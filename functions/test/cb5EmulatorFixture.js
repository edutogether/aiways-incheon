"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gPassRegistry } = require("../lib/edu2gPassRegistry");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const {
  createFirestoreDeviceStore,
  createEdu2gHandlers,
} = require("../lib/edu2gPassHandlers");

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

async function setupCb5DeviceMatrix() {
  const { authUrl } = configureProject();
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const participants = actorKeys.map((key, index) => ({
    loginId: `cb5 participant ${index}`,
    actorId: `cb5_actor_${key}`,
    displayName: `CB5 ${key}`,
    enabled: true,
    maxDevices: 5,
  }));
  const registry = createEdu2gPassRegistry({
    getSecret: () => JSON.stringify({ version: 2, participants }),
  });
  const store = createFirestoreDeviceStore({
    db,
    serverTimestamp: () => FieldValue.serverTimestamp(),
  });
  const access = createEdu2gDeviceAccess({
    auth,
    db,
    serverTimestamp: () => FieldValue.serverTimestamp(),
  });
  const handlers = createEdu2gHandlers({
    registry,
    store,
    access,
    appCheck: async () => ({ status: "valid" }),
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
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
    for (let deviceIndex = 0; deviceIndex < 5; deviceIndex += 1) {
      const response = await call(handlers.redeem, group[deviceIndex].token, {
        loginId: `cb5 participant ${actorIndex}`,
        deviceLabel: `${actorKeys[actorIndex]}${deviceIndex + 1}`,
        platform: "web",
        confirm: true,
      });
      assert.equal(response.statusCode, 200);
    }
    const sixth = await call(handlers.redeem, group[5].token, {
      loginId: `cb5 participant ${actorIndex}`,
      deviceLabel: `${actorKeys[actorIndex]}6`,
      platform: "web",
      confirm: true,
    });
    assert.equal(sixth.statusCode, 409);
  }

  await assertActiveDeviceMatrix({ db });
  return { app, auth, db, access, handlers, users, actorKeys, participants };
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
  const { db, handlers, users, actorKeys } = fixture;
  const list = await call(handlers.list, users[actorIndex][0].token, {});
  assert.equal(list.statusCode, 200);
  const target = list.body.devices.find((device) => !device.currentDevice);
  assert.ok(target);
  assert.equal(
    (
      await call(handlers.revoke, users[actorIndex][0].token, {
        targetManagementId: target.managementId,
        confirm: true,
      })
    ).statusCode,
    200,
  );
  const targetDocument = await db
    .collection("actors")
    .doc(`cb5_actor_${actorKeys[actorIndex]}`)
    .collection("trustedDevices")
    .where("managementId", "==", target.managementId)
    .get();
  const revoked = users[actorIndex].find((user) => user.uid === targetDocument.docs[0].id);
  assert.ok(revoked);
  assert.equal(
    (
      await call(handlers.redeem, users[actorIndex][5].token, {
        loginId: `cb5 participant ${actorIndex}`,
        deviceLabel: `${actorKeys[actorIndex]}6`,
        platform: "web",
        confirm: true,
      })
    ).statusCode,
    200,
  );
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
