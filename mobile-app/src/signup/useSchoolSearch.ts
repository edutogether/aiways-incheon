// 학교 검색.
//
// 자유 입력 대신 나이스(NEIS) 학교기본정보에서 실제로 찾아 목록에서 고르게
// 한다 - 오타 때문에 같은 학교 학생이 다른 집계 단위로 쪼개지는 것을 막으려는
// 것이고, 선생님들이 실제로 지적한 문제다. 화면에는 학교 "이름"이 보이지만
// 서버로 가는 값은 표준학교코드다.
//
// **목록에서 고르기 전에는 코드가 비어 있다.** 그래서 이름만 쳐놓고 제출하는
// 것을 막을 수 있다(selection이 null이면 제출 단계에서 거른다).
import { useCallback, useEffect, useRef, useState } from "react";
import { edu2gClient } from "../legacy/globals";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const BLUR_HIDE_MS = 150;
const MAX_RESULTS = 15;

export interface SchoolResult {
  schoolCode: string;
  schoolName: string;
  schoolLevel: string;
  address?: string;
  region?: string;
}

export interface SchoolSelection {
  schoolId: string;
  schoolName: string;
}

export function useSchoolSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolResult[] | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const selectedLabel = useRef("");
  const debounce = useRef<number | null>(null);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (debounce.current !== null) window.clearTimeout(debounce.current);
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
  }, []);

  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    // 고른 뒤에 글자를 고치면 그 선택은 무효다 - 코드를 비워서 "고르지 않은
    // 상태"로 되돌린다.
    if (value.trim() !== selectedLabel.current) setSchoolId("");
    if (debounce.current !== null) window.clearTimeout(debounce.current);
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      return;
    }
    debounce.current = window.setTimeout(() => {
      void edu2gClient()?.searchSchool?.({ query: trimmed }).then((response) => {
        const schools = response.ok ? ((response.data as { schools?: SchoolResult[] } | undefined)?.schools ?? []) : [];
        setResults(schools.slice(0, MAX_RESULTS));
      }).catch(() => setResults([]));
    }, DEBOUNCE_MS);
  }, []);

  const select = useCallback((school: SchoolResult) => {
    setQuery(school.schoolName);
    selectedLabel.current = school.schoolName;
    setSchoolId(school.schoolCode);
    setResults(null);
  }, []);

  // 목록 항목을 누르는 순간에도 blur가 먼저 오기 때문에, 조금 늦게 닫는다.
  // 바로 닫으면 클릭이 허공을 때린다.
  const onBlur = useCallback(() => {
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    blurTimer.current = window.setTimeout(() => setResults(null), BLUR_HIDE_MS);
  }, []);

  const setValue = useCallback((nextSchoolId: string, nextSchoolName: string) => {
    setSchoolId(nextSchoolId || "");
    setQuery(nextSchoolName || "");
    selectedLabel.current = nextSchoolName || "";
  }, []);

  const selection: SchoolSelection | null = schoolId ? { schoolId, schoolName: query.trim() } : null;

  return { query, results, selection, onQueryChange, onBlur, select, setValue };
}
