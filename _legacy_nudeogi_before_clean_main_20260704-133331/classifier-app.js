(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const wasteRules = [
    {
      id: "paper",
      item: "종이류",
      category: "종이류",
      bin: "종이류 배출함",
      keywords: ["paper", "envelope", "book", "comic book", "menu", "notebook", "packet", "paper towel", "carton"],
      action: "물기와 음식물이 묻지 않았다면 펼쳐서 종이류로 배출합니다.",
      warning: "코팅지, 테이프가 붙은 종이, 음식물 오염이 있는 종이는 바로 배출하지 않고 판단 보류함에 등록합니다.",
    },
    {
      id: "paper_pack",
      item: "우유갑 / 종이팩",
      category: "종이팩",
      bin: "종이팩 전용 수거함",
      keywords: ["milk", "carton", "packet", "container", "juice", "box"],
      action: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 배출합니다.",
      warning: "젖어 있거나 내용물이 남아 있으면 재활용 품질이 떨어지므로 보류 판단이 필요합니다.",
    },
    {
      id: "plastic_bottle",
      item: "플라스틱병 / 플라스틱 용기",
      category: "플라스틱류",
      bin: "플라스틱 배출함",
      keywords: ["water bottle", "pop bottle", "bottle", "plastic", "water jug", "container", "bucket", "cup"],
      action: "내용물을 비우고 뚜껑과 라벨 등 분리 가능한 부분을 떼어낸 뒤 배출합니다.",
      warning: "음료나 음식물이 남아 있으면 먼저 비우고 헹군 뒤 판단합니다.",
    },
    {
      id: "vinyl",
      item: "비닐류 / 과자봉지",
      category: "비닐류 또는 판단 보류",
      bin: "비닐류 배출함 / 판단 보류함",
      keywords: ["plastic bag", "packet", "snack", "bag", "shopping bag", "pouch", "wrapper"],
      action: "내용물을 완전히 비우고 오염이 적으면 비닐류로 배출합니다.",
      warning: "기름기와 양념이 많이 묻어 있으면 일반쓰레기 또는 판단 보류가 필요합니다.",
    },
    {
      id: "can",
      item: "캔류",
      category: "캔류",
      bin: "캔류 배출함",
      keywords: ["can", "tin can", "beer can", "soda can", "aluminum"],
      action: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다.",
      warning: "담배꽁초나 이물질이 들어 있으면 먼저 제거해야 합니다.",
    },
    {
      id: "glass",
      item: "유리병 / 유리류",
      category: "유리류",
      bin: "유리병 배출함",
      keywords: ["bottle", "wine bottle", "beer bottle", "glass", "jar", "vase"],
      action: "내용물을 비우고 깨지지 않도록 조심해 유리류로 배출합니다.",
      warning: "깨진 유리는 재활용 배출함이 아니라 안전하게 싸서 별도 처리해야 합니다.",
    },
    {
      id: "food",
      item: "음식물 또는 오염 물질",
      category: "일반쓰레기 / 음식물 검토",
      bin: "일반쓰레기 또는 음식물 처리 기준 확인",
      keywords: ["banana", "apple", "orange", "food", "pizza", "hotdog", "ice cream", "broccoli", "cucumber"],
      action: "음식물은 학교 기준에 맞게 별도로 처리하고, 포장재와 분리합니다.",
      warning: "음식물이 묻은 재활용품은 오배출 가능성이 높으므로 먼저 비우고 닦아야 합니다.",
    },
    {
      id: "stationery",
      item: "학용품 / 복합재질 물건",
      category: "일반쓰레기 또는 판단 보류",
      bin: "판단 보류함",
      keywords: ["ballpoint", "pencil", "rubber eraser", "eraser", "pen", "binder", "ruler", "scissors"],
      action: "여러 재질이 섞인 학용품은 재활용이 어려운 경우가 많아 판단 보류함에 등록합니다.",
      warning: "분리 가능한 부품이 있는지 확인하고, 학교 기준에 따라 최종 판단합니다.",
    },
  ];

  const effects = {
    quick: { name: "3초 분류 앱", effect: "오배출 감소", mis: -5, success: 5, co2: 0.7, life: 5 },
    hold: { name: "판단 보류함", effect: "즉시 오배출 감소", mis: -4, success: 3, co2: 0.5, life: 4 },
    guide: { name: "가이드선", effect: "성공률 증가", mis: -3, success: 6, co2: 0.4, life: 3 },
    quiz: { name: "퀴즈 앱", effect: "참여율 증가", mis: -2, success: 4, co2: 0.3, life: 2 },
    rank: { name: "랭킹", effect: "학급 동기 강화", mis: -2, success: 3, co2: 0.2, life: 2 },
  };

  const session = {
    today: Number(sessionStorage.getItem("cx_today") || 0),
    ai: Number(sessionStorage.getItem("cx_ai") || 0),
    reconfirm: Number(sessionStorage.getItem("cx_reconfirm") || 0),
    hold: Number(sessionStorage.getItem("cx_hold") || 0),
    converted: Number(sessionStorage.getItem("cx_converted") || 0),
    schoolObserved: Number(sessionStorage.getItem("cx_schoolObserved") || 0),
  };

  const baseCache = {};
  let currentObjectUrl = null;
  let currentResult = null;
  let currentFinalized = false;
  let modelPromise = null;
  let renderLock = false;

  function saveSession() {
    Object.entries(session).forEach(([key, value]) => sessionStorage.setItem(`cx_${key}`, String(value)));
  }

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function parseNumber(value) {
    const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cameraIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"></path>
        <circle cx="12" cy="13" r="3.5"></circle>
      </svg>
    `;
  }

  function galleryIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2"></rect>
        <circle cx="9" cy="10" r="1.5"></circle>
        <path d="M21 15l-4-4-5 5-2-2-4 4"></path>
      </svg>
    `;
  }

  function findRecordCard() {
    const explicit = $("#classify.upload-card") || $(".upload-card");
    if (explicit) return explicit;

    return $$(".aiw-card").find((card) => normalize(card.textContent).includes("버려지는 순간을 기록하세요"));
  }

  function appTemplate() {
    return `
      <div class="awx-card-inner cx-app">
        <div class="cx-head">
          <div>
            <div class="awx-eyebrow">H-A-H Module</div>
            <div class="awx-card-title nowrap">버려지는 순간을 기록하세요</div>
          </div>
          <span class="cx-mode">MobileNet</span>
        </div>

        <p class="cx-copy">사진을 찍어 AI와 함께 분류하며 판단합니다. 이미지는 저장하지 않고 브라우저 안에서만 잠시 분석합니다.</p>

        <div class="cx-inputs">
          <input id="cx-camera-input" type="file" accept="image/*" capture="environment" />
          <input id="cx-gallery-input" type="file" accept="image/*" />
        </div>

        <div class="cx-pickers">
          <button class="cx-picker" type="button" id="cx-camera-btn">
            <span class="cx-picker-icon">${cameraIcon()}</span>
            <span class="cx-picker-title">지금 버려지는 순간 찰칵</span>
            <span class="cx-picker-sub">카메라로 촬영해 분류하기</span>
          </button>
          <button class="cx-picker" type="button" id="cx-gallery-btn">
            <span class="cx-picker-icon">${galleryIcon()}</span>
            <span class="cx-picker-title">기록해둔 순간 판단하기</span>
            <span class="cx-picker-sub">사진을 올려 확인하기</span>
          </button>
        </div>

        <div class="cx-preview-card" id="cx-preview-card">
          <div class="cx-preview" id="cx-preview">
            <img id="cx-preview-img" alt="업로드한 버려지는 순간 미리보기" />
            <div class="cx-scan-glow" aria-hidden="true"></div>
            <div class="cx-scan-line" aria-hidden="true"></div>
            <div class="cx-detect-box" aria-hidden="true"></div>
          </div>
          <div class="cx-analysis-status" id="cx-analysis-status">
            <span class="cx-loader" aria-hidden="true"></span>
            <span id="cx-analysis-text">이미지 분류 모델을 준비하는 중입니다...</span>
          </div>
        </div>

        <div class="cx-result" id="cx-result" aria-live="polite"></div>
        <div class="cx-sim" id="cx-sim"></div>
      </div>
    `;
  }

  function ensureModel() {
    if (modelPromise) return modelPromise;

    modelPromise = new Promise(async (resolve, reject) => {
      try {
        const started = Date.now();
        while (!window.mobilenet && Date.now() - started < 9000) {
          await new Promise((done) => window.setTimeout(done, 120));
        }

        if (!window.mobilenet) throw new Error("MobileNet library was not loaded");
        const model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
        resolve(model);
      } catch (error) {
        console.warn("[AIWays] MobileNet load failed:", error);
        reject(error);
      }
    });

    return modelPromise;
  }

  function fallbackInferByFilename(file) {
    const name = (file?.name || "").toLowerCase();
    const rule =
      wasteRules.find((candidate) => candidate.keywords.some((keyword) => name.includes(keyword.toLowerCase()))) ||
      wasteRules.find((candidate) => candidate.id === "paper");

    return {
      ...rule,
      confidence: 42,
      engine: "fallback",
      rawLabel: "모델 연결 실패",
      predictions: [],
    };
  }

  async function classifyImageElement(img, file) {
    try {
      const model = await ensureModel();
      const predictions = await model.classify(img, 5);
      return mapPredictionsToWaste(predictions, file);
    } catch {
      return fallbackInferByFilename(file);
    }
  }

  function mapPredictionsToWaste(predictions, file) {
    const filename = (file?.name || "").toLowerCase();
    const labelText = predictions
      .map((prediction) => `${prediction.className} ${Math.round(prediction.probability * 100)}`)
      .join(" ")
      .toLowerCase();
    const combined = `${filename} ${labelText}`;
    let bestRule = null;
    let bestScore = -1;

    wasteRules.forEach((rule) => {
      let score = 0;
      rule.keywords.forEach((keyword) => {
        if (combined.includes(keyword.toLowerCase())) score += 4;
      });

      predictions.forEach((prediction) => {
        const className = prediction.className.toLowerCase();
        rule.keywords.forEach((keyword) => {
          if (className.includes(keyword.toLowerCase())) score += prediction.probability * 12;
        });
      });

      if (score > bestScore) {
        bestScore = score;
        bestRule = rule;
      }
    });

    const top = predictions[0];
    let confidence = top ? Math.round(top.probability * 100) : 0;

    if (!bestRule || bestScore < 2) {
      bestRule = {
        id: "unknown",
        item: "판단이 필요한 물건",
        category: "판단 보류",
        bin: "판단 보류함",
        action: "AI가 물체를 명확히 구분하지 못했습니다. 바로 버리지 말고 판단 보류함에 등록한 뒤 함께 확인합니다.",
        warning: "이 장면은 인간 재확인이 필요한 사례입니다.",
      };
      confidence = Math.max(32, confidence);
    }

    return {
      ...bestRule,
      confidence: clamp(confidence, 35, 97),
      engine: "mobilenet",
      rawLabel: top ? top.className : "unknown",
      predictions,
    };
  }

  function renderResult(result) {
    const resultEl = $("#cx-result");
    if (!resultEl) return;

    const predictionList = result.predictions?.length
      ? result.predictions
          .slice(0, 3)
          .map((prediction) => `<span>${prediction.className} ${(prediction.probability * 100).toFixed(1)}%</span>`)
          .join("")
      : "<span>이미지 모델 연결 실패 · 임시 판단 모드</span>";
    const modelBadge = result.engine === "mobilenet" ? "실제 이미지 분류" : "임시 판단";
    const particle = roParticle(result.item);

    resultEl.innerHTML = `
      <div class="cx-result-top">
        <div>
          <h3 class="cx-result-title">${result.item}${particle} 추정됩니다</h3>
          <div class="cx-copy">${modelBadge} 결과를 바탕으로 학생이 다시 확인합니다.</div>
        </div>
        <div class="cx-confidence">신뢰도 ${result.confidence}%</div>
      </div>

      <div class="cx-result-grid">
        <div class="cx-info">
          <span class="cx-info-label">AI 원본 인식</span>
          <span class="cx-info-value">${result.rawLabel}</span>
        </div>
        <div class="cx-info">
          <span class="cx-info-label">분리배출 분류</span>
          <span class="cx-info-value">${result.category}</span>
        </div>
        <div class="cx-info">
          <span class="cx-info-label">배출 위치</span>
          <span class="cx-info-value">${result.bin}</span>
        </div>
      </div>

      <p class="cx-guide">${result.action}<br /><strong>${result.warning}</strong></p>

      <div class="cx-model-labels">${predictionList}</div>

      <div class="cx-result-actions">
        <button class="cx-btn cx-btn-primary" type="button" id="cx-confirm-btn">학생 판단 완료</button>
        <button class="cx-btn cx-btn-secondary" type="button" id="cx-hold-btn">판단 보류함 등록</button>
        <button class="cx-btn cx-btn-ghost" type="button" id="cx-reset-btn">다시 선택</button>
      </div>
    `;

    resultEl.classList.add("is-visible");
    $(".cx-app")?.classList.add("has-result");

    $("#cx-confirm-btn")?.addEventListener("click", () => finalizeRecord("confirm"));
    $("#cx-hold-btn")?.addEventListener("click", () => finalizeRecord("hold"));
    $("#cx-reset-btn")?.addEventListener("click", resetApp);
  }

  function roParticle(word) {
    const last = (word || "").trim().charCodeAt((word || "").trim().length - 1);
    if (last < 0xac00 || last > 0xd7a3) return "로";
    const hasBatchim = (last - 0xac00) % 28 !== 0;
    const isRieul = (last - 0xac00) % 28 === 8;
    return hasBatchim && !isRieul ? "으로" : "로";
  }

  function finalizeRecord(mode) {
    if (currentFinalized) {
      renderSimulator(true, "이미 대시보드에 반영된 기록입니다.");
      return;
    }

    if (mode === "hold") {
      session.hold += 1;
    } else {
      session.reconfirm += 1;
      session.converted += 1;
    }

    currentFinalized = true;
    saveSession();
    applyCounterOffsets();
    renderSimulator(true, mode === "hold" ? "판단 보류함에 등록했습니다." : "대시보드 반영 완료");
  }

  function graphPath(score) {
    const base = [88, 78, 70, 64, 58, 54, 52];
    return base
      .map((y, index) => `${14 + index * 42},${Math.max(24, Math.round(y - score * (index / 6) * 1.15))}`)
      .join(" ");
  }

  function renderSimulator(open, statusText = "") {
    const sim = $("#cx-sim");
    if (!sim) return;

    sim.innerHTML = `
      <div class="cx-sim-head">
        <div>
          <h3 class="cx-sim-title">되감기 시뮬레이터</h3>
          <p class="cx-sim-caption">${statusText || "UX 솔루션을 체크하며 데이터 변화를 확인합니다."}</p>
        </div>
      </div>

      <div class="cx-checks">
        ${Object.entries(effects)
          .map(
            ([key, item]) => `
              <label class="cx-check">
                <input type="checkbox" data-cx-effect="${key}" />
                <span class="cx-check-name">${item.name}</span>
                <span class="cx-check-effect">${item.effect}</span>
              </label>
            `
          )
          .join("")}
      </div>

      <div class="cx-sim-body">
        <div class="cx-metrics">
          <div class="cx-metric"><span>오배출률</span><b id="cx-misrate">22%</b></div>
          <div class="cx-metric"><span>성공률</span><b class="good" id="cx-success">62%</b></div>
          <div class="cx-metric"><span>CO2 감축</span><b class="good" id="cx-co2">0.0kg</b></div>
          <div class="cx-metric"><span>수명 연장</span><b class="good" id="cx-life">+0일</b></div>
        </div>

        <div class="cx-graph">
          <svg viewBox="0 0 280 120" preserveAspectRatio="none" aria-label="미래 쓰레기 누적 배출량 곡선">
            <defs>
              <linearGradient id="cxLineGrad" x1="0" x2="1">
                <stop offset="0%" stop-color="#70f4df"></stop>
                <stop offset="100%" stop-color="#73bdff"></stop>
              </linearGradient>
            </defs>
            <polyline id="cx-graph-line" points="${graphPath(0)}" fill="none" stroke="url(#cxLineGrad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
            <polyline points="14,88 56,78 98,70 140,64 182,58 224,54 266,52" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round"></polyline>
          </svg>
          <p class="cx-quote">우리의 기획이 미래를 바꾼다.</p>
        </div>
      </div>
    `;

    sim.classList.toggle("is-visible", Boolean(open));
    $$("[data-cx-effect]", sim).forEach((input) => input.addEventListener("change", updateSimulator));
    updateSimulator();
  }

  function updateSimulator() {
    const checked = $$("[data-cx-effect]:checked").map((input) => input.dataset.cxEffect);
    let mis = 22;
    let success = 62;
    let co2 = 0;
    let life = 0;

    checked.forEach((key) => {
      const effect = effects[key];
      if (!effect) return;
      mis += effect.mis;
      success += effect.success;
      co2 += effect.co2;
      life += effect.life;
    });

    mis = Math.max(5, mis);
    success = Math.min(96, success);

    if ($("#cx-misrate")) $("#cx-misrate").textContent = `${mis}%`;
    if ($("#cx-success")) $("#cx-success").textContent = `${success}%`;
    if ($("#cx-co2")) $("#cx-co2").textContent = `${co2.toFixed(1)}kg`;
    if ($("#cx-life")) $("#cx-life").textContent = `+${life}일`;
    $("#cx-graph-line")?.setAttribute("points", graphPath(checked.length * 8 + (62 - mis) * 0.45));
  }

  function resetApp() {
    currentResult = null;
    currentFinalized = false;

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    $(".cx-app")?.classList.remove("has-preview", "has-result");
    $("#cx-preview-card")?.classList.remove("is-visible");
    $("#cx-preview")?.classList.remove("is-scanning");
    $("#cx-preview-img")?.removeAttribute("src");
    $("#cx-analysis-status")?.classList.remove("is-visible");

    const result = $("#cx-result");
    if (result) {
      result.classList.remove("is-visible");
      result.innerHTML = "";
    }

    const sim = $("#cx-sim");
    if (sim) {
      sim.classList.remove("is-visible");
      sim.innerHTML = "";
    }
  }

  function handleFile(file) {
    if (!file) return;

    currentFinalized = false;
    currentResult = null;

    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(file);

    const app = $(".cx-app");
    const previewCard = $("#cx-preview-card");
    const preview = $("#cx-preview");
    const img = $("#cx-preview-img");
    const status = $("#cx-analysis-status");
    const statusText = $("#cx-analysis-text");

    app?.classList.add("has-preview");
    app?.classList.remove("has-result");
    previewCard?.classList.add("is-visible");
    status?.classList.add("is-visible");
    preview?.classList.add("is-scanning");

    if (statusText) statusText.textContent = "이미지 분류 모델을 준비하는 중입니다...";
    if (img) {
      img.onload = async () => {
        try {
          if (statusText) statusText.textContent = "사진 속 물체를 실제 이미지 모델로 분류하는 중입니다...";
          currentResult = await classifyImageElement(img, file);
          if (statusText) statusText.textContent = "분리배출 기준 카드로 변환하는 중입니다...";

          window.setTimeout(() => {
            preview?.classList.remove("is-scanning");
            status?.classList.remove("is-visible");
            renderResult(currentResult);
            renderSimulator(false);
          }, 520);
        } catch {
          currentResult = fallbackInferByFilename(file);
          preview?.classList.remove("is-scanning");
          status?.classList.remove("is-visible");
          renderResult(currentResult);
          renderSimulator(false);
        }
      };
      img.src = currentObjectUrl;
    }

    session.today += 1;
    session.ai += 1;
    session.schoolObserved += 1;
    saveSession();
    applyCounterOffsets();
  }

  function getBaseValue(key, element) {
    if (!(key in baseCache)) baseCache[key] = parseNumber(element.textContent);
    return baseCache[key];
  }

  function findValueByLabel(labels) {
    const blocks = $$(".awx-stat, .aiw-kpi-tile, .class-main-kpi, .class-mini-kpis div");
    const target = blocks.find((block) => {
      const label = $(".awx-stat-label, span, .aiw-kpi-tile span", block);
      const text = normalize(label?.textContent);
      return labels.some((needle) => text.includes(needle));
    });

    return $(".awx-stat-value, b, .aiw-kpi-tile b", target);
  }

  function setDashboardNumber(key, offset, fallbackLabels = []) {
    if (!offset) return;
    const valueEl = document.querySelector(`[data-kpi="${key}"]`) || findValueByLabel(fallbackLabels);
    if (!valueEl) return;

    const next = getBaseValue(key, valueEl) + offset;
    valueEl.textContent = String(next);
    valueEl.dataset.target = String(next);

    try {
      metricValues[key] = next;
    } catch {
      /* metricValues belongs to script.js when available. */
    }
  }

  function applyCounterOffsets() {
    setDashboardNumber("today-observed", session.today, ["오늘 관찰"]);
    setDashboardNumber("ai-classified", session.ai, ["AI 분류", "AI 1차 분류"]);
    setDashboardNumber("human-confirmed", session.reconfirm, ["재확인", "학생 재확인"]);
    setDashboardNumber("class-hold", session.hold, ["판단 보류"]);
    setDashboardNumber("converted", session.converted, ["전환 사례"]);
    setDashboardNumber("school-observed", session.schoolObserved, ["배출 관찰"]);
  }

  function bindApp() {
    $("#cx-camera-btn")?.addEventListener("click", () => $("#cx-camera-input")?.click());
    $("#cx-gallery-btn")?.addEventListener("click", () => $("#cx-gallery-input")?.click());

    $("#cx-camera-input")?.addEventListener("change", (event) => {
      handleFile(event.target.files?.[0]);
      event.target.value = "";
    });
    $("#cx-gallery-input")?.addEventListener("change", (event) => {
      handleFile(event.target.files?.[0]);
      event.target.value = "";
    });
  }

  function installApp() {
    if (renderLock) return;

    const card = findRecordCard();
    if (!card) return;

    if ($(".cx-app", card)) {
      applyCounterOffsets();
      return;
    }

    renderLock = true;
    card.classList.add("awx-live-card", "cx-card-host");
    card.innerHTML = appTemplate();
    bindApp();
    applyCounterOffsets();
    renderLock = false;
  }

  function warmupModel() {
    const start = () => ensureModel().catch(() => undefined);
    if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 3500 });
    else window.setTimeout(start, 1200);
  }

  function boot() {
    installApp();
    warmupModel();

    const observer = new MutationObserver(() => {
      window.clearTimeout(window.__cxInstallTimer);
      window.__cxInstallTimer = window.setTimeout(installApp, 80);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    window.setInterval(() => {
      installApp();
      applyCounterOffsets();
    }, 420);
  }

  if (document.readyState !== "complete") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
