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
import { edu2gClient, schoolList } from "../legacy/globals";

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
  // 🔴 검색이 실패한 것과 그런 학교가 없는 것은 다르다. 예전에는 둘 다 빈
  // 배열이라 화면이 "검색 결과가 없어요"라고 말했다 - 2026-09-10에 실제로
  // 그 화면을 보고 원인을 못 찾았다(COMMON_STANDARDS §21).
  const [error, setError] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const selectedLabel = useRef("");
  const debounce = useRef<number | null>(null);
  const blurTimer = useRef<number | null>(null);
  // 목록이 늦게 도착했을 때 "지금 화면에 있는 글자"로 다시 거르기 위해 들고 있는다.
  const latestQuery = useRef("");

  useEffect(() => () => {
    if (debounce.current !== null) window.clearTimeout(debounce.current);
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
  }, []);

  // 🔴 첫 화면에서 미리 받지 않는다. 이 훅은 App 최상위에서 마운트되므로
  // 마운트 시점에 받으면 그것이 곧 첫 화면이다 - 학교 검색을 쓰지도 않는 학생이
  // 학교 와이파이에서 164KB를 받게 된다. **검색창을 만지는 순간**에만 받는다.
  // 아낌 모드·2G면 받지 않고 서버 검색으로 가는 판정은 schoolListSearch.js에 있다.
  const onFocus = useCallback(() => { void schoolList()?.loadNow(); }, []);

  const onQueryChange = useCallback((value: string) => {
    // 포커스 없이 값이 들어오는 경로(붙여넣기 등)에서도 시작되게 한다.
    // load()는 약속을 캐시하므로 여러 번 불러도 한 번만 받는다.
    //
    // 🔴 목록이 도착하면 **그때 화면에 있던 글자로 다시 한 번 거른다.** 없으면
    // 첫 글자가 서버로 갔다가 실패했을 때 "검색하지 못했어요"가 그대로 남는다 -
    // 목록은 몇백 ms 뒤에 도착하는데 그것을 쓰지 못하고 버리는 셈이다.
    void schoolList()?.loadNow()?.then(() => {
      const latest = latestQuery.current.trim();
      if (latest.length < MIN_QUERY_LENGTH) return;
      const hits = schoolList()?.search(latest);
      if (!hits) return;
      // 🔴 기다리고 있던 서버 호출을 **취소한다.** 안 그러면 300ms 뒤에 온
      //    서버 응답(로컬에서는 실패)이 방금 그린 목록을 덮어쓴다.
      if (debounce.current !== null) { window.clearTimeout(debounce.current); debounce.current = null; }
      setError(null);
      setResults(hits.slice(0, MAX_RESULTS));
    });
    latestQuery.current = value;
    setQuery(value);
    // 고른 뒤에 글자를 고치면 그 선택은 무효다 - 코드를 비워서 "고르지 않은
    // 상태"로 되돌린다.
    if (value.trim() !== selectedLabel.current) setSchoolId("");
    setError(null);
    if (debounce.current !== null) window.clearTimeout(debounce.current);
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      return;
    }
    // 🔴 목록이 브라우저에 있으면 서버를 거치지 않는다. 디바운스도 걸지 않는다 -
    // 필터가 밀리초로 끝나는데 300ms를 기다리면 "타자 치는 대로"가 성립하지 않고,
    // 한글은 자모마다 값이 바뀌므로 기다리는 만큼 목록이 멎어 보인다.
    const local = schoolList()?.search(trimmed);
    if (local) {
      setResults(local.slice(0, MAX_RESULTS));
      return;
    }

    // 목록이 아직 안 왔거나 못 받았으면 예전처럼 서버로 간다(폴백).
    debounce.current = window.setTimeout(() => {
      void edu2gClient()?.searchSchool?.({ query: trimmed }).then((response) => {
        if (!response.ok) { setError(response.code || "unknown"); setResults([]); return; }
        setError(null);
        const schools = (response.data as { schools?: SchoolResult[] } | undefined)?.schools ?? [];
        setResults(schools.slice(0, MAX_RESULTS));
      }).catch(() => { setError("network_error"); setResults([]); });
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

  return { query, results, error, selection, onQueryChange, onFocus, onBlur, select, setValue };
}
