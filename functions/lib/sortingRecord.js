"use strict";

const SCHEMA_VERSION = "sorting-record-v1";
const MAX_BODY_BYTES = 24 * 1024;
// \bname\b (word-boundary), not a bare "name" substring match -- otherwise
// legitimate keys like classContext.schoolName would false-positive as PII
// (schoolName isn't a student's real name, just a school's display label).
const FORBIDDEN_KEY = /(?:image|base64|data:image|url|authorization|api[_-]?key|secret|prompt|raw.*response|email|\bname\b|access.*code)/i;
const { observeAppCheck } = require("./appCheckProtection");
const { protectActorRequest } = require("./protectedActor");
const { cleanSchoolId, cleanPathSegment } = require("./firestorePathSafety");
const { cleanText, applyCors } = require("./httpGuard");

function reject(code) { return { valid: false, code }; }
function hasForbiddenKey(value) {
  return !!value && typeof value === "object" && Object.keys(value).some((key) => FORBIDDEN_KEY.test(key));
}
function normalizeCandidate(value, material) {
  if (!value || typeof value !== "object" || hasForbiddenKey(value)) return null;
  const label = cleanText(value.label, 200);
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
  const label = cleanText(value.label, 200);
  return id && label && typeof value.checked === "boolean" ? { id, label, checked: value.checked } : null;
}
// Interim, student-typed school/grade/class (step 4 will replace this with a
// real one-time signup + permanent device lock). Kept optional so records
// saved before this field existed, and any caller that never sets it, still
// validate exactly as before.
function normalizeClassContext(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value) || hasForbiddenKey(value)) return undefined;
  const schoolId = cleanSchoolId(value.schoolId);
  const schoolName = cleanText(value.schoolName, 80);
  const grade = cleanPathSegment(String(value.grade ?? ""));
  const classNum = cleanPathSegment(String(value.classNum ?? ""));
  return schoolId && grade && classNum ? { schoolId, ...(schoolName ? { schoolName } : {}), grade, classNum } : undefined;
}
function validateRecordRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || hasForbiddenKey(body)) return reject("invalid_request");
  const allowed = new Set(["schemaVersion", "status", "provider", "model", "appVersion", "sourceSchemaVersion", "analysis", "checklist", "userDecision", "hold", "idempotencyKey", "classContext", "campusCheckId"]);
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
  const visibleCautions = cautions.map((item) => cleanText(item, 200));
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
    reasons: Array.isArray(hold.reasons) ? hold.reasons.map((item) => cleanText(item, 200)).filter(Boolean).slice(0, 5) : []
  } : null;
  if (body.status === "completed" && (action !== "recorded" || !checklist.every((item) => item.checked) || normalizedHold?.recommended)) return reject("invalid_completed_state");
  if (body.status === "held" && (action !== "held" || !normalizedHold?.recommended)) return reject("invalid_held_state");
  const classContext = normalizeClassContext(body.classContext);
  if (classContext === undefined) return reject("invalid_class_context");
  const campusCheckId = body.campusCheckId === undefined ? "" : cleanText(body.campusCheckId, 80);
  if (body.campusCheckId !== undefined && !campusCheckId) return reject("invalid_campus_check");
  return { valid: true, value: {
    schemaVersion: SCHEMA_VERSION, status: body.status, provider,
    ...(cleanText(body.model, 80) ? { model: cleanText(body.model, 80) } : {}),
    ...(cleanText(body.appVersion, 80) ? { appVersion: cleanText(body.appVersion, 80) } : {}),
    ...(cleanText(body.sourceSchemaVersion, 80) ? { sourceSchemaVersion: cleanText(body.sourceSchemaVersion, 80) } : {}),
    analysis: { objectCandidates, materialCandidates, visibleCautions }, checklist,
    userDecision: { selectedItemId, ...(selectedCorrectionType ? { selectedCorrectionType } : {}), action, userConfirmed: true },
    hold: normalizedHold, ...(classContext ? { classContext } : {}), idempotencyKey, campusCheckId
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
    const protectedActor = await protectActorRequest({ req, functionName: "saveSortingRecord", access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck, blockedActors: dependencies.blockedActors });
    if (!protectedActor.ok) { if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds)); return res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) }); }
    const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
    if (bodyBytes > MAX_BODY_BYTES) return res.status(413).json({ ok: false, code: "request_too_large" });
    const checked = validateRecordRequest(req.body);
    if (!checked.valid) { logger({ validationCode: checked.code }); return res.status(400).json({ ok: false, code: checked.code }); }
    const actorId = protectedActor.actorId;
    const createdAt = now();
    // 2026-08-26: 90일 후 자동삭제 정책 폐지 - 이 앱은 누적 실적/반별
    // 랭킹이 핵심 기능이라 기록을 계속 쌓아야 한다(대표 결정). expireAt을
    // 아예 더 이상 만들지 않는다.
    const record = { ...checked.value, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    // 실명가입(4단계)으로 이 actor에 검증된 studentProfile이 있으면, 클라이언트가
    // 뭐라고 보냈든 그 값을 무시하고 서버가 기억하는 값으로 덮어쓴다 - 그래야
    // 학생이 임시 입력폼을 조작해서 다른 반으로 기록되는 걸 막을 수 있다.
    // 재감사 지적사항(2026-09-01, classContext 신뢰 문제) - 예전엔 가입 전
    // (studentProfile 없음)이면 클라이언트가 보낸 값을 그대로 썼는데, 이게
    // 가입/승인 절차를 아예 거치지 않은 기기가 임의 학교/학년/반을 자기신고해
    // 랭킹·대시보드·CSV 반전체 내보내기를 오염시킬 수 있는 구멍이었다(교사
    // 승인 게이트가 saveSortingRecord까지는 전파가 안 됐던 문제). 이제
    // 승인된 studentProfile이 없으면 classContext를 아예 저장하지 않는다 -
    // 승인 전에도 기록 자체는 저장돼 개인 연습에는 지장 없지만, 반/학교
    // 집계·랭킹·CSV에는 전혀 반영되지 않는다(schoolDashboardAggregate.js가
    // classContext 없는 기록은 이미 조용히 건너뛰도록 돼 있었음).
    if (db) {
      const actorSnap = await db.collection("actors").doc(actorId).get();
      const profile = actorSnap.exists ? actorSnap.data()?.studentProfile : null;
      // studentNumber/studentName도 같이 넘겨야 반별 개인 랭킹(6단계)을
      // 집계할 수 있다 - 필드명은 "studentName"으로, 그냥 "name"을 쓰면
      // FORBIDDEN_KEY(\bname\b)에 걸려 기록 자체가 거부된다(이 세션에
      // schoolName에서 이미 한 번 겪은 문제와 동일한 이유). 실명 검증
      // 없이 학생이 스스로 적은 값 그대로다(교사가 부모 동의 하에 자율
      // 입력을 허용하기로 결정 - 실명이 아니어도 됨).
      record.classContext = profile
        ? { schoolId: profile.schoolId, ...(profile.schoolName ? { schoolName: profile.schoolName } : {}), grade: profile.grade, classNum: profile.classNum, ...(profile.studentNumber ? { studentNumber: profile.studentNumber } : {}), ...(profile.name ? { studentName: profile.name } : {}) }
        : null;
    }
    // GPS 교내판정(5단계): campusCheckId가 있으면 그 일회용 판정 결과를 소비해서
    // record.onCampus에 반영한다 - 좌표 자체는 이 함수도, 그 이전 어떤 단계도
    // 저장/기록하지 않는다(checkCampusLocation에서 이미 boolean만 남기고 버림).
    // 아이디가 없거나, 없거나, 만료/중복사용이면 안전하게 교외(false)로 취급한다.
    if (db && record.campusCheckId) {
      const recordSchoolId = record.classContext?.schoolId || "";
      const checkRef = db.collection("actors").doc(actorId).collection("campusChecks").doc(record.campusCheckId);
      record.onCampus = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(checkRef);
        if (!snap.exists) return false;
        const data = snap.data() || {};
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        if (data.consumed === true || !(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < now().getTime()) return false;
        transaction.update(checkRef, { consumed: true });
        // The check was performed for a specific school (campusLocation.js
        // stores it at creation time); a record whose classContext claims a
        // different school cannot borrow that school's on-campus result --
        // otherwise an actor could stand on their own campus, mint a passing
        // check, then submit a record tagged with someone else's schoolId.
        if (!recordSchoolId || data.schoolId !== recordSchoolId) return false;
        return data.onCampus === true;
      });
    }
    delete record.idempotencyKey;
    delete record.campusCheckId;
    const result = await store.createOrGet(actorId, checked.value.idempotencyKey, record, { createdAt: createdAt.toISOString() });
    logger({ recordId: result.recordId, status: result.status, provider: record.provider, schemaVersion: SCHEMA_VERSION, duplicate: result.duplicate === true });
    return res.status(result.duplicate ? 200 : 201).json({ recordId: result.recordId, status: result.status, createdAt: result.createdAt, schemaVersion: SCHEMA_VERSION, duplicate: result.duplicate === true });
  };
}
module.exports = { SCHEMA_VERSION, validateRecordRequest, createSaveSortingRecordHandler };
