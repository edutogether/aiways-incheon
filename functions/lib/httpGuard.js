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
// 2026-09-01 추가: 6개 앱 주소를 edutogether.kr/앱이름으로 통일하는 리버스
// 프록시가 Portal에 구축 중인데, 그 프록시는 정적 페이지만 다루고 Cloud
// Functions API 도메인은 프록시하지 않는다 - 즉 브라우저는 프록시된 페이지에서도
// API는 원래 Cloud Functions 주소로 직접 호출하고, 그때 Origin은
// https://edutogether.kr가 된다(Voice Cinema 프로젝트에서 먼저 발견된 동일
// 구조 - projects-42 전달). 페이지 코드 변경 없이 서버 허용목록에만 추가.
const ALLOWED_STATIC_ORIGINS = new Set([
  "https://edutogether.github.io",
  "https://ai-ways-incheon.firebaseapp.com",
  "https://edutogether.kr",
  // 2026-09-09: 이 앱의 정식 주소.
  // (처음엔 aiways.edutogether.kr로 잡았다가 가비아에서 incheon으로
  //  확정됐다 - aiways는 DNS에 존재하지 않으니 되살리지 말 것)
  "https://incheon.edutogether.kr",
  // 2026-09-09에 Bumm님 지시로 여기서 뺐다가, 2026-09-10에 **다시 넣었다.**
  //
  // 뺀 이유: 박람회 때 쓰던 사용자를 정리하고 4학교 클로즈베타로 다시
  // 시작하려고 - 옛 주소로 들어오면 화면은 떠도 기능은 안 되게.
  // 되돌린 이유: **가용성.** 9/10에 정식 주소에서 App Check 토큰을 못 받아
  // 아무 기능도 안 되는 일이 실제로 벌어졌는데, 그때 들어갈 다른 길이 하나도
  // 없었다. Bumm님 판단 - "현 주소가 안 되면 대비용으로 쓸 수 있어야 한다."
  //
  // 🔴 클로즈베타 사용자 정리는 이것과 무관하다. 그건 오리진이 아니라
  // 교사코드·가입 쪽에서 강제되므로, 오리진을 다시 열어도 느슨해지지 않는다.
  "https://ai-ways-incheon.web.app",
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
