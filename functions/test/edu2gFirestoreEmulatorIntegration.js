"use strict";
// Runs only in demo-aiways-incheon emulators. It uses synthetic approved login IDs and
// an injected valid App Check observation; no production service is contacted.
const assert = require("node:assert/strict");
const http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gPassRegistry } = require("../lib/edu2gPassRegistry");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createFirestoreDeviceStore, createEdu2gHandlers } = require("../lib/edu2gPassHandlers");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
function request(path, body) { return new Promise((resolve, reject) => { const req = http.request({ hostname: authEmulator.hostname, port: authEmulator.port, path, method: "POST", headers: { "Content-Type": "application/json" } }, res => { let data = ""; res.on("data", chunk => data += chunk); res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data || "{}") })); }); req.on("error", reject); req.end(JSON.stringify(body)); }); }
function response() { return { set() { return this; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, send() { return this; } }; }
function call(handler, token, body) { const res = response(); return handler({ method: "POST", headers: { origin: "http://localhost:5173", "content-type": "application/json", authorization: `Bearer ${token}` }, body }, res).then(() => res); }

(async () => {
  const app = getApps()[0] || initializeApp({ projectId }); const auth = getAuth(app); const db = getFirestore(app);
  const registry = createEdu2gPassRegistry({ getSecret: () => JSON.stringify({ version: 2, participants: [
    { loginId: "test alpha", actorId: "actor_alpha", displayName: "알파", enabled: true, maxDevices: 5 },
    { loginId: "test beta", actorId: "actor_beta", displayName: "베타", enabled: true, maxDevices: 5 }
  ] }) });
  const store = createFirestoreDeviceStore({ db, serverTimestamp: () => FieldValue.serverTimestamp() });
  const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
  const handlers = createEdu2gHandlers({ registry, store, access, appCheck: async () => ({ status: "valid" }), rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) } });
  const tokens = []; const uids = [];
  try {
    for (let index = 0; index < 6; index += 1) { const signup = await request("/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", { returnSecureToken: true }); assert.equal(signup.status, 200); const decoded = await auth.verifyIdToken(signup.body.idToken); assert.equal(decoded.firebase.sign_in_provider, "anonymous"); tokens.push(signup.body.idToken); uids.push(decoded.uid); }
    for (let index = 0; index < 4; index += 1) { const out = await call(handlers.redeem, tokens[index], { loginId: "test alpha", deviceLabel: `기기 ${index + 1}`, platform: "web", confirm: true }); assert.equal(out.statusCode, 200); assert.equal(out.body.activeDeviceCount, index + 1); }
    const concurrent = await Promise.all([call(handlers.redeem, tokens[4], { loginId: "test alpha", deviceLabel: "기기 5", platform: "web", confirm: true }), call(handlers.redeem, tokens[5], { loginId: "test alpha", deviceLabel: "기기 6", platform: "web", confirm: true })]);
    assert.equal(concurrent.filter(item => item.statusCode === 200).length, 1); assert.equal(concurrent.filter(item => item.body.code === "device_limit_reached").length, 1); const deniedIndex = concurrent[0].statusCode === 409 ? 4 : 5;
    const alpha = await db.collection("actors").doc("actor_alpha").get(); assert.equal(alpha.data().activeDeviceCount, 5);
    const repeat = await call(handlers.redeem, tokens[0], { loginId: "test alpha", deviceLabel: "기기 1", platform: "web", confirm: true }); assert.equal(repeat.body.alreadyRegistered, true);
    const rebind = await call(handlers.redeem, tokens[0], { loginId: "test beta", deviceLabel: "기기 1", platform: "web", confirm: true }); assert.equal(rebind.body.code, "device_already_bound");
    const beta = await call(handlers.redeem, tokens[deniedIndex], { loginId: "test beta", deviceLabel: "베타 기기", platform: "web", confirm: true }); assert.equal(beta.statusCode, 200);
    const session = await call(handlers.session, tokens[0], {}); assert.equal(session.statusCode, 200); assert.equal(session.body.plan, "closed_beta");
    const listed = await call(handlers.list, tokens[0], {}); assert.equal(listed.statusCode, 200); assert.equal(JSON.stringify(listed.body).includes("uid"), false); assert.equal(listed.body.devices.every(device => /^[0-9a-f-]{36}$/i.test(device.managementId)), true);
    const target = listed.body.devices.find(device => !device.currentDevice); assert.ok(target);
    const betaList = await call(handlers.list, tokens[deniedIndex], {}); const cross = await call(handlers.revoke, tokens[0], { targetManagementId: betaList.body.devices[0].managementId, confirm: true }); assert.equal(cross.statusCode, 404);
    const revoked = await call(handlers.revoke, tokens[0], { targetManagementId: target.managementId, confirm: true }); assert.equal(revoked.statusCode, 200); assert.equal(revoked.body.activeDeviceCount, 4);
    const again = await call(handlers.revoke, tokens[0], { targetManagementId: target.managementId, confirm: true }); assert.equal(again.body.alreadyRevoked, true);
    const targetUid = (await db.collection("actors").doc("actor_alpha").collection("trustedDevices").where("managementId", "==", target.managementId).limit(1).get()).docs[0].id;
    const targetToken = tokens[uids.indexOf(targetUid)]; const revokedAccess = await access.resolve({ headers: { authorization: `Bearer ${targetToken}` } }); assert.equal(revokedAccess.code, "device_revoked");
    const all = await Promise.all([db.collection("actors").doc("actor_alpha").collection("trustedDevices").get(), db.collection("edu2gDeviceBindings").get()]); assert.equal(JSON.stringify(all.map(snap => snap.docs.map(doc => doc.data()))).includes("test alpha"), false); assert.equal(JSON.stringify(all.map(snap => snap.docs.map(doc => doc.data()))).includes("idToken"), false);
    process.stdout.write(JSON.stringify({ authFirestoreTransactionIntegration: "passed", activeDevices: 5, concurrentSixth: "one_blocked" }) + "\n");
  } finally {
    const batch = db.batch(); for (const actorId of ["actor_alpha", "actor_beta"]) { const devices = await db.collection("actors").doc(actorId).collection("trustedDevices").get(); devices.docs.forEach(doc => batch.delete(doc.ref)); batch.delete(db.collection("actors").doc(actorId)); } uids.forEach(uid => batch.delete(db.collection("edu2gDeviceBindings").doc(uid))); await batch.commit();
  }
})().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
