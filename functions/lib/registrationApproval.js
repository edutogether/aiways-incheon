"use strict";

// 3단 권한체계 2단계(2026-08-31 대표님 지시): "코드만 알면 자동가입"이 아니라
// "교사가 한 명씩 승인"하는 구조로 registerStudentProfile의 신원증명 문제를
// 실제로 닫는다. registerStudentProfile(studentProfile.js)은 이제 즉시
// studentProfile을 쓰지 않고 registrationRequests/{actorId}에 대기 상태로만
// 남긴다 - 여기 두 함수가 그 대기열을 teacherVerified된 actor에게만 열어준다.
const { protectActorRequest } = require("./protectedActor");
const { cleanText, applyCors } = require("./httpGuard");

const MAX_BODY_BYTES = 2 * 1024;
const MAX_LIST_SIZE = 100;

function publicProfile(profile) {
  if (!profile) return null;
  const { schoolId, schoolName, grade, classNum, studentNumber, name } = profile;
  return { schoolId, schoolName, grade, classNum, studentNumber, name };
}

async function guardedTeacher(req, res, functionName, dependencies) {
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
  const teacherSnap = await dependencies.db.collection("actors").doc(protectedActor.actorId).get();
  const teacherVerified = teacherSnap.exists ? teacherSnap.data()?.teacherVerified : null;
  if (!teacherVerified?.schoolId) { res.status(403).json({ ok: false, code: "teacher_verification_required" }); return null; }
  return { actorId: protectedActor.actorId, schoolId: teacherVerified.schoolId };
}

function createListPendingRegistrationsHandler(dependencies = {}) {
  const db = dependencies.db;
  return async (req, res) => {
    const teacher = await guardedTeacher(req, res, "listPendingRegistrations", dependencies);
    if (!teacher) return;
    const body = req.body || {};
    if (Object.keys(body).length) return res.status(400).json({ ok: false, code: "unknown_field" });
    const snap = await db.collection("registrationRequests").where("schoolId", "==", teacher.schoolId).where("status", "==", "pending").limit(MAX_LIST_SIZE).get();
    const requests = snap.docs.map((doc) => ({ actorId: doc.id, ...publicProfile(doc.data()) }));
    return res.status(200).json({ ok: true, requests });
  };
}

function createDecideRegistrationHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  return async (req, res) => {
    const teacher = await guardedTeacher(req, res, "decideRegistration", dependencies);
    if (!teacher) return;
    const body = req.body || {};
    const allowed = new Set(["targetActorId", "decision"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const targetActorId = cleanText(body.targetActorId, 200);
    const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : "";
    if (!targetActorId || !decision) return res.status(400).json({ ok: false, code: "invalid_request" });

    const requestRef = db.collection("registrationRequests").doc(targetActorId);
    const actorRef = db.collection("actors").doc(targetActorId);
    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(requestRef);
      if (!snap.exists) return { code: "not_found" };
      const data = snap.data();
      // 다른 학교 요청이면 "없는 것"처럼 404로 응답한다 - 학교 소속을
      // 넘어선 actorId 추측 시도로도 다른 학교 학생 정보가 새어나가지 않게.
      if (data.schoolId !== teacher.schoolId) return { code: "not_found" };
      if (data.status !== "pending") return { code: "not_pending" };
      if (decision === "reject") {
        transaction.set(requestRef, { ...data, status: "rejected", decidedAt: serverTimestamp() }, { merge: true });
        return { ok: true, decision: "rejected" };
      }
      const actorSnap = await transaction.get(actorRef);
      if (actorSnap.exists && actorSnap.data()?.studentProfile) return { code: "already_registered" };
      // 3단계(2026-08-31) - 승인은 교사가 사람이 눈으로 확인한 신원증명이므로,
      // 이 기기의 school-lock(dashboardSchoolId)도 승인된 학교로 같이
      // 바로잡는다(teacherAuth.js의 verifyTeacherCode와 같은 근거).
      transaction.set(actorRef, { studentProfile: { schoolId: data.schoolId, schoolName: data.schoolName, grade: data.grade, classNum: data.classNum, studentNumber: data.studentNumber, name: data.name, registeredAt: serverTimestamp() }, dashboardSchoolId: data.schoolId }, { merge: true });
      transaction.delete(requestRef);
      return { ok: true, decision: "approved" };
    });
    if (result.code === "not_found") return res.status(404).json({ ok: false, code: "request_not_found" });
    if (result.code === "not_pending") return res.status(409).json({ ok: false, code: "already_decided" });
    if (result.code === "already_registered") return res.status(409).json({ ok: false, code: "already_registered" });
    return res.status(200).json({ ok: true, decision: result.decision, targetActorId });
  };
}

module.exports = { createListPendingRegistrationsHandler, createDecideRegistrationHandler };
