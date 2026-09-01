"use strict";

// 2026-08-29: 이 파일이 나오기 전까지 cleanText/isAllowedOrigin/applyCors가
// functions/lib/ 8개 파일에 그대로 복붙돼 있었다(campusLocation,
// classRanking, schoolDashboard, schoolSearch, sortingRecord,
// sortingTextTip, sortingVision, studentProfile). 복붙하면서 이미 서로
// 갈라져 있었다 - cleanText 기본 글자수 제한이 파일마다 80/200으로 달랐다.
// 여기 한 곳으로 모은다. MAX_BODY_BYTES는 엔드포인트마다 실제로 다른
// 값이 맞아서(요청 본문 크기가 다름) 공용화 대상에서 뺐다 - 각 파일에
// 그대로 남는다.

const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

function cleanText(value, max = 80) {
  return typeof value === "string" && value.length <= max && value.trim() && !/[<>\x00-\x1f]/.test(value) ? value.trim() : "";
}

// 2026-09-01: edutogether.github.io(구 GitHub Pages)만 허용돼 있어서,
// 같은 날 Firebase Hosting(ai-ways-incheon.web.app)으로 이전한 뒤에도
// 이 목록이 안 갱신돼 라이브 사이트의 모든 API 호출이 403 invalid_origin으로
// 막혀 있었다(2026-09-01 종합감사 중 curl로 실측 재현 확인, 대표님 승인 후
// 즉시 수정). GH Pages는 대표님이 아직 폐기 여부를 결정 전이라 남겨둔다.
const ALLOWED_STATIC_ORIGINS = new Set([
  "https://edutogether.github.io",
  "https://ai-ways-incheon.web.app",
  "https://ai-ways-incheon.firebaseapp.com",
]);

function isAllowedOrigin(origin) {
  return ALLOWED_STATIC_ORIGINS.has(origin) || ALLOWED_ORIGIN.test(origin);
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

module.exports = { ALLOWED_ORIGIN, cleanText, isAllowedOrigin, applyCors };
