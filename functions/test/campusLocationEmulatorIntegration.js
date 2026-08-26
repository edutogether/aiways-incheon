"use strict";
// Demo emulators only, needs auth+firestore+functions (aggregation trigger
// must fire to prove off-campus records are excluded from class/school
// competition). Confirms: coordinates never get stored, on-campus records
// count toward the class aggregate, off-campus and reused/expired check ids
// do not, and an unconfigured school fails safe to off-campus.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");
const { createCheckCampusLocationHandler } = require("../lib/campusLocation");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const ACTOR_ID = "campus_test_actor";
const SCHOOL_ID = "campus_test_school";
// Seoul City Hall-ish coordinates, arbitrary -- only used as a fixed campus
// center + a point ~50m away (inside a 100m radius) and a point ~5km away
// (well outside) for the distance math, nothing location-sensitive.
const CAMPUS = { lat: 37.5665, lng: 126.9780, radiusMeters: 100 };
const ON_CAMPUS_POINT = { lat: 37.56694, lng: 126.9780 }; // ~49m north
const OFF_CAMPUS_POINT = { lat: 37.61, lng: 126.9780 }; // ~4.8km north

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

function recordPayload(key, extra = {}) {
  return {
    schemaVersion: "sorting-record-v1", status: "completed", provider: "manual_select",
    analysis: { objectCandidates: [], materialCandidates: [], visibleCautions: [] }, checklist: [],
    userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true }, hold: null,
    classContext: { schoolId: SCHOOL_ID, grade: "5", classNum: "1" }, idempotencyKey: key, ...extra
  };
}

async function pollUntil(check, { timeoutMs = 8000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result !== undefined) return result;
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
    await db.collection("actors").doc(ACTOR_ID).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(ACTOR_ID).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174801" });
    await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId: ACTOR_ID, status: "active" });
    await db.collection("schoolCampuses").doc(SCHOOL_ID).set(CAMPUS);

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
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
    const check = createCheckCampusLocationHandler({ access, rateLimiter, actorRateLimiter, appCheck, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const save = createSaveSortingRecordHandler({ access, rateLimiter, actorRateLimiter, appCheck, store: recordStore, db, serverTimestamp: () => FieldValue.serverTimestamp() });

    // 1. On-campus point resolves true, and no coordinate ever lands in Firestore.
    const onCheck = await call(check, token, { schoolId: SCHOOL_ID, ...ON_CAMPUS_POINT });
    assert.equal(onCheck.status, 200);
    assert.equal(onCheck.body.onCampus, true);
    const onCheckDoc = await db.collection("actors").doc(ACTOR_ID).collection("campusChecks").doc(onCheck.body.campusCheckId).get();
    const onCheckData = onCheckDoc.data();
    assert.equal(Object.hasOwn(onCheckData, "lat"), false);
    assert.equal(Object.hasOwn(onCheckData, "lng"), false);
    assert.equal(onCheckData.onCampus, true);
    assert.equal(onCheckData.consumed, false);

    // 2. Off-campus point resolves false.
    const offCheck = await call(check, token, { schoolId: SCHOOL_ID, ...OFF_CAMPUS_POINT });
    assert.equal(offCheck.status, 200);
    assert.equal(offCheck.body.onCampus, false);

    // 3. Unconfigured school fails safe to off-campus, no error.
    const unknownCheck = await call(check, token, { schoolId: "no_such_school", ...ON_CAMPUS_POINT });
    assert.equal(unknownCheck.status, 200);
    assert.equal(unknownCheck.body.onCampus, false);

    const classRef = db.collection("schools").doc(SCHOOL_ID).collection("classes").doc("5_1");

    // 4. On-campus record: saved with onCampus:true, and DOES count toward the class aggregate.
    const onSave = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174901", { campusCheckId: onCheck.body.campusCheckId }));
    assert.equal(onSave.status, 201);
    const onSaveDoc = await db.collection("actors").doc(ACTOR_ID).collection("records").doc(onSave.body.recordId).get();
    assert.equal(onSaveDoc.data().onCampus, true);
    const afterOn = await pollUntil(async () => {
      const snap = await classRef.get();
      const data = snap.data();
      return data && data.observedToday === 1 ? data : undefined;
    });
    assert.equal(afterOn.observedToday, 1);

    // 5. Off-campus record: saved with onCampus:false, does NOT move the aggregate.
    const offSave = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174902", { campusCheckId: offCheck.body.campusCheckId }));
    assert.equal(offSave.status, 201);
    const offSaveDoc = await db.collection("actors").doc(ACTOR_ID).collection("records").doc(offSave.body.recordId).get();
    assert.equal(offSaveDoc.data().onCampus, false);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // give a wrongly-firing trigger a chance to show up
    const stillOne = (await classRef.get()).data();
    assert.equal(stillOne.observedToday, 1, "off-campus record must not be counted");

    // 6. Reusing an already-consumed campusCheckId fails safe to off-campus (not a second true).
    const reuseSave = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174903", { campusCheckId: onCheck.body.campusCheckId }));
    assert.equal(reuseSave.status, 201);
    const reuseDoc = await db.collection("actors").doc(ACTOR_ID).collection("records").doc(reuseSave.body.recordId).get();
    assert.equal(reuseDoc.data().onCampus, false);

    // 7. No campusCheckId at all (GPS never attempted): saved fine, but does NOT
    // count toward class competition either -- only a verified onCampus:true
    // counts. This is the same "확인 안 됨 = 제외" rule as an explicit denial.
    const noCheckSave = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174904"));
    assert.equal(noCheckSave.status, 201);
    const noCheckDoc = await db.collection("actors").doc(ACTOR_ID).collection("records").doc(noCheckSave.body.recordId).get();
    assert.equal(Object.hasOwn(noCheckDoc.data(), "onCampus"), false);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const stillOneAfterNoCheck = (await classRef.get()).data();
    assert.equal(stillOneAfterNoCheck.observedToday, 1, "a record with no campus check at all must not be counted either");

    process.stdout.write(JSON.stringify({ campusLocationEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    const actorRoot = db.collection("actors").doc(ACTOR_ID);
    for (const name of ["trustedDevices", "records", "_idempotency", "campusChecks"]) {
      const snap = await actorRoot.collection(name).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(actorRoot);
    batch.delete(db.collection("schoolCampuses").doc(SCHOOL_ID));
    const classesSnap = await db.collection("schools").doc(SCHOOL_ID).collection("classes").get();
    classesSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection("schools").doc(SCHOOL_ID));
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
