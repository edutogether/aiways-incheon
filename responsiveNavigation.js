"use strict";

// 🔴 이 파일도 `app.js`와 같은 문제를 갖는다 — **실행되는 순간 DOM을 잡는다.**
// 리액트 전환본에서는 그때 화면이 아직 없어서 아래 `if (!header || !nav) return`에
// 걸려 **조용히 아무것도 안 한다.** 그러면 반응형 메뉴 버튼이 아예 안 생긴다
// (2026-09-10 기준선 대조에서 `responsive-main-nav`가 빠진 것으로 드러났다).
//
// 그래서 `app.js`와 같은 방식으로 진입점을 내놓고, 깃발이 서 있으면 자동 실행을
// 건너뛴다. 리액트가 마운트 뒤 **원본과 같은 순서로** 부른다.
(() => {
  function init() {
  const header = document.querySelector(".site-header");
  const nav = document.querySelector(".main-nav");
  if (!header || !nav) return;
  const mobileNav = document.querySelector(".mobile-quick-nav");
  const mobileTitle = document.querySelector("[data-mobile-shell-title]");
  const mobileState = document.querySelector("[data-mobile-shell-state]");
  const mobileHomeState = document.querySelector("[data-mobile-home-status]");
  const trigger = document.createElement("button");
  trigger.type = "button"; trigger.className = "responsive-nav-trigger";
  trigger.setAttribute("aria-expanded", "false"); trigger.setAttribute("aria-controls", "responsive-main-nav");
  trigger.textContent = "메뉴"; nav.id = "responsive-main-nav"; header.append(trigger);
  const close = () => { header.classList.remove("is-nav-open"); trigger.setAttribute("aria-expanded", "false"); };
  const open = () => { header.classList.add("is-nav-open"); trigger.setAttribute("aria-expanded", "true"); nav.querySelector("a")?.focus(); };
  trigger.addEventListener("click", () => header.classList.contains("is-nav-open") ? close() : open());
  nav.addEventListener("click", event => { if (event.target.closest("a")) close(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && header.classList.contains("is-nav-open")) { close(); trigger.focus(); } });

  const sectionTitles = new Map(
    [...document.querySelectorAll(".scene[id][data-nav]")].map(section => [section.id, section.dataset.nav])
  );
  const syncMobileShell = () => {
    const currentId = location.hash.slice(1) || "dashboard";
    const title = sectionTitles.get(currentId)
      || (currentId === "ranking" || currentId === "landfill" ? "대시보드" : "대시보드");
    if (mobileTitle) mobileTitle.textContent = title;
    mobileNav?.querySelectorAll("a").forEach(link => {
      const target = link.getAttribute("href")?.slice(1);
      const isCurrent = target === currentId
        || (currentId === "ranking" || currentId === "landfill") && target === currentId;
      link.toggleAttribute("aria-current", isCurrent);
    });
  };
  const setMobileShellState = detail => {
    if (!mobileState || !detail || typeof detail.message !== "string") return;
    mobileState.textContent = detail.message;
    mobileState.dataset.state = detail.state || "notice";
    mobileState.hidden = !detail.message;
    if (mobileHomeState) {
      mobileHomeState.textContent = detail.message;
      mobileHomeState.dataset.state = detail.state || "notice";
      mobileHomeState.setAttribute("role", detail.state === "error" ? "alert" : "status");
      mobileHomeState.hidden = !detail.message;
    }
  };
  window.addEventListener("hashchange", syncMobileShell);
  mobileNav?.addEventListener("click", () => window.setTimeout(syncMobileShell, 0));
  window.addEventListener("offline", () => setMobileShellState({ state: "offline", message: "오프라인 상태입니다. 연결되면 다시 동기화합니다." }));
  window.addEventListener("online", () => {
    [mobileState, mobileHomeState].filter(Boolean).forEach(element => { element.hidden = true; element.textContent = ""; });
  });
  window.addEventListener("aiways:mobile-shell-state", event => setMobileShellState(event.detail));
  syncMobileShell();
  }

  window.AIWaysResponsiveNav = { init };
  if (!window.__AIWAYS_PC_REACT_BOOT) init();
})();
