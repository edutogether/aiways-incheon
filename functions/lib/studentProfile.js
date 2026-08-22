"use strict";

// One-time real-name signup that permanently locks a device (actor) to a
// school/grade/class/name. Mirrors edu2gPassHandlers.js's confirm:false/true
// two-step pattern: the first call previews what will be written, the second
// (confirm:true) actually commits it. Once studentProfile exists on the
// actor document, this handler refuses to overwrite it -- step 6 (반 변경
// 서버 쿨다운) is what will later add a controlled, rate-limited way to
// change it, not this endpoint.
const { protectActorRequest } = require("./protectedActor");

const MAX_BODY_BYTES = 2 * 1024;
const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const DIGITS = /^\d{1,2}$/;

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
  const { schoolId, grade, classNum, studentNumber, name } = profile;
  return { schoolId, grade, classNum, studentNumber, name };
}

async function guardedActor(req, res, functionName, dependencies) {
  if (!applyCors(req, res)) { res.status(403).json({ ok: false, code: "invalid_origin" }); return null; }
  if (req.method === "OPTIONS") { res.status(204).send(""); return null; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, code: "method_not_allowed" }); return null; }
  const protectedActor = await protectActorRequest({ req, functionName, access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck });
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
    const allowed = new Set(["schoolId", "grade", "classNum", "studentNumber", "name", "confirm"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const schoolId = cleanText(body.schoolId, 80);
    const grade = typeof body.grade === "string" && DIGITS.test(body.grade) ? body.grade : "";
    const classNum = typeof body.classNum === "string" && DIGITS.test(body.classNum) ? body.classNum : "";
    const studentNumber = typeof body.studentNumber === "string" && DIGITS.test(body.studentNumber) ? body.studentNumber : "";
    const name = cleanText(body.name, 20);
    if (!schoolId || !grade || !classNum || !studentNumber || !name) return res.status(400).json({ ok: false, code: "invalid_request" });
    if (typeof body.confirm !== "boolean") return res.status(400).json({ ok: false, code: "invalid_request" });

    const actorRef = db.collection("actors").doc(protectedActor.actorId);
    const existingSnap = await actorRef.get();
    const existingProfile = existingSnap.exists ? existingSnap.data()?.studentProfile : null;
    if (existingProfile) return res.status(409).json({ ok: false, code: "already_registered", profile: publicProfile(existingProfile) });

    if (!body.confirm) {
      // Preview only -- nothing written yet. The client shows this back to
      // the student ("정말 OO초 5학년 1반 홍길동 맞나요?") before calling again
      // with confirm:true.
      return res.status(200).json({ ok: true, confirmed: false, preview: { schoolId, grade, classNum, studentNumber, name } });
    }

    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(actorRef);
      const already = snap.exists ? snap.data()?.studentProfile : null;
      if (already) return { code: "already_registered", profile: already };
      transaction.set(actorRef, { studentProfile: { schoolId, grade, classNum, studentNumber, name, registeredAt: serverTimestamp() } }, { merge: true });
      return { ok: true };
    });
    if (result.code === "already_registered") return res.status(409).json({ ok: false, code: "already_registered", profile: publicProfile(result.profile) });
    return res.status(201).json({ ok: true, confirmed: true, profile: { schoolId, grade, classNum, studentNumber, name } });
  };
}

module.exports = { createCheckStudentProfileHandler, createRegisterStudentProfileHandler };
