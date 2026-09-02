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

(async () => {
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
    await db.collection("actors").doc(TEACHER_ID).set({ status: "active", plan: "closed_beta", teacherVerified: { schoolId: student.schoolId } });
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

    const committed = await call(change, token, { grade: "6", classNum: "3", confirm: true });
    assert.equal(committed.status, 200);
    assert.equal(committed.body.confirmed, true);
    assert.deepEqual(committed.body.profile, { schoolId: student.schoolId, schoolName: student.schoolName, grade: "6", classNum: "3", studentNumber: student.studentNumber, name: student.name });

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
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
