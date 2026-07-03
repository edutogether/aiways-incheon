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

  const ACTIVE_CLASSES = [
    "aiways-fl-nav-active",
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

  const TEXTBOOK_LINKS = [
    { subject: "실과", platform: "미래엔 엠티처", url: "https://www.m-teacher.co.kr/" },
    { subject: "사회", platform: "아이스크림 교과서", url: "https://text.i-scream.co.kr/" },
    { subject: "국어", platform: "T셀파", url: "https://www.tsherpa.co.kr/" }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => (value || "").replace(/\s+/g, " ").trim();

  let currentLabel = null;
  let scrollStopTimer = null;
  let lightTimer = null;
  let rafPending = false;
  let mutationTimer = null;

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

    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0;
  }

  function normalizeLabels() {
    $$("a,button,span,h1,h2,h3,h4,p,div").forEach(el => {
      const text = clean(el.textContent);

      if (text === "산출물") el.textContent = "갤러리";
      if (text === "6차시") el.textContent = "차시흐름";
      if (text === "3초 판단 앱" || text === "3초판단앱") el.textContent = "3초판단";
      if (text === "PLAY BOOK" || text === "Play Book" || text === "Playbook") el.textContent = "플레이북";
    });
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

      item.el.classList.add("aiways-fl-page", "aiways-one-page");
      item.el.dataset.aiwaysOneLabel = item.label;

      if (item.label === "차시흐름") {
        item.el.dataset.mobileLabel = "차시흐름";
      }

      pages.push({
        el: item.el,
        label: item.label,
        top: item.el.offsetTop,
        height: item.el.offsetHeight || rect.height
      });
    });

    return pages.sort((a, b) => a.top - b.top);
  }

  function pageCandidates() {
    const pages = explicitPageCandidates();
    if (pages.length >= 5) return pages;

    return $$("main > section, main > article, body > section, body > article")
      .filter(isVisible)
      .map(el => {
        const text = clean(el.textContent);
        let label = null;

        if (text.includes("버리는 순간") && text.includes("데이터가 되다")) label = "대시보드";
        else if (text.includes("포스터를 만드는 수업이 아니라")) label = "프로젝트";
        else if (text.includes("교육과정")) label = "교육과정";
        else if (text.includes("H-A-H") || text.includes("사람이 발견하고")) label = "H-A-H";
        else if (text.includes("차시흐름") || text.includes("6차시")) label = "차시흐름";
        else if (text.includes("갤러리") || text.includes("학생 산출물")) label = "갤러리";
        else if (text.includes("3초")) label = "3초판단";
        else if (text.includes("PLAY BOOK") || text.includes("플레이북")) label = "플레이북";

        return label ? { el, label, top: el.offsetTop, height: el.offsetHeight } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.top - b.top);
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

  function orderNavItems(nav) {
    const cta = $(".aiw-nav-cta", nav) || null;

    NAV_ORDER.forEach(label => {
      const item = $$("a,button,span", nav).find(el => clean(el.textContent) === label);
      if (item && item.nextElementSibling !== cta) nav.insertBefore(item, cta);
    });
  }

  function ensureNavItems() {
    const nav = getNavRoot();
    if (!nav) return;

    normalizeLabels();

    NAV_ORDER.forEach(label => {
      const exists = $$("a,button,span", nav).some(el => clean(el.textContent) === label);
      if (exists) return;

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = "aiways-fl-nav";
      button.style.background = "transparent";
      button.style.border = "0";
      button.style.cursor = "pointer";
      button.style.font = "inherit";
      nav.appendChild(button);
    });

    dedupeNavItems(nav);
    orderNavItems(nav);

    $$("a,button,span", nav).forEach(el => {
      const label = clean(el.textContent);
      if (!NAV_ORDER.includes(label)) return;

      el.classList.add("aiways-fl-nav");

      if (el.dataset.aiwaysFastNavBound === "1") return;
      el.dataset.aiwaysFastNavBound = "1";

      el.addEventListener("click", event => {
        const targetLabel = clean(el.textContent);
        const target = pageCandidates().find(page => page.label === targetLabel);
        if (!target) return;

        event.preventDefault();

        const header = getHeader();
        const headerHeight = header ? header.getBoundingClientRect().height : 68;
        const top = Math.max(0, target.el.offsetTop - headerHeight + 2);

        setNavActive(targetLabel);
        startScrolling();

        window.scrollTo({ top, behavior: "smooth" });

        clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(stopScrolling, 280);
      }, true);
    });
  }

  function currentPage() {
    const pages = pageCandidates();
    if (!pages.length) return null;

    const header = getHeader();
    const headerHeight = header ? header.getBoundingClientRect().height : 68;
    const anchorY = headerHeight + Math.max(80, (window.innerHeight - headerHeight) * 0.32);
    let best = pages[0];
    let bestScore = Infinity;

    pages.forEach(page => {
      const rect = page.el.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, headerHeight));
      const ratio = visible / Math.max(1, Math.min(window.innerHeight - headerHeight, rect.height));
      const center = rect.top + rect.height * 0.32;
      let score = Math.abs(center - anchorY) - ratio * 250;

      if (rect.top <= anchorY && rect.bottom >= anchorY) score -= 360;

      if (score < bestScore) {
        bestScore = score;
        best = page;
      }
    });

    return best;
  }

  function setNavActive(label) {
    const nav = getNavRoot();
    if (!nav || !label) return;

    $$("a,button,span", nav).forEach(el => {
      const navLabel = clean(el.textContent);
      if (!NAV_ORDER.includes(navLabel)) return;

      ACTIVE_CLASSES.forEach(cls => el.classList.remove(cls));

      const active = navLabel === label;
      el.classList.toggle("aiways-fl-nav-active", active);
      el.classList.toggle("aiways-nav-active", active);
      el.setAttribute("aria-current", active ? "page" : "false");
    });

    currentLabel = label;
  }

  function clearPageLight() {
    $$(".aiways-fl-page").forEach(el => {
      el.classList.remove(
        "aiways-fl-lit",
        "aiways-one-page-lit",
        "aiways-final-scroll-lit",
        "aiways-master-page-active",
        "aiways-scroll-light-active",
        "aiw-page-active"
      );
    });
  }

  function lightCurrentPage(delay = 42) {
    const page = currentPage();
    if (!page) return;

    setNavActive(page.label);

    clearTimeout(lightTimer);
    lightTimer = setTimeout(() => {
      clearPageLight();
      requestAnimationFrame(() => {
        page.el.classList.add("aiways-fl-lit", "aiways-one-page-lit", "aiw-page-active");
      });
    }, delay);
  }

  function startScrolling() {
    document.body.classList.add("aiways-fl-scrolling", "aiways-one-is-scrolling");

    clearTimeout(lightTimer);
    clearPageLight();

    const page = currentPage();
    if (page) setNavActive(page.label);
  }

  function stopScrolling() {
    document.body.classList.remove("aiways-fl-scrolling", "aiways-one-is-scrolling");
    lightCurrentPage(42);
  }

  function onScroll() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        startScrolling();
      });
    }

    clearTimeout(scrollStopTimer);
    scrollStopTimer = setTimeout(stopScrolling, 62);
  }

  function replaceFlowPage() {
    const page = $("#aiways-restore-flow-page") || $("#lesson") || pageCandidates().find(item => item.label === "차시흐름")?.el;
    if (!page) return;
    if (page.dataset.aiwaysFastFlowApplied === "1" && $(".aiways-fast-flow-card", page)) return;

    page.dataset.aiwaysFastFlowApplied = "1";
    page.classList.add("aiways-fast-flow-page", "aiways-fl-page", "aiways-one-page");
    page.dataset.aiwaysOneLabel = "차시흐름";
    page.dataset.mobileLabel = "차시흐름";

    page.innerHTML = `
      <div class="aiways-fast-flow-wrap aiways-mobile-slide-inner">
        <div>
          <div class="aiways-fast-flow-kicker">6-Lesson Journey + Experience + Sharing</div>
          <h1 class="aiways-fast-flow-title">차시흐름</h1>
          <p class="aiways-fast-flow-sub">
            문제 발견에서 AI 활용, 인간 검증, 블록코딩·티처블머신·바이브코딩을 거쳐
            대시보드 체험과 배포·공유까지 이어지는 수업 여정입니다.
          </p>
        </div>

        <div class="aiways-fast-flow-grid">
          <article class="aiways-fast-flow-card">
            <span class="aiways-fast-flow-step">1차시 · Human 1</span>
            <h3>환경을 강요하지 않는 문제 발견</h3>
            <p>분리배출을 시키기 전에, 학생이 실제로 헷갈리고 불편했던 순간을 먼저 모읍니다.</p>
            <ul>
              <li>교실·복도 쓰레기통 관찰</li>
              <li>가정 분리배출 불편 VOC 수집</li>
              <li>인천 수도권매립지 문제와 연결</li>
            </ul>
          </article>

          <article class="aiways-fast-flow-card">
            <span class="aiways-fast-flow-step">2차시 · AI</span>
            <h3>생성형 AI로 아이디어 확장</h3>
            <p>AI와 함께 학교 쓰레기 문제를 해결할 UX 후보를 넓게 탐색합니다.</p>
            <ul>
              <li>3초 판단 앱</li>
              <li>판단 보류함</li>
              <li>가이드선·퀴즈·랭킹 대시보드</li>
            </ul>
          </article>

          <article class="aiways-fast-flow-card">
            <span class="aiways-fast-flow-step">3차시 · Human 2</span>
            <h3>인간 검증과 딜레마 토론</h3>
            <p>AI 제안을 그대로 믿지 않고, 우리 교실에 맞는 기준으로 걸러 최종 선택합니다.</p>
            <ul>
              <li>실현 가능성</li>
              <li>환경 효과</li>
              <li>지속 가능성·공동체성</li>
            </ul>
          </article>

          <article class="aiways-fast-flow-card">
            <span class="aiways-fast-flow-step">4차시 · 블록코딩</span>
            <h3>이미지 분류 개념 이해</h3>
            <p>엔트리 같은 저버전 코딩으로 이미지 분류의 필요성과 원리를 쉽게 체험합니다.</p>
            <ul>
              <li>사진 데이터가 분류 기준이 되는 과정 이해</li>
              <li>AI가 왜 헷갈리는지 확인</li>
              <li>사람 최종 판단의 필요성 정리</li>
            </ul>
          </article>

          <article class="aiways-fast-flow-card">
            <span class="aiways-fast-flow-step">5차시 · Teachable Machine</span>
            <h3>우리반 AI 모델 학습</h3>
            <p>학생들이 찍은 교실 물건 사진으로 우리반 분리배출 모델을 학습시킵니다.</p>
            <ul>
              <li>플라스틱류·종이류·종이팩·캔류·비닐류</li>
              <li>기타·판단보류 클래스 만들기</li>
              <li>모델 URL을 3초 판단 앱에 연결</li>
            </ul>
          </article>

          <article class="aiways-fast-flow-card">
            <span class="aiways-fast-flow-step">6차시 · 바이브코딩</span>
            <h3>앱 기능을 말로 설계하고 개선</h3>
            <p>학생이 원하는 기능을 자연어로 설명하고, AI와 함께 앱 개선 방향을 구체화합니다.</p>
            <ul>
              <li>판단 카드 문구 개선</li>
              <li>보류 사유 버튼 추가 아이디어</li>
              <li>퀴즈·랭킹·대시보드 기능 제안</li>
            </ul>
          </article>

          <article class="aiways-fast-flow-card">
            <span class="aiways-fast-flow-step">체험 · Dashboard</span>
            <h3>교사 제작 대시보드 활용</h3>
            <p>교사가 만든 대시보드에서 우리반 데이터가 어떻게 쌓이고 읽히는지 체험합니다.</p>
            <ul>
              <li>오늘 관찰 수 확인</li>
              <li>판단 보류 TOP 5 확인</li>
              <li>다음 토론 주제 찾기</li>
            </ul>
          </article>

          <article class="aiways-fast-flow-card">
            <span class="aiways-fast-flow-step">배포 및 공유</span>
            <h3>수업 결과를 밖으로 연결</h3>
            <p>앱, 대시보드, 학생 산출물을 정리해 다른 반과 선생님들이 따라 할 수 있게 공유합니다.</p>
            <ul>
              <li>홈페이지·QR로 공유</li>
              <li>학생 산출물 갤러리 정리</li>
              <li>깃허브·패들렛·구글문서 연결</li>
            </ul>
          </article>
        </div>
      </div>
    `;
  }

  function findCurriculumPage() {
    return $("#curriculum") || pageCandidates().find(page => page.label === "교육과정")?.el || null;
  }

  function replaceTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      node.nodeValue = node.nodeValue.replaceAll("실제 학교 문제 해결", "실제 문제");
    });
  }

  function addTextbookLinks() {
    const page = findCurriculumPage();
    if (!page) return;

    replaceTextNodes(page);

    TEXTBOOK_LINKS.forEach(item => {
      if ($(`[data-aiways-textbook="${item.subject}"]`, page)) return;

      const candidates = $$("article,section,li,div", page)
        .filter(el => {
          const text = clean(el.textContent);
          const rect = el.getBoundingClientRect();

          return rect.width > 120 &&
            rect.height > 34 &&
            text.includes(item.subject) &&
            !text.includes(item.platform);
        })
        .sort((a, b) => {
          const ar = a.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          return (ar.width * ar.height) - (br.width * br.height);
        });

      const target = candidates[0];
      if (!target) return;

      const link = document.createElement("a");
      link.className = "aiways-textbook-link";
      link.dataset.aiwaysTextbook = item.subject;
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${item.platform} 열기`;

      target.appendChild(link);
    });
  }

  function bootOnce(light = false) {
    normalizeLabels();
    replaceFlowPage();
    ensureNavItems();
    addTextbookLinks();
    pageCandidates();

    const page = currentPage();
    if (page) {
      setNavActive(page.label);
      if (light || !$(".aiways-fl-lit")) lightCurrentPage(60);
    }
  }

  function boot() {
    bootOnce(true);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      bootOnce(false);
      stopScrolling();
    }, { passive: true });

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      bootOnce(false);
      if (tries >= 30) clearInterval(timer);
    }, 360);

    const observer = new MutationObserver(() => {
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(() => {
        normalizeLabels();
        replaceFlowPage();
        addTextbookLinks();
      }, 80);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
