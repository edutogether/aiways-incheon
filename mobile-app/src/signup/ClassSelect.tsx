// 학년·반 드롭다운 (2026-09-11, 지시 Bumm - "학년·반이 드롭다운이 아님").
//
// 🔴 PC와 **같은 구현 한 벌**을 쓴다. 루트의 `classPicker.js`가 `<select>`를 감싸
// 껍데기를 씌우고, `classPicker.css`가 그린다. 여기서 리액트로 다시 만들면
// 두 화면의 드롭다운이 서로 달라지는 날이 온다.
//
// 🔴 값의 주인은 `<select>`다. 리액트는 `value`/`onChange`만 준다 - 껍데기는
// 고를 때 네이티브 `change`를 직접 내므로 리액트가 그대로 받는다.
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    AIWaysClassPicker?: { attach: (select: HTMLSelectElement) => void };
    AIWaysSchoolClassCounts?: {
      schools: { schoolId: string; name: string; classesByGrade: Record<string, number> }[];
    };
  }
}

// 참여 학교면 **그 학교에 실제로 있는 반**만 보여준다. 아니면 일반 범위를 준다 -
// 학생 앱은 전국 어느 학교로도 가입할 수 있어서 모든 학교의 학급 수를 알 수 없다.
const FALLBACK_CLASSES = 20;

export function classesFor(schoolId: string, grade: string): number {
  const found = window.AIWaysSchoolClassCounts?.schools.find((s) => s.schoolId === schoolId);
  const known = found && grade ? found.classesByGrade[grade] : undefined;
  return typeof known === "number" && known > 0 ? known : FALLBACK_CLASSES;
}

export function ClassSelect({ id, label, value, onChange, options, placeholder }: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; text: string }[];
  placeholder: string;
}) {
  const ref = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (ref.current) window.AIWaysClassPicker?.attach(ref.current);
  }, []);

  return (
    <select
      id={id}
      ref={ref}
      aria-label={label}
      data-aiways-picker
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.text}</option>)}
    </select>
  );
}
