"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
  // 🔴 셋을 뺐다 - "잘했어요. 배출 준비가 완료됐습니다." / "지금 확정하지 않아도…" /
  //    "AI 사진 분석 참고 후보"는 **없어진 3초 판단 패널**의 문구였다. 화면이 사라진 뒤
  //    코드만 남아 사진마다 TypeError를 내고 있어 2026-09-11에 걷어냈다(결정 Bumm).
  //    남은 셋은 지금도 화면·코드에 그대로 있다.
  ["AI가 확인할 항목을 제안합니다.", "최종 배출 판단은 사용자가 결정합니다.", "future_gemini"].forEach((copy) => assert.ok((html + app).includes(copy), copy));
});

test("raw color exceptions stay limited to token, transparency and chart effects", () => {
  const componentCss = css.slice(css.indexOf("@layer base"));
  const rawColors = componentCss.match(/(?:#[0-9a-f]{3,8}\b|rgb\()/gi) || [];
  assert.ok(rawColors.length <= 10, JSON.stringify({ rawColors: rawColors.length }));
});
