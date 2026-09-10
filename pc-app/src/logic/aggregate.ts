// 기록을 반별·학년별 숫자로 접는 것들 (S3 둘째 묶음 — ②집계).
//
// 원본 `app.js`에 있던 것을 타입만 붙여 옮겼다. **동작은 한 군데도 바꾸지
// 않았다.** 이번 전환의 성공 기준은 "달라진 데가 없다"이므로, 여기서 조금이라도
// 손보면 화면 숫자가 달라졌을 때 전환 탓인지 손질 탓인지 못 가린다.
//
// 🔴 눈에 띄지만 **일부러 그대로 둔 것들**(고치면 원본과 달라진다):
//
//   - `setClassMetric`은 **없는 반을 만들지 않는다.** `if (!classes[className])
//     return;` 바로 다음 줄의 `classes[className] || {...}`는 그래서 절대 안 쓰이는
//     가지다. 지우고 싶어지는 자리지만, 지우면 "이름이 비슷한 반이 조용히
//     생기는가"라는 질문의 답이 달라 보인다. 그대로 둔다.
//
//   - `aggregateSchoolDashboard`는 `Math.max(1, observed)`로 **0으로 나누는 것만**
//     막는다. 분모가 0에서 1로 바뀐 사실은 아무 데도 안 남으므로, 참여 수가 0인데
//     맞춘 수가 5인 반이 있으면 화면에 **성공률 500%**가 찍힌다. `class:...:correct`만
//     넣고 `weekly`를 안 넣은 자료에서 실제로 그렇게 된다.
//     (`NaN`/`Infinity`는 여기까지 오지 않는다 — `toNumber`가 먼저 fallback으로
//     걸러내므로 `observed`는 항상 유한하다.)
//
//   - `getCurrentClassRank`는 찾는 반이 목록에 없으면 **1위인 반의 등수**를
//     돌려준다(`ranking.find(...) || ranking[0]`). 학년 등수 쪽은 `findIndex`가
//     -1이라 `Math.max(1, 0)` = 1위가 된다. **"못 찾음"이 "1위"로 보인다.**
//
//   - `buildClassRanking`은 `scans > 0`인 반만 남긴다. 아직 아무도 안 찍은 반은
//     순위표에서 아예 빠진다(0위가 아니라 없음).
import { DATA_CONFIG } from "./config";
import { cleanText, classParts, normalizeFullClassName, toNumber } from "./normalize";
import { BASE_DASHBOARD, cloneBaseClasses, type ClassRow } from "./baseData";

/** 기록 한 줄. 어디서 왔든 필드가 빠지거나 타입이 뒤섞일 수 있다. */
export type LegacyRecord = Record<string, unknown>;

/** 집계가 읽는 반 자료. 필드가 없을 수 있어 원본도 전부 fallback을 둔다. */
export type LooseRow = Partial<ClassRow>;
export type LooseClassMap = Record<string, LooseRow>;

type MetricField = keyof ClassRow;

/**
 * 반 하나의 지표 한 칸을 채운다.
 *
 * 🔴 **없는 반은 만들지 않는다.** 숫자가 아닌 값도 넣지 않는다. 이 둘 때문에
 * 오타난 반 이름의 기록은 조용히 버려진다 — 원본 동작이다.
 */
export function setClassMetric(
  classes: LooseClassMap,
  className: unknown,
  field: MetricField,
  value: unknown
): void {
  if (!className || !Number.isFinite(value)) return;
  const key = className as string;
  if (!classes[key]) return;
  // 원본 그대로 둔다 - 바로 위에서 걸렀으므로 `||` 오른쪽은 절대 안 쓰인다.
  classes[key] = classes[key] || { today: 0, weekly: 0, hold: 0, converted: 0, correct: 0, recycle: 0, reuse: 0, contamination: 0 };
  (classes[key] as Record<string, unknown>)[field] = value;
}

export interface LandfillDay {
  date: unknown;
  weekday: unknown;
  landfillTons: unknown;
}

export interface BaseData {
  dashboard: Record<string, number>;
  classes: LooseClassMap;
  landfillDays: LandfillDay[];
}

/**
 * 기본 기록(`input_type === "base"`)을 대시보드 숫자·반 자료·매립지 일자로 접는다.
 *
 * 🔴 한 기록이 **여러 곳에 동시에 반영될 수 있다.** 반 지표를 채운 기록이
 * `landfillTons`도 갖고 있으면 매립지 일자에도 들어간다(그 가지에는 `return`이
 * 없다). 대시보드 키와 `landfill:` 키만 그 자리에서 끝난다.
 */
export function baseDataFromRecords(baseRecords: LegacyRecord[]): BaseData {
  const dashboard: Record<string, number> = { ...BASE_DASHBOARD };
  const classes: LooseClassMap = cloneBaseClasses();
  const landfillDays: LandfillDay[] = [];

  baseRecords.forEach((record) => {
    const key = cleanText(record.mapped_item || record.ai_raw_label);
    const valueText = cleanText(record.final_decision || record.suggested_category);
    const value = toNumber(valueText, NaN);

    if (Object.prototype.hasOwnProperty.call(dashboard, key) && Number.isFinite(value)) {
      dashboard[key] = value;
      return;
    }

    const classFromColumns = record.class_name
      ? normalizeFullClassName(record.grade || DATA_CONFIG.currentGrade, record.class_name)
      : "";
    if (classFromColumns && Number.isFinite(record.totalScans)) {
      setClassMetric(classes, classFromColumns, "weekly", record.totalScans);
      setClassMetric(classes, classFromColumns, "correct", record.correctScans);
      setClassMetric(classes, classFromColumns, "hold", record.holdCount);
      setClassMetric(classes, classFromColumns, "converted", record.recycleCount);
      setClassMetric(classes, classFromColumns, "recycle", record.recycleCount);
      setClassMetric(classes, classFromColumns, "reuse", record.reuseCount);
      setClassMetric(classes, classFromColumns, "contamination", record.contaminationCount);
    }

    if (Number.isFinite(record.landfillTons)) {
      landfillDays.push({
        date: record.date || record.timestamp || "",
        weekday: record.weekday || "",
        landfillTons: record.landfillTons
      });
    }

    const landfillMatch = key.match(/^landfill:(.+)$/);
    if (landfillMatch && Number.isFinite(value)) {
      landfillDays.push({ date: "", weekday: landfillMatch[1], landfillTons: value });
      return;
    }

    const classMatch = key.match(/^class:(.+):(today|weekly|hold|converted|correct|recycle|reuse|contamination)$/);
    if (!classMatch || !Number.isFinite(value)) return;

    const [, className, field] = classMatch;
    // 정규식이 여덟 이름만 잡으므로 field는 반드시 MetricField다.
    setClassMetric(classes, className, field as MetricField, value);
  });

  return { dashboard, classes, landfillDays };
}

/**
 * 실제 기록(사진·검색)을 반 자료에 더한다.
 *
 * 🔴 원본은 반 이름이 없는 기록을 **화면에서 고른 반**(`selectedClassName()`)으로
 * 돌린다. 그 함수는 `#classSelect`를 읽는 DOM 코드라 여기로 옮길 수 없어,
 * **그 값을 인자로 받는다.** 부르는 쪽이 원본과 같은 값을 넘겨야 한다.
 *
 * 🔴 입력 `classes`는 **고치지 않는다**(얕은 복사부터 하고 시작한다). 원본도
 * 그렇고, 이게 깨지면 같은 자료로 두 번 계산했을 때 값이 달라진다.
 */
export function mergeActualIntoClasses(
  classes: LooseClassMap,
  actualRecords: LegacyRecord[],
  fallbackClassName: string
): LooseClassMap {
  const merged: LooseClassMap = Object.fromEntries(
    Object.entries(classes).map(([name, data]) => [name, { ...data }])
  );

  actualRecords.forEach((record) => {
    const className = record.class_name
      ? normalizeFullClassName(record.grade || DATA_CONFIG.currentGrade, record.class_name)
      : fallbackClassName;
    // 🔴 `ClassRow`로 단언한다. 실제로는 필드가 빠져 있을 수 있고(원본이 그렇다)
    // 아래 `+= 1`이 그때 `NaN`을 만든다 - 그 동작을 그대로 두기 위한 단언이지,
    // "여덟 필드가 다 있다"는 주장이 아니다.
    const profile = (merged[className] || {
      today: 0, weekly: 0, hold: 0, converted: 0, correct: 0, recycle: 0, reuse: 0, contamination: 0
    }) as ClassRow;
    const decision = cleanText(record.final_decision || record.suggested_category);
    const isHold = record.hold_flag || decision.includes("보류");

    // 🔴 `+= 1`이지 `toNumber(...) + 1`이 아니다. today가 숫자가 아니면
    // "3반1"처럼 문자열이 되거나 NaN이 된다 - 원본이 그렇다.
    profile.today += 1;
    profile.weekly = toNumber(profile.weekly, 0) + 1;
    if (isHold) profile.hold += 1;
    else {
      profile.correct += 1;
      profile.converted += 1;
    }

    if (decision.includes("재사용")) profile.reuse += 1;
    else if (decision.includes("일반") || decision.includes("오염")) profile.contamination += 1;
    else if (decision) profile.recycle += 1;

    merged[className] = profile;
  });

  return merged;
}

/**
 * 반 점수. 맞춘 것과 재사용에 가중치 2, 보류는 0.5, 오염은 -1.5.
 * 소수 첫째 자리까지 반올림한다.
 */
export function calculateClassScore(row: LooseRow): number {
  return Math.round((
    toNumber(row.correct, row.converted || 0) * 2 +
    toNumber(row.recycle, 0) +
    toNumber(row.reuse, 0) * 2 +
    toNumber(row.hold, 0) * 0.5 -
    toNumber(row.contamination, 0) * 1.5
  ) * 10) / 10;
}

export interface RankingItem {
  name: string;
  grade: string;
  classOnly: string;
  score: number;
  scans: number;
  correct: number;
  hold: number;
  contamination: number;
  rank: number;
}

/**
 * 반 순위표. 점수 → 참여 수 → 이름(한국어 정렬) 순으로 내림차순 정렬한다.
 * 🔴 아직 한 번도 안 찍은 반(`scans <= 0`)은 **목록에서 빠진다.**
 */
export function buildClassRanking(classes: LooseClassMap): RankingItem[] {
  return Object.entries(classes)
    .map(([name, row]) => {
      const { grade, className } = classParts(name);
      return {
        name,
        grade,
        classOnly: className,
        score: calculateClassScore(row),
        scans: toNumber(row.weekly, row.today || 0),
        correct: toNumber(row.correct, row.converted || 0),
        hold: toNumber(row.hold, 0),
        contamination: toNumber(row.contamination, 0)
      };
    })
    .filter((item) => item.scans > 0)
    .sort((a, b) => b.score - a.score || b.scans - a.scans || a.name.localeCompare(b.name, "ko"))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export interface ClassRank {
  grade: string;
  gradeRank: number;
  gradeTotal: number;
  totalRank: number;
  total: number;
}

/**
 * 지금 보고 있는 반의 등수.
 *
 * 🔴 목록에 없는 반을 물으면 **1등 반의 등수**가 나온다(`|| ranking[0]`). 학년
 * 등수도 `findIndex`가 -1이라 1위로 보인다. 목록이 비었으면 전부 1이다.
 */
export function getCurrentClassRank(ranking: RankingItem[], currentClassName: unknown): ClassRank {
  const { grade } = classParts(currentClassName);
  const totalRank = ranking.find((item) => item.name === currentClassName) || ranking[0];
  const gradeEntries = ranking.filter((item) => item.grade === grade);
  const gradeRank = Math.max(1, gradeEntries.findIndex((item) => item.name === currentClassName) + 1);

  return {
    grade,
    gradeRank,
    gradeTotal: Math.max(gradeEntries.length, 1),
    totalRank: totalRank ? totalRank.rank : 1,
    total: Math.max(ranking.length, 1)
  };
}

export interface GradeSummary {
  grade: string;
  classCount: number;
  observed: number;
  today: number;
  hold: number;
  correct: number;
  converted: number;
}

/** 학년별로 반을 접는다. 학년 이름은 `classParts`가 정한다. */
export function gradeSummaries(classes: LooseClassMap): Record<string, GradeSummary> {
  const summaries: Record<string, GradeSummary> = {};

  Object.entries(classes).forEach(([name, row]) => {
    const { grade } = classParts(name);
    summaries[grade] = summaries[grade] || {
      grade,
      classCount: 0,
      observed: 0,
      today: 0,
      hold: 0,
      correct: 0,
      converted: 0
    };

    const summary = summaries[grade];
    summary.classCount += 1;
    summary.observed += toNumber(row.weekly, row.today || 0);
    summary.today += toNumber(row.today, 0);
    summary.hold += toNumber(row.hold, 0);
    summary.correct += toNumber(row.correct, row.converted || 0);
    summary.converted += toNumber(row.converted, 0);
  });

  return summaries;
}

// 🔴 `today`가 선택 항목인 것은 실수가 아니다. 학년을 하나도 못 찾았을 때 쓰는
// 마지막 fallback에는 `today`가 **아예 없다**(원본이 그렇다). 필수로 적으면
// 타입이 거짓말을 하게 되고, 화면 쪽에서 `today`가 undefined일 수 있다는 사실이
// 가려진다.
export interface SchoolDashboard extends Partial<GradeSummary> {
  grade: string;
  successPct: number;
  holdPct: number;
  summaries: Record<string, GradeSummary>;
}

/**
 * 학교 대시보드 한 학년치.
 *
 * 🔴 찾는 학년이 없으면 **아무 학년이나 첫 번째**를 쓰고, 그마저 없으면
 * `BASE_DASHBOARD`의 숫자로 채운다. "자료 없음"이 화면에 안 나오고 **그럴듯한
 * 숫자가 대신 나온다** — 원본 동작이다.
 *
 * 🔴 백분율은 `Math.max(1, observed)`로 0 나눗셈만 막는다. `observed`가 `NaN`이면
 * 백분율도 `NaN`이다(0이 아니다).
 */
export function aggregateSchoolDashboard(classes: LooseClassMap, grade: string): SchoolDashboard {
  const summaries = gradeSummaries(classes);
  const summary = summaries[grade] || Object.values(summaries)[0] || {
    grade,
    classCount: BASE_DASHBOARD.schoolClasses,
    observed: BASE_DASHBOARD.schoolObserved,
    hold: BASE_DASHBOARD.schoolHold,
    correct: 0,
    converted: 0
  };

  const observed = Math.max(1, summary.observed);
  return {
    ...summary,
    successPct: Math.round((summary.correct / observed) * 1000) / 10,
    holdPct: Math.round((summary.hold / observed) * 1000) / 10,
    summaries
  };
}
