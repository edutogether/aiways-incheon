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

  function showApp() {
    gate.classList.add("hidden");
    appRoot.classList.remove("hidden");
    // app.js measures tab heights at DOMContentLoaded, while #appRoot is
    // still display:none (pre-auth) -- re-measure now that it's real.
    requestAnimationFrame(() => window.AIWaysMobileApp?.syncTabHeights?.());
  }

  function renderLoading() {
    gateContent.replaceChildren();
    const box = el("div", "text-center py-10 space-y-3");
    box.append(el("p", "text-3xl", "♻️"), el("p", "text-sm font-semibold text-slate-500", "접속을 준비하고 있습니다."));
    gateContent.append(box);
  }

  function renderRetry(code) {
    gateContent.replaceChildren();
    const box = el("div", "text-center py-8 space-y-4");
    box.append(
      el("p", "text-3xl", "🔄"),
      el("p", "text-sm font-semibold text-slate-700", "접속 확인에 실패했습니다."),
      el("p", "text-xs text-slate-500", client().errorMessageFor(code))
    );
    const retryBtn = el("button", "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-2xl transition-all active:scale-[0.98]", "다시 시도");
    retryBtn.type = "button";
    retryBtn.addEventListener("click", restore);
    box.append(retryBtn);
    gateContent.append(box);
  }

  async function restore() {
    renderLoading();
    const result = await client().getSession();
    if (result.ok) { showApp(); return; }
    renderRetry(result.code);
  }

  window.addEventListener("DOMContentLoaded", restore, { once: true });
})();
