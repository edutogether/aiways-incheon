(() => {
  window.AIWAYS_DATA_LOCK_ACTIVE = true;

  const FIXED_CLASS_DATA = {
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

  const FIXED_LANDFILL = {
    ton: 19507,
    delta: -3.2,
    inbound: 68.3,
    margin: 32.7
  };

  const DEFAULT_CONFUSING = {
    "비닐 코팅 종이컵": 4,
    "과자 포장지": 3,
    "영수증": 3,
    "음식물 묻은 종이": 2,
    "볼펜": 2
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const norm = value => (value || "").replace(/\s+/g, " ").trim();

  let selectedClass = localStorage.getItem("aiways_selected_class") || "5학년 1반";
  if (!FIXED_CLASS_DATA[selectedClass]) selectedClass = "5학년 1반";
  let selectedGrade = FIXED_CLASS_DATA[selectedClass].grade;
  let lastRecordSignature = "";

  function records() {
    try {
      return JSON.parse(localStorage.getItem("aiways_records")) || [];
    } catch {
      return [];
    }
  }

  function recordSignature() {
    const list = records();
    return JSON.stringify({
      len: list.length,
      first: list[0]?.timestamp || "",
      cls: selectedClass,
      grade: selectedGrade
    });
  }

  function findCard(text, key) {
    if (key) {
      const existing = $(`[data-op-card="${key}"]`);
      if (existing) return existing;
    }

    const candidates = $$(".aiw-card, .op-card, .awx-live-card, .dashboard-card, article");
    return candidates
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return norm(el.textContent).includes(text) && rect.width > 260 && rect.height > 120;
      })
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return ar.width * ar.height - br.width * br.height;
      })[0];
  }

  function patchHeroAndLogo() {
    const title = $(".aiw-title") || $$("h1, .hero-title, .headline").find(el => norm(el.textContent).includes("버리는 순간"));
    if (title) title.classList.add("aiways-final-hero-title");

    const copy = $(".aiw-description") || $$(".op-hero-copy, p, .hero-description").find(el => {
      const text = norm(el.textContent);
      return text.includes("AIWays Incheon은") && text.includes("H-A-H");
    });

    if (copy && !copy.dataset.aiwaysFinalCopyFixed) {
      copy.dataset.aiwaysFinalCopyFixed = "1";
      copy.classList.add("aiways-final-hero-copy");
      copy.innerHTML = `
        <span class="aiways-copy-line">AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다.</span>
        <span class="aiways-copy-line">우리가 실제로 쓰레기를 버리는 순간을 관찰하고,</span>
        <span class="aiways-copy-line">AI를 통해 데이터를 1차 판단한 뒤 사람이 중심이 되어 다시 확인하는,</span>
        <span class="aiways-copy-line">우리 학교의 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.</span>
      `;
    }
  }

  function gradeOfClass(className) {
    return FIXED_CLASS_DATA[className]?.grade || "5학년";
  }

  function baseForGrade(grade) {
    return Object.entries(FIXED_CLASS_DATA).filter(([, data]) => data.grade === grade);
  }

  function classRecords(className) {
    return records().filter(record => record.class_name === className);
  }

  function gradeRecords(grade) {
    return records().filter(record => record.grade === grade);
  }

  function statsForClass(className) {
    const base = FIXED_CLASS_DATA[className] || FIXED_CLASS_DATA["5학년 1반"];
    const rec = classRecords(className);
    const confirmed = rec.filter(record => record.action === "학생 판단 완료").length;
    const hold = rec.filter(record => record.hold_flag).length;

    return {
      observed: base.observed + rec.length,
      hold: base.hold + hold,
      converted: base.converted + confirmed,
      rank: base.rank
    };
  }

  function statsForGrade(grade) {
    const base = baseForGrade(grade);
    const rec = gradeRecords(grade);

    return {
      classes: base.length,
      observed: base.reduce((sum, [, data]) => sum + data.observed, 0) + rec.length,
      hold: base.reduce((sum, [, data]) => sum + data.hold, 0) + rec.filter(record => record.hold_flag).length,
      converted: base.reduce((sum, [, data]) => sum + data.converted, 0) + rec.filter(record => record.action === "학생 판단 완료").length
    };
  }

  function metric(label, value, unit = "건") {
    return `
      <div class="aiways-lock-metric">
        <span class="aiways-lock-metric-label">${label}</span>
        <strong class="aiways-lock-metric-value">${value}<small>${unit}</small></strong>
      </div>
    `;
  }

  function barRow(label, value, max) {
    const width = Math.max(10, Math.round((value / max) * 100));
    return `
      <div class="aiways-lock-bar-row">
        <span class="aiways-lock-bar-label">${label}</span>
        <span class="aiways-lock-bar-track">
          <i class="aiways-lock-bar-fill" style="width:${width}%"></i>
        </span>
        <span class="aiways-lock-bar-value">${value}</span>
      </div>
    `;
  }

  function donut(title, value) {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    return `
      <div class="aiways-lock-donut-box">
        <div class="aiways-lock-donut-title">${title}</div>
        <div class="aiways-lock-donut" style="--value:${safeValue}">
          <b>${safeValue}%</b>
        </div>
      </div>
    `;
  }

  function renderSchoolCard() {
    const card = findCard("우리학교 자원순환 대시보드", "school");
    if (!card) return;

    const gradeStats = statsForGrade(selectedGrade);
    const gradeEntries = ["3학년", "4학년", "5학년", "6학년"].map(grade => [grade, statsForGrade(grade).observed]);
    const max = Math.max(...gradeEntries.map(([, value]) => value));
    const successRate = Math.round((gradeStats.converted / Math.max(1, gradeStats.observed - gradeStats.hold)) * 100);
    const holdRate = Math.round((gradeStats.hold / Math.max(1, gradeStats.observed)) * 100);

    card.classList.add("op-card", "tune-managed");
    card.dataset.opCard = "school";
    card.innerHTML = `
      <div class="aiways-lock-inner">
        <div class="aiways-lock-head">
          <div>
            <div class="aiways-lock-kicker">School Resource Dashboard</div>
            <h2 class="aiways-lock-title">우리학교 자원순환 대시보드</h2>
          </div>

          <select class="aiways-lock-select" id="aiways-school-grade">
            ${["3학년", "4학년", "5학년", "6학년"].map(grade => `
              <option value="${grade}" ${grade === selectedGrade ? "selected" : ""}>${grade}</option>
            `).join("")}
          </select>
        </div>

        <div class="aiways-lock-school-grid">
          <div class="aiways-lock-metrics">
            ${metric("참여 학급", gradeStats.classes, "학급")}
            ${metric("배출 관찰", gradeStats.observed, "건")}
            ${metric("판단 보류", gradeStats.hold, "건")}
          </div>

          <div class="aiways-lock-right">
            <div class="aiways-lock-panel">
              <div class="aiways-lock-panel-title">학년별 참여</div>
              ${gradeEntries.map(([label, value]) => barRow(label, value, max)).join("")}
            </div>

            <div class="aiways-lock-donut-pair">
              ${donut("배출 성공률", successRate)}
              ${donut("판단 보류 비율", holdRate)}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#aiways-school-grade", card)?.addEventListener("change", event => {
      selectedGrade = event.target.value;
      const firstClass = Object.keys(FIXED_CLASS_DATA).find(name => FIXED_CLASS_DATA[name].grade === selectedGrade);
      if (firstClass) {
        selectedClass = firstClass;
        localStorage.setItem("aiways_selected_class", selectedClass);
      }

      rerenderDataIfNeeded(true);
    });
  }

  function confusionTop() {
    const result = { ...DEFAULT_CONFUSING };

    classRecords(selectedClass).forEach(record => {
      const key = record.mapped_item || record.ai_raw_label || "판단 보류 물건";
      const isConfusing = record.hold_flag || Number(record.hold_score || 0) >= 55 || record.final_decision === "판단 보류";
      if (isConfusing) result[key] = (result[key] || 0) + 1;
    });

    return Object.entries(result)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  function renderClassCard() {
    const card = findCard("우리반 자원순환 대시보드", "class");
    if (!card) return;

    const data = statsForClass(selectedClass);
    const classNames = Object.keys(FIXED_CLASS_DATA);
    const top = confusionTop();

    card.classList.add("op-card", "tune-managed");
    card.dataset.opCard = "class";
    card.innerHTML = `
      <div class="aiways-lock-inner">
        <div class="aiways-lock-head">
          <div>
            <div class="aiways-lock-kicker">Class Resource Dashboard</div>
            <h2 class="aiways-lock-title">우리반 자원순환 대시보드</h2>
            <p class="aiways-lock-desc">우리반의 버리는 순간을 AI와 함께 분류하고, 다시 확인한 기록입니다.</p>
          </div>

          <select class="aiways-lock-select" id="aiways-class-select">
            ${classNames.map(name => `
              <option value="${name}" ${name === selectedClass ? "selected" : ""}>${name}</option>
            `).join("")}
          </select>
        </div>

        <div class="aiways-lock-class-grid">
          <div class="aiways-lock-metrics">
            ${metric("오늘 관찰", data.observed, "건")}
            ${metric("판단 보류", data.hold, "건")}
            ${metric("전환 사례", data.converted, "건")}
          </div>

          <div class="aiways-lock-side">
            <div class="aiways-lock-panel">
              <div class="aiways-lock-panel-title">헷갈린 물건 TOP 5</div>
              <div class="aiways-lock-list">
                ${top.map(([item, count], index) => `
                  <div class="aiways-lock-list-item">
                    <span>${index + 1}. ${item}</span>
                    <span class="aiways-lock-count">${count}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="aiways-lock-panel">
              <div class="aiways-lock-panel-title">우리반 랭킹</div>
              <div class="aiways-lock-rank">
                <div class="aiways-lock-rank-medal">🏅</div>
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

    $("#aiways-class-select", card)?.addEventListener("change", event => {
      selectedClass = event.target.value;
      selectedGrade = gradeOfClass(selectedClass);
      localStorage.setItem("aiways_selected_class", selectedClass);
      rerenderDataIfNeeded(true);
    });
  }

  function animateStableNumber(el, to, formatter, amount) {
    if (!el) return;

    const from = to - amount;
    const start = performance.now();
    const duration = 720;

    el.classList.add("aiways-lock-counting");

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      el.textContent = formatter(current);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = formatter(to);
        setTimeout(() => el.classList.remove("aiways-lock-counting"), 200);
      }
    }

    requestAnimationFrame(frame);
  }

  function refreshLandfillDisplay() {
    const button = $("#tune-landfill-refresh") || $("#op-landfill-refresh") || $(".tune-refresh") || $(".op-refresh");
    if (button) {
      button.classList.add("aiways-lock-refresh-spin");
      setTimeout(() => button.classList.remove("aiways-lock-refresh-spin"), 760);
    }

    animateStableNumber($("#tune-ton"), FIXED_LANDFILL.ton, value => `${Math.round(value).toLocaleString("ko-KR")}t`, 130);
    animateStableNumber($("#tune-delta"), FIXED_LANDFILL.delta, value => `${value.toFixed(1)}%`, 1.0);
    animateStableNumber($("#tune-inbound"), FIXED_LANDFILL.inbound, value => `${value.toFixed(1)}%`, 1.5);
    animateStableNumber($("#tune-margin"), FIXED_LANDFILL.margin, value => `${value.toFixed(1)}%`, 1.5);
  }

  function lockLandfillNumbers() {
    const ton = $("#tune-ton");
    const delta = $("#tune-delta");
    const inbound = $("#tune-inbound");
    const margin = $("#tune-margin");

    if (ton && !ton.classList.contains("aiways-lock-counting")) ton.textContent = `${FIXED_LANDFILL.ton.toLocaleString("ko-KR")}t`;
    if (delta && !delta.classList.contains("aiways-lock-counting")) delta.textContent = `${FIXED_LANDFILL.delta.toFixed(1)}%`;
    if (inbound && !inbound.classList.contains("aiways-lock-counting")) inbound.textContent = `${FIXED_LANDFILL.inbound.toFixed(1)}%`;
    if (margin && !margin.classList.contains("aiways-lock-counting")) margin.textContent = `${FIXED_LANDFILL.margin.toFixed(1)}%`;

    $$("#tune-landfill-refresh, #op-landfill-refresh, .tune-refresh, .op-refresh").forEach(button => {
      if (button.dataset.aiwaysLockRefreshBound) return;
      button.dataset.aiwaysLockRefreshBound = "1";

      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        refreshLandfillDisplay();
      }, true);
    });
  }

  function syncUploadClassContext() {
    window.aiwaysSelectedClass = selectedClass;
    window.aiwaysSelectedGrade = selectedGrade;
    localStorage.setItem("aiways_selected_class", selectedClass);
  }

  function rerenderDataIfNeeded(force = false) {
    const signature = recordSignature();
    const needsLockedRender = !$("#aiways-school-grade") || !$("#aiways-class-select");

    if (force || needsLockedRender || signature !== lastRecordSignature) {
      lastRecordSignature = signature;
      renderSchoolCard();
      renderClassCard();
    }

    lockLandfillNumbers();
    syncUploadClassContext();
  }

  function boot() {
    patchHeroAndLogo();
    rerenderDataIfNeeded(true);

    let retry = 0;
    const starter = setInterval(() => {
      retry += 1;
      patchHeroAndLogo();
      rerenderDataIfNeeded(true);

      if (retry >= 12) clearInterval(starter);
    }, 350);

    setInterval(() => {
      patchHeroAndLogo();
      rerenderDataIfNeeded(false);
    }, 900);

    window.addEventListener("aiways-record-saved", () => rerenderDataIfNeeded(true));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
