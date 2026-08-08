const test = require("node:test");
const assert = require("node:assert/strict");
const { createRegistry, canonicalModelBaseUrl, previewTeachableMachineModel, getSupportingSkillEvidence, buildSkillEvidenceContext } = require("../../classroomSkillRegistry.js");

function storage() { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }; }
function input(overrides = {}) { return { name: "우리 반 병 분류", description: "투명 병과 캔을 구분했어요.", modelBaseUrl: "https://teachablemachine.withgoogle.com/models/demo/", modelVersion: "tm-image-v1", classes: ["병", "캔"], schoolId: "school-a", grade: "5", className: "1", visibility: "class", ...overrides }; }

test("registers cumulative skills without deleting prior versions", () => {
  const registry = createRegistry({ storage: storage() });
  const first = registry.registerSkill(input()).skill;
  const second = registry.registerSkill(input({ name: "우리 반 포장 분류", modelBaseUrl: "https://teachablemachine.withgoogle.com/models/second/" })).skill;
  assert.equal(registry.listSkills().length, 2); assert.notEqual(first.skillId, second.skillId);
  const version = registry.createSkillVersion(first.skillId, input({ name: "우리 반 병 분류 v2", modelBaseUrl: "https://teachablemachine.withgoogle.com/models/first-v2/" })).skill;
  assert.equal(version.parentSkillId, first.skillId); assert.equal(version.version, 2); assert.equal(registry.listSkills().length, 3);
});
test("supports enable disable and class scope without client identity fields", () => {
  const registry = createRegistry({ storage: storage() }); const skill = registry.registerSkill(input()).skill;
  assert.equal(registry.listEnabledSkills({ schoolId: "school-a", grade: "5", className: "1" }).length, 1);
  registry.disableSkill(skill.skillId); assert.equal(registry.listEnabledSkills().length, 0);
  registry.enableSkill(skill.skillId); assert.equal(registry.getSkill(skill.skillId).status, "enabled");
  assert.equal(JSON.stringify(registry.getSkill(skill.skillId)).includes("actorId"), false);
});
test("rejects insecure, local and duplicate model URLs", () => {
  assert.throws(() => canonicalModelBaseUrl("javascript:alert(1)"), /model_url_https_required/);
  assert.throws(() => canonicalModelBaseUrl("http://example.com/model.json"), /model_url_https_required/);
  assert.throws(() => canonicalModelBaseUrl("https://localhost/model.json"), /model_url_localhost_forbidden/);
  const registry = createRegistry({ storage: storage() }); registry.registerSkill(input());
  assert.throws(() => registry.registerSkill(input()), /skill_model_url_duplicate/);
});
test("parses Teachable Machine metadata without executing scripts", async () => {
  const calls = []; const preview = await previewTeachableMachineModel("https://teachablemachine.withgoogle.com/models/demo/model.json", async url => { calls.push(url); return { ok: true, json: async () => url.endsWith("metadata.json") ? { labels: ["병", "캔"], version: "v3" } : { format: "layers-model" } }; });
  assert.equal(preview.modelBaseUrl, "https://teachablemachine.withgoogle.com/models/demo/"); assert.deepEqual(preview.classes, ["병", "캔"]); assert.equal(calls.length, 2);
});
test("creates announcement and adoption contracts while keeping TM evidence inactive", () => {
  const registry = createRegistry({ storage: storage() }); const result = registry.registerSkill(input());
  assert.equal(result.announcement.type, "skill_registered"); assert.match(result.announcement.message, /새 기술을 배웠어요/);
  const adoption = registry.adoptSkill({ skillId: result.skill.skillId, schoolId: "school-b", classId: "6-2" }); assert.equal(adoption.enabled, true);
  const evidence = getSupportingSkillEvidence("never-persist-image", [result.skill.skillId]); assert.equal(evidence.mode, "future_tm_inference_disabled");
  assert.match(buildSkillEvidenceContext([]).policy, /reference-only/);
});
