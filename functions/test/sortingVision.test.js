"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAnalyzeSortingHandler, redactProviderMessage, classifyProviderError, createSafeProviderErrorMeta } = require("../lib/sortingVision");

const imageData = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+QKQe2QAAAABJRU5ErkJggg==", "base64").toString("base64");
function requestBody(overrides = {}) {
  return { schemaVersion: "sorting-vision-v1", requestId: "test-request", sessionId: "test-session", idempotencyKey: "123e4567-e89b-42d3-a456-426614174000", locale: "ko-KR", source: "future_gemini", image: { mimeType: "image/png", data: imageData }, imageMetadata: { mimeType: "image/png", width: 1, height: 1, byteLength: Buffer.from(imageData, "base64").length }, userContext: {}, ...overrides };
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
const allowLimit = { check: async () => ({ allowed: true, outcome: "allowed" }) };
const allowAccess = { resolve: async () => ({ ok: true, actorId: "actor_test" }) };
const allowAnalysis = { claimAnalysisRequest: async () => ({ state: "claimed" }), completeAnalysisRequest: async () => true, failAnalysisRequest: async () => true };
const validAppCheck = async () => ({ status: "valid" });
function handlerFor(response = responseBody()) { return createAnalyzeSortingHandler({ appCheck: validAppCheck, access: allowAccess, actorRateLimiter: allowLimit, getApiKey: () => "mock", rateLimiter: allowLimit, analysisRequests: allowAnalysis, createClient: () => ({ models: { generateContent: async () => ({ text: JSON.stringify(response) }) } }) }); }

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
  let providerCalls = 0;
  const inputHandler = createAnalyzeSortingHandler({ appCheck: validAppCheck, access: allowAccess, actorRateLimiter: allowLimit, getApiKey: () => "mock", rateLimiter: allowLimit, analysisRequests: allowAnalysis, createClient: () => ({ models: { generateContent: async () => { providerCalls += 1; throw new Error("provider should not be called"); } } }) });
  assert.equal((await invoke(inputHandler, "POST", requestBody({ image: { mimeType: "image/heic", data: imageData } }))).payload.code, "unsupported_image_type");
  assert.equal((await invoke(inputHandler, "POST", requestBody({ image: { mimeType: "image/jpeg", data: "not_base64" } }))).payload.code, "invalid_image");

  const payloadResult = await invoke(inputHandler, "POST", requestBody({ userContext: { searchQuery: "x".repeat(6 * 1024 * 1024) } }));
  assert.equal(payloadResult.statusCode, 413); assert.equal(payloadResult.payload.code, "payload_too_large");

  const oversized = Buffer.alloc(4 * 1024 * 1024 + 1); Buffer.from([137,80,78,71,13,10,26,10]).copy(oversized);
  const data = oversized.toString("base64");
  const imageResult = await invoke(inputHandler, "POST", requestBody({ image: { mimeType: "image/png", data }, imageMetadata: { mimeType: "image/png", width: 1, height: 1, byteLength: oversized.length } }));
  assert.equal(imageResult.statusCode, 413); assert.equal(imageResult.payload.code, "image_too_large");

  const signatureResult = await invoke(inputHandler, "POST", requestBody({ image: { mimeType: "image/jpeg", data: imageData }, imageMetadata: { mimeType: "image/jpeg", width: 1, height: 1, byteLength: Buffer.from(imageData, "base64").length } }));
  assert.equal(signatureResult.statusCode, 400); assert.equal(signatureResult.payload.code, "image_signature_mismatch");

  const overDimension = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(overDimension); overDimension.writeUInt32BE(5001, 16); overDimension.writeUInt32BE(1, 20);
  const dimensionResult = await invoke(inputHandler, "POST", requestBody({ image: { mimeType: "image/png", data: overDimension.toString("base64") }, imageMetadata: { mimeType: "image/png", width: 5001, height: 1, byteLength: overDimension.length } }));
  assert.equal(dimensionResult.statusCode, 413); assert.equal(dimensionResult.payload.code, "image_dimensions_too_large");
  assert.equal(providerCalls, 0);
});
test("returns stable errors for unavailable provider, client error and method", async () => {
  assert.equal((await invoke(createAnalyzeSortingHandler({ appCheck: validAppCheck, access: allowAccess, actorRateLimiter: allowLimit, getApiKey: () => "", rateLimiter: allowLimit, analysisRequests: allowAnalysis }))).payload.code, "provider_unavailable");
  const logged = [];
  const failed = await invoke(createAnalyzeSortingHandler({ appCheck: validAppCheck, access: allowAccess, actorRateLimiter: allowLimit, getApiKey: () => "mock", rateLimiter: allowLimit, analysisRequests: allowAnalysis, createClient: () => ({ models: { generateContent: async () => { throw new Error("internal"); } } }), logProviderError: (metadata) => logged.push(metadata) }));
  assert.equal(failed.payload.code, "analysis_failed");
  assert.equal(failed.statusCode, 502); assert.equal(logged.length, 1); assert.equal(Object.hasOwn(logged[0], "stack"), false);
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

test("redacts API keys, bearer tokens, image data and base64 from provider messages", () => {
  const apiKey = ["AI", "za", "123456789012345678901234567890"].join("");
  const sensitive = `${apiKey} Bearer token-secret-123 data:image/png;base64,QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo= inlineData.data=QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=`;
  const redacted = redactProviderMessage(sensitive);
  assert.match(redacted, /\[REDACTED\]/); assert.equal(redacted.includes(apiKey), false); assert.doesNotMatch(redacted, /token-secret|QUJDREV/);
});

test("classifies safe upstream error metadata without retaining request content", () => {
  assert.equal(classifyProviderError({ status: 400 }), "invalid_request");
  assert.equal(classifyProviderError({ status: 401, code: "API_KEY_INVALID" }), "api_key_invalid");
  assert.equal(classifyProviderError({ status: 403, message: "API has not been used" }), "api_not_enabled");
  assert.equal(classifyProviderError({ status: 403, providerStatus: "PERMISSION_DENIED" }), "permission_denied");
  assert.equal(classifyProviderError({ status: 429 }), "quota_or_rate_limit");
  assert.equal(classifyProviderError({ status: 503 }), "provider_internal");
  assert.equal(classifyProviderError({}), "unknown");
  const apiKey = ["AI", "za", "123456789012345678901234567890"].join("");
  const metadata = createSafeProviderErrorMeta({ name: "ApiError", response: { status: 401, data: { error: { code: "API_KEY_INVALID", message: `key=${apiKey}` } } } }, "test-request", "diagnostic-test");
  assert.equal(metadata.classification, "api_key_invalid"); assert.equal(metadata.providerMessage.includes(apiKey), false); assert.equal(Object.hasOwn(metadata, "body"), false);
});
