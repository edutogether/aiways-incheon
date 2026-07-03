(() => {
  const NAV_ORDER = [
    "대시보드",
    "프로젝트",
    "교육과정",
    "H-A-H",
    "차시흐름",
    "갤러리",
    "3초판단",
    "플레이북"
  ];

  const ACTIVE_CLASS_NAMES = [
    "aiways-final-nav-lit",
    "aiways-master-nav-active",
    "aiways-restore-nav-active",
    "aiways-output-nav-active",
    "aiways-final-active",
    "aiw-nav-active",
    "op-current",
    "active",
    "current",
    "is-active"
  ];

  const PAGE_ACTIVE_CLASS_NAMES = [
    "aiways-final-scroll-lit",
    "aiways-master-page-active",
    "aiways-scroll-light-active",
    "aiw-page-active",
    "active",
    "current",
    "is-active"
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => (value || "").replace(/\s+/g, " ").trim();

  let currentLabel = null;
  let bodyLightTimer = null;
  let scrollStopTimer = null;
  let rafPending = false;
  let lastScrollY = window.scrollY;
  let lastActivePage = null;

  function getHeader() {
    return $("header") || $(".site-header") || $(".header");
  }

  function getNavRoot() {
    const header = getHeader();
    if (!header) return null;
    return $("nav", header) || $('[class*="nav"]', header) || header;
  }

  function isVisible(el) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return style.display !== "none"
      && style.visibility !== "hidden"
      && rect.width > 0
      && rect.height > 0;
  }

  function renameExactTitles() {
    const candidates = $$("a,button,span,h1,h2,h3,h4,p,div");

    candidates.forEach(el => {
      if (!isVisible(el)) return;

      const directText = Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.nodeValue)
        .join("")
        .trim();

      const full = clean(el.textContent);

      if (directText === "산출물" || full === "산출물") {
        el.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === "산출물") {
            node.nodeValue = node.nodeValue.replace("산출물", "갤러리");
          }
        });

        if (clean(el.textContent) === "산출물") el.textContent = "갤러리";
      }

      if (directText === "6차시" || full === "6차시") {
        el.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === "6차시") {
            node.nodeValue = node.nodeValue.replace("6차시", "차시흐름");
          }
        });

        if (clean(el.textContent) === "6차시") el.textContent = "차시흐름";
      }

      if (directText === "3초 판단 앱" || full === "3초 판단 앱") {
        el.textContent = "3초판단";
      }

      if (directText === "PLAY BOOK" || full === "PLAY BOOK") {
        el.textContent = "플레이북";
      }
    });
  }

  function dedupeNavItems(nav) {
    const seen = new Set();

    $$("a,button,span", nav).forEach(el => {
      const label = clean(el.textContent);
      if (!NAV_ORDER.includes(label)) return;

      if (seen.has(label)) {
        el.remove();
        return;
      }

      seen.add(label);
    });
  }

  function ensureNavItems() {
    const nav = getNavRoot();
    if (!nav) return;

    renameExactTitles();

    const existing = $$("a,button,span", nav).filter(el => {
      return NAV_ORDER.includes(clean(el.textContent));
    });

    existing.forEach(el => {
      el.classList.add("aiways-nav-managed");

      if (el.tagName.toLowerCase() === "a" && !el.getAttribute("href")) {
        el.setAttribute("href", "#");
      }

      if (el.tagName.toLowerCase() === "button") {
        el.setAttribute("type", "button");
      }
    });

    NAV_ORDER.forEach(label => {
      const exists = $$("a,button,span", nav).some(el => clean(el.textContent) === label);
      if (exists) return;

      const node = document.createElement("button");
      node.type = "button";
      node.textContent = label;
      node.className = "aiways-nav-managed aiways-nav-added";
      node.style.background = "transparent";
      node.style.border = "0";
      node.style.cursor = "pointer";
      node.style.font = "inherit";

      nav.appendChild(node);
    });

    dedupeNavItems(nav);

    $$("a,button,span", nav).forEach(el => {
      const label = clean(el.textContent);
      const managed = NAV_ORDER.includes(label);

      if (!managed) return;

      el.classList.add("aiways-nav-managed");

      if (el.dataset.aiwaysNavBound === "1") return;
      el.dataset.aiwaysNavBound = "1";

      el.addEventListener("click", event => {
        const targetLabel = clean(el.textContent);
        const targetPage = findPageByLabel(targetLabel);

        if (!targetPage) return;

        event.preventDefault();

        const header = getHeader();
        const headerHeight = header ? header.getBoundingClientRect().height : 68;
        const top = Math.max(0, targetPage.offsetTop - headerHeight + 2);

        startScrollingState();
        setNavActive(targetLabel);

        window.scrollTo({
          top,
          behavior: "smooth"
        });

        clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(() => {
          stopScrollingState();
        }, 520);
      }, true);
    });
  }

  function labelForText(t) {
    if (!t) return null;

    if (
      t.includes("버리는 순간") &&
      t.includes("데이터가 되다") &&
      t.includes("AIWays Incheon은") &&
      t.includes("우리학교 자원순환 대시보드")
    ) {
      return "대시보드";
    }

    if (
      t.includes("버리는 순간을 데이터로 바꾸다") ||
      t.includes("환경 보호 포스터를 만드는 수업이 아니라")
    ) {
      return "프로젝트";
    }

    if (
      t.includes("교육과정 기반 수업설계") ||
      t.includes("Curriculum-Based") ||
      t.includes("생활 자원 관리와 자원순환 실천") ||
      t.includes("실과") && t.includes("사회") && t.includes("국어") && t.includes("창의적 체험활동")
    ) {
      return "교육과정";
    }

    if (
      t.includes("H-A-H Learning Loop") ||
      t.includes("Human → AI → Human") ||
      t.includes("Human -> AI -> Human") ||
      t.includes("사람이 발견하고") ||
      t.includes("AI로 넓히고") && t.includes("다시 사람이 결정합니다") ||
      t.includes("문제 발견") && t.includes("아이디어 확장") && t.includes("인간 검증")
    ) {
      return "H-A-H";
    }

    if (
      t.includes("6-Lesson Journey") ||
      t.includes("6차시 여정") ||
      t.includes("차시흐름") ||
      t.includes("1~2차시") && t.includes("3차시") && t.includes("4차시") ||
      t.includes("5차시") && t.includes("대시보드 체험")
    ) {
      return "차시흐름";
    }

    if (
      t.includes("학생 산출물 갤러리") ||
      t.includes("갤러리") && t.includes("학생") && t.includes("산출")
    ) {
      return "갤러리";
    }

    if (
      t.includes("3초판단") ||
      t.includes("3초 판단") ||
      t.includes("3-Second Sorting Helper App") ||
      t.includes("버려지는 순간을 판단하세요")
    ) {
      return "3초판단";
    }

    if (
      t.includes("플레이북") ||
      t.includes("PLAY BOOK") ||
      t.includes("Play Book") ||
      t.includes("Playbook")
    ) {
      return "플레이북";
    }

    return null;
  }

  function markPage(item) {
    item.el.classList.add("aiways-one-page");
    item.el.dataset.aiwaysOneLabel = item.label;

    if (getComputedStyle(item.el).position === "static") {
      item.el.style.position = "relative";
    }
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

      const page = {
        el: item.el,
        label: item.label,
        top: item.el.offsetTop,
        height: item.el.offsetHeight || rect.height
      };

      markPage(page);
      pages.push(page);
    });

    return pages.sort((a, b) => a.top - b.top);
  }

  function pageCandidates() {
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
    const candidates = [];

    raw.forEach(el => {
      if (!el || seen.has(el)) return;
      seen.add(el);

      if (el === document.body || el === document.documentElement) return;
      if (!isVisible(el)) return;

      const rect = el.getBoundingClientRect();
      const height = el.offsetHeight || rect.height;
      const width = el.offsetWidth || rect.width;
      const t = clean(el.textContent);

      if (width < 420 || height < 300 || t.length < 25) return;
      if (height > window.innerHeight * 2.2 && !el.matches("main > section, main > article, main > div, body > section, body > article")) return;

      const label = labelForText(t);
      if (!label) return;

      candidates.push({ el, label, top: el.offsetTop, height });
    });

    candidates.sort((a, b) => {
      if (Math.abs(a.top - b.top) < 16) {
        return b.height - a.height;
      }
      return a.top - b.top;
    });

    const filtered = [];

    candidates.forEach(item => {
      const sameTop = filtered.find(prev => Math.abs(prev.top - item.top) < 16);

      if (!sameTop) {
        filtered.push(item);
        return;
      }

      if (item.height > sameTop.height && item.height < window.innerHeight * 2.2) {
        const index = filtered.indexOf(sameTop);
        filtered[index] = item;
      }
    });

    filtered.forEach(markPage);

    return filtered;
  }

  function findPageByLabel(label) {
    const pages = pageCandidates();
    return pages.find(item => item.label === label)?.el || null;
  }

  function currentPage() {
    const pages = pageCandidates();

    if (!pages.length) return null;

    const header = getHeader();
    const headerHeight = header ? header.getBoundingClientRect().height : 68;
    const anchorY = headerHeight + Math.max(110, (window.innerHeight - headerHeight) * 0.36);

    let best = pages[0];
    let bestScore = Infinity;

    pages.forEach(item => {
      const rect = item.el.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, headerHeight));
      const visibleRatio = visible / Math.max(1, Math.min(window.innerHeight - headerHeight, rect.height));
      const center = rect.top + rect.height * 0.38;

      let score = Math.abs(center - anchorY) - visibleRatio * 220;

      if (rect.top <= anchorY && rect.bottom >= anchorY) {
        score -= 320;
      }

      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    });

    return best;
  }

  function stripNavClasses(el) {
    ACTIVE_CLASS_NAMES.forEach(name => {
      if (name !== "active" && name !== "current" && name !== "is-active") {
        el.classList.remove(name);
      }
    });

    el.classList.remove("aiways-final-nav-lit");
    el.classList.remove("aiways-master-nav-active");
    el.classList.remove("aiways-restore-nav-active");
    el.classList.remove("aiways-output-nav-active");
    el.classList.remove("aiways-final-active");
    el.classList.remove("aiw-nav-active");
    el.classList.remove("op-current");
  }

  function setNavActive(label) {
    ensureNavItems();

    const nav = getNavRoot();
    if (!nav || !label) return;

    $$("a,button,span", nav).forEach(el => {
      const isManaged = NAV_ORDER.includes(clean(el.textContent));
      if (!isManaged) return;

      stripNavClasses(el);

      const active = clean(el.textContent) === label;
      el.classList.toggle("aiways-nav-active", active);
      el.setAttribute("aria-current", active ? "page" : "false");
    });

    currentLabel = label;
  }

  function clearPageLights() {
    $$(".aiways-one-page").forEach(el => {
      el.classList.remove("aiways-one-page-lit");

      PAGE_ACTIVE_CLASS_NAMES.forEach(name => {
        if (name !== "active" && name !== "current" && name !== "is-active") {
          el.classList.remove(name);
        }
      });

      el.classList.remove("aiways-final-scroll-lit");
      el.classList.remove("aiways-master-page-active");
      el.classList.remove("aiways-scroll-light-active");
      el.classList.remove("aiw-page-active");
    });
  }

  function setBodyLight(page) {
    if (!page) return;

    clearPageLights();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        page.el.classList.add("aiways-one-page-lit");
        page.el.classList.add("aiw-page-active");
        lastActivePage = page.el;
      });
    });
  }

  function syncNavImmediately() {
    const page = currentPage();
    if (!page) return;

    if (page.label !== currentLabel) {
      setNavActive(page.label);
    }
  }

  function startScrollingState() {
    document.body.classList.add("aiways-one-is-scrolling");
    clearTimeout(bodyLightTimer);
    clearPageLights();
    syncNavImmediately();
  }

  function stopScrollingState() {
    document.body.classList.remove("aiways-one-is-scrolling");

    const page = currentPage();
    if (!page) return;

    setNavActive(page.label);

    clearTimeout(bodyLightTimer);
    bodyLightTimer = setTimeout(() => {
      setBodyLight(page);
    }, 150);
  }

  function onScroll() {
    lastScrollY = window.scrollY;

    if (!rafPending) {
      rafPending = true;

      requestAnimationFrame(() => {
        rafPending = false;
        startScrollingState();
      });
    }

    clearTimeout(scrollStopTimer);
    scrollStopTimer = setTimeout(stopScrollingState, 95);
  }

  function hideScrollbarGhosts() {
    $$("body *").forEach(el => {
      if (el.dataset.aiwaysNavGhostChecked === "1") return;
      el.dataset.aiwaysNavGhostChecked = "1";

      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      const fixedOrSticky = style.position === "fixed" || style.position === "sticky";
      const nearRight = rect.right >= window.innerWidth - 18;
      const smallWidth = rect.width > 0 && rect.width <= 24;
      const scrollbarHeight = rect.height >= 24 && rect.height <= window.innerHeight * 0.5;
      const noText = clean(el.textContent).length === 0;
      const lowOpacity = Number(style.opacity || 1) < 0.95;

      if (fixedOrSticky && nearRight && smallWidth && scrollbarHeight && noText && lowOpacity) {
        el.classList.add("aiways-nav-scrollbar-ghost");
      }
    });
  }

  function bootOnce() {
    renameExactTitles();
    ensureNavItems();
    pageCandidates();
    hideScrollbarGhosts();

    const page = currentPage();
    if (page) {
      setNavActive(page.label);

      clearTimeout(bodyLightTimer);
      bodyLightTimer = setTimeout(() => {
        setBodyLight(page);
      }, 220);
    }
  }

  function boot() {
    bootOnce();

    window.addEventListener("scroll", onScroll, { passive: true });

    window.addEventListener("resize", () => {
      bootOnce();
      stopScrollingState();
    }, { passive: true });

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      bootOnce();

      if (tries >= 14) clearInterval(timer);
    }, 360);

    const observer = new MutationObserver(() => {
      renameExactTitles();
      ensureNavItems();
      pageCandidates();

      const page = currentPage();
      if (page) setNavActive(page.label);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
