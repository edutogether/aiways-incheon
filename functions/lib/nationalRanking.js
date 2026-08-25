"use strict";

// 8단계 "전국 랭킹": 다른 학교의 반별 내역은 절대 안 보여주고, 학교 단위
// 총점만 보여준다. getSchoolDashboard(우리 학교 전용, dashboardSchoolId로
// 잠긴)와 달리 이 엔드포인트는 애초에 클래스(반) 단위 데이터를 읽지도,
// 응답에 담지도 않는다 - 그래서 어느 학교를 요청해도 격리를 어길 방법 자체가
// 구조적으로 없다.
const { protectActorRequest } = require("./protectedActor");

const MAX_BODY_BYTES = 1 * 1024;
const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

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

function createGetNationalRankingHandler(dependencies = {}) {
  const db = dependencies.db;
  return async (req, res) => {
    if (!applyCors(req, res)) return res.status(403).json({ ok: false, code: "invalid_origin" });
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ ok: false, code: "method_not_allowed" });

    const protectedActor = await protectActorRequest({ req, functionName: "getNationalRanking", access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck, blockedActors: dependencies.blockedActors });
    if (!protectedActor.ok) {
      if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds));
      return res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) });
    }

    const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
    if (bodyBytes > MAX_BODY_BYTES) return res.status(413).json({ ok: false, code: "request_too_large" });

    const body = req.body || {};
    const allowed = new Set(["schoolId"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const highlightSchoolId = body.schoolId === undefined ? "" : cleanText(body.schoolId, 80);
    if (body.schoolId !== undefined && !highlightSchoolId) return res.status(400).json({ ok: false, code: "invalid_request" });

    // 반(class) 문서를 모아 학교 단위로만 합산한다 - 어느 반이 몇 명인지,
    // 무슨 물건을 헷갈렸는지는 이 응답에 아예 존재하지 않는다.
    const classesSnap = await db.collectionGroup("classes").get();
    const totals = new Map();
    for (const doc of classesSnap.docs) {
      const data = doc.data() || {};
      const schoolId = cleanText(data.schoolId, 80);
      if (!schoolId) continue;
      const completedTotal = Number(data.completedTotal) || 0;
      const heldTotal = Number(data.heldTotal) || 0;
      const current = totals.get(schoolId) || { schoolId, score: 0, observedTotal: 0 };
      current.score += completedTotal;
      current.observedTotal += completedTotal + heldTotal;
      totals.set(schoolId, current);
    }
    // schoolId는 나이스 학교코드라 그 자체로는 사람이 못 읽는다 - 학교 문서
    // (부모, schoolDashboardAggregate.js가 채워둔 schoolName)를 한 번 더
    // 읽어 표시용 이름을 붙인다. 학교 수가 적은 규모라 school당 1회 추가
    // 조회는 무시할 만한 비용이다.
    const schoolNamePairs = await Promise.all([...totals.keys()].map(async (schoolId) => {
      const snap = await db.collection("schools").doc(schoolId).get();
      return [schoolId, cleanText(snap.exists ? snap.data()?.schoolName : "", 80)];
    }));
    const schoolNames = new Map(schoolNamePairs);

    const ranked = [...totals.values()].sort((a, b) => b.score - a.score);
    const schools = ranked.map((item, index) => ({ schoolId: item.schoolId, schoolName: schoolNames.get(item.schoolId) || "", score: item.score, rank: index + 1, isMine: item.schoolId === highlightSchoolId }));

    return res.status(200).json({ ok: true, schoolCount: schools.length, schools });
  };
}

module.exports = { createGetNationalRankingHandler };
