"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const requiredTokens = ["canvas-bg","elevated-bg","surface-1","surface-2","surface-3","text-primary","text-secondary","text-tertiary","line-subtle","line-default","line-strong","accent-primary","accent-secondary","success","caution","error","info","focus","shadow-low","shadow-medium","shadow-high","glow-subtle","radius-small","radius-medium","radius-large","radius-pill","control-height","duration","ease"];

test("design system exposes complete semantic tokens and states", () => {
  requiredTokens.forEach((token) => assert.match(css, new RegExp(`--${token}:`), token));
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /judgement-candidate-block/);
  assert.match(css, /judgement-checklist/);
  assert.match(css, /is-ready/);
  assert.match(css, /is-hold/);
  assert.match(css, /error-state/);
  assert.match(css, /primary-btn/);
  assert.match(css, /secondary-btn/);
});

test("design hard constraints and fixed learner contract remain intact", () => {
  assert.equal((css.match(/!important/g) || []).length, 0);
  assert.doesNotMatch(css, /(?:PAGE_FIX|FINAL_FIX|scroll-snap|overflow-x\s*:\s*hidden)/i);
  assert.ok((css.match(/@media\s*\(/g) || []).length <= 5);
  assert.doesNotMatch(html, /(?:tensorflow|mobilenet|teachablemachine)[^\n]*<\/script>/i);
  ["AI가 확인할 항목을 제안합니다.", "최종 배출 판단은 사용자가 결정합니다.", "잘했어요. 배출 준비가 완료됐습니다.", "지금 확정하지 않아도 됩니다. 확인이 필요한 물건으로 보류함에 저장할까요?", "AI 사진 분석 참고 후보", "future_gemini"].forEach((copy) => assert.ok((html + app).includes(copy), copy));
});

test("raw color exceptions stay limited to token, transparency and chart effects", () => {
  const componentCss = css.slice(css.indexOf("@layer base"));
  const rawColors = componentCss.match(/(?:#[0-9a-f]{3,8}\b|rgb\()/gi) || [];
  assert.ok(rawColors.length <= 10, JSON.stringify({ rawColors: rawColors.length }));
});
