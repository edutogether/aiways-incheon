"use strict";

const { createHash } = require("node:crypto");

const RATE_LIMIT_SCHEMA = "global-rate-limit-v1";
const RATE_LIMITS = Object.freeze({
  analyzeSortingImage: { perMinute: 20, perDay: 1000 },
  analyzeSortingSafetyObserver: { perMinute: 20, perDay: 1000 },
  analyzeSortingText: { perMinute: 20, perDay: 1000 },
  saveSortingRecord: { perMinute: 60 },
  listSortingRecords: { perMinute: 120 },
  resolveSortingRecord: { perMinute: 60 },
  // 대시보드가 5초마다 자동으로 다시 불러오는 폴링 방식이라(app.js) 기기
  // 한 대가 분당 12번을 쓴다 - 예전 120/min은 동시에 10대만 켜져 있어도
  // (파일럿 4개 학교 x PC/패드 여러 대) 전역 상한에 걸려 그 순간 모든
  // 사용자가 같이 막히는 구조였다(실측: 2000/일 액터 상한은 약 2시간
  // 47분 만에 소진). 이 파일럿 규모(4개 학교) 기준으로 여유 있게 올림.
  // perDay는 2026-08-26 정밀감사에서 빠진 게 발견됨 - 분당 상한만 있으면
  // 하루 종일 최대치로 돌리는 트래픽을 못 막는다. 5초 폴링 x 넉넉히
  // 20대(4학교 x PC/패드 5대) 기준 하루 약 34.5만 회(17,280 x 20)가
  // 정상 사용 상한선이라, 그 위에 여유를 둔 50만으로 잡는다.
  getSchoolDashboard: { perMinute: 600, perDay: 500000 },
  checkStudentProfile: { perMinute: 30 }, registerStudentProfile: { perMinute: 10 },
  checkCampusLocation: { perMinute: 60 },
  changeStudentClass: { perMinute: 10 },
  // 전국 랭킹(collectionGroup 전수스캔)을 폐지하고 학교+학년 범위로 축소한
  // 뒤 이름도 그에 맞게 바꿈(2026-08-26) - 쿼리 자체가 훨씬 가벼워졌지만
  // perDay가 아예 없던 문제는 그대로 남아있어 같이 추가.
  getClassRanking: { perMinute: 60, perDay: 5000 },
  searchSchool: { perMinute: 60 }
  ,redeemEdu2gPass: { perMinute: 5 }, getEdu2gSession: { perMinute: 60 }, listEdu2gTrustedDevices: { perMinute: 60 }, revokeEdu2gTrustedDevice: { perMinute: 20 }
});

function getUtcBuckets(now = new Date()) {
  const date = new Date(now);
  const utcDate = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  const minuteKey = `${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return { utcDate, minuteKey };
}

function getRetryAfterSeconds(now = new Date(), outcome) {
  const date = new Date(now);
  const end = outcome === "daily_limited"
    ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0)
    : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes() + 1, 0);
  return Math.max(1, Math.min(60, Math.ceil((end - date.getTime()) / 1000)));
}

function expireAtFor(now) {
  const date = new Date(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 3, 0, 0, 0));
}

function createGlobalRateLimiter({ db, now = () => new Date(), serverTimestamp = () => new Date() }) {
  return {
    async check(functionName) {
      const limit = RATE_LIMITS[functionName];
      if (!limit || !db?.runTransaction) return { allowed: false, outcome: "unavailable" };
      const current = new Date(now());
      const { utcDate, minuteKey } = getUtcBuckets(current);
      const ref = db.collection("system_rate_limits").doc(`${functionName}-${utcDate}`);
      try {
        return await db.runTransaction(async (transaction) => {
          const snap = await transaction.get(ref);
          const data = snap.exists ? (snap.data() || {}) : {};
          const minuteCounts = data.minuteCounts && typeof data.minuteCounts === "object" ? data.minuteCounts : {};
          const minuteCount = Number(minuteCounts[minuteKey] || 0);
          const totalCount = Number(data.totalCount || 0);
          const outcome = minuteCount >= limit.perMinute ? "minute_limited" : (limit.perDay && totalCount >= limit.perDay ? "daily_limited" : "allowed");
          if (outcome !== "allowed") return { allowed: false, outcome, retryAfterSeconds: getRetryAfterSeconds(current, outcome) };
          transaction.set(ref, {
            schemaVersion: RATE_LIMIT_SCHEMA, functionName, utcDate,
            totalCount: totalCount + 1, minuteCounts: { ...minuteCounts, [minuteKey]: minuteCount + 1 },
            ...(snap.exists ? {} : { createdAt: serverTimestamp(), expireAt: expireAtFor(current) }), updatedAt: serverTimestamp()
          }, { merge: true });
          return { allowed: true, outcome: "allowed" };
        });
      } catch {
        return { allowed: false, outcome: "unavailable" };
      }
    }
  };
}

const ACTOR_RATE_LIMITS = Object.freeze({
  analyzeSortingImage: { perMinute: 4, perDay: 50 }, analyzeSortingText: { perMinute: 6, perDay: 80 },
  saveSortingRecord: { perMinute: 12, perDay: 200 },
  listSortingRecords: { perMinute: 60, perDay: 500 }, resolveSortingRecord: { perMinute: 20, perDay: 100 },
  // 24시간 내내 켜있는 키오스크 기기가 5초마다 폴링하면 하루 최대
  // 86400/5=17280번 호출한다 - 2000이면 약 2시간 47분 만에 소진돼서
  // 그 뒤로는 이 기기 하나만 대시보드가 조용히 멈춘다(429가 화면에
  // 아무 표시도 안 남기고 그냥 무시됐었음, 아래 app.js에서 별도 수정).
  // 여유 있게 20000으로 올림.
  getSchoolDashboard: { perMinute: 30, perDay: 20000 },
  checkStudentProfile: { perMinute: 10, perDay: 200 }, registerStudentProfile: { perMinute: 5, perDay: 20 },
  checkCampusLocation: { perMinute: 15, perDay: 300 },
  changeStudentClass: { perMinute: 15, perDay: 20 },
  getClassRanking: { perMinute: 30, perDay: 2000 },
  searchSchool: { perMinute: 20, perDay: 500 },
  redeemEdu2gPass: { perMinute: 5 }
});
function hashRateLimitScope(value) { return createHash("sha256").update(String(value)).digest("hex"); }
function createActorRateLimiter({ db, now = () => new Date(), serverTimestamp = () => new Date(), limits = ACTOR_RATE_LIMITS }) {
  return { async check(functionName, scope) {
    const limit = limits[functionName];
    if (!limit) return { allowed: true, outcome: "not_configured" };
    if (typeof scope !== "string" || !scope || !db?.runTransaction) return { allowed: false, outcome: "unavailable" };
    const current = new Date(now()), { utcDate, minuteKey } = getUtcBuckets(current);
    const ref = db.collection("system_actor_rate_limits").doc(`${functionName}-${hashRateLimitScope(scope)}-${utcDate}`);
    try { return await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref), data = snap.exists ? (snap.data() || {}) : {}, counts = data.minuteCounts && typeof data.minuteCounts === "object" ? data.minuteCounts : {};
      const minuteCount = Number(counts[minuteKey] || 0), totalCount = Number(data.totalCount || 0);
      const outcome = minuteCount >= limit.perMinute ? "minute_limited" : (limit.perDay && totalCount >= limit.perDay ? "daily_limited" : "allowed");
      if (outcome !== "allowed") return { allowed: false, outcome, retryAfterSeconds: getRetryAfterSeconds(current, outcome) };
      transaction.set(ref, { schemaVersion: "actor-rate-limit-v1", functionName, utcDate, totalCount: totalCount + 1, minuteCounts: { ...counts, [minuteKey]: minuteCount + 1 }, ...(snap.exists ? {} : { createdAt: serverTimestamp(), expireAt: expireAtFor(current) }), updatedAt: serverTimestamp() }, { merge: true });
      return { allowed: true, outcome: "allowed" };
    }); } catch { return { allowed: false, outcome: "unavailable" }; }
  } };
}

async function checkGlobalRateLimit(limiter, functionName) { return limiter.check(functionName); }

module.exports = { RATE_LIMIT_SCHEMA, RATE_LIMITS, ACTOR_RATE_LIMITS, getUtcBuckets, getRetryAfterSeconds, expireAtFor, checkGlobalRateLimit, createGlobalRateLimiter, createActorRateLimiter, hashRateLimitScope };
