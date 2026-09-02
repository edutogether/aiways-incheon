"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createFirestoreDeviceStore } = require("../lib/deviceBindingStore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");

const projectId = "demo-aiways-incheon";
const actorKeys = ["a", "b", "c", "d", "e"];

function configureProject() {
  process.env.GCLOUD_PROJECT = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!authHost || !firestoreHost) {
    throw new Error(
      "CB-5 integration requires FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST.",
    );
  }
  const authUrl = new URL(`http://${authHost}`);
  if (!authUrl.port) throw new Error("FIREBASE_AUTH_EMULATOR_HOST must include a port.");
  return { authUrl };
}

function signup(authUrl) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: authUrl.hostname,
        port: authUrl.port,
        path: "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, body: JSON.parse(body || "{}") }),
        );
      },
    );
    request.on("error", reject);
    request.end(JSON.stringify({ returnSecureToken: true }));
  });
}

function call(handler, token, body, options = {}) {
  const response = {
    headers: {},
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(jsonBody) {
      this.body = jsonBody;
      return this;
    },
    send(bodyValue) {
      this.body = bodyValue;
      return this;
    },
  };
  return handler(
    {
      method: options.method || "POST",
      headers: {
        origin: "http://localhost:5173",
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body,
    },
    response,
  ).then(() => response);
}

// 2026-09-02: 클로즈베타 시크릿코드 시스템(edu2gPassRegistry.js/
// edu2gPassHandlers.js, 대표님 지시로 폐기) 위에서 이 25개 기기 매트릭스를
// 만들고 있었는데, 그 시스템이 없어져도 saveSortingRecord/기록조회 쪽
// 동시성 테스트(cb5DeviceMatrixEmulatorIntegration.js/
// cb5RecordResolveRecoveryEmulatorIntegration.js)는 그대로 유효하고
// 계속 필요하다 - HTTP 핸들러+loginId 레지스트리 경유 대신
// deviceBindingStore.js의 store.redeem/list/revoke를 직접 호출해서
// 같은 매트릭스를 만들도록 바꿨다(만드는 결과물은 동일: actor당 활성
// 기기 5개, 6번째는 거절).
async function setupCb5DeviceMatrix() {
  const { authUrl } = configureProject();
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const participants = actorKeys.map((key, index) => ({
    actorId: `cb5_actor_${key}`,
    displayName: `CB5 ${key}`,
  }));
  const store = createFirestoreDeviceStore({
    db,
    serverTimestamp: () => FieldValue.serverTimestamp(),
  });
  const access = createEdu2gDeviceAccess({
    auth,
    db,
    serverTimestamp: () => FieldValue.serverTimestamp(),
  });
  const users = [];

  for (let actorIndex = 0; actorIndex < actorKeys.length; actorIndex += 1) {
    const group = [];
    for (let deviceIndex = 0; deviceIndex < 6; deviceIndex += 1) {
      const signed = await signup(authUrl);
      assert.equal(signed.status, 200);
      const decoded = await auth.verifyIdToken(signed.body.idToken);
      group.push({ token: signed.body.idToken, uid: decoded.uid });
    }
    users.push(group);
    const participant = participants[actorIndex];
    for (let deviceIndex = 0; deviceIndex < 5; deviceIndex += 1) {
      const result = await store.redeem({
        uid: group[deviceIndex].uid,
        actor: { ...participant, deviceLabel: `${actorKeys[actorIndex]}${deviceIndex + 1}`, platform: "web" },
      });
      assert.equal(result.ok, true);
    }
    const sixth = await store.redeem({
      uid: group[5].uid,
      actor: { ...participant, deviceLabel: `${actorKeys[actorIndex]}6`, platform: "web" },
    });
    assert.equal(sixth.code, "device_limit_reached");
  }

  await assertActiveDeviceMatrix({ db });
  return { app, auth, db, store, access, users, actorKeys, participants };
}

async function assertActiveDeviceMatrix({ db }) {
  let activeDevices = 0;
  for (const actorKey of actorKeys) {
    const actorRef = db.collection("actors").doc(`cb5_actor_${actorKey}`);
    const actor = await actorRef.get();
    assert.equal(actor.data().activeDeviceCount, 5);
    const active = await actorRef.collection("trustedDevices").where("status", "==", "active").get();
    assert.equal(active.size, 5);
    activeDevices += active.size;
  }
  assert.equal(activeDevices, 25);
  return activeDevices;
}

async function revokeAndReplaceDevice(fixture, actorIndex) {
  const { db, store, users, actorKeys, participants } = fixture;
  const actorId = `cb5_actor_${actorKeys[actorIndex]}`;
  const devices = await store.list(actorId, users[actorIndex][0].uid);
  const target = devices.find((device) => !device.currentDevice);
  assert.ok(target);
  const revokeResult = await store.revoke(actorId, target.managementId, users[actorIndex][0].uid);
  assert.equal(revokeResult.ok, true);
  const targetDocument = await db
    .collection("actors")
    .doc(actorId)
    .collection("trustedDevices")
    .where("managementId", "==", target.managementId)
    .get();
  const revoked = users[actorIndex].find((user) => user.uid === targetDocument.docs[0].id);
  assert.ok(revoked);
  const replaceResult = await store.redeem({
    uid: users[actorIndex][5].uid,
    actor: { ...participants[actorIndex], deviceLabel: `${actorKeys[actorIndex]}6`, platform: "web" },
    replaceManagementId: target.managementId,
  });
  assert.equal(replaceResult.ok, true);
  await assertActiveDeviceMatrix({ db });
  return { revoked, replacement: users[actorIndex][5] };
}

async function cleanupCb5Fixture({ db, users, actorKeys: keys = actorKeys }) {
  const batch = db.batch();
  for (const group of users) {
    for (const user of group) batch.delete(db.collection("edu2gDeviceBindings").doc(user.uid));
  }
  for (const actorKey of keys) {
    const actor = db.collection("actors").doc(`cb5_actor_${actorKey}`);
    for (const name of ["records", "_idempotency", "_resolutions", "trustedDevices"]) {
      const snapshot = await actor.collection(name).get();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
    }
    batch.delete(actor);
  }
  await batch.commit();
}

module.exports = {
  actorKeys,
  call,
  cleanupCb5Fixture,
  configureProject,
  projectId,
  revokeAndReplaceDevice,
  setupCb5DeviceMatrix,
  assertActiveDeviceMatrix,
};
