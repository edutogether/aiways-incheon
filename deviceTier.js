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
