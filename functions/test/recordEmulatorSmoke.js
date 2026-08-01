"use strict";

const assert = require("node:assert/strict");
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp({ projectId: "demo-aiways-incheon" });

async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

async function main() {
  const base = "http://127.0.0.1:5001/demo-aiways-incheon/asia-northeast3";
  const payload = { schemaVersion: "sorting-record-v1", status: "completed", provider: "future_gemini", analysis: { objectCandidates: [{ label: "PET bottle", itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "high" }], materialCandidates: [{ label: "plastic", confidenceBand: "medium" }], visibleCautions: [] }, checklist: [{ id: "empty", label: "Empty container", checked: true }], userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true }, hold: null, idempotencyKey: "stage6-emulator-key-0001", actorId: "emulator-test-actor" };
  for (const [name, body] of [["saveSortingRecord", payload], ["listSortingRecords", {}], ["resolveSortingRecord", {}]]) {
    const result = await post(`${base}/${name}`, body);
    assert.equal(result.status, 401);
    assert.equal(result.body.code, "app_check_missing");
  }
  const records = await getFirestore().collection("actors").doc("emulator-test-actor").collection("records").get();
  assert.equal(records.empty, true);
  const directWrite = await fetch("http://127.0.0.1:8080/v1/projects/demo-aiways-incheon/databases/(default)/documents/actors/emulator-test-actor/records/direct-client-write", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: { status: { stringValue: "completed" } } }) });
  assert.equal(directWrite.ok, false, "default-deny Firestore Rules must reject direct client writes");
  process.stdout.write("Firestore Emulator App Check enforcement smoke test passed\n");
}

main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
