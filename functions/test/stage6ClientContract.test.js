"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function contract() {
  const source = fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8");
  const match = source.match(/  const FIRESTORE_EMULATOR_PROJECT_ID[\s\S]*?\n  async function persistSortingRecordRemote/);
  assert.ok(match, "Stage 6 client storage helpers must exist");
  const helpers = match[0].replace(/\n  async function persistSortingRecordRemote$/, "");
  const context = { URLSearchParams, Uint32Array, Date, Math, window: { crypto: { randomUUID: () => "test-idempotency-key-0001" } } };
  vm.createContext(context);
  vm.runInContext(`const cleanText = value => typeof value === "string" ? value.trim() : ""; const sortingVisionConfidence = value => ["high", "medium", "low", "unknown"].includes(value) ? value : "unknown"; ${helpers}; globalThis.contract = { isFirestoreEmulatorStorageMode, recordPayloadFromDecision, FIRESTORE_EMULATOR_SAVE_URL };`, context);
  return context.contract;
}
const decision = { provider: "future_gemini", schemaVersion: "sorting-vision-v1", selectedItemId: "pet-bottle", selectedCorrectionType: "", objectCandidates: [{ label: "PET bottle", itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "high", image: "never-copy" }], materialCandidates: [{ label: "plastic", confidenceBand: "medium" }], visibleCautions: ["Remove cap"], checklist: [{ id: "empty", label: "Empty container", checked: true, required: true }, { id: "optional", label: "Optional", checked: false, required: false }], hold: { recommended: true, reasons: ["Check local rule"] }, image: "forbidden", rawResponse: "forbidden", prompt: "forbidden", canRecord: true, createdAt: "forbidden" };

test("enables Firestore only for explicit localhost emulator mode", () => {
  const { isFirestoreEmulatorStorageMode } = contract();
  assert.equal(isFirestoreEmulatorStorageMode({ hostname: "localhost", search: "" }), false);
  assert.equal(isFirestoreEmulatorStorageMode({ hostname: "edutogether.github.io", search: "?storage=firestore-emulator" }), false);
  assert.equal(isFirestoreEmulatorStorageMode({ hostname: "127.0.0.1", search: "?storage=firestore-emulator" }), true);
});
test("builds completed and held payloads from the allowlist only", () => {
  const { recordPayloadFromDecision, FIRESTORE_EMULATOR_SAVE_URL } = contract();
  const completed = recordPayloadFromDecision(decision, "completed", "stage6-client-key-0001");
  const held = recordPayloadFromDecision(decision, "held", "stage6-client-key-0002");
  assert.match(FIRESTORE_EMULATOR_SAVE_URL, /demo-aiways-incheon\/asia-northeast3\/saveSortingRecord$/);
  assert.deepEqual(Object.keys(completed).sort(), ["actorId", "analysis", "appVersion", "checklist", "hold", "idempotencyKey", "provider", "schemaVersion", "sourceSchemaVersion", "status", "userDecision"].sort());
  assert.equal(completed.status, "completed"); assert.equal(completed.hold, null); assert.equal(completed.checklist.length, 1);
  assert.equal(completed.analysis.objectCandidates[0].image, undefined);
  assert.equal(held.status, "held"); assert.equal(held.hold.recommended, true);
});
