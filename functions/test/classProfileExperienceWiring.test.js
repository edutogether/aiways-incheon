"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createClassProfileStore } = require("../../classProfileStore.js");
const { createRegistry } = require("../../classroomSkillRegistry.js");

function storage() { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }; }
function skill(name, scope, visibility = "class") { return { name, description: name, modelBaseUrl: `https://example.test/${name}/`, classes: ["PLASTIC"], visibility, ...scope }; }
const root = path.resolve(__dirname, "..", "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("class profile persistence and scoped skills preserve the no-profile baseline", () => {
  const profiles = createClassProfileStore({ storage: storage(), now: () => "2026-08-09T00:00:00.000Z" });
  const registry = createRegistry({ storage: storage() });
  const a = { schoolId: "school-a", schoolName: "AI Ways", grade: "3", classId: "3-2", className: "3-2", mode: "personal" };
  const b = { ...a, classId: "3-3", className: "3-3", mode: "class_device" };
  registry.registerSkill(skill("a-only", a)); registry.registerSkill(skill("b-only", b)); registry.registerSkill(skill("school", { ...a, className: "3-9" }, "school")); registry.registerSkill(skill("public", { ...a, schoolId: "school-b" }, "public"));
  assert.equal(registry.listEnabledSkillsForClassProfile(null).length, 4);
  assert.deepEqual(registry.listEnabledSkillsForClassProfile(profiles.saveClassProfile(a)).map(value => value.name).sort(), ["a-only", "public", "school"]);
  assert.deepEqual(registry.listEnabledSkillsForClassProfile(profiles.saveClassProfile(b)).map(value => value.name).sort(), ["b-only", "public", "school"]);
  assert.equal(profiles.loadClassProfile().mode, "class_device");
  profiles.clearClassProfile(); assert.equal(profiles.loadClassProfile(), null); assert.equal(registry.listSkills().length, 4);
});

test("app wiring loads, scopes, clears and keeps profile inputs privacy-safe", () => {
  assert.match(app, /activeClassProfile = classProfileStore\?\.loadClassProfile\?\.\(\) \|\| null/);
  assert.match(app, /listEnabledSkillsForClassProfile\?\.\(activeClassProfile\)/);
  assert.match(app, /classProfileStore\.saveClassProfile/);
  assert.match(app, /classProfileStore\?\.clearClassProfile\?\.\(\)/);
  assert.match(html, /id="classProfileForm"/); assert.match(html, /id="classProfileMode"/);
  assert.doesNotMatch(`${app}\n${html}`, /classProfile(?:Student|Email|Password|Ip|Uid|ActorId|Fingerprint|Gps)/i);
});
