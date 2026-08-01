"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.resolve(__dirname, "..", "..", "index.html"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "..", "..", "app.js"), "utf8");
const nav = ["대시보드", "프로젝트", "교육과정", "H-A-H", "차시흐름", "갤러리", "3초판단", "자료실"];
const sections = ["dashboard", "project", "curriculum", "hah", "flow", "gallery", "sorting", "resources"];
function orderedIndexes(values, source) { return values.map((value) => source.indexOf(value)); }
function sectionMarkup(id) { const start = html.indexOf(`<section class="scene`, html.indexOf(`id="${id}"`) - 80); const next = sections.slice(sections.indexOf(id) + 1).map((nextId) => html.indexOf(`id="${nextId}"`)).filter((index) => index >= 0)[0] || html.indexOf("</main>"); return html.slice(start, next); }

test("navigation and section order are immutable", () => {
  const navIndexes = orderedIndexes(nav.map((label) => `>${label}</a>`), html);
  const sectionIndexes = orderedIndexes(sections.map((id) => `id="${id}"`), html);
  assert.ok(navIndexes.every((index, position) => index >= 0 && (!position || navIndexes[position - 1] < index)), "nav order");
  assert.ok(sectionIndexes.every((index, position) => index >= 0 && (!position || sectionIndexes[position - 1] < index)), "section order");
});

test("major content remains in its original section", () => {
  const expected = {
    dashboard: ["hero-copy", "dashboard-grid", "school-panel", "landfill-panel", "class-panel", "upload-panel"],
    project: ["project-intro", "project-cards"],
    curriculum: ["curriculum-layout", "subject-grid", "standards-panel"],
    hah: ["hah-grid"], flow: ["flow-grid"], gallery: ["gallery-stage", "galleryDetail"],
    sorting: ["sorting-layout", "sorting-app", "data-sorting-result", "tmModelInput"], resources: ["resource-grid", "footer-credit"]
  };
  Object.entries(expected).forEach(([id, markers]) => markers.forEach((marker) => assert.ok(sectionMarkup(id).includes(marker), `${id}: ${marker}`)));
});

test("event hooks, fixed copy and Stage 8 authentication UI stay unchanged", () => {
  ["cameraInput", "uploadInput", "searchInput", "aiModal", "data-upload", "data-tab", "data-sorting-mode", "data-judgement-action", "data-final-category"].forEach((value) => assert.ok((html + app).includes(value), value));
  ["AI가 먼저 제안하고, 사람이 최종 판단하다", "사진은 저장하지 않고 판단 결과만 쌓아 회의 안건으로 연결합니다.", "수업 설계 기획안"].forEach((copy) => assert.ok(html.includes(copy), copy));
  assert.doesNotMatch(html, /(?:stage\s*8|authentication|로그인|회원가입)/i);
});
