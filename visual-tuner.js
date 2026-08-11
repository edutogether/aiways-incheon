(() => {
  "use strict";

  const STYLE = `
    #vt-toggle, #vt-export-badge {
      position: fixed; z-index: 99999; right: 16px;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: 999px; border: 1px solid rgba(94,247,205,.4);
      background: #06111c; color: #5ef7cd; font: 700 14px/1 system-ui, sans-serif;
      cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.4);
    }
    #vt-toggle { bottom: 16px; }
    #vt-toggle.is-on { background: #5ef7cd; color: #06111c; }
    #vt-export-badge { bottom: 64px; display: none; }
    #vt-export-badge.is-shown { display: inline-flex; }

    #vt-hover-outline {
      position: fixed; z-index: 99997; pointer-events: none;
      border: 2px dashed rgba(100,234,255,.85); border-radius: 4px; display: none; box-sizing: border-box;
    }
    #vt-select-box {
      position: fixed; z-index: 99998; pointer-events: none;
      border: 2px solid #5ef7cd; border-radius: 2px; display: none; box-sizing: border-box;
    }
    .vt-handle {
      position: fixed; z-index: 99999; width: 12px; height: 12px; margin: -6px 0 0 -6px;
      background: #5ef7cd; border: 2px solid #06111c; border-radius: 50%;
      display: none; box-sizing: border-box;
    }
    .vt-handle.vt-corner { border-radius: 50%; }
    .vt-handle.vt-edge { border-radius: 3px; background: #64eaff; }
    .vt-handle.vt-nw, .vt-handle.vt-se { cursor: nwse-resize; }
    .vt-handle.vt-ne, .vt-handle.vt-sw { cursor: nesw-resize; }
    .vt-handle.vt-n, .vt-handle.vt-s { cursor: ns-resize; }
    .vt-handle.vt-e, .vt-handle.vt-w { cursor: ew-resize; }

    #vt-mini-toolbar {
      position: fixed; z-index: 99999; display: none; align-items: center; gap: 6px;
      background: #0b1626; border: 1px solid rgba(94,247,205,.35); border-radius: 10px;
      padding: 6px 8px; box-shadow: 0 8px 24px rgba(0,0,0,.5);
      font: 600 12px/1 system-ui, sans-serif; color: #eef7ff;
    }
    #vt-mini-toolbar button {
      cursor: pointer; border: none; background: transparent; color: inherit;
      font-size: 15px; padding: 4px 6px; border-radius: 6px;
    }
    #vt-mini-toolbar button:hover { background: rgba(255,255,255,.1); }
    #vt-mini-toolbar .vt-size-readout { color: #9eb3c7; font-size: 11px; padding: 0 4px; white-space: nowrap; }

    #vt-export {
      position: fixed; z-index: 100000; inset: 8% 10%; background: #0b1626; color: #eef7ff;
      border: 1px solid rgba(94,247,205,.4); border-radius: 16px; padding: 20px; display: none;
      box-shadow: 0 20px 60px rgba(0,0,0,.6); flex-direction: column;
    }
    #vt-export.is-open { display: flex; }
    #vt-export h3 { margin: 0; font-size: 14px; color: #5ef7cd; }
    #vt-export textarea {
      flex: 1 1 auto; margin-top: 12px; background: #06111c; color: #b8ffef;
      border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 12px;
      font: 12px/1.5 ui-monospace, monospace; resize: none;
    }
    #vt-export .vt-btn-row { display: flex; gap: 8px; margin-top: 12px; }
    #vt-export button {
      cursor: pointer; border: 1px solid rgba(255,255,255,.18); border-radius: 8px;
      background: rgba(255,255,255,.06); color: #eef7ff; padding: 8px 14px; font: 700 12px/1 system-ui, sans-serif;
    }
    #vt-export button.vt-primary { background: #5ef7cd; color: #06111c; border-color: #5ef7cd; }

    [data-vt-editable="true"] { outline: 2px solid #ad8cff !important; outline-offset: 2px; }
    [data-vt-deleted="true"] { display: none !important; }
    html.vt-active [data-vt-tunable]:hover { cursor: pointer; }
  `;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    const { dataset, ...rest } = props || {};
    Object.assign(node, rest);
    if (dataset) Object.assign(node.dataset, dataset);
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

  // Trivial inline wrapper tags used purely for line-wrap/typography control in this codebase.
  const TRIVIAL_INLINE = new Set(["SPAN", "EM", "STRONG", "B", "I", "SMALL"]);

  function hasOwnVisualBox(node) {
    const cs = getComputedStyle(node);
    return cs.backgroundImage !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)" ||
      parseFloat(cs.borderTopWidth) > 0;
  }

  // PowerPoint-like target resolution: climb past bare typography wrappers to the
  // nearest element that reads as a real "object" (has its own class/box), so a
  // click anywhere in a card selects the card, not some inner <span>.
  function pickTarget(raw) {
    let node = raw;
    while (
      node && node.parentElement &&
      TRIVIAL_INLINE.has(node.tagName) &&
      !hasOwnVisualBox(node) &&
      node.parentElement !== document.body
    ) {
      node = node.parentElement;
    }
    return node;
  }

  const NAV_PASSTHROUGH_SELECTOR = ".main-nav a, .responsive-nav-trigger, .edu2g-beta-trigger, #vt-toggle, #vt-export-badge, #vt-export, #vt-mini-toolbar";

  const state = { active: false, selected: null, changes: new Map() };

  function recordChange(node, note) {
    if (!state.changes.has(node)) state.changes.set(node, { selector: describeSelector(node), notes: [] });
    state.changes.get(node).notes.push(note);
    exportBadge.textContent = `📋 변경 ${state.changes.size}건 보기`;
    exportBadge.classList.toggle("is-shown", state.changes.size > 0);
  }

  function ensureOriginal(node) {
    if (node.dataset.vtOriginalStyle === undefined) {
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
    exportBadge.textContent = `📋 변경 ${state.changes.size}건 보기`;
    exportBadge.classList.toggle("is-shown", state.changes.size > 0);
  }

  // ---- scaffolding ----
  document.head.appendChild(el("style", { textContent: STYLE }));

  const toggleBtn = el("button", { id: "vt-toggle", textContent: "🛠 조정모드 켜기" });
  const exportBadge = el("button", { id: "vt-export-badge", textContent: "📋 변경 0건 보기" });
  const hoverOutline = el("div", { id: "vt-hover-outline" });
  const selectBox = el("div", { id: "vt-select-box" });
  const CORNER_POS = ["nw", "ne", "sw", "se"];
  const EDGE_POS = ["n", "s", "e", "w"];
  const handles = [
    ...CORNER_POS.map(pos => el("div", { className: "vt-handle vt-corner vt-" + pos, dataset: { pos, kind: "corner" } })),
    ...EDGE_POS.map(pos => el("div", { className: "vt-handle vt-edge vt-" + pos, dataset: { pos, kind: "edge" } }))
  ];
  const miniToolbar = el("div", { id: "vt-mini-toolbar" });
  const sizeReadout = el("span", { className: "vt-size-readout" });
  const fontMinusBtn = el("button", { textContent: "A−", title: "글자 작게" });
  const fontPlusBtn = el("button", { textContent: "A+", title: "글자 크게" });
  const editBtn = el("button", { textContent: "✏️", title: "텍스트 편집 (더블클릭해도 됩니다)" });
  const deleteBtn = el("button", { textContent: "🗑", title: "삭제" });
  const resetBtn = el("button", { textContent: "↺", title: "이 요소만 초기화" });
  miniToolbar.append(sizeReadout, fontMinusBtn, fontPlusBtn, editBtn, deleteBtn, resetBtn);

  document.body.append(toggleBtn, exportBadge, hoverOutline, selectBox, ...handles, miniToolbar);

  const exportBox = el("div", { id: "vt-export" });
  const exportTextarea = el("textarea", { readOnly: true });
  const exportCopyBtn = el("button", { textContent: "클립보드에 복사" });
  const exportResetAllBtn = el("button", { textContent: "↺ 전체 초기화" });
  const exportCloseBtn = el("button", { className: "vt-primary", textContent: "닫기" });
  exportBox.append(
    el("h3", { textContent: "변경사항 요약 (복사해서 붙여넣어 주세요)" }),
    exportTextarea,
    el("div", { className: "vt-btn-row" }, [exportCopyBtn, exportResetAllBtn, exportCloseBtn])
  );
  document.body.appendChild(exportBox);

  exportCopyBtn.addEventListener("click", () => {
    exportTextarea.select();
    document.execCommand("copy");
    exportCopyBtn.textContent = "복사됨!";
    setTimeout(() => { exportCopyBtn.textContent = "클립보드에 복사"; }, 1500);
  });
  exportResetAllBtn.addEventListener("click", () => {
    if (!confirm("모든 조정 내용을 되돌릴까요?")) return;
    [...state.changes.keys()].forEach(resetNode);
    selectNode(null);
    exportBox.classList.remove("is-open");
  });
  exportCloseBtn.addEventListener("click", () => exportBox.classList.remove("is-open"));
  exportBadge.addEventListener("click", () => {
    const lines = [];
    state.changes.forEach(info => lines.push(`${info.selector}\n  - ${info.notes.join("\n  - ")}`));
    exportTextarea.value = lines.length ? lines.join("\n\n") : "(아직 바뀐 게 없습니다)";
    exportBox.classList.add("is-open");
  });

  // ---- geometry ----
  function rectOf(node) { return node.getBoundingClientRect(); }

  function paintBox(box, rect) {
    if (!rect) { box.style.display = "none"; return; }
    box.style.display = "block";
    box.style.left = rect.left + "px";
    box.style.top = rect.top + "px";
    box.style.width = rect.width + "px";
    box.style.height = rect.height + "px";
  }

  const HANDLE_POS = {
    nw: r => [r.left, r.top],
    ne: r => [r.right, r.top],
    sw: r => [r.left, r.bottom],
    se: r => [r.right, r.bottom],
    n: r => [r.left + r.width / 2, r.top],
    s: r => [r.left + r.width / 2, r.bottom],
    e: r => [r.right, r.top + r.height / 2],
    w: r => [r.left, r.top + r.height / 2]
  };

  function refreshSelectionGeometry() {
    if (!state.selected) return;
    const rect = rectOf(state.selected);
    paintBox(selectBox, rect);
    handles.forEach(h => {
      const [x, y] = HANDLE_POS[h.dataset.pos](rect);
      h.style.display = "block";
      h.style.left = x + "px";
      h.style.top = y + "px";
    });
    miniToolbar.style.display = "flex";
    const top = rect.top > 44 ? rect.top - 40 : rect.bottom + 8;
    miniToolbar.style.left = Math.max(8, rect.left) + "px";
    miniToolbar.style.top = top + "px";
    const cs = getComputedStyle(state.selected);
    sizeReadout.textContent = `${Math.round(rect.width)}×${Math.round(rect.height)} · ${parseFloat(cs.fontSize)}px`;
  }
  window.addEventListener("scroll", () => { if (state.selected) refreshSelectionGeometry(); }, { passive: true });
  window.addEventListener("resize", () => { if (state.selected) refreshSelectionGeometry(); });

  function selectNode(node) {
    state.selected = node;
    if (!node) {
      paintBox(selectBox, null);
      handles.forEach(h => { h.style.display = "none"; });
      miniToolbar.style.display = "none";
      return;
    }
    refreshSelectionGeometry();
  }

  // ---- resize via handles: corners scale width+height together (keeps ratio),
  // edges stretch a single axis (breaks ratio) ----
  let resizeState = null;
  let suppressNextClick = false;
  handles.forEach(h => {
    h.addEventListener("mousedown", event => {
      if (!state.selected) return;
      event.preventDefault();
      event.stopPropagation();
      ensureOriginal(state.selected);
      // some elements (e.g. img/svg) have a site-wide max-width:100% reset that
      // would silently cap a bigger explicit width - clear any size constraints
      // so the handle drag isn't fighting a hidden ceiling.
      state.selected.style.maxWidth = "none";
      state.selected.style.maxHeight = "none";
      state.selected.style.minWidth = "0";
      state.selected.style.minHeight = "0";
      const rect = rectOf(state.selected);
      resizeState = {
        pos: h.dataset.pos, kind: h.dataset.kind,
        startX: event.clientX, startY: event.clientY,
        startWidth: rect.width, startHeight: rect.height
      };
    });
  });
  document.addEventListener("mousemove", event => {
    if (!resizeState || !state.selected) return;
    const { pos, kind, startWidth, startHeight } = resizeState;
    const dx = event.clientX - resizeState.startX;
    const dy = event.clientY - resizeState.startY;
    if (kind === "edge") {
      if (pos === "e") state.selected.style.width = Math.max(12, Math.round(startWidth + dx)) + "px";
      else if (pos === "w") state.selected.style.width = Math.max(12, Math.round(startWidth - dx)) + "px";
      else if (pos === "s") state.selected.style.height = Math.max(12, Math.round(startHeight + dy)) + "px";
      else if (pos === "n") state.selected.style.height = Math.max(12, Math.round(startHeight - dy)) + "px";
    } else {
      const signX = (pos === "ne" || pos === "se") ? 1 : -1;
      const signY = (pos === "sw" || pos === "se") ? 1 : -1;
      const scaleX = (startWidth + signX * dx) / startWidth;
      const scaleY = (startHeight + signY * dy) / startHeight;
      const scale = Math.max(0.1, (scaleX + scaleY) / 2);
      state.selected.style.width = Math.max(12, Math.round(startWidth * scale)) + "px";
      state.selected.style.height = Math.max(12, Math.round(startHeight * scale)) + "px";
    }
    refreshSelectionGeometry();
  }, true);
  document.addEventListener("mouseup", () => {
    if (resizeState && state.selected) {
      const cs = getComputedStyle(state.selected);
      recordChange(state.selected, `크기: ${cs.width} × ${cs.height}`);
      suppressNextClick = true;
    }
    resizeState = null;
  }, true);

  function stepFontSize(delta) {
    if (!state.selected) return;
    ensureOriginal(state.selected);
    const cs = getComputedStyle(state.selected);
    const next = Math.max(6, Math.round((parseFloat(cs.fontSize) || 16) + delta));
    state.selected.style.fontSize = next + "px";
    recordChange(state.selected, `font-size: ${next}px`);
    refreshSelectionGeometry();
  }
  fontMinusBtn.addEventListener("click", () => stepFontSize(-2));
  fontPlusBtn.addEventListener("click", () => stepFontSize(2));

  // ---- move via dragging the selection body ----
  let dragState = null;
  selectBox.style.pointerEvents = "none"; // clicks pass through to the real element below

  document.addEventListener("mousedown", event => {
    if (!state.active || !state.selected) return;
    if (event.target !== state.selected) return;
    if (state.selected.getAttribute("contenteditable") === "true") return;
    ensureOriginal(state.selected);
    const current = state.selected.style.transform || "";
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(current);
    dragState = {
      startX: event.clientX, startY: event.clientY,
      baseX: match ? parseFloat(match[1]) : 0, baseY: match ? parseFloat(match[2]) : 0
    };
    event.preventDefault();
  }, true);
  document.addEventListener("mousemove", event => {
    if (!dragState || !state.selected) return;
    const x = dragState.baseX + (event.clientX - dragState.startX);
    const y = dragState.baseY + (event.clientY - dragState.startY);
    state.selected.style.transform = `translate(${x}px, ${y}px)`;
    refreshSelectionGeometry();
  }, true);
  document.addEventListener("mouseup", () => {
    if (dragState && state.selected) {
      recordChange(state.selected, `위치 이동: ${state.selected.style.transform}`);
      suppressNextClick = true;
    }
    dragState = null;
  }, true);

  // ---- mini toolbar actions ----
  editBtn.addEventListener("click", () => startTextEdit());
  function startTextEdit() {
    if (!state.selected) return;
    state.selected.setAttribute("contenteditable", "true");
    state.selected.setAttribute("data-vt-editable", "true");
    state.selected.focus();
    recordChange(state.selected, "텍스트 수정됨");
  }
  document.addEventListener("blur", event => {
    if (event.target === state.selected && state.selected?.getAttribute("contenteditable") === "true") {
      state.selected.removeAttribute("contenteditable");
      state.selected.removeAttribute("data-vt-editable");
    }
  }, true);

  deleteBtn.addEventListener("click", () => {
    if (!state.selected) return;
    state.selected.dataset.vtDeleted = "true";
    recordChange(state.selected, "삭제됨");
    selectNode(null);
  });
  resetBtn.addEventListener("click", () => {
    if (!state.selected) return;
    resetNode(state.selected);
    selectNode(null);
  });

  document.addEventListener("keydown", event => {
    if (!state.active || !state.selected) return;
    if (state.selected.getAttribute("contenteditable") === "true") return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteBtn.click();
    } else if (event.key === "Escape") {
      selectNode(null);
    }
  });

  // ---- click-to-select / hover, only while active ----
  document.addEventListener("mousemove", event => {
    if (!state.active || dragState || resizeState) return;
    const t = event.target;
    if (t.closest(NAV_PASSTHROUGH_SELECTOR)) { hoverOutline.style.display = "none"; return; }
    paintBox(hoverOutline, rectOf(pickTarget(t)));
  }, true);

  document.addEventListener("dblclick", event => {
    if (!state.active) return;
    if (event.target.closest(NAV_PASSTHROUGH_SELECTOR)) return;
    event.preventDefault();
    event.stopPropagation();
    const target = pickTarget(event.target);
    if (state.selected !== target) selectNode(target);
    startTextEdit();
  }, true);

  document.addEventListener("click", event => {
    if (!state.active) return;
    if (suppressNextClick) { suppressNextClick = false; event.preventDefault(); event.stopPropagation(); return; }
    if (event.target.closest(NAV_PASSTHROUGH_SELECTOR)) return; // let real navigation happen
    event.preventDefault();
    event.stopPropagation();
    selectNode(pickTarget(event.target));
  }, true);

  toggleBtn.addEventListener("click", () => {
    state.active = !state.active;
    document.documentElement.classList.toggle("vt-active", state.active);
    toggleBtn.classList.toggle("is-on", state.active);
    toggleBtn.textContent = state.active ? "🛠 조정모드 끄기" : "🛠 조정모드 켜기";
    if (!state.active) {
      hoverOutline.style.display = "none";
      selectNode(null);
    }
  });

  console.log("[visual-tuner] 로드됨 — 오른쪽 아래 '조정모드' 버튼을 눌러 시작하세요. 클릭=선택, 더블클릭=텍스트편집, 모서리 드래그=크기, 본체 드래그=이동, Delete=삭제.");
})();
