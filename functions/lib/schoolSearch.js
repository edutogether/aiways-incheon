"use strict";

// 나이스(NEIS) 교육정보 개방 포털의 학교기본정보 API를 대신 호출해준다.
// 인증키는 절대 브라우저로 안 나가고 여기(서버)에만 있는다 - Gemini API
// 키를 다루는 방식과 동일한 패턴. 응답도 우리가 실제로 쓰는 필드(학교코드/
// 학교명/지역/급별)만 추려서 돌려준다 - 나이스 원본 응답의 다른 필드들은
// 클라이언트에 노출할 이유가 없다.
const { protectActorRequest } = require("./protectedActor");
const { cleanText, applyCors } = require("./httpGuard");

const MAX_BODY_BYTES = 1 * 1024;
const NEIS_TIMEOUT_MS = 8000;
const NEIS_URL = "https://open.neis.go.kr/hub/schoolInfo";

function toSchool(row) {
  return {
    schoolCode: cleanText(row.SD_SCHUL_CODE, 20),
    schoolName: cleanText(row.SCHUL_NM, 80),
    schoolLevel: cleanText(row.SCHUL_KND_SC_NM, 20),
    region: cleanText(row.LCTN_SC_NM, 20),
    // 같은 이름의 학교가 여러 지역에 있을 수 있어(예: 인천동방초등학교 vs
    // 인천동방중학교), region만으로는 못 구분한다 - 실제 도로명주소까지
    // 보여줘야 목록에서 정확히 구분해서 고를 수 있다.
    address: cleanText(row.ORG_RDNMA, 120)
  };
}

// 문지기를 통과한 뒤의 본문 - 요청 검사, NEIS 호출, 응답 정리.
//
// 2026-09-10에 관리자 화면도 학교를 이름으로 검색하게 되면서 갈라 뒀다.
// 학생 앱은 actor(익명 인증)로, 관리자 화면은 superadmin ID토큰으로 들어와
// **문지기가 서로 다르다.** 그렇다고 NEIS 호출을 두 벌 쓰면 한쪽만 고쳐지는
// 날이 반드시 온다 - 문지기만 다르고 그 뒤는 같은 코드를 쓴다.
async function respondWithSchoolSearch({ req, res, getApiKey, fetchImpl, logger }) {
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
  } catch (error) {
    // 2026-08-27 재감사 지적: 이 catch가 조용해서, NEIS가 장애나면
    // 모든 학생의 학교검색이 실패하는데 Cloud Logging엔 아무 흔적도
    // 안 남았다.
    logger({ message: "search_school_provider_failed", error: String(error && error.message ? error.message : error) });
    return res.status(502).json({ ok: false, code: "provider_unavailable" });
  } finally {
    clearTimeout(timer);
  }
}

function createSearchSchoolHandler(dependencies = {}) {
  const getApiKey = dependencies.getApiKey;
  const fetchImpl = dependencies.fetch || fetch;
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    if (!applyCors(req, res)) return res.status(403).json({ ok: false, code: "invalid_origin" });
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ ok: false, code: "method_not_allowed" });

    const protectedActor = await protectActorRequest({ req, functionName: "searchSchool", access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck, blockedActors: dependencies.blockedActors });
    if (!protectedActor.ok) {
      if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds));
      return res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) });
    }

    return respondWithSchoolSearch({ req, res, getApiKey, fetchImpl, logger });
  };
}

module.exports = { createSearchSchoolHandler, respondWithSchoolSearch };
