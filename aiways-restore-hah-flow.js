(() => {
  const NAV_ORDER = ["대시보드", "프로젝트", "교육과정", "H-A-H", "차시흐름", "산출물"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

  function header(){
    return $("header") || $(".site-header") || $(".header");
  }

  function navRoot(){
    const h = header();
    if (!h) return null;
    return $("nav", h) || $('[class*="nav"]', h) || h;
  }

  function normalizeNav(){
    const nav = navRoot();
    if (!nav) return;

    $$("a,button,span", nav).forEach(el => {
      if (text(el) === "6차시") el.textContent = "차시흐름";
    });

    const links = $$("a,button,span", nav).filter(el => {
      return ["대시보드", "프로젝트", "교육과정", "H-A-H", "차시흐름", "산출물"].includes(text(el));
    });

    if (!links.length) return;

    function ensure(label, beforeLabel){
      if ($$("a,button,span", nav).some(el => text(el) === label)) return;

      const ref = $$("a,button,span", nav).find(el => text(el) === beforeLabel) || links[0];
      if (!ref || !ref.parentElement) return;

      const node = document.createElement(ref.tagName.toLowerCase());
      node.textContent = label;
      node.className = ref.className || "";
      if (node.tagName.toLowerCase() === "a") node.setAttribute("href", "#");
      ref.parentElement.insertBefore(node, ref);
    }

    ensure("대시보드", "프로젝트");
    ensure("H-A-H", "차시흐름");
    ensure("차시흐름", "산출물");
  }

  function sections(){
    const candidates = $$("main > section, body > section, section, article, [data-section], .aiw-page-section, [class*='page-section']").filter(el => {
      const rect = el.getBoundingClientRect();
      const t = text(el);

      return rect.width > 420
        && rect.height > 220
        && t.length > 20
        && !el.classList.contains("aiways-output-removed")
        && !el.classList.contains("aiways-final-removed");
    });

    const unique = [];
    candidates.forEach(el => {
      if (unique.some(parent => parent.contains(el))) return;
      unique.push(el);
    });

    return unique;
  }

  function findSectionByText(words){
    return sections().find(sec => {
      const t = text(sec);
      return words.some(word => t.includes(word));
    }) || null;
  }

  function curriculumSection(){
    return findSectionByText([
      "교육과정 기반 수업설계",
      "Curriculum-Based Learning Design",
      "연계 성취기준"
    ]);
  }

  function firstOutputSection(){
    return findSectionByText([
      "학생 산출물 갤러리",
      "3초 판단 앱",
      "3-Second Sorting Helper App",
      "리소스",
      "Resource",
      "Resources",
      "Output"
    ]);
  }

  function hahMarkup(){
    return `
      <div class="aiways-restore-wrap">
        <div class="aiways-restore-kicker">H-A-H Learning Loop</div>
        <h2 class="aiways-restore-title">사람이 발견하고,<br>AI로 넓히고,<br>다시 사람이 결정합니다.</h2>
        <p class="aiways-restore-subtitle">
          AIWays Incheon의 핵심은 AI에게 판단을 맡기는 것이 아니라,
          학생이 자기 삶의 문제를 발견하고 AI를 조력자로 활용한 뒤
          사람의 기준으로 다시 검증하는 Human → AI → Human의 학습 루프입니다.
        </p>

        <div class="aiways-hah-grid">
          <div class="aiways-hah-card">
            <div class="aiways-hah-number">H1</div>
            <h3>문제 발견</h3>
            <p>교실과 가정에서 실제로 헷갈리고 불편했던 분리배출 경험을 VOC로 모읍니다.</p>
            <div class="aiways-hah-list">
              <div>· 교실·복도 쓰레기통 관찰</div>
              <div>· 가정 분리배출 불편 데이터 수집</div>
              <div>· 인천 수도권매립지 문제와 연결</div>
            </div>
          </div>

          <div class="aiways-hah-card">
            <div class="aiways-hah-number">AI</div>
            <h3>아이디어 확장</h3>
            <p>생성형 AI와 함께 학교 쓰레기 문제를 해결할 UX 기능 후보를 넓게 탐색합니다.</p>
            <div class="aiways-hah-list">
              <div>· 3초 판단 앱</div>
              <div>· 판단 보류함</div>
              <div>· 가이드선·퀴즈·랭킹 대시보드</div>
            </div>
          </div>

          <div class="aiways-hah-card">
            <div class="aiways-hah-number">H2</div>
            <h3>인간 검증</h3>
            <p>AI 제안을 맹신하지 않고, 우리 교실에 맞는 기준으로 걸러 최종 솔루션을 결정합니다.</p>
            <div class="aiways-hah-list">
              <div>· 실현 가능성</div>
              <div>· 환경 효과</div>
              <div>· 지속 가능성·공동체성</div>
            </div>
          </div>
        </div>

        <div class="aiways-hah-loop">
          H-A-H의 결론은 “AI가 대신 생각한다”가 아니라 “AI 덕분에 더 넓게 보고, 사람이 더 책임 있게 판단한다”입니다.
        </div>
      </div>
    `;
  }

  function flowMarkup(){
    return `
      <div class="aiways-restore-wrap">
        <div class="aiways-flow-layout">
          <div class="aiways-flow-left">
            <div class="aiways-restore-kicker">6-Lesson Journey</div>
            <h2 class="aiways-restore-title">6차시 여정</h2>
            <p class="aiways-restore-subtitle">
              문제 발견에서 AI 활용, 인간 검증, 블록코딩, 바이브코딩, 대시보드 체험까지
              이틀 수업 안에서 산출물로 이어지는 흐름입니다.
            </p>

            <div class="aiways-flow-callout">
              <strong>수업의 핵심 산출물</strong>
              <span>
                학생 VOC, 딜레마 토론 이젤패드, 엔트리 이미지 분류 결과,
                바이브코딩 프롬프트, 3초 판단 앱 기록, 우리반 자원순환 대시보드가 연결됩니다.
              </span>
            </div>
          </div>

          <div class="aiways-flow-grid">
            <div class="aiways-flow-card">
              <small>1~2차시 · Human 1</small>
              <h3>환경을 강요하지 않는 문제 발견</h3>
              <p>나와 가족의 진짜 불편함에서 출발해 교실 쓰레기통과 인천 매립지 문제를 연결합니다.</p>
            </div>

            <div class="aiways-flow-card">
              <small>3차시 · AI</small>
              <h3>생성형 AI로 아이디어 확장</h3>
              <p>우리 학교 오배출을 줄일 UX 솔루션을 AI와 브레인스토밍하고 후보 기능을 넓힙니다.</p>
            </div>

            <div class="aiways-flow-card">
              <small>4차시 · Human 2</small>
              <h3>딜레마 토론과 인간 검증</h3>
              <p>AI 제안을 실현 가능성·환경 효과·지속 가능성·공동체성으로 평가해 결정합니다.</p>
            </div>

            <div class="aiways-flow-card">
              <small>5차시 · Coding</small>
              <h3>블록코딩과 바이브코딩</h3>
              <p>엔트리 이미지 분류를 체험하고, 바이브코딩으로 판단 카드·퀴즈·보류함 개선안을 만듭니다.</p>
            </div>

            <div class="aiways-flow-card">
              <small>6차시 · Dashboard</small>
              <h3>대시보드 체험과 실전 배포</h3>
              <p>3초 판단 앱과 대시보드에 기록을 쌓고, 헷갈린 물건 TOP 5를 다음 토론 근거로 사용합니다.</p>
            </div>

            <div class="aiways-flow-card">
              <small>확산 · Output</small>
              <h3>산출물 공유</h3>
              <p>학생 산출물 갤러리와 3초 판단 앱을 통해 다른 선생님도 따라할 수 있는 형태로 정리합니다.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function upsertPages(){
    const curriculum = curriculumSection();
    if (!curriculum) return;

    let hah = $("#aiways-restore-hah-page");
    if (!hah) {
      hah = document.createElement("section");
      hah.id = "aiways-restore-hah-page";
      hah.className = "aiways-restore-page aiw-page-section";
    }

    let flow = $("#aiways-restore-flow-page");
    if (!flow) {
      flow = document.createElement("section");
      flow.id = "aiways-restore-flow-page";
      flow.className = "aiways-restore-page aiw-page-section";
    }

    hah.innerHTML = hahMarkup();
    flow.innerHTML = flowMarkup();

    hah.classList.remove("aiways-output-removed", "aiways-final-removed");
    flow.classList.remove("aiways-output-removed", "aiways-final-removed");

    curriculum.insertAdjacentElement("afterend", flow);
    curriculum.insertAdjacentElement("afterend", hah);
  }

  function labelForSection(sec, index, list){
    const t = text(sec);

    if (sec.id === "aiways-restore-hah-page") return "H-A-H";
    if (sec.id === "aiways-restore-flow-page") return "차시흐름";

    if (t.includes("버리는 순간") && t.includes("데이터가 되다") && t.includes("AIWays Incheon은")) return "대시보드";
    if (t.includes("교육과정 기반 수업설계") || t.includes("Curriculum-Based Learning Design")) return "교육과정";
    if (t.includes("H-A-H") && !t.includes("3-Second Sorting Helper App") && !t.includes("버려지는 순간을 기록하세요")) return "H-A-H";
    if (t.includes("6차시 여정") || t.includes("차시흐름") || t.includes("1~2차시") || t.includes("5차시")) return "차시흐름";

    if (
      t.includes("학생 산출물 갤러리") ||
      t.includes("3초 판단 앱") ||
      t.includes("3-Second Sorting Helper App") ||
      t.includes("버려지는 순간을 기록하세요") ||
      t.includes("리소스") ||
      t.includes("Resource") ||
      t.includes("Resources") ||
      t.includes("Output")
    ) {
      return "산출물";
    }

    const flowIndex = list.findIndex(item => item.id === "aiways-restore-flow-page" || text(item).includes("6차시 여정"));
    if (flowIndex >= 0 && index > flowIndex) return "산출물";

    return null;
  }

  function currentSection(){
    const list = sections();
    const center = window.scrollY + window.innerHeight * 0.48;

    let best = list[0] || null;
    let bestDistance = Infinity;

    list.forEach(sec => {
      const mid = sec.offsetTop + sec.offsetHeight * 0.46;
      const dist = Math.abs(mid - center);

      if (dist < bestDistance) {
        bestDistance = dist;
        best = sec;
      }
    });

    return { best, list };
  }

  function updateNav(){
    normalizeNav();

    const nav = navRoot();
    if (!nav) return;

    const { best, list } = currentSection();
    if (!best) return;

    const activeLabel = labelForSection(best, list.indexOf(best), list);
    const items = $$("a,button,span", nav).filter(el => NAV_ORDER.includes(text(el)));

    items.forEach(el => {
      const active = text(el) === activeLabel;

      el.classList.toggle("aiways-restore-nav-active", active);
      el.classList.toggle("aiways-output-nav-active", active);
      el.classList.toggle("aiways-final-active", active);
      el.classList.toggle("aiw-nav-active", active);
      el.classList.toggle("op-current", active);
    });
  }

  function bindNavClicks(){
    const nav = navRoot();
    if (!nav) return;

    $$("a,button,span", nav).forEach(item => {
      const label = text(item);
      if (!NAV_ORDER.includes(label)) return;
      if (item.dataset.aiwaysRestoreClickBound === "1") return;

      item.dataset.aiwaysRestoreClickBound = "1";

      item.addEventListener("click", event => {
        const currentSections = sections();
        let target = null;

        if (label === "대시보드") {
          target = currentSections.find(sec => labelForSection(sec, currentSections.indexOf(sec), currentSections) === "대시보드");
        } else if (label === "교육과정") {
          target = curriculumSection();
        } else if (label === "H-A-H") {
          target = $("#aiways-restore-hah-page");
        } else if (label === "차시흐름") {
          target = $("#aiways-restore-flow-page");
        } else if (label === "산출물") {
          target = firstOutputSection();
        }

        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior:"smooth", block:"start" });
      }, true);
    });
  }

  function boot(){
    normalizeNav();
    upsertPages();
    bindNavClicks();
    updateNav();

    window.addEventListener("scroll", updateNav, { passive:true });
    window.addEventListener("resize", updateNav, { passive:true });

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      normalizeNav();
      upsertPages();
      bindNavClicks();
      updateNav();

      if (tries >= 16) clearInterval(timer);
    }, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once:true });
  } else {
    boot();
  }
})();
