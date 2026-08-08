(function(root, factory) {
  const api = factory(root, root.AIWaysClassroomSkillRegistry);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AIWaysTeachableSkillRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function(root, registryApi) {
  "use strict";
  const cache = new Map();
  const MAX_ACTIVE_SKILLS = 3;
  const MODEL_TYPE = "teachable_machine_image";
  function fail(code) { throw new Error(code); }
  function canonicalBaseUrl(value) { if (!registryApi?.canonicalModelBaseUrl) fail("skill_registry_url_validator_unavailable"); return registryApi.canonicalModelBaseUrl(value); }
  function validateSkill(skill) {
    if (!skill || typeof skill !== "object") fail("skill_invalid");
    if (skill.modelType !== MODEL_TYPE) fail("skill_model_type_invalid");
    if (!String(skill.skillId || "").trim() || !String(skill.name || "").trim()) fail("skill_metadata_invalid");
    if (!Number.isFinite(Number(skill.version)) || Number(skill.version) < 1) fail("skill_version_invalid");
    return { ...skill, modelBaseUrl: canonicalBaseUrl(skill.modelBaseUrl), version: Number(skill.version) };
  }
  function cacheKey(skill) { return `${skill.skillId}::${skill.version}::${skill.modelBaseUrl}`; }
  async function readMetadata(baseUrl, fetcher) {
    const response = await fetcher(`${baseUrl}metadata.json`, { credentials: "omit" });
    if (!response?.ok) fail("tm_metadata_unavailable");
    const metadata = await response.json();
    const labels = Array.isArray(metadata?.labels) ? metadata.labels.map(value => String(value || "").trim()) : [];
    if (!labels.length || labels.some(value => !value) || new Set(labels).size !== labels.length) fail("tm_metadata_invalid");
    return { metadata, labels };
  }
  async function defaultModelLoader(baseUrl) {
    const runtime = await root.AIWaysAiRuntime?.loadTeachableMachine?.();
    if (!runtime?.load) fail("tm_runtime_unavailable");
    return runtime.load(`${baseUrl}model.json`, `${baseUrl}metadata.json`);
  }
  async function loadTeachableSkillModel(skill, options = {}) {
    const valid = validateSkill(skill), key = cacheKey(valid);
    if (cache.has(key)) return cache.get(key);
    const fetcher = options.fetcher || root.fetch, modelLoader = options.modelLoader || defaultModelLoader;
    if (typeof fetcher !== "function") fail("tm_fetch_unavailable");
    if (typeof modelLoader !== "function") fail("tm_loader_unavailable");
    const pending = (async () => {
      const { metadata, labels } = await readMetadata(valid.modelBaseUrl, fetcher);
      const model = await modelLoader(valid.modelBaseUrl, { metadata, labels });
      if (!model || typeof model.predict !== "function") fail("tm_model_invalid");
      const registryLabels = Array.isArray(valid.classes) ? valid.classes.map(value => String(value).trim()) : [];
      return { model, labels, cacheKey: key, runtimeVersion: String(metadata.version || metadata.tmVersion || "tm-image"), registryLabelsMatch: !registryLabels.length || (registryLabels.length === labels.length && registryLabels.every((label, index) => label === labels[index])) };
    })();
    cache.set(key, pending);
    try { return await pending; } catch (error) { cache.delete(key); throw error; }
  }
  function clearTeachableSkillCache() { cache.clear(); }
  function normalizePredictions(values) {
    if (!Array.isArray(values)) fail("tm_predictions_invalid");
    return values.map(value => {
      const label = String(value?.className ?? value?.label ?? "").trim(), confidence = Number(value?.probability ?? value?.confidence);
      if (!label || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) fail("tm_prediction_invalid");
      return { label, confidence };
    }).sort((left, right) => right.confidence - left.confidence || left.label.localeCompare(right.label)).slice(0, 3);
  }
  async function runSupportingSkillInference(imageInput, skill, options = {}) {
    const started = Date.now();
    try {
      const valid = validateSkill(skill);
      const loaded = await loadTeachableSkillModel(valid, options), predictions = normalizePredictions(await loaded.model.predict(imageInput));
      return { skillId: valid.skillId, skillName: valid.name, version: valid.version, status: "success", predictions, topPrediction: predictions[0] || null, inferenceLatencyMs: Date.now() - started, registryLabelsMatch: loaded.registryLabelsMatch };
    } catch (error) { return { skillId: String(skill?.skillId || ""), skillName: String(skill?.name || ""), version: Number(skill?.version || 0), status: "error", predictions: [], topPrediction: null, inferenceLatencyMs: Date.now() - started, error: String(error?.message || "tm_inference_failed") }; }
  }
  function enabledTeachableSkills(skills) { return (Array.isArray(skills) ? skills : []).filter(skill => skill?.modelType === MODEL_TYPE && (skill.enabled === true || skill.status === "enabled")).sort((left, right) => String(left.skillId).localeCompare(String(right.skillId)) || Number(right.version || 0) - Number(left.version || 0)).slice(0, MAX_ACTIVE_SKILLS); }
  async function getSupportingSkillEvidence(imageInput, enabledSkills, options = {}) { return Promise.all(enabledTeachableSkills(enabledSkills).map(skill => runSupportingSkillInference(imageInput, skill, options))); }
  function buildSkillEvidenceContext(evidence) { return { role: "supporting_skill_only", policy: "Teachable Machine evidence is reference-only and never determines disposal, record status, Gemini output, or the user's final judgement.", evidence: (Array.isArray(evidence) ? evidence : []).filter(item => item.status === "success").map(item => ({ skillId: item.skillId, skillName: item.skillName, version: item.version, topPrediction: item.topPrediction, predictions: item.predictions })) }; }
  return { MAX_ACTIVE_SKILLS, loadTeachableSkillModel, runSupportingSkillInference, getSupportingSkillEvidence, buildSkillEvidenceContext, clearTeachableSkillCache };
});
