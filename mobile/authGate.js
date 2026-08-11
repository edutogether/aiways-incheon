"use strict";
// Full-screen closed-beta gate for the mobile-only entry point. Reuses the
// existing production auth backend (edu2gBetaClient.js / firebaseBetaAuth.js /
// firebaseAppCheck.js) — same secret-code + 5-device system already live on PC —
// but blocks the whole page until a session is confirmed, instead of PC's
// optional header trigger.
(() => {
  const DEVICE_NAME_MAX = 12;
  const client = () => window.AIWaysEdu2gClient;
  const gate = document.getElementById("authGate");
  const gateContent = document.getElementById("authGateContent");
  const appRoot = document.getElementById("appRoot");
  if (!gate || !gateContent || !appRoot) return;

  const state = { pending: null, devices: [] };

  function truncateDeviceName(value) { return Array.from(value).slice(0, DEVICE_NAME_MAX).join(""); }
  function detectDeviceKind() {
    const ua = navigator.userAgent || "";
    const touch = (navigator.maxTouchPoints || 0) > 0;
    if (touch && (/ipad/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)))) return "tablet";
    if (touch && (/android|iphone|ipod|mobile/i.test(ua) || navigator.userAgentData?.mobile === true)) return "mobile";
    return "desktop";
  }
  function deviceNoun() {
    const kind = detectDeviceKind();
    const platform = client().getPlatformLabel();
    // Keep this short: once a name is prepended ("OOO이의 "), a verbose
    // platform-prefixed label (e.g. "Android 휴대폰") truncates mid-word
    // inside the 12-Korean-character limit.
    const byKind = { mobile: platform === "iOS" ? "아이폰" : "휴대폰", tablet: platform === "iOS" ? "아이패드" : "태블릿", desktop: "PC" };
    return byKind[kind] || "기기";
  }
  function defaultDeviceName() { return truncateDeviceName(deviceNoun()); }
  function hasBatchim(text) {
    const lastChar = text.trim().slice(-1);
    const code = lastChar.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return false;
    return (code - 0xac00) % 28 !== 0;
  }
  function personalizedDeviceName(displayName) {
    const name = (displayName || "").trim();
    if (!name) return defaultDeviceName();
    const possessive = hasBatchim(name) ? `${name}이의` : `${name}의`;
    return truncateDeviceName(`${possessive} ${deviceNoun()}`);
  }

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

  function renderLoading(message) {
    gateContent.replaceChildren();
    const box = el("div", "text-center py-10 space-y-3");
    box.append(el("p", "text-3xl", "🔒"), el("p", "text-sm font-semibold text-slate-500", message));
    gateContent.append(box);
  }

  function renderError(code) {
    const message = client().errorMessageFor(code);
    const node = el("p", "text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5", message);
    return node;
  }

  function renderLogin() {
    gateContent.replaceChildren();
    const wrap = el("div", "space-y-5");
    const header = el("div", "text-center space-y-1.5");
    header.append(
      el("p", "text-3xl", "🔒"),
      el("h2", "text-lg font-extrabold text-slate-900", "클로즈드 베타 접속"),
      el("p", "text-xs text-slate-500", "관리자가 안내한 시크릿 코드를 입력하세요.")
    );

    const form = document.createElement("form");
    form.className = "space-y-3.5";
    form.noValidate = true;

    const codeLabel = el("label", "block text-xs font-bold text-slate-700", "시크릿 코드");
    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.autocomplete = "one-time-code";
    codeInput.placeholder = "여러분만의 시크릿 코드를 입력하세요";
    codeInput.maxLength = 80;
    codeInput.className = "w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all";

    const nameLabel = el("label", "block text-xs font-bold text-slate-700 mt-1", "기기 이름");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = DEVICE_NAME_MAX;
    nameInput.autocomplete = "off";
    nameInput.value = defaultDeviceName();
    nameInput.className = "w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all";
    nameInput.addEventListener("focus", () => nameInput.select());

    const help = el("p", "text-[11px] text-slate-400", `누구 기기인지 알아보게 예: "민수 아이폰"처럼 직접 바꿔 주세요 (한글 ${DEVICE_NAME_MAX}자 이내) · 기기당 최대 5대까지 등록돼요`);

    const feedback = el("div", "space-y-2");

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "접속 확인";
    submit.className = "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3.5 rounded-2xl shadow-sm transition-all active:scale-[0.98]";

    form.append(codeLabel, codeInput, nameLabel, nameInput, help, feedback, submit);
    wrap.append(header, form);
    gateContent.append(wrap);
    codeInput.focus();

    form.addEventListener("submit", async event => {
      event.preventDefault();
      feedback.replaceChildren();
      const loginId = codeInput.value.normalize("NFKC").trim();
      const deviceLabel = nameInput.value.trim();
      if (!loginId) { feedback.append(renderError("login_not_approved")); codeInput.focus(); return; }
      if (!deviceLabel) { feedback.append(renderError("invalid_request")); nameInput.focus(); return; }
      state.pending = { loginId, deviceLabel, platform: client().getPlatformLabel() };
      submit.disabled = true;
      submit.textContent = "확인 중...";
      const result = await client().requestAccess(state.pending);
      submit.disabled = false;
      submit.textContent = "접속 확인";
      if (!result.ok) {
        if (result.code === "device_limit_reached" && Array.isArray(result.data?.devices)) {
          state.devices = result.data.devices;
          if (state.pending) state.pending.deviceLabel = personalizedDeviceName(result.data?.displayName);
          renderReplace();
          return;
        }
        feedback.replaceChildren(renderError(result.code));
        return;
      }
      if (result.data?.alreadyRegistered) { await restore(); return; }
      if (state.pending) state.pending.deviceLabel = personalizedDeviceName(result.data?.displayName);
      renderConfirm();
    });
  }

  function renderConfirm() {
    gateContent.replaceChildren();
    const wrap = el("div", "text-center space-y-4 py-4");
    wrap.append(
      el("p", "text-3xl", "📱"),
      el("h3", "text-base font-extrabold text-slate-900", "이 기기를 등록하시겠습니까?"),
      el("p", "text-xs text-slate-500", "등록하면 이 코드로 최대 5대의 기기를 안전하게 사용할 수 있습니다.")
    );
    const nameLabel = el("label", "block text-xs font-bold text-slate-700 text-left", "기기 이름");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = DEVICE_NAME_MAX;
    nameInput.autocomplete = "off";
    nameInput.value = state.pending?.deviceLabel || defaultDeviceName();
    nameInput.className = "w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all";
    nameInput.addEventListener("focus", () => nameInput.select());
    const nameField = el("div", "text-left space-y-1.5");
    nameField.append(nameLabel, nameInput);

    const feedback = el("div", "space-y-2");
    const actions = el("div", "flex gap-2.5 pt-2");
    const confirmBtn = el("button", "flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-2xl transition-all", "등록");
    const backBtn = el("button", "flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm py-3 rounded-2xl transition-all", "돌아가기");
    confirmBtn.addEventListener("click", () => {
      const label = nameInput.value.trim();
      if (!label) { feedback.replaceChildren(renderError("invalid_request")); nameInput.focus(); return; }
      if (state.pending) state.pending.deviceLabel = label;
      register("");
    });
    backBtn.addEventListener("click", renderLogin);
    actions.append(confirmBtn, backBtn);
    wrap.append(nameField, feedback, actions);
    gateContent.append(wrap);
  }

  async function register(replaceManagementId) {
    renderLoading(replaceManagementId ? "기기를 교체하고 있습니다." : "기기를 등록하고 있습니다.");
    const result = await client().confirmDeviceRegistration({ ...state.pending, replaceManagementId });
    if (!result.ok) {
      if (result.code === "device_limit_reached" && Array.isArray(result.data?.devices)) {
        state.devices = result.data.devices;
        renderReplace();
        return;
      }
      renderLogin();
      gateContent.append(renderError(result.code));
      return;
    }
    state.pending = null;
    showApp();
  }

  function renderReplace() {
    gateContent.replaceChildren();
    const wrap = el("div", "space-y-4");
    wrap.append(
      el("h3", "text-base font-extrabold text-slate-900 text-center", "등록 기기 5대 가득 참"),
      el("p", "text-xs text-slate-500 text-center", "새 기기를 등록하려면 해제할 기기 하나를 선택하세요.")
    );
    state.devices.forEach(device => {
      const row = el("div", "flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-3.5");
      const info = el("div", "");
      info.append(el("strong", "block text-sm font-bold text-slate-800", device.deviceLabel || "등록된 기기"), el("span", "text-[11px] text-slate-400", device.platform || "Other"));
      const btn = el("button", "bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shrink-0", "이 기기 교체");
      btn.addEventListener("click", () => register(device.managementId));
      row.append(info, btn);
      wrap.append(row);
    });
    const backBtn = el("button", "w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm py-3 rounded-2xl transition-all", "돌아가기");
    backBtn.addEventListener("click", renderLogin);
    wrap.append(backBtn);
    gateContent.append(wrap);
  }

  async function restore() {
    renderLoading("연결 정보를 확인하고 있습니다.");
    const result = await client().getSession();
    if (result.ok) { showApp(); return; }
    renderLogin();
  }

  window.addEventListener("DOMContentLoaded", restore, { once: true });
})();
