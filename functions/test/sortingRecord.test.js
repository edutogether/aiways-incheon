"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");

function payload(overrides = {}) {
  return { schemaVersion: "sorting-record-v1", status: "completed", provider: "future_gemini", model: "gemini-3.5-flash-lite", analysis: { objectCandidates: [{ label: "PET bottle", itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "high" }], materialCandidates: [{ label: "plastic", confidenceBand: "medium" }], visibleCautions: [] }, checklist: [{ id: "empty", label: "Empty container", checked: true }], userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true }, hold: null, idempotencyKey: "stage6-idempotency-key-0001", ...overrides };
}
function setup(options = {}) {
  const db = new Map();
  const handler = createSaveSortingRecordHandler({ appCheck: async () => ({ status: "valid" }), access: options.access || { resolve: async () => ({ ok: true, actorId: "actor_test" }) }, actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) }, now: () => new Date("2026-07-28T00:00:00.000Z"), serverTimestamp: () => "SERVER_TIMESTAMP", rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) }, store: { async createOrGet(actor, key, record, response) { const existing = db.get(`${actor}:${key}`); if (existing) return { ...existing, duplicate: true }; const value = { recordId: `server-${db.size + 1}`, status: record.status, ...response, duplicate: false, record }; db.set(`${actor}:${key}`, value); return value; } } });
  return { db, handler };
}
async function call(handler, body) {
  const result = {};
  await handler({ method: "POST", body, headers: {} }, { set() { return this; }, status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; }, send() { return this; } });
  return result;
}
test("stores completed and held records with server timestamps and idempotency", async () => {
  const { handler, db } = setup();
  const first = await call(handler, payload());
  assert.equal(first.status, 201); assert.equal(first.body.expireAt, "2026-10-26T00:00:00.000Z");
  assert.equal([...db.values()][0].record.createdAt, "SERVER_TIMESTAMP");
  const duplicate = await call(handler, payload());
  assert.equal(duplicate.status, 200); assert.equal(duplicate.body.duplicate, true); assert.equal(db.size, 1);
  const held = await call(handler, payload({ status: "held", userDecision: { selectedItemId: "pet-bottle", action: "held", userConfirmed: true }, hold: { recommended: true, reasons: ["Check locally"] }, idempotencyKey: "stage6-idempotency-key-0002" }));
  assert.equal(held.status, 201);
});
test("rejects untrusted production actor and invalid or sensitive fields", async () => {
  const { handler } = setup({ access: { resolve: async () => ({ ok: false, httpStatus: 403, code: "actor_unavailable" }) } });
  assert.equal((await call(handler, payload())).status, 403);
  const testHandler = setup().handler;
  const cases = [payload({ status: "other" }), payload({ schemaVersion: "bad" }), payload({ userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: false } }), payload({ status: "held", userDecision: { selectedItemId: "pet-bottle", action: "held", userConfirmed: true }, hold: null }), payload({ analysis: { ...payload().analysis, objectCandidates: Array(4).fill(payload().analysis.objectCandidates[0]) } }), payload({ checklist: Array(21).fill(payload().checklist[0]) }), payload({ imageUrl: "https://example.invalid" }), payload({ analysis: { ...payload().analysis, rawResponse: "forbidden" } }), payload({ prompt: "forbidden" })];
  for (const item of cases) assert.equal((await call(testHandler, item)).status, 400);
});
