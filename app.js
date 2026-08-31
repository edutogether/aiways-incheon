(() => {
  "use strict";

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("beforeunload", () => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  });

  let kioskEventTag = "";

  const DATA_CONFIG = {
    // 2026-08-26: Google Sheets/Apps Script 연동(appsScriptUrl/submitToken)
    // 완전 제거 - PC의 AI 판단 모달도 이제 다른 화면들과 같은 Firestore
    // 백엔드(saveSortingRecordToFirestore(), 아래)에만 기록한다.
    seedUrl: "./base-data-seed.tsv",
    currentSchool: "AIWays초",
    currentGrade: "5학년",
    currentClassName: "5학년 1반"
  };

  const STORAGE_RECORDS = "aiways_clean_records";
  const STORAGE_PENDING = "aiways_clean_pending_records";
  const STORAGE_PRIVACY = "aiways_clean_privacy_id";
  const SORTING_STATS_KEY = "aiways_main_sorting_stats_v1";
  const SORTING_HOLD_KEY = "aiways_main_sorting_hold_v1";
  const SORTING_DECISIONS_V2_KEY = "aiways_sorting_decisions_v2";
  const classProfileStore = window.AIWaysClassProfileStore?.createClassProfileStore?.();
  let activeClassProfile = classProfileStore?.loadClassProfile?.() || null;
  const classroomSkillRegistry = window.AIWaysClassroomSkillRegistry?.createRegistry?.();
  let teachableSkillRuntime = window.AIWaysTeachableSkillRuntime;
  let teachableSkillRuntimePromise = null;
  function loadTeachableSkillRuntime() {
    if (teachableSkillRuntime?.getSupportingSkillEvidence) return Promise.resolve(teachableSkillRuntime);
    if (teachableSkillRuntimePromise) return teachableSkillRuntimePromise;
    teachableSkillRuntimePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-aiways-supporting-skill-runtime]');
      const script = existing || document.createElement("script");
      const finish = () => {
        teachableSkillRuntime = window.AIWaysTeachableSkillRuntime;
        teachableSkillRuntime?.getSupportingSkillEvidence ? resolve(teachableSkillRuntime) : reject(new Error("Supporting skill runtime is unavailable"));
      };
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", () => reject(new Error("Supporting skill runtime failed to load")), { once: true });
      if (!existing) {
        script.async = true;
        script.src = "./teachableSkillRuntime.js";
        script.dataset.aiwaysSupportingSkillRuntime = "true";
        document.head.append(script);
      }
    }).catch(error => {
      teachableSkillRuntimePromise = null;
      throw error;
    });
    return teachableSkillRuntimePromise;
  }
  const AIWAYS_SEED_SKILL = Object.freeze({
    skillId: "aiways_seed_recycling_v1",
    name: "AI Ways Seed 분리수거 Skill",
    description: "PLASTIC, METAL, PAPER 분류를 참고 정보로 제공하는 Seed Teachable Machine Skill입니다.",
    modelType: "teachable_machine_image",
    modelBaseUrl: "https://edutogether.github.io/aiways-incheon/assets/models/aiways-seed-recycling-v1/",
    modelVersion: "layers-model",
    version: 1,
    classes: ["PLASTIC", "METAL", "PAPER"],
    visibility: "class",
    enabled: true
  });
  window.AIWaysClassroomSkillFoundation = {
    registry: classroomSkillRegistry,
    getSupportingSkillEvidence: (...args) => loadTeachableSkillRuntime().then(runtime => runtime.getSupportingSkillEvidence(...args)),
    buildSkillEvidenceContext: evidence => teachableSkillRuntime?.buildSkillEvidenceContext?.(evidence) || null
  };

  const BASE_DASHBOARD = {
    schoolObserved: 244,
    schoolClasses: 4,
    schoolHold: 36,
    todayObserved: 16,
    aiClassified: 3,
    humanConfirmed: 7,
    holdCount: 0
  };

  const BASE_CLASS_DATA = {
    "3학년 1반": { today: 13, weekly: 72, hold: 8, converted: 25, correct: 56, recycle: 31, reuse: 7, contamination: 6 },
    "3학년 2반": { today: 11, weekly: 64, hold: 9, converted: 21, correct: 48, recycle: 27, reuse: 6, contamination: 8 },
    "3학년 3반": { today: 15, weekly: 78, hold: 7, converted: 28, correct: 62, recycle: 35, reuse: 8, contamination: 5 },
    "4학년 1반": { today: 14, weekly: 74, hold: 8, converted: 27, correct: 58, recycle: 32, reuse: 8, contamination: 6 },
    "4학년 2반": { today: 17, weekly: 88, hold: 9, converted: 34, correct: 70, recycle: 40, reuse: 10, contamination: 6 },
    "4학년 3반": { today: 12, weekly: 67, hold: 10, converted: 22, correct: 50, recycle: 29, reuse: 5, contamination: 9 },
    "4학년 4반": { today: 22, weekly: 116, hold: 6, converted: 44, correct: 92, recycle: 54, reuse: 15, contamination: 4 },
    "5학년 1반": { today: 24, weekly: 128, hold: 4, converted: 52, correct: 104, recycle: 62, reuse: 18, contamination: 3 },
    "5학년 2반": { today: 21, weekly: 103, hold: 8, converted: 41, correct: 84, recycle: 48, reuse: 13, contamination: 5 },
    "5학년 3반": { today: 19, weekly: 97, hold: 10, converted: 37, correct: 76, recycle: 44, reuse: 11, contamination: 7 },
    "5학년 4반": { today: 14, weekly: 78, hold: 14, converted: 24, correct: 55, recycle: 30, reuse: 6, contamination: 11 },
    "6학년 1반": { today: 29, weekly: 142, hold: 3, converted: 60, correct: 118, recycle: 72, reuse: 20, contamination: 2 },
    "6학년 2반": { today: 20, weekly: 101, hold: 9, converted: 40, correct: 82, recycle: 49, reuse: 12, contamination: 6 },
    "6학년 3반": { today: 18, weekly: 95, hold: 11, converted: 34, correct: 74, recycle: 43, reuse: 10, contamination: 8 }
  };

  const CLASS_CONFUSION_DATA = {
    "3학년 1반": [
      ["우유갑", 31],
      ["멸균팩", 26],
      ["빨대", 21],
      ["종이컵", 16],
      ["요구르트병", 12]
    ],
    "3학년 2반": [
      ["과자봉지", 28],
      ["비닐봉투", 24],
      ["라면봉지", 19],
      ["빨대", 15],
      ["물티슈", 11]
    ],
    "3학년 3반": [
      ["종이컵", 34],
      ["코팅종이", 28],
      ["영수증", 22],
      ["스티커 붙은 종이상자", 17],
      ["휴지", 13]
    ],
    "4학년 1반": [
      ["플라스틱컵", 30],
      ["페트병", 25],
      ["생수병", 21],
      ["빨대", 17],
      ["캔류", 12]
    ],
    "4학년 2반": [
      ["멸균팩", 36],
      ["우유갑", 31],
      ["플라스틱컵", 25],
      ["과자봉지", 20],
      ["빨대", 15]
    ],
    "4학년 3반": [
      ["택배 상자", 29],
      ["아이스팩", 24],
      ["코팅종이", 20],
      ["영수증", 16],
      ["휴지", 11]
    ],
    "4학년 4반": [
      ["페트병", 42],
      ["플라스틱컵", 35],
      ["생수병", 29],
      ["캔류", 23],
      ["요구르트병", 18]
    ],
    "5학년 1반": [
      ["배달용기", 34],
      ["컵라면 용기", 31],
      ["과자봉지", 26],
      ["아이스팩", 20],
      ["빨대", 16]
    ],
    "5학년 2반": [
      ["코팅종이", 32],
      ["영수증", 27],
      ["종이컵", 22],
      ["택배 상자", 18],
      ["물티슈", 13]
    ],
    "5학년 3반": [
      ["캔류", 33],
      ["참치캔", 28],
      ["유리병", 23],
      ["페트병", 19],
      ["건전지", 14]
    ],
    "5학년 4반": [
      ["라면봉지", 27],
      ["과자봉지", 23],
      ["비닐봉투", 19],
      ["배달용기", 15],
      ["물티슈", 11]
    ],
    "6학년 1반": [
      ["배달용기", 38],
      ["아이스팩", 33],
      ["컵라면 용기", 28],
      ["건전지", 22],
      ["전구", 17]
    ],
    "6학년 2반": [
      ["페트병", 35],
      ["생수병", 30],
      ["플라스틱컵", 25],
      ["칫솔", 19],
      ["요구르트병", 14]
    ],
    "6학년 3반": [
      ["유리병", 31],
      ["참치캔", 27],
      ["캔류", 23],
      ["계란판", 18],
      ["코팅종이", 13]
    ]
  };

  const BASE_LANDFILL_DAYS = [
    { date: "2026-07-01", weekday: "월", landfillTons: 22800 },
    { date: "2026-07-02", weekday: "화", landfillTons: 18900 },
    { date: "2026-07-03", weekday: "수", landfillTons: 20600 },
    { date: "2026-07-04", weekday: "목", landfillTons: 17200 },
    { date: "2026-07-05", weekday: "금", landfillTons: 21900 },
    { date: "2026-07-06", weekday: "토", landfillTons: 18100 },
    { date: "2026-07-07", weekday: "일", landfillTons: 16400 }
  ];
  const LANDFILL_INCOMING_PERCENT = 68.3;
  const LANDFILL_REMAINING_PERCENT = 32.7;

  const quickItems = {
    paper: {
      item: "종이류",
      category: "종이류",
      guidance: "오염되지 않은 종이는 종이류로 분리배출할 수 있습니다. 물기, 음식물, 테이프, 코팅이 있으면 다시 확인합니다."
    },
    milk: {
      item: "우유갑",
      category: "종이팩",
      guidance: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 배출합니다. 일반 종이와 섞지 않는 것이 좋습니다."
    },
    cup: {
      item: "플라스틱컵",
      category: "플라스틱류",
      guidance: "남은 음료를 비우고 빨대와 뚜껑을 분리한 뒤 학교 기준에 맞게 배출합니다."
    },
    snack: {
      item: "과자 봉지",
      category: "비닐류 또는 판단 보류",
      guidance: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다. 기름기와 양념이 많으면 보류 판단이 필요합니다."
    },
    ramen: {
      item: "라면용기",
      category: "일반쓰레기 검토",
      guidance: "국물 자국과 기름기가 남아 있으면 일반쓰레기로 검토합니다. 깨끗한 재질만 학교 기준에 따라 분리합니다."
    },
    can: {
      item: "캔류",
      category: "캔류",
      guidance: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다. 이물질이 들어 있으면 먼저 제거합니다."
    },
    receipt: {
      item: "영수증",
      category: "일반쓰레기",
      guidance: "감열지 영수증은 특수 코팅이 되어 있어 일반쓰레기로 배출합니다."
    },
    vinyl: {
      item: "비닐",
      category: "비닐류",
      guidance: "오염이 적은 비닐은 비닐류로 분리합니다. 음식물이나 기름기가 많으면 판단 보류가 필요합니다."
    }
  };

  const sortingDb = {
    milk: {
      label: "우유갑",
      emoji: "🥛",
      title: "AI 1차 제안: 우유갑",
      category: "종이팩류",
      guide: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 배출합니다.",
      tip: "일반 종이와 종이팩은 재활용 공정이 달라 전용 수거함에 넣는 것이 좋습니다.",
      carbonSaved: 25
    },
    paper: {
      label: "종이류",
      emoji: "📄",
      title: "AI 1차 제안: 종이류",
      category: "종이류",
      guide: "물기와 음식물 오염이 없는 종이는 묶거나 정리해 종이류로 배출합니다.",
      tip: "스프링, 비닐 코팅, 테이프처럼 종이가 아닌 부분은 최대한 제거해야 합니다.",
      carbonSaved: 15
    },
    cup: {
      label: "플라스틱컵",
      emoji: "🥤",
      title: "AI 1차 제안: 플라스틱컵",
      category: "플라스틱류",
      guide: "남은 음료를 비우고 빨대와 뚜껑을 분리한 뒤 깨끗하게 헹궈 배출합니다.",
      tip: "라벨이나 실링 비닐이 잘 떨어지지 않으면 재활용 효율이 낮아질 수 있습니다.",
      carbonSaved: 32.5
    },
    ramen: {
      label: "라면용기",
      emoji: "🍜",
      title: "AI 1차 제안: 라면용기",
      category: "일반쓰레기 검토",
      guide: "기름때와 국물 자국이 남아 있으면 일반쓰레기로 검토합니다.",
      tip: "깨끗하게 세척된 흰 스티로폼만 학교 기준에 따라 분리배출할 수 있습니다.",
      carbonSaved: 5
    },
    snack: {
      label: "과자 봉지",
      emoji: "🍿",
      title: "AI 1차 제안: 과자 봉지",
      category: "비닐류",
      guide: "부스러기를 털어내고 오염이 적으면 비닐류로 배출합니다.",
      tip: "기름기와 양념이 많으면 비닐함을 오염시키므로 일반쓰레기 또는 판단 보류가 필요합니다.",
      carbonSaved: 12
    },
    can: {
      label: "캔류",
      emoji: "🥫",
      title: "AI 1차 제안: 캔류",
      category: "캔류",
      guide: "내용물을 비우고 가능하면 눌러서 캔류 수거함에 배출합니다.",
      tip: "담배꽁초나 액체가 들어 있으면 선별 과정에서 오염원이 됩니다.",
      carbonSaved: 28
    },
    receipt: {
      label: "영수증",
      emoji: "🧾",
      title: "AI 1차 제안: 영수증",
      category: "일반쓰레기",
      guide: "감열지 영수증은 특수 코팅이 되어 있어 일반쓰레기로 배출합니다.",
      tip: "영수증을 종이류에 섞으면 종이 재활용 품질을 떨어뜨릴 수 있습니다.",
      carbonSaved: 4.5
    },
    hold: {
      label: "판단 보류",
      emoji: "🟨",
      title: "AI 1차 제안: 판단 보류",
      category: "기준 확인 필요",
      guide: "복합 재질이거나 오염 상태가 애매하면 아무 데나 버리지 말고 보류함에 기록합니다.",
      tip: "판단 보류도 자원순환 역량입니다. 금요일 회의에서 기준을 함께 정해 보세요.",
      carbonSaved: 0,
      isHold: true
    }
  };

  // SORTING_JUDGEMENT_V2: rule and checklist data. This supplements the
  // original quick-item database so legacy quiz/statistics flows remain intact.
  const CHECKS = {
    empty: ["empty", "내용물을 비웠나요?"],
    rinse: ["rinse", "이물질을 헹구거나 닦았나요?"],
    label: ["label", "라벨·뚜껑·부속품을 분리했나요?"],
    material: ["material", "재질 표기와 분리 방법을 확인했나요?"],
    tape: ["tape", "테이프·송장·스티커를 제거했나요?"],
    local: ["local", "우리 지역 또는 학교 기준과 맞는지 확인했나요?"]
  };

  function checklist(...keys) {
    return keys.map(key => ({ id: CHECKS[key][0], label: CHECKS[key][1], required: true, checked: false }));
  }

  function judgementItem(config) {
    return {
      materialCandidates: [],
      disposalCandidates: [],
      visibleCautions: [],
      checklist: checklist("material", "local"),
      holdReasons: [],
      searchKeywords: [],
      carbonSaved: 0,
      ...config
    };
  }

  const sortingDbV2 = {
    "pet-bottle": judgementItem({
      label: "페트병", emoji: "🧴", objectType: "pet-bottle", category: "플라스틱류 검토", carbonSaved: 22,
      materialCandidates: ["PET 플라스틱", "라벨·뚜껑 별도 재질"], disposalCandidates: ["플라스틱류", "지역 기준 확인"],
      visibleCautions: ["내용물·라벨·뚜껑 상태는 사진만으로 확정할 수 없습니다."],
      checklist: checklist("empty", "rinse", "label", "material", "local"), primaryFlow: "플라스틱류 배출을 우선 검토",
      holdReasons: ["라벨 또는 뚜껑 재질이 불명확함", "내용물이 남아 있음"], searchKeywords: ["페트", "페트병", "생수병", "음료병", "bottle"]
    }),
    "plastic-cup": judgementItem({
      label: "플라스틱컵", emoji: "🥤", objectType: "plastic-cup", category: "플라스틱류 검토", carbonSaved: 18,
      materialCandidates: ["플라스틱", "뚜껑·빨대 별도 재질"], disposalCandidates: ["플라스틱류", "일반폐기물 또는 지역 기준"],
      visibleCautions: ["음료·음식물 오염과 재질 표기를 함께 확인하세요."],
      checklist: checklist("empty", "rinse", "label", "material", "local"), primaryFlow: "세척 후 플라스틱류 배출을 우선 검토",
      holdReasons: ["기름·음식물 오염이 심함", "재질 표기가 없음"], searchKeywords: ["플라스틱컵", "테이크아웃컵", "컵", "plastic cup"]
    }),
    "paper-cup": judgementItem({
      label: "종이컵", emoji: "☕", objectType: "paper-cup", category: "종이류 확정 금지", carbonSaved: 3,
      materialCandidates: ["코팅 종이", "복합재질 가능"], disposalCandidates: ["지역 기준 확인", "판단 보류"],
      visibleCautions: ["종이컵은 코팅 여부와 지역 수거 기준에 따라 달라질 수 있습니다."],
      checklist: checklist("empty", "rinse", "material", "local"), primaryFlow: "종이류로 바로 확정하지 말고 지역 기준 확인",
      holdReasons: ["코팅·오염 여부가 불명확함"], searchKeywords: ["종이컵", "paper cup", "코팅컵"]
    }),
    "milk-carton": judgementItem({
      label: "우유갑 / 종이팩", emoji: "🥛", objectType: "milk-carton", category: "종이팩류 검토", carbonSaved: 25,
      materialCandidates: ["종이팩", "빨대·뚜껑 별도 재질"], disposalCandidates: ["종이팩 전용 수거함", "지역 기준 확인"],
      visibleCautions: ["빨대·비닐·뚜껑은 종이팩과 분리 가능한지 확인하세요."],
      checklist: checklist("empty", "rinse", "label", "material", "local"), primaryFlow: "비우고 헹군 뒤 펼쳐 말려 종이팩 수거함을 우선 확인",
      holdReasons: ["빨대·비닐이 붙어 있음", "전용 수거함을 찾을 수 없음"], searchKeywords: ["우유갑", "우유팩", "종이팩", "멸균팩", "milk carton"]
    }),
    can: judgementItem({
      label: "캔류", emoji: "🥫", objectType: "can", category: "캔류 검토", carbonSaved: 28,
      materialCandidates: ["알루미늄", "철", "뚜껑·부속품 별도 재질"], disposalCandidates: ["캔류", "지역 기준 확인"],
      visibleCautions: ["날카로운 뚜껑과 내용물 잔여물을 확인하세요."],
      checklist: checklist("empty", "rinse", "label", "local"), primaryFlow: "내용물을 비우고 세척한 뒤 캔류 배출을 우선 검토",
      holdReasons: ["내용물이 남아 있음", "복합 부속품이 분리되지 않음"], searchKeywords: ["캔", "캔류", "알루미늄", "철캔", "can"]
    }),
    "glass-bottle": judgementItem({
      label: "유리병", emoji: "🍾", objectType: "glass-bottle", category: "유리류 검토", carbonSaved: 22,
      materialCandidates: ["유리", "뚜껑 별도 재질"], disposalCandidates: ["유리류", "깨진 유리 별도 기준"],
      visibleCautions: ["깨진 유리는 안전하게 감싼 뒤 별도 배출 기준을 확인하세요."],
      checklist: checklist("empty", "rinse", "label", "local"), primaryFlow: "내용물과 뚜껑을 분리한 뒤 유리류 배출을 우선 검토",
      holdReasons: ["깨진 유리임", "뚜껑·마개가 분리되지 않음"], searchKeywords: ["유리병", "유리", "병", "glass bottle"]
    }),
    "snack-wrapper": judgementItem({
      label: "과자 봉지", emoji: "🍪", objectType: "snack-wrapper", category: "비닐류 또는 판단 보류", carbonSaved: 12,
      materialCandidates: ["비닐류", "복합 포장재 가능"], disposalCandidates: ["비닐류", "일반폐기물 또는 지역 기준"],
      visibleCautions: ["기름·가루 오염과 복합 포장재 여부를 확인하세요."],
      checklist: checklist("empty", "rinse", "material", "local"), primaryFlow: "내용물 제거 후 비닐류 배출 가능 여부를 우선 검토",
      holdReasons: ["기름·음식물 오염이 심함", "복합 포장재임"], searchKeywords: ["과자", "과자봉지", "포장지", "wrapper", "snack"]
    }),
    "vinyl-bag": judgementItem({
      label: "비닐 봉투", emoji: "🛍️", objectType: "vinyl-bag", category: "비닐류 검토", carbonSaved: 9,
      materialCandidates: ["비닐류"], disposalCandidates: ["비닐류", "일반폐기물 또는 지역 기준"],
      visibleCautions: ["음식물·기름 오염이 남아 있으면 선별이 어려울 수 있습니다."],
      checklist: checklist("empty", "rinse", "local"), primaryFlow: "이물질을 제거한 뒤 비닐류 배출을 우선 검토",
      holdReasons: ["세척하기 어려운 오염이 있음"], searchKeywords: ["비닐", "비닐봉투", "봉투", "plastic bag"]
    }),
    "ramen-container": judgementItem({
      label: "컵라면 용기", emoji: "🍜", objectType: "ramen-container", category: "재질·오염 확인 필요", carbonSaved: 5,
      materialCandidates: ["플라스틱", "발포재", "코팅 종이 가능"], disposalCandidates: ["재질 표기별 배출", "판단 보류"],
      visibleCautions: ["국물·기름 오염과 용기 재질에 따라 배출 흐름이 달라집니다."],
      checklist: checklist("empty", "rinse", "material", "local"), primaryFlow: "국물과 기름을 제거한 뒤 재질 표기와 지역 기준을 확인",
      holdReasons: ["기름 오염이 남아 있음", "재질 표기를 찾기 어려움"], searchKeywords: ["컵라면", "라면용기", "라면", "noodle cup", "ramen"]
    }),
    receipt: judgementItem({
      label: "영수증", emoji: "🧾", objectType: "receipt", category: "일반폐기물 검토", carbonSaved: 0,
      materialCandidates: ["감열지 가능", "코팅 종이 가능"], disposalCandidates: ["일반폐기물", "지역 기준 확인"],
      visibleCautions: ["감열지 영수증은 일반 종이류로 확정하지 않는 것이 안전합니다."],
      checklist: checklist("material", "local"), primaryFlow: "일반 종이류가 아닌 일반폐기물 배출을 우선 검토",
      holdReasons: ["재질을 확인할 수 없음"], searchKeywords: ["영수증", "감열지", "receipt"]
    }),
    "tape-box": judgementItem({
      label: "테이프 붙은 박스", emoji: "📦", objectType: "tape-box", category: "종이류 검토", carbonSaved: 18,
      materialCandidates: ["골판지", "테이프·송장 별도 재질"], disposalCandidates: ["종이류", "지역 기준 확인"],
      visibleCautions: ["테이프·송장·완충재를 제거하지 않으면 종이류 선별이 어려울 수 있습니다."],
      checklist: checklist("tape", "material", "local"), primaryFlow: "테이프와 송장을 제거한 뒤 종이류 배출을 우선 검토",
      holdReasons: ["테이프·코팅·오염이 많이 남아 있음"], searchKeywords: ["박스", "상자", "택배상자", "테이프", "cardboard"]
    }),
    hold: judgementItem({
      label: "기타 / 판단 보류", emoji: "🟨", objectType: "hold", category: "기준 확인 필요", carbonSaved: 0,
      materialCandidates: ["재질 미확인"], disposalCandidates: ["판단 보류", "지역 기준 확인"],
      visibleCautions: ["사진이나 이름만으로 재질·오염·복합재질을 확정할 수 없습니다."],
      checklist: checklist("material", "local"), primaryFlow: "지금은 확정하지 않고 확인이 필요한 물건으로 보류함에 저장",
      holdReasons: ["물체 후보가 불명확함", "지역 기준 확인이 필요함"], searchKeywords: ["기타", "모름", "판단보류", "unknown", "other"]
    })
  };

  Object.entries(sortingDbV2).forEach(([id, item]) => {
    item.id = id;
  });

  const sortingKeyAliases = {
    milk: "milk-carton", paper: "paper-cup", cup: "plastic-cup", ramen: "ramen-container",
    snack: "snack-wrapper", can: "can", receipt: "receipt", hold: "hold",
    bottle: "pet-bottle", pet: "pet-bottle", glass: "glass-bottle", vinyl: "vinyl-bag",
    box: "tape-box"
  };

  let teachableMachineModelPromise = null;
  let currentDraft = null;
  // classifyImage()'s full return value, kept alongside the simplified
  // currentDraft (UI-facing only: mapped_item/suggested_category/etc) so the
  // #confirmDecision handler can still build a schema-correct
  // saveSortingRecord() analysis.objectCandidates entry (needs judgementKey/
  // provider/confidenceBand, none of which currentDraft carries).
  let currentAnalysisDraft = null;
  let pendingDecision = null;
  let previewUrl = "";
  let sessionImageFile = null;
  let modalSession = 0;
  let countUpNextDashboard = false;
  let dashboardIntroActive = false;
  let dashboardAnimationScope = "";
  let dashboardRepaintTimer = 0;
  let dashboardIntroResetTimer = 0;
  let dashboardIntroStartFrame = 0;
  let dashboardIntroPlayed = false;
  let dashboardIntroRenderConsumed = false;
  let dashboardDataReady = false;
  let dashboardIntroPendingOnSettle = false;
  let lastLandfillDays = [];
  let landfillClockTimer = null;
  let holdEmojiCycleTimer = null;
  let holdEmojiSettleTimer = 0;
  let seedRecords = [];
  let remoteRecords = [];
  let latestRanking = [];
  // 개인별 랭킹(6단계) - 실명 검증 없이 학생이 자율로 적은 번호/이름을
  // 그대로 보여준다(교사가 부모 동의 하에 결정, 마스킹 없음).
  let latestTopStudents = [];
  let sortingStats = { totalCount: 0, carbonReduction: 0, logs: [] };
  let sortingHoldItems = [];
  let selectedSortingKey = "";
  let sortingJudgementRequest = 0;
  let sortingJudgementTimer = 0;
  let currentSortingJudgement = null;
  let sortingDecisionHistory = [];

  const DEMO_SORTING_LOGS = [
    { label: "우유갑", emoji: "🥛", category: "종이팩류", carbon: 25, time: "09:12", synced: true },
    { label: "플라스틱컵", emoji: "🥤", category: "플라스틱류", carbon: 32.5, time: "10:26", synced: true },
    { label: "영수증", emoji: "🧾", category: "일반쓰레기", carbon: 4.5, time: "11:08", synced: true },
    { label: "캔류", emoji: "🥫", category: "캔류", carbon: 28, time: "12:41", synced: true },
    { label: "과자 봉지", emoji: "🍪", category: "비닐류", carbon: 12, time: "13:37", synced: true },
    { label: "택배상자", emoji: "📦", category: "종이류", carbon: 18, time: "13:58", synced: true },
    { label: "라면용기", emoji: "🍜", category: "일반쓰레기 검토", carbon: 5, time: "14:16", synced: true },
    { label: "폐건전지", emoji: "🔋", category: "전용 수거함", carbon: 9, time: "14:31", synced: true },
    { label: "유리병", emoji: "🍾", category: "유리류", carbon: 22, time: "14:44", synced: true },
    { label: "코팅 종이컵", emoji: "☕", category: "판단 보류", carbon: 3.5, time: "15:02", synced: true },
    { label: "스티커 붙은 종이상자", emoji: "📦", category: "종이류 검토", carbon: 11, time: "15:17", synced: true },
    { label: "플라스틱 뚜껑", emoji: "🧴", category: "플라스틱류", carbon: 7, time: "15:35", synced: true }
  ];

  const DEMO_HOLD_ITEMS = [
    { id: "demo-coated-note", name: "코팅 공책", reason: "종이류 / 코팅 여부 논의 필요", status: "회의 안건 대기", time: "07.05 09:24", synced: true },
    { id: "demo-broken-ruler", name: "부러진 자", reason: "플라스틱류 / 일반쓰레기 기준 확인", status: "기준 확인 필요", time: "07.05 10:18", synced: true },
    { id: "demo-milk-straw", name: "우유팩 빨대 포함", reason: "종이팩 / 빨대 분리 여부 논의", status: "분류 논의 필요", time: "07.05 11:32", synced: true },
    { id: "demo-dirty-vinyl", name: "오염된 비닐봉투", reason: "비닐류 / 오염도 확인 필요", status: "회의 안건 대기", time: "07.05 12:46", synced: true },
    { id: "demo-sticker-box", name: "스티커 붙은 종이상자", reason: "종이류 / 이물질 제거 기준 확인", status: "기준 확인 필요", time: "07.05 13:05", synced: true },
    { id: "demo-black-tray", name: "검은색 배달 용기", reason: "플라스틱류 / 선별 가능 여부 확인", status: "기준 확인 필요", time: "07.05 13:34", synced: true },
    { id: "demo-wet-paper", name: "젖은 종이", reason: "종이류 / 물기와 오염도 확인", status: "분류 논의 필요", time: "07.05 14:02", synced: true },
    { id: "demo-pump-bottle", name: "펌프형 샴푸통", reason: "플라스틱류 / 금속 스프링 분리 여부", status: "회의 안건 대기", time: "07.05 14:28", synced: true },
    { id: "demo-broken-glass", name: "깨진 유리 조각", reason: "유리류 / 안전 포장과 별도 배출 기준", status: "안전 기준 확인", time: "07.05 14:51", synced: true },
    { id: "demo-coated-cup", name: "코팅 종이컵", reason: "종이류 / 코팅과 오염 상태 확인", status: "기준 확인 필요", time: "07.05 15:10", synced: true },
    { id: "demo-label-bottle", name: "라벨 안 뗀 페트병", reason: "플라스틱류 / 라벨 제거 기준 확인", status: "회의 의견 대기", time: "07.05 15:24", synced: true },
    { id: "demo-chicken-box", name: "치킨 상자", reason: "종이류 / 기름 오염도 판단 필요", status: "분류 논의 필요", time: "07.05 15:39", synced: true },
    { id: "demo-taped-delivery-box", name: "테이프 붙은 택배상자", reason: "종이류 / 테이프와 송장 제거 여부", status: "기준 확인 필요", time: "07.05 15:52", synced: true },
    { id: "demo-foil-snack", name: "은박 과자봉지", reason: "비닐류 / 복합 재질 여부 논의", status: "회의 안건 대기", time: "07.05 16:04", synced: true },
    { id: "demo-soup-ramen-cup", name: "남은 국물 묻은 컵라면 용기", reason: "일반쓰레기 검토 / 세척 가능 여부", status: "분류 논의 필요", time: "07.05 16:17", synced: true },
    { id: "demo-icecream-stick", name: "아이스크림 막대", reason: "나무류 / 오염 상태와 일반쓰레기 기준", status: "기준 확인 필요", time: "07.05 16:29", synced: true },
    { id: "demo-yogurt-bundle", name: "요구르트 병 묶음", reason: "플라스틱류 / 묶음 비닐 분리 여부", status: "회의 의견 대기", time: "07.05 16:43", synced: true },
    { id: "demo-can-lid", name: "캔 뚜껑 분리 문제", reason: "캔류 / 날카로운 뚜껑 처리 기준", status: "안전 기준 확인", time: "07.05 16:56", synced: true },
    { id: "demo-toy-piece", name: "플라스틱 장난감 조각", reason: "복합 재질 / 재활용 가능 여부 확인", status: "기준 확인 필요", time: "07.05 17:08", synced: true },
    { id: "demo-toothbrush-tube", name: "칫솔과 치약 튜브", reason: "일반쓰레기 검토 / 복합 재질 분리 어려움", status: "분류 논의 필요", time: "07.05 17:21", synced: true },
    { id: "demo-wet-tissue", name: "물티슈", reason: "일반쓰레기 / 종이류 오인 가능성 확인", status: "기준 확인 필요", time: "07.05 17:33", synced: true },
    { id: "demo-umbrella-vinyl", name: "우산 비닐", reason: "비닐류 / 물기와 오염 상태 확인", status: "회의 안건 대기", time: "07.05 17:47", synced: true }
  ];

  const HOLD_EMOJI_CYCLE = ["🥛", "🧃", "☕", "🥤", "🧴", "🥡", "🍱", "🍜", "🥫", "🍾", "🫙", "📦", "🧾", "📄", "📘", "📰", "🗒️", "🛍️", "🍪", "🍌", "🍎", "🍊", "🥬", "🍚", "🍲", "🍗", "🍕", "🍦", "🥢", "🧻", "🪥", "🧼", "🔋", "💡", "🔩", "📎", "🧷", "👕", "🧦", "🧤", "☂️", "🎒", "✏️", "🖊️", "📏", "✂️", "🏷️", "🔌", "🎧", "📱", "💻", "💾", "💿"];

  const WASTE_EMOJI_RULES = [
    ["🧴", ["라벨 안 뗀 페트병", "라벨안뗀페트병", "페트병", "생수병", "물병", "플라스틱병"]],
    ["🍜", ["남은 국물 묻은 컵라면 용기", "남은국물묻은컵라면용기", "컵라면 용기", "컵라면", "라면용기", "라면 용기", "사발면", "라면봉지", "라면 봉지"]],
    ["📦", ["스티커 붙은 종이상자", "스티커붙은종이상자", "테이프 붙은 택배상자", "테이프붙은택배상자", "테이프 붙은 박스", "테이프붙은박스", "종이상자", "택배상자", "골판지", "박스", "상자"]],
    ["🥡", ["검은색 배달 용기", "검은색배달용기", "배달용기", "플라스틱 용기", "플라스틱용기", "반찬통", "용기"]],
    ["🍱", ["도시락 용기", "도시락용기", "도시락"]],
    ["🥛", ["우유팩 빨대 포함", "우유팩빨대포함", "우유갑", "우유팩", "멸균팩", "두유팩", "종이팩"]],
    ["🧃", ["요구르트 병 묶음", "요구르트병묶음", "요구르트병", "요구르트", "주스팩", "음료팩"]],
    ["☕", ["코팅 종이컵", "코팅종이컵", "종이컵", "코팅컵", "커피컵", "일회용컵", "컵홀더"]],
    ["🥤", ["빨대 포함 컵", "빨대포함컵", "플라스틱컵", "투명컵", "빨대컵", "텀블러", "빨대", "컵"]],
    ["🧴", ["펌프형 샴푸통", "펌프형샴푸통", "샴푸통", "린스통", "세제통", "화장품 용기", "화장품용기", "로션통", "스프레이", "분무기", "샴푸", "세제", "풀", "본드", "플라스틱"]],
    ["🧢", ["플라스틱 뚜껑", "플라스틱뚜껑", "병뚜껑", "뚜껑"]],
    ["🧸", ["플라스틱 장난감", "플라스틱장난감", "장난감"]],
    ["🧩", ["플라스틱 장난감 조각", "플라스틱장난감조각", "장난감 조각", "장난감조각", "깨진 유리 조각", "깨진유리조각", "깨진 유리", "깨진유리", "유리조각"]],
    ["📏", ["부러진 자", "부러진자", "플라스틱 자", "플라스틱자", "자"]],
    ["🛍️", ["오염된 비닐봉투", "오염된비닐봉투", "택배 비닐", "택배비닐", "비닐봉투", "비닐 봉투", "종이봉투", "쇼핑백", "지퍼백", "비닐", "봉투", "봉지"]],
    ["🍪", ["은박 과자봉지", "은박과자봉지", "과자봉지", "과자 봉지", "과자포장", "과자 포장", "스낵봉지"]],
    ["🎁", ["포장지"]],
    ["🧻", ["비닐랩", "은박지", "호일", "랩", "휴지심", "물티슈", "휴지", "키친타월", "냅킨"]],
    ["☂️", ["우산 비닐", "우산비닐", "우산"]],
    ["🥫", ["캔 뚜껑", "캔뚜껑", "알루미늄캔", "음료캔", "참치캔", "철캔", "캔"]],
    ["🔩", ["고철", "금속", "나사"]],
    ["📎", ["클립"]],
    ["🧷", ["철사"]],
    ["🍾", ["유리병", "병"]],
    ["🫙", ["소스병", "잼병"]],
    ["🪞", ["거울 조각", "거울조각", "거울"]],
    ["💡", ["형광등", "전구", "led", "LED"]],
    ["🔋", ["보조배터리", "건전지", "배터리"]],
    ["💊", ["약봉지", "알약", "약"]],
    ["💉", ["주사기"]],
    ["🥬", ["음식물쓰레기", "음식물", "김치", "채소", "야채"]],
    ["🍚", ["밥"]],
    ["🍲", ["남은 국물", "남은국물", "국물"]],
    ["🍎", ["사과껍질", "사과 껍질", "과일껍질", "과일 껍질"]],
    ["🍌", ["바나나껍질", "바나나 껍질", "바나나"]],
    ["🍊", ["귤껍질", "귤 껍질", "귤"]],
    ["🍞", ["빵"]],
    ["🍗", ["치킨상자", "치킨 상자", "치킨 박스", "치킨박스", "치킨"]],
    ["🍕", ["피자박스", "피자 박스", "피자"]],
    ["🍦", ["아이스크림 막대", "아이스크림막대", "아이스크림"]],
    ["🥢", ["나무젓가락", "젓가락"]],
    ["🥄", ["숟가락"]],
    ["📄", ["코팅 종이", "코팅종이", "코팅지", "활동지", "시험지", "프린트", "문서", "색종이", "종이"]],
    ["📘", ["코팅 공책", "코팅공책", "스프링노트", "스프링 노트", "공책", "노트"]],
    ["📰", ["신문지", "잡지"]],
    ["📚", ["책"]],
    ["🧾", ["영수증", "감열지"]],
    ["🗒️", ["포스트잇", "메모지"]],
    ["🥚", ["계란판", "달걀판", "계란", "달걀"]],
    ["😷", ["마스크"]],
    ["🪥", ["치약튜브", "치약 튜브", "칫솔", "치약"]],
    ["🧼", ["물비누", "비누"]],
    ["🧺", ["수건"]],
    ["👕", ["티셔츠", "의류", "옷"]],
    ["🧦", ["양말"]],
    ["🧤", ["고무장갑", "장갑"]],
    ["🧥", ["우비"]],
    ["👟", ["신발"]],
    ["🎒", ["가방"]],
    ["✏️", ["연필"]],
    ["🖊️", ["볼펜"]],
    ["🧽", ["지우개"]],
    ["✂️", ["가위"]],
    ["🏷️", ["스티커", "테이프", "라벨"]],
    ["🎧", ["이어폰"]],
    ["🔌", ["충전기", "케이블", "전선"]],
    ["🖱️", ["마우스"]],
    ["⌨️", ["키보드"]],
    ["📱", ["휴대폰", "태블릿"]],
    ["💻", ["노트북"]],
    ["💾", ["usb", "USB"]],
    ["⌚", ["시계"]],
    ["🧮", ["계산기"]],
    ["💿", ["cd", "CD"]],
    ["💳", ["카드"]]
  ];

  const WASTE_EMOJI_MATCHERS = WASTE_EMOJI_RULES
    .flatMap(([emoji, keywords]) => keywords.map(keyword => ({ emoji, keyword })))
    .sort((a, b) => normalizeItemText(b.keyword).compact.length - normalizeItemText(a.keyword).compact.length);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function privacyId() {
    let id = localStorage.getItem(STORAGE_PRIVACY);
    if (!id) {
      id = "anon-" + Date.now().toString(36);
      localStorage.setItem(STORAGE_PRIVACY, id);
    }
    return id;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }

  // COMMON_FINAL_FIX_START
  function animateNumber(node, target) {
    const end = Number(target);
    if (!Number.isFinite(end)) {
      node.textContent = target;
      return;
    }

    const duration = 540;
    const startTime = performance.now();
    node.textContent = "0";

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = Math.round(end * eased).toLocaleString("ko-KR");
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function shouldAnimateDashboardNumber(selector) {
    if (!countUpNextDashboard) return false;
    if (dashboardAnimationScope === "all") return true;
    if (dashboardAnimationScope === "school") return selector.includes("data-school");
    if (dashboardAnimationScope === "class") {
      return selector.includes("data-today-observed")
        || selector.includes("data-ai-classified")
        || selector.includes("data-human-confirmed");
    }
    return false;
  }

  function setDashboardNumber(selector, value) {
    const node = $(selector);
    if (!node) return;
    if (shouldAnimateDashboardNumber(selector)) animateNumber(node, value);
    else node.textContent = Number(value).toLocaleString("ko-KR");
  }

  function animateMetricText(node, finalText, duration = 760) {
    if (!node) return;
    const match = cleanText(finalText).match(/-?[\d,.]+/);
    if (!match) {
      node.textContent = finalText;
      return;
    }
    const end = Number(match[0].replace(/,/g, ""));
    const prefix = finalText.slice(0, match.index);
    const suffix = finalText.slice(match.index + match[0].length);
    const decimals = match[0].includes(".") ? 1 : 0;
    const startTime = performance.now();
    node.textContent = `${prefix}${decimals ? "0.0" : "0"}${suffix}`;

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = end * eased;
      const formatted = decimals
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString("ko-KR");
      node.textContent = `${prefix}${formatted}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
      else node.textContent = finalText;
    }

    requestAnimationFrame(tick);
  }

  function formatPercent(value) {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    const rounded = Math.round(safe * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function animateDonutFill(donut, percent, duration = 720, delay = 0) {
    if (!donut) return;
    const target = Math.max(0, Math.min(100, Number(percent) || 0));
    const span = $("span", donut);
    donut.style.setProperty("--pct", "0");
    if (span) span.textContent = "0%";
    const start = () => {
      const startTime = performance.now();

      function tick(now) {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = target * eased;
        donut.style.setProperty("--pct", value.toFixed(2));
        if (span) span.textContent = `${formatPercent(value)}%`;
        if (progress < 1) requestAnimationFrame(tick);
        else {
          donut.style.setProperty("--pct", String(target));
          if (span) span.textContent = `${formatPercent(target)}%`;
        }
      }

      requestAnimationFrame(tick);
    };

    if (delay > 0) window.setTimeout(start, delay);
    else start();
  }

  function updateDonut(donut, percent, options = {}) {
    if (!donut) return;
    const safe = Math.max(0, Math.min(100, Number(percent) || 0));
    const span = $("span", donut);
    const label = $("small", donut);
    donut.dataset.percent = String(safe);
    if (label && options.label) label.innerHTML = options.label;

    if (options.animate && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      animateDonutFill(donut, safe, options.duration || 720, options.delay || 0);
    } else {
      if (span) span.textContent = `${formatPercent(safe)}%`;
      donut.style.setProperty("--pct", String(safe));
    }
  }

  function prepareDashboardIntroState(options = {}) {
    if (!options.force && dashboardIntroPlayed) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (dashboardIntroStartFrame) {
      cancelAnimationFrame(dashboardIntroStartFrame);
      dashboardIntroStartFrame = 0;
    }
    [
      "[data-school-classes]",
      "[data-school-observed]",
      "[data-school-hold]",
      "[data-real-count]",
      "[data-hold-count]",
      "[data-pending-count]",
      "[data-today-observed]",
      "[data-ai-classified]",
      "[data-human-confirmed]"
    ].forEach(selector => {
      const node = $(selector);
      if (node) node.textContent = "0";
    });
    $$(".landfill-metrics strong").forEach((node, index) => {
      node.textContent = index === 0 ? "0t" : "0%";
    });
    $$(".bar-list b, .confusion b, .progress-stack b").forEach(node => {
      node.textContent = "0";
    });
    $$(".bar-list i, .confusion i").forEach(bar => {
      bar.style.setProperty("--value", "0%");
    });
    $$(".progress-stack em").forEach(bar => {
      bar.style.width = "0%";
    });
    $$(".donut").forEach(donut => {
      donut.style.setProperty("--pct", "0");
      const span = $("span", donut);
      if (span) span.textContent = "0%";
    });
    $$(".combo-chart .chart-area, .combo-chart .chart-line, .combo-chart .chart-points, .combo-chart .chart-average").forEach(node => {
      node.style.opacity = "0";
      node.setAttribute("opacity", "0");
    });
    $$(".combo-chart .chart-bars rect").forEach(rect => {
      const y = Number(rect.getAttribute("y")) || 0;
      const height = Number(rect.getAttribute("height")) || 0;
      rect.setAttribute("y", String(Math.round(y + height)));
      rect.setAttribute("height", "0");
      rect.style.transform = "scaleY(0)";
      rect.style.transition = "none";
    });
  }

  function resetDashboardIntroCycleForNextEntry() {
    window.clearTimeout(dashboardRepaintTimer);
    if (dashboardIntroStartFrame) {
      cancelAnimationFrame(dashboardIntroStartFrame);
      dashboardIntroStartFrame = 0;
    }
    dashboardAnimationScope = "";
    countUpNextDashboard = false;
    dashboardIntroActive = false;
    dashboardIntroPlayed = false;
    dashboardIntroRenderConsumed = false;
    dashboardIntroPendingOnSettle = false;
    $$(".school-panel, .class-panel, .landfill-panel").forEach(item => item.classList.remove("is-dashboard-repaint"));
    prepareDashboardIntroState({ force: true });
  }

  function scheduleDashboardIntroResetForNextEntry() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    window.clearTimeout(dashboardIntroResetTimer);
    dashboardIntroPlayed = false;
    dashboardIntroRenderConsumed = false;
    dashboardIntroPendingOnSettle = false;
    dashboardIntroResetTimer = window.setTimeout(() => {
      if (!document.getElementById("dashboard")?.classList.contains("is-active")) {
        resetDashboardIntroCycleForNextEntry();
      }
    }, 520);
  }

  function beginDashboardRepaint(scope, duration = 1050) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    window.clearTimeout(dashboardRepaintTimer);
    window.clearTimeout(dashboardIntroResetTimer);
    dashboardAnimationScope = scope;
    countUpNextDashboard = scope !== "landfill";
    dashboardIntroActive = scope === "all";
    const panelSelector = {
      all: ".dashboard-grid",
      school: ".school-panel",
      class: ".class-panel",
      landfill: ".landfill-panel"
    }[scope];
    const panel = panelSelector ? $(panelSelector) : null;
    $$(".school-panel, .class-panel, .landfill-panel").forEach(item => item.classList.remove("is-dashboard-repaint"));
    panel?.classList.add("is-dashboard-repaint");
    dashboardRepaintTimer = window.setTimeout(() => {
      if (dashboardAnimationScope === scope) {
        dashboardAnimationScope = "";
        countUpNextDashboard = false;
        dashboardIntroActive = false;
      }
      panel?.classList.remove("is-dashboard-repaint");
    }, duration);
  }

  function animateDashboardVisuals(scope = dashboardAnimationScope) {
    if (!scope || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (scope === "landfill" || scope === "all") animateLandfillChartSequence();
  }

  function beginDashboardIntro() {
    if (dashboardIntroPlayed || dashboardIntroActive) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      dashboardIntroPlayed = true;
      return;
    }
    dashboardIntroPlayed = true;
    dashboardIntroRenderConsumed = false;
    beginDashboardRepaint("all", 1050);
  }

  function playDashboardIntroForCurrentData(options = {}) {
    const dashboardSection = document.getElementById("dashboard");
    if (!dashboardDataReady) {
      dashboardIntroPendingOnSettle = true;
      return;
    }
    if (!dashboardSection?.classList.contains("is-active") && !options.initial) {
      dashboardIntroPendingOnSettle = true;
      return;
    }
    if (dashboardIntroPlayed || dashboardIntroActive) return;

    prepareDashboardIntroState({ force: true });
    dashboardIntroPendingOnSettle = false;
    if (dashboardIntroStartFrame) cancelAnimationFrame(dashboardIntroStartFrame);
    dashboardIntroStartFrame = requestAnimationFrame(() => {
      dashboardIntroStartFrame = 0;
      if (!dashboardSection?.classList.contains("is-active") && !options.initial) {
        dashboardIntroPendingOnSettle = true;
        return;
      }
      beginDashboardIntro();
      applyDashboard(allStoredRecords());
      // The splash's job is to cover the reset-to-zero flash, not to wait out
      // the count-up. This is the first frame with real (seed) numbers on
      // screen, so it hides here - not on the animation frame right after
      // boot() merely starts the data fetch, which used to fire before the
      // fetch had even resolved and left nothing for the fade to reveal.
      // 이미 실제 학교가 설정된 채로 부팅할 때(options.deferSplashHide)는
      // 여기서 걷지 않는다 - loadDashboardRows가 그 학교의 진짜
      // 데이터(loadSchoolDashboardFromApi)까지 받아온 뒤에 직접 걷어서,
      // 이 시드/더미 숫자가 화면에 잠깐 보였다가 진짜 학교 데이터로
      // 바뀌는 깜빡임을 막는다(사용자 지적: "더미데이터가 언뜻언뜻 보여
      // 방 분리가 안 된 것 같다" - 실제로는 다른 학교 데이터가 섞인 게
      // 아니라, 이 화면이 걷히는 타이밍이 너무 일렀던 것).
      if (!options.deferSplashHide) window.__aiwaysHideBootSplash?.();
    });
  }

  function consumeDashboardIntroRender() {
    if (dashboardAnimationScope !== "all" || dashboardIntroRenderConsumed) return;
    dashboardIntroRenderConsumed = true;
    dashboardAnimationScope = "";
    countUpNextDashboard = false;
    dashboardIntroActive = false;
  }
  // COMMON_FINAL_FIX_END

  function renderHoldList(records) {
    const list = $("#holdList");
    if (!list) return;
    if (list.closest(".sorting-app")) return;

    const holdRecords = records.filter(record => record.hold_flag || cleanText(record.final_decision).includes("보류"));
    if (!holdRecords.length) {
      list.innerHTML = "<li>아직 보류 기록이 없습니다.</li>";
      return;
    }

    list.innerHTML = holdRecords
      .slice(-6)
      .reverse()
      .map(record => `<li><strong>${escapeHtml(record.mapped_item || "미확인 물건")}</strong><span>${escapeHtml(record.suggested_category || "분류 검토")} · ${escapeHtml(record.local_time || "임시 기록")}</span></li>`)
      .join("");
  }

  function classifyRecordType(record) {
    const type = cleanText(record.input_type).toLowerCase();
    if (type) return type;
    if (record.totalScans !== undefined || record.landfillTons !== undefined) return "base";
    return "";
  }

  function normalizeGrade(value) {
    const text = cleanText(value);
    const match = text.match(/([1-6])\s*학?년?/);
    return match ? `${match[1]}학년` : DATA_CONFIG.currentGrade;
  }

  function normalizeClassOnly(value) {
    const text = cleanText(value);
    const dash = text.match(/[1-6]\s*[-반]\s*([1-9])\s*반?/);
    if (dash) return `${dash[1]}반`;
    const match = text.match(/([1-9])\s*반/);
    return match ? `${match[1]}반` : "1반";
  }

  function normalizeFullClassName(grade, className) {
    const classText = cleanText(className);
    const full = classText.match(/([1-6])\s*학년\s*([1-9])\s*반/);
    if (full) return `${full[1]}학년 ${full[2]}반`;

    const compact = classText.match(/([1-6])\s*[-반]\s*([1-9])\s*반?/);
    if (compact) return `${compact[1]}학년 ${compact[2]}반`;

    return `${normalizeGrade(grade)} ${normalizeClassOnly(classText)}`;
  }

  function toNumber(value, fallback = 0) {
    if (value === undefined || value === null || cleanText(value) === "") return fallback;
    const number = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeRecords(records) {
    return records
      .filter(record => record && typeof record === "object")
      .map(record => ({
        timestamp: record.timestamp || record.created_at || "",
        local_time: record.local_time || record.date || "",
        date: record.date || "",
        weekday: record.weekday || "",
        school: record.school || DATA_CONFIG.currentSchool,
        grade: record.grade ? normalizeGrade(record.grade) : "",
        class_name: (record.class_name || record.className) ? normalizeClassOnly(record.class_name || record.className) : "",
        input_type: classifyRecordType(record),
        final_decision: record.final_decision || record.finalLabel || record.action || "",
        hold_flag: String(record.hold_flag || "").toLowerCase() === "true" || record.hold_flag === true,
        mapped_item: record.mapped_item || record.itemName || record.item || "",
        suggested_category: record.suggested_category || record.predictedLabel || record.category || "",
        ai_raw_label: record.ai_raw_label || record.predictedLabel || "",
        ai_confidence: record.ai_confidence ?? record.confidence ?? "",
        image_saved: false,
        totalScans: toNumber(record.totalScans, NaN),
        correctScans: toNumber(record.correctScans, NaN),
        holdCount: toNumber(record.holdCount, NaN),
        recycleCount: toNumber(record.recycleCount, NaN),
        reuseCount: toNumber(record.reuseCount, NaN),
        contaminationCount: toNumber(record.contaminationCount, NaN),
        landfillTons: toNumber(record.landfillTons, NaN)
      }));
  }

  function selectedClassName() {
    const select = $("#classSelect");
    return select ? select.value : DATA_CONFIG.currentClassName;
  }

  function classParts(className) {
    const match = String(className || DATA_CONFIG.currentClassName).match(/(\d학년)\s*(\d반)/);
    return {
      grade: match ? match[1] : DATA_CONFIG.currentGrade,
      className: match ? match[2] : "1반"
    };
  }

  // -----------------------------------------------------------------
  // 3단계: PC 대시보드 실제 데이터 연결 (Firestore 집계 -> getSchoolDashboard)
  // -----------------------------------------------------------------
  const DASHBOARD_SCHOOL_ID_KEY = "aiways_pc_dashboard_school_v1";
  const DASHBOARD_SCHOOL_NAME_KEY = "aiways_pc_dashboard_school_name_v1";
  const DASHBOARD_CLASS_NUM_KEY = "aiways_pc_dashboard_classnum_v1";
  const DASHBOARD_SAMPLE_PREVIEW_KEY = "aiways_pc_sample_preview_v1";
  // 검색은 전국 학교 전부 되지만(교사가 나중에 필요한 학교를 미리
  // 찾아볼 수 있게), 실제로 데이터가 쌓이는 "방"은 이번 파일럿에
  // 참여하는 4개 학교로 한정한다 - 그 외 학교를 고르면 저장 대신
  // "서비스 준비중" 팝업을 띄운다.
  const DASHBOARD_LAUNCHED_SCHOOLS = new Set(["7341025", "7321030", "7361073", "7361064"]);
  // 4개 파일럿 학교 각각의 학년/총 반 수(교사가 확인해 줌) - 학교마다
  // 반 구성이 다 달라서(3반짜리 학교도, 9반짜리 학교도 있음)
  // #classSelect를 하드코딩된 고정 목록 대신 이 설정에 맞춰 매번 다시
  // 만든다. classNum(몇 반)은 여기 없다 - "1반 선생님도, 2반 선생님도
  // 각자 쓸 건데 특정 선생님 반을 기본값으로 미리 깔아두면 안 된다"는
  // 지적에 따라, 반 번호는 학교를 고른 다음 별도 단계에서 매번 직접
  // 고르게 한다.
  const SCHOOL_CLASS_CONFIG = {
    "7321030": { grade: "1", totalClasses: 3 },  // 인천서흥초등학교
    "7361073": { grade: "3", totalClasses: 9 },  // 인천청라초등학교
    "7341025": { grade: "5", totalClasses: 4 },  // 인천동방초등학교
    "7361064": { grade: "6", totalClasses: 7 }   // 인천마전초등학교
  };
  function applySchoolClassConfig(schoolId, classNum) {
    const config = SCHOOL_CLASS_CONFIG[schoolId];
    if (!config || !classNum) return;
    const classSelect = $("#classSelect");
    if (classSelect) {
      classSelect.replaceChildren();
      for (let n = 1; n <= config.totalClasses; n += 1) {
        const option = document.createElement("option");
        option.textContent = `${config.grade}학년 ${n}반`;
        if (String(n) === String(classNum)) option.selected = true;
        classSelect.append(option);
      }
      classSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    // #gradeSelect(학교 전체 학년별 통계용)와 #classSelect(우리반)는 서로
    // 독립된 두 <select>라 그냥 두면 안 맞을 수 있다 - getSchoolDashboard가
    // 이 둘을 각각 읽어(grade는 gradeSelect, classNum은 classSelect) 같은
    // 반을 가리킨다고 가정하고 조합하므로, 학교 설정 시 gradeSelect도 같은
    // 학년으로 맞춰준다(하드코딩된 3~6학년 목록에 없는 학년이면 새로 추가).
    const gradeSelect = $("#gradeSelect");
    if (gradeSelect) {
      const targetLabel = `${config.grade}학년`;
      let option = [...gradeSelect.options].find(item => item.textContent === targetLabel);
      if (!option) {
        option = document.createElement("option");
        option.textContent = targetLabel;
        gradeSelect.append(option);
      }
      gradeSelect.value = targetLabel;
      gradeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  // 학교별 PC/태블릿 키오스크는 한 번 학교를 설정하면(검색해서 고르거나,
  // URL에 ?school=나이스학교코드 를 붙여 열면) 그 값이 이 브라우저의
  // localStorage에 저장돼 다음부터는 계속 같은 학교로 유지된다 - 다른
  // 기기(태블릿 등)는 그 기기에서 따로 한 번 더 설정해야 한다. schoolId는
  // 학교 "이름"이 아니라 나이스(NEIS) 표준학교코드다(mobile 쪽 가입과
  // 동일한 식별자라야 같은 학교로 집계된다) - ?school= URL 트릭은 코드를
  // 직접 아는 사람만 쓰는 상급자용 지름길이고, 보통은 화면의 학교 검색
  // 입력(dashboardSchoolSetup)으로 설정한다.
  function resolveDashboardSchoolId() {
    const fromUrl = cleanText(new URLSearchParams(window.location.search).get("school") || "");
    if (fromUrl) { try { localStorage.setItem(DASHBOARD_SCHOOL_ID_KEY, fromUrl); } catch {} return fromUrl; }
    try { return cleanText(localStorage.getItem(DASHBOARD_SCHOOL_ID_KEY) || ""); } catch { return ""; }
  }
  function resolveDashboardClassNum() {
    try { return cleanText(localStorage.getItem(DASHBOARD_CLASS_NUM_KEY) || ""); } catch { return ""; }
  }
  function isSamplePreview() {
    try { return sessionStorage.getItem(DASHBOARD_SAMPLE_PREVIEW_KEY) === "1"; } catch { return false; }
  }

  // 조용히 지나치기 쉬운 안내(예: "서비스 준비중")를 눈에 띄는 팝업으로
  // 띄운다 - 문단 텍스트만으로는 놓치기 쉽다는 지적. 열려 있는
  // <dialog>는 브라우저가 항상 "top layer"에 그려서 z-index와 무관하게
  // 다른 모든 일반 DOM보다 위에 뜨므로, 모달이 열려 있는 동안은
  // body 직속 토스트 host가 그 뒤에 가려 안 보였다(사용자 지적: "안
  // 해줌" - 실제로는 뜨고 있었지만 모달에 가려 안 보인 것). 모달이
  // 열려 있으면 모달 안의 host를, 아니면 body 직속 host를 쓴다.
  function showDashboardToast(message, duration = 2200) {
    const modal = $("#dashboardSchoolModal");
    const host = (modal?.open && $("#dashboardToastHostModal")) || $("#dashboardToastHost");
    if (!host) return;
    const toast = document.createElement("div");
    toast.className = "dashboard-toast";
    toast.textContent = message;
    host.append(toast);
    window.setTimeout(() => toast.remove(), duration);
  }

  function updateSampleBadge() {
    const badge = $("#sampleDataBadge");
    if (!badge) return;
    const hasSchool = !!resolveDashboardSchoolId();
    const previewing = isSamplePreview();
    badge.hidden = hasSchool && !previewing;
    badge.textContent = previewing && hasSchool
      ? "👀 샘플 미리보기 중 · 실제 데이터로 돌아가기"
      : "📊 샘플 데이터 보는 중 · 학교 설정하기";
  }

  // 학교가 아직 설정 안 된 PC/태블릿에서 모달로 검색-선택 UI를 띄운다 -
  // URL 트릭을 모르는 다른 교사가 그냥 열었을 때 계속 빈 화면만 보는
  // 문제(교사 지적 사항)를 해결하기 위함. dashboard-grid의 실측 튜닝된
  // 4패널 quadrant를 화면에 인라인으로 끼워넣으면 레이아웃이 밀리므로
  // (사용자 지적), 기존 #aiModal과 같은 <dialog> 오버레이 방식을 쓴다.
  // 선택하면 모달을 닫고 그 자리에서 대시보드를 다시 불러온다.
  function openDashboardSchoolModal() {
    const modal = $("#dashboardSchoolModal");
    if (!modal) return;
    $("#dashboardSchoolStepSearch").hidden = false;
    $("#dashboardSchoolStepClass").hidden = true;
    const backBtn = $("#dashboardClassBackBtn");
    if (backBtn) backBtn.hidden = true;
    const input = $("#dashboardSchoolInput");
    if (input) { input.disabled = false; input.value = ""; }
    $("#dashboardSchoolStatus").textContent = "";
    $("#dashboardSchoolResults").replaceChildren();
    document.body.classList.add("modal-open");
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
    input?.focus();
  }
  function closeDashboardSchoolModal() {
    const modal = $("#dashboardSchoolModal");
    if (!modal) return;
    document.body.classList.remove("modal-open");
    if (typeof modal.close === "function" && modal.open) modal.close();
    else modal.removeAttribute("open");
  }
  // 반 선택 단계: 학년/반을 각각 드롭다운으로 고르게 한다(전에는 반만
  // 버튼 그리드였는데, 학교마다 참여 학년도 다를 수 있어 학년도 같이
  // 고르는 게 더 일반적인 구조). 실제로 그 학교가 서비스 중인
  // 학년/반 조합(SCHOOL_CLASS_CONFIG)과 다르면 저장하지 않고 학교
  // 선택 때와 같은 토스트로 "아직 준비중"을 안내한다.
  function showClassStep(school) {
    const config = SCHOOL_CLASS_CONFIG[school.schoolCode];
    if (!config) return;
    const stepSearch = $("#dashboardSchoolStepSearch");
    const stepClass = $("#dashboardSchoolStepClass");
    const gradeSelect = $("#dashboardGradeSelect");
    const classNumSelect = $("#dashboardClassNumSelect");
    const confirmBtn = $("#dashboardClassConfirmBtn");
    if (!stepSearch || !stepClass || !gradeSelect || !classNumSelect || !confirmBtn) return;
    stepSearch.hidden = true;
    stepClass.hidden = false;
    const backBtn = $("#dashboardClassBackBtn");
    if (backBtn) backBtn.hidden = false;
    gradeSelect.replaceChildren();
    for (let g = 1; g <= 6; g += 1) {
      const option = document.createElement("option");
      option.value = String(g);
      option.textContent = `${g}학년`;
      gradeSelect.append(option);
    }
    gradeSelect.value = config.grade;
    classNumSelect.replaceChildren();
    for (let n = 1; n <= 15; n += 1) {
      const option = document.createElement("option");
      option.value = String(n);
      option.textContent = `${n}반`;
      classNumSelect.append(option);
    }
    classNumSelect.value = "1";
    confirmBtn.onclick = () => {
      const grade = gradeSelect.value;
      const classNum = classNumSelect.value;
      if (grade !== config.grade || Number(classNum) > config.totalClasses) {
        showDashboardToast(`${school.schoolName} ${grade}학년 ${classNum}반은 서비스 준비중이에요. 곧 만나요 !`);
        return;
      }
      try {
        localStorage.setItem(DASHBOARD_SCHOOL_ID_KEY, school.schoolCode);
        localStorage.setItem(DASHBOARD_SCHOOL_NAME_KEY, school.schoolName);
        localStorage.setItem(DASHBOARD_CLASS_NUM_KEY, classNum);
        sessionStorage.removeItem(DASHBOARD_SAMPLE_PREVIEW_KEY);
      } catch {}
      updateSampleBadge();
      applySchoolClassConfig(school.schoolCode, classNum);
      loadSchoolDashboardFromApi();
      closeDashboardSchoolModal();
    };
  }
  // 톱니바퀴 메뉴의 "학년반 다시 설정하기" - 이미 설정된 학교는 그대로
  // 두고 반 선택 단계로 바로 연다(학교부터 다시 고르는 "초기화"와는
  // 달라야 한다는 지적 - 지금까지는 사실상 같았음).
  function openDashboardClassStepForCurrentSchool() {
    const schoolId = resolveDashboardSchoolId();
    let schoolName = "";
    try { schoolName = cleanText(localStorage.getItem(DASHBOARD_SCHOOL_NAME_KEY) || ""); } catch {}
    if (!schoolId || !SCHOOL_CLASS_CONFIG[schoolId]) { openDashboardSchoolModal(); return; }
    const modal = $("#dashboardSchoolModal");
    if (!modal) return;
    document.body.classList.add("modal-open");
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
    showClassStep({ schoolCode: schoolId, schoolName: schoolName || schoolId });
  }
  function initDashboardSchoolSetup() {
    const modal = $("#dashboardSchoolModal");
    const input = $("#dashboardSchoolInput");
    const results = $("#dashboardSchoolResults");
    const status = $("#dashboardSchoolStatus");
    const searchBtn = $("#dashboardSchoolSearchBtn");
    const stepSearch = $("#dashboardSchoolStepSearch");
    const stepClass = $("#dashboardSchoolStepClass");
    const backBtn = $("#dashboardClassBackBtn");
    if (!modal || !input || !results || !status || !stepSearch || !stepClass) return;
    $$("[data-close-school-modal]").forEach(button => button.addEventListener("click", closeDashboardSchoolModal));
    modal.addEventListener("click", event => { if (event.target === modal) closeDashboardSchoolModal(); });
    modal.addEventListener("cancel", event => { event.preventDefault(); closeDashboardSchoolModal(); });
    backBtn?.addEventListener("click", () => {
      stepClass.hidden = true;
      stepSearch.hidden = false;
      backBtn.hidden = true;
      input.focus();
    });
    $("#sampleDataBadge")?.addEventListener("click", () => {
      if (isSamplePreview() && resolveDashboardSchoolId()) {
        try { sessionStorage.removeItem(DASHBOARD_SAMPLE_PREVIEW_KEY); } catch {}
        updateSampleBadge();
        loadSchoolDashboardFromApi();
        return;
      }
      openDashboardSchoolModal();
    });
    updateSampleBadge();
    // 검색/자동 오픈 로직은 학교 미설정 상태에서만 필요하지만, 그와
    // 별개로 닫기·뒤로가기 버튼은 항상 동작해야 한다(톱니 메뉴의
    // "학년반 다시 설정하기"는 학교가 이미 설정된 상태에서도 반 선택
    // 단계를 직접 여니까, 그 안의 뒤로가기가 죽어있으면 안 된다) - 위
    // 리스너들은 그래서 이 검사보다 앞에 둔다.
    if (resolveDashboardSchoolId()) return;
    openDashboardSchoolModal();
    const client = window.AIWaysEdu2gClient;
    let debounceTimer = 0;
    let searchToken = 0;
    function selectSchool(school) {
      if (!DASHBOARD_LAUNCHED_SCHOOLS.has(school.schoolCode)) {
        showDashboardToast(`"${school.schoolName}"은(는) 서비스 준비중이에요. 곧 만나요 !`);
        return;
      }
      showClassStep(school);
    }
    async function runSearch(rawQuery) {
      const query = rawQuery.trim();
      results.replaceChildren();
      if (!query) { status.textContent = ""; return; }
      if (query.length < 2) { status.textContent = "학교 이름을 두 글자 이상 입력해 주세요."; return; }
      status.textContent = "검색하는 중이에요...";
      const token = ++searchToken;
      const response = await client?.searchSchool?.({ query });
      if (token !== searchToken) return; // a newer search already superseded this one
      // 2026-08-27 실사용 제보: 실제로는 actor_unavailable(403) 등 구체적인
      // 원인이 있었는데도 화면엔 항상 이 뭉뚱그린 문구만 떠서 원인 파악이
      // 안 됐다. edu2gBetaClient.js의 errorMessageFor()가 이미 코드별
      // 안내문구를 갖고 있으니 그걸 쓴다.
      if (!response?.ok) { status.textContent = client?.errorMessageFor?.(response?.code) || "검색에 실패했어요. 잠시 후 다시 시도해 주세요."; return; }
      const schools = response.data?.schools || [];
      if (!schools.length) { status.textContent = "검색 결과가 없어요. 학교 이름을 다시 확인해 주세요."; return; }
      status.textContent = `${schools.length}개 학교를 찾았어요. 목록에서 골라 주세요.`;
      // 같은 이름의 학교가 여러 지역에 있을 수 있어(예: 인천동방초등학교 vs
      // 인천동방중학교), 급별만으론 못 구분할 때가 있다 - 실제 도로명주소를
      // 같이 보여줘야 정확히 구분해서 고를 수 있다.
      schools.slice(0, 15).forEach(school => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.style.cssText = "display:block;width:100%;text-align:left;border:0;background:none;padding:.6rem .5rem;cursor:pointer;color:inherit";
        const title = document.createElement("strong");
        title.style.cssText = "display:block;font-weight:700;font-size:.92rem";
        title.textContent = `${school.schoolName} (${school.schoolLevel})`;
        const address = document.createElement("small");
        address.style.cssText = "display:block;margin-block-start:.15rem;color:var(--ssm-muted,#5b6572);font-size:.78rem";
        address.textContent = school.address || school.region;
        button.append(title, address);
        button.addEventListener("click", () => selectSchool(school));
        item.append(button);
        results.append(item);
      });
    }
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => runSearch(input.value), 300);
    });
    searchBtn?.addEventListener("click", () => { clearTimeout(debounceTimer); runSearch(input.value); });
  }

  // 100점 목표 4번(CSV 내보내기) - listSortingRecords는 "이 기기(actor)가
  // 저장한 기록"만 돌려준다(반/학교 전체를 모아 보는 교사용 기능이 아니라,
  // 학생 개인 기기가 자기 판단 이력을 CSV로 가져가는 용도). 학교/반 전체를
  // 모으는 "선생님용 내보내기"는 exportClassRecordsAsCsv(3단 권한체계
  // 5단계, teacherVerified 필요) 참고.
  function csvQuote(value) {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = "'" + text; // 스프레드시트 수식 주입 방지
    return `"${text.replace(/"/g, '""')}"`;
  }
  function csvRowForSortingRecord(record) {
    const createdAt = record.createdAt ? new Date(record.createdAt) : null;
    const dateLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString("ko-KR") : "";
    const statusLabel = record.status === "completed" ? "완료" : record.status === "held" ? "보류" : record.status || "";
    const selectedItemId = record.userDecision?.selectedItemId || "";
    const matchedCandidate = (record.analysis?.objectCandidates || []).find((item) => item?.itemId === selectedItemId);
    const itemLabel = matchedCandidate?.label || selectedItemId;
    const reviewLabel = record.resolutionType ? "재검토 완료" : record.status === "held" ? "재검토 대기" : "";
    return [dateLabel, statusLabel, itemLabel, reviewLabel];
  }
  function buildSortingRecordsCsv(records) {
    const header = ["날짜", "처리 상태", "판단 품목", "재검토 상태"];
    const rows = records.map(csvRowForSortingRecord);
    const bom = String.fromCharCode(0xfeff); // 엑셀에서 한글이 깨지지 않도록 BOM을 앞에 붙인다
    return bom + [header, ...rows].map((row) => row.map(csvQuote).join(",")).join("\r\n");
  }
  const CSV_MAX_PAGES = 25; // pageSize 40 * 25 = 최대 1000건까지 한 번에 모음(방어적 상한)
  async function exportMySortingRecordsAsCsv() {
    const client = window.AIWaysEdu2gClient;
    if (!client?.listSortingRecords) return;
    showDashboardToast("기록을 모으고 있어요...");
    const records = [];
    let cursor = "";
    try {
      for (let page = 0; page < CSV_MAX_PAGES; page += 1) {
        const response = await client.listSortingRecords({ pageSize: 40, cursor, statusFilter: "all" });
        if (!response.ok || !response.data) {
          showDashboardToast(client?.errorMessageFor?.(response?.code) || "기록을 불러오지 못했어요. 다시 시도해주세요.");
          return;
        }
        records.push(...(response.data.records || []));
        if (!response.data.hasMore || !response.data.nextCursor) break;
        cursor = response.data.nextCursor;
      }
    } catch {
      showDashboardToast("기록을 불러오지 못했어요. 다시 시도해주세요.");
      return;
    }
    if (!records.length) {
      showDashboardToast("아직 저장된 기록이 없어요.");
      return;
    }
    const csv = buildSortingRecordsCsv(records);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aiways-my-sorting-records-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 3단 권한체계 5단계(2026-08-31) - 위 exportMySortingRecordsAsCsv와 달리
  // 이 기기 하나가 아니라 반 전체 기록을 모은다(exportClassRecords,
  // teacherVerified 필요). 번호/이름 컬럼이 추가로 필요해 행 구성이
  // 다르다.
  function csvRowForClassRecord(record) {
    const createdAt = record.createdAt ? new Date(record.createdAt) : null;
    const dateLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString("ko-KR") : "";
    const statusLabel = record.status === "completed" ? "완료" : record.status === "held" ? "보류" : record.status || "";
    const reviewLabel = record.resolutionType ? "재검토 완료" : record.status === "held" ? "재검토 대기" : "";
    return [record.studentNumber || "", record.studentName || "", dateLabel, statusLabel, record.selectedItemId || "", reviewLabel];
  }
  function buildClassRecordsCsv(records) {
    const header = ["번호", "이름", "날짜", "처리 상태", "판단 품목", "재검토 상태"];
    const rows = records.map(csvRowForClassRecord);
    const bom = String.fromCharCode(0xfeff);
    return bom + [header, ...rows].map((row) => row.map(csvQuote).join(",")).join("\r\n");
  }
  const CLASS_CSV_MAX_PAGES = 10; // 페이지당 최대 200건 x 10 = 2000건까지 한 번에 모음
  async function exportClassRecordsAsCsv() {
    const client = window.AIWaysEdu2gClient;
    if (!client?.exportClassRecords) return;
    const grade = window.prompt("내보낼 학년을 입력해주세요.");
    if (!grade) return;
    const classNum = window.prompt("내보낼 반을 입력해주세요.");
    if (!classNum) return;
    showDashboardToast("반 전체 기록을 모으고 있어요...");
    const records = [];
    let cursor;
    try {
      for (let page = 0; page < CLASS_CSV_MAX_PAGES; page += 1) {
        const response = await client.exportClassRecords({ grade, classNum, cursor });
        if (!response.ok || !response.data) {
          showDashboardToast(response.code === "teacher_verification_required"
            ? "이 기기는 아직 선생님 인증이 안 됐어요. 먼저 '선생님 인증하기'를 해주세요."
            : client?.errorMessageFor?.(response?.code) || "기록을 불러오지 못했어요. 다시 시도해주세요.");
          return;
        }
        records.push(...(response.data.records || []));
        if (!response.data.hasMore || !response.data.nextCursor) break;
        cursor = response.data.nextCursor;
      }
    } catch {
      showDashboardToast("기록을 불러오지 못했어요. 다시 시도해주세요.");
      return;
    }
    if (!records.length) {
      showDashboardToast("아직 저장된 기록이 없어요.");
      return;
    }
    const csv = buildClassRecordsCsv(records);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aiways-class-${grade}-${classNum}-records-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 3단 권한체계 1단계(2026-08-31) - 학교 전체가 공유하는 코드 1개로 "이
  // 기기가 교사"임을 서버에 표시한다(actors/{actorId}.teacherVerified).
  // 코드 발급은 아직 관리자 화면이 없어(슈퍼어드민 단계 예정) 개발자가
  // functions/scripts/setTeacherCode.js로 미리 심어둬야 한다.
  async function verifyTeacherCodeFromPrompt() {
    const client = window.AIWaysEdu2gClient;
    if (!client?.verifyTeacherCode) return;
    const already = await client.checkTeacherStatus?.();
    if (already?.ok && already.data?.verified) {
      showDashboardToast("이미 선생님 인증이 완료된 기기예요.");
      return;
    }
    const schoolId = resolveDashboardSchoolId();
    if (!schoolId) {
      showDashboardToast("먼저 학교를 설정한 뒤 다시 시도해주세요.");
      return;
    }
    const code = window.prompt("학교에서 안내받은 선생님 인증코드를 입력해주세요.");
    if (!code) return;
    const response = await client.verifyTeacherCode({ schoolId, code });
    if (response.ok && response.data?.verified) {
      showDashboardToast("선생님 인증이 완료됐어요.");
    } else {
      showDashboardToast(response.code === "teacher_code_not_set"
        ? "이 학교는 아직 인증코드가 준비되지 않았어요. 관리자에게 문의해주세요."
        : client?.errorMessageFor?.(response?.code) || "인증코드를 다시 확인해주세요.");
    }
  }

  // 3단 권한체계 2단계(2026-08-31) - teacherVerified된 기기가 자기 학교의
  // 가입 신청을 한 명씩 승인/거절한다. 이름/번호는 학생이 자율로 적은
  // 값이라 innerHTML이 아니라 textContent로만 넣는다(그대로 신뢰하지 않음).
  async function renderTeacherApprovalList() {
    const client = window.AIWaysEdu2gClient;
    const status = $("#teacherApprovalStatus");
    const list = $("#teacherApprovalList");
    if (!client || !status || !list) return;
    status.textContent = "불러오는 중...";
    list.replaceChildren();
    const response = await client.listPendingRegistrations();
    if (!response.ok) {
      status.textContent = response.code === "teacher_verification_required"
        ? "이 기기는 아직 선생님 인증이 안 됐어요. 먼저 '선생님 인증하기'를 해주세요."
        : client?.errorMessageFor?.(response?.code) || "불러오지 못했어요. 다시 시도해주세요.";
      return;
    }
    const requests = response.data?.requests || [];
    if (!requests.length) { status.textContent = "대기중인 가입 신청이 없어요."; return; }
    status.textContent = `대기중인 신청 ${requests.length}건`;
    requests.forEach(request => {
      const row = document.createElement("li");
      const info = document.createElement("span");
      info.textContent = `${request.grade}학년 ${request.classNum}반 ${request.studentNumber}번 ${request.name}`;
      const approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.textContent = "승인";
      approveBtn.addEventListener("click", () => {
        // 승인은 거절과 달리 되돌릴 방법이 없다(거절은 학생이 재신청 가능,
        // 승인취소 기능은 없음) - 초기화 버튼도 확인창이 있는데 이보다
        // 훨씬 되돌리기 어려운 액션에 확인창이 없던 걸 감사에서 지적받음.
        if (!window.confirm(`"${info.textContent}" 학생의 가입을 승인할까요? 승인은 취소할 수 없어요.`)) return;
        decideTeacherApproval(request.actorId, "approve");
      });
      const rejectBtn = document.createElement("button");
      rejectBtn.type = "button";
      rejectBtn.textContent = "거절";
      rejectBtn.addEventListener("click", () => decideTeacherApproval(request.actorId, "reject"));
      row.append(info, approveBtn, rejectBtn);
      list.append(row);
    });
  }
  async function decideTeacherApproval(targetActorId, decision) {
    const client = window.AIWaysEdu2gClient;
    const response = await client?.decideRegistration?.({ targetActorId, decision });
    if (response?.ok) {
      showDashboardToast(decision === "approve" ? "승인했어요." : "거절했어요.");
      renderTeacherApprovalList();
    } else {
      showDashboardToast(client?.errorMessageFor?.(response?.code) || "처리하지 못했어요. 다시 시도해주세요.");
    }
  }
  function initTeacherApprovalModal() {
    const modal = $("#teacherApprovalModal");
    if (!modal) return;
    $$("[data-close-teacher-approval-modal]").forEach(button => button.addEventListener("click", () => modal.close()));
  }

  // 헤더 우상단 톱니바퀴 설정 메뉴: 학교/반 다시 설정, 샘플 데이터 보기,
  // 초기화. "샘플 데이터 보기"는 실제 학교가 설정돼 있어도 언제든 눌러서
  // 볼 수 있게 세션 동안만 유지되는 미리보기 상태로 전환한다(저장된
  // 설정 자체는 안 지움).
  function initDashboardSettingsMenu() {
    const toggle = $("#dashboardSettingsToggle");
    const menu = $("#dashboardSettingsMenu");
    if (!toggle || !menu) return;
    function closeMenu() { menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); }
    function openMenu() { menu.hidden = false; toggle.setAttribute("aria-expanded", "true"); }
    toggle.addEventListener("click", event => {
      event.stopPropagation();
      menu.hidden ? openMenu() : closeMenu();
    });
    document.addEventListener("click", event => {
      if (!menu.hidden && event.target !== toggle && !menu.contains(event.target)) closeMenu();
    });
    $("[data-settings-action='sample']")?.addEventListener("click", () => {
      closeMenu();
      try { sessionStorage.setItem(DASHBOARD_SAMPLE_PREVIEW_KEY, "1"); } catch {}
      updateSampleBadge();
      showDashboardToast("샘플 데이터를 보여드릴게요. 실제 데이터로 돌아가려면 배지를 눌러 주세요.");
    });
    $("[data-settings-action='reconfigure']")?.addEventListener("click", () => {
      closeMenu();
      openDashboardClassStepForCurrentSchool();
    });
    $("[data-settings-action='csv']")?.addEventListener("click", () => {
      closeMenu();
      exportMySortingRecordsAsCsv();
    });
    $("[data-settings-action='teacher']")?.addEventListener("click", () => {
      closeMenu();
      verifyTeacherCodeFromPrompt();
    });
    $("[data-settings-action='approvals']")?.addEventListener("click", () => {
      closeMenu();
      const modal = $("#teacherApprovalModal");
      if (typeof modal?.showModal === "function") modal.showModal();
      renderTeacherApprovalList();
    });
    $("[data-settings-action='class-csv']")?.addEventListener("click", () => {
      closeMenu();
      exportClassRecordsAsCsv();
    });
    $("[data-settings-action='reset']")?.addEventListener("click", () => {
      closeMenu();
      if (!window.confirm("정말 모두 초기화할까요? 이 기기에 설정된 학교, 학년, 반이 모두 사라지고 처음 학교 검색 화면으로 돌아가요.")) return;
      try {
        localStorage.removeItem(DASHBOARD_SCHOOL_ID_KEY);
        localStorage.removeItem(DASHBOARD_SCHOOL_NAME_KEY);
        localStorage.removeItem(DASHBOARD_CLASS_NUM_KEY);
        sessionStorage.removeItem(DASHBOARD_SAMPLE_PREVIEW_KEY);
      } catch {}
      window.location.reload();
    });
  }

  function digitsOnly(value) {
    const match = String(value || "").match(/\d+/);
    return match ? match[0] : "";
  }

  function parseTsv(text) {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const headers = (lines.shift() || "").split("\t").map(header => header.trim());
    if (!headers.length) return [];

    return lines.map(line => {
      const cells = line.split("\t");
      return headers.reduce((row, header, index) => {
        row[header] = cells[index] === undefined ? "" : cells[index];
        return row;
      }, {});
    });
  }

  async function loadSeedData() {
    try {
      const response = await fetch(DATA_CONFIG.seedUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("seed response " + response.status);
      const text = await response.text();
      seedRecords = normalizeRecords(parseTsv(text));
      return seedRecords;
    } catch {
      seedRecords = [];
      return [];
    }
  }

  function localRecords() {
    return normalizeRecords(readJson(STORAGE_RECORDS, []));
  }

  function baseRecordsForDashboard() {
    const remoteBase = remoteRecords.filter(record => record.input_type === "base");
    if (remoteBase.length) return remoteBase;
    if (seedRecords.length) return seedRecords.filter(record => record.input_type === "base");
    return [];
  }

  function actualRecordsForDashboard() {
    return normalizeRecords([
      ...remoteRecords.filter(record => record.input_type === "image" || record.input_type === "search"),
      ...localRecords()
    ]);
  }

  function allStoredRecords(extra = []) {
    return normalizeRecords([...baseRecordsForDashboard(), ...actualRecordsForDashboard(), ...extra]);
  }

  function splitRecords(records) {
    const normalized = normalizeRecords(records);
    return {
      base: normalized.filter(record => record.input_type === "base"),
      actual: normalized.filter(record => record.input_type === "image" || record.input_type === "search")
    };
  }

  function cloneBaseClasses() {
    return Object.fromEntries(
      Object.entries(BASE_CLASS_DATA).map(([name, data]) => [name, { ...data }])
    );
  }

  function setClassMetric(classes, className, field, value) {
    if (!className || !Number.isFinite(value)) return;
    if (!classes[className]) return;
    classes[className] = classes[className] || { today: 0, weekly: 0, hold: 0, converted: 0, correct: 0, recycle: 0, reuse: 0, contamination: 0 };
    classes[className][field] = value;
  }

  function baseDataFromRecords(baseRecords) {
    const dashboard = { ...BASE_DASHBOARD };
    const classes = cloneBaseClasses();
    const landfillDays = [];

    baseRecords.forEach(record => {
      const key = cleanText(record.mapped_item || record.ai_raw_label);
      const valueText = cleanText(record.final_decision || record.suggested_category);
      const value = toNumber(valueText, NaN);

      if (Object.prototype.hasOwnProperty.call(dashboard, key) && Number.isFinite(value)) {
        dashboard[key] = value;
        return;
      }

      const classFromColumns = record.class_name
        ? normalizeFullClassName(record.grade || DATA_CONFIG.currentGrade, record.class_name)
        : "";
      if (classFromColumns && Number.isFinite(record.totalScans)) {
        setClassMetric(classes, classFromColumns, "weekly", record.totalScans);
        setClassMetric(classes, classFromColumns, "correct", record.correctScans);
        setClassMetric(classes, classFromColumns, "hold", record.holdCount);
        setClassMetric(classes, classFromColumns, "converted", record.recycleCount);
        setClassMetric(classes, classFromColumns, "recycle", record.recycleCount);
        setClassMetric(classes, classFromColumns, "reuse", record.reuseCount);
        setClassMetric(classes, classFromColumns, "contamination", record.contaminationCount);
      }

      if (Number.isFinite(record.landfillTons)) {
        landfillDays.push({
          date: record.date || record.timestamp || "",
          weekday: record.weekday || "",
          landfillTons: record.landfillTons
        });
      }

      const landfillMatch = key.match(/^landfill:(.+)$/);
      if (landfillMatch && Number.isFinite(value)) {
        landfillDays.push({ date: "", weekday: landfillMatch[1], landfillTons: value });
        return;
      }

      const classMatch = key.match(/^class:(.+):(today|weekly|hold|converted|correct|recycle|reuse|contamination)$/);
      if (!classMatch || !Number.isFinite(value)) return;

      const [, className, field] = classMatch;
      setClassMetric(classes, className, field, value);
    });

    return { dashboard, classes, landfillDays };
  }

  function mergeActualIntoClasses(classes, actualRecords) {
    const merged = Object.fromEntries(Object.entries(classes).map(([name, data]) => [name, { ...data }]));

    actualRecords.forEach(record => {
      const className = record.class_name ? normalizeFullClassName(record.grade || DATA_CONFIG.currentGrade, record.class_name) : selectedClassName();
      const profile = merged[className] || { today: 0, weekly: 0, hold: 0, converted: 0, correct: 0, recycle: 0, reuse: 0, contamination: 0 };
      const decision = cleanText(record.final_decision || record.suggested_category);
      const isHold = record.hold_flag || decision.includes("보류");

      profile.today += 1;
      profile.weekly = toNumber(profile.weekly, 0) + 1;
      if (isHold) profile.hold += 1;
      else {
        profile.correct += 1;
        profile.converted += 1;
      }

      if (decision.includes("재사용")) profile.reuse += 1;
      else if (decision.includes("일반") || decision.includes("오염")) profile.contamination += 1;
      else if (decision) profile.recycle += 1;

      merged[className] = profile;
    });

    return merged;
  }

  function calculateClassScore(row) {
    return Math.round((
      toNumber(row.correct, row.converted || 0) * 2 +
      toNumber(row.recycle, 0) +
      toNumber(row.reuse, 0) * 2 +
      toNumber(row.hold, 0) * 0.5 -
      toNumber(row.contamination, 0) * 1.5
    ) * 10) / 10;
  }

  function buildClassRanking(classes) {
    return Object.entries(classes)
      .map(([name, row]) => {
        const { grade, className } = classParts(name);
        return {
          name,
          grade,
          classOnly: className,
          score: calculateClassScore(row),
          scans: toNumber(row.weekly, row.today || 0),
          correct: toNumber(row.correct, row.converted || 0),
          hold: toNumber(row.hold, 0),
          contamination: toNumber(row.contamination, 0)
        };
      })
      .filter(item => item.scans > 0)
      .sort((a, b) => b.score - a.score || b.scans - a.scans || a.name.localeCompare(b.name, "ko"))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  function getCurrentClassRank(ranking, currentClassName) {
    const { grade } = classParts(currentClassName);
    const totalRank = ranking.find(item => item.name === currentClassName) || ranking[0];
    const gradeEntries = ranking.filter(item => item.grade === grade);
    const gradeRank = Math.max(1, gradeEntries.findIndex(item => item.name === currentClassName) + 1);

    return {
      grade,
      gradeRank,
      gradeTotal: Math.max(gradeEntries.length, 1),
      totalRank: totalRank ? totalRank.rank : 1,
      total: Math.max(ranking.length, 1)
    };
  }

  function formatClassRanking(className, ranking) {
    const rank = getCurrentClassRank(ranking, className);
    return `RANKING 🥇 ${rank.grade} 중 ${rank.gradeRank}위 · 🏫 전교 ${rank.totalRank}위`;
  }

  function selectedGrade() {
    const select = $("#gradeSelect");
    if (!select) return DATA_CONFIG.currentGrade;
    const selected = select.options[select.selectedIndex];
    return cleanText(select.value) || cleanText(selected?.textContent) || DATA_CONFIG.currentGrade;
  }

  function gradeSummaries(classes) {
    const summaries = {};

    Object.entries(classes).forEach(([name, row]) => {
      const { grade } = classParts(name);
      summaries[grade] = summaries[grade] || {
        grade,
        classCount: 0,
        observed: 0,
        today: 0,
        hold: 0,
        correct: 0,
        converted: 0
      };

      const summary = summaries[grade];
      summary.classCount += 1;
      summary.observed += toNumber(row.weekly, row.today || 0);
      summary.today += toNumber(row.today, 0);
      summary.hold += toNumber(row.hold, 0);
      summary.correct += toNumber(row.correct, row.converted || 0);
      summary.converted += toNumber(row.converted, 0);
    });

    return summaries;
  }

  function aggregateSchoolDashboard(classes, grade) {
    const summaries = gradeSummaries(classes);
    const summary = summaries[grade] || Object.values(summaries)[0] || {
      grade,
      classCount: BASE_DASHBOARD.schoolClasses,
      observed: BASE_DASHBOARD.schoolObserved,
      hold: BASE_DASHBOARD.schoolHold,
      correct: 0,
      converted: 0
    };

    const observed = Math.max(1, summary.observed);
    return {
      ...summary,
      successPct: Math.round((summary.correct / observed) * 1000) / 10,
      holdPct: Math.round((summary.hold / observed) * 1000) / 10,
      summaries
    };
  }

  function renderSchoolDashboard(classes) {
    const grade = selectedGrade();
    const summary = aggregateSchoolDashboard(classes, grade);
    const allSummaries = Object.values(summary.summaries).sort((a, b) => a.grade.localeCompare(b.grade, "ko"));
    const maxObserved = Math.max(...allSummaries.map(item => item.observed), 1);

    setDashboardNumber("[data-school-classes]", summary.classCount);
    setDashboardNumber("[data-school-observed]", summary.observed);
    setDashboardNumber("[data-school-hold]", summary.hold);

    const bars = $("[data-grade-bars]");
    if (bars) {
      bars.innerHTML = allSummaries.map(item => {
        const pct = Math.max(8, Math.round((item.observed / maxObserved) * 100));
        return `<div class="${item.grade === grade ? "is-selected" : ""}"><span>${item.grade}</span><i style="--value:${pct}%"></i><b>${item.observed}</b></div>`;
      }).join("");
    }

    const animate = dashboardAnimationScope === "school" || dashboardAnimationScope === "all";
    const donuts = $$(".school-panel .donut");
    updateDonut(donuts[0], summary.successPct, {
      label: "분리 성공률",
      animate,
      duration: 720
    });
    updateDonut(donuts[1], summary.holdPct, {
      label: "판단 보류 비율",
      animate,
      duration: 720,
      delay: animate ? 90 : 0
    });
  }

  function normalizeConfusionItemName(value) {
    const text = cleanText(value);
    if (!text) return "";
    if (text.includes("스티커")) return "택배 상자";
    if (text.includes("테이프")) return "택배 상자";
    if (text.includes("멸균")) return "멸균팩";
    if (text.includes("우유") || text.includes("종이팩")) return "우유갑";
    if (text.includes("컵라면") || text.includes("라면용기")) return "컵라면 용기";
    if (text.includes("라면")) return "라면봉지";
    if (text.includes("과자")) return "과자봉지";
    if (text.includes("비닐")) return "비닐봉투";
    if (text.includes("배달")) return "배달용기";
    if (text.includes("코팅")) return "코팅종이";
    if (text.includes("영수")) return "영수증";
    if (text.includes("플라스틱컵")) return "플라스틱컵";
    if (text.includes("종이컵")) return "종이컵";
    if (text.includes("생수")) return "생수병";
    if (text.includes("페트")) return "페트병";
    if (text.includes("참치")) return "참치캔";
    if (text.includes("캔")) return "캔류";
    if (text.includes("유리")) return "유리병";
    if (text.includes("빨대")) return "빨대";
    if (text.includes("물티슈")) return "물티슈";
    if (text.includes("휴지")) return "휴지";
    if (text.includes("칫솔")) return "칫솔";
    if (text.includes("건전지") || text.includes("배터리")) return "건전지";
    if (text.includes("전구")) return "전구";
    if (text.includes("계란")) return "계란판";
    if (text.includes("요구르트") || text.includes("요거트")) return "요구르트병";
    if (text.includes("컵")) return "종이컵";
    return text;
  }

  function fallbackConfusionItems(profile) {
    const baseHold = toNumber(profile.hold, 0);
    const baseToday = toNumber(profile.today, 0);
    const balancedTop = Math.max(18, Math.round(baseToday * 0.72 + baseHold * 1.2));
    return [
      ["우유갑", balancedTop],
      ["종이컵", Math.max(14, balancedTop - 4)],
      ["과자봉지", Math.max(11, balancedTop - 8)],
      ["컵라면 용기", Math.max(9, balancedTop - 12)],
      ["영수증", Math.max(7, balancedTop - 16)]
    ];
  }

  function confusionItemsForClass(profile, classActual, className) {
    const baseItems = CLASS_CONFUSION_DATA[className] || fallbackConfusionItems(profile);
    const counts = new Map(baseItems.map(([label, value]) => [label, value]));

    classActual.forEach(record => {
      const name = normalizeConfusionItemName(record.mapped_item || record.ai_raw_label || record.final_decision);
      if (!name) return;
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return Array.from(counts, ([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  function itemEmoji(label) {
    const text = cleanText(label);
    if (text.includes("우유") || text.includes("멸균")) return "🥛";
    if (text.includes("플라스틱컵") || text.includes("종이컵") || text.includes("컵")) return "🥤";
    if (text.includes("과자") || text.includes("비닐")) return "🍪";
    if (text.includes("라면")) return "🍜";
    if (text.includes("배달")) return "🥡";
    if (text.includes("영수")) return "🧾";
    if (text.includes("스티커") || text.includes("테이프") || text.includes("상자") || text.includes("박스")) return "📦";
    if (text.includes("코팅") || text.includes("휴지")) return "📄";
    if (text.includes("빨대")) return "🥤";
    if (text.includes("물티슈")) return "🧻";
    if (text.includes("아이스팩")) return "🧊";
    if (text.includes("캔")) return "🥫";
    if (text.includes("유리")) return "🍾";
    if (text.includes("플라스틱") || text.includes("페트") || text.includes("생수") || text.includes("요구르트") || text.includes("뚜껑")) return "🧴";
    if (text.includes("택배")) return "📦";
    if (text.includes("건전지") || text.includes("배터리")) return "🔋";
    if (text.includes("전구")) return "💡";
    if (text.includes("칫솔")) return "🪥";
    if (text.includes("계란")) return "🥚";
    return "🟨";
  }

  function renderClassDashboard(profile, classActual, className, ranking) {
    // profile은 mergeActualIntoClasses()에서 이미 classActual과 동일한 실제
    // 기록을 today/hold/converted에 반영한 값이다. 여기서 classActual.length를
    // 다시 더하면 실제 제출 1건이 화면 숫자를 2씩 올리는 이중 집계가 된다.
    const today = profile.today;
    const classHold = profile.hold;
    const confirmed = profile.converted;

    setDashboardNumber("[data-today-observed]", today);
    setDashboardNumber("[data-ai-classified]", classHold);
    setDashboardNumber("[data-human-confirmed]", confirmed);

    const confusion = $(".confusion");
    if (confusion) {
      const heading = $("h3", confusion)?.outerHTML || "<h3>헷갈린 물건 TOP 5</h3>";
      const items = confusionItemsForClass(profile, classActual, className);
      const max = Math.max(...items.map(item => item.value), 1);
      confusion.innerHTML = heading + items.map(item => {
        const pct = Math.max(12, Math.round((item.value / max) * 100));
        return `<div><span><em aria-hidden="true">${itemEmoji(item.label)}</em>${escapeHtml(item.label)}</span><i style="--value:${pct}%"></i><b>${item.value}</b></div>`;
      }).join("");
    }

    const rankNote = $(".rank-note");
    if (rankNote) {
      rankNote.textContent = formatClassRanking(className, ranking);
      rankNote.setAttribute("role", "button");
      rankNote.setAttribute("tabindex", "0");
      rankNote.setAttribute("aria-label", "우리 학급 자원순환 랭킹 상세 보기");
    }
  }

  // getSchoolDashboard 응답(실제 Firestore 집계)으로 학교/반 패널을 그린다.
  // 매립지 패널은 원래도 실제 제출과 무관한 참고용 더미 데이터라 그대로 둔다.
  function renderSchoolPanelFromDashboardApi(data) {
    setDashboardNumber("[data-school-classes]", data.classCount);
    setDashboardNumber("[data-school-observed]", data.school.observedTotal);
    setDashboardNumber("[data-school-hold]", data.school.heldTotal);

    const selectedGradeDigits = digitsOnly(selectedGrade());
    const bars = $("[data-grade-bars]");
    if (bars) {
      const maxObserved = Math.max(...data.gradeBars.map(item => item.observedToday), 1);
      bars.innerHTML = data.gradeBars.map(item => {
        const pct = Math.max(8, Math.round((item.observedToday / maxObserved) * 100));
        return `<div class="${item.grade === selectedGradeDigits ? "is-selected" : ""}"><span>${item.grade}학년</span><i style="--value:${pct}%"></i><b>${item.observedToday}</b></div>`;
      }).join("");
    }

    const observedForRate = Math.max(1, data.school.observedTotal);
    const successPct = Math.round((data.school.completedTotal / observedForRate) * 1000) / 10;
    const holdPct = Math.round((data.school.heldTotal / observedForRate) * 1000) / 10;
    const animate = dashboardAnimationScope === "school" || dashboardAnimationScope === "all";
    const donuts = $$(".school-panel .donut");
    updateDonut(donuts[0], successPct, { label: "분리 성공률", animate, duration: 720 });
    updateDonut(donuts[1], holdPct, { label: "판단 보류 비율", animate, duration: 720, delay: animate ? 90 : 0 });
  }

  function renderClassPanelFromDashboardApi(selectedClass) {
    if (!selectedClass) return;
    latestTopStudents = Array.isArray(selectedClass.topStudents) ? selectedClass.topStudents : [];
    setDashboardNumber("[data-today-observed]", selectedClass.observedToday);
    setDashboardNumber("[data-ai-classified]", selectedClass.heldTotal);
    setDashboardNumber("[data-human-confirmed]", selectedClass.convertedTotal);

    const confusion = $(".confusion");
    if (confusion) {
      const heading = $("h3", confusion)?.outerHTML || "<h3>헷갈린 물건 TOP 5</h3>";
      const items = selectedClass.topItems.map(entry => ({ label: sortingDbV2[entry.itemId]?.label || entry.itemId, value: entry.count }));
      const max = Math.max(...items.map(item => item.value), 1);
      confusion.innerHTML = heading + (items.length
        ? items.map(item => {
          const pct = Math.max(12, Math.round((item.value / max) * 100));
          return `<div><span><em aria-hidden="true">${itemEmoji(item.label)}</em>${escapeHtml(item.label)}</span><i style="--value:${pct}%"></i><b>${item.value}</b></div>`;
        }).join("")
        : `<p class="confusion-empty">아직 기록이 없어요.</p>`);
    }

    const rankNote = $(".rank-note");
    if (rankNote) {
      const hasActivity = selectedClass.observedToday > 0 || selectedClass.completedTotal > 0 || selectedClass.heldTotal > 0;
      rankNote.textContent = hasActivity
        ? `RANKING 🥇 ${selectedClass.grade}학년 중 ${selectedClass.rankInGrade}위 · 🏫 전교 ${selectedClass.rankInSchool}위`
        : "아직 이 반의 기록이 없어요.";
      rankNote.setAttribute("role", "button");
      rankNote.setAttribute("tabindex", "0");
      rankNote.setAttribute("aria-label", "우리 학급 자원순환 랭킹 상세 보기");
    }
  }

  let dashboardApiSchoolNotice = false;
  async function loadSchoolDashboardFromApi() {
    // "샘플 데이터 보기"로 미리보기 중이면 실제 학교가 설정돼 있어도
    // API 호출 없이 화면의 기본(더미) 데이터를 그대로 보여준다.
    if (isSamplePreview()) return null;
    const client = window.AIWaysEdu2gClient;
    const schoolId = resolveDashboardSchoolId();
    if (!schoolId) {
      // 아직 이 PC에 학교가 설정되지 않음 - 콘솔에 한 번만 안내하고 조용히 대기.
      // (URL에 ?school=학교이름 을 붙여 한 번 열면 저장됨)
      if (!dashboardApiSchoolNotice) { dashboardApiSchoolNotice = true; console.info("[aiways] 대시보드에 표시할 학교가 설정되지 않았습니다. ?school=학교이름 으로 접속해 주세요."); }
      return null;
    }
    if (!client?.getSchoolDashboard) return null;
    const grade = digitsOnly(selectedGrade());
    // digitsOnly(selectedClassName())는 "5학년 1반" 전체 문자열에서 첫
    // 숫자(5)를 집어서, 반 번호가 아니라 학년 숫자를 classNum으로 잘못
    // 보내고 있었다(학년과 반 번호가 다른 4개 파일럿 학교 전부 이 버그에
    // 걸림 - 예: 인천동방초 5학년 1반이면 classNum이 "1"이 아니라 "5"가
    // 되어 우리반 패널이 계속 빈 데이터를 보여줬을 것). classParts로 반
    // 부분만 정확히 뽑는다.
    const classNum = digitsOnly(classParts(selectedClassName()).className);
    try {
      const response = await client.getSchoolDashboard({ schoolId, grade, classNum });
      if (!response.ok || !response.data) {
        // 예전엔 실패(429 요청 한도 초과 등)를 그냥 조용히 삼켜서, 화면이
        // 멈춰도 교사/학생이 원인을 알 방법이 전혀 없었다(사용자 지적) -
        // 매 폴링(5초)마다 토스트를 띄우면 그것대로 방해가 되니, 연속
        // 실패가 일정 횟수 쌓였을 때 한 번만 눈에 띄게 알린다.
        noteDashboardApiFailure(response);
        return null;
      }
      dashboardApiFailureStreak = 0;
      renderSchoolPanelFromDashboardApi(response.data);
      renderClassPanelFromDashboardApi(response.data.selectedClass);
      consumeDashboardIntroRender();
      return response.data;
    } catch (error) {
      noteDashboardApiFailure({ status: 0, code: error?.name || "network_error" });
      return null;
    }
  }

  let dashboardApiFailureStreak = 0;
  let dashboardApiFailureToastShown = false;
  // 2026-08-26 재감사 지적: 서버가 429(요청 초과)나 Retry-After를 돌려줘도
  // 그동안은 그냥 무시하고 5초마다 똑같이 재시도해서, 상한에 걸린 기기가
  // 스스로 자기 장애를 계속 연장시켰다. 다음 폴링까지 최소 이만큼(초)은
  // 쉬어야 한다는 값을 여기 저장해두고, 폴링 루프가 이 값을 참고한다.
  let dashboardApiBackoffSeconds = 0;
  function noteDashboardApiFailure(response) {
    dashboardApiFailureStreak += 1;
    console.warn("[aiways] 대시보드 갱신 실패", response?.status, response?.code);
    // 2026-08-29 대표님 지시: 이 기기(actor)는 최초 조회한 학교로 서버에
    // 영구히 고정돼 있어서(schoolDashboard.js dashboardSchoolId 잠금),
    // 다른 학교를 골라도 매번 이 403이 돌아온다 - 새로고침으로도, 재시도로도
    // 절대 안 풀린다. 그런데 예전엔 이 경우도 그냥 "대시보드 갱신에 문제가
    // 생겼어요, 새로고침 해주세요"로 뭉뚱그려 보여줬는데, 새로고침을 아무리
    // 해도 안 풀리니 사용자를 오도하는 문구였다 - 원인을 정확히 알리고,
    // 절대 성공 못 할 폴링을 계속 두드리지 않게 멈춘다.
    const isSchoolMismatch = response?.status === 403 && response?.code === "school_mismatch";
    if (isSchoolMismatch) {
      if (!dashboardApiFailureToastShown) {
        dashboardApiFailureToastShown = true;
        showDashboardToast("이 기기는 이미 다른 학교로 연결되어 있어 학교를 바꿀 수 없어요. 관리자에게 문의해주세요.", 4200);
      }
      if (schoolDashboardLiveRefreshTimer) {
        window.clearInterval(schoolDashboardLiveRefreshTimer);
        schoolDashboardLiveRefreshTimer = 0;
      }
      return;
    }
    const isRateLimited = response?.status === 429 || response?.code === "rate_limit_exceeded";
    // 2026-08-27 재감사 지적: 429만 백오프 대상이었는데, 레이트리미터
    // 자체가 내부 오류로 막히면 서버는 429가 아니라 503+
    // protection_unavailable을 돌려준다(globalRateLimit.js) - 그 경우도
    // 똑같이 계속 5초마다 두드리면 장애 중인 백엔드를 더 몰아붙이게 된다.
    const isProtectionUnavailable = response?.status === 503 || response?.code === "protection_unavailable";
    if (isRateLimited || isProtectionUnavailable) {
      const serverRetryAfter = Number(response?.data?.retryAfterSeconds ?? response?.retryAfterSeconds);
      dashboardApiBackoffSeconds = Number.isFinite(serverRetryAfter) && serverRetryAfter > 0 ? serverRetryAfter : 10;
    }
    // 5초 폴링 기준 3연속 실패면 최소 15초는 화면이 멈춰있었다는 뜻 -
    // 그 시점에 딱 한 번만 토스트를 띄운다(재접속/새로고침 전까지 반복 안 함).
    if (dashboardApiFailureStreak >= 3 && !dashboardApiFailureToastShown) {
      dashboardApiFailureToastShown = true;
      showDashboardToast(isRateLimited || isProtectionUnavailable
        ? "실시간 갱신이 잠시 지연되고 있어요. 화면은 곧 다시 정상적으로 업데이트돼요."
        : "대시보드 갱신에 문제가 생겼어요. 화면을 새로고침 해주세요.");
    }
  }

  let schoolDashboardLiveRefreshTimer = 0;
  function startSchoolDashboardLiveRefresh() {
    if (schoolDashboardLiveRefreshTimer) return;
    // 이 파일럿 규모(학교 4곳)에서는 20초든 5초든 Firestore/Functions
    // 비용 차이가 무시할 수준이라, 체감(박람회에서 찍자마자 화면 앞으로
    // 달려와 확인하는 상황)을 기준으로 5초로 줄였다. 다만 서버가 429를
    // 돌려주면(dashboardApiBackoffSeconds) 그 시간만큼은 이 5초 주기를
    // 건너뛴다 - 매 tick마다 카운트다운만 하고 실제 요청은 안 보낸다.
    schoolDashboardLiveRefreshTimer = window.setInterval(() => {
      if (document.hidden) return;
      if (dashboardApiBackoffSeconds > 0) { dashboardApiBackoffSeconds -= 5; return; }
      loadSchoolDashboardFromApi();
    }, 5000);
  }

  function landfillDaysForChart(days) {
    const byDate = new Map();
    [...BASE_LANDFILL_DAYS, ...days].forEach(item => {
      const key = item.date || item.weekday;
      if (!key || !Number.isFinite(item.landfillTons)) return;
      byDate.set(key, {
        date: item.date || key,
        weekday: item.weekday || key,
        landfillTons: item.landfillTons
      });
    });
    const values = Array.from(byDate.values()).slice(-7);
    const fallbackValues = BASE_LANDFILL_DAYS.slice(-7);
    const chartValues = values.length === 7 ? values : fallbackValues;

    return getRecentSevenDaysLabels().map((label, index) => ({
      ...label,
      landfillTons: Number.isFinite(chartValues[index]?.landfillTons)
        ? chartValues[index].landfillTons
        : 0
    }));
  }

  function yForChart(value, min, max, top, baseline) {
    if (max <= min) return baseline;
    const clamped = Math.min(max, Math.max(min, value));
    return top + ((max - clamped) / (max - min)) * (baseline - top);
  }

  function padDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function getRecentSevenDaysLabels(referenceDate = new Date()) {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const yyyy = date.getFullYear();
      const mm = padDatePart(date.getMonth() + 1);
      const dd = padDatePart(date.getDate());
      return {
        date: `${yyyy}-${mm}-${dd}`,
        displayDate: `${mm}.${dd}`,
        weekday: weekdays[date.getDay()]
      };
    });
  }

  function formatNowCompact(now = new Date()) {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const yy = padDatePart(now.getFullYear() % 100);
    const mm = padDatePart(now.getMonth() + 1);
    const dd = padDatePart(now.getDate());
    const hh = padDatePart(now.getHours());
    const mi = padDatePart(now.getMinutes());
    const ss = padDatePart(now.getSeconds());
    return `${yy}.${mm}.${dd}(${weekdays[now.getDay()]}) ${hh}:${mi}:${ss}`;
  }

  function renderLandfillTimeNow() {
    const box = $(".landfill-time-now");
    if (!box) return;

    const update = () => {
      const now = new Date();
      const mm = padDatePart(now.getMonth() + 1);
      const dd = padDatePart(now.getDate());
      const hh = padDatePart(now.getHours());
      const mi = padDatePart(now.getMinutes());
      const ss = padDatePart(now.getSeconds());
      box.textContent = formatNowCompact(now);
      if ("dateTime" in box) box.dateTime = `${now.getFullYear()}-${mm}-${dd}T${hh}:${mi}:${ss}`;
    };

    update();
    if (!landfillClockTimer) landfillClockTimer = window.setInterval(update, 1000);
  }

  function ensureSvgItems(group, selector, tagName, count, className = "") {
    if (!group) return [];
    const ns = "http://www.w3.org/2000/svg";
    let items = $$(selector, group);
    while (items.length < count) {
      const item = document.createElementNS(ns, tagName);
      if (className) item.setAttribute("class", className);
      group.appendChild(item);
      items.push(item);
    }
    return items.slice(0, count);
  }

  function refreshLandfillMonitor() {
    renderLandfillTimeNow();
    renderLandfillChart(lastLandfillDays);
  }

  function numberFromText(value, fallback = 0) {
    const number = Number(cleanText(value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(number) ? number : fallback;
  }

  function updateLandfillDonuts(animate) {
    const progressLabels = $$(".landfill-panel .progress-stack label");
    const donuts = $$(".landfill-kpi-ring");
    const primaryValue = $("[data-landfill-primary-value]");
    const secondaryValue = $("[data-landfill-secondary-value]");
    const incomingGauge = $("[data-landfill-incoming-gauge]");
    const remainingGauge = $("[data-landfill-remaining-gauge]");

    [
      { value: LANDFILL_INCOMING_PERCENT, label: "반입량" },
      { value: LANDFILL_REMAINING_PERCENT, label: "잔여량" }
    ].forEach((item, index) => {
      const pct = Math.max(0, Math.min(100, item.value));
      const progress = progressLabels[index];
      if (progress) {
        const text = $("b", progress);
        const fill = $("em", progress);
        if (text) text.textContent = `${formatPercent(pct)}%`;
        if (fill) fill.style.width = `${pct}%`;
      }
      updateDonut(donuts[index], pct, {
        label: item.label,
        animate,
        duration: 740,
        delay: animate ? 120 + index * 90 : 0
      });
    });

    if (primaryValue) primaryValue.textContent = `${formatPercent(LANDFILL_INCOMING_PERCENT)}%`;
    if (secondaryValue) secondaryValue.textContent = `${formatPercent(LANDFILL_REMAINING_PERCENT)}%`;
    if (incomingGauge) incomingGauge.style.width = `${formatPercent(LANDFILL_INCOMING_PERCENT)}%`;
    if (remainingGauge) remainingGauge.style.width = `${formatPercent(LANDFILL_REMAINING_PERCENT)}%`;
  }

  function animateLandfillChartSequence() {
    const svg = $(".combo-chart");
    if (!svg || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const bars = $$(".chart-bars rect", svg);
    const line = $(".chart-line", svg);
    const area = $(".chart-area", svg);

    bars.forEach(bar => {
      bar.style.animation = "none";
      bar.style.transformBox = "fill-box";
      bar.style.transformOrigin = "center bottom";
    });

    if (line?.getTotalLength) {
      const length = line.getTotalLength();
      line.style.transition = "none";
      line.style.strokeDasharray = String(length);
      line.style.strokeDashoffset = String(length);
    }

    if (area) {
      area.style.transition = "none";
      area.style.setProperty("opacity", "0", "important");
    }

    svg.classList.remove("is-landfill-chart-sequencing");
    void svg.getBoundingClientRect();
    svg.classList.add("is-landfill-chart-sequencing");

    window.setTimeout(() => {
      bars.forEach((bar, index) => {
        bar.style.animation = `landfillBarGrow 760ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 38}ms both`;
      });
    }, 260);

    window.setTimeout(() => {
      if (line?.getTotalLength) {
        line.style.transition = "stroke-dashoffset 620ms cubic-bezier(0.22, 1, 0.36, 1), filter 620ms ease";
        line.style.strokeDashoffset = "0";
      }
      if (area) {
        area.style.transition = "opacity 520ms cubic-bezier(0.22, 1, 0.36, 1)";
        area.style.setProperty("opacity", "0.16", "important");
      }
    }, 1120);

    window.setTimeout(() => {
      bars.forEach(bar => {
        bar.style.animation = "";
      });
      if (line) {
        line.style.strokeDasharray = "";
        line.style.strokeDashoffset = "";
        line.style.transition = "";
      }
      if (area) area.style.transition = "";
      svg.classList.remove("is-landfill-chart-sequencing");
    }, 1880);
  }

  function renderLandfillChart(days) {
    const svg = $(".combo-chart");
    if (!svg) return;

    const chartDays = landfillDaysForChart(days);
    const ns = "http://www.w3.org/2000/svg";
    const chartTop = 4;
    const chartBottom = 220;
    const chartLeft = 40;
    const chartRight = 435;
    const chartHeight = chartBottom - chartTop;
    const yMin = 15000;
    const yMax = 23000;
    const ticks = Array.from({ length: 5 }, (_, index) => yMin + index * 2000);
    const minorTicks = Array.from({ length: 4 }, (_, index) => yMin + 1000 + index * 2000);
    const xs = chartDays.map((_, index) => chartLeft + ((chartRight - chartLeft) / Math.max(1, chartDays.length - 1)) * index);
    const yScale = value => chartBottom - ((Math.min(yMax, Math.max(yMin, value)) - yMin) / (yMax - yMin)) * chartHeight;
    const points = chartDays.map((day, index) => ({
      ...day,
      x: Math.round(xs[index] || xs[xs.length - 1]),
      y: yScale(day.landfillTons)
    }));
    const animateLandfill = dashboardAnimationScope === "landfill" || dashboardAnimationScope === "all";
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const shouldAnimate = animateLandfill && !reducedMotion;

    function appendSvg(parent, tagName, attrs = {}, text = "") {
      const node = document.createElementNS(ns, tagName);
      Object.entries(attrs).forEach(([key, value]) => {
        if (value !== undefined && value !== null) node.setAttribute(key, String(value));
      });
      if (text) node.textContent = text;
      parent.appendChild(node);
      return node;
    }

    function linePathFor(items) {
      if (!items.length) return "";
      return items
        .map((point, index) => `${index ? "L" : "M"}${point.x} ${Math.round(point.y)}`)
        .join(" ");
    }

    function smoothPathFor(items) {
      if (items.length < 2) return linePathFor(items);
      return items.reduce((path, point, index) => {
        if (index === 0) return `M${point.x} ${Math.round(point.y)}`;
        const previous = items[index - 1];
        const beforePrevious = items[index - 2] || previous;
        const next = items[index + 1] || point;
        const cp1x = previous.x + (point.x - beforePrevious.x) / 6;
        const cp1y = previous.y + (point.y - beforePrevious.y) / 6;
        const cp2x = point.x - (next.x - previous.x) / 6;
        const cp2y = point.y - (next.y - previous.y) / 6;
        return `${path} C${Math.round(cp1x)} ${Math.round(cp1y)} ${Math.round(cp2x)} ${Math.round(cp2y)} ${point.x} ${Math.round(point.y)}`;
      }, "");
    }

    function tickLabel(tick) {
      return tick >= 1000 ? `${Math.round(tick / 1000)}K` : String(tick);
    }

    svg.setAttribute("aria-label", "최근 일주일 반입량 막대와 선 그래프");
    svg.setAttribute("viewBox", "0 0 460 252");
    svg.innerHTML = "";

    const defs = appendSvg(svg, "defs");
    const areaGradient = appendSvg(defs, "linearGradient", { id: "cleanLineFill", x1: "0", x2: "0", y1: "0", y2: "1" });
    appendSvg(areaGradient, "stop", { offset: "0%", "stop-color": "#52ffe1", "stop-opacity": "0.16" });
    appendSvg(areaGradient, "stop", { offset: "58%", "stop-color": "#55c7ff", "stop-opacity": "0.075" });
    appendSvg(areaGradient, "stop", { offset: "100%", "stop-color": "#55c7ff", "stop-opacity": "0.02" });

    const barGradient = appendSvg(defs, "linearGradient", { id: "cleanBarFill", x1: "0", x2: "0", y1: "0", y2: "1" });
    appendSvg(barGradient, "stop", { offset: "0%", "stop-color": "#8cffeb", "stop-opacity": "0.98" });
    appendSvg(barGradient, "stop", { offset: "55%", "stop-color": "#59e8ff", "stop-opacity": "0.74" });
    appendSvg(barGradient, "stop", { offset: "100%", "stop-color": "#5d99ff", "stop-opacity": "0.45" });

    const glow = appendSvg(defs, "filter", { id: "landfillLineGlow", x: "-30%", y: "-30%", width: "160%", height: "160%" });
    appendSvg(glow, "feDropShadow", { dx: "0", dy: "0", stdDeviation: "2.4", "flood-color": "#65f4dc", "flood-opacity": "0.34" });

    const minorGrid = appendSvg(svg, "g", { class: "chart-minor-grid", stroke: "rgba(220,245,255,.075)", "stroke-width": "1" });
    minorTicks.forEach(tick => {
      const y = Math.round(yScale(tick));
      appendSvg(minorGrid, "path", { d: `M${chartLeft - 8} ${y} H${chartRight + 12}` });
    });

    const grid = appendSvg(svg, "g", { class: "chart-grid", stroke: "rgba(220,245,255,.15)", "stroke-width": "1" });
    const yAxis = appendSvg(svg, "g", { class: "chart-axis chart-y-axis", fill: "rgba(220,245,255,.7)", "font-size": "15", "font-weight": "800" });
    ticks.slice().reverse().forEach(tick => {
      const y = Math.round(yScale(tick));
      appendSvg(grid, "path", { d: `M${chartLeft - 8} ${y} H${chartRight + 12}` });
      appendSvg(yAxis, "text", { class: "y-label", x: "-14", y: String(y + 4) }, tickLabel(tick));
    });
    appendSvg(yAxis, "text", { class: "y-zero", x: "-6", y: String(chartBottom + 22), "text-anchor": "middle" }, "0");

    const linePath = smoothPathFor(points);
    const first = points[0];
    const last = points[points.length - 1];
    const areaPath = first && last ? `${linePath} L${last.x} ${chartBottom} L${first.x} ${chartBottom} Z` : "";
    const weeklyAverage = points.reduce((sum, point) => sum + point.landfillTons, 0) / Math.max(1, points.length);
    const averageY = Math.round(yScale(weeklyAverage));
    const area = appendSvg(svg, "path", { class: "chart-area", d: areaPath, fill: "url(#cleanLineFill)", opacity: shouldAnimate ? "0" : "0.16" });
    if (shouldAnimate) area.style.setProperty("opacity", "0", "important");
    const barsGroup = appendSvg(svg, "g", { class: "chart-bars", fill: "url(#cleanBarFill)" });
    const bars = [];

    points.forEach((point, index) => {
      const barY = Math.round(point.y);
      const barHeight = Math.max(6, Math.round(chartBottom - point.y));
      const bar = appendSvg(barsGroup, "rect", {
        x: String(point.x - 15),
        y: shouldAnimate ? String(chartBottom) : String(barY),
        width: "30",
        height: shouldAnimate ? "0" : String(barHeight),
        rx: "8",
        "aria-label": `${point.displayDate} ${point.weekday} ${Math.round(point.landfillTons).toLocaleString("ko-KR")}t`
      });
      bar.dataset.finalY = String(barY);
      bar.dataset.finalHeight = String(barHeight);
      bar.style.transformBox = "fill-box";
      bar.style.transformOrigin = "center bottom";
      bar.style.transform = shouldAnimate ? "scaleY(0)" : "scaleY(1)";
      if (shouldAnimate) {
        bar.style.transition = `transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 36}ms`;
      }
      bars.push(bar);
    });

    const line = appendSvg(svg, "path", {
      class: "chart-line",
      d: linePath,
      fill: "none",
      stroke: "#65f4dc",
      "stroke-width": "3.2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      filter: "url(#landfillLineGlow)"
    });

    const pointsGroup = appendSvg(svg, "g", { class: "chart-points" });
    points.forEach(point => {
      appendSvg(pointsGroup, "circle", { cx: String(point.x), cy: String(Math.round(point.y)), r: "3.7" });
    });

    const averageGroup = appendSvg(svg, "g", { class: "chart-average" });
    appendSvg(averageGroup, "path", {
      d: `M${chartLeft - 8} ${averageY} H${chartRight + 12}`,
      stroke: "rgba(255,232,128,.96)",
      "stroke-width": "3.8",
      "stroke-dasharray": "7 6",
      "stroke-linecap": "round"
    });
    appendSvg(averageGroup, "text", { x: String(chartRight + 8), y: String(averageY - 10), "text-anchor": "end", "font-size": "14", "font-weight": "800", fill: "rgba(255,232,128,.96)" }, "주간 평균");

    const xAxis = appendSvg(svg, "g", { class: "chart-axis chart-x-axis", fill: "rgba(220,245,255,.75)", "font-size": "12.5", "font-weight": "800" });
    points.forEach(point => {
      const label = appendSvg(xAxis, "text", { class: "x-label", x: String(point.x), y: String(chartBottom + 25), "text-anchor": "middle" });
      appendSvg(label, "tspan", { class: "date-label", x: String(point.x), dy: "0" }, point.displayDate);
      appendSvg(label, "tspan", { class: "weekday-label", x: String(point.x), dy: "17" }, point.weekday);
    });

    if (shouldAnimate) {
      if (line?.getTotalLength) {
        const length = line.getTotalLength();
        line.style.strokeDasharray = String(length);
        line.style.strokeDashoffset = String(length);
        line.style.transition = "none";
      }

      const startChartAnimation = () => {
        bars.forEach(bar => {
          bar.setAttribute("y", bar.dataset.finalY);
          bar.setAttribute("height", bar.dataset.finalHeight);
          bar.style.transform = "scaleY(1)";
        });

        window.setTimeout(() => {
          if (line?.getTotalLength) {
            line.style.transition = "stroke-dashoffset 620ms cubic-bezier(0.22, 1, 0.36, 1), filter 620ms ease";
            line.style.strokeDashoffset = "0";
          }
          area.style.transition = "opacity 560ms cubic-bezier(0.22, 1, 0.36, 1)";
          area.style.setProperty("opacity", "0.16", "important");
        }, 720);
      };

      requestAnimationFrame(() => requestAnimationFrame(startChartAnimation));
    }

    const landfillMetricNodes = $$(".landfill-metrics strong");
    const totalNode = landfillMetricNodes[0];
    if (totalNode && last) {
      const totalText = Math.round(last.landfillTons).toLocaleString("ko-KR") + "t";
      if (animateLandfill) animateMetricText(totalNode, totalText, 620);
      else totalNode.textContent = totalText;
    }

    const previous = points[points.length - 2];
    const dayOverDay = previous?.landfillTons
      ? ((last.landfillTons - previous.landfillTons) / previous.landfillTons) * 100
      : 0;
    const dayOverDayText = `${dayOverDay > 0 ? "+" : ""}${Math.round(dayOverDay * 10) / 10}%`;
    const landfillMetrics = [
      null,
      dayOverDayText,
      `${formatPercent(LANDFILL_INCOMING_PERCENT)}%`,
      `${formatPercent(LANDFILL_REMAINING_PERCENT)}%`
    ];

    landfillMetrics.forEach((value, index) => {
      const node = landfillMetricNodes[index];
      if (!node || value === null) return;
      if (animateLandfill) animateMetricText(node, value, 620);
      else node.textContent = value;
    });

    updateLandfillDonuts(animateLandfill);
  }

  function escapeHtml(value) {
    return cleanText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureRankingModal() {
    let modal = $("#rankingModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "rankingModal";
    modal.className = "ranking-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="ranking-dialog" role="dialog" aria-modal="true" aria-labelledby="rankingModalTitle">
        <button class="ranking-close" type="button" aria-label="랭킹 닫기">×</button>
        <p class="eyebrow">Class Resource Ranking</p>
        <h2 id="rankingModalTitle">우리반 자원순환 레이스</h2>
        <div class="ranking-tabs" role="tablist" aria-label="랭킹 범위">
          <button class="ranking-tab is-active" type="button" data-ranking-scope="all">전체</button>
          <button class="ranking-tab" type="button" data-ranking-scope="3학년">3학년</button>
          <button class="ranking-tab" type="button" data-ranking-scope="4학년">4학년</button>
          <button class="ranking-tab" type="button" data-ranking-scope="5학년">5학년</button>
          <button class="ranking-tab" type="button" data-ranking-scope="6학년">6학년</button>
        </div>
        <div class="ranking-podium" aria-label="상위 3개 학급"></div>
        <div class="ranking-race-wrap">
          <div class="ranking-race-head"><span>학급 레이스</span></div>
          <div class="ranking-race-list"></div>
        </div>
        <div class="ranking-student-wrap ranking-race-wrap">
          <div class="ranking-race-head"><span>우리반 실천왕</span></div>
          <div class="ranking-student-list ranking-race-list"></div>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", event => {
      const tab = event.target.closest("[data-ranking-scope]");
      if (!tab || !modal.contains(tab)) return;
      $$(".ranking-tab", modal).forEach(button => button.classList.toggle("is-active", button === tab));
      renderRankingModalRows(modal);
    });
    return modal;
  }

  function renderRankingModalRows(modal) {
    const podium = $(".ranking-podium", modal);
    const list = $(".ranking-race-list", modal);
    if (!podium || !list) return;
    const current = selectedClassName();
    const rows = latestRanking.length ? latestRanking : buildClassRanking(cloneBaseClasses());
    const scope = $(".ranking-tab.is-active", modal)?.dataset.rankingScope || "all";
    const scopedRows = (scope === "all" ? rows : rows.filter(item => item.grade === scope))
      .map((item, index) => ({ ...item, rank: index + 1 }));
    const maxScore = Math.max(...scopedRows.map(item => item.score), 1);
    const mascotsByClass = {
      "3학년 1반": "🐰",
      "3학년 2반": "🐼",
      "3학년 3반": "🦊",
      "4학년 1반": "🐻",
      "4학년 2반": "🐸",
      "4학년 3반": "🐬",
      "4학년 4반": "🐿️",
      "5학년 1반": "🐱",
      "5학년 2반": "🐧",
      "5학년 3반": "🦁",
      "5학년 4반": "🐨",
      "6학년 1반": "🐯",
      "6학년 2반": "🐹",
      "6학년 3반": "🦄"
    };
    const fallbackMascots = ["🦝", "🦉", "🦭", "🦋", "🐢", "🦔", "🐳"];
    const medal = ["🥇", "🥈", "🥉"];

    function mascotFor(item, index) {
      const key = cleanText(item.name || item.classOnly);
      if (mascotsByClass[key]) return mascotsByClass[key];
      const sum = Array.from(key).reduce((acc, char) => acc + char.charCodeAt(0), index);
      return fallbackMascots[sum % fallbackMascots.length];
    }

    function statsLine(item) {
      return `판독 ${item.scans.toLocaleString("ko-KR")} · 정확 ${item.correct.toLocaleString("ko-KR")} · 보류 ${item.hold.toLocaleString("ko-KR")} · 오염 ${item.contamination.toLocaleString("ko-KR")}`;
    }

    podium.innerHTML = scopedRows.slice(0, 3).map((item, index) => `
      <article class="podium-card podium-${index + 1} ${item.name === current ? "is-current" : ""}">
        <span class="podium-medal">${medal[index]}</span>
        <b>${mascotFor(item, index)}</b>
        <strong>${escapeHtml(item.grade)} ${escapeHtml(item.classOnly)}</strong>
        <em>${item.score.toLocaleString("ko-KR")}점</em>
      </article>
    `).join("");

    list.innerHTML = scopedRows.map((item, index) => {
      const pct = Math.max(8, Math.round((item.score / maxScore) * 100));
      return `
        <article class="race-row ${item.name === current ? "is-current" : ""}">
          <span class="race-rank">${item.rank}</span>
          <span class="race-mascot" aria-hidden="true">${mascotFor(item, index)}</span>
          <div class="race-body">
            <div class="race-title">
              <strong>${escapeHtml(item.grade)} ${escapeHtml(item.classOnly)}</strong>
              <small>${statsLine(item)}</small>
              <b>${item.score.toLocaleString("ko-KR")}점</b>
            </div>
            <i><em style="width:${pct}%"></em></i>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderTopStudentsModalRows(modal) {
    const list = $(".ranking-student-list", modal);
    const wrap = $(".ranking-student-wrap", modal);
    if (!list || !wrap) return;
    wrap.hidden = latestTopStudents.length === 0;
    list.innerHTML = latestTopStudents.map((item, index) => `
      <article class="race-row">
        <span class="race-rank">${index + 1}</span>
        <div class="race-body">
          <div class="race-title">
            <strong>${escapeHtml(item.studentNumber)}번 ${escapeHtml(item.studentName || "이름 없음")}</strong>
            <b>${item.completedTotal.toLocaleString("ko-KR")}회</b>
          </div>
        </div>
      </article>
    `).join("");
  }

  function openRankingModal() {
    const modal = ensureRankingModal();
    renderRankingModalRows(modal);
    renderTopStudentsModalRows(modal);
    modal.hidden = false;
    document.body.classList.add("ranking-modal-open");
    requestAnimationFrame(() => modal.classList.add("is-open"));
    $(".ranking-close", modal)?.focus();
  }

  function closeRankingModal() {
    const modal = $("#rankingModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    document.body.classList.remove("ranking-modal-open");
    window.setTimeout(() => {
      modal.hidden = true;
    }, 160);
  }

  function resetInternalScrollState(root = document) {
    if (!root) return;
    $$(
      "#sortingTimeline, #holdList, .ranking-race-list, .ranking-dialog, .gallery-detail, .gallery-detail-grid, .tab-panel, [data-scroll-reset]",
      root
    ).forEach(node => {
      if ("scrollTop" in node) node.scrollTop = 0;
    });
  }

  function resetRankingModalUiState() {
    const modal = $("#rankingModal");
    if (!modal) return;
    $$(".ranking-tab", modal).forEach(button => {
      button.classList.toggle("is-active", button.dataset.rankingScope === "all");
    });
    resetInternalScrollState(modal);
    modal.classList.remove("is-open");
    modal.hidden = true;
    document.body.classList.remove("ranking-modal-open");
  }

  function closeAllOpenOverlays() {
    closeModal();
    resetRankingModalUiState();
    document.body.classList.remove("modal-open", "ranking-modal-open");
  }

  function resetGalleryUiState() {
    const stage = $("#galleryStage");
    if (!stage) return;
    stage.classList.remove("is-detail", "is-active", "is-expanded");
    $$("[data-gallery]", stage).forEach(card => card.classList.remove("is-active", "is-selected", "is-expanded"));
    const grid = $("#galleryDetailGrid", stage);
    if (grid) grid.innerHTML = "";
    resetInternalScrollState(stage);
  }

  function resetTransientUiState(section) {
    if (!section) return;
    if (section.id === "gallery") resetGalleryUiState();
    resetInternalScrollState(section);
  }

  function resetSectionEntryState(section) {
    if (!section) return;
    closeAllOpenOverlays();
    if (section.id === "gallery") resetGalleryUiState();
    resetInternalScrollState(section);
  }

  function applyDashboard(records) {
    const { base, actual } = splitRecords(records.length ? records : allStoredRecords());
    const { dashboard, classes, landfillDays } = baseDataFromRecords(base);
    const baseImage = base.filter(record => record.input_type === "base");
    const imageRecords = actual.filter(record => record.input_type === "image");
    const holdRecords = actual.filter(record => record.hold_flag || cleanText(record.final_decision).includes("보류"));
    const className = selectedClassName();
    const mergedClasses = mergeActualIntoClasses(classes, actual);
    const profile = mergedClasses[className] || mergedClasses[DATA_CONFIG.currentClassName];
    const classActual = actual.filter(record => {
      const label = [record.grade, record.class_name].filter(Boolean).join(" ");
      return !label || label === className;
    });

    renderSchoolDashboard(mergedClasses);
    setDashboardNumber("[data-real-count]", actual.length);
    setDashboardNumber("[data-hold-count]", holdRecords.length);
    setDashboardNumber("[data-pending-count]", readJson(STORAGE_PENDING, []).length);

    if (baseImage.length) {
      document.body.dataset.hasSheetBase = "true";
    }

    latestRanking = buildClassRanking(mergedClasses);
    renderClassDashboard(profile, classActual, className, latestRanking);
    lastLandfillDays = landfillDays;
    renderLandfillChart(landfillDays);
    renderHoldList(holdRecords);
    consumeDashboardIntroRender();
  }

  // 예전엔 여기서 구글시트(Code.gs) JSONP를 폴링해 school-panel/class-panel을
  // 채웠다. 3단계부터는 그 자리를 loadSchoolDashboardFromApi()(Firestore 집계
  // 읽기, 위쪽에 정의)가 대신한다 - 매립지 패널만 여전히 seed 기반 참고용
  // 데이터라 applyDashboard()가 그대로 담당한다.
  async function loadDashboardRows(options = {}) {
    await loadSeedData();
    dashboardDataReady = true;
    applySchoolClassConfig(resolveDashboardSchoolId(), resolveDashboardClassNum());
    // 이미 실제 학교가 설정된 채로 부팅하는 경우, 부트 스플래시를 이
    // 학교의 진짜 데이터가 도착할 때까지 걷지 않는다(deferSplashHide) -
    // 그래야 시드/더미 숫자가 화면에 잠깐 노출됐다가 진짜 데이터로
    // 바뀌는 깜빡임이 없다.
    const hasRealSchool = !!resolveDashboardSchoolId() && !isSamplePreview();
    if (options.animateIntro) playDashboardIntroForCurrentData({ deferSplashHide: hasRealSchool });
    else applyDashboard(allStoredRecords());
    await loadSchoolDashboardFromApi();
    if (hasRealSchool) window.__aiwaysHideBootSplash?.();
    startSchoolDashboardLiveRefresh();
    return allStoredRecords();
  }

  function createPcRecordIdempotencyKey() {
    return createAnalysisIdempotencyKey() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // 2026-08-26: PC "AI 판단" 모달을 Google Sheets 대신 다른 화면들과 같은
  // Firestore 백엔드(saveSortingRecord, mobile/app.js의 submitSortingRecord()와
  // 같은 패턴)로 옮긴 지점. PC는 mobile/처럼 학교/반 실명 연결이 없는
  // 발표용 데모 화면이라 classContext/campusCheckId는 보내지 않는다 -
  // 기록 자체는 저장되지만(개인 기록), 반/학교 집계에는 반영되지 않는다.
  async function saveSortingRecordToFirestore(record) {
    const client = window.AIWaysEdu2gClient;
    if (!client?.saveSortingRecord) return false;
    const draft = currentAnalysisDraft;
    const isAiResult = !!draft?.liveGemini;
    const selectedItemId = cleanText(draft?.judgementKey || record.mapped_item || "hold", 40) || "hold";
    const payload = {
      schemaVersion: "sorting-record-v1",
      status: record.hold_flag ? "held" : "completed",
      provider: cleanText(draft?.provider || (record.hold_flag ? "manual_hold" : "manual_select"), 80) || "manual_select",
      analysis: {
        objectCandidates: isAiResult ? [{ label: cleanText(draft.item, 40) || selectedItemId, itemId: selectedItemId, objectType: selectedItemId, confidenceBand: draft.confidenceBand || "unknown" }] : [],
        materialCandidates: [], visibleCautions: []
      },
      checklist: [],
      userDecision: { selectedItemId, action: record.hold_flag ? "held" : "recorded", userConfirmed: true },
      hold: record.hold_flag ? { recommended: true, reasons: ["PC 수동 판단"] } : null,
      idempotencyKey: createPcRecordIdempotencyKey()
    };
    try {
      const response = await client.saveSortingRecord(payload);
      return response.ok === true;
    } catch {
      return false;
    }
  }

  async function appendRecord(record) {
    const parts = classParts(selectedClassName());
    const safeRecord = {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      school: "우리학교",
      grade: parts.grade,
      class_name: parts.className,
      group_id: "",
      privacy_id: privacyId(),
      input_type: record.input_type,
      ai_engine: record.ai_engine,
      ai_raw_label: record.ai_raw_label,
      ai_confidence: record.ai_confidence,
      mapped_item: record.mapped_item,
      suggested_category: record.suggested_category,
      final_decision: record.final_decision,
      hold_flag: record.hold_flag,
      hold_score: record.hold_flag ? 1 : 0,
      action: record.hold_flag ? "hold" : "confirm",
      image_saved: false,
      app_version: "clean-2026-07",
      ...(kioskEventTag ? { event_channel: kioskEventTag } : {})
    };

    const result = await saveSortingRecordToFirestore(record);
    if (!result) {
      const pending = readJson(STORAGE_PENDING, []);
      pending.push(safeRecord);
      writeJson(STORAGE_PENDING, pending);
    }

    const nextRecords = localRecords();
    nextRecords.push(safeRecord);
    writeJson(STORAGE_RECORDS, nextRecords);
    applyDashboard(allStoredRecords());
    return result;
  }

  // COMMON_FINAL_FIX_START
  function initNavigation() {
    if (window.__AIWAYS_CLEAN_PAGE_FIX_NAV__) return;
    window.__AIWAYS_CLEAN_PAGE_FIX_NAV__ = true;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    const navPairs = [
      ["대시보드", "dashboard"],
      ["프로젝트", "project"],
      ["교육과정", "curriculum"],
      ["H-A-H", "hah"],
      ["차시흐름", "flow"],
      ["갤러리", "gallery"],
      ["자료실", "resources"]
    ];
    const labels = new Set(navPairs.map(pair => pair[0]));
    const links = $$(".main-nav a").filter(link => labels.has(cleanText(link.textContent)));
    // A scene hidden by the stylesheet (PC hides #sorting) must drop out of the
    // scroll/keyboard sequence too, so gallery steps straight to resources.
    const sections = navPairs
      .map(([, id]) => document.getElementById(id))
      .filter(Boolean)
      .filter(section => getComputedStyle(section).display !== "none");
    let currentId = "";
    let snapLocked = false;
    let scrollTicking = false;
    let scrollDebounce = 0;
    let clickLockUntil = 0;
    let dashboardLockUntil = Date.now() + 260;
    let rewindActive = false;
    let rewindCooldownUntil = 0;

    function activate(section, force = false, options = {}) {
      if (!section) return;
      const id = section.id;
      const sectionLight = options.sectionLight !== false;
      if (!force && id === currentId && (!sectionLight || section.classList.contains("is-active"))) return;
      const previousId = currentId;
      const previousSection = previousId ? document.getElementById(previousId) : null;
      if (id !== "dashboard") document.body.classList.remove("is-rewound");
      if (previousId && previousId !== id) resetTransientUiState(previousSection);
      if (previousId !== id) resetSectionEntryState(section);
      if (previousId === "dashboard" && id !== "dashboard") scheduleDashboardIntroResetForNextEntry();
      const enteringDashboard = id === "dashboard" && previousId !== "dashboard";
      if (enteringDashboard) {
        prepareDashboardIntroState({ force: true });
        dashboardIntroPendingOnSettle = true;
      }
      const label = navPairs.find(([, sectionId]) => sectionId === id)?.[0] || section.dataset.nav;
      const shouldPlayDashboardIntro = id === "dashboard" && sectionLight && (enteringDashboard || dashboardIntroPendingOnSettle);
      currentId = id;

      if (sectionLight) {
        sections.forEach(item => item.classList.toggle("is-active", item === section));
      }
      links.forEach(link => {
        const active = cleanText(link.textContent) === label;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });

      if (shouldPlayDashboardIntro) {
        dashboardIntroPendingOnSettle = false;
        playDashboardIntroForCurrentData();
      }
    }

    function waitForScrollSettle(section, callback, maxWait = 300) {
      if (!section) { callback(); return; }
      const startedAt = performance.now();
      const tolerance = Math.max(8, Math.round(window.innerHeight * 0.014));
      function check(now) {
        const rect = section.getBoundingClientRect();
        const settled = Math.abs(rect.top) <= tolerance || now - startedAt > maxWait;
        if (!settled) {
          requestAnimationFrame(check);
          return;
        }
        callback();
      }
      requestAnimationFrame(check);
    }

    function nearestSection() {
      const center = window.innerHeight / 2;
      return sections
        .map(section => {
          const rect = section.getBoundingClientRect();
          const sectionCenter = rect.top + rect.height / 2;
          const insideCenter = rect.top <= center && rect.bottom >= center;
          return {
            section,
            insideCenter,
            distance: Math.abs(sectionCenter - center)
          };
        })
        .sort((a, b) => Number(b.insideCenter) - Number(a.insideCenter) || a.distance - b.distance)[0]?.section || sections[0];
    }

    function scheduleActiveUpdate(delay = 110) {
      if (Date.now() < dashboardLockUntil) return;
      if (Date.now() < clickLockUntil) return;
      window.clearTimeout(scrollDebounce);
      scrollDebounce = window.setTimeout(() => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
          activate(nearestSection());
          scrollTicking = false;
        });
      }, delay);
    }

    function sectionIndexByScrollPosition() {
      const y = window.scrollY;
      return sections
        .map((section, index) => ({
          index,
          distance: Math.abs(section.offsetTop - y)
        }))
        .sort((a, b) => a.distance - b.distance)[0]?.index || 0;
    }

    function currentSectionIndex(direction) {
      const activeIndex = sections.findIndex(section => section.id === currentId);
      const scrollIndex = sectionIndexByScrollPosition();
      if (activeIndex < 0) return scrollIndex;
      if (direction < 0) return activeIndex;
      const activeRect = sections[activeIndex].getBoundingClientRect();
      const nearActive = Math.abs(activeRect.top) <= Math.max(80, window.innerHeight * 0.16);
      return nearActive ? activeIndex : scrollIndex;
    }

    function resetToDashboard() {
      dashboardLockUntil = Date.now() + 520;
      history.replaceState(null, "", window.location.pathname + window.location.search);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      activate(sections[0], true);
    }

    function shouldSkipSnap(event) {
      return Boolean(event.target.closest("input, textarea, select, option, dialog, .ai-modal, [role='dialog']"));
    }

    function canContinueInternalScroll(target, direction) {
      let node = target instanceof Element ? target : null;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const scrollable = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
        if (scrollable) {
          const remaining = direction > 0
            ? node.scrollTop < node.scrollHeight - node.clientHeight - 1
            : node.scrollTop > 1;
          if (remaining) return true;
        }
        node = node.parentElement;
      }
      return false;
    }

    // Chrome ramps native smooth-scroll duration with distance, which reads as
    // drifting over to the next scene rather than snapping onto it, so drive
    // the scroll ourselves on a short, sharply decelerating curve.
    //
    // style.css sets html{scroll-behavior:smooth}. Left on, the browser starts
    // its own animation for every frame we set, and sixty of those per second
    // fight each other into visible chaos. Pin the property to auto for the
    // duration of our animation and restore whatever was there afterwards -
    // more reliable than passing behavior:"instant" per call.
    let snapScrollFrame = 0;
    // A wheel notch should read like a spring being let go, not a rusty
    // clock spring winding up: an immediate, decisive push-off that then
    // decelerates smoothly into the landing. Wrapping an ease-out in a
    // smoothstep (the previous curve) gave the ride a literal zero velocity
    // at t=0 - technically gentle, but it read as sluggish, not snappy.
    // Plain ease-out-quart has real velocity from the first frame and still
    // decelerates the whole way, so it never hits the hard mid-ride peak
    // that made easeInOutQuart feel rigid either.
    const glideEase = t => 1 - Math.pow(1 - t, 4);
    const GLIDE_MS = 720;
    // The rewind travels the whole deck, so it carries a little more weight
    // than a single-section glide.
    const REWIND_MS = 700;

    // The glide is driven from rAF on the main thread, so anything the browser
    // has to re-rasterise per frame shows up as stutter. The worst offender is
    // the sticky header's backdrop blur: it re-blurs whatever passes behind it
    // on every single frame of the ride. Marking the ride lets the stylesheet
    // stand those costs down while the page is in motion, and promote just the
    // two scenes involved so their dimmed, gradient-heavy surfaces are moved
    // rather than repainted.
    let glidingScenes = [];
    let glideSafetyTimer = 0;

    function beginGlide(from, to) {
      endGlide();
      document.body.classList.add("is-snapping");
      glidingScenes = [from, to].filter(Boolean);
      glidingScenes.forEach(scene => scene.classList.add("is-gliding"));
      // A ride cancelled mid-flight never reaches its landing callback, so the
      // stood-down effects would stay off for good. Always hand them back.
      glideSafetyTimer = window.setTimeout(endGlide, GLIDE_MS + 900);
    }

    function endGlide() {
      window.clearTimeout(glideSafetyTimer);
      glideSafetyTimer = 0;
      document.body.classList.remove("is-snapping");
      glidingScenes.forEach(scene => scene.classList.remove("is-gliding"));
      glidingScenes = [];
    }

    // Where a section is meant to come to rest. The first scene starts below
    // the in-flow sticky header, so parking it at the viewport top would slide
    // it back under the header; the whole page lands at 0 instead, leaving the
    // header and the scene both fully visible. Every place that positions the
    // page must agree on this, or the landing correction will undo the ride.
    function snapTargetY(section) {
      if (section === sections[0]) return 0;
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return Math.min(maxY, Math.max(0, window.scrollY + section.getBoundingClientRect().top));
    }

    function snapScrollTo(section, duration = 640, onLanded, easing) {
      if (snapScrollFrame) cancelAnimationFrame(snapScrollFrame);
      const root = document.documentElement;
      root.style.scrollBehavior = "auto";
      const finish = (landed) => {
        snapScrollFrame = 0;
        // Always restore to empty, never to a captured value: a snap that
        // interrupts another snap would capture "auto" and leave it inline
        // forever, and stale inline state is one way the feel degrades.
        root.style.scrollBehavior = "";
        if (landed && onLanded) onLanded();
      };
      const startY = window.scrollY;
      const endY = snapTargetY(section);
      const distance = endY - startY;
      if (Math.abs(distance) < 2) {
        window.scrollTo(0, endY);
        finish(true);
        return;
      }
      const startedAt = performance.now();
      // Apple-style: a longer ride on easeInOutQuart - soft start, fast middle,
      // long heavily-damped landing, zero overshoot. The back-curve variants
      // (tried at c1 0.95 and 0.42) both read as jitter, not weight.
      const ease = easing || (t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2));
      function step(now) {
        const progress = Math.min(1, (now - startedAt) / duration);
        window.scrollTo(0, Math.round(startY + distance * ease(progress)));
        if (progress < 1) snapScrollFrame = requestAnimationFrame(step);
        else finish(true);
      }
      snapScrollFrame = requestAnimationFrame(step);
    }

    function rewindFromLastSection() {
      if (rewindActive || Date.now() < rewindCooldownUntil) return;
      rewindActive = true;
      snapLocked = true;
      clickLockUntil = Date.now() + REWIND_MS + 260;

      const first = sections[0];
      history.replaceState(null, "", "#" + first.id);
      activate(first, true, { sectionLight: false });
      // The whole-deck rewind reads better a touch slower and on the same
      // soft-in/long-tail curve as the per-section glide, so it winds up
      // rather than snapping back. Gliding also stands the sticky header's
      // backdrop blur down for the ride, which matters most here: this is by
      // far the longest travel on the page.
      beginGlide(sections[sections.length - 1], first);
      snapScrollTo(first, REWIND_MS, () => activate(first, true), glideEase);
      waitForScrollSettle(first, () => {
        activate(first, true);
        endGlide();
        // Reaching the top by rewinding means the visitor has seen the whole
        // deck, so this is the moment to offer the phone hand-off QR. A first
        // visit to the dashboard does not get it.
        document.body.classList.add("is-rewound");
        rewindActive = false;
        snapLocked = false;
        clickLockUntil = 0;
        rewindCooldownUntil = Date.now() + 900;
        // The first scene rests with the page at 0, so its own top never gets
        // within the settle tolerance - this wait always runs its full length.
        // It therefore has to outlast the ride, or the lights would come up
        // while the page is still winding.
      }, REWIND_MS + 140);
    }

  function snapByWheel(event) {
      if (event.ctrlKey || shouldSkipSnap(event) || Math.abs(event.deltaY) < 18 || snapLocked) return;
      const active = sections.find(section => section.id === currentId) || nearestSection();
      const direction = event.deltaY > 0 ? 1 : -1;
      if (canContinueInternalScroll(event.target, direction)) return;
      // A scene genuinely taller than the viewport must be scrollable through
      // before the snap kicks in, or its lower half would be unreachable. The
      // old 60px margin handed almost every scene to the browser's raw wheel
      // scrolling - tiny rigid steps instead of the glide - because scenes
      // routinely overhang by a few dozen pixels. Only a substantial overhang
      // (a quarter of the viewport) is worth reading through manually.
      const manualScrollMargin = Math.max(120, Math.round(window.innerHeight * 0.25));
      const activeRect = active.getBoundingClientRect();
      if (direction > 0 && activeRect.bottom > window.innerHeight + manualScrollMargin) return;
      if (direction < 0 && activeRect.top < -manualScrollMargin) return;
      const currentIndex = currentSectionIndex(direction);
      const nextIndex = Math.min(sections.length - 1, Math.max(0, currentIndex + direction));
      if (nextIndex === currentIndex) {
        if (direction > 0 && currentIndex === sections.length - 1 && window.innerWidth > 980) {
          event.preventDefault();
          rewindFromLastSection();
          return;
        }
        event.preventDefault();
        snapLocked = true;
        clickLockUntil = Date.now() + 300;
        const edgeTarget = sections[currentIndex] || active;
        snapScrollTo(edgeTarget, 300);
        activate(edgeTarget, true);
        window.setTimeout(() => {
          snapLocked = false;
          clickLockUntil = 0;
        }, 320);
        return;
      }

      event.preventDefault();
      snapLocked = true;
      clickLockUntil = Date.now() + GLIDE_MS + 160;
      const target = sections[nextIndex];
      history.replaceState(null, "", "#" + target.id);
      // Travel dark, land, then light: the nav highlight moves immediately but
      // the destination scene stays dimmed for the whole ride and only comes on
      // once it has come to rest - the eye reads "off, arrived, ON".
      //
      // The lock must be held for the entire ride. Releasing it on arrival
      // *position* (what waitForScrollSettle does) frees it about two thirds of
      // the way in, because the long decelerating tail creeps the last few
      // pixels - so the next wheel event, which one physical notch of a mouse
      // wheel readily produces, cancelled the tail and launched the following
      // snap. That is what made the glide feel chopped off instead of settling.
      activate(target, true, { sectionLight: false });
      beginGlide(active, target);
      snapScrollTo(target, GLIDE_MS, () => {
        // Absorb any sub-pixel drift instantly, so the scene comes to rest
        // exactly on the edge rather than easing into an approximate stop.
        // This must aim at the same resting place the ride did: measuring the
        // section's own top instead would drag the first scene down under the
        // header, which read as the page catching and then dropping a notch.
        const restingY = snapTargetY(target);
        if (Math.abs(window.scrollY - restingY) > 1) {
          window.scrollTo({ top: restingY, left: 0, behavior: "auto" });
        }
        // A beat of stillness before the lights: arrival and illumination read
        // as two separate events, which is what makes the landing feel solid.
        window.setTimeout(() => {
          activate(target, true);
          endGlide();
          snapLocked = false;
          clickLockUntil = 0;
        }, 90);
      }, glideEase);
    }

    if (!sections.length) return;

    function navigateToSection(id) {
      const section = document.getElementById(id);
      if (!section) return false;
      clickLockUntil = Date.now() + GLIDE_MS + 60;
      history.replaceState(null, "", "#" + id);
      activate(section, true, { sectionLight: false });
      beginGlide(nearestSection(), section);
      snapScrollTo(section, GLIDE_MS, () => {
        activate(section, true);
        endGlide();
      }, glideEase);
      window.setTimeout(() => {
        clickLockUntil = 0;
      }, GLIDE_MS + 40);
      return true;
    }

    links.forEach(link => {
      const label = cleanText(link.textContent);
      const id = navPairs.find(([navLabel]) => navLabel === label)?.[1];
      if (!id) return;
      link.setAttribute("href", "#" + id);
      link.addEventListener("click", event => {
        if (!navigateToSection(id)) return;
        event.preventDefault();
      });
    });

    $$(".flow-card[href^='#']").forEach(link => {
      link.addEventListener("click", event => {
        const targetId = link.getAttribute("href")?.slice(1);
        if (!targetId || !navPairs.some(([, id]) => id === targetId)) return;
        if (!navigateToSection(targetId)) return;
        event.preventDefault();
      });
    });

    window.addEventListener("scroll", () => scheduleActiveUpdate(110), { passive: true });
    window.addEventListener("wheel", snapByWheel, { passive: false });

    // sorting-scene is gone from the page entirely now - the hero's "지금
    // 분류하기" always opens the QR portal in place (already on screen)
    // instead of scrolling to a section that no longer exists.
    $$(".hero-actions a[href='#sorting']").forEach(anchor => {
      anchor.addEventListener("click", event => {
        event.preventDefault();
        document.body.classList.add("is-rewound");
      });
    });

    // Expo kiosk mode: a QR code can carry ?kiosk=5-1 so any visitor's own
    // phone lands straight on 3초판단 with the demo class pre-selected,
    // instead of the usual reset-to-dashboard behavior below.
    const KIOSK_CLASS_MAP = { "5-1": "5학년 1반" };
    const kioskClassLabel = KIOSK_CLASS_MAP[new URLSearchParams(window.location.search).get("kiosk") || ""];

    if (kioskClassLabel) {
      kioskEventTag = "expo_kiosk";
      const classSelect = $("#classSelect");
      if (classSelect && $$("option", classSelect).some(option => option.value === kioskClassLabel)) {
        classSelect.value = kioskClassLabel;
        classSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      navigateToSection("sorting");
    } else {
      resetToDashboard();
      window.addEventListener("pageshow", () => requestAnimationFrame(resetToDashboard), { once: true });
      requestAnimationFrame(resetToDashboard);
    }
  }
  // COMMON_FINAL_FIX_END

  function loadSortingStorage() {
    let stats = null;
    try {
      stats = JSON.parse(localStorage.getItem(SORTING_STATS_KEY) || "null");
    } catch {
      stats = null;
    }
    if (stats && typeof stats === "object") {
      sortingStats = {
        totalCount: Number(stats.totalCount) || 0,
        carbonReduction: Number(stats.carbonReduction) || 0,
        logs: Array.isArray(stats.logs) ? stats.logs.slice(0, 30) : []
      };
    }
    if (!sortingStats.logs.length) {
      sortingStats = {
        totalCount: 7,
        carbonReduction: 1800,
        logs: DEMO_SORTING_LOGS.slice()
      };
    } else if (sortingStats.logs.length < 10) {
      const existing = new Set(sortingStats.logs.map(log => cleanText(`${log.time}:${log.label}`)));
      const filler = DEMO_SORTING_LOGS.filter(log => !existing.has(cleanText(`${log.time}:${log.label}`)));
      sortingStats = {
        ...sortingStats,
        logs: sortingStats.logs.concat(filler.slice(0, 10 - sortingStats.logs.length))
      };
    }
    sortingHoldItems = readJson(SORTING_HOLD_KEY, []);
    if (!sortingHoldItems.length) {
      sortingHoldItems = DEMO_HOLD_ITEMS.slice();
    } else if (sortingHoldItems.length < 20) {
      const existing = new Set(sortingHoldItems.map(item => cleanText(item.id || item.name)));
      const filler = DEMO_HOLD_ITEMS.filter(item => !existing.has(cleanText(item.id || item.name)));
      sortingHoldItems = sortingHoldItems.concat(filler.slice(0, 20 - sortingHoldItems.length));
    }
    sortingDecisionHistory = readJson(SORTING_DECISIONS_V2_KEY, []).slice(0, 40);
  }

  function saveSortingStats() {
    writeJson(SORTING_STATS_KEY, sortingStats);
  }

  function saveSortingHolds() {
    writeJson(SORTING_HOLD_KEY, sortingHoldItems);
  }

  function saveSortingDecisionV2(decision, action = "saved") {
    if (!decision?.item) return;
    sortingDecisionHistory.unshift({
      source: decision.source,
      provider: decision.provider || decision.source,
      schemaVersion: decision.schemaVersion || SORTING_VISION_SCHEMA_VERSION,
      requestId: cleanText(decision.requestId),
      query: decision.query,
      selectedItemId: decision.selectedItemId,
      objectCandidates: decision.objectCandidates,
      materialCandidates: decision.materialCandidates,
      disposalCandidates: decision.disposalCandidates,
      visibleCautions: decision.visibleCautions,
      checklist: decision.checklist,
      primaryFlow: decision.primaryFlow,
      recommendation: decision.recommendation,
      holdReasons: decision.holdReasons,
      isAmbiguous: decision.isAmbiguous,
      canRecord: decision.canRecord,
      hold: decision.hold,
      selectedCorrectionType: decision.selectedCorrectionType,
      action,
      createdAt: decision.createdAt,
      timestamp: new Date().toISOString()
    });
    sortingDecisionHistory = sortingDecisionHistory.slice(0, 40);
    try {
      writeJson(SORTING_DECISIONS_V2_KEY, sortingDecisionHistory);
      return true;
    } catch {
      // Keep the current result and checklist usable when browser storage is unavailable.
      sortingDecisionHistory.shift();
      return false;
    }
  }

  const practiceBadgeSteps = [
    { count: 1, emoji: "🌱", title: "새싹 실천가" },
    { count: 3, emoji: "♻️", title: "분리배출 입문자" },
    { count: 5, emoji: "🔎", title: "자원순환 탐험가" },
    { count: 10, emoji: "🧃", title: "분리배출 실천가" },
    { count: 20, emoji: "🌍", title: "자원순환 환경운동가" },
    { count: 30, emoji: "🏆", title: "AI Ways 마스터" }
  ];

  function currentBadgeTitle(totalCount) {
    return practiceBadgeSteps
      .filter(step => totalCount >= step.count)
      .at(-1)?.title || "기록 시작 전";
  }

  function recordSortingPracticeLocally(item, saved = true) {
    const time = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    sortingStats.totalCount += 1;
    sortingStats.carbonReduction += Number(item.carbonSaved) || 0;
    sortingStats.logs.unshift({
      label: item.label,
      emoji: item.emoji || holdEmojiFor(item.label),
      category: item.category || "학생 확인",
      carbon: item.carbonSaved,
      time,
      synced: saved === true
    });
    sortingStats.logs = sortingStats.logs.slice(0, 30);
    saveSortingStats();
    renderSortingStats();
  }

  function addSortingHoldLocally(name, reason = "기준 확인 필요", saved = true, decision = null, localRecordId = "", remoteRecordId = "") {
    const cleaned = cleanText(name) || "판단 보류 물건";
    sortingHoldItems.unshift({
      id: localRecordId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      localRecordId: localRecordId || "",
      remoteRecordId: remoteRecordId || "",
      name: cleaned,
      reason,
      status: "보류",
      candidate: holdCandidateFor(cleaned),
      judgement: decision ? {
        source: decision.source,
        objectCandidates: decision.objectCandidates,
        materialCandidates: decision.materialCandidates,
        visibleCautions: decision.visibleCautions,
        checklist: decision.checklist,
        userDecision: { userConfirmed: true },
        recommendation: decision.recommendation,
        holdReasons: decision.hold?.reasons || [],
        selectedCorrectionType: decision.selectedCorrectionType || ""
      } : null,
      synced: saved === true,
      time: new Date().toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    });
    sortingHoldItems = sortingHoldItems.slice(0, 40);
    saveSortingHolds();
    renderSortingHolds();
  }

  function updateSortingFromRecord(record, saved = true) {
    const label = cleanText(record.mapped_item || record.ai_raw_label || record.final_decision || "판단 기록");
    if (record.hold_flag || cleanText(record.final_decision).includes("보류")) {
      addSortingHoldLocally(label, "기록 반영 대기 안건", saved);
      return;
    }

    const item = {
      label,
      emoji: holdEmojiFor(label),
      category: cleanText(record.final_decision || record.suggested_category || "학생 확인"),
      carbonSaved: 6
    };
    recordSortingPracticeLocally(item, saved);
  }

  function storageMessage(saved, kind = "record") {
    if (saved === true) return kind === "hold" ? "판단 보류를 저장하고 보류함에 반영했어요." : "기록을 저장하고 실천 통계에 반영했어요.";
    return "현재 연결이 불안정해 임시 저장 후 다시 전송을 시도합니다.";
  }

  function renderSortingStats() {
    setText("#sortingPracticeCount", `${sortingStats.totalCount.toLocaleString("ko-KR")}회`);
    setText("#sortingCarbonCount", `${sortingStats.carbonReduction >= 1000 ? `${(sortingStats.carbonReduction / 1000).toFixed(1)}kg` : `${sortingStats.carbonReduction.toFixed(1)}g`}`);
    const recent = sortingStats.logs[0];
    setText("#sortingRecentItem", recent ? `${recent.emoji || holdEmojiFor(recent.label)} ${recent.label}` : "-");

    const statsPanel = $('[data-panel="stats"]');
    const timelineBox = $("#sortingTimeline")?.closest(".timeline-box");
    if (statsPanel && timelineBox) {
      let insights = $(".impact-insights", statsPanel);
      if (!insights) {
        insights = document.createElement("section");
        insights.className = "impact-insights";
        timelineBox.before(insights);
      }
      const carbonKg = sortingStats.carbonReduction / 1000;
      const treeCount = Math.max(0.1, carbonKg / 6).toFixed(1);
      const resourceCount = sortingStats.logs.filter(log => !String(log.category || "").includes("일반")).length || sortingStats.totalCount;
      insights.innerHTML = `
        <article><b>🌳</b><strong>나무 보호 환산</strong><span>나무 ${treeCount}그루를 지켰어요</span></article>
        <article><b>🌍</b><strong>탄소 절감 환산</strong><span>CO2 ${carbonKg.toFixed(1)}kg 감축에 기여했어요</span></article>
        <article><b>♻️</b><strong>자원순환 효과</strong><span>재활용 가능 자원 ${resourceCount.toLocaleString("ko-KR")}건을 살렸어요</span></article>
        <article><b>🐻‍❄️</b><strong>오늘의 메시지</strong><span>시원한 내일을 위한 작은 실천이 쌓이고 있어요</span></article>
      `;

      let badge = $(".badge-progress", statsPanel);
      if (!badge) {
        badge = document.createElement("section");
        badge.className = "badge-progress";
        timelineBox.before(badge);
      }
      const total = sortingStats.totalCount;
      badge.innerHTML = `
        <div class="badge-progress-head">
          <strong>실천 배지 단계</strong>
          <span>현재 ${total.toLocaleString("ko-KR")}회 · ${escapeHtml(currentBadgeTitle(total))}</span>
        </div>
        <div class="badge-track">
          ${practiceBadgeSteps.map(step => `
            <article class="${total >= step.count ? "is-earned" : ""}">
              <b>${step.emoji}</b>
              <strong>${step.title}</strong>
              <span>${step.count}회</span>
            </article>
          `).join("")}
        </div>
      `;
    }

    const timeline = $("#sortingTimeline");
    if (!timeline) return;
    if (!sortingStats.logs.length) {
      timeline.innerHTML = '<li class="empty-state sorting-empty-state"><span aria-hidden="true">🌱</span><strong>아직 실천 기록이 없어요</strong><p>AI분류 탭에서 물건을 선택하고 실천 기록을 남기면 여기에 오늘의 흐름이 쌓입니다.</p></li>';
      return;
    }
    timeline.innerHTML = sortingStats.logs.slice(0, 12).map(log => `
      <li class="timeline-item"><time>${escapeHtml(log.time)}</time><span class="timeline-emoji" aria-hidden="true">${escapeHtml(log.emoji || holdEmojiFor(log.label))}</span><div><strong>${escapeHtml(log.label)}</strong><span>${escapeHtml(log.category)}</span></div><em>CO2 ${Number(log.carbon || 0).toFixed(1)}g</em></li>
    `).join("");
  }

  function normalizeItemText(value) {
    const spaced = cleanText(String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[()[\]{}.,/\\|:;'"!?·ㆍ•_+=~`<>]/g, " "));
    return {
      spaced,
      compact: spaced.replace(/\s+/g, "")
    };
  }

  function getItemEmojiByText(name) {
    const text = normalizeItemText(name);
    if (!text.compact) return "";

    const matched = WASTE_EMOJI_MATCHERS.find(({ keyword }) => {
      const target = normalizeItemText(keyword);
      return Boolean(target.compact)
        && (text.compact.includes(target.compact) || text.spaced.includes(target.spaced));
    });
    return matched ? matched.emoji : "🟨";
  }

  function holdEmojiFor(name) {
    return getItemEmojiByText(name);
  }

  function holdCandidateFor(name) {
    const text = cleanText(name);
    if (text.includes("우유") || text.includes("종이팩") || text.includes("멸균팩")) return "종이팩 / 전용 수거 여부 논의 필요";
    if (text.includes("컵라면") || text.includes("라면")) return "오염도 확인 후 일반쓰레기 또는 스티로폼";
    if (text.includes("비닐") || text.includes("봉지")) return "비닐류 / 오염도 확인 필요";
    if (text.includes("캔")) return "캔류 / 내용물 제거 여부 확인";
    if (text.includes("유리") || text.includes("병")) return "유리류 / 파손·뚜껑 분리 기준 확인";
    if (text.includes("건전지") || text.includes("배터리")) return "폐건전지 전용 수거함";
    if (text.includes("장난감")) return "복합 재질 / 일반쓰레기 또는 분해 가능 여부";
    if (text.includes("공책") || text.includes("노트") || text.includes("코팅")) return "종이류 / 코팅·스프링 제거 기준 확인";
    if (text.includes("상자")) return "종이류 / 송장·스티커 제거 여부";
    if (text.includes("자")) return "플라스틱류 / 파손 상태 기준 확인";
    return "분류 후보를 회의에서 함께 정하기";
  }

  function renderSortingHolds() {
    const list = $("#holdList");
    const count = $("#sortingHoldCount");
    if (count) count.textContent = String(sortingHoldItems.length);
    const preview = $("#manualHoldEmojiPreview");
    const inputValue = cleanText($("#manualHoldInput")?.value);
    if (preview && inputValue) preview.textContent = holdEmojiFor(inputValue);
    if (!list) return;
    if (!sortingHoldItems.length) {
      list.innerHTML = '<li class="empty-state hold-empty-state"><span aria-hidden="true">🟨</span><strong>회의 안건을 기다리는 중</strong><p>애매한 물건을 보류함에 남기면 금요일 회의에서 기준을 함께 확인할 수 있습니다.</p></li>';
      return;
    }
    list.innerHTML = sortingHoldItems.map(item => `
      <li class="hold-card" data-hold-id="${item.id}">
        <span class="hold-emoji" aria-hidden="true">${holdEmojiFor(item.name)}</span>
        <div class="hold-body">
          <strong>${escapeHtml(item.name)}</strong>
          <em>${escapeHtml(item.status || "기준 확인 필요")}</em>
          <span>${escapeHtml(item.reason || holdCandidateFor(item.name))}</span>
          <small>${escapeHtml(item.candidate || holdCandidateFor(item.name))}</small>
          ${(item.remoteRecordId || item.localRecordId) && item.status === "보류" ? `<div class="hold-checks" aria-label="추가 확인 항목">${(item.judgement?.checklist || []).map((check, index) => `<button type="button" data-hold-check="${item.id}:${index}" aria-pressed="${check.checked === true}">${check.checked === true ? "✓ " : ""}${escapeHtml(check.label || "확인 항목")}</button>`).join("")}</div>` : ""}
        </div>
        <time>${escapeHtml(item.time)}</time>
        <div class="hold-card-actions">
          ${(item.remoteRecordId || item.localRecordId) && item.status === "보류" ? `<button type="button" data-resolve-hold="${item.id}">추가 확인 후 해결</button>` : ""}
        </div>
      </li>
    `).join("");
  }

  function judgementKeyFor(input) {
    const rawKey = String(typeof input === "string" ? input : input?.key || "").trim().toLowerCase();
    if (sortingDbV2[rawKey]) return rawKey;
    const key = cleanText(rawKey).toLowerCase();
    if (sortingDbV2[key]) return key;
    return sortingKeyAliases[key] || "hold";
  }

  // Stage 5 keeps image analysis advisory-only: remote hints never decide a disposal outcome.
  const SORTING_INPUT_SOURCES = Object.freeze({ quick: "quick_select", search: "search_rule", photo: "photo_hint", correction: "user_correction", future: "future_gemini" });
  const SORTING_VISION_SOURCES = Object.freeze({ TEACHABLE_MACHINE: "tm_hint", FUTURE_GEMINI: "future_gemini" });
  const SORTING_VISION_SCHEMA_VERSION = "sorting-vision-v1";
  const SORTING_VISION_PRODUCTION_ENDPOINT = "https://asia-northeast3-ai-ways-incheon.cloudfunctions.net/analyzeSortingImage";
  const SORTING_VISION_STATES = Object.freeze({ IDLE: "idle", PREPARING: "preparing", ANALYZING: "analyzing", SUCCESS: "success", UNCERTAIN: "uncertain", UNAVAILABLE: "unavailable", INVALID_RESPONSE: "invalid_response", ERROR: "error" });
  const SORTING_CONFIDENCE_BANDS = Object.freeze(["high", "medium", "low", "unknown"]);
  const SORTING_VISION_LIMITS = Object.freeze({ candidates: 3, cautions: 5, labelLength: 40, cautionLength: 100 });
  let sortingVisionRequestSequence = 0;
  let activeSortingVisionRequestId = "";
  let activeSortingVisionIdempotencyKey = "";

  function createAnalysisIdempotencyKey() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (window.crypto?.getRandomValues) { const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); return [...bytes].map(value => value.toString(16).padStart(2, "0")).join(""); }
    return "";
  }

  function createSortingVisionRequestId(prefix = "sorting") {
    sortingVisionRequestSequence += 1;
    return `${prefix}-${Date.now().toString(36)}-${sortingVisionRequestSequence.toString(36)}`;
  }

  function createSortingVisionRequestMetadata(input = {}) {
    const requestId = cleanText(input.requestId) || createSortingVisionRequestId();
    const sessionId = cleanText(input.sessionId) || `session-${Date.now().toString(36)}`;
    return {
      schemaVersion: SORTING_VISION_SCHEMA_VERSION,
      requestId,
      sessionId,
      idempotencyKey: cleanText(input.idempotencyKey),
      locale: cleanText(input.locale) || "ko-KR",
      source: SORTING_VISION_SOURCES.FUTURE_GEMINI,
      imageMetadata: {
        mimeType: cleanText(input.imageMetadata?.mimeType),
        width: Number.isFinite(input.imageMetadata?.width) ? input.imageMetadata.width : 0,
        height: Number.isFinite(input.imageMetadata?.height) ? input.imageMetadata.height : 0,
        byteLength: Number.isFinite(input.imageMetadata?.byteLength) ? input.imageMetadata.byteLength : 0
      },
      userContext: {
        searchQuery: cleanText(input.userContext?.searchQuery),
        selectedCorrectionType: cleanText(input.userContext?.selectedCorrectionType),
        locale: cleanText(input.userContext?.locale) || "ko-KR"
      }
    };
  }

  function sortingVisionText(value, maxLength) {
    return cleanText(value).slice(0, maxLength);
  }

  function sortingVisionConfidence(value) {
    return SORTING_CONFIDENCE_BANDS.includes(value) ? value : "unknown";
  }

  function normalizeSortingVisionResponse(value) {
    const raw = value && typeof value === "object" ? value : {};
    const objectCandidates = Array.isArray(raw.objectCandidates) ? raw.objectCandidates : [];
    const materialCandidates = Array.isArray(raw.materialCandidates) ? raw.materialCandidates : [];
    const visibleCautions = Array.isArray(raw.visibleCautions) ? raw.visibleCautions : [];
    const validItem = itemId => Boolean(sortingDbV2[itemId]);
    const unique = new Set();
    const normalizedObjects = objectCandidates
      .map(candidate => ({
        label: sortingVisionText(candidate?.label, SORTING_VISION_LIMITS.labelLength),
        objectType: cleanText(candidate?.objectType),
        itemId: cleanText(candidate?.itemId),
        confidenceBand: sortingVisionConfidence(candidate?.confidenceBand)
      }))
      .filter(candidate => candidate.label && validItem(candidate.itemId) && sortingDbV2[candidate.itemId].objectType === candidate.objectType)
      .filter(candidate => !unique.has(candidate.itemId) && unique.add(candidate.itemId))
      .slice(0, SORTING_VISION_LIMITS.candidates);
    const normalizedMaterials = materialCandidates
      .map(candidate => ({ label: sortingVisionText(candidate?.label, SORTING_VISION_LIMITS.labelLength), confidenceBand: sortingVisionConfidence(candidate?.confidenceBand) }))
      .filter(candidate => candidate.label)
      .slice(0, SORTING_VISION_LIMITS.candidates);
    const normalizedCautions = [...new Set(visibleCautions.map(caution => sortingVisionText(caution, SORTING_VISION_LIMITS.cautionLength)).filter(Boolean))]
      .slice(0, SORTING_VISION_LIMITS.cautions);
    return {
      schemaVersion: raw.schemaVersion,
      requestId: sortingVisionText(raw.requestId, 80),
      provider: raw.provider,
      objectCandidates: normalizedObjects,
      materialCandidates: normalizedMaterials,
      visibleCautions: normalizedCautions,
      uncertainty: ["low", "medium", "high"].includes(raw.uncertainty) ? raw.uncertainty : "high",
      needsUserCheck: typeof raw.needsUserCheck === "boolean" ? raw.needsUserCheck : true
    };
  }

  function validateSortingVisionResponse(value) {
    const errors = [];
    if (!value || typeof value !== "object") errors.push("invalid_response");
    if (value?.schemaVersion !== SORTING_VISION_SCHEMA_VERSION) errors.push("unsupported_schema");
    if (value?.provider !== SORTING_VISION_SOURCES.FUTURE_GEMINI) errors.push("invalid_provider");
    if (!cleanText(value?.requestId)) errors.push("invalid_request_id");
    if (!Array.isArray(value?.objectCandidates)) errors.push("invalid_object_candidates");
    if (!Array.isArray(value?.materialCandidates)) errors.push("invalid_material_candidates");
    if (!Array.isArray(value?.visibleCautions)) errors.push("invalid_visible_cautions");
    if (!["low", "medium", "high"].includes(value?.uncertainty)) errors.push("invalid_uncertainty");
    if (typeof value?.needsUserCheck !== "boolean") errors.push("invalid_user_check");
    const sanitizedValue = normalizeSortingVisionResponse(value);
    if (sanitizedValue.objectCandidates.length !== (Array.isArray(value?.objectCandidates) ? value.objectCandidates.length : 0)) errors.push("invalid_candidate");
    return { valid: errors.length === 0, errors: [...new Set(errors)], sanitizedValue };
  }

  function createSortingVisionHint(candidate, source, options = {}) {
    const itemId = judgementKeyFor(candidate?.itemId || candidate?.key || "hold");
    const item = sortingDbV2[itemId] || sortingDbV2.hold;
    return {
      source,
      provider: options.provider || source,
      label: sortingVisionText(candidate?.label || item.label, SORTING_VISION_LIMITS.labelLength),
      objectType: item.objectType,
      itemId,
      confidenceBand: sortingVisionConfidence(options.confidenceBand || candidate?.confidenceBand),
      rawConfidence: Number.isFinite(options.rawConfidence) ? options.rawConfidence : null,
      requestId: cleanText(options.requestId),
      schemaVersion: options.schemaVersion || SORTING_VISION_SCHEMA_VERSION
    };
  }

  function getSortingVisionEndpoint() {
    const configured = cleanText(window.AIWaysConfig?.sortingVisionEndpoint);
    if (configured) return configured;
    if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
      return "http://127.0.0.1:5001/demo-aiways-incheon/asia-northeast3/analyzeSortingImage";
    }
    return SORTING_VISION_PRODUCTION_ENDPOINT;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error("image_encode_failed"));
      reader.readAsDataURL(blob);
    });
  }

  async function prepareSortingVisionImage(image) {
    const sourceWidth = image?.naturalWidth || image?.width || 0;
    const sourceHeight = image?.naturalHeight || image?.height || 0;
    if (!sourceWidth || !sourceHeight) return null;
    const scale = Math.min(1, 768 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.78));
    if (!blob || blob.size > 1_500_000) return null;
    const data = await blobToBase64(blob);
    return data ? { mimeType: "image/jpeg", data, metadata: { mimeType: "image/jpeg", width, height, byteLength: blob.size } } : null;
  }

  async function requestSortingVisionHint({ requestMetadata, imagePayload }) {
    const client = window.AIWaysEdu2gClient;
    if (!client?.analyzeSortingImage || client.visualReviewRequested?.()) return { ok: false, state: SORTING_VISION_STATES.UNAVAILABLE, code: "auth_invalid", requestId: requestMetadata.requestId };
    if (!imagePayload) return { ok: false, state: SORTING_VISION_STATES.UNAVAILABLE, code: "image_prepare_failed", requestId: requestMetadata.requestId };
    try {
      const response = await client.analyzeSortingImage({ ...requestMetadata, image: { mimeType: imagePayload.mimeType, data: imagePayload.data, metadata: imagePayload.metadata }, imageMetadata: imagePayload.metadata });
      if (!response.ok) return { ok: false, state: SORTING_VISION_STATES.UNAVAILABLE, code: cleanText(response.code) || "provider_unavailable", requestId: requestMetadata.requestId };
      const raw = response.data;
      if (activeSortingVisionRequestId !== requestMetadata.requestId) return { ok: false, state: SORTING_VISION_STATES.IDLE, code: "stale", requestId: requestMetadata.requestId };
      const checked = validateSortingVisionResponse(raw);
      if (!checked.valid || checked.sanitizedValue.requestId !== requestMetadata.requestId) return { ok: false, state: SORTING_VISION_STATES.INVALID_RESPONSE, code: "invalid_response", requestId: requestMetadata.requestId };
      return { ok: true, state: checked.sanitizedValue.uncertainty === "high" || checked.sanitizedValue.needsUserCheck ? SORTING_VISION_STATES.UNCERTAIN : SORTING_VISION_STATES.SUCCESS, value: checked.sanitizedValue, requestId: requestMetadata.requestId };
    } catch { return { ok: false, state: SORTING_VISION_STATES.UNAVAILABLE, code: "analysis_failed", requestId: requestMetadata.requestId }; }
  }

  async function requestSortingSafetyObserver({ requestMetadata, imagePayload }) {
    const client = window.AIWaysEdu2gClient;
    if (!client?.analyzeSortingSafetyObserver || !imagePayload) return { ok:false, safety:{ safetyLevel:"CAUTION", retakeRecommended:false, directSelectionRecommended:true, reasons:["observer_unavailable"], uxState:"caution" } };
    try { const response=await client.analyzeSortingSafetyObserver({ ...requestMetadata, image:{mimeType:imagePayload.mimeType,data:imagePayload.data,metadata:imagePayload.metadata},imageMetadata:imagePayload.metadata }); if(!response.ok)return {ok:false}; const o=response.data||{}; const retake=o.targetVisibility==="poor"||o.imageQuality==="poor"||o.occlusion==="severe"||(o.multiObject&&o.targetDominance==="low")||(o.backgroundClutter==="high"&&o.targetVisibility!=="clear"); const caution=!retake&&(o.targetVisibility==="partial"||o.backgroundClutter==="medium"||o.deformation||o.contamination||o.multiObject||o.occlusion==="mild"); return {ok:true,value:o,safety:{safetyLevel:retake?"RETAKE":caution?"CAUTION":"SAFE",retakeRecommended:retake,directSelectionRecommended:true,reasons:retake?["image_ambiguity"]:caution?["check_visible_condition"]:[],uxState:retake?"retake":caution?"caution":"safe"}}; } catch { return {ok:false}; }
  }

  const sortingVisionProviders = Object.freeze({
    teachableMachine: { source: SORTING_VISION_SOURCES.TEACHABLE_MACHINE, enabled: true },
    futureGemini: {
      source: SORTING_VISION_SOURCES.FUTURE_GEMINI,
      enabled: true,
      async analyze({ requestMetadata, imagePayload } = {}) {
        if (!requestMetadata?.requestId) return { ok: false, state: SORTING_VISION_STATES.ERROR, code: "invalid_request", requestId: "" };
        return requestSortingVisionHint({ requestMetadata, imagePayload });
      }
    }
  });

  function mergeSortingVisionHints(hints) {
    const seen = new Set();
    return hints.filter(hint => hint?.itemId && !seen.has(`${hint.source}:${hint.itemId}`) && seen.add(`${hint.source}:${hint.itemId}`));
  }

  window.AIWaysSortingVisionContract = Object.freeze({
    schemaVersion: SORTING_VISION_SCHEMA_VERSION,
    sources: SORTING_VISION_SOURCES,
    states: SORTING_VISION_STATES,
    createRequestMetadata: createSortingVisionRequestMetadata,
    validateResponse: validateSortingVisionResponse,
    normalizeResponse: normalizeSortingVisionResponse,
    createHint: createSortingVisionHint,
    futureProvider: sortingVisionProviders.futureGemini
  });

  function findJudgementKeys(value) {
    const text = cleanText(value).toLowerCase();
    if (!text) return ["hold"];
    const explicitMatches = [
      ["milk-carton", ["우유", "종이팩", "우유팩", "멸균팩"]],
      ["tape-box", ["테이프", "택배상자", "종이상자", "박스", "상자"]],
      ["pet-bottle", ["페트", "생수병", "음료병"]],
      ["plastic-cup", ["플라스틱컵", "테이크아웃컵"]],
      ["paper-cup", ["종이컵", "코팅컵"]],
      ["ramen-container", ["컵라면", "라면용기"]],
      ["snack-wrapper", ["과자", "과자봉지", "포장지"]],
      ["vinyl-bag", ["비닐", "비닐봉투"]],
      ["glass-bottle", ["유리병", "유리"]],
      ["receipt", ["영수증", "감열지"]],
      ["can", ["캔", "알루미늄", "철캔"]]
    ].filter(([, keywords]) => keywords.some(keyword => text.includes(keyword))).map(([key]) => key);
    if (explicitMatches.length) return explicitMatches.slice(0, 3);
    const matches = Object.entries(sortingDbV2)
      .filter(([, item]) => [item.label, ...(item.searchKeywords || [])]
        .some(keyword => text.includes(cleanText(keyword).toLowerCase())))
      .map(([key]) => key);
    return matches.length ? matches.slice(0, 3) : ["hold"];
  }

  function getJudgementResult(input, options = {}) {
    const inputSource = options.source || input?.source || (typeof input === "string" ? "quick" : "search");
    const source = {
      quick: SORTING_INPUT_SOURCES.quick,
      search: SORTING_INPUT_SOURCES.search,
      correction: SORTING_INPUT_SOURCES.correction,
      photo: options.candidateSource || "photo_hint",
      initial: "quick_select",
      future_gemini: "future_gemini"
    }[inputSource] || inputSource;
    const query = cleanText(options.query || input?.query || "");
    const candidateKeys = Array.isArray(options.candidateKeys) && options.candidateKeys.length
      ? options.candidateKeys
      : (inputSource === "search" ? findJudgementKeys(query || input) : [judgementKeyFor(input)]);
    const key = judgementKeyFor(options.key || candidateKeys[0]);
    const item = sortingDbV2[key] || sortingDbV2.hold;
    const candidateSource = options.candidateSource || source;
    const isAmbiguous = item.objectType === "hold" || candidateKeys.length > 1;
    const objectCandidateKeys = candidateKeys.length === 1 && key !== "hold" ? [...candidateKeys, "hold"] : candidateKeys;
    const createdAt = new Date().toISOString();
    return {
      key,
      item,
      source,
      provider: options.provider || candidateSource,
      schemaVersion: options.schemaVersion || SORTING_VISION_SCHEMA_VERSION,
      requestId: cleanText(options.requestId),
      query,
      selectedItemId: key,
      objectCandidates: objectCandidateKeys.map((candidateKey, index) => {
        const candidate = sortingDbV2[judgementKeyFor(candidateKey)] || sortingDbV2.hold;
        return {
          id: candidate.objectType,
          itemId: judgementKeyFor(candidateKey),
          label: index === 1 && candidate.objectType === "hold" && !isAmbiguous ? "추가 확인 필요" : candidate.label,
          objectType: candidate.objectType,
          confidence: index === 0 ? options.confidence || "reference" : "possible",
          confidenceBand: index === 0 ? sortingVisionConfidence(options.confidenceBand) : "unknown",
          source: index === 0 ? candidateSource : "search_rule"
        };
      }),
      materialCandidates: item.materialCandidates.map((label, index) => ({ id: `${item.objectType}-material-${index + 1}`, label, confidence: index === 0 ? "medium" : "check" })),
      disposalCandidates: item.disposalCandidates.slice(),
      visibleCautions: item.visibleCautions.slice(),
      checklist: item.checklist.map(check => ({ ...check, checked: false, status: "unknown" })),
      primaryFlow: item.primaryFlow,
      recommendation: { status: item.objectType === "hold" ? "hold_recommended" : "needs_user_check", primary: item.primaryFlow, reason: "사진과 이름만으로 오염·부속품·재질 표기·지역 기준을 확정할 수 없습니다." },
      holdReasons: [...item.holdReasons],
      isAmbiguous,
      canRecord: false,
      hold: { recommended: isAmbiguous, reasons: [...item.holdReasons] },
      imageHints: options.imageHints || [],
      liveGemini: options.liveGemini === true,
      analysisCode: cleanText(options.analysisCode),
      selectedCorrectionType: options.selectedCorrectionType || "",
      createdAt,
      timestamp: createdAt
    };
  }

  function playJudgementScan(container, options = {}) {
    if (!container) return;
    selectedSortingKey = "";
    container.classList.remove("is-empty", "is-result");
    container.classList.add("is-scanning");
    container.innerHTML = `<div class="judgement-scan"><strong>AI 판단 지원을 준비하는 중</strong><span class="quick-scan-meter" aria-hidden="true"><i></i></span><p>${escapeHtml(cleanText(options.label) || "선택한 물건")}의 재질·주의 요소·확인 항목을 정리하고 있습니다.</p></div>`;
  }

  function supportingEvidenceHtml(result) {
    const evidence = Array.isArray(result?.supportingEvidence) ? result.supportingEvidence.filter(item => item?.status === "success") : [];
    if (!evidence.length) return "";
    const comparison = result.skillComparison || compareGeminiAndSkillEvidence("", evidence);
    const rows = evidence.map(item => {
      const top = item.topPrediction;
      const predictions = (item.predictions || []).map(prediction => `${escapeHtml(prediction.label)} ${Math.round(Number(prediction.confidence || 0) * 100)}%`).join(" · ");
      return `<li><strong>${escapeHtml(item.skillName)} v${escapeHtml(String(item.version))}</strong><span>${escapeHtml(top?.label || "참고 결과 없음")} ${Math.round(Number(top?.confidence || 0) * 100)}%</span><small>Top-3: ${predictions}</small></li>`;
    }).join("");
    const signal = comparison.status === "AGREEMENT" || comparison.status === "CONFLICT" ? `<p class="skill-evidence-signal is-${comparison.status.toLowerCase()}">${escapeHtml(comparison.message)}</p>` : `<p class="skill-evidence-signal">${escapeHtml(comparison.message || "학생들이 학습한 보조 모델의 참고 결과입니다.")}</p>`;
    return `<aside class="judgement-skill-evidence ${comparison.status === "CONFLICT" ? "is-caution" : ""}" aria-label="우리 반이 가르친 AI 참고"><strong>우리 반이 가르친 AI 참고</strong><span>학생들이 학습한 보조 모델의 참고 결과입니다.</span><ul>${rows}</ul>${signal}</aside>`;
  }

  function renderJudgementResult(result, container) {
    const safeResult = result || getJudgementResult("hold");
    const item = safeResult.item || sortingDbV2.hold;
    const key = safeResult.key || "hold";
    const buttons = $$("[data-quick-item]");
    const completed = safeResult.checklist.filter(check => check.required).every(check => check.status === "done");
    const needsHold = safeResult.hold.recommended || !completed;
    const liveGemini = safeResult.liveGemini === true;
    safeResult.canRecord = completed && !safeResult.hold.recommended;
    const objectChips = safeResult.objectCandidates.map(candidate => `<span class="judgement-chip object"><b>${escapeHtml(candidate.label)}</b><em>${escapeHtml(candidate.source === "photo_hint" ? "사진 기반 참고 후보" : candidate.source === "tm_hint" ? "우리 학교 학습 모델 참고 후보" : candidate.source === "future_gemini" ? "AI 사진 분석 참고 후보" : candidate.source === "user" ? "사용자 선택" : "검색 후보")}</em></span>`).join("");
    const materialChips = safeResult.materialCandidates.map(candidate => `<span class="judgement-chip material">${escapeHtml(candidate.label)}</span>`).join("");
    const correctionButtons = [["pet-bottle", "병"], ["plastic-cup", "컵"], ["tape-box", "박스"], ["snack-wrapper", "봉지"], ["paper-cup", "종이"], ["can", "캔"], ["glass-bottle", "유리"], ["hold", "기타"]].map(([type, label]) => `<button type="button" data-judgement-correction="${type}" class="${safeResult.selectedCorrectionType === type ? "is-active" : ""}">${label}</button>`).join("");
    const checklistHtml = safeResult.checklist.map(check => `<button type="button" class="judgement-check ${check.status === "done" ? "is-done" : ""}" data-judgement-check="${check.id}" aria-pressed="${check.status === "done"}"><span aria-hidden="true">${check.status === "done" ? "✓" : ""}</span>${escapeHtml(check.label)}</button>`).join("");
    selectedSortingKey = key;
    buttons.forEach(target => target.classList.toggle("is-active", target.dataset.quickItem === key));
    container?.classList.remove("is-empty", "is-scanning");
    container?.classList.add("is-result");
    container?.classList.toggle("is-live-gemini", liveGemini);
    currentSortingJudgement = safeResult;
    container.innerHTML = `
      <header class="judgement-result-head"><p>AI가 확인할 항목을 제안합니다.</p><strong>${item.emoji} ${escapeHtml(item.label)}</strong><span>최종 배출 판단은 사용자가 결정합니다.</span></header>
      ${liveGemini ? `<aside class="judgement-gemini-live" aria-label="Google Gemini live analysis"><strong>Google Gemini 분석 결과</strong><span>AI 사진 분석 참고 후보 · Live 분석 · Firebase Functions 연결</span><small>분석 엔진: Google Gemini · 서버 연결: Firebase Functions · 결과 출처: future_gemini · 최종 판단: 사용자</small></aside>` : ""}
      ${supportingEvidenceHtml(safeResult)}
      <p class="judgement-action-status" data-judgement-action-status role="status" aria-live="polite">${safeResult.analysisCode ? "AI 분석을 사용할 수 없어 직접 선택 모드로 전환했습니다." : ""}</p>
      <details class="judgement-details judgement-candidate-block" open><summary>물체 후보</summary><div class="judgement-chip-row">${objectChips}</div></details>
      <details class="judgement-details judgement-candidate-block" open><summary>재질 후보</summary><div class="judgement-chip-row">${materialChips}</div></details>
      ${safeResult.imageHints.length ? `<p class="judgement-image-hint">${escapeHtml(safeResult.imageHints.join(" · "))}</p>` : ""}
      <details class="judgement-details judgement-cautions"><summary>보이는 주의 요소</summary><ul>${safeResult.visibleCautions.map(caution => `<li>${escapeHtml(caution)}</li>`).join("")}</ul></details>
      <section class="judgement-checklist"><h4>배출 전 체크리스트</h4><div>${checklistHtml}</div></section>
      <section class="judgement-recommendation ${completed ? "is-ready" : "is-hold"}"><strong>${completed ? "잘했어요. 배출 준비가 완료됐습니다." : needsHold ? "지금 확정하지 않아도 됩니다. 확인이 필요한 물건으로 보류함에 저장할까요?" : "확인 항목을 마친 뒤 사용자가 최종 판단합니다."}</strong><span>${escapeHtml(item.primaryFlow)}</span></section>
      <section class="judgement-corrections"><span>AI가 항목을 잘못 읽었다면 바로 고쳐 주세요.</span><div>${correctionButtons}</div></section>
      <div class="quick-action-row judgement-actions"><button type="button" data-judgement-action="record" ${completed && !safeResult.hold.recommended ? "" : "disabled"}>배출 기록 남기기</button><button type="button" data-judgement-action="decide" ${completed ? "" : "disabled"}>확인 후 결정하기</button><button type="button" data-judgement-action="hold">보류함에 저장</button><button type="button" data-next-sorting-item>다음 물건</button></div>`;
    const holdAction = container?.querySelector('[data-judgement-action="hold"]');
    if (holdAction) holdAction.disabled = !needsHold;
  }

  function runThreeSecondJudgement(input, options = {}) {
    const container = options.container || $("[data-sorting-result]");
    const result = getJudgementResult(input, options);
    const request = ++sortingJudgementRequest;
    if (sortingJudgementTimer) window.clearTimeout(sortingJudgementTimer);

    playJudgementScan(container, { label: result.item?.label });
    sortingJudgementTimer = window.setTimeout(() => {
      if (request !== sortingJudgementRequest) return;
      sortingJudgementTimer = 0;
      renderJudgementResult(result, container);
    }, options.delay ?? 1080);
  }

  function chooseDraftFromLabel(label, confidence) {
    const normalized = cleanText(label).toLowerCase();

    if (normalized.includes("carton") || normalized.includes("milk")) return { ...quickItems.milk, confidence };
    if (normalized.includes("cup") || normalized.includes("plastic") || normalized.includes("bottle")) return { ...quickItems.cup, confidence };
    if (normalized.includes("bag") || normalized.includes("packet") || normalized.includes("wrapper")) return { ...quickItems.snack, confidence };
    if (normalized.includes("ramen") || normalized.includes("noodle") || normalized.includes("라면")) return { ...quickItems.ramen, confidence };
    if (normalized.includes("can") || normalized.includes("캔")) return { ...quickItems.can, confidence };
    if (normalized.includes("receipt") || normalized.includes("영수증")) return { ...quickItems.receipt, confidence };
    if (normalized.includes("vinyl") || normalized.includes("비닐")) return { ...quickItems.vinyl, confidence };
    return { ...quickItems.paper, confidence };
  }

  function judgementKeyFromVisualLabel(label) {
    const normalized = cleanText(label).toLowerCase();
    if (normalized.includes("carton") || normalized.includes("milk") || normalized.includes("우유") || normalized.includes("종이팩")) return "milk-carton";
    if (normalized.includes("bottle") || normalized.includes("pet") || normalized.includes("페트")) return "pet-bottle";
    if (normalized.includes("glass") || normalized.includes("유리")) return "glass-bottle";
    if (normalized.includes("cup") || normalized.includes("plastic") || normalized.includes("플라스틱") || normalized.includes("컵")) return "plastic-cup";
    if (normalized.includes("bag") || normalized.includes("packet") || normalized.includes("wrapper") || normalized.includes("과자")) return "snack-wrapper";
    if (normalized.includes("ramen") || normalized.includes("noodle") || normalized.includes("라면")) return "ramen-container";
    if (normalized.includes("can") || normalized.includes("캔")) return "can";
    if (normalized.includes("receipt") || normalized.includes("영수")) return "receipt";
    return "hold";
  }

  function classroomSkillScope() {
    if (activeClassProfile) return { schoolId: activeClassProfile.schoolId, grade: activeClassProfile.grade, className: activeClassProfile.className };
    return { schoolId: DATA_CONFIG.currentSchool, grade: DATA_CONFIG.currentGrade, className: DATA_CONFIG.currentClassName };
  }

  function enabledClassroomSkills() {
    return classroomSkillRegistry?.listEnabledSkillsForClassProfile?.(activeClassProfile) || classroomSkillRegistry?.listEnabledSkills?.(classroomSkillScope()) || [];
  }

  function materialFamilyForLabel(label) {
    const normalized = cleanText(label).toLowerCase();
    if (/(?:metal|can|캔|알루미늄|철)/.test(normalized)) return "METAL";
    if (/(?:paper|종이|carton|milk|우유|receipt|영수증)/.test(normalized)) return "PAPER";
    if (/(?:plastic|pet|bottle|cup|플라스틱|페트|병|컵)/.test(normalized)) return "PLASTIC";
    return "";
  }

  function compareGeminiAndSkillEvidence(geminiCandidate, evidence) {
    const top = (Array.isArray(evidence) ? evidence : []).find(item => item?.status === "success")?.topPrediction;
    const geminiFamily = materialFamilyForLabel(geminiCandidate?.label || geminiCandidate);
    const skillFamily = materialFamilyForLabel(top?.label);
    if (!top) return { status: "NONE", message: "", topPrediction: null, lowConfidence: false };
    const lowConfidence = Number(top.confidence) < 0.5;
    if (geminiFamily && skillFamily && geminiFamily === skillFamily) return { status: "AGREEMENT", message: "우리 반이 가르쳐준 모델도 같은 쪽을 보고 있어요. 👀", topPrediction: top, lowConfidence };
    if (geminiFamily && skillFamily && geminiFamily !== skillFamily) return { status: "CONFLICT", message: "제 생각과 우리 반 모델의 의견이 조금 달라요. 표시된 부분을 한 번 더 확인해볼까요?", topPrediction: top, lowConfidence };
    return { status: "REFERENCE", message: lowConfidence ? "약한 참고 결과이므로 사진의 재질과 상태를 직접 확인해 주세요." : "우리 반 모델의 참고 결과입니다.", topPrediction: top, lowConfidence };
  }

  async function collectSupportingSkillEvidence(image, skills) {
    if (!skills.length) return { evidence: [], context: teachableSkillRuntime?.buildSkillEvidenceContext?.([]) || null, failed: false };
    try {
      const runtime = await loadTeachableSkillRuntime();
      const evidence = await runtime.getSupportingSkillEvidence(image, skills);
      return { evidence, context: runtime.buildSkillEvidenceContext(evidence), failed: evidence.some(item => item?.status === "error") };
    } catch {
      return { evidence: [], context: teachableSkillRuntime.buildSkillEvidenceContext?.([]) || null, failed: true };
    }
  }

  async function loadTeachableMachineModel(modelUrl) {
    if (!modelUrl || !window.AIWaysAiRuntime) return null;
    let baseUrl = cleanText(modelUrl);
    baseUrl = baseUrl.replace(/\/(model|metadata)\.json(?:\?.*)?$/i, "/");
    baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    const runtime = await window.AIWaysAiRuntime.loadTeachableMachine();
    return runtime.load(baseUrl + "model.json", baseUrl + "metadata.json");
  }

  function sortingVisionConfidenceBand(confidence) {
    if (!Number.isFinite(confidence)) return "unknown";
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.5) return "medium";
    return "low";
  }

  async function classifyImage(image, options = {}) {
    const requestMetadata = createSortingVisionRequestMetadata({
      requestId: options.requestId,
      idempotencyKey: options.idempotencyKey,
      imageMetadata: options.imageMetadata,
      userContext: options.userContext
    });
    activeSortingVisionRequestId = requestMetadata.requestId;
    const hints = [];
    const activeSkills = enabledClassroomSkills();
    // Supporting skill work starts immediately but is intentionally not awaited by Gemini/Safety.
    const supportingEvidencePromise = collectSupportingSkillEvidence(image, activeSkills);
    let liveGemini = false;
    let geminiCandidate = null;
    let analysisCode = "";
    let safety = { safetyLevel:"CAUTION", retakeRecommended:false, directSelectionRecommended:true, reasons:["observer_unavailable"], uxState:"caution" };
    if (teachableMachineModelPromise) {
      try {
        const model = await teachableMachineModelPromise;
        const top = (await model.predict(image))?.[0];
        if (top) hints.push(createSortingVisionHint({ label: top.className, itemId: judgementKeyFromVisualLabel(top.className) }, SORTING_VISION_SOURCES.TEACHABLE_MACHINE, {
          provider: "teachable_machine", rawConfidence: top.probability, confidenceBand: sortingVisionConfidenceBand(top.probability), requestId: requestMetadata.requestId
        }));
      } catch {
        teachableMachineModelPromise = null;
      }
    }
    try {
      const imagePayload = await prepareSortingVisionImage(image);
      const remote = await sortingVisionProviders.futureGemini.analyze({ requestMetadata, imagePayload });
      if (remote.ok && activeSortingVisionRequestId === requestMetadata.requestId) {
        liveGemini = true;
        geminiCandidate = remote.value.objectCandidates?.[0] || null;
        remote.value.objectCandidates.forEach(candidate => hints.push(createSortingVisionHint(candidate, SORTING_VISION_SOURCES.FUTURE_GEMINI, {
          provider: "future_gemini", confidenceBand: candidate.confidenceBand, requestId: requestMetadata.requestId, schemaVersion: remote.value.schemaVersion
        })));
        // 안전관찰자 조건부 호출(7단계 결정): 메인 판별이 이미 확실하면(대부분의
        // 경우) 같은 사진을 화질/구도 확인용으로 Gemini에 두 번째로 또 보낼
        // 필요가 없다 - 메인 판별 스스로 애매하다고 표시한 경우에만 "다시
        // 찍어야 할지" 안전관찰자에게 물어본다. 이게 사진 1장당 Gemini 호출
        // 2회였던 걸 대부분의 경우 1회로 줄이는 지점이다.
        if (remote.state === SORTING_VISION_STATES.UNCERTAIN) {
          const observer = await requestSortingSafetyObserver({ requestMetadata, imagePayload });
          if (observer.ok && observer.safety) safety = observer.safety;
        } else {
          safety = { safetyLevel: "SAFE", retakeRecommended: false, directSelectionRecommended: true, reasons: [], uxState: "safe" };
        }
      } else if (!remote.ok) analysisCode = remote.code || "analysis_failed";
    } catch {
      analysisCode = "analysis_failed";
    }
    const mergedHints = mergeSortingVisionHints(hints);
    // Advisory hints (Teachable Machine) must never decide the final judgement -
    // only a live Gemini candidate can. If Gemini didn't return one, there is no
    // topHint at all (no silent fallback to an advisory model).
    const topHint = mergedHints.find(hint => hint.source === SORTING_VISION_SOURCES.FUTURE_GEMINI) || null;
    const mapped = topHint ? chooseDraftFromLabel(topHint.label, topHint.rawConfidence) : { item: "판단 실패", category: "다시 시도해 주세요", guidance: "AI 분석에 실패했습니다. 사진을 다시 찍거나 올려서 다시 시도해 주세요.", ruleBased: true };
    return {
      ...mapped,
      hints: mergedHints,
      judgementKey: topHint?.itemId || "hold",
      confidence: topHint?.rawConfidence ?? null,
      source: topHint?.source || null,
      provider: topHint?.provider || null,
      confidenceBand: topHint?.confidenceBand || null,
      liveGemini,
      analysisCode,
      safety,
      ruleBased: !topHint,
      requestMetadata,
      activeSkillCount: activeSkills.length,
      supportingEvidencePromise: supportingEvidencePromise.then(payload => ({ ...payload, comparison: compareGeminiAndSkillEvidence(geminiCandidate, payload.evidence) })),
      state: topHint ? (safety.safetyLevel === "RETAKE" || mergedHints.length > 1 ? SORTING_VISION_STATES.UNCERTAIN : SORTING_VISION_STATES.SUCCESS) : SORTING_VISION_STATES.UNAVAILABLE
    };
  }

  // Local integration seam only: exposes the same prepared-image entry used after file decoding.
  // It is intentionally absent from public Pages and does not expose credentials or registry mutation.
  const e2eParams = new URLSearchParams(window.location.search);
  const e2eHost = window.location.hostname;
  if ((e2eHost === "localhost" || e2eHost === "127.0.0.1") && e2eParams.get("e2e") === "1") {
    window.__AIWAYS_E2E__ = Object.freeze({
      analyzePreparedImage: (preparedImage, options = {}) => {
        const session = Object.hasOwn(options, "session") ? options.session : modalSession;
        return runPreparedImageFlow(preparedImage, { ...options, session });
      },
      getCurrentSession: () => modalSession
    });
  }

  function openModal() {
    const modal = $("#aiModal");
    if (!modal) return;
    document.body.classList.add("modal-open");
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function resetModalState() {
    pendingDecision = null;
    currentDraft = null;
    currentAnalysisDraft = null;
    setScanning(false);
    document.body.classList.remove("modal-open");
    setDecisionConfirm(false);
    setSaveState("");
    $$("[data-final-category]").forEach(item => item.classList.remove("is-selected"));
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }
    $("#modalPreview")?.removeAttribute("src");
  }

  function closeModal(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const modal = $("#aiModal");
    if (!modal) return;
    modalSession += 1;
    resetModalState();
    if (typeof modal.close === "function" && modal.open) modal.close();
    else if (typeof modal.close !== "function") {
      modal.removeAttribute("open");
    }
  }

  function setSaveState(message) {
    const state = $("#saveState");
    if (state) state.textContent = message;
  }

  function setDecisionConfirm(visible, category = "") {
    const box = $("#decisionConfirm");
    const text = $("#pendingDecisionText");
    if (!box) return;
    box.hidden = !visible;
    if (text) text.textContent = category ? `${category} 판단을 저장할까요?` : "선택한 판단을 저장할까요?";
  }

  function setScanning(active) {
    const modal = $("#aiModal");
    if (modal) modal.classList.toggle("is-scanning", Boolean(active));
  }

  function formatConfidence(draftRecord) {
    const confidence = Number(draftRecord.ai_confidence);
    if (draftRecord.ai_engine === "future_gemini" && Number.isFinite(confidence) && confidence > 0) {
      return Math.round(confidence * 100) + "%";
    }
    return draftRecord.input_type === "search" ? "규칙 기반 제안" : "참고 제안";
  }

  function showDraftModal(draftRecord, guidance) {
    currentDraft = draftRecord;
    setScanning(false);
    const image = $("#modalPreview");
    if (image && draftRecord.input_type !== "image") image.removeAttribute("src");

    $("#draftTitle").textContent = draftRecord.mapped_item + "로 보입니다";
    $("#draftDesc").textContent = guidance || "AI raw label을 수업용 mapping rule로 연결한 1차 제안입니다. 최종 판단은 학생이 확정합니다.";
    $("#draftItem").textContent = draftRecord.mapped_item;
    $("#draftCategory").textContent = draftRecord.suggested_category;
    $("#draftConfidence").textContent = formatConfidence(draftRecord);
    pendingDecision = null;
    setDecisionConfirm(false);
    setSaveState("");
    openModal();
  }

  async function runPreparedImageFlow(image, { file, session }) {
    if (session !== modalSession) return;
    // The current tab may retry this File, but it is never persisted.
    sessionImageFile = file;
    const draft = await classifyImage(image, {
      imageMetadata: { mimeType: file.type, width: image.naturalWidth, height: image.naturalHeight, byteLength: file.size },
      idempotencyKey: activeSortingVisionIdempotencyKey,
      userContext: { selectedCorrectionType: currentSortingJudgement?.selectedCorrectionType || "" }
    });
    if (session !== modalSession) return;
    currentAnalysisDraft = draft;
    currentDraft = {
      input_type: "image",
      ai_engine: draft.source || "fallback-rule",
      ai_raw_label: draft.item,
      ai_confidence: draft.ruleBased ? "" : Number(draft.confidence || 0).toFixed(4),
      mapped_item: draft.item,
      suggested_category: draft.category,
      final_decision: draft.category,
      hold_flag: false
    };

    showDraftModal(currentDraft, draft.guidance);
    runThreeSecondJudgement({ key: draft.judgementKey }, {
      source: "photo",
      candidateSource: draft.source || "photo_hint",
      provider: draft.provider || "fallback_rule",
      schemaVersion: draft.requestMetadata?.schemaVersion,
      requestId: draft.requestMetadata?.requestId,
      confidenceBand: draft.confidenceBand,
      candidateKeys: draft.hints?.map(hint => hint.itemId).filter(Boolean),
      confidence: draft.confidence,
      imageHints: draft.hints.map(hint => `${hint.source === "tm_hint" ? "우리 학교 학습 모델 참고 후보" : hint.source === "future_gemini" ? "AI 사진 분석 참고 후보" : "사진 기반 참고 후보"}: ${hint.label}`),
      liveGemini: draft.liveGemini,
      analysisCode: draft.analysisCode,
      delay: 0
    });
    draft.supportingEvidencePromise?.then(payload => {
      if (session !== modalSession || !currentSortingJudgement) return;
      const currentRequestId = cleanText(currentSortingJudgement.requestId);
      if (currentRequestId && currentRequestId !== cleanText(draft.requestMetadata?.requestId)) return;
      const supportingEvidence = Array.isArray(payload?.evidence) ? payload.evidence : [];
      if (!supportingEvidence.some(item => item?.status === "success")) return;
      renderJudgementResult({ ...currentSortingJudgement, supportingEvidence, skillEvidenceContext: payload.context, skillComparison: payload.comparison }, $("[data-sorting-result]"));
    });
  }

  async function handleImage(file) {
    if (!file || !file.type.startsWith("image/")) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    activeSortingVisionIdempotencyKey = createAnalysisIdempotencyKey();
    const session = ++modalSession;

    const image = $("#modalPreview");
    if (!image) return;

    image.src = previewUrl;
    currentDraft = {
      input_type: "image",
      ai_engine: "pending",
      ai_raw_label: "pending",
      ai_confidence: 0,
      mapped_item: "분석 중",
      suggested_category: "분석 중",
      final_decision: "",
      hold_flag: false
    };

    $("#draftTitle").textContent = "AI가 분류를 제안하고 있습니다";
    $("#draftDesc").textContent = "학생이 최종 판단을 누르기 전까지 기록은 저장되지 않습니다.";
    $("#draftItem").textContent = "분석 중";
    $("#draftCategory").textContent = "분석 중";
    $("#draftConfidence").textContent = "-";
    setSaveState("");
    setScanning(true);
    openModal();

    image.onload = () => runPreparedImageFlow(image, { file, session });

    image.onerror = () => {
      if (session !== modalSession) return;
      setScanning(false);
      setSaveState("사진을 불러오지 못했습니다. 다른 사진을 선택해 주세요.");
    };
  }

  function initTabs() {
    const tabs = $$("[data-tab]");
    const panels = $$("[data-panel]");

    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(item => item.classList.toggle("is-active", item === tab));
        panels.forEach(panel => panel.classList.toggle("is-active", panel.dataset.panel === tab.dataset.tab));
        if (tab.dataset.tab === "quiz" && (!quizSet.length || cleanText($("#quizProgress")?.textContent) === "퀴즈 완료")) {
          startSortingQuiz();
        }
      });
    });

    $("[data-quiz-answer]")?.addEventListener("click", () => {
      const result = $("#quizResult");
      if (result) result.textContent = "맞아요. 오염이 심하면 AI 제안보다 보류 판단이 먼저입니다.";
    });
  }

  // PAGE_FINAL_FIX_06_GALLERY_START
  function initGallery() {
    const stage = $("#galleryStage");
    const detail = $("#galleryDetail");
    const back = $("#galleryBack");
    const grid = $("#galleryDetailGrid", detail);
    if (!stage || !detail || !grid) return;

    const titleNode = $("#galleryDetailTitle", detail);
    const numberNode = $("#galleryDetailNumber", detail);
    const captionNode = $("#galleryDetailCaption", detail);
    const galleryItems = {
      "학생 VOC 활동지": {
        number: "01",
        caption: "학생들이 발견한 불편함을 실제 활동지 이미지로 확인합니다.",
        images: ["assets/gallery/01-1.png", "assets/gallery/01-2.png"]
      },
      "쓰레기매립지 알아보기": {
        number: "02",
        caption: "우리 지역의 쓰레기 흐름과 매립지 문제를 탐구한 기록입니다.",
        images: ["assets/gallery/02-1.png", "assets/gallery/02-2.png"]
      },
      "아이디어 확장하기": {
        number: "03",
        caption: "AI와 함께 확장한 자원순환 UX 아이디어 산출물입니다.",
        images: ["assets/gallery/03-1.jpg", "assets/gallery/03-2.jpg"]
      },
      "딜레마 토론": {
        number: "04",
        caption: "AI 제안을 사람이 다시 판단한 토론 기록입니다.",
        images: ["assets/gallery/04-1.jpg", "assets/gallery/04-2.jpg"]
      },
      "블록코딩": {
        number: "05",
        caption: "AI 이미지 분류 원리를 블록코딩으로 이해한 활동입니다.",
        images: ["assets/gallery/05-1.jpg", "assets/gallery/05-2.jpg"]
      },
      "이미지 모델 학습 자료": {
        number: "06",
        caption: "Teachable Machine을 위한 이미지 모델 학습 자료입니다.",
        images: ["assets/gallery/06-1.png", "assets/gallery/06-2.png"]
      },
      "3초판단 앱 프로토타입": {
        number: "07",
        caption: "학생 확인을 중심에 둔 3초판단 앱 프로토타입입니다.",
        images: ["assets/gallery/07-1.png", "assets/gallery/07-2.png"]
      },
      "H-A-H 토의하기": {
        number: "08",
        caption: "Human → AI → Human 흐름으로 판단을 조정한 토의 기록입니다.",
        images: ["assets/gallery/08-1.jpg", "assets/gallery/08-2.jpg"]
      }
    };

    function showMissingSlot() {
      return '<figure class="gallery-detail-photo is-missing"><span>이미지 준비 중</span></figure>';
    }

    function openDetail(card) {
      const title = card.dataset.gallery || cleanText(card.textContent) || "학생 산출물";
      const item = galleryItems[title] || {
        number: "--",
        caption: "이미지 준비 중",
        images: []
      };

      if (numberNode) numberNode.textContent = item.number;
      if (titleNode) titleNode.textContent = title;
      if (captionNode) captionNode.textContent = item.caption;
      grid.innerHTML = item.images.length
        ? item.images.map((src, index) => `
            <figure class="gallery-detail-photo">
              <img src="${src}" alt="${title} ${index + 1}" loading="lazy" />
            </figure>
          `).join("")
        : showMissingSlot() + showMissingSlot();

      $$("img", grid).forEach(img => {
        img.addEventListener("error", () => {
          const photo = img.closest(".gallery-detail-photo");
          if (!photo) return;
          photo.classList.add("is-missing");
          photo.innerHTML = "<span>이미지 준비 중</span>";
        }, { once: true });
      });

      stage.classList.add("is-detail");
    }

    stage.addEventListener("click", event => {
      const card = event.target.closest("[data-gallery]");
      if (!card || !stage.contains(card)) return;
      event.preventDefault();
      openDetail(card);
    });

    back?.addEventListener("click", () => {
      stage.classList.remove("is-detail");
      grid.innerHTML = "";
    });
  }
  // PAGE_FINAL_FIX_06_GALLERY_END

  // PAGE_FINAL_FIX_01_DASHBOARD_START
  function initRefreshControls() {
    const refresh = $("[data-refresh-records]");
    if (!refresh) return;

    refresh.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      refresh.classList.add("is-loading");
      refresh.setAttribute("aria-busy", "true");
      beginDashboardRepaint("landfill", 1900);
      refreshLandfillMonitor();
      window.setTimeout(() => {
        refresh.classList.remove("is-loading");
        refresh.removeAttribute("aria-busy");
      }, 1600);
    });
  }

  function initRankingModal() {
    const note = $(".rank-note");
    if (!note) return;

    note.addEventListener("click", openRankingModal);
    note.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openRankingModal();
    });

    document.addEventListener("click", event => {
      const modal = $("#rankingModal");
      if (!modal || modal.hidden) return;
      if (event.target === modal || event.target.closest(".ranking-close")) closeRankingModal();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeRankingModal();
    });
  }

  function initLandfillSourceLink() {
    const panel = $(".landfill-panel[data-source-url]");
    if (!panel) return;

    panel.addEventListener("click", event => {
      if (event.target.closest("a, button, input, select, label")) return;
      const url = panel.dataset.sourceUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  function resetCurriculumCardInteractionState(suppressHover = false) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".subject-card")) active.blur();

    $$(".subject-card").forEach(card => {
      card.classList.remove("active", "is-active", "selected", "is-selected", "is-focused", "focus");
      if (suppressHover) card.classList.add("is-hover-suppressed");
      if (card instanceof HTMLElement && card.matches(":focus")) card.blur();
    });
  }

  function initCurriculumCardFocusReset() {
    if (window.__AIWAYS_CURRICULUM_CARD_FOCUS_RESET__) return;
    window.__AIWAYS_CURRICULUM_CARD_FOCUS_RESET__ = true;
    const cards = $$(".subject-card");
    if (!cards.length) return;

    cards.forEach(card => {
      card.addEventListener("click", () => {
        card.classList.add("is-hover-suppressed");
        window.setTimeout(() => resetCurriculumCardInteractionState(true), 0);
      });
      card.addEventListener("pointerenter", () => card.classList.remove("is-hover-suppressed"));
      card.addEventListener("pointerleave", () => {
        card.classList.remove("is-hover-suppressed");
        if (card instanceof HTMLElement && !card.matches(":focus-visible")) card.blur();
      });
      card.addEventListener("focus", () => {
        if (card.matches(":focus-visible")) card.classList.remove("is-hover-suppressed");
      });
    });

    const resetAfterReturn = () => window.setTimeout(() => resetCurriculumCardInteractionState(true), 0);
    window.addEventListener("focus", resetAfterReturn);
    window.addEventListener("pageshow", resetAfterReturn);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) resetAfterReturn();
    });
  }
  // PAGE_FINAL_FIX_01_DASHBOARD_END

  function initSelectors() {
    const seenClasses = new Set();
    $$("#gradeSelect option, #classSelect option").forEach(option => {
      option.value = cleanText(option.textContent);
    });
    $$("#classSelect option").forEach(option => {
      const label = cleanText(option.textContent);
      if (seenClasses.has(label)) option.remove();
      else seenClasses.add(label);
    });
    // 실제 학교가 설정된 상태에서는 school-panel/class-panel을
    // loadSchoolDashboardFromApi()가 전담한다(위 주석 참고 - 3단계부터
    // 구글시트 폴링 대신 Firestore 집계로 넘어감). 그런데도 학년/반을
    // 바꿀 때마다 여기서 applyDashboard(로컬/시드 데이터)를 무조건 같이
    // 불러버려서, 그 더미 숫자가 잠깐 그려졌다가 API 응답이 도착하면
    // 진짜 데이터로 다시 바뀌는 깜빡임이 매번 생겼다(사용자 지적: "학년
    // 반 고를때마다 계속 생김"). 학교가 아직 없거나 "샘플 데이터
    // 보기" 중일 때만 applyDashboard로 로컬 데이터를 보여준다.
    $("#gradeSelect")?.addEventListener("change", () => {
      beginDashboardRepaint("school", 980);
      if (!resolveDashboardSchoolId() || isSamplePreview()) applyDashboard(allStoredRecords());
      loadSchoolDashboardFromApi();
    });
    $("#classSelect")?.addEventListener("change", () => {
      beginDashboardRepaint("class", 980);
      if (!resolveDashboardSchoolId() || isSamplePreview()) applyDashboard(allStoredRecords());
      loadSchoolDashboardFromApi();
    });
  }

  function initUpload() {
    const cameraInput = $("#cameraInput");
    const uploadInput = $("#uploadInput");

    $$("[data-upload]").forEach(button => {
      button.addEventListener("click", () => {
        if (button.dataset.upload === "camera") cameraInput?.click();
        else uploadInput?.click();
      });
    });

    [cameraInput, uploadInput].forEach(input => {
      input?.addEventListener("change", () => {
        const file = input.files && input.files[0];
        handleImage(file);
        input.value = "";
      });
    });

    $$("[data-final-category]").forEach(button => {
      button.addEventListener("click", () => {
        if (!currentDraft) return;
        const finalCategory = button.dataset.finalCategory;
        const isHold = finalCategory === "판단 보류";
        pendingDecision = {
          ...currentDraft,
          hold_flag: isHold,
          final_decision: finalCategory,
          suggested_category: currentDraft.suggested_category
        };
        $$("[data-final-category]").forEach(item => item.classList.toggle("is-selected", item === button));
        setDecisionConfirm(true, finalCategory);
        setSaveState("확인을 누르면 판단 기록만 저장됩니다.");
      });
    });

    $("#confirmDecision")?.addEventListener("click", async () => {
      if (!pendingDecision) return;
      setSaveState(pendingDecision.hold_flag ? "판단 보류를 저장 중입니다..." : "학생 최종 판단을 저장 중입니다...");
      const decision = pendingDecision;
      const saved = await appendRecord(pendingDecision);
      updateSortingFromRecord(decision, saved);
      pendingDecision = null;
      setDecisionConfirm(false);
      $$("[data-final-category]").forEach(item => item.classList.remove("is-selected"));
      setSaveState(storageMessage(saved, decision.hold_flag ? "hold" : "record"));
    });

    $("#cancelDecision")?.addEventListener("click", () => {
      pendingDecision = null;
      setDecisionConfirm(false);
      $$("[data-final-category]").forEach(item => item.classList.remove("is-selected"));
      setSaveState("저장하지 않았습니다. 다시 판단을 선택할 수 있습니다.");
    });

    $("#aiModal")?.addEventListener("close", resetModalState);

    $("#aiModal")?.addEventListener("cancel", event => {
      closeModal(event);
    });

    $("#aiModal")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeModal();
    });

    $$("[data-close-analysis]").forEach(button => {
      button.addEventListener("click", closeModal);
    });
  }

  function initClassroomSkills() {
    if (!classroomSkillRegistry) return;
    const form = $("#classroomSkillForm"), list = $("#classroomSkillList"), preview = $("#classroomSkillPreview"), status = $("#classroomSkillStatus"), count = $("#classroomSkillCount"), seedButton = $("#classroomSeedSkillButton");
    if (!form || !list) return;
    const profileForm = $("#classProfileForm"), profileStatus = $("#classProfileStatus"), profileActions = $("#classProfileActions"), profileChange = $("#classProfileChangeButton"), profileClear = $("#classProfileClearButton");
    let pending = null;
    const scope = classroomSkillScope;
    const offerRetry = message => {
      status.replaceChildren(document.createTextNode(message + " "));
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = sessionImageFile ? "다시 분석하기" : "다시 촬영하기";
      retry.addEventListener("click", () => sessionImageFile ? handleImage(sessionImageFile) : $("[data-upload=\"camera\"]")?.click());
      status.append(retry);
    };
    const render = () => {
      const skills = enabledClassroomSkills();
      if (count) count.textContent = `우리 반이 AI에게 가르친 기술 ${skills.length}개`;
      list.replaceChildren();
      if (!skills.length) { const empty = document.createElement("li"); empty.className = "empty-state"; empty.textContent = "아직 우리 반이 가르쳐준 기술이 없어요. 첫 번째 기술을 만들어볼까요? 🎓"; list.append(empty); return; }
      skills.forEach(skill => {
        const item = document.createElement("li"), copy = document.createElement("span"), title = document.createElement("strong"), detail = document.createElement("small"), toggle = document.createElement("button");
        title.textContent = skill.name; detail.textContent = `${skill.className} · ${skill.classes.length}개 클래스 · v${skill.version} · ${skill.status === "enabled" ? "활성" : "비활성"}`;
        copy.append(title, document.createElement("br"), detail); toggle.type = "button"; toggle.textContent = skill.status === "enabled" ? "비활성화" : "활성화";
        toggle.addEventListener("click", () => { skill.status === "enabled" ? classroomSkillRegistry.disableSkill(skill.skillId) : classroomSkillRegistry.enableSkill(skill.skillId); render(); });
        item.append(copy, toggle); list.append(item);
      });
    };
    const renderProfile = () => {
      if (!profileForm || !profileStatus || !profileActions) return;
      if (!activeClassProfile) {
        profileForm.hidden = false;
        profileActions.hidden = true;
        profileStatus.textContent = "반을 연결하면 우리 반 Skill만 참고용으로 사용합니다.";
        return;
      }
      const modeLabel = activeClassProfile.mode === "class_device" ? " · 공용 기기" : "";
      profileStatus.textContent = `${activeClassProfile.schoolName} ${activeClassProfile.grade}학년 ${activeClassProfile.className}반과 연결됨${modeLabel}`;
      profileForm.hidden = true;
      profileActions.hidden = false;
      if (profileChange) profileChange.textContent = activeClassProfile.mode === "class_device" ? "공용 기기 반 변경" : "다른 반으로 연결";
    };
    const showProfileForm = () => {
      if (!profileForm) return;
      profileForm.hidden = false;
      profileActions.hidden = true;
      if (activeClassProfile) {
        $("#classProfileSchoolId").value = activeClassProfile.schoolId;
        $("#classProfileSchoolName").value = activeClassProfile.schoolName;
        $("#classProfileGrade").value = activeClassProfile.grade;
        $("#classProfileClassName").value = activeClassProfile.className;
        $("#classProfileMode").value = activeClassProfile.mode;
      }
    };
    profileForm?.addEventListener("submit", event => {
      event.preventDefault();
      if (!classProfileStore) { profileStatus.textContent = "반 연결 저장소를 준비하지 못했습니다. 기존 분류 기능은 계속 사용할 수 있습니다."; return; }
      try {
        activeClassProfile = classProfileStore.saveClassProfile({
          schoolId: $("#classProfileSchoolId").value,
          schoolName: $("#classProfileSchoolName").value,
          grade: $("#classProfileGrade").value,
          classId: $("#classProfileClassName").value,
          className: $("#classProfileClassName").value,
          mode: $("#classProfileMode").value
        });
        renderProfile();
        render();
      } catch {
        profileStatus.textContent = "학교, 학년, 반과 연결 방식을 모두 확인해 주세요.";
      }
    });
    profileChange?.addEventListener("click", showProfileForm);
    profileClear?.addEventListener("click", () => {
      classProfileStore?.clearClassProfile?.();
      activeClassProfile = null;
      profileForm?.reset();
      renderProfile();
      render();
    });
    seedButton?.addEventListener("click", () => {
      try {
        const exists = classroomSkillRegistry.listSkills(scope()).some(skill => skill.modelBaseUrl === AIWAYS_SEED_SKILL.modelBaseUrl);
        if (exists) { status.textContent = "AI Ways Seed 분리수거 Skill은 이미 우리 반 참고 기술로 연결되어 있습니다."; return; }
        const result = classroomSkillRegistry.registerSkill({ ...AIWAYS_SEED_SKILL, ...scope(), createdByScope: scope() });
        offerRetry(result.announcement.message);
        render();
      } catch { status.textContent = "Seed Skill을 연결하지 못했습니다. HTTPS 모델 주소를 다시 확인해 주세요."; }
    });
    form?.addEventListener("submit", async event => {
      event.preventDefault();
      const name = $("#classroomSkillName")?.value.trim(), description = $("#classroomSkillDescription")?.value.trim(), url = $("#classroomSkillUrl")?.value.trim(), visibility = $("#classroomSkillVisibility")?.value;
      try {
        status.textContent = "model.json과 metadata.json을 확인하고 있어요.";
        const checked = await window.AIWaysClassroomSkillRegistry.previewTeachableMachineModel(url);
        pending = { name, description, visibility, ...scope(), createdByScope: scope(), ...checked };
        preview.hidden = false; preview.replaceChildren();
        const text = document.createElement("p"); text.textContent = `클래스 ${checked.classes.length}개: ${checked.classes.join(", ")}`;
        const confirm = document.createElement("button"); confirm.type = "button"; confirm.textContent = "이 기술 등록";
        confirm.addEventListener("click", () => {
          try { const result = classroomSkillRegistry.registerSkill(pending); offerRetry(result.announcement.message); preview.hidden = true; preview.replaceChildren(); form.reset(); pending = null; render(); }
          catch (error) { status.textContent = error.message === "skill_model_url_duplicate" ? "같은 반에 이미 등록된 모델 URL입니다. 새 버전은 별도로 기록하세요." : "기술을 등록하지 못했습니다."; }
        });
        preview.append(text, confirm); status.textContent = "미리보기를 확인한 뒤 등록하세요. 이 모델은 아직 추론에 사용되지 않습니다.";
      } catch (error) {
        pending = null; preview.hidden = true; preview.replaceChildren();
        const messages = { model_url_invalid: "HTTPS Teachable Machine 모델 URL을 입력하세요.", model_url_https_required: "HTTPS URL만 사용할 수 있습니다.", model_url_localhost_forbidden: "localhost 모델 URL은 등록할 수 없습니다.", model_files_unavailable: "model.json 또는 metadata.json을 확인할 수 없습니다.", model_metadata_invalid: "metadata.json의 클래스 라벨을 읽을 수 없습니다.", model_cors_or_network_failed: "모델 파일 접근이 CORS 또는 네트워크 정책으로 차단됐습니다." };
        status.textContent = messages[error.message] || "모델 주소를 확인할 수 없습니다.";
      }
    });
    renderProfile();
    render();
  }

  function boot() {
    // 폰 폭(deviceTier.js와 같은 기준, 767px)에서는 화면 자체를 mobile/ 앱
    // iframe으로 대체하므로, 이 PC용 대시보드 초기화(구글시트 JSONP 폴링 등)를
    // 뒤에서 돌릴 이유가 없다 - 안 보이는데도 계속 실행되며 콘솔에 에러만
    // 남기고 있었다.
    if (window.innerWidth <= 767) return;
    initNavigation();
    initTabs();
    // "3초 판단" 퀴즈/보류함 로컬 상태는 사진 판단 흐름(#confirmDecision)이
    // 계속 읽고 쓰므로 로딩/초기 렌더는 유지한다 - 그 흐름을 여는 옛 UI 자체
    // (검색창, 빠른선택 그리드, 자체 퀴즈 탭 등)만 화면에서 사라져
    // initQuickButtons()/initSortingDataApp()의 나머지 부분은 제거했다.
    loadSortingStorage();
    renderSortingStats();
    renderSortingHolds();
    initGallery();
    initSelectors();
    initUpload();
    initClassroomSkills();
    initDashboardSchoolSetup();
    initDashboardSettingsMenu();
    initTeacherApprovalModal();
    initRefreshControls();
    initRankingModal();
    initLandfillSourceLink();
    initCurriculumCardFocusReset();
    prepareDashboardIntroState();
    renderLandfillTimeNow();
    loadDashboardRows({ animateIntro: true });
    // The splash is hidden from playDashboardIntroForCurrentData once the
    // first real (seed) render actually lands - see the comment there. This
    // used to hide on the very next animation frame after this call, which
    // is before the seed fetch this triggers has even resolved: the fade
    // played out over a still-empty, zeroed-out dashboard, so by the time a
    // person could react the splash was already gone and there was nothing
    // behind it yet to reveal.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
