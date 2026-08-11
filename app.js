(() => {
  "use strict";

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("beforeunload", () => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  });

  let kioskEventTag = "";

  const DATA_CONFIG = {
    appsScriptUrl: "https://script.google.com/macros/s/AKfycbykh5VyFwzbA55nLTFNsWlhSoqiFl49JA1o3UUBHHsSOTOC9YaNj_e9rCnwZIEsLKR8/exec",
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
  const localSortingStore = window.AIWaysSortingLocalStore?.createSortingLocalStore?.();
  window.AIWaysLocalSortingPersistence = { persistSortingDecisionLocally: input => localSortingStore?.saveLocalSortingRecord(input), listPendingSortingRecords: () => localSortingStore?.listPendingSortingRecords(), syncPendingSortingRecords: syncOne => localSortingStore?.syncPendingSortingRecords(syncOne), resolveLocalHeldRecord: (id, patch) => localSortingStore?.resolveLocalHeldRecord(id, patch), buildSortingRecordsCsv: records => window.AIWaysSortingLocalStore?.buildSortingRecordsCsv(records) };
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
      ["스티커 붙은 종이상자", 29],
      ["테이프 붙은 박스", 24],
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
      ["테이프 붙은 박스", 20],
      ["빨대", 16]
    ],
    "5학년 2반": [
      ["코팅종이", 32],
      ["영수증", 27],
      ["종이컵", 22],
      ["스티커 붙은 종이상자", 18],
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
      ["테이프 붙은 박스", 33],
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

  function buildExpandedSortingQuizData(seedQuestions) {
    const quizItems = [
      ["🥛", "우유갑", "종이팩류", "내용물을 비우고 헹군 뒤 펼쳐 말린"],
      ["🧃", "멸균팩", "종이팩류", "빨대를 분리하고 헹군 뒤 말린"],
      ["📄", "깨끗한 종이", "종이류", "물기와 테이프를 제거한"],
      ["📘", "코팅 공책", "판단 보류", "코팅 여부를 확인한"],
      ["📦", "택배상자", "종이류", "송장과 테이프를 제거한"],
      ["🥤", "플라스틱컵", "플라스틱류", "남은 음료를 비우고 헹군"],
      ["🧴", "페트병", "플라스틱류", "라벨을 제거하고 찌그러뜨린"],
      ["🧴", "샴푸통", "플라스틱류", "내용물을 비우고 헹군"],
      ["🛍️", "깨끗한 비닐봉투", "비닐류", "이물질을 털어낸"],
      ["🍿", "과자봉지", "비닐류", "부스러기와 기름기를 확인한"],
      ["🍜", "컵라면 용기", "일반쓰레기 검토", "국물 자국과 기름때를 확인한"],
      ["🥫", "알루미늄 캔", "캔류", "내용물을 비우고 헹군"],
      ["🍾", "유리병", "유리류", "뚜껑을 분리하고 깨지지 않게 정리한"],
      ["🔋", "폐건전지", "전용 수거함", "전용 수거함 위치를 확인한"],
      ["🧾", "영수증", "일반쓰레기", "감열지 여부를 확인한"],
      ["🧻", "사용한 휴지", "일반쓰레기", "오염 상태를 확인한"],
      ["☕", "코팅 종이컵", "판단 보류", "오염과 코팅 상태를 확인한"],
      ["🥢", "나무젓가락", "일반쓰레기 검토", "음식물 오염 여부를 확인한"],
      ["🍕", "피자박스", "일반쓰레기 검토", "기름 묻은 부분을 분리한"],
      ["🧸", "고장난 장난감", "판단 보류", "복합 재질 여부를 확인한"],
      ["📏", "부러진 자", "판단 보류", "재질과 파손 상태를 확인한"],
      ["🧲", "자석 홍보물", "판단 보류", "자석과 종이를 분리 가능한지 확인한"],
      ["🧷", "클립이 붙은 종이", "종이류", "금속 클립을 분리한"],
      ["🧽", "수세미", "일반쓰레기", "여러 재질이 섞였는지 확인한"],
      ["🧼", "세제 리필 파우치", "판단 보류", "재질 표시와 오염 상태를 확인한"],
      ["🥡", "검은색 플라스틱 용기", "판단 보류", "선별 가능 여부를 확인한"],
      ["🍱", "배달 용기", "판단 보류", "음식물 오염을 확인한"],
      ["🪥", "칫솔", "일반쓰레기 검토", "복합 재질 여부를 확인한"],
      ["🖊️", "볼펜", "일반쓰레기 검토", "분리 가능한 부품을 확인한"],
      ["📚", "스프링 노트", "종이류", "스프링과 종이를 분리한"],
      ["🧪", "깨진 유리", "별도 배출", "안전하게 감싼 뒤 학교 기준을 확인한"],
      ["🧂", "양념 묻은 비닐", "일반쓰레기 검토", "오염 정도를 확인한"],
      ["🥚", "달걀 껍데기", "일반쓰레기", "지역 음식물 기준을 확인한"],
      ["🍗", "닭뼈", "일반쓰레기", "음식물쓰레기 예외 기준을 확인한"],
      ["🐚", "조개껍데기", "일반쓰레기", "음식물쓰레기 예외 기준을 확인한"],
      ["🧊", "스티로폼", "스티로폼류", "테이프와 이물질을 제거한"],
      ["🧴", "펌프형 용기", "판단 보류", "스프링과 몸체를 분리 가능한지 확인한"],
      ["📎", "복합 재질 물건", "판단 보류", "재질이 섞인 부분을 확인한"],
      ["🧃", "빨대", "판단 보류", "작은 플라스틱 선별 기준을 확인한"],
      ["🟨", "이름 모를 물건", "판단 보류", "아무 데나 버리지 않고 기록한"]
    ];
    const trueTemplates = [
      item => `${item.name}은 ${item.action} 뒤 ${item.category} 기준으로 검토하는 것이 좋다.`,
      item => `${item.name}은 배출 전 오염 상태와 학교 수거 기준을 함께 확인해야 한다.`,
      item => `${item.name}처럼 헷갈리는 물건은 AI 제안 후 학생이 다시 확인하는 과정이 필요하다.`,
      item => `${item.name}은 분리 가능한 부품을 떼어내면 자원순환 품질을 높일 수 있다.`,
      item => `${item.name}을 판단 보류함에 남기는 것도 아무 데나 버리지 않는 실천이다.`,
      item => `${item.name}은 같은 이름이어도 오염 상태에 따라 최종 판단이 달라질 수 있다.`,
      item => `${item.name} 배출 기준은 우리 학교 수거함 안내와 지역 기준을 같이 살펴야 한다.`,
      item => `${item.name}을 기록하면 우리 반 자원순환 데이터가 더 정확해진다.`
    ];
    const falseTemplates = [
      item => `${item.name}은 오염 상태와 상관없이 무조건 ${item.category}로 버리면 된다.`,
      item => `${item.name}은 AI가 한 번 제안하면 학생 확인 없이 바로 최종 판단해도 된다.`,
      item => `${item.name}은 학교 기준을 보지 않아도 전국 어디서나 항상 같은 수거함에 넣는다.`,
      item => `${item.name}은 음식물이나 액체가 묻어도 재활용 품질에 영향을 주지 않는다.`,
      item => `${item.name}은 작거나 가벼우면 아무 일반 수거함에 섞어도 괜찮다.`,
      item => `${item.name}은 분리 가능한 부품이 있어도 그대로 버리는 것이 항상 더 좋다.`,
      item => `${item.name}을 헷갈릴 때 보류함에 기록하는 것은 자원순환 실천이 아니다.`,
      item => `${item.name}은 친구 의견이나 학교 안내보다 색깔만 보고 분류하면 충분하다.`
    ];
    const trueQuestions = seedQuestions.filter(item => item.answer);
    const falseQuestions = seedQuestions.filter(item => !item.answer);

    quizItems.forEach(([emoji, name, category, action]) => {
      const item = { emoji, name, category, action };
      trueTemplates.forEach(template => {
        trueQuestions.push({
          emoji,
          question: template(item),
          answer: true,
          explanation: "맞는 판단입니다. 오염 상태, 재질, 학교 기준을 함께 확인하는 습관이 중요합니다."
        });
      });
      falseTemplates.forEach(template => {
        falseQuestions.push({
          emoji,
          question: template(item),
          answer: false,
          explanation: "아쉬워요. 분리배출은 물건 이름만이 아니라 오염 상태와 학교 기준까지 함께 봐야 합니다."
        });
      });
    });

    const balanced = [];
    for (let index = 0; index < 250; index += 1) {
      balanced.push(trueQuestions[index % trueQuestions.length]);
      balanced.push(falseQuestions[index % falseQuestions.length]);
    }
    return balanced;
  }

  const sortingQuizData = buildExpandedSortingQuizData([
    ["🧾", "영수증은 깨끗해 보여도 감열지라 일반쓰레기로 배출하는 것이 맞다.", true],
    ["🥛", "우유갑은 일반 종이와 같은 수거함에 섞어도 항상 괜찮다.", false],
    ["📦", "택배상자는 테이프와 송장을 최대한 제거하고 종이류로 배출한다.", true],
    ["🥤", "플라스틱컵은 남은 음료를 비우고 헹군 뒤 배출해야 한다.", true],
    ["🍜", "국물 자국이 심한 컵라면 용기는 재활용보다 일반쓰레기 검토가 필요하다.", true],
    ["🍿", "과자봉지는 부스러기와 기름기가 많아도 무조건 비닐류다.", false],
    ["🥫", "캔 안에 이물질이 들어 있으면 먼저 비우는 것이 좋다.", true],
    ["🔋", "폐건전지는 일반쓰레기 봉투에 넣어도 안전하다.", false],
    ["🪥", "칫솔처럼 여러 재질이 결합된 생활용품은 일반쓰레기 검토가 필요하다.", true],
    ["🖊️", "볼펜은 플라스틱처럼 보여도 재질 분리가 어려워 일반쓰레기로 보는 경우가 많다.", true],
    ["🧼", "지우개 조각은 종이류와 함께 버리면 좋다.", false],
    ["🍌", "바나나 껍질은 지역 기준에 따라 음식물쓰레기로 배출할 수 있다.", true],
    ["🥚", "달걀 껍데기는 음식물쓰레기로 항상 배출한다.", false],
    ["🧃", "빨대가 붙은 음료팩은 빨대를 분리하고 팩을 헹구는 것이 좋다.", true],
    ["☕", "종이컵 안쪽 코팅과 오염 상태가 애매하면 학교 기준을 다시 확인한다.", true],
    ["🧴", "페트병은 내용물을 비우고 라벨을 제거한 뒤 찌그러뜨려 배출하면 좋다.", true],
    ["🧴", "페트병 뚜껑은 닫아도 되는지 학교 기준에 따라 확인할 필요가 있다.", true],
    ["🍱", "음식물이 묻은 배달 용기는 씻기 어렵다면 재활용함을 오염시킬 수 있다.", true],
    ["🧻", "물티슈는 종이류로 재활용하는 것이 원칙이다.", false],
    ["📄", "코팅된 전단지는 일반 종이와 다르게 판단이 필요할 수 있다.", true],
    ["🧲", "자석이 붙은 홍보물은 종이류로만 보면 안 된다.", true],
    ["🧃", "종이팩은 펼쳐 말린 뒤 배출하면 재활용 품질이 좋아진다.", true],
    ["🥢", "나무젓가락은 깨끗하면 종이류로 배출한다.", false],
    ["🍕", "기름이 밴 피자박스는 오염된 부분을 일반쓰레기로 검토한다.", true],
    ["🧊", "스티로폼은 이물질과 테이프를 제거하고 깨끗할 때 분리배출한다.", true],
    ["🧷", "클립과 종이는 가능하면 분리해서 배출한다.", true],
    ["🧽", "수세미는 플라스틱류로 재활용하는 것이 일반적이다.", false],
    ["🧴", "샴푸통은 내용물을 비우고 헹군 뒤 배출한다.", true],
    ["🛍️", "비닐봉투는 음식물 오염이 심하면 비닐류 배출이 어려울 수 있다.", true],
    ["🧃", "빨대는 작고 재질이 달라 별도 판단이 필요할 수 있다.", true],
    ["🪙", "알루미늄 캔과 철 캔은 같은 캔류 흐름에서 관리될 수 있다.", true],
    ["📚", "스프링 노트는 종이와 스프링을 분리하면 더 좋다.", true],
    ["🧴", "펌프형 용기는 금속 스프링이 있어 재질 분리가 필요하다.", true],
    ["🧂", "양념이 묻은 비닐은 깨끗한 비닐과 섞지 않는 것이 좋다.", true],
    ["🥤", "플라스틱 빨대는 작아서 선별이 어려울 수 있다.", true],
    ["📦", "택배 완충재는 재질에 따라 비닐류 또는 일반쓰레기로 나뉠 수 있다.", true],
    ["🧻", "휴지는 사용 후 오염되므로 종이류로 재활용하지 않는다.", true],
    ["🥫", "통조림 캔은 내용물을 비우고 헹구면 재활용에 도움이 된다.", true],
    ["🧴", "화장품 용기는 내용물을 비우고 재질 표시를 확인한다.", true],
    ["🧃", "멸균팩과 일반 종이팩은 수거 체계가 다를 수 있어 학교 기준을 확인한다.", true],
    ["🧸", "고장난 장난감은 플라스틱류로 무조건 배출한다.", false],
    ["📎", "복합 재질 물건은 판단 보류함에 기록해 기준을 정할 수 있다.", true],
    ["🍗", "닭뼈는 음식물쓰레기가 아니라 일반쓰레기로 보는 지역이 많다.", true],
    ["🐚", "조개껍데기는 음식물쓰레기로 배출하면 사료화에 좋다.", false],
    ["🥤", "테이크아웃 컵의 뚜껑과 컵은 재질이 다를 수 있어 분리 확인이 필요하다.", true],
    ["🧪", "깨진 유리는 안전하게 감싸 별도 배출 기준을 확인한다.", true],
    ["🧼", "세제 리필 파우치는 내용물을 비우고 재질 표시를 확인한다.", true],
    ["🥡", "검은색 플라스틱 용기는 선별이 어려울 수 있어 지역 기준을 확인한다.", true],
    ["🟨", "모르는 물건을 아무 데나 버리지 않고 보류하는 것도 좋은 선택이다.", true],
    ["🌱", "AI가 제안한 분류는 학생이 오염 상태와 학교 기준으로 다시 확인해야 한다.", true]
  ].map(([emoji, question, answer]) => ({
    emoji,
    question,
    answer,
    explanation: answer ? "맞는 기준입니다. 실제 배출 전 오염 상태와 학교 기준을 한 번 더 확인해요." : "헷갈리기 쉬운 기준입니다. 재질과 오염 상태를 다시 살펴봐요."
  })));

  let mobileNetModelPromise = null;
  let teachableMachineModelPromise = null;
  let currentDraft = null;
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
  let sortingStats = { totalCount: 0, carbonReduction: 0, logs: [] };
  let sortingHoldItems = [];
  let selectedSortingKey = "";
  let sortingJudgementRequest = 0;
  let sortingJudgementTimer = 0;
  let currentSortingJudgement = null;
  let sortingDecisionHistory = [];
  let quizSet = [];
  let quizIndex = 0;
  let quizScore = 0;
  let quizLocked = false;

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
      .map(record => `<li><strong>${record.mapped_item || "미확인 물건"}</strong><span>${record.suggested_category || "분류 검토"} · ${record.local_time || "임시 기록"}</span></li>`)
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
    if (text.includes("스티커")) return "스티커 붙은 종이상자";
    if (text.includes("테이프")) return "테이프 붙은 박스";
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
      { value: LANDFILL_INCOMING_PERCENT, label: "총량 대비<br />반입량" },
      { value: LANDFILL_REMAINING_PERCENT, label: "잔여 관리<br />여력" }
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
    const chartRight = 442;
    const chartHeight = chartBottom - chartTop;
    const yMin = 15000;
    const yMax = 23000;
    const ticks = Array.from({ length: 9 }, (_, index) => yMin + index * 1000);
    const minorTicks = Array.from({ length: 8 }, (_, index) => yMin + 500 + index * 1000);
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
    const yAxis = appendSvg(svg, "g", { class: "chart-axis chart-y-axis", fill: "rgba(220,245,255,.7)", "font-size": "13.5", "font-weight": "800" });
    ticks.slice().reverse().forEach(tick => {
      const y = Math.round(yScale(tick));
      appendSvg(grid, "path", { d: `M${chartLeft - 8} ${y} H${chartRight + 12}` });
      appendSvg(yAxis, "text", { class: "y-label", x: "2", y: String(y + 4) }, tickLabel(tick));
    });
    appendSvg(yAxis, "text", { class: "y-zero", x: "10", y: String(chartBottom + 22), "text-anchor": "middle" }, "0");

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
    appendSvg(averageGroup, "text", { x: String(chartRight + 8), y: String(averageY - 10), "text-anchor": "end", "font-size": "12.5", "font-weight": "800" }, "주간 평균");

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

  function openRankingModal() {
    const modal = ensureRankingModal();
    renderRankingModalRows(modal);
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

  function resetHoldEmojiPreviewToCycle() {
    const preview = $("#manualHoldEmojiPreview");
    if (!preview) return;
    preview.textContent = HOLD_EMOJI_CYCLE[0];
    preview.classList.remove("is-matched");
    preview.classList.add("is-cycling");
  }

  function resetThreeSecondAppUiState() {
    cancelThreeSecondJudgement();
    const sortingSection = $("#sorting");
    if (!sortingSection) return;

    $$("[data-tab]", sortingSection).forEach(tab => {
      tab.classList.toggle("is-active", tab.dataset.tab === "classify");
    });
    $$("[data-panel]", sortingSection).forEach(panel => {
      panel.classList.toggle("is-active", panel.dataset.panel === "classify");
    });

    selectedSortingKey = "";
    $$("[data-quick-item]", sortingSection).forEach(button => button.classList.remove("is-active"));
    const searchInput = $("#searchInput", sortingSection);
    if (searchInput) searchInput.value = "";
    const result = $("[data-sorting-result]", sortingSection);
    result?.classList.remove("is-scanning", "is-result");
    result?.classList.add("is-empty");
    const category = $("[data-quick-category]", sortingSection);
    if (category) category.innerHTML = "<b>H-A-H</b> AI 1차 제안 준비";
    const guidance = $("[data-quick-guidance]", sortingSection);
    if (guidance) guidance.textContent = "지금 버리려는 물건을 선택하거나 검색해 보세요. AI가 먼저 분류 후보를 제안하고, 여러분이 다시 확인해 실천 기록으로 남깁니다.";
    const tip = $("[data-quick-tip]", sortingSection);
    if (tip) {
      tip.hidden = false;
      tip.innerHTML = "<strong>실천 흐름</strong><span>사진 또는 검색 → AI 후보 → 학생 확인 → 실천 기록 또는 판단 보류</span>";
    }
    $(".quick-action-row", sortingSection)?.setAttribute("hidden", "");
    $("#practiceLogButton", sortingSection)?.removeAttribute("disabled");
    const holdButton = $("#holdLogButton", sortingSection);
    if (holdButton) holdButton.textContent = "판단 보류";
    if (result) renderJudgementResult(getJudgementResult("hold", { source: "initial" }), result);

    quizSet = [];
    quizIndex = 0;
    quizScore = 0;
    quizLocked = false;
    showQuizQuestion();

    const holdInput = $("#manualHoldInput", sortingSection);
    if (holdInput) holdInput.value = "";
    resetHoldEmojiPreviewToCycle();
    resetInternalScrollState(sortingSection);
  }

  function resetTransientUiState(section) {
    if (!section) return;
    if (section.id === "gallery") resetGalleryUiState();
    if (section.id === "sorting") resetThreeSecondAppUiState();
    resetInternalScrollState(section);
  }

  function resetSectionEntryState(section) {
    if (!section) return;
    closeAllOpenOverlays();
    if (section.id === "gallery") resetGalleryUiState();
    if (section.id === "sorting") resetThreeSecondAppUiState();
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

  function loadRemoteRecords(options = {}) {
    return new Promise(resolve => {
      if (!DATA_CONFIG.appsScriptUrl) {
        remoteRecords = [];
        if (!options.skipApplyWhenUnavailable) applyDashboard(allStoredRecords());
        resolve([]);
        return;
      }

      const callbackName = "aiwaysCleanCallback_" + Date.now().toString(36);
      const script = document.createElement("script");
      let settled = false;

      window[callbackName] = data => {
        if (settled) return;
        settled = true;
        const records = Array.isArray(data) ? data : data.rows || data.records || data.data || [];
        const normalized = normalizeRecords(records);
        remoteRecords = normalized;
        applyDashboard(allStoredRecords());
        cleanup();
        resolve(normalized);
      };

      function cleanup() {
        delete window[callbackName];
        script.remove();
      }

      script.onerror = () => {
        if (settled) return;
        settled = true;
        remoteRecords = [];
        applyDashboard(allStoredRecords());
        cleanup();
        resolve([]);
      };

      script.src = DATA_CONFIG.appsScriptUrl + "?action=list&callback=" + encodeURIComponent(callbackName);
      document.body.appendChild(script);

      window.setTimeout(() => {
        if (settled) return;
        settled = true;
        remoteRecords = [];
        applyDashboard(allStoredRecords());
        cleanup();
        resolve([]);
      }, 6500);
    });
  }

  let dashboardLiveRefreshTimer = 0;

  function startDashboardLiveRefresh() {
    if (!DATA_CONFIG.appsScriptUrl || dashboardLiveRefreshTimer) return;
    dashboardLiveRefreshTimer = window.setInterval(() => {
      if (document.hidden) return;
      loadRemoteRecords({ skipApplyWhenUnavailable: true });
    }, 20000);
  }

  async function loadDashboardRows(options = {}) {
    await loadSeedData();
    dashboardDataReady = true;
    if (options.animateIntro) playDashboardIntroForCurrentData();
    else applyDashboard(allStoredRecords());
    await loadRemoteRecords({ skipApplyWhenUnavailable: options.animateIntro });
    startDashboardLiveRefresh();
    return allStoredRecords();
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

    let result = DATA_CONFIG.appsScriptUrl ? true : "queued";
    try {
      if (DATA_CONFIG.appsScriptUrl) {
        await fetch(DATA_CONFIG.appsScriptUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(safeRecord)
        });
      } else {
        const pending = readJson(STORAGE_PENDING, []);
        pending.push(safeRecord);
        writeJson(STORAGE_PENDING, pending);
      }
    } catch {
      result = false;
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
      ["3초판단", "sorting"],
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
    function snapScrollTo(section, duration = 420) {
      if (snapScrollFrame) cancelAnimationFrame(snapScrollFrame);
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      const finish = () => {
        snapScrollFrame = 0;
        root.style.scrollBehavior = previousBehavior;
      };
      const startY = window.scrollY;
      const maxY = Math.max(0, root.scrollHeight - window.innerHeight);
      const endY = Math.min(maxY, Math.max(0, startY + section.getBoundingClientRect().top));
      const distance = endY - startY;
      if (Math.abs(distance) < 2) {
        window.scrollTo(0, endY);
        finish();
        return;
      }
      const startedAt = performance.now();
      // easeInOutCubic: the pure ease-out curve started at full speed, which
      // read as a jolt rather than smooth motion on every wheel tick.
      const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      function step(now) {
        const progress = Math.min(1, (now - startedAt) / duration);
        window.scrollTo(0, Math.round(startY + distance * ease(progress)));
        if (progress < 1) snapScrollFrame = requestAnimationFrame(step);
        else finish();
      }
      snapScrollFrame = requestAnimationFrame(step);
    }

    function rewindFromLastSection() {
      if (rewindActive || Date.now() < rewindCooldownUntil) return;
      rewindActive = true;
      snapLocked = true;
      clickLockUntil = Date.now() + 820;

      const first = sections[0];
      history.replaceState(null, "", "#" + first.id);
      snapScrollTo(first, 480);
      // Light the destination as the move starts, not after it lands: the
      // 0.3s opacity/filter fade then runs under the scroll instead of after it.
      activate(first, true);
      waitForScrollSettle(first, () => {
        activate(first, true);
        // Reaching the top by rewinding means the visitor has seen the whole
        // deck, so this is the moment to offer the phone hand-off QR. A first
        // visit to the dashboard does not get it.
        document.body.classList.add("is-rewound");
        rewindActive = false;
        snapLocked = false;
        clickLockUntil = 0;
        rewindCooldownUntil = Date.now() + 900;
      }, 700);
    }

  function snapByWheel(event) {
      if (event.ctrlKey || shouldSkipSnap(event) || Math.abs(event.deltaY) < 18 || snapLocked) return;
      const active = sections.find(section => section.id === currentId) || nearestSection();
      const direction = event.deltaY > 0 ? 1 : -1;
      if (canContinueInternalScroll(event.target, direction)) return;
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
      clickLockUntil = Date.now() + 420;
      const target = sections[nextIndex];
      history.replaceState(null, "", "#" + target.id);
      snapScrollTo(target);
      activate(target, true);
      waitForScrollSettle(target, () => {
        snapLocked = false;
        clickLockUntil = 0;
        const rect = target.getBoundingClientRect();
        const tolerance = Math.max(24, Math.round(window.innerHeight * 0.05));
        if (Math.abs(rect.top) > tolerance) snapScrollTo(target, 220);
      }, 420);
    }

    if (!sections.length) return;

    function navigateToSection(id) {
      const section = document.getElementById(id);
      if (!section) return false;
      clickLockUntil = Date.now() + 420;
      history.replaceState(null, "", "#" + id);
      snapScrollTo(section);
      activate(section, true);
      window.setTimeout(() => {
        clickLockUntil = 0;
      }, 420);
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

  function recordForSortingItem(item, holdFlag = false, labelOverride = "") {
    const label = cleanText(labelOverride || item?.label || item?.title || "판단 기록");
    const category = holdFlag ? "기준 확인 필요" : cleanText(item?.category || "학생 확인");
    return {
      input_type: "search",
      ai_engine: "main-3second-helper",
      ai_raw_label: label,
      ai_confidence: "",
      mapped_item: label,
      suggested_category: category,
      final_decision: holdFlag ? "판단 보류" : category,
      hold_flag: Boolean(holdFlag)
    };
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
      addSortingHoldLocally(label, "Google Sheets 기록 반영 대기 안건", saved);
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
    if (saved === true) return kind === "hold" ? "판단 보류를 Google Sheets에 저장하고 보류함에 반영했어요." : "기록을 Google Sheets에 저장하고 실천 통계에 반영했어요.";
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

  const FIRESTORE_EMULATOR_PROJECT_ID = "demo-aiways-incheon";
  const FIRESTORE_EMULATOR_ACTOR_ID = "emulator-test-actor";
  const FIRESTORE_EMULATOR_SAVE_URL = `http://127.0.0.1:5001/${FIRESTORE_EMULATOR_PROJECT_ID}/asia-northeast3/saveSortingRecord`;
  const FIRESTORE_EMULATOR_LIST_URL = `http://127.0.0.1:5001/${FIRESTORE_EMULATOR_PROJECT_ID}/asia-northeast3/listSortingRecords`;
  const FIRESTORE_EMULATOR_RESOLVE_URL = `http://127.0.0.1:5001/${FIRESTORE_EMULATOR_PROJECT_ID}/asia-northeast3/resolveSortingRecord`;
  let pendingFirestoreRecordSave = null;
  let localSortingSyncActive = false;
  let localSortingSyncBlocked = false;
  async function appCheckHeaders() { return window.AIWaysAppCheck?.getAIWaysAppCheckHeaders?.() || null; }

  function isFirestoreEmulatorStorageMode(locationLike = window.location) {
    const hostname = cleanText(locationLike?.hostname).toLowerCase();
    const storage = new URLSearchParams(locationLike?.search || "").get("storage");
    return (hostname === "localhost" || hostname === "127.0.0.1") && storage === "firestore-emulator";
  }

  function createFirestoreIdempotencyKey() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = window.crypto?.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(4)) : [Date.now(), Math.random() * 0xffffffff, Math.random() * 0xffffffff, Math.random() * 0xffffffff];
    return Array.from(bytes, value => Number(value >>> 0).toString(36)).join("-");
  }

  async function loadFirestoreEmulatorHolds() {
    const client = window.AIWaysEdu2gClient;
    if (!client?.listSortingRecords || client.visualReviewRequested?.()) return false;
    try {
      const response = await client.listSortingRecords({ pageSize: 20, statusFilter: "all" });
      if (!response.ok || !Array.isArray(response.data?.records)) return false;
      const remote = response.data.records.map(record => ({ id: `firestore-${record.recordId}`, remoteRecordId: record.recordId, name: cleanText(record.analysis?.objectCandidates?.[0]?.label) || "판단 기록", reason: cleanText(record.hold?.reasons?.[0]) || "사용자 최종 판단 기록", status: record.status === "held" ? "보류" : record.resolvedAt ? "재확인 완료" : "배출 완료", candidate: cleanText(record.provider) === "future_gemini" ? "AI 사진 분석 참고 후보" : "사용자 확인 기록", judgement: { checklist: Array.isArray(record.checklist) ? record.checklist : [], userDecision: record.userDecision || {} }, time: cleanText(record.updatedAt || record.createdAt).replace("T", " ").slice(0, 16), synced: true }));
      sortingHoldItems = [...remote, ...sortingHoldItems.filter(item => !item.remoteRecordId)];
      renderSortingHolds();
      return true;
    } catch { return false; }
  }

  async function resolveFirestoreEmulatorHold(item) {
    const client = window.AIWaysEdu2gClient;
    if (!client?.resolveSortingRecord || client.visualReviewRequested?.() || !item?.remoteRecordId) return false;
    const checklist = Array.isArray(item.judgement?.checklist) ? item.judgement.checklist : [];
    if (!checklist.length || checklist.some(check => !check.checked)) return false;
    const userDecision = item.judgement?.userDecision;
    if (!userDecision?.userConfirmed) return false;
    const response = await client.resolveSortingRecord({ recordId: item.remoteRecordId, idempotencyKey: item.__resolveKey || (item.__resolveKey = createFirestoreIdempotencyKey()), resolutionType: "confirmed_after_review", userDecision: { userConfirmed: true }, checklist });
    return response.ok === true;
  }

  function recordPayloadFromDecision(decision, status, idempotencyKey) {
    const objectCandidates = (Array.isArray(decision?.objectCandidates) ? decision.objectCandidates : []).slice(0, 3).map(candidate => ({
      label: cleanText(candidate?.label).slice(0, 200), itemId: cleanText(candidate?.itemId).slice(0, 40), objectType: cleanText(candidate?.objectType).slice(0, 40), confidenceBand: sortingVisionConfidence(candidate?.confidenceBand || candidate?.confidence)
    }));
    const materialCandidates = (Array.isArray(decision?.materialCandidates) ? decision.materialCandidates : []).slice(0, 3).map(candidate => ({
      label: cleanText(candidate?.label).slice(0, 200), confidenceBand: sortingVisionConfidence(candidate?.confidenceBand || candidate?.confidence)
    }));
    const visibleCautions = (Array.isArray(decision?.visibleCautions) ? decision.visibleCautions : []).slice(0, 5).map(value => cleanText(value).slice(0, 200)).filter(Boolean);
    const checklist = (Array.isArray(decision?.checklist) ? decision.checklist : []).filter(item => item?.required !== false).slice(0, 20).map(item => ({ id: cleanText(item?.id).slice(0, 80), label: cleanText(item?.label).slice(0, 200), checked: item?.checked === true }));
    const action = status === "held" ? "held" : "recorded";
    return {
      schemaVersion: "sorting-record-v1", status, provider: cleanText(decision?.provider || decision?.source || "local_rule").slice(0, 80),
      ...(cleanText(decision?.model).slice(0, 80) ? { model: cleanText(decision.model).slice(0, 80) } : {}),
      analysis: { objectCandidates, materialCandidates, visibleCautions }, checklist,
      userDecision: { selectedItemId: cleanText(decision?.selectedItemId).slice(0, 40), ...(cleanText(decision?.selectedCorrectionType).slice(0, 80) ? { selectedCorrectionType: cleanText(decision.selectedCorrectionType).slice(0, 80) } : {}), action, userConfirmed: true },
      hold: status === "held" ? { recommended: true, reasons: (Array.isArray(decision?.hold?.reasons) ? decision.hold.reasons : []).slice(0, 5).map(value => cleanText(value).slice(0, 200)).filter(Boolean) } : null,
      appVersion: "clean-2026-08", sourceSchemaVersion: cleanText(decision?.schemaVersion).slice(0, 80), idempotencyKey
    };
  }

  async function persistSortingRecordRemote(decision, status, clientRecordId = "") {
    const client = window.AIWaysEdu2gClient;
    if (!decision || !client?.saveSortingRecord || client.visualReviewRequested?.()) return { attempted: false, saved: false, status: 0, code: "auth_invalid" };
    const existing = clientRecordId || decision.__firestoreIdempotencyKey || createFirestoreIdempotencyKey();
    decision.__firestoreIdempotencyKey = existing;
    if (pendingFirestoreRecordSave?.key === existing) return pendingFirestoreRecordSave.promise;
    const promise = client.saveSortingRecord(recordPayloadFromDecision(decision, status, existing))
      .then(response => ({ attempted: true, saved: response.ok === true, status: response.status || 0, code: response.code || "invalid_response", duplicate: response.data?.duplicate === true, serverRecordId: cleanText(response.data?.recordId) }))
      .catch(() => ({ attempted: true, saved: false, status: 0, code: "network_error" }));
    pendingFirestoreRecordSave = { key: existing, promise };
    try { return await promise; } finally { if (pendingFirestoreRecordSave?.key === existing) pendingFirestoreRecordSave = null; }
  }

  function localDecisionRecord(decision, status, record) {
    const clientRecordId = decision?.__localRecordId || createFirestoreIdempotencyKey();
    if (decision) decision.__localRecordId = clientRecordId;
    return { clientRecordId, decision: status === "held" ? "held" : "completed", status, category: cleanText(record?.category || decision?.item?.category || "학생 확인").slice(0, 200), displayLabel: cleanText(record?.mapped_item || record?.ai_raw_label || decision?.item?.label || "판단 기록").slice(0, 200), source: cleanText(decision?.provider || decision?.source || "local_rule").slice(0, 80), analysisMode: cleanText(decision?.selectedItemId || decision?.key || "local-item").slice(0, 40), syncStatus: "pending" };
  }

  function decisionFromLocalRecord(record) {
    const itemId = cleanText(record.analysisMode || "local-item").slice(0, 40) || "local-item";
    const label = cleanText(record.displayLabel || "판단 기록").slice(0, 200) || "판단 기록";
    const category = cleanText(record.category || "학생 확인").slice(0, 200) || "학생 확인";
    const held = record.status === "held";
    return { provider: cleanText(record.source || "local_rule"), selectedItemId: itemId, objectCandidates: [{ label, itemId, objectType: itemId, confidenceBand: "unknown" }], materialCandidates: [{ label: category, confidenceBand: "unknown" }], visibleCautions: [], checklist: [], hold: held ? { recommended: true, reasons: [] } : null };
  }

  async function syncOneLocalSortingRecord(localRecord, decision = null) {
    const status = localRecord.status === "resolved" ? "completed" : localRecord.status;
    const remote = await persistSortingRecordRemote(decision || decisionFromLocalRecord(localRecord), status, localRecord.clientRecordId);
    if (!remote.saved) {
      const error = new Error(remote.code || "sync-failed");
      error.status = remote.status || 0;
      if (remote.status === 403) localSortingSyncBlocked = true;
      throw error;
    }
    return { serverRecordId: remote.serverRecordId || localRecord.serverRecordId || "" };
  }

  async function syncPendingLocalSortingRecords() {
    if (!localSortingStore || localSortingSyncActive || localSortingSyncBlocked || !navigator.onLine) return [];
    localSortingSyncActive = true;
    try { return await localSortingStore.syncPendingSortingRecords(record => syncOneLocalSortingRecord(record)); }
    catch { return []; }
    finally { localSortingSyncActive = false; }
  }

  async function appendSortingDecisionRecord(record, decision, status) {
    if (!localSortingStore) return { attempted: false, saved: false, localSaved: false, code: "local_storage_unavailable" };
    let local;
    try { local = await localSortingStore.saveLocalSortingRecord(localDecisionRecord(decision, status, record)); }
    catch { return { attempted: false, saved: false, localSaved: false, code: "local_storage_failed" }; }
    const nextRecords = localRecords();
    if (!nextRecords.some(item => item.clientRecordId === local.clientRecordId)) {
      nextRecords.push({ ...record, clientRecordId: local.clientRecordId, timestamp: new Date().toISOString(), local_time: new Date().toLocaleString("ko-KR") });
      writeJson(STORAGE_RECORDS, nextRecords);
      applyDashboard(allStoredRecords());
    }
    let remote = { attempted: false, saved: false, status: 0, code: "network_error" };
    try {
      const result = await syncOneLocalSortingRecord(local, decision);
      await localSortingStore.updateLocalSortingRecord(local.clientRecordId, { syncStatus: "synced", serverRecordId: result.serverRecordId, syncedAt: new Date().toISOString() });
      remote = { attempted: true, saved: true, serverRecordId: result.serverRecordId };
    } catch (error) {
      await localSortingStore.updateLocalSortingRecord(local.clientRecordId, { syncStatus: "failed", lastSyncErrorCode: error?.status === 403 ? "app-check-permission-denied" : "sync-failed" });
      if (error?.status === 403) localSortingSyncBlocked = true;
    }
    if (!remote.saved) syncPendingLocalSortingRecords();
    return { ...remote, localSaved: true, clientRecordId: local.clientRecordId };
  }

  async function logSortingPractice(item, decision = null) {
    const remote = await appendSortingDecisionRecord(recordForSortingItem(item, false), decision, "completed");
    if (remote.localSaved) recordSortingPracticeLocally(item, remote.saved);
    if (remote.saved) loadFirestoreEmulatorHolds();
    const guidance = $("[data-quick-guidance]");
    if (guidance) guidance.textContent = remote.saved
      ? `${item.label} 기록을 보호된 클라우드 기록에 저장했어요.`
      : remote.localSaved ? "기기에 저장됨 · 네트워크 연결 후 자동으로 전송됩니다." : "기기 저장을 완료하지 못했습니다. 다시 시도해 주세요.";
    return remote;
  }

  async function addSortingHold(name, reason = "기준 확인 필요", decision = null) {
    const cleaned = cleanText(name) || "판단 보류 물건";
    const remote = await appendSortingDecisionRecord(recordForSortingItem({ label: cleaned, category: "기준 확인 필요" }, true, cleaned), decision, "held");
    if (remote.localSaved) {
      addSortingHoldLocally(cleaned, reason, remote.saved, decision, remote.clientRecordId, remote.serverRecordId);
      if (decision) saveSortingDecisionV2(decision, "held");
      loadFirestoreEmulatorHolds();
    }
    return remote;
  }

  async function recoverLocalSortingRecords() {
    if (!localSortingStore) return [];
    const records = await localSortingStore.listLocalSortingRecords();
    records.filter(record => record.status === "held").forEach(record => {
      if (!sortingHoldItems.some(item => item.localRecordId === record.clientRecordId)) addSortingHoldLocally(record.displayLabel, "기기에 저장된 판단 보류", record.syncStatus === "synced", null, record.clientRecordId, record.serverRecordId || "");
    });
    renderSortingHolds();
    return records;
  }

  async function resolveLocalSortingHold(item) {
    if (!item?.localRecordId || !localSortingStore) return false;
    const resolved = await localSortingStore.resolveLocalHeldRecord(item.localRecordId);
    item.status = "재확인 완료";
    item.synced = false;
    renderSortingHolds();
    if (item.remoteRecordId) {
      try {
        const remote = await resolveFirestoreEmulatorHold(item);
        if (remote) await localSortingStore.updateLocalSortingRecord(resolved.clientRecordId, { syncStatus: "synced", syncedAt: new Date().toISOString() });
      } catch { /* local resolution remains durable */ }
    } else syncPendingLocalSortingRecords();
    return true;
  }

  function pickQuizSet() {
    const shuffle = items => [...items].sort(() => Math.random() - 0.5);
    const truePool = shuffle(sortingQuizData.filter(item => item.answer === true));
    const falsePool = shuffle(sortingQuizData.filter(item => item.answer === false));
    return shuffle([...truePool.slice(0, 5), ...falsePool.slice(0, 5)]);
  }

  function quizRank(correctCount) {
    if (correctCount >= 10) return { title: "AI Ways 자원순환 마스터", message: "완벽해요. 오늘의 분리배출 챔피언입니다 🏆", emoji: "🏆" };
    if (correctCount >= 9) return { title: "자원순환 환경운동가", message: "와우! 기준도 좋고 실천 감각도 뛰어나요 🌍", emoji: "🌍" };
    if (correctCount >= 7) return { title: "분리배출 실천가", message: "잘하고 있어요! 학교에서도 믿고 맡길 수 있는 수준이에요 ♻️", emoji: "♻️" };
    if (correctCount >= 5) return { title: "자원순환 탐험가", message: "기준을 꽤 잘 알고 있어요. 이제 실천력을 더 키워봐요 🔎", emoji: "🔎" };
    if (correctCount >= 3) return { title: "분리배출 연습생", message: "조금씩 감이 오고 있어요. 한 번 더 하면 더 잘할 수 있어요 🍀", emoji: "🍀" };
    return { title: "분리배출 새싹", message: "처음은 누구나 헷갈릴 수 있어요. 다시 도전해봐요 🌱", emoji: "🌱" };
  }

  function quizRankTableHtml(correctCount) {
    const ranges = [
      ["0~2개", "분리배출 새싹", "🌱"],
      ["3~4개", "분리배출 연습생", "🍀"],
      ["5~6개", "자원순환 탐험가", "🔎"],
      ["7~8개", "분리배출 실천가", "♻️"],
      ["9개", "자원순환 환경운동가", "🌍"],
      ["10개", "AI Ways 자원순환 마스터", "🏆"]
    ];
    return `<div class="quiz-rank-table">${ranges.map(([range, title, emoji]) => `
      <span class="${title === quizRank(correctCount).title ? "is-current" : ""}"><b>${emoji}</b><em>${range}</em><strong>${title}</strong></span>
    `).join("")}</div>`;
  }

  function quizMessage(score) {
    return quizRank(Math.round(score / 10)).message;
  }

  function showQuizQuestion() {
    const item = quizSet[quizIndex];
    const progress = quizSet.length ? ((quizIndex + 1) / quizSet.length) * 100 : 0;
    setText("#quizProgress", quizSet.length ? `문제 ${quizIndex + 1} / ${quizSet.length}` : "대기 중");
    setText("#quizScore", `${quizScore}점`);
    setText("#quizEmoji", item?.emoji || "🎮");
    setText("#quizQuestion", item?.question || "퀴즈 탭을 열면 10문제가 바로 시작됩니다.");
    setText("#quizResult", "");
    $(".quiz-card")?.classList.remove("is-correct", "is-wrong", "is-finished");
    $$("[data-quiz-choice]").forEach(button => {
      button.classList.remove("is-picked", "is-answer");
      button.disabled = false;
    });
    const bar = $("#quizBar");
    if (bar) bar.style.width = `${progress}%`;
    quizLocked = false;
  }

  function finishQuiz() {
    const correctCount = Math.round(quizScore / 10);
    const wrongCount = Math.max(0, quizSet.length - correctCount);
    const rank = quizRank(correctCount);
    setText("#quizProgress", "퀴즈 완료");
    setText("#quizScore", `${quizScore}점`);
    setText("#quizEmoji", "");
    const question = $("#quizQuestion");
    if (question) question.textContent = "";
    const result = $("#quizResult");
    if (result) {
      result.innerHTML = `
        <section class="quiz-report-panel" aria-label="퀴즈 결과 리포트">
          <span class="quiz-report-label">퀴즈 결과 리포트</span>
          <div class="quiz-report-rank">
            <b>${escapeHtml(rank.emoji)}</b>
            <span>
              <strong>${escapeHtml(rank.title)}</strong>
              <em>${escapeHtml(rank.message)}</em>
            </span>
          </div>
          <div class="quiz-report-score" aria-label="퀴즈 점수 요약">
            <span class="quiz-total-score"><em>총점</em><b>${quizScore}점</b></span>
            <span><em>정답</em><b>${correctCount}/${quizSet.length}</b></span>
            <span><em>오답</em><b>${wrongCount}</b></span>
          </div>
          <p class="quiz-finish-count">10문제 중 ${correctCount}문제를 맞혔습니다.</p>
        </section>
        ${quizRankTableHtml(correctCount)}
        <button type="button" class="quiz-retry-btn" data-quiz-retry>💪 다시 도전하기</button>
      `;
    }
    const bar = $("#quizBar");
    if (bar) bar.style.width = "100%";
    $(".quiz-card")?.classList.add("is-finished");
    $$("[data-quiz-choice]").forEach(button => {
      button.disabled = true;
      button.classList.remove("is-picked", "is-answer");
    });
    quizLocked = true;
  }

  function startSortingQuiz() {
    quizSet = pickQuizSet();
    quizIndex = 0;
    quizScore = 0;
    quizLocked = false;
    showQuizQuestion();
  }

  function answerSortingQuiz(answer) {
    if (quizLocked || !quizSet.length) return;
    quizLocked = true;
    const item = quizSet[quizIndex];
    const correct = item.answer === answer;
    const correctLabel = item.answer ? "O" : "X";
    if (correct) quizScore += 10;
    setText("#quizScore", `${quizScore}점`);
    const result = $("#quizResult");
    if (result) {
      result.innerHTML = `
        <strong class="${correct ? "is-good" : "is-bad"}">${correct ? "정답이에요!" : "아쉬워요!"}</strong>
        <span>정답은 ${correctLabel}입니다. ${escapeHtml(item.explanation)}</span>
      `;
    }
    const card = $(".quiz-card");
    card?.classList.toggle("is-correct", correct);
    card?.classList.toggle("is-wrong", !correct);
    $$("[data-quiz-choice]").forEach(button => {
      const buttonAnswer = button.dataset.quizChoice === "true";
      button.disabled = true;
      button.classList.toggle("is-picked", buttonAnswer === answer);
      button.classList.toggle("is-answer", buttonAnswer === item.answer);
    });
    window.setTimeout(() => {
      quizIndex += 1;
      if (quizIndex >= quizSet.length) finishQuiz();
      else showQuizQuestion();
    }, 900);
  }

  function updateHoldEmojiPreview(forceMatch = false) {
    const preview = $("#manualHoldEmojiPreview");
    const input = $("#manualHoldInput");
    if (!preview || !input) return;
    const value = cleanText(input.value);
    if (value) {
      preview.textContent = holdEmojiFor(value);
      preview.classList.toggle("is-matched", forceMatch);
      preview.classList.remove("is-cycling");
      return;
    }
    preview.classList.remove("is-matched");
    preview.classList.add("is-cycling");
  }

  function initHoldEmojiPreview() {
    const preview = $("#manualHoldEmojiPreview");
    const input = $("#manualHoldInput");
    if (!preview || !input) return;
    input.value = "";
    let index = 0;

    const cycle = () => {
      if (cleanText(input.value)) return;
      preview.textContent = HOLD_EMOJI_CYCLE[index % HOLD_EMOJI_CYCLE.length];
      preview.classList.remove("is-matched");
      preview.classList.add("is-cycling");
      index += 1;
    };

    cycle();
    if (!holdEmojiCycleTimer) holdEmojiCycleTimer = window.setInterval(cycle, 500);
    input.addEventListener("input", () => {
      window.clearTimeout(holdEmojiSettleTimer);
      if (!cleanText(input.value)) {
        cycle();
        return;
      }
      updateHoldEmojiPreview(false);
      holdEmojiSettleTimer = window.setTimeout(() => updateHoldEmojiPreview(true), 360);
    });
    input.addEventListener("blur", () => updateHoldEmojiPreview(true));
  }

  function isolateWheelInside(selector) {
    const node = $(selector);
    if (!node || node.dataset.wheelIsolated === "true") return;
    node.dataset.wheelIsolated = "true";
    node.addEventListener("wheel", event => {
      const canScroll = node.scrollHeight > node.clientHeight + 1;
      if (!canScroll) return;
      const previousTop = node.scrollTop;
      node.scrollTop += event.deltaY;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) node.scrollLeft += event.deltaX;
      if (node.scrollTop === previousTop && Math.abs(event.deltaY) < 1) return;
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });
  }

  function initNestedScrollIsolation() {
    isolateWheelInside("#sortingTimeline");
    isolateWheelInside("#holdList");
  }

  function initSortingDataApp() {
    loadSortingStorage();
    renderSortingStats();
    renderSortingHolds();
    loadFirestoreEmulatorHolds();
    recoverLocalSortingRecords().then(() => syncPendingLocalSortingRecords());
    window.addEventListener("online", () => syncPendingLocalSortingRecords());
    initHoldEmojiPreview();
    initNestedScrollIsolation();

    $("#manualHoldButton")?.addEventListener("click", () => {
      const input = $("#manualHoldInput");
      const value = cleanText(input?.value);
      if (!value) return;
      addSortingHold(value);
      input.value = "";
      updateHoldEmojiPreview(false);
    });

    $("#manualHoldInput")?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      $("#manualHoldButton")?.click();
    });

    $("#holdList")?.addEventListener("click", async event => {
      const checkButton = event.target.closest("[data-hold-check]");
      if (checkButton) {
        const [id, indexText] = checkButton.dataset.holdCheck.split(":");
        const check = sortingHoldItems.find(entry => entry.id === id)?.judgement?.checklist?.[Number(indexText)];
        if (check) { check.checked = !check.checked; renderSortingHolds(); }
        return;
      }
      const button = event.target.closest("[data-resolve-hold]");
      if (!button) return;
      const id = button.dataset.resolveHold;
      const item = sortingHoldItems.find(entry => entry.id === id);
      if (item?.localRecordId) {
        if (button.dataset.pending === "true") return;
        button.dataset.pending = "true";
        button.disabled = true;
        try {
          await resolveLocalSortingHold(item);
        } finally { button.disabled = false; button.dataset.pending = "false"; }
        return;
      }
      sortingHoldItems = sortingHoldItems.filter(item => item.id !== id);
      saveSortingHolds();
      renderSortingHolds();
    });

    $("#exportSortingCsvButton")?.addEventListener("click", async () => {
      const status = $("#sortingCsvStatus");
      const records = localSortingStore ? await localSortingStore.listLocalSortingRecords() : [];
      if (!records.length) { if (status) status.textContent = "내보낼 기기 저장 기록이 없습니다."; return; }
      window.AIWaysSortingLocalStore?.downloadSortingRecordsCsv(records);
      if (status) status.textContent = "기기 저장 기록을 CSV로 내보냈습니다.";
    });

    $("#quizStartButton")?.addEventListener("click", startSortingQuiz);
    $(".quiz-card")?.addEventListener("click", event => {
      if (!event.target.closest("[data-quiz-retry]")) return;
      startSortingQuiz();
    });
    $$("[data-quiz-choice]").forEach(button => {
      button.addEventListener("click", () => answerSortingQuiz(button.dataset.quizChoice === "true"));
    });
  }

  function cancelThreeSecondJudgement() {
    sortingJudgementRequest += 1;
    if (sortingJudgementTimer) {
      window.clearTimeout(sortingJudgementTimer);
      sortingJudgementTimer = 0;
    }
  }

  function judgementKeyFor(input) {
    const rawKey = String(typeof input === "string" ? input : input?.key || "").trim().toLowerCase();
    if (sortingDbV2[rawKey]) return rawKey;
    const key = cleanText(rawKey).toLowerCase();
    if (sortingDbV2[key]) return key;
    return sortingKeyAliases[key] || "hold";
  }

  // Stage 5 keeps image analysis advisory-only: remote hints never decide a disposal outcome.
  const SORTING_INPUT_SOURCES = Object.freeze({ quick: "quick_select", search: "search_rule", photo: "mobilenet_hint", correction: "user_correction", future: "future_gemini" });
  const SORTING_VISION_SOURCES = Object.freeze({ MOBILENET: "mobilenet_hint", TEACHABLE_MACHINE: "tm_hint", FUTURE_GEMINI: "future_gemini" });
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
    mobilenet: { source: SORTING_VISION_SOURCES.MOBILENET, enabled: true },
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
      photo: options.candidateSource || "mobilenet_hint",
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
    const objectChips = safeResult.objectCandidates.map(candidate => `<span class="judgement-chip object"><b>${escapeHtml(candidate.label)}</b><em>${escapeHtml(candidate.source === "mobilenet_hint" ? "사진 기반 참고 후보" : candidate.source === "tm_hint" ? "우리 학교 학습 모델 참고 후보" : candidate.source === "future_gemini" ? "AI 사진 분석 참고 후보" : candidate.source === "user" ? "사용자 선택" : "검색 후보")}</em></span>`).join("");
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

  function initQuickButtons() {
    const buttons = $$("[data-quick-item]");
    const result = $("[data-sorting-result]");
    const modeButtons = $$("button[data-sorting-mode]");
    const modeStatus = $("[data-sorting-mode-status]");
    const modeCopy = {
      photo: "사진을 찍거나 올려서 참고 후보를 확인할 수 있어요.",
      search: "물건 이름을 검색해 규칙 기반 판단 지원을 받아보세요.",
      quick: "자주 헷갈리는 물건을 빠르게 선택해 확인할 수 있어요."
    };

    function setSortingMode(mode) {
      modeButtons.forEach(button => {
        const active = button.dataset.sortingMode === mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      result?.closest(".sorting-app")?.setAttribute("data-sorting-mode", mode);
      if (modeStatus) modeStatus.textContent = modeCopy[mode] || modeCopy.photo;
    }

    modeButtons.forEach(button => button.addEventListener("click", () => setSortingMode(button.dataset.sortingMode)));
    setSortingMode("photo");

    function itemFromSearch(value) {
      return findJudgementKeys(value);
    }

    function renderEmptySortingResult() {
      cancelThreeSecondJudgement();
      selectedSortingKey = "";
      buttons.forEach(target => target.classList.remove("is-active"));
      renderJudgementResult(getJudgementResult("hold", { source: "initial" }), result);
    }

    function applySearchValue() {
      const value = cleanText($("#searchInput")?.value);
      if (!value) return;
      const candidateKeys = itemFromSearch(value);
      const primaryKey = candidateKeys[0] || "hold";
      runThreeSecondJudgement({ key: primaryKey, query: value }, { container: result, source: "search", key: primaryKey, candidateKeys });
    }

    buttons.forEach(button => {
      button.classList.remove("is-active");
      button.addEventListener("click", () => {
        buttons.forEach(target => target.classList.toggle("is-active", target === button));
        runThreeSecondJudgement(button.dataset.quickItem, { container: result, source: "quick" });
      });
    });

    $("#searchButton")?.addEventListener("click", applySearchValue);
    $("#searchInput")?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      applySearchValue();
    });

    $("#tmApplyButton")?.addEventListener("click", async () => {
      const state = $("#tmModelState");
      const value = cleanText($("#tmModelInput")?.value);
      if (!value) {
        if (state) state.textContent = "모델 링크를 입력하면 적용할 수 있습니다.";
        return;
      }
      if (state) state.textContent = "모델을 불러오는 중입니다...";
      try {
        teachableMachineModelPromise = await loadTeachableMachineModel(value);
        if (state) state.textContent = teachableMachineModelPromise ? "우리 학교 학습 모델 참고 후보 기능이 적용되었습니다. 최종 판단에는 사용하지 않습니다." : "모델 런타임을 사용할 수 없어 기본 판단 지원을 유지합니다.";
      } catch {
        teachableMachineModelPromise = null;
        if (state) state.textContent = "모델을 불러오지 못했습니다. 링크를 다시 확인해 주세요.";
      }
    });

    $("#tmModelInput")?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      $("#tmApplyButton")?.click();
    });

    result?.addEventListener("click", async event => {
      const correction = event.target.closest("[data-judgement-correction]");
      if (correction) {
        runThreeSecondJudgement(correction.dataset.judgementCorrection, { container: result, source: "correction", selectedCorrectionType: correction.dataset.judgementCorrection });
        return;
      }
      const check = event.target.closest("[data-judgement-check]");
      if (check && currentSortingJudgement) {
        const target = currentSortingJudgement.checklist.find(item => item.id === check.dataset.judgementCheck);
        if (target) {
          target.checked = !target.checked;
          target.status = target.checked ? "done" : "unknown";
        }
        renderJudgementResult(currentSortingJudgement, result);
        return;
      }
      const action = event.target.closest("[data-judgement-action]");
      const nextItem = event.target.closest("[data-next-sorting-item]");
      if (nextItem) { resetThreeSecondAppUiState(); $("[data-upload=\"camera\"]")?.focus(); return; }
      if (!action || !currentSortingJudgement) return;
      if (action.disabled || action.dataset.pending === "true") return;
      action.dataset.pending = "true";
      const status = result.querySelector("[data-judgement-action-status]");
      const setActionStatus = message => { if (status) status.textContent = message; };
      const decision = currentSortingJudgement;
      const legacyItem = { label: decision.item.label, emoji: decision.item.emoji, category: decision.item.category, carbonSaved: decision.item.carbonSaved };
      try {
        if (action.dataset.judgementAction === "record") {
          setActionStatus("기기에 저장하는 중입니다.");
          const remote = await logSortingPractice(legacyItem, decision);
          if (remote.localSaved) {
            saveSortingDecisionV2(decision, "recorded");
            setActionStatus(remote.saved ? (remote.duplicate ? "기기에 저장됨 · 기존 클라우드 기록을 사용합니다." : "기기에 저장됨 · 클라우드 기록에 전송했습니다.") : "기기에 저장됨 · 네트워크 연결 후 자동으로 전송됩니다.");
          } else setActionStatus("기기 저장을 완료하지 못했습니다. 다시 시도해 주세요.");
        } else if (action.dataset.judgementAction === "decide") {
          saveSortingDecisionV2(decision, "user_confirmed");
          renderJudgementResult({ ...decision, hold: { ...decision.hold, recommended: false } }, result);
        } else {
          const reason = decision.hold.reasons[0] || "확인 항목 또는 지역 기준 확인 필요";
          setActionStatus("기기에 보류 기록을 저장하는 중입니다.");
          const remote = await addSortingHold(decision.item.label, reason, decision);
          setActionStatus(remote.localSaved ? (remote.saved ? "기기에 저장됨 · 보류 기록을 전송했습니다." : "기기에 저장됨 · 네트워크 연결 후 자동으로 전송됩니다.") : "기기 저장을 완료하지 못했습니다. 다시 시도해 주세요.");
        }
      } finally {
        action.dataset.pending = "false";
      }
    });

    renderEmptySortingResult();
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
      if (!mobileNetModelPromise) {
        mobileNetModelPromise = window.AIWaysAiRuntime?.loadMobileNet().then(runtime => runtime.load());
      }
      if (mobileNetModelPromise) {
        const model = await mobileNetModelPromise;
        const top = (await model.classify(image))?.[0];
        if (top) hints.push(createSortingVisionHint({ label: top.className, itemId: judgementKeyFromVisualLabel(top.className) }, SORTING_VISION_SOURCES.MOBILENET, {
          provider: "mobilenet", rawConfidence: top.probability, confidenceBand: sortingVisionConfidenceBand(top.probability), requestId: requestMetadata.requestId
        }));
      }
    } catch {
      mobileNetModelPromise = null;
    }
    try {
      const imagePayload = await prepareSortingVisionImage(image);
      const [recognitionResult, observerResult] = await Promise.allSettled([sortingVisionProviders.futureGemini.analyze({ requestMetadata, imagePayload }), requestSortingSafetyObserver({ requestMetadata, imagePayload })]);
      const remote = recognitionResult.status === "fulfilled" ? recognitionResult.value : { ok:false, code:"analysis_failed" };
      const observer = observerResult.status === "fulfilled" ? observerResult.value : { ok:false };
      if (observer.ok && observer.safety) safety = observer.safety;
      if (remote.ok && activeSortingVisionRequestId === requestMetadata.requestId) {
        liveGemini = true;
        geminiCandidate = remote.value.objectCandidates?.[0] || null;
        remote.value.objectCandidates.forEach(candidate => hints.push(createSortingVisionHint(candidate, SORTING_VISION_SOURCES.FUTURE_GEMINI, {
          provider: "future_gemini", confidenceBand: candidate.confidenceBand, requestId: requestMetadata.requestId, schemaVersion: remote.value.schemaVersion
        })));
      } else if (!remote.ok) analysisCode = remote.code || "analysis_failed";
    } catch {
      analysisCode = "analysis_failed";
    }
    const mergedHints = mergeSortingVisionHints(hints);
    const topHint = mergedHints[0];
    const mapped = topHint ? chooseDraftFromLabel(topHint.label, topHint.rawConfidence) : { item: "기타 / 판단 보류", category: "기준 확인 필요", guidance: "사진만으로 재질과 오염 상태를 확정할 수 없습니다.", ruleBased: true };
    return {
      ...mapped,
      hints: mergedHints,
      judgementKey: topHint?.itemId || "hold",
      confidence: topHint?.rawConfidence ?? null,
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
    if (draftRecord.ai_engine === "mobilenet" && Number.isFinite(confidence) && confidence > 0) {
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
    currentDraft = {
      input_type: "image",
      ai_engine: draft.hints?.[0]?.source || (draft.ruleBased ? "fallback-rule" : "mobilenet_hint"),
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
      candidateSource: draft.hints?.[0]?.source || "mobilenet_hint",
      provider: draft.hints?.[0]?.provider || "fallback_rule",
      schemaVersion: draft.requestMetadata?.schemaVersion,
      requestId: draft.requestMetadata?.requestId,
      confidenceBand: draft.hints?.[0]?.confidenceBand,
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
      ai_engine: "mobilenet_hint",
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
    $("#gradeSelect")?.addEventListener("change", () => {
      beginDashboardRepaint("school", 980);
      applyDashboard(allStoredRecords());
    });
    $("#classSelect")?.addEventListener("change", () => {
      beginDashboardRepaint("class", 980);
      applyDashboard(allStoredRecords());
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
      setSaveState(pendingDecision.hold_flag ? "판단 보류를 Google Sheets에 저장 중입니다..." : "학생 최종 판단을 Google Sheets에 저장 중입니다...");
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
    initNavigation();
    initQuickButtons();
    initTabs();
    initSortingDataApp();
    initGallery();
    initSelectors();
    initUpload();
    initClassroomSkills();
    initRefreshControls();
    initRankingModal();
    initLandfillSourceLink();
    initCurriculumCardFocusReset();
    prepareDashboardIntroState();
    renderLandfillTimeNow();
    loadDashboardRows({ animateIntro: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
