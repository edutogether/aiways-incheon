"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanText, isAllowedOrigin, applyCors } = require("../lib/httpGuard");

test("cleanText trims, rejects control chars/angle brackets, and enforces max length", () => {
  assert.equal(cleanText("  hi  "), "hi");
  assert.equal(cleanText("<script>"), "");
  assert.equal(cleanText("a\x01b"), "");
  assert.equal(cleanText("a".repeat(80)), "a".repeat(80));
  assert.equal(cleanText("a".repeat(81)), "");
  assert.equal(cleanText("a".repeat(200), 200), "a".repeat(200));
  assert.equal(cleanText(""), "");
  assert.equal(cleanText(undefined), "");
});

test("isAllowedOrigin accepts the production origins and localhost dev ports only", () => {
  assert.equal(isAllowedOrigin("https://edutogether.github.io"), true);
  assert.equal(isAllowedOrigin("https://ai-ways-incheon.web.app"), true);
  assert.equal(isAllowedOrigin("https://ai-ways-incheon.firebaseapp.com"), true);
  assert.equal(isAllowedOrigin("https://edutogether.kr"), true);
  assert.equal(isAllowedOrigin("http://localhost:5173"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:8080"), true);
  assert.equal(isAllowedOrigin("https://evil.example.com"), false);
  assert.equal(isAllowedOrigin("http://edutogether.github.io"), false);
});

function fakeRes() {
  const headers = {};
  return { headers, set(key, value) { headers[key] = value; } };
}

test("applyCors sets headers for an allowed origin and returns true", () => {
  const res = fakeRes();
  const ok = applyCors({ headers: { origin: "https://edutogether.github.io" } }, res);
  assert.equal(ok, true);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://edutogether.github.io");
  assert.equal(res.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
});

test("applyCors rejects a disallowed origin without setting headers", () => {
  const res = fakeRes();
  const ok = applyCors({ headers: { origin: "https://evil.example.com" } }, res);
  assert.equal(ok, false);
  assert.deepEqual(res.headers, {});
});

test("applyCors allows requests with no Origin header at all (non-browser callers)", () => {
  const res = fakeRes();
  const ok = applyCors({ headers: {} }, res);
  assert.equal(ok, true);
  assert.deepEqual(res.headers, {});
});
