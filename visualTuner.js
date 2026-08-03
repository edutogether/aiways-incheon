"use strict";
(() => {
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  if (!localHosts.has(location.hostname) || new URLSearchParams(location.search).get("visual-tuner") !== "1") return;
  const storageKey = "aiways.visualTuner.v1";
  const targets = { "dashboard hero": ".dashboard-scene .hero-copy", "dashboard grid": ".dashboard-grid", "school panel": ".school-panel", "landfill panel": ".landfill-panel", "class panel": ".class-panel", "project title": "#project .project-intro", "curriculum content": "#curriculum .curriculum-layout", "H-A-H content": "#hah .hah-grid", "flow content": "#flow .flow-grid", "gallery region": "#gallery .gallery-stage", "sorting input": "#sorting .tab-panel[data-panel='classify']", "sorting result": "#sorting [data-sorting-result]", "sorting checklist": "#sorting .judgement-checklist", "sorting action": "#sorting .quick-action-row", "resources region": "#resources .resource-grid", "EDU2G trigger": ".edu2g-beta-trigger" };
  const fields = [["inline-size", "width"], ["max-inline-size", "max-width"], ["min-block-size", "min-height"], ["gap", "gap"], ["padding", "padding"], ["font-size", "font-size"], ["line-height", "line-height"], ["opacity", "opacity"], ["border-radius", "radius"], ["filter", "blur"], ["translate", "x / y"], ["z-index", "z-index"]];
  let selected = "dashboard hero", values = {};
  try { values = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { values = {}; }
  const apply = () => { const node = document.querySelector(targets[selected]); document.querySelectorAll(".visual-tuner__target").forEach(item => item.classList.remove("visual-tuner__target")); node?.classList.add("visual-tuner__target"); Object.entries(values[selected] || {}).forEach(([name, value]) => node?.style.setProperty(name, value)); };
  const save = () => localStorage.setItem(storageKey, JSON.stringify(values));
  const root = document.createElement("aside"); root.className = "visual-tuner"; root.setAttribute("aria-label", "개발용 비주얼 튜너");
  const head = document.createElement("div"); head.className = "visual-tuner__head"; const title = document.createElement("strong"); title.textContent = "Visual tuner"; const badge = document.createElement("span"); badge.className = "visual-tuner__badge"; badge.textContent = "LOCAL ONLY"; head.append(title, badge);
  const select = document.createElement("select"); Object.keys(targets).forEach(name => { const option = document.createElement("option"); option.value = option.textContent = name; select.append(option); }); const breakpoint = document.createElement("select"); ["desktop", "tablet", "mobile"].forEach(name => { const option = document.createElement("option"); option.value = option.textContent = name; breakpoint.append(option); }); breakpoint.setAttribute("aria-label", "breakpoint");
  const form = document.createElement("div"); form.className = "visual-tuner__form";
  const render = () => { form.replaceChildren(); fields.forEach(([property, label]) => { const row = document.createElement("label"), name = document.createElement("span"), input = document.createElement("input"); name.textContent = label; input.value = values[selected]?.[property] || ""; input.placeholder = property; input.addEventListener("input", () => { values[selected] ||= {}; values[selected][property] = input.value; apply(); save(); }); row.append(name, input); form.append(row); }); };
  select.addEventListener("change", () => { selected = select.value; apply(); render(); });
  const actions = document.createElement("div"); actions.className = "visual-tuner__actions";
  const button = (text, action) => { const node = document.createElement("button"); node.type = "button"; node.textContent = text; node.addEventListener("click", action); return node; };
  actions.append(button("대상 초기화", () => { delete values[selected]; apply(); save(); render(); }), button("전체 초기화", () => { values = {}; document.querySelectorAll(".visual-tuner__target").forEach(node => { node.removeAttribute("style"); node.classList.remove("visual-tuner__target"); }); save(); render(); }), button("JSON 복사", async event => { try { await navigator.clipboard.writeText(JSON.stringify(values, null, 2)); event.currentTarget.textContent = "복사됨"; } catch { event.currentTarget.textContent = "복사 불가"; } }));
  root.append(head, select, breakpoint, form, actions); document.body.append(root); render(); apply();
})();
