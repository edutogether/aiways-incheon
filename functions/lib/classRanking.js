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
const { applyCors } = require("./httpGuard");

const MAX_BODY_BYTES = 1 * 1024;

// 2026-08-29 - 100점 목표 4번(비용상한을 "요청당 읽기수" 기준으로 재점검):
// 이 함수는 schoolDashboard.js(2026-08-26)와 달리 캐시가 전혀 없어서 호출마다
// (락 트랜잭션 1회 읽기 + classes where-쿼리 1회) = 요청 하나당 최대 2회
// Firestore 읽기가 고정으로 나갔다. school-panel의 반 목록과 같은
// 데이터 신선도(같은 폴링 주기)면 충분하므로, schoolDashboard.js와 동일한
// 패턴(같은 TTL, 같은 "폴링 주기보다 길게" 원칙)으로 (schoolId,grade) 단위
// 인스턴스 캐시를 둔다 - 캐시 적중 시 요청당 읽기가 2회에서 락 트랜잭션
// 1회로 줄어든다. isMine(요청자 본인 반 여부)은 요청마다 다를 수 있어
// 캐시 대상에서 제외하고 캐시 조회 이후에 매번 새로 계산한다.
const RANKING_CACHE_TTL_MS = 5500;
function createClassRankingCache() {
  const store = new Map();
  return {
    get(key, now) {
      const entry = store.get(key);
      if (!entry || now - entry.cachedAt > RANKING_CACHE_TTL_MS) return null;
      return entry.value;
    },
    set(key, value, now) {
      store.set(key, { value, cachedAt: now });
    }
  };
}

function createGetClassRankingHandler(dependencies = {}) {
  const db = dependencies.db;
  const now = dependencies.now || (() => Date.now());
  const cache = dependencies.cache || createClassRankingCache();
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
      let binding;
      try {
        binding = await db.runTransaction(async (transaction) => {
          const snap = await transaction.get(actorRef);
          const data = snap.exists ? snap.data() : null;
          const boundSchoolId = cleanSchoolId(data?.dashboardSchoolId || "");
          if (!boundSchoolId) {
            transaction.set(actorRef, { dashboardSchoolId: schoolId }, { merge: true });
            return true;
          }
          return boundSchoolId === schoolId;
        });
      } catch {
        return res.status(503).json({ ok: false, code: "protection_unavailable" });
      }
      if (!binding) return res.status(403).json({ ok: false, code: "school_mismatch" });
    }

    // 같은 학교, 같은 학년의 반만 조회한다 - 다른 학년/다른 학교 데이터는
    // 이 쿼리 자체가 절대 안 읽는다(전국 스캔이었던 예전 구조와의 핵심 차이).
    const requestTime = now();
    const cacheKey = `${schoolId}_${grade}`;
    let classes = cache.get(cacheKey, requestTime);
    if (!classes) {
      const classesSnap = await db.collection("schools").doc(schoolId).collection("classes").where("grade", "==", grade).get();
      classes = classesSnap.docs.map((doc) => {
        const data = doc.data() || {};
        const completedTotal = Number(data.completedTotal) || 0;
        const heldTotal = Number(data.heldTotal) || 0;
        return { classNum: data.classNum || "", score: completedTotal, observedTotal: completedTotal + heldTotal };
      });
      cache.set(cacheKey, classes, requestTime);
    }

    const ranked = [...classes].sort((a, b) => b.score - a.score);
    const rankedWithPosition = ranked.map((item, index) => ({ ...item, rank: index + 1, isMine: !!highlightClassNum && item.classNum === highlightClassNum }));

    return res.status(200).json({ ok: true, schoolId, grade, classCount: rankedWithPosition.length, classes: rankedWithPosition });
  };
}

module.exports = { createGetClassRankingHandler };
