// 옮긴 정규화 함수들이 **원본과 같은 값을 내는가** (S3 대조).
//
// 🔴 원본 함수를 **파일에서 그때그때 떼어 와 실제로 실행**해서 비교한다.
// 원문을 복사해 픽스처로 굳혀 두면 기준을 감시 대상에서 가져오는 것이 되고
// (§21-7), 원본이 바뀌어도 대조가 조용히 통과한다.
//
// 🔴 **정상 입력만으로 대조하지 않는다.** 이 함수들은 이름부터 정규화·파싱이라
// **깨진 입력에서 갈린다.** 입력 집합이 좁으면 "같다"가 아무것도 증명하지 않는다.
// 그래서 빈 값·null·undefined·타입 뒤섞임·범위 밖 학년/반·특수문자·자정 근처
// 시각을 전부 넣는다.
import { describe, expect, it } from "vitest";
import { loadLegacy } from "../../scripts/extractLegacyFns.mjs";
import * as ported from "./normalize";

// 원본은 서로를 부르므로 한 덩어리로 떼어 온다. DATA_CONFIG는 그 함수들이
// 참조하는 유일한 바깥 값이라 같이 넣어 준다(원본과 같은 값).
const LEGACY_NAMES = [
  "cleanText", "digitsOnly", "toNumber", "normalizeGrade",
  "normalizeClassOnly", "normalizeFullClassName", "classParts", "classifyRecordType"
];
const legacy = loadLegacy(LEGACY_NAMES, `
  const DATA_CONFIG = { currentSchool: "AIWays초", currentGrade: "5학년", currentClassName: "5학년 1반" };
`) as Record<string, (...args: unknown[]) => unknown>;

// 한 함수라도 못 떼어 오면 대조가 통째로 사라진다.
it("원본 함수를 실제로 떼어 왔다", () => {
  expect(Object.keys(legacy).sort()).toEqual([...LEGACY_NAMES].sort());
  for (const name of LEGACY_NAMES) expect(typeof legacy[name], `${name}`).toBe("function");
});

// 한 인자짜리 함수들에 공통으로 먹일 입력. 깨진 것 위주다.
const HOSTILE: unknown[] = [
  undefined, null, "", "   ", 0, 3, -1, 7, 12, NaN, Infinity, true, false,
  "3", "3학년", "삼학년", "0학년", "7학년", "-2학년", "10학년",
  "1반", "9반", "10반", "0반", "반", "3-2", "3 - 2", "3학년2반", "3학년  2반",
  "5학년 1반", "  5학년   1반  ", "3학년 12반", "12학년 3반",
  "1,234", "1 234", "1.5", "-7", "1e3", "0x10", " 42 ",
  "이름,쉼표", '따옴표"안', "줄\n바꿈", "탭\t문자", "이모지🎓", "<script>",
  [], {}, [1, 2], { grade: 3 }
];

function compare(name: string, fn: (v: unknown) => unknown, inputs: unknown[] = HOSTILE) {
  const legacyFn = legacy[name]!;
  for (const input of inputs) {
    const label = `${name}(${JSON.stringify(input) ?? String(input)})`;
    expect(fn(input), label).toEqual(legacyFn(input));
  }
}

describe("한 인자짜리 정규화", () => {
  it("cleanText", () => compare("cleanText", ported.cleanText));
  it("digitsOnly", () => compare("digitsOnly", ported.digitsOnly));
  it("normalizeGrade — 못 알아들으면 기본 학년", () => compare("normalizeGrade", ported.normalizeGrade));
  it("normalizeClassOnly — 못 알아들으면 1반", () => compare("normalizeClassOnly", ported.normalizeClassOnly));
  it("classParts", () => compare("classParts", ported.classParts));
});

describe("toNumber — fallback이 실제로 쓰이는지까지", () => {
  it("기본 fallback", () => compare("toNumber", ported.toNumber));

  it("fallback을 직접 준 경우", () => {
    for (const input of HOSTILE) {
      for (const fallback of [0, -1, 999, NaN]) {
        const label = `toNumber(${String(input)}, ${String(fallback)})`;
        expect(ported.toNumber(input, fallback), label).toEqual(legacy.toNumber!(input, fallback));
      }
    }
  });
});

describe("normalizeFullClassName — 두 인자가 서로 다투는 경우", () => {
  it("학년과 반 문자열의 모든 조합", () => {
    const grades: unknown[] = [undefined, null, "", 3, "3", "3학년", "7학년", "0", "삼"];
    const classes: unknown[] = [undefined, null, "", "2반", "3-2", "3학년 2반", "12반", "2", 2, "반"];
    for (const grade of grades) {
      for (const className of classes) {
        const label = `normalizeFullClassName(${String(grade)}, ${String(className)})`;
        expect(ported.normalizeFullClassName(grade, className), label)
          .toEqual(legacy.normalizeFullClassName!(grade, className));
      }
    }
  });
});

describe("classifyRecordType — 필드가 없거나 섞인 기록", () => {
  it("기록 모양 전부", () => {
    const records: Record<string, unknown>[] = [
      {}, { input_type: "" }, { input_type: "   " }, { input_type: "TEXT" }, { input_type: "text" },
      { input_type: null }, { input_type: undefined }, { input_type: 0 }, { input_type: false },
      { totalScans: 0 }, { totalScans: undefined }, { landfillTons: 0 }, { landfillTons: null },
      { totalScans: 3, landfillTons: 5 }, { input_type: "photo", totalScans: 1 }
    ];
    for (const record of records) {
      const label = `classifyRecordType(${JSON.stringify(record)})`;
      expect(ported.classifyRecordType(record), label).toEqual(legacy.classifyRecordType!(record));
    }
  });
});

// 🔴 자정 근처. 다른 저장소에서 시간대 처리로 실제 사고가 났다. 이 묶음에는
// 날짜를 직접 다루는 함수가 없지만, 날짜 문자열이 학년/반 자리에 잘못 들어오는
// 경우가 실제로 있어(기록 병합 중 필드가 밀리는 일) 그것까지 같이 본다.
describe("자정 근처 날짜 문자열이 엉뚱한 자리에 들어와도 같은 값", () => {
  it("날짜 꼴 입력", () => {
    const dates = [
      "2026-09-10T23:59:59", "2026-09-10T00:00:00", "2026-09-11T00:00:00.000Z",
      "2026-01-01", "26.09.10(목) 00:00:00", "1970-01-01T00:00:00Z"
    ];
    compare("normalizeGrade", ported.normalizeGrade, dates);
    compare("normalizeClassOnly", ported.normalizeClassOnly, dates);
    compare("classParts", ported.classParts, dates);
    compare("toNumber", ported.toNumber, dates);
  });
});
