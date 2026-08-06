"use strict";

(() => {
  const header = document.querySelector(".site-header");
  const nav = document.querySelector(".main-nav");
  if (!header || !nav) return;
  const mobileNav = document.querySelector(".mobile-quick-nav");
  const mobileTitle = document.querySelector("[data-mobile-shell-title]");
  const mobileState = document.querySelector("[data-mobile-shell-state]");
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
  };
  window.addEventListener("hashchange", syncMobileShell);
  mobileNav?.addEventListener("click", () => window.setTimeout(syncMobileShell, 0));
  window.addEventListener("offline", () => setMobileShellState({ state: "offline", message: "오프라인 상태입니다. 연결되면 다시 동기화합니다." }));
  window.addEventListener("online", () => { if (mobileState) { mobileState.hidden = true; mobileState.textContent = ""; } });
  window.addEventListener("aiways:mobile-shell-state", event => setMobileShellState(event.detail));
  syncMobileShell();
})();
