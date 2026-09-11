"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
  // 🔴 "학생들이 학습한 보조 모델의 참고 결과입니다"는 없어진 3초 판단 패널의
  //    문구였다. 화면이 사라진 뒤 코드만 남아 사진마다 TypeError를 내고 있어
  //    2026-09-11에 걷어냈다(결정 Bumm). 위 다섯 줄은 살아 있는 코드가 그대로 갖고 있다.
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
  // 🔴 `data-judgement-action`/`data-judgement-correction`은 없어진 패널의 버튼이었다.
  //    그 패널을 그리던 코드를 2026-09-11에 걷어냈다 - **리스너도 없었으므로**
  //    누를 수 있는 사람이 애초에 없었다. 직접 선택 경로는 아래 모달이 담당한다.
  assert.match(app, /id="aiModal"|#aiModal/);
});
