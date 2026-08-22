"use strict";

const SCHEMA_VERSION = "sorting-record-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 24 * 1024;
const FORBIDDEN_KEY = /(?:image|base64|data:image|url|authorization|api[_-]?key|secret|prompt|raw.*response|email|name|access.*code)/i;
const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const { observeAppCheck } = require("./appCheckProtection");
const { protectActorRequest } = require("./protectedActor");

function reject(code) { return { valid: false, code }; }
function cleanText(value, max = 200) {
  return typeof value === "string" && value.length <= max && value.trim() && !/[<>\u0000-\u001f]/.test(value) ? value.trim() : "";
}
function hasForbiddenKey(value) {
  return !!value && typeof value === "object" && Object.keys(value).some((key) => FORBIDDEN_KEY.test(key));
}
function isAllowedOrigin(origin) {
  return origin === "https://edutogether.github.io" || ALLOWED_ORIGIN.test(origin);
}
function applyCors(req, res) {
  const origin = String(req.headers?.origin || "");
  if (origin && !isAllowedOrigin(origin)) return false;
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck, Authorization");
  }
  return true;
}
function normalizeCandidate(value, material) {
  if (!value || typeof value !== "object" || hasForbiddenKey(value)) return null;
  const label = cleanText(value.label);
  const confidenceBand = cleanText(value.confidenceBand, 20);
  if (!label || !["high", "medium", "low", "unknown"].includes(confidenceBand)) return null;
  if (material) return { label, confidenceBand };
  const itemId = cleanText(value.itemId, 40);
  const objectType = cleanText(value.objectType, 40);
  return itemId && objectType ? { label, itemId, objectType, confidenceBand } : null;
}
function normalizeChecklist(value) {
  if (!value || typeof value !== "object" || hasForbiddenKey(value)) return null;
  const id = cleanText(value.id, 80);
  const label = cleanText(value.label);
  return id && label && typeof value.checked === "boolean" ? { id, label, checked: value.checked } : null;
}
// Interim, student-typed school/grade/class (step 4 will replace this with a
// real one-time signup + permanent device lock). Kept optional so records
// saved before this field existed, and any caller that never sets it, still
// validate exactly as before.
function normalizeClassContext(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value) || hasForbiddenKey(value)) return undefined;
  const schoolId = cleanText(value.schoolId, 80);
  const grade = cleanText(String(value.grade ?? ""), 10);
  const classNum = cleanText(String(value.classNum ?? ""), 10);
  return schoolId && grade && classNum ? { schoolId, grade, classNum } : undefined;
}
function validateRecordRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || hasForbiddenKey(body)) return reject("invalid_request");
  const allowed = new Set(["schemaVersion", "status", "provider", "model", "appVersion", "sourceSchemaVersion", "analysis", "checklist", "userDecision", "hold", "idempotencyKey", "classContext"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return reject("unknown_field");
  if (body.schemaVersion !== SCHEMA_VERSION || !["completed", "held"].includes(body.status)) return reject("invalid_schema");
  const provider = cleanText(body.provider, 80);
  const idempotencyKey = cleanText(body.idempotencyKey, 80);
  if (!provider) return reject("invalid_provider");
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) return reject("invalid_idempotency_key");
  const analysis = body.analysis;
  if (!analysis || typeof analysis !== "object" || hasForbiddenKey(analysis)) return reject("invalid_analysis");
  const objects = analysis.objectCandidates;
  const materials = analysis.materialCandidates;
  const cautions = analysis.visibleCautions;
  if (!Array.isArray(objects) || objects.length > 3 || !Array.isArray(materials) || materials.length > 3 || !Array.isArray(cautions) || cautions.length > 5) return reject("analysis_limit");
  const objectCandidates = objects.map((item) => normalizeCandidate(item, false));
  const materialCandidates = materials.map((item) => normalizeCandidate(item, true));
  const visibleCautions = cautions.map((item) => cleanText(item));
  if (objectCandidates.some((item) => !item) || materialCandidates.some((item) => !item) || visibleCautions.some((item) => !item)) return reject("invalid_analysis");
  if (!Array.isArray(body.checklist) || body.checklist.length > 20) return reject("checklist_limit");
  const checklist = body.checklist.map(normalizeChecklist);
  if (checklist.some((item) => !item)) return reject("invalid_checklist");
  const decision = body.userDecision;
  if (!decision || typeof decision !== "object" || hasForbiddenKey(decision)) return reject("invalid_user_decision");
  const selectedItemId = cleanText(decision.selectedItemId, 40);
  const selectedCorrectionType = cleanText(decision.selectedCorrectionType || "", 80);
  const action = cleanText(decision.action, 24);
  if (!selectedItemId || !["recorded", "held"].includes(action) || decision.userConfirmed !== true) return reject("invalid_user_decision");
  const hold = body.hold === null || body.hold === undefined ? null : body.hold;
  const normalizedHold = hold && typeof hold === "object" && !hasForbiddenKey(hold) ? {
    recommended: hold.recommended === true,
    reasons: Array.isArray(hold.reasons) ? hold.reasons.map((item) => cleanText(item)).filter(Boolean).slice(0, 5) : []
  } : null;
  if (body.status === "completed" && (action !== "recorded" || !checklist.every((item) => item.checked) || normalizedHold?.recommended)) return reject("invalid_completed_state");
  if (body.status === "held" && (action !== "held" || !normalizedHold?.recommended)) return reject("invalid_held_state");
  const classContext = normalizeClassContext(body.classContext);
  if (classContext === undefined) return reject("invalid_class_context");
  return { valid: true, value: {
    schemaVersion: SCHEMA_VERSION, status: body.status, provider,
    ...(cleanText(body.model, 80) ? { model: cleanText(body.model, 80) } : {}),
    ...(cleanText(body.appVersion, 80) ? { appVersion: cleanText(body.appVersion, 80) } : {}),
    ...(cleanText(body.sourceSchemaVersion, 80) ? { sourceSchemaVersion: cleanText(body.sourceSchemaVersion, 80) } : {}),
    analysis: { objectCandidates, materialCandidates, visibleCautions }, checklist,
    userDecision: { selectedItemId, ...(selectedCorrectionType ? { selectedCorrectionType } : {}), action, userConfirmed: true },
    hold: normalizedHold, ...(classContext ? { classContext } : {}), idempotencyKey
  } };
}
function createSaveSortingRecordHandler(dependencies = {}) {
  const now = dependencies.now || (() => new Date());
  const logger = dependencies.logger || (() => {});
  const serverTimestamp = dependencies.serverTimestamp || (() => now());
  const store = dependencies.store;
  const db = dependencies.db;
  return async (req, res) => {
    if (!applyCors(req, res)) return res.status(403).json({ ok: false, code: "invalid_origin" });
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ ok: false, code: "method_not_allowed" });
    const protectedActor = await protectActorRequest({ req, functionName: "saveSortingRecord", access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck });
    if (!protectedActor.ok) { if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds)); return res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) }); }
    const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
    if (bodyBytes > MAX_BODY_BYTES) return res.status(413).json({ ok: false, code: "request_too_large" });
    const checked = validateRecordRequest(req.body);
    if (!checked.valid) { logger({ validationCode: checked.code }); return res.status(400).json({ ok: false, code: checked.code }); }
    const actorId = protectedActor.actorId;
    const createdAt = now();
    const expireAt = new Date(createdAt.getTime() + 90 * DAY_MS);
    const record = { ...checked.value, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), expireAt };
    // 실명가입(4단계)으로 이 actor에 검증된 studentProfile이 있으면, 클라이언트가
    // 뭐라고 보냈든 그 값을 무시하고 서버가 기억하는 값으로 덮어쓴다 - 그래야
    // 학생이 임시 입력폼을 조작해서 다른 반으로 기록되는 걸 막을 수 있다.
    // 아직 가입 전이면(=studentProfile 없으면) 기존처럼 클라이언트 값을 그대로 쓴다.
    if (db) {
      const actorSnap = await db.collection("actors").doc(actorId).get();
      const profile = actorSnap.exists ? actorSnap.data()?.studentProfile : null;
      if (profile) record.classContext = { schoolId: profile.schoolId, grade: profile.grade, classNum: profile.classNum };
    }
    delete record.idempotencyKey;
    const result = await store.createOrGet(actorId, checked.value.idempotencyKey, record, { createdAt: createdAt.toISOString(), expireAt: expireAt.toISOString() });
    logger({ recordId: result.recordId, status: result.status, provider: record.provider, schemaVersion: SCHEMA_VERSION, duplicate: result.duplicate === true });
    return res.status(result.duplicate ? 200 : 201).json({ recordId: result.recordId, status: result.status, createdAt: result.createdAt, expireAt: result.expireAt, schemaVersion: SCHEMA_VERSION, duplicate: result.duplicate === true });
  };
}
module.exports = { DAY_MS, SCHEMA_VERSION, validateRecordRequest, createSaveSortingRecordHandler };
