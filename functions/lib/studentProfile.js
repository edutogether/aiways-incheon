"use strict";

// One-time real-name signup that permanently locks a device (actor) to a
// school/grade/class/name. Mirrors edu2gPassHandlers.js's confirm:false/true
// two-step pattern: the first call previews what will be written, the second
// (confirm:true) actually commits it. Once studentProfile exists on the
// actor document, registerStudentProfile refuses to overwrite it --
// changeStudentClass (step 6) is the only sanctioned way to move grade/class
// afterward, and it's cooldown-limited so a device can't hop classes freely.
const { protectActorRequest } = require("./protectedActor");
const { cleanText, applyCors } = require("./httpGuard");
const { verifyTeacherCodeCore } = require("./teacherAuth");

const MAX_BODY_BYTES = 2 * 1024;
const DIGITS = /^\d{1,2}$/;
const CLASS_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_CHANGE_HISTORY = 10;
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
    try {
      const snap = await db.collection("actors").doc(protectedActor.actorId).get();
      const profile = snap.exists ? snap.data()?.studentProfile : null;
      if (profile) return res.status(200).json({ ok: true, hasProfile: true, pending: false, rejected: false, profile: publicProfile(profile) });
      const requestSnap = await db.collection("registrationRequests").doc(protectedActor.actorId).get();
      const request = requestSnap.exists ? requestSnap.data() : null;
      const isPending = request?.status === "pending";
      return res.status(200).json({ ok: true, hasProfile: false, pending: isPending, rejected: request?.status === "rejected", profile: null, pendingProfile: isPending ? publicProfile(request) : null });
    } catch {
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

// 2026-09-02 재설계(대표님 지시): "가입 경로를 두 개나 만들지 말라 - 학생과
// 교사 전부 하나의 가입 화면에서 학교/학년/반 + 역할을 선택"하는 단일
// 플로우 요구사항에 맞춰, 이 핸들러 하나가 학생/담임 가입을 전부 처리한다.
// role:"student"(기본값)는 기존과 동일하게 승인대기열로 간다. role:"homeroom"은
// teacherCode를 같이 받아 그 자리에서 바로 교사 인증까지 끝낸다(별도 화면/
// 별도 코드입력 다이얼로그 없음) - 승인이 필요 없는 이유는 코드 자체가
// 이미 "교사만 아는 값"이라는 신원증명이기 때문(teacherAuth.js와 동일한 근거).
function createRegisterStudentProfileHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    const protectedActor = await guardedActor(req, res, "registerStudentProfile", dependencies);
    if (!protectedActor) return;
    const body = req.body || {};
    const allowed = new Set(["schoolId", "schoolName", "grade", "classNum", "studentNumber", "name", "role", "teacherCode", "confirm"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const role = body.role === "homeroom" ? "homeroom" : "student";
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
    if (!schoolId || !schoolName || !grade || !classNum || !name) return res.status(400).json({ ok: false, code: "invalid_request" });
    if (role === "student" && !studentNumber) return res.status(400).json({ ok: false, code: "invalid_request" });
    if (typeof body.confirm !== "boolean") return res.status(400).json({ ok: false, code: "invalid_request" });

    if (role === "homeroom") {
      const teacherCode = cleanText(body.teacherCode, 40);
      if (!teacherCode) return res.status(400).json({ ok: false, code: "invalid_request" });
      if (!body.confirm) return res.status(200).json({ ok: true, confirmed: false, role, preview: { schoolId, schoolName, grade, classNum, name } });
      try {
        const result = await verifyTeacherCodeCore({ db, serverTimestamp, actorId: protectedActor.actorId, uid: protectedActor.uid, auth: dependencies.auth, schoolId, grade, classNum, code: teacherCode, logger });
        if (!result.ok) return res.status(result.httpStatus).json({ ok: false, code: result.code });
        return res.status(200).json({ ok: true, confirmed: true, role, verified: true, schoolId, grade, classNum });
      } catch {
        return res.status(503).json({ ok: false, code: "protection_unavailable" });
      }
    }

    try {
      const actorRef = db.collection("actors").doc(protectedActor.actorId);
      const existingSnap = await actorRef.get();
      const existingProfile = existingSnap.exists ? existingSnap.data()?.studentProfile : null;
      if (existingProfile) return res.status(409).json({ ok: false, code: "already_registered", profile: publicProfile(existingProfile) });

      if (!body.confirm) {
        // Preview only -- nothing written yet. The client shows this back to
        // the student ("정말 OO초 5학년 1반 홍길동 맞나요?") before calling again
        // with confirm:true.
        return res.status(200).json({ ok: true, confirmed: false, role, preview: { schoolId, schoolName, grade, classNum, studentNumber, name } });
      }

      // 3단 권한체계 2단계(2026-08-31) - 여기서 바로 studentProfile을 쓰지 않고
      // registrationRequests/{actorId}에 대기 상태로만 남긴다. teacherVerified된
      // actor(registrationApproval.js)가 승인해야 실제로 studentProfile이
      // 생긴다 - 코드만 알면 자기신고로 실명+번호를 무제한 조회할 수 있던
      // LOCKED 문제를 여기서 닫는다.
      const requestRef = db.collection("registrationRequests").doc(protectedActor.actorId);
      const result = await db.runTransaction(async (transaction) => {
        const actorSnap = await transaction.get(actorRef);
        const already = actorSnap.exists ? actorSnap.data()?.studentProfile : null;
        if (already) return { code: "already_registered", profile: already };
        const requestSnap = await transaction.get(requestRef);
        const existingRequest = requestSnap.exists ? requestSnap.data() : null;
        if (existingRequest?.status === "pending") return { code: "request_pending" };
        transaction.set(requestRef, { schoolId, schoolName, grade, classNum, studentNumber, name, status: "pending", submittedAt: serverTimestamp() });
        return { ok: true };
      });
      if (result.code === "already_registered") return res.status(409).json({ ok: false, code: "already_registered", profile: publicProfile(result.profile) });
      if (result.code === "request_pending") return res.status(409).json({ ok: false, code: "request_pending" });
      return res.status(202).json({ ok: true, confirmed: true, role, pending: true, preview: { schoolId, schoolName, grade, classNum, studentNumber, name } });
    } catch {
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
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
    try {
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
    } catch {
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

module.exports = { createCheckStudentProfileHandler, createRegisterStudentProfileHandler, createChangeStudentClassHandler };
