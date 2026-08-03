"use strict";

(() => {
  const header = document.querySelector(".site-header");
  const nav = document.querySelector(".main-nav");
  if (!header || !nav) return;
  const trigger = document.createElement("button");
  trigger.type = "button"; trigger.className = "responsive-nav-trigger";
  trigger.setAttribute("aria-expanded", "false"); trigger.setAttribute("aria-controls", "responsive-main-nav");
  trigger.textContent = "메뉴"; nav.id = "responsive-main-nav"; header.append(trigger);
  const close = () => { header.classList.remove("is-nav-open"); trigger.setAttribute("aria-expanded", "false"); };
  const open = () => { header.classList.add("is-nav-open"); trigger.setAttribute("aria-expanded", "true"); nav.querySelector("a")?.focus(); };
  trigger.addEventListener("click", () => header.classList.contains("is-nav-open") ? close() : open());
  nav.addEventListener("click", event => { if (event.target.closest("a")) close(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && header.classList.contains("is-nav-open")) { close(); trigger.focus(); } });
})();
