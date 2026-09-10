// CSV 만들기 (S3 셋째 묶음 — ③CSV).
//
// 원본 `app.js`에 있던 것을 타입만 붙여 옮겼다. **동작은 한 군데도 바꾸지 않았다.**
//
// 🔴 **`csvQuote`는 보안 장치다.** `=`·`+`·`-`·`@`로 시작하는 값 앞에 작은따옴표를
// 붙여 **엑셀이 그 칸을 수식으로 실행하는 것**을 막는다. 학생 이름이나 품목
// 이름에 그런 글자가 들어올 수 있고, 선생님이 받은 파일을 엑셀로 여는 순간
// 실행된다. 이 줄을 "필요 없어 보인다"고 지우면 안 된다.
//
// 🔴 눈에 띄지만 **일부러 그대로 둔 것들**(고치면 원본과 달라진다):
//
//   - 수식 방지는 **네 글자만** 본다. 앞에 탭이나 캐리지리턴이 붙은 `\t=cmd`는
//     정규식에 안 걸린다. 원본이 그렇다 — 넓히는 것은 별건이다.
//
//   - `String(value ?? "")`이라 `0`과 `false`는 **글자로 남는다**(빈 칸이 아니다).
//     `null`/`undefined`만 빈 칸이 된다.
//
//   - 날짜는 `toLocaleString("ko-KR")`이라 **보는 사람의 시간대**로 찍힌다.
//     서버 시각이 아니다.
//
//   - 줄 끝은 `\r\n`이고 맨 앞에 BOM이 붙는다. 엑셀에서 한글이 안 깨지게 하는
//     것이라, 둘 다 바꾸면 선생님 화면에서 글자가 깨진다.

/**
 * CSV 한 칸. 큰따옴표로 감싸고, 안의 큰따옴표는 둘로 늘린다.
 *
 * 🔴 **아무 값이나 받는다.** 객체가 들어오면 `"[object Object]"`가 되고 그것이
 * 그대로 파일에 들어간다 — 원본 동작이다. eslint의 `no-base-to-string`이 바로
 * 그것을 경고하는데, 여기서는 **그 동작이 지켜야 할 것**이라 규칙을 끈다.
 * 타입을 좁혀 경고를 없애면 원본이 받던 입력을 못 받게 되고, 그건 동작을 바꾸는
 * 것이다(normalize.ts와 같은 이유).
 */
export function csvQuote(value: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- 위 주석 참고
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = "'" + text; // 스프레드시트 수식 주입 방지
  return `"${text.replace(/"/g, '""')}"`;
}

/** 기록 한 줄. 필드가 빠지거나 타입이 뒤섞일 수 있다. */
export type SortingRecord = {
  createdAt?: unknown;
  status?: unknown;
  resolutionType?: unknown;
  userDecision?: { selectedItemId?: unknown } | null;
  analysis?: { objectCandidates?: unknown } | null;
  [key: string]: unknown;
};

export type ClassRecord = {
  createdAt?: unknown;
  status?: unknown;
  resolutionType?: unknown;
  studentNumber?: unknown;
  studentName?: unknown;
  selectedItemId?: unknown;
  [key: string]: unknown;
};

/** 내 기록 한 줄: 날짜 · 처리 상태 · 판단 품목 · 재검토 상태. */
export function csvRowForSortingRecord(record: SortingRecord): unknown[] {
  const createdAt = record.createdAt ? new Date(record.createdAt as string) : null;
  const dateLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString("ko-KR") : "";
  const statusLabel = record.status === "completed" ? "완료" : record.status === "held" ? "보류" : record.status || "";
  const selectedItemId = record.userDecision?.selectedItemId || "";
  // 🔴 중간 변수를 두지 않는다. 후보 목록이 배열이 아니면 여기서 TypeError가
  // 나는데, 변수에 담으면 **예외 메시지에 그 변수 이름이 찍혀** 원본과 달라진다.
  // 화면에 보이는 차이는 아니지만, 대조에서 "같은 이유로 죽었는가"를 볼 수
  // 없게 되므로 원본 표현을 그대로 둔다.
  const matchedCandidate = ((record.analysis?.objectCandidates || []) as { itemId?: unknown; label?: unknown }[])
    .find((item) => item?.itemId === selectedItemId);
  const itemLabel = matchedCandidate?.label || selectedItemId;
  const reviewLabel = record.resolutionType ? "재검토 완료" : record.status === "held" ? "재검토 대기" : "";
  return [dateLabel, statusLabel, itemLabel, reviewLabel];
}

export const SORTING_CSV_HEADER = ["날짜", "처리 상태", "판단 품목", "재검토 상태"];

export function buildSortingRecordsCsv(records: SortingRecord[]): string {
  const header = SORTING_CSV_HEADER;
  const rows = records.map(csvRowForSortingRecord);
  const bom = String.fromCharCode(0xfeff); // 엑셀에서 한글이 깨지지 않도록 BOM을 앞에 붙인다
  return bom + [header, ...rows].map((row) => row.map(csvQuote).join(",")).join("\r\n");
}

/**
 * 반 전체 기록 한 줄. 번호·이름이 앞에 더 붙어 **위와 열 구성이 다르다.**
 *
 * 🔴 품목이 `selectedItemId`(코드)지 사람이 읽는 이름이 아니다. 위 함수는
 * 후보 목록에서 `label`을 찾아 쓰는데 이쪽은 그러지 않는다 — 원본이 그렇다.
 */
export function csvRowForClassRecord(record: ClassRecord): unknown[] {
  const createdAt = record.createdAt ? new Date(record.createdAt as string) : null;
  const dateLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString("ko-KR") : "";
  const statusLabel = record.status === "completed" ? "완료" : record.status === "held" ? "보류" : record.status || "";
  const reviewLabel = record.resolutionType ? "재검토 완료" : record.status === "held" ? "재검토 대기" : "";
  return [record.studentNumber || "", record.studentName || "", dateLabel, statusLabel, record.selectedItemId || "", reviewLabel];
}

export const CLASS_CSV_HEADER = ["번호", "이름", "날짜", "처리 상태", "판단 품목", "재검토 상태"];

export function buildClassRecordsCsv(records: ClassRecord[]): string {
  const header = CLASS_CSV_HEADER;
  const rows = records.map(csvRowForClassRecord);
  const bom = String.fromCharCode(0xfeff);
  return bom + [header, ...rows].map((row) => row.map(csvQuote).join(",")).join("\r\n");
}
