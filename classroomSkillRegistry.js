(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AIWaysClassroomSkillRegistry = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  "use strict";
  const STORAGE_KEY = "aiways.classroomSkillRegistry.v1";
  const EVENT_KEY = "aiways.classroomSkillEvents.v1";
  const MODEL_TYPE = "teachable_machine_image";
  const allowedVisibility = new Set(["class", "school", "public"]);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function makeId(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`; }
  function defaultStorage() { return { skills: [], adoptions: [], events: [] }; }
  function storageAdapter(storage) {
    const target = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    let memory = defaultStorage();
    return {
      read() { try { return target ? { ...defaultStorage(), ...JSON.parse(target.getItem(STORAGE_KEY) || "null") } : clone(memory); } catch { return clone(memory); } },
      write(value) { const next = clone(value); if (target) target.setItem(STORAGE_KEY, JSON.stringify(next)); else memory = next; return next; }
    };
  }
  function canonicalModelBaseUrl(input) {
    let parsed;
    try { parsed = new URL(String(input || "").trim()); } catch { throw new Error("model_url_invalid"); }
    if (parsed.protocol !== "https:") throw new Error("model_url_https_required");
    if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".local") || /^127\./.test(parsed.hostname) || parsed.hostname === "::1") throw new Error("model_url_localhost_forbidden");
    const marker = /\/(model\.json|metadata\.json)$/i;
    parsed.pathname = parsed.pathname.replace(marker, "").replace(/\/+$/, "") + "/";
    parsed.search = ""; parsed.hash = "";
    return parsed.href;
  }
  async function previewTeachableMachineModel(input, fetcher) {
    const baseUrl = canonicalModelBaseUrl(input);
    const request = fetcher || fetch;
    let model, metadata;
    try {
      const [modelResponse, metadataResponse] = await Promise.all([request(`${baseUrl}model.json`, { credentials: "omit" }), request(`${baseUrl}metadata.json`, { credentials: "omit" })]);
      if (!modelResponse.ok || !metadataResponse.ok) throw new Error("model_files_unavailable");
      [model, metadata] = await Promise.all([modelResponse.json(), metadataResponse.json()]);
    } catch (error) { if (error.message === "model_files_unavailable") throw error; throw new Error("model_cors_or_network_failed"); }
    const classes = Array.isArray(metadata.labels) ? metadata.labels.filter(label => typeof label === "string" && label.trim()).map(label => label.trim()) : [];
    if (!model || typeof model !== "object" || !classes.length) throw new Error("model_metadata_invalid");
    return { modelType: MODEL_TYPE, modelBaseUrl: baseUrl, classes, modelVersion: String(metadata.version || model.format || "tm-image-v1") };
  }
  function sanitizeScope(scope) {
    const input = scope || {};
    return { schoolId: String(input.schoolId || "").trim(), grade: String(input.grade || "").trim(), className: String(input.className || "").trim() };
  }
  function publicSkill(skill) {
    const { createdByScope, schoolId, grade, className, ...safe } = skill;
    return { ...safe, createdByScope: { schoolId: "", grade: "", className: "" }, schoolId: "", grade: "", className: "" };
  }
  function buildSkill(input) {
    const scope = sanitizeScope(input.createdByScope || input);
    const visibility = input.visibility || "class";
    if (!allowedVisibility.has(visibility)) throw new Error("skill_visibility_invalid");
    const now = new Date().toISOString();
    const skill = { skillId: makeId("skill"), name: String(input.name || "").trim(), description: String(input.description || "").trim(), modelType: MODEL_TYPE, modelBaseUrl: canonicalModelBaseUrl(input.modelBaseUrl), modelVersion: String(input.modelVersion || "tm-image-v1"), classes: [...new Set(input.classes || [])], createdAt: now, updatedAt: now, createdByScope: scope, schoolId: scope.schoolId, grade: scope.grade, className: scope.className, visibility, status: input.enabled === false ? "disabled" : "enabled", parentSkillId: input.parentSkillId || null, version: Number(input.version || 1), usageCount: 0, adoptionCount: 0, adoptedBySchoolsCount: 0, adoptedByClassesCount: 0, benchmarkScore: null, benchmarkVersion: null };
    if (!skill.name || !skill.description || !skill.classes.length) throw new Error("skill_required_fields_missing");
    return skill;
  }
  function createRegistry(options = {}) {
    const adapter = storageAdapter(options.storage);
    const read = () => adapter.read();
    const event = (state, type, skill, message) => { const entry = { eventId: makeId("skill_event"), type, title: type === "skill_registered" ? "새 기술을 배웠어요!" : "우리 반 AI 기술 업데이트", message, createdAt: new Date().toISOString(), scope: clone(skill.createdByScope), relatedSkillId: skill.skillId }; state.events.push(entry); return entry; };
    const listSkills = scope => { const skills = read().skills; if (!scope) return clone(skills); const s = sanitizeScope(scope); return clone(skills.filter(skill => skill.schoolId === s.schoolId && (!s.grade || skill.grade === s.grade) && (!s.className || skill.className === s.className))); };
    const listEnabledSkillsForClassProfile = profile => {
      if (!profile || typeof profile !== "object") return listSkills().filter(skill => skill.status === "enabled");
      const scope = sanitizeScope({ schoolId: profile.schoolId, grade: profile.grade, className: profile.className });
      if (!scope.schoolId || !scope.grade || !scope.className) return listSkills().filter(skill => skill.status === "enabled");
      return clone(read().skills.filter(skill => skill.status === "enabled" && (
        skill.visibility === "public" ||
        (skill.visibility === "school" && skill.schoolId === scope.schoolId) ||
        (skill.visibility === "class" && skill.schoolId === scope.schoolId && skill.grade === scope.grade && skill.className === scope.className)
      )));
    };
    return {
      registerSkill(input) {
        const state = read(); const next = buildSkill(input);
        if (state.skills.some(skill => skill.modelBaseUrl === next.modelBaseUrl && skill.schoolId === next.schoolId && skill.grade === next.grade && skill.className === next.className)) throw new Error("skill_model_url_duplicate");
        state.skills.push(next); const announcement = event(state, "skill_registered", next, `새 기술을 배웠어요! "${next.name}"을 이제 참고할 수 있습니다. 다시 한번 볼까요? 🎓`); adapter.write(state); return { skill: clone(next), announcement };
      },
      createSkillVersion(parentSkillId, input) {
        const state = read(); const parent = state.skills.find(skill => skill.skillId === parentSkillId); if (!parent) throw new Error("skill_not_found");
        const version = buildSkill({ ...parent, ...input, parentSkillId: parent.skillId, version: parent.version + 1, createdByScope: parent.createdByScope });
        if (state.skills.some(skill => skill.modelBaseUrl === version.modelBaseUrl && skill.skillId !== parent.skillId)) throw new Error("skill_model_url_duplicate");
        state.skills.push(version); const announcement = event(state, "skill_updated", version, `새 기술 버전 ${version.version}을 기록했어요.`); adapter.write(state); return { skill: clone(version), announcement };
      },
      listSkills,
      listEnabledSkillsForClassProfile,
      getSkill(id) { const found = read().skills.find(skill => skill.skillId === id); return found ? clone(found) : null; },
      enableSkill(id) { return this._setStatus(id, "enabled"); },
      disableSkill(id) { return this._setStatus(id, "disabled"); },
      _setStatus(id, status) { const state = read(); const skill = state.skills.find(value => value.skillId === id); if (!skill) throw new Error("skill_not_found"); skill.status = status; skill.updatedAt = new Date().toISOString(); adapter.write(state); return clone(skill); },
      listEnabledSkills(scope) { return listSkills(scope).filter(skill => skill.status === "enabled"); },
      adoptSkill(input) { const state = read(); const skill = state.skills.find(value => value.skillId === input.skillId); if (!skill) throw new Error("skill_not_found"); const scope = sanitizeScope({ ...input, className: input.className || input.classId }); if (!scope.schoolId || !scope.className) throw new Error("adoption_scope_required"); if (state.adoptions.some(value => value.skillId === skill.skillId && value.schoolId === scope.schoolId && value.classId === input.classId)) throw new Error("skill_already_adopted"); const adoption = { adoptionId: makeId("adoption"), skillId: skill.skillId, schoolId: scope.schoolId, classId: String(input.classId || scope.className), adoptedAt: new Date().toISOString(), enabled: input.enabled !== false, lastUsedAt: null }; state.adoptions.push(adoption); skill.adoptionCount += 1; skill.adoptedBySchoolsCount = new Set(state.adoptions.filter(a => a.skillId === skill.skillId).map(a => a.schoolId)).size; skill.adoptedByClassesCount = state.adoptions.filter(a => a.skillId === skill.skillId).length; event(state, "skill_adopted", skill, `새 학교가 "${skill.name}" 기술을 채택했어요.`); adapter.write(state); return clone(adoption); },
      listAnnouncements() { return clone(read().events); },
      exportPublicSkill(id) { const skill = this.getSkill(id); return skill && skill.visibility === "public" ? publicSkill(skill) : null; }
    };
  }
  function getSupportingSkillEvidence(image, skillIds) { return { image, skillIds: [...new Set(skillIds || [])], mode: "future_tm_inference_disabled", evidence: [] }; }
  function buildSkillEvidenceContext(evidence) { return { role: "supporting_skill_only", policy: "TM evidence is reference-only; Gemini and the user must preserve uncertainty and user final judgement.", evidence: Array.isArray(evidence) ? evidence.map(({ skillId, skillName, predictions }) => ({ skillId, skillName, predictions })) : [] }; }
  return { STORAGE_KEY, MODEL_TYPE, canonicalModelBaseUrl, previewTeachableMachineModel, createRegistry, getSupportingSkillEvidence, buildSkillEvidenceContext };
});
