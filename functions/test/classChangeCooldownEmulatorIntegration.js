"use strict";
// Demo emulators only. Confirms: registration starts the cooldown clock, an
// immediate class-change attempt is rejected (429 cooldown_active) with the
// student's actual class unchanged, and once the cooldown has genuinely
// elapsed (simulated by backdating lastChangedAt -- not by waiting 24h) the
// change goes through and is recorded in changeHistory. Also confirms a
// no-op request (same grade/classNum) and an unregistered device are
// rejected distinctly.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createRegisterStudentProfileHandler, createChangeStudentClassHandler, createCheckStudentProfileHandler } = require("../lib/studentProfile");
const { createDecideRegistrationHandler } = require("../lib/registrationApproval");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const ACTOR_ID = "class_change_test_actor";
const TEACHER_ID = "class_change_test_teacher";
const ACTOR2_ID = "class_change_test_actor2";
const TEACHER2_ID = "class_change_test_teacher2";

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

const student = { schoolId: "7321071", schoolName: "테스트초등학교", grade: "5", classNum: "1", studentNumber: "12", name: "홍길동" };

test("changeStudentClass cooldown: 24h clock starts at registration, backdated cooldown allows a real change recorded in changeHistory, no-op and unregistered rejected distinctly", async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uid = "", teacherUid = "";
  try {
    const signed = await signup();
    const token = signed.idToken;
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    await db.collection("actors").doc(ACTOR_ID).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(ACTOR_ID).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614175001" });
    await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId: ACTOR_ID, status: "active" });

    // 2026-08-31 3단 권한체계 도입 이후 registerStudentProfile은 즉시
    // studentProfile을 만들지 않고 승인대기열에 넣는다(202) - 이 아래
    // 쿨다운 테스트가 실제로 studentProfile을 가지고 동작하려면 교사
    // 승인을 거쳐야 한다. 승인용 교사 actor를 별도로 준비한다.
    const teacherSigned = await signup();
    const teacherToken = teacherSigned.idToken;
    teacherUid = (await auth.verifyIdToken(teacherToken)).uid;
    await db.collection("actors").doc(TEACHER_ID).set({ status: "active", plan: "closed_beta", teacherVerified: { schoolId: student.schoolId, grade: student.grade, classNum: student.classNum } });
    await db.collection("actors").doc(TEACHER_ID).collection("trustedDevices").doc(teacherUid).set({ uid: teacherUid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614175002" });
    await db.collection("edu2gDeviceBindings").doc(teacherUid).set({ actorId: TEACHER_ID, status: "active" });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const deps = { access, rateLimiter, actorRateLimiter, appCheck, db, serverTimestamp: () => FieldValue.serverTimestamp() };
    const register = createRegisterStudentProfileHandler(deps);
    const change = createChangeStudentClassHandler(deps);
    const check = createCheckStudentProfileHandler(deps);
    const decide = createDecideRegistrationHandler(deps);

    // Not registered yet -- a change attempt must fail distinctly from a cooldown rejection.
    const beforeSignup = await call(change, token, { grade: "5", classNum: "2", confirm: false });
    assert.equal(beforeSignup.status, 409);
    assert.equal(beforeSignup.body.code, "not_registered");

    const registered = await call(register, token, { ...student, confirm: true });
    assert.equal(registered.status, 202);
    const approved = await call(decide, teacherToken, { targetActorId: ACTOR_ID, decision: "approve" });
    assert.equal(approved.status, 200);

    // Registration itself starts the cooldown clock -- an immediate change attempt is blocked.
    const immediatePreview = await call(change, token, { grade: "5", classNum: "2", confirm: false });
    assert.equal(immediatePreview.status, 429);
    assert.equal(immediatePreview.body.code, "cooldown_active");
    assert.ok(immediatePreview.body.retryAfterSeconds > 0 && immediatePreview.body.retryAfterSeconds <= 24 * 60 * 60);
    const immediateCommit = await call(change, token, { grade: "5", classNum: "2", confirm: true });
    assert.equal(immediateCommit.status, 429);
    const stillOldClass = await call(check, token, {});
    assert.deepEqual(stillOldClass.body.profile, student);

    // Requesting the exact same class the student already has is a distinct
    // rejection (no_change) -- but only reachable once cooldown clears, so
    // backdate lastChangedAt to simulate 25 hours having passed.
    await db.collection("actors").doc(ACTOR_ID).update({ "studentProfile.lastChangedAt": new Date(Date.now() - 25 * 60 * 60 * 1000) });
    const noChangeAttempt = await call(change, token, { grade: "5", classNum: "1", confirm: false });
    assert.equal(noChangeAttempt.status, 400);
    assert.equal(noChangeAttempt.body.code, "no_change");

    // Cooldown has elapsed and this is a real change -- preview must not write anything.
    const preview = await call(change, token, { grade: "6", classNum: "3", confirm: false });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.confirmed, false);
    assert.deepEqual(preview.body.preview, { schoolId: student.schoolId, schoolName: student.schoolName, grade: "6", classNum: "3", studentNumber: student.studentNumber, name: student.name });
    const stillPreChange = await call(check, token, {});
    assert.deepEqual(stillPreChange.body.profile, student, "preview must not write anything");

    // 2026-09-07 종합감사 - 반을 옮기면 옛 반의 개인랭킹 문서(실명+번호가
    // 그대로 들어있는 schools/*/classes/{옛 학년_반}/students/{번호})도 같이
    // 지워져야 한다. 안 지우면 ①떠난 반의 "우리반 실천왕"에 그 학생 이름이
    // 계속 뜨고 ②studentAnonymization.js는 "지금 소속된 반"만 지우므로
    // 삭제 요청을 받아도 옛 반의 실명·번호는 영원히 남는다.
    const oldStudentRef = db.collection("schools").doc(student.schoolId).collection("classes").doc(`${student.grade}_${student.classNum}`).collection("students").doc(student.studentNumber);
    await oldStudentRef.set({ studentNumber: student.studentNumber, studentName: student.name, completedTotal: 3 });

    const committed = await call(change, token, { grade: "6", classNum: "3", confirm: true });
    assert.equal(committed.status, 200);
    assert.equal(committed.body.confirmed, true);
    assert.deepEqual(committed.body.profile, { schoolId: student.schoolId, schoolName: student.schoolName, grade: "6", classNum: "3", studentNumber: student.studentNumber, name: student.name });

    assert.equal((await oldStudentRef.get()).exists, false, "옛 반의 개인랭킹 문서(실명+번호)는 반 이동과 함께 삭제돼야 한다");

    const afterChange = await call(check, token, {});
    assert.equal(afterChange.body.profile.grade, "6");
    assert.equal(afterChange.body.profile.classNum, "3");
    assert.equal(afterChange.body.profile.schoolId, student.schoolId, "school/name/number must be untouched by a class change");

    const actorDoc = await db.collection("actors").doc(ACTOR_ID).get();
    const history = actorDoc.data().studentProfile.changeHistory;
    assert.equal(history.length, 1);
    assert.equal(history[0].fromGrade, "5");
    assert.equal(history[0].fromClassNum, "1");
    assert.equal(history[0].toGrade, "6");
    assert.equal(history[0].toClassNum, "3");

    // The clock reset on this change too -- another immediate attempt is blocked again.
    const secondImmediate = await call(change, token, { grade: "5", classNum: "1", confirm: false });
    assert.equal(secondImmediate.status, 429);
    assert.equal(secondImmediate.body.code, "cooldown_active");

    // 학생 소속 자기신고 검증 구멍 좁히기 - changeStudentClass 자체도 그
    // 반의 번호 하나를 새로 차지하는 것이므로, 이미 그 번호를 쓰는 학생이
    // 있는 반으로는 못 옮겨야 한다(registrationApproval.js의 승인 시점
    // 검사와는 별개 경로 - changeStudentClass의 자체 클레임 검사를 직접
    // 검증한다). ACTOR2를 일단 다른 반(6학년 4반)에 12번으로 승인시킨 뒤,
    // ACTOR_ID가 이미 차지한 6학년 3반 12번으로 옮기려 시도한다.
    const signed2 = await signup();
    const token2 = signed2.idToken;
    const uid2 = (await auth.verifyIdToken(token2)).uid;
    await db.collection("actors").doc(ACTOR2_ID).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(ACTOR2_ID).collection("trustedDevices").doc(uid2).set({ uid: uid2, status: "active", managementId: "123e4567-e89b-42d3-a456-426614175003" });
    await db.collection("edu2gDeviceBindings").doc(uid2).set({ actorId: ACTOR2_ID, status: "active" });
    const teacherSigned2 = await signup();
    const teacherToken2 = teacherSigned2.idToken;
    const teacherUid2 = (await auth.verifyIdToken(teacherToken2)).uid;
    await db.collection("actors").doc(TEACHER2_ID).set({ status: "active", plan: "closed_beta", teacherVerified: { schoolId: student.schoolId, grade: "6", classNum: "4" } });
    await db.collection("actors").doc(TEACHER2_ID).collection("trustedDevices").doc(teacherUid2).set({ uid: teacherUid2, status: "active", managementId: "123e4567-e89b-42d3-a456-426614175004" });
    await db.collection("edu2gDeviceBindings").doc(teacherUid2).set({ actorId: TEACHER2_ID, status: "active" });
    try {
      const registered2 = await call(register, token2, { ...student, grade: "6", classNum: "4", confirm: true });
      assert.equal(registered2.status, 202);
      const approved2 = await call(decide, teacherToken2, { targetActorId: ACTOR2_ID, decision: "approve" });
      assert.equal(approved2.status, 200);
      await db.collection("actors").doc(ACTOR2_ID).update({ "studentProfile.lastChangedAt": new Date(Date.now() - 25 * 60 * 60 * 1000) });
      const collision = await call(change, token2, { grade: "6", classNum: "3", confirm: true });
      assert.equal(collision.status, 409);
      assert.equal(collision.body.code, "student_number_taken");
      const stillInOldClass = await call(check, token2, {});
      assert.equal(stillInOldClass.body.profile.classNum, "4", "a collision must not move the student at all");
    } finally {
      await db.collection("edu2gDeviceBindings").doc(uid2).delete();
      await db.collection("edu2gDeviceBindings").doc(teacherUid2).delete();
      const batch2 = db.batch();
      for (const actorId of [ACTOR2_ID, TEACHER2_ID]) {
        const actorRoot = db.collection("actors").doc(actorId);
        const devicesSnap = await actorRoot.collection("trustedDevices").get();
        devicesSnap.docs.forEach((d) => batch2.delete(d.ref));
        batch2.delete(actorRoot);
      }
      batch2.delete(db.collection("studentNumberClaims").doc(`${student.schoolId}_6_4_${student.studentNumber}`));
      await batch2.commit();
    }

    process.stdout.write(JSON.stringify({ classChangeCooldownEmulatorIntegration: "passed" }) + "\n");
  } finally {
    if (uid) await db.collection("edu2gDeviceBindings").doc(uid).delete();
    if (teacherUid) await db.collection("edu2gDeviceBindings").doc(teacherUid).delete();
    const batch = db.batch();
    for (const actorId of [ACTOR_ID, TEACHER_ID]) {
      const actorRoot = db.collection("actors").doc(actorId);
      const devicesSnap = await actorRoot.collection("trustedDevices").get();
      devicesSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(actorRoot);
    }
    batch.delete(db.collection("studentNumberClaims").doc(`${student.schoolId}_${student.grade}_${student.classNum}_${student.studentNumber}`));
    batch.delete(db.collection("studentNumberClaims").doc(`${student.schoolId}_6_3_${student.studentNumber}`));
    batch.delete(db.collection("schools").doc(student.schoolId).collection("classes").doc(`${student.grade}_${student.classNum}`).collection("students").doc(student.studentNumber));
    await batch.commit();
  }
});
