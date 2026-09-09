// 임시 학교/반 입력.
//
// 가입하지 않은 학생의 기록에 붙일 값이다. 가입하면 서버가 가진 정보로
// 대체되므로 이 카드는 숨는다.
//
// 저장 시점을 "입력 확정(blur)"으로 잡은 것은 원본과 같다. 글자를 칠 때마다
// 저장하면, 학년을 "1"까지 쳤을 뿐인데 "저장됨"이 떴다 사라졌다 해서
// 눈에 거슬린다.
import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS, loadClassContext, removeKey, writeJson } from "../state/storage";
import { useSchoolSearch } from "./useSchoolSearch";

const SAVED_MESSAGE = "저장됨 · 이제부터 이 반 기록으로 저장돼요.";
const EMPTY_MESSAGE = "학교를 검색해서 목록에서 고르고, 학년/반을 입력해야 우리 반 기록에 반영돼요.";

export function useInterimClass() {
  const school = useSchoolSearch();
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("");
  const [status, setStatus] = useState(EMPTY_MESSAGE);

  // 저장된 값이 있으면 화면에 되살린다.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadClassContext();
    if (!saved) return;
    school.setValue(saved.schoolId, saved.schoolName);
    setGrade(saved.grade);
    setClassNum(saved.classNum);
    setStatus(SAVED_MESSAGE);
  }, [school]);

  // 최신 값을 sync()가 보게 참조로 둔다 - sync는 blur 시점에 불리는데,
  // 그때의 상태를 클로저로 잡아두면 한 박자 낡은 값을 저장하게 된다.
  const latest = useRef({ selection: school.selection, grade, classNum });
  latest.current = { selection: school.selection, grade, classNum };

  const sync = useCallback(() => {
    const { selection, grade: currentGrade, classNum: currentClassNum } = latest.current;
    const trimmedGrade = currentGrade.trim();
    const trimmedClassNum = currentClassNum.trim();
    if (selection && trimmedGrade && trimmedClassNum) {
      writeJson(STORAGE_KEYS.classContext, {
        schoolId: selection.schoolId,
        schoolName: selection.schoolName,
        grade: trimmedGrade,
        classNum: trimmedClassNum
      });
      setStatus(SAVED_MESSAGE);
      return;
    }
    removeKey(STORAGE_KEYS.classContext);
    setStatus(EMPTY_MESSAGE);
  }, []);

  return { school, grade, setGrade, classNum, setClassNum, status, sync };
}
