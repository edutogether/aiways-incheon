// 대시보드의 **기본 자료** (S3 둘째 묶음).
//
// 원본 `app.js`의 `BASE_DASHBOARD`/`BASE_CLASS_DATA`를 그대로 옮긴 것이다.
// 실제 기록이 오기 전에 화면을 채우는 값이고, `base-data-seed.tsv`가 덮어쓰기
// 전까지 그대로 보인다.
//
// 🔴 **숫자를 한 칸도 바꾸지 않는다.** 화면에 그대로 찍히는 값이라 하나만 달라도
// 전환본이 원본과 다른 화면이 된다. `aggregate.parity.test.ts`가 이 파일을
// `app.js` 원문에서 떼어 온 값과 대조한다 — 손으로 고치면 그 검사가 실패한다.

export interface ClassRow {
  today: number;
  weekly: number;
  hold: number;
  converted: number;
  correct: number;
  recycle: number;
  reuse: number;
  contamination: number;
}

export type ClassMap = Record<string, ClassRow>;

export const BASE_DASHBOARD = {
  schoolObserved: 244,
  schoolClasses: 4,
  schoolHold: 36,
  todayObserved: 16,
  aiClassified: 3,
  humanConfirmed: 7,
  holdCount: 0
};

export const BASE_CLASS_DATA: ClassMap = {
  "3학년 1반": { today: 13, weekly: 72, hold: 8, converted: 25, correct: 56, recycle: 31, reuse: 7, contamination: 6 },
  "3학년 2반": { today: 11, weekly: 64, hold: 9, converted: 21, correct: 48, recycle: 27, reuse: 6, contamination: 8 },
  "3학년 3반": { today: 15, weekly: 78, hold: 7, converted: 28, correct: 62, recycle: 35, reuse: 8, contamination: 5 },
  "4학년 1반": { today: 14, weekly: 74, hold: 8, converted: 27, correct: 58, recycle: 32, reuse: 8, contamination: 6 },
  "4학년 2반": { today: 17, weekly: 88, hold: 9, converted: 34, correct: 70, recycle: 40, reuse: 10, contamination: 6 },
  "4학년 3반": { today: 12, weekly: 67, hold: 10, converted: 22, correct: 50, recycle: 29, reuse: 5, contamination: 9 },
  "4학년 4반": { today: 22, weekly: 116, hold: 6, converted: 44, correct: 92, recycle: 54, reuse: 15, contamination: 4 },
  "5학년 1반": { today: 24, weekly: 128, hold: 4, converted: 52, correct: 104, recycle: 62, reuse: 18, contamination: 3 },
  "5학년 2반": { today: 21, weekly: 103, hold: 8, converted: 41, correct: 84, recycle: 48, reuse: 13, contamination: 5 },
  "5학년 3반": { today: 19, weekly: 97, hold: 10, converted: 37, correct: 76, recycle: 44, reuse: 11, contamination: 7 },
  "5학년 4반": { today: 14, weekly: 78, hold: 14, converted: 24, correct: 55, recycle: 30, reuse: 6, contamination: 11 },
  "6학년 1반": { today: 29, weekly: 142, hold: 3, converted: 60, correct: 118, recycle: 72, reuse: 20, contamination: 2 },
  "6학년 2반": { today: 20, weekly: 101, hold: 9, converted: 40, correct: 82, recycle: 49, reuse: 12, contamination: 6 },
  "6학년 3반": { today: 18, weekly: 95, hold: 11, converted: 34, correct: 74, recycle: 43, reuse: 10, contamination: 8 }
};

/**
 * 기본 학급 자료의 **얕은 복사본**을 만든다.
 *
 * 🔴 얕은 복사인 것이 중요하다 — 집계 함수들이 돌려받은 값을 그 자리에서 고치기
 * 때문에, 원본을 그대로 넘기면 `BASE_CLASS_DATA`가 오염되어 **두 번째 계산부터
 * 값이 달라진다.**
 */
export function cloneBaseClasses(): ClassMap {
  return Object.fromEntries(
    Object.entries(BASE_CLASS_DATA).map(([name, data]) => [name, { ...data }])
  );
}
