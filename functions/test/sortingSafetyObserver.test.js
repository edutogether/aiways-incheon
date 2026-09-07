"use strict";
// 2026-09-07 종합감사 - createSortingSafetyObserverHandler(실제 프로덕션
// 핸들러) 자체를 검증하는 자동 테스트가 하나도 없었다. splitSafetyObserver.test.js는
// OBSERVER_SCHEMA 상수와(예전엔) 죽은 판정 함수만 테스트했지, 이 핸들러의
// 실제 동작(Gemini 호출 성공/실패, idempotency 분기, App Check/메서드
// 검증, logProviderError 호출)은 자매 함수인 analyzeSortingImage/
// analyzeSortingText와 달리 전혀 커버되지 않고 있었다. sortingVision.test.js와
// 같은 패턴으로 작성한다.
const assert = require("node:assert/strict");
// OBSERVER_SCHEMA 계약 자체(필수 필드/금지 필드)는 splitSafetyObserver.test.js가
// 이미 검증한다 - 여기서는 중복하지 않고 핸들러의 실제 동작만 다룬다.
const { createSortingSafetyObserverHandler } = require("../lib/sortingSafetyObserver");

const imageData = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+QKQe2QAAAABJRU5ErkJggg==", "base64").toString("base64");
function requestBody(overrides = {}) {
  return { schemaVersion: "sorting-vision-v1", requestId: "test-request", sessionId: "test-session", idempotencyKey: "123e4567-e89b-42d3-a456-426614174000", locale: "ko-KR", source: "future_gemini", image: { mimeType: "image/png", data: imageData }, imageMetadata: { mimeType: "image/png", width: 1, height: 1, byteLength: Buffer.from(imageData, "base64").length }, userContext: {}, ...overrides };
}
function observerResponse(overrides = {}) {
  return { requestId: "test-request", observerVersion: "v1", targetVisibility: "clear", targetDominance: "high", multiObject: false, occlusion: "none", deformation: false, contamination: false, transparencyAmbiguity: false, compositeMaterial: false, imageQuality: "good", backgroundClutter: "low", candidateConflict: "none", observerStatus: "ok", ...overrides };
}
async function invoke(handler, method = "POST", body = requestBody()) {
  const result = { statusCode: 0, payload: null, headers: {} };
  const res = { set(key, value) { result.headers[key] = value; return this; }, status(code) { result.statusCode = code; return this; }, json(value) { result.payload = value; return this; }, send(value) { result.payload = value; return this; } };
  await handler({ method, headers: {}, body }, res);
  return result;
}
const allowLimit = { check: async () => ({ allowed: true, outcome: "allowed" }) };
const allowAccess = { resolve: async () => ({ ok: true, actorId: "actor_test" }) };
const allowAnalysis = { claimAnalysisRequest: async () => ({ state: "claimed" }), completeAnalysisRequest: async () => true, failAnalysisRequest: async () => true };
const validAppCheck = async () => ({ status: "valid" });
function handlerFor(response = observerResponse(), extra = {}) {
  return createSortingSafetyObserverHandler({ appCheck: validAppCheck, access: allowAccess, actorRateLimiter: allowLimit, rateLimiter: allowLimit, getApiKey: () => "mock", analysisRequests: allowAnalysis, createClient: () => ({ models: { generateContent: async () => ({ text: JSON.stringify(response) }) } }), ...extra });
}

test("returns the raw observation payload on success", async () => {
  const result = await invoke(handlerFor());
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.observerStatus, "ok");
  assert.equal(result.payload.targetVisibility, "clear");
});

test("rejects a response whose requestId differs from the request, and marks the request failed", async () => {
  const failed = [];
  const handler = handlerFor(observerResponse({ requestId: "other" }), { analysisRequests: { ...allowAnalysis, failAnalysisRequest: async (...args) => { failed.push(args); return true; } } });
  const result = await invoke(handler);
  assert.equal(result.statusCode, 502);
  assert.equal(result.payload.code, "invalid_model_response");
  assert.equal(failed.length, 1);
});

test("Gemini call failure logs a redacted error and fails the request", async () => {
  const logged = [];
  const handler = handlerFor(undefined, {
    createClient: () => ({ models: { generateContent: async () => { throw new Error("upstream boom"); } } }),
    logProviderError: (metadata) => logged.push(metadata)
  });
  const result = await invoke(handler);
  assert.equal(result.statusCode, 502);
  assert.equal(result.payload.code, "analysis_failed");
  assert.equal(logged.length, 1);
  assert.equal(logged[0].functionName, "analyzeSortingSafetyObserver");
  assert.equal(Object.hasOwn(logged[0], "stack"), false);
});

test("idempotency claim states map to the documented status codes without calling the provider", async () => {
  let providerCalls = 0;
  const createClient = () => ({ models: { generateContent: async () => { providerCalls += 1; return { text: JSON.stringify(observerResponse()) }; } } });
  const completed = await invoke(handlerFor(undefined, { createClient, analysisRequests: { ...allowAnalysis, claimAnalysisRequest: async () => ({ state: "completed", result: { cached: true } }) } }));
  assert.equal(completed.statusCode, 200);
  assert.deepEqual(completed.payload, { cached: true });

  const processing = await invoke(handlerFor(undefined, { createClient, analysisRequests: { ...allowAnalysis, claimAnalysisRequest: async () => ({ state: "processing" }) } }));
  assert.equal(processing.statusCode, 409);
  assert.equal(processing.headers["Retry-After"], "1");

  const expired = await invoke(handlerFor(undefined, { createClient, analysisRequests: { ...allowAnalysis, claimAnalysisRequest: async () => ({ state: "expired" }) } }));
  assert.equal(expired.statusCode, 409);
  assert.equal(expired.payload.code, "request_expired");

  assert.equal(providerCalls, 0, "provider must never be called when the claim short-circuits");
});

test("rejects unsupported method and unapproved origin the same way the sibling analyzers do", async () => {
  assert.equal((await invoke(handlerFor(), "GET")).payload.code, "method_not_allowed");
  const handler = handlerFor();
  const result = { statusCode: 0, payload: null, headers: {} };
  const res = { set(key, value) { result.headers[key] = value; return this; }, status(code) { result.statusCode = code; return this; }, json(value) { result.payload = value; return this; }, send(value) { result.payload = value; return this; } };
  await handler({ method: "OPTIONS", headers: { origin: "https://example.invalid" }, body: {} }, res);
  assert.equal(result.statusCode, 403);
  assert.equal(result.headers["Access-Control-Allow-Origin"], undefined);
});

test("propagates Retry-After when the shared actor/global rate limiter rejects the request", async () => {
  const limited = { check: async () => ({ allowed: false, outcome: "minute_limited" }) };
  const handler = createSortingSafetyObserverHandler({ appCheck: validAppCheck, access: allowAccess, rateLimiter: limited, actorRateLimiter: allowLimit, getApiKey: () => "mock", analysisRequests: allowAnalysis });
  const result = await invoke(handler);
  assert.equal(result.statusCode, 429);
  assert.ok(result.headers["Retry-After"]);
});
