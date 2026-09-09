// S2(마크업 이식) 검증 - 리액트가 그린 DOM이 원본 마크업과 "같은가".
//
// 왜 스크린샷이 아니라 DOM 대조인가:
// 렌더 결과는 (DOM, CSS, 뷰포트)의 함수다. CSS는 바이트 그대로 쓰고 있고
// (reactShell.spec.js가 해시로 확인한다), 뷰포트는 테스트가 정한다. 그러면
// **DOM이 같다는 것을 보이면 렌더가 같다는 것이 따라 나온다.** 표본을 몇 장
// 찍어보는 스크린샷보다 강한 증명이고, "안 찍힌 화면"이 남지 않는다.
//
// 원본 쪽은 실행 중인 페이지가 아니라 **HTML 원문을 받아서 파싱한다**.
// /mobile/index.html을 그냥 열면 app.js가 곧바로 퀵선택 그리드·자동완성
// 목록·퀴즈 등급표를 채워 넣어서, 아직 그 로직을 옮기지 않은 S2 시점의
// 리액트 DOM과 비교할 수가 없다. DOMParser로 파싱하면 스크립트가 돌지 않아
// "손으로 쓴 마크업 그대로"를 얻는다.
//
// DOM 대조 하나만으로는 못 잡는 것이 있다: **인라인 요소 사이의 공백.**
// HTML은 줄바꿈+들여쓰기가 공백 하나로 접히지만, JSX는 줄로 나뉜 요소 사이의
// 공백을 아예 없앤다. 정규화가 공백만 있는 텍스트 노드를 버리므로 그 차이가
// 여기서는 안 드러나는데, 화면에서는 글자 사이가 붙어버리는 실제 차이다.
// 그래서 아래에 실측 대조를 하나 더 둔다 - 두 화면을 같은 뷰포트로 띄워
// 모든 요소의 좌표·크기·계산된 스타일을 비교한다.
import { test, expect } from "@playwright/test";
import { LAYOUT_PROPS, VIEWPORTS, settle } from "./harness.js";

// 양쪽을 같은 함수로 정규화한다. 재는 자가 다르면 비교가 의미 없다.
const COMPARE = async () => {
  const describe = (root) => {
    const lines = [];
    const walk = (node, depth) => {
      const pad = "  ".repeat(depth);
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.nodeValue || "").replace(/\s+/g, " ").trim();
        if (text) lines.push(`${pad}"${text}"`);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return; // 주석은 렌더에 영향이 없다
      // style만 "선언 단위"로 비교한다. 리액트는 style 객체를 문자열로 만들
      // 때 끝에 세미콜론을 붙이고(width: 20%;) 원본 HTML에는 없다(width: 20%).
      // 브라우저가 파싱한 결과는 똑같아서 렌더에 아무 영향이 없는데, 글자
      // 그대로 비교하면 여기서 걸린다. 선언을 쪼개서 비교하면 "정말 다른
      // 스타일"만 남는다.
      const normalizeAttr = (name, value) =>
        name === "style"
          ? value.split(";").map((part) => part.trim()).filter(Boolean).join("; ")
          : value;
      const attrs = [...node.attributes]
        .map((a) => `${a.name}=${JSON.stringify(normalizeAttr(a.name, a.value))}`)
        .sort()
        .join(" ");
      lines.push(`${pad}<${node.nodeName.toLowerCase()}${attrs ? " " + attrs : ""}>`);
      for (const child of node.childNodes) walk(child, depth + 1);
    };
    for (const child of root.childNodes) walk(child, 0);
    return lines;
  };

  const html = await (await fetch("/mobile/index.html")).text();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const originalRoot = parsed.getElementById("appRoot");
  const convertedRoot = document.getElementById("appRoot");
  if (!originalRoot || !convertedRoot) return { error: "#appRoot 를 한쪽에서 찾지 못했다" };

  const original = describe(originalRoot);
  const converted = describe(convertedRoot);
  const diffs = [];
  for (let i = 0; i < Math.max(original.length, converted.length); i += 1) {
    if (original[i] !== converted[i]) {
      diffs.push({ line: i, 원본: original[i] ?? "(없음)", 전환본: converted[i] ?? "(없음)" });
      if (diffs.length >= 5) break;
    }
  }
  return { diffs, originalLines: original.length, convertedLines: converted.length };
};

test("리액트가 그린 DOM이 원본 마크업과 같다", async ({ page }) => {
  await page.goto("/mobile-next/index.html");
  await page.waitForFunction(() => (document.getElementById("appRoot")?.childElementCount ?? 0) > 0);

  const result = await page.evaluate(COMPARE);
  expect(result.error).toBeUndefined();
  // 차이를 그대로 보여준다 - "다르다"는 것만 알려주면 어디가 다른지 찾는 데
  // 시간이 다 간다.
  expect(result.diffs, JSON.stringify(result.diffs, null, 2)).toEqual([]);
  expect(result.convertedLines).toBe(result.originalLines);
});

// 여기서부터가 실측 대조.
//
// 원본 페이지를 그냥 열면 app.js가 곧바로 화면을 채워버려서(퀵선택 그리드,
// 퀴즈 문제 문구 등) S2 시점의 리액트 화면과 비교할 수가 없다. 그래서
// **app.js 요청만 빈 응답으로 가로챈다** - 나머지 스크립트와 스타일은 평소대로
// 로드되므로, 남는 것은 정확히 "손으로 쓴 마크업 + 실제 CSS"다.
// 전환본 쪽은 아직 로직이 없어 그 자체로 같은 상태다.
async function measure(page, url, { blockLegacyApp = false } = {}) {
  if (blockLegacyApp) {
    await page.route("**/mobile/app.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  }
  await page.goto(url);
  await page.waitForFunction(() => (document.getElementById("appRoot")?.childElementCount ?? 0) > 0);
  await page.evaluate(() => {
    const gate = document.getElementById("authGate");
    const root = document.getElementById("appRoot");
    if (gate) gate.style.display = "none";
    if (root) { root.classList.remove("hidden"); root.style.display = ""; }
  });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(300);
  // 헤더의 animate-ping 점이 계속 깜빡여서, 재는 순간에 따라 opacity가
  // 0.2~0.27 사이 아무 값이나 나온다. 애니메이션을 끝난 상태로 고정한 뒤
  // 잰다(선언값은 기준선의 motion 덤프가 따로 본다).
  await settle(page);

  return page.evaluate((props) => {
    // 키를 id나 글자가 아니라 **자리(경로)**로 잡는다. 앞선 테스트가 두 트리가
    // 같은 모양임을 이미 보였으므로, 같은 자리는 같은 요소다. id 없는 요소도
    // 빠짐없이 들어온다는 것이 이 방식의 이점이다.
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
  }, LAYOUT_PROPS);
}

for (const vp of VIEWPORTS) {
  test(`전환본이 원본과 같은 자리·같은 스타일로 그려진다 ${vp.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    try {
      const originalPage = await context.newPage();
      const original = await measure(originalPage, "/mobile/index.html", { blockLegacyApp: true });
      const convertedPage = await context.newPage();
      const converted = await measure(convertedPage, "/mobile-next/index.html");

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
    } finally {
      await context.close();
    }
  });
}
