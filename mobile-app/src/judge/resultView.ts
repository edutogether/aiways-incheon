// 판단 결과 모달에 실제로 그릴 값들을 계산한다.
//
// 화면을 직접 만지던 원본 renderResult()에서 "무엇을 보여줄지 정하는 부분"만
// 떼어낸 것이다. 순수 함수라 눈으로 확인하지 않고도 검사할 수 있다.
import { sortingDbV2, type SortingItem } from "../data/sortingData";
import type { MaterialCandidate, ObjectCandidate } from "../analysis/sortingAnalysis";

export interface ResultOptions {
  isAiResult?: boolean;
  /** AI가 읽은 물건 이름. 보류로 떨어졌을 때 "그래도 이렇게 보였다"를 알려준다. */
  aiLabel?: string;
  candidates?: ObjectCandidate[];
  materialCandidates?: MaterialCandidate[];
  cautions?: string[];
  /** 검색창에 친 말. 보류함 등록 칸에 미리 채워 넣는다. */
  rawQuery?: string;
}

export interface CandidateChip {
  itemId: string;
  label: string;
}

export interface ResultView {
  item: SortingItem;
  category: string;
  title: string;
  body: string;
  tip: string;
  actionTag: string;
  actionTagClassName: string;
  candidates: CandidateChip[];
  isHold: boolean;
  holdNameDefault: string;
  /** 사진·검색어 AI 판단으로 온 결과인가. 실천 기록을 남길 때 provider가 달라진다. */
  isAiResult: boolean;
  /** AI가 읽은 이름. 기록에 담는 후보 라벨로 쓴다. */
  aiLabel: string;
}

const HOLD_TAG_CLASS = "inline-block text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200";
const GUIDE_TAG_CLASS = "inline-block text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200";

export function buildResultView(itemId: string, options: ResultOptions = {}): ResultView {
  const item = sortingDbV2[itemId] ?? sortingDbV2.hold;
  if (!item) throw new Error("판단 보류 항목이 데이터에 없습니다 - sortingData가 깨졌습니다.");

  // 사진으로 물어봤는데 결국 "보류"로 떨어진 경우에도, AI가 무엇으로 봤는지는
  // 알려준다. 그냥 보류 문구만 보여주면 "모르겠다"로 끝나버려서, 학생이
  // 다음에 뭘 확인해야 할지 알 수 없다.
  const aiGuess = Boolean(options.isAiResult && item.isHold && options.aiLabel);

  let category: string;
  let title: string;
  let body: string;
  let tip: string;

  if (aiGuess) {
    const materials = (options.materialCandidates ?? []).map((entry) => entry.label).filter(Boolean);
    const materialText = materials.length
      ? `재질은 ${materials.slice(0, 2).join(", ")}(으)로 추정돼요.`
      : "재질은 사진만으로 확신하기 어려워요.";
    category = "AI 추정 · 확인 필요";
    title = `❓ ${options.aiLabel ?? ""}`;
    body = `AI가 살펴본 결과 "${options.aiLabel ?? ""}"(으)로 보여요. ${materialText} 정확한 분리배출 방법은 확신할 수 없어 학교 판단 보류함에 기록하는 것을 추천해요.`;
    tip = options.cautions?.[0] || item.tip;
  } else {
    category = item.category;
    title = `${item.emoji} ${item.label}`;
    body = item.guide;
    tip = (options.isAiResult ? options.cautions?.[0] : "") || item.tip;
  }

  // 후보가 둘 이상일 때만 "다른 후보였나요?"를 보여준다. 하나뿐이면 고를
  // 것이 없어 오히려 헷갈린다.
  const candidates: CandidateChip[] = options.isAiResult && Array.isArray(options.candidates) && options.candidates.length > 1
    ? options.candidates
        .filter((candidate) => candidate.itemId !== itemId && sortingDbV2[candidate.itemId])
        .map((candidate) => {
          const candidateItem = sortingDbV2[candidate.itemId]!;
          return { itemId: candidate.itemId, label: `${candidateItem.emoji} ${candidateItem.label.split(" / ")[0] ?? ""}` };
        })
    : [];

  const isHold = Boolean(item.isHold);
  return {
    item,
    category,
    title,
    body,
    tip,
    actionTag: isHold ? "🛑 보류함 보관 권장" : options.isAiResult ? "🤖 AI 사진 판단" : "🔍 배출 가이드 확인",
    actionTagClassName: isHold ? HOLD_TAG_CLASS : GUIDE_TAG_CLASS,
    candidates,
    isHold,
    holdNameDefault: options.rawQuery ?? "",
    isAiResult: Boolean(options.isAiResult),
    aiLabel: options.aiLabel ?? ""
  };
}
