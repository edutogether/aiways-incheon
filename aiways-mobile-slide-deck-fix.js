(() => {
  const LABELS = [
    "대시보드",
    "프로젝트",
    "교육과정",
    "H-A-H",
    "차시흐름",
    "갤러리",
    "3초판단",
    "플레이북"
  ];

  const clean = value => (value || "").replace(/\s+/g, " ").trim();
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let observer = null;

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function isVisible(el) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0;
  }

  function getHeader() {
    return $("header") || $(".site-header") || $(".header");
  }

  function getNavRoot() {
    const header = getHeader();
    if (!header) return null;

    return $("nav", header) || $('[class*="nav"]', header) || header;
  }

  function normalizeTextLabels() {
    $$("a,button,span,h1,h2,h3,h4,p,div").forEach(el => {
      const text = clean(el.textContent);

      if (text === "산출물") {
        el.textContent = "갤러리";
      }

      if (text === "3초 판단 앱" || text === "3초판단앱") {
        el.textContent = "3초판단";
      }

      if (text === "PLAY BOOK" || text === "Play Book" || text === "Playbook") {
        el.textContent = "플레이북";
      }

      if (text === "6차시") {
        el.textContent = "차시흐름";
      }
    });
  }

  function labelForText(text) {
    if (
      text.includes("버리는 순간") &&
      text.includes("데이터가 되다") &&
      text.includes("우리학교 자원순환 대시보드")
    ) return "대시보드";

    if (
      text.includes("버리는 순간을 데이터로 바꾸다") ||
      text.includes("환경 보호 포스터를 만드는 수업이 아니라")
    ) return "프로젝트";

    if (
      text.includes("교육과정 기반 수업설계") ||
      text.includes("생활 자원 관리와 자원순환 실천") ||
      text.includes("Curriculum-Based")
    ) return "교육과정";

    if (
      text.includes("H-A-H Learning Loop") ||
      text.includes("Human → AI → Human") ||
      text.includes("사람이 발견하고") ||
      text.includes("문제 발견") && text.includes("아이디어 확장") && text.includes("인간 검증")
    ) return "H-A-H";

    if (
      text.includes("차시흐름") ||
      text.includes("6-Lesson Journey") ||
      text.includes("6차시 여정") ||
      text.includes("1~2차시") && text.includes("3차시") && text.includes("4차시")
    ) return "차시흐름";

    if (
      text.includes("학생 산출물 갤러리") ||
      text.includes("갤러리") && text.includes("학생") && text.includes("산출")
    ) return "갤러리";

    if (
      text.includes("3초판단") ||
      text.includes("3초 판단") ||
      text.includes("3-Second Sorting Helper App") ||
      text.includes("버려지는 순간을 판단하세요")
    ) return "3초판단";

    if (
      text.includes("플레이북") ||
      text.includes("PLAY BOOK") ||
      text.includes("Play Book") ||
      text.includes("Playbook")
    ) return "플레이북";

    return null;
  }

  function explicitPageCandidates() {
    const hero = $("main > .aiw-hero") || $("main > .hero-story") || $("main > section");
    const specs = [
      { label: "대시보드", el: hero },
      { label: "프로젝트", el: $("#project") },
      { label: "교육과정", el: $("#curriculum") },
      { label: "H-A-H", el: $("#aiways-restore-hah-page") || $("#hah") },
      { label: "차시흐름", el: $("#aiways-restore-flow-page") || $("#lesson") },
      { label: "갤러리", el: $("#outputs") },
      { label: "3초판단", el: $("#quick-app") },
      { label: "플레이북", el: $("#playbook") }
    ];

    const seen = new Set();
    const pages = [];

    specs.forEach(item => {
      if (!item.el || seen.has(item.el) || !isVisible(item.el)) return;
      seen.add(item.el);

      const rect = item.el.getBoundingClientRect();
      if (rect.width < 260 || rect.height < 160) return;

      pages.push({
        el: item.el,
        label: item.label,
        top: item.el.offsetTop,
        area: rect.width * rect.height,
        height: rect.height
      });
    });

    return pages.sort((a, b) => a.top - b.top);
  }

  function findPageCandidates() {
    const explicit = explicitPageCandidates();
    if (explicit.length >= 5) return explicit;

    const selectors = [
      "main > section",
      "main > article",
      "main > div",
      "body > section",
      "body > article",
      ".aiw-page-section",
      ".aiways-master-page",
      ".aiways-final-scroll-page",
      ".aiways-restore-page",
      ".aiways-output-page",
      "[data-section]",
      "section",
      "article"
    ];

    const raw = selectors.flatMap(selector => $$(selector));
    const seen = new Set();
    const items = [];

    raw.forEach(el => {
      if (!el || seen.has(el)) return;
      seen.add(el);

      if (el === document.body || el === document.documentElement) return;
      if (!isVisible(el)) return;

      const rect = el.getBoundingClientRect();
      const text = clean(el.textContent);

      if (rect.width < 280 || rect.height < 240 || text.length < 20) return;

      const label = labelForText(text);
      if (!label) return;

      items.push({
        el,
        label,
        top: el.offsetTop,
        area: rect.width * rect.height,
        height: rect.height
      });
    });

    items.sort((a, b) => {
      if (Math.abs(a.top - b.top) < 16) return b.area - a.area;
      return a.top - b.top;
    });

    const filtered = [];

    items.forEach(item => {
      const sameLabel = filtered.find(prev => prev.label === item.label);
      const sameTop = filtered.find(prev => Math.abs(prev.top - item.top) < 16);

      if (sameLabel && Math.abs(sameLabel.top - item.top) < window.innerHeight * 0.6) {
        if (item.area > sameLabel.area) {
          filtered[filtered.indexOf(sameLabel)] = item;
        }
        return;
      }

      if (sameTop) {
        if (item.area > sameTop.area) {
          filtered[filtered.indexOf(sameTop)] = item;
        }
        return;
      }

      filtered.push(item);
    });

    filtered.sort((a, b) => a.top - b.top);

    return filtered;
  }

  function wrapSlideContent(page) {
    if (page.el.dataset.mobileSlideWrapped === "1") return;

    const wrapper = document.createElement("div");
    wrapper.className = "aiways-mobile-slide-inner";

    while (page.el.firstChild) {
      wrapper.appendChild(page.el.firstChild);
    }

    page.el.appendChild(wrapper);
    page.el.dataset.mobileSlideWrapped = "1";
  }

  function markLeftCards(page) {
    const wrapper = $(".aiways-mobile-slide-inner", page.el) || page.el;

    const grids = $$("[class*='grid'], [class*='Grid']", wrapper);
    grids.forEach(grid => {
      const children = Array.from(grid.children || []);
      if (children.length >= 4) grid.classList.add("aiways-mobile-left-cards");
    });
  }

  function lockMobilePageSize(page) {
    const value = "calc(100svh - var(--ms-header-h))";

    page.el.style.setProperty("height", value, "important");
    page.el.style.setProperty("min-height", value, "important");
    page.el.style.setProperty("max-height", value, "important");
    page.el.style.setProperty("overflow", "hidden", "important");
  }

  function unlockMobilePageSize(page) {
    page.el.style.removeProperty("height");
    page.el.style.removeProperty("min-height");
    page.el.style.removeProperty("max-height");
    page.el.style.removeProperty("overflow");
  }

  function applySlides() {
    normalizeTextLabels();

    const pages = findPageCandidates();

    pages.forEach(page => {
      page.el.classList.add("aiways-mobile-slide-page");
      page.el.dataset.mobileLabel = page.label;

      if (isMobile()) {
        lockMobilePageSize(page);
        wrapSlideContent(page);
        markLeftCards(page);
      } else {
        unlockMobilePageSize(page);
      }
    });

    return pages;
  }

  function dedupeNavItems(nav) {
    const seen = new Set();

    $$("a,button,span", nav).forEach(el => {
      const label = clean(el.textContent);
      if (!LABELS.includes(label)) return;

      if (seen.has(label)) {
        el.remove();
        return;
      }

      seen.add(label);
    });
  }

  function ensureNav() {
    const nav = getNavRoot();
    if (!nav) return;

    normalizeTextLabels();

    LABELS.forEach(label => {
      const exists = $$("a,button,span", nav).some(el => clean(el.textContent) === label);

      if (!exists) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = "aiways-nav-managed aiways-mobile-added-nav";
        button.style.background = "transparent";
        button.style.border = "0";
        button.style.cursor = "pointer";
        button.style.font = "inherit";
        nav.appendChild(button);
      }
    });

    dedupeNavItems(nav);

    $$("a,button,span", nav).forEach(el => {
      const label = clean(el.textContent);
      if (!LABELS.includes(label)) return;

      el.classList.add("aiways-nav-managed");

      if (el.dataset.mobileSlideNavBound === "1") return;
      el.dataset.mobileSlideNavBound = "1";

      el.addEventListener("click", event => {
        if (!isMobile()) return;

        const pages = applySlides();
        const target = pages.find(page => page.label === label);

        if (!target) return;

        event.preventDefault();
        target.el.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

        setActiveNav(label);
      }, true);
    });
  }

  function setActiveNav(label) {
    const nav = getNavRoot();
    if (!nav) return;

    $$("a,button,span", nav).forEach(el => {
      const text = clean(el.textContent);
      if (!LABELS.includes(text)) return;

      const active = text === label;

      el.classList.toggle("aiways-nav-active", active);
      el.classList.toggle("aiways-final-nav-lit", active);
      el.classList.toggle("aiways-master-nav-active", false);
      el.classList.toggle("aiways-restore-nav-active", false);
      el.classList.toggle("aiways-output-nav-active", false);
      el.setAttribute("aria-current", active ? "page" : "false");

      if (active && isMobile()) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }
    });
  }

  function installObserver() {
    if (observer) observer.disconnect();

    const pages = applySlides();

    if (!isMobile() || !pages.length) return;

    observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      const label = visible.target.dataset.mobileLabel;
      if (label) setActiveNav(label);
    }, {
      root: null,
      threshold: [0.55, 0.68, 0.8],
      rootMargin: "-8% 0px -18% 0px"
    });

    pages.forEach(page => observer.observe(page.el));
  }

  function fixOverflowNow() {
    if (!isMobile()) return;

    $$("body *").forEach(el => {
      const rect = el.getBoundingClientRect();

      if (rect.width > window.innerWidth + 8) {
        el.style.maxWidth = "100%";
        el.style.minWidth = "0";
      }
    });
  }

  function run() {
    normalizeTextLabels();
    ensureNav();
    applySlides();
    installObserver();

    requestAnimationFrame(fixOverflowNow);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  window.addEventListener("resize", () => {
    setTimeout(run, 120);
  }, { passive: true });

  window.addEventListener("orientationchange", () => {
    setTimeout(run, 260);
  }, { passive: true });

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    run();

    if (tries >= 12) clearInterval(timer);
  }, 420);
})();
