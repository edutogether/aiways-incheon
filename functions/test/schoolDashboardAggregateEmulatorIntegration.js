"use strict";
// Demo emulators only, needs auth+firestore+functions running (the Firestore
// trigger only fires while the Functions emulator is up and watching the
// same Firestore emulator instance). Proves the full loop end to end: a
// saveSortingRecord write -> onSortingRecordWritten trigger -> aggregate doc
// update -> getSchoolDashboard read, including the held->completed
// conversion path via resolveSortingRecord.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");
const { createResolveSortingRecordHandler } = require("../lib/sortingRecordQuery");
const { createGetSchoolDashboardHandler } = require("../lib/schoolDashboard");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const SCHOOL_ID = "dashboard_test_school";

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

function recordPayload(key, { status = "completed", selectedItemId = "pet-bottle", grade = "5", classNum = "1" } = {}) {
  return {
    schemaVersion: "sorting-record-v1", status, provider: status === "held" ? "manual_hold" : "manual_select",
    analysis: { objectCandidates: [], materialCandidates: [], visibleCautions: [] }, checklist: [],
    userDecision: { selectedItemId, action: status === "held" ? "held" : "recorded", userConfirmed: true },
    hold: status === "held" ? { recommended: true, reasons: ["check"] } : null,
    classContext: { schoolId: SCHOOL_ID, grade, classNum }, idempotencyKey: key
  };
}

async function pollUntil(check, { timeoutMs = 8000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() > deadline) throw new Error("timed out waiting for trigger effect");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
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
    const actorId = "dashboard_test_actor";
    await db.collection("actors").doc(actorId).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(actorId).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174401" });
    await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId, status: "active" });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const store = {
      async createOrGet(actorIdArg, key, record, response) {
        const actor = db.collection("actors").doc(actorIdArg);
        const idem = actor.collection("_idempotency").doc(key);
        return db.runTransaction(async (tx) => {
          const prior = await tx.get(idem);
          if (prior.exists) return { ...prior.data(), duplicate: true };
          const ref = actor.collection("records").doc();
          tx.create(ref, record);
          tx.create(idem, { recordId: ref.id, status: record.status, createdAt: response.createdAt, expireAt: response.expireAt });
          return { recordId: ref.id, status: record.status, ...response, duplicate: false };
        });
      },
      async resolve(actorIdArg, b, serverTime) {
        const record = db.collection("actors").doc(actorIdArg).collection("records").doc(b.recordId);
        const key = db.collection("actors").doc(actorIdArg).collection("_resolutions").doc(b.idempotencyKey);
        return db.runTransaction(async (tx) => {
          const prior = await tx.get(key);
          if (prior.exists) return { ...prior.data(), duplicate: true };
          const snap = await tx.get(record);
          if (!snap.exists) return { code: "not_found" };
          if (snap.data().status !== "held") return { code: "conflict" };
          const result = { recordId: b.recordId, status: "completed", resolutionType: b.resolutionType, duplicate: false };
          tx.update(record, { status: "completed", updatedAt: serverTime, resolvedAt: serverTime, resolutionType: b.resolutionType, userDecision: b.userDecision, checklist: b.checklist });
          tx.create(key, result);
          return result;
        });
      }
    };
    const appCheck = async () => ({ status: "valid" });
    const save = createSaveSortingRecordHandler({ access, rateLimiter, actorRateLimiter, appCheck, store, serverTimestamp: () => FieldValue.serverTimestamp() });
    const resolve = createResolveSortingRecordHandler({ store, access, appCheck, serverTimestamp: () => FieldValue.serverTimestamp(), rateLimiter, actorRateLimiter, logAppCheck: () => {} });
    const dashboard = createGetSchoolDashboardHandler({ db, access, appCheck, rateLimiter, actorRateLimiter, logAppCheck: () => {} });

    // Two completed records in 5학년 1반, one in 5학년 2반, one held record
    // in 5학년 1반 later resolved to completed (tests the conversion path).
    const r1 = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174501", { selectedItemId: "pet-bottle" }));
    const r2 = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174502", { selectedItemId: "pet-bottle" }));
    const r3 = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174503", { grade: "5", classNum: "2", selectedItemId: "milk-carton" }));
    const held = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174504", { status: "held", selectedItemId: "이상한 물건" }));
    assert.equal(r1.status, 201); assert.equal(r2.status, 201); assert.equal(r3.status, 201); assert.equal(held.status, 201);

    const classRef = db.collection("schools").doc(SCHOOL_ID).collection("classes").doc("5_1");
    const afterCreates = await pollUntil(async () => {
      const snap = await classRef.get();
      const data = snap.data();
      return data && data.observedToday === 3 && data.heldTotal === 1 ? data : null;
    });
    assert.equal(afterCreates.completedTotal, 2);
    assert.equal(afterCreates.itemCounts["pet-bottle"], 2);
    assert.equal(afterCreates.itemCounts["이상한 물건"], 1);

    const resolved = await call(resolve, token, { recordId: held.body.recordId, idempotencyKey: "123e4567-e89b-42d3-a456-426614174505", resolutionType: "confirmed_after_review", userDecision: { userConfirmed: true }, checklist: [{ checked: true }] });
    assert.equal(resolved.status, 200);

    const afterResolve = await pollUntil(async () => {
      const snap = await classRef.get();
      const data = snap.data();
      return data && data.convertedTotal === 1 ? data : null;
    });
    assert.equal(afterResolve.heldTotal, 0);
    assert.equal(afterResolve.completedTotal, 3);
    // observedToday must NOT double-count the resolve -- it only counts new records.
    assert.equal(afterResolve.observedToday, 3);

    const schoolView = await call(dashboard, token, { schoolId: SCHOOL_ID });
    assert.equal(schoolView.status, 200);
    assert.equal(schoolView.body.classCount, 2);
    assert.equal(schoolView.body.school.observedToday, 4);
    assert.equal(schoolView.body.school.completedTotal, 4);
    assert.equal(schoolView.body.school.heldTotal, 0);
    assert.deepEqual(schoolView.body.gradeBars, [{ grade: "5", observedToday: 4 }]);

    const classView = await call(dashboard, token, { schoolId: SCHOOL_ID, grade: "5", classNum: "1" });
    assert.equal(classView.status, 200);
    assert.equal(classView.body.selectedClass.observedToday, 3);
    assert.equal(classView.body.selectedClass.convertedTotal, 1);
    assert.equal(classView.body.selectedClass.topItems[0].itemId, "pet-bottle");
    assert.equal(classView.body.selectedClass.topItems[0].count, 2);
    assert.equal(classView.body.selectedClass.rankInGrade, 1);
    assert.equal(classView.body.selectedClass.gradeSize, 2);

    const badSelector = await call(dashboard, token, { schoolId: SCHOOL_ID, grade: "5" });
    assert.equal(badSelector.status, 400);
    assert.equal(badSelector.body.code, "invalid_class_selector");

    process.stdout.write(JSON.stringify({ schoolDashboardAggregateEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    const actorRoot = db.collection("actors").doc("dashboard_test_actor");
    for (const name of ["records", "_idempotency", "_resolutions", "trustedDevices"]) {
      const snap = await actorRoot.collection(name).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(actorRoot);
    const classesSnap = await db.collection("schools").doc(SCHOOL_ID).collection("classes").get();
    classesSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection("schools").doc(SCHOOL_ID));
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
