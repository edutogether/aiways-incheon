(() => {
  const $ = (selector, parent = document) => parent?.querySelector(selector) || null;
  const $$ = (selector, parent = document) => (parent ? [...parent.querySelectorAll(selector)] : []);

  const classData = {
    "5학년 1반": { ai: 37, reconfirm: 18, today: 128, hold: 7, converted: 24, rank: "학년 내 1위 · 학교 내 2위" },
    "5학년 2반": { ai: 33, reconfirm: 17, today: 116, hold: 6, converted: 19, rank: "학년 내 2위 · 학교 내 5위" },
    "5학년 3반": { ai: 29, reconfirm: 15, today: 109, hold: 8, converted: 17, rank: "학년 내 3위 · 학교 내 7위" },
    "4학년 1반": { ai: 25, reconfirm: 14, today: 97, hold: 5, converted: 13, rank: "학년 내 1위 · 학교 내 8위" },
    "6학년 2반": { ai: 41, reconfirm: 21, today: 134, hold: 9, converted: 28, rank: "학년 내 1위 · 학교 내 1위" },
  };

  const schoolState = {
    observed: 312,
    classes: 14,
    hold: 21,
    grades: {
      "3학년": 46,
      "4학년": 58,
      "5학년": 112,
      "6학년": 96,
    },
  };

  const landfillState = {
    ton: 18420,
    delta: -2.8,
    inbound: 63.4,
    margin: 36.6,
    trend: [52, 42, 48, 66, 56, 82, 94],
  };

  let selectedClass = "5학년 1반";
  let autoTimer = null;

  function text(node) {
    return (node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function numberText(value) {
    return Math.round(value).toLocaleString("ko-KR");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomFloat(min, max, decimals = 1) {
    return Number((min + Math.random() * (max - min)).toFixed(decimals));
  }

  function pulse(card) {
    if (!card) return;
    card.classList.remove("awx-pulse");
    void card.offsetWidth;
    card.classList.add("awx-pulse");
  }

  function setCounter(key, value) {
    const counter = document.querySelector(`[data-counter][data-kpi="${key}"]`);
    if (!counter) return;
    counter.dataset.target = String(value);
    counter.textContent = String(value);

    try {
      metricValues[key] = value;
    } catch {
      /* metricValues is provided by script.js on the deployed page. */
    }
  }

  function setStaticKpi(key, value) {
    const node = document.querySelector(`[data-kpi="${key}"]`);
    if (!node) return;
    node.textContent = numberText(value);
  }

  function patchHero() {
    $(".aiw-eyebrow")?.classList.add("awx-hero-badge");
    $(".aiw-title")?.classList.add("awx-hero-title");

    const copy = $(".aiw-description");
    if (copy) {
      copy.classList.add("awx-hero-copy");
      copy.innerHTML = [
        "AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다.",
        "우리가 실제로 쓰레기를 버리는 순간을 관찰하고,",
        "AI를 통해 데이터를 1차 판단한 뒤 사람이 중심이 되어 다시 확인하는,",
        "우리 학교의 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.",
      ]
        .map((line) => `<span class="line">${line}</span>`)
        .join("");
    }

    $(".aiw-primary-btn")?.classList.add("awx-top-cta");
  }

  function patchCards() {
    $(".aiw-dashboard-panel")?.classList.add("awx-dashboard-panel");

    $$(".school-card, .class-card, .landfill-card, .upload-card").forEach((card) => {
      card.classList.add("awx-live-card");
      $(".aiw-card-head", card)?.classList.add("awx-card-head");
      $("h2", card)?.classList.add("awx-card-title");
    });
  }

  function patchSchoolCard() {
    const card = $(".school-card");
    if (!card) return;

    const title = $("h2", card);
    if (title) title.textContent = "우리학교 자원순환 대시보드";

    const badge = $(".aiw-demo-badge", card);
    if (badge) {
      badge.classList.add("awx-demo-chip");
      badge.textContent = "DEMO · 수업용 데이터";
    }

    setStaticKpi("school-observed", schoolState.observed);
    setStaticKpi("school-classes", schoolState.classes);
    setStaticKpi("school-hold", schoolState.hold);
    refreshGradeBars();
  }

  function refreshGradeBars() {
    const card = $(".school-card");
    if (!card) return;

    const max = Math.max(...Object.values(schoolState.grades));
    $$(".grade-row", card).forEach((row) => {
      const label = text($("span", row));
      const value = schoolState.grades[label];
      if (!value) return;

      const bar = $("i", row);
      const valueNode = $("b", row);
      if (bar) bar.style.setProperty("--bar", `${Math.round((value / max) * 100)}%`);
      if (valueNode) valueNode.textContent = String(value);
    });
  }

  function patchClassCard() {
    const card = $(".class-card");
    if (!card) return;

    const title = $("h2", card);
    if (title) title.textContent = "우리반 자원순환 대시보드";

    $$(".class-main-kpi, .class-mini-kpis div", card).forEach((tile) => tile.classList.add("awx-stat-focus"));

    const head = $(".aiw-card-head", card);
    const badge = $(".aiw-demo-badge", card);
    if (head && badge && !$("#awxClassSelect", card)) {
      badge.classList.add("awx-class-badge");
      badge.textContent = "";

      const select = document.createElement("select");
      select.id = "awxClassSelect";
      select.className = "awx-class-select";
      select.setAttribute("aria-label", "대시보드 학급 선택");
      Object.keys(classData).forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        option.selected = name === selectedClass;
        select.appendChild(option);
      });
      badge.appendChild(select);

      select.addEventListener("change", () => {
        selectedClass = select.value;
        applyClassData(true);
      });
    }

    applyClassData(false);
  }

  function applyClassData(animate) {
    const card = $(".class-card");
    const data = classData[selectedClass] || classData["5학년 1반"];

    setCounter("ai-classified", data.ai);
    setCounter("human-confirmed", data.reconfirm);
    setCounter("today-observed", data.today);
    setCounter("class-hold", data.hold);
    setCounter("converted", data.converted);

    const labels = [
      ["ai-classified", "AI 분류"],
      ["human-confirmed", "재확인"],
      ["today-observed", "오늘 관찰"],
      ["class-hold", "판단 보류"],
      ["converted", "전환 사례"],
    ];
    labels.forEach(([key, label]) => {
      const cardNode = document.querySelector(`[data-kpi-card="${key}"]`);
      const span = $("span", cardNode);
      if (span) span.textContent = label;
    });

    const rankStrong = $(".ranking-box strong", card);
    if (rankStrong) rankStrong.textContent = data.rank;
    const rankSmall = $(".ranking-box small", card);
    if (rankSmall) rankSmall.textContent = "랭킹 보기";
    $(".ranking-box", card)?.classList.add("awx-rank-chip");

    const select = $("#awxClassSelect", card);
    if (select) select.value = selectedClass;

    if (animate) pulse(card);
  }

  function patchLandfillCard() {
    const card = $(".landfill-card");
    if (!card) return;

    const title = $("h2", card);
    if (title) title.textContent = "수도권매립지 모니터";

    const kicker = $(".aiw-card-kicker", card);
    if (kicker) kicker.textContent = "DEMO · 공식 관리 지표 구조 참고";

    const refresh = $(".landfill-refresh, .live-dot", card);
    if (refresh) {
      refresh.classList.add("awx-refresh-btn");
      refresh.setAttribute("role", "button");
      refresh.setAttribute("tabindex", "0");
      refresh.setAttribute("aria-label", "수도권매립지 모니터 새로고침");
      if (!refresh.innerHTML.trim() || refresh.classList.contains("live-dot")) {
        refresh.innerHTML = refreshIcon();
      }

      if (!refresh.dataset.awxBound) {
        refresh.dataset.awxBound = "true";
        refresh.addEventListener("click", () => refreshLandfill(true));
        refresh.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            refreshLandfill(true);
          }
        });
      }
    }

    let pill = $(".awx-live-pill", card);
    if (!pill) {
      pill = document.createElement("div");
      pill.className = "awx-live-pill";
      pill.textContent = "수업용 프로토타입 · 자동 갱신";
      const bottom = $(".landfill-bottom", card);
      if (bottom) bottom.insertAdjacentElement("afterend", pill);
      else card.appendChild(pill);
    }

    refreshLandfill(false);
  }

  function refreshIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 11a8 8 0 1 0 2 5"></path>
        <path d="M20 4v7h-7"></path>
      </svg>
    `;
  }

  function refreshLandfill(animate) {
    const card = $(".landfill-card");
    if (!card) return;

    if (animate) {
      landfillState.ton = clamp(landfillState.ton + randomInt(-38, 44), 18120, 18890);
      landfillState.delta = randomFloat(-3.6, -1.4);
      landfillState.inbound = randomFloat(62.5, 65.8);
      landfillState.margin = Number((100 - landfillState.inbound).toFixed(1));
      landfillState.trend = landfillState.trend.map((value, index) => {
        const drift = index === landfillState.trend.length - 1 ? randomInt(-4, 2) : randomInt(-3, 3);
        return clamp(value + drift, 32, 98);
      });
    }

    updateLandfillTile(card, "반입량", `${numberText(landfillState.ton)}t`);
    updateLandfillTile(card, "전일 대비", `${landfillState.delta.toFixed(1)}%`);
    updateLandfillTile(card, "반입률", `${landfillState.inbound.toFixed(1)}%`);
    updateLandfillTile(card, "여력", `${landfillState.margin.toFixed(1)}%`);

    $$(".progress-row", card).forEach((row) => {
      const label = text($("span", row));
      const value = label.includes("반입률") ? landfillState.inbound : landfillState.margin;
      const valueNode = $("b", row);
      const bar = $("em", row);
      if (valueNode) valueNode.textContent = `${value.toFixed(1)}%`;
      if (bar) bar.style.width = `${value}%`;
    });

    const donut = $(".landfill-donut", card);
    if (donut) {
      donut.style.setProperty("--val", landfillState.margin.toFixed(1));
      donut.setAttribute("data-label", `잔여\n${landfillState.margin.toFixed(1)}%`);
    }

    const strokePath = $(".landfill-line path[stroke]", card);
    const fillPath = $(".landfill-line path[fill]", card);
    if (strokePath) {
      const d = landfillState.trend.map((value, index) => `${index === 0 ? "M" : "L"}${10 + index * 50} ${value}`).join(" ");
      strokePath.setAttribute("d", d);
      if (fillPath) fillPath.setAttribute("d", `${d} L310 108 L10 108 Z`);
    }

    const refresh = $(".awx-refresh-btn", card);
    if (animate && refresh) {
      refresh.classList.add("is-spinning");
      window.setTimeout(() => refresh.classList.remove("is-spinning"), 820);
      pulse(card);
    }
  }

  function updateLandfillTile(card, labelPart, value) {
    const tile = $$(".landfill-kpis .aiw-kpi-tile", card).find((node) => text($("span", node)).includes(labelPart));
    const valueNode = $("b", tile);
    if (valueNode) valueNode.textContent = value;
  }

  function patchUploadCard() {
    const card = $(".upload-card");
    if (!card) return;
    if ($(".cx-app, .ny-app", card)) {
      card.classList.add("awx-live-card");
      return;
    }

    const title = $("h2", card);
    if (title) title.textContent = "버려지는 순간을 기록하세요";

    const kicker = $(".aiw-card-kicker", card);
    if (kicker) kicker.textContent = "H-A-H Demo Module";

    const desc = $(".aiw-card-desc", card);
    if (desc) desc.textContent = "사진을 올리면 AI가 1차 분류를 제안하고, 학생이 다시 확인합니다.";

    const strong = $(".upload-drop strong", card);
    if (strong) strong.textContent = "사진 업로드";

    const uploadText = $(".upload-drop span:last-child", card) || $(".upload-drop span", card);
    let small = $(".upload-drop small", card);
    if (!small && uploadText) {
      small = document.createElement("small");
      uploadText.appendChild(small);
    }
    if (small) small.textContent = "큐시트 종이를 구겨 올리는 발표 시연";

    const start = $("#startAiGuess", card);
    if (start) {
      start.classList.add("awx-primary-record");
      start.textContent = "버려지는 순간을 데이터로 만들기";
    }

    ensureDemoMessage(card);

    const actions = ensureUploadActions(card);
    if (actions && !actions.dataset.awxBound) {
      actions.dataset.awxBound = "true";
      const [cameraButton, galleryButton] = $$("button", actions);
      const input = $("#wasteImageInput", card);

      cameraButton?.addEventListener("click", () => {
        if (!input) return;
        input.setAttribute("capture", "environment");
        input.click();
      });

      galleryButton?.addEventListener("click", () => {
        if (!input) return;
        input.removeAttribute("capture");
        input.click();
      });
    }
  }

  function ensureUploadActions(card) {
    let actions = $(".upload-actions-two", card);
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "upload-actions-two";
      const drop = $(".upload-drop", card);
      if (drop) drop.insertAdjacentElement("afterend", actions);
      else card.appendChild(actions);
    }

    if ($$("button", actions).length < 2) {
      actions.innerHTML = `
        <button class="awx-camera-btn" type="button">카메라로 지금 찍기</button>
        <button class="awx-gallery-btn" type="button">찍은 사진 올리기</button>
      `;
    } else {
      const [cameraButton, galleryButton] = $$("button", actions);
      cameraButton.classList.add("awx-camera-btn");
      cameraButton.textContent = "카메라로 지금 찍기";
      galleryButton.classList.add("awx-gallery-btn");
      galleryButton.textContent = "찍은 사진 올리기";
    }

    return actions;
  }

  function ensureDemoMessage(card) {
    if ($("#demoMessage", card)) return;

    const note = document.createElement("p");
    note.id = "demoMessage";
    note.className = "upload-note";
    note.setAttribute("aria-live", "polite");
    note.textContent = "발표 중 업로드한 사진은 이 브라우저 안에서만 미리보기로 사용됩니다.";

    const preview = $("#previewWrap", card);
    const start = $("#startAiGuess", card);
    if (preview) preview.insertAdjacentElement("beforebegin", note);
    else if (start) start.insertAdjacentElement("afterend", note);
    else card.appendChild(note);
  }

  function mutateSchool() {
    schoolState.observed = clamp(schoolState.observed + randomInt(-1, 4), 300, 346);
    schoolState.hold = clamp(schoolState.hold + randomInt(-1, 1), 17, 25);
    Object.keys(schoolState.grades).forEach((key) => {
      schoolState.grades[key] = clamp(schoolState.grades[key] + randomInt(-1, 2), 38, 122);
    });
  }

  function liveTick() {
    mutateSchool();
    patchSchoolCard();
    refreshLandfill(true);
    pulse($(".school-card"));
  }

  function boot() {
    patchHero();
    patchCards();
    patchSchoolCard();
    patchClassCard();
    patchLandfillCard();
    patchUploadCard();

    window.setTimeout(() => {
      patchHero();
      patchCards();
      patchSchoolCard();
      patchClassCard();
      patchLandfillCard();
      patchUploadCard();
    }, 180);

    if (!autoTimer) {
      autoTimer = window.setInterval(liveTick, 5600);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
