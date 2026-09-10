// 학년·반·숫자·글자를 다듬는 것들 (S3 첫 묶음).
//
// 원본 `app.js`에 있던 것을 타입만 붙여 옮겼다. **동작은 한 군데도 바꾸지
// 않았다** — 이번 전환의 성공 기준은 "달라진 데가 없다"이고, 여기서 조금이라도
// 손보면 화면에 차이가 났을 때 전환 탓인지 그 손질 탓인지 못 가린다.
//
// 🔴 눈에 띄지만 **일부러 그대로 둔 것들**(고치면 원본과 달라진다):
//   - `normalizeGrade`는 못 알아들으면 **기본 학년("5학년")**을 돌려준다.
//     빈 문자열이나 null이 아니다.
//   - `normalizeClassOnly`는 못 알아들으면 **"1반"**을 돌려준다.
//   - 학년은 1~6, 반은 1~9만 인식한다. **10반 이상은 못 읽는다** — 청라초는
//     3학년이 9개 반이라 지금은 걸리지 않지만, 반이 늘면 여기서 막힌다.
//     고치는 것은 별건이다(이번 전환의 비목표).
import { DATA_CONFIG } from "./config";

// 🔴 아래 함수들은 **아무 값이나 받는다.** 원본이 그렇게 동작하기 때문이다 —
// 객체가 들어오면 "[object Object]"가 되고, 그 결과가 그대로 화면에 쓰인다.
// eslint의 no-base-to-string은 바로 그것을 경고하는데, **여기서는 그 동작이
// 지켜야 할 것**이라 규칙을 끈다. 타입을 좁혀서 경고를 없애면 원본이 받던
// 입력을 못 받게 되고, 그건 동작을 바꾸는 것이다.
/* eslint-disable @typescript-eslint/no-base-to-string */


/** 공백을 하나로 접고 앞뒤를 자른다. null/undefined는 빈 문자열이 된다. */
export function cleanText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/**
 * 🔴 **처음 나오는 숫자 덩어리 하나**를 돌려준다. "모든 숫자를 남기는 것"이
 * 아니다 — `"3-2"`는 `"3"`이지 `"32"`가 아니고, `"3학년 2반"`도 `"3"`이다.
 *
 * 옮기면서 이것을 `replace(/\D+/g, "")`로 잘못 썼다가 대조에서 잡혔다. 화면에
 * 학년만 들어가는 자리에 쓰이므로, 두 자리가 들어가면 **엉뚱한 학년이 조용히
 * 만들어진다.**
 */
export function digitsOnly(value: unknown): string {
  const match = String(value || "").match(/\d+/);
  return match ? match[0] : "";
}

/**
 * 숫자로 읽는다. 쉼표는 무시하고, 못 읽으면 `fallback`을 돌려준다.
 * 🔴 빈 문자열·null·undefined도 `fallback`이다("0"이 아니다).
 */
export function toNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || cleanText(value) === "") return fallback;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : fallback;
}

/** "3학년" 꼴로 맞춘다. 못 알아들으면 기본 학년을 돌려준다. */
export function normalizeGrade(value: unknown): string {
  const text = cleanText(value);
  const match = text.match(/([1-6])\s*학?년?/);
  return match ? `${match[1]}학년` : DATA_CONFIG.currentGrade;
}

/** "2반" 꼴로 맞춘다. 못 알아들으면 "1반"을 돌려준다. */
export function normalizeClassOnly(value: unknown): string {
  const text = cleanText(value);
  const dash = text.match(/[1-6]\s*[-반]\s*([1-9])\s*반?/);
  if (dash) return `${dash[1]}반`;
  const match = text.match(/([1-9])\s*반/);
  return match ? `${match[1]}반` : "1반";
}

/** "3학년 2반" 꼴로 맞춘다. 반 문자열 안에 학년이 들어 있으면 그쪽을 쓴다. */
export function normalizeFullClassName(grade: unknown, className: unknown): string {
  const classText = cleanText(className);
  const full = classText.match(/([1-6])\s*학년\s*([1-9])\s*반/);
  if (full) return `${full[1]}학년 ${full[2]}반`;

  const compact = classText.match(/([1-6])\s*[-반]\s*([1-9])\s*반?/);
  if (compact) return `${compact[1]}학년 ${compact[2]}반`;

  return `${normalizeGrade(grade)} ${normalizeClassOnly(classText)}`;
}

/** "3학년 2반"을 학년과 반으로 가른다. 못 가르면 기본값을 돌려준다. */
export function classParts(className: unknown): { grade: string; className: string } {
  const match = String(className || DATA_CONFIG.currentClassName).match(/(\d학년)\s*(\d반)/);
  return {
    grade: match ? match[1]! : DATA_CONFIG.currentGrade,
    className: match ? match[2]! : "1반"
  };
}

/** 기록이 어떤 종류인지. 입력 종류가 없으면 집계용 기본값인지 본다. */
export function classifyRecordType(record: {
  input_type?: unknown;
  totalScans?: unknown;
  landfillTons?: unknown;
}): string {
  const type = cleanText(record.input_type).toLowerCase();
  if (type) return type;
  if (record.totalScans !== undefined || record.landfillTons !== undefined) return "base";
  return "";
}
