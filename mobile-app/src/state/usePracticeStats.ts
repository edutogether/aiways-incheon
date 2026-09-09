// 실천 기록(누적 횟수·CO2 절감량·타임라인).
import { useCallback, useState } from "react";
import type { SortingItem } from "../data/sortingData";
import { STORAGE_KEYS, readJson, removeKey, writeJson } from "./storage";

export interface PracticeLog {
  name: string;
  category: string;
  carbon: number;
  time: string;
}

export interface PracticeStats {
  totalCount: number;
  carbonReduction: number;
  logs: PracticeLog[];
}

const EMPTY: PracticeStats = { totalCount: 0, carbonReduction: 0, logs: [] };

// 타임라인은 30개까지만 들고 있는다(원본과 같다). 더 쌓이면 오래된 것부터
// 버린다 - localStorage 용량과 화면 스크롤 양쪽의 문제다.
const MAX_LOGS = 30;

export function usePracticeStats() {
  const [stats, setStats] = useState<PracticeStats>(() => readJson<PracticeStats>(STORAGE_KEYS.stats, EMPTY));

  const record = useCallback((item: SortingItem) => {
    setStats((current) => {
      const carbon = item.carbonSaved || 0;
      const time = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const logs = [{ name: `${item.emoji} ${item.label}`, category: item.category, carbon, time }, ...current.logs];
      if (logs.length > MAX_LOGS) logs.pop();
      const next: PracticeStats = {
        totalCount: current.totalCount + 1,
        carbonReduction: current.carbonReduction + carbon,
        logs
      };
      writeJson(STORAGE_KEYS.stats, next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    removeKey(STORAGE_KEYS.stats);
    setStats(EMPTY);
  }, []);

  return { stats, record, reset };
}
