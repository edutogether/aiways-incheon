"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createRegistry } = require("../../classroomSkillRegistry.js");
function storage() { let value = null; return { getItem: () => value, setItem: (_, next) => { value = next; } }; }
function skill(name, scope, visibility = "class", enabled = true) { return { name, description: name, modelBaseUrl: `https://example.test/${name}/`, classes: ["PLASTIC"], visibility, enabled, ...scope }; }
test("class profiles filter enabled classroom skills without deleting records", () => {
  const registry = createRegistry({ storage: storage() });
  const a = { schoolId: "school-a", grade: "3", className: "3-2" }, b = { schoolId: "school-a", grade: "3", className: "3-3" };
  const exact = registry.registerSkill(skill("exact", a)).skill;
  registry.registerSkill(skill("other-class", b)); registry.registerSkill(skill("other-grade", { schoolId: "school-a", grade: "4", className: "4-2" })); registry.registerSkill(skill("other-school", { schoolId: "school-b", grade: "3", className: "3-2" }));
  registry.registerSkill(skill("school", { ...a, className: "3-9" }, "school")); registry.registerSkill(skill("public", { schoolId: "school-b", grade: "9", className: "9-9" }, "public"));
  const disabled = registry.registerSkill(skill("disabled", a, "class", false)).skill;
  assert.deepEqual(registry.listEnabledSkillsForClassProfile(a).map(x => x.name).sort(), ["exact", "public", "school"]);
  assert.deepEqual(registry.listEnabledSkillsForClassProfile(b).map(x => x.name).sort(), ["other-class", "public", "school"]);
  assert.equal(registry.getSkill(exact.skillId).name, "exact"); assert.equal(registry.getSkill(disabled.skillId).status, "disabled");
  assert.equal(registry.listSkills().length, 7); assert.equal(registry.listEnabledSkillsForClassProfile(null).length, 6);
});
