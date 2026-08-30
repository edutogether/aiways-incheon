"use strict";
// Demo emulators only. Confirms verifyTeacherCode: wrong code rejected, no
// code-set-for-school rejected distinctly, correct code marks the actor as
// teacherVerified for that schoolId, and checkTeacherStatus reflects it.
const assert = require("node:assert/strict"), http = require("node:http");
const { createHash } = require("node:crypto");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createCheckTeacherStatusHandler, createVerifyTeacherCodeHandler } = require("../lib/teacherAuth");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const ACTOR_ID = "teacher_auth_test_actor";
const SCHOOL_ID = "7321071";
const CODE = "sunrise-teachers-2026";
const NO_CODE_SCHOOL_ID = "9999999";

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

(async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uid = "";
  try {
    const signed = await signup();
    const token = signed.idToken;
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    await db.collection("actors").doc(ACTOR_ID).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(ACTOR_ID).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174601" });
    await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId: ACTOR_ID, status: "active" });
    await db.collection("teacherCodes").doc(SCHOOL_ID).set({ codeHash: createHash("sha256").update(CODE).digest("hex") });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const deps = { access, rateLimiter, actorRateLimiter, appCheck, db, serverTimestamp: () => FieldValue.serverTimestamp() };
    const checkStatus = createCheckTeacherStatusHandler(deps);
    const verify = createVerifyTeacherCodeHandler(deps);

    const before = await call(checkStatus, token, {});
    assert.equal(before.status, 200);
    assert.equal(before.body.verified, false);

    const noSuchSchool = await call(verify, token, { schoolId: NO_CODE_SCHOOL_ID, code: CODE });
    assert.equal(noSuchSchool.status, 404);
    assert.equal(noSuchSchool.body.code, "teacher_code_not_set");

    const wrongCode = await call(verify, token, { schoolId: SCHOOL_ID, code: "wrong-code-123" });
    assert.equal(wrongCode.status, 401);
    assert.equal(wrongCode.body.code, "invalid_code");
    const stillUnverified = await call(checkStatus, token, {});
    assert.equal(stillUnverified.body.verified, false, "a wrong attempt must not verify the actor");

    const correct = await call(verify, token, { schoolId: SCHOOL_ID, code: CODE });
    assert.equal(correct.status, 200);
    assert.equal(correct.body.verified, true);
    assert.equal(correct.body.schoolId, SCHOOL_ID);

    const after = await call(checkStatus, token, {});
    assert.equal(after.status, 200);
    assert.equal(after.body.verified, true);
    assert.equal(after.body.schoolId, SCHOOL_ID);

    const invalid = await call(verify, token, { schoolId: "", code: CODE });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "invalid_request");

    process.stdout.write(JSON.stringify({ teacherAuthEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    const actorRoot = db.collection("actors").doc(ACTOR_ID);
    for (const name of ["trustedDevices"]) {
      const snap = await actorRoot.collection(name).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(actorRoot);
    batch.delete(db.collection("teacherCodes").doc(SCHOOL_ID));
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
