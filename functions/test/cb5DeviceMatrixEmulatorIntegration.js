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
process.env.GCLOUD_PROJECT = projectId;
process.env.GOOGLE_CLOUD_PROJECT = projectId;

const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (!authEmulatorHost || !firestoreEmulatorHost) {
  throw new Error(
    "CB-5 device matrix requires FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST.",
  );
}

const authEmulatorUrl = new URL(`http://${authEmulatorHost}`);
if (!authEmulatorUrl.port) {
  throw new Error("FIREBASE_AUTH_EMULATOR_HOST must include a port.");
}

function signup() {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: authEmulatorUrl.hostname,
        port: authEmulatorUrl.port,
        path: "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            body: JSON.parse(body || "{}"),
          }),
        );
      },
    );
    request.on("error", reject);
    request.end(JSON.stringify({ returnSecureToken: true }));
  });
}

function call(handler, token, body) {
  const response = {
    set() {
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
    send() {
      return this;
    },
  };

  return handler(
    {
      method: "POST",
      headers: {
        origin: "http://localhost:5173",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body,
    },
    response,
  ).then(() => response);
}

(async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const ids = ["a", "b", "c", "d", "e"];
  const users = [];
  const passes = ids.map((id, index) => ({
    pass: `CB5-PASS-${index}`,
    actorId: `cb5_actor_${id}`,
    displayName: `CB5 ${id}`,
    enabled: true,
    maxDevices: 5,
  }));
  const registry = createEdu2gPassRegistry({
    getSecret: () => JSON.stringify({ version: 1, passes }),
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

  try {
    for (let actorIndex = 0; actorIndex < ids.length; actorIndex += 1) {
      const group = [];
      for (let deviceIndex = 0; deviceIndex < 6; deviceIndex += 1) {
        const signupResponse = await signup();
        assert.equal(signupResponse.status, 200);
        const decoded = await auth.verifyIdToken(signupResponse.body.idToken);
        group.push({ token: signupResponse.body.idToken, uid: decoded.uid });
      }
      users.push(group);

      for (let deviceIndex = 0; deviceIndex < 5; deviceIndex += 1) {
        const response = await call(handlers.redeem, group[deviceIndex].token, {
          pass: `CB5-PASS-${actorIndex}`,
          deviceLabel: `${ids[actorIndex]}${deviceIndex + 1}`,
          platform: "web",
        });
        assert.equal(response.statusCode, 200);
      }

      const sixthResponse = await call(handlers.redeem, group[5].token, {
        pass: `CB5-PASS-${actorIndex}`,
        deviceLabel: `${ids[actorIndex]}6`,
        platform: "web",
      });
      assert.equal(sixthResponse.statusCode, 409);

      const actorRef = db.collection("actors").doc(`cb5_actor_${ids[actorIndex]}`);
      const actor = await actorRef.get();
      assert.equal(actor.data().activeDeviceCount, 5);
      assert.equal(
        (await actorRef.collection("trustedDevices").where("status", "==", "active").get()).size,
        5,
      );
    }

    const list = await call(handlers.list, users[0][0].token, {});
    const target = list.body.devices.find((device) => !device.currentDevice);
    assert.ok(target);
    assert.equal(
      (
        await call(handlers.revoke, users[0][0].token, {
          targetManagementId: target.managementId,
          confirm: true,
        })
      ).statusCode,
      200,
    );

    const revokedUid = (
      await db
        .collection("actors")
        .doc("cb5_actor_a")
        .collection("trustedDevices")
        .where("managementId", "==", target.managementId)
        .get()
    ).docs[0].id;
    const revoked = users[0].find((user) => user.uid === revokedUid);
    assert.equal(
      (await access.resolve({ headers: { authorization: `Bearer ${revoked.token}` } })).code,
      "device_revoked",
    );
    assert.equal(
      (
        await call(handlers.redeem, users[0][5].token, {
          pass: "CB5-PASS-0",
          deviceLabel: "a6",
          platform: "web",
        })
      ).statusCode,
      200,
    );

    const actors = await db.collection("actors").where("plan", "==", "closed_beta").get();
    let active = 0;
    for (const id of ids) {
      const devices = await db
        .collection("actors")
        .doc(`cb5_actor_${id}`)
        .collection("trustedDevices")
        .where("status", "==", "active")
        .get();
      assert.equal(devices.size, 5);
      active += devices.size;
    }
    assert.equal(actors.size, 5);
    assert.equal(active, 25);
    process.stdout.write(
      `${JSON.stringify({
        cb5DeviceMatrix: "passed",
        actors: 5,
        activeDevices: 25,
        sixthBlocked: 5,
        revokedBlocked: 1,
        replacement: 1,
      })}\n`,
    );
  } finally {
    const batch = db.batch();
    for (const id of ids) {
      const actor = db.collection("actors").doc(`cb5_actor_${id}`);
      const devices = await actor.collection("trustedDevices").get();
      devices.docs.forEach((device) => batch.delete(device.ref));
      batch.delete(actor);
    }
    for (const group of users) {
      for (const user of group) {
        batch.delete(db.collection("edu2gDeviceBindings").doc(user.uid));
      }
    }
    await batch.commit();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
