"use strict";

// 3단 기기 라우팅: 폰 폭이면 index.html 대신 mobile/ 앱을 iframe으로 띄우고,
// 그 폭을 벗어나면 다시 내려서 백그라운드에서 계속 도는 걸 막는다. 창을
// 늘렸다 줄였다 해도 즉시 반영되도록 resize마다 재평가한다(CSS는 순수 CSS
// 미디어쿼리로 이미 레이아웃을 처리하므로, 여기서는 iframe의 src만 관리).
// 🔴 이 파일도 실행되는 순간 DOM을 잡는다. 리액트 전환본에서는 그때 화면이
// 아직 없어 아래 `if (!frame) return`에 걸려 **조용히 아무것도 안 한다** — 그러면
// 폰으로 들어온 학생이 학생 앱으로 안 넘어가고 PC 대시보드를 받는다.
// 🔴 기준선으로는 이것을 못 잡는다. 재는 네 폭이 전부 짧은 변 600 이상이라
// 어느 폭에서도 이 코드가 화면을 바꾸지 않기 때문이다. 그래서 따로 검사한다.
(() => {
  function init() {
  const frame = document.getElementById("phoneShellFrame");
  if (!frame) return;

  // 2026-09-10(Bumm님 지시) - 학교에 보급되는 소형 태블릿이 600×960이라,
  // 폭 767 이하를 전부 "폰"으로 보면 **그 태블릿이 대시보드 대신 학생 앱을**
  // 받는다. 그렇다고 경계를 폭 599로만 내리면 이번엔 **폰을 가로로 눕혔을 때**
  // (예: 667×375) 폭이 667이라 대시보드가 떠버린다.
  //
  // 🔴 그래서 폭이 아니라 **짧은 변**으로 가른다. 기기를 어느 방향으로 놓든
  // 짧은 변은 그대로다 - 폰은 눕히든 세우든 430 안팎이고, 가장 작은 태블릿도
  // 600이다. 방향이 바뀌어도 판정이 흔들리지 않는 유일한 기준이다.
  const PHONE_MAX_SHORT_SIDE = 599;
  let currentTier = "";

  function tierFor(shortSide) {
    if (shortSide <= PHONE_MAX_SHORT_SIDE) return "phone";
    return "not-phone";
  }

  function applyTier() {
    const tier = tierFor(Math.min(window.innerWidth, window.innerHeight));
    if (tier === currentTier) return;
    currentTier = tier;
    // 2026-08-27: 실사용 교사 제보(학교 PC에서 모바일 화면이 풀스크린으로
    // 뜸) - 원인은 여기(px 판정)와 CSS의 폰-풀스크린 규칙(rem 판정,
    // styles/cb3a.css)이 서로 독립적으로 폭을 재고 있었던 것. 브라우저
    // 기본 글꼴크기가 16px가 아니면(접근성 설정 등) 두 판정이 어긋난다.
    // 이제 판정은 여기 한 곳에서만 하고, 결과를 <html data-tier>로
    // 남겨서 CSS는 더 이상 독자적으로 폭을 재지 않고 이 값만 그대로
    // 따르게 한다.
    if (tier === "phone") document.documentElement.setAttribute("data-tier", "phone");
    else document.documentElement.removeAttribute("data-tier");
    if (tier === "phone") {
      if (!frame.src) frame.src = "./mobile/index.html";
    } else if (frame.src) {
      frame.removeAttribute("src");
    }
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyTier, 120);
  });

  applyTier();
  }

  window.AIWaysDeviceTier = { init };
  if (!window.__AIWAYS_PC_REACT_BOOT) init();
})();
