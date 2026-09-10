// 대시보드 섹션 TSX를 원본 index.html에서 **다시 만든다.**
//
// 손으로 고치지 않는다 - 원본이 바뀌면 이 스크립트를 다시 돌린다. 사람이
// 옮겨 적으면 텍스트 노드가 쪼개져 글자 폭이 소수점 아래에서 달라진다.
//
// 실행:
//   node pc-app/scripts/htmlToTsx.mjs 161 445 > <임시파일>
//   node pc-app/scripts/regenerateDashboard.mjs <임시파일>
//
// 기계 변환이 못 하는 것 하나만 여기서 손본다: **<option selected>**.
// 리액트는 option의 selected를 일부러 무시하고 <select>의 defaultValue를
// 쓰라고 경고한다. 골라지는 항목은 같고 DOM 속성만 없다.
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = process.argv[2] || "C:/Users/817be/AppData/Local/Temp/dash.tsx.txt";
const body = readFileSync(SOURCE, "utf8").replace(/\s+$/, "");
let shifted = body.split("\n").map((l) => (l.startsWith("    ") ? l.slice(4) : l)).join("\n");
shifted = shifted
  .replace('<select id="gradeSelect" aria-label="학년 선택">', '<select id="gradeSelect" aria-label="학년 선택" defaultValue="5학년">')
  .replace('<select id="classSelect" aria-label="학급 선택">', '<select id="classSelect" aria-label="학급 선택" defaultValue="5학년 1반">')
  .split("<option selected={true}>").join("<option>");
const prev = readFileSync("pc-app/src/sections/DashboardSection.tsx", "utf8");
const head = prev.split("export function DashboardSection")[0].replace(/^import type[^\n]*\n\n/, "");
const imp = shifted.includes("CSSProperties") ? 'import type { CSSProperties } from "react";\n\n' : "";
writeFileSync("pc-app/src/sections/DashboardSection.tsx", imp + head + "export function DashboardSection() {\n  return (\n" + shifted + "\n  );\n}\n");
console.log("재생성 완료");
