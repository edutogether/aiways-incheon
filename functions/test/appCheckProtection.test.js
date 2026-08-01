"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { APP_CHECK_ENFORCEMENT, extractAppCheckToken, observeAppCheck } = require("../lib/appCheckProtection");
const { createAnalyzeSortingHandler } = require("../lib/sortingVision");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");
const { createListSortingRecordsHandler, createResolveSortingRecordHandler } = require("../lib/sortingRecordQuery");

function response() {
  return { set() { return this; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, send() { return this; } };
}

test("enforces App Check by default without logging token material", async () => {
  assert.equal(APP_CHECK_ENFORCEMENT, true);
  assert.equal(extractAppCheckToken({ headers: { "X-Firebase-AppCheck": "token" } }), "token");
  assert.equal(extractAppCheckToken({ headers: {} }), "");
  const cases = [
    ["valid", undefined, undefined, async () => {}, { "x-firebase-appcheck": "token" }],
    ["missing", "app_check_missing", 401, async () => {}, {}],
    ["invalid", "app_check_invalid", 401, async () => { throw Error(); }, { "x-firebase-appcheck": "token" }],
    ["unavailable", "protection_unavailable", 503, async () => { const error = Error(); error.code = "unavailable"; throw error; }, { "x-firebase-appcheck": "token" }]
  ];
  for (const [status, code, httpStatus, verifier, headers] of cases) {
    const logs = [];
    const out = await observeAppCheck({ headers }, { functionName: "test", requestId: "r", verifier, logger: value => logs.push(value) });
    assert.equal(out.status, status);
    assert.equal(out.code, code);
    assert.equal(out.httpStatus, httpStatus);
    assert.equal(logs[0].event, "app_check_observation");
    assert.equal(logs[0].enforcement, true);
    assert.equal(JSON.stringify(logs).includes("token"), false);
  }
});

test("all HTTP handlers stop enforced App Check failures before privileged work", async () => {
  let provider = 0;
  let rateLimit = 0;
  let idempotencyClaim = 0;
  let storeAccess = 0;
  const appCheck = async () => ({ status: "missing", httpStatus: 401, code: "app_check_missing" });
  const rateLimiter = { check: async () => { rateLimit += 1; return { allowed: true, outcome: "allowed" }; } };
  const analysisRequests = { claimAnalysisRequest: async () => { idempotencyClaim += 1; return { state: "claimed" }; }, completeAnalysisRequest: async () => true, failAnalysisRequest: async () => true };
  const handlers = [
    createAnalyzeSortingHandler({ appCheck, rateLimiter, analysisRequests, getApiKey: () => "mock", createClient: () => ({ models: { generateContent: async () => { provider += 1; } } }) }),
    createSaveSortingRecordHandler({ appCheck, rateLimiter, store: { createOrGet: async () => { storeAccess += 1; } } }),
    createListSortingRecordsHandler({ appCheck, rateLimiter, store: { list: async () => { storeAccess += 1; } } }),
    createResolveSortingRecordHandler({ appCheck, rateLimiter, store: { resolve: async () => { storeAccess += 1; } }, serverTimestamp: () => new Date() })
  ];
  for (const handler of handlers) {
    const res = response();
    await handler({ method: "POST", headers: {}, body: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, "app_check_missing");
  }
  assert.equal(provider, 0);
  assert.equal(rateLimit, 0);
  assert.equal(idempotencyClaim, 0);
  assert.equal(storeAccess, 0);
});
