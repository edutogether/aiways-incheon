"use strict";

const assert = require("node:assert/strict");
const base = "http://127.0.0.1:5001/demo-aiways-incheon/asia-northeast3/analyzeSortingImage";
const imageData = Buffer.from("aiways-image").toString("base64");
const body = { schemaVersion: "sorting-vision-v1", requestId: "emulator-request", sessionId: "emulator-session", locale: "ko-KR", source: "future_gemini", image: { mimeType: "image/jpeg", data: imageData }, imageMetadata: { mimeType: "image/jpeg", width: 12, height: 8, byteLength: Buffer.from(imageData, "base64").length }, userContext: {} };

async function call(method, payload, origin = "http://127.0.0.1:8001") {
  return fetch(base, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
}

(async () => {
  const options = await call("OPTIONS");
  assert.equal(options.status, 204);
  assert.match(options.headers.get("access-control-allow-origin") || "", /127\.0\.0\.1/);
  assert.equal((await call("GET")).status, 405);
  assert.equal((await call("POST", {})).status, 400);
  assert.equal((await call("POST", { ...body, schemaVersion: "bad" })).status, 400);
  assert.equal((await call("POST", { ...body, image: { mimeType: "image/heic", data: imageData } })).status, 400);
  const unavailable = await call("POST", body);
  assert.equal(unavailable.status, 503);
  const unavailableBody = await unavailable.json();
  assert.equal(unavailableBody.code, "provider_unavailable");
  assert.equal(unavailableBody.requestId, "emulator-request");
  process.stdout.write("Functions Emulator smoke checks passed\n");
})().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
