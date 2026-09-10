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

// 2026-09-11: Hosting 프리뷰 채널. **S5 전환본을 라이브와 같은 조건**(https·실제
// 백엔드·실제 자료·Hosting 헤더)에서 Bumm님이 확인하시려고 열었다 - 로컬 정적
// 서버로는 App Check가 통하지 않아 자료 없는 화면만 보이고, 그것을 "레이아웃이
// 틀어졌다"로 오독하는 일이 실제로 있었다(그날 원본·프리즈·전환본 셋이 다
// 비슷해 보였던 것은 셋 다 자료가 없는 같은 상태였기 때문이다).
//
// 🔴 **빼는 시점: S5 확인이 끝나고 채널이 만료되면 이 줄과 테스트를 같이 뺀다**
// (채널 `pc-s5-review`는 2026-09-18 만료).
//
// 🔴 좁게 잡는다. 채널 주소는 `ai-ways-incheon--<채널>-<해시>.web.app` 형태이고
// 이 형태는 **이 프로젝트에서만** 발급된다. `--`를 반드시 포함시키는 것이 핵심이라
// `evil--pc.web.app`처럼 프로젝트 이름이 다른 것은 걸리지 않는다. 끝을 `$`로 막아
// `...web.app.evil.com` 같은 접미사 공격도 막는다.
const PREVIEW_CHANNEL_ORIGIN = /^https:\/\/ai-ways-incheon--[a-z0-9-]+\.web\.app$/;

function isAllowedOrigin(origin) {
  return ALLOWED_STATIC_ORIGINS.has(origin) || ALLOWED_ORIGIN.test(origin) || PREVIEW_CHANNEL_ORIGIN.test(origin);
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
