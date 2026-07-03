(() => {
  const NAV_LABELS = ["대시보드", "프로젝트", "교육과정", "H-A-H", "차시흐름", "산출물"];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => (value || "").replace(/\s+/g, " ").trim();

  let scrollStopTimer = null;
  let lastLitSection = null;

  function getHeader() {
    return $("header") || $(".site-header") || $(".header");
  }

  function getNavRoot() {
    const header = getHeader();
    if (!header) return null;
    return $("nav", header) || $('[class*="nav"]', header) || header;
  }

  function navTargetForLabel(label) {
    const targets = {
      "대시보드": "#top",
      "프로젝트": "#project",
      "교육과정": "#curriculum",
      "H-A-H": $("#aiways-restore-hah-page") ? "#aiways-restore-hah-page" : "#hah",
      "차시흐름": $("#aiways-restore-flow-page") ? "#aiways-restore-flow-page" : "#lesson",
      "산출물": "#outputs"
    };

    return targets[label] || null;
  }

  function patchNavLabels() {
    const nav = getNavRoot();
    if (!nav) return;

    $$("a,button,span", nav).forEach(el => {
      if (clean(el.textContent) === "6차시") el.textContent = "차시흐름";
    });

    const navItems = $$("a,button,span", nav).filter(el => NAV_LABELS.includes(clean(el.textContent)));
    const hasDashboard = navItems.some(el => clean(el.textContent) === "대시보드");
    const project = navItems.find(el => clean(el.textContent) === "프로젝트") || navItems[0];

    if (!hasDashboard && project && project.parentElement) {
      const tag = project.tagName.toLowerCase();
      const node = document.createElement(["a", "button", "span"].includes(tag) ? tag : "span");
      node.textContent = "대시보드";
      node.className = project.className || "";
      if (node.tagName.toLowerCase() === "a") node.setAttribute("href", "#top");
      project.parentElement.insertBefore(node, project);
    }

    $$("a,button,span", nav).forEach(el => {
      const label = clean(el.textContent);
      const target = navTargetForLabel(label);
      if (!target) return;

      el.dataset.aiwaysFinalScrollTarget = target;
      if (el.tagName.toLowerCase() === "a") el.setAttribute("href", target);
    });
  }

  function getSections() {
    const selectors = [
      "main > section",
      "body > section",
      ".aiw-page-section",
      ".aiways-restore-page",
      ".aiways-full-app-section",
      "[data-section]",
      "[class*='page-section']"
    ];
    const raw = selectors.flatMap(sel => $$(sel));
    const unique = [];

    raw.forEach(el => {
      if (!el || el === document.body || el === document.documentElement) return;
      if (el.classList.contains("aiways-output-removed") || el.classList.contains("aiways-final-removed")) return;

      const rect = el.getBoundingClientRect();
      const t = clean(el.textContent);
      const style = getComputedStyle(el);

      if (rect.width < 320 || rect.height < 160 || t.length < 20) return;
      if (style.display === "none" || style.visibility === "hidden") return;
      if (unique.some(parent => parent.contains(el))) return;

      el.classList.add("aiways-final-scroll-page");
      if (style.position === "static") el.style.position = "relative";
      unique.push(el);
    });

    unique.sort((a, b) => a.offsetTop - b.offsetTop);
    return unique;
  }

  function labelForSection(section, index, sections) {
    const t = clean(section.textContent);

    if (t.includes("버리는 순간") && t.includes("데이터가 되다") && t.includes("AIWays Incheon은")) return "대시보드";
    if (t.includes("버리는 순간을 데이터로 바꾸다") || t.includes("포스터를 만드는 수업이 아니라")) return "프로젝트";
    if (t.includes("교육과정 기반 수업설계") || t.includes("Curriculum-Based Learning Design") || t.includes("연계 성취기준")) return "교육과정";
    if (section.id === "aiways-restore-hah-page" || t.includes("H-A-H Learning Loop") || t.includes("사람이 발견하고")) return "H-A-H";
    if (section.id === "aiways-restore-flow-page" || t.includes("6-Lesson Journey") || t.includes("6차시 여정") || t.includes("차시흐름")) return "차시흐름";

    const flowIndex = sections.findIndex(sec => {
      const st = clean(sec.textContent);
      return sec.id === "aiways-restore-flow-page" || st.includes("6차시 여정") || st.includes("6-Lesson Journey");
    });

    if (
      t.includes("학생 산출물 갤러리") ||
      t.includes("3초 판단 앱") ||
      t.includes("3-Second Sorting Helper App") ||
      t.includes("버려지는 순간을 기록하세요") ||
      t.includes("PLAY BOOK") ||
      t.includes("Resource") ||
      (flowIndex >= 0 && index > flowIndex)
    ) {
      return "산출물";
    }

    return null;
  }

  function currentSection() {
    const sections = getSections();
    if (!sections.length) return { section: null, sections };

    const header = getHeader();
    const headerHeight = header ? header.getBoundingClientRect().height : 68;
    const anchorY = headerHeight + 18;
    let best = sections[0];
    let bestScore = Infinity;

    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const visibleRatio = visible / Math.min(window.innerHeight, Math.max(1, rect.height));
      let score = Math.abs(rect.top - headerHeight) - visibleRatio * 80;

      if (rect.top <= anchorY && rect.bottom > anchorY) score -= 260;

      if (score < bestScore) {
        bestScore = score;
        best = section;
      }
    });

    return { section: best, sections };
  }

  function clearPageLights() {
    getSections().forEach(section => {
      section.classList.remove("aiways-final-scroll-lit", "aiways-master-page-active", "aiways-scroll-light-active", "aiw-page-active");
    });
  }

  function applyPageLight() {
    const { section } = currentSection();
    if (!section) return;

    clearPageLights();

    if (lastLitSection !== section) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          section.classList.add("aiways-final-scroll-lit", "aiw-page-active");
          lastLitSection = section;
        });
      });
      return;
    }

    section.classList.add("aiways-final-scroll-lit", "aiw-page-active");
  }

  function applyNavLight() {
    patchNavLabels();

    const nav = getNavRoot();
    if (!nav) return;

    const { section, sections } = currentSection();
    if (!section) return;

    const label = labelForSection(section, sections.indexOf(section), sections);
    if (!label) return;

    $$("a,button,span", nav)
      .filter(el => NAV_LABELS.includes(clean(el.textContent)))
      .forEach(el => {
        const isActive = clean(el.textContent) === label;
        el.classList.toggle("aiways-final-nav-lit", isActive);

        if (!isActive) {
          el.classList.remove("aiways-master-nav-active", "aiways-restore-nav-active", "aiways-output-nav-active", "aiways-final-active", "aiw-nav-active", "op-current");
        }
      });
  }

  function hideScrollbarGhosts() {
    $$("body *").forEach(el => {
      if (el.dataset.aiwaysGhostChecked === "1") return;
      el.dataset.aiwaysGhostChecked = "1";

      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const fixedOrSticky = style.position === "fixed" || style.position === "sticky";
      const nearRight = rect.right >= window.innerWidth - 18;
      const smallWidth = rect.width > 0 && rect.width <= 22;
      const scrollbarHeight = rect.height >= 24 && rect.height <= window.innerHeight * 0.45;
      const noText = clean(el.textContent).length === 0;
      const lowVisual = Number(style.opacity || 1) < 0.9 || style.backgroundColor.includes("rgba");

      if (fixedOrSticky && nearRight && smallWidth && scrollbarHeight && noText && lowVisual) {
        el.classList.add("aiways-final-scrollbar-ghost");
      }
    });
  }

  function onScrollStart() {
    document.body.classList.add("aiways-final-is-scrolling");
    clearPageLights();
    applyNavLight();
  }

  function onScrollStop() {
    document.body.classList.remove("aiways-final-is-scrolling");
    applyNavLight();
    applyPageLight();
  }

  function handleScroll() {
    onScrollStart();
    window.clearTimeout(scrollStopTimer);
    scrollStopTimer = window.setTimeout(onScrollStop, 115);
  }

  function bindNavClicks() {
    const nav = getNavRoot();
    if (!nav) return;

    $$("a,button,span", nav).forEach(item => {
      const label = clean(item.textContent);
      if (!NAV_LABELS.includes(label)) return;
      if (item.dataset.aiwaysFinalScrollClickBound === "1") return;

      item.dataset.aiwaysFinalScrollClickBound = "1";
      item.addEventListener("click", event => {
        const targetSelector = item.dataset.aiwaysFinalScrollTarget;
        const target = targetSelector ? $(targetSelector) : null;

        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        window.setTimeout(onScrollStop, 760);
      }, true);
    });
  }

  function boot() {
    patchNavLabels();
    hideScrollbarGhosts();
    bindNavClicks();
    getSections();

    window.setTimeout(onScrollStop, 180);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", () => {
      patchNavLabels();
      hideScrollbarGhosts();
      bindNavClicks();
      onScrollStop();
    }, { passive: true });
    window.addEventListener("aiways-sections-mutated", () => window.setTimeout(onScrollStop, 80), { passive: true });

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      patchNavLabels();
      hideScrollbarGhosts();
      bindNavClicks();
      applyNavLight();
      if (!document.body.classList.contains("aiways-final-is-scrolling")) applyPageLight();
      if (tries >= 18) window.clearInterval(timer);
    }, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
