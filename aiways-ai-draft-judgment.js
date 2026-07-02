(() => {
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
      emoji: "🖊",
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
        "수업에서는 이런 사례가 좋은 토론 데이터가 됩니다."
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

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => (value || "").replace(/\s+/g, " ").trim();
  const handledEvents = new WeakSet();

  let modelPromise = null;
  let imageUrl = null;
  let lastDraft = null;
  let lastDraftAt = 0;
  let rendering = false;

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function findElements() {
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
        $("#aiways-final-progress-fill"),

      progress:
        $("#aiways-final-progress")
    };
  }

  function updateProgress(label, percent) {
    const els = findElements();
    if (els.step) els.step.textContent = label;
    if (els.percent) els.percent.textContent = `${percent}%`;
    if (els.fill) els.fill.style.width = `${percent}%`;
    if (els.progress) els.progress.classList.add("visible");
  }

  function markScanning(on) {
    const { photo } = findElements();
    if (!photo) return;
    photo.classList.toggle("scanning", on);
    photo.classList.toggle("scan", on);
    photo.classList.add("has-image", "visible");
  }

  function showLoading() {
    const { result } = findElements();
    if (!result) return;

    result.innerHTML = `
      <div class="aiways-draft-loading">
        <strong>AI 판단 초안 작성중</strong>
        <span>
          정답을 단정하지 않고, 물건 후보·재질 후보·사람이 확인할 질문을 먼저 정리합니다.
        </span>
      </div>
    `;
  }

  async function ensureModel() {
    if (modelPromise) return modelPromise;

    modelPromise = new Promise(async (resolve, reject) => {
      try {
        const startedAt = Date.now();
        while (!window.mobilenet && Date.now() - startedAt < 2600) {
          await new Promise(tick => setTimeout(tick, 120));
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

  function confidenceLevel(confidence, material) {
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
      updateProgress("기본 이미지 모델로 물체 후보 추정 중", 45);
      const model = await ensureModel();
      const predictions = await model.classify(img, 5);
      const best = predictions[0] || { className: "unknown", probability: 0 };
      const rawText = `${file?.name || ""} ${predictions.map(p => p.className).join(" ")}`;
      const material = materialFromText(rawText);
      const confidence = Math.max(35, Math.round((best.probability || 0.35) * 100));
      const risk = confidenceLevel(confidence, material);

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
      const risk = confidenceLevel(confidence, material);

      return {
        engine: "파일명·수업 규칙 기반",
        rawLabel: "이미지 모델 연결 전",
        confidence,
        material,
        risk,
        holdScore: holdScore(material, confidence, risk.mode),
        predictions: []
      };
    }
  }

  function predictionText(draft) {
    if (!draft.predictions?.length) return "후보 없음";
    return draft.predictions.map(p => `${escapeHtml(p.label)} ${p.probability}%`).join(" · ");
  }

  function badgeClass(mode) {
    if (mode === "hold") return "hold";
    if (mode === "recheck") return "warn";
    return "";
  }

  function listMarkup(items) {
    return `
      <ul class="aiways-draft-list">
        ${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    `;
  }

  function renderDraftCard(draft) {
    const { result } = findElements();
    if (!result || !draft) return;

    rendering = true;

    const material = draft.material;

    result.innerHTML = `
      <div class="aiways-draft-card">
        <div class="aiways-draft-header">
          <div>
            <h3>${material.emoji} ${escapeHtml(material.item)}</h3>
            <div class="aiways-draft-badges">
              <span class="aiways-draft-pill">${escapeHtml(draft.engine)}</span>
              <span class="aiways-draft-pill">신뢰도 ${draft.confidence}%</span>
              <span class="aiways-draft-pill ${badgeClass(draft.risk.mode)}">${escapeHtml(draft.risk.label)}</span>
            </div>
          </div>
        </div>

        <div class="aiways-draft-section">
          <div class="aiways-draft-section-title">AI가 먼저 정리한 판단 초안</div>
          <div class="aiways-draft-main-grid">
            <div class="aiways-draft-info">
              <small>물건 후보</small>
              <b>${escapeHtml(material.item)}</b>
            </div>
            <div class="aiways-draft-info">
              <small>재질 후보</small>
              <b>${escapeHtml(material.category)}</b>
            </div>
            <div class="aiways-draft-info">
              <small>배출 후보</small>
              <b>${escapeHtml(material.bin)}</b>
            </div>
          </div>
        </div>

        <div class="aiways-draft-section">
          <div class="aiways-draft-section-title">사진으로 보이는 특징</div>
          ${listMarkup(material.features)}
        </div>

        <div class="aiways-draft-section">
          <div class="aiways-draft-section-title">사람이 마지막으로 확인할 질문</div>
          ${listMarkup(material.questions)}
        </div>

        <div class="aiways-draft-guide">
          <strong>AI 원본 인식:</strong> ${escapeHtml(draft.rawLabel)}<br>
          <strong>후보:</strong> ${predictionText(draft)}<br>
          <strong>판단 메시지:</strong> ${escapeHtml(draft.risk.message)}<br>
          ${escapeHtml(material.guide)}
        </div>

        <div class="aiways-draft-section">
          <div class="aiways-draft-section-title">학생 최종 판단</div>
          <div class="aiways-draft-final-grid">
            ${FINAL_CHOICES.map(choice => `
              <button
                type="button"
                class="aiways-draft-choice ${choice === material.category ? "primary" : ""} ${choice === "판단 보류" ? "hold" : ""}"
                data-aiways-final-choice="${escapeHtml(choice)}"
              >
                ${escapeHtml(choice)}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    $$("[data-aiways-final-choice]", result).forEach(button => {
      button.addEventListener("click", () => {
        saveFinalChoice(draft, button.dataset.aiwaysFinalChoice);
        showSavedMessage(button.dataset.aiwaysFinalChoice);
      });
    });

    window.setTimeout(() => {
      rendering = false;
    }, 80);
  }

  function getClassName() {
    const select =
      $("#aiways-master-class-select") ||
      $("#aiways-app-class-select") ||
      $("#aiways-class-select") ||
      $("#tune-class-select") ||
      $("#op-class-select");

    return select?.value || localStorage.getItem("aiways_selected_class") || "5학년 1반";
  }

  function gradeOfClass(className) {
    const matched = String(className).match(/([3-6])학년/);
    return matched ? `${matched[1]}학년` : "5학년";
  }

  function sessionId() {
    let id = localStorage.getItem("aiways_session_id");
    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("aiways_session_id", id);
    }
    return id;
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

  function saveFinalChoice(draft, finalChoice) {
    const className = getClassName();
    const material = draft.material;
    const holdFlag = finalChoice === "판단 보류";

    const record = {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      privacy_id: sessionId(),
      school: "우리학교",
      grade: gradeOfClass(className),
      class_name: className,
      group_id: "미지정",
      input_type: "image",
      ai_engine: "AI 판단 초안",
      ai_raw_label: draft.rawLabel,
      ai_confidence: draft.confidence,
      mapped_item: material.item,
      suggested_category: material.category,
      final_decision: finalChoice,
      hold_flag: holdFlag,
      hold_score: draft.holdScore,
      hold_reason: holdFlag ? "학생 최종 판단에서 보류 선택" : "",
      contamination_check: "사람 최종 확인 질문 기반",
      action: holdFlag ? "판단 보류함 등록" : "학생 판단 완료",
      image_saved: false,
      carbon_saved: holdFlag ? 0 : material.carbon,
      app_version: "aiways-ai-draft-judgment-v1"
    };

    const list = records();
    list.unshift(record);
    saveRecords(list);
    window.dispatchEvent(new CustomEvent("aiways-record-updated", { detail: record }));
  }

  function showSavedMessage(finalChoice) {
    const { result } = findElements();
    if (!result) return;

    $(".aiways-draft-saved", result)?.remove();
    result.insertAdjacentHTML("beforeend", `
      <div class="aiways-draft-saved">
        최종 판단: ${escapeHtml(finalChoice)} · 대시보드에 기록했습니다.<br>
        사진은 저장하지 않고 판단 데이터만 남깁니다.
      </div>
    `);
  }

  async function handleFile(file) {
    if (!file) return;

    const els = findElements();

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);

    if (els.img) {
      els.img.src = imageUrl;
      els.img.style.display = "block";
    }

    if (els.photo) {
      els.photo.classList.add("has-image", "visible");
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

    updateProgress("이미지 전처리 중", 25);

    const draft = await classifyImage(img, file);

    updateProgress("사람이 확인할 질문 생성 중", 70);

    window.setTimeout(() => {
      updateProgress("학생 최종 판단 카드 생성 완료", 100);
      markScanning(false);
      lastDraft = draft;
      lastDraftAt = Date.now();
      renderDraftCard(draft);
    }, 420);
  }

  function isAiwaysFileInput(input) {
    if (!input || input.type !== "file") return false;

    return Boolean(
      input.closest("#aiways-full-app-v3") ||
      input.closest(".aiways-full-app-section") ||
      input.closest(".aiways-mini-app") ||
      input.closest(".op-mini") ||
      input.closest(".op-card-inner") ||
      input.id.includes("aiways") ||
      input.id.includes("tune") ||
      input.id.includes("op-")
    );
  }

  function onGlobalFileChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!isAiwaysFileInput(input)) return;

    const file = input.files?.[0];
    if (!file) return;
    if (handledEvents.has(event)) return;

    handledEvents.add(event);
    event.preventDefault();
    event.stopImmediatePropagation();
    handleFile(file);
  }

  function protectDraftCard() {
    const result = findElements().result;
    if (!result || !lastDraft) return;
    if (Date.now() - lastDraftAt > 15000) return;
    if (rendering) return;

    if (!result.querySelector(".aiways-draft-card")) {
      renderDraftCard(lastDraft);
    }
  }

  function boot() {
    document.addEventListener("change", onGlobalFileChange, true);

    const observer = new MutationObserver(protectDraftCard);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      protectDraftCard();
      if (tries >= 16) window.clearInterval(timer);
    }, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
