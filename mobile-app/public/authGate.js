"use strict";
// Public entry point for the mobile app: no secret code, no device-limit
// screen -- anyone opening the link or scanning the QR code gets in. Under
// the hood this still uses the production auth backend (edu2gBetaClient.js
// / firebaseBetaAuth.js / firebaseAppCheck.js): the browser signs in
// anonymously and passes an App Check token, and the backend auto-provisions
// a fresh single-device "actor" for that anonymous session on first contact
// instead of requiring a pre-shared code. That keeps bot/abuse protection
// (App Check + per-visitor + global rate limits) in place while dropping
// the manual code-entry step.
(() => {
  const client = () => window.AIWaysEdu2gClient;
  const gate = document.getElementById("authGate");
  const gateContent = document.getElementById("authGateContent");
  const appRoot = document.getElementById("appRoot");
  if (!gate || !gateContent || !appRoot) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // 🔴 2026-09-10 이후로 이 게이트는 **아무것도 가리지 않는다.** 앱을 바로
  // 보여주고, 탐침이 실패했을 때만 화면 위에 띠로 남는다(아래 renderBanner).
  // 그래서 예전의 전체화면 로딩·재시도 화면(renderLoading/renderRetry)과 그
  // 부속(splashMarkup/appendBrandHeader)은 쓰이지 않게 되어 지웠다. HTML 안의
  // 스플래시 마크업은 그대로 두는데, 그것이 **스타일시트가 오기 전 첫 프레임**을
  // 채우는 역할을 계속하기 때문이다(index.html 주석 참고).
  function showApp() {
    appRoot.classList.remove("hidden");
    // app.js measures tab heights at DOMContentLoaded, while #appRoot is
    // still display:none (pre-auth) -- re-measure now that it's real.
    requestAnimationFrame(() => window.AIWaysMobileApp?.syncTabHeights?.());
    // Fade the splash out over the app rather than cutting to it. The gate
    // carries inline styles so it can paint before the stylesheets arrive,
    // and an inline display beats the .hidden class - hence hiding it inline
    // too once the fade has finished.
    gate.style.opacity = "0";
    gate.style.pointerEvents = "none";
    window.setTimeout(() => {
      gate.classList.add("hidden");
      gate.style.display = "none";
    }, 420);
  }

  // 실패했을 때 화면 위에 계속 남는 띠. 사라지는 알림(토스트)으로 하지 않는
  // 이유: 학생이 못 보고 지나치면 **저장이 안 되는 상태인 줄 모른 채** 사진을
  // 찍는다. 이 앱은 App Check가 한 번 거부되면 그 기기가 24시간 계속 실패하는
  // 성질이 있어, 그 상태가 오래 간다.
  //
  // 🔴 `#authGate`를 그대로 재활용해 띠로 바꾼다. 새 요소를 만들지 않는 이유는
  // 화면 기준선이 `#authGate` 안쪽을 일부러 제외하고 재기 때문이다 - 밖에 새
  // 요소를 만들면 스냅샷 24장이 전부 흔들린다.
  function renderBanner(code) {
    gate.style.position = "sticky";
    gate.style.inset = "auto";
    gate.style.top = "0";
    gate.style.display = "block";
    gate.style.padding = "0";
    gate.style.background = "transparent";
    gate.style.opacity = "1";
    gate.style.pointerEvents = "auto";
    gate.classList.remove("hidden");

    gateContent.removeAttribute("style");
    gateContent.className = "";
    gateContent.replaceChildren();
    const strip = el("div");
    strip.setAttribute("role", "status");
    strip.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fffbeb;border-bottom:1px solid #fde68a;color:#92400e;font-size:12px;font-weight:600";
    strip.append(el("span", "", "⚠️"));
    const words = el("div");
    words.style.cssText = "flex:1;min-width:0;line-height:1.35";
    words.append(el("div", "", "지금은 저장·분석이 안 됩니다."));
    const advice = window.AIWaysAppCheck?.lastFailureAdvice?.() || client().errorMessageFor(code);
    if (advice) {
      const small = el("div", "", advice);
      small.style.cssText = "font-weight:500;font-size:11px;color:#b45309;margin-top:2px";
      words.append(small);
    }
    strip.append(words);
    const again = el("button", "", "다시 시도");
    again.type = "button";
    again.style.cssText = "flex:0 0 auto;background:#b45309;color:#fff;border:0;border-radius:10px;padding:7px 12px;font-size:11px;font-weight:700";
    again.addEventListener("click", () => { hideBanner(); probe(); });
    strip.append(again);
    gateContent.append(strip);

    const detail = window.AIWaysAppCheck?.lastFailureSummary?.();
    if (detail) console.warn("[AIWaysAppCheck] 토큰 발급 실패:", detail);
  }

  function hideBanner() {
    gate.style.display = "none";
    gate.classList.add("hidden");
  }

  // 2026-09-02: getEdu2gSession(클로즈베타 시스템, 폐기)을 "인증됐는지만
  // 확인하는 용도"로 재사용하고 있었다 - checkStudentProfile도 인증만
  // 되면 200을 주고(가입 여부와 무관), 코드 삭제 없이 그대로 쓸 수 있는
  // 다른 protected 엔드포인트라 그대로 대체한다.
  //
  // 🔴 2026-09-10: 이 호출을 **기다리지 않는다.**
  //
  // 예전에는 이 왕복이 끝날 때까지 앱을 통째로 가려 뒀다. 그런데 실측해 보니
  // **앱은 2초에 이미 다 그려져 있었고**(요소 368개) `display:none`으로 가려져만
  // 있었다. 기다리던 5.5초는 Firebase SDK 285KB와 reCAPTCHA 2.5MB를 내려받아
  // 초기화하는 시간이고, 학생이 화면을 보는 데는 그것이 필요 없다 - 토큰이
  // 필요한 것은 **저장·분석·업로드**다.
  //
  // 그래서 화면은 바로 보여주고, 이 탐침은 뒤에서 돌린다. 실패하면 **같은
  // 시각에** 띠로 알린다(정보량은 그대로, 대기만 없앤다). 저장·분석을 실제로
  // 누르면 그 자리에서 또 막히고 이유가 나온다 - 그 경로는 원래부터 있었다.
  async function probe() {
    const result = await client().checkStudentProfile();
    if (result.ok) { hideBanner(); return; }
    renderBanner(result.code);
  }

  window.addEventListener("DOMContentLoaded", () => {
    showApp();
    void probe();
  }, { once: true });
})();
