"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanSchoolId, cleanPathSegment } = require("../lib/firestorePathSafety");

test("cleanSchoolId accepts 1-12 digit NEIS codes only", () => {
  assert.equal(cleanSchoolId("7341025"), "7341025");
  assert.equal(cleanSchoolId("123456789012"), "123456789012");
  assert.equal(cleanSchoolId("1234567890123"), ""); // 13 digits, too long
  assert.equal(cleanSchoolId(""), "");
  assert.equal(cleanSchoolId(undefined), "");
  assert.equal(cleanSchoolId("a/b"), "");
  assert.equal(cleanSchoolId("734102a"), "");
});

test("cleanPathSegment rejects '/' and other path-unsafe characters", () => {
  assert.equal(cleanPathSegment("5"), "5");
  assert.equal(cleanPathSegment("5학년"), "5학년");
  assert.equal(cleanPathSegment("a/b"), "");
  assert.equal(cleanPathSegment("a/b/c"), "");
  assert.equal(cleanPathSegment(""), "");
  assert.equal(cleanPathSegment("  ", 10), "");
  assert.equal(cleanPathSegment("12345678901", 10), ""); // over max length
  assert.equal(cleanPathSegment(" 5 "), "5"); // trims
});
