(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const text = el => (el?.textContent || "").replace(/\s+/g, " ").trim();

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function findMainDashboardSection() {
    return $$("main > section, section, article, .aiw-page-section, [data-section]").find(el => {
      const t = text(el);
      return t.includes("버리는 순간") && t.includes("데이터가 되다") && t.includes("AIWays Incheon은");
    });
  }

  function markMobileSections() {
    const dashboard = findMainDashboardSection();

    if (dashboard) {
      dashboard.classList.add("aiways-mobile-dashboard-section");

      const title = $$("h1,h2,div,span", dashboard).find(el => {
        const t = text(el);
        return t.includes("버리는 순간") && t.includes("데이터가 되다") && t.length < 50;
      });

      if (title) title.classList.add("aiways-mobile-hero-title");

      const copy = $$("p,div", dashboard).find(el => {
        const t = text(el);
        return t.includes("AIWays Incheon은") && t.includes("H-A-H 기반 수업 프로젝트입니다");
      });

      if (copy) copy.classList.add("aiways-mobile-force-br");
    }

    $$("main > section, section, article, .aiw-page-section, .aiways-restore-page, .aiways-full-app-section, [data-section]").forEach(el => {
      const rect = el.getBoundingClientRect();
      const t = text(el);
      if (rect.width > 240 && rect.height > 120 && t.length > 20) {
        el.classList.add("aiways-mobile-section");
      }
    });
  }

  function markScrollbarGhosts() {
    $$("body *").forEach(el => {
      if (el.dataset.aiwaysMobileChecked === "1") return;
      el.dataset.aiwaysMobileChecked = "1";

      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const t = text(el);

      if (
        (style.position === "fixed" || style.position === "sticky") &&
        rect.right >= window.innerWidth - 18 &&
        rect.width > 0 &&
        rect.width <= 24 &&
        rect.height >= 24 &&
        rect.height <= window.innerHeight * 0.5 &&
        t.length === 0
      ) {
        el.classList.add("aiways-final-scrollbar-ghost");
      }
    });
  }

  function preventHorizontalOverflow() {
    if (!isMobile()) return;

    $$("body *").forEach(el => {
      const rect = el.getBoundingClientRect();

      if (rect.width > window.innerWidth + 4) {
        el.style.maxWidth = "100%";
        el.style.minWidth = "0";
      }

      if (rect.left < -8 || rect.right > window.innerWidth + 8) {
        el.style.maxWidth = "100%";
      }
    });
  }

  function disableMobileLighting() {
    if (!isMobile()) return;

    document.body.classList.remove("aiways-final-is-scrolling");

    $$(".aiways-final-scroll-page, .aiways-master-page, .aiways-scroll-light-managed, .aiw-page-section").forEach(el => {
      el.classList.add("aiways-final-scroll-lit", "aiw-page-active");
      el.style.opacity = "1";
      el.style.filter = "none";
      el.style.transform = "none";
    });
  }

  function normalizeMobileNav() {
    if (!isMobile()) return;

    const header = $("header") || $(".site-header") || $(".header");
    if (!header) return;

    const nav = $("nav", header) || $('[class*="nav"]', header);
    if (!nav) return;

    nav.style.overflowX = "auto";
    nav.style.overflowY = "hidden";
    nav.style.webkitOverflowScrolling = "touch";
  }

  function run() {
    markMobileSections();

    if (isMobile()) {
      normalizeMobileNav();
      disableMobileLighting();
      markScrollbarGhosts();
      requestAnimationFrame(preventHorizontalOverflow);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  window.addEventListener("resize", run, { passive: true });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(run, 220);
  }, { passive: true });

  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    run();
    if (tries >= 14) window.clearInterval(timer);
  }, 350);
})();
