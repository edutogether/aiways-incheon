// 분리배출 데이터가 지켜야 할 것들.
//
// 전환하는 동안에는 이 자리에 **원본 mobile/sortingData.js를 실제로 실행해
// 값을 통째로 대조하는** 테스트가 있었다(sortingData.parity.test.ts). 그
// 목적은 "370줄을 옮기면서 글자 하나 안 틀렸는가"였고, 전환이 끝나면서
// 원본이 저장소에서 사라졌으므로 그 테스트도 같이 내렸다. 대조 기록은
// 커밋에, 원본은 mobile-react-freeze-20260909 태그에 남아 있다.
//
// 원본을 참고용으로 남겨두고 계속 대조하는 방법도 생각했지만 그러면 **데이터를
// 영원히 못 고치게 된다** - 앞으로 품목 안내를 고치는 것은 정상적인 작업이고,
// 그때마다 "원본과 다르다"고 빨간불이 뜨는 것은 맞지 않다. 대신 여기서는
// 내용이 아니라 **구조가 무너지지 않았는지**를 본다. 문구가 바뀌는 것은
// git diff가 보여준다.
import { describe, expect, it } from "vitest";
import { DECORATIVE_EMOJI_LOOKUP, QUICK_SELECT_ORDER, pickQuizSet, quizPool, quizRank, sortingDbV2 } from "./sortingData";

// 아래 검사들은 대부분 목록을 돌면서 확인한다. 목록이 비면 **반복문이 안 돌아
// 전부 초록불**이 된다 - 데이터가 통째로 사라진 것이 가장 큰 사고인데 그때
// 제일 조용해지는 셈이다(COMMON_STANDARDS §21). 먼저 개수부터 못박는다.
describe("데이터가 실제로 있다", () => {
  it("품목·빠른선택·이모지표·문제은행이 비어 있지 않다", () => {
    expect(Object.keys(sortingDbV2).length).toBeGreaterThanOrEqual(12);
    expect(QUICK_SELECT_ORDER.length).toBeGreaterThanOrEqual(12);
    expect(DECORATIVE_EMOJI_LOOKUP.length).toBeGreaterThanOrEqual(10);
    expect(quizPool.length).toBe(500);
  });
});

describe("품목 데이터", () => {
  it("모든 항목의 id가 키와 같다", () => {
    // renderResult가 item.id로 다시 조회하는 자리가 있어서, 키와 어긋나면
    // "다른 후보였나요?" 칩이 엉뚱한 품목을 가리킨다.
    for (const [key, item] of Object.entries(sortingDbV2)) {
      expect(item.id, `${key}의 id`).toBe(key);
    }
  });

  it("안내에 필요한 값이 비어 있지 않다", () => {
    for (const [key, item] of Object.entries(sortingDbV2)) {
      for (const field of ["label", "emoji", "objectType", "category", "guide", "tip"] as const) {
        expect(item[field], `${key}.${field}`).toBeTruthy();
      }
      expect(Array.isArray(item.searchKeywords), `${key}.searchKeywords`).toBe(true);
      expect(Array.isArray(item.holdReasons), `${key}.holdReasons`).toBe(true);
    }
  });

  it("판단 보류 항목이 있고, 그것만 isHold다", () => {
    // buildResultView가 모르는 id를 받으면 hold로 떨어뜨린다. 이게 없으면
    // 결과 모달이 통째로 못 뜬다.
    const holds = Object.values(sortingDbV2).filter((item) => item.isHold);
    expect(holds.map((item) => item.id)).toEqual(["hold"]);
  });

  it("빠른 선택 목록이 전부 실재하는 품목을 가리킨다", () => {
    for (const id of QUICK_SELECT_ORDER) {
      expect(sortingDbV2[id], `빠른 선택의 ${id}`).toBeDefined();
    }
  });

  it("검색창 이모지 표가 [이모지, 부르는 말들] 꼴이다", () => {
    for (const [emoji, keywords] of DECORATIVE_EMOJI_LOOKUP) {
      expect(typeof emoji).toBe("string");
      expect(emoji.length).toBeGreaterThan(0);
      expect(keywords.length).toBeGreaterThan(0);
    }
  });
});

describe("퀴즈", () => {
  it("문제 은행이 500개 상한을 지킨다", () => {
    // 상한이 사라지면 문제 수가 조용히 늘어난다(예전에 index % length로
    // 잘라 쓰다가 31번째 이후 품목이 전부 빠지던 버그가 있었다).
    expect(quizPool.length).toBe(500);
  });

  it("모든 문제에 해설이 붙어 있다", () => {
    for (const question of quizPool) {
      expect(question.question, "문제 문장").toBeTruthy();
      expect(question.explanation, "해설").toBeTruthy();
      expect(typeof question.answer).toBe("boolean");
    }
  });

  it("한 판은 O 5개 X 5개로 10문제다", () => {
    const set = pickQuizSet();
    expect(set.length).toBe(10);
    expect(set.filter((item) => item.answer).length).toBe(5);
    expect(set.filter((item) => !item.answer).length).toBe(5);
  });

  it("한 판 안에 같은 문제가 두 번 나오지 않는다", () => {
    const set = pickQuizSet();
    expect(new Set(set.map((item) => item.question)).size).toBe(set.length);
  });

  it("등급이 맞힌 개수에 따라 올라간다", () => {
    const titles = [0, 3, 5, 7, 9, 10].map((count) => quizRank(count).title);
    expect(titles).toEqual([
      "분리배출 새싹",
      "분리배출 연습생",
      "자원순환 탐험가",
      "분리배출 실천가",
      "자원순환 환경운동가",
      "AI Ways 자원순환 마스터"
    ]);
    // 구간 경계 바로 아래는 한 단계 낮은 등급이어야 한다.
    expect(quizRank(2).title).toBe(quizRank(0).title);
    expect(quizRank(4).title).toBe(quizRank(3).title);
    // 10문제가 상한이지만, 넘겨도 최고 등급에서 멈춘다.
    expect(quizRank(11).title).toBe(quizRank(10).title);
  });
});
