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
const { setDashboardSchoolClaim } = require("./dashboardSchoolClaim");

const MAX_BODY_BYTES = 2 * 1024;
const SCHOOL_ID_PATTERN = /^\d{1,12}$/;
const DIGITS = /^\d{1,2}$/;

function teacherCodeDocId(schoolId, grade, classNum) {
  return `${schoolId}_${grade}_${classNum}`;
}

// 2026-09-07 종합감사 - 교사코드는 반당 1개를 여러 교사가 공유하는
// 구조라 유출되면 그 반 전체 실명+번호 CSV/가입승인/익명화 권한이
// 통째로 넘어간다. 그런데 방어는 "느린 해시(scrypt) + 전역 분당 상한"
// 뿐이었고, 코드 강도 요건도 6자 이상뿐이었다("123456"도 통과). 게다가
// registerStudentProfile(role:"homeroom")이 이 로직을 그대로 재사용하는데
// (studentProfile.js), 그 함수의 전역 상한은 학생 가입 트래픽을 감당하려고
// 넉넉하게 잡혀 있어(이번 감사에서 400/분으로 올림) 결과적으로 교사코드
// 시도 상한도 같이 넓어져 버렸다 - 전역 상한이 아니라 "이 반 코드"
// 자체에 거는 잠금이 필요하다. 짧은 시간 안에 실패가 쌓이면 그 반의
// 코드 검증 자체를 잠가서, 어느 엔드포인트로 시도하든(verifyTeacherCode든
// registerStudentProfile 경유든) 공통으로 막는다.
const CODE_LOCKOUT_THRESHOLD = 10;
const CODE_LOCKOUT_WINDOW_MS = 10 * 60 * 1000;
const CODE_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
function teacherCodeAttemptRef(db, schoolId, grade, classNum) {
  return db.collection("teacherCodeAttempts").doc(teacherCodeDocId(schoolId, grade, classNum));
}
function timestampToDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return null;
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
  } catch (error) {
    (dependencies.logger || (() => {}))({ severity: "ERROR", message: "guarded_teacher_failed", functionName, actorId: protectedActor.actorId, error: String(error?.message || error) });
    res.status(503).json({ ok: false, code: "protection_unavailable" });
    return null;
  }
}

function createCheckTeacherStatusHandler(dependencies = {}) {
  const db = dependencies.db;
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    const protectedActor = await guardedActor(req, res, "checkTeacherStatus", dependencies);
    if (!protectedActor) return;
    const body = req.body || {};
    if (Object.keys(body).length) return res.status(400).json({ ok: false, code: "unknown_field" });
    try {
      const snap = await db.collection("actors").doc(protectedActor.actorId).get();
      const teacherVerified = snap.exists ? snap.data()?.teacherVerified : null;
      return res.status(200).json({ ok: true, verified: !!teacherVerified, schoolId: teacherVerified?.schoolId || null, grade: teacherVerified?.grade || null, classNum: teacherVerified?.classNum || null });
    } catch (error) {
      logger({ severity: "ERROR", message: "check_teacher_status_failed", actorId: protectedActor.actorId, error: String(error?.message || error) });
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

// verifyTeacherCode: registerStudentProfile(role:"homeroom")도 이 로직을
// 그대로 재사용한다(studentProfile.js에서 verifyTeacherCodeCore를 직접
// import) - "가입 경로를 두 개 만들지 말라"는 지시대로 단일 가입 폼에서
// 코드까지 같이 받으므로, HTTP 핸들러 계층이 아니라 여기 핵심 로직만
// 공유 함수로 뺀다.
async function verifyTeacherCodeCore({ db, serverTimestamp, now = () => new Date(), actorId, uid, auth, schoolId, grade, classNum, code, logger }) {
  const current = now();
  const attemptRef = teacherCodeAttemptRef(db, schoolId, grade, classNum);
  const attemptSnap = await attemptRef.get();
  const attempt = attemptSnap.exists ? attemptSnap.data() || {} : {};
  const lockedUntil = timestampToDate(attempt.lockedUntil);
  if (lockedUntil && lockedUntil.getTime() > current.getTime()) {
    return { ok: false, httpStatus: 429, code: "teacher_code_locked", retryAfterSeconds: Math.ceil((lockedUntil.getTime() - current.getTime()) / 1000) };
  }

  const codeSnap = await db.collection("teacherCodes").doc(teacherCodeDocId(schoolId, grade, classNum)).get();
  if (!codeSnap.exists) return { ok: false, httpStatus: 404, code: "teacher_code_not_set" };
  if (!verifyStoredTeacherCode(code, codeSnap.data() || {})) {
    logger?.({ severity: "WARNING", message: "teacher_code_verification_failed", schoolId, grade, classNum, actorId });
    // windowStart는 반드시 now()가 주는 값(current) 기준으로 저장해야 한다 -
    // serverTimestamp()(Firestore 서버 시각)로 저장하면, 다음 비교 때
    // current(주입 가능한 now())와 서버 시각이라는 서로 다른 시계를
    // 비교하게 돼서 어긋난다(실사용에선 둘이 거의 같아 잘 안 드러나지만
    // 테스트에서 now를 고정하면 바로 깨진다 - 실제로 이 버그로 6번째
    // 실패부터 곧바로 잠기는 걸 테스트로 잡았다).
    const windowStart = timestampToDate(attempt.windowStart);
    const withinWindow = !!windowStart && current.getTime() - windowStart.getTime() < CODE_LOCKOUT_WINDOW_MS;
    const count = (withinWindow ? Number(attempt.count) || 0 : 0) + 1;
    const update = { count, updatedAt: serverTimestamp(), windowStart: withinWindow ? attempt.windowStart : current };
    if (count >= CODE_LOCKOUT_THRESHOLD) {
      update.lockedUntil = new Date(current.getTime() + CODE_LOCKOUT_DURATION_MS);
      logger?.({ severity: "WARNING", message: "teacher_code_locked", schoolId, grade, classNum, count });
    }
    await attemptRef.set(update, { merge: true });
    return { ok: false, httpStatus: 401, code: "invalid_code" };
  }
  // 성공 - 다음 정상 사용에 영향 없게 실패 카운터를 리셋한다.
  await attemptRef.delete().catch(() => {});
  // 3단 권한체계 3단계(2026-08-31) - school-lock(getSchoolDashboard의
  // dashboardSchoolId, schoolDashboard.js 참고)은 이 기기가 처음 요청한
  // 학교로 한 번 고정되면 풀 방법이 전혀 없었다. 교사 코드로 신원이
  // 확인된 순간만큼은 "이 기기는 이 학교 것"이라는 확실한 서버측
  // 증거이므로, 그 신뢰를 그대로 넘겨 잘못 고정된 school-lock을
  // 여기서 바로잡는다(새 "관리자" 개념 없이도 가능한 교정).
  const actorRef = db.collection("actors").doc(actorId);
  await actorRef.set({ teacherVerified: { schoolId, grade, classNum, verifiedAt: serverTimestamp() }, dashboardSchoolId: schoolId }, { merge: true });
  // 비용절감 4번 - school-lock을 여기서 고쳐쓰는 경우, dashboardSchoolClaim.js가
  // 보장하는 "클레임 == dashboardSchoolId" 불변식이 깨지지 않도록 여기서도
  // 클레임을 같이 맞춘다(schoolDashboard.js/classRanking.js는 "처음 확정" 때만
  // 설정하지만, 이 교정 경로는 이미 확정된 값을 실제로 바꾸는 유일한 지점이라
  // 매번 다시 설정해야 한다).
  await setDashboardSchoolClaim({ auth, uid, schoolId, logger });
  return { ok: true };
}

function createVerifyTeacherCodeHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  const now = dependencies.now || (() => new Date());
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
      const result = await verifyTeacherCodeCore({ db, serverTimestamp, now, actorId: protectedActor.actorId, uid: protectedActor.uid, auth: dependencies.auth, schoolId, grade, classNum, code, logger });
      if (!result.ok) {
        if (result.retryAfterSeconds) res.set("Retry-After", String(result.retryAfterSeconds));
        return res.status(result.httpStatus).json({ ok: false, code: result.code, ...(result.retryAfterSeconds ? { retryAfterSeconds: result.retryAfterSeconds } : {}) });
      }
      return res.status(200).json({ ok: true, verified: true, schoolId, grade, classNum });
    } catch (error) {
      logger({ severity: "ERROR", message: "verify_teacher_code_failed", actorId: protectedActor.actorId, schoolId, grade, classNum, error: String(error?.message || error) });
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

module.exports = { createCheckTeacherStatusHandler, createVerifyTeacherCodeHandler, guardedTeacher, verifyTeacherCodeCore, teacherCodeDocId };
