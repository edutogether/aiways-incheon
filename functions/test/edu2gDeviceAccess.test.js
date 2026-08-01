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
test("fails closed for unregistered, revoked and mismatched state", async () => {
  const decoded = { uid: "u1", firebase: { sign_in_provider: "anonymous" } };
  for (const [values, code] of [[{}, "device_not_registered"], [{ "edu2gDeviceBindings/u1": { status: "revoked" } }, "device_revoked"], [{ "edu2gDeviceBindings/u1": { status: "active", actorId: "actor1" }, "actors/actor1": { status: "active", plan: "closed_beta" }, "actors/actor1/trustedDevices/u1": { status: "active", uid: "other" } }, "access_state_invalid"]]) { const access = createEdu2gDeviceAccess({ auth: auth(decoded), db: fakeDb(values) }); assert.equal((await access.resolve(request())).code, code); }
});
test("resolves only an active anonymous binding", async () => {
  const values = { "edu2gDeviceBindings/u1": { status: "active", actorId: "actor1" }, "actors/actor1": { status: "active", plan: "closed_beta", displayName: "테스트" }, "actors/actor1/trustedDevices/u1": { status: "active", uid: "u1", deviceLabel: "테스트 기기" } };
  const access = createEdu2gDeviceAccess({ auth: auth({ uid: "u1", firebase: { sign_in_provider: "anonymous" } }), db: fakeDb(values) }); const result = await access.resolve(request()); assert.equal(result.ok, true); assert.equal(result.actorId, "actor1"); assert.equal(JSON.stringify(result).includes("token"), false);
});
