"use strict";
// Real disposal-guide data, ported from ../app.js's sortingDbV2 (same source PC's
// AI photo-judgment confirmation screen uses). Kept as a plain data module so the
// mobile app never needs to load the full PC app.js bundle.
(() => {
  function judgementItem(config) {
    return {
      materialCandidates: [],
      disposalCandidates: [],
      visibleCautions: [],
      holdReasons: [],
      searchKeywords: [],
      carbonSaved: 0,
      ...config
    };
  }

  const sortingDbV2 = {
    "pet-bottle": judgementItem({
      label: "페트병", emoji: "🧴", objectType: "pet-bottle", category: "플라스틱류 검토", carbonSaved: 22,
      guide: "내용물을 비우고 라벨과 뚜껑을 분리한 뒤 찌그러뜨려 플라스틱류로 배출합니다.",
      tip: "라벨·뚜껑 재질이 다르면 반드시 분리해야 재활용 효율이 올라갑니다.",
      holdReasons: ["라벨 또는 뚜껑 재질이 불명확함", "내용물이 남아 있음"], searchKeywords: ["페트", "페트병", "생수병", "음료병", "bottle"]
    }),
    "plastic-cup": judgementItem({
      label: "플라스틱컵", emoji: "🥤", objectType: "plastic-cup", category: "플라스틱류 검토", carbonSaved: 18,
      guide: "남은 음료를 비우고 빨대와 뚜껑을 분리한 뒤 깨끗하게 헹궈 배출합니다.",
      tip: "라벨이나 실링 비닐이 잘 떨어지지 않으면 재활용 효율이 낮아질 수 있습니다.",
      holdReasons: ["기름·음식물 오염이 심함", "재질 표기가 없음"], searchKeywords: ["플라스틱컵", "테이크아웃컵", "컵", "plastic cup"]
    }),
    "paper-cup": judgementItem({
      label: "종이컵", emoji: "☕", objectType: "paper-cup", category: "종이류 확정 금지", carbonSaved: 3,
      guide: "종이컵은 코팅 여부와 학교·지역 수거 기준에 따라 달라지므로 바로 종이류로 확정하지 않습니다.",
      tip: "코팅·오염 여부가 애매하면 판단 보류함에 기록하고 기준을 확인하세요.",
      holdReasons: ["코팅·오염 여부가 불명확함"], searchKeywords: ["종이컵", "paper cup", "코팅컵"]
    }),
    "milk-carton": judgementItem({
      label: "우유갑 / 종이팩", emoji: "🥛", objectType: "milk-carton", category: "종이팩류 검토", carbonSaved: 25,
      guide: "내용물을 비우고 물로 헹군 뒤 펼쳐 말려 종이팩 전용 수거함에 배출합니다.",
      tip: "일반 종이와 종이팩은 재활용 공정이 달라 반드시 전용 수거함에 넣어야 합니다.",
      holdReasons: ["빨대·비닐이 붙어 있음", "전용 수거함을 찾을 수 없음"], searchKeywords: ["우유갑", "우유팩", "종이팩", "멸균팩", "milk carton"]
    }),
    can: judgementItem({
      label: "캔류", emoji: "🥫", objectType: "can", category: "캔류 검토", carbonSaved: 28,
      guide: "내용물을 비우고 세척한 뒤 가능하면 눌러서 캔류 수거함에 배출합니다.",
      tip: "담배꽁초나 액체가 남아 있으면 선별 과정에서 오염원이 됩니다.",
      holdReasons: ["내용물이 남아 있음", "복합 부속품이 분리되지 않음"], searchKeywords: ["캔", "캔류", "알루미늄", "철캔", "can"]
    }),
    "glass-bottle": judgementItem({
      label: "유리병", emoji: "🍾", objectType: "glass-bottle", category: "유리류 검토", carbonSaved: 22,
      guide: "내용물과 뚜껑을 분리한 뒤 유리류로 배출합니다.",
      tip: "깨진 유리는 신문지 등으로 안전하게 감싼 뒤 별도 배출 기준을 확인하세요.",
      holdReasons: ["깨진 유리임", "뚜껑·마개가 분리되지 않음"], searchKeywords: ["유리병", "유리", "병", "glass bottle"]
    }),
    "snack-wrapper": judgementItem({
      label: "과자 봉지", emoji: "🍪", objectType: "snack-wrapper", category: "비닐류 또는 판단 보류", carbonSaved: 12,
      guide: "부스러기를 털어내고 오염이 적으면 비닐류로 배출합니다.",
      tip: "기름기·양념이 많으면 비닐함을 오염시키므로 일반쓰레기 또는 판단 보류가 필요합니다.",
      holdReasons: ["기름·음식물 오염이 심함", "복합 포장재임"], searchKeywords: ["과자", "과자봉지", "포장지", "wrapper", "snack"]
    }),
    "vinyl-bag": judgementItem({
      label: "비닐 봉투", emoji: "🛍️", objectType: "vinyl-bag", category: "비닐류 검토", carbonSaved: 9,
      guide: "이물질을 제거한 뒤 비닐류로 배출합니다.",
      tip: "세척하기 어려운 음식물 오염이 있으면 일반쓰레기로 검토합니다.",
      holdReasons: ["세척하기 어려운 오염이 있음"], searchKeywords: ["비닐", "비닐봉투", "봉투", "plastic bag"]
    }),
    "ramen-container": judgementItem({
      label: "컵라면 용기", emoji: "🍜", objectType: "ramen-container", category: "재질·오염 확인 필요", carbonSaved: 5,
      guide: "국물과 기름을 제거한 뒤 재질 표기와 학교 기준을 확인합니다. 오염이 남아 있으면 일반쓰레기로 배출합니다.",
      tip: "깨끗하게 세척된 흰 스티로폼만 학교 기준에 따라 분리배출할 수 있습니다.",
      holdReasons: ["기름 오염이 남아 있음", "재질 표기를 찾기 어려움"], searchKeywords: ["컵라면", "라면용기", "라면", "noodle cup", "ramen"]
    }),
    receipt: judgementItem({
      label: "영수증", emoji: "🧾", objectType: "receipt", category: "일반폐기물 검토", carbonSaved: 0,
      guide: "감열지 영수증은 특수 화학 코팅이 되어 있어 종이류가 아닌 일반쓰레기로 배출합니다.",
      tip: "영수증을 종이류에 섞으면 종이 재활용 품질을 떨어뜨릴 수 있습니다.",
      holdReasons: ["재질을 확인할 수 없음"], searchKeywords: ["영수증", "감열지", "receipt"]
    }),
    "tape-box": judgementItem({
      label: "택배상자 / 종이류", emoji: "📦", objectType: "tape-box", category: "종이류 검토", carbonSaved: 18,
      guide: "테이프·운송장·완충재를 제거한 뒤 부피를 줄여 종이류로 배출합니다.",
      tip: "테이프·코팅·오염이 많이 남아 있으면 선별 효율이 떨어지니 최대한 제거해 주세요.",
      holdReasons: ["테이프·코팅·오염이 많이 남아 있음"], searchKeywords: ["박스", "상자", "택배상자", "테이프", "종이", "종이류", "cardboard"]
    }),
    hold: judgementItem({
      label: "판단 보류", emoji: "🟨", objectType: "hold", category: "기준 확인 필요", carbonSaved: 0, isHold: true,
      guide: "복합 재질이거나 오염 상태가 애매하면 아무 데나 버리지 말고 학교 판단 보류함에 기록합니다.",
      tip: "판단 보류도 자원순환 역량입니다. 정기 회의에서 기준을 함께 정해 보세요.",
      holdReasons: ["물체 후보가 불명확함", "지역 기준 확인이 필요함"], searchKeywords: ["기타", "모름", "판단보류", "unknown", "other"]
    })
  };
  Object.entries(sortingDbV2).forEach(([id, item]) => { item.id = id; });

  const QUICK_SELECT_ORDER = ["milk-carton", "tape-box", "plastic-cup", "ramen-container", "snack-wrapper", "can", "pet-bottle", "hold"];

  const quizData = [
    { emoji: "🧾", question: "물건을 사고 받은 종이 영수증은 깨끗한 종이류 수거함에 섞어 배출해도 된다.", answer: false,
      explanation: "영수증은 열에 반응하는 특수 약품 코팅(감열지)이 되어 있습니다. 일반 폐지와 섞이면 가공 품질이 훼손되므로 일반쓰레기로 배출해야 정답입니다." },
    { emoji: "🍜", question: "국물 얼룩이 씻어도 지워지지 않는 스티로폼 라면 용기는 재활용이 불가능하다.", answer: true,
      explanation: "오염을 지울 수 없는 상태의 스티로폼 용기는 재활용 불가로 분류됩니다. 일반쓰레기로 배출해야 선별장에서 혼선이 없습니다." },
    { emoji: "🥛", question: "우유갑과 종이팩은 일반 폐지와 분리해 종이팩 전용 수거함에 배출해야 한다.", answer: true,
      explanation: "종이팩은 일반 신문지·재생용지와 재활용 가공 공정이 달라 전용 분리 배출이 원칙입니다." },
    { emoji: "📦", question: "택배 상자는 테이프와 운송장 비닐 스티커가 조금 남아 있어도 그대로 종이류로 버리면 된다.", answer: false,
      explanation: "테이프와 비닐 송장은 재활용 공정에서 불순물이 되므로 완전히 제거한 뒤 종이류로 배출해야 합니다." },
    { emoji: "🍾", question: "내용물을 비우고 압착한 투명 페트병은 라벨을 뜯지 않고 그대로 배출해도 잘 분류된다.", answer: false,
      explanation: "라벨은 몸체와 재질이 달라 반드시 제거한 뒤 투명 페트병만 따로 배출해야 고품질 재활용이 가능합니다." }
  ];

  window.AIWaysMobileData = { sortingDbV2, QUICK_SELECT_ORDER, quizData };
})();
