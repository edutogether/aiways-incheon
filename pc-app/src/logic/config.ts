// 원본 `app.js`의 `DATA_CONFIG`. **값을 바꾸지 않는다** — 정규화 함수들이
// 못 알아들었을 때 돌려주는 기본값이라, 여기가 달라지면 화면의 숫자가 조용히
// 달라진다.
//
// `seedUrl`은 기본 데이터 TSV의 위치다. S3에서 계산 로직만 먼저 옮기므로
// 그 파일을 읽는 쪽은 아직 `app.js`에 있다.
export const DATA_CONFIG = {
  seedUrl: "./base-data-seed.tsv",
  currentSchool: "AIWays초",
  currentGrade: "5학년",
  currentClassName: "5학년 1반"
} as const;
