"use strict";
// 2026-09-01 종합감사(B그룹 4번): 이 파일은 어떤 유닛테스트에서도 직접
// require된 적 없었다(protectedRecordsEmulatorIntegration.js가 핸들러
// 전체를 에뮬레이터로 통째로 검증하긴 하지만, publicRecord()의 필드
// 화이트리스트 자체 - Firestore 문서에 있는 임의 필드가 클라이언트로
// 새어나가지 않는지 - 는 별도로 확인된 적이 없었다). publicRecord와
// 사소해 보이지만 실제로 요청을 걸러내는 guard()의 크기/컨텐츠타입
// 체크를 직접 확인한다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createListSortingRecordsHandler, createResolveSortingRecordHandler, publicRecord } = require("../lib/sortingRecordQuery");

test("publicRecord only copies the known-safe fields, dropping anything else on the Firestore document", () => {
  const out = publicRecord("rec1", {
    schemaVersion: "sorting-record-v1",
    status: "completed",
    provider: "future_gemini",
    // Fields that must NOT leak to the client:
    internalDebugPrompt: "leaked prompt text",
    rawGeminiResponse: { secret: true },
    idempotencyKey: "should-not-leak-either",
  });
  assert.equal(out.recordId, "rec1");
  assert.equal(out.schemaVersion, "sorting-record-v1");
  assert.equal(out.status, "completed");
  assert.equal("internalDebugPrompt" in out, false);
  assert.equal("rawGeminiResponse" in out, false);
  assert.equal("idempotencyKey" in out, false);
});

test("publicRecord converts Firestore Timestamp-shaped date fields to ISO strings", () => {
  const fakeTimestamp = { toDate: () => new Date("2026-01-01T00:00:00.000Z") };
  const out = publicRecord("rec2", { createdAt: fakeTimestamp, updatedAt: new Date("2026-02-02T00:00:00.000Z") });
  assert.equal(out.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(out.updatedAt, "2026-02-02T00:00:00.000Z");
});

test("publicRecord omits a date field entirely rather than emitting null when absent", () => {
  const out = publicRecord("rec3", { status: "held" });
  assert.equal("createdAt" in out, false);
  assert.equal("resolvedAt" in out, false);
});

function fakeRes() {
  const out = { headers: {} };
  return {
    out,
    set(k, v) { out.headers[k] = v; return this; },
    status(s) { out.status = s; return this; },
    json(v) { out.body = v; return this; },
    send(v) { out.body = v; return this; },
  };
}

test("createListSortingRecordsHandler rejects an oversized body before touching the store", async () => {
  const handler = createListSortingRecordsHandler({});
  const res = fakeRes();
  const bigBody = "x".repeat(13 * 1024);
  await handler({ method: "POST", headers: { origin: "http://localhost:5173" }, rawBody: Buffer.from(bigBody), body: {} }, res);
  assert.equal(res.out.status, 413);
  assert.equal(res.out.body.code, "request_too_large");
});

test("createResolveSortingRecordHandler rejects a non-JSON content-type before touching the store", async () => {
  const handler = createResolveSortingRecordHandler({});
  const res = fakeRes();
  await handler({ method: "POST", headers: { origin: "http://localhost:5173", "content-type": "text/plain" }, body: {} }, res);
  assert.equal(res.out.status, 415);
  assert.equal(res.out.body.code, "invalid_content_type");
});

test("both handlers reject a disallowed origin with 403 invalid_origin", async () => {
  for (const create of [createListSortingRecordsHandler, createResolveSortingRecordHandler]) {
    const handler = create({});
    const res = fakeRes();
    await handler({ method: "POST", headers: { origin: "https://evil.example.com" }, body: {} }, res);
    assert.equal(res.out.status, 403);
    assert.equal(res.out.body.code, "invalid_origin");
  }
});
