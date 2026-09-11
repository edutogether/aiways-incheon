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

// 🔴 어디에서 학년·반을 가져오는지가 이 화면의 전부다. 2026-09-11에 실제로
// **가입을 마친 학생에게 랭킹이 영영 안 떴다** - 학년·반을 `classContext`
// (임시 입력 카드가 쓰는 값)에서만 읽었는데, 가입 흐름은 그 값을 쓰지 않기
// 때문이다. 가입한 학생은 서버에 학년·반이 있는데도 화면은 "학교/반을
// 연결하면…"에 멈춰 있었고, 새로고침을 눌러도 **서버를 부르지도 않았다.**
// 그래서 이제 **가입 프로필을 먼저 보고**, 없을 때만 임시 입력으로 떨어진다.
export function useClassRanking(registeredSchoolId: () => string, registeredClass?: () => { grade: string; classNum: string } | null) {
  const [rows, setRows] = useState<ClassRankingRow[]>([]);
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(NOT_CONNECTED);

  const load = useCallback(async () => {
    const client = edu2gClient();
    if (!client?.getClassRanking) {
      setStatus("지금은 랭킹을 불러올 수 없어요.");
      return;
    }
    const context = loadClassContext();
    const mine = registeredClass?.() ?? null;
    const schoolId = registeredSchoolId() || context?.schoolId || "";
    const currentGrade = mine?.grade || context?.grade || "";
    const classNum = mine?.classNum || context?.classNum || "";
    if (!schoolId || !currentGrade) {
      setStatus(NOT_CONNECTED);
      return;
    }
    setLoading(true);
    setStatus("불러오는 중입니다...");
    setRows([]);
    setGrade(currentGrade);
    const result = await client.getClassRanking({ schoolId, grade: currentGrade, classNum });
    setLoading(false);
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
  }, [registeredSchoolId, registeredClass]);

  return { rows, grade, status, loading, load };
}
