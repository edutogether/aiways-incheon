// 옮긴 집계 함수들이 **원본과 같은 값을 내는가** (S3 둘째 묶음 대조).
//
// 🔴 원본 함수를 `app.js`에서 그때그때 떼어 와 **실제로 실행**해서 비교한다.
// 원문을 복사해 픽스처로 굳혀 두면 기준을 감시 대상에서 가져오는 것이 되고
// (§21-7), 원본이 바뀌어도 대조가 조용히 통과한다.
//
// 🔴 **자료도 같이 대조한다.** `BASE_DASHBOARD`/`BASE_CLASS_DATA`는 화면에 그대로
// 찍히는 숫자인데, 함수만 대조하면 양쪽이 서로 다른 자료를 먹은 채로 "같은 함수"를
// 확인하게 되어 옮겨 적다 틀린 한 칸이 안 잡힌다.
//
// 🔴 **`toEqual`로는 부족하다.** 이 묶음은 나눗셈이 들어 있어 `0`·`NaN`·`Infinity`·
// `-0`이 갈리는데, 그 넷을 구분해서 봐야 "같다"가 의미를 갖는다. 아래
// `expectSame`이 숫자를 `Object.is`로 본다.
import { describe, expect, it } from "vitest";
import { extractConst, legacySource, loadLegacy, loadLegacyConsts } from "../../scripts/extractLegacyFns.mjs";
import { BASE_CLASS_DATA, BASE_DASHBOARD, cloneBaseClasses } from "./baseData";
import * as ported from "./aggregate";
import type { LegacyRecord, LooseClassMap } from "./aggregate";

// -----------------------------------------------------------------------
// 원본 떼어 오기
// -----------------------------------------------------------------------

// 화면에서 고른 반. 원본 `mergeActualIntoClasses`가 `selectedClassName()`(DOM)을
// 부르므로, 대조에서는 **양쪽에 같은 값**을 준다 - 옮긴 쪽은 인자로 받는다.
const FALLBACK_CLASS = "5학년 1반";

const source = legacySource();
const LEGACY_NAMES = [
  "cleanText", "digitsOnly", "toNumber", "normalizeGrade", "normalizeClassOnly",
  "normalizeFullClassName", "classParts",
  "setClassMetric", "cloneBaseClasses", "baseDataFromRecords", "mergeActualIntoClasses",
  "calculateClassScore", "buildClassRanking", "getCurrentClassRank",
  "gradeSummaries", "aggregateSchoolDashboard"
];

const legacy = loadLegacy(LEGACY_NAMES, `
  const DATA_CONFIG = ${extractConst(source, "DATA_CONFIG")};
  const BASE_DASHBOARD = ${extractConst(source, "BASE_DASHBOARD")};
  const BASE_CLASS_DATA = ${extractConst(source, "BASE_CLASS_DATA")};
  function selectedClassName() { return ${JSON.stringify(FALLBACK_CLASS)}; }
`) as Record<string, (...args: never[]) => unknown>;

// 자료는 값으로 읽어 온다(위 extraSource는 원문 그대로 엮는 쪽이다).
const legacyConsts = loadLegacyConsts(["BASE_DASHBOARD", "BASE_CLASS_DATA"]);

const call = (name: string, ...args: unknown[]): unknown =>
  (legacy[name] as (...a: unknown[]) => unknown)(...args);

// 한 함수라도 못 떼어 오면 대조가 통째로 사라진다.
it("원본 함수를 실제로 떼어 왔다", () => {
  expect(Object.keys(legacy).sort()).toEqual([...LEGACY_NAMES].sort());
  for (const name of LEGACY_NAMES) expect(typeof legacy[name], name).toBe("function");
});

// -----------------------------------------------------------------------
// 0 / NaN / Infinity / -0 을 구분하는 깊은 비교
// -----------------------------------------------------------------------

// 어디가 다른지 경로로 알려준다. 값이 깊어서 "객체가 다릅니다"만으로는 못 고친다.
function diffPath(a: unknown, b: unknown, path = ""): string | null {
  if (typeof a === "number" || typeof b === "number") {
    // 🔴 Object.is라야 NaN===NaN이 참이고 0과 -0이 갈린다.
    return Object.is(a, b) ? null : `${path || "(값)"}: 옮긴 것=${String(a)} / 원본=${String(b)}`;
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return Object.is(a, b) ? null : `${path || "(값)"}: 옮긴 것=${JSON.stringify(a)} / 원본=${JSON.stringify(b)}`;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: 한쪽만 배열이다`;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  // 🔴 키 집합까지 본다. 없는 키가 undefined로 읽혀 "같다"로 넘어가면 안 된다.
  const missing = keysB.filter((k) => !keysA.includes(k));
  const extra = keysA.filter((k) => !keysB.includes(k));
  if (missing.length) return `${path}: 옮긴 것에 없는 키 [${missing.join(", ")}]`;
  if (extra.length) return `${path}: 옮긴 것에만 있는 키 [${extra.join(", ")}]`;
  for (const key of keysB) {
    const found = diffPath(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      path ? `${path}.${key}` : key
    );
    if (found) return found;
  }
  return null;
}

function expectSame(mine: unknown, theirs: unknown, label: string): void {
  const diff = diffPath(mine, theirs);
  expect(diff === null ? "같음" : `${label} — ${diff}`).toBe("같음");
}

// 이 비교기가 실제로 갈라내는지부터 확인한다. 그러지 않으면 아래 대조 전부가
// "무엇이든 같다고 말하는 비교기"로 통과할 수 있다(§21).
describe("비교기 자체", () => {
  it("0 / -0 / NaN / Infinity 를 구분한다", () => {
    expect(diffPath(0, -0)).not.toBeNull();
    expect(diffPath(NaN, 0)).not.toBeNull();
    expect(diffPath(Infinity, NaN)).not.toBeNull();
    expect(diffPath(Infinity, Infinity)).toBeNull();
    expect(diffPath(NaN, NaN)).toBeNull();
    expect(diffPath({ a: NaN }, { a: 0 })).not.toBeNull();
    expect(diffPath({ a: 1 }, { a: 1, b: 2 })).not.toBeNull();
    expect(diffPath({ a: 1, b: 2 }, { a: 1 })).not.toBeNull();
  });
});

// -----------------------------------------------------------------------
// 자료
// -----------------------------------------------------------------------

describe("옮겨 적은 자료가 원본과 같다", () => {
  it("BASE_DASHBOARD", () => {
    expectSame(BASE_DASHBOARD, legacyConsts.BASE_DASHBOARD, "BASE_DASHBOARD");
  });
  it("BASE_CLASS_DATA — 14개 반 × 8개 지표", () => {
    const original = legacyConsts.BASE_CLASS_DATA as Record<string, unknown>;
    // 개수부터 못박는다. 자료가 비면 아래 비교가 "빈 것끼리 같다"로 통과한다.
    expect(Object.keys(original).length, "원본 반 수").toBeGreaterThanOrEqual(14);
    expectSame(BASE_CLASS_DATA, original, "BASE_CLASS_DATA");
  });
  it("cloneBaseClasses — 원본을 오염시키지 않는다", () => {
    expectSame(cloneBaseClasses(), call("cloneBaseClasses"), "cloneBaseClasses()");
    const mine = cloneBaseClasses();
    mine["5학년 1반"]!.today = 9999;
    expect(BASE_CLASS_DATA["5학년 1반"]!.today, "복사본을 고쳤는데 원본이 바뀌었다").toBe(24);
  });
});

// -----------------------------------------------------------------------
// 먹일 입력 — 깨진 것 위주
// -----------------------------------------------------------------------

// 반 자료. 정상 / 값이 비었거나 타입이 뒤섞인 것 / 0만 있는 것 / NaN이 든 것.
const CLASS_MAPS: { label: string; value: LooseClassMap }[] = [
  { label: "기본 자료 그대로", value: cloneBaseClasses() },
  { label: "빈 자료", value: {} },
  {
    label: "전부 0 — 0으로 나눌 뻔한 자리",
    value: { "3학년 1반": { today: 0, weekly: 0, hold: 0, converted: 0, correct: 0, recycle: 0, reuse: 0, contamination: 0 } }
  },
  {
    label: "weekly가 NaN — 백분율이 NaN으로 나가는지",
    value: { "3학년 1반": { weekly: NaN, correct: 5, hold: 1 } }
  },
  {
    label: "weekly가 Infinity",
    value: { "4학년 2반": { weekly: Infinity, correct: 3, hold: 0 } }
  },
  {
    label: "값이 문자열·null·undefined로 뒤섞임",
    value: {
      "5학년 1반": { weekly: "72", correct: null, hold: undefined, contamination: "여섯" } as never,
      "5학년 2반": {}
    }
  },
  {
    label: "반 이름이 학년/반 꼴이 아님 — classParts가 기본값으로 접는다",
    value: { "": { weekly: 3, correct: 1 }, "이름없음": { weekly: 4, correct: 2 }, "12학년 34반": { weekly: 5, correct: 3 } }
  },
  {
    label: "correct는 없고 converted만 — fallback이 실제로 쓰이는지",
    value: { "6학년 1반": { weekly: 10, converted: 7, hold: 2 } }
  },
  {
    label: "음수",
    value: { "3학년 2반": { weekly: -5, correct: -3, hold: -1, contamination: -2 } }
  }
];

// 기록 한 줄. 대시보드 키 / class: 키 / landfill: 키 / 열로 온 것 / 아무것도 아닌 것.
const BASE_RECORD_SETS: { label: string; value: LegacyRecord[] }[] = [
  { label: "빈 목록", value: [] },
  {
    label: "대시보드 키",
    value: [
      { mapped_item: "schoolObserved", final_decision: "500" },
      { mapped_item: "schoolClasses", final_decision: "안 읽히는 값" },
      { mapped_item: "holdCount", final_decision: "0" },
      { mapped_item: "toString", final_decision: "7" },
      { mapped_item: "__proto__", final_decision: "7" },
      { mapped_item: "constructor", final_decision: "7" }
    ]
  },
  {
    label: "class: 키",
    value: [
      { mapped_item: "class:5학년 1반:weekly", final_decision: "300" },
      { mapped_item: "class:5학년 1반:contamination", final_decision: "-4" },
      { mapped_item: "class:없는반:weekly", final_decision: "300" },
      { mapped_item: "class:5학년 1반:없는지표", final_decision: "300" },
      { mapped_item: "class:5학년 1반:weekly", final_decision: "숫자아님" }
    ]
  },
  {
    label: "landfill: 키",
    value: [
      { mapped_item: "landfill:월", final_decision: "3.5" },
      { mapped_item: "landfill:", final_decision: "3.5" },
      { mapped_item: "landfill:화", final_decision: "숫자아님" }
    ]
  },
  {
    label: "열로 온 반 자료",
    value: [
      { class_name: "1반", grade: "3학년", totalScans: 40, correctScans: 30, holdCount: 5, recycleCount: 12, reuseCount: 3, contaminationCount: 2 },
      { class_name: "1반", totalScans: 40 },
      { class_name: "99반", grade: "3학년", totalScans: 40 },
      { class_name: "1반", grade: "3학년", totalScans: "40" },
      { class_name: "1반", grade: "3학년", totalScans: NaN },
      { class_name: "1반", grade: "3학년", totalScans: Infinity }
    ]
  },
  {
    label: "한 기록이 반 자료와 매립지에 동시에 걸린다",
    value: [{ class_name: "2반", grade: "4학년", totalScans: 12, landfillTons: 1.25, date: "2026-09-10", weekday: "목" }]
  },
  {
    label: "필드가 아예 없거나 null",
    value: [{}, { mapped_item: null, final_decision: null }, { mapped_item: undefined }, { landfillTons: 0 }, { landfillTons: null }]
  },
  {
    label: "자정 근처 날짜가 그대로 들어온다",
    value: [
      { landfillTons: 2, date: "2026-09-10T23:59:59", weekday: "" },
      { landfillTons: 2, timestamp: "2026-09-11T00:00:00.000Z" }
    ]
  }
];

const ACTUAL_RECORD_SETS: { label: string; value: LegacyRecord[] }[] = [
  { label: "빈 목록", value: [] },
  {
    label: "판정 문구별",
    value: [
      { class_name: "1반", grade: "5학년", final_decision: "재활용" },
      { class_name: "1반", grade: "5학년", final_decision: "재사용" },
      { class_name: "1반", grade: "5학년", final_decision: "일반쓰레기" },
      { class_name: "1반", grade: "5학년", final_decision: "오염되어 재활용 불가" },
      { class_name: "1반", grade: "5학년", final_decision: "보류" },
      { class_name: "1반", grade: "5학년", final_decision: "" },
      { class_name: "1반", grade: "5학년", suggested_category: "재활용" }
    ]
  },
  {
    label: "재사용과 오염이 한 문구에 같이 — 먼저 걸리는 가지가 이긴다",
    value: [{ class_name: "1반", grade: "5학년", final_decision: "재사용 가능하지만 오염됨" }]
  },
  {
    label: "hold_flag가 문구를 이긴다",
    value: [{ class_name: "1반", grade: "5학년", hold_flag: true, final_decision: "재활용" }]
  },
  {
    label: "반 이름이 없어 화면에서 고른 반으로 간다",
    value: [{ final_decision: "재활용" }, { class_name: "", final_decision: "보류" }]
  },
  {
    label: "기본 자료에 없는 반 — 새로 만들어진다",
    value: [{ class_name: "9반", grade: "1학년", final_decision: "재활용" }]
  },
  {
    label: "필드가 전부 빠진 기록",
    value: [{}, { final_decision: null }, { hold_flag: 0 }]
  }
];

// -----------------------------------------------------------------------
// 대조
// -----------------------------------------------------------------------

describe("baseDataFromRecords", () => {
  for (const { label, value } of BASE_RECORD_SETS) {
    it(label, () => {
      expectSame(ported.baseDataFromRecords(value), call("baseDataFromRecords", value), `baseDataFromRecords(${label})`);
    });
  }

  it("입력 기록을 고치지 않는다", () => {
    const records = BASE_RECORD_SETS[4]!.value;
    const before = JSON.stringify(records);
    ported.baseDataFromRecords(records);
    expect(JSON.stringify(records), "옮긴 것이 입력을 고쳤다").toBe(before);
  });
});

describe("mergeActualIntoClasses", () => {
  for (const classes of CLASS_MAPS) {
    for (const records of ACTUAL_RECORD_SETS) {
      it(`${classes.label} + ${records.label}`, () => {
        // 🔴 양쪽에 **각자의 복사본**을 준다. 같은 객체를 주면 앞쪽 호출이 고친
        // 값을 뒤쪽이 받아 "같다"가 나올 수 있다.
        const mine = ported.mergeActualIntoClasses(structuredCloneish(classes.value), records.value, FALLBACK_CLASS);
        const theirs = call("mergeActualIntoClasses", structuredCloneish(classes.value), records.value);
        expectSame(mine, theirs, `mergeActualIntoClasses(${classes.label}, ${records.label})`);
      });
    }
  }

  it("입력 반 자료를 고치지 않는다", () => {
    const classes = cloneBaseClasses();
    const before = JSON.stringify(classes);
    ported.mergeActualIntoClasses(classes, ACTUAL_RECORD_SETS[1]!.value, FALLBACK_CLASS);
    expect(JSON.stringify(classes), "옮긴 것이 입력을 고쳤다").toBe(before);
  });
});

describe("calculateClassScore", () => {
  it("반 자료 전부", () => {
    let checked = 0;
    for (const { label, value } of CLASS_MAPS) {
      for (const [name, row] of Object.entries(value)) {
        expectSame(ported.calculateClassScore(row), call("calculateClassScore", row), `calculateClassScore(${label}/${name})`);
        checked += 1;
      }
    }
    // 걸러낸 것이 0개면 위 단언이 통째로 사라진다(§21).
    expect(checked, "잰 반이 너무 적다").toBeGreaterThan(15);
  });
});

describe("buildClassRanking", () => {
  for (const { label, value } of CLASS_MAPS) {
    it(label, () => {
      expectSame(ported.buildClassRanking(value), call("buildClassRanking", value), `buildClassRanking(${label})`);
    });
  }

  it("점수가 같을 때 이름 순서까지 같다", () => {
    // 정렬의 마지막 기준(localeCompare "ko")이 실제로 쓰이는 자료를 일부러 만든다.
    const tie: LooseClassMap = {
      "3학년 3반": { weekly: 10, correct: 5 },
      "3학년 1반": { weekly: 10, correct: 5 },
      "3학년 2반": { weekly: 10, correct: 5 }
    };
    const mine = ported.buildClassRanking(tie);
    expect(mine.map((r) => r.name), "동점인데 순서가 안 정해졌다").toEqual(["3학년 1반", "3학년 2반", "3학년 3반"]);
    expectSame(mine, call("buildClassRanking", tie), "buildClassRanking(동점)");
  });
});

describe("getCurrentClassRank", () => {
  const NAMES: unknown[] = [
    "5학년 1반", "3학년 1반", "없는 반", "", null, undefined, 0, "12학년 34반", { name: "5학년 1반" }
  ];
  for (const { label, value } of CLASS_MAPS) {
    it(label, () => {
      const ranking = ported.buildClassRanking(value);
      const legacyRanking = call("buildClassRanking", value);
      for (const name of NAMES) {
        expectSame(
          ported.getCurrentClassRank(ranking, name),
          call("getCurrentClassRank", legacyRanking, name),
          `getCurrentClassRank(${label}, ${String(name)})`
        );
      }
    });
  }

  it("빈 순위표에서도 같은 값을 낸다", () => {
    expectSame(ported.getCurrentClassRank([], "5학년 1반"), call("getCurrentClassRank", [], "5학년 1반"), "getCurrentClassRank(빈 목록)");
  });
});

describe("gradeSummaries", () => {
  for (const { label, value } of CLASS_MAPS) {
    it(label, () => {
      expectSame(ported.gradeSummaries(value), call("gradeSummaries", value), `gradeSummaries(${label})`);
    });
  }
});

describe("aggregateSchoolDashboard — 0으로 나누는 자리", () => {
  const GRADES = ["5학년", "3학년", "없는학년", "", "1학년"];
  for (const { label, value } of CLASS_MAPS) {
    for (const grade of GRADES) {
      it(`${label} / ${grade || "(빈 학년)"}`, () => {
        expectSame(
          ported.aggregateSchoolDashboard(value, grade),
          call("aggregateSchoolDashboard", value, grade),
          `aggregateSchoolDashboard(${label}, ${grade})`
        );
      });
    }
  }

  // 🔴 나눗셈 결과가 실제로 무엇인지 눈으로 못박는다. 위 대조는 "양쪽이 같다"만
  // 말하므로, 둘 다 엉뚱한 값이어도 통과한다. 여기서는 **값 자체**를 적는다.
  it("observed가 0이면 0%다(NaN도 Infinity도 아니다)", () => {
    const zero = ported.aggregateSchoolDashboard(CLASS_MAPS[2]!.value, "3학년");
    expect(Object.is(zero.successPct, 0), `successPct=${String(zero.successPct)}`).toBe(true);
    expect(Object.is(zero.holdPct, 0), `holdPct=${String(zero.holdPct)}`).toBe(true);
  });

  // 🔴 처음에 "NaN이 그대로 나갈 것"이라고 적었다가 여기서 틀렸다. `toNumber`가
  // NaN·Infinity를 fallback으로 걸러내므로 `observed`는 **절대 NaN이 아니다.**
  // 나눗셈 자체는 안전하다. 대신 아래 것이 실제로 나온다.
  it("weekly가 NaN·Infinity여도 백분율은 NaN이 아니다 — toNumber가 먼저 거른다", () => {
    for (const [index, grade] of [[3, "3학년"], [4, "4학년"]] as const) {
      const got = ported.aggregateSchoolDashboard(CLASS_MAPS[index]!.value, grade);
      expect(Number.isFinite(got.successPct), `successPct=${String(got.successPct)}`).toBe(true);
      expect(Number.isFinite(got.holdPct), `holdPct=${String(got.holdPct)}`).toBe(true);
      expect(Object.is(got.observed, 0), `observed=${String(got.observed)}`).toBe(true);
    }
  });

  // 🔴 **실제로 나오는 값은 500%다.** `Math.max(1, observed)`는 0으로 나누는 것만
  // 막지, "분모가 1로 바뀐" 것을 알려주지 않는다. 그래서 참여 수가 0인데 맞춘
  // 수가 5인 반이 있으면 화면에 **성공률 500%**가 찍힌다.
  //
  // 자료가 `class:...:correct`만 넣고 `weekly`/`today`를 안 넣으면 실제로 그
  // 상태가 된다. 원본에 있던 성질이라 **전환 중에는 고치지 않는다** - 고치면
  // "달라진 데가 없다"는 이번 전환의 판정 기준이 깨진다. 별건으로 남긴다.
  it("참여 수가 0인데 맞춘 수가 있으면 백분율이 100%를 넘는다 (원본 성질, 전환 중 고치지 않음)", () => {
    const got = ported.aggregateSchoolDashboard({ "3학년 1반": { correct: 5, hold: 1 } }, "3학년");
    expect(got.successPct, "500%가 아니면 계산이 달라진 것이다").toBe(500);
    expect(got.holdPct).toBe(100);
    // 원본도 같은 값을 내는지 함께 못박는다 - 옮기다 생긴 것이 아니라는 증거다.
    expectSame(got, call("aggregateSchoolDashboard", { "3학년 1반": { correct: 5, hold: 1 } }, "3학년"), "500% 사례");
  });

  it("빈 자료면 BASE_DASHBOARD 숫자로 채워지고 today가 아예 없다", () => {
    const empty = ported.aggregateSchoolDashboard({}, "5학년");
    expect(empty.observed).toBe(BASE_DASHBOARD.schoolObserved);
    expect(empty.classCount).toBe(BASE_DASHBOARD.schoolClasses);
    expect("today" in empty, "원본 fallback에는 today가 없다").toBe(false);
  });
});

// 얕은 복사로는 부족하고(반 객체를 그 자리에서 고친다) structuredClone은 함수가
// 든 값에서 죽는다. 여기 자료는 순수 값뿐이라 두 단계 복사로 충분하다.
function structuredCloneish(map: LooseClassMap): LooseClassMap {
  return Object.fromEntries(Object.entries(map).map(([name, row]) => [name, { ...row }]));
}
