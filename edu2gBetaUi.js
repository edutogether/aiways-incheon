"use strict";

(() => {
  const state = { opener: null, session: null, devices: [], mode: "booting" };
  const client = () => window.AIWaysEdu2gClient;
  const text = (node, value) => { node.textContent = value || ""; };
  const validLabel = value => /^[^\u0000-\u001f\u007f<>]{1,48}$/u.test(value);
  const statusCopy = key => ({ booting: "연결 확인 중", unregistered: "베타 연결", registered: "베타 연결됨", temporary_error: "연결 확인 필요", access_error: "연결 확인 필요" }[key] || "베타 연결");

  function setMode(mode) { state.mode = mode; }
  function build() {
    const header = document.querySelector(".site-header");
    if (!header) return null;
    const trigger = document.createElement("button");
    trigger.type = "button"; trigger.className = "edu2g-beta-trigger"; trigger.setAttribute("aria-haspopup", "dialog"); trigger.textContent = statusCopy("booting");
    const dialog = document.createElement("dialog");
    dialog.className = "edu2g-beta-dialog"; dialog.setAttribute("aria-labelledby", "edu2g-beta-title"); dialog.setAttribute("aria-modal", "true");
    const shell = document.createElement("section"); shell.className = "edu2g-beta-shell";
    const head = document.createElement("header"); head.className = "edu2g-beta-head";
    const headingCopy = document.createElement("div"); const kicker = document.createElement("p"); kicker.className = "edu2g-beta-kicker"; text(kicker, "EDU2G PASS");
    const title = document.createElement("h2"); title.id = "edu2g-beta-title"; text(title, "클로즈드 베타 연결"); headingCopy.append(kicker, title);
    const close = document.createElement("button"); close.className = "edu2g-beta-close"; close.type = "button"; close.setAttribute("aria-label", "닫기"); text(close, "×"); head.append(headingCopy, close);
    const live = document.createElement("p"); live.className = "edu2g-beta-live"; live.setAttribute("aria-live", "polite"); const content = document.createElement("div"); content.className = "edu2g-beta-content";
    shell.append(head, live, content); dialog.append(shell);
    header.append(trigger); document.body.append(dialog);
    trigger.addEventListener("click", () => { state.opener = trigger; dialog.showModal(); render(); requestAnimationFrame(() => dialog.querySelector("input, button")?.focus()); });
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => state.opener?.focus());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    return { trigger, dialog, live, content };
  }
  const ui = build();
  function announce(message) { if (ui) text(ui.live, message); }
  function setTrigger(kind) { if (ui) text(ui.trigger, statusCopy(kind)); }
  function button(label, action, kind = "secondary") { const node = document.createElement("button"); node.type = "button"; node.className = `edu2g-beta-button edu2g-beta-button-${kind}`; node.textContent = label; node.addEventListener("click", action); return node; }
  function showError(code) { const node = document.createElement("p"); node.className = "edu2g-beta-message"; node.setAttribute("role", "alert"); text(node, client().errorMessageFor(code)); return node; }
  function render() {
    if (!ui) return; const root = ui.content; root.replaceChildren();
    if (state.mode === "redeeming") return renderPass(root, true);
    if (["booting", "loading_devices", "revoking"].includes(state.mode)) { const loading = document.createElement("p"); loading.className = "edu2g-beta-loading"; loading.setAttribute("aria-busy", "true"); text(loading, "연결 정보를 확인하고 있습니다."); root.append(loading); return; }
    if (!state.session) return renderPass(root, false);
    renderSession(root);
  }
  function renderPass(root, loading) {
    const intro = document.createElement("p"); intro.className = "edu2g-beta-description"; text(intro, "받은 EDU2G PASS로 이 기기를 연결하세요.");
    const form = document.createElement("form"); form.className = "edu2g-beta-form"; form.noValidate = true;
    const passLabel = document.createElement("label"); passLabel.htmlFor = "edu2g-beta-pass"; text(passLabel, "EDU2G PASS"); const pass = document.createElement("input"); pass.id = "edu2g-beta-pass"; pass.type = "password"; pass.name = "edu2g-pass"; pass.autocomplete = "one-time-code"; pass.placeholder = "EDU2G PASS";
    const deviceNameLabel = document.createElement("label"); deviceNameLabel.htmlFor = "edu2g-beta-device-label"; text(deviceNameLabel, "기기 이름"); const label = document.createElement("input"); label.id = "edu2g-beta-device-label"; label.type = "text"; label.maxLength = 48; label.autocomplete = "off"; label.value = "현재 기기";
    const platform = document.createElement("p"); platform.className = "edu2g-beta-help"; text(platform, `현재 플랫폼: ${client().getPlatformLabel()}`); const help = document.createElement("p"); help.className = "edu2g-beta-help"; text(help, "기기 이름은 48자 이내로 입력하세요. 개인정보는 별도로 수집하지 않습니다.");
    const submit = document.createElement("button"); submit.type = "submit"; submit.className = "edu2g-beta-button edu2g-beta-button-primary"; submit.disabled = !!loading; submit.textContent = loading ? "연결 중" : "PASS로 연결"; form.setAttribute("aria-busy", String(!!loading));
    const feedback = document.createElement("div"); feedback.className = "edu2g-beta-feedback"; feedback.setAttribute("aria-live", "polite");
    form.append(passLabel, pass, deviceNameLabel, label, platform, help, submit, feedback); root.append(intro, form);
    form.addEventListener("submit", async event => {
      event.preventDefault(); if (state.mode === "redeeming") return;
      const value = pass.value; const deviceLabel = label.value.trim();
      feedback.replaceChildren();
      if (!value) { feedback.append(showError("invalid_pass")); pass.focus(); return; }
      if (!validLabel(deviceLabel)) { feedback.append(showError("invalid_request")); label.focus(); return; }
      setMode("redeeming"); render(); const result = await client().redeemPass({ pass: value, deviceLabel, platform: client().getPlatformLabel() }); pass.value = "";
      if (!result.ok) { setMode(["network_error", "request_timeout", "protection_unavailable", "app_check_unavailable"].includes(result.code) ? "temporary_error" : "access_error"); render(); const target = ui.content.querySelector(".edu2g-beta-feedback"); target?.append(showError(result.code)); if (result.code === "invalid_pass") ui.content.querySelector('input[name="edu2g-pass"]')?.focus(); return; }
      state.session = result.data; setMode("registered"); setTrigger("registered"); announce("기기가 연결되었습니다."); render();
    });
  }
  function renderSession(root) {
    const card = document.createElement("section"); card.className = "edu2g-beta-session";
    const name = document.createElement("strong"); text(name, state.session.displayName || "연결된 사용자");
    const detail = document.createElement("p"); text(detail, `${state.session.deviceLabel || "현재 기기"} · ${state.session.activeDeviceCount || 0}/${state.session.maxDevices || 0}대 연결됨`);
    const actions = document.createElement("div"); actions.className = "edu2g-beta-actions"; actions.append(button("신뢰 기기 관리", loadDevices, "primary")); card.append(name, detail, actions); root.append(card);
    if (state.devices.length) renderDevices(root);
  }
  async function loadDevices() {
    if (state.mode === "loading_devices" || state.mode === "revoking") return; setMode("loading_devices"); render(); const result = await client().listTrustedDevices();
    if (!result.ok || !Array.isArray(result.data?.devices) || !result.data.devices.length) { setMode("access_error"); render(); ui.content.append(showError(result.ok ? "invalid_response" : result.code)); return; }
    state.devices = result.data.devices; setMode("devices_ready"); announce("신뢰 기기 목록을 불러왔습니다."); render();
  }
  function renderDevices(root) {
    const section = document.createElement("section"); section.className = "edu2g-beta-devices"; const title = document.createElement("h3"); text(title, "신뢰 기기"); section.append(title);
    state.devices.forEach(device => {
      const row = document.createElement("article"); row.className = "edu2g-beta-device"; const label = document.createElement("strong"); text(label, device.deviceLabel || "등록된 기기"); const detail = document.createElement("p"); text(detail, `${device.platform || "Other"}${device.currentDevice ? " · 현재 기기" : ""} · ${device.status === "active" ? "연결됨" : "해제됨"}`); row.append(label, detail);
      if (device.status === "active") { const revoke = button(device.currentDevice ? "이 기기 해제" : "기기 해제", () => revokeDevice(device)); revoke.dataset.managementId = device.managementId || ""; row.append(revoke); } section.append(row);
    }); root.append(section);
  }
  async function revokeDevice(device) {
    if (state.mode === "revoking" || !device.managementId || !confirm(`“${device.deviceLabel || "이 기기"}” 연결을 해제할까요?`)) return;
    setMode("revoking"); render(); const result = await client().revokeTrustedDevice({ targetManagementId: device.managementId });
    if (!result.ok) { setMode("access_error"); render(); ui.content.append(showError(result.code)); return; }
    if (device.currentDevice) { await window.AIWaysBetaAuth?.clearEdu2gDeviceSession?.(); state.session = null; state.devices = []; setMode("revoked_current"); setTrigger("unregistered"); announce("현재 기기 연결을 해제했습니다."); render(); return; }
    setMode("registered"); await loadDevices();
  }
  async function restore() {
    if (!ui) return; setMode("booting"); setTrigger("booting"); const result = await client().getSession();
    if (result.ok) { state.session = result.data; setMode("registered"); setTrigger("registered"); return; }
    if (result.code === "device_revoked") { await window.AIWaysBetaAuth?.clearEdu2gDeviceSession?.(); state.session = null; setMode("access_error"); setTrigger("temporary_error"); return; }
    if (["device_not_registered", "auth_missing", "auth_invalid"].includes(result.code)) { state.session = null; setMode("unregistered"); setTrigger("unregistered"); return; }
    setMode("temporary_error"); setTrigger("temporary_error");
  }
  window.addEventListener("DOMContentLoaded", () => { void restore(); }, { once: true });
})();
