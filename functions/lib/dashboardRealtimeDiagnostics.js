"use strict";

// 비용절감 4번 ③단계(2026-09-03 대표님 지시) - 폴링/실시간 구독 병행 관찰
// 기간을 "며칠 지켜보고 민원 없으면 넘어간다"는 감으로 판단하지 않기
// 위한 최소 신호. dashboardRealtime.js가 school-lock 확정 뒤 실시간
// 구독을 시작/실패할 때마다 한 번씩만 호출한다(5초 폴링처럼 반복 호출되는
// 경로가 아니라 세션당 최소 빈도) - Firestore 읽기/쓰기가 전혀 없는
// Cloud Logging 기록뿐이라 관찰 기간 동안 추가 비용이 사실상 0에 가깝다.
// 관찰이 끝나면(④단계, 폴링 제거) 이 엔드포인트도 같이 정리한다.
const { protectActorRequest } = require("./protectedActor");
const { cleanText, applyCors } = require("./httpGuard");

const MAX_BODY_BYTES = 512;
const ALLOWED_EVENTS = new Set(["subscribed", "failed"]);

function createLogDashboardRealtimeEventHandler(dependencies = {}) {
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    if (!applyCors(req, res)) return res.status(403).json({ ok: false, code: "invalid_origin" });
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ ok: false, code: "method_not_allowed" });
    const protectedActor = await protectActorRequest({ req, functionName: "logDashboardRealtimeEvent", access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck, blockedActors: dependencies.blockedActors });
    if (!protectedActor.ok) {
      if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds));
      return res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) });
    }
    const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
    if (bodyBytes > MAX_BODY_BYTES) return res.status(413).json({ ok: false, code: "request_too_large" });
    const body = req.body || {};
    const allowed = new Set(["event", "code"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const event = typeof body.event === "string" && ALLOWED_EVENTS.has(body.event) ? body.event : "";
    if (!event) return res.status(400).json({ ok: false, code: "invalid_request" });
    const code = cleanText(body.code, 60);
    logger({ severity: event === "failed" ? "WARNING" : "INFO", message: `dashboard_realtime_${event}`, actorId: protectedActor.actorId, code: code || null });
    return res.status(200).json({ ok: true });
  };
}

module.exports = { createLogDashboardRealtimeEventHandler };
