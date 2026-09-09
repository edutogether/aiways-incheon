// 응답을 다듬는 로직이 원본과 정말 같은지 확인한다.
//
// 왜 이 부분을 특히 조이는가: mobile/sortingVision.js와 sortingTextTip.js에
// 90줄짜리 normalizeResponse가 **두 벌 복붙**돼 있었고, 이번에 하나로 합쳤다.
// 합치는 과정에서 조건 하나만 틀어져도 "AI가 엉뚱한 후보를 화면에 올리는"
// 형태로 조용히 깨진다. 그래서 원본 파일을 node:vm에서 실제로 돌려, 같은
// 입력에 같은 결과가 나오는지 응답 모양을 바꿔가며 대조한다.
//
// requestId는 양쪽이 각자 만들기 때문에 미리 알 수 없다. 가짜 클라이언트가
// **요청에 담겨 온 requestId를 그대로 응답에 되돌려주는** 방식으로 맞춘다
// (일부러 어긋나게 하는 경우도 따로 본다).
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sortingDbV2 } from "../data/sortingData";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGACY_FILE = resolve(HERE, "../../../mobile/sortingTextTip.js");

type RawBuilder = (requestId: string) => unknown;

// 응답 본문을 만들어 주는 가짜 클라이언트. 원본과 전환본에 같은 것을 준다.
function fakeClient(build: RawBuilder, { ok = true, code = "" } = {}) {
  return {
    analyzeSortingText: (payload: { requestId: string }) =>
      Promise.resolve(ok ? { ok: true, data: build(payload.requestId) } : { ok: false, code })
  };
}

function fakeWindow(client: unknown) {
  return {
    AIWaysEdu2gClient: client,
    AIWaysMobileData: { sortingDbV2 },
    crypto: { randomUUID: () => "fixed-uuid" }
  };
}

async function runLegacy(client: unknown, query: string) {
  const code = readFileSync(LEGACY_FILE, "utf8");
  const legacyWindow = fakeWindow(client) as Record<string, unknown> & { AIWaysMobileTextTip?: { analyzeText: (q: string) => Promise<unknown> } };
  runInContext(code, createContext({ window: legacyWindow }));
  if (!legacyWindow.AIWaysMobileTextTip) throw new Error("원본이 window.AIWaysMobileTextTip을 채우지 않았다");
  return legacyWindow.AIWaysMobileTextTip.analyzeText(query);
}

async function runConverted(client: unknown, query: string) {
  vi.resetModules();
  vi.stubGlobal("window", fakeWindow(client));
  const { analyzeText } = await import("./sortingAnalysis");
  return analyzeText(query);
}

const SCHEMA = "sorting-text-tip-v1";
const PROVIDER = "future_gemini";
const valid = (requestId: string, overrides: Record<string, unknown> = {}) => ({
  schemaVersion: SCHEMA,
  provider: PROVIDER,
  requestId,
  uncertainty: "medium",
  objectCandidates: [{ label: "페트병", itemId: "pet-bottle", confidenceBand: "high" }],
  ...overrides
});

// 응답 모양을 이렇게 흔들어 본다. 이름은 실패 시 어느 경우가 깨졌는지
// 바로 알아보려고 붙인다.
const CASES: { 이름: string; build: RawBuilder }[] = [
  { 이름: "정상 응답", build: (id) => valid(id) },
  { 이름: "스키마 이름이 다름", build: (id) => valid(id, { schemaVersion: "sorting-vision-v1" }) },
  { 이름: "제공자가 다름", build: (id) => valid(id, { provider: "someone-else" }) },
  { 이름: "requestId가 어긋남", build: () => valid("전혀-다른-아이디") },
  { 이름: "objectCandidates가 배열이 아님", build: (id) => valid(id, { objectCandidates: "없음" }) },
  { 이름: "uncertainty 값이 이상함", build: (id) => valid(id, { uncertainty: "아마도" }) },
  { 이름: "응답이 객체가 아님", build: () => "그냥 문자열" },
  { 이름: "응답이 null", build: () => null },
  {
    이름: "모르는 품목 id는 버린다",
    build: (id) => valid(id, { objectCandidates: [{ label: "무언가", itemId: "없는-품목", confidenceBand: "high" }, { label: "캔", itemId: "can", confidenceBand: "low" }] })
  },
  {
    이름: "같은 품목이 여러 번 오면 첫 번째만 남긴다",
    build: (id) => valid(id, { objectCandidates: [{ label: "캔", itemId: "can", confidenceBand: "high" }, { label: "캔 또", itemId: "can", confidenceBand: "low" }] })
  },
  {
    이름: "후보가 셋을 넘으면 자른다",
    build: (id) => valid(id, {
      objectCandidates: ["can", "pet-bottle", "paper-cup", "milk-carton", "vinyl-bag"].map((itemId) => ({ label: itemId, itemId, confidenceBand: "medium" }))
    })
  },
  {
    이름: "label이 비면 버린다",
    build: (id) => valid(id, { objectCandidates: [{ label: "   ", itemId: "can", confidenceBand: "high" }] })
  },
  {
    이름: "label이 40자를 넘으면 자른다",
    build: (id) => valid(id, { objectCandidates: [{ label: "가".repeat(80), itemId: "can", confidenceBand: "high" }] })
  },
  {
    이름: "confidenceBand가 이상하면 unknown",
    build: (id) => valid(id, { objectCandidates: [{ label: "캔", itemId: "can", confidenceBand: "아주높음" }] })
  },
  {
    이름: "후보가 객체가 아닌 값이어도 죽지 않는다",
    build: (id) => valid(id, { objectCandidates: ["문자열", 42, null, { label: "캔", itemId: "can" }] })
  },
  {
    이름: "재질 후보를 다듬고 자른다",
    build: (id) => valid(id, { materialCandidates: [{ label: " 알루미늄 " }, { label: "" }, { label: "철" }, { label: "주석" }, { label: "구리" }] })
  },
  {
    이름: "재질 후보가 배열이 아니면 빈 배열",
    build: (id) => valid(id, { materialCandidates: { label: "알루미늄" } })
  },
  {
    이름: "주의문구는 중복을 지우고 다섯 개까지",
    build: (id) => valid(id, { visibleCautions: ["가", "가", "나", "다", "라", "마", "바"] })
  },
  {
    이름: "주의문구가 100자를 넘으면 자른다",
    build: (id) => valid(id, { visibleCautions: ["주".repeat(150)] })
  },
  {
    이름: "needsUserCheck가 불리언이 아니면 true",
    build: (id) => valid(id, { needsUserCheck: "네" })
  },
  {
    이름: "needsUserCheck가 false면 그대로 false",
    build: (id) => valid(id, { needsUserCheck: false })
  },
  {
    // 원본이 db[itemId]로만 확인해서 프로토타입 속성("constructor")이 통과한다.
    // 고치면 동작이 달라지므로 여기서는 **원본과 같게** 두고, 이 테스트로
    // 그 사실을 드러내 놓는다(별건으로 보고했다).
    이름: "프로토타입 속성 이름도 원본과 같게 처리한다",
    build: (id) => valid(id, { objectCandidates: [{ label: "이상한 것", itemId: "constructor", confidenceBand: "high" }] })
  }
];

describe("응답 정규화 이식 정합성", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  for (const testCase of CASES) {
    it(testCase.이름, async () => {
      const legacy = await runLegacy(fakeClient(testCase.build), "이름 모를 물건");
      const converted = await runConverted(fakeClient(testCase.build), "이름 모를 물건");
      expect(converted).toEqual(legacy);
    });
  }

  it("검색어가 비면 원본과 같은 코드로 거절한다", async () => {
    const build: RawBuilder = (id) => valid(id);
    expect(await runConverted(fakeClient(build), "   ")).toEqual(await runLegacy(fakeClient(build), "   "));
  });

  it("서버가 실패를 돌려주면 그 코드를 그대로 전한다", async () => {
    const build: RawBuilder = (id) => valid(id);
    const make = () => fakeClient(build, { ok: false, code: "rate_limited" });
    expect(await runConverted(make(), "페트병")).toEqual(await runLegacy(make(), "페트병"));
  });

  it("클라이언트 자체가 없으면 원본과 같이 provider_unavailable", async () => {
    expect(await runConverted({}, "페트병")).toEqual(await runLegacy({}, "페트병"));
  });
});
