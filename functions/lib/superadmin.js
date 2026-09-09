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
const { cleanText, applyCors } = require("./httpGuard");
const { observeAppCheck } = require("./appCheckProtection");
const { MAX_EXTRA_CODES, hashTeacherCode } = require("./teacherCodeHash");
const { teacherCodeDocId } = require("./teacherAuth");

const MAX_BODY_BYTES = 2 * 1024;
const SCHOOL_ID_PATTERN = /^\d{1,12}$/;
const DIGITS = /^\d{1,2}$/;

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
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    const admin = await guardedSuperadmin(req, res, "manageTeacherCode", dependencies);
    if (!admin) return;
    const body = req.body || {};
    const allowed = new Set(["schoolId", "grade", "classNum", "code", "mode", "label"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const schoolId = typeof body.schoolId === "string" && SCHOOL_ID_PATTERN.test(body.schoolId) ? body.schoolId : "";
    const grade = typeof body.grade === "string" && DIGITS.test(body.grade) ? body.grade : "";
    const classNum = typeof body.classNum === "string" && DIGITS.test(body.classNum) ? body.classNum : "";
    const code = cleanText(body.code, 40);
    if (!schoolId || !grade || !classNum || !code || code.length < 6) return res.status(400).json({ ok: false, code: "invalid_request" });
    // 2026-09-09(Bumm님 결정): 한 반이 코드를 여러 개 받을 수 있다.
    //   replace(기본) - 그 반의 대표 코드를 갈아끼운다(지금까지의 동작).
    //   add           - 대표 코드는 그대로 두고 추가 코드를 하나 더 등록한다.
    // 네 분 선생님의 개인 코드(EDU2G ...)가 반 코드와 **같이** 통해야 하기
    // 때문이다 - 대체로 만들면 개인 코드에 문제가 생겼을 때 그 선생님이
    // 들어갈 길이 하나도 없어진다.
    const mode = body.mode === undefined ? "replace" : body.mode;
    if (mode !== "replace" && mode !== "add") return res.status(400).json({ ok: false, code: "invalid_request" });
    // 라벨은 사람이 나중에 "이게 누구 코드였지"를 알아보기 위한 것뿐이고,
    // 코드 자체와는 무관하다(해시에도 안 들어간다).
    const label = cleanText(body.label, 40);
    // 2026-09-01 종합감사(B그룹 6번): sha256 단일해시 -> scrypt+솔트(teacherCodeHash.js).
    // 2026-09-02 재설계: 학교 공유코드 1개에서 반 단위 코드로 세분화(대표님
    // 지시) - 담임마다 자기 반 코드를 따로 받아야 반별 학생정보 접근을
    // 분리할 수 있다.
    const { codeHash, codeSalt } = hashTeacherCode(code);
    // 이 프로젝트의 다른 모든 Firestore 쓰기 핸들러(registrationApproval.js/
    // sortingRecord.js 등)와 달리 여기만 try/catch가 빠져 있어서, 일시적
    // Firestore 장애 시 503 대신 처리되지 않은 예외로 빠져나갈 수 있었다 -
    // 같은 컨벤션 적용.
    const docRef = db.collection("teacherCodes").doc(teacherCodeDocId(schoolId, grade, classNum));
    try {
      if (mode === "add") {
        // 같은 라벨이 이미 있으면 그 자리를 갈아끼운다(코드 회전). 라벨이
        // 없으면 새로 붙인다. 트랜잭션으로 읽고 쓰는 이유: 두 코드를
        // 거의 동시에 등록하면 나중 쓰기가 앞선 것을 덮어쓸 수 있다.
        await db.runTransaction(async (transaction) => {
          const snap = await transaction.get(docRef);
          if (!snap.exists) throw new Error("teacher_code_not_set");
          const current = Array.isArray(snap.data()?.extraCodes) ? snap.data().extraCodes : [];
          const kept = current.filter((entry) => !label || entry?.label !== label);
          const next = [...kept, { label, codeHash, codeSalt }];
          if (next.length > MAX_EXTRA_CODES) throw new Error("too_many_codes");
          transaction.set(docRef, { extraCodes: next, updatedAt: serverTimestamp(), updatedByUid: admin.uid }, { merge: true });
        });
      } else {
        await docRef.set({ codeHash, codeSalt, updatedAt: serverTimestamp(), updatedByUid: admin.uid }, { merge: true });
      }
    } catch (error) {
      const reason = String(error?.message || error);
      logger({ severity: "ERROR", message: "manage_teacher_code_failed", schoolId, grade, classNum, mode, updatedByUid: admin.uid, error: reason });
      // 추가 코드는 대표 코드가 이미 있어야 붙일 수 있다 - 없는 반에
      // 개인 코드만 달아두면 그 반은 규칙 코드로는 못 들어가게 된다.
      if (reason.includes("teacher_code_not_set")) return res.status(404).json({ ok: false, code: "teacher_code_not_set" });
      if (reason.includes("too_many_codes")) return res.status(400).json({ ok: false, code: "too_many_codes" });
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
    logger({ severity: "INFO", message: mode === "add" ? "teacher_code_added" : "teacher_code_rotated", schoolId, grade, classNum, label, updatedByUid: admin.uid });
    return res.status(200).json({ ok: true, schoolId, grade, classNum, mode });
  };
}

module.exports = { createManageTeacherCodeHandler };
