// 원본 index.html의 `<body>` 안 화면을 TSX로 **다시 만든다.**
//
// 손으로 고치지 않는다 — 원본이 바뀌면 이 스크립트를 다시 돌린다. 사람이
// 옮겨 적으면 텍스트 노드가 쪼개져 글자 폭이 소수점 아래에서 달라지고,
// 그건 눈으로 못 잡는다(`mobile/` 전환에서 실제로 당했다).
//
// 🔴 **body 안을 통째로 한 번에 옮긴다.** 처음에는 섹션 일곱 개만 옮겼는데,
// 그러면 헤더·설정 메뉴·모바일 내비·다이얼로그 다섯 개·토스트 자리가 통째로
// 빠진다. 실제로 그렇게 만들었다가 기준선에서 **id가 95개에서 47개로 줄어든
// 것**으로 잡혔다. 조각으로 나눠 옮기면 "빠뜨렸다"가 조용히 지나간다.
//
// 부트 스플래시와 그 인라인 스크립트는 옮기지 않는다 — **리액트보다 먼저**
// 그려져야 하므로 셸(pc-app/index.html)에 그대로 남는다.
//
// 실행: node pc-app/scripts/regeneratePage.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SOURCE = resolve(REPO_ROOT, "index.html");

// 기계 변환이 못 하는 자리. 리액트는 option의 selected를 **일부러 무시하고**
// <select>의 defaultValue를 쓰라고 경고한다 — 골라지는 항목은 같고 DOM 속성만
// 없다. 대조에서도 속성이 아니라 실제로 골라졌는지를 본다.
const SELECT_DEFAULTS = [
  { find: '<select id="gradeSelect" aria-label="학년 선택">', add: ' defaultValue="5학년"' },
  { find: '<select id="classSelect" aria-label="학급 선택">', add: ' defaultValue="5학년 1반"' }
];

const lines = readFileSync(SOURCE, "utf8").split(/\r?\n/);
const bodyAt = lines.findIndex((l) => l.trim().startsWith("<body"));
const bodyEnd = lines.findIndex((l) => l.trim() === "</body>");
if (bodyAt < 0 || bodyEnd < 0) throw new Error("원본에서 <body>를 찾지 못했습니다.");

// 셸이 들고 있는 부분(부트 스플래시 + 인라인 스크립트)의 끝.
const scriptEnd = lines.findIndex((l, i) => i > bodyAt && l.trim() === "</script>");
if (scriptEnd < 0 || scriptEnd > bodyEnd) throw new Error("부트 스플래시 스크립트를 찾지 못했습니다.");

const from = scriptEnd + 2;
const to = bodyEnd;
// 옮길 것이 없으면 조용히 빈 화면을 만들지 않는다.
if (to - from < 100) throw new Error(`옮길 줄이 ${to - from}줄뿐입니다 - 원본 구조가 바뀐 것으로 보입니다.`);

let body = execFileSync(
  process.execPath,
  [resolve(HERE, "htmlToTsx.mjs"), String(from), String(to), SOURCE],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
).replace(/\s+$/, "");

// 컴포넌트 안쪽 기준으로 들여쓰기를 맞춘다(원본은 4칸에서 시작).
body = body.split("\n").map((l) => (l.startsWith("    ") ? `    ${l.slice(4)}` : l)).join("\n");
for (const { find, add } of SELECT_DEFAULTS) {
  if (!body.includes(find)) throw new Error(`${find} 를 찾지 못했습니다 - 원본이 바뀌었으면 SELECT_DEFAULTS도 고쳐야 합니다.`);
  body = body.replace(find, find.replace(/>$/, `${add}>`));
}
body = body.split("<option selected={true}>").join("<option>");

const needsCss = body.includes("CSSProperties");
const head = [
  `// 원본 index.html ${from}~${to}행(<body> 안 화면)을 **기계로** 옮긴 것이다.`,
  "//",
  "// 🔴 손으로 고치지 않는다. 원본이 바뀌면",
  "// `node pc-app/scripts/regeneratePage.mjs`를 다시 돌린다.",
  "//",
  "// 값을 채우는 것은 아직 `app.js`가 한다(S2는 마크업만 옮긴다). 그래서 id와",
  "// class 이름이 **원본과 정확히 같아야** 한다 — 하나라도 다르면 그 자리의",
  "// 값이 조용히 안 채워진다.",
  "//",
  "// 무엇을 지켜야 하는지는 tests/baseline/PC-BASELINE.md에 있다 — 특히",
  "// **전환 전부터 있던 결함 셋은 그대로 재현해야 한다**는 것.",
  needsCss ? 'import type { CSSProperties } from "react";\n' : "",
  "export function App() {",
  "  return (",
  "    <>"
].filter((l) => l !== "").join("\n");

writeFileSync(resolve(HERE, "..", "src", "App.tsx"), `${head}\n${body}\n    </>\n  );\n}\n`);
console.log(`App.tsx  (원본 ${from}~${to}행, ${to - from + 1}줄)`);
