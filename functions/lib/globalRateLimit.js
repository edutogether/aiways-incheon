"use strict";

const { createHash } = require("node:crypto");

const RATE_LIMIT_SCHEMA = "global-rate-limit-v1";
const RATE_LIMITS = Object.freeze({
  analyzeSortingImage: { perMinute: 20, perDay: 1000 },
  analyzeSortingText: { perMinute: 20, perDay: 1000 },
  saveSortingRecord: { perMinute: 60 },
  listSortingRecords: { perMinute: 120 },
  resolveSortingRecord: { perMinute: 60 }
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
