(() => {
  const AIWAYS_SHEETS_ENDPOINT = "";
  const AIWAYS_LANDFILL_ENDPOINT = "";

  const classData = {
    "3학년 1반": { grade: "3학년", observed: 17, hold: 1, converted: 1, rank: 9 },
    "3학년 2반": { grade: "3학년", observed: 18, hold: 2, converted: 1, rank: 8 },
    "3학년 3반": { grade: "3학년", observed: 18, hold: 1, converted: 1, rank: 7 },
    "4학년 1반": { grade: "4학년", observed: 16, hold: 1, converted: 1, rank: 12 },
    "4학년 2반": { grade: "4학년", observed: 15, hold: 1, converted: 1, rank: 13 },
    "4학년 3반": { grade: "4학년", observed: 14, hold: 2, converted: 1, rank: 14 },
    "4학년 4반": { grade: "4학년", observed: 16, hold: 1, converted: 1, rank: 10 },
    "5학년 1반": { grade: "5학년", observed: 24, hold: 3, converted: 2, rank: 3 },
    "5학년 2반": { grade: "5학년", observed: 29, hold: 2, converted: 2, rank: 2 },
    "5학년 3반": { grade: "5학년", observed: 30, hold: 2, converted: 2, rank: 1 },
    "5학년 4반": { grade: "5학년", observed: 32, hold: 2, converted: 2, rank: 4 },
    "6학년 1반": { grade: "6학년", observed: 30, hold: 2, converted: 1, rank: 5 },
    "6학년 2반": { grade: "6학년", observed: 31, hold: 2, converted: 2, rank: 6 },
    "6학년 3반": { grade: "6학년", observed: 28, hold: 1, converted: 1, rank: 11 }
  };

  const trashDb = {
    "우유갑": { aliases: ["우유", "milk", "carton", "팩", "종이팩"], name: "🥛 우유갑", item: "우유갑", category: "종이팩", bin: "종이팩 전용 수거함", guide: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 배출합니다.", tip: "일반 종이류와 섞이면 재활용 공정이 달라 품질이 떨어집니다.", holdBase: 28 },
    "종이류": { aliases: ["종이", "paper", "book", "notebook", "프린트", "활동지"], name: "📄 깨끗한 종이류", item: "종이류", category: "종이류", bin: "종이류 배출함", guide: "물기와 음식물이 묻지 않았다면 펼쳐서 종이류로 배출합니다.", tip: "코팅, 테이프, 음식물 오염이 있으면 판단 보류함에 등록합니다.", holdBase: 24 },
    "플라스틱 컵": { aliases: ["컵", "plastic", "cup", "bottle", "container", "페트", "생수병"], name: "🥤 플라스틱 컵", item: "플라스틱 컵", category: "플라스틱류", bin: "플라스틱 배출함", guide: "남은 음료를 비우고 빨대·뚜껑·라벨을 분리한 뒤 배출합니다.", tip: "오염이 심하면 재활용이 어려울 수 있어 먼저 헹군 뒤 판단합니다.", holdBase: 34 },
    "과자 봉지": { aliases: ["과자", "봉지", "비닐", "snack", "wrapper", "bag", "packet"], name: "🍿 과자 봉지", item: "과자 봉지", category: "비닐류 또는 판단 보류", bin: "비닐류 배출함 / 판단 보류함", guide: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다.", tip: "기름기와 양념이 많으면 일반쓰레기 또는 보류 판단이 필요합니다.", holdBase: 58 },
    "컵라면 용기": { aliases: ["라면", "컵라면", "스티로폼", "noodle"], name: "🍜 컵라면 용기", item: "컵라면 용기", category: "일반쓰레기 검토", bin: "일반쓰레기 / 스티로폼 기준 확인", guide: "국물 자국이 씻기지 않는 용기는 일반쓰레기로 배출합니다.", tip: "깨끗한 스티로폼만 학교 기준에 따라 분리합니다.", holdBase: 70 },
    "캔류": { aliases: ["캔", "can", "tin", "aluminum"], name: "🥫 캔류", item: "캔류", category: "캔류", bin: "캔류 배출함", guide: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다.", tip: "담배꽁초나 이물질이 들어 있으면 먼저 제거해야 합니다.", holdBase: 18 },
    "영수증": { aliases: ["영수증", "receipt"], name: "🧾 영수증", item: "영수증", category: "일반쓰레기", bin: "일반쓰레기", guide: "감열지 영수증은 특수 코팅이 되어 있어 일반쓰레기로 배출합니다.", tip: "종이처럼 보여도 폐지와 섞지 않는 것이 좋습니다.", holdBase: 32 },
    "볼펜": { aliases: ["볼펜", "펜", "pen", "ballpoint", "pencil"], name: "🖋️ 볼펜 및 필기구", item: "볼펜 및 필기구", category: "일반쓰레기 또는 판단 보류", bin: "판단 보류함", guide: "여러 재질이 섞인 소형 학용품은 재활용이 어려운 경우가 많습니다.", tip: "분리 가능한 부품이 있는지 확인하고 애매하면 보류함에 등록합니다.", holdBase: 76 },
    "판단 보류 물건": { aliases: ["모름", "애매", "판단", "보류", "unknown", "object"], name: "🤔 판단 보류 물건", item: "판단 보류 물건", category: "판단 보류", bin: "판단 보류함", guide: "바로 버리지 말고 판단 보류함에 등록한 뒤 금요일 회의 안건으로 확인합니다.", tip: "모르는 것을 바로 버리지 않는 것도 자원순환 역량입니다.", holdBase: 90 }
  };

  const quizData = [
    { emoji: "🧾", q: "종이 영수증은 깨끗하니까 종이류 수거함에 버려도 된다.", a: false, e: "영수증은 감열지라 일반 종이와 다릅니다. 일반쓰레기로 배출하는 것이 안전합니다." },
    { emoji: "🍜", q: "빨간 국물이 깊게 밴 컵라면 용기는 재활용이 어려울 수 있다.", a: true, e: "오염이 지워지지 않는 용기는 선별 과정에서 폐기될 가능성이 큽니다." },
    { emoji: "🥛", q: "우유갑은 일반 종이와 분리해 종이팩 전용함에 버리는 것이 좋다.", a: true, e: "종이팩은 일반 폐지와 공정이 다르므로 따로 모으면 자원 가치가 높아집니다." },
    { emoji: "📦", q: "택배 상자는 테이프와 운송장을 떼지 않고 그대로 종이류에 버려도 된다.", a: false, e: "테이프와 비닐 송장은 가능한 한 제거해야 종이 재활용 품질이 좋아집니다." },
    { emoji: "🥤", q: "플라스틱 컵은 남은 음료를 비우고 헹군 뒤 배출하는 것이 좋다.", a: true, e: "내용물과 오염을 줄이는 것이 재활용 성공률을 높이는 핵심입니다." }
  ];

  const simEffects = {
    quick: { name: "3초 분류 앱", effect: "오배출 감소", mis: -5, success: 5, co2: 0.7, life: 5 },
    hold: { name: "판단 보류함", effect: "즉시 오배출 감소", mis: -4, success: 3, co2: 0.5, life: 4 },
    guide: { name: "가이드선", effect: "성공률 증가", mis: -3, success: 6, co2: 0.4, life: 3 },
    quiz: { name: "퀴즈 앱", effect: "참여율 증가", mis: -2, success: 4, co2: 0.3, life: 2 },
    rank: { name: "랭킹", effect: "동기 강화", mis: -2, success: 3, co2: 0.2, life: 2 }
  };

  let selectedClass = "5학년 1반";
  let selectedGrade = "5학년";
  let quizIndex = 0;
  let quizScore = 0;
  let modelPromise = null;
  let imageUrl = null;

  const landfill = {
    ton: 18457,
    delta: -3.5,
    inbound: 64.3,
    margin: 37.3,
    trend: [82, 77, 68, 55, 61, 44, 30]
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const norm = value => (value || "").replace(/\s+/g, " ").trim();

  function findCard(text, key) {
    if (key) {
      const existing = $(`[data-op-card="${key}"]`);
      if (existing) return existing;
    }

    const candidates = $$(".aiw-card, .awx-live-card, .dashboard-card, article");
    return candidates
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return !el.closest("[data-op-card]") && norm(el.textContent).includes(text) && rect.width > 260 && rect.height > 120;
      })
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return ar.width * ar.height - br.width * br.height;
      })[0];
  }

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

  function holds() {
    try {
      return JSON.parse(localStorage.getItem("aiways_holds")) || [];
    } catch {
      return [];
    }
  }

  function saveHolds(list) {
    localStorage.setItem("aiways_holds", JSON.stringify(list));
  }

  function sessionId() {
    let id = localStorage.getItem("aiways_session_id");
    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("aiways_session_id", id);
    }
    return id;
  }

  function gradeOfClass(className) {
    return classData[className]?.grade || "5학년";
  }

  function classRecords(className = selectedClass) {
    return records().filter(record => record.class_name === className);
  }

  function baseClassesForGrade(grade) {
    return Object.entries(classData).filter(([, data]) => data.grade === grade);
  }

  function gradeStats(grade) {
    const base = baseClassesForGrade(grade);
    const rec = records().filter(item => item.grade === grade);
    return {
      classes: base.length,
      observed: base.reduce((sum, [, data]) => sum + data.observed, 0) + rec.length,
      hold: base.reduce((sum, [, data]) => sum + data.hold, 0) + rec.filter(item => item.hold_flag).length,
      converted: base.reduce((sum, [, data]) => sum + data.converted, 0) + rec.filter(item => item.action === "학생 판단 완료").length
    };
  }

  function allStats() {
    const rec = records();
    return {
      classes: Object.keys(classData).length,
      observed: Object.values(classData).reduce((sum, data) => sum + data.observed, 0) + rec.length,
      hold: Object.values(classData).reduce((sum, data) => sum + data.hold, 0) + rec.filter(item => item.hold_flag).length,
      converted: Object.values(classData).reduce((sum, data) => sum + data.converted, 0) + rec.filter(item => item.action === "학생 판단 완료").length
    };
  }

  function currentClassStats() {
    const base = classData[selectedClass] || classData["5학년 1반"];
    const rec = classRecords(selectedClass);
    return {
      observed: base.observed + rec.length,
      hold: base.hold + rec.filter(item => item.hold_flag).length,
      converted: base.converted + rec.filter(item => item.action === "학생 판단 완료").length,
      rank: base.rank
    };
  }

  function buildRecord(payload) {
    const cls = selectedClass;
    const grade = gradeOfClass(cls);
    return {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      privacy_id: sessionId(),
      school: "우리학교",
      grade,
      class_name: cls,
      group_id: "미지정",
      input_type: payload.input_type || "search",
      ai_raw_label: payload.ai_raw_label || "",
      ai_confidence: payload.ai_confidence ?? "",
      mapped_item: payload.mapped_item || "",
      suggested_category: payload.suggested_category || "",
      final_decision: payload.final_decision || "",
      hold_flag: Boolean(payload.hold_flag),
      hold_score: payload.hold_score ?? "",
      hold_reason: payload.hold_reason || "",
      contamination_check: payload.contamination_check || "미입력",
      action: payload.action || "",
      image_saved: false,
      app_version: "aiways-operational-v1"
    };
  }

  async function sendToSheet(record) {
    if (!AIWAYS_SHEETS_ENDPOINT) return;
    try {
      await fetch(AIWAYS_SHEETS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(record)
      });
    } catch (error) {
      console.warn("[AIWays] Google Sheets 전송 실패:", error);
    }
  }

  async function saveRecord(payload) {
    const record = buildRecord(payload);
    const list = records();
    list.unshift(record);
    saveRecords(list);

    if (record.hold_flag) {
      const holdList = holds();
      holdList.unshift({
        id: "hold-" + Date.now(),
        name: record.mapped_item || "판단 보류 물건",
        reason: record.hold_reason || "학생 판단 보류",
        time: record.local_time,
        class_name: record.class_name
      });
      saveHolds(holdList);
    }

    await sendToSheet(record);
    renderDashboards();
    renderDataPanel();
    renderHoldList();
    showSim();
    return record;
  }

  function downloadCsv() {
    const list = records();
    const headers = [
      "timestamp",
      "local_time",
      "privacy_id",
      "school",
      "grade",
      "class_name",
      "group_id",
      "input_type",
      "ai_raw_label",
      "ai_confidence",
      "mapped_item",
      "suggested_category",
      "final_decision",
      "hold_flag",
      "hold_score",
      "hold_reason",
      "contamination_check",
      "action",
      "image_saved",
      "app_version"
    ];

    const rows = [
      headers.join(","),
      ...list.map(record => headers.map(key => {
        const value = record[key] ?? "";
        return '"' + String(value).replace(/"/g, '""') + '"';
      }).join(","))
    ];

    const blob = new Blob(["\ufeff" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "aiways-classification-records.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  function patchHeader() {
    const header = $("header, .site-header, .header");
    if (!header) return;

    const navItems = $$("nav a, a", header).filter(link => {
      const text = norm(link.textContent);
      return ["프로젝트", "교육과정", "H-A-H", "6차시", "산출물"].includes(text);
    });

    navItems.forEach(link => link.classList.remove("op-current"));
    navItems[0]?.classList.add("op-current");

    $$("button, a", header).forEach(item => {
      if (["지금 분류하기", "실시간 시연 시작", "지금 버려지는 순간 찰칵"].includes(norm(item.textContent))) {
        item.textContent = "지금 버려지는 순간 찰칵";
        item.classList.add("op-bright-button");
        bindCameraTrigger(item);
      }
    });
  }

  function patchHero() {
    const candidates = $$("p, .aiw-description, .hero-description").filter(el => {
      const text = norm(el.textContent);
      return text.includes("AIWays Incheon은") && text.includes("H-A-H");
    });

    const copy = candidates[0];
    if (!copy) return;

    copy.classList.add("op-hero-copy");
    copy.innerHTML = `
      <span class="op-line">AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다.</span>
      <span class="op-line">우리가 실제로 쓰레기를 버리는 순간을 관찰하고,</span>
      <span class="op-line">AI를 통해 데이터를 1차 판단한 뒤 사람이 중심이 되어 다시 확인하는,</span>
      <span class="op-line">우리 학교의 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.</span>
    `;

    $$("button, a").forEach(item => {
      if (["지금 분류하기", "실시간 시연 시작", "지금 버려지는 순간 찰칵"].includes(norm(item.textContent))) {
        item.textContent = "지금 버려지는 순간 찰칵";
        item.classList.add("op-bright-button");
        bindCameraTrigger(item);
      }
    });
  }

  function bindCameraTrigger(button) {
    if (button.dataset.opCameraBound) return;
    button.dataset.opCameraBound = "1";
    button.addEventListener("click", event => {
      const input = $("#op-camera-input") || document.querySelector('input[type="file"][capture]');
      if (input) {
        event.preventDefault();
        input.click();
      } else {
        const app = $(".op-mini");
        if (app) {
          event.preventDefault();
          app.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    });
  }

  function metric(label, value, unit = "건") {
    return `
      <div class="op-metric">
        <span class="op-metric-label">${label}</span>
        <strong class="op-metric-value">${value}<small>${unit}</small></strong>
      </div>
    `;
  }

  function barRow(label, value, max) {
    const width = Math.max(8, Math.round((value / max) * 100));
    return `
      <div class="op-bar-row">
        <span class="op-bar-label">${label}</span>
        <span class="op-bar-track">
          <i class="op-bar-fill" style="width:${width}%"></i>
        </span>
        <span class="op-bar-value">${value}</span>
      </div>
    `;
  }

  function donut(label, value, sub) {
    return `
      <div class="op-donut-card">
        <div class="op-donut" style="--value:${value}">
          <b>${value}%</b>
        </div>
        <div class="op-donut-text">
          <strong>${label}</strong>
          <span>${sub}</span>
        </div>
      </div>
    `;
  }

  function renderSchoolCard() {
    const card = findCard("우리학교 자원순환 대시보드", "school");
    if (!card) return;

    const total = allStats();
    const gradeEntries = ["3학년", "4학년", "5학년", "6학년"].map(grade => [grade, gradeStats(grade).observed]);
    const max = Math.max(...gradeEntries.map(([, value]) => value));
    const selected = gradeStats(selectedGrade);
    const successRate = Math.round(68 + Math.min(22, selected.converted * 2));
    const holdReduction = Math.round(Math.max(12, 42 - selected.hold));

    card.classList.add("op-card");
    card.dataset.opCard = "school";
    card.innerHTML = `
      <div class="op-card-inner">
        <div class="op-card-head">
          <div>
            <div class="op-kicker">School Resource Dashboard</div>
            <h2 class="op-title nowrap">우리학교 자원순환 대시보드</h2>
          </div>

          <select class="op-select" id="op-school-grade">
            ${["3학년", "4학년", "5학년", "6학년"].map(grade => `
              <option value="${grade}" ${grade === selectedGrade ? "selected" : ""}>${grade} 전체</option>
            `).join("")}
          </select>
        </div>

        <div class="op-school-grid">
          <div class="op-school-metrics">
            ${metric("참여 학급", total.classes, "학급")}
            ${metric("배출 관찰", total.observed, "건")}
            ${metric("판단 보류", total.hold, "건")}
          </div>

          <div class="op-school-right">
            <div class="op-panel">
              <div class="op-panel-title">학년별 참여</div>
              ${gradeEntries.map(([label, value]) => barRow(label, value, max)).join("")}
            </div>

            <div class="op-donut-pair">
              ${donut("분리배출 성공률", successRate, `${selectedGrade} 기준 학생 재확인 후 성공 비율`)}
              ${donut("보류 감소 여력", holdReduction, "판단 보류를 회의로 해결할 수 있는 여지")}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#op-school-grade", card)?.addEventListener("change", event => {
      selectedGrade = event.target.value;
      const firstClass = Object.keys(classData).find(name => classData[name].grade === selectedGrade);
      if (firstClass) selectedClass = firstClass;
      renderDashboards();
    });
  }

  function renderClassCard() {
    const card = findCard("우리반 자원순환 대시보드", "class");
    if (!card) return;

    const data = currentClassStats();
    const classNames = Object.keys(classData);
    const confusing = ["비닐 코팅 종이컵", "과자 포장지", "영수증", "음식물 묻은 종이", "빨대"];

    card.classList.add("op-card");
    card.dataset.opCard = "class";
    card.innerHTML = `
      <div class="op-card-inner">
        <div class="op-card-head">
          <div>
            <div class="op-kicker">Class Resource Dashboard</div>
            <h2 class="op-title nowrap">우리반 자원순환 대시보드</h2>
            <p class="op-desc">우리반의 버리는 순간을 AI와 함께 분류하고, 다시 확인한 기록입니다.</p>
          </div>

          <select class="op-select" id="op-class-select">
            ${classNames.map(name => `
              <option value="${name}" ${name === selectedClass ? "selected" : ""}>${name}</option>
            `).join("")}
          </select>
        </div>

        <div class="op-class-grid">
          <div class="op-class-metrics">
            ${metric("오늘 관찰", data.observed, "건")}
            ${metric("판단 보류", data.hold, "건")}
            ${metric("전환 사례", data.converted, "건")}
          </div>

          <div class="op-class-side">
            <div class="op-panel">
              <div class="op-panel-title">헷갈린 물건 TOP 5</div>
              <div class="op-list">
                ${confusing.map((item, index) => `<div>${index + 1}. ${item}</div>`).join("")}
              </div>
            </div>

            <div class="op-panel">
              <div class="op-panel-title">우리반 랭킹</div>
              <div class="op-rank">
                <div class="op-rank-medal">🏅</div>
                <div>
                  <strong>${data.rank}위</strong>
                  <span>전체 ${classNames.length}개 학급 중</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $("#op-class-select", card)?.addEventListener("change", event => {
      selectedClass = event.target.value;
      selectedGrade = gradeOfClass(selectedClass);
      renderDashboards();
    });
  }

  function refreshIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7.2 7.4A7 7 0 0 1 19 11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M19 5.6V11H13.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16.8 16.6A7 7 0 0 1 5 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M5 18.4V13H10.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function renderLandfillCard() {
    const card = findCard("수도권매립지 모니터", "landfill");
    if (!card) return;

    const points = landfill.trend.map((value, index) => {
      const x = 12 + index * 40;
      const y = 88 - value * 0.66;
      return `${x},${Math.max(16, Math.round(y))}`;
    }).join(" ");

    card.classList.add("op-card");
    card.dataset.opCard = "landfill";
    card.innerHTML = `
      <div class="op-card-inner">
        <div class="op-card-head">
          <div>
            <div class="op-kicker">공식 관리 지표 구조</div>
            <h2 class="op-title nowrap">수도권매립지 모니터</h2>
            <p class="op-desc">수도권매립지 흐름을 한눈에 읽을 수 있도록 정리한 실시간 모니터</p>
          </div>

          <button class="op-refresh" id="op-landfill-refresh" type="button" aria-label="매립지 지표 새로고침">
            ${refreshIcon()}
          </button>
        </div>

        <div class="op-landfill-grid">
          <div class="op-kpi-row">
            <div class="op-kpi"><b>${landfill.ton.toLocaleString("ko-KR")}t</b><span>오늘 반입 총량</span></div>
            <div class="op-kpi"><b>${landfill.delta.toFixed(1)}%</b><span>전일 대비</span></div>
            <div class="op-kpi"><b>${landfill.inbound.toFixed(1)}%</b><span>총량 대비 반입률</span></div>
            <div class="op-kpi"><b>${landfill.margin.toFixed(1)}%</b><span>잔여 관리 여력</span></div>
          </div>

          <div class="op-landfill-body">
            <div class="op-line-card">
              <div class="op-panel-title">반입률 추이 · 최근 7일</div>
              <svg viewBox="0 0 280 96" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="opLandfillLine" x1="0" x2="1">
                    <stop offset="0%" stop-color="#6df3e3"/>
                    <stop offset="100%" stop-color="#74bdff"/>
                  </linearGradient>
                </defs>
                <polyline points="${points}" fill="none" stroke="url(#opLandfillLine)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div class="op-chart-caption">최근 7일간 총량 대비 반입률이 어떻게 변했는지 보여줍니다.</div>
            </div>

            <div class="op-landfill-donuts">
              ${donut("잔여 관리 여력", Math.round(landfill.margin), "현재 기준으로 남은 관리 가능 비율")}
              ${donut("총량 대비 반입률", Math.round(landfill.inbound), "오늘 반입량이 전체 기준에서 차지하는 비율")}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#op-landfill-refresh", card)?.addEventListener("click", refreshLandfill);
  }

  async function refreshLandfill() {
    if (window.AIWAYS_FINAL_TUNE_ACTIVE) return;

    if (AIWAYS_LANDFILL_ENDPOINT) {
      try {
        const response = await fetch(AIWAYS_LANDFILL_ENDPOINT);
        const data = await response.json();
        landfill.ton = Number(data.ton ?? landfill.ton);
        landfill.delta = Number(data.delta ?? landfill.delta);
        landfill.inbound = Number(data.inbound ?? landfill.inbound);
        landfill.margin = Number(data.margin ?? landfill.margin);
        landfill.trend = Array.isArray(data.trend) ? data.trend : landfill.trend;
      } catch (error) {
        mutateLandfill();
      }
    } else {
      mutateLandfill();
    }
    renderLandfillCard();
  }

  function mutateLandfill() {
    landfill.ton += Math.floor(Math.random() * 60) - 22;
    landfill.delta = Number((landfill.delta + (Math.random() * 0.8 - 0.4)).toFixed(1));
    landfill.inbound = Number((landfill.inbound + (Math.random() * 0.8 - 0.25)).toFixed(1));
    landfill.margin = Number((100 - landfill.inbound + 1.6).toFixed(1));
    landfill.trend = landfill.trend.map(value => Math.max(22, Math.min(90, value + Math.floor(Math.random() * 9) - 4)));
  }

  function renderDashboards() {
    if (window.AIWAYS_FINAL_TUNE_ACTIVE) return;

    renderSchoolCard();
    renderClassCard();
    renderLandfillCard();
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

  function renderMiniApp() {
    if (window.AIWAYS_FINAL_TUNE_ACTIVE) return;

    const card = findCard("버려지는 순간을 기록하세요", "miniapp");
    if (!card) return;

    card.classList.add("op-card");
    card.dataset.opCard = "miniapp";
    card.innerHTML = `
      <div class="op-card-inner op-mini">
        <div>
          <div class="op-kicker">3-Second Sorting Helper App</div>
          <h2 class="op-mini-title">버려지는 순간을 기록하세요</h2>
          <p class="op-desc">사진 AI분류, 3초 판단, OX 퀴즈, 판단 보류함을 한 장의 수업용 미니앱으로 연결합니다.</p>
        </div>

        <div class="op-tabs">
          <button class="op-tab active" data-op-tab="photo">AI분류</button>
          <button class="op-tab" data-op-tab="judge">3초판단</button>
          <button class="op-tab" data-op-tab="quiz">퀴즈</button>
          <button class="op-tab" data-op-tab="hold">보류함</button>
        </div>

        <section class="op-panel-content active" data-op-panel="photo">
          <input class="op-file-input" id="op-camera-input" type="file" accept="image/*" capture="environment">
          <input class="op-file-input" id="op-gallery-input" type="file" accept="image/*">

          <div class="op-picker-grid">
            <button class="op-picker" id="op-camera-button" type="button">
              <span class="op-picker-icon">${cameraIcon()}</span>
              <strong>지금 버려지는 순간 찰칵</strong>
              <span>카메라로 바로 촬영해 분류하기</span>
            </button>

            <button class="op-picker" id="op-gallery-button" type="button">
              <span class="op-picker-icon">${galleryIcon()}</span>
              <strong>기록해둔 순간 판단하기</strong>
              <span>이미 찍어둔 사진으로 확인하기</span>
            </button>
          </div>

          <div class="op-preview" id="op-preview">
            <div class="op-photo" id="op-photo">
              <img id="op-preview-img" alt="업로드한 사진 미리보기">
              <div class="op-scan-line"></div>
            </div>

            <div class="op-status" id="op-status">
              <span class="op-loader"></span>
              <span id="op-status-text">사진 속 물체를 분석하는 중입니다...</span>
            </div>
          </div>

          <div class="op-result" id="op-photo-result"></div>
          <div class="op-sim" id="op-sim"></div>
        </section>

        <section class="op-panel-content" data-op-panel="judge">
          <div class="op-search">
            <input id="op-search-input" placeholder="예: 우유갑, 플라스틱 컵, 영수증, 볼펜">
            <div class="op-quick-grid">
              ${Object.keys(trashDb).slice(0, 8).map(key => `
                <button class="op-quick" data-op-quick="${key}">${trashDb[key].name}</button>
              `).join("")}
            </div>
          </div>
          <div class="op-result" id="op-judge-result"></div>
        </section>

        <section class="op-panel-content" data-op-panel="quiz">
          <div class="op-quiz-card">
            <div class="op-quiz-meta">
              <span id="op-quiz-progress">질문 1 / ${quizData.length}</span>
              <span id="op-quiz-score">점수 0점</span>
            </div>
            <div class="op-progress">
              <span id="op-quiz-bar" style="width:${100 / quizData.length}%"></span>
            </div>
            <div class="op-quiz-emoji" id="op-quiz-emoji">🧾</div>
            <div class="op-quiz-q" id="op-quiz-q"></div>
            <div class="op-ox" id="op-ox">
              <button class="op-btn primary" data-op-answer="true">O</button>
              <button class="op-btn secondary" data-op-answer="false">X</button>
            </div>
            <div class="op-answer" id="op-answer"></div>
            <button class="op-btn primary" id="op-next-quiz" style="display:none;width:100%;margin-top:8px;">다음 문제</button>
          </div>
        </section>

        <section class="op-panel-content" data-op-panel="hold">
          <div class="op-hold-card">
            <p class="op-desc">애매한 물건은 바로 버리지 않고 보류함에 등록해 금요일 회의 안건으로 사용합니다.</p>
            <div class="op-hold-form">
              <input id="op-hold-input" placeholder="예: 스프링 공책, 코팅 종이, 부러진 자">
              <button class="op-btn secondary" id="op-hold-add">등록</button>
            </div>
            <div class="op-list-box" id="op-hold-list"></div>
            <div class="op-data-card" style="margin-top:8px;">
              <div class="op-data-grid">
                <div class="op-data-metric">
                  <small>저장된 판단 기록</small>
                  <strong id="op-record-count">0</strong>
                </div>
                <div class="op-data-metric">
                  <small>판단 보류</small>
                  <strong id="op-hold-count">0</strong>
                </div>
              </div>
              <button class="op-btn primary" id="op-download-csv" style="width:100%;margin-top:8px;">CSV로 데이터 내려받기</button>
            </div>
          </div>
        </section>
      </div>
    `;

    bindMiniAppEvents(card);
    renderQuiz();
    renderHoldList();
    renderDataPanel();
  }

  function bindMiniAppEvents(card) {
    $$("[data-op-tab]", card).forEach(button => {
      button.addEventListener("click", () => {
        $$("[data-op-tab]", card).forEach(item => item.classList.remove("active"));
        $$("[data-op-panel]", card).forEach(item => item.classList.remove("active"));

        button.classList.add("active");
        $(`[data-op-panel="${button.dataset.opTab}"]`, card)?.classList.add("active");

        if (button.dataset.opTab === "quiz") renderQuiz();
        if (button.dataset.opTab === "hold") {
          renderHoldList();
          renderDataPanel();
        }
      });
    });

    $("#op-camera-button", card)?.addEventListener("click", () => $("#op-camera-input")?.click());
    $("#op-gallery-button", card)?.addEventListener("click", () => $("#op-gallery-input")?.click());
    $("#op-camera-input", card)?.addEventListener("change", event => handleFile(event.target.files?.[0], "camera"));
    $("#op-gallery-input", card)?.addEventListener("change", event => handleFile(event.target.files?.[0], "upload"));

    $("#op-search-input", card)?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const item = resolveTrash(event.target.value);
      showResult($("#op-judge-result"), {
        item,
        raw: "검색 판단",
        confidence: "",
        inputType: "search"
      });
    });

    $$("[data-op-quick]", card).forEach(button => {
      button.addEventListener("click", () => {
        const item = trashDb[button.dataset.opQuick];
        showResult($("#op-judge-result"), {
          item,
          raw: "빠른 선택",
          confidence: "",
          inputType: "search"
        });
      });
    });

    $("#op-hold-add", card)?.addEventListener("click", () => {
      const input = $("#op-hold-input");
      const value = norm(input?.value);
      if (!value) return;

      saveRecord({
        input_type: "manual_hold",
        mapped_item: value,
        suggested_category: "판단 보류",
        final_decision: "판단 보류",
        hold_flag: true,
        hold_score: 100,
        hold_reason: "학생 직접 보류 등록",
        action: "판단 보류함 등록"
      });

      input.value = "";
    });

    $("#op-download-csv", card)?.addEventListener("click", downloadCsv);
  }

  function resolveTrash(query) {
    const q = norm(query).toLowerCase();
    if (!q) return trashDb["판단 보류 물건"];

    for (const [key, item] of Object.entries(trashDb)) {
      if (key.toLowerCase().includes(q) || q.includes(key.toLowerCase())) return item;
      if (item.aliases.some(alias => q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q))) {
        return item;
      }
    }

    return {
      ...trashDb["판단 보류 물건"],
      name: `🤔 ${query}`,
      item: query
    };
  }

  async function ensureModel() {
    if (modelPromise) return modelPromise;

    modelPromise = new Promise(async (resolve, reject) => {
      try {
        const startedAt = Date.now();
        while (!window.mobilenet && Date.now() - startedAt < 9000) {
          await new Promise(tick => setTimeout(tick, 120));
        }
        if (!window.mobilenet) throw new Error("MobileNet unavailable");
        const model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
        resolve(model);
      } catch (error) {
        reject(error);
      }
    });

    return modelPromise;
  }

  async function classifyImage(img, file) {
    try {
      const model = await ensureModel();
      const predictions = await model.classify(img, 5);
      const combined = `${file?.name || ""} ${predictions.map(p => p.className).join(" ")}`;
      const item = resolveTrash(combined);
      const confidence = Math.max(35, Math.round((predictions[0]?.probability || 0.42) * 100));
      return {
        item,
        raw: predictions[0]?.className || "unknown",
        confidence,
        inputType: "camera"
      };
    } catch {
      const item = resolveTrash(file?.name || "판단 보류 물건");
      return {
        item,
        raw: "모델 연결 실패 · 검색 규칙 판단",
        confidence: 42,
        inputType: "camera"
      };
    }
  }

  function holdScore(item, confidence) {
    let score = item.holdBase || 50;
    if (confidence && confidence < 55) score += 25;
    if (confidence && confidence < 40) score += 15;
    if (item.category.includes("보류")) score += 20;
    if (item.category.includes("일반쓰레기")) score += 10;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async function handleFile(file, inputType) {
    if (!file) return;

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);

    const preview = $("#op-preview");
    const photo = $("#op-photo");
    const img = $("#op-preview-img");
    const status = $("#op-status");
    const statusText = $("#op-status-text");

    img.src = imageUrl;
    preview.classList.add("visible");
    photo.classList.add("scan");
    status.classList.add("visible");
    statusText.textContent = "사진 속 물체를 실제 이미지 모델로 분석하는 중입니다...";

    img.onload = async () => {
      const result = await classifyImage(img, file);
      result.inputType = inputType;
      statusText.textContent = "분리배출 판단 카드로 바꾸는 중입니다...";
      setTimeout(() => {
        photo.classList.remove("scan");
        status.classList.remove("visible");
        showResult($("#op-photo-result"), result);
      }, 650);
    };
  }

  function showResult(target, data) {
    const item = data.item;
    const score = holdScore(item, data.confidence);
    const recommendedHold = score >= 61;

    target.innerHTML = `
      <div class="op-result-top">
        <div>
          <h3 class="op-result-title">${item.name}</h3>
          <p class="op-desc">AI 1차 판단 뒤 학생이 다시 확인합니다.</p>
        </div>
        <span class="op-pill">${data.confidence ? `신뢰도 ${data.confidence}%` : item.category}</span>
      </div>

      <div class="op-info-grid">
        <div class="op-info"><small>분류</small><strong>${item.category}</strong></div>
        <div class="op-info"><small>배출 위치</small><strong>${item.bin}</strong></div>
        <div class="op-info"><small>보류 권장</small><strong>${score}%</strong></div>
      </div>

      <p class="op-guide">
        <strong>AI 원본 인식:</strong> ${data.raw || "검색 판단"}<br>
        ${item.guide}<br>
        <strong>${item.tip}</strong>
      </p>

      <div class="op-actions">
        <button class="op-btn primary" data-op-action="confirm">학생 판단 완료</button>
        <button class="op-btn secondary" data-op-action="hold">판단 보류함 등록</button>
        <button class="op-btn ghost" data-op-action="reset">다시 선택</button>
      </div>
    `;

    target.classList.add("visible");

    $("[data-op-action='confirm']", target)?.addEventListener("click", () => {
      saveRecord({
        input_type: data.inputType || "search",
        ai_raw_label: data.raw || "",
        ai_confidence: data.confidence || "",
        mapped_item: item.item || item.name,
        suggested_category: item.category,
        final_decision: item.category,
        hold_flag: false,
        hold_score: score,
        hold_reason: recommendedHold ? "보류 권장 점수가 높지만 학생이 최종 확인" : "",
        action: "학생 판단 완료"
      });
    });

    $("[data-op-action='hold']", target)?.addEventListener("click", () => {
      saveRecord({
        input_type: data.inputType || "search",
        ai_raw_label: data.raw || "",
        ai_confidence: data.confidence || "",
        mapped_item: item.item || item.name,
        suggested_category: item.category,
        final_decision: "판단 보류",
        hold_flag: true,
        hold_score: score,
        hold_reason: "학생이 애매하다고 판단",
        action: "판단 보류함 등록"
      });
    });

    $("[data-op-action='reset']", target)?.addEventListener("click", () => {
      target.classList.remove("visible");
      target.innerHTML = "";
    });
  }

  function renderQuiz() {
    const quiz = quizData[quizIndex];
    if (!$("#op-quiz-q")) return;

    $("#op-quiz-progress").textContent = `질문 ${quizIndex + 1} / ${quizData.length}`;
    $("#op-quiz-score").textContent = `점수 ${quizScore}점`;
    $("#op-quiz-bar").style.width = `${((quizIndex + 1) / quizData.length) * 100}%`;
    $("#op-quiz-emoji").textContent = quiz.emoji;
    $("#op-quiz-q").textContent = quiz.q;
    $("#op-answer").classList.remove("visible");
    $("#op-answer").innerHTML = "";
    $("#op-ox").style.display = "grid";
    $("#op-next-quiz").style.display = "none";

    $$("[data-op-answer]").forEach(button => {
      button.onclick = () => {
        const correct = String(quiz.a) === button.dataset.opAnswer;
        if (correct) quizScore += 20;

        $("#op-answer").innerHTML = `
          <strong>${correct ? "🎉 정답입니다!" : "💡 다시 생각해볼 포인트!"}</strong><br>
          ${quiz.e}
        `;

        $("#op-answer").classList.add("visible");
        $("#op-ox").style.display = "none";
        $("#op-next-quiz").style.display = "block";
        $("#op-quiz-score").textContent = `점수 ${quizScore}점`;
      };
    });

    $("#op-next-quiz").onclick = () => {
      quizIndex += 1;
      if (quizIndex >= quizData.length) {
        quizIndex = 0;
        quizScore = 0;
      }
      renderQuiz();
    };
  }

  function renderHoldList() {
    const list = $("#op-hold-list");
    if (!list) return;

    const holdList = holds();

    if (!holdList.length) {
      list.innerHTML = `<div class="op-list-item">보류함에 등록된 물건이 없습니다.</div>`;
      return;
    }

    list.innerHTML = holdList.slice(0, 8).map(item => `
      <div class="op-list-item">
        <span>🟨 ${item.name}</span>
        <span>${item.class_name || selectedClass}</span>
      </div>
    `).join("");
  }

  function renderDataPanel() {
    const recordCount = $("#op-record-count");
    const holdCount = $("#op-hold-count");
    if (recordCount) recordCount.textContent = records().length;
    if (holdCount) holdCount.textContent = records().filter(item => item.hold_flag).length;
  }

  function graphPath(score) {
    const base = [88, 78, 70, 64, 58, 54, 52];
    return base
      .map((y, i) => `${14 + i * 42},${Math.max(24, Math.round(y - score * (i / 6) * 1.15))}`)
      .join(" ");
  }

  function showSim() {
    const sim = $("#op-sim");
    if (!sim) return;

    sim.innerHTML = `
      <h3 class="op-result-title">되감기 시뮬레이터로 효과 검증</h3>
      <p class="op-desc">4차시 토론에서 결정한 UX 솔루션을 체크하며 데이터 변화를 확인합니다.</p>

      <div class="op-checks">
        ${Object.entries(simEffects).map(([key, value]) => `
          <label class="op-check">
            <input type="checkbox" data-op-effect="${key}">
            <strong>${value.name}</strong>
            <small>${value.effect}</small>
          </label>
        `).join("")}
      </div>

      <div class="op-sim-body">
        <div class="op-sim-metrics">
          <div class="op-data-metric"><small>오배출률</small><strong id="op-misrate">22%</strong></div>
          <div class="op-data-metric"><small>성공률</small><strong id="op-success">62%</strong></div>
          <div class="op-data-metric"><small>온실가스 감축</small><strong id="op-co2">0.0kg</strong></div>
          <div class="op-data-metric"><small>매립지 수명</small><strong id="op-life">+0일</strong></div>
        </div>

        <div class="op-sim-graph">
          <svg viewBox="0 0 280 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="opSimLine" x1="0" x2="1">
                <stop offset="0%" stop-color="#70f4df"/>
                <stop offset="100%" stop-color="#73bdff"/>
              </linearGradient>
            </defs>
            <polyline
              id="op-sim-line"
              points="${graphPath(0)}"
              fill="none"
              stroke="url(#opSimLine)"
              stroke-width="5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <polyline
              points="14,88 56,78 98,70 140,64 182,58 224,54 266,52"
              fill="none"
              stroke="rgba(255,255,255,.15)"
              stroke-width="3"
              stroke-dasharray="6 8"
              stroke-linecap="round"
            />
          </svg>
          <p class="op-quote">“우리의 기획이 미래를 바꾼다.”</p>
        </div>
      </div>
    `;

    sim.classList.add("visible");

    $$("[data-op-effect]", sim).forEach(input => {
      input.addEventListener("change", updateSim);
    });

    updateSim();
  }

  function updateSim() {
    const checked = $$("[data-op-effect]:checked").map(input => input.dataset.opEffect);
    $$("[data-op-effect]").forEach(input => {
      input.closest(".op-check")?.classList.toggle("is-active", input.checked);
    });

    let mis = 22;
    let success = 62;
    let co2 = 0;
    let life = 0;

    checked.forEach(key => {
      const effect = simEffects[key];
      if (!effect) return;
      mis += effect.mis;
      success += effect.success;
      co2 += effect.co2;
      life += effect.life;
    });

    mis = Math.max(5, mis);
    success = Math.min(96, success);

    const score = checked.length * 8 + (62 - mis) * 0.45;

    $("#op-misrate") && ($("#op-misrate").textContent = `${mis}%`);
    $("#op-success") && ($("#op-success").textContent = `${success}%`);
    $("#op-co2") && ($("#op-co2").textContent = `${co2.toFixed(1)}kg`);
    $("#op-life") && ($("#op-life").textContent = `+${life}일`);
    $("#op-sim-line") && $("#op-sim-line").setAttribute("points", graphPath(score));
  }

  function renderAll() {
    if (window.AIWAYS_FINAL_TUNE_ACTIVE) return;

    patchHeader();
    patchHero();
    renderDashboards();
    renderMiniApp();
    renderDataPanel();
  }

  function boot() {
    renderAll();

    let retry = 0;
    const timer = setInterval(() => {
      retry += 1;
      renderAll();
      if (retry >= 8) clearInterval(timer);
    }, 500);

    setInterval(refreshLandfill, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
