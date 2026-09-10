// 매립지 그래프의 좌표 계산과 날짜 라벨 (S3 넷째 묶음 — ④차트 계산).
//
// 원본 `app.js`에 있던 것을 타입만 붙여 옮겼다. **동작은 한 군데도 바꾸지 않았다.**
// `linePathFor`/`smoothPathFor`/`tickLabel`은 원본에서 `renderLandfillChart` 안에
// 중첩돼 있지만 DOM을 안 쓰는 순수 계산이라 여기로 꺼냈다 — 계산식은 그대로다.
//
// 🔴 눈에 띄지만 **일부러 그대로 둔 것들**(고치면 화면 그래프가 달라진다):
//
//   - `getRecentSevenDaysLabels`는 **보는 사람의 시간대**로 오늘을 정한다. 서버
//     날짜가 아니다. 자정을 넘기면 라벨 일곱 개가 통째로 하루 밀린다.
//
//   - 🔴 `landfillDaysForChart`는 기본 자료와 실제 자료를 **한 Map에 섞는다.**
//     실제 자료가 6일치뿐이면 합쳐서 13개가 되고 `slice(-7)`이 뒤 7개를 가져가므로
//     **7월 기본값 한 칸이 최근 날짜 라벨을 달고 화면에 나간다.** 6일치가 버려지는
//     것이 아니라, 없는 하루가 옛 숫자로 메워지는 것이다.
//
//   - 위 때문에 `values.length === 7 ? values : fallbackValues`의 **오른쪽 가지는
//     닿을 수 없다.** 기본 자료가 늘 7개의 서로 다른 키를 넣으므로 Map은 항상
//     7개 이상이고 `slice(-7)`은 항상 정확히 7개를 준다. 지우고 싶어지는 자리지만
//     원본 그대로 둔다.
//
//   - 같은 날짜가 여러 번 들어오면 **마지막 것이 이긴다**(Map에 덮어쓴다).
//
//   - `yForChart`는 `max <= min`이면 바닥선을 돌려준다. 0으로 나누지 않는다.
//
//   - `smoothPathFor`는 제어점만 반올림하고 **끝점 x는 반올림하지 않는다**.
//     원본이 그렇다(`point.x`는 이미 `renderLandfillChart`에서 반올림돼 들어온다).

export interface LandfillDay {
  date?: unknown;
  weekday?: unknown;
  landfillTons?: unknown;
}

export interface DayLabel {
  date: string;
  displayDate: string;
  weekday: string;
}

export interface ChartDay extends DayLabel {
  landfillTons: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  [key: string]: unknown;
}

// 기본 매립지 자료. 실제 값이 일곱 개 모이지 않으면 이것이 화면에 나간다.
// 🔴 숫자를 바꾸지 않는다 — `chart.parity.test.ts`가 `app.js` 원문과 대조한다.
export const BASE_LANDFILL_DAYS: LandfillDay[] = [
  { date: "2026-07-01", weekday: "월", landfillTons: 22800 },
  { date: "2026-07-02", weekday: "화", landfillTons: 18900 },
  { date: "2026-07-03", weekday: "수", landfillTons: 20600 },
  { date: "2026-07-04", weekday: "목", landfillTons: 17200 },
  { date: "2026-07-05", weekday: "금", landfillTons: 21900 },
  { date: "2026-07-06", weekday: "토", landfillTons: 18100 },
  { date: "2026-07-07", weekday: "일", landfillTons: 16400 }
];

/** 두 자리로 채운다. `padDatePart(9)` → `"09"`. */
export function padDatePart(value: unknown): string {
  return String(value).padStart(2, "0");
}

/**
 * 오늘까지 최근 7일의 날짜·요일 라벨.
 * 🔴 **로컬 시간대 기준**이고, 인자를 안 주면 실행하는 순간의 오늘이다.
 */
export function getRecentSevenDaysLabels(referenceDate: Date = new Date()): DayLabel[] {
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
      weekday: weekdays[date.getDay()]!
    };
  });
}

/** 매립지 패널에 찍히는 시각. `26.09.10(목) 15:04:05` 꼴. */
export function formatNowCompact(now: Date = new Date()): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const yy = padDatePart(now.getFullYear() % 100);
  const mm = padDatePart(now.getMonth() + 1);
  const dd = padDatePart(now.getDate());
  const hh = padDatePart(now.getHours());
  const mi = padDatePart(now.getMinutes());
  const ss = padDatePart(now.getSeconds());
  return `${yy}.${mm}.${dd}(${weekdays[now.getDay()]}) ${hh}:${mi}:${ss}`;
}

/**
 * 그래프에 그릴 7일치를 고른다.
 *
 * 🔴 **정확히 7개가 아니면 전부 버리고 기본 자료를 쓴다.** 실제 자료가 6일치만
 * 있으면 화면에는 그 6일이 안 나오고 7월 기본값이 나온다 — 원본 동작이다.
 */
export function landfillDaysForChart(days: LandfillDay[]): ChartDay[] {
  const byDate = new Map<unknown, LandfillDay>();
  [...BASE_LANDFILL_DAYS, ...days].forEach((item) => {
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
      ? (chartValues[index]!.landfillTons as number)
      : 0
  }));
}

/**
 * 값 하나를 세로 좌표로. 범위를 벗어나면 잘라 넣는다.
 * 🔴 `max <= min`이면 바닥선을 돌려준다 — 0으로 나누지 않는다.
 */
export function yForChart(value: number, min: number, max: number, top: number, baseline: number): number {
  if (max <= min) return baseline;
  const clamped = Math.min(max, Math.max(min, value));
  return top + ((max - clamped) / (max - min)) * (baseline - top);
}

/** 꺾은선 경로. 빈 목록은 빈 문자열이다. */
export function linePathFor(items: ChartPoint[]): string {
  if (!items.length) return "";
  return items
    .map((point, index) => `${index ? "L" : "M"}${point.x} ${Math.round(point.y)}`)
    .join(" ");
}

/** 곡선 경로(카트멀-롬 꼴). 점이 둘 미만이면 꺾은선과 같다. */
export function smoothPathFor(items: ChartPoint[]): string {
  if (items.length < 2) return linePathFor(items);
  return items.reduce((path, point, index) => {
    if (index === 0) return `M${point.x} ${Math.round(point.y)}`;
    const previous = items[index - 1]!;
    const beforePrevious = items[index - 2] || previous;
    const next = items[index + 1] || point;
    const cp1x = previous.x + (point.x - beforePrevious.x) / 6;
    const cp1y = previous.y + (point.y - beforePrevious.y) / 6;
    const cp2x = point.x - (next.x - previous.x) / 6;
    const cp2y = point.y - (next.y - previous.y) / 6;
    return `${path} C${Math.round(cp1x)} ${Math.round(cp1y)} ${Math.round(cp2x)} ${Math.round(cp2y)} ${point.x} ${Math.round(point.y)}`;
  }, "");
}

/** 세로축 눈금 글자. 1000 이상은 K로 줄인다. */
export function tickLabel(tick: number): string {
  return tick >= 1000 ? `${Math.round(tick / 1000)}K` : String(tick);
}
