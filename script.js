const itemData = {
  paper: {
    name: "구겨진 종이",
    category: "종이류",
    confidence: 86,
    guidance:
      "오염되지 않은 종이는 종이류로 분리배출할 수 있습니다. 단, 물기·음식물·테이프·코팅 여부는 다시 확인해야 합니다.",
    quickGuidance:
      "오염되지 않은 종이는 종이류로 분리배출할 수 있습니다. 물기, 음식물, 테이프, 코팅이 있으면 다시 확인합니다.",
  },
  milk: {
    name: "우유갑",
    category: "종이팩",
    confidence: 82,
    guidance:
      "내용물을 비우고 헹군 뒤 말려서 종이팩 수거함에 배출합니다. 빨대와 비닐은 분리합니다.",
    quickGuidance:
      "내용물을 비우고 헹군 뒤 말려서 종이팩 수거함에 배출합니다. 빨대와 비닐은 분리합니다.",
  },
  cup: {
    name: "플라스틱컵",
    category: "플라스틱",
    confidence: 79,
    guidance:
      "내용물을 비우고 헹군 뒤 플라스틱으로 배출합니다. 오염이 심하면 학교 기준에 따라 다시 확인합니다.",
    quickGuidance:
      "내용물을 비우고 헹군 뒤 플라스틱으로 배출합니다. 오염이 심하면 학교 기준에 따라 다시 확인합니다.",
  },
  snack: {
    name: "과자봉지",
    category: "비닐류 검토",
    confidence: 72,
    guidance:
      "재질과 오염 여부를 확인합니다. 재활용이 어려운 비닐류는 학교 분리배출 기준에 따라 판단합니다.",
    quickGuidance:
      "재질과 오염 여부를 확인합니다. 재활용이 어려운 비닐류는 학교 분리배출 기준에 따라 판단합니다.",
  },
  straw: {
    name: "빨대",
    category: "학교 기준 재확인",
    confidence: 64,
    guidance:
      "작고 오염되기 쉬운 물건은 재활용이 어려울 수 있습니다. 학교 기준과 안내를 확인합니다.",
    quickGuidance:
      "작고 오염되기 쉬운 물건은 재활용이 어려울 수 있습니다. 학교 기준과 안내를 확인합니다.",
  },
};

const metricValues = {};
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rankingData = {
  class: [
    { title: "5학년 1반", meta: "1위 / 42건", highlight: true },
    { title: "5학년 2반", meta: "2위 / 36건" },
    { title: "5학년 3반", meta: "3위 / 31건" },
    { title: "5학년 4반", meta: "4위 / 28건" },
  ],
  grade: [
    { title: "5학년", meta: "1위 / 112건", highlight: true },
    { title: "6학년", meta: "2위 / 96건" },
    { title: "4학년", meta: "3위 / 58건" },
    { title: "3학년", meta: "4위 / 46건" },
  ],
  school: [
    { title: "우리학교", meta: "학교 내 2위 학급 보유 / 참여 학급 14개", highlight: true },
    { title: "5학년 1반", meta: "최다 AI 분류 참여", highlight: true },
    { title: "판단 보류 개선률", meta: "18% 감소" },
  ],
  dong: [
    { title: "우리학교", meta: "7위", highlight: true },
    { title: "동 평균 참여 지수", meta: "74" },
    { title: "우리학교 참여 지수", meta: "86", highlight: true },
  ],
  gu: [
    { title: "우리학교", meta: "12위", highlight: true },
    { title: "구 평균 참여 지수", meta: "68" },
    { title: "우리학교 참여 지수", meta: "86", highlight: true },
  ],
  incheon: [
    { title: "우리학교", meta: "48위", highlight: true },
    { title: "인천 참여 학교 더미", meta: "126개" },
    { title: "우리반 데이터", meta: "확산 준비 중" },
  ],
};

let selectedFile = null;
let currentItemKey = "paper";
let resultVisible = false;
let recordFinalized = false;
let analysisMetricApplied = false;
let loadingTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  bindIntroOverlay();
  prepareStorySections();
  initializeCounters();
  bindScrollButtons();
  bindAnchorNavigation();
  bindStoryProgress();
  bindRankingTabs();
  bindUploadDemo();
  bindResultActions();
  bindQuickApp();
});

function initializeCounters() {
  document.querySelectorAll("[data-counter]").forEach((counter) => {
    const key = counter.dataset.kpi;
    const target = Number(counter.dataset.target || 0);
    metricValues[key] = target;
    counter.textContent = String(target);
  });
}

function bindScrollButtons() {
  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetSelector = button.dataset.scroll === "#demo-card" ? "#classify" : button.dataset.scroll;
      smoothScrollToTarget(targetSelector);

      if (button.dataset.scroll === "#demo-card") {
        highlightDemoCard();
        window.setTimeout(() => document.querySelector("#wasteImageInput, #imageUpload")?.focus(), 760);
      }
    });
  });
}

function highlightDemoCard() {
  const card = document.querySelector("#classify, #demo-card");
  if (!card) return;
  card.classList.remove("is-highlighted");
  void card.offsetWidth;
  card.classList.add("is-highlighted");
  window.setTimeout(() => card.classList.remove("is-highlighted"), 1300);
}

function bindAnchorNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      smoothScrollToTarget(href);
    });
  });
}

function smoothScrollToTarget(selector) {
  const target = document.querySelector(selector);
  if (!target) return;

  if (prefersReducedMotion || window.innerWidth < 900) {
    target.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function appleEase(progress) {
  const x1 = 0.22;
  const y1 = 1;
  const x2 = 0.36;
  const y2 = 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  let t = progress;

  for (let i = 0; i < 5; i += 1) {
    const x = ((ax * t + bx) * t + cx) * t - progress;
    const derivative = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(derivative) < 0.000001) break;
    t = Math.min(1, Math.max(0, t - x / derivative));
  }

  return ((ay * t + by) * t + cy) * t;
}

function animateScrollTo(targetY, duration) {
  const startY = window.scrollY;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  const destination = Math.max(0, Math.min(targetY, maxY));
  const distance = destination - startY;
  const startTime = performance.now();

  document.body.classList.add("is-section-scrolling");

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, startY + distance * appleEase(progress));

    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }

    window.scrollTo(0, destination);
    window.setTimeout(() => document.body.classList.remove("is-section-scrolling"), 160);
  }

  requestAnimationFrame(step);
}

function bindIntroOverlay() {
  const overlay = document.querySelector("#introOverlay");
  const skipButton = document.querySelector("#skipIntro");
  if (!overlay) return;

  const closeIntro = () => {
    overlay.classList.add("is-done");
    document.documentElement.classList.add("intro-finished");
  };

  skipButton?.addEventListener("click", closeIntro);

  if (prefersReducedMotion) {
    window.setTimeout(closeIntro, 420);
    return;
  }

  window.setTimeout(closeIntro, 4800);
}

function prepareStorySections() {
  document.querySelectorAll("main > .story-section:not(.hero-story)").forEach((section) => {
    if (section.querySelector(":scope > .sticky-stage")) return;
    const stage = document.createElement("div");
    stage.className = "sticky-stage";
    while (section.firstChild) {
      stage.appendChild(section.firstChild);
    }
    section.appendChild(stage);
  });
}

function bindStoryProgress() {
  const sections = [...document.querySelectorAll(".story-section")];
  if (!sections.length) return;

  let metrics = [];
  let ticking = false;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function measure() {
    metrics = sections.map((section) => ({
      section,
      top: section.offsetTop,
      height: section.offsetHeight,
    }));
    update();
  }

  function update() {
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    metrics.forEach(({ section, top, height }) => {
      const travel = Math.max(1, height - viewportHeight);
      const progress = clamp((scrollY - top) / travel, 0, 1);
      section.style.setProperty("--progress", progress.toFixed(4));
      section.classList.toggle("is-in-view", progress > 0.02 && progress < 0.98);
    });

    ticking = false;
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  measure();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", measure);
}

function bindRankingTabs() {
  const list = document.querySelector("#rankingList");
  const buttons = document.querySelectorAll("[data-ranking-tab]");
  if (!list || !buttons.length) return;

  function renderRanking(key) {
    const rows = rankingData[key] || rankingData.class;
    list.innerHTML = rows
      .map(
        (row, index) => `
          <article class="${row.highlight ? "is-highlighted" : ""}">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${row.title}</strong>
            <em>${row.meta}</em>
          </article>
        `
      )
      .join("");
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((tabButton) => {
        const isActive = tabButton === button;
        tabButton.classList.toggle("is-active", isActive);
        tabButton.setAttribute("aria-selected", String(isActive));
      });
      renderRanking(button.dataset.rankingTab);
    });
  });

  renderRanking("class");
}

function bindUploadDemo() {
  const input = document.querySelector("#wasteImageInput, #imageUpload");
  const startButton = document.querySelector("#startAiGuess, #startAnalysis");
  const dropZone = document.querySelector("#dropZone");
  if (!input || !startButton || !dropZone) return;

  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) handleSelectedFile(file);
  });

  startButton.addEventListener("click", () => {
    if (!selectedFile) {
      showDemoMessage("사진을 먼저 업로드하면 AI 1차 추정 시연을 시작할 수 있습니다.", true);
      return;
    }
    runMockAnalysis();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showDemoMessage("사진 파일만 업로드할 수 있습니다.", true);
      return;
    }
    handleSelectedFile(file);
  });
}

function handleSelectedFile(file) {
  selectedFile = file;
  currentItemKey = "paper";
  resultVisible = false;
  recordFinalized = false;
  analysisMetricApplied = false;
  clearTimeout(loadingTimer);

  const previewWrap = document.querySelector("#previewWrap");
  const previewImage = document.querySelector("#previewImage");
  const objectUrl = URL.createObjectURL(file);

  previewImage.src = objectUrl;
  previewImage.onload = () => URL.revokeObjectURL(objectUrl);
  previewWrap.classList.remove("is-hidden");

  hideResult();
  showDemoMessage("사진이 업로드되었습니다. AI 1차 추정 시작 버튼을 눌러 시연을 진행하세요.", false);
}

function runMockAnalysis() {
  if (!selectedFile) {
    showDemoMessage("사진을 먼저 업로드하면 AI 1차 추정 시연을 시작할 수 있습니다.", true);
    return;
  }

  clearTimeout(loadingTimer);
  hideResult();
  resultVisible = false;
  recordFinalized = false;
  currentItemKey = "paper";

  document.querySelector("#loadingState").classList.remove("is-hidden");
  showDemoMessage("AI가 최종 정답을 확정하지 않고 1차 분류만 제안합니다.", false);
  applyAnalysisMetrics();

  loadingTimer = window.setTimeout(() => {
    document.querySelector("#loadingState").classList.add("is-hidden");
    renderResult("paper");
    resultVisible = true;
    const resultCard = document.querySelector("#resultCard");
    resultCard.classList.remove("is-hidden");
    resultCard.classList.add("is-visible");
  }, 1500);
}

function bindResultActions() {
  document.querySelector("#confirmResult")?.addEventListener("click", () => {
    if (!ensureResultReady()) return;
    if (recordFinalized) {
      setResultStatus("이미 대시보드에 반영된 기록입니다. 새 사진을 올리면 다시 시연할 수 있습니다.");
      return;
    }

    applyAnalysisMetrics();
    updateMetric("converted", 1);
    recordFinalized = true;
    setResultStatus("대시보드 반영 완료");
  });

  document.querySelector("#reselectItem")?.addEventListener("click", () => {
    if (!ensureResultReady()) return;
    document.querySelector("#itemChooser").classList.toggle("is-hidden");
    setResultStatus("헷갈리는 물건을 직접 선택해 안내를 다시 확인합니다.");
  });

  document.querySelector("#holdResult")?.addEventListener("click", () => {
    if (!ensureResultReady()) return;
    if (!recordFinalized) {
      updateMetric("class-hold", 1);
      recordFinalized = true;
    }
    setResultStatus(
      "모르는 물건을 아무 데나 버리지 않는 것도 자원순환 역량입니다. 판단 보류 사례로 기록되었습니다."
    );
  });

  document.querySelectorAll("[data-result-item]").forEach((button) => {
    button.addEventListener("click", () => {
      renderResult(button.dataset.resultItem);
      setResultStatus("선택한 물건 기준으로 안내 카드가 변경되었습니다.");
    });
  });
}

function applyAnalysisMetrics() {
  if (analysisMetricApplied) return;
  updateMetric("today-observed", 1);
  updateMetric("ai-classified", 1);
  updateMetric("human-confirmed", 1);
  analysisMetricApplied = true;
}

function bindQuickApp() {
  const quickCategory = document.querySelector("#quickCategory");
  const quickGuidance = document.querySelector("#quickGuidance");

  document.querySelectorAll("[data-quick-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const data = itemData[button.dataset.quickItem];
      if (!data) return;

      document
        .querySelectorAll("[data-quick-item]")
        .forEach((itemButton) => itemButton.classList.remove("is-active"));
      button.classList.add("is-active");

      quickCategory.textContent = `AI 1차 제안: ${data.category}`;
      quickGuidance.textContent = data.quickGuidance;
    });
  });
}

function renderResult(itemKey) {
  const data = itemData[itemKey] || itemData.paper;
  currentItemKey = itemKey;

  document.querySelector("#detectedItem").textContent = data.name;
  document.querySelector("#categorySuggestion").textContent = data.category;
  document.querySelector("#confidencePill").textContent = `신뢰도 ${data.confidence}%`;
  document.querySelector("#resultGuidance").textContent = data.guidance;
}

function ensureResultReady() {
  if (!selectedFile) {
    showDemoMessage("사진을 먼저 업로드하면 결과 처리 버튼을 사용할 수 있습니다.", true);
    return false;
  }
  if (!resultVisible) {
    showDemoMessage("AI 1차 추정이 끝난 뒤 결과를 처리할 수 있습니다.", true);
    return false;
  }
  return true;
}

function updateMetric(key, amount) {
  const counter = document.querySelector(`[data-counter][data-kpi="${key}"]`);
  const card = document.querySelector(`[data-kpi-card="${key}"]`);
  if (!counter || !card) return;

  const previous = metricValues[key] ?? Number(counter.textContent || 0);
  const next = previous + amount;
  metricValues[key] = next;

  animateCounter(counter, previous, next, 520);
  card.classList.remove("is-pulsing");
  void card.offsetWidth;
  card.classList.add("is-pulsing");

  window.setTimeout(() => card.classList.remove("is-pulsing"), 980);
}

function animateCounter(element, from, to, duration) {
  if (prefersReducedMotion) {
    element.textContent = String(to);
    return;
  }

  const startTime = performance.now();
  const difference = to - from;

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(from + difference * eased));

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function hideResult() {
  document.querySelector("#loadingState").classList.add("is-hidden");
  document.querySelector("#resultCard").classList.add("is-hidden");
  document.querySelector("#resultCard").classList.remove("is-visible");
  document.querySelector("#itemChooser").classList.add("is-hidden");
  setResultStatus("");
}

function showDemoMessage(message, isWarning) {
  const demoMessage = document.querySelector("#demoMessage");
  demoMessage.textContent = message;
  demoMessage.classList.toggle("is-warning", Boolean(isWarning));
}

function setResultStatus(message) {
  document.querySelector("#resultStatus").textContent = message;
}
