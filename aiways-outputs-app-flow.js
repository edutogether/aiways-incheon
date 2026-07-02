(() => {
  const NAV_LABELS = ["프로젝트", "교육과정", "H-A-H", "차시흐름", "산출물"];

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

  const TRASH_DB = {
    "우유갑": {
      aliases: ["우유", "milk", "carton", "팩", "종이팩"],
      emoji: "🥛",
      name: "우유갑",
      category: "종이팩",
      bin: "종이팩 전용 수거함",
      guide: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 종이팩 전용 수거함에 배출합니다.",
      tip: "일반 종이류와 섞이면 재활용 공정이 달라 품질이 떨어집니다.",
      carbon: 25,
      holdBase: 24
    },
    "종이류": {
      aliases: ["종이", "paper", "book", "notebook", "프린트", "활동지", "cardboard", "box"],
      emoji: "📄",
      name: "깨끗한 종이류",
      category: "종이류",
      bin: "종이류 배출함",
      guide: "물기와 음식물이 묻지 않았다면 펼쳐서 종이류로 배출합니다.",
      tip: "코팅, 테이프, 음식물 오염이 있으면 판단 보류함에 등록합니다.",
      carbon: 15,
      holdBase: 22
    },
    "플라스틱 컵": {
      aliases: ["컵", "plastic", "cup", "bottle", "container", "페트", "생수병", "water bottle"],
      emoji: "🥤",
      name: "플라스틱 컵",
      category: "플라스틱류",
      bin: "플라스틱 배출함",
      guide: "남은 음료를 비우고 빨대·뚜껑·라벨을 분리한 뒤 배출합니다.",
      tip: "오염이 심하면 재활용이 어려울 수 있어 먼저 헹군 뒤 판단합니다.",
      carbon: 32.5,
      holdBase: 32
    },
    "과자 봉지": {
      aliases: ["과자", "봉지", "비닐", "snack", "wrapper", "bag", "packet", "plastic bag"],
      emoji: "🍿",
      name: "과자 봉지",
      category: "비닐류 또는 판단 보류",
      bin: "비닐류 배출함 / 판단 보류함",
      guide: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다.",
      tip: "기름기와 양념이 많으면 일반쓰레기 또는 보류 판단이 필요합니다.",
      carbon: 12,
      holdBase: 58
    },
    "컵라면 용기": {
      aliases: ["라면", "컵라면", "스티로폼", "noodle", "cup noodle", "ramen"],
      emoji: "🍜",
      name: "컵라면 용기",
      category: "일반쓰레기 검토",
      bin: "일반쓰레기 / 스티로폼 기준 확인",
      guide: "국물 자국이 씻기지 않는 용기는 일반쓰레기로 배출합니다.",
      tip: "깨끗한 스티로폼만 학교 기준에 따라 분리합니다.",
      carbon: 5,
      holdBase: 70
    },
    "캔류": {
      aliases: ["캔", "can", "tin", "aluminum", "soda can"],
      emoji: "🥫",
      name: "캔류",
      category: "캔류",
      bin: "캔류 배출함",
      guide: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다.",
      tip: "담배꽁초나 이물질이 들어 있으면 먼저 제거해야 합니다.",
      carbon: 38,
      holdBase: 18
    },
    "영수증": {
      aliases: ["영수증", "receipt"],
      emoji: "🧾",
      name: "영수증",
      category: "일반쓰레기",
      bin: "일반쓰레기",
      guide: "감열지 영수증은 특수 코팅이 되어 있어 일반쓰레기로 배출합니다.",
      tip: "종이처럼 보여도 폐지와 섞지 않는 것이 좋습니다.",
      carbon: 4.5,
      holdBase: 34
    },
    "볼펜": {
      aliases: ["볼펜", "펜", "pen", "ballpoint", "pencil", "marker"],
      emoji: "🖋️",
      name: "볼펜 및 필기구",
      category: "일반쓰레기 또는 판단 보류",
      bin: "판단 보류함",
      guide: "여러 재질이 섞인 소형 학용품은 재활용이 어려운 경우가 많습니다.",
      tip: "분리 가능한 부품이 있는지 확인하고 애매하면 보류함에 등록합니다.",
      carbon: 3,
      holdBase: 74
    },
    "판단 보류 물건": {
      aliases: ["모름", "애매", "판단", "보류", "unknown", "object"],
      emoji: "🤔",
      name: "판단 보류 물건",
      category: "판단 보류",
      bin: "판단 보류함",
      guide: "바로 버리지 말고 판단 보류함에 등록한 뒤 금요일 회의 안건으로 확인합니다.",
      tip: "모르는 것을 바로 버리지 않는 것도 자원순환 역량입니다.",
      carbon: 0,
      holdBase: 90
    }
  };

  const QUIZ_DATA = [
    {
      emoji: "🧾",
      question: "영수증은 종이처럼 보여도 일반쓰레기로 버리는 것이 안전하다.",
      answer: true,
      explanation: "영수증은 감열지라 일반 종이와 분리해 판단해야 합니다."
    },
    {
      emoji: "🥛",
      question: "우유갑은 일반 종이와 섞어 버려도 재활용 과정이 같다.",
      answer: false,
      explanation: "종이팩은 일반 폐지와 공정이 달라 따로 모으는 것이 좋습니다."
    },
    {
      emoji: "🍜",
      question: "국물 자국이 깊게 밴 컵라면 용기는 재활용이 어려울 수 있다.",
      answer: true,
      explanation: "오염이 지워지지 않으면 선별 과정에서 폐기될 가능성이 큽니다."
    },
    {
      emoji: "🥤",
      question: "플라스틱 컵은 남은 음료를 비우고 헹군 뒤 배출한다.",
      answer: true,
      explanation: "오염을 줄이는 것이 분리배출 성공률을 높이는 핵심입니다."
    },
    {
      emoji: "📦",
      question: "택배 상자는 테이프와 운송장을 제거하면 더 좋은 재활용 자원이 된다.",
      answer: true,
      explanation: "종이 외 이물질을 제거하면 재활용 품질이 좋아집니다."
    },
    {
      emoji: "🍿",
      question: "기름 묻은 과자봉지는 무조건 깨끗한 비닐류와 같은 기준으로 버린다.",
      answer: false,
      explanation: "오염 정도에 따라 일반쓰레기 또는 판단 보류가 필요합니다."
    },
    {
      emoji: "🖋️",
      question: "볼펜처럼 여러 재질이 섞인 물건은 바로 판단하기 어려울 수 있다.",
      answer: true,
      explanation: "복합재질 소형 물건은 보류함에 등록해 함께 판단하기 좋습니다."
    },
    {
      emoji: "🤖",
      question: "AI가 말한 분류 결과는 사람이 다시 확인하지 않아도 항상 정답이다.",
      answer: false,
      explanation: "AI는 1차 제안이고, 최종 판단은 사람이 맥락을 보고 결정합니다."
    },
    {
      emoji: "🟨",
      question: "애매한 물건을 판단 보류함에 넣는 것도 좋은 자원순환 행동이다.",
      answer: true,
      explanation: "모르는 것을 바로 버리지 않는 태도가 H-A-H의 핵심입니다."
    },
    {
      emoji: "🌱",
      question: "분리배출 기록은 대시보드에 쌓여 다음 토론의 근거가 될 수 있다.",
      answer: true,
      explanation: "기록된 데이터는 헷갈린 물건 TOP 5, 판단 보류 비율, 학급 참여를 확인하는 근거가 됩니다."
    }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const norm = value => (value || "").replace(/\s+/g, " ").trim();

  let selectedClass = localStorage.getItem("aiways_selected_class") || "5학년 1반";
  if (!CLASS_DATA[selectedClass]) selectedClass = "5학년 1반";

  let selectedGrade = CLASS_DATA[selectedClass].grade;
  let appRendered = false;
  let modelPromise = null;
  let imageUrl = null;
  let currentItem = null;
  let currentRawLabel = "";
  let currentConfidence = 0;

  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;

  function getPageCandidates() {
    const nodes = $$("main > section, body > section, section, article, .aiw-page-section, [data-section]");
    const unique = [];

    nodes.forEach(node => {
      if (unique.includes(node)) return;
      const rect = node.getBoundingClientRect();
      const text = norm(node.textContent);

      if (rect.width < 420 || rect.height < 220 || text.length < 10) return;
      if (unique.some(parent => parent.contains(node))) return;

      unique.push(node);
    });

    return unique;
  }

  function findPageByTexts(texts) {
    const pages = getPageCandidates();

    const matches = pages.filter(page => {
      const text = norm(page.textContent);
      return texts.some(key => text.includes(key));
    });

    if (matches.length) {
      return matches.sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return ar.width * ar.height - br.width * br.height;
      })[0];
    }

    const heading = $$("h1, h2, h3, [class*='title']").find(el => {
      const text = norm(el.textContent);
      return texts.some(key => text.includes(key));
    });

    if (!heading) return null;

    let current = heading;
    while (current && current !== document.body) {
      if (pages.includes(current)) return current;
      current = current.parentElement;
    }

    return null;
  }

  function patchNavLabel() {
    const header = $("header, .site-header, .header") || document;

    $$("a, button, span", header).forEach(el => {
      if (norm(el.textContent) === "6차시") {
        el.textContent = "차시흐름";
      }
    });
  }

  function collectNavItems() {
    const header = $("header, .site-header, .header") || document;

    return NAV_LABELS.map(label => {
      return $$("a, button, span", header).find(el => norm(el.textContent) === label);
    }).filter(Boolean);
  }

  function removeUnwantedPages() {
    ["#hold", "#ranking"].forEach(selector => {
      const page = $(selector);
      if (page) {
        page.classList.add("aiways-output-removed");
        page.remove();
      }
    });

    [
      ["판단 보류 QR", "판단보류 QR", "보류 QR"],
      ["5학년 1반 자원순환 랭킹", "자원순환 랭킹 페이지"]
    ].forEach(texts => {
      const page = findPageByTexts(texts);
      if (page) {
        page.classList.add("aiways-output-removed");
        page.remove();
      }
    });
  }

  function reorderOutputPages() {
    const gallery = $("#outputs") || findPageByTexts(["학생 산출물 갤러리", "산출물 갤러리"]);
    const app = $("#quick-app") || $("[data-aiways-generated-app-page='1']") || findPageByTexts(["3초 판단 앱", "3-Second Sorting Helper App"]);

    if (!gallery || !app || gallery === app || !gallery.parentNode || !app.parentNode) return;

    const sameParent = gallery.parentNode === app.parentNode;
    if (!sameParent) return;

    const position = app.compareDocumentPosition(gallery);
    const appBeforeGallery = Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING);

    if (appBeforeGallery) {
      app.parentNode.insertBefore(gallery, app);
    }
  }

  function ensureAppPage() {
    let app = $("#quick-app");

    if (!app) {
      const gallery = $("#outputs") || findPageByTexts(["학생 산출물 갤러리", "산출물 갤러리"]);
      const section = document.createElement("section");
      section.className = "aiways-full-app-section aiw-page-section";
      section.id = "quick-app";
      section.dataset.aiwaysGeneratedAppPage = "1";

      if (gallery && gallery.parentNode) {
        gallery.parentNode.insertBefore(section, gallery.nextSibling);
      } else {
        document.body.appendChild(section);
      }

      app = section;
    }

    if (!appRendered || !app.querySelector("#aiways-full-app-v3")) {
      app.classList.add("aiways-full-app-section");
      app.innerHTML = appMarkup();
      appRendered = true;
      bindAppEvents(app);
      renderClassOptions();
      renderQuiz();
      updateStatsPanel();
      updateHoldPanel();
      showPlaceholder();
    }
  }

  function appMarkup() {
    return `
      <div class="aiways-full-app-wrap" id="aiways-full-app-v3">
        <div class="aiways-app-copy">
          <div class="aiways-app-kicker">Output · 3-Second Sorting Helper App</div>
          <h2 class="aiways-app-title">3초 판단 앱</h2>
          <p class="aiways-app-desc">
            학생이 사진을 찍거나 검색하면 AI가 먼저 물체를 추정하고, 학생이 다시 확인해
            실천 기록·판단 보류함·퀴즈·통계로 연결하는 H-A-H 기반 자원순환 미니앱입니다.
          </p>

          <div class="aiways-app-feature-grid">
            <div class="aiways-app-feature">
              <strong>이미지 AI분류</strong>
              <span>사진을 올리면 지이잉 스캔 후 물체 후보를 추정하고 배출 카드를 제안합니다.</span>
            </div>
            <div class="aiways-app-feature">
              <strong>3초 판단 검색</strong>
              <span>우유갑, 영수증, 볼펜처럼 자주 헷갈리는 물건을 빠르게 확인합니다.</span>
            </div>
            <div class="aiways-app-feature">
              <strong>OX 퀴즈</strong>
              <span>분리배출 기준을 게임처럼 확인하고 점수로 피드백합니다.</span>
            </div>
            <div class="aiways-app-feature">
              <strong>통계·보류함</strong>
              <span>사진은 저장하지 않고 판단 결과만 쌓아 대시보드와 회의 안건으로 연결합니다.</span>
            </div>
          </div>
        </div>

        <div class="aiways-app-device">
          <div class="aiways-app-device-inner">
            <div class="aiways-app-head">
              <div class="aiways-app-head-title">
                <small>AI + 학생 판단</small>
                <h3>버려지는 순간을 판단하세요</h3>
              </div>
              <select class="aiways-app-class-select" id="aiways-app-class-select"></select>
            </div>

            <div class="aiways-app-tabs">
              <button class="aiways-app-tab active" data-aiways-tab="judge">AI분류</button>
              <button class="aiways-app-tab" data-aiways-tab="quiz">퀴즈</button>
              <button class="aiways-app-tab" data-aiways-tab="stats">통계</button>
              <button class="aiways-app-tab" data-aiways-tab="hold">보류함</button>
            </div>

            <div class="aiways-app-panels">
              <section class="aiways-app-panel active" data-aiways-panel="judge">
                <div class="aiways-judge-grid">
                  <div class="aiways-camera-column">
                    <div class="aiways-section-label">사진 기반 AI분류</div>

                    <input class="aiways-hidden-file" id="aiways-camera-input" type="file" accept="image/*" capture="environment">
                    <input class="aiways-hidden-file" id="aiways-gallery-input" type="file" accept="image/*">

                    <div class="aiways-capture-grid">
                      <button class="aiways-capture-btn" id="aiways-camera-button" type="button">
                        <span class="aiways-capture-icon">${cameraIcon()}</span>
                        <strong>지금 버려지는 순간 찰칵</strong>
                        <span>카메라로 바로 촬영해 분류하기</span>
                      </button>

                      <button class="aiways-capture-btn" id="aiways-gallery-button" type="button">
                        <span class="aiways-capture-icon">${galleryIcon()}</span>
                        <strong>기록해둔 순간 판단하기</strong>
                        <span>이미 찍어둔 사진으로 확인하기</span>
                      </button>
                    </div>

                    <div class="aiways-preview-box" id="aiways-preview-box">
                      <div class="aiways-photo-frame" id="aiways-photo-frame">
                        <img id="aiways-preview-img" alt="업로드한 사진 미리보기">
                        <div class="aiways-scan-line"></div>
                      </div>
                      <div class="aiways-status" id="aiways-status">
                        <span class="aiways-loader"></span>
                        <span id="aiways-status-text">사진 속 물체를 분석하는 중입니다...</span>
                      </div>
                    </div>

                    <div class="aiways-search-box">
                      <div class="aiways-section-label">3초 판단 검색</div>
                      <div class="aiways-search-row">
                        <input id="aiways-search-input" placeholder="예: 우유갑, 영수증, 볼펜, 컵라면">
                        <button class="aiways-btn primary" id="aiways-search-button">판단</button>
                      </div>

                      <div class="aiways-quick-grid">
                        ${["우유갑", "종이류", "플라스틱 컵", "컵라면 용기", "과자 봉지", "캔류", "영수증", "볼펜"].map(key => `
                          <button class="aiways-quick-btn" data-aiways-quick="${key}">
                            ${TRASH_DB[key].emoji} ${key}
                          </button>
                        `).join("")}
                      </div>
                    </div>
                  </div>

                  <div class="aiways-result-column">
                    <div id="aiways-result-area"></div>
                  </div>
                </div>
              </section>

              <section class="aiways-app-panel" data-aiways-panel="quiz">
                <div class="aiways-quiz-layout">
                  <div class="aiways-quiz-card">
                    <div class="aiways-quiz-progress">
                      <span id="aiways-quiz-progress">질문 1 / 10</span>
                      <span id="aiways-quiz-score">0점</span>
                    </div>
                    <div class="aiways-progress-track">
                      <span class="aiways-progress-fill" id="aiways-quiz-bar"></span>
                    </div>

                    <div class="aiways-quiz-emoji" id="aiways-quiz-emoji">🧾</div>
                    <div class="aiways-quiz-question" id="aiways-quiz-question"></div>

                    <div class="aiways-ox-grid" id="aiways-ox-grid">
                      <button class="aiways-ox-btn o" data-aiways-answer="true">O</button>
                      <button class="aiways-ox-btn x" data-aiways-answer="false">X</button>
                    </div>

                    <div class="aiways-explanation" id="aiways-explanation"></div>
                  </div>

                  <div class="aiways-quiz-side">
                    <div class="aiways-quiz-scorebox">
                      <strong id="aiways-quiz-big-score">0점</strong>
                      <span id="aiways-quiz-message">분리배출 감각을 테스트해 보세요.</span>
                    </div>

                    <div class="aiways-tip-list">
                      <div>💡 AI의 답은 1차 제안입니다. 최종 판단은 사람이 합니다.</div>
                      <div>🟨 애매하면 바로 버리지 않고 판단 보류함에 등록합니다.</div>
                      <div>📊 퀴즈와 판단 기록은 수업 토론의 근거가 됩니다.</div>
                      <button class="aiways-btn secondary" id="aiways-quiz-restart">퀴즈 다시 시작</button>
                    </div>
                  </div>
                </div>
              </section>

              <section class="aiways-app-panel" data-aiways-panel="stats">
                <div class="aiways-stat-grid">
                  <div class="aiways-stat-metrics">
                    <div class="aiways-stat-metric">
                      <small>누적 판단 기록</small>
                      <strong id="aiways-stat-total">0건</strong>
                    </div>
                    <div class="aiways-stat-metric">
                      <small>판단 보류</small>
                      <strong id="aiways-stat-hold">0건</strong>
                    </div>
                    <div class="aiways-stat-metric">
                      <small>CO₂ 저감 추정</small>
                      <strong id="aiways-stat-carbon">0.0g</strong>
                    </div>
                  </div>

                  <div class="aiways-stat-card">
                    <div class="aiways-section-label">실천 타임라인</div>
                    <div class="aiways-log-list" id="aiways-log-list"></div>
                  </div>
                </div>
              </section>

              <section class="aiways-app-panel" data-aiways-panel="hold">
                <div class="aiways-hold-layout">
                  <div class="aiways-hold-card">
                    <div class="aiways-section-label">판단 보류함 등록</div>

                    <div class="aiways-hold-form">
                      <input id="aiways-hold-input" placeholder="예: 코팅 종이컵, 스프링 공책, 부러진 자">
                      <button class="aiways-btn warning" id="aiways-hold-add">보류함에 등록</button>
                    </div>

                    <div class="aiways-hold-help">
                      애매한 물건은 바로 버리지 않고 보류함에 등록합니다.
                      금요일 회의에서 AI 결과, 실제 오염 여부, 학교 기준을 함께 확인합니다.
                    </div>
                  </div>

                  <div class="aiways-hold-card">
                    <div class="aiways-section-label">보류 및 회의 안건</div>
                    <div class="aiways-hold-list" id="aiways-hold-list"></div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    `;
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

  function bindAppEvents(root) {
    $$("[data-aiways-tab]", root).forEach(button => {
      button.addEventListener("click", () => {
        const tab = button.dataset.aiwaysTab;

        $$("[data-aiways-tab]", root).forEach(item => item.classList.toggle("active", item === button));
        $$("[data-aiways-panel]", root).forEach(panel => panel.classList.toggle("active", panel.dataset.aiwaysPanel === tab));

        if (tab === "quiz") renderQuiz();
        if (tab === "stats") updateStatsPanel();
        if (tab === "hold") updateHoldPanel();
      });
    });

    $("#aiways-app-class-select", root)?.addEventListener("change", event => {
      selectedClass = event.target.value;
      selectedGrade = CLASS_DATA[selectedClass]?.grade || "5학년";
      localStorage.setItem("aiways_selected_class", selectedClass);
      window.aiwaysSelectedClass = selectedClass;
      window.aiwaysSelectedGrade = selectedGrade;
      toast(`${selectedClass} 기록으로 연결됩니다.`);
    });

    $("#aiways-camera-button", root)?.addEventListener("click", () => $("#aiways-camera-input", root)?.click());
    $("#aiways-gallery-button", root)?.addEventListener("click", () => $("#aiways-gallery-input", root)?.click());

    $("#aiways-camera-input", root)?.addEventListener("change", event => handleFile(event.target.files?.[0], "camera"));
    $("#aiways-gallery-input", root)?.addEventListener("change", event => handleFile(event.target.files?.[0], "upload"));

    $("#aiways-search-button", root)?.addEventListener("click", () => {
      const value = norm($("#aiways-search-input", root)?.value);
      if (!value) return;
      const item = resolveTrash(value);
      showResult(item, "검색 판단", "", "search");
    });

    $("#aiways-search-input", root)?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      $("#aiways-search-button", root)?.click();
    });

    $$("[data-aiways-quick]", root).forEach(button => {
      button.addEventListener("click", () => {
        const item = TRASH_DB[button.dataset.aiwaysQuick] || TRASH_DB["판단 보류 물건"];
        showResult(item, "빠른 선택", "", "quick");
      });
    });

    $$("[data-aiways-answer]", root).forEach(button => {
      button.addEventListener("click", () => answerQuiz(button.dataset.aiwaysAnswer === "true"));
    });

    $("#aiways-quiz-restart", root)?.addEventListener("click", () => {
      quizIndex = 0;
      quizScore = 0;
      quizAnswered = false;
      renderQuiz();
    });

    $("#aiways-hold-add", root)?.addEventListener("click", () => {
      const input = $("#aiways-hold-input", root);
      const value = norm(input?.value);
      if (!value) return;

      addHold(value, "수동 등록");
      input.value = "";
    });
  }

  function renderClassOptions() {
    const select = $("#aiways-app-class-select");
    if (!select) return;

    select.innerHTML = Object.keys(CLASS_DATA).map(name => `
      <option value="${name}" ${name === selectedClass ? "selected" : ""}>${name}</option>
    `).join("");
  }

  function resolveTrash(query) {
    const q = norm(query).toLowerCase();

    if (!q) return TRASH_DB["판단 보류 물건"];

    for (const [key, item] of Object.entries(TRASH_DB)) {
      if (key.toLowerCase().includes(q) || q.includes(key.toLowerCase())) return item;

      if (item.aliases.some(alias => q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q))) {
        return item;
      }
    }

    return {
      ...TRASH_DB["판단 보류 물건"],
      name: query,
      emoji: "🤔"
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

  async function handleFile(file, inputType) {
    if (!file) return;

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);

    const preview = $("#aiways-preview-box");
    const frame = $("#aiways-photo-frame");
    const img = $("#aiways-preview-img");
    const status = $("#aiways-status");
    const statusText = $("#aiways-status-text");

    img.src = imageUrl;
    preview?.classList.add("visible");
    frame?.classList.add("scan");
    status?.classList.add("visible");

    if (statusText) statusText.textContent = "사진 속 물체를 지이잉 분석하는 중입니다...";

    img.onload = async () => {
      const result = await classifyImage(img, file);

      if (statusText) statusText.textContent = "AI 1차 판단을 배출 카드로 변환하는 중입니다...";

      setTimeout(() => {
        frame?.classList.remove("scan");
        status?.classList.remove("visible");
        showResult(result.item, result.raw, result.confidence, inputType);
      }, 720);
    };
  }

  async function classifyImage(img, file) {
    try {
      const model = await ensureModel();
      const predictions = await model.classify(img, 5);
      const combined = `${file?.name || ""} ${predictions.map(item => item.className).join(" ")}`;
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
        raw: "이미지 모델 연결 실패 · 파일명/규칙 기반 판단",
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

  function showPlaceholder() {
    const area = $("#aiways-result-area");
    if (!area) return;

    area.innerHTML = `
      <div class="aiways-placeholder">
        <div>
          <strong>AI분류 대기 중</strong>
          <span>사진을 찍거나 물건을 검색하면<br>AI 1차 판단 카드가 여기에 나타납니다.</span>
        </div>
      </div>
    `;
  }

  function showResult(item, rawLabel, confidence, inputType) {
    currentItem = item;
    currentRawLabel = rawLabel || "";
    currentConfidence = confidence || "";

    const score = holdScore(item, confidence);
    const area = $("#aiways-result-area");
    if (!area) return;

    area.innerHTML = `
      <div class="aiways-result-card">
        <div class="aiways-result-top">
          <div>
            <h4>${item.emoji} ${item.name}</h4>
          </div>
          <span class="aiways-pill">${confidence ? `신뢰도 ${confidence}%` : item.category}</span>
        </div>

        <div class="aiways-info-grid">
          <div class="aiways-info">
            <small>분류</small>
            <strong>${item.category}</strong>
          </div>
          <div class="aiways-info">
            <small>배출 위치</small>
            <strong>${item.bin}</strong>
          </div>
          <div class="aiways-info">
            <small>보류 권장</small>
            <strong>${score}%</strong>
          </div>
        </div>

        <div class="aiways-guide">
          <strong>AI 원본 인식:</strong> ${rawLabel || "검색 판단"}<br>
          ${item.guide}<br>
          <strong>팁:</strong> ${item.tip}
        </div>

        <div class="aiways-action-grid">
          <button class="aiways-btn primary" id="aiways-confirm-record">학생 판단 완료</button>
          <button class="aiways-btn warning" id="aiways-hold-record">판단 보류함 등록</button>
        </div>
      </div>
    `;

    $("#aiways-confirm-record")?.addEventListener("click", () => {
      saveRecord({
        input_type: inputType || "search",
        mapped_item: item.name,
        suggested_category: item.category,
        final_decision: item.category,
        ai_raw_label: rawLabel || "",
        ai_confidence: confidence || "",
        hold_flag: false,
        hold_score: score,
        action: "학생 판단 완료",
        carbon: item.carbon || 0
      });

      toast("학생 판단 완료 · 대시보드에 기록했습니다.");
    });

    $("#aiways-hold-record")?.addEventListener("click", () => {
      saveRecord({
        input_type: inputType || "search",
        mapped_item: item.name,
        suggested_category: item.category,
        final_decision: "판단 보류",
        ai_raw_label: rawLabel || "",
        ai_confidence: confidence || "",
        hold_flag: true,
        hold_score: score,
        hold_reason: "학생이 애매하다고 판단",
        action: "판단 보류함 등록",
        carbon: 0
      });

      addHold(item.name, "AI분류 후 보류");
      toast("판단 보류함에 등록했습니다.");
    });
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

  function appStats() {
    try {
      return JSON.parse(localStorage.getItem("aiways_full_app_stats")) || {
        total: 0,
        hold: 0,
        carbon: 0,
        logs: []
      };
    } catch {
      return {
        total: 0,
        hold: 0,
        carbon: 0,
        logs: []
      };
    }
  }

  function saveAppStats(stats) {
    localStorage.setItem("aiways_full_app_stats", JSON.stringify(stats));
  }

  function holds() {
    try {
      return JSON.parse(localStorage.getItem("aiways_full_app_holds")) || [];
    } catch {
      return [];
    }
  }

  function saveHolds(list) {
    localStorage.setItem("aiways_full_app_holds", JSON.stringify(list));
  }

  function sessionId() {
    let id = localStorage.getItem("aiways_session_id");

    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("aiways_session_id", id);
    }

    return id;
  }

  function saveRecord(payload) {
    const grade = CLASS_DATA[selectedClass]?.grade || "5학년";

    const record = {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      privacy_id: sessionId(),
      school: "우리학교",
      grade,
      class_name: selectedClass,
      group_id: "미지정",
      input_type: payload.input_type || "search",
      ai_raw_label: payload.ai_raw_label || "",
      ai_confidence: payload.ai_confidence || "",
      mapped_item: payload.mapped_item || "",
      suggested_category: payload.suggested_category || "",
      final_decision: payload.final_decision || "",
      hold_flag: Boolean(payload.hold_flag),
      hold_score: payload.hold_score || "",
      hold_reason: payload.hold_reason || "",
      contamination_check: "미입력",
      action: payload.action || "",
      image_saved: false,
      app_version: "aiways-full-output-app-v3"
    };

    const list = records();
    list.unshift(record);
    saveRecords(list);

    const stats = appStats();
    stats.total += 1;
    if (record.hold_flag) stats.hold += 1;
    stats.carbon += Number(payload.carbon || 0);
    stats.logs.unshift({
      time: record.local_time,
      class_name: selectedClass,
      item: payload.mapped_item || "",
      category: payload.final_decision || "",
      carbon: Number(payload.carbon || 0),
      hold: record.hold_flag
    });
    stats.logs = stats.logs.slice(0, 40);
    saveAppStats(stats);

    window.dispatchEvent(new CustomEvent("aiways-record-updated", { detail: record }));

    updateStatsPanel();
    updateHoldPanel();
  }

  function addHold(name, reason) {
    const list = holds();

    list.unshift({
      id: "hold-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name,
      reason,
      class_name: selectedClass,
      time: new Date().toLocaleString("ko-KR")
    });

    saveHolds(list.slice(0, 60));
    updateHoldPanel();
  }

  function updateStatsPanel() {
    const stats = appStats();

    $("#aiways-stat-total") && ($("#aiways-stat-total").textContent = `${stats.total}건`);
    $("#aiways-stat-hold") && ($("#aiways-stat-hold").textContent = `${stats.hold}건`);
    $("#aiways-stat-carbon") && ($("#aiways-stat-carbon").textContent = `${Number(stats.carbon || 0).toFixed(1)}g`);

    const list = $("#aiways-log-list");
    if (!list) return;

    if (!stats.logs.length) {
      list.innerHTML = `
        <div class="aiways-log-item">
          <b>아직 실천 기록이 없습니다.</b>
          <span>대기</span>
        </div>
      `;
      return;
    }

    list.innerHTML = stats.logs.map(log => `
      <div class="aiways-log-item">
        <div>
          <b>${log.item}</b><br>
          <small>${log.class_name} · ${log.time}</small>
        </div>
        <span>${log.hold ? "보류" : `-${Number(log.carbon || 0).toFixed(1)}g`}</span>
      </div>
    `).join("");
  }

  function updateHoldPanel() {
    const list = $("#aiways-hold-list");
    if (!list) return;

    const holdList = holds();

    if (!holdList.length) {
      list.innerHTML = `
        <div class="aiways-hold-item">
          <b>등록된 판단 보류 물건이 없습니다.</b>
          <span>0건</span>
        </div>
      `;
      return;
    }

    list.innerHTML = holdList.map(item => `
      <div class="aiways-hold-item">
        <div>
          <b>🟨 ${item.name}</b><br>
          <small>${item.class_name} · ${item.reason} · ${item.time}</small>
        </div>
        <span>회의 안건</span>
      </div>
    `).join("");
  }

  function renderQuiz() {
    const progress = $("#aiways-quiz-progress");
    if (!progress) return;

    if (quizIndex >= QUIZ_DATA.length) {
      const score = quizScore * 10;
      const message =
        score >= 90 ? "당신은 인천 자원순환 전략가입니다. AI를 참고하되 판단의 중심을 놓치지 않았어요." :
        score >= 70 ? "당신은 실천형 환경 해결사입니다. 조금만 더 확인하면 교실의 기준이 될 수 있어요." :
        score >= 50 ? "당신은 성장 중인 분리배출 탐정입니다. 애매한 순간을 보류하는 태도부터 아주 좋아요." :
        "괜찮아요. 오늘은 AI와 함께 다시 판단하는 연습을 시작한 날입니다.";

      $("#aiways-quiz-progress").textContent = "퀴즈 완료";
      $("#aiways-quiz-score").textContent = `${score}점`;
      $("#aiways-quiz-bar").style.width = "100%";
      $("#aiways-quiz-emoji").textContent = "🏆";
      $("#aiways-quiz-question").textContent = message;
      $("#aiways-ox-grid").style.display = "none";
      $("#aiways-explanation").classList.remove("visible");
      $("#aiways-quiz-big-score").textContent = `${score}점`;
      $("#aiways-quiz-message").textContent = message;
      return;
    }

    const quiz = QUIZ_DATA[quizIndex];

    $("#aiways-quiz-progress").textContent = `질문 ${quizIndex + 1} / ${QUIZ_DATA.length}`;
    $("#aiways-quiz-score").textContent = `${quizScore * 10}점`;
    $("#aiways-quiz-bar").style.width = `${((quizIndex + 1) / QUIZ_DATA.length) * 100}%`;
    $("#aiways-quiz-emoji").textContent = quiz.emoji;
    $("#aiways-quiz-question").textContent = quiz.question;
    $("#aiways-ox-grid").style.display = "grid";
    $("#aiways-explanation").classList.remove("visible");
    $("#aiways-explanation").innerHTML = "";
    $("#aiways-quiz-big-score").textContent = `${quizScore * 10}점`;
    $("#aiways-quiz-message").textContent = "O/X를 선택하면 잠시 후 다음 문제로 넘어갑니다.";

    quizAnswered = false;
  }

  function answerQuiz(answer) {
    if (quizAnswered || quizIndex >= QUIZ_DATA.length) return;

    quizAnswered = true;

    const quiz = QUIZ_DATA[quizIndex];
    const correct = answer === quiz.answer;

    if (correct) quizScore += 1;

    const explanation = $("#aiways-explanation");
    if (explanation) {
      explanation.innerHTML = `
        <strong>${correct ? "정답입니다." : "다시 생각해볼 포인트입니다."}</strong><br>
        ${quiz.explanation}<br>
        <small>잠시 후 다음 문제로 넘어갑니다.</small>
      `;
      explanation.classList.add("visible");
    }

    $("#aiways-quiz-score").textContent = `${quizScore * 10}점`;
    $("#aiways-quiz-big-score").textContent = `${quizScore * 10}점`;

    setTimeout(() => {
      quizIndex += 1;
      renderQuiz();
    }, 1850);
  }

  function toast(message) {
    const old = $(".aiways-toast");
    if (old) old.remove();

    const box = document.createElement("div");
    box.className = "aiways-toast";
    box.textContent = message;
    document.body.appendChild(box);

    requestAnimationFrame(() => box.classList.add("visible"));

    setTimeout(() => {
      box.classList.remove("visible");
      setTimeout(() => box.remove(), 260);
    }, 2400);
  }

  function sectionLabel(page, index, pages) {
    const text = norm(page.textContent);
    const journeyIndex = pages.findIndex(item => {
      const itemText = norm(item.textContent);
      return itemText.includes("6차시 여정")
        || itemText.includes("차시흐름")
        || itemText.includes("차시 흐름")
        || itemText.includes("Human 1")
        || itemText.includes("1~2차시");
    });

    if (text.includes("버리는 순간") && text.includes("데이터가 되다") && index === 0) return "프로젝트";
    if (text.includes("교육과정 기반 수업설계") || text.includes("Curriculum-Based Learning Design")) return "교육과정";
    if (text.includes("H-A-H") && !text.includes("3-Second Sorting Helper App")) return "H-A-H";
    if (text.includes("6차시 여정") || text.includes("차시흐름") || text.includes("차시 흐름") || text.includes("1~2차시")) return "차시흐름";
    if (text.includes("학생 산출물 갤러리") || text.includes("3초 판단 앱") || text.includes("3-Second Sorting Helper App")) return "산출물";
    if (journeyIndex >= 0 && index > journeyIndex) return "산출물";

    return null;
  }

  function updateNavActive() {
    patchNavLabel();

    const navItems = collectNavItems();
    const pages = getPageCandidates().filter(page => !page.classList.contains("aiways-output-removed"));

    if (!pages.length || !navItems.length) return;

    const viewportCenter = window.scrollY + window.innerHeight * 0.48;

    let bestIndex = 0;
    let bestDistance = Infinity;

    pages.forEach((page, index) => {
      const top = page.offsetTop;
      const height = page.offsetHeight;
      const center = top + height * 0.46;
      const distance = Math.abs(center - viewportCenter);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    const activeLabel = sectionLabel(pages[bestIndex], bestIndex, pages) || "산출물";

    navItems.forEach(item => {
      const isActive = norm(item.textContent) === activeLabel;

      item.classList.toggle("aiways-output-nav-active", isActive);
      item.classList.toggle("aiw-nav-active", isActive);
      item.classList.toggle("op-current", isActive);
    });
  }

  function boot() {
    patchNavLabel();
    removeUnwantedPages();
    reorderOutputPages();
    ensureAppPage();
    reorderOutputPages();
    updateNavActive();

    let retry = 0;
    const timer = setInterval(() => {
      retry += 1;

      patchNavLabel();
      removeUnwantedPages();
      ensureAppPage();
      reorderOutputPages();
      updateNavActive();

      if (retry >= 16) clearInterval(timer);
    }, 350);

    window.addEventListener("scroll", updateNavActive, { passive: true });
    window.addEventListener("resize", updateNavActive, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

