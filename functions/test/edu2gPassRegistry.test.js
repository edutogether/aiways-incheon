"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { MAX_DEVICES, normalizeLoginId, parseEdu2gPassRegistry, createEdu2gPassRegistry } = require("../lib/edu2gPassRegistry");
const registry = participants => JSON.stringify({ version: 2, participants });
const entry = (loginId = "student alpha", extra = {}) => ({ actorId: "actor_alpha", loginId, displayName: "참가자 A", enabled: true, maxDevices: MAX_DEVICES, ...extra });

test("approved login IDs use NFKC, collapsed whitespace and case-insensitive matching", async () => {
  const service = createEdu2gPassRegistry({ getSecret: () => registry([entry(" Student\u3000Alpha ", { aliases: ["alpha-id"] })]) });
  assert.equal(normalizeLoginId(" Student\u3000Alpha "), "student alpha");
  assert.deepEqual(await service.identify("STUDENT alpha"), { ok: true, actor: { actorId: "actor_alpha", displayName: "참가자 A", maxDevices: 5 } });
  assert.equal((await service.identify("alpha-id")).ok, true);
});
test("PASS and password fields are rejected by the participant registry schema", () => {
  for (const value of ["{", registry([]), JSON.stringify({ version: 1, participants: [entry()] }), registry([entry(), entry("other", { actorId: "actor_alpha" })]), registry([entry(), entry("STUDENT ALPHA", { actorId: "actor_beta" })]), registry([entry(undefined, { maxDevices: 4 })]), JSON.stringify({ version: 2, participants: [{ ...entry(), pass: "forbidden" }] })]) assert.throws(() => parseEdu2gPassRegistry(value), /invalid_registry/);
});
test("unapproved, disabled and oversized names return the same non-sensitive rejection", async () => {
  const service = createEdu2gPassRegistry({ getSecret: () => registry([entry("student alpha", { enabled: false })]), maxLoginIdLength: 32 });
  for (const value of ["student alpha", "unknown", "X".repeat(33)]) assert.deepEqual(await service.identify(value), { ok: false, code: "login_not_approved" });
});
