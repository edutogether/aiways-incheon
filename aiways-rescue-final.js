
(() => {
  const NAV = ["대시보드", "프로젝트", "교육과정", "H-A-H", "차시흐름", "갤러리", "3초판단", "자료실"];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clean = v => (v || "").replace(/\s+/g, " ").trim();

  const flowItems = [
    ["1차시 · Human 1", "환경을 강요하지 않는 문제 발견", "분리배출을 시키기 전에, 학생이 실제로 헷갈리고 불편했던 순간을 먼저 모읍니다.", ["교실·복도 쓰레기통 관찰", "가정 분리배출 불편 VOC 수집", "인천 수도권매립지 문제와 연결"]],
    ["2차시 · AI", "생성형 AI로 아이디어 확장", "AI와 함께 학교 쓰레기 문제를 해결할 UX 후보를 넓게 탐색합니다.", ["3초 판단 앱", "판단 보류함", "가이드선·퀴즈·랭킹 대시보드"]],
    ["3차시 · Human 2", "인간 검증과 딜레마 토론", "AI 제안을 그대로 믿지 않고, 우리 교실에 맞는 기준으로 걸러 최종 선택합니다.", ["실현 가능성", "환경 효과", "지속 가능성·공동체성"]],
    ["4차시 · 블록코딩", "이미지 분류 개념 이해", "엔트리 같은 저버전 코딩으로 이미지 분류의 필요성과 원리를 쉽게 체험합니다.", ["사진 데이터가 분류 기준이 되는 과정 이해", "AI가 왜 헷갈리는지 확인", "사람 최종 판단의 필요성 정리"]],
    ["5차시 · Teachable Machine", "우리반 AI 모델 학습", "학생들이 찍은 교실 물건 사진으로 우리반 분리배출 모델을 학습시킵니다.", ["플라스틱류·종이류·종이팩·캔류·비닐류", "기타·판단보류 클래스 만들기", "모델 URL을 3초 판단 앱에 연결"]],
    ["6차시 · 바이브코딩", "앱 기능을 말로 설계하고 개선", "학생이 원하는 기능을 자연어로 설명하고, AI와 함께 앱 개선 방향을 구체화합니다.", ["판단 카드 문구 개선", "보류 사유 버튼 추가 아이디어", "퀴즈·랭킹·대시보드 기능 제안"]],
    ["체험 · Dashboard", "교사 제작 대시보드 활용", "교사가 만든 대시보드에서 우리반 데이터가 어떻게 쌓이고 읽히는지 체험합니다.", ["오늘 관찰 수 확인", "판단 보류 TOP 3 확인", "다음 토론 주제 찾기"]],
    ["배포 및 공유", "수업 결과를 밖으로 연결", "앱, 대시보드, 학생 산출물을 정리해 다른 반과 선생님들이 따라 할 수 있게 공유합니다.", ["홈페이지·QR로 공유", "학생 산출물 갤러리 정리", "깃허브·패들렛·구글문서 연결"]]
  ];

  function bigBoxContaining(...texts) {
    const nodes = $$("main > section, main > article, main > div, body > section, body > article, section, article, div")
      .filter(el => {
        if (el.closest("header")) return false;
        const t = clean(el.textContent);
        if (!texts.every(x => t.includes(x))) return false;
        const r = el.getBoundingClientRect();
        return r.width > 420 && r.height > 240;
      })
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.width * br.height - ar.width * ar.height;
      });

    return nodes[0] || null;
  }

  function sectionByLabel(label) {
    if (label === "대시보드") return bigBoxContaining("버리는 순간", "데이터가 되다") || bigBoxContaining("우리학교 자원순환 대시보드");
    if (label === "프로젝트") return document.querySelector("[data-rescue-label='프로젝트']") || bigBoxContaining("환경 보호", "포스터");
    if (label === "교육과정") return bigBoxContaining("교육과정 기반 수업설계") || bigBoxContaining("Curriculum-Based");
    if (label === "H-A-H") return bigBoxContaining("H-A-H Learning Loop") || bigBoxContaining("사람이 발견하고");
    if (label === "차시흐름") return document.querySelector("[data-rescue-label='차시흐름']") || bigBoxContaining("차시흐름") || bigBoxContaining("6차시 여정");
    if (label === "갤러리") return document.querySelector("[data-rescue-label='갤러리']") || bigBoxContaining("갤러리");
    if (label === "3초판단") return document.querySelector("#quick-app") || bigBoxContaining("3초판단") || bigBoxContaining("3-Second Sorting Helper App");
    if (label === "자료실") return document.querySelector("[data-rescue-label='자료실']") || bigBoxContaining("자료실") || bigBoxContaining("PLAY BOOK");
    return null;
  }

  function scrollToLabel(label) {
    const page = sectionByLabel(label);
    if (!page) return;

    const header = $("header") || $(".site-header") || $(".header");
    const h = header ? header.getBoundingClientRect().height : 68;

    window.scrollTo({
      top: Math.max(0, page.offsetTop - h + 2),
      behavior: "smooth"
    });
  }

  function cleanHeader() {
    const header = $("header") || $(".site-header") || $(".header");
    if (!header || header.dataset.rescueHeader === "1") return;

    header.dataset.rescueHeader = "1";
    header.classList.add("aiways-rescue-header");

    $$("a,button,span", header).forEach(el => {
      if (el.closest(".aiways-rescue-clean-nav")) return;
      const t = clean(el.textContent);

      if (
        NAV.includes(t) ||
        t.includes("자료실") ||
        t.includes("PLAY BOOK") ||
        t.includes("지금 버려지는") ||
        t.includes("지금 분류") ||
        t.includes("찰칵")
      ) {
        el.classList.add("aiways-rescue-old-nav-hidden");
      }
    });

    const nav = document.createElement("nav");
    nav.className = "aiways-rescue-clean-nav";

    NAV.forEach(label => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.dataset.rescueNav = label;
      btn.addEventListener("click", () => scrollToLabel(label));
      nav.appendChild(btn);
    });

    header.appendChild(nav);
  }

  function setActive(label) {
    $$("[data-rescue-nav]").forEach(btn => {
      btn.classList.toggle("aiways-rescue-active", btn.dataset.rescueNav === label);
    });
  }

  function updateActive() {
    const pages = NAV
      .map(label => ({ label, el: sectionByLabel(label) }))
      .filter(x => x.el);

    if (!pages.length) return;

    const header = $("header") || $(".site-header") || $(".header");
    const h = header ? header.getBoundingClientRect().height : 68;
    const y = h + (window.innerHeight - h) * 0.42;

    let best = pages[0];
    let bestScore = Infinity;

    pages.forEach(page => {
      const r = page.el.getBoundingClientRect();
      const center = r.top + r.height * 0.42;
      let score = Math.abs(center - y);

      if (r.top <= y && r.bottom >= y) score -= 260;

      if (score < bestScore) {
        bestScore = score;
        best = page;
      }
    });

    setActive(best.label);
  }

  function removeFloatingBox() {
    $$("body > div, body > span").forEach(el => {
      if (el.id === "aiwaysMfModal") return;
      if (el.closest("header")) return;

      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();

      if (
        style.position === "fixed" &&
        r.width <= 64 &&
        r.height <= 120 &&
        r.right > window.innerWidth - 90 &&
        r.bottom > window.innerHeight - 140
      ) {
        el.remove();
      }
    });
  }

  function fixHome() {
    const page = sectionByLabel("대시보드");
    if (!page) return;

    page.classList.add("aiways-rescue-page");
    page.dataset.rescueLabel = "대시보드";

    const copy = $$("p,div", page).find(el => {
      const t = clean(el.textContent);
      return t.includes("AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다") &&
        t.includes("H-A-H 기반 수업 프로젝트입니다");
    });

    if (copy) {
      copy.classList.add("aiways-rescue-hero-copy");
      copy.innerHTML = `
        AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다.<br>
        우리가 실제로 쓰레기를 버리는 순간을 관찰하고,<br>
        AI를 통해 데이터를 1차 판단한 뒤 사람이 중심이 되어 다시 확인하는,<br>
        우리 학교의 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.
      `;
    }

    const btns = $$("a,button", page).filter(el => {
      const t = clean(el.textContent);
      return t.includes("지금 버려지는 순간 찰칵") || t.includes("수업 설계 보기");
    });

    btns.forEach(btn => {
      const parent = btn.parentElement;
      if (parent) parent.classList.add("aiways-rescue-hero-buttons");
    });
  }

  function renderProject() {
    const page = sectionByLabel("프로젝트");
    if (!page || page.dataset.rescueDone === "project") return;

    page.dataset.rescueDone = "project";
    page.dataset.rescueLabel = "프로젝트";
    page.classList.add("aiways-rescue-page");

    page.innerHTML = `
      <div class="aiways-rescue-project">
        <div>
          <div class="aiways-rescue-pill">Project Frame</div>
          <h1>
            <span>환경 보호 포스터를 만드는 수업이 아니라,</span>
            <span>학교의 버리는 순간을 바꾸는 수업입니다.</span>
          </h1>
          <p>
            AIWays Incheon은 학생들이 실제로 쓰레기를 버리는 순간을 관찰하고,
            AI의 1차 판단을 사람의 기준으로 다시 검증하며,
            우리 학교의 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.
          </p>
        </div>

        <div class="aiways-rescue-project-cards">
          <div class="aiways-rescue-project-card">
            <strong>버리는 순간을 데이터로 바꾸다</strong>
            <span>교실의 작은 행동을 관찰 가능한 데이터로 바꾸고, 학급과 학교의 자원순환 흐름을 읽습니다.</span>
          </div>
          <div class="aiways-rescue-project-card">
            <strong>AI가 먼저 제안하고, 사람이 최종 판단하다</strong>
            <span>AI는 빠른 후보를 제시하고, 학생은 오염·코팅·복합재질 같은 맥락을 검토합니다.</span>
          </div>
          <div class="aiways-rescue-project-card">
            <strong>우리 학교 UX를 직접 개선하다</strong>
            <span>판단 보류함, 3초 판단앱, 퀴즈, 대시보드로 학생이 행동 변화의 설계자가 됩니다.</span>
          </div>
        </div>
      </div>
    `;
  }

  function fixCurriculum() {
    const page = sectionByLabel("교육과정");
    if (!page) return;

    page.dataset.rescueLabel = "교육과정";
    page.classList.add("aiways-rescue-page", "aiways-rescue-curriculum");

    $$("a,button", page).forEach(el => {
      const t = clean(el.textContent);

      if (
        t.includes("6실05-05") ||
        t.includes("E-book 열기") ||
        t.includes("아이스크림 교과서") ||
        t.includes("미래엔 엠티처") ||
        t.includes("T셀파")
      ) {
        el.remove();
      }
    });

    const socialCard = $$("article,div,section,li", page).find(el => {
      const t = clean(el.textContent);
      const r = el.getBoundingClientRect();
      return r.width > 120 && r.height > 60 && t.includes("사회");
    });

    if (socialCard && socialCard.dataset.rescueLink !== "1") {
      socialCard.dataset.rescueLink = "1";
      socialCard.style.cursor = "pointer";
      socialCard.addEventListener("click", () => {
        window.open("https://www.i-scream.co.kr/user/main/MainPage.do", "_blank", "noopener,noreferrer");
      });
    }
  }

  function renderFlow() {
    const page = sectionByLabel("차시흐름");
    if (!page || page.dataset.rescueDone === "flow") return;

    page.dataset.rescueDone = "flow";
    page.dataset.rescueLabel = "차시흐름";
    page.classList.add("aiways-rescue-page");

    page.innerHTML = `
      <div class="aiways-rescue-flow">
        <div>
          <div class="aiways-rescue-pill">6-Lesson Journey + Experience + Sharing</div>
          <h1>차시흐름</h1>
          <p>문제 발견에서 AI 활용, 인간 검증, 블록코딩·티처블머신·바이브코딩을 거쳐 대시보드 체험과 배포·공유까지 이어지는 수업 여정입니다.</p>
        </div>

        <div class="aiways-rescue-flow-grid">
          ${flowItems.map((item, idx) => `
            <button class="aiways-rescue-flow-card" type="button" data-open-gallery="${idx}">
              <small>${item[0]}</small>
              <strong>${item[1]}</strong>
              <span>${item[2]}</span>
              <ul>${item[3].map(x => `<li>${x}</li>`).join("")}</ul>
            </button>
          `).join("")}
        </div>
      </div>
    `;

    page.querySelectorAll("[data-open-gallery]").forEach(btn => {
      btn.addEventListener("click", () => {
        renderGallery();
        scrollToLabel("갤러리");
        setTimeout(() => openGalleryDetail(Number(btn.dataset.openGallery)), 360);
      });
    });
  }

  function renderGallery() {
    const page = sectionByLabel("갤러리");
    if (!page || page.dataset.rescueDone === "gallery") return;

    page.dataset.rescueDone = "gallery";
    page.dataset.rescueLabel = "갤러리";
    page.classList.add("aiways-rescue-page");

    page.innerHTML = `
      <div class="aiways-rescue-gallery" data-gallery-main>
        <div>
          <div class="aiways-rescue-pill">Output Gallery</div>
          <h1>갤러리</h1>
          <p>학생들이 발견한 불편함, AI와 함께 확장한 아이디어, 사람이 다시 판단한 기록을 모아 우리 학교 자원순환 UX가 어떻게 바뀌었는지 보여주는 산출물 아카이브입니다.</p>
        </div>

        <div class="aiways-rescue-gallery-grid">
          ${flowItems.map((item, idx) => `
            <button class="aiways-rescue-gallery-card" type="button" data-gallery-open="${idx}">
              <small>${item[0]}</small>
              <strong>${item[1]}</strong>
              <span>${item[2]}</span>
            </button>
          `).join("")}
        </div>
      </div>

      <div class="aiways-rescue-gallery-detail" data-gallery-detail>
        <div class="aiways-rescue-gallery-detail-head">
          <div>
            <div class="aiways-rescue-pill" data-gallery-kicker>Gallery Detail</div>
            <h2 data-gallery-title>갤러리</h2>
          </div>
          <button class="aiways-rescue-back" type="button" data-gallery-back>갤러리로 돌아가기</button>
        </div>

        <div class="aiways-rescue-gallery-slots">
          <div class="aiways-rescue-gallery-slot">사진 1 업로드 예정</div>
          <div class="aiways-rescue-gallery-slot">사진 2 업로드 예정</div>
        </div>
      </div>
    `;

    page.querySelectorAll("[data-gallery-open]").forEach(btn => {
      btn.addEventListener("click", () => openGalleryDetail(Number(btn.dataset.galleryOpen)));
    });

    page.querySelector("[data-gallery-back]")?.addEventListener("click", () => {
      page.querySelector("[data-gallery-detail]")?.classList.remove("active");
      const main = page.querySelector("[data-gallery-main]");
      if (main) main.style.display = "";
      scrollToLabel("갤러리");
    });
  }

  function openGalleryDetail(index) {
    const page = sectionByLabel("갤러리");
    if (!page) return;

    const item = flowItems[index] || flowItems[0];

    page.querySelector("[data-gallery-main]").style.display = "none";
    page.querySelector("[data-gallery-detail]").classList.add("active");
    page.querySelector("[data-gallery-kicker]").textContent = item[0];
    page.querySelector("[data-gallery-title]").textContent = item[1];

    scrollToLabel("갤러리");
  }

  function fixSortingPage() {
    const page = sectionByLabel("3초판단");
    if (!page) return;

    page.dataset.rescueLabel = "3초판단";
    page.classList.add("aiways-rescue-page", "aiways-rescue-sort-fix");

    if (page.dataset.rescueDone === "sort" && $(".aiways-mf-app-tabs", page)) return;
    page.dataset.rescueDone = "sort";

    const classNames = ["3학년 1반", "3학년 2반", "3학년 3반", "4학년 1반", "4학년 2반", "4학년 3반", "4학년 4반", "5학년 1반", "5학년 2반", "5학년 3반", "5학년 4반", "6학년 1반", "6학년 2반", "6학년 3반"];
    const choices = ["플라스틱류", "종이팩", "종이류", "캔류", "비닐류", "일반쓰레기", "판단 보류"];
    const chips = ["우유갑", "구겨진 종이", "플라스틱 컵", "과자 봉지", "캔", "빨대", "영수증", "볼펜"];

    function selectedClass() {
      return localStorage.getItem("aiways_selected_class") || "5학년 1반";
    }

    function sessionId() {
      let id = localStorage.getItem("aiways_session_id");
      if (!id) {
        id = "anon-" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("aiways_session_id", id);
      }
      return id;
    }

    function readRecords() {
      try {
        return JSON.parse(localStorage.getItem("aiways_records")) || [];
      } catch (error) {
        return [];
      }
    }

    function writeRecord(record) {
      const list = readRecords();
      list.unshift(record);
      localStorage.setItem("aiways_records", JSON.stringify(list.slice(0, 500)));
    }

    function gradeFromClass(name) {
      const match = String(name || "").match(/[3-6]학년/);
      return match ? match[0] : "5학년";
    }

    function materialFromText(value) {
      const text = clean(value).toLowerCase();
      if (text.includes("우유") || text.includes("팩") || text.includes("milk")) return ["우유갑", "종이팩", "종이팩 수거함", 23, "내용물을 비우고 펼쳐 말린 뒤 종이팩으로 따로 모읍니다."];
      if (text.includes("플라스틱") || text.includes("컵") || text.includes("페트")) return ["플라스틱 컵·페트병", "플라스틱류", "플라스틱 수거함", 18, "내용물을 비우고 헹군 뒤 라벨과 뚜껑을 확인합니다."];
      if (text.includes("과자") || text.includes("봉지") || text.includes("비닐")) return ["과자 봉지", "비닐류", "비닐 수거함", 31, "오염이 크면 일반쓰레기로 보류하고, 깨끗하면 비닐류로 모읍니다."];
      if (text.includes("캔")) return ["캔", "캔류", "캔 수거함", 14, "남은 액체를 비우고 가능한 눌러서 캔류로 배출합니다."];
      if (text.includes("영수증") || text.includes("빨대") || text.includes("볼펜")) return [value || "헷갈리는 물건", "판단 보류", "판단 보류함", 76, "복합재질이거나 학교 기준 확인이 필요합니다. 보류함에 기록하세요."];
      return [value || "구겨진 종이", "종이류", "종이 수거함", 26, "물기·음식물·테이프·코팅이 있으면 다시 확인합니다."];
    }

    function renderStats() {
      const records = readRecords();
      const today = records.filter(row => String(row.local_time || row.timestamp || "").includes(new Date().getFullYear().toString())).length;
      const hold = records.filter(row => row.hold_flag || row.final_decision === "판단 보류").length;
      return `
        <div class="aiways-mf-result-grid">
          <div class="aiways-mf-info"><small>누적 판단</small><b>${records.length}</b></div>
          <div class="aiways-mf-info"><small>오늘 기록</small><b>${today}</b></div>
          <div class="aiways-mf-info"><small>판단 보류</small><b>${hold}</b></div>
          <div class="aiways-mf-info"><small>저장 방식</small><b>Sheets + local</b></div>
        </div>
      `;
    }

    function renderHoldList() {
      const holds = readRecords().filter(row => row.hold_flag || row.final_decision === "판단 보류").slice(0, 6);
      if (!holds.length) return `<div class="aiways-mf-app-wait"><div><strong>보류 기록 없음</strong><span>헷갈리는 물건은 판단 보류로 남겨 회의 안건으로 모읍니다.</span></div></div>`;
      return holds.map(row => `<div class="aiways-mf-result-section"><strong>${row.mapped_item || "보류 물건"}</strong><br>${row.suggested_category || row.final_decision} · ${row.local_time || ""}</div>`).join("");
    }

    page.innerHTML = `
      <div class="aiways-mf-sort-wrap">
        <div class="aiways-mf-sort-left">
          <div class="aiways-mf-section-kicker">Output · 3-Second Sorting Helper App</div>
          <h1>3초판단앱</h1>
          <p>사진을 올리거나 물건을 검색하면 AI 판단 초안을 보여주고, 학생이 최종 판단을 눌렀을 때만 기록으로 저장합니다.</p>
          <div class="aiways-mf-feature-grid">
            <div class="aiways-mf-feature"><strong>AI분류</strong><span>사진·검색어로 분리배출 후보를 빠르게 확인합니다.</span></div>
            <div class="aiways-mf-feature"><strong>학생 확인</strong><span>오염, 코팅, 복합재질을 사람이 마지막으로 판단합니다.</span></div>
            <div class="aiways-mf-feature"><strong>통계</strong><span>대시보드와 Google Sheets 기록으로 연결합니다.</span></div>
            <div class="aiways-mf-feature"><strong>보류함</strong><span>모르는 물건을 아무 데나 버리지 않도록 남깁니다.</span></div>
          </div>
        </div>

        <div class="aiways-mf-app">
          <div class="aiways-mf-app-head">
            <div>
              <div class="aiways-mf-kicker">AI + 학생 판단</div>
              <h2 class="aiways-mf-app-title">버려지는 순간을 판단하세요</h2>
            </div>
            <select class="aiways-mf-select" data-sort-class>
              ${classNames.map(name => `<option value="${name}" ${name === selectedClass() ? "selected" : ""}>${name}</option>`).join("")}
            </select>
          </div>

          <div class="aiways-mf-app-tabs">
            <button type="button" class="active" data-tab="ai">AI분류</button>
            <button type="button" data-tab="quiz">퀴즈</button>
            <button type="button" data-tab="stats">통계</button>
            <button type="button" data-tab="hold">보류함</button>
          </div>

          <div class="aiways-mf-app-body">
            <div class="aiways-mf-app-left" data-panel="ai">
              <div class="aiways-mf-pick-grid">
                <button class="aiways-mf-pick" type="button" data-rescue-upload><strong>사진 업로드</strong><span>큐시트 종이를 구겨 올리는 발표 시연</span></button>
                <button class="aiways-mf-pick" type="button" data-rescue-demo><strong>AI 판단 초안</strong><span>검색어로 즉시 판단 카드 보기</span></button>
              </div>
              <input type="file" accept="image/*" data-rescue-file hidden>
              <div class="aiways-mf-search" style="margin-top:14px;display:grid;grid-template-columns:1fr auto;gap:8px;">
                <input data-rescue-search placeholder="예: 우유갑, 영수증, 볼펜, 컵라면">
                <button type="button" data-rescue-search-btn>판단</button>
              </div>
              <div class="aiways-mf-chip-grid">
                ${chips.map(item => `<button class="aiways-mf-chip" type="button" data-rescue-chip="${item}">${item}</button>`).join("")}
              </div>
            </div>
            <div class="aiways-mf-app-right" data-rescue-result>
              <div class="aiways-mf-app-wait"><div><strong>AI분류 대기 중</strong><span>사진을 올리거나 물건을 검색하면 판단 카드가 나타납니다.</span></div></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const result = page.querySelector("[data-rescue-result]");
    const left = page.querySelector("[data-panel='ai']");

    function showJudgment(value, rawLabel = value) {
      const [item, category, bin, holdScore, guide] = materialFromText(value);
      const confidence = category === "판단 보류" ? 49 : 88;
      result.innerHTML = `
        <div class="aiways-mf-result" data-rescue-item="${item}" data-rescue-category="${category}" data-rescue-hold="${holdScore}" data-rescue-raw="${rawLabel}" data-rescue-confidence="${confidence}">
          <h3>${item}</h3>
          <div class="aiways-mf-badges">
            <span class="aiways-mf-badge">AI 판단 초안</span>
            <span class="aiways-mf-badge">신뢰도 ${confidence}%</span>
            <span class="aiways-mf-badge">${category}</span>
          </div>
          <div class="aiways-mf-result-grid">
            <div class="aiways-mf-info"><small>물건 후보</small><b>${item}</b></div>
            <div class="aiways-mf-info"><small>재질 후보</small><b>${category}</b></div>
            <div class="aiways-mf-info"><small>배출 후보</small><b>${bin}</b></div>
            <div class="aiways-mf-info"><small>판단 보류 점수</small><b>${holdScore}점</b></div>
          </div>
          <div class="aiways-mf-result-section"><strong>사람이 마지막으로 확인할 질문</strong><br>오염되었나요?<br>코팅이나 복합재질인가요?<br>우리 학교 수거함 기준과 맞나요?</div>
          <div class="aiways-mf-result-section"><strong>학생 최종 판단</strong><div class="aiways-mf-final-buttons">${choices.map(choice => `<button type="button" class="${choice === category ? "primary" : ""}" data-mf-final="${choice}">${choice}</button>`).join("")}</div></div>
          <div class="aiways-mf-result-section">${guide}</div>
        </div>
      `;

      result.querySelectorAll("[data-mf-final]").forEach(button => {
        button.addEventListener("click", () => {
          const selected = selectedClass();
          const finalChoice = button.dataset.mfFinal;
          const hold = finalChoice === "판단 보류";
          writeRecord({
            timestamp: new Date().toISOString(),
            local_time: new Date().toLocaleString("ko-KR"),
            school: "우리학교",
            grade: gradeFromClass(selected),
            class_name: selected,
            group_id: localStorage.getItem("aiways_group_id") || "",
            privacy_id: sessionId(),
            input_type: "image",
            ai_engine: "수업용 3초 판단 규칙",
            ai_raw_label: rawLabel || "",
            ai_confidence: confidence,
            mapped_item: item,
            suggested_category: category,
            final_decision: finalChoice,
            hold_flag: hold,
            hold_score: holdScore,
            action: hold ? "판단 보류함 등록" : "학생 판단 완료",
            image_saved: false,
            app_version: "aiways-rescue-sort-v1"
          });
          button.closest(".aiways-mf-result")?.insertAdjacentHTML("beforeend", `<div class="aiways-mf-saved">최종 판단 ${finalChoice} · 기록을 저장했습니다.</div>`);
        }, { once: true });
      });
    }

    function setTab(tab) {
      page.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
      if (tab === "ai") {
        left.style.display = "";
        result.innerHTML = `<div class="aiways-mf-app-wait"><div><strong>AI분류 대기 중</strong><span>사진을 올리거나 물건을 검색하면 판단 카드가 나타납니다.</span></div></div>`;
      } else {
        left.style.display = "none";
        if (tab === "quiz") {
          result.innerHTML = `<div class="aiways-mf-result-section"><strong>OX 퀴즈</strong><br>Q. 우유갑은 일반 종이와 항상 함께 버린다. <b>X</b><br>Q. 모르는 물건을 보류함에 남기는 것도 자원순환 역량이다. <b>O</b></div>`;
        }
        if (tab === "stats") result.innerHTML = renderStats();
        if (tab === "hold") result.innerHTML = renderHoldList();
      }
    }

    page.querySelector("[data-sort-class]")?.addEventListener("change", event => {
      localStorage.setItem("aiways_selected_class", event.target.value);
    });
    page.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => setTab(button.dataset.tab)));
    page.querySelector("[data-rescue-upload]")?.addEventListener("click", () => page.querySelector("[data-rescue-file]")?.click());
    page.querySelector("[data-rescue-file]")?.addEventListener("change", event => showJudgment(event.target.files?.[0]?.name || "업로드한 사진", "uploaded-image"));
    page.querySelector("[data-rescue-demo]")?.addEventListener("click", () => showJudgment(page.querySelector("[data-rescue-search]")?.value || "구겨진 종이"));
    page.querySelector("[data-rescue-search-btn]")?.addEventListener("click", () => showJudgment(page.querySelector("[data-rescue-search]")?.value || "구겨진 종이"));
    page.querySelectorAll("[data-rescue-chip]").forEach(button => button.addEventListener("click", () => showJudgment(button.dataset.rescueChip)));
  }

  function renderPlaybook() {
    const page = sectionByLabel("자료실");
    if (!page || page.dataset.rescueDone === "playbook") return;

    page.dataset.rescueDone = "playbook";
    page.dataset.rescueLabel = "자료실";
    page.classList.add("aiways-rescue-page");

    page.innerHTML = `
      <div class="aiways-rescue-playbook">
        <div>
          <div class="aiways-rescue-pill">Resources</div>
          <h1>자료실</h1>
        </div>

        <div class="aiways-rescue-resource-grid">
          <a class="aiways-rescue-resource-btn" href="#" data-resource="voc">VOC 활동지</a>
          <a class="aiways-rescue-resource-btn" href="#" data-resource="parent-form">학부모 구글폼</a>
          <a class="aiways-rescue-resource-btn" href="#" data-resource="lesson-sheet">차시별 활동지</a>
          <a class="aiways-rescue-resource-btn" href="https://github.com/ssamkang/aiways-incheon" target="_blank" rel="noopener noreferrer">GitHub 저장소</a>
        </div>

        <div class="aiways-rescue-credit">
          <span>AIWays Incheon · Human → AI → Human Learning Project</span>
          <span>강서희 · 원나연 · 같이교육</span>
        </div>
      </div>
    `;

    let next = page.nextElementSibling;
    while (next) {
      next.style.display = "none";
      next = next.nextElementSibling;
    }
  }

  function runOnce() {
    document.body.classList.add("aiways-rescue-ready");

    cleanHeader();
    fixHome();
    renderProject();
    fixCurriculum();
    renderFlow();
    renderGallery();
    fixSortingPage();
    renderPlaybook();
    removeFloatingBox();
    updateActive();
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;

    ticking = true;

    requestAnimationFrame(() => {
      updateActive();
      removeFloatingBox();
      ticking = false;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runOnce, { once: true });
  } else {
    runOnce();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => setTimeout(() => {
    runOnce();
    updateActive();
  }, 120), { passive: true });

  setTimeout(runOnce, 150);
  setTimeout(runOnce, 700);
})();
