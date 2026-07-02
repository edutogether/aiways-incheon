(() => {
  window.AIWAYS_FINAL_TUNE_ACTIVE = true;

  const AIWAYS_SHEETS_ENDPOINT = "";
  const AIWAYS_LANDFILL_ENDPOINT = "";

  const classData = {
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

  const trashDb = {
    "우유갑": { aliases: ["우유", "milk", "carton", "팩", "종이팩"], name: "🥛 우유갑", item: "우유갑", category: "종이팩", bin: "종이팩 전용 수거함", guide: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 배출합니다.", holdBase: 24 },
    "종이류": { aliases: ["종이", "paper", "book", "notebook", "프린트", "활동지"], name: "📄 깨끗한 종이류", item: "종이류", category: "종이류", bin: "종이류 배출함", guide: "물기와 음식물이 묻지 않았다면 펼쳐서 종이류로 배출합니다.", holdBase: 22 },
    "플라스틱 컵": { aliases: ["컵", "plastic", "cup", "bottle", "container", "페트", "생수병"], name: "🥤 플라스틱 컵", item: "플라스틱 컵", category: "플라스틱류", bin: "플라스틱 배출함", guide: "남은 음료를 비우고 빨대·뚜껑·라벨을 분리한 뒤 배출합니다.", holdBase: 32 },
    "과자 봉지": { aliases: ["과자", "봉지", "비닐", "snack", "wrapper", "bag", "packet"], name: "🍿 과자 봉지", item: "과자 봉지", category: "비닐류 또는 판단 보류", bin: "비닐류 배출함 / 판단 보류함", guide: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다.", holdBase: 58 },
    "컵라면 용기": { aliases: ["라면", "컵라면", "스티로폼", "noodle"], name: "🍜 컵라면 용기", item: "컵라면 용기", category: "일반쓰레기 검토", bin: "일반쓰레기 / 스티로폼 기준 확인", guide: "국물 자국이 씻기지 않는 용기는 일반쓰레기로 배출합니다.", holdBase: 70 },
    "캔류": { aliases: ["캔", "can", "tin", "aluminum"], name: "🥫 캔류", item: "캔류", category: "캔류", bin: "캔류 배출함", guide: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다.", holdBase: 18 },
    "영수증": { aliases: ["영수증", "receipt"], name: "🧾 영수증", item: "영수증", category: "일반쓰레기", bin: "일반쓰레기", guide: "감열지 영수증은 특수 코팅이 되어 있어 일반쓰레기로 배출합니다.", holdBase: 34 },
    "볼펜": { aliases: ["볼펜", "펜", "pen", "ballpoint", "pencil"], name: "🖋️ 볼펜 및 필기구", item: "볼펜 및 필기구", category: "일반쓰레기 또는 판단 보류", bin: "판단 보류함", guide: "여러 재질이 섞인 소형 학용품은 재활용이 어려운 경우가 많습니다.", holdBase: 74 },
    "판단 보류 물건": { aliases: ["모름", "애매", "판단", "보류", "unknown", "object"], name: "🤔 판단 보류 물건", item: "판단 보류 물건", category: "판단 보류", bin: "판단 보류함", guide: "바로 버리지 말고 판단 보류함에 등록한 뒤 금요일 회의 안건으로 확인합니다.", holdBase: 90 }
  };

  const quizData = [
    { emoji: "🧾", q: "영수증은 종이처럼 보여도 일반쓰레기로 버리는 것이 안전하다.", a: true, e: "영수증은 감열지라 일반 종이와 분리해 판단해야 합니다." },
    { emoji: "🥛", q: "우유갑은 일반 종이와 섞어 버려도 재활용 과정이 같다.", a: false, e: "종이팩은 일반 폐지와 공정이 달라 따로 모으는 것이 좋습니다." },
    { emoji: "🍜", q: "국물 자국이 깊게 밴 컵라면 용기는 재활용이 어려울 수 있다.", a: true, e: "오염이 지워지지 않으면 선별 과정에서 폐기될 가능성이 큽니다." },
    { emoji: "🥤", q: "플라스틱 컵은 남은 음료를 비우고 헹군 뒤 배출한다.", a: true, e: "오염을 줄이는 것이 분리배출 성공률을 높이는 핵심입니다." },
    { emoji: "📦", q: "택배 상자는 테이프와 운송장을 제거하면 더 좋은 재활용 자원이 된다.", a: true, e: "종이 외 이물질을 제거하면 재활용 품질이 좋아집니다." },
    { emoji: "🍿", q: "기름 묻은 과자봉지는 무조건 깨끗한 비닐류와 같은 기준으로 버린다.", a: false, e: "오염 정도에 따라 일반쓰레기 또는 판단 보류가 필요합니다." },
    { emoji: "🖋️", q: "볼펜처럼 여러 재질이 섞인 물건은 바로 판단하기 어려울 수 있다.", a: true, e: "복합재질 소형 물건은 보류함에 등록해 함께 판단하기 좋습니다." },
    { emoji: "🧃", q: "내용물이 남아 있는 팩은 그대로 분리배출해도 문제가 없다.", a: false, e: "내용물을 비우고 헹군 뒤 배출해야 오염을 줄일 수 있습니다." },
    { emoji: "🤖", q: "AI가 말한 분류 결과는 사람이 다시 확인하지 않아도 항상 정답이다.", a: false, e: "AI는 1차 제안이고, 최종 판단은 사람이 맥락을 보고 결정합니다." },
    { emoji: "🟨", q: "애매한 물건을 판단 보류함에 넣는 것도 좋은 자원순환 행동이다.", a: true, e: "모르는 것을 바로 버리지 않는 태도가 H-A-H의 핵심입니다." }
  ];

  let selectedClass = localStorage.getItem("aiways_selected_class") || "5학년 1반";
  let selectedGrade = classData[selectedClass]?.grade || "5학년";
  let imageUrl = null;
  let modelPromise = null;
  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;

  let landfill = {
    ton: Number(localStorage.getItem("aiways_landfill_ton") || 18457),
    delta: -3.5,
    inbound: 64.3,
    margin: 35.7,
    trend: [62, 61, 60, 58, 59, 57, 55],
    bars: [18120, 18310, 18440, 18290, 18510, 18630, 18710]
  };

  let previousLandfill = { ...landfill };
  let lastMiniRendered = false;

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

  function gradeStats(grade) {
    const base = Object.entries(classData).filter(([, data]) => data.grade === grade);
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

  function metric(label, value, unit = "건") {
    return `
      <div class="tune-metric">
        <span class="tune-metric-label">${label}</span>
        <strong class="tune-metric-value">${value}<small>${unit}</small></strong>
      </div>
    `;
  }

  function barRow(label, value, max) {
    const width = Math.max(10, Math.round((value / max) * 100));
    return `
      <div class="tune-bar-row">
        <span class="tune-bar-label">${label}</span>
        <span class="tune-bar-track">
          <i class="tune-bar-fill" style="width:${width}%"></i>
        </span>
        <span class="tune-bar-value">${value}</span>
      </div>
    `;
  }

  function donutBox(title, value) {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    return `
      <div class="tune-donut-box">
        <div class="tune-donut-title">${title}</div>
        <div class="tune-donut" style="--value:${safeValue}">
          <b>${safeValue}%</b>
        </div>
      </div>
    `;
  }

  function patchHero() {
    const title = $$("h1, .hero-title, .headline, [class*='title']").find(el => norm(el.textContent).includes("버리는 순간"));
    if (title) title.classList.add("tune-hero-title");

    const chip = $$("div, span, p").find(el => norm(el.textContent).includes("학생의 버리는 순간을 읽는"));
    if (chip) chip.classList.add("tune-hero-chip");

    const header = $("header, .site-header, .header");
    if (header) {
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

    $$("button, a").forEach(item => {
      if (["지금 분류하기", "실시간 시연 시작", "지금 버려지는 순간 찰칵"].includes(norm(item.textContent))) {
        item.textContent = "지금 버려지는 순간 찰칵";
        item.classList.add("op-bright-button");
        bindCameraTrigger(item);
      }
    });
  }

  function bindCameraTrigger(button) {
    if (button.dataset.tuneCameraBound) return;
    button.dataset.tuneCameraBound = "1";
    button.addEventListener("click", event => {
      const input = $("#tune-camera-input") || $("#op-camera-input") || document.querySelector('input[type="file"][capture]');
      if (input) {
        event.preventDefault();
        input.click();
      }
    });
  }

  function renderSchoolCard() {
    const card = findCard("우리학교 자원순환 대시보드", "school");
    if (!card) return;

    const total = allStats();
    const gradeEntries = ["3학년", "4학년", "5학년", "6학년"].map(grade => [grade, gradeStats(grade).observed]);
    const max = Math.max(...gradeEntries.map(([, value]) => value));
    const successRate = Math.round((total.converted / Math.max(1, total.observed - total.hold)) * 100);
    const holdRate = Math.round((total.hold / Math.max(1, total.observed)) * 100);

    card.classList.add("op-card", "tune-managed");
    card.dataset.opCard = "school";
    card.innerHTML = `
      <div class="tune-card-inner">
        <div class="tune-card-head">
          <div>
            <div class="tune-kicker">School Resource Dashboard</div>
            <h2 class="tune-title">우리학교 자원순환 대시보드</h2>
          </div>

          <select class="tune-select" id="tune-school-grade">
            ${["3학년", "4학년", "5학년", "6학년"].map(grade => `
              <option value="${grade}" ${grade === selectedGrade ? "selected" : ""}>${grade} 전체</option>
            `).join("")}
          </select>
        </div>

        <div class="tune-school-grid">
          <div class="tune-school-metrics">
            ${metric("참여 학급", total.classes, "학급")}
            ${metric("배출 관찰", total.observed, "건")}
            ${metric("판단 보류", total.hold, "건")}
          </div>

          <div class="tune-school-right">
            <div class="tune-panel">
              <div class="tune-panel-title">학년별 참여</div>
              ${gradeEntries.map(([label, value]) => barRow(label, value, max)).join("")}
            </div>

            <div class="tune-donut-pair">
              ${donutBox("배출 성공률", successRate)}
              ${donutBox("판단 보류 비율", holdRate)}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#tune-school-grade", card)?.addEventListener("change", event => {
      selectedGrade = event.target.value;
      const firstClass = Object.keys(classData).find(name => classData[name].grade === selectedGrade);
      if (firstClass) {
        selectedClass = firstClass;
        localStorage.setItem("aiways_selected_class", selectedClass);
      }
      renderSchoolCard();
      renderClassCard();
    });
  }

  function confusionTop() {
    const seed = {
      "비닐 코팅 종이컵": 4,
      "과자 포장지": 3,
      "영수증": 3,
      "음식물 묻은 종이": 2,
      "볼펜": 2
    };

    records()
      .filter(record => record.class_name === selectedClass)
      .forEach(record => {
        const key = record.mapped_item || record.ai_raw_label || "판단 보류 물건";
        if (record.hold_flag || Number(record.hold_score || 0) >= 55) {
          seed[key] = (seed[key] || 0) + 1;
        }
      });

    return Object.entries(seed)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  function renderClassCard() {
    const card = findCard("우리반 자원순환 대시보드", "class");
    if (!card) return;

    const data = currentClassStats();
    const classNames = Object.keys(classData);
    const top = confusionTop();

    card.classList.add("op-card", "tune-managed");
    card.dataset.opCard = "class";
    card.innerHTML = `
      <div class="tune-card-inner">
        <div class="tune-card-head">
          <div>
            <div class="tune-kicker">Class Resource Dashboard</div>
            <h2 class="tune-title">우리반 자원순환 대시보드</h2>
            <p class="tune-desc">우리반의 버리는 순간을 AI와 함께 분류하고, 다시 확인한 기록입니다.</p>
          </div>

          <select class="tune-select" id="tune-class-select">
            ${classNames.map(name => `
              <option value="${name}" ${name === selectedClass ? "selected" : ""}>${name}</option>
            `).join("")}
          </select>
        </div>

        <div class="tune-class-grid">
          <div class="tune-class-metrics">
            ${metric("오늘 관찰", data.observed, "건")}
            ${metric("판단 보류", data.hold, "건")}
            ${metric("전환 사례", data.converted, "건")}
          </div>

          <div class="tune-class-side">
            <div class="tune-panel">
              <div class="tune-panel-title">헷갈린 물건 TOP 5</div>
              <div class="tune-confusing-list">
                ${top.map(([item, count], index) => `
                  <div class="tune-confusing-item">
                    <span>${index + 1}. ${item}</span>
                    <span class="tune-confusing-count">${count}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="tune-panel">
              <div class="tune-panel-title">우리반 랭킹</div>
              <div class="tune-rank">
                <div class="tune-rank-medal">🏅</div>
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

    $("#tune-class-select", card)?.addEventListener("change", event => {
      selectedClass = event.target.value;
      selectedGrade = gradeOfClass(selectedClass);
      localStorage.setItem("aiways_selected_class", selectedClass);
      renderSchoolCard();
      renderClassCard();
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

  function lineAndBarChart() {
    const maxBar = Math.max(...landfill.bars);
    const minBar = Math.min(...landfill.bars);
    const days = ["월", "화", "수", "목", "금", "토", "오늘"];
    const bars = landfill.bars.map((value, index) => {
      const x = 38 + index * 33;
      const height = 18 + ((value - minBar) / Math.max(1, maxBar - minBar)) * 50;
      const y = 108 - height;
      return `<rect x="${x}" y="${y}" width="18" height="${height}" rx="5" fill="rgba(108,244,223,0.18)"></rect>`;
    }).join("");

    const linePoints = landfill.trend.map((value, index) => {
      const x = 47 + index * 33;
      const y = 112 - value * 0.95;
      return `${x},${Math.max(28, Math.min(104, y))}`;
    }).join(" ");

    const labels = days.map((day, index) => {
      const x = 47 + index * 33;
      return `<text class="tune-axis" x="${x}" y="135" text-anchor="middle">${day}</text>`;
    }).join("");

    return `
      <svg viewBox="0 0 280 145" preserveAspectRatio="none">
        <defs>
          <linearGradient id="tuneLandfillLine" x1="0" x2="1">
            <stop offset="0%" stop-color="#6df3e3"/>
            <stop offset="100%" stop-color="#74bdff"/>
          </linearGradient>
        </defs>

        <line x1="30" y1="20" x2="30" y2="118" stroke="rgba(220,234,252,0.16)" stroke-width="1"/>
        <line x1="30" y1="118" x2="265" y2="118" stroke="rgba(220,234,252,0.16)" stroke-width="1"/>

        <text class="tune-axis" x="4" y="31">70%</text>
        <text class="tune-axis" x="4" y="72">60%</text>
        <text class="tune-axis" x="4" y="113">50%</text>

        ${bars}

        <polyline points="${linePoints}" fill="none" stroke="url(#tuneLandfillLine)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        ${landfill.trend.map((value, index) => {
          const x = 47 + index * 33;
          const y = Math.max(28, Math.min(104, 112 - value * 0.95));
          return `<circle cx="${x}" cy="${y}" r="3.2" fill="#d9fffa" stroke="#6df3e3" stroke-width="2"></circle>`;
        }).join("")}
        ${labels}
      </svg>
    `;
  }

  function animateNumber(el, from, to, formatter) {
    if (!el) return;
    const start = performance.now();
    const duration = 700;
    el.classList.add("tune-counting");

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      el.textContent = formatter(current);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = formatter(to);
        setTimeout(() => el.classList.remove("tune-counting"), 180);
      }
    }

    requestAnimationFrame(frame);
  }

  function renderLandfillCard(animate = false) {
    const card = findCard("수도권매립지 모니터", "landfill");
    if (!card) return;

    card.classList.add("op-card", "tune-managed");
    card.dataset.opCard = "landfill";
    card.innerHTML = `
      <div class="tune-card-inner">
        <div class="tune-card-head">
          <div>
            <div class="tune-kicker">공식 관리 지표 구조</div>
            <h2 class="tune-title">수도권매립지 모니터</h2>
            <p class="tune-desc">수도권매립지 흐름을 한눈에 읽을 수 있도록 정리한 실시간 모니터</p>
          </div>

          <button class="tune-refresh ${animate ? "tune-spinning" : ""}" id="tune-landfill-refresh" type="button" aria-label="매립지 지표 새로고침">
            ${refreshIcon()}
          </button>
        </div>

        <div class="tune-landfill-grid">
          <div class="tune-kpi-row">
            <div class="tune-kpi"><b id="tune-ton">${landfill.ton.toLocaleString("ko-KR")}t</b><span>오늘 반입 총량</span></div>
            <div class="tune-kpi"><b id="tune-delta">${landfill.delta.toFixed(1)}%</b><span>전일 대비</span></div>
            <div class="tune-kpi"><b id="tune-inbound">${landfill.inbound.toFixed(1)}%</b><span>총량 대비 반입률</span></div>
            <div class="tune-kpi"><b id="tune-margin">${landfill.margin.toFixed(1)}%</b><span>잔여 관리 여력</span></div>
          </div>

          <div class="tune-landfill-body">
            <div class="tune-chart-card">
              <div class="tune-panel-title">반입률 추이 · 최근 7일</div>
              ${lineAndBarChart()}
            </div>

            <div class="tune-landfill-donuts">
              ${donutBox("총량 대비 반입률", landfill.inbound)}
              ${donutBox("잔여 관리 여력", landfill.margin)}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#tune-landfill-refresh", card)?.addEventListener("click", () => refreshLandfill(true));

    if (animate) {
      animateNumber($("#tune-ton", card), previousLandfill.ton, landfill.ton, value => `${Math.round(value).toLocaleString("ko-KR")}t`);
      animateNumber($("#tune-delta", card), previousLandfill.delta, landfill.delta, value => `${value.toFixed(1)}%`);
      animateNumber($("#tune-inbound", card), previousLandfill.inbound, landfill.inbound, value => `${value.toFixed(1)}%`);
      animateNumber($("#tune-margin", card), previousLandfill.margin, landfill.margin, value => `${value.toFixed(1)}%`);
    }
  }

  async function refreshLandfill(manual = false) {
    if (window.AIWAYS_DATA_LOCK_ACTIVE) return;

    previousLandfill = { ...landfill };

    if (AIWAYS_LANDFILL_ENDPOINT) {
      try {
        const response = await fetch(AIWAYS_LANDFILL_ENDPOINT);
        const data = await response.json();
        landfill.ton = Math.max(landfill.ton, Number(data.ton ?? landfill.ton));
        landfill.delta = Number(data.delta ?? landfill.delta);
        landfill.inbound = Number(data.inbound ?? landfill.inbound);
        landfill.margin = Number(data.margin ?? landfill.margin);
        landfill.trend = Array.isArray(data.trend) ? data.trend : landfill.trend;
        landfill.bars = Array.isArray(data.bars) ? data.bars : landfill.bars;
      } catch {
        mutateLandfill();
      }
    } else {
      mutateLandfill();
    }

    localStorage.setItem("aiways_landfill_ton", String(landfill.ton));
    renderLandfillCard(true);
  }

  function mutateLandfill() {
    // Disabled by aiways-data-lock-fix: presentation values should stay stable.
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

  function renderMiniApp(force = false) {
    const card = findCard("버려지는 순간을 기록하세요", "miniapp");
    if (!card) return;
    if (lastMiniRendered && !force && card.querySelector(".tune-mini-grid")) return;

    card.classList.add("op-card", "tune-managed");
    card.dataset.opCard = "miniapp";
    card.innerHTML = `
      <div class="tune-card-inner tune-mini-grid">
        <div>
          <div class="tune-kicker">3-Second Sorting Helper App</div>
          <h2 class="tune-mini-title">버려지는 순간을 기록하세요</h2>
          <p class="tune-desc">사진 AI분류, 3초 판단, OX 퀴즈, 판단 보류함을 한 장의 수업용 미니앱으로 연결합니다.</p>
        </div>

        <div class="tune-mini-body">
          <button class="tune-picker" id="tune-camera-button" type="button">
            <span class="tune-picker-icon">${cameraIcon()}</span>
            <strong>지금 버려지는 순간 찰칵</strong>
            <span>카메라로 바로 촬영해 분류하기</span>
          </button>

          <button class="tune-picker" id="tune-gallery-button" type="button">
            <span class="tune-picker-icon">${galleryIcon()}</span>
            <strong>기록해둔 순간 판단하기</strong>
            <span>이미 찍어둔 사진으로 확인하기</span>
          </button>
        </div>

        <div class="tune-mini-lower">
          <div class="tune-result">
            <input class="tune-file-input" id="tune-camera-input" type="file" accept="image/*" capture="environment">
            <input class="tune-file-input" id="tune-gallery-input" type="file" accept="image/*">

            <div class="tune-preview" id="tune-preview">
              <div class="tune-photo" id="tune-photo">
                <img id="tune-preview-img" alt="업로드한 사진 미리보기">
                <div class="tune-scan-line"></div>
              </div>

              <div class="tune-status" id="tune-status">
                <span class="tune-loader"></span>
                <span id="tune-status-text">사진 속 물체를 분석하는 중입니다...</span>
              </div>
            </div>

            <div id="tune-result-area">
              <h3 class="tune-result-title">AI분류 대기 중</h3>
              <p class="tune-result-text">사진을 찍거나 올리면 AI가 먼저 물체를 추정하고, 학생이 최종 판단합니다.</p>
            </div>
          </div>

          <div class="tune-quiz" id="tune-quiz"></div>
        </div>
      </div>
    `;

    lastMiniRendered = true;
    bindMiniEvents(card);
    renderQuiz();
  }

  function bindMiniEvents(card) {
    $("#tune-camera-button", card)?.addEventListener("click", () => $("#tune-camera-input", card)?.click());
    $("#tune-gallery-button", card)?.addEventListener("click", () => $("#tune-gallery-input", card)?.click());
    $("#tune-camera-input", card)?.addEventListener("change", event => handleFile(event.target.files?.[0], "camera"));
    $("#tune-gallery-input", card)?.addEventListener("change", event => handleFile(event.target.files?.[0], "upload"));
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
        resolve(await window.mobilenet.load({ version: 2, alpha: 1.0 }));
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
        confidence
      };
    } catch {
      const item = resolveTrash(file?.name || "판단 보류 물건");
      return {
        item,
        raw: "모델 연결 실패 · 검색 규칙 판단",
        confidence: 42
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

    const preview = $("#tune-preview");
    const photo = $("#tune-photo");
    const img = $("#tune-preview-img");
    const status = $("#tune-status");
    const statusText = $("#tune-status-text");

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
        showResult(result);
      }, 650);
    };
  }

  function buildRecord(payload) {
    return {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      privacy_id: sessionId(),
      school: "우리학교",
      grade: gradeOfClass(selectedClass),
      class_name: selectedClass,
      group_id: "미지정",
      input_type: payload.input_type || "camera",
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
      app_version: "aiways-final-tune-v1"
    };
  }

  async function saveRecord(payload) {
    if (window.AIWAYS_DATA_LOCK_ACTIVE) {
      const lockedClass = localStorage.getItem("aiways_selected_class");
      if (lockedClass && classData[lockedClass]) {
        selectedClass = lockedClass;
        selectedGrade = gradeOfClass(selectedClass);
      }
    }

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

    if (AIWAYS_SHEETS_ENDPOINT) {
      try {
        await fetch(AIWAYS_SHEETS_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(record)
        });
      } catch {}
    }

    if (!window.AIWAYS_DATA_LOCK_ACTIVE) {
      renderSchoolCard();
      renderClassCard();
    }

    window.dispatchEvent(new CustomEvent("aiways-record-saved"));
  }

  function showResult(data) {
    const item = data.item;
    const score = holdScore(item, data.confidence);
    const target = $("#tune-result-area");
    if (!target) return;

    target.innerHTML = `
      <div class="tune-result-top">
        <div>
          <h3 class="tune-result-title">${item.name}</h3>
          <p class="tune-result-text">AI 1차 판단 뒤 학생이 다시 확인합니다.</p>
        </div>
        <span class="tune-pill">신뢰도 ${data.confidence}%</span>
      </div>

      <div class="tune-info-grid">
        <div class="tune-info"><small>분류</small><strong>${item.category}</strong></div>
        <div class="tune-info"><small>배출 위치</small><strong>${item.bin}</strong></div>
        <div class="tune-info"><small>보류 권장</small><strong>${score}%</strong></div>
      </div>

      <p class="tune-result-text">
        <strong>AI 원본 인식:</strong> ${data.raw}<br>
        ${item.guide}
      </p>

      <div class="tune-actions">
        <button class="tune-btn primary" id="tune-confirm">학생 판단 완료</button>
        <button class="tune-btn secondary" id="tune-hold">판단 보류함 등록</button>
      </div>
    `;

    $("#tune-confirm")?.addEventListener("click", () => {
      saveRecord({
        input_type: data.inputType || "camera",
        ai_raw_label: data.raw,
        ai_confidence: data.confidence,
        mapped_item: item.item,
        suggested_category: item.category,
        final_decision: item.category,
        hold_flag: false,
        hold_score: score,
        action: "학생 판단 완료"
      });
    });

    $("#tune-hold")?.addEventListener("click", () => {
      saveRecord({
        input_type: data.inputType || "camera",
        ai_raw_label: data.raw,
        ai_confidence: data.confidence,
        mapped_item: item.item,
        suggested_category: item.category,
        final_decision: "판단 보류",
        hold_flag: true,
        hold_score: score,
        hold_reason: "학생이 애매하다고 판단",
        action: "판단 보류함 등록"
      });
    });
  }

  function renderQuiz() {
    const container = $("#tune-quiz");
    if (!container) return;

    if (quizIndex >= quizData.length) {
      const score = quizScore * 10;
      const message =
        score >= 90 ? "당신은 인천 자원순환 전략가입니다. AI를 참고하되 판단의 중심을 놓치지 않았어요." :
        score >= 70 ? "당신은 실천형 환경 해결사입니다. 조금만 더 확인하면 교실의 기준이 될 수 있어요." :
        score >= 50 ? "당신은 성장 중인 분리배출 탐정입니다. 애매한 순간을 보류하는 태도부터 아주 좋아요." :
        "괜찮아요. 오늘은 AI와 함께 다시 판단하는 연습을 시작한 날입니다.";

      container.innerHTML = `
        <div class="tune-score">
          <div>
            <strong>${score}점</strong>
            <p>${message}</p>
            <button class="tune-btn primary" id="tune-quiz-restart" style="margin-top:10px;min-width:110px;">다시 도전</button>
          </div>
        </div>
      `;

      $("#tune-quiz-restart")?.addEventListener("click", () => {
        quizIndex = 0;
        quizScore = 0;
        quizAnswered = false;
        renderQuiz();
      });

      return;
    }

    const quiz = quizData[quizIndex];

    container.innerHTML = `
      <div class="tune-quiz-head">
        <span>OX 퀴즈 ${quizIndex + 1} / ${quizData.length}</span>
        <span>${quizScore * 10}점</span>
      </div>

      <div class="tune-quiz-emoji">${quiz.emoji}</div>
      <div class="tune-quiz-q">${quiz.q}</div>

      <div class="tune-ox">
        <button class="tune-btn primary" data-answer="true">O</button>
        <button class="tune-btn secondary" data-answer="false">X</button>
      </div>

      <div class="tune-answer" id="tune-answer"></div>
    `;

    quizAnswered = false;

    $$("[data-answer]", container).forEach(button => {
      button.addEventListener("click", () => {
        if (quizAnswered) return;
        quizAnswered = true;

        const correct = String(quiz.a) === button.dataset.answer;
        if (correct) quizScore += 1;

        const answer = $("#tune-answer", container);
        answer.innerHTML = `<strong>${correct ? "정답입니다." : "다시 생각해볼 포인트입니다."}</strong><br>${quiz.e}<br><small>잠시 후 다음 문제로 넘어갑니다.</small>`;
        answer.classList.add("visible");

        setTimeout(() => {
          quizIndex += 1;
          renderQuiz();
        }, 1800);
      });
    });
  }

  function renderAll() {
    patchHero();
    renderSchoolCard();
    renderClassCard();
    renderLandfillCard(false);
    renderMiniApp(false);
  }

  function boot() {
    renderAll();

    let retry = 0;
    const early = setInterval(() => {
      retry += 1;
      renderAll();
      if (retry >= 14) clearInterval(early);
    }, 350);

    // Disabled by aiways-data-lock-fix: landfill values must not randomly change.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
