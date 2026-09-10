// PC 전환본의 "껍데기"가 지켜야 할 것들 (S1).
//
// 화면 내용은 기준선 스냅샷(pcBaseline)이 본다. 이 파일은 스냅샷으로는
// 안 잡히는 두 가지를 본다.
//
//   1. 손으로 쓴 스타일시트가 **빌드를 거치지 않고 바이트 그대로** 나가는가
//   2. 아직 전환하지 않은 고전 스크립트가 **앱 번들보다 먼저** 실행되는가
//
// 2번이 이 파일의 존재 이유에 가깝다. Vite는 번들 `<script type="module">`을
// head에 꽂는데, 그대로 두면 리액트가 `window.AIWays*`보다 먼저 돌아서
// 저장·로그인이 "가끔" 안 되는 형태로 깨진다 — **화면 스냅샷으로는 절대
// 안 잡히는 종류다.** `mobile/` 전환에서 실제로 겪었다.
//
// 1번은 이번 전환의 비목표를 지키는 장치다. CSS는 바이트 그대로 써야
// 화면에 차이가 났을 때 전환 탓인지 CSS 탓인지 가릴 수 있다.
//
// 🔴 이 검사는 `pc-next/`(전환본 산출물)를 본다. 빌드하지 않았으면
// 그 사실을 알려주고 실패한다 — 없는 것을 조용히 건너뛰면 "검사가 통과했다"가
// 아무것도 뜻하지 않게 된다(COMMON_STANDARDS §21).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const OUT = "pc-next";
const VERBATIM = ["style.css", "styles/cb3a.css"];

// 원본 index.html이 싣는 순서 그대로. 서로 전역으로 의존하므로 순서가 곧 계약이다.
const LEGACY_SCRIPTS = [
  "deviceTier.js", "firebaseAppCheck.js", "firebaseBetaAuth.js", "edu2gBetaClient.js",
  "dashboardRealtime.js", "responsiveNavigation.js", "classProfileStore.js",
  "classroomSkillRegistry.js", "aiRuntimeLoader.js", "app.js"
];

function builtHtml() {
  const path = `${OUT}/index.html`;
  if (!existsSync(path)) {
    throw new Error(`${path}이 없습니다 - 먼저 \`npm run build:pc\`를 돌리세요. 없는 것을 건너뛰면 이 검사가 아무것도 뜻하지 않게 됩니다.`);
  }
  return readFileSync(path, "utf8");
}

test("손으로 쓴 스타일시트를 다시 만들지 않고 바이트 그대로 내보낸다", () => {
  const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
  if (!existsSync(`${OUT}/index.html`)) throw new Error(`${OUT}/이 없습니다 - 먼저 \`npm run build:pc\`를 돌리세요.`);
  for (const name of VERBATIM) {
    expect(sha(`${OUT}/${name}`), `${name}이 빌드를 거치면서 달라졌다`).toBe(sha(name));
  }
});

test("고전 스크립트가 앱 번들보다 먼저 실행된다", () => {
  const html = builtHtml();
  const order = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  // 대상을 못 찾으면 조용히 통과하지 않는다.
  expect(order.length, "산출물에 script 태그가 하나도 없다 - 빌드가 잘못됐다").toBeGreaterThanOrEqual(LEGACY_SCRIPTS.length + 1);

  const bundleAt = order.findIndex((src) => src.includes("/bundle/"));
  expect(bundleAt, "앱 번들 <script>를 찾지 못했다").toBeGreaterThan(-1);

  for (const name of LEGACY_SCRIPTS) {
    const at = order.findIndex((src) => src.endsWith(`/${name}`) || src.endsWith(name));
    expect(at, `${name}이 산출물에 없다`).toBeGreaterThan(-1);
    expect(at, `${name}이 앱 번들보다 뒤에 온다 - 리액트가 그 전역보다 먼저 돌면 저장·로그인이 "가끔" 안 되는 형태로 깨진다`).toBeLessThan(bundleAt);
  }
});

test("스타일시트가 스크립트보다 먼저 온다", () => {
  const html = builtHtml();
  const firstScript = html.search(/<script[^>]*src=/);
  for (const name of VERBATIM) {
    const at = html.indexOf(`href="./${name}"`);
    expect(at, `${name} <link>를 찾지 못했다`).toBeGreaterThan(-1);
    expect(at, `${name}이 스크립트보다 뒤에 온다 - 스타일 없이 그려지는 순간이 생긴다`).toBeLessThan(firstScript);
  }
});
