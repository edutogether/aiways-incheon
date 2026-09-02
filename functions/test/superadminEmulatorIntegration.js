"use strict";
// Demo emulators only. Confirms manageTeacherCode: a signed-in user WITHOUT
// the superadmin custom claim is refused, a missing token is refused, and
// once the claim is granted, an issued code actually works end-to-end
// through verifyTeacherCode (not just written to Firestore -- proven usable).
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createManageTeacherCodeHandler } = require("../lib/superadmin");
const { createVerifyTeacherCodeHandler, teacherCodeDocId } = require("../lib/teacherAuth");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const SCHOOL_ID = "7321071";
const GRADE = "5", CLASS_NUM = "1";
const NEW_CODE = "rotated-teacher-code-2026";
const TEACHER_ACTOR_ID = "superadmin_test_teacher_actor";

function signup(payload = { returnSecureToken: true }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: authEmulator.hostname, port: authEmulator.port, path: "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let body = ""; res.on("data", (chunk) => (body += chunk)); res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end(JSON.stringify(payload));
  });
}

function refreshIdToken(refreshToken) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: authEmulator.hostname, port: authEmulator.port, path: "/securetoken.googleapis.com/v1/token?key=fake-api-key", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }, (res) => {
      let body = ""; res.on("data", (chunk) => (body += chunk)); res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end(`grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`);
  });
}

function call(handler, token, body) {
  const out = { headers: {} };
  const res = { set(k, v) { out.headers[k] = v; return this; }, status(s) { out.status = s; return this; }, json(v) { out.body = v; return this; }, send(v) { out.body = v; return this; } };
  return handler({ method: "POST", headers: { origin: "http://localhost:5173", "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body }, res).then(() => out);
}

(async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uid = "", teacherUid = "";
  try {
    const signed = await signup({ email: `superadmin-test-${Date.now()}@example.com`, password: "test-password-123", returnSecureToken: true });
    uid = signed.localId;
    const rateLimiter = createGlobalRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const deps = { db, rateLimiter, appCheck, verifyIdToken: (token) => auth.verifyIdToken(token), serverTimestamp: () => FieldValue.serverTimestamp() };
    const manage = createManageTeacherCodeHandler(deps);

    const forbidden = await call(manage, signed.idToken, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: NEW_CODE });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "superadmin_required", "a logged-in user without the claim must not manage teacher codes");

    const noToken = await call(manage, "", { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: NEW_CODE });
    assert.equal(noToken.status, 401);
    assert.equal(noToken.body.code, "auth_missing");

    await auth.setCustomUserClaims(uid, { role: "superadmin" });
    const refreshed = await refreshIdToken(signed.refreshToken);
    const superadminToken = refreshed.id_token;

    const invalidCode = await call(manage, superadminToken, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: "short" });
    assert.equal(invalidCode.status, 400);
    assert.equal(invalidCode.body.code, "invalid_request", "codes under 6 chars are rejected");

    const issued = await call(manage, superadminToken, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: NEW_CODE });
    assert.equal(issued.status, 200);
    assert.equal(issued.body.schoolId, SCHOOL_ID);
    assert.equal(issued.body.grade, GRADE);
    assert.equal(issued.body.classNum, CLASS_NUM);

    // 발급한 코드가 실제로 verifyTeacherCode에서 통하는지까지 끝까지
    // 확인한다 - Firestore에 해시가 써졌다는 것만으로는 부족하다.
    const studentAccess = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const actorRateLimiter = createActorRateLimiter({ db });
    const verify = createVerifyTeacherCodeHandler({ db, access: studentAccess, appCheck, rateLimiter, actorRateLimiter, serverTimestamp: () => FieldValue.serverTimestamp() });
    const teacherSignup = await signup();
    teacherUid = (await auth.verifyIdToken(teacherSignup.idToken)).uid;
    await db.collection("actors").doc(TEACHER_ACTOR_ID).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(TEACHER_ACTOR_ID).collection("trustedDevices").doc(teacherUid).set({ uid: teacherUid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174621" });
    await db.collection("edu2gDeviceBindings").doc(teacherUid).set({ actorId: TEACHER_ACTOR_ID, status: "active" });
    const verified = await call(verify, teacherSignup.idToken, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: NEW_CODE });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.verified, true, "a code issued via manageTeacherCode must actually work for verifyTeacherCode");

    process.stdout.write(JSON.stringify({ superadminEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (teacherUid) batch.delete(db.collection("edu2gDeviceBindings").doc(teacherUid));
    const teacherRoot = db.collection("actors").doc(TEACHER_ACTOR_ID);
    const devices = await teacherRoot.collection("trustedDevices").get();
    devices.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(teacherRoot);
    batch.delete(db.collection("teacherCodes").doc(teacherCodeDocId(SCHOOL_ID, GRADE, CLASS_NUM)));
    await batch.commit();
    if (uid) await auth.deleteUser(uid).catch(() => {});
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
