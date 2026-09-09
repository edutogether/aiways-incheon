// 퀴즈 탭 위쪽의 등급표.
//
// 맞힌 개수 구간마다 어떤 칭호가 붙는지 미리 보여준다 - 풀기 전에 목표가
// 보이면 끝까지 푸는 비율이 올라간다는 판단으로 넣은 것이다.
// 구간의 min 값을 quizRank()에 그대로 넣어 칭호를 얻으므로, 칭호 규칙이
// 바뀌어도 이 표는 저절로 따라간다.
import { quizRank } from "../data/sortingData";

export interface QuizRankRange {
  min: number;
  label: string;
}

export const QUIZ_RANK_RANGES: readonly QuizRankRange[] = [
  { min: 0, label: "0~2개" },
  { min: 3, label: "3~4개" },
  { min: 5, label: "5~6개" },
  { min: 7, label: "7~8개" },
  { min: 9, label: "9개" },
  { min: 10, label: "10개" }
];

export { quizRank };
