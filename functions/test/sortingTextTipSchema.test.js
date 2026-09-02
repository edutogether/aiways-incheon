"use strict";
// 2026-09-01 종합감사(B그룹 4번): sortingVisionSchema.test.js와 같은 이유 -
// sortingTextTip.js를 통해서만 간접 실행됐지 직접 require된 적 없었다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { SCHEMA, MAX_QUERY_LENGTH, validateRequest, normalizeResponse, validateResponse } = require("../lib/sortingTextTipSchema");

function validRequestBody(overrides = {}) {
  return {
    schemaVersion: SCHEMA,
    requestId: "req-1",
    sessionId: "session-1",
    locale: "ko-KR",
    idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
    source: "future_gemini",
    query: "우유갑",
    ...overrides,
  };
}

test("validateRequest accepts a well-formed text-tip request and echoes back the cleaned query", () => {
  const result = validateRequest(validRequestBody());
  assert.equal(result.valid, true);
  assert.equal(result.query, "우유갑");
});

test("validateRequest rejects a non-object body", () => {
  assert.equal(validateRequest(null).valid, false);
  assert.equal(validateRequest(42).code, "invalid_request");
});

test("validateRequest rejects a mismatched schemaVersion", () => {
  assert.equal(validateRequest(validRequestBody({ schemaVersion: "old-version" })).code, "invalid_schema");
});

test("validateRequest rejects an empty query", () => {
  assert.equal(validateRequest(validRequestBody({ query: "" })).code, "invalid_query");
});

test("validateRequest rejects a query that is only control characters/angle brackets (sanitizes to empty)", () => {
  assert.equal(validateRequest(validRequestBody({ query: "<>" })).valid, false);
});

test("validateRequest sanitizes angle brackets out of an otherwise-real query rather than rejecting it outright", () => {
  const result = validateRequest(validRequestBody({ query: "<script>우유갑</script>" }));
  assert.equal(result.valid, true);
  assert.equal(result.query.includes("<"), false);
  assert.equal(result.query.includes(">"), false);
});

test("validateRequest truncates the returned query at MAX_QUERY_LENGTH but does not error on a long input", () => {
  const longQuery = "가".repeat(MAX_QUERY_LENGTH + 50);
  const result = validateRequest(validRequestBody({ query: longQuery }));
  assert.equal(result.valid, true);
  assert.equal(result.query.length, MAX_QUERY_LENGTH);
});

test("validateRequest rejects a non-string query even if coercible", () => {
  assert.equal(validateRequest(validRequestBody({ query: 12345 })).code, "invalid_query");
});

test("validateRequest rejects an invalid idempotencyKey", () => {
  assert.equal(validateRequest(validRequestBody({ idempotencyKey: "short" })).code, "invalid_idempotency_key");
});

test("validateRequest rejects a source other than future_gemini", () => {
  assert.equal(validateRequest(validRequestBody({ source: "other" })).code, "invalid_request");
});

test("validateRequest rejects an oversized payload", () => {
  const result = validateRequest(validRequestBody({ query: "가".repeat(3000) }));
  assert.equal(result.code, "payload_too_large");
});

function validResponseBody(overrides = {}) {
  return {
    schemaVersion: SCHEMA,
    requestId: "req-1",
    provider: "future_gemini",
    objectCandidates: [{ label: "milk carton", itemId: "milk-carton", objectType: "milk-carton", confidenceBand: "high" }],
    materialCandidates: [{ label: "paper", confidenceBand: "medium" }],
    visibleCautions: [],
    uncertainty: "low",
    needsUserCheck: false,
    ...overrides,
  };
}

test("validateResponse accepts a well-formed model response", () => {
  const result = validateResponse(validResponseBody(), "req-1");
  assert.equal(result.valid, true);
});

test("validateResponse rejects a candidate whose itemId/objectType pair is unrecognized", () => {
  const result = validateResponse(validResponseBody({
    objectCandidates: [{ label: "fake", itemId: "fake-item", objectType: "fake-item", confidenceBand: "high" }],
  }), "req-1");
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("invalid_candidate"));
});

test("normalizeResponse dedupes visibleCautions and caps materialCandidates at 3", () => {
  const normalized = normalizeResponse({
    materialCandidates: [{ label: "a" }, { label: "b" }, { label: "c" }, { label: "d" }],
    visibleCautions: ["wet", "wet"],
  });
  assert.equal(normalized.materialCandidates.length, 3);
  assert.deepEqual(normalized.visibleCautions, ["wet"]);
});
