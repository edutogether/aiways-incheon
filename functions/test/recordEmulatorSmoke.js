"use strict";
const assert = require("node:assert/strict");
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
if (!getApps().length) initializeApp({ projectId: "demo-aiways-incheon" });
async function main() {
  const payload = { schemaVersion: "sorting-record-v1", status: "completed", provider: "future_gemini", analysis: { objectCandidates: [{ label: "PET bottle", itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "high" }], materialCandidates: [{ label: "plastic", confidenceBand: "medium" }], visibleCautions: [] }, checklist: [{ id: "empty", label: "Empty container", checked: true }], userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true }, hold: null, idempotencyKey: "stage6-emulator-key-0001", actorId: "stage6-test-actor" };
  const url = "http://127.0.0.1:5001/demo-aiways-incheon/asia-northeast3/saveSortingRecord";
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json();
  assert.equal(response.status, 201); assert.equal(result.status, "completed");
  const doc = await getFirestore().doc(`actors/stage6-test-actor/records/${result.recordId}`).get();
  assert.equal(doc.exists, true); assert.equal(doc.data().schemaVersion, "sorting-record-v1");
  assert.equal(doc.data().expireAt.toDate().getTime() - doc.data().createdAt.toDate().getTime() > 89 * 24 * 60 * 60 * 1000, true);
  const duplicate = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal(duplicate.status, 200);
  const heldPayload = { ...payload, status: "held", idempotencyKey: "stage6-emulator-key-0002", userDecision: { selectedItemId: "pet-bottle", action: "held", userConfirmed: true }, hold: { recommended: true, reasons: ["Check local rule"] } };
  const heldResponse = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(heldPayload) });
  const held = await heldResponse.json();
  assert.equal(heldResponse.status, 201); assert.equal(held.status, "held");
  assert.equal((await getFirestore().doc(`actors/stage6-test-actor/records/${held.recordId}`).get()).data().hold.recommended, true);
  const directWrite = await fetch("http://127.0.0.1:8080/v1/projects/demo-aiways-incheon/databases/(default)/documents/actors/stage6-test-actor/records/direct-client-write", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: { status: { stringValue: "completed" } } }) });
  assert.equal(directWrite.ok, false, "default-deny Firestore Rules must reject direct client writes");
  process.stdout.write("Firestore Emulator record smoke test passed\n");
}
main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
