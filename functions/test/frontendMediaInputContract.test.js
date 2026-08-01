"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "aiRuntimeLoader.js"), "utf8");

test("photo inputs preserve camera and file-selection contracts", () => {
  assert.match(html, /<input id="cameraInput" type="file" accept="image\/\*" capture="environment" hidden/);
  assert.match(html, /<input id="uploadInput" type="file" accept="image\/\*" hidden/);
  assert.match(html, /data-upload="camera"/);
  assert.match(html, /data-upload="file"/);
  assert.match(app, /button\.dataset\.upload === "camera"\) cameraInput\?\.click\(\)/);
  assert.match(app, /else uploadInput\?\.click\(\)/);
  assert.match(app, /input\.files && input\.files\[0\]/);
  assert.match(app, /handleImage\(file\)/);
});

test("photo handling rejects non-images and releases preview resources", () => {
  assert.match(app, /if \(!file \|\| !file\.type\.startsWith\("image\/"\)\) return/);
  assert.match(app, /URL\.createObjectURL\(file\)/);
  assert.match(app, /URL\.revokeObjectURL\(previewUrl\)/);
  assert.match(app, /input\.value = ""/);
  assert.doesNotMatch(app, /localStorage\.setItem\([^\n]*(?:base64|image|photo)/i);
});

test("photo contract keeps non-camera fallback and avoids original-image persistence", () => {
  assert.match(html, /data-upload="file"[\s\S]*?(?:찍은 사진 올리기|저장된 사진 선택)/);
  assert.match(app, /\[cameraInput, uploadInput\]\.forEach/);
  assert.doesNotMatch(html + app, /localStorage\.setItem\([^\n]*(?:base64|data:image)/i);
});

test("advisory AI runtime remains lazy, deduplicated and safely bounded", () => {
  assert.doesNotMatch(html, /(?:tensorflow|mobilenet|teachablemachine)[^\n]*<\/script>/i);
  assert.match(loader, /const pending = new Map\(\)/);
  assert.match(loader, /if \(pending\.has\(name\)\) return pending\.get\(name\)/);
  assert.match(loader, /runtime timed out/);
  assert.match(loader, /async function loadMobileNet\(\)[\s\S]*loadScript\("tf"\)[\s\S]*loadScript\("mobilenet"\)/);
  assert.match(loader, /async function loadTeachableMachine\(\)[\s\S]*loadScript\("tf"\)[\s\S]*loadScript\("teachableMachine"\)/);
});
