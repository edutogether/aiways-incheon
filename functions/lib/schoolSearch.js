"use strict";

// 나이스(NEIS) 교육정보 개방 포털의 학교기본정보 API를 대신 호출해준다.
// 인증키는 절대 브라우저로 안 나가고 여기(서버)에만 있는다 - Gemini API
// 키를 다루는 방식과 동일한 패턴. 응답도 우리가 실제로 쓰는 필드(학교코드/
// 학교명/지역/급별)만 추려서 돌려준다 - 나이스 원본 응답의 다른 필드들은
// 클라이언트에 노출할 이유가 없다.
const { protectActorRequest } = require("./protectedActor");

const MAX_BODY_BYTES = 1 * 1024;
const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const NEIS_TIMEOUT_MS = 8000;
const NEIS_URL = "https://open.neis.go.kr/hub/schoolInfo";

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

function toSchool(row) {
  return {
    schoolCode: cleanText(row.SD_SCHUL_CODE, 20),
    schoolName: cleanText(row.SCHUL_NM, 80),
    schoolLevel: cleanText(row.SCHUL_KND_SC_NM, 20),
    region: cleanText(row.LCTN_SC_NM, 20)
  };
}

function createSearchSchoolHandler(dependencies = {}) {
  const getApiKey = dependencies.getApiKey;
  const fetchImpl = dependencies.fetch || fetch;
  return async (req, res) => {
    if (!applyCors(req, res)) return res.status(403).json({ ok: false, code: "invalid_origin" });
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ ok: false, code: "method_not_allowed" });

    const protectedActor = await protectActorRequest({ req, functionName: "searchSchool", access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck });
    if (!protectedActor.ok) {
      if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds));
      return res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) });
    }

    const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
    if (bodyBytes > MAX_BODY_BYTES) return res.status(413).json({ ok: false, code: "request_too_large" });

    const body = req.body || {};
    const allowed = new Set(["query"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const query = cleanText(body.query, 60);
    if (!query || query.length < 2) return res.status(400).json({ ok: false, code: "invalid_query" });

    const apiKey = getApiKey?.();
    if (!apiKey) return res.status(503).json({ ok: false, code: "provider_unavailable" });

    const url = `${NEIS_URL}?KEY=${encodeURIComponent(apiKey)}&Type=json&pIndex=1&pSize=20&SCHUL_NM=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NEIS_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) return res.status(502).json({ ok: false, code: "provider_unavailable" });
      const data = await response.json();
      const rows = data?.schoolInfo?.[1]?.row;
      const schools = Array.isArray(rows) ? rows.map(toSchool).filter((school) => school.schoolCode && school.schoolName) : [];
      return res.status(200).json({ ok: true, schools });
    } catch {
      return res.status(502).json({ ok: false, code: "provider_unavailable" });
    } finally {
      clearTimeout(timer);
    }
  };
}

module.exports = { createSearchSchoolHandler };
