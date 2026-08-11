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

  // Same brand header shown once inside #appRoot (badge + title + subtitle),
  // reused here so the pre-auth screen doesn't look like a bare loading spinner.
  function appendBrandHeader(container) {
    const header = el("div", "text-center mb-7 space-y-3");
    const badge = el("div", "inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3.5 py-1 rounded-full text-[11px] font-bold shadow-sm border border-blue-100");
    badge.append(el("span", "inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping"), document.createTextNode("AI Ways Incheon - 버리는 순간을 바꾸다."));
    const title = el("h1", "text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 flex justify-center items-center gap-2");
    title.append(document.createTextNode("♻️ "), el("span", "text-blue-600", "3초 판단"), document.createTextNode(" 도우미"));
    const subtitle = el("p", "text-xs sm:text-sm text-slate-500 font-medium", "AI와 데이터로 실천하는 학교 자원순환 UX 개선 프로젝트");
    header.append(badge, title, subtitle);
    container.append(header);
  }

  function renderLoading() {
    gateContent.replaceChildren();
    appendBrandHeader(gateContent);
    const box = el("div", "flex items-center justify-center gap-2.5 pb-3");
    box.append(el("span", "inline-block w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"), el("span", "text-sm font-semibold text-slate-500", "접속을 준비하고 있습니다."));
    gateContent.append(box);
  }

  function renderRetry(code) {
    gateContent.replaceChildren();
    appendBrandHeader(gateContent);
    const box = el("div", "text-center space-y-4 pt-1");
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
