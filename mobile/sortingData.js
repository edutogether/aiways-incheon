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

  const QUICK_SELECT_ORDER = ["milk-carton", "tape-box", "plastic-cup", "ramen-container", "snack-wrapper", "can", "pet-bottle", "glass-bottle"];

  // Quiz bank ported verbatim from ../app.js's buildExpandedSortingQuizData /
  // sortingQuizData / pickQuizSet / quizRank, so the mobile quiz uses the same
  // large question pool and rank titles as the PC app.
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
        trueQuestions.push({ emoji, question: template(item), answer: true, explanation: "맞는 판단입니다. 오염 상태, 재질, 학교 기준을 함께 확인하는 습관이 중요합니다." });
      });
      falseTemplates.forEach(template => {
        falseQuestions.push({ emoji, question: template(item), answer: false, explanation: "아쉬워요. 분리배출은 물건 이름만이 아니라 오염 상태와 학교 기준까지 함께 봐야 합니다." });
      });
    });

    const balanced = [];
    for (let index = 0; index < 250; index += 1) {
      balanced.push(trueQuestions[index % trueQuestions.length]);
      balanced.push(falseQuestions[index % falseQuestions.length]);
    }
    return balanced;
  }

  const quizPool = buildExpandedSortingQuizData([
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
    emoji, question, answer,
    explanation: answer ? "맞는 기준입니다. 실제 배출 전 오염 상태와 학교 기준을 한 번 더 확인해요." : "헷갈리기 쉬운 기준입니다. 재질과 오염 상태를 다시 살펴봐요."
  })));

  function pickQuizSet() {
    const shuffle = items => [...items].sort(() => Math.random() - 0.5);
    const truePool = shuffle(quizPool.filter(item => item.answer === true));
    const falsePool = shuffle(quizPool.filter(item => item.answer === false));
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

  window.AIWaysMobileData = { sortingDbV2, QUICK_SELECT_ORDER, quizPool, pickQuizSet, quizRank };
})();
