// 검색어로 품목을 찾고, 검색창 아이콘에 쓸 이모지를 고르는 규칙.
//
// 문자열 비교는 NFKC 정규화 + 소문자 + 공백 제거를 거친다. "페트병"과
// "PET병"처럼 겉보기 다른 표기를 같은 것으로 보기 위한 것이고, 원본과
// 같은 함수를 그대로 쓴다.
import { DECORATIVE_EMOJI_LOOKUP, sortingDbV2 } from "../data/sortingData";

export function normalize(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toLowerCase();
}

/**
 * 검색어에 맞는 품목 id. 없으면 null.
 *
 * 두 번 훑는 순서가 중요하다. 먼저 **이름이 정확히 같은 것**을 찾고,
 * 없을 때만 이름·검색어 키워드에 부분 일치하는 것을 찾는다. 반대로 하면
 * "컵"을 쳤을 때 "플라스틱컵"이 "종이컵"보다 먼저 걸리는 식으로, 정확히
 * 그 이름인 품목을 두고 엉뚱한 것이 잡힌다.
 * "hold"(판단 보류)는 검색 대상이 아니다 - 직접 고르는 버튼이 따로 있다.
 */
export function findItemId(query: string): string | null {
  const q = normalize(query);
  if (!q) return null;
  for (const id in sortingDbV2) {
    if (id !== "hold" && normalize(sortingDbV2[id]?.label) === q) return id;
  }
  for (const id in sortingDbV2) {
    if (id === "hold") continue;
    const item = sortingDbV2[id];
    if (!item) continue;
    const haystacks = [item.label, ...item.searchKeywords].map(normalize);
    if (haystacks.some((entry) => entry && (entry.includes(q) || q.includes(entry)))) return id;
  }
  return null;
}

/**
 * 분리배출 안내와 무관한, 순전히 검색창 아이콘용 이모지.
 *
 * 안내가 있는 품목은 12개뿐이라, 학생이 "우산"이나 "핸드폰"을 치면 늘
 * 물음표만 떴다. 그럴 때라도 말이 되는 그림을 보여주려는 표다.
 */
export function matchDecorativeEmoji(query: string): string | null {
  const q = normalize(query);
  if (!q) return null;
  for (const [emoji, keywords] of DECORATIVE_EMOJI_LOOKUP) {
    if (keywords.some((keyword) => {
      const normalized = normalize(keyword);
      return q.includes(normalized) || normalized.includes(q);
    })) return emoji;
  }
  return null;
}
