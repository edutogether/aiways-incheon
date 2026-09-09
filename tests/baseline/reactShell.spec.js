// 배포되는 화면의 "껍데기"가 지켜야 할 것들.
//
// 화면 내용은 기준선 스냅샷(mobileBaseline / mobileInteraction)이 본다. 이
// 파일은 스냅샷으로는 안 잡히는 세 가지를 본다:
//
//   1. 스타일시트가 **빌드를 거치지 않고 바이트 그대로** 나가는가
//   2. PC 앱과 공유하는 전역 스크립트가 **앱 번들보다 먼저** 실행되는가
//   3. 리액트가 #appRoot 자체는 건드리지 않는가(인증 게이트가 쓰는 요소다)
//
// 2번이 이 파일의 존재 이유에 가깝다. Vite는 번들 <script type="module">을
// head에 꽂는데, 그대로 두면 리액트가 window.AIWaysEdu2gClient보다 먼저
// 돌아서 저장·로그인이 "가끔" 안 되는 형태로 깨진다 - 화면 스냅샷으로는
// 절대 안 잡히는 종류다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const PAGE = "/mobile/index.html";

test("스타일시트를 다시 만들지 않고 바이트 그대로 내보낸다", () => {
  // tailwind.generated.css는 빌드 파이프라인 없이 만들어져 커밋된 24KB짜리
  // 사전 생성 번들이다. 다시 만들면 purge 범위·버전 차이로 화면이 미세하게
  // 달라지는데, 그 차이는 "체감까지 동일"을 깨뜨리면서 눈으로 찾기는 어렵다.
  // public/에 둔 원본과 산출물이 같은 파일인지 매번 확인한다.
  const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
  for (const name of ["tailwind.generated.css", "mobile.css"]) {
    expect(sha(`mobile/${name}`), `${name}이 빌드를 거치면서 달라졌다`).toBe(sha(`mobile-app/public/${name}`));
  }
});

test("공유 전역 스크립트가 앱 번들보다 먼저 실행된다", async ({ page }) => {
  await page.goto(PAGE);
  // PC 앱과 공유하는 셋. mobile/의 데이터·판정·화면 스크립트는 TS 모듈로
  // 옮겨져 더 이상 <script>로 로드되지 않는다.
  const globals = await page.evaluate(() => ({
    appCheck: typeof window.AIWaysAppCheck,
    betaAuth: typeof window.AIWaysBetaAuth,
    edu2gClient: typeof window.AIWaysEdu2gClient
  }));
  expect(globals).toEqual({ appCheck: "object", betaAuth: "object", edu2gClient: "object" });

  // 문서 순서도 같이 본다 - 위 확인은 "번들이 이미 다 돈 뒤"를 보는 것이라
  // 순서가 뒤집혀도 통과할 수 있다(되돌림 확인에서 실제로 그랬다).
  const order = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")));
  const bundleAt = order.findIndex((src) => src.includes("/bundle/"));
  const lastLegacyAt = order.reduce((last, src, i) => (src.includes("/bundle/") ? last : i), -1);
  expect(bundleAt, "앱 번들 <script>를 찾지 못했다").toBeGreaterThan(-1);
  // 공유 스크립트가 통째로 사라지면 lastLegacyAt이 -1이 되어 아래 비교가
  // 저절로 통과한다 - 순서를 지켰기 때문이 아니라 비교할 것이 없어서다
  // (COMMON_STANDARDS §21). 실제로 있는지 먼저 못박는다.
  expect(lastLegacyAt, "공유 스크립트가 하나도 없다").toBeGreaterThan(-1);
  // 앱 번들보다 먼저 와야 하는 <script defer> 넷: 공유 셋(AppCheck/BetaAuth/
  // Edu2gClient) + 인증 게이트. 개수를 못박아 두면 하나가 조용히 빠지는 것도 잡힌다.
  expect(order.filter((src) => !src.includes("/bundle/")).length, "먼저 로드돼야 할 스크립트 개수가 달라졌다").toBe(4);
  expect(bundleAt, "앱 번들이 공유 스크립트보다 앞에 있다").toBeGreaterThan(lastLegacyAt);
});

test("리액트가 #appRoot 자체는 건드리지 않는다", async ({ page }) => {
  await page.goto(PAGE);
  // authGate.js가 인증 통과 시점에 이 요소에서 hidden을 뗀다. 리액트가 이
  // 요소를 소유하면 그 조작이 리렌더에 지워질 수 있어, 안쪽만 그리게 했다.
  const root = await page.evaluate(() => {
    const el = document.getElementById("appRoot");
    return el ? { className: el.className, tag: el.tagName } : null;
  });
  expect(root).toEqual({ className: "hidden w-full flex flex-col items-center", tag: "DIV" });
});
