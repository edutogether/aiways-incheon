"use strict";
// Demo emulators only. Confirms the exact payload shape mobile/app.js's
// submitSortingRecord() sends (interim classContext field, added for the
// mobile-backend-wiring step) actually persists in Firestore end to end --
// not just passes schema validation in isolation.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);

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

// Mirrors mobile/app.js's submitSortingRecord() exactly: manual quick-select
// (no analysis candidates) plus the interim classContext form's shape.
function mobileManualPayload(key, classContext) {
  return {
    schemaVersion: "sorting-record-v1", status: "completed", provider: "manual_select",
    analysis: { objectCandidates: [], materialCandidates: [], visibleCautions: [] }, checklist: [],
    userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true },
    hold: null, ...(classContext ? { classContext } : {}), idempotencyKey: key
  };
}

// Mirrors mobile/app.js's addHoldItem() -> submitSortingRecord({status:"held"}).
function mobileHeldPayload(key, classContext) {
  return {
    schemaVersion: "sorting-record-v1", status: "held", provider: "manual_hold",
    analysis: { objectCandidates: [], materialCandidates: [], visibleCautions: [] }, checklist: [],
    userDecision: { selectedItemId: "이상한 스프링 공책", action: "held", userConfirmed: true },
    hold: { recommended: true, reasons: ["학생 직접 등록"] }, ...(classContext ? { classContext } : {}), idempotencyKey: key
  };
}

(async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uid = "";
  try {
    const signed = await signup();
    const signedToken = signed.idToken;
    const decoded = await auth.verifyIdToken(signedToken);
    uid = decoded.uid;
    const actorId = "mobile_class_context_actor";
    await db.collection("actors").doc(actorId).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(actorId).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174201" });
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
          tx.create(idem, { recordId: ref.id, status: record.status, createdAt: response.createdAt });
          return { recordId: ref.id, status: record.status, ...response, duplicate: false };
        });
      }
    };
    const save = createSaveSortingRecordHandler({ access, rateLimiter, actorRateLimiter, appCheck: async () => ({ status: "valid" }), store, serverTimestamp: () => FieldValue.serverTimestamp() });

    // 2026-09-01: schoolId는 이 시점엔 이미 NEIS 표준학교코드(숫자)로
    // 전환돼 있었다(CLAUDE.md "자유텍스트에서 NEIS 학교코드로 전환") -
    // 이 테스트는 그 전 시절 그대로 학교명을 schoolId 자리에 넣고 있어서
    // cleanSchoolId가 전부 거부해 CI에 걸면 항상 400으로 실패했다
    // (2026-09-01 종합감사 중 발견, dependencies에 db가 없어 classContext
    // 신뢰 재감사 수정과는 무관 - 순수 스키마 검증 단계에서만 걸림).
    const classContext = { schoolId: "7321071", schoolName: "테스트초등학교", grade: "5", classNum: "1" };

    // 1. Manual quick-select confirmation, with classContext (the common case).
    const completed = await call(save, signedToken, mobileManualPayload("123e4567-e89b-42d3-a456-426614174301", classContext));
    assert.equal(completed.status, 201);
    const completedDoc = await db.collection("actors").doc("mobile_class_context_actor").collection("records").doc(completed.body.recordId).get();
    assert.deepEqual(completedDoc.data().classContext, classContext);
    assert.equal(completedDoc.data().provider, "manual_select");
    assert.deepEqual(completedDoc.data().analysis.objectCandidates, []);

    // 2. Hold registration, with classContext.
    const held = await call(save, signedToken, mobileHeldPayload("123e4567-e89b-42d3-a456-426614174302", classContext));
    assert.equal(held.status, 201);
    const heldDoc = await db.collection("actors").doc("mobile_class_context_actor").collection("records").doc(held.body.recordId).get();
    assert.deepEqual(heldDoc.data().classContext, classContext);
    assert.equal(heldDoc.data().userDecision.selectedItemId, "이상한 스프링 공책");

    // 3. No class picked yet (student hasn't filled the interim form) -- record
    // must still save successfully, just without a classContext field.
    const noContext = await call(save, signedToken, mobileManualPayload("123e4567-e89b-42d3-a456-426614174303"));
    assert.equal(noContext.status, 201);
    const noContextDoc = await db.collection("actors").doc("mobile_class_context_actor").collection("records").doc(noContext.body.recordId).get();
    assert.equal("classContext" in noContextDoc.data(), false);

    // 4. Malformed classContext (missing a required field) is rejected outright.
    const bad = await call(save, signedToken, mobileManualPayload("123e4567-e89b-42d3-a456-426614174304", { schoolId: "7321071", grade: "5" }));
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, "invalid_class_context");

    process.stdout.write(JSON.stringify({ mobileClassContextEmulatorIntegration: "passed", recordsWritten: 3 }) + "\n");
  } finally {
    const batch = db.batch();
    if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    const root = db.collection("actors").doc("mobile_class_context_actor");
    for (const name of ["records", "_idempotency", "trustedDevices"]) {
      const snap = await root.collection(name).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(root);
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
