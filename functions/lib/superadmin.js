"use strict";

// 3단 권한체계 4단계(2026-08-31 대표님 지시) - 이 앱 최초의 진짜 로그인
// 시스템. 학생/교사는 전부 anonymous auth(actorId)로 처리되지만, 여기만은
// 대표님 본인의 실제 Firebase Auth 이메일/비밀번호 계정 + 커스텀 클레임
// (role:"superadmin")으로 인증한다. 계정 자체는 대표님이 Firebase 콘솔에서
// 직접 만들고(비밀번호를 대신 만들어주지 않음), scripts/grantSuperadmin.js로
// 그 uid에 클레임을 부여해야 이 함수들을 실제로 쓸 수 있다.
//
// 지금 유일한 기능은 교사 인증코드 발급/회전(manageTeacherCode) - 지금까지
// scripts/setTeacherCode.js를 개발자가 로컬에서 수동 실행해야만 했던 걸
// 대표님이 admin.html에서 직접 할 수 있게 대체한다.
const { createHash } = require("node:crypto");
const { cleanText, applyCors } = require("./httpGuard");
const { observeAppCheck } = require("./appCheckProtection");

const MAX_BODY_BYTES = 2 * 1024;
const SCHOOL_ID_PATTERN = /^\d{1,12}$/;

function extractBearer(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/.exec(String(header));
  return match ? match[1] : "";
}

async function guardedSuperadmin(req, res, functionName, dependencies) {
  if (!applyCors(req, res)) { res.status(403).json({ ok: false, code: "invalid_origin" }); return null; }
  if (req.method === "OPTIONS") { res.status(204).send(""); return null; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, code: "method_not_allowed" }); return null; }
  const observed = await (dependencies.appCheck || (options => observeAppCheck(options.req, options)))({ req, functionName, logger: dependencies.logAppCheck });
  if (observed.httpStatus) { res.status(observed.httpStatus).json({ ok: false, code: observed.code }); return null; }
  const globalLimit = await dependencies.rateLimiter?.check?.(functionName);
  if (globalLimit && !globalLimit.allowed) {
    res.status(globalLimit.outcome === "unavailable" ? 503 : 429).json({ ok: false, code: globalLimit.outcome === "unavailable" ? "protection_unavailable" : "rate_limit_exceeded" });
    return null;
  }
  const token = extractBearer(req);
  if (!token) { res.status(401).json({ ok: false, code: "auth_missing" }); return null; }
  let decoded;
  try { decoded = await dependencies.verifyIdToken(token); } catch { res.status(401).json({ ok: false, code: "auth_invalid" }); return null; }
  if (decoded?.role !== "superadmin") { res.status(403).json({ ok: false, code: "superadmin_required" }); return null; }
  const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
  if (bodyBytes > MAX_BODY_BYTES) { res.status(413).json({ ok: false, code: "request_too_large" }); return null; }
  return { uid: decoded.uid };
}

function createManageTeacherCodeHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  return async (req, res) => {
    const admin = await guardedSuperadmin(req, res, "manageTeacherCode", dependencies);
    if (!admin) return;
    const body = req.body || {};
    const allowed = new Set(["schoolId", "code"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const schoolId = typeof body.schoolId === "string" && SCHOOL_ID_PATTERN.test(body.schoolId) ? body.schoolId : "";
    const code = cleanText(body.code, 40);
    if (!schoolId || !code || code.length < 6) return res.status(400).json({ ok: false, code: "invalid_request" });
    const codeHash = createHash("sha256").update(code).digest("hex");
    await db.collection("teacherCodes").doc(schoolId).set({ codeHash, updatedAt: serverTimestamp(), updatedByUid: admin.uid }, { merge: true });
    return res.status(200).json({ ok: true, schoolId });
  };
}

module.exports = { createManageTeacherCodeHandler };
