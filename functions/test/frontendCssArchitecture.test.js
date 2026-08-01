"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const declarationCss = css.replace(/@media\s*\([^)]*\)/g, "");
const rules = [...css.matchAll(/(^|\n)\s*([^@}{][^{]+)\{/g)].map((match) => match[2].trim());
const media = [...css.matchAll(/@media\s*\(([^)]+)\)/g)].map((match) => match[1].trim());
const duplicateSelectors = rules.reduce((all, rule) => {
  rule.split(",").map((part) => part.trim()).forEach((selector) => all[selector] = (all[selector] || 0) + 1);
  return all;
}, {});
const report = {
  rules: rules.length,
  media: media.length,
  uniqueViewportConditions: [...new Set(media)].length,
  maxSelectorDefinitions: Math.max(...Object.values(duplicateSelectors)),
  important: (css.match(/!important/g) || []).length,
  fixedHeightDeclarations: (css.match(/(?<!line-)\bheight\s*:/g) || []).length,
  maxHeightDeclarations: (css.match(/\bmax-height\s*:/g) || []).length,
  minWidthDeclarations: (declarationCss.match(/\bmin-width\s*:/g) || []).length,
  nowrapDeclarations: (css.match(/white-space\s*:\s*nowrap/g) || []).length,
  overflowHiddenDeclarations: (css.match(/overflow(?:-[xy])?\s*:\s*hidden/g) || []).length
};

test("frontend CSS is a compact canonical architecture", () => {
  assert.match(css, /^@layer reset, tokens, base, layout, components, sections, states, responsive, utilities;/);
  assert.ok(report.rules <= 700, JSON.stringify(report));
  assert.ok(report.media <= 10 && report.uniqueViewportConditions <= 5, JSON.stringify(report));
  assert.ok(report.maxSelectorDefinitions <= 3, JSON.stringify(report));
  Object.entries(report).filter(([name]) => /Declarations|important/.test(name)).forEach(([, value]) => assert.equal(value, 0, JSON.stringify(report)));
  assert.doesNotMatch(css, /(?:PAGE_FIX|FINAL_FIX|scroll-snap|overflow-x\s*:\s*hidden)/i);
  assert.doesNotMatch(html, /(?:tensorflow|mobilenet|teachablemachine)[^\n]*<\/script>/i);
  process.stdout.write(`${JSON.stringify(report)}\n`);
});
