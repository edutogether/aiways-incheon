(() => {
  "use strict";

  const STYLE = `
    #vt-toggle {
      position: fixed; z-index: 99999; right: 16px; bottom: 16px;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: 999px; border: 1px solid rgba(94,247,205,.4);
      background: #06111c; color: #5ef7cd; font: 700 14px/1 system-ui, sans-serif;
      cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.4);
    }
    #vt-toggle.is-on { background: #5ef7cd; color: #06111c; }
    #vt-hover-outline {
      position: fixed; z-index: 99997; pointer-events: none;
      border: 2px dashed #64eaff; border-radius: 4px; display: none;
      box-sizing: border-box;
    }
    #vt-select-outline {
      position: fixed; z-index: 99998; pointer-events: none;
      border: 2px solid #5ef7cd; border-radius: 4px; display: none;
      box-sizing: border-box; box-shadow: 0 0 0 2000px rgba(0,0,0,.15);
    }
    #vt-panel {
      position: fixed; z-index: 99999; right: 16px; top: 16px; bottom: 72px;
      width: 300px; overflow-y: auto;
      background: #0b1626; color: #eef7ff; border: 1px solid rgba(94,247,205,.3);
      border-radius: 16px; padding: 16px; font: 500 13px/1.5 system-ui, sans-serif;
      box-shadow: 0 12px 40px rgba(0,0,0,.5); display: none;
    }
    #vt-panel.is-open { display: block; }
    #vt-panel h3 { margin: 0 0 4px; font-size: 13px; color: #5ef7cd; }
    #vt-panel .vt-target-label { font-size: 12px; color: #9eb3c7; word-break: break-all; margin-bottom: 12px; }
    #vt-panel label { display: block; margin-top: 12px; font-size: 12px; color: #bcd2e0; }
    #vt-panel .vt-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    #vt-panel input[type="range"] { flex: 1 1 auto; }
    #vt-panel input[type="number"] { width: 56px; background: #06111c; color: #eef7ff; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; padding: 3px 5px; font-size: 12px; }
    #vt-panel .vt-value { width: 48px; text-align: right; font-variant-numeric: tabular-nums; color: #9eb3c7; font-size: 11px; }
    #vt-panel button {
      cursor: pointer; border: 1px solid rgba(255,255,255,.18); border-radius: 8px;
      background: rgba(255,255,255,.06); color: #eef7ff; padding: 7px 10px; font: 700 12px/1 system-ui, sans-serif;
    }
    #vt-panel button.vt-danger { border-color: rgba(255,107,107,.4); color: #ff9d9d; }
    #vt-panel button.vt-primary { background: #5ef7cd; color: #06111c; border-color: #5ef7cd; }
    #vt-panel .vt-btn-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    #vt-panel .vt-section-sep { border: none; border-top: 1px solid rgba(255,255,255,.1); margin: 16px 0; }
    #vt-log-list { list-style: none; margin: 8px 0 0; padding: 0; max-height: 140px; overflow-y: auto; }
    #vt-log-list li { display: flex; justify-content: space-between; gap: 6px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,.06); font-size: 11px; color: #9eb3c7; }
    #vt-log-list li button { padding: 2px 6px; font-size: 10px; }
    #vt-export {
      position: fixed; z-index: 100000; inset: 8% 10%; background: #0b1626; color: #eef7ff;
      border: 1px solid rgba(94,247,205,.4); border-radius: 16px; padding: 20px; display: none;
      box-shadow: 0 20px 60px rgba(0,0,0,.6);
    }
    #vt-export.is-open { display: flex; flex-direction: column; }
    #vt-export textarea {
      flex: 1 1 auto; margin-top: 12px; background: #06111c; color: #b8ffef;
      border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 12px;
      font: 12px/1.5 ui-monospace, monospace; resize: none;
    }
    [data-vt-editable="true"] { outline: 2px solid #ad8cff !important; outline-offset: 2px; }
    [data-vt-deleted="true"] { display: none !important; }
  `;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    (children || []).forEach(c => node.appendChild(c));
    return node;
  }

  function describeSelector(node) {
    if (!node || node === document.body) return "body";
    const cls = (node.className && typeof node.className === "string")
      ? "." + node.className.trim().split(/\s+/).join(".")
      : "";
    return node.tagName.toLowerCase() + cls;
  }

  const state = {
    active: false,
    selected: null,
    changes: new Map() // element -> { selector, notes: [] }
  };

  function recordChange(node, note) {
    if (!state.changes.has(node)) {
      state.changes.set(node, { selector: describeSelector(node), notes: [] });
    }
    state.changes.get(node).notes.push(note);
    renderLog();
  }

  function ensureOriginal(node) {
    if (!node.dataset.vtOriginalStyle) {
      node.dataset.vtOriginalStyle = node.getAttribute("style") || "";
    }
  }

  function resetNode(node) {
    if (!node) return;
    if (node.dataset.vtOriginalStyle !== undefined) {
      if (node.dataset.vtOriginalStyle) node.setAttribute("style", node.dataset.vtOriginalStyle);
      else node.removeAttribute("style");
      delete node.dataset.vtOriginalStyle;
    }
    delete node.dataset.vtDeleted;
    node.removeAttribute("contenteditable");
    node.removeAttribute("data-vt-editable");
    state.changes.delete(node);
    renderLog();
  }

  // ---- DOM scaffolding ----
  const styleTag = el("style", { textContent: STYLE });
  document.head.appendChild(styleTag);

  const toggleBtn = el("button", { id: "vt-toggle", textContent: "🛠 조정모드 켜기" });
  const hoverOutline = el("div", { id: "vt-hover-outline" });
  const selectOutline = el("div", { id: "vt-select-outline" });
  document.body.appendChild(toggleBtn);
  document.body.appendChild(hoverOutline);
  document.body.appendChild(selectOutline);

  const targetLabel = el("div", { className: "vt-target-label", textContent: "요소를 클릭해서 선택하세요" });

  function makeSlider(labelText, min, max, step, unit, onInput) {
    const value = el("span", { className: "vt-value" });
    const input = el("input", { type: "range", min: String(min), max: String(max), step: String(step) });
    input.addEventListener("input", () => {
      value.textContent = input.value + unit;
      onInput(Number(input.value));
    });
    const wrap = el("div", {}, [
      el("label", { textContent: labelText }),
      el("div", { className: "vt-row" }, [input, value])
    ]);
    return { wrap, input, value };
  }

  const fontSizeCtl = makeSlider("글자 크기", 8, 160, 1, "px", v => {
    if (!state.selected) return;
    ensureOriginal(state.selected);
    state.selected.style.fontSize = v + "px";
    recordChange(state.selected, `font-size: ${v}px`);
  });
  const paddingCtl = makeSlider("안쪽 여백 (padding)", 0, 120, 1, "px", v => {
    if (!state.selected) return;
    ensureOriginal(state.selected);
    state.selected.style.padding = v + "px";
    recordChange(state.selected, `padding: ${v}px`);
  });
  const gapCtl = makeSlider("요소 사이 간격 (gap)", 0, 80, 1, "px", v => {
    if (!state.selected) return;
    ensureOriginal(state.selected);
    state.selected.style.gap = v + "px";
    recordChange(state.selected, `gap: ${v}px`);
  });
  const widthCtl = makeSlider("가로 크기 (width)", 20, 1400, 2, "px", v => {
    if (!state.selected) return;
    ensureOriginal(state.selected);
    state.selected.style.width = v + "px";
    recordChange(state.selected, `width: ${v}px`);
  });

  const posX = el("input", { type: "number", value: "0" });
  const posY = el("input", { type: "number", value: "0" });
  function applyPosition() {
    if (!state.selected) return;
    ensureOriginal(state.selected);
    const x = Number(posX.value) || 0;
    const y = Number(posY.value) || 0;
    state.selected.style.transform = `translate(${x}px, ${y}px)`;
    recordChange(state.selected, `position: translate(${x}px, ${y}px)`);
    refreshOutline();
  }
  posX.addEventListener("input", applyPosition);
  posY.addEventListener("input", applyPosition);
  const posRow = el("div", {}, [
    el("label", { textContent: "위치 이동 (드래그하거나 숫자 입력, px)" }),
    el("div", { className: "vt-row" }, [
      el("span", { textContent: "X" }), posX,
      el("span", { textContent: "Y" }), posY
    ])
  ]);

  const editTextBtn = el("button", { textContent: "✏️ 텍스트 편집" });
  editTextBtn.addEventListener("click", () => {
    if (!state.selected) return;
    const on = state.selected.getAttribute("contenteditable") === "true";
    if (on) {
      state.selected.removeAttribute("contenteditable");
      state.selected.removeAttribute("data-vt-editable");
      editTextBtn.textContent = "✏️ 텍스트 편집";
    } else {
      state.selected.setAttribute("contenteditable", "true");
      state.selected.setAttribute("data-vt-editable", "true");
      state.selected.focus();
      editTextBtn.textContent = "✏️ 편집 끝내기";
      recordChange(state.selected, "텍스트 수정됨");
    }
  });

  const deleteBtn = el("button", { className: "vt-danger", textContent: "🗑 이 요소 삭제" });
  deleteBtn.addEventListener("click", () => {
    if (!state.selected) return;
    state.selected.dataset.vtDeleted = "true";
    recordChange(state.selected, "삭제됨");
    selectNode(null);
  });

  const resetBtn = el("button", { textContent: "↺ 이 요소 초기화" });
  resetBtn.addEventListener("click", () => {
    if (!state.selected) return;
    resetNode(state.selected);
    selectNode(null);
  });

  const resetAllBtn = el("button", { className: "vt-danger", textContent: "↺ 전체 초기화" });
  resetAllBtn.addEventListener("click", () => {
    if (!confirm("모든 조정 내용을 되돌릴까요?")) return;
    [...state.changes.keys()].forEach(resetNode);
    selectNode(null);
  });

  const exportBtn = el("button", { className: "vt-primary", textContent: "📋 변경사항 내보내기" });
  exportBtn.addEventListener("click", openExport);

  const logList = el("ul", { id: "vt-log-list" });
  function renderLog() {
    logList.textContent = "";
    state.changes.forEach((info, node) => {
      const restore = el("button", { textContent: "되돌리기" });
      restore.addEventListener("click", () => resetNode(node));
      const item = el("li", {}, [
        el("span", { textContent: `${info.selector} — ${info.notes[info.notes.length - 1]}` }),
        restore
      ]);
      logList.appendChild(item);
    });
  }

  const panel = el("div", { id: "vt-panel" }, [
    el("h3", { textContent: "조정 패널" }),
    targetLabel,
    fontSizeCtl.wrap,
    paddingCtl.wrap,
    gapCtl.wrap,
    widthCtl.wrap,
    posRow,
    el("div", { className: "vt-btn-row" }, [editTextBtn, deleteBtn, resetBtn]),
    el("hr", { className: "vt-section-sep" }),
    el("h3", { textContent: "지금까지 바꾼 것" }),
    logList,
    el("div", { className: "vt-btn-row" }, [exportBtn, resetAllBtn])
  ]);
  document.body.appendChild(panel);

  const exportBox = el("div", { id: "vt-export" });
  const exportTextarea = el("textarea", { readOnly: true });
  const exportCloseBtn = el("button", { className: "vt-primary", textContent: "닫기" });
  exportCloseBtn.addEventListener("click", () => exportBox.classList.remove("is-open"));
  const exportCopyBtn = el("button", { textContent: "클립보드에 복사" });
  exportCopyBtn.addEventListener("click", () => {
    exportTextarea.select();
    document.execCommand("copy");
    exportCopyBtn.textContent = "복사됨!";
    setTimeout(() => { exportCopyBtn.textContent = "클립보드에 복사"; }, 1500);
  });
  exportBox.appendChild(el("h3", { textContent: "변경사항 요약 (이 내용을 복사해서 붙여넣어 주세요)" }));
  exportBox.appendChild(exportTextarea);
  exportBox.appendChild(el("div", { className: "vt-btn-row" }, [exportCopyBtn, exportCloseBtn]));
  document.body.appendChild(exportBox);

  function openExport() {
    const lines = [];
    state.changes.forEach(info => {
      lines.push(`${info.selector}\n  - ${info.notes.join("\n  - ")}`);
    });
    exportTextarea.value = lines.length
      ? lines.join("\n\n")
      : "(아직 바뀐 게 없습니다)";
    exportBox.classList.add("is-open");
  }

  // ---- selection / hover ----
  function rectOf(node) {
    return node.getBoundingClientRect();
  }

  function paintOutline(box, rect) {
    if (!rect) { box.style.display = "none"; return; }
    box.style.display = "block";
    box.style.left = rect.left + "px";
    box.style.top = rect.top + "px";
    box.style.width = rect.width + "px";
    box.style.height = rect.height + "px";
  }

  function refreshOutline() {
    if (state.selected) paintOutline(selectOutline, rectOf(state.selected));
  }
  window.addEventListener("scroll", refreshOutline, { passive: true });
  window.addEventListener("resize", refreshOutline);

  function selectNode(node) {
    state.selected = node;
    if (!node) {
      panel.classList.remove("is-open");
      paintOutline(selectOutline, null);
      return;
    }
    panel.classList.add("is-open");
    targetLabel.textContent = describeSelector(node);
    const cs = getComputedStyle(node);
    fontSizeCtl.input.value = parseFloat(cs.fontSize) || 16;
    fontSizeCtl.value.textContent = fontSizeCtl.input.value + "px";
    paddingCtl.input.value = parseFloat(cs.paddingTop) || 0;
    paddingCtl.value.textContent = paddingCtl.input.value + "px";
    gapCtl.input.value = parseFloat(cs.gap) || 0;
    gapCtl.value.textContent = gapCtl.input.value + "px";
    widthCtl.input.value = Math.round(node.getBoundingClientRect().width) || 100;
    widthCtl.value.textContent = widthCtl.input.value + "px";
    posX.value = "0";
    posY.value = "0";
    editTextBtn.textContent = "✏️ 텍스트 편집";
    paintOutline(selectOutline, rectOf(node));
  }

  // ---- drag to reposition ----
  let dragState = null;
  document.addEventListener("mousedown", event => {
    if (!state.active || !state.selected || event.target !== state.selected) return;
    if (state.selected.getAttribute("contenteditable") === "true") return;
    dragState = {
      startX: event.clientX, startY: event.clientY,
      baseX: Number(posX.value) || 0, baseY: Number(posY.value) || 0
    };
    event.preventDefault();
  }, true);
  document.addEventListener("mousemove", event => {
    if (!dragState) return;
    posX.value = String(dragState.baseX + (event.clientX - dragState.startX));
    posY.value = String(dragState.baseY + (event.clientY - dragState.startY));
    applyPosition();
  }, true);
  document.addEventListener("mouseup", () => { dragState = null; }, true);

  // ---- click-to-select / hover, only while active ----
  document.addEventListener("mousemove", event => {
    if (!state.active || dragState) return;
    const t = event.target;
    if (t === toggleBtn || panel.contains(t) || exportBox.contains(t)) {
      hoverOutline.style.display = "none";
      return;
    }
    paintOutline(hoverOutline, rectOf(t));
  }, true);

  document.addEventListener("click", event => {
    if (!state.active) return;
    const t = event.target;
    if (t === toggleBtn || panel.contains(t) || exportBox.contains(t)) return;
    event.preventDefault();
    event.stopPropagation();
    selectNode(t);
  }, true);

  toggleBtn.addEventListener("click", () => {
    state.active = !state.active;
    toggleBtn.classList.toggle("is-on", state.active);
    toggleBtn.textContent = state.active ? "🛠 조정모드 끄기" : "🛠 조정모드 켜기";
    document.documentElement.style.cursor = state.active ? "crosshair" : "";
    if (!state.active) {
      hoverOutline.style.display = "none";
      selectNode(null);
    }
  });

  console.log("[visual-tuner] 로드됨 — 오른쪽 아래 '조정모드' 버튼을 눌러 시작하세요.");
})();
