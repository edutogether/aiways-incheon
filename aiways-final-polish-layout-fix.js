
(() => {
  window.AIWAYS_FINAL_POLISH_ACTIVE = true;

  const LINKS = {
    "실과": "https://www.m-teacher.co.kr/",
    "사회": "https://text.i-scream.co.kr/",
    "국어": "https://www.tsherpa.co.kr/",
    "teachable": "https://teachablemachine.withgoogle.com/train/image",
    "github": "https://github.com/"
  };

  const BASELINE_CLASSES = {
    "3학년 1반": { grade: "3학년", observed: 17, hold: 1, converted: 14, rank: 9 },
    "3학년 2반": { grade: "3학년", observed: 18, hold: 2, converted: 14, rank: 8 },
    "3학년 3반": { grade: "3학년", observed: 18, hold: 1, converted: 15, rank: 7 },
    "4학년 1반": { grade: "4학년", observed: 16, hold: 1, converted: 13, rank: 12 },
    "4학년 2반": { grade: "4학년", observed: 15, hold: 1, converted: 12, rank: 13 },
    "4학년 3반": { grade: "4학년", observed: 14, hold: 2, converted: 10, rank: 14 },
    "4학년 4반": { grade: "4학년", observed: 16, hold: 1, converted: 13, rank: 10 },
    "5학년 1반": { grade: "5학년", observed: 24, hold: 3, converted: 20, rank: 3 },
    "5학년 2반": { grade: "5학년", observed: 29, hold: 2, converted: 25, rank: 2 },
    "5학년 3반": { grade: "5학년", observed: 30, hold: 2, converted: 26, rank: 1 },
    "5학년 4반": { grade: "5학년", observed: 32, hold: 2, converted: 27, rank: 4 },
    "6학년 1반": { grade: "6학년", observed: 30, hold: 2, converted: 25, rank: 5 },
    "6학년 2반": { grade: "6학년", observed: 31, hold: 2, converted: 26, rank: 6 },
    "6학년 3반": { grade: "6학년", observed: 28, hold: 1, converted: 24, rank: 11 }
  };

  const DEFAULT_CONFUSING = {
    "비닐 코팅 종이컵": 4,
    "과자 포장지": 3,
    "영수증": 3,
    "음식물 묻은 종이": 2,
    "볼펜": 2
  };

  const MATERIALS = {
    plastic: {
      emoji: "🥤",
      item: "플라스틱 컵·페트병",
      category: "플라스틱류",
      bin: "플라스틱 배출함",
      guide: "내용물을 비우고, 가능하면 헹군 뒤 라벨·뚜껑·빨대는 분리해 배출합니다.",
      features: ["컵·병·투명 용기 형태로 보입니다.", "오염 여부는 사람이 직접 확인해야 합니다."],
      questions: ["안에 음료나 이물질이 남아 있나요?", "라벨·뚜껑·빨대를 분리했나요?"],
      holdBase: 34
    },
    paperpack: {
      emoji: "🥛",
      item: "우유갑·종이팩",
      category: "종이팩",
      bin: "종이팩 전용 수거함",
      guide: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 종이팩 전용 수거함에 배출합니다.",
      features: ["팩 형태의 종이 용기로 보입니다.", "내용물 잔여 여부는 사람이 확인해야 합니다."],
      questions: ["내용물을 완전히 비웠나요?", "안쪽을 헹굴 수 있나요?"],
      holdBase: 28
    },
    paper: {
      emoji: "📄",
      item: "깨끗한 종이·종이상자",
      category: "종이류",
      bin: "종이류 배출함",
      guide: "물기와 음식물이 묻지 않았다면 펼쳐서 종이류로 배출합니다.",
      features: ["평평한 종이 또는 상자 형태로 보입니다.", "코팅 여부는 사람이 확인해야 합니다."],
      questions: ["음식물이나 물기가 묻어 있나요?", "코팅지나 영수증은 아닌가요?"],
      holdBase: 26
    },
    can: {
      emoji: "🥫",
      item: "캔",
      category: "캔류",
      bin: "캔류 배출함",
      guide: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다.",
      features: ["금속 캔 형태로 보입니다.", "안쪽 내용물은 사람이 확인해야 합니다."],
      questions: ["내용물이 완전히 비어 있나요?", "다른 쓰레기가 들어 있지 않나요?"],
      holdBase: 20
    },
    vinyl: {
      emoji: "🍿",
      item: "과자봉지·비닐",
      category: "비닐류 또는 재확인",
      bin: "비닐류 배출함 / 판단 보류함",
      guide: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다.",
      features: ["얇은 포장재 또는 비닐 형태로 보입니다.", "기름기나 양념은 사람이 확인해야 합니다."],
      questions: ["부스러기나 양념이 많이 묻어 있나요?", "털어내면 깨끗한가요?"],
      holdBase: 62
    },
    hold: {
      emoji: "🤔",
      item: "기타·판단 보류 물건",
      category: "판단 보류",
      bin: "판단 보류함",
      guide: "학습 데이터 밖이거나 재질이 애매한 물건입니다. 사람이 최종 판단합니다.",
      features: ["AI가 확실하게 분류하기 어려운 물건입니다.", "수업에서는 좋은 토론 데이터가 됩니다."],
      questions: ["어떤 재질이 가장 많이 섞여 있나요?", "친구들과 기준을 확인해야 할까요?"],
      holdBase: 92
    }
  };

  const LABEL_RULES = [
    { key: "plastic", words: ["plastic", "cup", "bottle", "container", "water bottle", "플라스틱", "페트", "컵", "생수병", "병"] },
    { key: "paperpack", words: ["milk", "carton", "paper pack", "우유", "종이팩", "팩"] },
    { key: "paper", words: ["paper", "cardboard", "box", "book", "notebook", "종이", "상자", "공책"] },
    { key: "can", words: ["can", "tin", "aluminum", "soda", "캔"] },
    { key: "vinyl", words: ["bag", "wrapper", "packet", "snack", "plastic bag", "비닐", "봉지", "과자"] }
  ];

  const FINAL_CHOICES = ["플라스틱류", "종이팩", "종이류", "캔류", "비닐류", "일반쓰레기", "판단 보류"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => (value || "").replace(/\s+/g, " ").trim();

  let selectedClass = localStorage.getItem("aiways_selected_class") || "5학년 1반";
  if (!BASELINE_CLASSES[selectedClass]) selectedClass = "5학년 1반";
  let selectedGrade = BASELINE_CLASSES[selectedClass].grade;
  let modelPromise = null;

  function records() {
    try {
      return JSON.parse(localStorage.getItem("aiways_records")) || [];
    } catch {
      return [];
    }
  }

  function saveRecords(list) {
    localStorage.setItem("aiways_records", JSON.stringify(list));
  }

  function sessionId() {
    let id = localStorage.getItem("aiways_session_id");
    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("aiways_session_id", id);
    }
    return id;
  }

  function gradeOfClass(name) {
    return BASELINE_CLASSES[name]?.grade || "5학년";
  }

  function classRecords(name) {
    return records().filter(r => r.class_name === name);
  }

  function gradeRecords(grade) {
    return records().filter(r => r.grade === grade);
  }

  function statsForClass(name) {
    const base = BASELINE_CLASSES[name] || BASELINE_CLASSES["5학년 1반"];
    const rec = classRecords(name);

    return {
      observed: base.observed + rec.length,
      hold: base.hold + rec.filter(r => r.hold_flag).length,
      converted: base.converted + rec.filter(r => r.action === "학생 판단 완료").length,
      rank: base.rank
    };
  }

  function statsForGrade(grade) {
    const entries = Object.entries(BASELINE_CLASSES).filter(([, v]) => v.grade === grade);
    const rec = gradeRecords(grade);

    return {
      classes: entries.length,
      observed: entries.reduce((s, [, v]) => s + v.observed, 0) + rec.length,
      hold: entries.reduce((s, [, v]) => s + v.hold, 0) + rec.filter(r => r.hold_flag).length,
      converted: entries.reduce((s, [, v]) => s + v.converted, 0) + rec.filter(r => r.action === "학생 판단 완료").length
    };
  }

  function textIncludes(el, ...phrases) {
    const t = clean(el.textContent);
    return phrases.every(p => t.includes(p));
  }

  function findSmallestContainerByText(...phrases) {
    return $$("section,article,div").filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 260 && rect.height > 120 && textIncludes(el, ...phrases);
    }).sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    })[0] || null;
  }

  function findDashboardCard(selector, ...phrases) {
    const direct = $(selector);
    if (direct) return direct;
    return findSmallestContainerByText(...phrases);
  }

  function findPageByText(...phrases) {
    return $$("main > section, main > article, main > div, body > section, body > article, section, article, div").filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 420 && rect.height > 260 && textIncludes(el, ...phrases);
    }).sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0] || null;
  }

  function hideHeaderCta() {
    const header = $("header") || $(".site-header") || $(".header");
    if (!header) return;

    $$("a,button", header).forEach(el => {
      const t = clean(el.textContent);
      if (t.includes("지금") && (t.includes("찰칵") || t.includes("분류") || t.includes("버려지는 순간"))) {
        el.classList.add("aiways-hide-header-cta");
      }
    });
  }

  function fixHeroCopy() {
    const page = findPageByText("버리는 순간", "데이터가 되다", "AIWays Incheon은");
    if (!page) return;

    const copy = $$("p,div", page).find(el => {
      const t = clean(el.textContent);
      return t.includes("AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다") &&
        t.includes("H-A-H 기반 수업 프로젝트입니다");
    });

    if (copy) copy.classList.add("aiways-hero-copy-fixed");
  }

  function metric(label, value, unit) {
    return `
      <div class="aiways-final-metric">
        <span>${label}</span>
        <strong>${value}<small>${unit}</small></strong>
      </div>
    `;
  }

  function barRow(label, value, max) {
    const width = Math.max(8, Math.round(value / Math.max(1, max) * 100));

    return `
      <div class="aiways-final-bar-row">
        <span class="aiways-final-bar-label">${label}</span>
        <span class="aiways-final-bar-track"><i class="aiways-final-bar-fill" style="width:${width}%"></i></span>
        <span class="aiways-final-bar-value">${value}</span>
      </div>
    `;
  }

  function donut(title, value) {
    const safe = Math.max(0, Math.min(100, Math.round(value)));

    return `
      <div class="aiways-final-donut-box">
        <div class="aiways-final-donut-title">${title}</div>
        <div class="aiways-final-donut" style="--value:${safe}">
          <b>${safe}%</b>
        </div>
      </div>
    `;
  }

  function top5Markup() {
    const counts = { ...DEFAULT_CONFUSING };

    classRecords(selectedClass).forEach(record => {
      const key = record.mapped_item || record.ai_raw_label || "판단 보류 물건";
      const confusing = record.hold_flag || record.final_decision === "판단 보류" || Number(record.hold_score || 0) >= 55;
      if (confusing) counts[key] = (counts[key] || 0) + 1;
    });

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = Math.max(...top.map(([, v]) => v), 1);

    return `
      <div class="aiways-final-top5">
        ${top.map(([label, value], index) => `
          <div class="aiways-final-top5-row">
            <div class="aiways-final-top5-label">${index + 1}. ${label}</div>
            <div class="aiways-final-top5-track">
              <span class="aiways-final-top5-fill" style="width:${Math.max(8, Math.round(value / max * 100))}%"></span>
            </div>
            <div class="aiways-final-top5-value">${value}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderSchoolDashboard() {
    const card = findDashboardCard(".school-card", "우리학교", "자원순환", "대시보드");
    if (!card || (card.dataset.finalStableRendered === "school" && $(".aiways-final-dash-inner", card))) return;

    const render = () => {
      const s = statsForGrade(selectedGrade);
      const gradeRows = ["3학년", "4학년", "5학년", "6학년"].map(g => [g, statsForGrade(g).observed]);
      const max = Math.max(...gradeRows.map(([, v]) => v), 1);
      const successRate = Math.round(s.converted / Math.max(1, s.observed - s.hold) * 100);
      const holdRate = Math.round(s.hold / Math.max(1, s.observed) * 100);

      card.classList.add("aiways-stable-dashboard", "aiways-dashboard-card-fixed", "aiways-final-dashboard");
      card.dataset.finalStableRendered = "school";

      card.innerHTML = `
        <div class="aiways-final-dash-inner">
          <div class="aiways-final-dash-head">
            <div>
              <div class="aiways-final-kicker">School Resource Dashboard</div>
              <h2 class="aiways-final-dash-title">우리학교 자원순환 대시보드</h2>
            </div>

            <select class="aiways-final-select" data-school-grade>
              ${["3학년", "4학년", "5학년", "6학년"].map(g => `<option value="${g}" ${g === selectedGrade ? "selected" : ""}>${g}</option>`).join("")}
            </select>
          </div>

          <div class="aiways-final-school-grid">
            <div class="aiways-final-metrics">
              ${metric("참여 학급", s.classes, "학급")}
              ${metric("배출 관찰", s.observed, "건")}
              ${metric("판단 보류", s.hold, "건")}
            </div>

            <div class="aiways-final-right">
              <div class="aiways-final-panel">
                <div class="aiways-final-panel-title">학년별 참여</div>
                ${gradeRows.map(([label, value]) => barRow(label, value, max)).join("")}
              </div>

              <div class="aiways-final-donut-pair">
                ${donut("배출 성공률", successRate)}
                ${donut("판단 보류 비율", holdRate)}
              </div>
            </div>
          </div>
        </div>
      `;

      $("[data-school-grade]", card)?.addEventListener("change", event => {
        selectedGrade = event.target.value;
        const firstClass = Object.keys(BASELINE_CLASSES).find(name => BASELINE_CLASSES[name].grade === selectedGrade);
        if (firstClass) selectedClass = firstClass;
        localStorage.setItem("aiways_selected_class", selectedClass);
        updateDashboards();
      });
    };

    render();
  }

  function renderClassDashboard() {
    const card = findDashboardCard(".class-card", "우리반", "자원순환", "대시보드");
    if (!card || (card.dataset.finalStableRendered === "class" && $(".aiways-final-dash-inner", card))) return;

    const s = statsForClass(selectedClass);
    const classes = Object.keys(BASELINE_CLASSES);

    card.classList.add("aiways-stable-dashboard", "aiways-dashboard-card-fixed", "aiways-final-dashboard");
    card.dataset.finalStableRendered = "class";

    card.innerHTML = `
      <div class="aiways-final-dash-inner">
        <div class="aiways-final-dash-head">
          <div>
            <div class="aiways-final-kicker">Class Resource Dashboard</div>
            <h2 class="aiways-final-dash-title">우리반 자원순환 대시보드</h2>
            <p class="aiways-final-dash-desc">우리반의 버리는 순간을 AI와 함께 분류하고, 다시 확인한 기록입니다.</p>
          </div>

          <select class="aiways-final-select" data-class-select>
            ${classes.map(name => `<option value="${name}" ${name === selectedClass ? "selected" : ""}>${name}</option>`).join("")}
          </select>
        </div>

        <div class="aiways-final-class-grid">
          <div class="aiways-final-metrics">
            ${metric("오늘 관찰", s.observed, "건")}
            ${metric("판단 보류", s.hold, "건")}
            ${metric("전환 사례", s.converted, "건")}
          </div>

          <div class="aiways-final-side">
            <div class="aiways-final-panel">
              <div class="aiways-final-panel-title">헷갈린 물건 TOP 5</div>
              ${top5Markup()}
            </div>

            <div class="aiways-final-panel">
              <div class="aiways-final-panel-title">우리반 랭킹</div>
              <div class="aiways-final-rank">
                <div class="aiways-final-rank-medal">🏅</div>
                <div>
                  <strong>${s.rank}위</strong>
                  <span>전체 ${classes.length}개 학급 중</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $("[data-class-select]", card)?.addEventListener("change", event => {
      selectedClass = event.target.value;
      selectedGrade = gradeOfClass(selectedClass);
      localStorage.setItem("aiways_selected_class", selectedClass);
      updateDashboards();
    });
  }

  function chartSvg() {
    return `
      <svg class="aiways-final-svg" viewBox="0 0 320 120" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fpLine" x1="0" x2="1">
            <stop offset="0%" stop-color="#6cf4df"/>
            <stop offset="100%" stop-color="#6bbcff"/>
          </linearGradient>
        </defs>
        <line x1="30" y1="20" x2="30" y2="98" stroke="rgba(220,234,252,.18)" stroke-width="1"/>
        <line x1="30" y1="98" x2="302" y2="98" stroke="rgba(220,234,252,.18)" stroke-width="1"/>
        <text x="4" y="26" fill="rgba(220,234,252,.62)" font-size="9">70%</text>
        <text x="4" y="62" fill="rgba(220,234,252,.62)" font-size="9">60%</text>
        <text x="4" y="100" fill="rgba(220,234,252,.62)" font-size="9">50%</text>
        ${[51,55,58,59,60,62,64].map((v, i) => {
          const x = 44 + i * 36;
          const h = Math.max(16, Math.round(v));
          const y = 98 - h;
          return `<rect x="${x}" y="${y}" width="18" height="${h}" rx="5" fill="rgba(108,244,223,.20)"/>`;
        }).join("")}
        <path d="M52,40 L88,43 L124,49 L160,58 L196,54 L232,66 L268,74" fill="none" stroke="url(#fpLine)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        ${["월","화","수","목","금","토","오늘"].map((label, i) => `<text x="${53 + i * 36}" y="114" text-anchor="middle" fill="rgba(220,234,252,.66)" font-size="9">${label}</text>`).join("")}
      </svg>
    `;
  }

  function renderLandfill() {
    const card = findDashboardCard(".landfill-card", "수도권매립지", "모니터");
    if (!card || (card.dataset.finalStableRendered === "landfill" && $(".aiways-final-dash-inner", card))) return;

    card.classList.add("aiways-stable-dashboard", "aiways-dashboard-card-fixed", "aiways-final-dashboard");
    card.dataset.finalStableRendered = "landfill";

    card.innerHTML = `
      <div class="aiways-final-dash-inner">
        <div class="aiways-final-dash-head">
          <div>
            <div class="aiways-final-kicker">공식 관리 지표 구조</div>
            <h2 class="aiways-final-dash-title">수도권매립지 모니터</h2>
            <p class="aiways-final-dash-desc">수도권매립지 흐름을 한눈에 읽을 수 있도록 정리한 실시간 모니터입니다.</p>
          </div>
        </div>

        <div style="display:grid;grid-template-rows:auto 1fr;gap:9px;min-height:0;">
          <div class="aiways-final-landfill-metrics">
            <div class="aiways-final-landfill-metric"><strong>19,507t</strong><span>오늘 반입 총량</span></div>
            <div class="aiways-final-landfill-metric"><strong>-3.2%</strong><span>전일 대비</span></div>
            <div class="aiways-final-landfill-metric"><strong>68.3%</strong><span>총량 대비 반입률</span></div>
            <div class="aiways-final-landfill-metric"><strong>32.7%</strong><span>잔여 관리 여력</span></div>
          </div>

          <div style="display:grid;grid-template-columns:1.2fr .8fr;gap:9px;min-height:0;">
            <div class="aiways-final-chart">
              <div class="aiways-final-panel-title">반입률 추이 · 최근 7일</div>
              ${chartSvg()}
              <div class="aiways-final-live-note">공식 데이터 연결 전에는 발표 안정용 기준값으로 표시됩니다.</div>
            </div>

            <div class="aiways-final-donut-pair" style="grid-template-columns:1fr;grid-template-rows:1fr 1fr;">
              ${donut("총량 대비 반입률", 68)}
              ${donut("잔여 관리 여력", 33)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderMiniApp() {
    const card = findDashboardCard("#classify, .upload-card", "버려지는 순간", "기록");
    if (!card || (card.dataset.finalStableRendered === "miniapp" && $(".aiways-final-app-picks", card))) return;

    card.classList.add("aiways-stable-dashboard", "aiways-dashboard-card-fixed");
    card.dataset.finalStableRendered = "miniapp";

    card.innerHTML = `
      <div class="aiways-opapp">
        <div class="aiways-opapp-head">
          <div class="aiways-opapp-kicker">3-Second Sorting Helper App</div>
          <h2 class="aiways-opapp-title">버려지는 순간을 기록하세요</h2>
          <p class="aiways-opapp-desc">사진을 찍어 AI와 함께 분류하며 판단합니다.</p>
        </div>

        <div class="aiways-opapp-picks aiways-final-app-picks">
          <button class="aiways-opapp-pick aiways-final-pick" type="button" data-role="camera">
            <span class="aiways-opapp-icon">📷</span>
            <strong>카메라로 지금 찍기</strong>
            <span>바로 촬영해 AI 판단 초안 만들기</span>
          </button>

          <button class="aiways-opapp-pick aiways-final-pick" type="button" data-role="upload">
            <span class="aiways-opapp-icon">🖼️</span>
            <strong>찍은 사진 올리기</strong>
            <span>이미 찍은 사진으로 판단하기</span>
          </button>
        </div>

        <input class="aiways-opapp-hidden" type="file" accept="image/*" capture="environment" data-role="camera-input">
        <input class="aiways-opapp-hidden" type="file" accept="image/*" data-role="upload-input">

        <div class="aiways-opapp-work">
          <div class="aiways-opapp-preview">
            <div class="aiways-opapp-photo" data-role="photo">
              <div class="aiways-opapp-placeholder">사진이 들어오면<br>미리보기와 스캔선이 나타납니다.</div>
              <img data-role="img" alt="업로드한 사진 미리보기">
              <div class="aiways-opapp-scan"></div>
            </div>

            <div class="aiways-opapp-progress">
              <div class="aiways-opapp-progress-label">
                <span data-role="step">AI분류 대기중</span>
                <span data-role="percent">0%</span>
              </div>
              <div class="aiways-opapp-track">
                <div class="aiways-opapp-fill" data-role="fill"></div>
              </div>
            </div>
          </div>

          <div class="aiways-opapp-result" data-role="result">
            <div class="aiways-opapp-wait">
              <strong>AI분류 대기 중</strong>
              <span>사진을 촬영하거나 업로드하면 AI 판단 초안이 표시됩니다.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    bindApp(card);
  }

  function updateDashboards() {
    ["school", "class"].forEach(type => {
      const old = $(`[data-final-stable-rendered="${type}"]`);
      if (old) old.dataset.finalStableRendered = "";
    });

    renderSchoolDashboard();
    renderClassDashboard();
  }

  function materialFromText(value) {
    const text = clean(value).toLowerCase();

    for (const rule of LABEL_RULES) {
      if (rule.words.some(word => text.includes(word.toLowerCase()))) {
        return MATERIALS[rule.key];
      }
    }

    return MATERIALS.hold;
  }

  async function ensureModel() {
    if (modelPromise) return modelPromise;

    modelPromise = new Promise(async (resolve, reject) => {
      try {
        const started = Date.now();

        while (!window.mobilenet && Date.now() - started < 9000) {
          await new Promise(r => setTimeout(r, 120));
        }

        if (!window.mobilenet) throw new Error("MobileNet unavailable");

        const model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
        resolve(model);
      } catch (error) {
        modelPromise = null;
        reject(error);
      }
    });

    return modelPromise;
  }

  async function classifyImage(img, file) {
    try {
      const model = await ensureModel();
      const predictions = await model.classify(img, 5);
      const best = predictions[0] || { className: "unknown", probability: 0 };
      const raw = `${file?.name || ""} ${predictions.map(p => p.className).join(" ")}`;
      const material = materialFromText(raw);
      const confidence = Math.max(35, Math.round((best.probability || 0.35) * 100));

      return {
        rawLabel: best.className,
        confidence,
        material,
        holdScore: material.holdBase,
        predictions: predictions.slice(0, 4).map(p => `${p.className} ${Math.round(p.probability * 100)}%`)
      };
    } catch {
      const material = materialFromText(file?.name || "unknown");
      return {
        rawLabel: "이미지 모델 연결 실패",
        confidence: 42,
        material,
        holdScore: material.holdBase,
        predictions: []
      };
    }
  }

  function updateProgress(app, step, percent) {
    const stepEl = $('[data-role="step"]', app);
    const percentEl = $('[data-role="percent"]', app);
    const fillEl = $('[data-role="fill"]', app);

    if (stepEl) stepEl.textContent = step;
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (fillEl) fillEl.style.width = `${percent}%`;
  }

  function showResult(app, draft) {
    const result = $('[data-role="result"]', app);
    if (!result) return;

    const m = draft.material;

    result.innerHTML = `
      <div class="aiways-opapp-result-card">
        <h3>${m.emoji} ${m.item}</h3>

        <div class="aiways-opapp-badges">
          <span class="aiways-opapp-pill">AI 판단 초안</span>
          <span class="aiways-opapp-pill">신뢰도 ${draft.confidence}%</span>
          <span class="aiways-opapp-pill ${m.category === "판단 보류" ? "hold" : ""}">${m.category}</span>
        </div>

        <div class="aiways-opapp-info-grid">
          <div class="aiways-opapp-info"><small>물건 후보</small><b>${m.item}</b></div>
          <div class="aiways-opapp-info"><small>재질 후보</small><b>${m.category}</b></div>
          <div class="aiways-opapp-info"><small>배출 후보</small><b>${m.bin}</b></div>
        </div>

        <div class="aiways-opapp-section">
          <strong>사람이 마지막으로 확인할 질문</strong>
          <ul class="aiways-opapp-list">
            ${m.questions.map(q => `<li>${q}</li>`).join("")}
          </ul>
        </div>

        <div class="aiways-opapp-section">
          <strong>AI 원본 인식:</strong> ${draft.rawLabel}<br>
          <strong>후보:</strong> ${draft.predictions.join(" · ") || "후보 없음"}<br>
          ${m.guide}
        </div>

        <div class="aiways-opapp-section">
          <strong>학생 최종 판단</strong>
          <div class="aiways-opapp-final">
            ${FINAL_CHOICES.map(choice => `
              <button type="button" class="${choice === m.category ? "primary" : ""} ${choice === "판단 보류" ? "hold" : ""}" data-final-choice="${choice}">
                ${choice}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    $$("[data-final-choice]", result).forEach(button => {
      button.addEventListener("click", () => {
        saveFinalChoice(draft, button.dataset.finalChoice);

        result.insertAdjacentHTML("beforeend", `
          <div class="aiways-opapp-saved">
            최종 판단: ${button.dataset.finalChoice} · 대시보드에 기록했습니다.
          </div>
        `);
      });
    });
  }

  function saveFinalChoice(draft, finalChoice) {
    const m = draft.material;
    const holdFlag = finalChoice === "판단 보류";

    const record = {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      privacy_id: sessionId(),
      school: "우리학교",
      grade: gradeOfClass(selectedClass),
      class_name: selectedClass,
      input_type: "image",
      ai_engine: "AI 판단 초안",
      ai_raw_label: draft.rawLabel,
      ai_confidence: draft.confidence,
      mapped_item: m.item,
      suggested_category: m.category,
      final_decision: finalChoice,
      hold_flag: holdFlag,
      hold_score: draft.holdScore,
      action: holdFlag ? "판단 보류함 등록" : "학생 판단 완료",
      image_saved: false,
      app_version: "aiways-final-polish-v1"
    };

    const list = records();
    list.unshift(record);
    saveRecords(list);
    updateDashboards();
  }

  async function handleFile(app, file) {
    if (!file) return;

    const photo = $('[data-role="photo"]', app);
    const img = $('[data-role="img"]', app);
    const result = $('[data-role="result"]', app);

    const objectUrl = URL.createObjectURL(file);

    img.src = objectUrl;
    img.style.display = "block";
    photo.classList.add("has-image", "scanning");

    result.innerHTML = `
      <div class="aiways-opapp-wait">
        <strong>AI 판단 초안 작성중</strong>
        <span>물건 후보·재질 후보·확인 질문을 정리하고 있습니다.</span>
      </div>
    `;

    updateProgress(app, "사진 불러오는 중", 12);

    await new Promise(resolve => {
      if (img.complete) resolve();
      else img.onload = resolve;
    });

    updateProgress(app, "이미지 전처리 중", 28);
    setTimeout(() => updateProgress(app, "사진 속 물체 후보 추정 중", 55), 250);
    setTimeout(() => updateProgress(app, "분리배출 규칙으로 보정 중", 78), 650);

    const draft = await classifyImage(img, file);

    setTimeout(() => {
      updateProgress(app, "학생 최종 판단 카드 생성 완료", 100);
      photo.classList.remove("scanning");
      showResult(app, draft);
      URL.revokeObjectURL(objectUrl);
    }, 950);
  }

  function bindApp(root) {
    const app = root.querySelector(".aiways-opapp") || root;

    $('[data-role="camera"]', app)?.addEventListener("click", () => $('[data-role="camera-input"]', app)?.click());
    $('[data-role="upload"]', app)?.addEventListener("click", () => $('[data-role="upload-input"]', app)?.click());

    $('[data-role="camera-input"]', app)?.addEventListener("change", event => handleFile(app, event.target.files?.[0]));
    $('[data-role="upload-input"]', app)?.addEventListener("change", event => handleFile(app, event.target.files?.[0]));
  }

  function removePreviewOnlyText() {
    $$("p,div,span").forEach(el => {
      const t = clean(el.textContent);
      if (t === "발표 중 업로드한 사진은 이 브라우저 안에서만 미리보기로 사용됩니다.") {
        el.remove();
      }
    });
  }

  function polishProjectPage() {
    const page = findPageByText("환경 보호 포스터를 만드는 수업이 아니라");
    if (!page) return;

    page.classList.add("aiways-project-polished");

    $$("h1,h2,div,p", page).forEach(el => {
      const t = clean(el.textContent);

      if (t.includes("환경 보호 포스터를 만드는 수업이 아니라") && t.includes("학교의 버리는 순간을 바꾸는 수업입니다")) {
        el.classList.add("aiways-project-title-fixed");
        el.innerHTML = `
          <span class="project-line">환경 보호 포스터를 만드는 수업이 아니라,</span>
          <span class="project-line">학교의 버리는 순간을 바꾸는 수업입니다.</span>
        `;
      }
    });
  }

  function polishCurriculumPage() {
    const page = findPageByText("교육과정 기반 수업설계");
    if (!page) return;

    page.classList.add("aiways-curriculum-polished");

    $$("a", page).forEach(a => {
      const t = clean(a.textContent);
      if (
        t.includes("미래엔") ||
        t.includes("엠티처") ||
        t.includes("아이스크림") ||
        t.includes("T셀파") ||
        t.includes("티셀파") ||
        t.includes("교과서 열기")
      ) {
        a.remove();
      }
    });

    ["실과", "사회", "국어"].forEach(subject => {
      const card = $$("article,div,section,li", page)
        .filter(el => {
          const rect = el.getBoundingClientRect();
          const t = clean(el.textContent);
          return rect.width > 120 && rect.height > 60 && t.includes(subject);
        })
        .sort((a, b) => {
          const ar = a.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          return ar.width * ar.height - br.width * br.height;
        })[0];

      if (!card) return;

      card.classList.add("aiways-subject-card-clickable");
      card.dataset.subjectLink = LINKS[subject];

      if (card.dataset.subjectClickBound !== "1") {
        card.dataset.subjectClickBound = "1";
        card.addEventListener("click", () => {
          window.open(card.dataset.subjectLink, "_blank", "noopener,noreferrer");
        });
      }
    });

    $$("article,div,section,li", page).forEach(el => {
      const t = clean(el.textContent);
      if (/6실|6사|6국|성취기준|2022 개정/.test(t)) {
        el.classList.add("aiways-achievement-hover-only");
        $$("a,button", el).forEach(child => child.remove());
      }
    });
  }

  function polishFlowPage() {
    const page = findPageByText("차시흐름");
    if (!page) return;

    page.classList.add("aiways-flow-polished");
  }

  function polishGalleryPage() {
    const page = findPageByText("학생 산출물 갤러리") || findPageByText("갤러리", "학생");
    if (!page || page.dataset.galleryPolished === "1") return;

    page.dataset.galleryPolished = "1";
    page.classList.add("aiways-gallery-polished");

    $$("h1,h2,h3", page).forEach(el => {
      if (clean(el.textContent).includes("학생 산출물 갤러리")) {
        el.textContent = "갤러리";
      }
    });

    const hero = document.createElement("div");
    hero.className = "aiways-gallery-hero";
    hero.innerHTML = `
      <div class="aiways-gallery-kicker">Output Gallery</div>
      <h1 class="aiways-gallery-title">갤러리</h1>
      <p class="aiways-gallery-sub">
        학생들이 발견한 불편함, AI와 함께 확장한 아이디어, 사람이 다시 판단한 기록을 모아
        우리 학교 자원순환 UX가 어떻게 바뀌었는지 보여주는 산출물 아카이브입니다.
      </p>
    `;

    page.insertBefore(hero, page.firstChild);
  }

  function polishSortingPage() {
    const page = findPageByText("3초판단") || findPageByText("3-Second Sorting Helper App");
    if (!page) return;

    page.classList.add("aiways-sorting-polished");

    const teachableExists = $(".aiways-teachable-learn-btn", page);
    if (!teachableExists) {
      const target = $$("div,article,section", page)
        .filter(el => clean(el.textContent).includes("Teachable Machine") || clean(el.textContent).includes("티처블"))
        .sort((a, b) => {
          const ar = a.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          return ar.width * ar.height - br.width * br.height;
        })[0];

      if (target) {
        const a = document.createElement("a");
        a.href = LINKS.teachable;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "aiways-teachable-learn-btn";
        a.textContent = "Teachable Machine 배우기 ↗";
        target.appendChild(a);
      }
    }
  }

  function polishPlaybookPage() {
    const page = findPageByText("PLAY BOOK") || findPageByText("플레이북");
    if (!page) return;

    page.classList.add("aiways-playbook-polished");

    $$("h1,h2,h3,div,span", page).forEach(el => {
      const t = clean(el.textContent);

      if (t === "PLAY BOOK" || t === "플레이북") {
        el.textContent = "PLAY BOOK 자료실";
      }

      if (t === "END" || t === "End" || t === "앤드 마크") {
        el.remove();
      }
    });

    $$("a,button", page).forEach(el => {
      const t = clean(el.textContent);

      if (t.includes("GitHub 코드보기") || t.includes("GitHub 코드 보기")) {
        el.textContent = "GitHub 저장소로 찾아가기";
        if (el.tagName.toLowerCase() === "a" && (!el.href || el.href === window.location.href + "#")) {
          el.href = LINKS.github;
          el.target = "_blank";
          el.rel = "noopener noreferrer";
        }
      }
    });
  }

  function run() {
    hideHeaderCta();
    fixHeroCopy();
    removePreviewOnlyText();

    renderSchoolDashboard();
    renderClassDashboard();
    renderLandfill();
    renderMiniApp();

    polishProjectPage();
    polishCurriculumPage();
    polishFlowPage();
    polishGalleryPage();
    polishSortingPage();
    polishPlaybookPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  window.addEventListener("aiways-record-updated", updateDashboards);
  window.addEventListener("resize", () => setTimeout(run, 180), { passive: true });

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    run();

    if (tries >= 18) clearInterval(timer);
  }, 600);
})();
