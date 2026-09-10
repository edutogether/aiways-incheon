// 원본 index.html의 한 조각을 TSX로 **기계적으로** 옮긴다.
//
// 손으로 다시 타이핑하지 않는 이유(`mobile/` 전환에서 실제로 당한 것):
// 사람이 옮겨 적으면 텍스트 노드가 쪼개지거나 줄바꿈 공백이 사라져서, 화면은
// 같아 보여도 글자 폭이 소수점 아래에서 달라지고 `textContent`가 바뀐다.
// 기계로 옮기면 그 종류의 차이가 **구조적으로** 생기지 않는다.
//
// 하는 일은 JSX 문법에 맞추는 것뿐이고, **내용은 한 글자도 바꾸지 않는다.**
//   class= → className= / for= → htmlFor=
//   void 태그 자기닫기 / style="a:b" → style={{ a: "b" }}
//   불리언 속성(hidden, disabled…) → {true}
//   <!-- --> → {/* */}
//   JSX가 표현식으로 읽는 { } 를 글자로 남기기
//
// 실행: node pc-app/scripts/htmlToTsx.mjs <시작줄> <끝줄> [파일]
import { readFileSync } from "node:fs";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

// JSX에서 이름이 다른 속성. 나머지(data-*, aria-*, role 등)는 그대로 둔다.
// 🔴 SVG의 하이픈 속성(stroke-width, stop-color 등)은 리액트가 그대로
// 통과시키므로 건드리지 않는다 — 카멜로 바꾸면 오히려 원본과 다른 이름이
// DOM에 남을 수 있다. 렌더된 DOM을 원본과 대조해서 확인한다.
const RENAME = {
  class: "className", for: "htmlFor", colspan: "colSpan", rowspan: "rowSpan",
  tabindex: "tabIndex", maxlength: "maxLength", minlength: "minLength",
  autocomplete: "autoComplete", readonly: "readOnly", inputmode: "inputMode",
  srcset: "srcSet", datetime: "dateTime", novalidate: "noValidate",
  autofocus: "autoFocus", enterkeyhint: "enterKeyHint", spellcheck: "spellCheck",
  contenteditable: "contentEditable", crossorigin: "crossOrigin",
  referrerpolicy: "referrerPolicy", playsinline: "playsInline"
};

// 리액트 타입이 number로 받는 속성. **DOM에 남는 값은 같다** — 문자열로 두면
// 타입 검사에서만 막히고 화면은 똑같다. 숫자로 내서 통과시킨다.
// tabindex는 음수(-1)도 쓰므로 부호를 허용한다.
const NUMERIC = new Set(["maxlength", "minlength", "size", "cols", "rows", "span", "start", "tabindex"]);

// 값이 없으면 참인 속성.
const BOOLEAN = new Set(["hidden", "disabled", "checked", "selected", "required", "readonly", "autofocus", "multiple", "novalidate", "open"]);

function styleToObject(value) {
  const entries = value.split(";").map((s) => s.trim()).filter(Boolean).map((pair) => {
    const at = pair.indexOf(":");
    const name = pair.slice(0, at).trim();
    const val = pair.slice(at + 1).trim();
    // CSS 사용자 정의 속성(--x)은 이름을 그대로 둬야 한다.
    const key = name.startsWith("--") ? JSON.stringify(name) : name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return key + ': "' + val + '"';
  });
  const joined = entries.join(", ");
  // 사용자 정의 속성(--pct 등)은 리액트 CSSProperties 타입에 없다. 값을
  // 바꾸지 않고 단언만 붙인다 — app.js가 이 변수를 읽어 도넛 각도를 그린다.
  const hasCustom = entries.some((e) => e.startsWith('"--'));
  return hasCustom ? "{{ " + joined + " } as CSSProperties}" : "{{ " + joined + " }}";
}

function convertTag(tag) {
  const nameMatch = tag.match(/^<\s*([a-zA-Z][\w-]*)/);
  if (!nameMatch) return tag;
  const name = nameMatch[1];
  if (tag.startsWith("</")) return tag;

  let selfClosed = /\/>$/.test(tag);
  const body = tag.replace(/^<\s*[a-zA-Z][\w-]*/, "").replace(/\/?>$/, "");

  // 속성을 하나씩 읽는다. 값 안에 = 나 공백이 있어도 안전하도록 따옴표 기준으로 자른다.
  const attrs = [];
  const re = /([:\w-]+)(\s*=\s*("([^"]*)"|'([^']*)'))?/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const raw = m[1];
    const lower = raw.toLowerCase();
    const hasValue = m[2] !== undefined;
    const value = m[4] !== undefined ? m[4] : m[5];
    const key = RENAME[lower] ?? raw;
    if (!hasValue) {
      attrs.push(BOOLEAN.has(lower) ? key + "={true}" : key + '=""');
    } else if (lower === "style") {
      attrs.push("style=" + styleToObject(value));
    } else if (NUMERIC.has(lower) && /^-?\d+$/.test(value)) {
      attrs.push(key + "={" + value + "}");
    } else if (/[{}]/.test(value)) {
      // 값 안의 중괄호를 JSX가 표현식으로 읽지 않게 문자열로 넘긴다.
      attrs.push(key + "={" + JSON.stringify(value) + "}");
    } else {
      attrs.push(key + '="' + value + '"');
    }
  }

  if (VOID.has(name.toLowerCase())) selfClosed = true;
  const attrText = attrs.length ? " " + attrs.join(" ") : "";
  return "<" + name + attrText + (selfClosed ? " />" : ">");
}

const [, , from, to, file = "index.html"] = process.argv;
const lines = readFileSync(file, "utf8").split(/\r?\n/);
let html = lines.slice(Number(from) - 1, Number(to)).join("\n");

// 주석을 먼저 자리표시자로 빼둔다 — 안에 태그처럼 보이는 글자가 있을 수 있다.
const comments = [];
html = html.replace(/<!--([\s\S]*?)-->/g, (_, inner) => {
  comments.push(inner);
  return " COMMENT" + (comments.length - 1) + " ";
});

html = html.replace(/<[^>]+>/g, convertTag);

// 🔴 순서가 중요하다. 중괄호 감싸기를 **먼저** 한다 — 아래에서 넣는 {" "}가
// "텍스트 안의 중괄호"로 보여서 통째로 문자열이 되어 화면에 {" "}가 그대로
// 찍히는 일이 실제로 났다.
// 텍스트 안의 중괄호는 JSX 표현식으로 읽히므로 문자열로 감싼다.
html = html.replace(/>([^<]*[{}][^<]*)</g, (_, text) => ">{" + JSON.stringify(text) + "}<");

// 🔴 요소 사이의 공백을 되살린다.
//
// **JSX는 줄로 나뉜 요소 사이의 공백을 아예 없앤다.** HTML에서 줄바꿈+들여쓰기는
// 공백 하나로 렌더되는 텍스트 노드지만, JSX에서는 사라진다. 화면은 flex gap 등
// 때문에 같아 보여도 `textContent`가 달라지고, **스크린리더가 "분석 엔진버리는"
// 처럼 붙여 읽는다.** `mobile/` 전환에서 실제로 당했고, 이번에도 그대로 났다.
//
// 원본에 공백이 있던 자리에만 `{" "}`를 넣는다 - 없던 자리에는 넣지 않는다.
// 세 가지 자리에서 사라진다: 태그↔태그, 태그↔글자, 글자↔태그.
// (글자↔글자는 JSX가 알아서 공백 하나로 합쳐 주므로 건드리지 않는다.)
html = html.replace(/>(\s*\n\s*)</g, (_, gap) => ">{\" \"}" + gap + "<");
html = html.replace(/>(\s*\n\s*)([^<\s])/g, (_, gap, ch) => ">{\" \"}" + gap + ch);
html = html.replace(/([^>\s}])(\s*\n\s*)</g, (_, ch, gap) => ch + "{\" \"}" + gap + "<");

// 🔴 자리표시자를 JSX 주석으로 되돌린다. **앞뒤 공백에 기대지 않는다.**
//
// 2026-09-11에 여기서 사고가 났다. 예전 정규식은 `/ COMMENT(\d+) /`로 **앞뒤 공백을
// 요구**했는데, 바로 위 125~127행의 `{" "}` 삽입이 그 사이에 끼어들어
// ` COMMENT0{" "} `가 되면서 **뒤 공백이 사라져 하나도 안 바뀌었다.** 그 결과
// 자리표시자 6개가 **화면에 그대로 글자로 찍혔다** — 헤더 바로 아래
// (y=79) `COMMENT0 COMMENT1 COMMENT2`가 보이는 상태로 프리뷰에 나갔고,
// Bumm님이 발견하셨다. 원본에는 없는 글자다.
//
// 공백에 기대지 않게 하고, 뒤에 붙은 `{" "}`도 같이 걷어낸다 — 원본에서 주석은
// 텍스트 노드를 만들지 않으므로 그 자리에 공백을 넣으면 안 된다.
html = html.replace(/[ \t]*COMMENT(\d+)(\{" "\})?[ \t]*/g, (_, i) => {
  const body = comments[Number(i)];
  if (body === undefined) throw new Error(`COMMENT${i}에 대응하는 주석이 없습니다 - 자리표시자와 목록이 어긋났습니다.`);
  // JSX 주석 안의 */ 는 주석을 일찍 닫아 문법을 깨뜨린다.
  if (body.includes("*/")) throw new Error(`주석 ${i}번 본문에 */ 가 들어 있어 JSX 주석으로 옮길 수 없습니다.`);
  return "{/*" + body + "*/}";
});

// 🔴 하나라도 남으면 **조용히 화면에 글자로 나간다.** 그대로 내보내지 않고 멈춘다
// (COMMON_STANDARDS §21 - 조용히 통과하는 실패가 이 저장소에서 제일 비싸다).
const leftover = html.match(/COMMENT\d+/g);
if (leftover) {
  throw new Error(`자리표시자가 ${leftover.length}개 남았습니다(${[...new Set(leftover)].join(", ")}) - 그대로 두면 화면에 글자로 찍힙니다.`);
}

process.stdout.write(html + "\n");
