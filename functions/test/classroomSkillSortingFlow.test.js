"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const registry = fs.readFileSync(path.join(root, "classroomSkillRegistry.js"), "utf8");

test("runs only enabled classroom skills as non-blocking supporting evidence", () => {
  assert.match(app, /function enabledClassroomSkills\(\)[\s\S]*listEnabledSkills/);
  assert.match(app, /const supportingEvidencePromise = collectSupportingSkillEvidence\(image, activeSkills\)/);
  assert.doesNotMatch(app, /await supportingEvidencePromise/);
  assert.match(app, /loadTeachableSkillRuntime\(\)\.then\(runtime => runtime\.getSupportingSkillEvidence/);
});

test("keeps Gemini primary while rendering agreement, conflict and low-confidence reference copy", () => {
  assert.match(app, /status: "AGREEMENT"/);
  assert.match(app, /status: "CONFLICT"/);
  assert.match(app, /약한 참고 결과/);
  assert.match(app, /우리 반이 가르쳐준 모델도 같은 쪽을 보고 있어요/);
  assert.match(app, /제 생각과 우리 반 모델의 의견이 조금 달라요/);
  assert.match(app, /학생들이 학습한 보조 모델의 참고 결과입니다/);
});

test("offers the HTTPS Seed Skill, count, version and in-memory retry without photo persistence", () => {
  assert.match(app, /AIWAYS_SEED_SKILL/);
  assert.match(app, /aiways-seed-recycling-v1/);
  assert.match(html, /id="classroomSeedSkillButton"/);
  assert.match(html, /id="classroomSkillCount"/);
  assert.match(app, /우리 반이 AI에게 가르친 기술 \$\{skills\.length\}개/);
  assert.match(app, /다시 분석하기/);
  assert.match(app, /sessionImageFile = file/);
  assert.doesNotMatch(app, /localStorage\.setItem\([^\n]*(?:sessionImageFile|base64|data:image)/i);
});

test("preserves direct selection and the registry announcement handoff", () => {
  assert.match(app, /classroomSkillRegistry\.registerSkill\(pending\)/);
  assert.match(registry, /새 기술을 배웠어요/);
  assert.match(app, /data-judgement-action="decide"/);
  assert.match(app, /data-judgement-correction/);
});
