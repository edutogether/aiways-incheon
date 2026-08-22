"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSearchSchoolHandler } = require("../lib/schoolSearch");

async function invoke(handler, body) {
  const result = { statusCode: 0, payload: null, headers: {} };
  const res = { set(k, v) { result.headers[k] = v; return this; }, status(code) { result.statusCode = code; return this; }, json(value) { result.payload = value; return this; }, send(value) { result.payload = value; return this; } };
  await handler({ method: "POST", headers: { origin: "https://edutogether.github.io" }, body }, res);
  return result;
}
const allowLimit = { check: async () => ({ allowed: true, outcome: "allowed" }) };
const allowAccess = { resolve: async () => ({ ok: true, actorId: "actor_test" }) };
const validAppCheck = async () => ({ status: "valid" });
function neisRow(overrides = {}) {
  return { SD_SCHUL_CODE: "7321071", SCHUL_NM: "남인천초등학교", SCHUL_KND_SC_NM: "초등학교", LCTN_SC_NM: "인천광역시", ...overrides };
}
function handlerFor(rows = [neisRow()], fetchImpl) {
  return createSearchSchoolHandler({
    appCheck: validAppCheck, access: allowAccess, actorRateLimiter: allowLimit, rateLimiter: allowLimit,
    getApiKey: () => "mock-key",
    fetch: fetchImpl || (async () => ({ ok: true, json: async () => ({ schoolInfo: [{ head: [{ list_total_count: rows.length }] }, { row: rows }] }) }))
  });
}

test("returns cleaned school list from NEIS response", async () => {
  const result = await invoke(handlerFor(), { query: "인천초" });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload.schools, [{ schoolCode: "7321071", schoolName: "남인천초등학교", schoolLevel: "초등학교", region: "인천광역시" }]);
});
test("rejects short or missing query without calling NEIS", async () => {
  let called = false;
  const handler = handlerFor([], async () => { called = true; return { ok: true, json: async () => ({}) }; });
  assert.equal((await invoke(handler, { query: "a" })).statusCode, 400);
  assert.equal((await invoke(handler, {})).payload.code, "invalid_query");
  assert.equal(called, false);
});
test("rejects unknown fields and oversized query", async () => {
  const handler = handlerFor();
  assert.equal((await invoke(handler, { query: "인천초", extra: 1 })).payload.code, "unknown_field");
  assert.equal((await invoke(handler, { query: "x".repeat(61) })).payload.code, "invalid_query");
});
test("handles NEIS empty result (no schoolInfo key) as zero schools", async () => {
  const handler = handlerFor([], async () => ({ ok: true, json: async () => ({ RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." } }) }));
  const result = await invoke(handler, { query: "존재안하는학교이름입니다" });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload.schools, []);
});
test("fails safe when NEIS is unreachable or errors, never leaking the API key", async () => {
  const handler = handlerFor([], async () => { throw new Error("network down"); });
  const result = await invoke(handler, { query: "인천초" });
  assert.equal(result.statusCode, 502);
  assert.equal(result.payload.code, "provider_unavailable");
  assert.equal(JSON.stringify(result).includes("mock-key"), false);
});
test("drops rows missing a school code or name", async () => {
  const handler = handlerFor([neisRow({ SD_SCHUL_CODE: "" }), neisRow({ SCHUL_NM: "" }), neisRow()]);
  const result = await invoke(handler, { query: "인천초" });
  assert.equal(result.payload.schools.length, 1);
});
test("rejects when getApiKey has no value configured", async () => {
  const handler = createSearchSchoolHandler({ appCheck: validAppCheck, access: allowAccess, actorRateLimiter: allowLimit, rateLimiter: allowLimit, getApiKey: () => "" });
  const result = await invoke(handler, { query: "인천초" });
  assert.equal(result.statusCode, 503);
});
