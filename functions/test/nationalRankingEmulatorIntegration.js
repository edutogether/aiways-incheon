"use strict";
// Demo emulators only, needs auth+firestore+functions so the aggregation
// trigger actually populates schools/{id}/classes/* for multiple schools.
// Confirms: getNationalRanking sums correctly across schools, ranks by
// score, flags the caller's own school via isMine, and -- the actual point
// of step 8 -- never exposes any other school's class-level breakdown
// (grade, classNum, itemCounts, observedToday) anywhere in the response.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");
const { createGetNationalRankingHandler } = require("../lib/nationalRanking");
const { createGetSchoolDashboardHandler } = require("../lib/schoolDashboard");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const SCHOOL_A = "national_test_school_a";
const SCHOOL_B = "national_test_school_b";
const SCHOOL_C = "national_test_school_c";

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

function recordPayload(key, schoolId, grade, classNum, selectedItemId = "pet-bottle", schoolName = "") {
  return {
    schemaVersion: "sorting-record-v1", status: "completed", provider: "manual_select",
    analysis: { objectCandidates: [], materialCandidates: [], visibleCautions: [] }, checklist: [],
    userDecision: { selectedItemId, action: "recorded", userConfirmed: true }, hold: null,
    classContext: { schoolId, ...(schoolName ? { schoolName } : {}), grade, classNum }, idempotencyKey: key
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
  const actorId = "national_test_actor";
  try {
    const signed = await signup();
    const token = signed.idToken;
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    await db.collection("actors").doc(actorId).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(actorId).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614175101" });
    await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId, status: "active" });

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
        tx.create(idem, { recordId: ref.id, status: record.status, createdAt: response.createdAt, expireAt: response.expireAt });
        return { recordId: ref.id, status: record.status, ...response, duplicate: false };
      });
    } };
    async function seedOnCampusCheck() {
      const ref = db.collection("actors").doc(actorId).collection("campusChecks").doc();
      await ref.set({ onCampus: true, consumed: false, createdAt: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 120000) });
      return ref.id;
    }
    const save = createSaveSortingRecordHandler({ access, rateLimiter, actorRateLimiter, appCheck, store: recordStore, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const ranking = createGetNationalRankingHandler({ db, access, appCheck, rateLimiter, actorRateLimiter, logAppCheck: () => {} });
    const dashboard = createGetSchoolDashboardHandler({ db, access, appCheck, rateLimiter, actorRateLimiter, logAppCheck: () => {} });

    // School A: 3 completed records across two classes (score 3, highest).
    // School B: 1 completed record (score 1). School C: 0 records at all
    // (must not appear, or appear with score 0 -- either is fine, just no crash).
    let key = 174600;
    await call(save, token, recordPayload(String(key++), SCHOOL_A, "5", "1", "pet-bottle"));
    await call(save, token, recordPayload(String(key++), SCHOOL_A, "5", "1", "milk-carton"));
    await call(save, token, recordPayload(String(key++), SCHOOL_A, "6", "2", "can"));
    await call(save, token, recordPayload(String(key++), SCHOOL_B, "5", "1", "pet-bottle"));
    // idempotencyKey must look like a UUID for validateRecordRequest -- reuse the working pattern.
    const keys = ["123e4567-e89b-42d3-a456-426614175201", "123e4567-e89b-42d3-a456-426614175202", "123e4567-e89b-42d3-a456-426614175203", "123e4567-e89b-42d3-a456-426614175204"];
    const r1 = await call(save, token, { ...recordPayload(keys[0], SCHOOL_A, "5", "1", "pet-bottle", "가온초등학교"), campusCheckId: await seedOnCampusCheck() });
    const r2 = await call(save, token, { ...recordPayload(keys[1], SCHOOL_A, "5", "1", "milk-carton", "가온초등학교"), campusCheckId: await seedOnCampusCheck() });
    const r3 = await call(save, token, { ...recordPayload(keys[2], SCHOOL_A, "6", "2", "can", "가온초등학교"), campusCheckId: await seedOnCampusCheck() });
    const r4 = await call(save, token, { ...recordPayload(keys[3], SCHOOL_B, "5", "1", "pet-bottle"), campusCheckId: await seedOnCampusCheck() });
    assert.equal(r1.status, 201); assert.equal(r2.status, 201); assert.equal(r3.status, 201); assert.equal(r4.status, 201);

    await pollUntil(async () => {
      const a1 = await db.collection("schools").doc(SCHOOL_A).collection("classes").doc("5_1").get();
      const a2 = await db.collection("schools").doc(SCHOOL_A).collection("classes").doc("6_2").get();
      const b1 = await db.collection("schools").doc(SCHOOL_B).collection("classes").doc("5_1").get();
      return a1.data()?.completedTotal === 2 && a2.data()?.completedTotal === 1 && b1.data()?.completedTotal === 1 ? true : undefined;
    });

    const result = await call(ranking, token, { schoolId: SCHOOL_A });
    assert.equal(result.status, 200);
    assert.ok(result.body.schoolCount >= 2, "at least schools A and B must appear");
    const bySchool = new Map(result.body.schools.map((s) => [s.schoolId, s]));
    assert.equal(bySchool.get(SCHOOL_A).score, 3);
    assert.equal(bySchool.get(SCHOOL_A).rank, 1);
    assert.equal(bySchool.get(SCHOOL_A).isMine, true);
    assert.equal(bySchool.get(SCHOOL_A).schoolName, "가온초등학교", "schoolName written via classContext must surface in the ranking response");
    assert.equal(bySchool.get(SCHOOL_B).score, 1);
    assert.equal(bySchool.get(SCHOOL_B).isMine, false);
    assert.equal(bySchool.get(SCHOOL_B).schoolName, "", "a school that never sent schoolName must not crash, just show empty");
    assert.ok(bySchool.get(SCHOOL_B).rank > bySchool.get(SCHOOL_A).rank, "school B must rank below school A");
    assert.equal(SCHOOL_C in Object.fromEntries(bySchool), false, "a school with zero records should not need to appear");

    // The actual point of step 8: no class-level field ever appears anywhere
    // in this response, for ANY school -- not even the caller's own.
    const responseText = JSON.stringify(result.body);
    for (const forbidden of ["grade", "classNum", "itemCounts", "observedToday", "heldTotal", "topItems", "rankInGrade"]) {
      assert.equal(responseText.includes(forbidden), false, `response must never mention "${forbidden}"`);
    }

    // Without a schoolId, isMine is simply false for everyone (no crash, no default leak).
    const noHighlight = await call(ranking, token, {});
    assert.equal(noHighlight.status, 200);
    assert.ok(noHighlight.body.schools.every((s) => s.isMine === false));

    // getSchoolDashboard (already built in step 3) is the actual full-detail
    // channel for one's own school, unaffected by this endpoint's existence.
    const detail = await call(dashboard, token, { schoolId: SCHOOL_A });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.classCount, 2);

    process.stdout.write(JSON.stringify({ nationalRankingEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    const actorRoot = db.collection("actors").doc(actorId);
    for (const name of ["records", "_idempotency", "trustedDevices", "campusChecks"]) {
      const snap = await actorRoot.collection(name).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(actorRoot);
    for (const schoolId of [SCHOOL_A, SCHOOL_B, SCHOOL_C]) {
      const classesSnap = await db.collection("schools").doc(schoolId).collection("classes").get();
      classesSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(db.collection("schools").doc(schoolId));
    }
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
