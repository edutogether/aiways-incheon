"use strict";

// ── 학년·반 고르기를 앱 디자인 드롭다운으로 (2026-09-11, 지시 Bumm)
//
// Bumm님: "드롭다운이 촌스러워. 운영체제 기본 선택 상자라 30년 전 프로그램 같아."
//
// 🔴 **`<select>`를 없애지 않고 감싼다.** 값을 읽고 쓰는 것은 그대로 `<select>`이고,
// 이 스크립트는 그 위에 보이는 껍데기를 씌운다. 그래서:
//   - `app.js`가 `<option>`을 채우고 `.value`를 읽는 코드를 한 줄도 안 고쳐도 된다
//     (고쳤다면 학년·반이 안 맞는 사고가 날 수 있는 자리다 - 반이 틀리면 그 반
//     선생님이 못 들어간다)
//   - **이 스크립트가 안 와도 기본 선택 상자가 그대로 동작한다**(점진적 향상)
//   - 화면에 안 보일 뿐 실제 폼 값·이벤트는 네이티브 그대로다
//
// 🔴 접근성을 기본 `<select>`보다 떨어뜨리지 않는다(팀장 지시):
//   - 키보드: ↑↓ 이동 · Home/End · Enter/Space 열기·고르기 · Esc 닫기 · 글자로 건너뛰기
//   - 포커스 표시: 버튼에 그대로 보인다
//   - 스크린리더: combobox/listbox/option 역할과 `aria-activedescendant`를 쓰고,
//     원래 `<select>`의 `aria-label`을 버튼이 물려받는다
//   - 터치: 버튼과 항목이 모두 눌린다(태블릿)
(() => {
  let seq = 0;

  function attach(select) {
    if (!select || select.dataset.aiwaysPicker === "on") return;
    select.dataset.aiwaysPicker = "on";
    const id = `aiways-picker-${seq += 1}`;

    const shell = document.createElement("div");
    shell.className = "aiways-picker";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "aiways-picker-button";
    button.id = `${id}-button`;
    button.setAttribute("role", "combobox");
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", `${id}-list`);
    const label = select.getAttribute("aria-label");
    if (label) button.setAttribute("aria-label", label);
    const text = document.createElement("span");
    text.className = "aiways-picker-text";
    const caret = document.createElement("span");
    caret.className = "aiways-picker-caret";
    caret.setAttribute("aria-hidden", "true");
    button.append(text, caret);

    const list = document.createElement("ul");
    list.className = "aiways-picker-list";
    list.id = `${id}-list`;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    if (label) list.setAttribute("aria-label", label);

    select.parentNode.insertBefore(shell, select);
    shell.append(select, button, list);
    select.classList.add("aiways-picker-native");

    let active = -1;

    const options = () => Array.from(select.options);

    function syncButton() {
      const chosen = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
      text.textContent = chosen ? chosen.textContent : "";
      // 값이 비어 있는 항목(안내문)은 "아직 안 고른 상태"로 보여준다.
      shell.classList.toggle("is-placeholder", !chosen || chosen.value === "");
      button.disabled = select.disabled;
      shell.classList.toggle("is-disabled", select.disabled);
    }

    function renderList() {
      list.replaceChildren();
      options().forEach((option, index) => {
        const item = document.createElement("li");
        item.className = "aiways-picker-option";
        item.id = `${id}-option-${index}`;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(index === select.selectedIndex));
        item.textContent = option.textContent;
        // 값이 빈 항목은 고를 수 없다 - 원래 `<select>`에서도 고르면 아무 일이
        // 없던 안내문이다. 고를 수 없다는 것을 스크린리더에도 알린다.
        if (option.value === "") {
          item.classList.add("is-hint");
          item.setAttribute("aria-disabled", "true");
        }
        item.addEventListener("mousedown", (event) => {
          event.preventDefault(); // 버튼에서 포커스가 빠져나가 목록이 먼저 닫히는 것을 막는다
          if (option.value === "") return;
          choose(index);
        });
        list.append(item);
      });
    }

    function markActive(index) {
      active = index;
      Array.from(list.children).forEach((item, i) => item.classList.toggle("is-active", i === index));
      if (index >= 0) {
        button.setAttribute("aria-activedescendant", `${id}-option-${index}`);
        list.children[index]?.scrollIntoView({ block: "nearest" });
      } else button.removeAttribute("aria-activedescendant");
    }

    // 🔴 목록이 화면(또는 모달) 밖으로 흘러나가지 않게 자리를 잡는다. 아래가
    // 좁고 위가 넓으면 위로 연다. 어느 쪽이든 남은 공간에 맞춰 높이를 줄인다.
    function place() {
      const GAP = 6;
      const box = button.getBoundingClientRect();
      const below = window.innerHeight - box.bottom - GAP;
      const above = box.top - GAP;
      const upward = below < 160 && above > below;
      shell.classList.toggle("is-upward", upward);
      list.style.maxBlockSize = `${Math.max(96, Math.min(208, (upward ? above : below) - GAP))}px`;
    }

    function open() {
      if (select.disabled || !list.hidden) return;
      renderList();
      list.hidden = false;
      button.setAttribute("aria-expanded", "true");
      shell.classList.add("is-open");
      place();
      // 아직 안 골랐으면 안내문이 아니라 **고를 수 있는 첫 항목**에서 시작한다.
      // 안내문에 커서를 두면 화살표를 한 번 더 눌러야 해서 한 칸씩 밀린다.
      const chosen = select.options[select.selectedIndex];
      markActive(chosen && chosen.value !== "" ? select.selectedIndex : step(-1, 1));
    }

    function close() {
      if (list.hidden) return;
      list.hidden = true;
      button.setAttribute("aria-expanded", "false");
      shell.classList.remove("is-open");
      markActive(-1);
    }

    function choose(index) {
      const option = select.options[index];
      if (!option || option.value === "") return;
      select.selectedIndex = index;
      syncButton();
      close();
      button.focus();
      // 🔴 `selectedIndex`를 코드로 바꾸면 change가 저절로 안 난다. 원래
      // `<select>`를 쓰던 쪽(app.js의 onchange)이 그대로 동작해야 하므로 직접 낸다.
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // 값을 고를 수 있는 다음/이전 항목으로 옮긴다(안내문은 건너뛴다).
    function step(from, delta) {
      const all = options();
      for (let i = from + delta; i >= 0 && i < all.length; i += delta) {
        if (all[i].value !== "") return i;
      }
      return from;
    }
    function edge(delta) {
      const all = options();
      return delta > 0 ? step(-1, 1) : step(all.length, -1);
    }

    let typed = "";
    let typedTimer = 0;

    button.addEventListener("click", () => { if (list.hidden) open(); else close(); });
    button.addEventListener("blur", () => close());
    button.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key === "Escape") { close(); return; }
      if (key === "Tab") { close(); return; }
      if (list.hidden) {
        if (key === "Enter" || key === " " || key === "ArrowDown" || key === "ArrowUp") { event.preventDefault(); open(); return; }
      } else {
        if (key === "Enter" || key === " ") { event.preventDefault(); choose(active); return; }
        if (key === "ArrowDown") { event.preventDefault(); markActive(step(active, 1)); return; }
        if (key === "ArrowUp") { event.preventDefault(); markActive(step(active, -1)); return; }
        if (key === "Home") { event.preventDefault(); markActive(edge(1)); return; }
        if (key === "End") { event.preventDefault(); markActive(edge(-1)); return; }
      }
      // 글자로 건너뛰기 - 기본 `<select>`가 하던 일이라 없애지 않는다.
      if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        typed += key;
        window.clearTimeout(typedTimer);
        typedTimer = window.setTimeout(() => { typed = ""; }, 700);
        const all = options();
        const found = all.findIndex((option) => option.value !== "" && option.textContent.startsWith(typed));
        if (found >= 0) {
          if (list.hidden) choose(found);
          else markActive(found);
        }
      }
    });

    // `<option>`을 바꿔 끼우는 쪽(app.js)이 있으므로 그것을 따라간다.
    new MutationObserver(() => { syncButton(); if (!list.hidden) renderList(); })
      .observe(select, { childList: true, attributes: true, attributeFilter: ["disabled"] });
    select.addEventListener("change", syncButton);

    syncButton();
  }

  function attachAll(root) {
    (root || document).querySelectorAll("select[data-aiways-picker]").forEach(attach);
  }

  window.AIWaysClassPicker = { attach, attachAll };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => attachAll(), { once: true });
  else attachAll();
})();
