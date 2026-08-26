"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRecordStore } = require("../lib/sortingRecordStore");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");

// A fake Firestore that behaves like the real admin SDK on the one point
// that actually matters here: Firestore rejects `undefined` field values
// unless ignoreUndefinedProperties is set (this project doesn't set it).
// This is what a mock that just "records what was passed" would miss --
// the 2026-08-26 production incident (saveSortingRecord 500ing on every
// call) shipped with 120/120 tests green precisely because sortingRecord.js
// had its own fake store that didn't enforce this.
function assertNoUndefinedFields(data, label) {
  for (const [key, value] of Object.entries(data)) {
    assert.notEqual(value, undefined, `${label}: field "${key}" is undefined -- Firestore would reject this document`);
  }
}
function fakeDb() {
  const docs = new Map();
  function collection(name) {
    return {
      doc(id = `auto-${docs.size}`) {
        const path = `${name}/${id}`;
        return {
          id,
          _path: path,
          collection: (sub) => collection(`${path}/${sub}`),
          async get() { const data = docs.get(path); return { exists: !!data, data: () => data }; }
        };
      }
    };
  }
  return {
    collection,
    async runTransaction(fn) {
      const transaction = {
        async get(ref) { const data = docs.get(ref._path); return { exists: !!data, data: () => data }; },
        create(ref, data) { assertNoUndefinedFields(data, ref._path); docs.set(ref._path, data); },
        update(ref, patch) { docs.set(ref._path, { ...(docs.get(ref._path) || {}), ...patch }); }
      };
      return fn(transaction);
    },
    _docs: docs
  };
}

test("createOrGet never writes an undefined field (regression: expireAt removal broke this)", async () => {
  const db = fakeDb();
  const store = createRecordStore({ db });
  const response = await store.createOrGet("actor_1", "idem_key_1", { status: "completed", provider: "future_gemini" }, { createdAt: "2026-08-26T00:00:00.000Z" });
  assert.equal(response.duplicate, false);
  assert.ok(response.recordId);
});

test("saveSortingRecord handler end-to-end: the exact payload it builds writes cleanly through the real store", async () => {
  const db = fakeDb();
  const handler = createSaveSortingRecordHandler({
    appCheck: async () => ({ status: "valid" }),
    access: { resolve: async () => ({ ok: true, actorId: "actor_2" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    now: () => new Date("2026-08-26T00:00:00.000Z"),
    serverTimestamp: () => "SERVER_TIMESTAMP",
    store: createRecordStore({ db }),
    db
  });
  const result = {};
  await handler(
    { method: "POST", headers: {}, body: { schemaVersion: "sorting-record-v1", status: "completed", provider: "future_gemini", analysis: { objectCandidates: [], materialCandidates: [], visibleCautions: [] }, checklist: [], userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true }, hold: null, idempotencyKey: "regression-test-key-0001" } },
    { set() { return this; }, status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; }, send() { return this; } }
  );
  assert.equal(result.status, 201, `expected 201, got ${result.status}: ${JSON.stringify(result.body)}`);
});
