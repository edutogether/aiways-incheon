(() => {
  const TM_URL_KEY = "aiways_teachable_machine_model_url";
  const TM_LABELS_KEY = "aiways_teachable_machine_labels";

  const CLASS_DATA = {
    "3학년 1반": { grade: "3학년" },
    "3학년 2반": { grade: "3학년" },
    "3학년 3반": { grade: "3학년" },
    "4학년 1반": { grade: "4학년" },
    "4학년 2반": { grade: "4학년" },
    "4학년 3반": { grade: "4학년" },
    "4학년 4반": { grade: "4학년" },
    "5학년 1반": { grade: "5학년" },
    "5학년 2반": { grade: "5학년" },
    "5학년 3반": { grade: "5학년" },
    "5학년 4반": { grade: "5학년" },
    "6학년 1반": { grade: "6학년" },
    "6학년 2반": { grade: "6학년" },
    "6학년 3반": { grade: "6학년" }
  };

  const MATERIALS = {
    plastic: {
      key: "plastic",
      emoji: "🥤",
      item: "플라스틱 컵·페트병",
      category: "플라스틱류",
      bin: "플라스틱 배출함",
      guide: "남은 내용물을 비우고, 가능하면 헹군 뒤 라벨·뚜껑·빨대를 분리해 배출합니다.",
      holdBase: 30,
      carbon: 32.5
    },
    paperpack: {
      key: "paperpack",
      emoji: "🥛",
      item: "우유갑·종이팩",
      category: "종이팩",
      bin: "종이팩 전용 수거함",
      guide: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 종이팩 전용 수거함에 배출합니다.",
      holdBase: 24,
      carbon: 25
    },
    paper: {
      key: "paper",
      emoji: "📄",
      item: "깨끗한 종이·종이상자",
      category: "종이류",
      bin: "종이류 배출함",
      guide: "물기와 음식물이 묻지 않았다면 펼쳐서 종이류로 배출합니다. 테이프와 비닐은 가능한 한 제거합니다.",
      holdBase: 22,
      carbon: 15
    },
    can: {
      key: "can",
      emoji: "🥫",
      item: "캔",
      category: "캔류",
      bin: "캔류 배출함",
      guide: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다. 이물질이 들어 있으면 먼저 제거합니다.",
      holdBase: 18,
      carbon: 38
    },
    vinyl: {
      key: "vinyl",
      emoji: "🍿",
      item: "과자봉지·비닐",
      category: "비닐류 또는 재확인",
      bin: "비닐류 배출함 / 판단 보류함",
      guide: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다. 기름기나 양념이 많으면 판단 보류합니다.",
      holdBase: 58,
      carbon: 12
    },
    contaminated: {
      key: "contaminated",
      emoji: "🧃",
      item: "오염된 용기",
      category: "일반쓰레기 또는 판단 보류",
      bin: "일반쓰레기 / 판단 보류함",
      guide: "음식물이나 국물 자국이 심하면 재활용이 어려울 수 있습니다. 씻겨지는지 확인한 뒤 사람이 최종 판단합니다.",
      holdBase: 72,
      carbon: 3
    },
    receipt: {
      key: "receipt",
      emoji: "🧾",
      item: "영수증·코팅종이",
      category: "일반쓰레기",
      bin: "일반쓰레기",
      guide: "감열지 영수증과 코팅된 종이는 일반 종이류와 섞지 않고 일반쓰레기로 배출하는 것이 안전합니다.",
      holdBase: 34,
      carbon: 4.5
    },
    complex: {
      key: "complex",
      emoji: "🖊️",
      item: "볼펜·복합재질",
      category: "판단 보류",
      bin: "판단 보류함",
      guide: "여러 재질이 섞인 소형 물건은 재활용 판단이 어렵습니다. 바로 버리지 말고 판단 보류함에 등록합니다.",
      holdBase: 78,
      carbon: 0
    },
    hold: {
      key: "hold",
      emoji: "🤔",
      item: "기타·판단 보류",
      category: "판단 보류",
      bin: "판단 보류함",
      guide: "학습 데이터 밖이거나 재질이 애매한 물건입니다. AI가 단정하지 않고 사람이 최종 판단하도록 보류합니다.",
      holdBase: 92,
      carbon: 0
    }
  };

  const LABEL_RULES = [
    { key: "plastic", words: ["플라스틱", "페트", "pet", "plastic", "cup", "bottle", "container", "컵", "생수", "병"] },
    { key: "paperpack", words: ["우유", "종이팩", "팩", "milk", "carton", "paperpack", "paper pack"] },
    { key: "paper", words: ["종이류", "깨끗한 종이", "종이", "paper", "box", "cardboard", "book", "notebook", "상자"] },
    { key: "can", words: ["캔", "can", "aluminum", "tin", "soda"] },
    { key: "vinyl", words: ["비닐", "봉지", "과자", "wrapper", "bag", "packet", "snack", "vinyl"] },
    { key: "contaminated", words: ["오염", "오염된", "더러운", "국물", "contaminated", "dirty", "stained"] },
    { key: "receipt", words: ["영수증", "코팅", "receipt", "thermal"] },
    { key: "complex", words: ["볼펜", "펜", "복합", "학용품", "pen", "ballpoint", "marker", "pencil", "complex"] },
    { key: "hold", words: ["기타", "애매", "판단", "보류", "other", "unknown", "hold", "etc", "misc"] }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => (value || "").replace(/\s+/g, " ").trim();

  let tmModelPromise = null;
  let mobileNetPromise = null;
  let imageUrl = null;
  let lastResult = null;
  let observerStarted = false;

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeModelUrl(input) {
    let url = clean(input);
    if (!url) return "";
    url = url.replace(/\/?model\.json(\?.*)?$/i, "/");
    url = url.replace(/\/?metadata\.json(\?.*)?$/i, "/");
    if (!url.endsWith("/")) url += "/";
    return url;
  }

  function getModelUrl() {
    return normalizeModelUrl(localStorage.getItem(TM_URL_KEY) || "");
  }

  function setModelUrl(value) {
    const normalized = normalizeModelUrl(value);
    localStorage.setItem(TM_URL_KEY, normalized);
    tmModelPromise = null;
    return normalized;
  }

  function clearModelUrl() {
    localStorage.removeItem(TM_URL_KEY);
    localStorage.removeItem(TM_LABELS_KEY);
    tmModelPromise = null;
  }

  function modelModeLabel() {
    return getModelUrl() ? "우리반 학습 모델 우선" : "기본 이미지 모델";
  }

  function findMiniAppRoot() {
    return (
      $("#aiways-master-camera-btn")?.closest(".aiways-mini-app") ||
      $("#aiways-master-camera-btn")?.closest(".aiways-master-inner") ||
      $("#aiways-camera-button")?.closest(".aiways-full-app-wrap") ||
      $("#aiways-camera-button")?.closest(".op-mini") ||
      $("#aiways-camera-button")?.closest(".op-card-inner") ||
      $("#aiways-full-app-v3") ||
      Array.from(document.querySelectorAll("section, article, div")).find(el => {
        const t = clean(el.textContent);
        const rect = el.getBoundingClientRect();
        return rect.width > 260
          && rect.height > 180
          && t.includes("버려지는 순간을 기록하세요")
          && (t.includes("3-Second") || t.includes("AI분류"));
      })
    );
  }

  function installModelPanel() {
    const root = findMiniAppRoot();
    if (!root || $("#aiways-tm-panel", root)) return;

    const buttonArea =
      $(".aiways-capture-grid", root) ||
      $(".aiways-mini-buttons", root) ||
      $(".tune-mini-body", root) ||
      $(".op-picker-grid", root);

    if (!buttonArea) return;

    const panel = document.createElement("div");
    panel.id = "aiways-tm-panel";
    panel.className = "aiways-tm-panel";
    panel.innerHTML = `
      <div class="aiways-tm-panel-head">
        <div class="aiways-tm-panel-title">우리반 AI 학습 모델 연결</div>
        <div class="aiways-tm-panel-badge" id="aiways-tm-badge">${modelModeLabel()}</div>
      </div>

      <div class="aiways-tm-row">
        <input
          id="aiways-tm-url"
          class="aiways-tm-input"
          placeholder="Teachable Machine 모델 URL 붙여넣기"
          value="${escapeHtml(getModelUrl())}"
        >
        <button type="button" class="aiways-tm-btn" id="aiways-tm-save">모델 연결</button>
        <button type="button" class="aiways-tm-btn ghost" id="aiways-tm-clear">초기화</button>
      </div>

      <div class="aiways-tm-help">
        수업용 권장 클래스:
        <strong>플라스틱류 / 종이팩 / 종이류 / 캔류 / 비닐류 / 기타·판단보류</strong>.
        학생 사진 100장은 Teachable Machine에서 학습한 뒤, 모델 URL만 여기에 붙이면 됩니다.
        <a class="aiways-tm-open" href="https://teachablemachine.withgoogle.com/train/image" target="_blank" rel="noopener noreferrer">Teachable Machine 열기</a>
      </div>

      <div class="aiways-tm-status" id="aiways-tm-status">
        ${getModelUrl() ? "저장된 우리반 모델 URL이 있습니다. 사진을 넣으면 이 모델을 우선 사용합니다." : "모델 URL이 없으면 기본 MobileNet으로 1차 판단합니다."}
      </div>
    `;

    buttonArea.insertAdjacentElement("beforebegin", panel);

    $("#aiways-tm-save", panel)?.addEventListener("click", async () => {
      const input = $("#aiways-tm-url", panel);
      const status = $("#aiways-tm-status", panel);
      const badge = $("#aiways-tm-badge", panel);
      const url = setModelUrl(input.value);

      if (!url) {
        status.textContent = "모델 URL이 비어 있습니다. 기본 이미지 모델로 판단합니다.";
        badge.textContent = modelModeLabel();
        return;
      }

      input.value = url;
      status.textContent = "우리반 AI 모델을 불러오는 중입니다...";
      badge.textContent = "모델 로딩 중";

      try {
        await ensureTeachableModel();
        status.textContent = "우리반 학습 모델 연결 완료. 이제 사진 분류에 우선 사용합니다.";
        badge.textContent = modelModeLabel();
      } catch {
        status.textContent = "모델을 불러오지 못했습니다. URL을 확인하세요. 기본 이미지 모델로 대체합니다.";
        badge.textContent = "연결 실패";
      }
    });

    $("#aiways-tm-clear", panel)?.addEventListener("click", () => {
      clearModelUrl();
      $("#aiways-tm-url", panel).value = "";
      $("#aiways-tm-status", panel).textContent = "모델 연결을 초기화했습니다. 기본 이미지 모델로 판단합니다.";
      $("#aiways-tm-badge", panel).textContent = modelModeLabel();
    });
  }

  async function ensureTeachableModel() {
    const baseUrl = getModelUrl();
    if (!baseUrl) return null;
    if (tmModelPromise) return tmModelPromise;

    tmModelPromise = new Promise(async (resolve, reject) => {
      try {
        const startedAt = Date.now();
        while (!window.tmImage && Date.now() - startedAt < 9000) {
          await new Promise(tick => setTimeout(tick, 120));
        }

        if (!window.tmImage) throw new Error("tmImage unavailable");

        const model = await window.tmImage.load(
          baseUrl + "model.json",
          baseUrl + "metadata.json"
        );

        try {
          const labels = model.getClassLabels ? model.getClassLabels() : [];
          localStorage.setItem(TM_LABELS_KEY, JSON.stringify(labels));
        } catch {}

        resolve(model);
      } catch (error) {
        tmModelPromise = null;
        reject(error);
      }
    });

    return tmModelPromise;
  }

  async function ensureMobileNet() {
    if (mobileNetPromise) return mobileNetPromise;

    mobileNetPromise = new Promise(async (resolve, reject) => {
      try {
        const startedAt = Date.now();
        while (!window.mobilenet && Date.now() - startedAt < 9000) {
          await new Promise(tick => setTimeout(tick, 120));
        }

        if (!window.mobilenet) throw new Error("mobilenet unavailable");

        const model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
        resolve(model);
      } catch (error) {
        mobileNetPromise = null;
        reject(error);
      }
    });

    return mobileNetPromise;
  }

  function materialFromLabel(label) {
    const value = clean(label).toLowerCase();

    for (const rule of LABEL_RULES) {
      if (rule.words.some(word => value.includes(word.toLowerCase()))) {
        return MATERIALS[rule.key];
      }
    }

    return MATERIALS.hold;
  }

  function judgeRisk(material, confidence, secondGap) {
    let mode = "confirm";
    let message = "AI 1차 판단 결과입니다. 학생이 오염·코팅·복합재질 여부를 최종 확인하세요.";

    if (material.key === "hold" || material.key === "complex") {
      mode = "hold";
      message = "학습 범위 밖이거나 복합재질 가능성이 있어 판단 보류를 권장합니다.";
    } else if (confidence < 60) {
      mode = "hold";
      message = "AI 확신도가 낮아 판단 보류를 권장합니다.";
    } else if (confidence < 80 || secondGap < 14 || material.key === "vinyl" || material.key === "contaminated") {
      mode = "recheck";
      message = "AI가 후보를 찾았지만 사람이 다시 확인해야 합니다. 오염·코팅·복합재질 여부를 봐주세요.";
    }

    return { mode, message };
  }

  function holdScore(material, confidence, riskMode) {
    let score = material.holdBase || 50;
    if (confidence < 80) score += 10;
    if (confidence < 60) score += 20;
    if (confidence < 45) score += 15;
    if (riskMode === "recheck") score += 10;
    if (riskMode === "hold") score += 25;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async function classifyWithTeachable(img) {
    const model = await ensureTeachableModel();
    if (!model) return null;

    const predictions = await model.predict(img, false);
    predictions.sort((a, b) => b.probability - a.probability);

    const best = predictions[0] || { className: "기타·판단보류", probability: 0 };
    const second = predictions[1] || { probability: 0 };
    const confidence = Math.round(best.probability * 100);
    const secondGap = Math.round((best.probability - second.probability) * 100);
    const material = materialFromLabel(best.className);
    const risk = judgeRisk(material, confidence, secondGap);

    return {
      engine: "우리반 학습 모델",
      rawLabel: best.className,
      confidence,
      secondGap,
      material,
      riskMode: risk.mode,
      riskMessage: risk.message,
      predictions: predictions.slice(0, 4)
    };
  }

  async function classifyWithMobileNet(img, file) {
    try {
      const model = await ensureMobileNet();
      const predictions = await model.classify(img, 5);
      const best = predictions[0] || { className: "unknown", probability: 0 };
      const second = predictions[1] || { probability: 0 };
      const combined = `${file?.name || ""} ${predictions.map(p => p.className).join(" ")}`;
      const material = materialFromLabel(combined);
      const confidence = Math.max(35, Math.round(best.probability * 100));
      const secondGap = Math.round((best.probability - second.probability) * 100);
      const risk = judgeRisk(material, confidence, secondGap);

      return {
        engine: "기본 이미지 모델",
        rawLabel: best.className,
        confidence,
        secondGap,
        material,
        riskMode: risk.mode,
        riskMessage: risk.message,
        predictions: predictions.map(p => ({
          className: p.className,
          probability: p.probability
        })).slice(0, 4)
      };
    } catch {
      const material = materialFromLabel(file?.name || "unknown");
      return {
        engine: "수업 규칙 기반 판단",
        rawLabel: "이미지 모델 연결 실패",
        confidence: 42,
        secondGap: 0,
        material,
        riskMode: "hold",
        riskMessage: "이미지 모델을 불러오지 못했습니다. 사람이 최종 판단하도록 보류합니다.",
        predictions: []
      };
    }
  }

  function findPreviewElements() {
    return {
      img:
        $("#aiways-master-img") ||
        $("#aiways-preview-img") ||
        $("#tune-preview-img") ||
        $("#op-preview-img"),

      photo:
        $("#aiways-master-photo") ||
        $("#aiways-photo-frame") ||
        $("#tune-photo") ||
        $("#op-photo"),

      result:
        $("#aiways-master-result") ||
        $("#aiways-result-area") ||
        $("#tune-result-area") ||
        $("#op-photo-result") ||
        $("#op-judge-result"),

      step:
        $("#aiways-master-step") ||
        $("#aiways-final-progress-step") ||
        $("#aiways-status-text") ||
        $("#tune-status-text") ||
        $("#op-status-text"),

      percent:
        $("#aiways-master-percent") ||
        $("#aiways-final-progress-percent"),

      fill:
        $("#aiways-master-fill") ||
        $("#aiways-final-progress-fill") ||
        $("#aiways-quiz-bar") ||
        $("#op-quiz-bar"),

      progress:
        $("#aiways-final-progress")
    };
  }

  function updateProgress(label, percent) {
    const els = findPreviewElements();
    if (els.step) els.step.textContent = label;
    if (els.percent) els.percent.textContent = `${percent}%`;
    if (els.fill) els.fill.style.width = `${percent}%`;
    if (els.progress) els.progress.classList.add("visible");
  }

  function markScanning(on) {
    const { photo } = findPreviewElements();
    if (!photo) return;
    photo.classList.toggle("scanning", on);
    photo.classList.toggle("scan", on);
  }

  function showLoading() {
    const { result } = findPreviewElements();
    if (!result) return;

    result.innerHTML = `
      <div class="aiways-tm-loading">
        <strong class="aiways-tm-loading-title">AI분류 진행중</strong>
        <span class="aiways-tm-loading-sub">
          ${getModelUrl() ? "우리반이 학습시킨 모델로 물체를 분석하고 있습니다." : "기본 이미지 모델로 물체를 1차 추정하고 있습니다."}
        </span>
      </div>
    `;
  }

  function topPredictionText(result) {
    if (!result.predictions?.length) return "후보 없음";
    return result.predictions
      .map(p => `${escapeHtml(p.className)} ${Math.round(p.probability * 100)}%`)
      .join(" · ");
  }

  function riskBadgeClass(mode) {
    if (mode === "hold") return "hold";
    if (mode === "recheck") return "warn";
    return "";
  }

  function riskBadgeText(mode) {
    if (mode === "hold") return "판단 보류 권장";
    if (mode === "recheck") return "사람 재확인 필요";
    return "AI 1차 판단";
  }

  function showResult(result) {
    const { result: box } = findPreviewElements();
    if (!box) return;

    const material = result.material;
    const score = holdScore(material, result.confidence, result.riskMode);

    lastResult = {
      ...result,
      holdScore: score
    };

    box.innerHTML = `
      <div class="aiways-tm-result-card">
        <h3>${material.emoji} ${escapeHtml(material.item)}</h3>

        <div class="aiways-tm-result-badges">
          <span class="aiways-tm-pill">${escapeHtml(result.engine)}</span>
          <span class="aiways-tm-pill">신뢰도 ${result.confidence}%</span>
          <span class="aiways-tm-pill ${riskBadgeClass(result.riskMode)}">${riskBadgeText(result.riskMode)}</span>
        </div>

        <div class="aiways-tm-info-grid">
          <div class="aiways-tm-info">
            <small>분류</small>
            <b>${escapeHtml(material.category)}</b>
          </div>

          <div class="aiways-tm-info">
            <small>배출 위치</small>
            <b>${escapeHtml(material.bin)}</b>
          </div>

          <div class="aiways-tm-info">
            <small>보류 권장</small>
            <b>${score}%</b>
          </div>
        </div>

        <div class="aiways-tm-guide">
          <strong>AI 원본 인식:</strong> ${escapeHtml(result.rawLabel)}<br>
          <strong>후보:</strong> ${topPredictionText(result)}<br>
          ${escapeHtml(material.guide)}<br>
          <strong>판단 메시지:</strong> ${escapeHtml(result.riskMessage)}
        </div>

        <div class="aiways-tm-actions">
          <button type="button" class="aiways-tm-action primary" id="aiways-tm-confirm">학생 판단 완료</button>
          <button type="button" class="aiways-tm-action secondary" id="aiways-tm-hold">판단 보류 등록</button>
        </div>
      </div>
    `;

    $("#aiways-tm-confirm")?.addEventListener("click", () => {
      saveResult(false);
      markSaved("학생 판단 완료 · 대시보드에 반영했습니다.");
    });

    $("#aiways-tm-hold")?.addEventListener("click", () => {
      saveResult(true);
      markSaved("판단 보류 등록 · 헷갈린 물건 데이터에 반영했습니다.");
    });
  }

  function currentClassName() {
    const select =
      $("#aiways-master-class-select") ||
      $("#aiways-app-class-select") ||
      $("#aiways-class-select") ||
      $("#tune-class-select") ||
      $("#op-class-select");

    const selected = select?.value || localStorage.getItem("aiways_selected_class") || "5학년 1반";
    return CLASS_DATA[selected] ? selected : "5학년 1반";
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

  function sessionId() {
    let id = localStorage.getItem("aiways_session_id");
    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("aiways_session_id", id);
    }
    return id;
  }

  function saveResult(forceHold) {
    if (!lastResult) return;

    const className = currentClassName();
    const grade = CLASS_DATA[className]?.grade || "5학년";
    const material = lastResult.material;
    const shouldHold = forceHold || lastResult.riskMode === "hold";

    const record = {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      privacy_id: sessionId(),
      school: "우리학교",
      grade,
      class_name: className,
      group_id: "미지정",
      input_type: "image",
      ai_engine: lastResult.engine,
      ai_raw_label: lastResult.rawLabel,
      ai_confidence: lastResult.confidence,
      mapped_item: material.item,
      suggested_category: material.category,
      final_decision: shouldHold ? "판단 보류" : material.category,
      hold_flag: shouldHold,
      hold_score: lastResult.holdScore,
      hold_reason: shouldHold ? "AI 확신도·오염·코팅·복합재질 가능성으로 보류" : "",
      contamination_check: "사람 최종 확인 필요",
      action: shouldHold ? "판단 보류함 등록" : "학생 판단 완료",
      image_saved: false,
      carbon_saved: shouldHold ? 0 : material.carbon,
      app_version: "aiways-teachable-classroom-bridge-v1"
    };

    const list = records();
    list.unshift(record);
    saveRecords(list);
    window.dispatchEvent(new CustomEvent("aiways-record-updated", { detail: record }));
  }

  function markSaved(message) {
    const guide = $(".aiways-tm-guide");
    if (!guide) return;

    guide.innerHTML = `
      <strong>${escapeHtml(message)}</strong><br>
      사진은 저장하지 않고, 학년·반·AI결과·학생 최종판단 데이터만 기록했습니다.
    `;
  }

  async function handleFile(file) {
    if (!file) return;

    const els = findPreviewElements();

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);

    if (els.img) {
      els.img.src = imageUrl;
      els.img.style.display = "block";
    }

    if (els.photo) {
      els.photo.classList.add("has-image");
      els.photo.classList.add("visible");
    }

    showLoading();
    markScanning(true);
    updateProgress("사진 불러오는 중", 12);

    const img = els.img || new Image();
    if (!els.img) img.src = imageUrl;

    await new Promise(resolve => {
      if (img.complete) resolve();
      else img.onload = resolve;
    });

    updateProgress("이미지 전처리 중", 24);

    let result = null;

    if (getModelUrl()) {
      try {
        updateProgress("우리반 학습 모델로 분석 중", 48);
        result = await classifyWithTeachable(img);
      } catch {
        updateProgress("우리반 모델 실패 · 기본 모델로 대체 중", 48);
      }
    }

    if (!result) {
      updateProgress("기본 이미지 모델로 1차 추정 중", 56);
      result = await classifyWithMobileNet(img, file);
    }

    updateProgress("분리배출 규칙으로 보정 중", 82);

    window.setTimeout(() => {
      updateProgress("학생 최종 판단 카드 생성 완료", 100);
      markScanning(false);
      showResult(result);
    }, 420);
  }

  function bindFileInputs() {
    [
      "#aiways-master-camera-input",
      "#aiways-master-gallery-input",
      "#aiways-camera-input",
      "#aiways-gallery-input",
      "#tune-camera-input",
      "#tune-gallery-input",
      "#op-camera-input",
      "#op-gallery-input"
    ].forEach(selector => {
      const input = $(selector);
      if (!input || input.dataset.aiwaysTmBound === "1") return;

      input.dataset.aiwaysTmBound = "1";
      input.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (!file) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        handleFile(file);
      }, true);
    });
  }

  function bindVisibleButtons() {
    [
      ["#aiways-master-camera-btn", "#aiways-master-camera-input"],
      ["#aiways-master-gallery-btn", "#aiways-master-gallery-input"],
      ["#aiways-camera-button", "#aiways-camera-input"],
      ["#aiways-gallery-button", "#aiways-gallery-input"],
      ["#tune-camera-button", "#tune-camera-input"],
      ["#tune-gallery-button", "#tune-gallery-input"],
      ["#op-camera-button", "#op-camera-input"],
      ["#op-gallery-button", "#op-gallery-input"]
    ].forEach(([buttonSelector, inputSelector]) => {
      const button = $(buttonSelector);
      const input = $(inputSelector);
      if (!button || !input || button.dataset.aiwaysTmClickBound === "1") return;

      button.dataset.aiwaysTmClickBound = "1";
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        input.click();
      }, true);
    });
  }

  function bindSearchFallback() {
    ["#aiways-search-input", "#op-search-input"].forEach(selector => {
      const input = $(selector);
      if (!input || input.dataset.aiwaysTmSearchBound === "1") return;

      input.dataset.aiwaysTmSearchBound = "1";
      input.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;

        const material = materialFromLabel(input.value);
        const risk = judgeRisk(material, 88, 30);

        lastResult = {
          engine: "검색 규칙",
          rawLabel: input.value,
          confidence: 88,
          secondGap: 30,
          material,
          riskMode: risk.mode,
          riskMessage: risk.message,
          predictions: []
        };

        showResult(lastResult);
      }, true);
    });
  }

  function boot() {
    installModelPanel();
    bindFileInputs();
    bindVisibleButtons();
    bindSearchFallback();

    if (!observerStarted) {
      observerStarted = true;
      const observer = new MutationObserver(() => {
        installModelPanel();
        bindFileInputs();
        bindVisibleButtons();
        bindSearchFallback();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      installModelPanel();
      bindFileInputs();
      bindVisibleButtons();
      bindSearchFallback();
      if (tries >= 12) window.clearInterval(timer);
    }, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
