"use strict";

// 8단계였던 "전국 랭킹"을 폐지하고 "같은 학교, 같은 학년 반별 랭킹"으로
// 범위를 축소한 버전(2026-08-26, 대표 결정). 예전 nationalRanking.js는
// db.collectionGroup("classes").get()으로 전국 모든 학교의 모든 반을 매
// 요청마다 통째로 스캔했다 -- 학교가 늘수록 그대로 비용/응답시간이
// 늘어나고, 별도 일일 상한도 없어 정밀감사에서 비용 폭탄 위험(항목 3)으로
// 지적됐다. 이 버전은 schools/{schoolId}/classes 서브컬렉션 하나를 같은
// 학년으로만 필터링해서 읽는다 -- 대상 규모(4개 학교, 학교당 최대 7~9개
// 반)에서는 한 학교의 한 학년 문서 몇 개가 전부라 그 비용 문제 자체가
// 구조적으로 사라진다.
const { protectActorRequest } = require("./protectedActor");
const { cleanSchoolId, cleanPathSegment } = require("./firestorePathSafety");

const MAX_BODY_BYTES = 1 * 1024;
const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

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

function createGetClassRankingHandler(dependencies = {}) {
  const db = dependencies.db;
  return async (req, res) => {
    if (!applyCors(req, res)) return res.status(403).json({ ok: false, code: "invalid_origin" });
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ ok: false, code: "method_not_allowed" });

    const protectedActor = await protectActorRequest({ req, functionName: "getClassRanking", access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck, blockedActors: dependencies.blockedActors });
    if (!protectedActor.ok) {
      if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds));
      return res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) });
    }

    const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
    if (bodyBytes > MAX_BODY_BYTES) return res.status(413).json({ ok: false, code: "request_too_large" });

    const body = req.body || {};
    const allowed = new Set(["schoolId", "grade", "classNum"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const schoolId = cleanSchoolId(body.schoolId);
    const grade = cleanPathSegment(body.grade);
    if (!schoolId || !grade) return res.status(400).json({ ok: false, code: "invalid_request" });
    const highlightClassNum = body.classNum === undefined ? "" : cleanPathSegment(body.classNum);
    if (body.classNum !== undefined && !highlightClassNum) return res.status(400).json({ ok: false, code: "invalid_request" });

    // schoolDashboard.js와 같은 "이 기기가 처음 요청한 학교로 고정" 잠금을
    // 같은 필드(dashboardSchoolId)로 공유한다 - 안 그러면 아무 actor나
    // 임의의 schoolId+grade를 보내 다른 학교의 반 점수를 조회할 수 있다
    // (2026-08-26 재감사 지적사항). 점수 자체엔 개인정보가 없지만, "우리
    // 학교 데이터만 봐야 한다"는 격리 원칙은 이 엔드포인트에도 동일하게
    // 적용돼야 한다.
    if (db) {
      const actorRef = db.collection("actors").doc(protectedActor.actorId);
      const binding = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(actorRef);
        const data = snap.exists ? snap.data() : null;
        const boundSchoolId = cleanSchoolId(data?.dashboardSchoolId || "");
        if (!boundSchoolId) {
          transaction.set(actorRef, { dashboardSchoolId: schoolId }, { merge: true });
          return true;
        }
        return boundSchoolId === schoolId;
      });
      if (!binding) return res.status(403).json({ ok: false, code: "school_mismatch" });
    }

    // 같은 학교, 같은 학년의 반만 조회한다 - 다른 학년/다른 학교 데이터는
    // 이 쿼리 자체가 절대 안 읽는다(전국 스캔이었던 예전 구조와의 핵심 차이).
    const classesSnap = await db.collection("schools").doc(schoolId).collection("classes").where("grade", "==", grade).get();
    const classes = classesSnap.docs.map((doc) => {
      const data = doc.data() || {};
      const completedTotal = Number(data.completedTotal) || 0;
      const heldTotal = Number(data.heldTotal) || 0;
      return { classNum: data.classNum || "", score: completedTotal, observedTotal: completedTotal + heldTotal };
    });

    const ranked = classes.sort((a, b) => b.score - a.score);
    const rankedWithPosition = ranked.map((item, index) => ({ ...item, rank: index + 1, isMine: !!highlightClassNum && item.classNum === highlightClassNum }));

    return res.status(200).json({ ok: true, schoolId, grade, classCount: rankedWithPosition.length, classes: rankedWithPosition });
  };
}

module.exports = { createGetClassRankingHandler };
