"use strict";

(() => {
  const state = { opener: null, session: null, devices: [], pending: null, mode: "booting" };
  const client = () => window.AIWaysEdu2gClient;
  const text = (node, value) => { node.textContent = value || ""; };
  const validLabel = value => /^[^\u0000-\u001f\u007f<>]{1,48}$/u.test(value);
  const validLoginId = value => value.normalize("NFKC").trim().replace(/\s+/gu, " ").length > 0;
  const statusCopy = key => ({ booting: "연결 확인 중", unregistered: "클베 접속", registered: "클베 연결됨", temporary_error: "연결 확인 필요", access_error: "연결 확인 필요" }[key] || "클베 접속");
  function setMode(mode) { state.mode = mode; }
  const DEVICE_NAME_MAX = 12;
  const truncateDeviceName = value => Array.from(value).slice(0, DEVICE_NAME_MAX).join("");
  function detectDeviceKind() {
    const ua = navigator.userAgent || "";
    if (/ipad/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
    if (/android|iphone|ipod|mobile/i.test(ua) || navigator.userAgentData?.mobile === true) return "mobile";
    return "desktop";
  }
  function defaultDeviceName() {
    const kind = detectDeviceKind();
    const platform = client().getPlatformLabel();
    const byKind = { mobile: platform === "iOS" ? "iPhone" : `${platform} 휴대폰`, tablet: platform === "iOS" ? "iPad" : `${platform} 태블릿`, desktop: `${platform} PC` };
    return truncateDeviceName(byKind[kind] || "현재 기기");
  }
  const SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) { const node = document.createElementNS(SVG_NS, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); return node; }
  const DEVICE_KIND_SHAPES = {
    mobile: [["rect", { x: 7, y: 2, width: 10, height: 20, rx: 2 }], ["line", { x1: 11, y1: 18, x2: 13, y2: 18 }]],
    tablet: [["rect", { x: 3, y: 4, width: 18, height: 16, rx: 2 }], ["line", { x1: 11, y1: 17, x2: 13, y2: 17 }]],
    desktop: [["rect", { x: 3, y: 4, width: 18, height: 13, rx: 1.5 }], ["line", { x1: 8, y1: 20, x2: 16, y2: 20 }], ["line", { x1: 12, y1: 17, x2: 12, y2: 20 }]],
  };
  function deviceKindIcon(kind) {
    const svg = svgEl("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", "stroke-width": "1.8" });
    (DEVICE_KIND_SHAPES[kind] || DEVICE_KIND_SHAPES.desktop).forEach(([tag, attrs]) => svg.append(svgEl(tag, attrs)));
    return svg;
  }
  function build() {
    const header = document.querySelector(".site-header"); if (!header) return null;
    const trigger = document.createElement("button"); trigger.type = "button"; trigger.className = "edu2g-beta-trigger"; trigger.setAttribute("aria-haspopup", "dialog"); trigger.textContent = statusCopy("booting");
    const dialog = document.createElement("dialog"); dialog.className = "edu2g-beta-dialog"; dialog.setAttribute("aria-labelledby", "edu2g-beta-title"); dialog.setAttribute("aria-modal", "true");
    const shell = document.createElement("section"); shell.className = "edu2g-beta-shell"; const head = document.createElement("header"); head.className = "edu2g-beta-head";
    const heading = document.createElement("div"), kicker = document.createElement("p"), title = document.createElement("h2"); kicker.className = "edu2g-beta-kicker"; text(kicker, "CLOSED BETA"); title.id = "edu2g-beta-title"; text(title, "클로즈드 베타 접속"); heading.append(kicker, title);
    const close = document.createElement("button"); close.className = "edu2g-beta-close"; close.type = "button"; close.setAttribute("aria-label", "닫기"); text(close, "×"); head.append(heading, close);
    const live = document.createElement("p"); live.className = "edu2g-beta-live"; live.setAttribute("aria-live", "polite"); const content = document.createElement("div"); content.className = "edu2g-beta-content"; shell.append(head, live, content); dialog.append(shell); header.append(trigger); document.body.append(dialog);
    trigger.addEventListener("click", () => { state.opener = trigger; dialog.showModal(); render(); requestAnimationFrame(() => dialog.querySelector("input, button")?.focus()); }); close.addEventListener("click", () => dialog.close()); dialog.addEventListener("close", () => state.opener?.focus()); dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }); return { trigger, dialog, live, content };
  }
  const ui = build();
  function announce(message) { if (ui) text(ui.live, message); }
  function setTrigger(kind) { if (ui) text(ui.trigger, statusCopy(kind)); }
  function button(label, action, kind = "secondary") { const node = document.createElement("button"); node.type = "button"; node.className = `edu2g-beta-button edu2g-beta-button-${kind}`; text(node, label); node.addEventListener("click", action); return node; }
  function showError(code) { const node = document.createElement("p"); node.className = "edu2g-beta-message"; node.setAttribute("role", "alert"); text(node, client().errorMessageFor(code)); return node; }
  function render() {
    if (!ui) return; const root = ui.content; root.replaceChildren();
    if (["booting", "loading_devices", "requesting", "registering", "replacing", "revoking"].includes(state.mode)) { const loading = document.createElement("p"); loading.className = "edu2g-beta-loading"; loading.setAttribute("aria-busy", "true"); text(loading, "연결 정보를 확인하고 있습니다."); root.append(loading); return; }
    if (state.mode === "confirm_device") return renderConfirmation(root);
    if (state.mode === "replace_device") return renderReplacement(root);
    if (!state.session) return renderLogin(root);
    renderSession(root);
  }
  function renderLogin(root) {
    const intro = document.createElement("p"); intro.className = "edu2g-beta-description"; text(intro, "관리자가 안내한 시크릿 코드를 입력하세요.");
    const form = document.createElement("form"); form.className = "edu2g-beta-form"; form.noValidate = true;
    const loginLabel = document.createElement("label"), login = document.createElement("input"); loginLabel.htmlFor = "edu2g-beta-login"; text(loginLabel, "시크릿 코드"); login.id = "edu2g-beta-login"; login.name = "edu2g-login"; login.type = "text"; login.autocomplete = "username"; login.placeholder = "당신의 시크릿 코드를 입력하세요"; login.maxLength = 80;
    const deviceNameLabel = document.createElement("label"), deviceNameRow = document.createElement("div"), deviceIcon = document.createElement("span"), label = document.createElement("input");
    deviceNameLabel.htmlFor = "edu2g-beta-device-label"; text(deviceNameLabel, "기기 이름");
    deviceNameRow.className = "edu2g-beta-device-name-row";
    deviceIcon.className = "edu2g-beta-device-icon"; deviceIcon.setAttribute("aria-hidden", "true"); deviceIcon.append(deviceKindIcon(detectDeviceKind()));
    label.id = "edu2g-beta-device-label"; label.type = "text"; label.maxLength = DEVICE_NAME_MAX; label.autocomplete = "off"; label.value = defaultDeviceName();
    deviceNameRow.append(deviceIcon, label);
    const help = document.createElement("p"); help.className = "edu2g-beta-help"; text(help, `기기 이름은 한글 ${DEVICE_NAME_MAX}자 이내로 직접 바꿀 수 있어요`); const submit = button("접속 확인", () => form.requestSubmit(), "primary"); submit.type = "submit"; const feedback = document.createElement("div"); feedback.className = "edu2g-beta-feedback"; feedback.setAttribute("aria-live", "polite"); form.append(loginLabel, login, deviceNameLabel, deviceNameRow, help, submit, feedback); root.append(intro, form);
    form.addEventListener("submit", async event => { event.preventDefault(); const loginId = login.value, deviceLabel = label.value.trim(); feedback.replaceChildren(); if (!validLoginId(loginId)) { feedback.append(showError("login_not_approved")); login.focus(); return; } if (!validLabel(deviceLabel)) { feedback.append(showError("invalid_request")); label.focus(); return; } state.pending = { loginId, deviceLabel, platform: client().getPlatformLabel() }; setMode("requesting"); render(); const result = await client().requestAccess(state.pending); if (!result.ok) { if (result.code === "device_limit_reached" && Array.isArray(result.data?.devices)) { state.devices = result.data.devices; setMode("replace_device"); render(); return; } setMode("access_error"); render(); ui.content.append(showError(result.code)); return; } if (result.data?.alreadyRegistered) { await restore(); render(); return; } setMode("confirm_device"); render(); });
  }
  async function register(replaceManagementId = "") { setMode(replaceManagementId ? "replacing" : "registering"); render(); const result = await client().confirmDeviceRegistration({ ...state.pending, replaceManagementId }); if (!result.ok) { if (result.code === "device_limit_reached" && Array.isArray(result.data?.devices)) { state.devices = result.data.devices; setMode("replace_device"); render(); return; } setMode("access_error"); render(); ui.content.append(showError(result.code)); return; } state.session = result.data; state.pending = null; setMode("registered"); setTrigger("registered"); announce("이 기기가 등록되어 앱에 연결되었습니다."); render(); }
  function renderConfirmation(root) { const card = document.createElement("section"); card.className = "edu2g-beta-confirm"; const title = document.createElement("h3"), detail = document.createElement("p"), actions = document.createElement("div"); text(title, "이 기기를 등록하시겠습니까?"); text(detail, "등록하면 이 아이디로 최대 5대의 기기를 안전하게 사용할 수 있습니다."); actions.className = "edu2g-beta-actions"; actions.append(button("등록", () => register(""), "primary"), button("돌아가기", () => { setMode("unregistered"); render(); })); card.append(title, detail, actions); root.append(card); }
  function renderReplacement(root) { const section = document.createElement("section"); section.className = "edu2g-beta-devices"; const title = document.createElement("h3"), intro = document.createElement("p"); text(title, "등록 기기 5대"); text(intro, "새 기기를 등록하려면 해제할 기기 하나를 선택하세요."); section.append(title, intro); state.devices.forEach(device => { const row = document.createElement("article"); row.className = "edu2g-beta-device"; const label = document.createElement("strong"), detail = document.createElement("p"); text(label, device.deviceLabel || "등록된 기기"); text(detail, device.platform || "Other"); row.append(label, detail, button("이 기기 교체", () => register(device.managementId), "primary")); section.append(row); }); root.append(section, button("돌아가기", () => { setMode("unregistered"); render(); })); }
  function renderSession(root) { const card = document.createElement("section"); card.className = "edu2g-beta-session"; const name = document.createElement("strong"), detail = document.createElement("p"), actions = document.createElement("div"); text(name, state.session.displayName || "연결된 사용자"); text(detail, `${state.session.deviceLabel || "현재 기기"} · ${state.session.activeDeviceCount || 0}/${state.session.maxDevices || 0}대 등록됨`); actions.className = "edu2g-beta-actions"; actions.append(button("신뢰 기기 관리", loadDevices, "primary")); card.append(name, detail, actions); root.append(card); if (state.devices.length) renderDevices(root); }
  async function loadDevices() { if (state.mode === "loading_devices" || state.mode === "revoking") return; setMode("loading_devices"); render(); const result = await client().listTrustedDevices(); if (!result.ok || !Array.isArray(result.data?.devices)) { setMode("access_error"); render(); ui.content.append(showError(result.ok ? "invalid_response" : result.code)); return; } state.devices = result.data.devices; setMode("registered"); announce("신뢰 기기 목록을 불러왔습니다."); render(); }
  function renderDevices(root) { const section = document.createElement("section"); section.className = "edu2g-beta-devices"; const title = document.createElement("h3"); text(title, "신뢰 기기"); section.append(title); state.devices.forEach(device => { const row = document.createElement("article"); row.className = "edu2g-beta-device"; const label = document.createElement("strong"), detail = document.createElement("p"); text(label, device.deviceLabel || "등록된 기기"); text(detail, `${device.platform || "Other"}${device.currentDevice ? " · 현재 기기" : ""} · ${device.status === "active" ? "연결됨" : "해제됨"}`); row.append(label, detail); if (device.status === "active") { const revoke = button(device.currentDevice ? "이 기기 해제" : "기기 해제", () => revokeDevice(device)); revoke.dataset.managementId = device.managementId || ""; row.append(revoke); } section.append(row); }); root.append(section); }
  async function revokeDevice(device) { if (state.mode === "revoking" || !device.managementId || !confirm(`“${device.deviceLabel || "이 기기"}” 연결을 해제할까요?`)) return; setMode("revoking"); render(); const result = await client().revokeTrustedDevice({ targetManagementId: device.managementId }); if (!result.ok) { setMode("access_error"); render(); ui.content.append(showError(result.code)); return; } if (device.currentDevice) { await window.AIWaysBetaAuth?.clearEdu2gDeviceSession?.(); state.session = null; state.devices = []; setMode("unregistered"); setTrigger("unregistered"); announce("현재 기기 연결을 해제했습니다."); render(); return; } setMode("registered"); await loadDevices(); }
  async function restore() { if (!ui) return; setMode("booting"); setTrigger("booting"); const result = await client().getSession(); if (result.ok) { state.session = result.data; setMode("registered"); setTrigger("registered"); return; } if (result.code === "device_revoked") { await window.AIWaysBetaAuth?.clearEdu2gDeviceSession?.(); state.session = null; setMode("access_error"); setTrigger("temporary_error"); return; } if (["device_not_registered", "auth_missing", "auth_invalid"].includes(result.code)) { state.session = null; setMode("unregistered"); setTrigger("unregistered"); return; } setMode("temporary_error"); setTrigger("temporary_error"); }
  async function autoOpenOnMobileIfUnregistered() {
    if (!ui) return;
    const isMobile = window.matchMedia("(max-width: 63.99rem)").matches;
    if (!isMobile || state.mode !== "unregistered") return;
    state.opener = ui.trigger;
    ui.dialog.showModal();
    render();
    requestAnimationFrame(() => ui.dialog.querySelector("input, button")?.focus());
  }
  window.addEventListener("DOMContentLoaded", async () => { await restore(); await autoOpenOnMobileIfUnregistered(); }, { once: true });
})();
