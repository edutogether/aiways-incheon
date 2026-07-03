(() => {
  /*
    수도권매립지 공식 API
    - 공공데이터포털 등록 URL: https://dream-ics.slc.or.kr/cp/bs/bs0063/cpbs0063/selectApiArMerInfo.do
    - 공사에서 부여한 Key 필요.
    - 키를 받으면 아래 SLCORP_API_KEY에 넣거나, 브라우저 콘솔에서:
      localStorage.setItem("aiways_slc_api_key", "발급받은키")
  */
  const SLCORP_API_URL = "https://dream-ics.slc.or.kr/cp/bs/bs0063/cpbs0063/selectApiArMerInfo.do";
  const SLCORP_API_KEY = "";

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

  const MATERIALS = {
    plastic: {
      emoji: "🥤",
      item: "플라스틱 컵·페트병",
      category: "플라스틱류",
      bin: "플라스틱 배출함",
      guide: "내용물을 비우고, 가능하면 헹군 뒤 라벨·뚜껑·빨대는 분리해 배출합니다.",
      features: [
        "컵·병·투명 용기 형태로 보입니다.",
        "라벨, 뚜껑, 빨대는 사진만으로 완전히 확인하기 어렵습니다.",
        "음료가 남아 있는지, 오염이 있는지는 사람이 직접 확인해야 합니다."
      ],
      questions: [
        "안에 음료나 이물질이 남아 있나요?",
        "라벨·뚜껑·빨대를 분리했나요?",
        "헹궈서 깨끗하게 만들 수 있나요?"
      ],
      holdBase: 34,
      carbon: 32.5
    },

    paperpack: {
      emoji: "🥛",
      item: "우유갑·종이팩",
      category: "종이팩",
      bin: "종이팩 전용 수거함",
      guide: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 종이팩 전용 수거함에 배출합니다.",
      features: [
        "팩 형태의 종이 용기로 보입니다.",
        "겉보기에는 종이처럼 보여도 일반 종이류와 공정이 다를 수 있습니다.",
        "내용물 잔여 여부는 사람이 확인해야 합니다."
      ],
      questions: [
        "내용물을 완전히 비웠나요?",
        "안쪽을 헹굴 수 있나요?",
        "종이류가 아니라 종이팩 전용으로 따로 모을 수 있나요?"
      ],
      holdBase: 28,
      carbon: 25
    },

    paper: {
      emoji: "📄",
      item: "깨끗한 종이·종이상자",
      category: "종이류",
      bin: "종이류 배출함",
      guide: "물기와 음식물이 묻지 않았다면 펼쳐서 종이류로 배출합니다. 테이프와 비닐은 가능한 한 제거합니다.",
      features: [
        "평평한 종이 또는 상자 형태로 보입니다.",
        "코팅 여부와 음식물 오염은 사진만으로 확정하기 어렵습니다.",
        "테이프, 스프링, 비닐이 붙어 있는지 확인이 필요합니다."
      ],
      questions: [
        "음식물이나 물기가 묻어 있나요?",
        "코팅지나 영수증처럼 일반 종이와 다른 재질인가요?",
        "테이프·비닐·스프링을 제거했나요?"
      ],
      holdBase: 26,
      carbon: 15
    },

    can: {
      emoji: "🥫",
      item: "캔",
      category: "캔류",
      bin: "캔류 배출함",
      guide: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다. 이물질이 들어 있으면 먼저 제거합니다.",
      features: [
        "금속 캔 형태로 보입니다.",
        "안쪽에 내용물이 남아 있는지는 사진만으로 확인하기 어렵습니다.",
        "이물질이 들어 있으면 분리배출 품질이 떨어질 수 있습니다."
      ],
      questions: [
        "내용물이 완전히 비어 있나요?",
        "담배꽁초나 다른 쓰레기가 들어 있지 않나요?",
        "캔류 배출함에 따로 넣을 수 있나요?"
      ],
      holdBase: 20,
      carbon: 38
    },

    vinyl: {
      emoji: "🍿",
      item: "과자봉지·비닐",
      category: "비닐류 또는 재확인",
      bin: "비닐류 배출함 / 판단 보류함",
      guide: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다. 기름기나 양념이 많으면 판단 보류합니다.",
      features: [
        "얇은 포장재 또는 비닐 형태로 보입니다.",
        "오염·기름기·양념 묻음은 사진만으로 애매할 수 있습니다.",
        "깨끗한 비닐인지 오염된 포장재인지 사람이 확인해야 합니다."
      ],
      questions: [
        "과자 부스러기나 양념이 많이 묻어 있나요?",
        "내용물을 털어내면 깨끗한가요?",
        "비닐류로 보기 애매하면 판단 보류할까요?"
      ],
      holdBase: 62,
      carbon: 12
    },

    general: {
      emoji: "🧾",
      item: "영수증·코팅종이·오염물",
      category: "일반쓰레기 또는 판단 보류",
      bin: "일반쓰레기 / 판단 보류함",
      guide: "영수증, 코팅지, 심하게 오염된 종이·용기는 일반쓰레기 또는 판단 보류로 처리합니다.",
      features: [
        "종이처럼 보이지만 일반 종이류가 아닐 가능성이 있습니다.",
        "코팅, 감열지, 오염 여부는 사람이 확인해야 합니다.",
        "AI가 종이로 보더라도 재활용 가능 여부는 다를 수 있습니다."
      ],
      questions: [
        "영수증이나 코팅된 종이인가요?",
        "음식물이나 기름이 묻어 있나요?",
        "깨끗하게 분리배출할 수 없다면 일반쓰레기 또는 보류가 맞나요?"
      ],
      holdBase: 68,
      carbon: 4
    },

    complex: {
      emoji: "🖋️",
      item: "볼펜·복합재질 물건",
      category: "판단 보류",
      bin: "판단 보류함",
      guide: "여러 재질이 섞인 소형 물건은 재활용 판단이 어렵습니다. 바로 버리지 말고 판단 보류함에 등록합니다.",
      features: [
        "한 가지 재질로 보기 어려운 물건일 수 있습니다.",
        "작고 복합적인 물건은 AI가 물체 이름을 맞혀도 배출 기준은 애매할 수 있습니다.",
        "분해 가능한지, 학교 기준이 있는지 확인이 필요합니다."
      ],
      questions: [
        "플라스틱, 금속, 고무 등이 섞여 있나요?",
        "분리해서 버릴 수 있나요?",
        "바로 버리지 말고 판단 보류함에 등록할까요?"
      ],
      holdBase: 82,
      carbon: 0
    },

    hold: {
      emoji: "🤔",
      item: "기타·판단 보류 물건",
      category: "판단 보류",
      bin: "판단 보류함",
      guide: "학습 데이터 밖이거나 재질이 애매한 물건입니다. AI가 단정하지 않고 사람이 최종 판단하도록 보류합니다.",
      features: [
        "AI가 확실하게 분류하기 어려운 물건입니다.",
        "사진만으로 재질·오염·코팅 여부를 확정하기 어렵습니다.",
        "수업에서는 이런 사례가 가장 좋은 토론 데이터가 됩니다."
      ],
      questions: [
        "이 물건은 어떤 재질이 가장 많이 섞여 있나요?",
        "오염되었거나 코팅되어 있나요?",
        "친구들과 기준을 확인하기 위해 판단 보류함에 넣을까요?"
      ],
      holdBase: 92,
      carbon: 0
    }
  };

  const LABEL_RULES = [
    { key: "plastic", words: ["plastic", "cup", "bottle", "container", "water bottle", "플라스틱", "페트", "컵", "생수병", "병"] },
    { key: "paperpack", words: ["milk", "carton", "paper pack", "우유", "종이팩", "팩"] },
    { key: "paper", words: ["paper", "cardboard", "box", "book", "notebook", "종이", "상자", "활동지", "공책"] },
    { key: "can", words: ["can", "tin", "aluminum", "soda", "캔"] },
    { key: "vinyl", words: ["bag", "wrapper", "packet", "snack", "plastic bag", "비닐", "봉지", "과자"] },
    { key: "general", words: ["receipt", "dirty", "stained", "thermal", "영수증", "오염", "코팅", "기름"] },
    { key: "complex", words: ["pen", "ballpoint", "marker", "pencil", "볼펜", "펜", "복합", "학용품"] },
    { key: "hold", words: ["unknown", "object", "기타", "판단", "보류", "애매"] }
  ];

  const FINAL_CHOICES = [
    "플라스틱류",
    "종이팩",
    "종이류",
    "캔류",
    "비닐류",
    "일반쓰레기",
    "판단 보류"
  ];

  const DEFAULT_CONFUSING = {
    "비닐 코팅 종이컵": 4,
    "과자 포장지": 3,
    "영수증": 3,
    "음식물 묻은 종이": 2,
    "볼펜": 2
  };

  const FALLBACK_LANDFILL = {
    totalTon: 19507,
    previousDelta: -3.2,
    inboundRate: 68.3,
    marginRate: 32.7,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    trend: [53, 56, 58, 60, 61, 63, 68],
    bars: [51, 55, 58, 59, 60, 62, 64]
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => (value || "").replace(/\s+/g, " ").trim();

  let selectedClass = localStorage.getItem("aiways_selected_class") || "5학년 1반";
  if (!BASELINE_CLASSES[selectedClass]) selectedClass = "5학년 1반";

  let selectedGrade = BASELINE_CLASSES[selectedClass].grade;
  let modelPromise = null;
  let appInstanceCounter = 0;
  let landfillState = JSON.parse(localStorage.getItem("aiways_landfill_cache") || "null") || FALLBACK_LANDFILL;

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

  function findHeadingCard(headingText) {
    const heading = $$("h1,h2,h3,h4,div,span,p").find(el => clean(el.textContent) === headingText);
    if (!heading) return null;

    const preferred = heading.closest(".aiw-card, article, [class*='card'], [class*='Card']");
    if (preferred && preferred !== document.body) {
      const rect = preferred.getBoundingClientRect();
      if (rect.width > 260 && rect.height > 120) return preferred;
    }

    let node = heading;
    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      const t = clean(node.textContent);

      if (t.includes(headingText) && rect.width > 260 && rect.height > 120) {
        return node;
      }

      node = node.parentElement;
    }

    return null;
  }

  function metric(label, value, unit) {
    return `
      <div class="aiways-ops-metric">
        <span>${label}</span>
        <strong>${value}<small>${unit}</small></strong>
      </div>
    `;
  }

  function barRow(label, value, max) {
    const width = Math.max(8, Math.round(value / Math.max(1, max) * 100));

    return `
      <div class="aiways-ops-bar-row">
        <span class="aiways-ops-bar-label">${label}</span>
        <span class="aiways-ops-bar-track">
          <i class="aiways-ops-bar-fill" style="width:${width}%"></i>
        </span>
        <span class="aiways-ops-bar-value">${value}</span>
      </div>
    `;
  }

  function donut(title, value) {
    const safe = Math.max(0, Math.min(100, Math.round(value)));

    return `
      <div class="aiways-ops-donut-box">
        <div class="aiways-ops-donut-title">${title}</div>
        <div class="aiways-ops-donut" style="--value:${safe}">
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
      <div class="aiways-ops-top5">
        ${top.map(([label, value], index) => `
          <div class="aiways-ops-top5-row">
            <div class="aiways-ops-top5-label">${index + 1}. ${label}</div>
            <div class="aiways-ops-top5-track">
              <span class="aiways-ops-top5-fill" style="width:${Math.max(8, Math.round(value / max * 100))}%"></span>
            </div>
            <div class="aiways-ops-top5-value">${value}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderSchoolDashboard() {
    const card = findHeadingCard("우리학교 자원순환 대시보드");
    if (!card) return;

    const s = statsForGrade(selectedGrade);
    const gradeRows = ["3학년", "4학년", "5학년", "6학년"].map(g => [g, statsForGrade(g).observed]);
    const max = Math.max(...gradeRows.map(([, v]) => v), 1);

    const successRate = Math.round(s.converted / Math.max(1, s.observed - s.hold) * 100);
    const holdRate = Math.round(s.hold / Math.max(1, s.observed) * 100);

    card.classList.add("aiways-ops-dashboard");
    card.dataset.aiwaysOpsLocked = "school";
    card.innerHTML = `
      <div class="aiways-ops-inner">
        <div class="aiways-ops-head">
          <div>
            <div class="aiways-ops-kicker">School Resource Dashboard</div>
            <h2 class="aiways-ops-title">우리학교 자원순환 대시보드</h2>
          </div>

          <select class="aiways-ops-select" id="aiways-ops-school-grade">
            ${["3학년", "4학년", "5학년", "6학년"].map(g => `
              <option value="${g}" ${g === selectedGrade ? "selected" : ""}>${g}</option>
            `).join("")}
          </select>
        </div>

        <div class="aiways-ops-school-grid">
          <div class="aiways-ops-metrics">
            ${metric("참여 학급", s.classes, "학급")}
            ${metric("배출 관찰", s.observed, "건")}
            ${metric("판단 보류", s.hold, "건")}
          </div>

          <div class="aiways-ops-right">
            <div class="aiways-ops-panel">
              <div class="aiways-ops-panel-title">학년별 참여</div>
              ${gradeRows.map(([label, value]) => barRow(label, value, max)).join("")}
            </div>

            <div class="aiways-ops-donut-pair">
              ${donut("배출 성공률", successRate)}
              ${donut("판단 보류 비율", holdRate)}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#aiways-ops-school-grade", card)?.addEventListener("change", event => {
      selectedGrade = event.target.value;

      const firstClass = Object.keys(BASELINE_CLASSES).find(name => BASELINE_CLASSES[name].grade === selectedGrade);
      if (firstClass) selectedClass = firstClass;

      localStorage.setItem("aiways_selected_class", selectedClass);
      renderDashboards();
    });
  }

  function renderClassDashboard() {
    const card = findHeadingCard("우리반 자원순환 대시보드");
    if (!card) return;

    const s = statsForClass(selectedClass);
    const classes = Object.keys(BASELINE_CLASSES);

    card.classList.add("aiways-ops-dashboard");
    card.dataset.aiwaysOpsLocked = "class";
    card.innerHTML = `
      <div class="aiways-ops-inner">
        <div class="aiways-ops-head">
          <div>
            <div class="aiways-ops-kicker">Class Resource Dashboard</div>
            <h2 class="aiways-ops-title">우리반 자원순환 대시보드</h2>
            <p class="aiways-ops-desc">우리반의 버리는 순간을 AI와 함께 분류하고, 다시 확인한 기록입니다.</p>
          </div>

          <select class="aiways-ops-select" id="aiways-ops-class-select">
            ${classes.map(name => `
              <option value="${name}" ${name === selectedClass ? "selected" : ""}>${name}</option>
            `).join("")}
          </select>
        </div>

        <div class="aiways-ops-class-grid">
          <div class="aiways-ops-metrics">
            ${metric("오늘 관찰", s.observed, "건")}
            ${metric("판단 보류", s.hold, "건")}
            ${metric("전환 사례", s.converted, "건")}
          </div>

          <div class="aiways-ops-side">
            <div class="aiways-ops-panel">
              <div class="aiways-ops-panel-title">헷갈린 물건 TOP 5</div>
              ${top5Markup()}
            </div>

            <div class="aiways-ops-panel">
              <div class="aiways-ops-panel-title">우리반 랭킹</div>
              <div class="aiways-ops-rank">
                <div class="aiways-ops-rank-medal">🏅</div>
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

    $("#aiways-ops-class-select", card)?.addEventListener("change", event => {
      selectedClass = event.target.value;
      selectedGrade = gradeOfClass(selectedClass);

      localStorage.setItem("aiways_selected_class", selectedClass);
      renderDashboards();
    });
  }

  function renderDashboards() {
    renderSchoolDashboard();
    renderClassDashboard();
  }

  function parseNumber(value) {
    if (value == null) return null;

    const n = Number(String(value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function flattenArrays(obj, out = []) {
    if (Array.isArray(obj)) {
      if (obj.length && typeof obj[0] === "object") out.push(obj);
      obj.forEach(v => flattenArrays(v, out));
    } else if (obj && typeof obj === "object") {
      Object.values(obj).forEach(v => flattenArrays(v, out));
    }

    return out;
  }

  function extractWeight(row) {
    const keys = Object.keys(row || {});
    const priority = [
      "실중량",
      "실 중량",
      "realWt",
      "realWeight",
      "netWeight",
      "weight",
      "중량",
      "반입량",
      "WGT",
      "WT"
    ];

    for (const p of priority) {
      const key = keys.find(k => k.toLowerCase().includes(p.toLowerCase()));
      const value = key ? parseNumber(row[key]) : null;
      if (value != null) return value;
    }

    for (const key of keys) {
      if (/(중량|weight|wt|wgt|반입량)/i.test(key)) {
        const value = parseNumber(row[key]);
        if (value != null) return value;
      }
    }

    return null;
  }

  async function tryFetchLandfillWithParams(params) {
    const url = new URL(SLCORP_API_URL);

    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store"
    });

    if (!response.ok) throw new Error("SLC API HTTP " + response.status);

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("SLC API JSON parse failed");
    }
  }

  async function fetchLandfillData() {
    const key = clean(localStorage.getItem("aiways_slc_api_key") || SLCORP_API_KEY);

    if (!key) {
      return {
        ...FALLBACK_LANDFILL,
        source: "API 키 미설정"
      };
    }

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const ymd = `${y}${m}${d}`;
    const ymdDash = `${y}-${m}-${d}`;

    const paramTries = [
      { KEY: key, pIndex: 1, pSize: 500, type: "json" },
      { key: key, pIndex: 1, pSize: 500, type: "json" },
      { apiKey: key, pIndex: 1, pSize: 500, type: "json" },
      { serviceKey: key, pageNo: 1, numOfRows: 500, resultType: "json" },
      { KEY: key, startDate: ymd, endDate: ymd, pIndex: 1, pSize: 500, type: "json" },
      { KEY: key, startDate: ymdDash, endDate: ymdDash, pIndex: 1, pSize: 500, type: "json" }
    ];

    let lastError = null;

    for (const params of paramTries) {
      try {
        const json = await tryFetchLandfillWithParams(params);
        const arrays = flattenArrays(json).sort((a, b) => b.length - a.length);
        const rows = arrays[0] || [];

        const weights = rows
          .map(row => extractWeight(row))
          .filter(v => v != null && Number.isFinite(v));

        if (!weights.length) continue;

        let total = weights.reduce((s, v) => s + v, 0);

        if (total > 100000) total = total / 1000;

        const totalTon = Math.max(1, Math.round(total));
        const yearlyQuota = 533019;
        const inboundRate = Math.min(100, Math.round(totalTon / yearlyQuota * 1000) / 10);
        const marginRate = Math.max(0, Math.round((100 - inboundRate) * 10) / 10);

        const base = Math.max(30, inboundRate - 8);
        const trend = [0, 1, 2, 3, 4, 5, 6].map(i => Math.round((base + i * (inboundRate - base) / 6) * 10) / 10);
        const bars = trend.map(v => Math.max(10, Math.round(v)));

        return {
          totalTon,
          previousDelta: 0,
          inboundRate,
          marginRate,
          source: "공식 OpenAPI",
          updatedAt: new Date().toISOString(),
          trend,
          bars
        };
      } catch (error) {
        lastError = error;
      }
    }

    console.warn("SLC API fallback:", lastError);

    return {
      ...FALLBACK_LANDFILL,
      source: "API 호출 실패·fallback"
    };
  }

  function linePath(values, width, height, pad = 16) {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = Math.max(1, max - min);

    return values.map((v, i) => {
      const x = pad + i * ((width - pad * 2) / Math.max(1, values.length - 1));
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  function chartSvg(data) {
    const width = 320;
    const height = 160;
    const values = data.trend || FALLBACK_LANDFILL.trend;
    const bars = data.bars || FALLBACK_LANDFILL.bars;
    const maxBar = Math.max(...bars, 100);

    return `
      <svg class="aiways-ops-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="opsChartLine" x1="0" x2="1">
            <stop offset="0%" stop-color="#6cf4df"/>
            <stop offset="100%" stop-color="#6bbcff"/>
          </linearGradient>
          <linearGradient id="opsChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#6cf4df" stop-opacity=".35"/>
            <stop offset="100%" stop-color="#6bbcff" stop-opacity=".05"/>
          </linearGradient>
        </defs>

        <line x1="32" y1="22" x2="32" y2="132" stroke="rgba(220,234,252,.18)" stroke-width="1"/>
        <line x1="32" y1="132" x2="304" y2="132" stroke="rgba(220,234,252,.18)" stroke-width="1"/>

        <text x="6" y="32" fill="rgba(220,234,252,.62)" font-size="10">70%</text>
        <text x="6" y="83" fill="rgba(220,234,252,.62)" font-size="10">60%</text>
        <text x="6" y="134" fill="rgba(220,234,252,.62)" font-size="10">50%</text>

        ${bars.map((v, i) => {
          const x = 44 + i * 38;
          const h = Math.max(18, Math.round((v / maxBar) * 92));
          const y = 132 - h;
          return `<rect x="${x}" y="${y}" width="20" height="${h}" rx="5" fill="rgba(108,244,223,.20)"/>`;
        }).join("")}

        <path d="${linePath(values, width, height, 44)}" fill="none" stroke="url(#opsChartLine)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>

        ${values.map((v, i) => {
          const max = Math.max(...values);
          const min = Math.min(...values);
          const range = Math.max(1, max - min);
          const x = 44 + i * ((width - 88) / Math.max(1, values.length - 1));
          const y = height - 16 - ((v - min) / range) * (height - 32);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#6cf4df" stroke="#061829" stroke-width="2"/>`;
        }).join("")}

        ${["월","화","수","목","금","토","오늘"].map((label, i) => {
          const x = 44 + i * 38;
          return `<text x="${x + 10}" y="150" text-anchor="middle" fill="rgba(220,234,252,.66)" font-size="10">${label}</text>`;
        }).join("")}
      </svg>
    `;
  }

  function renderLandfill() {
    const card = findHeadingCard("수도권매립지 모니터");
    if (!card) return;

    const d = landfillState;
    const updated = new Date(d.updatedAt || Date.now()).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

    card.classList.add("aiways-ops-dashboard");
    card.dataset.aiwaysOpsLocked = "landfill";
    card.innerHTML = `
      <div class="aiways-ops-inner">
        <div class="aiways-ops-head">
          <div>
            <div class="aiways-ops-kicker">공식 관리 지표 구조</div>
            <h2 class="aiways-ops-title">수도권매립지 모니터</h2>
            <p class="aiways-ops-desc">수도권매립지 흐름을 한눈에 읽을 수 있도록 정리한 실시간 모니터입니다.</p>
          </div>

          <button class="aiways-ops-select" id="aiways-ops-landfill-refresh" type="button">↻ 새로고침</button>
        </div>

        <div class="aiways-ops-landfill-grid">
          <div class="aiways-ops-landfill-metrics">
            <div class="aiways-ops-landfill-metric">
              <strong>${Math.round(d.totalTon).toLocaleString("ko-KR")}t</strong>
              <span>오늘 반입 총량</span>
            </div>

            <div class="aiways-ops-landfill-metric">
              <strong>${Number(d.previousDelta).toFixed(1)}%</strong>
              <span>전일 대비</span>
            </div>

            <div class="aiways-ops-landfill-metric">
              <strong>${Number(d.inboundRate).toFixed(1)}%</strong>
              <span>총량 대비 반입률</span>
            </div>

            <div class="aiways-ops-landfill-metric">
              <strong>${Number(d.marginRate).toFixed(1)}%</strong>
              <span>잔여 관리 여력</span>
            </div>
          </div>

          <div class="aiways-ops-landfill-body">
            <div class="aiways-ops-chart">
              <div class="aiways-ops-chart-title">반입률 추이 · 최근 7일</div>
              ${chartSvg(d)}
              <div class="aiways-ops-live-note">데이터 상태: ${d.source} · 갱신 ${updated}</div>
            </div>

            <div class="aiways-ops-landfill-side">
              ${donut("총량 대비 반입률", d.inboundRate)}
              ${donut("잔여 관리 여력", d.marginRate)}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#aiways-ops-landfill-refresh", card)?.addEventListener("click", async () => {
      await refreshLandfill(true);
    });
  }

  async function refreshLandfill(force = false) {
    const cacheAge = Date.now() - new Date(landfillState.updatedAt || 0).getTime();

    if (!force && landfillState.source !== "fallback" && cacheAge < 1000 * 60 * 10) {
      renderLandfill();
      return;
    }

    landfillState = await fetchLandfillData();
    localStorage.setItem("aiways_landfill_cache", JSON.stringify(landfillState));
    renderLandfill();
  }

  function cameraIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/>
        <circle cx="12" cy="13" r="3.5"/>
      </svg>
    `;
  }

  function galleryIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2"/>
        <circle cx="9" cy="10" r="1.5"/>
        <path d="M21 15l-4-4-5 5-2-2-4 4"/>
      </svg>
    `;
  }

  function findAppHosts() {
    const nodes = $$("section,article,div").filter(el => {
      const t = clean(el.textContent);
      const rect = el.getBoundingClientRect();

      return rect.width > 260
        && rect.height > 180
        && t.includes("버려지는 순간을 기록하세요");
    });

    const unique = [];

    nodes
      .sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)
      .forEach(el => {
        if (unique.some(u => u.contains(el) || el.contains(u))) return;

        const area = el.getBoundingClientRect().width * el.getBoundingClientRect().height;
        if (area > window.innerWidth * window.innerHeight * 1.2) return;

        unique.push(el);
      });

    return unique.slice(0, 4);
  }

  function renderAppHost(host, index) {
    if (!host || host.dataset.aiwaysOpsApp === "1") return;

    host.dataset.aiwaysOpsApp = "1";
    host.classList.add("aiways-ops-dashboard");

    const id = `aiways-opapp-${++appInstanceCounter}`;
    const full = host.getBoundingClientRect().height > 500;

    host.innerHTML = `
      <div class="aiways-ops-inner">
        <div class="aiways-opapp ${full ? "aiways-opapp-full" : ""}" id="${id}">
          <div class="aiways-opapp-head">
            <div class="aiways-opapp-kicker">3-Second Sorting Helper App</div>
            <h2 class="aiways-opapp-title">버려지는 순간을 기록하세요</h2>
            <p class="aiways-opapp-desc">사진을 찍으면 AI가 먼저 판단 초안을 만들고, 학생이 다시 확인해 대시보드 기록으로 연결합니다.</p>
          </div>

          <div class="aiways-opapp-picks">
            <button class="aiways-opapp-pick" type="button" data-role="camera">
              <span class="aiways-opapp-icon">${cameraIcon()}</span>
              <strong>지금 버려지는 순간 찰칵</strong>
              <span>카메라로 바로 촬영해 분석하기</span>
            </button>

            <button class="aiways-opapp-pick" type="button" data-role="upload">
              <span class="aiways-opapp-icon">${galleryIcon()}</span>
              <strong>기록해둔 순간 판단하기</strong>
              <span>이미 찍어둔 사진으로 확인하기</span>
            </button>
          </div>

          <div class="aiways-opapp-work">
            <div class="aiways-opapp-preview">
              <input class="aiways-opapp-hidden" type="file" accept="image/*" capture="environment" data-role="camera-input">
              <input class="aiways-opapp-hidden" type="file" accept="image/*" data-role="upload-input">

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
                <strong>AI분류 대기중</strong>
                <span>사진을 촬영하거나 업로드하면<br>AI 판단 초안과 학생 최종판단 버튼이 표시됩니다.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const app = $(`#${id}`);

    $('[data-role="camera"]', app)?.addEventListener("click", () => $('[data-role="camera-input"]', app)?.click());
    $('[data-role="upload"]', app)?.addEventListener("click", () => $('[data-role="upload-input"]', app)?.click());

    $('[data-role="camera-input"]', app)?.addEventListener("change", event => {
      handleAppFile(app, event.target.files?.[0], "camera");
    });

    $('[data-role="upload-input"]', app)?.addEventListener("change", event => {
      handleAppFile(app, event.target.files?.[0], "upload");
    });
  }

  function updateProgress(app, step, percent) {
    $('[data-role="step"]', app).textContent = step;
    $('[data-role="percent"]', app).textContent = `${percent}%`;
    $('[data-role="fill"]', app).style.width = `${percent}%`;
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

  function materialFromText(value) {
    const text = clean(value).toLowerCase();

    for (const rule of LABEL_RULES) {
      if (rule.words.some(word => text.includes(word.toLowerCase()))) {
        return MATERIALS[rule.key];
      }
    }

    return MATERIALS.hold;
  }

  function riskFor(material, confidence) {
    if (material === MATERIALS.hold || material === MATERIALS.complex) {
      return {
        mode: "hold",
        label: "판단 보류 권장",
        message: "AI가 확실히 단정하기 어려운 물건입니다. 사람의 최종 판단이 필요합니다."
      };
    }

    if (confidence >= 80) {
      return {
        mode: "confirm",
        label: "AI 1차 판단",
        message: "AI가 비교적 높은 확신으로 후보를 제안했습니다. 그래도 오염·코팅·복합재질 여부는 사람이 확인해야 합니다."
      };
    }

    if (confidence >= 60) {
      return {
        mode: "recheck",
        label: "사람 재확인 필요",
        message: "AI가 후보를 찾았지만 확신도가 충분히 높지는 않습니다. 사람이 다시 확인해야 합니다."
      };
    }

    return {
      mode: "hold",
      label: "판단 보류 권장",
      message: "AI 확신도가 낮습니다. 무리하게 분류하지 말고 판단 보류함에 등록하는 것이 안전합니다."
    };
  }

  function holdScore(material, confidence, mode) {
    let score = material.holdBase || 50;

    if (confidence < 80) score += 10;
    if (confidence < 60) score += 20;
    if (confidence < 45) score += 15;
    if (mode === "recheck") score += 10;
    if (mode === "hold") score += 25;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async function classifyImage(img, file) {
    try {
      const model = await ensureModel();
      const predictions = await model.classify(img, 5);
      const best = predictions[0] || { className: "unknown", probability: 0 };
      const raw = `${file?.name || ""} ${predictions.map(p => p.className).join(" ")}`;
      const material = materialFromText(raw);
      const confidence = Math.max(35, Math.round((best.probability || 0.35) * 100));
      const risk = riskFor(material, confidence);

      return {
        engine: "기본 이미지 모델",
        rawLabel: best.className,
        confidence,
        material,
        risk,
        holdScore: holdScore(material, confidence, risk.mode),
        predictions: predictions.slice(0, 4).map(p => ({
          label: p.className,
          probability: Math.round(p.probability * 100)
        }))
      };
    } catch {
      const material = materialFromText(file?.name || "unknown");
      const confidence = 42;
      const risk = riskFor(material, confidence);

      return {
        engine: "파일명·수업 규칙 기반",
        rawLabel: "이미지 모델 연결 실패",
        confidence,
        material,
        risk,
        holdScore: holdScore(material, confidence, risk.mode),
        predictions: []
      };
    }
  }

  function listMarkup(items) {
    return `
      <ul class="aiways-opapp-list">
        ${items.map(item => `<li>${item}</li>`).join("")}
      </ul>
    `;
  }

  function predictionText(draft) {
    if (!draft.predictions?.length) return "후보 없음";
    return draft.predictions.map(p => `${p.label} ${p.probability}%`).join(" · ");
  }

  function pillClass(mode) {
    if (mode === "hold") return "hold";
    if (mode === "recheck") return "warn";
    return "";
  }

  function showResult(app, draft) {
    const result = $('[data-role="result"]', app);
    const m = draft.material;

    result.innerHTML = `
      <div class="aiways-opapp-result-card">
        <h3>${m.emoji} ${m.item}</h3>

        <div class="aiways-opapp-badges">
          <span class="aiways-opapp-pill">${draft.engine}</span>
          <span class="aiways-opapp-pill">신뢰도 ${draft.confidence}%</span>
          <span class="aiways-opapp-pill ${pillClass(draft.risk.mode)}">${draft.risk.label}</span>
        </div>

        <div class="aiways-opapp-info-grid">
          <div class="aiways-opapp-info">
            <small>물건 후보</small>
            <b>${m.item}</b>
          </div>

          <div class="aiways-opapp-info">
            <small>재질 후보</small>
            <b>${m.category}</b>
          </div>

          <div class="aiways-opapp-info">
            <small>배출 후보</small>
            <b>${m.bin}</b>
          </div>
        </div>

        <div class="aiways-opapp-section">
          <strong>사진으로 보이는 특징</strong>
          ${listMarkup(m.features)}
        </div>

        <div class="aiways-opapp-section">
          <strong>사람이 마지막으로 확인할 질문</strong>
          ${listMarkup(m.questions)}
        </div>

        <div class="aiways-opapp-section">
          <strong>AI 원본 인식:</strong> ${draft.rawLabel}<br>
          <strong>후보:</strong> ${predictionText(draft)}<br>
          <strong>판단 메시지:</strong> ${draft.risk.message}<br>
          ${m.guide}
        </div>

        <div class="aiways-opapp-section">
          <strong>학생 최종 판단</strong>
          <div class="aiways-opapp-final">
            ${FINAL_CHOICES.map(choice => `
              <button
                type="button"
                class="${choice === m.category ? "primary" : ""} ${choice === "판단 보류" ? "hold" : ""}"
                data-final-choice="${choice}"
              >
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
            최종 판단: ${button.dataset.finalChoice} · 대시보드에 기록했습니다.<br>
            사진은 저장하지 않고 판단 데이터만 남깁니다.
          </div>
        `);
      });
    });
  }

  async function handleAppFile(app, file, inputType) {
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

    updateProgress(app, "이미지 전처리 중", 25);

    setTimeout(() => updateProgress(app, "사진 속 물체 후보 추정 중", 45), 240);
    setTimeout(() => updateProgress(app, "분리배출 규칙으로 보정 중", 70), 700);

    const draft = await classifyImage(img, file);
    draft.inputType = inputType;

    setTimeout(() => {
      updateProgress(app, "학생 최종 판단 카드 생성 완료", 100);
      photo.classList.remove("scanning");
      showResult(app, draft);
      URL.revokeObjectURL(objectUrl);
    }, 1080);
  }

  function saveFinalChoice(draft, finalChoice) {
    const className = selectedClass;
    const grade = gradeOfClass(className);
    const m = draft.material;
    const holdFlag = finalChoice === "판단 보류";

    const record = {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      privacy_id: sessionId(),
      school: "우리학교",
      grade,
      class_name: className,
      group_id: "미지정",
      input_type: draft.inputType || "image",
      ai_engine: "AI 판단 초안",
      ai_raw_label: draft.rawLabel,
      ai_confidence: draft.confidence,
      mapped_item: m.item,
      suggested_category: m.category,
      final_decision: finalChoice,
      hold_flag: holdFlag,
      hold_score: draft.holdScore,
      hold_reason: holdFlag ? "학생 최종 판단에서 보류 선택" : "",
      contamination_check: "사람 최종 확인 질문 기반",
      action: holdFlag ? "판단 보류함 등록" : "학생 판단 완료",
      image_saved: false,
      app_version: "aiways-operational-dashboard-app-sync-v1"
    };

    const list = records();
    list.unshift(record);
    saveRecords(list);

    renderDashboards();
    window.dispatchEvent(new CustomEvent("aiways-record-updated", { detail: record }));
  }

  function renderApps() {
    findAppHosts().forEach((host, index) => renderAppHost(host, index));
  }

  async function boot() {
    renderDashboards();
    renderLandfill();
    renderApps();
    await refreshLandfill(false);

    setInterval(() => {
      renderLandfill();
    }, 1000 * 60 * 5);

    window.addEventListener("aiways-record-updated", renderDashboards);

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      renderDashboards();
      renderLandfill();
      renderApps();

      if (tries >= 30) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
