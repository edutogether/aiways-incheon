"use strict";

// 3단 기기 라우팅: 폰 폭이면 index.html 대신 mobile/ 앱을 iframe으로 띄우고,
// 그 폭을 벗어나면 다시 내려서 백그라운드에서 계속 도는 걸 막는다. 창을
// 늘렸다 줄였다 해도 즉시 반영되도록 resize마다 재평가한다(CSS는 순수 CSS
// 미디어쿼리로 이미 레이아웃을 처리하므로, 여기서는 iframe의 src만 관리).
(() => {
  const frame = document.getElementById("phoneShellFrame");
  if (!frame) return;

  const PHONE_MAX_WIDTH = 767; // 47.99rem 기준(16px * 47.99 ≈ 767.8)
  let currentTier = "";

  function tierFor(width) {
    if (width <= PHONE_MAX_WIDTH) return "phone";
    return "not-phone";
  }

  function applyTier() {
    const tier = tierFor(window.innerWidth);
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
})();
