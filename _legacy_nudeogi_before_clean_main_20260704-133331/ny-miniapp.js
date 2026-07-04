(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const trashDb = {
    "우유갑": {
      aliases: ["우유", "milk", "carton", "팩", "종이팩"],
      name: "우유갑",
      icon: "🥛",
      category: "종이팩",
      bin: "종이팩 전용 수거함",
      guide: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 배출합니다.",
      tip: "일반 종이류와 섞이면 재활용 공정이 달라 품질이 떨어집니다.",
      carbon: 25,
      hold: false,
    },
    "종이류": {
      aliases: ["종이", "paper", "book", "notebook", "프린트", "활동지", "envelope"],
      name: "깨끗한 종이류",
      icon: "📄",
      category: "종이류",
      bin: "종이류 배출함",
      guide: "물기와 음식물이 묻지 않았다면 펼쳐서 종이류로 배출합니다.",
      tip: "테이프, 코팅, 스프링, 비닐은 가능한 한 제거합니다.",
      carbon: 15,
      hold: false,
    },
    "플라스틱 컵": {
      aliases: ["컵", "plastic", "cup", "bottle", "container", "페트", "생수병", "water"],
      name: "플라스틱 컵",
      icon: "🥤",
      category: "플라스틱류",
      bin: "플라스틱 배출함",
      guide: "남은 음료를 비우고 빨대, 뚜껑, 라벨을 분리한 뒤 배출합니다.",
      tip: "오염이 심하면 재활용이 어려울 수 있어 먼저 헹군 뒤 판단합니다.",
      carbon: 32.5,
      hold: false,
    },
    "과자 봉지": {
      aliases: ["과자", "봉지", "비닐", "snack", "wrapper", "bag", "packet", "pouch"],
      name: "과자 봉지",
      icon: "🍿",
      category: "비닐류 또는 판단 보류",
      bin: "비닐류 배출함 / 판단 보류함",
      guide: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다.",
      tip: "기름기와 양념이 많이 묻어 있으면 일반쓰레기 또는 보류 판단이 필요합니다.",
      carbon: 12,
      hold: false,
    },
    "컵라면 용기": {
      aliases: ["라면", "컵라면", "스티로폼", "noodle", "ramen"],
      name: "컵라면 용기",
      icon: "🍜",
      category: "일반쓰레기 검토",
      bin: "일반쓰레기 / 스티로폼 기준 확인",
      guide: "국물 자국이 씻기지 않는 용기는 일반쓰레기로 배출합니다.",
      tip: "오염이 전혀 없고 깨끗한 스티로폼만 남은 경우에는 학교 기준에 따라 분리합니다.",
      carbon: 5,
      hold: false,
    },
    "캔류": {
      aliases: ["캔", "can", "tin", "aluminum", "soda"],
      name: "캔류",
      icon: "🥫",
      category: "캔류",
      bin: "캔류 배출함",
      guide: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다.",
      tip: "담배꽁초나 이물질이 들어 있으면 먼저 제거해야 합니다.",
      carbon: 38,
      hold: false,
    },
    "영수증": {
      aliases: ["영수증", "receipt"],
      name: "영수증",
      icon: "🧾",
      category: "일반쓰레기",
      bin: "일반쓰레기",
      guide: "감열지 영수증은 특수 코팅이 되어 있어 일반쓰레기로 배출합니다.",
      tip: "종이처럼 보여도 재활용 종이류와 섞지 않는 것이 좋습니다.",
      carbon: 3,
      hold: false,
    },
    "볼펜": {
      aliases: ["볼펜", "펜", "pen", "ballpoint", "pencil", "stationery"],
      name: "볼펜 / 학용품",
      icon: "🖊️",
      category: "복합재질",
      bin: "판단 보류함",
      guide: "여러 재질이 섞인 학용품은 바로 재활용하지 않고 보류함에 등록합니다.",
      tip: "분리 가능한 부품이 있는지 확인한 뒤 학교 기준으로 다시 판단합니다.",
      carbon: 4,
      hold: true,
    },
    "판단 보류 물건": {
      aliases: ["unknown", "misc", "object", "thing"],
      name: "판단 보류 물건",
      icon: "🤔",
      category: "판단 보류",
      bin: "판단 보류함",
      guide: "정확히 모르겠다면 아무 데나 버리지 말고 보류함에 등록합니다.",
      tip: "모르는 물건을 멈춰 세우는 것도 자원순환 역량입니다.",
      carbon: 1,
      hold: true,
    },
  };

  const quizData = [
    {
      emoji: "🧾",
      q: "영수증은 깨끗하니까 종이류로 배출한다.",
      a: false,
      e: "영수증은 감열지인 경우가 많아 일반쓰레기로 판단하는 것이 안전합니다.",
    },
    {
      emoji: "🥛",
      q: "우유갑은 비우고 헹군 뒤 말려서 종이팩으로 분리한다.",
      a: true,
      e: "종이팩은 일반 종이와 공정이 달라 전용 수거함에 넣는 것이 좋습니다.",
    },
    {
      emoji: "🍿",
      q: "기름이 많이 묻은 과자봉지는 무조건 비닐류로 넣는다.",
      a: false,
      e: "오염이 심하면 재활용 품질이 떨어져 일반쓰레기 또는 보류 판단이 필요합니다.",
    },
    {
      emoji: "🤔",
      q: "헷갈리는 물건을 보류함에 넣는 것도 자원순환 행동이다.",
      a: true,
      e: "잘못 버리는 것보다 잠깐 멈추고 함께 확인하는 편이 더 좋은 선택입니다.",
    },
    {
      emoji: "🥤",
      q: "플라스틱 컵은 내용물을 비우고 가능한 부분을 분리한 뒤 배출한다.",
      a: true,
      e: "내용물, 빨대, 뚜껑, 라벨을 확인하면 재활용 성공률이 높아집니다.",
    },
  ];

  const simEffects = {
    quick: { name: "3초 판단", effect: "오배출 감소", mis: -5, success: 5, co2: 0.7, life: 5 },
    hold: { name: "보류함", effect: "즉시 멈춤", mis: -4, success: 3, co2: 0.5, life: 4 },
    guide: { name: "가이드선", effect: "성공률 증가", mis: -3, success: 6, co2: 0.4, life: 3 },
    quiz: { name: "퀴즈", effect: "참여 증가", mis: -2, success: 4, co2: 0.3, life: 2 },
    rank: { name: "랭킹", effect: "동기 강화", mis: -2, success: 3, co2: 0.2, life: 2 },
  };

  const storageKeys = {
    stats: "aiways_ny_stats",
    holds: "aiways_ny_holds",
  };

  const baseCache = {};
  const addCache = {};
  let modelPromise = null;
  let objectUrl = null;
  let currentQuiz = 0;
  let quizScore = 0;
  let appLock = false;

  function norm(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function loadStats() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(storageKeys.stats) || "{}");
      return {
        observed: Number(parsed.observed || 0),
        ai: Number(parsed.ai || 0),
        count: Number(parsed.count || 0),
        reconfirm: Number(parsed.reconfirm || 0),
        hold: Number(parsed.hold || 0),
        carbon: Number(parsed.carbon || 0),
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
    } catch {
      return { observed: 0, ai: 0, count: 0, reconfirm: 0, hold: 0, carbon: 0, logs: [] };
    }
  }

  function saveStats(stats) {
    sessionStorage.setItem(storageKeys.stats, JSON.stringify(stats));
  }

  function loadHolds() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(storageKeys.holds) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHolds(holds) {
    sessionStorage.setItem(storageKeys.holds, JSON.stringify(holds));
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
    return $$(".aiw-card").find((card) => norm(card.textContent).includes("버려지는 순간을 기록하세요"));
  }

  function appTemplate() {
    const quickItems = Object.keys(trashDb).filter((key) => key !== "판단 보류 물건").slice(0, 8);

    return `
      <div class="ny-app">
        <div class="ny-head">
          <div>
            <div class="ny-kicker">Nayeon Classroom Mini App</div>
            <h2 class="ny-title">버려지는 순간을 기록하세요</h2>
          </div>
          <span class="ny-mode">AI + 학생 판단</span>
        </div>

        <p class="ny-desc">사진 AI분류, 3초 판단, OX 퀴즈, 판단 보류함을 한 장의 수업용 미니앱으로 연결합니다.</p>

        <div class="ny-tabs" role="tablist" aria-label="미니앱 기능">
          <button class="ny-tab is-active" type="button" data-ny-tab="photo">AI분류</button>
          <button class="ny-tab" type="button" data-ny-tab="judge">3초판단</button>
          <button class="ny-tab" type="button" data-ny-tab="quiz">퀴즈</button>
          <button class="ny-tab" type="button" data-ny-tab="hold">보류함</button>
        </div>

        <div class="ny-panels">
          <section class="ny-panel is-active" data-ny-panel="photo">
            <div class="ny-inputs">
              <input id="ny-camera-input" type="file" accept="image/*" capture="environment" />
              <input id="ny-gallery-input" type="file" accept="image/*" />
            </div>

            <div class="ny-picker-grid">
              <button class="ny-picker" type="button" id="ny-camera-btn">
                <span class="ny-icon">${cameraIcon()}</span>
                <strong>지금 버려지는 순간 찰칵</strong>
                <span>카메라로 바로 촬영해 분류하기</span>
              </button>
              <button class="ny-picker" type="button" id="ny-gallery-btn">
                <span class="ny-icon">${galleryIcon()}</span>
                <strong>기록해둔 순간 판단하기</strong>
                <span>이미 찍어둔 사진으로 확인하기</span>
              </button>
            </div>

            <div class="ny-preview" id="ny-preview">
              <div class="ny-photo" id="ny-photo">
                <img id="ny-preview-img" alt="업로드한 버려지는 순간 미리보기" />
                <span class="ny-scan-line" aria-hidden="true"></span>
                <span class="ny-detect-box" aria-hidden="true"></span>
              </div>
              <div class="ny-status" id="ny-status">
                <span class="ny-loader" aria-hidden="true"></span>
                <span id="ny-status-text">사진 속 물체를 분석하는 중입니다...</span>
              </div>
            </div>

            <div class="ny-result" id="ny-photo-result" aria-live="polite"></div>
            <div class="ny-sim" id="ny-sim"></div>
          </section>

          <section class="ny-panel" data-ny-panel="judge">
            <div class="ny-search-box">
              <input class="ny-search-input" id="ny-search-input" placeholder="예: 우유갑, 플라스틱 컵, 영수증, 볼펜" />
              <div class="ny-quick-grid">
                ${quickItems
                  .map((key) => `<button class="ny-quick" type="button" data-ny-quick="${key}">${trashDb[key].icon} ${key}</button>`)
                  .join("")}
              </div>
            </div>
            <div class="ny-result" id="ny-judge-result" aria-live="polite"></div>
          </section>

          <section class="ny-panel" data-ny-panel="quiz">
            <div class="ny-quiz-card">
              <div class="ny-quiz-meta">
                <span id="ny-quiz-progress">질문 1 / ${quizData.length}</span>
                <span id="ny-quiz-score">점수 0점</span>
              </div>
              <div class="ny-progress"><span id="ny-quiz-bar" style="width:${100 / quizData.length}%"></span></div>
              <div class="ny-quiz-emoji" id="ny-quiz-emoji">🧾</div>
              <div class="ny-quiz-q" id="ny-quiz-q"></div>
              <div class="ny-ox" id="ny-ox">
                <button class="ny-btn ny-o" type="button" data-ny-answer="true">O</button>
                <button class="ny-btn ny-x" type="button" data-ny-answer="false">X</button>
              </div>
              <div class="ny-explain" id="ny-explain"></div>
              <button class="ny-btn ny-btn-primary" type="button" id="ny-next-quiz" style="display:none;width:100%;margin-top:10px;">다음 문제</button>
            </div>
          </section>

          <section class="ny-panel" data-ny-panel="hold">
            <div class="ny-hold-card">
              <p class="ny-desc">애매한 물건은 바로 버리지 않고 보류함에 등록해 금요일 회의 안건으로 사용합니다.</p>
              <div class="ny-hold-form">
                <input id="ny-hold-input" placeholder="예: 스프링 공책, 부러진 자, 코팅 종이" />
                <button class="ny-btn ny-btn-secondary" type="button" id="ny-hold-add">등록</button>
              </div>
              <div class="ny-hold-list" id="ny-hold-list"></div>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function resolveTrash(query) {
    const q = norm(query).toLowerCase();
    if (!q) return trashDb["판단 보류 물건"];

    for (const [key, item] of Object.entries(trashDb)) {
      if (key.toLowerCase().includes(q) || q.includes(key.toLowerCase())) return item;
      if (item.aliases.some((alias) => q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q))) {
        return item;
      }
    }

    return { ...trashDb["판단 보류 물건"], name: query, icon: "🤔", raw: query };
  }

  function ensureModel() {
    if (modelPromise) return modelPromise;

    modelPromise = new Promise(async (resolve, reject) => {
      try {
        const startedAt = Date.now();
        while (!window.mobilenet && Date.now() - startedAt < 9000) {
          await new Promise((done) => window.setTimeout(done, 120));
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
      const combinedText = `${file?.name || ""} ${predictions.map((prediction) => prediction.className).join(" ")}`;
      const item = resolveTrash(combinedText);

      return {
        item,
        confidence: Math.max(35, Math.round((predictions[0]?.probability || 0.42) * 100)),
        raw: predictions[0]?.className || "unknown",
        predictions,
        real: true,
      };
    } catch {
      const item = resolveTrash(file?.name || "판단 보류 물건");
      return {
        item,
        confidence: 42,
        raw: "모델 연결 실패 · 검색 규칙 판단",
        predictions: [],
        real: false,
      };
    }
  }

  function resultCardHTML(data, source = "judge") {
    const item = data.item || data;
    const confidence = data.confidence;
    const raw = data.raw;
    const labels = data.predictions?.length
      ? data.predictions
          .slice(0, 3)
          .map((prediction) => `<span>${prediction.className} ${(prediction.probability * 100).toFixed(1)}%</span>`)
          .join("")
      : "<span>수업용 판단 규칙 적용</span>";

    return `
      <div class="ny-result-top">
        <div>
          <h3 class="ny-result-title">${item.icon || ""} ${item.name}</h3>
          <p class="ny-desc">${source === "photo" ? "AI 1차 판단 뒤 학생이 다시 확인합니다." : "3초 판단 도우미 결과입니다."}</p>
        </div>
        <span class="ny-pill">${confidence ? `신뢰도 ${confidence}%` : item.category}</span>
      </div>

      <div class="ny-info-grid">
        <div class="ny-info"><small>분류</small><strong>${item.category}</strong></div>
        <div class="ny-info"><small>배출 위치</small><strong>${item.bin}</strong></div>
        <div class="ny-info"><small>판단 방식</small><strong>${item.hold ? "보류함 권장" : "실천 가능"}</strong></div>
      </div>

      <p class="ny-guide">
        ${raw ? `<strong>AI 원본 인식:</strong> ${raw}<br />` : ""}
        ${item.guide}<br />
        <strong>${item.tip}</strong>
      </p>

      <div class="ny-model-labels">${labels}</div>

      <div class="ny-actions">
        <button class="ny-btn ny-btn-primary" type="button" data-ny-practice="${item.name}">학생 판단 완료</button>
        <button class="ny-btn ny-btn-secondary" type="button" data-ny-hold="${item.name}">판단 보류함 등록</button>
        <button class="ny-btn ny-btn-ghost" type="button" data-ny-reset>다시 선택</button>
      </div>
    `;
  }

  function showResult(target, data, source = "judge") {
    if (!target) return;
    target.innerHTML = resultCardHTML(data, source);
    target.classList.add("is-visible");
  }

  function logPractice(itemName) {
    const item = Object.values(trashDb).find((value) => value.name === itemName || `${value.icon} ${value.name}` === itemName) || resolveTrash(itemName);
    const stats = loadStats();
    stats.observed += 1;
    stats.count += 1;
    stats.reconfirm += 1;
    stats.carbon += Number(item.carbon || 0);
    stats.logs.unshift({
      name: `${item.icon || ""} ${item.name}`,
      category: item.category,
      carbon: item.carbon || 0,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    });
    stats.logs = stats.logs.slice(0, 20);
    saveStats(stats);
    updateDashboardNumbers();
    showSim();
  }

  function addHold(name) {
    const holds = loadHolds();
    const stats = loadStats();

    holds.unshift({
      id: crypto.randomUUID?.() || String(Date.now()),
      name,
      date: new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
    });
    saveHolds(holds);

    stats.observed += 1;
    stats.hold += 1;
    saveStats(stats);

    updateHoldUI();
    updateDashboardNumbers();
    showSim();
  }

  function updateHoldUI() {
    const list = $("#ny-hold-list");
    if (!list) return;

    const holds = loadHolds();
    if (!holds.length) {
      list.innerHTML = '<div class="ny-hold-item"><span>보류함에 등록된 물건이 없습니다.</span></div>';
      return;
    }

    list.innerHTML = holds
      .map(
        (item) => `
          <div class="ny-hold-item">
            <span>🟨 ${item.name}</span>
            <button class="ny-btn ny-btn-ghost" type="button" data-ny-resolve="${item.id}" style="min-height:30px;font-size:10px;">해결</button>
          </div>
        `
      )
      .join("");
  }

  function parseNumber(value) {
    const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function findValueByLabel(labels) {
    const blocks = $$(".awx-stat, .aiw-kpi-tile, .class-main-kpi, .class-mini-kpis div");
    const block = blocks.find((item) => {
      const label = $(".awx-stat-label, span, .aiw-kpi-tile span", item);
      const text = norm(label?.textContent || item.textContent);
      return labels.some((needle) => text.includes(needle));
    });
    return $(".awx-stat-value, b, .aiw-kpi-tile b", block);
  }

  function setDashboardNumber(key, labels, add) {
    const value = document.querySelector(`[data-kpi="${key}"]`) || findValueByLabel(labels);
    if (!value) return;

    if (!(key in baseCache)) baseCache[key] = parseNumber(value.textContent);
    if (!(key in addCache)) addCache[key] = 0;
    const current = parseNumber(value.textContent);
    const previousAdd = addCache[key];
    const expectedBefore = baseCache[key] + previousAdd;
    if (current > expectedBefore) {
      baseCache[key] = current - previousAdd;
    }
    addCache[key] = add;
    const next = baseCache[key] + add;
    value.textContent = String(next);
    value.dataset.target = String(next);

    try {
      metricValues[key] = next;
    } catch {
      /* metricValues is provided by script.js when present. */
    }
  }

  function updateDashboardNumbers() {
    const stats = loadStats();
    setDashboardNumber("today-observed", ["오늘 관찰"], stats.observed);
    setDashboardNumber("ai-classified", ["AI 분류", "AI 1차 분류"], stats.ai);
    setDashboardNumber("human-confirmed", ["재확인", "학생 재확인"], stats.reconfirm);
    setDashboardNumber("class-hold", ["판단 보류"], stats.hold);
    setDashboardNumber("converted", ["전환 사례"], stats.count);
    setDashboardNumber("school-observed", ["배출 관찰"], stats.observed);
  }

  function graphPath(score) {
    const base = [88, 78, 70, 64, 58, 54, 52];
    return base.map((y, index) => `${14 + index * 42},${Math.max(24, Math.round(y - score * (index / 6) * 1.15))}`).join(" ");
  }

  function showSim() {
    const sim = $("#ny-sim");
    if (!sim) return;

    sim.innerHTML = `
      <h3 class="ny-sim-title">되감기 시뮬레이터로 효과 검증</h3>
      <p class="ny-desc">4차시 토론에서 결정한 UX 솔루션을 체크하며 데이터 변화를 확인합니다.</p>
      <div class="ny-checks">
        ${Object.entries(simEffects)
          .map(
            ([key, value]) => `
              <label class="ny-check">
                <input type="checkbox" data-ny-effect="${key}" />
                <strong>${value.name}</strong>
                <small>${value.effect}</small>
              </label>
            `
          )
          .join("")}
      </div>
      <div class="ny-sim-body">
        <div class="ny-metrics">
          <div class="ny-stat"><small>오배출률</small><strong id="ny-misrate">22%</strong></div>
          <div class="ny-stat"><small>성공률</small><strong id="ny-success">62%</strong></div>
          <div class="ny-stat"><small>CO2 감축</small><strong id="ny-co2">0.0kg</strong></div>
          <div class="ny-stat"><small>매립지 수명</small><strong id="ny-life">+0일</strong></div>
        </div>
        <div class="ny-graph">
          <svg viewBox="0 0 280 120" preserveAspectRatio="none" aria-label="미래 쓰레기 누적 배출량 곡선">
            <defs>
              <linearGradient id="nyLineGrad" x1="0" x2="1">
                <stop offset="0%" stop-color="#70f4df"></stop>
                <stop offset="100%" stop-color="#73bdff"></stop>
              </linearGradient>
            </defs>
            <polyline id="ny-graph-line" points="${graphPath(0)}" fill="none" stroke="url(#nyLineGrad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
            <polyline points="14,88 56,78 98,70 140,64 182,58 224,54 266,52" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round"></polyline>
          </svg>
          <p class="ny-quote">우리의 기획이 미래를 바꾼다.</p>
        </div>
      </div>
    `;

    sim.classList.add("is-visible");
    $$("[data-ny-effect]", sim).forEach((input) => {
      input.addEventListener("change", updateSim);
    });
    updateSim();
  }

  function updateSim() {
    const checked = $$("[data-ny-effect]:checked").map((input) => input.dataset.nyEffect);
    let mis = 22;
    let success = 62;
    let co2 = 0;
    let life = 0;

    checked.forEach((key) => {
      const effect = simEffects[key];
      if (!effect) return;
      mis += effect.mis;
      success += effect.success;
      co2 += effect.co2;
      life += effect.life;
    });

    mis = Math.max(5, mis);
    success = Math.min(96, success);

    if ($("#ny-misrate")) $("#ny-misrate").textContent = `${mis}%`;
    if ($("#ny-success")) $("#ny-success").textContent = `${success}%`;
    if ($("#ny-co2")) $("#ny-co2").textContent = `${co2.toFixed(1)}kg`;
    if ($("#ny-life")) $("#ny-life").textContent = `+${life}일`;
    $("#ny-graph-line")?.setAttribute("points", graphPath(checked.length * 8 + (62 - mis) * 0.45));

    $$("[data-ny-effect]").forEach((input) => input.closest(".ny-check")?.classList.toggle("is-active", input.checked));
  }

  function renderQuiz() {
    const quiz = quizData[currentQuiz];
    if (!quiz) return;

    $("#ny-quiz-progress").textContent = `질문 ${currentQuiz + 1} / ${quizData.length}`;
    $("#ny-quiz-score").textContent = `점수 ${quizScore}점`;
    $("#ny-quiz-bar").style.width = `${((currentQuiz + 1) / quizData.length) * 100}%`;
    $("#ny-quiz-emoji").textContent = quiz.emoji;
    $("#ny-quiz-q").textContent = quiz.q;
    $("#ny-explain").classList.remove("is-visible");
    $("#ny-explain").innerHTML = "";
    $("#ny-ox").style.display = "grid";
    $("#ny-next-quiz").style.display = "none";
  }

  function resetPhotoPanel() {
    $("#ny-photo-result")?.classList.remove("is-visible");
    $("#ny-judge-result")?.classList.remove("is-visible");
    $("#ny-preview")?.classList.remove("is-visible");
    $("#ny-sim")?.classList.remove("is-visible");
  }

  function bindEvents(card) {
    card.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-ny-tab]");
      if (tab) {
        $$("[data-ny-tab]", card).forEach((button) => button.classList.toggle("is-active", button === tab));
        $$("[data-ny-panel]", card).forEach((panel) => panel.classList.toggle("is-active", panel.dataset.nyPanel === tab.dataset.nyTab));
        if (tab.dataset.nyTab === "quiz") renderQuiz();
        if (tab.dataset.nyTab === "hold") updateHoldUI();
        return;
      }

      if (event.target.closest("#ny-camera-btn")) $("#ny-camera-input")?.click();
      if (event.target.closest("#ny-gallery-btn")) $("#ny-gallery-input")?.click();

      const quick = event.target.closest("[data-ny-quick]");
      if (quick) showResult($("#ny-judge-result"), trashDb[quick.dataset.nyQuick], "judge");

      const practice = event.target.closest("[data-ny-practice]");
      if (practice) logPractice(practice.dataset.nyPractice);

      const hold = event.target.closest("[data-ny-hold]");
      if (hold) addHold(hold.dataset.nyHold);

      if (event.target.closest("[data-ny-reset]")) resetPhotoPanel();

      const answer = event.target.closest("[data-ny-answer]");
      if (answer) {
        const correct = String(quizData[currentQuiz].a) === answer.dataset.nyAnswer;
        if (correct) quizScore += 20;
        $("#ny-explain").innerHTML = `<strong>${correct ? "정답입니다!" : "다시 생각해볼 포인트!"}</strong><br />${quizData[currentQuiz].e}`;
        $("#ny-explain").classList.add("is-visible");
        $("#ny-ox").style.display = "none";
        $("#ny-next-quiz").style.display = "block";
        $("#ny-quiz-score").textContent = `점수 ${quizScore}점`;
      }

      if (event.target.closest("#ny-next-quiz")) {
        currentQuiz += 1;
        if (currentQuiz >= quizData.length) {
          currentQuiz = 0;
          quizScore = 0;
        }
        renderQuiz();
      }

      const resolve = event.target.closest("[data-ny-resolve]");
      if (resolve) {
        saveHolds(loadHolds().filter((item) => item.id !== resolve.dataset.nyResolve));
        updateHoldUI();
      }

      if (event.target.closest("#ny-hold-add")) {
        const input = $("#ny-hold-input");
        const value = norm(input?.value);
        if (value) {
          addHold(value);
          input.value = "";
          updateHoldUI();
        }
      }
    });

    $("#ny-search-input", card)?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      showResult($("#ny-judge-result"), resolveTrash(event.target.value), "judge");
    });

    $("#ny-camera-input", card)?.addEventListener("change", (event) => {
      handleFile(event.target.files?.[0]);
      event.target.value = "";
    });
    $("#ny-gallery-input", card)?.addEventListener("change", (event) => {
      handleFile(event.target.files?.[0]);
      event.target.value = "";
    });
  }

  async function handleFile(file) {
    if (!file) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    const img = $("#ny-preview-img");
    const preview = $("#ny-preview");
    const photo = $("#ny-photo");
    const status = $("#ny-status");
    const statusText = $("#ny-status-text");

    img.src = objectUrl;
    preview.classList.add("is-visible");
    photo.classList.add("is-scanning");
    status.classList.add("is-visible");
    statusText.textContent = "사진 속 물체를 분석하는 중입니다...";

    const stats = loadStats();
    stats.observed += 1;
    stats.ai += 1;
    saveStats(stats);
    updateDashboardNumbers();

    img.onload = async () => {
      const result = await classifyImage(img, file);
      statusText.textContent = "분리배출 카드로 바꾸는 중입니다...";
      window.setTimeout(() => {
        photo.classList.remove("is-scanning");
        status.classList.remove("is-visible");
        showResult($("#ny-photo-result"), result, "photo");
        showSim();
      }, 600);
    };
  }

  function install() {
    if (appLock) return;

    const card = findRecordCard();
    if (!card) return;

    if ($(".ny-app", card)) {
      updateHoldUI();
      updateDashboardNumbers();
      return;
    }

    appLock = true;
    card.classList.add("awx-live-card");
    card.innerHTML = appTemplate();
    bindEvents(card);
    renderQuiz();
    updateHoldUI();
    updateDashboardNumbers();
    appLock = false;
  }

  function boot() {
    install();
    ensureModel().catch(() => undefined);

    new MutationObserver(() => {
      window.clearTimeout(window.__nyMiniAppTimer);
      window.__nyMiniAppTimer = window.setTimeout(install, 120);
    }).observe(document.body, { childList: true, subtree: true });

    window.setInterval(() => {
      install();
      updateDashboardNumbers();
    }, 1200);
  }

  if (document.readyState === "loading" || document.readyState === "interactive") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
    window.addEventListener("load", () => {
      if (!$(".ny-app")) boot();
    }, { once: true });
  } else {
    boot();
  }
})();
