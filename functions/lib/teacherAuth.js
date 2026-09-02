"use strict";

// 3단 권한체계(2026-08-31 대표님 승인) 1단계: 교사 인증.
// 2026-09-02 재설계(대표님 지시) - 학교 전체가 공유하는 코드 1개 방식에서
// "학교+학년+반" 단위로 코드를 분리했다. 담임마다 자기 반 코드를 따로
// 받고, 대표님이 반별로 그때그때 코드를 추가 발급할 수 있어야 한다는
// 요구사항 때문 - 학교 공유코드 1개면 어떤 교사가 인증되든 학교 전체
// 학생 정보에 접근할 수 있어서(반별로 나눌 방법이 없음), 담임 개념
// 자체를 반 단위로 좁혔다. 검증된 actor는
// actors/{actorId}.teacherVerified에 schoolId+grade+classNum+verifiedAt이
// 남고, 가입승인대기열/CSV 반전체 내보내기/학생 익명화가 전부 이 값을
// "그 반 담임"의 신뢰 기준으로 삼는다.
// 코드 자체는 teacherCodes/{schoolId}_{grade}_{classNum} 문서의
// codeHash+codeSalt(scrypt)로만 저장한다 - 평문을 DB에 두지 않는다.
const { cleanText, applyCors } = require("./httpGuard");
const { protectActorRequest } = require("./protectedActor");
const { verifyTeacherCode: verifyStoredTeacherCode } = require("./teacherCodeHash");

const MAX_BODY_BYTES = 2 * 1024;
const SCHOOL_ID_PATTERN = /^\d{1,12}$/;
const DIGITS = /^\d{1,2}$/;

function teacherCodeDocId(schoolId, grade, classNum) {
  return `${schoolId}_${grade}_${classNum}`;
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

// teacherVerified 필수인 엔드포인트(가입승인대기열, CSV 반전체 내보내기,
// 학생 익명화)가 공유하는 가드 - registrationApproval.js/classExport.js/
// studentAnonymization.js에서도 씀(원래 각자 복붙돼 있던 걸 httpGuard.js와
// 같은 이유로 한 곳으로 모음). schoolId만이 아니라 grade/classNum까지
// 돌려줘서, 호출부가 "이 담임이 이 반 학생을 다루고 있는지"까지 확인할 수
// 있게 한다.
async function guardedTeacher(req, res, functionName, dependencies) {
  const protectedActor = await guardedActor(req, res, functionName, dependencies);
  if (!protectedActor) return null;
  try {
    const teacherSnap = await dependencies.db.collection("actors").doc(protectedActor.actorId).get();
    const teacherVerified = teacherSnap.exists ? teacherSnap.data()?.teacherVerified : null;
    if (!teacherVerified?.schoolId || !teacherVerified?.grade || !teacherVerified?.classNum) { res.status(403).json({ ok: false, code: "teacher_verification_required" }); return null; }
    return { actorId: protectedActor.actorId, schoolId: teacherVerified.schoolId, grade: teacherVerified.grade, classNum: teacherVerified.classNum };
  } catch {
    res.status(503).json({ ok: false, code: "protection_unavailable" });
    return null;
  }
}

function createCheckTeacherStatusHandler(dependencies = {}) {
  const db = dependencies.db;
  return async (req, res) => {
    const protectedActor = await guardedActor(req, res, "checkTeacherStatus", dependencies);
    if (!protectedActor) return;
    const body = req.body || {};
    if (Object.keys(body).length) return res.status(400).json({ ok: false, code: "unknown_field" });
    try {
      const snap = await db.collection("actors").doc(protectedActor.actorId).get();
      const teacherVerified = snap.exists ? snap.data()?.teacherVerified : null;
      return res.status(200).json({ ok: true, verified: !!teacherVerified, schoolId: teacherVerified?.schoolId || null, grade: teacherVerified?.grade || null, classNum: teacherVerified?.classNum || null });
    } catch {
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

// verifyTeacherCode: registerStudentProfile(role:"homeroom")도 이 로직을
// 그대로 재사용한다(studentProfile.js에서 verifyTeacherCodeCore를 직접
// import) - "가입 경로를 두 개 만들지 말라"는 지시대로 단일 가입 폼에서
// 코드까지 같이 받으므로, HTTP 핸들러 계층이 아니라 여기 핵심 로직만
// 공유 함수로 뺀다.
async function verifyTeacherCodeCore({ db, serverTimestamp, actorId, schoolId, grade, classNum, code, logger }) {
  const codeSnap = await db.collection("teacherCodes").doc(teacherCodeDocId(schoolId, grade, classNum)).get();
  if (!codeSnap.exists) return { ok: false, httpStatus: 404, code: "teacher_code_not_set" };
  if (!verifyStoredTeacherCode(code, codeSnap.data() || {})) {
    logger?.({ severity: "WARNING", message: "teacher_code_verification_failed", schoolId, grade, classNum, actorId });
    return { ok: false, httpStatus: 401, code: "invalid_code" };
  }
  // 3단 권한체계 3단계(2026-08-31) - school-lock(getSchoolDashboard의
  // dashboardSchoolId, schoolDashboard.js 참고)은 이 기기가 처음 요청한
  // 학교로 한 번 고정되면 풀 방법이 전혀 없었다. 교사 코드로 신원이
  // 확인된 순간만큼은 "이 기기는 이 학교 것"이라는 확실한 서버측
  // 증거이므로, 그 신뢰를 그대로 넘겨 잘못 고정된 school-lock을
  // 여기서 바로잡는다(새 "관리자" 개념 없이도 가능한 교정).
  const actorRef = db.collection("actors").doc(actorId);
  await actorRef.set({ teacherVerified: { schoolId, grade, classNum, verifiedAt: serverTimestamp() }, dashboardSchoolId: schoolId }, { merge: true });
  return { ok: true };
}

function createVerifyTeacherCodeHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    const protectedActor = await guardedActor(req, res, "verifyTeacherCode", dependencies);
    if (!protectedActor) return;
    const body = req.body || {};
    const allowed = new Set(["schoolId", "grade", "classNum", "code"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const schoolId = typeof body.schoolId === "string" && SCHOOL_ID_PATTERN.test(body.schoolId) ? body.schoolId : "";
    const grade = typeof body.grade === "string" && DIGITS.test(body.grade) ? body.grade : "";
    const classNum = typeof body.classNum === "string" && DIGITS.test(body.classNum) ? body.classNum : "";
    const code = cleanText(body.code, 40);
    if (!schoolId || !grade || !classNum || !code) return res.status(400).json({ ok: false, code: "invalid_request" });

    try {
      const result = await verifyTeacherCodeCore({ db, serverTimestamp, actorId: protectedActor.actorId, schoolId, grade, classNum, code, logger });
      if (!result.ok) return res.status(result.httpStatus).json({ ok: false, code: result.code });
      return res.status(200).json({ ok: true, verified: true, schoolId, grade, classNum });
    } catch {
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

module.exports = { createCheckTeacherStatusHandler, createVerifyTeacherCodeHandler, guardedTeacher, verifyTeacherCodeCore, teacherCodeDocId };
