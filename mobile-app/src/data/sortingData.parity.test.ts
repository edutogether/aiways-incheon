// sortingData.ts가 원본 mobile/sortingData.js와 **정말로 같은 값**인지 확인한다.
//
// 왜 필요한가: 옮긴 것은 품목 안내 문구 370줄이다. 여기서 오타 하나가 나면
// 학생에게 잘못된 분리배출 안내가 그대로 나간다 - 화면은 멀쩡해 보이고,
// 스크린샷 대조로도 안 잡힌다(글자가 바뀐 것뿐이니까). 그래서 "눈으로 잘
// 옮겼다"에 기대지 않고, **원본 파일을 실제로 실행해서** 값을 통째로 비교한다.
//
// 원본은 window에 값을 붙이는 고전 스크립트라, node:vm 샌드박스에 가짜
// window를 주고 그대로 돌린다.
//
// 난수를 양쪽에 같은 씨앗으로 심는 이유: quizPool은 만들 때 shuffle을 쓰므로
// 실행할 때마다 순서가 다르다. 같은 난수열을 주면 두 구현이 같은 순서를
// 내놓아야 하고, 그게 곧 "같은 로직"이라는 증거가 된다.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGACY_FILE = resolve(HERE, "../../../mobile/sortingData.js");

function seededRandom() {
  let seed = 42;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

interface LegacyData {
  sortingDbV2: Record<string, unknown>;
  QUICK_SELECT_ORDER: string[];
  DECORATIVE_EMOJI_LOOKUP: unknown[];
  quizPool: unknown[];
  pickQuizSet: () => unknown[];
  quizRank: (correctCount: number) => unknown;
}

function loadLegacy(): LegacyData {
  const code = readFileSync(LEGACY_FILE, "utf8");
  // Math를 프로토타입으로 삼아야 floor/abs 같은 나머지 메서드가 그대로 산다
  // (Math의 메서드는 열거 불가라 스프레드로는 복사되지 않는다).
  const patchedMath = Object.create(Math) as Math;
  Object.defineProperty(patchedMath, "random", { value: seededRandom() });
  const legacyWindow: { AIWaysMobileData?: LegacyData } = {};
  runInContext(code, createContext({ window: legacyWindow, Math: patchedMath }));
  if (!legacyWindow.AIWaysMobileData) throw new Error("원본이 window.AIWaysMobileData를 채우지 않았다");
  return legacyWindow.AIWaysMobileData;
}

async function loadConverted() {
  vi.resetModules();
  vi.stubGlobal("Math", Object.defineProperty(Object.create(Math) as Math, "random", { value: seededRandom() }));
  const module = await import("./sortingData");
  return module;
}

describe("sortingData 이식 정합성", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("품목 안내 데이터가 원본과 완전히 같다", async () => {
    const legacy = loadLegacy();
    const converted = await loadConverted();
    expect(converted.sortingDbV2).toEqual(legacy.sortingDbV2);
    // 품목이 통째로 빠져도 toEqual이 잡지만, 몇 개인지는 눈으로도 보이게 남긴다.
    expect(Object.keys(converted.sortingDbV2)).toEqual(Object.keys(legacy.sortingDbV2));
  });

  it("빠른 선택 순서와 검색 이모지 표가 원본과 같다", async () => {
    const legacy = loadLegacy();
    const converted = await loadConverted();
    expect(converted.QUICK_SELECT_ORDER).toEqual(legacy.QUICK_SELECT_ORDER);
    expect(converted.DECORATIVE_EMOJI_LOOKUP).toEqual(legacy.DECORATIVE_EMOJI_LOOKUP);
  });

  it("같은 난수를 주면 퀴즈 문제 은행이 원본과 같은 순서로 만들어진다", async () => {
    const legacy = loadLegacy();
    const converted = await loadConverted();
    expect(converted.quizPool).toEqual(legacy.quizPool);
    // 500개 상한이 실제로 걸려 있는지도 같이 확인한다 - 이 상한이 사라지면
    // 문제 수가 조용히 늘어난다.
    expect(converted.quizPool.length).toBe(500);
  });

  it("등급 판정이 모든 점수 구간에서 원본과 같다", async () => {
    const legacy = loadLegacy();
    const converted = await loadConverted();
    for (let correct = 0; correct <= 11; correct += 1) {
      expect(converted.quizRank(correct), `${correct}개 정답`).toEqual(legacy.quizRank(correct));
    }
  });

  it("문제 뽑기가 O/X를 5개씩 섞어 10문제를 낸다", async () => {
    const converted = await loadConverted();
    const set = converted.pickQuizSet();
    expect(set.length).toBe(10);
    expect(set.filter((item) => item.answer).length).toBe(5);
    expect(set.filter((item) => !item.answer).length).toBe(5);
  });
});
