// 옮긴 차트 계산이 **원본과 같은 좌표·글자를 내는가** (S3 넷째 묶음 대조).
//
// 🔴 원본 함수를 `app.js`에서 그때그때 떼어 와 **실제로 실행**해 비교한다(§21-7).
//
// 🔴 **시각을 고정하고 돌린다.** 이 묶음은 `new Date()`를 부르므로, 시각을 안
// 세우면 자정 근처에서 양쪽이 다른 "오늘"을 잡아 **가끔 깨지는 검사**가 된다.
// 흔들리는 검사는 증명 수단이 못 된다. `vi.setSystemTime`으로 못박고, 자정
// 직전/직후·월말·연말·윤년을 일부러 지나간다.
//
// 🔴 **좌표는 `Object.is`로 본다.** 나눗셈이 들어 있어 `-0`이 나올 수 있는데
// `toEqual`은 `0`과 `-0`을 잘 못 가른다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractConst, legacySource, loadLegacy, loadLegacyConsts } from "../../scripts/extractLegacyFns.mjs";
import * as ported from "./chart";
import type { ChartPoint, LandfillDay } from "./chart";

const source = legacySource();
const LEGACY_NAMES = [
  "padDatePart", "getRecentSevenDaysLabels", "formatNowCompact",
  "landfillDaysForChart", "yForChart", "linePathFor", "smoothPathFor", "tickLabel"
];

const legacy = loadLegacy(LEGACY_NAMES, `
  const BASE_LANDFILL_DAYS = ${extractConst(source, "BASE_LANDFILL_DAYS")};
`);
const legacyConsts = loadLegacyConsts(["BASE_LANDFILL_DAYS"]);

const call = (name: string, ...args: unknown[]): unknown =>
  (legacy[name] as (...a: unknown[]) => unknown)(...args);

afterEach(() => vi.useRealTimers());

it("원본 함수를 실제로 떼어 왔다", () => {
  expect(Object.keys(legacy).sort()).toEqual([...LEGACY_NAMES].sort());
  for (const name of LEGACY_NAMES) expect(typeof legacy[name], name).toBe("function");
});

// -0 까지 가리는 깊은 비교(aggregate.parity.test.ts와 같은 이유).
function diffPath(a: unknown, b: unknown, path = ""): string | null {
  if (typeof a === "number" || typeof b === "number") {
    return Object.is(a, b) ? null : `${path || "(값)"}: 옮긴 것=${String(a)} / 원본=${String(b)}`;
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return Object.is(a, b) ? null : `${path || "(값)"}: 옮긴 것=${JSON.stringify(a)} / 원본=${JSON.stringify(b)}`;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  const missing = keysB.filter((k) => !keysA.includes(k));
  const extra = keysA.filter((k) => !keysB.includes(k));
  if (missing.length) return `${path}: 옮긴 것에 없는 키 [${missing.join(", ")}]`;
  if (extra.length) return `${path}: 옮긴 것에만 있는 키 [${extra.join(", ")}]`;
  for (const key of keysB) {
    const found = diffPath((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
    if (found) return found;
  }
  return null;
}

function expectSame(mine: unknown, theirs: unknown, label: string): void {
  const diff = diffPath(mine, theirs);
  expect(diff === null ? "같음" : `${label} — ${diff}`).toBe("같음");
}

it("비교기가 0과 -0을 갈라낸다", () => {
  expect(diffPath(0, -0)).not.toBeNull();
  expect(diffPath({ y: -0 }, { y: 0 })).not.toBeNull();
});

// -----------------------------------------------------------------------
// 자료
// -----------------------------------------------------------------------

it("BASE_LANDFILL_DAYS가 원본과 같다", () => {
  const original = legacyConsts.BASE_LANDFILL_DAYS as unknown[];
  expect(original.length, "원본 일수").toBe(7);
  expectSame(ported.BASE_LANDFILL_DAYS, original, "BASE_LANDFILL_DAYS");
});

// -----------------------------------------------------------------------
// 시각에 걸린 것들
// -----------------------------------------------------------------------

// 🔴 자정 직전/직후를 반드시 넣는다 - 다른 저장소에서 시간대 처리로 실제 사고가
// 났다. 월말·연말·윤년(2028-02-29)까지 지나간다.
const MOMENTS = [
  "2026-09-10T15:04:05",
  "2026-09-10T23:59:59",
  "2026-09-11T00:00:00",
  "2026-09-11T00:00:01",
  "2026-10-01T00:00:00", // 월이 넘어가는 자리
  "2026-01-01T00:00:00", // 해가 넘어가는 자리(7일 중 앞쪽이 작년)
  "2026-03-01T00:30:00",
  "2028-03-01T00:00:00", // 윤년 다음날
  "2026-12-31T23:59:59"
];

describe("getRecentSevenDaysLabels — 시각을 고정하고", () => {
  for (const moment of MOMENTS) {
    it(moment, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(moment));
      expectSame(ported.getRecentSevenDaysLabels(), call("getRecentSevenDaysLabels"), `getRecentSevenDaysLabels@${moment}`);
      // 인자를 직접 준 경우도 본다.
      const given = new Date(moment);
      expectSame(ported.getRecentSevenDaysLabels(given), call("getRecentSevenDaysLabels", given), `인자@${moment}`);
    });
  }

  it("연말에는 앞쪽 날짜가 작년이다 — 7일이 한 해를 걸친다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-03T10:00:00"));
    const labels = ported.getRecentSevenDaysLabels();
    expect(labels.length).toBe(7);
    expect(labels[0]!.date, "6일 전").toBe("2025-12-28");
    expect(labels[6]!.date, "오늘").toBe("2026-01-03");
    expectSame(labels, call("getRecentSevenDaysLabels"), "연말 경계");
  });
});

describe("formatNowCompact — 시각을 고정하고", () => {
  for (const moment of MOMENTS) {
    it(moment, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(moment));
      expectSame(ported.formatNowCompact(), call("formatNowCompact"), `formatNowCompact@${moment}`);
    });
  }

  it("한 자리 값이 두 자리로 채워진다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T03:04:05"));
    expect(ported.formatNowCompact()).toBe("26.01.02(금) 03:04:05");
  });
});

describe("padDatePart", () => {
  it("깨진 입력 포함", () => {
    const inputs: unknown[] = [0, 1, 9, 10, 100, -1, "", "7", "77", null, undefined, NaN, true, [], {}, 1.5];
    for (const input of inputs) {
      expectSame(ported.padDatePart(input), call("padDatePart", input), `padDatePart(${String(input)})`);
    }
    expect(inputs.length).toBeGreaterThan(12);
  });
});

// -----------------------------------------------------------------------
// landfillDaysForChart
// -----------------------------------------------------------------------

const DAY_SETS: { label: string; value: LandfillDay[] }[] = [
  { label: "빈 목록 — 기본 자료가 나간다", value: [] },
  {
    label: "정확히 7일치 실제 자료",
    value: Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-0${i + 1}`, weekday: "월", landfillTons: 1000 * (i + 1) }))
  },
  {
    label: "🔴 6일치만 — 기본 자료 한 칸이 섞여 들어온다",
    value: Array.from({ length: 6 }, (_, i) => ({ date: `2026-09-0${i + 1}`, weekday: "월", landfillTons: 1000 * (i + 1) }))
  },
  {
    label: "8일치 — 뒤 7개만 남는다",
    value: Array.from({ length: 8 }, (_, i) => ({ date: `2026-09-1${i}`, weekday: "화", landfillTons: 500 * (i + 1) }))
  },
  {
    label: "같은 날짜가 두 번 — 마지막이 이긴다",
    value: [{ date: "2026-09-01", weekday: "월", landfillTons: 1 }, { date: "2026-09-01", weekday: "월", landfillTons: 2 }]
  },
  {
    label: "날짜가 없고 요일만 있다 — 기본 자료를 덮어쓴다",
    value: [{ weekday: "월", landfillTons: 111 }, { weekday: "화", landfillTons: 222 }]
  },
  {
    label: "landfillTons가 숫자가 아니다 — 버려진다",
    value: [{ date: "2026-09-01", landfillTons: "1000" }, { date: "2026-09-02", landfillTons: NaN }, { date: "2026-09-03", landfillTons: Infinity }, { date: "2026-09-04", landfillTons: null }]
  },
  {
    label: "키가 아예 없다",
    value: [{ landfillTons: 1000 }, {}, { date: "", weekday: "", landfillTons: 5 }]
  },
  {
    label: "landfillTons가 0 — 숫자이므로 남는다",
    value: [{ date: "2026-09-01", weekday: "월", landfillTons: 0 }]
  },
  {
    label: "음수",
    value: [{ date: "2026-09-01", weekday: "월", landfillTons: -500 }]
  }
];

describe("landfillDaysForChart", () => {
  for (const { label, value } of DAY_SETS) {
    it(label, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-10T15:04:05"));
      expectSame(ported.landfillDaysForChart(value), call("landfillDaysForChart", value), `landfillDaysForChart(${label})`);
    });
  }

  it("자정을 넘기면 라벨이 하루 밀린다 — 양쪽 다 같이 밀린다", () => {
    for (const moment of ["2026-09-10T23:59:59", "2026-09-11T00:00:01"]) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(moment));
      expectSame(ported.landfillDaysForChart([]), call("landfillDaysForChart", []), `자정@${moment}`);
    }
  });

  // 🔴 처음에 "7개가 안 되면 전부 버리고 기본값을 쓴다"고 적었다가 여기서 틀렸다.
  // 실제로는 기본 자료 7일과 실제 자료가 **한 Map에 섞인다.** 6일치를 넣으면
  // 합쳐서 13개가 되고 `slice(-7)`이 뒤 7개를 가져가므로, **7월 기본값 한 칸이
  // 실제 자료 여섯 개와 함께 화면에 나간다** - 그것도 "최근 7일" 라벨을 달고.
  it("🔴 6일치만 있으면 7월 기본값 한 칸이 최근 날짜 라벨을 달고 섞인다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:04:05"));
    const got = ported.landfillDaysForChart(DAY_SETS[2]!.value);
    // 맨 앞 16400은 2026-07-07 기본값인데, 라벨은 9월 4일이 붙는다.
    expect(got.map((d) => d.landfillTons)).toEqual([16400, 1000, 2000, 3000, 4000, 5000, 6000]);
    expect(got[0]!.date, "7월 값에 9월 라벨이 붙는다").toBe("2026-09-04");
    expectSame(got, call("landfillDaysForChart", DAY_SETS[2]!.value), "6일치");
  });

  // 🔴 `values.length === 7 ? values : fallbackValues`의 오른쪽 가지는 **닿을 수
  // 없다.** 기본 자료가 늘 7개의 서로 다른 키를 넣으므로 Map은 항상 7개 이상이고,
  // `slice(-7)`은 항상 정확히 7개를 준다. 그 사실을 못박아 둔다 - 나중에 기본
  // 자료를 줄이면 이 검사가 먼저 깨져서 알려준다.
  it("기본 자료가 7일이라 fallback 가지에는 닿지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:04:05"));
    expect(ported.BASE_LANDFILL_DAYS.length, "기본 자료가 7일이 아니면 위 전제가 깨진다").toBe(7);
    for (const { label, value } of DAY_SETS) {
      expect(ported.landfillDaysForChart(value).length, `${label}: 항상 7칸`).toBe(7);
    }
  });

  it("입력을 고치지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:04:05"));
    const days = DAY_SETS[1]!.value;
    const before = JSON.stringify(days);
    ported.landfillDaysForChart(days);
    expect(JSON.stringify(days)).toBe(before);
    // 기본 자료도 오염되면 안 된다 - 두 번째 계산부터 값이 달라진다.
    expect(ported.BASE_LANDFILL_DAYS[0]!.landfillTons).toBe(22800);
  });
});

// -----------------------------------------------------------------------
// 좌표
// -----------------------------------------------------------------------

describe("yForChart", () => {
  it("정상·경계·거꾸로 된 범위", () => {
    const cases: [number, number, number, number, number][] = [
      [19000, 15000, 23000, 4, 220],
      [15000, 15000, 23000, 4, 220],   // 최소
      [23000, 15000, 23000, 4, 220],   // 최대
      [0, 15000, 23000, 4, 220],       // 아래로 벗어남
      [99999, 15000, 23000, 4, 220],   // 위로 벗어남
      [19000, 23000, 15000, 4, 220],   // 🔴 max < min - 바닥선
      [19000, 15000, 15000, 4, 220],   // 🔴 max === min - 바닥선
      [19000, 15000, 23000, 220, 4],   // top과 baseline이 뒤집힌 경우
      [NaN, 15000, 23000, 4, 220],
      [Infinity, 15000, 23000, 4, 220],
      [-Infinity, 15000, 23000, 4, 220],
      [19000, NaN, 23000, 4, 220],
      [19000, 15000, NaN, 4, 220],
      [0, 0, 0, 0, 0]
    ];
    for (const args of cases) {
      expectSame(ported.yForChart(...args), call("yForChart", ...args), `yForChart(${args.join(", ")})`);
    }
    expect(cases.length).toBeGreaterThan(12);
  });
});

const POINT_SETS: { label: string; value: ChartPoint[] }[] = [
  { label: "빈 목록", value: [] },
  { label: "점 하나", value: [{ x: 40, y: 100.4 }] },
  { label: "점 둘", value: [{ x: 40, y: 100.4 }, { x: 105, y: 55.6 }] },
  {
    label: "일곱 점 — 실제 그래프와 같은 모양",
    value: [40, 105, 171, 237, 303, 369, 435].map((x, i) => ({ x, y: 220 - i * 17.3 }))
  },
  { label: "y가 소수 .5 — 반올림 방향", value: [{ x: 0, y: 0.5 }, { x: 10, y: 1.5 }, { x: 20, y: -0.5 }, { x: 30, y: -1.5 }] },
  { label: "x가 소수 — 끝점 x는 반올림하지 않는다", value: [{ x: 0.4, y: 10 }, { x: 10.6, y: 20 }, { x: 20.5, y: 30 }] },
  { label: "전부 같은 점", value: [{ x: 40, y: 100 }, { x: 40, y: 100 }, { x: 40, y: 100 }] },
  { label: "y가 NaN", value: [{ x: 0, y: NaN }, { x: 10, y: 20 }] },
  { label: "y가 Infinity", value: [{ x: 0, y: Infinity }, { x: 10, y: 20 }] },
  { label: "음수 좌표", value: [{ x: -10, y: -20 }, { x: -5, y: -40 }, { x: 0, y: -60 }] }
];

describe("linePathFor / smoothPathFor", () => {
  for (const { label, value } of POINT_SETS) {
    it(label, () => {
      expectSame(ported.linePathFor(value), call("linePathFor", value), `linePathFor(${label})`);
      expectSame(ported.smoothPathFor(value), call("smoothPathFor", value), `smoothPathFor(${label})`);
    });
  }

  it("점이 둘 미만이면 곡선이 꺾은선과 같다", () => {
    expect(ported.smoothPathFor([])).toBe(ported.linePathFor([]));
    const one: ChartPoint[] = [{ x: 40, y: 100.4 }];
    expect(ported.smoothPathFor(one)).toBe(ported.linePathFor(one));
  });

  it("빈 목록은 빈 경로다 — 'M undefined'가 나가지 않는다", () => {
    expect(ported.linePathFor([])).toBe("");
    expect(ported.smoothPathFor([])).toBe("");
  });
});

describe("tickLabel", () => {
  it("K로 줄이는 경계", () => {
    const ticks = [0, 1, 999, 1000, 1001, 1500, 1499, 2000, 15000, 23000, -1000, NaN, Infinity, 0.5];
    for (const tick of ticks) {
      expectSame(ported.tickLabel(tick), call("tickLabel", tick), `tickLabel(${String(tick)})`);
    }
    // 값 자체를 못박는다 - 세로축 글자가 바뀌면 화면이 달라진다.
    expect(ported.tickLabel(999)).toBe("999");
    expect(ported.tickLabel(1000)).toBe("1K");
    expect(ported.tickLabel(15000)).toBe("15K");
    expect(ported.tickLabel(1500)).toBe("2K");
  });
});
