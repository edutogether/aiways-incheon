"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const app = fs.readFileSync(path.resolve(__dirname, "..", "..", "app.js"), "utf8");

test("localhost E2E bridge gates and delegates only to the private prepared-image entry", () => {
  assert.match(app, /e2eHost === "localhost" \|\| e2eHost === "127\.0\.0\.1"/);
  assert.match(app, /e2eParams\.get\("e2e"\) === "1"/);
  assert.match(app, /window\.__AIWAYS_E2E__ = Object\.freeze/);
  assert.match(app, /analyzePreparedImage: \(preparedImage, options\) => classifyImage\(preparedImage, options\)/);
  assert.doesNotMatch(app, /__AIWAYS_E2E__[\s\S]{0,300}(?:GEMINI_API_KEY|actorId|managementId)/);
});
