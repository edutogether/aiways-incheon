"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { extractBearer, createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
function doc(data) { return { exists: data !== undefined, data: () => data }; }
function fakeDb(values) { return { collection(name) { return { doc(id) { const key = `${name}/${id}`; return { get: async () => doc(values[key]), update: () => {}, collection(child) { return { doc(next) { return { get: async () => doc(values[`${key}/${child}/${next}`]), update: () => {} }; } }; } }; } }; } }; }
function request(token = "token") { return { headers: token ? { authorization: `Bearer ${token}` } : {} }; }
const auth = decoded => ({ verifyIdToken: async () => decoded });
test("extracts only a proper bearer token", () => { assert.equal(extractBearer(request()), "token"); assert.equal(extractBearer({ headers: { authorization: "token" } }), ""); });
test("rejects missing, invalid and non-anonymous authentication", async () => {
  const missing = createEdu2gDeviceAccess({ auth: auth({}), db: fakeDb({}) }); assert.equal((await missing.resolve(request(""))).code, "auth_missing");
  const invalid = createEdu2gDeviceAccess({ auth: { verifyIdToken: async () => { throw Error(); } }, db: fakeDb({}) }); assert.equal((await invalid.resolve(request())).code, "auth_invalid");
  const social = createEdu2gDeviceAccess({ auth: auth({ uid: "u1", firebase: { sign_in_provider: "google.com" } }), db: fakeDb({}) }); assert.equal((await social.resolve(request())).code, "anonymous_auth_required");
});
test("fails closed for revoked and mismatched state", async () => {
  const decoded = { uid: "u1", firebase: { sign_in_provider: "anonymous" } };
  for (const [values, code] of [[{ "edu2gDeviceBindings/u1": { status: "revoked" } }, "device_revoked"], [{ "edu2gDeviceBindings/u1": { status: "active", actorId: "actor1" }, "actors/actor1": { status: "active", plan: "closed_beta" }, "actors/actor1/trustedDevices/u1": { status: "active", uid: "other" } }, "access_state_invalid"], [{ "edu2gDeviceBindings/u1": { status: "active", actorId: "actor1" }, "actors/actor1": { status: "active", plan: "closed_beta" }, "actors/actor1/trustedDevices/u1": { status: "active", uid: "u1" } }, "access_state_invalid"]]) { const access = createEdu2gDeviceAccess({ auth: auth(decoded), db: fakeDb(values) }); assert.equal((await access.resolve(request())).code, code); }
});
test("resolves only an active anonymous binding", async () => {
  const values = { "edu2gDeviceBindings/u1": { status: "active", actorId: "actor1" }, "actors/actor1": { status: "active", plan: "closed_beta", displayName: "테스트" }, "actors/actor1/trustedDevices/u1": { status: "active", uid: "u1", managementId: "00000000-0000-4000-8000-000000000001", deviceLabel: "테스트 기기" } };
  const access = createEdu2gDeviceAccess({ auth: auth({ uid: "u1", firebase: { sign_in_provider: "anonymous" } }), db: fakeDb(values) }); const result = await access.resolve(request()); assert.equal(result.ok, true); assert.equal(result.actorId, "actor1"); assert.equal(JSON.stringify(result).includes("token"), false);
});
function fakeDbWithTransaction(initial) {
  const store = { ...initial };
  function makeRef(key) {
    return {
      key,
      get: async () => doc(store[key]),
      update: (patch) => { store[key] = { ...(store[key] || {}), ...patch }; },
      collection(child) { return { doc(next) { return makeRef(`${key}/${child}/${next}`); } }; }
    };
  }
  return {
    collection(name) { return { doc(id) { return makeRef(`${name}/${id}`); } }; },
    async runTransaction(fn) {
      return fn({
        get: async ref => ref.get(),
        create: (ref, data) => { if (store[ref.key] !== undefined) throw new Error("already exists"); store[ref.key] = data; },
        set: (ref, data) => { store[ref.key] = data; }
      });
    },
    _store: store
  };
}
test("auto-provisions an open-access actor for a brand-new anonymous uid (no code needed)", async () => {
  const db = fakeDbWithTransaction({});
  const access = createEdu2gDeviceAccess({ auth: auth({ uid: "u1", firebase: { sign_in_provider: "anonymous" } }), db, serverTimestamp: () => "now" });
  const first = await access.resolve(request());
  assert.equal(first.ok, true);
  assert.equal(first.actorId, "u1");
  assert.equal(first.actor.plan, "open_access");
  assert.equal(first.actor.maxDevices, 1);
  assert.equal(first.device.status, "active");
  assert.equal(db._store["edu2gDeviceBindings/u1"].status, "active");
  // A returning visitor (binding now exists) resolves through the normal path, not re-provisioning.
  const second = await access.resolve(request());
  assert.equal(second.ok, true);
  assert.equal(second.actorId, "u1");
});
test("self-heals an open-access uid whose actor doc vanished while its binding survived (2026-08-27 live bug report: searchSchool always 403 actor_unavailable)", async () => {
  // Reproduces exactly what an admin deleting the `actors` collection
  // without also clearing `edu2gDeviceBindings` leaves behind: a binding
  // that points at an actorId (here, actorId===uid, the open_access shape)
  // whose actor/device docs no longer exist. Before this fix that uid was
  // permanently stuck on actor_unavailable with no way to recover.
  const db = fakeDbWithTransaction({ "edu2gDeviceBindings/u1": { status: "active", actorId: "u1" } });
  const access = createEdu2gDeviceAccess({ auth: auth({ uid: "u1", firebase: { sign_in_provider: "anonymous" } }), db, serverTimestamp: () => "now" });
  const result = await access.resolve(request());
  assert.equal(result.ok, true);
  assert.equal(result.actorId, "u1");
  assert.equal(result.actor.plan, "open_access");
  assert.equal(db._store["actors/u1"].plan, "open_access");
});
test("also self-heals a closed_beta binding whose shared actor vanished (2026-08-27: KakaoTalk in-app browser live bug report, same root cause as open_access but binding.actorId !== uid) - the closed-beta gate is already retired so a missing shared actor is just more of the same abandoned-relic state, not a deliberate block", async () => {
  const db = fakeDbWithTransaction({ "edu2gDeviceBindings/u1": { status: "active", actorId: "shared_actor" } });
  const access = createEdu2gDeviceAccess({ auth: auth({ uid: "u1", firebase: { sign_in_provider: "anonymous" } }), db, serverTimestamp: () => "now" });
  const result = await access.resolve(request());
  assert.equal(result.ok, true);
  // Re-provisioning converts this device to a fresh open_access actor keyed
  // by its own uid, not the old shared "shared_actor" id.
  assert.equal(result.actorId, "u1");
  assert.equal(result.actor.plan, "open_access");
});
test("still fails closed when the actor exists but is inactive/wrong-plan (distinct from a missing actor doc)", async () => {
  const db = fakeDbWithTransaction({
    "edu2gDeviceBindings/u1": { status: "active", actorId: "shared_actor" },
    "actors/shared_actor": { status: "disabled", plan: "closed_beta" }
  });
  const access = createEdu2gDeviceAccess({ auth: auth({ uid: "u1", firebase: { sign_in_provider: "anonymous" } }), db, serverTimestamp: () => "now" });
  const result = await access.resolve(request());
  assert.equal(result.ok, false);
  assert.equal(result.code, "actor_unavailable");
});
