// 전환본과 원본을 **둘 다 실행 상태로 나란히 띄워** 통째로 대조한다.
//
// 스냅샷 대조(mobileBaseline / mobileInteraction)와 역할이 다르다. 스냅샷은
// "전환 전에 찍어 둔 값과 같은가"를 보는데, 재는 범위가 정해져 있다 - id가
// 붙은 요소, 버튼, 그리고 몇 가지 목록. 이 파일은 그 범위 밖까지 포함해
// **#appRoot 아래 모든 요소**를 본다:
//
//   1. DOM 대조 - 태그·속성(class 포함)·글자가 하나도 다르지 않은가
//   2. 실측 대조 - 4개 뷰포트에서 모든 요소의 좌표·크기·계산된 스타일이 같은가
//
// 1번이 있으면 2번이 논리적으로 따라 나온다(렌더는 DOM·CSS·뷰포트의 함수이고,
// CSS는 바이트 그대로 쓰며 뷰포트는 테스트가 정한다). 그래도 2번을 같이 두는
// 이유는, 1번이 공백을 접어서 비교하기 때문이다 - HTML은 줄바꿈+들여쓰기가
// 텍스트 노드로 남고 JSX는 그 자리를 비우는데, 인라인 요소 사이에서는 그
// 차이가 실제로 글자를 붙여 버린다. 그건 좌표로만 잡힌다.
//
// 처음(S2)에는 원본 쪽을 HTML 원문으로 파싱해서 비교했다. 그때는 전환본에
// 로직이 없어서 "손으로 쓴 마크업"끼리 비교하는 게 맞았지만, 지금은 양쪽 다
// 살아 움직이는 앱이라 **실행 상태끼리** 비교하는 것이 맞다.
import { test, expect } from "@playwright/test";
import { LAYOUT_PROPS, VIEWPORTS, openApp, settle } from "./harness.js";

const ORIGINAL = "mobile";
const CONVERTED = "mobile-next";
// playwright.config.js의 use.baseURL과 같아야 한다.
const BASE_URL = "http://127.0.0.1:8001";

// 한 페이지의 #appRoot 아래를 통째로 훑어 문자열 목록으로 만든다.
function describeTree() {
  const lines = [];
  const walk = (node, depth) => {
    const pad = "  ".repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue || "").replace(/\s+/g, " ").trim();
      if (text) lines.push(`${pad}"${text}"`);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return; // 주석은 렌더에 영향이 없다
    // style만 "선언 단위"로 비교한다. 리액트는 style 객체를 문자열로 만들 때
    // 끝에 세미콜론을 붙이고(width: 20%;) 원본에는 없다(width: 20%). 브라우저가
    // 파싱한 결과는 같아 렌더에 아무 영향이 없는데, 글자 그대로 비교하면
    // 여기서 걸린다.
    //
    // class는 **집합으로** 비교한다. 원본은 classList.toggle로 클래스를 몇 개만
    // 켰다 껐다 해서 순서가 조작 이력에 따라 달라지는데, 순서는 화면에 아무
    // 영향이 없다(어느 규칙이 이기는지는 스타일시트 순서가 정한다).
    const normalize = (name, value) => {
      if (name === "style") return value.split(";").map((part) => part.trim()).filter(Boolean).sort().join("; ");
      if (name === "class") return value.split(/\s+/).filter(Boolean).sort().join(" ");
      return value;
    };
    const attrs = [...node.attributes]
      // 빈 value 속성은 뺀다. 리액트는 제어 입력의 값을 속성에도 비추는데,
      // 원본은 자바스크립트로 .value(프로퍼티)만 다뤄서 속성이 아예 없다.
      // 화면에 보이는 값도, 읽히는 값도 양쪽 다 빈 문자열로 같다 - 다른 것은
      // "기본값 속성이 붙어 있는가"뿐이고 이 앱에는 form reset이 없다.
      // 값이 들어 있는 경우는 그대로 비교하므로 진짜 차이는 여전히 잡힌다.
      .filter((a) => !(a.name === "value" && a.value === ""))
      .map((a) => `${a.name}=${JSON.stringify(normalize(a.name, a.value))}`)
      .sort()
      .join(" ");
    lines.push(`${pad}<${node.nodeName.toLowerCase()}${attrs ? " " + attrs : ""}>`);
    for (const child of node.childNodes) walk(child, depth + 1);
  };
  const root = document.getElementById("appRoot");
  for (const child of root.childNodes) walk(child, 0);
  return lines;
}

// 자리(경로)를 키로 삼는다. 앞선 DOM 대조가 두 트리가 같은 모양임을 이미
// 보였으므로 같은 자리는 같은 요소다. id 없는 요소도 빠짐없이 들어온다.
function measureTree(props) {
  const out = {};
  const walk = (el, path) => {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const row = { _tag: el.tagName.toLowerCase(), _box: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)] };
    for (const p of props) row[p] = cs.getPropertyValue(p);
    out[path] = row;
    [...el.children].forEach((child, i) => walk(child, `${path}/${i}:${child.tagName.toLowerCase()}`));
  };
  const root = document.getElementById("appRoot");
  [...root.children].forEach((child, i) => walk(child, `${i}:${child.tagName.toLowerCase()}`));
  return out;
}

// 화면 하나를 열어 재고 닫는다.
//
// **컨텍스트를 매번 새로 만드는 것이 중요하다.** 같은 컨텍스트에서 두 번째
// 화면을 열면 checkStudentProfile 응답이 영영 안 와서 배너 대기가 15초
// 타임아웃으로 죽는다(익명 인증·App Check 상태가 컨텍스트 단위로 남아
// 재사용되면서 두 번째 요청이 400으로 막히는 것으로 보인다). 순차로 열어도
// 마찬가지였고, 컨텍스트를 분리해야만 둘 다 정상으로 열렸다.
//
// baseURL을 직접 넘기는 이유: browser.newContext()로 만든 컨텍스트에는
// playwright.config.js의 use 설정이 자동으로 붙지 않는다.
async function collect(browser, viewport, target, run) {
  const context = await browser.newContext({ viewport, baseURL: BASE_URL });
  try {
    const page = await context.newPage();
    await openApp(page, target);
    return await run(page);
  } finally {
    await context.close();
  }
}

// 컨텍스트는 직접 만들지 않고 픽스처를 쓴다. browser.newContext()로 만들면
// playwright.config.js의 use 설정(baseURL 등)이 안 붙어서 로딩이 통째로
// 실패한다 - 처음에 그렇게 짰다가 15초 타임아웃으로 죽었다.
const DOM_VIEWPORT = { width: 390, height: 844 };

test("전환본의 DOM이 원본과 같다", async ({ browser }) => {
  {
    const original = await collect(browser, DOM_VIEWPORT, ORIGINAL, (page) => page.evaluate(describeTree));
    const converted = await collect(browser, DOM_VIEWPORT, CONVERTED, (page) => page.evaluate(describeTree));

    const diffs = [];
    for (let i = 0; i < Math.max(original.length, converted.length); i += 1) {
      if (original[i] !== converted[i]) {
        diffs.push({ 줄: i, 원본: original[i] ?? "(없음)", 전환본: converted[i] ?? "(없음)" });
        if (diffs.length >= 5) break;
      }
    }
    // 차이를 그대로 보여준다 - "다르다"만 알려주면 어디가 다른지 찾는 데
    // 시간이 다 간다.
    expect(diffs, JSON.stringify(diffs, null, 2)).toEqual([]);
    expect(converted.length).toBe(original.length);
  }
});

for (const vp of VIEWPORTS) {
  test(`전환본이 원본과 같은 자리·같은 스타일로 그려진다 ${vp.name}`, async ({ browser }) => {
    {
      const measure = (target) => collect(browser, { width: vp.width, height: vp.height }, target, async (page) => {
        // 헤더의 animate-ping 점이 계속 깜빡여서, 재는 순간에 따라 opacity가
        // 아무 값이나 나온다. 애니메이션을 끝난 상태로 고정한 뒤 잰다
        // (선언값은 기준선의 motion 덤프가 따로 본다).
        await settle(page);
        return page.evaluate(measureTree, LAYOUT_PROPS);
      });
      const original = await measure(ORIGINAL);
      const converted = await measure(CONVERTED);

      const diffs = [];
      for (const key of Object.keys(original)) {
        for (const prop of Object.keys(original[key])) {
          const a = JSON.stringify(original[key][prop]);
          const b = JSON.stringify(converted[key]?.[prop]);
          if (a !== b && diffs.length < 8) diffs.push({ 자리: key, 항목: prop, 원본: a, 전환본: b });
        }
      }
      expect(diffs, JSON.stringify(diffs, null, 2)).toEqual([]);
      expect(Object.keys(converted).length).toBe(Object.keys(original).length);
    }
  });
}
