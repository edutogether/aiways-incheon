// 모델 응답을 다듬는 로직(normalizeAnalysis)의 회귀 검사.
//
// 전환하는 동안에는 이 자리에 **원본 mobile/sortingTextTip.js를 실제로 실행해
// 같은 입력에 같은 결과가 나오는지 대조하는** 테스트가 있었다. 원본에 90줄짜리
// normalizeResponse가 두 벌 복붙돼 있던 것을 하나로 합치면서, 조건 하나만
// 틀어져도 "AI가 엉뚱한 후보를 화면에 올리는" 형태로 조용히 깨지기 때문이다.
//
// 전환이 끝나 원본이 저장소에서 사라졌으므로 대조 대상을 **명시적인 기대값**으로
// 바꿨다. 검사하는 경우의 수는 그대로다 - 그때 원본과 같다고 확인된 동작을
// 여기에 못박아 두는 것이라, 앞으로 이 로직이 흔들리면 여전히 잡힌다.
// (원본은 mobile-react-freeze-20260909 태그에 남아 있다.)
import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "./sortingAnalysis";

const SCHEMA = "sorting-text-tip-v1";
const PROVIDER = "future_gemini";
const REQ = "req-1";

const valid = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: SCHEMA,
  provider: PROVIDER,
  requestId: REQ,
  uncertainty: "medium",
  objectCandidates: [{ label: "페트병", itemId: "pet-bottle", confidenceBand: "high" }],
  ...overrides
});

const run = (raw: unknown) => normalizeAnalysis(raw, REQ, SCHEMA);

describe("응답을 못 믿을 때는 null을 돌려준다", () => {
  // null이면 호출부가 "invalid_response"로 처리한다. 여기서 하나라도 통과하면
  // 검증되지 않은 값이 그대로 화면에 올라간다.
  it.each([
    ["스키마 이름이 다름", valid({ schemaVersion: "sorting-vision-v1" })],
    ["제공자가 다름", valid({ provider: "someone-else" })],
    ["requestId가 어긋남", { ...valid(), requestId: "전혀-다른-아이디" }],
    ["objectCandidates가 배열이 아님", valid({ objectCandidates: "없음" })],
    ["uncertainty 값이 이상함", valid({ uncertainty: "아마도" })],
    ["응답이 객체가 아님", "그냥 문자열"],
    ["응답이 null", null]
  ])("%s", (_name, raw) => {
    expect(run(raw)).toBeNull();
  });
});

describe("후보 목록을 다듬는다", () => {
  it("데이터에 없는 품목 id는 버린다", () => {
    const result = run(valid({
      objectCandidates: [
        { label: "무언가", itemId: "없는-품목", confidenceBand: "high" },
        { label: "캔", itemId: "can", confidenceBand: "low" }
      ]
    }));
    expect(result?.objectCandidates).toEqual([{ label: "캔", itemId: "can", confidenceBand: "low" }]);
  });

  it("같은 품목이 여러 번 오면 첫 번째만 남긴다", () => {
    const result = run(valid({
      objectCandidates: [
        { label: "캔", itemId: "can", confidenceBand: "high" },
        { label: "캔 또", itemId: "can", confidenceBand: "low" }
      ]
    }));
    expect(result?.objectCandidates).toEqual([{ label: "캔", itemId: "can", confidenceBand: "high" }]);
  });

  it("후보가 셋을 넘으면 자른다", () => {
    const result = run(valid({
      objectCandidates: ["can", "pet-bottle", "paper-cup", "milk-carton", "vinyl-bag"]
        .map((itemId) => ({ label: itemId, itemId, confidenceBand: "medium" }))
    }));
    expect(result?.objectCandidates.map((c) => c.itemId)).toEqual(["can", "pet-bottle", "paper-cup"]);
  });

  it("label이 비면 버린다", () => {
    const result = run(valid({ objectCandidates: [{ label: "   ", itemId: "can", confidenceBand: "high" }] }));
    expect(result?.objectCandidates).toEqual([]);
  });

  it("label이 40자를 넘으면 자른다", () => {
    const result = run(valid({ objectCandidates: [{ label: "가".repeat(80), itemId: "can", confidenceBand: "high" }] }));
    expect(result?.objectCandidates[0]?.label).toBe("가".repeat(40));
  });

  it("confidenceBand가 이상하면 unknown으로 둔다", () => {
    const result = run(valid({ objectCandidates: [{ label: "캔", itemId: "can", confidenceBand: "아주높음" }] }));
    expect(result?.objectCandidates[0]?.confidenceBand).toBe("unknown");
  });

  it("후보가 객체가 아닌 값이어도 죽지 않는다", () => {
    const result = run(valid({ objectCandidates: ["문자열", 42, null, { label: "캔", itemId: "can" }] }));
    expect(result?.objectCandidates).toEqual([{ label: "캔", itemId: "can", confidenceBand: "unknown" }]);
  });

  it("프로토타입 속성 이름도 통과한다(원본과 같은 성질 - 별건으로 고칠 것)", () => {
    // db[itemId]로만 확인하기 때문에 "constructor"가 truthy로 통과한다.
    // 전환의 기준이 "동작 동일"이라 여기서 고치지 않았고, 고칠 때 이 테스트가
    // 같이 바뀌어야 한다는 표시로 남겨 둔다(app.md 남은 항목).
    const result = run(valid({ objectCandidates: [{ label: "이상한 것", itemId: "constructor", confidenceBand: "high" }] }));
    expect(result?.objectCandidates).toEqual([{ label: "이상한 것", itemId: "constructor", confidenceBand: "high" }]);
  });
});

describe("재질 후보와 주의문구", () => {
  it("빈 label을 버리고 셋까지만 남긴다", () => {
    const result = run(valid({
      materialCandidates: [{ label: " 알루미늄 " }, { label: "" }, { label: "철" }, { label: "주석" }, { label: "구리" }]
    }));
    expect(result?.materialCandidates).toEqual([
      { label: "알루미늄", confidenceBand: "unknown" },
      { label: "철", confidenceBand: "unknown" },
      { label: "주석", confidenceBand: "unknown" }
    ]);
  });

  it("재질 후보가 배열이 아니면 빈 배열로 둔다", () => {
    expect(run(valid({ materialCandidates: { label: "알루미늄" } }))?.materialCandidates).toEqual([]);
  });

  it("주의문구는 중복을 지우고 다섯 개까지만 남긴다", () => {
    const result = run(valid({ visibleCautions: ["가", "가", "나", "다", "라", "마", "바"] }));
    expect(result?.visibleCautions).toEqual(["가", "나", "다", "라", "마"]);
  });

  it("주의문구가 100자를 넘으면 자른다", () => {
    const result = run(valid({ visibleCautions: ["주".repeat(150)] }));
    expect(result?.visibleCautions[0]).toBe("주".repeat(100));
  });
});

describe("사용자 확인 필요 여부", () => {
  it("불리언이 아니면 true로 본다", () => {
    // 모르면 "확인이 필요하다"쪽으로 기운다 - 안전한 기본값이다.
    expect(run(valid({ needsUserCheck: "네" }))?.needsUserCheck).toBe(true);
  });

  it("false면 그대로 false다", () => {
    expect(run(valid({ needsUserCheck: false }))?.needsUserCheck).toBe(false);
  });
});
