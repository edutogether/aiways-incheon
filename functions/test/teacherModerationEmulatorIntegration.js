"use strict";
// Demo emulators only. 2026-09-09에 가입 승인 대기열을 없애고 교사 사후정리로
// 바꾸면서 추가된 세 엔드포인트(listClassStudents/describeStudent/
// moderateStudent)를 검증한다.
//
// 이 기능은 되돌릴 수 없는 삭제 권한을 "그 반 교사코드를 아는 기기"에 주는
// 것이라(Bumm님 확정), 방어가 실제로 동작하는지가 특히 중요하다. 그래서
// 아래를 전부 실행으로 확인한다:
//   - 다른 반 교사가 지정하면 404(존재 자체를 숨김)
//   - 클라이언트가 학교/학년/반을 지정할 방법이 없다(unknown_field)
//   - 차단하면 보호된 엔드포인트가 "각각" 403 actor_blocked를 낸다
//   - 차단 시 번호 점유가 풀려서 그 번호로 다시 가입할 수 있다
//   - 삭제 건수가 실제로 지워진 수와 맞는다
//   - 감사 로그가 남는다
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createListClassStudentsHandler, createDescribeStudentHandler, createModerateStudentHandler } = require("../lib/teacherModeration");
const { createListSortingRecordsHandler } = require("../lib/sortingRecordQuery");
const { createCheckStudentProfileHandler, createRegisterStudentProfileHandler } = require("../lib/studentProfile");
const { createRecordQueryStore } = require("../lib/sortingRecordQueryStore");
const { studentNumberClaimRef } = require("../lib/studentNumberClaim");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const STUDENT_ACTOR_ID = "moderation_test_student";
const OTHER_ACTOR_ID = "moderation_test_other_class_student";
const TEACHER_ACTOR_ID = "moderation_test_teacher";
const SCHOOL = "7361064";
const GRADE = "6", CLASS_NUM = "3", STUDENT_NUMBER = "11";
const OTHER_CLASS_NUM = "5";

function signup() {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: authEmulator.hostname, port: authEmulator.port, path: "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let body = ""; res.on("data", (chunk) => (body += chunk)); res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end(JSON.stringify({ returnSecureToken: true }));
  });
}

function call(handler, token, body) {
  const out = { headers: {} };
  const res = { set(k, v) { out.headers[k] = v; return this; }, status(s) { out.status = s; return this; }, json(v) { out.body = v; return this; }, send(v) { out.body = v; return this; } };
  return handler({ method: "POST", headers: { origin: "http://localhost:5173", "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body }, res).then(() => out);
}

test("teacherModeration: 반 스코프 강제, 차단이 실제 403을 내고 번호 점유가 풀리며, 삭제 건수가 실제와 맞는다", async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const audit = [];
  const uids = [];
  try {
    const studentSignup = await signup(), otherSignup = await signup(), teacherSignup = await signup();
    const studentToken = studentSignup.idToken, teacherToken = teacherSignup.idToken;
    const studentUid = (await auth.verifyIdToken(studentToken)).uid;
    const otherUid = (await auth.verifyIdToken(otherSignup.idToken)).uid;
    const teacherUid = (await auth.verifyIdToken(teacherToken)).uid;
    uids.push(studentUid, otherUid, teacherUid);

    let device = 4700;
    async function bind(actorId, uid) {
      device += 1;
      await db.collection("actors").doc(actorId).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: `123e4567-e89b-42d3-a456-42661417${device}` });
      await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId, status: "active" });
    }

    // 학생: 6학년 3반 11번. 기록 3건.
    await db.collection("actors").doc(STUDENT_ACTOR_ID).set({
      status: "active", plan: "closed_beta",
      studentProfile: { schoolId: SCHOOL, schoolName: "테스트초등학교", grade: GRADE, classNum: CLASS_NUM, studentNumber: STUDENT_NUMBER, name: "홍길동", registeredAt: FieldValue.serverTimestamp() }
    });
    await studentNumberClaimRef(db, SCHOOL, GRADE, CLASS_NUM, STUDENT_NUMBER).set({ actorId: STUDENT_ACTOR_ID, claimedAt: FieldValue.serverTimestamp() });
    for (let i = 0; i < 3; i += 1) {
      await db.collection("actors").doc(STUDENT_ACTOR_ID).collection("records").doc(`rec${i}`).set({ status: "completed", classContext: { schoolId: SCHOOL, grade: GRADE, classNum: CLASS_NUM } });
    }
    // 개인 랭킹 문서도 있어야 "지웠는데 이름이 남는" 상황을 검증할 수 있다.
    await db.collection("schools").doc(SCHOOL).collection("classes").doc(`${GRADE}_${CLASS_NUM}`).collection("students").doc(STUDENT_NUMBER).set({ studentNumber: STUDENT_NUMBER, studentName: "홍길동" });

    // 다른 반(6학년 5반) 학생 - 교사가 건드릴 수 없어야 한다.
    await db.collection("actors").doc(OTHER_ACTOR_ID).set({
      status: "active", plan: "closed_beta",
      studentProfile: { schoolId: SCHOOL, schoolName: "테스트초등학교", grade: GRADE, classNum: OTHER_CLASS_NUM, studentNumber: "1", name: "다른반학생", registeredAt: FieldValue.serverTimestamp() }
    });

    // 교사: 6학년 3반만 인증돼 있다.
    await db.collection("actors").doc(TEACHER_ACTOR_ID).set({
      status: "active", plan: "closed_beta",
      teacherVerified: { schoolId: SCHOOL, grade: GRADE, classNum: CLASS_NUM, verifiedAt: FieldValue.serverTimestamp() }
    });
    await bind(STUDENT_ACTOR_ID, studentUid);
    await bind(OTHER_ACTOR_ID, otherUid);
    await bind(TEACHER_ACTOR_ID, teacherUid);

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const logger = (entry) => audit.push(entry);
    const deps = { db, access, appCheck, rateLimiter, actorRateLimiter, logger, serverTimestamp: () => FieldValue.serverTimestamp() };
    const listStudents = createListClassStudentsHandler(deps);
    const describe = createDescribeStudentHandler(deps);
    const moderate = createModerateStudentHandler(deps);

    // --- 명부: 자기 반 학생만 보인다 ---
    const roster = await call(listStudents, teacherToken, {});
    assert.equal(roster.status, 200);
    const names = (roster.body.students || []).map((s) => s.name);
    assert.ok(names.includes("홍길동"), "자기 반 학생은 명부에 있어야 한다");
    assert.ok(!names.includes("다른반학생"), "다른 반 학생이 명부에 새면 안 된다");

    // --- 클라이언트가 학교/학년/반을 지정할 방법이 없다 ---
    const injected = await call(describe, teacherToken, { targetActorId: OTHER_ACTOR_ID, grade: GRADE, classNum: OTHER_CLASS_NUM });
    assert.equal(injected.status, 400);
    assert.equal(injected.body.code, "unknown_field");

    // --- 반 스코프: 다른 반 학생은 404(존재 자체를 숨김) ---
    const otherDescribe = await call(describe, teacherToken, { targetActorId: OTHER_ACTOR_ID });
    assert.equal(otherDescribe.status, 404);
    assert.equal(otherDescribe.body.code, "not_found");
    const otherModerate = await call(moderate, teacherToken, { targetActorId: OTHER_ACTOR_ID, blockAccount: true, deleteRecords: true });
    assert.equal(otherModerate.status, 404, "다른 반 학생을 지울 수 있으면 안 된다");
    assert.equal((await db.collection("actors").doc(OTHER_ACTOR_ID).get()).exists, true, "다른 반 학생 문서가 남아 있어야 한다");

    // --- 삭제 전 조회: 확인창이 보여줄 건수가 실제와 맞아야 한다 ---
    const detail = await call(describe, teacherToken, { targetActorId: STUDENT_ACTOR_ID });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.recordCount, 3, "확인창에 보여줄 건수가 실제 기록 수와 달라선 안 된다");
    assert.equal(detail.body.blocked, false);
    assert.equal(detail.body.student.name, "홍길동");

    // --- 기록만 삭제(차단은 안 함) ---
    const deleted = await call(moderate, teacherToken, { targetActorId: STUDENT_ACTOR_ID, deleteRecords: true });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.deletedRecords, 3, "보여준 건수와 실제 지운 수가 같아야 한다");
    assert.equal((await db.collection("actors").doc(STUDENT_ACTOR_ID).collection("records").get()).size, 0);
    assert.equal((await db.collection("schools").doc(SCHOOL).collection("classes").doc(`${GRADE}_${CLASS_NUM}`).collection("students").doc(STUDENT_NUMBER).get()).exists, false,
      "기록을 지웠으면 개인 랭킹에 이름이 남아 있으면 안 된다");
    // 차단은 안 했으므로 아직 접속 가능해야 한다.
    assert.equal((await db.collection("blockedActors").doc(STUDENT_ACTOR_ID).get()).exists, false, "기록 삭제만 했는데 계정이 차단되면 안 된다");

    // --- 차단 ---
    const blocked = await call(moderate, teacherToken, { targetActorId: STUDENT_ACTOR_ID, blockAccount: true });
    assert.equal(blocked.status, 200);
    assert.equal(blocked.body.blocked, true);
    assert.equal((await db.collection("blockedActors").doc(STUDENT_ACTOR_ID).get()).exists, true);

    // --- 차단이 실제로 403을 내는지: 엔드포인트별로 확인 ---
    const blockedActors = { async isBlocked(actorId) { return (await db.collection("blockedActors").doc(actorId).get()).exists; } };
    const guarded = { ...deps, blockedActors };
    const checkProfile = createCheckStudentProfileHandler(guarded);
    const listRecords = createListSortingRecordsHandler({ ...guarded, store: createRecordQueryStore({ db }) });
    for (const [name, handler, body] of [["checkStudentProfile", checkProfile, {}], ["listSortingRecords", listRecords, {}]]) {
      const res = await call(handler, studentToken, body);
      assert.equal(res.status, 403, `${name}이 차단된 기기를 막지 못했다`);
      assert.equal(res.body.code, "actor_blocked", `${name}의 거부 사유가 actor_blocked가 아니다`);
    }

    // --- 차단하면 번호 점유가 풀려서 그 번호로 다시 가입할 수 있다 ---
    assert.equal((await studentNumberClaimRef(db, SCHOOL, GRADE, CLASS_NUM, STUDENT_NUMBER).get()).exists, false,
      "차단했으면 번호 점유가 풀려야 잘못 가입한 학생을 다시 넣을 수 있다");
    const rejoinSignup = await signup();
    const rejoinToken = rejoinSignup.idToken;
    const rejoinUid = (await auth.verifyIdToken(rejoinToken)).uid;
    uids.push(rejoinUid);
    const REJOIN_ACTOR_ID = "moderation_test_rejoin";
    await db.collection("actors").doc(REJOIN_ACTOR_ID).set({ status: "active", plan: "closed_beta" });
    await bind(REJOIN_ACTOR_ID, rejoinUid);
    const register = createRegisterStudentProfileHandler({ ...deps, blockedActors, searchSchool: async () => ({ ok: true, schoolName: "테스트초등학교" }) });
    const rejoin = await call(register, rejoinToken, { schoolId: SCHOOL, schoolName: "테스트초등학교", grade: GRADE, classNum: CLASS_NUM, studentNumber: STUDENT_NUMBER, name: "새학생", confirm: true });
    assert.equal(rejoin.status, 200, `풀린 번호로 다시 가입이 돼야 한다 (실제: ${JSON.stringify(rejoin.body)})`);
    assert.equal((await db.collection("actors").doc(REJOIN_ACTOR_ID).get()).data()?.studentProfile?.name, "새학생");

    // --- 감사 로그 ---
    const moderationLogs = audit.filter((e) => e.message === "student_moderated");
    assert.equal(moderationLogs.length, 2, "차단·삭제가 각각 감사로그로 남아야 한다");
    assert.ok(moderationLogs.every((e) => e.teacherActorId === TEACHER_ACTOR_ID && e.targetActorId === STUDENT_ACTOR_ID),
      "누가 누구를 조작했는지가 로그에 남아야 한다");
    assert.ok(moderationLogs.some((e) => e.deletedRecords === 3), "삭제 건수가 로그에 남아야 한다");
    assert.ok(moderationLogs.some((e) => e.blockAccount === true), "차단 여부가 로그에 남아야 한다");

    process.stdout.write(JSON.stringify({ teacherModerationEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    for (const uid of uids) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    for (const actorId of [STUDENT_ACTOR_ID, OTHER_ACTOR_ID, TEACHER_ACTOR_ID, "moderation_test_rejoin"]) {
      const root = db.collection("actors").doc(actorId);
      for (const sub of ["trustedDevices", "records"]) {
        const snap = await root.collection(sub).get();
        snap.docs.forEach((d) => batch.delete(d.ref));
      }
      batch.delete(root);
      batch.delete(db.collection("blockedActors").doc(actorId));
    }
    batch.delete(studentNumberClaimRef(db, SCHOOL, GRADE, CLASS_NUM, STUDENT_NUMBER));
    batch.delete(db.collection("schools").doc(SCHOOL).collection("classes").doc(`${GRADE}_${CLASS_NUM}`).collection("students").doc(STUDENT_NUMBER));
    await batch.commit();
  }
}, 40000);
