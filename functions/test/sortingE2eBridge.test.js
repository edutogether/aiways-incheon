"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const app = fs.readFileSync(path.resolve(__dirname, "..", "..", "app.js"), "utf8");

test("localhost E2E bridge gates and delegates to the full prepared-image flow", () => {
  assert.match(app, /e2eHost === "localhost" \|\| e2eHost === "127\.0\.0\.1"/);
  assert.match(app, /e2eParams\.get\("e2e"\) === "1"/);
  assert.match(app, /window\.__AIWAYS_E2E__ = Object\.freeze/);
  assert.match(app, /async function runPreparedImageFlow\(image, \{ file, session \}\)/);
  assert.match(app, /analyzePreparedImage: \(preparedImage, options\) => runPreparedImageFlow\(preparedImage, options\)/);
  assert.match(app, /image\.onload = \(\) => runPreparedImageFlow\(image, \{ file, session \}\)/);
  const bridgeSource = app.slice(app.indexOf("window.__AIWAYS_E2E__"), app.indexOf("function openModal"));
  assert.doesNotMatch(bridgeSource, /classifyImage\(/);
  assert.doesNotMatch(app, /__AIWAYS_E2E__[\s\S]{0,300}(?:GEMINI_API_KEY|actorId|managementId)/);
});
