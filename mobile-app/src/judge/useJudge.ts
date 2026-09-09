// 3초 판단 탭의 흐름 전체 - 검색, 자동완성, 사진 판단, 결과 모달.
import { useCallback, useRef, useState } from "react";
import { analyzePhoto, analyzeText } from "../analysis/sortingAnalysis";
import { sortingDbV2 } from "../data/sortingData";
import { edu2gClient } from "../legacy/globals";
import type { ToastTone } from "../state/useToasts";
import { findItemId } from "./itemLookup";
import { buildResultView, type ResultOptions, type ResultView } from "./resultView";

// 스캔 연출을 최소 이만큼은 보여준다. 응답이 빨리 와도 화면이 번쩍하고
// 지나가면 무슨 일이 일어난 건지 알 수 없다.
const PHOTO_SCAN_MIN_MS = 2500;
// 텍스트 쪽은 로딩 막대 CSS 애니메이션(1.4s)과 맞춘 값이다. 막대가 다 차기
// 전에 결과가 바뀌면 어중간하게 잘린 것처럼 보인다.
const TEXT_SCAN_MIN_MS = 1400;

export type JudgeStage = "result" | "photoScan" | "textScan";

interface JudgeOptions {
  showToast: (message: string, tone?: ToastTone) => void;
}

async function waitOutMinimum(startedAt: number, minimumMs: number): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export function useJudge({ showToast }: JudgeOptions) {
  const [query, setQuery] = useState("");
  const [suggestionFilter, setSuggestionFilter] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [stage, setStage] = useState<JudgeStage>("result");
  const [result, setResult] = useState<ResultView | null>(null);
  const [scanImageUrl, setScanImageUrl] = useState("");
  const [scanQuery, setScanQuery] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const queryRef = useRef(query);
  queryRef.current = query;

  const showResult = useCallback((itemId: string, options: ResultOptions = {}) => {
    setResult(buildResultView(itemId, options));
    setStage("result");
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const runTextAnalysis = useCallback(async (rawQuery: string) => {
    setScanQuery(rawQuery);
    setStage("textScan");
    setModalOpen(true);
    const startedAt = Date.now();
    const analysis = await analyzeText(rawQuery);
    await waitOutMinimum(startedAt, TEXT_SCAN_MIN_MS);
    if (!analysis.ok) {
      setModalOpen(false);
      showToast(edu2gClient()?.errorMessageFor?.(analysis.code) || "검색어 분석에 실패했습니다. 다시 시도해 주세요.", "amber");
      return;
    }
    const top = analysis.value.objectCandidates[0];
    const shared = {
      isAiResult: true,
      rawQuery,
      materialCandidates: analysis.value.materialCandidates,
      cautions: analysis.value.visibleCautions
    };
    if (!top) {
      showResult("hold", shared);
      return;
    }
    showResult(top.itemId, { ...shared, candidates: analysis.value.objectCandidates, aiLabel: top.label });
  }, [showToast, showResult]);

  const triggerSearch = useCallback(() => {
    const value = query.trim();
    if (!value) return;
    setSuggestionsOpen(false);
    const id = findItemId(value);
    if (id) {
      showResult(id, { rawQuery: value });
      return;
    }
    // 12개 품목 어디에도 안 걸리면 Gemini에게 이 말이 무엇인지 물어본다.
    void runTextAnalysis(value);
  }, [query, showResult, runTextAnalysis]);

  // 자동완성은 keyup에서만 갱신한다(원본과 같다). 붙여넣기처럼 키를 안 누르는
  // 입력으로는 목록이 열리지 않는데, 그것도 원본 그대로다.
  const onSearchKeyUp = useCallback((key: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      // 목록만 닫고 **항목별 숨김 상태는 건드리지 않는다.** 원본이 그렇게
      // 동작한다(handleSearch가 컨테이너만 숨기고 바로 반환한다). 여기서
      // 필터를 지우면 닫힌 목록 안에서 항목들이 조용히 다시 보이는 상태가
      // 되어, 다음에 목록을 열 때 한 프레임 동안 전체 목록이 스쳐 보인다.
      setSuggestionsOpen(false);
      if (key === "Enter") triggerSearch();
      return;
    }
    setSuggestionFilter(trimmed);
    setSuggestionsOpen(true);
    if (key === "Enter") triggerSearch();
  }, [triggerSearch]);

  const pickSuggestion = useCallback((itemId: string) => {
    const item = sortingDbV2[itemId];
    if (!item) return;
    setQuery(item.label);
    showResult(item.id);
    setSuggestionsOpen(false);
  }, [showResult]);

  const runPhotoAnalysis = useCallback(async (imageEl: HTMLImageElement, imageUrl: string) => {
    setPhotoBusy(true);
    setScanImageUrl(imageUrl);
    setStage("photoScan");
    setModalOpen(true);
    const startedAt = Date.now();
    const analysis = await analyzePhoto(imageEl, { searchQuery: queryRef.current });
    await waitOutMinimum(startedAt, PHOTO_SCAN_MIN_MS);
    setPhotoBusy(false);
    if (!analysis.ok) {
      setModalOpen(false);
      showToast(edu2gClient()?.errorMessageFor?.(analysis.code) || "사진 분석에 실패했습니다. 다시 시도해 주세요.", "amber");
      return;
    }
    const top = analysis.value.objectCandidates[0];
    const shared = {
      isAiResult: true,
      materialCandidates: analysis.value.materialCandidates,
      cautions: analysis.value.visibleCautions
    };
    if (!top) {
      showResult("hold", shared);
      return;
    }
    showResult(top.itemId, { ...shared, candidates: analysis.value.objectCandidates, aiLabel: top.label });
  }, [showToast, showResult]);

  // 파일 선택 -> 이미지 로드 -> 분석. objectURL은 끝나면 반드시 반납한다.
  const onPhotoSelected = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      void runPhotoAnalysis(image, url).finally(() => URL.revokeObjectURL(url));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("사진을 불러오지 못했습니다. 다시 시도해 주세요.", "amber");
    };
    image.src = url;
  }, [runPhotoAnalysis, showToast]);

  return {
    query, setQuery,
    suggestionFilter, suggestionsOpen,
    onSearchKeyUp, triggerSearch, pickSuggestion,
    modalOpen, stage, result, scanImageUrl, scanQuery, photoBusy,
    showResult, closeModal, onPhotoSelected
  };
}
