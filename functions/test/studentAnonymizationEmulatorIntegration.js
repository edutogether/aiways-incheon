"use strict";
// Demo emulators only. Confirms anonymizeStudent (2026-09-02, 삭제·탈퇴 경로
// 대응): teacherVerified 교사만, 자기 학교 학생만 익명화할 수 있고(다른
// 학교는 404로 숨김), 이름/번호는 실제로 지워지지만 반 집계(classRef의
// completedTotal)는 줄지 않으며, 개인 랭킹 서브문서는 통째로 삭제되고,
// 이미 익명화된 학생을 다시 익명화하면 409로 깔끔히 막힌다.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createAnonymizeStudentHandler } = require("../lib/studentAnonymization");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const STUDENT_ACTOR_ID = "anonymize_test_student";
const TEACHER_A_ID = "anonymize_test_teacher_a";
const TEACHER_B_ID = "anonymize_test_teacher_b";
const SCHOOL_A = "7321071";
const SCHOOL_B = "9999999";
const GRADE = "5", CLASS_NUM = "1", STUDENT_NUMBER = "9";
const classDocId = `${GRADE}_${CLASS_NUM}`;

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

test("anonymizeStudent: same-school teacher only, name/number erased but class aggregate untouched, personal ranking doc deleted, re-anonymize rejected", async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let studentUid = "", teacherAUid = "", teacherBUid = "";
  try {
    const studentSignup = await signup(), teacherASignup = await signup(), teacherBSignup = await signup();
    const teacherAToken = teacherASignup.idToken, teacherBToken = teacherBSignup.idToken;
    studentUid = (await auth.verifyIdToken(studentSignup.idToken)).uid;
    teacherAUid = (await auth.verifyIdToken(teacherAToken)).uid;
    teacherBUid = (await auth.verifyIdToken(teacherBToken)).uid;

    async function bind(actorId, uid) {
      await db.collection("actors").doc(actorId).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174711" });
      await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId, status: "active" });
    }
    await db.collection("actors").doc(STUDENT_ACTOR_ID).set({
      status: "active", plan: "closed_beta",
      studentProfile: { schoolId: SCHOOL_A, schoolName: "테스트초등학교", grade: GRADE, classNum: CLASS_NUM, studentNumber: STUDENT_NUMBER, name: "홍길동", registeredAt: FieldValue.serverTimestamp() }
    });
    await bind(STUDENT_ACTOR_ID, studentUid);
    await db.collection("actors").doc(TEACHER_A_ID).set({ status: "active", plan: "closed_beta", teacherVerified: { schoolId: SCHOOL_A, grade: GRADE, classNum: CLASS_NUM } });
    await bind(TEACHER_A_ID, teacherAUid);
    await db.collection("actors").doc(TEACHER_B_ID).set({ status: "active", plan: "closed_beta", teacherVerified: { schoolId: SCHOOL_B, grade: GRADE, classNum: CLASS_NUM } });
    await bind(TEACHER_B_ID, teacherBUid);

    // 개인 랭킹 서브문서(이미 반영된 실적)와 반 집계 문서를 직접 심어서,
    // "집계는 그대로, 개인 식별만 삭제"를 검증할 준비를 한다.
    const classRef = db.collection("schools").doc(SCHOOL_A).collection("classes").doc(classDocId);
    const studentRef = classRef.collection("students").doc(STUDENT_NUMBER);
    await classRef.set({ schoolId: SCHOOL_A, grade: GRADE, classNum: CLASS_NUM, completedTotal: 7, heldTotal: 0, itemCounts: {} });
    await studentRef.set({ studentNumber: STUDENT_NUMBER, studentName: "홍길동", completedTotal: 3 });
    // 학생 소속 자기신고 검증 구멍 좁히기 - 실제 승인(registrationApproval.js)
    // 경로였다면 여기 클레임 문서가 같이 생겼을 것이다. 재현을 위해 직접 심어두고,
    // 익명화가 이 번호를 실제로 풀어주는지(다음 전학생이 같은 번호를 쓸 수 있게)
    // 아래에서 확인한다.
    const claimRef = db.collection("studentNumberClaims").doc(`${SCHOOL_A}_${GRADE}_${CLASS_NUM}_${STUDENT_NUMBER}`);
    await claimRef.set({ actorId: STUDENT_ACTOR_ID, claimedAt: FieldValue.serverTimestamp() });

    // 2026-09-07 종합감사 - 익명화가 studentProfile/개인랭킹만 지우고
    // 실제 기록(actors/*/records)의 classContext.studentNumber/studentName은
    // 안 지우고 있었다 - exportClassRecords(CSV 반전체 내보내기)가 정확히
    // 이 두 필드를 CSV에 싣기 때문에, 삭제 요청 후에도 실명·번호가 CSV로
    // 계속 유출되는 실제 결함이었다. 실제 기록 한 건을 심어서 정리되는지
    // 확인한다.
    const recordRef = db.collection("actors").doc(STUDENT_ACTOR_ID).collection("records").doc("anonymize-test-record");
    await recordRef.set({
      schemaVersion: "sorting-record-v1", status: "completed", provider: "manual_select",
      userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true },
      classContext: { schoolId: SCHOOL_A, grade: GRADE, classNum: CLASS_NUM, studentNumber: STUDENT_NUMBER, studentName: "홍길동" },
      createdAt: FieldValue.serverTimestamp()
    });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const anonymize = createAnonymizeStudentHandler({ db, access, rateLimiter, actorRateLimiter, appCheck, serverTimestamp: () => FieldValue.serverTimestamp() });

    // 다른 학교 교사는 대상 학생이 아예 안 보인 것처럼 404.
    const otherSchoolAttempt = await call(anonymize, teacherBToken, { targetActorId: STUDENT_ACTOR_ID });
    assert.equal(otherSchoolAttempt.status, 404);
    assert.equal(otherSchoolAttempt.body.code, "student_not_found");

    // 같은 학교 교사는 성공.
    const result = await call(anonymize, teacherAToken, { targetActorId: STUDENT_ACTOR_ID });
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);

    const actorAfter = (await db.collection("actors").doc(STUDENT_ACTOR_ID).get()).data();
    assert.equal(actorAfter.studentProfile.anonymized, true);
    assert.equal("name" in actorAfter.studentProfile, false, "name must actually be gone, not just blanked");
    assert.equal("studentNumber" in actorAfter.studentProfile, false, "studentNumber must actually be gone");
    assert.equal(actorAfter.studentProfile.schoolId, SCHOOL_A, "school/grade/class stay so the device can still contribute to class totals");
    assert.equal(actorAfter.studentProfile.grade, GRADE);
    // 2026-09-07 종합감사 - transaction.set을 merge:false로 쓰면 actors/{actorId}
    // 문서 "전체"가 { studentProfile: {...} } 하나로 교체돼서, status/plan이
    // 사라져 그 기기가 edu2gDeviceAccess.js에서 영구히 actor_unavailable(403)에
    // 갇히는 실제 회귀가 있었다 - 이 필드들이 익명화 후에도 그대로 남아있는지
    // 직접 확인한다.
    assert.equal(actorAfter.status, "active", "top-level actor fields (status) must survive anonymization, not just studentProfile");
    assert.equal(actorAfter.plan, "closed_beta", "top-level actor fields (plan) must survive anonymization -- otherwise edu2gDeviceAccess.js locks this device out permanently");

    const studentDocAfter = await studentRef.get();
    assert.equal(studentDocAfter.exists, false, "the per-student ranking subdocument must be deleted entirely");

    const classDocAfter = await classRef.get();
    assert.equal(classDocAfter.data().completedTotal, 7, "class-level aggregate must be untouched by anonymizing one student");

    const claimAfter = await claimRef.get();
    assert.equal(claimAfter.exists, false, "anonymizing must release the studentNumberClaim so a real new transfer student can take the same number");

    const recordAfter = (await recordRef.get()).data();
    assert.equal("studentNumber" in recordAfter.classContext, false, "past records must also lose studentNumber, or exportClassRecords keeps leaking it after a deletion request");
    assert.equal("studentName" in recordAfter.classContext, false, "past records must also lose studentName, or exportClassRecords keeps leaking it after a deletion request");
    assert.equal(recordAfter.classContext.schoolId, SCHOOL_A, "non-identifying classContext fields (schoolId/grade/classNum) stay so class aggregates remain consistent");

    // 이미 익명화된 학생을 다시 익명화하면 깔끔히 막힌다.
    const redo = await call(anonymize, teacherAToken, { targetActorId: STUDENT_ACTOR_ID });
    assert.equal(redo.status, 409);
    assert.equal(redo.body.code, "already_anonymized");

    process.stdout.write(JSON.stringify({ studentAnonymizationEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    for (const [actorId, uid] of [[STUDENT_ACTOR_ID, studentUid], [TEACHER_A_ID, teacherAUid], [TEACHER_B_ID, teacherBUid]]) {
      if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
      const actorRoot = db.collection("actors").doc(actorId);
      const devices = await actorRoot.collection("trustedDevices").get();
      devices.docs.forEach((d) => batch.delete(d.ref));
      const records = await actorRoot.collection("records").get();
      records.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(actorRoot);
    }
    const classRef = db.collection("schools").doc(SCHOOL_A).collection("classes").doc(classDocId);
    batch.delete(classRef.collection("students").doc(STUDENT_NUMBER));
    batch.delete(classRef);
    batch.delete(db.collection("studentNumberClaims").doc(`${SCHOOL_A}_${GRADE}_${CLASS_NUM}_${STUDENT_NUMBER}`));
    await batch.commit();
  }
});
