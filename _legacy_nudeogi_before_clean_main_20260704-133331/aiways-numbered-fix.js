(() => {
  const schoolGradeData = {
    "3학년 전체": {
      classes: 3,
      observed: 53,
      hold: 4,
      success: 71,
      inbound: 21,
      grades: { "3학년": 53, "4학년": 61, "5학년": 115, "6학년": 89 },
    },
    "4학년 전체": {
      classes: 4,
      observed: 61,
      hold: 5,
      success: 74,
      inbound: 24,
      grades: { "3학년": 53, "4학년": 61, "5학년": 115, "6학년": 89 },
    },
    "5학년 전체": {
      classes: 4,
      observed: 115,
      hold: 9,
      success: 78,
      inbound: 37,
      grades: { "3학년": 53, "4학년": 61, "5학년": 115, "6학년": 89 },
    },
    "6학년 전체": {
      classes: 3,
      observed: 89,
      hold: 5,
      success: 75,
      inbound: 29,
      grades: { "3학년": 53, "4학년": 61, "5학년": 115, "6학년": 89 },
    },
  };

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
    "6학년 3반": { grade: "6학년", observed: 28, hold: 1, converted: 1, rank: 11 },
  };

  const landfillState = {
    ton: 18457,
    delta: -3.5,
    inbound: 64.3,
    margin: 37.3,
    trend: [82, 77, 68, 55, 61, 44, 30],
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = (value) => (value || "").replace(/\s+/g, " ").trim();

  let selectedGrade = "5학년 전체";
  let selectedClass = "5학년 1반";
  let applying = false;

  function findCard(text) {
    const preferred = $$(".school-card, .class-card, .landfill-card, .upload-card, .awx-live-card, .aiw-card");
    return preferred.find((el) => {
      const rect = el.getBoundingClientRect();
      return norm(el.textContent).includes(text) && rect.width > 260 && rect.height > 120;
    });
  }

  function getCameraInput() {
    return (
      $("#ny-camera-input") ||
      $("#cx-camera-input") ||
      document.querySelector('input[type="file"][capture]') ||
      document.querySelector('input[type="file"][accept*="image"]')
    );
  }

  function triggerCameraFromButton(event) {
    const input = getCameraInput();
    if (input) {
      event.preventDefault();
      input.click();
      return;
    }

    const app = document.querySelector(".ny-app, .cx-app, [data-ny-panel='photo']");
    if (app) {
      event.preventDefault();
      app.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function patchLogo() {
    const img = document.querySelector(".aiw-logo-img") || document.querySelector("header img");
    if (!img) return;
    const box = img.closest(".aiw-logo-box, .brand-mark, .logo, span, div");
    box?.classList.add("aiways-logo-bright");
  }

  function patchNavAndButtons() {
    const header = document.querySelector(".aiw-header, header, .site-header");
    if (header) {
      const navLinks = $$("nav a", header).filter((anchor) => {
        const label = norm(anchor.textContent);
        return ["프로젝트", "교육과정", "H-A-H", "6차시", "산출물"].includes(label);
      });

      navLinks.forEach((anchor) => anchor.classList.remove("is-current"));
      const hash = window.location.hash.replace("#", "");
      const active = navLinks.find((anchor) => hash && (anchor.getAttribute("href") || "").includes(hash)) || navLinks[0];
      active?.classList.add("is-current");
    }

    $$("a, button").forEach((el) => {
      const label = norm(el.textContent);
      if (label === "지금 분류하기" || label === "지금 시연하기" || label === "실시간 시연 시작") {
        el.textContent = "지금 버려지는 순간 찰칵";
      }

      if (norm(el.textContent) === "지금 버려지는 순간 찰칵") {
        el.classList.add("fix-bright-btn");
        if (!el.dataset.fixCameraBound) {
          el.dataset.fixCameraBound = "1";
          el.addEventListener("click", triggerCameraFromButton);
        }
      }
    });
  }

  function patchHeroCopy() {
    const desc = $$(".aiw-description, .hero-description, .hero-copy p, p").find((el) => {
      const text = norm(el.textContent);
      return text.includes("AIWays Incheon은") && text.includes("H-A-H");
    });
    if (!desc || desc.classList.contains("aiways-hero-copy-fixed")) return;

    desc.classList.add("aiways-hero-copy-fixed");
    desc.innerHTML = `
      <span class="hero-line">AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다.</span>
      <span class="hero-line">우리가 실제로 쓰레기를 버리는 순간을 관찰하고,</span>
      <span class="hero-line">AI를 통해 데이터를 1차 판단한 뒤 사람이 중심이 되어 다시 확인하는,</span>
      <span class="hero-line">우리 학교의 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.</span>
    `;
  }

  function metric(label, value, unit = "건") {
    return `
      <div class="fix-metric">
        <span class="fix-metric-label">${label}</span>
        <strong class="fix-metric-value">${value}<small>${unit}</small></strong>
      </div>
    `;
  }

  function barRow(label, value, max) {
    const width = Math.max(8, Math.round((value / max) * 100));
    return `
      <div class="fix-bar-row">
        <span class="fix-bar-label">${label}</span>
        <span class="fix-bar-track"><i class="fix-bar-fill" style="width:${width}%"></i></span>
        <span class="fix-bar-value">${value}</span>
      </div>
    `;
  }

  function donut(label, value, sub) {
    return `
      <div class="fix-donut-panel">
        <div class="fix-donut" style="--value:${value}"><b>${value}%</b></div>
        <div class="fix-donut-text">
          <strong>${label}</strong>
          <span>${sub}</span>
        </div>
      </div>
    `;
  }

  function renderSchoolCard(force = false) {
    const card = findCard("우리학교 자원순환 대시보드");
    if (!card) return;

    const data = schoolGradeData[selectedGrade] || schoolGradeData["5학년 전체"];
    const key = `school:${selectedGrade}`;
    if (!force && card.dataset.numberedKey === key && card.classList.contains("fix-numbered-school")) return;

    const totalClasses = Object.values(schoolGradeData).reduce((sum, item) => sum + item.classes, 0);
    const totalObserved = Object.values(schoolGradeData).reduce((sum, item) => sum + item.observed, 0);
    const totalHold = Object.values(schoolGradeData).reduce((sum, item) => sum + item.hold, 0);
    const max = Math.max(...Object.values(data.grades));

    card.classList.add("fix-card-shell", "fix-numbered-school");
    card.dataset.numberedKey = key;
    card.innerHTML = `
      <div class="fix-card-inner">
        <div class="fix-card-head">
          <div>
            <div class="fix-kicker">School Resource Dashboard</div>
            <h2 class="fix-title nowrap">우리학교 자원순환 대시보드</h2>
          </div>
          <select class="fix-select" id="fix-school-select" aria-label="학년 선택">
            ${Object.keys(schoolGradeData).map((item) => `<option value="${item}" ${item === selectedGrade ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </div>

        <div class="fix-school-grid">
          <div class="fix-school-metrics">
            ${metric("참여 학급", totalClasses, "학급")}
            ${metric("배출 관찰", totalObserved, "건")}
            ${metric("판단 보류", totalHold, "건")}
          </div>

          <div class="fix-school-right">
            <div class="fix-grade-panel">
              <div class="fix-panel-title">학년별 참여</div>
              ${Object.entries(data.grades).map(([label, value]) => barRow(label, value, max)).join("")}
            </div>
            <div class="fix-donut-pair">
              ${donut("잔여 관리 여력", 34, "학급 실천 후 보류 감소 여지")}
              ${donut("총량 대비 반입률", data.inbound, "학교 실천이 연결되는 지역 지표")}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#fix-school-select", card)?.addEventListener("change", (event) => {
      selectedGrade = event.target.value;
      renderSchoolCard(true);
    });
  }

  function renderClassCard(force = false) {
    const card = findCard("우리반 자원순환 대시보드");
    if (!card) return;

    const data = classData[selectedClass] || classData["5학년 1반"];
    const key = `class:${selectedClass}`;
    if (!force && card.dataset.numberedKey === key && card.classList.contains("fix-numbered-class")) return;

    card.classList.add("fix-card-shell", "fix-numbered-class");
    card.dataset.numberedKey = key;
    card.innerHTML = `
      <div class="fix-card-inner">
        <div class="fix-card-head">
          <div>
            <div class="fix-kicker">Class Resource Dashboard</div>
            <h2 class="fix-title nowrap">우리반 자원순환 대시보드</h2>
            <p class="fix-desc">우리반의 버리는 순간을 AI와 함께 분류하고, 다시 확인한 기록입니다.</p>
          </div>
          <select class="fix-select" id="fix-class-select" aria-label="학급 선택">
            ${Object.keys(classData).map((item) => `<option value="${item}" ${item === selectedClass ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </div>

        <div class="fix-class-grid">
          <div class="fix-class-metrics">
            ${metric("오늘 관찰", data.observed, "건")}
            ${metric("판단 보류", data.hold, "건")}
            ${metric("전환 사례", data.converted, "건")}
          </div>

          <div class="fix-class-side">
            <div class="fix-side-card">
              <div class="fix-panel-title">헷갈린 물건 TOP 5</div>
              <div class="fix-list">
                <div>1. 비닐 코팅 종이컵</div>
                <div>2. 과자 포장지</div>
                <div>3. 영수증</div>
                <div>4. 음식물 묻은 종이</div>
                <div>5. 빨대</div>
              </div>
            </div>
            <div class="fix-side-card">
              <div class="fix-panel-title">우리반 랭킹</div>
              <div class="fix-rank">
                <div class="fix-rank-medal">🏅</div>
                <div>
                  <strong>${data.rank}위</strong>
                  <span>전체 ${Object.keys(classData).length}개 학급 중</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $("#fix-class-select", card)?.addEventListener("change", (event) => {
      selectedClass = event.target.value;
      selectedGrade = `${classData[selectedClass].grade} 전체`;
      renderClassCard(true);
      renderSchoolCard(true);
    });
  }

  function refreshIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7.2 7.4A7 7 0 0 1 19 11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
        <path d="M19 5.6V11H13.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M16.8 16.6A7 7 0 0 1 5 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
        <path d="M5 18.4V13H10.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
  }

  function renderLandfillCard(force = false) {
    const card = findCard("수도권매립지 모니터");
    if (!card) return;

    const l = landfillState;
    const key = `landfill:${l.ton}:${l.delta}:${l.inbound}:${l.margin}:${l.trend.join("-")}`;
    if (!force && card.dataset.numberedKey === key && card.classList.contains("fix-numbered-landfill")) return;

    const points = l.trend
      .map((value, index) => {
        const x = 12 + index * 40;
        const y = 96 - value * 0.78;
        return `${x},${Math.max(16, Math.round(y))}`;
      })
      .join(" ");

    card.classList.add("fix-card-shell", "fix-numbered-landfill");
    card.dataset.numberedKey = key;
    card.innerHTML = `
      <div class="fix-card-inner">
        <div class="fix-card-head">
          <div>
            <div class="fix-kicker">공식 관리 지표 구조</div>
            <h2 class="fix-title nowrap">수도권매립지 모니터</h2>
            <p class="fix-desc">수도권매립지 흐름을 한눈에 읽을 수 있도록 정리한 실시간 모니터</p>
          </div>
          <button class="fix-refresh-btn" id="fix-landfill-refresh" type="button" aria-label="매립지 지표 새로고침">
            ${refreshIcon()}
          </button>
        </div>

        <div class="fix-landfill-grid">
          <div class="fix-kpi-row">
            <div class="fix-kpi"><b>${l.ton.toLocaleString("ko-KR")}t</b><span>오늘 반입 총량</span></div>
            <div class="fix-kpi"><b>${l.delta.toFixed(1)}%</b><span>전일 대비</span></div>
            <div class="fix-kpi"><b>${l.inbound.toFixed(1)}%</b><span>총량 대비 반입률</span></div>
            <div class="fix-kpi"><b>${l.margin.toFixed(1)}%</b><span>잔여 관리 여력</span></div>
          </div>

          <div class="fix-landfill-body">
            <div class="fix-line-card">
              <div class="fix-panel-title">반입률 추이 · 최근 7일</div>
              <svg viewBox="0 0 280 112" preserveAspectRatio="none" aria-label="최근 7일 반입률 추이">
                <defs>
                  <linearGradient id="fixLandfillLine" x1="0" x2="1">
                    <stop offset="0%" stop-color="#6df3e3"></stop>
                    <stop offset="100%" stop-color="#74bdff"></stop>
                  </linearGradient>
                  <linearGradient id="fixLandfillFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#6df3e3" stop-opacity=".22"></stop>
                    <stop offset="100%" stop-color="#6df3e3" stop-opacity="0"></stop>
                  </linearGradient>
                </defs>
                <polyline points="${points}" fill="none" stroke="url(#fixLandfillLine)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
                <polyline points="${points} 252,102 12,102" fill="url(#fixLandfillFill)" stroke="none"></polyline>
              </svg>
              <div class="fix-chart-caption">최근 7일간 총량 대비 반입률이 어떻게 변했는지 보여줍니다.</div>
            </div>
            <div class="fix-landfill-donuts">
              ${donut("잔여 관리 여력", Math.round(l.margin), "현재 기준으로 남은 관리 가능 비율")}
              ${donut("총량 대비 반입률", Math.round(l.inbound), "오늘 반입량이 전체 기준에서 차지하는 비율")}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#fix-landfill-refresh", card)?.addEventListener("click", () => {
      landfillState.ton += Math.floor(Math.random() * 60) - 24;
      landfillState.delta = Number((landfillState.delta + (Math.random() * 0.8 - 0.4)).toFixed(1));
      landfillState.inbound = Number((landfillState.inbound + (Math.random() * 0.8 - 0.25)).toFixed(1));
      landfillState.margin = Number((100 - landfillState.inbound + 1.6).toFixed(1));
      landfillState.trend = landfillState.trend.map((value) => Math.max(22, Math.min(90, value + Math.floor(Math.random() * 9) - 4)));
      renderLandfillCard(true);
    });
  }

  function patchMiniApp() {
    const card = document.querySelector(".upload-card") || findCard("버려지는 순간을 기록하세요");
    if (!card) return;

    const kicker = $(".ny-kicker", card);
    if (kicker) {
      kicker.textContent = "3-Second Sorting Helper App";
      kicker.classList.add("fix-miniapp-kicker");
    }

    $$("button, a, span", card).forEach((el) => {
      if (norm(el.textContent).includes("AI + 학생 판단")) el.classList.add("fix-bright-btn");
    });
  }

  function applyAll() {
    if (applying) return;
    applying = true;
    patchLogo();
    patchNavAndButtons();
    patchHeroCopy();
    renderSchoolCard();
    renderClassCard();
    renderLandfillCard();
    patchMiniApp();
    applying = false;
  }

  function boot() {
    applyAll();

    const observer = new MutationObserver(() => {
      window.clearTimeout(window.__aiwaysNumberedFixTimer);
      window.__aiwaysNumberedFixTimer = window.setTimeout(applyAll, 160);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", patchNavAndButtons);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
