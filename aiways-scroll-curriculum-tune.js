(() => {
  const SECTION_IDS = ["project", "curriculum", "hah", "lesson", "outputs", "playbook"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const norm = value => (value || "").replace(/\s+/g, " ").trim();

  let sections = [];
  let navLinks = [];
  let rafId = 0;

  function patchProjectFrame() {
    const section = $("#project");
    if (!section) return;

    const eyebrow = $(".eyebrow", section);
    if (eyebrow) {
      eyebrow.textContent = "버리는 순간을 데이터로 바꾸다.";
      eyebrow.classList.add("aiw-project-slogan");
    }

    const title = $("h2", section);
    if (title) title.classList.add("aiw-slogan-title");
  }

  function curriculumMarkup() {
    return `
      <div class="aiw-curriculum-compact-panel">
        <div class="aiw-curriculum-inner">
          <div class="aiw-curriculum-kicker">Curriculum-Based Learning Design</div>
          <h2 class="aiw-curriculum-title">교육과정 기반 수업설계</h2>
          <p class="aiw-curriculum-desc">
            이 프로젝트는 생활 자원 관리, 지역사회 문제 해결, 자료 기반 토의·토론,
            창의적 체험활동을 하나의 흐름으로 묶어 “버리는 순간”을 학교 자원순환 UX 개선으로 연결하는 융합형 수업입니다.
          </p>

          <div class="aiw-curriculum-grid">
            <article class="aiw-curriculum-card">
              <strong>실과</strong>
              <p>생활 자원 관리, 합리적 소비, 재활용·재사용 실천을 실제 문제와 연결합니다.</p>
            </article>

            <article class="aiw-curriculum-card">
              <strong>사회</strong>
              <p>인천 수도권매립지와 자원순환 문제를 생활권 기반 지역사회 문제로 탐구합니다.</p>
            </article>

            <article class="aiw-curriculum-card">
              <strong>국어</strong>
              <p>AI 제안과 자료를 근거로 비교하고, 딜레마 토론과 설득적 표현으로 판단을 조정합니다.</p>
            </article>

            <article class="aiw-curriculum-card">
              <strong>창의적 체험활동</strong>
              <p>3초 판단 도우미, 판단 보류함, 대시보드 점검을 교실 밖 실천과 확산으로 이어갑니다.</p>
            </article>
          </div>

          <div class="aiw-standard-wrap">
            <div class="aiw-standard-head">
              <strong>연계 성취기준</strong>
              <span>2022 개정 교육과정 기반 · 자원순환 UX 프로젝트 적용</span>
            </div>

            <div class="aiw-standard-grid">
              <article class="aiw-standard-chip">
                <b>6실02-03</b>
                <em>생활 자원의 올바른 사용과 환경을 고려한 재활용·재사용 실천</em>
              </article>

              <article class="aiw-standard-chip">
                <b>6실05-03</b>
                <em>실생활 문제 해결 프로그램을 협력하여 작성하고 산출물 공유</em>
              </article>

              <article class="aiw-standard-chip">
                <b>6실05-04</b>
                <em>디지털·아날로그 데이터의 특징과 AI 활용 데이터 유형 탐색</em>
              </article>

              <article class="aiw-standard-chip">
                <b>6실05-05</b>
                <em>인공지능이 만들어지는 과정을 체험하고 사회적 영향 탐색</em>
              </article>

              <article class="aiw-standard-chip">
                <b>6사12-02</b>
                <em>지속 가능한 미래를 위한 지구촌 문제와 해결 방안 탐색</em>
              </article>

              <article class="aiw-standard-chip">
                <b>6국01-02</b>
                <em>주장과 근거의 타당성을 평가하며 듣고 토의·토론하기</em>
              </article>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function patchCurriculumSection() {
    const section = $("#curriculum");
    if (!section || section.dataset.aiwCurriculumPatched) return;

    section.dataset.aiwCurriculumPatched = "1";
    section.classList.add("aiw-curriculum-compact");
    section.innerHTML = curriculumMarkup();
  }

  function collectNavLinks() {
    navLinks = $$('header nav a[href^="#"], .aiw-nav a[href^="#"]').filter(link => {
      const id = link.getAttribute("href").slice(1);
      return SECTION_IDS.includes(id) || id === "classify";
    });
  }

  function collectSections() {
    sections = [
      $(".aiw-hero"),
      ...SECTION_IDS.map(id => document.getElementById(id)),
    ].filter(Boolean);

    sections.forEach((section, index) => {
      section.classList.add("aiw-page-section");
      section.dataset.aiwSectionIndex = String(index);
      if (getComputedStyle(section).position === "static") section.style.position = "relative";
    });
  }

  function activeSectionId() {
    if (!sections.length) return "";

    const viewportCenter = window.scrollY + window.innerHeight * 0.48;
    let bestSection = sections[0];
    let bestDistance = Infinity;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const center = top + height * 0.46;
      const distance = Math.abs(center - viewportCenter);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestSection = section;
      }
    });

    return bestSection.id || "top";
  }

  function updateActiveStates() {
    const activeId = activeSectionId();

    sections.forEach(section => {
      const isActive = section.id ? section.id === activeId : activeId === "top";
      section.classList.toggle("aiw-page-active", isActive);
    });

    navLinks.forEach(link => {
      const id = link.getAttribute("href").slice(1);
      const isActive = id === activeId;
      link.classList.toggle("aiw-nav-active", isActive);
      link.classList.toggle("op-current", isActive);
    });
  }

  function requestActiveUpdate() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      updateActiveStates();
    });
  }

  function bindNavClicks() {
    navLinks.forEach(link => {
      if (link.dataset.aiwScrollCurriculumBound) return;
      link.dataset.aiwScrollCurriculumBound = "1";

      link.addEventListener("click", () => {
        const id = link.getAttribute("href").slice(1);
        const target = document.getElementById(id);
        if (!target) return;

        window.setTimeout(() => {
          updateActiveStates();
        }, 900);
      });
    });
  }

  function boot() {
    patchProjectFrame();
    patchCurriculumSection();
    collectNavLinks();
    collectSections();
    bindNavClicks();
    updateActiveStates();

    let retry = 0;
    const timer = window.setInterval(() => {
      retry += 1;
      patchProjectFrame();
      patchCurriculumSection();
      collectNavLinks();
      collectSections();
      bindNavClicks();
      updateActiveStates();
      if (retry >= 10) window.clearInterval(timer);
    }, 450);

    window.addEventListener("scroll", requestActiveUpdate, { passive: true });
    window.addEventListener("resize", () => {
      collectSections();
      requestActiveUpdate();
    }, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
