"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAnalyzeSortingHandler } = require("../lib/sortingVision");

const imageData = Buffer.from("aiways-image").toString("base64");
function requestBody(overrides = {}) {
  return { schemaVersion: "sorting-vision-v1", requestId: "test-request", sessionId: "test-session", locale: "ko-KR", source: "future_gemini", image: { mimeType: "image/jpeg", data: imageData }, imageMetadata: { mimeType: "image/jpeg", width: 12, height: 8, byteLength: Buffer.from(imageData, "base64").length }, userContext: {}, ...overrides };
}
function responseBody(overrides = {}) {
  return { schemaVersion: "sorting-vision-v1", requestId: "test-request", provider: "future_gemini", objectCandidates: [{ label: "페트병", itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "high" }], materialCandidates: [{ label: "PET", confidenceBand: "medium" }], visibleCautions: ["내용물을 비우세요"], uncertainty: "low", needsUserCheck: true, ...overrides };
}
async function invoke(handler, method = "POST", body = requestBody()) {
  const result = { statusCode: 0, payload: null };
  const res = { set() { return this; }, status(code) { result.statusCode = code; return this; }, json(value) { result.payload = value; return this; }, send(value) { result.payload = value; return this; } };
  await handler({ method, body }, res);
  return result;
}
function handlerFor(response = responseBody()) { return createAnalyzeSortingHandler({ getApiKey: () => "mock", createClient: () => ({ models: { generateContent: async () => ({ text: JSON.stringify(response) }) } }) }); }

test("returns validated observation candidates without raw model content", async () => {
  const result = await invoke(handlerFor());
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.provider, "future_gemini");
  assert.equal(result.payload.objectCandidates[0].itemId, "pet-bottle");
  assert.equal(Object.hasOwn(result.payload, "text"), false);
});
test("supports multiple candidates and hold candidate", async () => {
  const result = await invoke(handlerFor(responseBody({ objectCandidates: [{ label: "박스", itemId: "tape-box", objectType: "tape-box", confidenceBand: "medium" }, { label: "보류", itemId: "hold", objectType: "hold", confidenceBand: "low" }], uncertainty: "high" })));
  assert.equal(result.statusCode, 200); assert.equal(result.payload.objectCandidates.length, 2);
});
test("rejects invalid schema, unknown item, type mismatch, long and HTML candidate labels", async () => {
  assert.equal((await invoke(handlerFor(), "POST", requestBody({ schemaVersion: "bad" }))).payload.code, "invalid_schema");
  for (const candidate of [{ label: "알 수 없음", itemId: "unknown", objectType: "unknown", confidenceBand: "low" }, { label: "페트병", itemId: "pet-bottle", objectType: "can", confidenceBand: "low" }, { label: "x".repeat(41), itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "low" }, { label: "<script>alert(1)</script>", itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "low" }]) {
    assert.equal((await invoke(handlerFor(responseBody({ objectCandidates: [candidate] })))).statusCode, 502);
  }
});
test("rejects unsupported, malformed and oversized image payloads", async () => {
  assert.equal((await invoke(handlerFor(), "POST", requestBody({ image: { mimeType: "image/heic", data: imageData } }))).payload.code, "unsupported_image_type");
  assert.equal((await invoke(handlerFor(), "POST", requestBody({ image: { mimeType: "image/jpeg", data: "not_base64" } }))).payload.code, "invalid_image");
  assert.equal((await invoke(handlerFor(), "POST", requestBody({ imageMetadata: { mimeType: "image/jpeg", width: 12, height: 8, byteLength: 1_500_001 } }))).payload.code, "image_too_large");
});
test("returns stable errors for unavailable provider, client error and method", async () => {
  assert.equal((await invoke(createAnalyzeSortingHandler({ getApiKey: () => "" }))).payload.code, "provider_unavailable");
  assert.equal((await invoke(createAnalyzeSortingHandler({ getApiKey: () => "mock", createClient: () => ({ models: { generateContent: async () => { throw new Error("internal"); } } }) }))).payload.code, "analysis_failed");
  assert.equal((await invoke(handlerFor(), "GET")).payload.code, "method_not_allowed");
});
test("does not reflect an unapproved browser origin", async () => {
  const handler = handlerFor();
  const result = { statusCode: 0, payload: null, headers: {} };
  const res = { set(key, value) { result.headers[key] = value; return this; }, status(code) { result.statusCode = code; return this; }, json(value) { result.payload = value; return this; }, send(value) { result.payload = value; return this; } };
  await handler({ method: "OPTIONS", headers: { origin: "https://example.invalid" }, body: {} }, res);
  assert.equal(result.statusCode, 403); assert.equal(result.headers["Access-Control-Allow-Origin"], undefined);
});
test("rejects a response whose requestId differs from the request", async () => {
  const result = await invoke(handlerFor(responseBody({ requestId: "other" })));
  assert.equal(result.statusCode, 502); assert.equal(result.payload.requestId, "test-request");
});
