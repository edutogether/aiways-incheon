"use strict";

// 3단 권한체계(2026-08-31 대표님 승인) 1단계: 교사 인증. 학교 전체가 공유하는
// 코드 1개로 "이 사람이 우리 학교 교사"만 확인한다(개인별 계정이 아님 -
// 그건 필요해지면 별도 결정). 검증된 actor는 actors/{actorId}.teacherVerified에
// schoolId+verifiedAt이 남고, 이후 가입승인대기열/CSV 반전체 내보내기 등
// "교사만" 기능들이 이 값을 신뢰 기준으로 삼는다.
// 코드 자체는 teacherCodes/{schoolId} 문서의 codeHash(sha256)로만 저장한다 -
// 평문을 DB에 두지 않는다. 아직 이 코드를 발급/회전하는 관리자 화면이 없어서
// (그건 슈퍼어드민 단계에서 만들 것), 지금은 scripts/setTeacherCode.js를
// 개발자가 로컬에서 1회 실행해 심어야 한다.
const { createHash, timingSafeEqual } = require("node:crypto");
const { cleanText, applyCors } = require("./httpGuard");
const { protectActorRequest } = require("./protectedActor");

const MAX_BODY_BYTES = 2 * 1024;
const SCHOOL_ID_PATTERN = /^\d{1,12}$/;

function hashTeacherCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

// 코드는 사람이 입력하는 값이라 처리 시간 자체로 정답 여부를 추측할 수 없게
// timingSafeEqual로 비교한다(sha256 다이제스트는 항상 같은 길이라 안전하게 씀).
function safeEqualHex(a, b) {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
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

function createCheckTeacherStatusHandler(dependencies = {}) {
  const db = dependencies.db;
  return async (req, res) => {
    const protectedActor = await guardedActor(req, res, "checkTeacherStatus", dependencies);
    if (!protectedActor) return;
    const body = req.body || {};
    if (Object.keys(body).length) return res.status(400).json({ ok: false, code: "unknown_field" });
    const snap = await db.collection("actors").doc(protectedActor.actorId).get();
    const teacherVerified = snap.exists ? snap.data()?.teacherVerified : null;
    return res.status(200).json({ ok: true, verified: !!teacherVerified, schoolId: teacherVerified?.schoolId || null });
  };
}

function createVerifyTeacherCodeHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  return async (req, res) => {
    const protectedActor = await guardedActor(req, res, "verifyTeacherCode", dependencies);
    if (!protectedActor) return;
    const body = req.body || {};
    const allowed = new Set(["schoolId", "code"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const schoolId = typeof body.schoolId === "string" && SCHOOL_ID_PATTERN.test(body.schoolId) ? body.schoolId : "";
    const code = cleanText(body.code, 40);
    if (!schoolId || !code) return res.status(400).json({ ok: false, code: "invalid_request" });

    const codeSnap = await db.collection("teacherCodes").doc(schoolId).get();
    if (!codeSnap.exists) return res.status(404).json({ ok: false, code: "teacher_code_not_set" });
    const codeHash = codeSnap.data()?.codeHash;
    if (typeof codeHash !== "string" || !safeEqualHex(hashTeacherCode(code), codeHash)) {
      return res.status(401).json({ ok: false, code: "invalid_code" });
    }

    // 3단 권한체계 3단계(2026-08-31) - school-lock(getSchoolDashboard의
    // dashboardSchoolId, schoolDashboard.js 참고)은 이 기기가 처음 요청한
    // 학교로 한 번 고정되면 풀 방법이 전혀 없었다. 교사 코드로 신원이
    // 확인된 순간만큼은 "이 기기는 이 학교 것"이라는 확실한 서버측
    // 증거이므로, 그 신뢰를 그대로 넘겨 잘못 고정된 school-lock을
    // 여기서 바로잡는다(새 "관리자" 개념 없이도 가능한 교정).
    const actorRef = db.collection("actors").doc(protectedActor.actorId);
    await actorRef.set({ teacherVerified: { schoolId, verifiedAt: serverTimestamp() }, dashboardSchoolId: schoolId }, { merge: true });
    return res.status(200).json({ ok: true, verified: true, schoolId });
  };
}

module.exports = { createCheckTeacherStatusHandler, createVerifyTeacherCodeHandler, hashTeacherCode };
