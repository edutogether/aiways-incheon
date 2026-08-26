"use strict";
// Demo emulators only. Confirms the one-time real-name signup double-confirm
// flow (confirm:false previews, confirm:true commits) and that the lock is
// permanent -- a second registration attempt, even from the same device,
// is rejected outright rather than silently overwriting the first one.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createCheckStudentProfileHandler, createRegisterStudentProfileHandler } = require("../lib/studentProfile");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const ACTOR_ID = "student_profile_test_actor";

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
  let uid = "";
  try {
    const signed = await signup();
    const token = signed.idToken;
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    await db.collection("actors").doc(ACTOR_ID).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(ACTOR_ID).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174601" });
    await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId: ACTOR_ID, status: "active" });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const deps = { access, rateLimiter, actorRateLimiter, appCheck, db, serverTimestamp: () => FieldValue.serverTimestamp() };
    const check = createCheckStudentProfileHandler(deps);
    const register = createRegisterStudentProfileHandler(deps);

    const before = await call(check, token, {});
    assert.equal(before.status, 200);
    assert.equal(before.body.hasProfile, false);

    const preview = await call(register, token, { ...student, confirm: false });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.confirmed, false);
    assert.deepEqual(preview.body.preview, student);
    const stillEmpty = await call(check, token, {});
    assert.equal(stillEmpty.body.hasProfile, false, "preview (confirm:false) must not write anything");

    const committed = await call(register, token, { ...student, confirm: true });
    assert.equal(committed.status, 201);
    assert.equal(committed.body.confirmed, true);
    assert.deepEqual(committed.body.profile, student);

    // The whole point of signup: once a verified profile exists, a student
    // can no longer just edit the interim form to fake a different class --
    // saveSortingRecord must ignore whatever classContext the client sends
    // and use the server-verified profile instead.
    const recordStore = { async createOrGet(actorIdArg, key, record, response) {
      const actor = db.collection("actors").doc(actorIdArg);
      const idem = actor.collection("_idempotency").doc(key);
      return db.runTransaction(async (tx) => {
        const prior = await tx.get(idem);
        if (prior.exists) return { ...prior.data(), duplicate: true };
        const ref = actor.collection("records").doc();
        tx.create(ref, record);
        tx.create(idem, { recordId: ref.id, status: record.status, createdAt: response.createdAt });
        return { recordId: ref.id, status: record.status, ...response, duplicate: false };
      });
    } };
    const save = createSaveSortingRecordHandler({ access, rateLimiter, actorRateLimiter, appCheck, store: recordStore, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const spoofedPayload = {
      schemaVersion: "sorting-record-v1", status: "completed", provider: "manual_select",
      analysis: { objectCandidates: [], materialCandidates: [], visibleCautions: [] }, checklist: [],
      userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true }, hold: null,
      classContext: { schoolId: "9999999", schoolName: "가짜학교", grade: "9", classNum: "9" },
      idempotencyKey: "123e4567-e89b-42d3-a456-426614174701"
    };
    const saved = await call(save, token, spoofedPayload);
    assert.equal(saved.status, 201);
    const savedDoc = await db.collection("actors").doc(ACTOR_ID).collection("records").doc(saved.body.recordId).get();
    // studentNumber/studentName도 서버가 프로필에서 채워넣는다(개인별
    // 랭킹 6단계) - "name"이 아니라 "studentName"인 이유는 FORBIDDEN_KEY의
    // \bname\b 때문(위와 같은 이유로 schoolName도 그냥 "name"을 못 씀).
    assert.deepEqual(savedDoc.data().classContext, { schoolId: student.schoolId, schoolName: student.schoolName, grade: student.grade, classNum: student.classNum, studentNumber: student.studentNumber, studentName: student.name });

    const after = await call(check, token, {});
    assert.equal(after.status, 200);
    assert.equal(after.body.hasProfile, true);
    assert.deepEqual(after.body.profile, student);

    // Permanent lock: a second registration, even with different details,
    // is rejected outright -- this endpoint never overwrites.
    const retry = await call(register, token, { ...student, name: "다른이름", confirm: true });
    assert.equal(retry.status, 409);
    assert.equal(retry.body.code, "already_registered");
    assert.deepEqual(retry.body.profile, student);

    const invalid = await call(register, token, { schoolId: "", grade: "5", classNum: "1", studentNumber: "12", name: "홍길동", confirm: false });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "invalid_request");

    process.stdout.write(JSON.stringify({ studentProfileEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    const actorRoot = db.collection("actors").doc(ACTOR_ID);
    for (const name of ["trustedDevices", "records", "_idempotency"]) {
      const snap = await actorRoot.collection(name).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(actorRoot);
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
