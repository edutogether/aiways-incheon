// 우리 학년 반별 랭킹.
//
// 같은 학교, 같은 학년의 반끼리만 비교한다 - 서버(getClassRanking)가 애초에
// 다른 학교나 다른 학년의 데이터를 조회하지도, 응답에 담지도 않는다.
// 2026-08-26에 전국 랭킹을 폐지하면서 이 범위로 줄었다.
import { useCallback, useState } from "react";
import { edu2gClient } from "../legacy/globals";
import { loadClassContext } from "../state/storage";

export interface ClassRankingRow {
  rank: number;
  classNum: string;
  score: number;
  isMine?: boolean;
}

const NOT_CONNECTED = "학교/반을 연결하면 우리 반 순위가 표시돼요.";

export function useClassRanking(registeredSchoolId: () => string) {
  const [rows, setRows] = useState<ClassRankingRow[]>([]);
  const [grade, setGrade] = useState("");
  const [status, setStatus] = useState(NOT_CONNECTED);

  const load = useCallback(async () => {
    const client = edu2gClient();
    if (!client?.getClassRanking) {
      setStatus("지금은 랭킹을 불러올 수 없어요.");
      return;
    }
    const context = loadClassContext();
    const schoolId = registeredSchoolId() || context?.schoolId || "";
    const currentGrade = context?.grade ?? "";
    const classNum = context?.classNum ?? "";
    if (!schoolId || !currentGrade) {
      setStatus(NOT_CONNECTED);
      return;
    }
    setStatus("불러오는 중입니다...");
    setRows([]);
    setGrade(currentGrade);
    const result = await client.getClassRanking({ schoolId, grade: currentGrade, classNum });
    if (!result.ok) {
      setStatus(client.errorMessageFor?.(result.code ?? "") || "랭킹을 불러오지 못했어요. 다시 시도해 주세요.");
      return;
    }
    const classes = (result.data as { classes?: ClassRankingRow[] } | undefined)?.classes;
    if (!Array.isArray(classes) || !classes.length) {
      setStatus("아직 같은 학년 반 기록이 없어요.");
      return;
    }
    setStatus("우리 반은 굵게 표시돼요.");
    setRows(classes);
  }, [registeredSchoolId]);

  return { rows, grade, status, load };
}
