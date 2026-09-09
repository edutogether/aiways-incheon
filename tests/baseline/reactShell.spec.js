// S1(토대) 검증 - 리액트 빌드 산출물이 "원본과 같은 껍데기"로 뜨는가.
//
// 이 단계에서는 화면 내용을 아직 옮기지 않았다(S2에서 한다). 그래서 여기서
// 재는 것은 화면이 아니라 **껍데기**다:
//   - <head>의 meta/title/lang이 원본과 글자 하나까지 같은가
//   - 스타일시트가 바이트 그대로인가 (Tailwind를 다시 만들지 않는다는 제약)
//   - PC 앱과 공유하는 전역 스크립트가 **앱 번들보다 먼저** 실행되는가
//
// 마지막 항목이 이 파일의 존재 이유에 가깝다. 원본은 공유 스크립트가 먼저,
// app.js가 마지막이었다. Vite는 번들 <script type="module">을 head에 꽂는데
// 그대로 두면 리액트가 window.AIWaysEdu2gClient보다 먼저 돌아서, 로그인·저장이
// "가끔" 안 되는 형태로 깨진다 - 화면 스냅샷으로는 절대 안 잡히는 종류다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const ORIGINAL = "/mobile/index.html";
const CONVERTED = "/mobile-next/index.html";

function headOf() {
  return {
    title: document.title,
    lang: document.documentElement.lang,
    bodyClass: document.body.className,
    meta: [...document.querySelectorAll("meta")]
      .map((m) => `${m.getAttribute("name") || m.getAttribute("property") || m.getAttribute("charset") || "?"}=${m.getAttribute("content") || ""}`)
      .sort()
  };
}

test("전환 산출물의 head가 원본과 같다", async ({ page }) => {
  await page.goto(ORIGINAL);
  const original = await page.evaluate(headOf);
  await page.goto(CONVERTED);
  const converted = await page.evaluate(headOf);
  expect(converted).toEqual(original);
});

test("스타일시트를 다시 만들지 않고 바이트 그대로 옮긴다", () => {
  const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
  for (const name of ["tailwind.generated.css", "mobile.css"]) {
    expect(sha(`mobile-next/${name}`), `${name}이 원본과 다르다`).toBe(sha(`mobile/${name}`));
  }
});

test("공유 전역 스크립트가 앱 번들보다 먼저 실행된다", async ({ page }) => {
  await page.goto(CONVERTED);
  // 실행 순서를 문서 순서가 아니라 "실제로 먼저 정의되어 있는가"로 확인한다.
  // defer 스크립트와 module 스크립트는 둘 다 문서 순서대로 실행되므로, 앱
  // 번들이 도는 시점에 이 전역들이 이미 있어야 한다.
  // S3/S4에서 mobile/의 데이터·판정·화면 스크립트는 TS 모듈로 옮겨져 더 이상
  // <script>로 로드되지 않는다. 남은 것은 PC 앱과 **공유하는** 세 개뿐이고,
  // 이 셋이 앱 번들보다 먼저 준비돼 있어야 한다.
  const globals = await page.evaluate(() => ({
    appCheck: typeof window.AIWaysAppCheck,
    betaAuth: typeof window.AIWaysBetaAuth,
    edu2gClient: typeof window.AIWaysEdu2gClient
  }));
  expect(globals).toEqual({ appCheck: "object", betaAuth: "object", edu2gClient: "object" });

  // 문서 순서도 같이 본다 - 위 확인은 "번들이 이미 다 돈 뒤"를 보는 것이라,
  // 순서가 뒤집혀도 통과할 수 있다.
  const order = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")));
  const bundleAt = order.findIndex((src) => src.includes("/bundle/"));
  const lastLegacyAt = order.reduce((last, src, i) => (src.includes("/bundle/") ? last : i), -1);
  expect(bundleAt, "앱 번들 <script>를 찾지 못했다").toBeGreaterThan(-1);
  expect(bundleAt, "앱 번들이 공유 스크립트보다 앞에 있다").toBeGreaterThan(lastLegacyAt);
});

test("리액트가 #appRoot 자체는 건드리지 않는다", async ({ page }) => {
  await page.goto(CONVERTED);
  // authGate.js가 인증 통과 시점에 이 요소에서 hidden을 뗀다. 리액트가 이
  // 요소를 소유하면 그 조작이 리렌더에 지워질 수 있어, 안쪽만 그리게 했다.
  const root = await page.evaluate(() => {
    const el = document.getElementById("appRoot");
    return el ? { className: el.className, tag: el.tagName } : null;
  });
  expect(root).toEqual({ className: "hidden w-full flex flex-col items-center", tag: "DIV" });
});
