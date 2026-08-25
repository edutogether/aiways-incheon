"use strict";

// One-time real-name signup that permanently locks a device (actor) to a
// school/grade/class/name. Mirrors edu2gPassHandlers.js's confirm:false/true
// two-step pattern: the first call previews what will be written, the second
// (confirm:true) actually commits it. Once studentProfile exists on the
// actor document, registerStudentProfile refuses to overwrite it --
// changeStudentClass (step 6) is the only sanctioned way to move grade/class
// afterward, and it's cooldown-limited so a device can't hop classes freely.
const { protectActorRequest } = require("./protectedActor");

const MAX_BODY_BYTES = 2 * 1024;
const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const DIGITS = /^\d{1,2}$/;
const CLASS_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_CHANGE_HISTORY = 10;

function cleanText(value, max = 80) {
  return typeof value === "string" && value.length <= max && value.trim() && !/[<>\x00-\x1f]/.test(value) ? value.trim() : "";
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

function publicProfile(profile) {
  if (!profile) return null;
  const { schoolId, schoolName, grade, classNum, studentNumber, name } = profile;
  return { schoolId, schoolName, grade, classNum, studentNumber, name };
}

async function guardedActor(req, res, functionName, dependencies) {
  if (!applyCors(req, res)) { res.status(403).json({ ok: false, code: "invalid_origin" }); return null; }
  if (req.method === "OPTIONS") { res.status(204).send(""); return null; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, code: "method_not_allowed" }); return null; }
  const protectedActor = await protectActorRequest({ req, functionName, access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck, blockedActors: dependencies.blockedActors });
  if (!protectedActor.ok) {
    if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds));
    res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) });
    return null;
  }
  const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
  if (bodyBytes > MAX_BODY_BYTES) { res.status(413).json({ ok: false, code: "request_too_large" }); return null; }
  return protectedActor;
}

function createCheckStudentProfileHandler(dependencies = {}) {
  const db = dependencies.db;
  return async (req, res) => {
    const protectedActor = await guardedActor(req, res, "checkStudentProfile", dependencies);
    if (!protectedActor) return;
    const body = req.body || {};
    if (Object.keys(body).length) return res.status(400).json({ ok: false, code: "unknown_field" });
    const snap = await db.collection("actors").doc(protectedActor.actorId).get();
    const profile = snap.exists ? snap.data()?.studentProfile : null;
    return res.status(200).json({ ok: true, hasProfile: !!profile, profile: publicProfile(profile) });
  };
}

function createRegisterStudentProfileHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  return async (req, res) => {
    const protectedActor = await guardedActor(req, res, "registerStudentProfile", dependencies);
    if (!protectedActor) return;
    const body = req.body || {};
    const allowed = new Set(["schoolId", "schoolName", "grade", "classNum", "studentNumber", "name", "confirm"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    // schoolId는 이제 사람이 친 학교 이름이 아니라 나이스(NEIS) 학교기본정보
    // API의 표준학교코드(SD_SCHUL_CODE, 숫자 문자열)다 - searchSchool로 검색해
    // 목록에서 고른 값만 여기로 들어오므로 오타로 다른 학교가 되는 일이 없다.
    // schoolName은 그 코드에 딸린 표시용 이름(대시보드/랭킹 화면에만 씀).
    const schoolId = typeof body.schoolId === "string" && /^\d{1,12}$/.test(body.schoolId) ? body.schoolId : "";
    const schoolName = cleanText(body.schoolName, 80);
    const grade = typeof body.grade === "string" && DIGITS.test(body.grade) ? body.grade : "";
    const classNum = typeof body.classNum === "string" && DIGITS.test(body.classNum) ? body.classNum : "";
    const studentNumber = typeof body.studentNumber === "string" && DIGITS.test(body.studentNumber) ? body.studentNumber : "";
    const name = cleanText(body.name, 20);
    if (!schoolId || !schoolName || !grade || !classNum || !studentNumber || !name) return res.status(400).json({ ok: false, code: "invalid_request" });
    if (typeof body.confirm !== "boolean") return res.status(400).json({ ok: false, code: "invalid_request" });

    const actorRef = db.collection("actors").doc(protectedActor.actorId);
    const existingSnap = await actorRef.get();
    const existingProfile = existingSnap.exists ? existingSnap.data()?.studentProfile : null;
    if (existingProfile) return res.status(409).json({ ok: false, code: "already_registered", profile: publicProfile(existingProfile) });

    if (!body.confirm) {
      // Preview only -- nothing written yet. The client shows this back to
      // the student ("정말 OO초 5학년 1반 홍길동 맞나요?") before calling again
      // with confirm:true.
      return res.status(200).json({ ok: true, confirmed: false, preview: { schoolId, schoolName, grade, classNum, studentNumber, name } });
    }

    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(actorRef);
      const already = snap.exists ? snap.data()?.studentProfile : null;
      if (already) return { code: "already_registered", profile: already };
      transaction.set(actorRef, { studentProfile: { schoolId, schoolName, grade, classNum, studentNumber, name, registeredAt: serverTimestamp() } }, { merge: true });
      return { ok: true };
    });
    if (result.code === "already_registered") return res.status(409).json({ ok: false, code: "already_registered", profile: publicProfile(result.profile) });
    return res.status(201).json({ ok: true, confirmed: true, profile: { schoolId, schoolName, grade, classNum, studentNumber, name } });
  };
}

function timestampToDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// 반 변경: 학교/번호/이름은 그대로, 학년·반만 바꾼다. 가입(registerStudentProfile)과
// 같은 confirm:false(미리보기)/true(확정) 2단계 구조지만, 그 위에 서버 쿨다운을
// 더한다 - 마지막으로 바뀐 시점(최초 가입 포함)으로부터 24시간 안에는 재변경을
// 거절한다("하루 1회" 결정 사항). 확인창만으로는 악의적 반복 변경을 못 막는다는
// 이유로 서버가 강제하기로 한 규칙이라, 클라이언트가 보내는 시간이 아니라 항상
// 서버가 기록해 둔 lastChangedAt/registeredAt으로만 판단한다.
function createChangeStudentClassHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  const now = dependencies.now || (() => new Date());
  return async (req, res) => {
    const protectedActor = await guardedActor(req, res, "changeStudentClass", dependencies);
    if (!protectedActor) return;
    const body = req.body || {};
    const allowed = new Set(["grade", "classNum", "confirm"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const grade = typeof body.grade === "string" && DIGITS.test(body.grade) ? body.grade : "";
    const classNum = typeof body.classNum === "string" && DIGITS.test(body.classNum) ? body.classNum : "";
    if (!grade || !classNum) return res.status(400).json({ ok: false, code: "invalid_request" });
    if (typeof body.confirm !== "boolean") return res.status(400).json({ ok: false, code: "invalid_request" });

    const actorRef = db.collection("actors").doc(protectedActor.actorId);
    const existingSnap = await actorRef.get();
    const existingProfile = existingSnap.exists ? existingSnap.data()?.studentProfile : null;
    if (!existingProfile) return res.status(409).json({ ok: false, code: "not_registered" });

    const lastChanged = timestampToDate(existingProfile.lastChangedAt) || timestampToDate(existingProfile.registeredAt) || now();
    const elapsedMs = now().getTime() - lastChanged.getTime();
    if (elapsedMs < CLASS_CHANGE_COOLDOWN_MS) {
      return res.status(429).json({ ok: false, code: "cooldown_active", retryAfterSeconds: Math.ceil((CLASS_CHANGE_COOLDOWN_MS - elapsedMs) / 1000) });
    }
    if (existingProfile.grade === grade && existingProfile.classNum === classNum) {
      return res.status(400).json({ ok: false, code: "no_change" });
    }

    if (!body.confirm) {
      return res.status(200).json({ ok: true, confirmed: false, preview: { schoolId: existingProfile.schoolId, schoolName: existingProfile.schoolName, grade, classNum, studentNumber: existingProfile.studentNumber, name: existingProfile.name } });
    }

    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(actorRef);
      const current = snap.exists ? snap.data()?.studentProfile : null;
      if (!current) return { code: "not_registered" };
      const currentLastChanged = timestampToDate(current.lastChangedAt) || timestampToDate(current.registeredAt) || now();
      if (now().getTime() - currentLastChanged.getTime() < CLASS_CHANGE_COOLDOWN_MS) return { code: "cooldown_active" };
      // FieldValue.serverTimestamp() can't be used inside an array element,
      // so this one entry uses a plain client Date instead of the usual
      // server sentinel -- fine here since it's only an audit trail, not
      // anything the cooldown math itself relies on (that reads lastChangedAt).
      const historyEntry = { fromGrade: current.grade, fromClassNum: current.classNum, toGrade: grade, toClassNum: classNum, changedAt: now() };
      const history = [...(Array.isArray(current.changeHistory) ? current.changeHistory : []), historyEntry].slice(-MAX_CHANGE_HISTORY);
      transaction.set(actorRef, { studentProfile: { ...current, grade, classNum, lastChangedAt: serverTimestamp(), changeHistory: history } }, { merge: true });
      return { ok: true };
    });
    if (result.code === "not_registered") return res.status(409).json({ ok: false, code: "not_registered" });
    if (result.code === "cooldown_active") return res.status(429).json({ ok: false, code: "cooldown_active" });
    return res.status(200).json({ ok: true, confirmed: true, profile: { schoolId: existingProfile.schoolId, schoolName: existingProfile.schoolName, grade, classNum, studentNumber: existingProfile.studentNumber, name: existingProfile.name } });
  };
}

module.exports = { createCheckStudentProfileHandler, createRegisterStudentProfileHandler, createChangeStudentClassHandler };
