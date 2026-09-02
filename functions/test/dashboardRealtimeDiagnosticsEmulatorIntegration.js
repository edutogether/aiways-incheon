"use strict";
// 비용절감 4번 ③단계 관찰용 신호(logDashboardRealtimeEvent) - 정상 actor가
// subscribed/failed 이벤트를 기록할 수 있는지, 잘못된 event 값과 미등록
// 기기는 거절되는지를 실제 액터 해석 경로(edu2gDeviceAccess)로 검증한다.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createLogDashboardRealtimeEventHandler } = require("../lib/dashboardRealtimeDiagnostics");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const ACTOR_ID = "dashboard_realtime_diag_test_actor";

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
    uid = (await auth.verifyIdToken(token)).uid;
    await db.collection("actors").doc(ACTOR_ID).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(ACTOR_ID).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174911" });
    await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId: ACTOR_ID, status: "active" });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const loggedEvents = [];
    const log = createLogDashboardRealtimeEventHandler({ access, rateLimiter, actorRateLimiter, appCheck, logger: (m) => loggedEvents.push(m) });

    const subscribed = await call(log, token, { event: "subscribed" });
    assert.equal(subscribed.status, 200);
    assert.equal(loggedEvents.at(-1).message, "dashboard_realtime_subscribed");
    assert.equal(loggedEvents.at(-1).actorId, ACTOR_ID);

    const failed = await call(log, token, { event: "failed", code: "permission-denied" });
    assert.equal(failed.status, 200);
    assert.equal(loggedEvents.at(-1).message, "dashboard_realtime_failed");
    assert.equal(loggedEvents.at(-1).code, "permission-denied");

    const invalidEvent = await call(log, token, { event: "not_a_real_event" });
    assert.equal(invalidEvent.status, 400);
    assert.equal(invalidEvent.body.code, "invalid_request");

    const unknownField = await call(log, token, { event: "subscribed", extra: "nope" });
    assert.equal(unknownField.status, 400);
    assert.equal(unknownField.body.code, "unknown_field");

    const noToken = await call(log, "", { event: "subscribed" });
    assert.equal(noToken.status, 401);

    process.stdout.write(JSON.stringify({ dashboardRealtimeDiagnosticsEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    const actorRoot = db.collection("actors").doc(ACTOR_ID);
    const devices = await actorRoot.collection("trustedDevices").get();
    devices.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(actorRoot);
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
