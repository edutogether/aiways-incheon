"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { MAX_DEVICES, normalizePass, passDigest, safeEqual, parseEdu2gPassRegistry, createEdu2gPassRegistry } = require("../lib/edu2gPassRegistry");
const registry = passes => JSON.stringify({ version: 1, passes });
const entry = (pass = "TEST-PASS-ALPHA", extra = {}) => ({ pass, actorId: "actor_alpha", displayName: "테스트 사용자", enabled: true, maxDevices: MAX_DEVICES, ...extra });

test("valid registry normalizes synthetic PASS without returning it", async () => {
  const service = createEdu2gPassRegistry({ getSecret: () => registry([entry()]) });
  const result = await service.redeem("  test-pass-alpha  ");
  assert.equal(normalizePass(" a\u3000b "), "A B"); assert.equal(result.ok, true); assert.equal(result.actor.actorId, "actor_alpha");
  assert.equal(JSON.stringify(result).includes("TEST-PASS"), false);
});
test("malformed schema, version, duplicates and invalid device limits fail closed", () => {
  for (const value of ["{", registry([]), JSON.stringify({ version: 2, passes: [entry()] }), registry([entry(), entry("TEST-PASS-BETA")]), registry([entry(), entry("TEST-PASS-BETA", { actorId: "actor_alpha" })]), registry([entry(undefined, { maxDevices: 4 })])]) assert.throws(() => parseEdu2gPassRegistry(value), /invalid_registry/);
});
test("disabled, unknown and oversized values have the same invalid PASS response", async () => {
  const service = createEdu2gPassRegistry({ getSecret: () => registry([entry("TEST-PASS-ALPHA", { enabled: false })]), maxPassLength: 32 });
  for (const value of ["TEST-PASS-ALPHA", "TEST-PASS-UNKNOWN", "X".repeat(33)]) assert.deepEqual(await service.redeem(value), { ok: false, code: "invalid_pass" });
});
test("PASS comparison uses fixed-length SHA-256 digests for every input length", () => { assert.equal(passDigest("A").length, 32); assert.equal(passDigest("A much longer value").length, 32); assert.equal(safeEqual("A", "A"), true); assert.equal(safeEqual("A", "A much longer value"), false); });
