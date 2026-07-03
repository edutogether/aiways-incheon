
(() => {
  const NAV_ORDER = ["대시보드", "프로젝트", "교육과정", "H-A-H", "차시흐름", "갤러리", "3초판단", "자료실"];
  const NAV_ITEMS = [
    { label: "대시보드", href: "#top", selector: ".aiw-hero", observe: ".aiw-dashboard-panel" },
    { label: "프로젝트", href: "#project", selector: "#project", observe: ".aiways-mf-project" },
    { label: "교육과정", href: "#curriculum", selector: "#curriculum", observe: ".curriculum-grid" },
    { label: "H-A-H", href: "#hah", selector: "#hah", observe: ".model-grid" },
    { label: "차시흐름", href: "#lesson", selector: "#lesson", observe: ".journey-grid" },
    { label: "갤러리", href: "#outputs", selector: "#outputs", observe: ".gallery-grid" },
    { label: "3초판단", href: "#quick-app", selector: "#quick-app", observe: ".aiways-mf-sort-wrap" },
    { label: "자료실", href: "#playbook", selector: "#playbook", observe: ".resource-grid" }
  ];
  const BASE_RECORD_KEY = "aiways_base_records";
  const STUDENT_INPUT_TYPES = new Set(["image", "search"]);

  const DEFAULT_CLASSES = {
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
      item: "플라스틱 컵·페트병",
      category: "플라스틱류",
      bin: "플라스틱 배출함",
      guide: "내용물을 비우고 가능하면 헹군 뒤 라벨·뚜껑·빨대는 분리해 배출합니다.",
      questions: ["내용물이 남아 있나요?", "라벨·뚜껑·빨대가 분리됐나요?"],
      holdScore: 32
    },
    paperpack: {
      item: "우유갑·종이팩",
      category: "종이팩",
      bin: "종이팩 전용 수거함",
      guide: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 종이팩 전용 수거함에 배출합니다.",
      questions: ["내용물을 완전히 비웠나요?", "안쪽을 헹굴 수 있나요?"],
      holdScore: 28
    },
    paper: {
      item: "깨끗한 종이·종이상자",
      category: "종이류",
      bin: "종이류 배출함",
      guide: "물기와 음식물이 묻지 않았다면 펼쳐서 종이류로 배출합니다.",
      questions: ["음식물이나 물기가 묻어 있나요?", "코팅지나 영수증은 아닌가요?"],
      holdScore: 26
    },
    can: {
      item: "캔",
      category: "캔류",
      bin: "캔류 배출함",
      guide: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다.",
      questions: ["내용물이 비어 있나요?", "다른 쓰레기가 들어 있지 않나요?"],
      holdScore: 20
    },
    vinyl: {
      item: "과자봉지·비닐",
      category: "비닐류",
      bin: "비닐류 배출함 / 판단 보류함",
      guide: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다.",
      questions: ["부스러기나 양념이 많이 묻어 있나요?", "털어내면 깨끗한가요?"],
      holdScore: 62
    },
    hold: {
      item: "기타·판단 보류 물건",
      category: "판단 보류",
      bin: "판단 보류함",
      guide: "AI가 확실하게 분류하기 어려운 물건입니다. 사람이 최종 판단합니다.",
      questions: ["어떤 재질이 가장 많이 섞여 있나요?", "친구들과 기준을 확인해야 할까요?"],
      holdScore: 92
    }
  };

  const LABEL_RULES = [
    { key: "plastic", words: ["plastic", "cup", "bottle", "container", "water bottle", "플라스틱", "페트", "컵", "생수병", "병"] },
    { key: "paperpack", words: ["milk", "carton", "paper pack", "우유", "종이팩", "팩"] },
    { key: "paper", words: ["paper", "cardboard", "box", "book", "notebook", "종이", "상자", "공책"] },
    { key: "can", words: ["can", "tin", "aluminum", "soda", "캔"] },
    { key: "vinyl", words: ["bag", "wrapper", "packet", "snack", "비닐", "봉지", "과자"] }
  ];

  const FINAL_CHOICES = ["플라스틱류", "종이팩", "종이류", "캔류", "비닐류", "일반쓰레기", "판단 보류"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => (value || "").replace(/\s+/g, " ").trim();

  let selectedClass = localStorage.getItem("aiways_selected_class") || "5학년 1반";
  if (!DEFAULT_CLASSES[selectedClass]) selectedClass = "5학년 1반";
  let selectedGrade = DEFAULT_CLASSES[selectedClass].grade;
  let modelPromise = null;
  let booted = false;
  let activePageLabel = "";
  let sectionObserver = null;
  const observedPages = new Map();
  const observedTargets = new Map();

  function getRecords() {
    try {
      const records = JSON.parse(localStorage.getItem("aiways_records")) || [];
      return records.filter(record => {
        const type = String(record.input_type || "image").toLowerCase();
        return type !== "base" && (STUDENT_INPUT_TYPES.has(type) || !record.input_type);
      });
    } catch {
      return [];
    }
  }

  function setRecords(list) {
    const records = list.filter(record => String(record.input_type || "image").toLowerCase() !== "base");
    localStorage.setItem("aiways_records", JSON.stringify(records));
  }

  function getBaseRecords() {
    try {
      return (JSON.parse(localStorage.getItem(BASE_RECORD_KEY)) || [])
        .filter(record => String(record.input_type || "").toLowerCase() === "base");
    } catch {
      return [];
    }
  }

  function getSessionId() {
    let id = localStorage.getItem("aiways_session_id");
    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("aiways_session_id", id);
    }
    return id;
  }

  function classRecords(name) {
    return getRecords().filter(r => r.class_name === name);
  }

  function gradeRecords(grade) {
    return getRecords().filter(r => r.grade === grade);
  }

  function numberFrom(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function metricValue(row) {
    const keys = [
      "value",
      "count",
      "metric_value",
      "observed",
      "observed_count",
      "hold",
      "hold_count",
      "converted",
      "converted_count",
      "rank",
      "ai_confidence",
      "hold_score",
      "final_decision",
      "action",
      "mapped_item",
      "suggested_category"
    ];
    for (const key of keys) {
      const value = numberFrom(row[key]);
      if (value !== null) return value;
    }
    return null;
  }

  function metricLabel(row) {
    return clean([
      row.metric,
      row.metric_name,
      row.mapped_item,
      row.suggested_category,
      row.final_decision,
      row.action,
      row.ai_raw_label
    ].filter(Boolean).join(" "));
  }

  function baseRowsForClass(name) {
    return getBaseRecords().filter(row => row.class_name === name);
  }

  function baseStatsForClass(name) {
    const fallback = DEFAULT_CLASSES[name] || DEFAULT_CLASSES["5학년 1반"];
    const rows = baseRowsForClass(name);
    if (!rows.length) return { ...fallback };

    const stats = { grade: fallback.grade, observed: 0, hold: 0, converted: 0, rank: fallback.rank };
    let matchedMetric = false;

    rows.forEach(row => {
      const label = metricLabel(row);
      const value = metricValue(row);

      if (label.includes("순위") || label.toLowerCase().includes("rank")) {
        if (value !== null) stats.rank = value;
        matchedMetric = true;
        return;
      }

      if (label.includes("보류")) {
        stats.hold += value ?? 1;
        matchedMetric = true;
        return;
      }

      if (label.includes("전환") || label.includes("완료") || label.includes("확인") || label.toLowerCase().includes("converted")) {
        stats.converted += value ?? 1;
        matchedMetric = true;
        return;
      }

      if (label.includes("관찰") || label.includes("배출") || label.toLowerCase().includes("observed")) {
        stats.observed += value ?? 1;
        matchedMetric = true;
        return;
      }

      stats.observed += 1;
    });

    if (!matchedMetric) {
      stats.hold = rows.filter(row => row.hold_flag || row.final_decision === "판단 보류").length;
      stats.converted = rows.filter(row => row.action === "학생 판단 완료").length;
    }

    if (stats.observed <= 0) stats.observed = fallback.observed;
    if (stats.converted <= 0 && !rows.some(row => metricLabel(row).includes("전환") || metricLabel(row).includes("완료"))) {
      stats.converted = fallback.converted;
    }

    return stats;
  }

  function classStats(name) {
    const base = baseStatsForClass(name);
    const rec = classRecords(name);
    return {
      observed: base.observed + rec.length,
      hold: base.hold + rec.filter(r => r.hold_flag).length,
      converted: base.converted + rec.filter(r => r.action === "학생 판단 완료").length,
      rank: base.rank
    };
  }

  function gradeStats(grade) {
    const entries = Object.entries(DEFAULT_CLASSES).filter(([, v]) => v.grade === grade);
    const rec = gradeRecords(grade);
    const base = entries.map(([name]) => baseStatsForClass(name));
    return {
      classes: entries.length,
      observed: base.reduce((s, v) => s + v.observed, 0) + rec.length,
      hold: base.reduce((s, v) => s + v.hold, 0) + rec.filter(r => r.hold_flag).length,
      converted: base.reduce((s, v) => s + v.converted, 0) + rec.filter(r => r.action === "학생 판단 완료").length
    };
  }

  function normalizeText() {
    $$("a,button,span,h1,h2,h3,div").forEach(el => {
      const t = clean(el.textContent);
      if (t === "플레이북" || t === "PLAY BOOK" || t === "PLAY BOOK 자료실") el.textContent = "자료실";
      if (t === "3초 판단 앱" || t === "3초판단앱") el.textContent = "3초판단";
    });
  }

  function labelForText(text) {
    if (text.includes("버리는 순간") && text.includes("데이터가 되다") && text.includes("우리학교 자원순환 대시보드")) return "대시보드";
    if (text.includes("환경 보호 포스터") || text.includes("학교의 버리는 순간을 바꾸는 수업") || text.includes("버리는 순간을 데이터로 바꾸다")) return "프로젝트";
    if (text.includes("교육과정 기반 수업설계") || text.includes("Curriculum-Based")) return "교육과정";
    if (text.includes("H-A-H Learning Loop") || text.includes("사람이 발견하고") || text.includes("Human") && text.includes("AI") && text.includes("Human")) return "H-A-H";
    if (text.includes("차시흐름") || text.includes("6-Lesson Journey")) return "차시흐름";
    if (text.includes("갤러리") || text.includes("Student Outputs")) return "갤러리";
    if (text.includes("3초판단") || text.includes("3-Second Sorting Helper App") || text.includes("버려지는 순간을 판단하세요")) return "3초판단";
    if (text.includes("자료실") || text.includes("PLAY BOOK")) return "자료실";
    return null;
  }

  function pageCandidates() {
    return NAV_ITEMS
      .map(item => {
        const el = $(item.selector);
        if (!el) return null;
        const observeEl = item.observe ? $(item.observe, el) || el : el;
        el.classList.add("aiways-mf-page");
        el.dataset.aiwaysLabel = item.label;
        observeEl.dataset.aiwaysLabel = item.label;
        return { el, observeEl, label: item.label, href: item.href };
      })
      .filter(Boolean)
      .sort((a, b) => a.el.offsetTop - b.el.offsetTop);
  }

  function currentPage() {
    const pages = pageCandidates();
    if (!pages.length) return null;

    const header = $("header") || $(".site-header") || $(".header");
    const headerH = header ? header.getBoundingClientRect().height : 68;
    const y = headerH + (window.innerHeight - headerH) * 0.46;

    let best = pages[0];
    let score = Infinity;

    pages.forEach(page => {
      const rect = page.el.getBoundingClientRect();
      const center = rect.top + rect.height * 0.42;
      let s = Math.abs(center - y);
      if (rect.top <= y && rect.bottom >= y) s -= 300;
      if (s < score) {
        score = s;
        best = page;
      }
    });

    return best;
  }

  function ensureNav() {
    const header = $("header") || $(".site-header") || $(".header");
    if (!header) return;

    const nav = $("nav", header) || $('[class*="nav"]', header);
    if (!nav) return;

    nav.innerHTML = NAV_ITEMS.map(item => `<a class="aiways-mf-nav" href="${item.href}">${item.label}</a>`).join("");
  }

  function setNav(label) {
    const header = $("header") || $(".site-header") || $(".header");
    const nav = header && ($("nav", header) || $('[class*="nav"]', header) || header);
    if (!nav) return;

    $$("a,button,span", nav).forEach(el => {
      const t = clean(el.textContent);
      const active = NAV_ORDER.includes(t) && t === label;
      el.classList.toggle("aiways-mf-active", active);
      el.classList.toggle("aiways-rescue-active", false);
      el.classList.toggle("is-active", false);
      if (NAV_ORDER.includes(t)) {
        if (active) el.setAttribute("aria-current", "page");
        else el.removeAttribute("aria-current");
      }
    });
  }

  function setActivePage(label, el) {
    if (!label || !el) return;
    setNav(label);
    if (activePageLabel === label && el.classList.contains("aiways-mf-lit")) return;
    activePageLabel = label;
    $$(".aiways-mf-page").forEach(page => page.classList.toggle("aiways-mf-lit", page === el));
  }

  function selectObservedPage() {
    const candidates = Array.from(observedPages.values())
      .filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.65)
      .sort((a, b) => {
        const ac = Math.abs(a.boundingClientRect.top + a.boundingClientRect.height / 2 - window.innerHeight / 2);
        const bc = Math.abs(b.boundingClientRect.top + b.boundingClientRect.height / 2 - window.innerHeight / 2);
        if (ac !== bc) return ac - bc;
        return b.intersectionRatio - a.intersectionRatio;
      });

    const entry = candidates[0];
    if (!entry) return;
    const page = observedTargets.get(entry.target);
    if (!page) return;
    setActivePage(page.label, page.el);
  }

  function initSectionObserver() {
    const pages = pageCandidates();
    if (!pages.length) return;

    if (sectionObserver) sectionObserver.disconnect();
    observedPages.clear();
    observedTargets.clear();

    if (!("IntersectionObserver" in window)) {
      const page = currentPage();
      if (page) setActivePage(page.label, page.el);
      return;
    }

    sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => observedPages.set(entry.target, entry));
      selectObservedPage();
    }, {
      threshold: [0.65, 0.7, 0.75]
    });

    pages.forEach(page => {
      observedTargets.set(page.observeEl, page);
      sectionObserver.observe(page.observeEl);
    });

    requestAnimationFrame(() => {
      const page = currentPage();
      if (page) setActivePage(page.label, page.el);
    });
  }

  function smallestContainer(...texts) {
    const candidates = $$("section,article,div").filter(el => {
      const t = clean(el.textContent);
      const r = el.getBoundingClientRect();
      return r.width > 240 && r.height > 120 && texts.every(x => t.includes(x));
    });
    return candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    })[0] || null;
  }

  function dashboardCard(selector, ...texts) {
    const direct = $(selector);
    if (direct) return direct;
    if (window.innerWidth < 700) return null;
    return smallestContainer(...texts);
  }

  function pageByText(...texts) {
    const candidates = $$("main > section, main > article, main > div, body > section, body > article, section, article, div").filter(el => {
      const t = clean(el.textContent);
      const r = el.getBoundingClientRect();
      return r.width > 260 && r.height > 180 && texts.every(x => t.includes(x));
    });
    return candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0] || null;
  }

  function metric(label, value, unit) {
    return `
      <div class="aiways-mf-metric">
        <span>${label}</span>
        <strong>${value}<small>${unit}</small></strong>
      </div>
    `;
  }

  function bar(label, value, max) {
    const width = Math.max(8, Math.round(value / Math.max(1, max) * 100));
    return `
      <div class="aiways-mf-bar-row">
        <span class="aiways-mf-bar-label">${label}</span>
        <span class="aiways-mf-bar-track"><i class="aiways-mf-bar-fill" style="width:${width}%"></i></span>
        <span class="aiways-mf-bar-value">${value}</span>
      </div>
    `;
  }

  function donut(title, value) {
    const safe = Math.max(0, Math.min(100, Math.round(value)));
    return `
      <div class="aiways-mf-donut-box">
        <div class="aiways-mf-donut-title">${title}</div>
        <div class="aiways-mf-donut" style="--value:${safe}">
          <b>${safe}%</b>
        </div>
      </div>
    `;
  }

  function top3() {
    const counts = {
      "비닐 코팅 종이컵": 4,
      "과자 포장지": 3,
      "영수증": 3
    };

    classRecords(selectedClass).forEach(r => {
      if (r.hold_flag || r.final_decision === "판단 보류") {
        const key = r.mapped_item || r.ai_raw_label || "판단 보류 물건";
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const list = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const max = Math.max(...list.map(([, v]) => v), 1);

    return list.map(([label, value], i) => `
      <div class="aiways-mf-top-row">
        <div class="aiways-mf-top-label">${i + 1}. ${label}</div>
        <div class="aiways-mf-top-track"><span class="aiways-mf-top-fill" style="width:${Math.max(8, Math.round(value / max * 100))}%"></span></div>
        <div class="aiways-mf-top-val">${value}</div>
      </div>
    `).join("");
  }

  function renderSchool() {
    const card = dashboardCard(".school-card", "우리학교", "자원순환", "대시보드");
    if (!card || (card.dataset.mfRendered === "school" && $(".aiways-mf-dash-inner", card))) return;

    const s = gradeStats(selectedGrade);
    const gradeRows = ["3학년", "4학년", "5학년", "6학년"].map(g => [g, gradeStats(g).observed]);
    const max = Math.max(...gradeRows.map(([, v]) => v), 1);
    const success = Math.round(s.converted / Math.max(1, s.observed - s.hold) * 100);
    const hold = Math.round(s.hold / Math.max(1, s.observed) * 100);

    card.classList.add("aiways-mf-dashboard");
    card.dataset.mfRendered = "school";
    card.innerHTML = `
      <div class="aiways-mf-dash-inner">
        <div class="aiways-mf-dash-head">
          <div>
            <div class="aiways-mf-kicker">School Resource Dashboard</div>
            <h2 class="aiways-mf-dash-title">우리학교 자원순환 대시보드</h2>
          </div>
          <select class="aiways-mf-select" data-mf-grade>
            ${["3학년", "4학년", "5학년", "6학년"].map(g => `<option value="${g}" ${g === selectedGrade ? "selected" : ""}>${g}</option>`).join("")}
          </select>
        </div>
        <div class="aiways-mf-school-grid">
          <div class="aiways-mf-metrics">
            ${metric("참여 학급", s.classes, "학급")}
            ${metric("배출 관찰", s.observed, "건")}
            ${metric("판단 보류", s.hold, "건")}
          </div>
          <div class="aiways-mf-right">
            <div class="aiways-mf-panel">
              <div class="aiways-mf-panel-title">학년별 참여</div>
              ${gradeRows.map(([label, value]) => bar(label, value, max)).join("")}
            </div>
            <div class="aiways-mf-donuts">
              ${donut("배출 성공률", success)}
              ${donut("판단 보류 비율", hold)}
            </div>
          </div>
        </div>
      </div>
    `;

    $('[data-mf-grade]', card)?.addEventListener("change", e => {
      selectedGrade = e.target.value;
      selectedClass = Object.keys(DEFAULT_CLASSES).find(name => DEFAULT_CLASSES[name].grade === selectedGrade) || selectedClass;
      localStorage.setItem("aiways_selected_class", selectedClass);
      rerenderDashboards();
    });
  }

  function renderClass() {
    const card = dashboardCard(".class-card", "우리반", "자원순환", "대시보드");
    if (!card || (card.dataset.mfRendered === "class" && $(".aiways-mf-dash-inner", card))) return;

    const s = classStats(selectedClass);
    const classes = Object.keys(DEFAULT_CLASSES);

    card.classList.add("aiways-mf-dashboard");
    card.dataset.mfRendered = "class";
    card.innerHTML = `
      <div class="aiways-mf-dash-inner">
        <div class="aiways-mf-dash-head">
          <div>
            <div class="aiways-mf-kicker">Class Resource Dashboard</div>
            <h2 class="aiways-mf-dash-title">우리반 자원순환 대시보드</h2>
            <p class="aiways-mf-dash-desc">우리반의 버리는 순간을 AI와 함께 분류하고, 다시 확인한 기록입니다.</p>
          </div>
          <select class="aiways-mf-select" data-mf-class>
            ${classes.map(name => `<option value="${name}" ${name === selectedClass ? "selected" : ""}>${name}</option>`).join("")}
          </select>
        </div>
        <div class="aiways-mf-class-grid">
          <div class="aiways-mf-metrics">
            ${metric("오늘 관찰", s.observed, "건")}
            ${metric("판단 보류", s.hold, "건")}
            ${metric("전환 사례", s.converted, "건")}
          </div>
          <div class="aiways-mf-side">
            <div class="aiways-mf-panel">
              <div class="aiways-mf-panel-title">헷갈린 물건 TOP 3</div>
              ${top3()}
            </div>
            <div class="aiways-mf-panel">
              <div class="aiways-mf-panel-title">우리반 랭킹</div>
              <div class="aiways-mf-rank">
                <div class="aiways-mf-rank-medal">🏅</div>
                <div><strong>${s.rank}위</strong><span>전체 ${classes.length}개 학급 중</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $('[data-mf-class]', card)?.addEventListener("change", e => {
      selectedClass = e.target.value;
      selectedGrade = DEFAULT_CLASSES[selectedClass].grade;
      localStorage.setItem("aiways_selected_class", selectedClass);
      rerenderDashboards();
    });
  }

  function chartSvg() {
    return `
      <svg class="aiways-mf-svg" viewBox="0 0 340 150" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mfLine" x1="0" x2="1">
            <stop offset="0%" stop-color="#6cf4df"/>
            <stop offset="100%" stop-color="#6bbcff"/>
          </linearGradient>
        </defs>
        <line x1="34" y1="18" x2="34" y2="124" stroke="rgba(220,234,252,.18)" stroke-width="1"/>
        <line x1="34" y1="124" x2="318" y2="124" stroke="rgba(220,234,252,.18)" stroke-width="1"/>
        <text x="5" y="25" fill="rgba(220,234,252,.62)" font-size="10">70%</text>
        <text x="5" y="75" fill="rgba(220,234,252,.62)" font-size="10">60%</text>
        <text x="5" y="126" fill="rgba(220,234,252,.62)" font-size="10">50%</text>
        ${[55,58,62,60,64,66,68].map((v, i) => {
          const x = 51 + i * 38;
          const h = Math.round((v - 45) * 3.1);
          const y = 124 - h;
          return `<rect x="${x}" y="${y}" width="22" height="${h}" rx="6" fill="rgba(108,244,223,.22)"/>`;
        }).join("")}
        <path d="M62,46 L100,49 L138,56 L176,61 L214,53 L252,68 L290,82" fill="none" stroke="url(#mfLine)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        ${["월","화","수","목","금","토","오늘"].map((label, i) => `<text x="${62 + i * 38}" y="143" text-anchor="middle" fill="rgba(220,234,252,.66)" font-size="10">${label}</text>`).join("")}
      </svg>
    `;
  }

  function renderLandfill() {
    const card = dashboardCard(".landfill-card", "수도권매립지", "모니터");
    if (!card || (card.dataset.mfRendered === "landfill" && $(".aiways-mf-dash-inner", card))) return;

    card.classList.add("aiways-mf-dashboard");
    card.dataset.mfRendered = "landfill";
    card.innerHTML = `
      <div class="aiways-mf-dash-inner">
        <div class="aiways-mf-dash-head">
          <div>
            <div class="aiways-mf-kicker">공식 관리 지표 구조</div>
            <h2 class="aiways-mf-dash-title">수도권매립지 모니터</h2>
            <p class="aiways-mf-dash-desc">수도권매립지 흐름을 한눈에 읽을 수 있도록 정리한 실시간 모니터입니다.</p>
          </div>
        </div>
        <div class="aiways-mf-landfill-body">
          <div class="aiways-mf-landfill-metrics">
            <div class="aiways-mf-landfill-metric"><strong>18,420t</strong><span>생활폐기물 반입량</span></div>
            <div class="aiways-mf-landfill-metric"><strong>-2.8%</strong><span>전일 대비</span></div>
            <div class="aiways-mf-landfill-metric"><strong>63.4%</strong><span>총량 대비 반입률</span></div>
            <div class="aiways-mf-landfill-metric"><strong>36.6%</strong><span>잔여 관리 여력</span></div>
          </div>
          <div class="aiways-mf-chart-grid">
            <div class="aiways-mf-chart">
              <div class="aiways-mf-panel-title">반입률 추이 · 최근 7일</div>
              ${chartSvg()}
            </div>
            <div class="aiways-mf-donuts" style="grid-template-columns:1fr;grid-template-rows:1fr 1fr;">
              ${donut("총량 대비 반입률", 63)}
              ${donut("잔여 관리 여력", 37)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function cameraIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M5 8.5h3.2l1.4-2h4.8l1.4 2H19a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z"/>
        <circle cx="12" cy="14" r="3.4"/>
      </svg>
    `;
  }

  function galleryIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="4" y="5" width="16" height="14" rx="2"/>
        <path d="M8 15l2.5-3 2.5 2.5 2-2.2L20 18"/>
        <circle cx="9" cy="9" r="1.3"/>
      </svg>
    `;
  }

  function renderMiniApp() {
    const card = dashboardCard("#classify, .upload-card", "버려지는 순간", "기록");
    if (!card || (card.dataset.mfRendered === "mini" && $(".aiways-mf-mini", card))) return;

    card.classList.add("aiways-mf-dashboard");
    card.dataset.mfRendered = "mini";

    card.innerHTML = `
      <div class="aiways-mf-mini">
        <div class="aiways-mf-mini-head">
          <div class="aiways-mf-kicker">3-Second Sorting Helper App</div>
          <h2 class="aiways-mf-mini-title">버려지는 순간을 기록하세요</h2>
          <p class="aiways-mf-mini-desc">사진을 찍어 AI와 함께 분류하며 판단합니다.</p>
        </div>

        <div class="aiways-mf-pick-grid">
          <button class="aiways-mf-pick" type="button" data-mf-camera>
            ${cameraIcon()}
            <strong>카메라로 지금 찍기</strong>
            <span>바로 촬영해 AI 판단 초안 만들기</span>
          </button>
          <button class="aiways-mf-pick" type="button" data-mf-upload>
            ${galleryIcon()}
            <strong>찍은 사진 올리기</strong>
            <span>이미 찍은 사진으로 판단하기</span>
          </button>
        </div>

        <input type="file" accept="image/*" capture="environment" data-mf-camera-input hidden>
        <input type="file" accept="image/*" data-mf-upload-input hidden>
      </div>
    `;

    card.querySelector("[data-mf-camera]")?.addEventListener("click", () => card.querySelector("[data-mf-camera-input]")?.click());
    card.querySelector("[data-mf-upload]")?.addEventListener("click", () => card.querySelector("[data-mf-upload-input]")?.click());
    card.querySelector("[data-mf-camera-input]")?.addEventListener("change", e => handleImageFile(e.target.files?.[0]));
    card.querySelector("[data-mf-upload-input]")?.addEventListener("change", e => handleImageFile(e.target.files?.[0]));
  }

  function rerenderDashboards() {
    ["school", "class"].forEach(type => {
      const el = $(`[data-mf-rendered="${type}"]`);
      if (el) el.dataset.mfRendered = "";
    });
    renderSchool();
    renderClass();
  }

  function materialFromText(value) {
    const text = clean(value).toLowerCase();
    for (const rule of LABEL_RULES) {
      if (rule.words.some(w => text.includes(w.toLowerCase()))) return MATERIALS[rule.key];
    }
    return MATERIALS.hold;
  }

  async function loadModel() {
    if (modelPromise) return modelPromise;

    modelPromise = new Promise(async (resolve, reject) => {
      try {
        const start = Date.now();
        while (!window.mobilenet && Date.now() - start < 9000) {
          await new Promise(r => setTimeout(r, 120));
        }
        if (!window.mobilenet) throw new Error("mobilenet unavailable");
        const model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
        resolve(model);
      } catch (e) {
        modelPromise = null;
        reject(e);
      }
    });

    return modelPromise;
  }

  async function classify(img, file) {
    try {
      const model = await loadModel();
      const predictions = await model.classify(img, 5);
      const raw = `${file?.name || ""} ${predictions.map(p => p.className).join(" ")}`;
      const material = materialFromText(raw);
      const best = predictions[0] || { className: "unknown", probability: 0.42 };
      return {
        material,
        rawLabel: best.className,
        confidence: Math.max(36, Math.round(best.probability * 100)),
        inputType: "image",
        predictions: predictions.slice(0, 4).map(p => `${p.className} ${Math.round(p.probability * 100)}%`)
      };
    } catch {
      const material = materialFromText(file?.name || "");
      return {
        material,
        rawLabel: "기본 이미지 모델 대기",
        confidence: 44,
        inputType: "image",
        predictions: []
      };
    }
  }

  function ensureModal() {
    let modal = $("#aiwaysMfModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "aiwaysMfModal";
    modal.className = "aiways-mf-modal aiways-mf-allow-motion";
    modal.innerHTML = `
      <div class="aiways-mf-modal-card">
        <div class="aiways-mf-modal-head">
          <div>
            <div class="aiways-mf-kicker">AI + 학생 판단</div>
            <h2>버려지는 순간 분석</h2>
          </div>
          <button class="aiways-mf-close" type="button" data-mf-close>×</button>
        </div>
        <div class="aiways-mf-modal-body">
          <div class="aiways-mf-photo">
            <img data-mf-modal-img alt="업로드한 사진">
            <div class="aiways-mf-scan"></div>
          </div>
          <div class="aiways-mf-result" data-mf-modal-result>
            <div class="aiways-mf-app-wait">
              <div>
                <strong>AI분류 중</strong>
                <span>사진 속 물체를 스캔하고 분리배출 기준으로 보정합니다.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("[data-mf-close]")?.addEventListener("click", () => modal.classList.remove("active"));
    modal.addEventListener("click", e => {
      if (e.target === modal) modal.classList.remove("active");
    });
    return modal;
  }

  async function handleImageFile(file) {
    if (!file) return;

    const modal = ensureModal();
    const img = modal.querySelector("[data-mf-modal-img]");
    const result = modal.querySelector("[data-mf-modal-result]");
    const objectUrl = URL.createObjectURL(file);

    modal.classList.add("active");
    img.src = objectUrl;
    result.innerHTML = `
      <div class="aiways-mf-app-wait">
        <div>
          <strong>AI분류 중</strong>
          <span>사진 속 물체를 스캔하고 분리배출 기준으로 보정합니다.</span>
        </div>
      </div>
    `;

    await new Promise(resolve => {
      if (img.complete) resolve();
      else img.onload = resolve;
    });

    const draft = await classify(img, file);
    setTimeout(() => {
      showImageResult(result, draft);
      URL.revokeObjectURL(objectUrl);
    }, 850);
  }

  function showImageResult(result, draft) {
    const m = draft.material;

    result.innerHTML = `
      <h3>${m.item}</h3>
      <div class="aiways-mf-badges">
        <span class="aiways-mf-badge">AI 판단 초안</span>
        <span class="aiways-mf-badge">신뢰도 ${draft.confidence}%</span>
        <span class="aiways-mf-badge">${m.category}</span>
      </div>

      <div class="aiways-mf-result-grid">
        <div class="aiways-mf-info"><small>물건 후보</small><b>${m.item}</b></div>
        <div class="aiways-mf-info"><small>재질 후보</small><b>${m.category}</b></div>
        <div class="aiways-mf-info"><small>배출 후보</small><b>${m.bin}</b></div>
        <div class="aiways-mf-info"><small>판단 보류 점수</small><b>${m.holdScore}점</b></div>
      </div>

      <div class="aiways-mf-result-section">
        <strong>사람이 마지막으로 확인할 질문</strong><br>
        ${m.questions.map(q => `• ${q}`).join("<br>")}
      </div>

      <div class="aiways-mf-result-section">
        <strong>AI 원본 인식:</strong> ${draft.rawLabel}<br>
        <strong>후보:</strong> ${draft.predictions.join(" · ") || "후보 없음"}<br>
        ${m.guide}
      </div>

      <div class="aiways-mf-result-section">
        <strong>학생 최종 판단</strong>
        <div class="aiways-mf-final-buttons">
          ${FINAL_CHOICES.map(choice => `<button type="button" class="${choice === m.category ? "primary" : ""}" data-mf-final="${choice}">${choice}</button>`).join("")}
        </div>
      </div>
    `;

    result.querySelectorAll("[data-mf-final]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.mfSaved === "1") return;
        result.querySelectorAll("[data-mf-final]").forEach(item => {
          item.dataset.mfSaved = "1";
          item.disabled = true;
        });
        saveFinal(draft, btn.dataset.mfFinal);
        result.insertAdjacentHTML("beforeend", `<div class="aiways-mf-saved">최종 판단 ${btn.dataset.mfFinal} · 대시보드에 기록했습니다.</div>`);
      });
    });
  }

  function saveFinal(draft, finalChoice) {
    const m = draft.material;
    const hold = finalChoice === "판단 보류";
    const rec = {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      privacy_id: getSessionId(),
      school: "우리학교",
      grade: DEFAULT_CLASSES[selectedClass].grade,
      class_name: selectedClass,
      input_type: draft.inputType || "image",
      ai_engine: "MobileNet + 수업용 분리배출 규칙",
      ai_raw_label: draft.rawLabel,
      ai_confidence: draft.confidence,
      mapped_item: m.item,
      suggested_category: m.category,
      final_decision: finalChoice,
      hold_flag: hold,
      hold_score: m.holdScore,
      action: hold ? "판단 보류함 등록" : "학생 판단 완료",
      image_saved: false,
      app_version: "aiways-master-finish"
    };

    const list = getRecords();
    list.unshift(rec);
    setRecords(list);
    rerenderDashboards();
  }

  function fixHeroCopy() {
    const page = pageByText("버리는 순간", "데이터가 되다", "AIWays Incheon은");
    if (!page) return;

    const target = $$("p,div", page).find(el => {
      const t = clean(el.textContent);
      return t.includes("AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다") &&
        t.includes("H-A-H 기반 수업 프로젝트입니다");
    });

    if (target) {
      target.classList.add("aiways-mf-hero-copy");
      target.innerHTML = `
        AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다.<br>
        우리가 실제로 쓰레기를 버리는 순간을 관찰하고,<br>
        AI를 통해 데이터를 1차 판단한 뒤 사람이 중심이 되어 다시 확인하는,<br>
        우리 학교의 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.
      `;
    }
  }

  function restoreProjectPage() {
    const page = pageByText("환경 보호 포스터") || pageByText("프로젝트", "버리는 순간");
    if (!page || page.dataset.mfProjectRestored === "1") return;

    page.dataset.mfProjectRestored = "1";
    page.dataset.aiwaysLabel = "프로젝트";
    page.classList.add("aiways-mf-page");

    page.innerHTML = `
      <div class="aiways-mf-project">
        <div>
          <div class="aiways-mf-project-kicker">Project Frame</div>
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
        <div class="aiways-mf-project-cards">
          <div class="aiways-mf-project-card">
            <strong>버리는 순간을 데이터로 바꾸다</strong>
            <span>교실의 작은 행동을 관찰 가능한 데이터로 바꾸고, 학급과 학교의 자원순환 흐름을 읽습니다.</span>
          </div>
          <div class="aiways-mf-project-card">
            <strong>AI가 먼저 제안하고, 사람이 최종 판단하다</strong>
            <span>AI는 빠른 후보를 제시하고, 학생은 오염·코팅·복합재질 같은 맥락을 검토합니다.</span>
          </div>
          <div class="aiways-mf-project-card">
            <strong>우리 학교 UX를 직접 개선하다</strong>
            <span>판단 보류함, 3초 판단앱, 퀴즈, 대시보드로 학생이 행동 변화의 설계자가 됩니다.</span>
          </div>
        </div>
      </div>
    `;
  }

  function fixCurriculum() {
    const page = pageByText("교육과정 기반 수업설계");
    if (!page) return;

    page.classList.add("aiways-mf-curriculum-up");

    page.innerHTML = page.innerHTML.replaceAll(
      "https://text.i-scream.co.kr/",
      "https://www.i-scream.co.kr/user/main/MainPage.do"
    );

    $$("a,button", page).forEach(el => {
      const t = clean(el.textContent);
      if (t.includes("6실05-05") || t.includes("E-book 열기") || t.includes("아이스크림 교과서") || t.includes("미래엔 엠티처") || t.includes("T셀파")) {
        el.remove();
      }
    });

    ["실과", "사회", "국어"].forEach(subject => {
      const card = $$("article,div,section,li", page)
        .filter(el => {
          const r = el.getBoundingClientRect();
          const t = clean(el.textContent);
          return r.width > 120 && r.height > 50 && t.includes(subject);
        })
        .sort((a, b) => {
          const ar = a.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          return ar.width * ar.height - br.width * br.height;
        })[0];

      if (!card) return;

      card.classList.add("aiways-mf-subject-clickable");
      card.dataset.mfSubject = subject;
      card.onclick = () => {
        const urls = {
          "실과": "https://www.m-teacher.co.kr/",
          "사회": "https://www.i-scream.co.kr/user/main/MainPage.do",
          "국어": "https://www.tsherpa.co.kr/"
        };
        window.open(urls[subject], "_blank", "noopener,noreferrer");
      };
    });

    $$("article,div,section,li", page).forEach(el => {
      const t = clean(el.textContent);
      if (/6실|6사|6국|성취기준|2022/.test(t)) {
        el.classList.add("aiways-mf-achievement");
      }
    });
  }

  function fixFlow() {
    const page = pageByText("차시흐름");
    if (!page) return;
    page.classList.add("aiways-mf-flow-page");
    $$("article,div", page).forEach((el, idx) => {
      const t = clean(el.textContent);
      if (/차시|Dashboard|배포|공유|Teachable|바이브|블록/.test(t)) {
        el.dataset.galleryLink = String(idx + 1);
      }
    });
  }

  function renderGallery() {
    const page = pageByText("갤러리") || pageByText("Student Outputs");
    if (!page || (page.dataset.mfGalleryDone === "1" && $(".aiways-mf-gallery", page))) return;

    page.dataset.mfGalleryDone = "1";
    page.dataset.aiwaysLabel = "갤러리";
    page.classList.add("aiways-mf-page");

    const items = [
      ["1차시", "문제 발견", "교실과 가정에서 실제로 헷갈렸던 분리배출 장면을 모읍니다."],
      ["2차시", "AI 아이디어 확장", "AI와 함께 3초 판단앱·보류함·퀴즈·랭킹 후보를 넓힙니다."],
      ["3차시", "인간 검증", "딜레마 토론으로 AI 제안을 우리 교실 기준에 맞게 걸러냅니다."],
      ["4차시", "블록코딩", "저버전 코딩으로 이미지 분류의 원리를 이해합니다."],
      ["5차시", "티처블머신", "우리반 물건 사진으로 교실 전용 AI 모델을 학습합니다."],
      ["6차시", "바이브코딩", "말로 기능을 설명하고 AI와 함께 앱 개선안을 만듭니다."],
      ["체험", "대시보드 활용", "교사 제작 대시보드에서 기록이 어떻게 읽히는지 체험합니다."],
      ["배포", "배포 및 공유", "학생 산출물과 수업 결과를 다른 반과 선생님에게 공유합니다."]
    ];

    page.innerHTML = `
      <div class="aiways-mf-gallery" data-gallery-main>
        <div class="aiways-mf-gallery-head">
          <div class="aiways-mf-section-kicker">Output Gallery</div>
          <h1>갤러리</h1>
          <p>학생들이 발견한 불편함, AI와 함께 확장한 아이디어, 사람이 다시 판단한 기록을 모아 우리 학교 자원순환 UX가 어떻게 바뀌었는지 보여주는 산출물 아카이브입니다.</p>
        </div>
        <div class="aiways-mf-gallery-grid">
          ${items.map((item, idx) => `
            <button class="aiways-mf-gallery-card" type="button" data-gallery-open="${idx}">
              <small>${item[0]}</small>
              <strong>${item[1]}</strong>
              <span>${item[2]}</span>
            </button>
          `).join("")}
        </div>
      </div>

      <div class="aiways-mf-gallery-detail" data-gallery-detail>
        <div class="aiways-mf-gallery-detail-head">
          <div>
            <div class="aiways-mf-section-kicker" data-detail-kicker>Gallery Detail</div>
            <h2 data-detail-title>갤러리</h2>
          </div>
          <button class="aiways-mf-back" type="button" data-gallery-back>차시흐름으로 돌아가기</button>
        </div>
        <div class="aiways-mf-gallery-slots">
          <div class="aiways-mf-gallery-slot">사진 1 업로드 예정</div>
          <div class="aiways-mf-gallery-slot">사진 2 업로드 예정</div>
        </div>
      </div>
    `;

    page.querySelectorAll("[data-gallery-open]").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = items[Number(btn.dataset.galleryOpen)];
        page.querySelector("[data-gallery-main]").style.display = "none";
        page.querySelector("[data-gallery-detail]").classList.add("active");
        page.querySelector("[data-detail-kicker]").textContent = item[0];
        page.querySelector("[data-detail-title]").textContent = item[1];
      });
    });

    page.querySelector("[data-gallery-back]")?.addEventListener("click", () => {
      const flow = pageCandidates().find(p => p.label === "차시흐름");
      page.querySelector("[data-gallery-detail]").classList.remove("active");
      page.querySelector("[data-gallery-main]").style.display = "";
      if (flow) {
        const header = $("header") || $(".site-header") || $(".header");
        const h = header ? header.getBoundingClientRect().height : 68;
        window.scrollTo({ top: Math.max(0, flow.el.offsetTop - h + 2), behavior: "smooth" });
      }
    });
  }

  function renderSortingPage() {
    const page = pageByText("3초판단") || pageByText("3-Second Sorting Helper App");
    if (!page || (page.dataset.mfSortingDone === "1" && $(".aiways-mf-app-tabs", page))) return;

    page.dataset.mfSortingDone = "1";
    page.dataset.aiwaysLabel = "3초판단";
    page.classList.add("aiways-mf-page", "aiways-mf-sort-page");

    page.innerHTML = `
      <div class="aiways-mf-sort-wrap">
        <div class="aiways-mf-sort-left">
          <div class="aiways-mf-section-kicker">Output · 3-Second Sorting Helper App</div>
          <h1>3초판단앱</h1>
          <p>
            학생이 사진을 찍거나 검색하면 AI가 먼저 물체 후보를 추정하고,
            학생이 다시 확인해 실천 기록·판단 보류함·퀴즈·통계로 연결하는 H-A-H 기반 자원순환 미니앱입니다.
          </p>
          <div class="aiways-mf-feature-grid">
            <div class="aiways-mf-feature"><strong>이미지 AI분류</strong><span>사진을 올리면 AI가 물체 후보와 재질 후보를 제안합니다.</span></div>
            <div class="aiways-mf-feature"><strong>3초 판단 검색</strong><span>우유갑, 영수증, 볼펜처럼 자주 헷갈리는 물건을 빠르게 확인합니다.</span></div>
            <div class="aiways-mf-feature"><strong>OX 퀴즈</strong><span>분리배출 기준을 게임처럼 확인하고 점수로 피드백합니다.</span></div>
            <div class="aiways-mf-feature"><strong>통계·보류함</strong><span>사진은 저장하지 않고 판단 결과만 쌓아 대시보드와 회의 안건으로 연결합니다.</span></div>
          </div>
        </div>

        <div class="aiways-mf-app">
          <div class="aiways-mf-app-head">
            <div>
              <div class="aiways-mf-kicker">AI + 학생 판단</div>
              <h2 class="aiways-mf-app-title">버려지는 순간을 판단하세요</h2>
            </div>
            <select class="aiways-mf-select" data-sort-class>
              ${Object.keys(DEFAULT_CLASSES).map(name => `<option value="${name}" ${name === selectedClass ? "selected" : ""}>${name}</option>`).join("")}
            </select>
          </div>

          <div class="aiways-mf-app-tabs">
            <button type="button" class="active">AI분류</button>
            <button type="button">퀴즈</button>
            <button type="button">통계</button>
            <button type="button">보류함</button>
          </div>

          <div class="aiways-mf-app-body">
            <div class="aiways-mf-app-left">
              <div class="aiways-mf-teachable">
                <label>우리반 Teachable Machine 모델 URL</label>
                <div class="aiways-mf-teachable-row">
                  <input type="url" data-tm-url placeholder="https://teachablemachine.withgoogle.com/models/...">
                  <button type="button" data-tm-save>연결</button>
                  <button type="button" data-tm-open>배우기</button>
                </div>
              </div>

              <div class="aiways-mf-pick-grid">
                <button class="aiways-mf-pick" type="button" data-sort-camera>${cameraIcon()}<strong>지금 버려지는 순간 찰칵</strong><span>카메라로 바로 촬영해 분류하기</span></button>
                <button class="aiways-mf-pick" type="button" data-sort-upload>${galleryIcon()}<strong>기록해둔 순간 판단하기</strong><span>이미 찍어둔 사진으로 확인하기</span></button>
              </div>

              <input type="file" accept="image/*" capture="environment" data-sort-camera-input hidden>
              <input type="file" accept="image/*" data-sort-upload-input hidden>

              <div class="aiways-mf-search" style="margin-top:14px;display:grid;grid-template-columns:1fr auto;gap:8px;">
                <input data-sort-search placeholder="예: 우유갑, 영수증, 볼펜, 컵라면">
                <button type="button" data-sort-search-btn>판단</button>
              </div>

              <div class="aiways-mf-chip-grid">
                ${["우유갑", "종이류", "플라스틱 컵", "컵라면 용기", "과자 봉지", "캔류", "영수증", "볼펜"].map(x => `<button class="aiways-mf-chip" type="button" data-chip="${x}">${x}</button>`).join("")}
              </div>
            </div>

            <div class="aiways-mf-app-right" data-sort-result>
              <div class="aiways-mf-app-wait">
                <div><strong>AI분류 대기 중</strong><span>사진을 찍거나 물건을 검색하면 AI 판단 카드가 여기에 나타납니다.</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const clsSelect = page.querySelector("[data-sort-class]");
    clsSelect?.addEventListener("change", e => {
      selectedClass = e.target.value;
      selectedGrade = DEFAULT_CLASSES[selectedClass].grade;
      localStorage.setItem("aiways_selected_class", selectedClass);
      rerenderDashboards();
    });

    page.querySelector("[data-tm-open]")?.addEventListener("click", () => {
      window.open("https://teachablemachine.withgoogle.com/train/image", "_blank", "noopener,noreferrer");
    });

    page.querySelector("[data-tm-save]")?.addEventListener("click", () => {
      const url = page.querySelector("[data-tm-url]")?.value.trim();
      if (url) localStorage.setItem("aiways_tm_model_url", url);
      alert("우리반 모델 URL을 저장했습니다. 이후 Teachable Machine 연결 확장 자리입니다.");
    });

    const savedTm = localStorage.getItem("aiways_tm_model_url");
    if (savedTm) page.querySelector("[data-tm-url]").value = savedTm;

    page.querySelector("[data-sort-camera]")?.addEventListener("click", () => page.querySelector("[data-sort-camera-input]")?.click());
    page.querySelector("[data-sort-upload]")?.addEventListener("click", () => page.querySelector("[data-sort-upload-input]")?.click());
    page.querySelector("[data-sort-camera-input]")?.addEventListener("change", e => handleImageFile(e.target.files?.[0]));
    page.querySelector("[data-sort-upload-input]")?.addEventListener("change", e => handleImageFile(e.target.files?.[0]));

    page.querySelector("[data-sort-search-btn]")?.addEventListener("click", () => {
      const value = page.querySelector("[data-sort-search]")?.value || "";
      showTextJudgment(page.querySelector("[data-sort-result]"), value);
    });

    page.querySelectorAll("[data-chip]").forEach(btn => {
      btn.addEventListener("click", () => showTextJudgment(page.querySelector("[data-sort-result]"), btn.dataset.chip));
    });
  }

  function showTextJudgment(target, value) {
    const material = materialFromText(value);
    const draft = {
      material,
      rawLabel: value || "직접 검색",
      confidence: material === MATERIALS.hold ? 48 : 88,
      inputType: "search",
      predictions: []
    };

    target.innerHTML = `<div class="aiways-mf-result"></div>`;
    showImageResult(target.querySelector(".aiways-mf-result"), draft);
  }

  function renderPlaybook() {
    const page = pageByText("자료실") || pageByText("PLAY BOOK");
    if (!page || (page.dataset.mfPlaybookDone === "1" && $(".aiways-mf-playbook", page))) return;

    page.dataset.mfPlaybookDone = "1";
    page.dataset.aiwaysLabel = "자료실";
    page.classList.add("aiways-mf-page");

    page.innerHTML = `
      <div class="aiways-mf-playbook">
        <div>
          <div class="aiways-mf-section-kicker">Resources</div>
          <h1>자료실</h1>
        </div>

        <div class="aiways-mf-resource-grid">
          <a class="aiways-mf-resource-btn" href="#" data-resource="voc">VOC 활동지</a>
          <a class="aiways-mf-resource-btn" href="#" data-resource="parent-form">학부모 구글폼</a>
          <a class="aiways-mf-resource-btn" href="#" data-resource="lesson-sheet">차시별 활동지</a>
          <a class="aiways-mf-resource-btn" href="https://github.com/ssamkang/aiways-incheon" target="_blank" rel="noopener noreferrer">GitHub 저장소</a>
        </div>

        <div class="aiways-mf-credit">
          <span>AIWays Incheon · Human → AI → Human Learning Project</span>
          <span>강서희 · 원나연 · 같이교육</span>
        </div>
      </div>
    `;
  }

  function boot() {
    if (booted) return;
    booted = true;
    document.body.classList.add("aiways-mf-ready");

    normalizeText();
    ensureNav();

    renderSchool();
    renderClass();
    renderLandfill();
    renderMiniApp();
    renderSortingPage();

    pageCandidates();
    cleanupFloatingBoxes();
    initSectionObserver();
  }

  function cleanupFloatingBoxes() {
    $$("body > div, body > span").forEach(el => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (
        style.position === "fixed" &&
        rect.width <= 40 &&
        rect.height <= 80 &&
        rect.right > window.innerWidth - 80 &&
        rect.bottom > window.innerHeight - 120 &&
        !el.id.includes("aiwaysMfModal")
      ) {
        el.classList.add("aiways-mf-hide");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("resize", initSectionObserver, { passive: true });
  window.addEventListener("aiways:records-loaded", () => rerenderDashboards());
  window.addEventListener("aiways:record-saved", () => rerenderDashboards());
})();
