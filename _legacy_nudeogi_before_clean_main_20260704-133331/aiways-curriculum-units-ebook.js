(() => {
  const EBOOK_LINKS = {
    silgwa: "https://e.m-teacher.co.kr/pages/ele/Main.mrn",
    social: "https://e.m-teacher.co.kr/pages/ele/Main.mrn",
    korean: "https://www.tsherpa.co.kr",
    creative: "https://e.m-teacher.co.kr/pages/ele/Main.mrn"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function curriculumCard(subject, unit, body, linkKey) {
    return `
      <article class="aiw-curriculum-card" data-ebook="${linkKey}" role="button" tabindex="0" aria-label="${subject} 교과서 E-book 열기">
        <strong>${subject}</strong>
        <span class="aiw-curriculum-unit">${unit}</span>
        <p>${body}</p>
      </article>
    `;
  }

  function curriculumMarkup() {
    return `
      <div class="aiw-curriculum-compact-panel">
        <div class="aiw-curriculum-inner">
          <div class="aiw-curriculum-kicker">Curriculum-Based Learning Design</div>
          <h2 class="aiw-curriculum-title">교육과정 기반 수업설계</h2>

          <p class="aiw-curriculum-desc">
            <span class="aiw-desc-line">이 프로젝트는 생활 자원 관리, 지역사회 문제 해결, 자료 기반 토의·토론, 창의적 체험활동을 하나의 흐름으로 묶어</span>
            <span class="aiw-desc-line">“버리는 순간”을 학교 자원순환 UX 개선으로 연결하는 융합형 수업입니다.</span>
          </p>

          <div class="aiw-curriculum-grid">
            ${curriculumCard(
              "실과",
              "생활 자원 관리와 자원순환 실천",
              "생활 자원의 올바른 사용, 재활용·재사용, 환경을 고려한 실천을 실제 문제와 연결합니다.",
              "silgwa"
            )}

            ${curriculumCard(
              "사회",
              "지속 가능한 지구촌 / 지역사회 문제 해결",
              "인천 수도권매립지와 자원순환 문제를 생활권 기반 지역사회 문제로 탐구합니다.",
              "social"
            )}

            ${curriculumCard(
              "국어",
              "자료를 바탕으로 토의·토론하기",
              "AI 제안과 자료를 근거로 비교하고, 딜레마 토론과 설득적 표현으로 판단을 조정합니다.",
              "korean"
            )}

            ${curriculumCard(
              "창의적 체험활동",
              "자율·동아리·진로 연계 실천 프로젝트",
              "3초 판단 도우미, 판단 보류함, 대시보드 점검을 교실 밖 실천과 확산으로 이어갑니다.",
              "creative"
            )}
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

  function bindEbookCards(section) {
    $$("[data-ebook]", section).forEach(card => {
      if (card.dataset.aiwaysEbookBound) return;
      card.dataset.aiwaysEbookBound = "1";

      const open = () => {
        const url = EBOOK_LINKS[card.dataset.ebook];
        if (!url) return;
        window.open(url, "_blank", "noopener,noreferrer");
      };

      card.addEventListener("click", open);
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function patchCurriculumSection() {
    const section = $("#curriculum");
    if (!section) return;

    if (section.dataset.aiwaysUnitsEbookPatched !== "1") {
      section.dataset.aiwaysUnitsEbookPatched = "1";
      section.dataset.aiwCurriculumPatched = "1";
      section.classList.add("aiw-curriculum-compact");
      section.innerHTML = curriculumMarkup();
    }

    bindEbookCards(section);
  }

  function boot() {
    patchCurriculumSection();

    let retry = 0;
    const timer = setInterval(() => {
      retry += 1;
      patchCurriculumSection();
      if (retry >= 10) clearInterval(timer);
    }, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
