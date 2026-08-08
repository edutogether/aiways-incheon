"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), registry = require("../../classroomSkillRegistry.js");
global.AIWaysClassroomSkillRegistry = registry;
const runtime = require("../../teachableSkillRuntime.js");
const skill = (id, version = 1, overrides = {}) => ({ skillId: id, name: `Skill ${id}`, modelType: "teachable_machine_image", modelBaseUrl: `https://teachablemachine.withgoogle.com/models/${id}/`, version, classes: ["병", "캔", "종이"], status: "enabled", ...overrides });
const fetcher = metadata => async () => ({ ok: true, json: async () => metadata });
const model = predictions => ({ predict: async () => predictions });
test("validates TM type, HTTPS URL, version and metadata labels", async () => {
  runtime.clearTeachableSkillCache();
  await assert.rejects(() => runtime.loadTeachableSkillModel(skill("bad", 1, { modelType: "other" }), { fetcher: fetcher({ labels: ["병"] }), modelLoader: async () => model([]) }), /skill_model_type_invalid/);
  await assert.rejects(() => runtime.loadTeachableSkillModel(skill("bad-url", 1, { modelBaseUrl: "http://example.com/" }), { fetcher: fetcher({ labels: ["병"] }), modelLoader: async () => model([]) }), /model_url_https_required/);
  await assert.rejects(() => runtime.loadTeachableSkillModel(skill("malformed-url", 1, { modelBaseUrl: "not-a-url" }), { fetcher: fetcher({ labels: ["병"] }), modelLoader: async () => model([]) }), /model_url_invalid/);
  await assert.rejects(() => runtime.loadTeachableSkillModel(skill("bad-meta"), { fetcher: fetcher({ labels: ["병", "병"] }), modelLoader: async () => model([]) }), /tm_metadata_invalid/);
});
test("caches by skill, version and base URL while preserving version entries", async () => {
  runtime.clearTeachableSkillCache(); let loads = 0; const options = { fetcher: fetcher({ labels: ["병", "캔", "종이"], version: "v1" }), modelLoader: async () => { loads += 1; return model([]); } };
  const first = await runtime.loadTeachableSkillModel(skill("a", 1), options), hit = await runtime.loadTeachableSkillModel(skill("a", 1), options), second = await runtime.loadTeachableSkillModel(skill("a", 2), options);
  assert.equal(loads, 2); assert.equal(first.cacheKey, hit.cacheKey); assert.notEqual(first.cacheKey, second.cacheKey);
});
test("returns ordered top three supporting evidence without a final decision", async () => {
  runtime.clearTeachableSkillCache(); const result = await runtime.runSupportingSkillInference("session-image", skill("top"), { fetcher: fetcher({ labels: ["병", "캔", "종이"] }), modelLoader: async () => model([{ className: "종이", probability: 0.2 }, { className: "병", probability: 0.9 }, { className: "캔", probability: 0.5 }, { className: "기타", probability: 0.1 }]) }), context = runtime.buildSkillEvidenceContext([result]);
  assert.equal(result.status, "success"); assert.deepEqual(result.predictions.map(value => value.label), ["병", "캔", "종이"]); assert.equal(context.role, "supporting_skill_only"); assert.equal(Object.hasOwn(context, "decision"), false);
  const invalid = await runtime.runSupportingSkillInference("session-image", skill("invalid-confidence"), { fetcher: fetcher({ labels: ["병"] }), modelLoader: async () => model([{ className: "병", probability: "not-a-number" }]) }); assert.equal(invalid.status, "error");
});
test("isolates failed skills, limits execution to three and keeps A/B/C registry records", async () => {
  runtime.clearTeachableSkillCache(); const calls = []; const options = { fetcher: async url => ({ ok: !url.includes("b/"), json: async () => ({ labels: ["병"] }) }), modelLoader: async base => { calls.push(base); return model([{ className: "병", probability: 1 }]); } };
  const evidence = await runtime.getSupportingSkillEvidence("session-image", [skill("d"), skill("c"), skill("b"), skill("a")], options);
  assert.equal(evidence.length, 3); assert.equal(evidence.filter(value => value.status === "error").length, 1); assert.equal(calls.length, 2);
  assert.deepEqual(await runtime.getSupportingSkillEvidence("session-image", [], options), []);
  const skills = registry.createRegistry(); const a = skills.registerSkill({ name: "A", description: "A", modelBaseUrl: "https://teachablemachine.withgoogle.com/models/a-reg/", classes: ["병"] }).skill, b = skills.registerSkill({ name: "B", description: "B", modelBaseUrl: "https://teachablemachine.withgoogle.com/models/b-reg/", classes: ["캔"] }).skill, c = skills.registerSkill({ name: "C", description: "C", modelBaseUrl: "https://teachablemachine.withgoogle.com/models/c-reg/", classes: ["종이"] }).skill, v2 = skills.createSkillVersion(a.skillId, { name: "A2", description: "A2", modelBaseUrl: "https://teachablemachine.withgoogle.com/models/a2-reg/", classes: ["병"] }).skill;
  assert.deepEqual(skills.listSkills().map(value => value.skillId).sort(), [a.skillId, b.skillId, c.skillId, v2.skillId].sort()); assert.equal(skills.getSkill(a.skillId).version, 1); assert.equal(v2.version, 2);
});
