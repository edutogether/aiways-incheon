"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const requiredIds = ["dashboard", "gradeSelect", "classSelect", "cameraInput", "uploadInput", "galleryStage", "galleryDetail", "sorting", "searchInput", "searchButton", "tmModelInput", "tmApplyButton", "sortingTimeline", "holdList", "aiModal", "modalPreview", "confirmDecision", "cancelDecision", "saveState"];
const requiredData = ["data-nav", "data-upload", "data-tab", "data-panel", "data-sorting-mode", "data-sorting-mode-panel", "data-quick-item", "data-sorting-result", "data-judgement-correction", "data-judgement-check", "data-judgement-action", "data-final-category", "data-close-analysis"];

test("frontend DOM keeps the app event contract", () => {
  requiredIds.forEach((id) => assert.match(html, new RegExp(`id=["']${id}["']`), id));
  requiredData.forEach((attribute) => assert.match(html + app, new RegExp(attribute), attribute));
  ["#sorting", "[data-sorting-result]", "#aiModal", "[data-judgement-action]"].forEach((selector) => assert.match(app, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), selector));
});

test("frontend preserves learner-facing decision boundaries", () => {
  ["AI가 확인할 항목을 제안합니다.", "최종 배출 판단은 사용자가 결정합니다.", "학생이 최종 판단을 누르기 전까지 기록은 저장되지 않습니다.", "AI가 먼저 제안하고, 사람이 최종 판단하다"].forEach((copy) => assert.match(html + app, new RegExp(copy)));
});

test("initial document has no advisory AI runtime and has deterministic order", () => {
  assert.doesNotMatch(html, /(?:tensorflow|mobilenet|teachablemachine)[^\n]*<\/script>/i);
  const firebase = html.indexOf("./firebaseAppCheck.js");
  const loader = html.indexOf("./aiRuntimeLoader.js");
  const application = html.indexOf("./app.js");
  assert.ok(firebase >= 0 && firebase < loader && loader < application, "firebase app-check, loader, app order");
  assert.doesNotMatch(html, /(?:COMMON|PAGE)_FINAL_FIX/i);
});
