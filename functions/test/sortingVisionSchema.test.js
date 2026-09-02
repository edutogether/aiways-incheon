"use strict";
// 2026-09-01 종합감사(B그룹 4번): 이 파일은 sortingVision.js를 통해서만
// 간접적으로 실행됐지 직접 require된 적은 없었다. validateRequest/
// validateResponse는 Gemini 요청/응답 양쪽 다 신뢰 경계라 각자 실패
// 경로를 직접 확인한다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { SCHEMA, validateRequest, normalizeResponse, validateResponse } = require("../lib/sortingVisionSchema");

// A minimal but real PNG signature + IHDR width/height, matching what
// imageValidation.js's dimensions() parser actually reads -- an all-zero
// buffer fails signature validation before this schema's own checks
// (metadata.byteLength agreement, etc.) ever run.
function makeValidPngBase64(width = 10, height = 10) {
  const buf = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buf, 0);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf.toString("base64");
}
const VALID_IMAGE_DATA = makeValidPngBase64();
const VALID_IMAGE_BYTES = Buffer.from(VALID_IMAGE_DATA, "base64").length;

function validRequestBody(overrides = {}) {
  return {
    schemaVersion: SCHEMA,
    requestId: "req-1",
    sessionId: "session-1",
    locale: "ko-KR",
    idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
    source: "future_gemini",
    image: { mimeType: "image/png", data: VALID_IMAGE_DATA, metadata: { byteLength: VALID_IMAGE_BYTES, mimeType: "image/png", width: 10, height: 10 } },
    ...overrides,
  };
}

test("validateRequest accepts a fully well-formed request", () => {
  const result = validateRequest(validRequestBody());
  assert.equal(result.valid, true);
  assert.equal(result.requestId, "req-1");
});

test("validateRequest rejects a non-object body", () => {
  assert.equal(validateRequest(null).valid, false);
  assert.equal(validateRequest("not an object").code, "invalid_request");
});

test("validateRequest rejects a mismatched schemaVersion", () => {
  const result = validateRequest(validRequestBody({ schemaVersion: "wrong-version" }));
  assert.equal(result.valid, false);
  assert.equal(result.code, "invalid_schema");
});

test("validateRequest rejects an unsupported image mimeType", () => {
  const body = validRequestBody();
  body.image.mimeType = "image/gif";
  const result = validateRequest(body);
  assert.equal(result.code, "unsupported_image_type");
});

test("validateRequest rejects non-base64 image data", () => {
  const body = validRequestBody();
  body.image.data = "not-base64!!!";
  const result = validateRequest(body);
  assert.equal(result.code, "invalid_image");
});

test("validateRequest rejects when metadata.byteLength disagrees with the actual decoded length", () => {
  const body = validRequestBody();
  body.image.metadata.byteLength = 99999;
  const result = validateRequest(body);
  assert.equal(result.code, "invalid_image");
});

test("validateRequest rejects when metadata.mimeType contradicts image.mimeType", () => {
  const body = validRequestBody();
  body.image.metadata.mimeType = "image/jpeg";
  const result = validateRequest(body);
  assert.equal(result.code, "invalid_image");
});

test("validateRequest rejects a source other than future_gemini", () => {
  const result = validateRequest(validRequestBody({ source: "past_gemini" }));
  assert.equal(result.code, "invalid_request");
});

test("validateRequest rejects a missing/invalid idempotencyKey", () => {
  const result = validateRequest(validRequestBody({ idempotencyKey: "not-a-uuid" }));
  assert.equal(result.code, "invalid_idempotency_key");
});

function validResponseBody(overrides = {}) {
  return {
    schemaVersion: SCHEMA,
    requestId: "req-1",
    provider: "future_gemini",
    objectCandidates: [{ label: "PET bottle", itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "high" }],
    materialCandidates: [{ label: "plastic", confidenceBand: "medium" }],
    visibleCautions: [],
    uncertainty: "low",
    needsUserCheck: false,
    ...overrides,
  };
}

test("validateResponse accepts a well-formed model response and echoes back the expected requestId", () => {
  const result = validateResponse(validResponseBody(), "req-1");
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateResponse rejects a response whose requestId differs from the request (already covered elsewhere, kept here for schema-level completeness)", () => {
  const result = validateResponse(validResponseBody({ requestId: "different-id" }), "req-1");
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("invalid_request"));
});

test("validateResponse rejects an object candidate whose itemId/objectType pair isn't in the known ITEM_TYPES map", () => {
  const result = validateResponse(validResponseBody({
    objectCandidates: [{ label: "mystery", itemId: "not-a-real-item", objectType: "not-a-real-item", confidenceBand: "high" }],
  }), "req-1");
  // normalizeResponse silently drops the unrecognized candidate, so the raw
  // vs. normalized length mismatch must surface as invalid_candidate.
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("invalid_candidate"));
});

test("validateResponse rejects a candidate label containing HTML-hostile characters", () => {
  const result = validateResponse(validResponseBody({
    objectCandidates: [{ label: "<script>", itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "high" }],
  }), "req-1");
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("invalid_candidate"));
});

test("validateResponse rejects an unknown uncertainty band", () => {
  const result = validateResponse(validResponseBody({ uncertainty: "extreme" }), "req-1");
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("invalid_response"));
});

test("normalizeResponse caps candidate lists at 3 and dedupes visibleCautions", () => {
  const raw = {
    objectCandidates: [
      { label: "a", itemId: "pet-bottle", objectType: "pet-bottle", confidenceBand: "high" },
      { label: "b", itemId: "plastic-cup", objectType: "plastic-cup", confidenceBand: "high" },
      { label: "c", itemId: "paper-cup", objectType: "paper-cup", confidenceBand: "high" },
      { label: "d", itemId: "can", objectType: "can", confidenceBand: "high" },
    ],
    visibleCautions: ["wet", "wet", "dirty"],
  };
  const normalized = normalizeResponse(raw);
  assert.equal(normalized.objectCandidates.length, 3);
  assert.deepEqual(normalized.visibleCautions, ["wet", "dirty"]);
});

test("normalizeResponse defaults uncertainty to high and needsUserCheck to true when absent/invalid", () => {
  const normalized = normalizeResponse({});
  assert.equal(normalized.uncertainty, "high");
  assert.equal(normalized.needsUserCheck, true);
});
