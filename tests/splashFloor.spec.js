// 스플래시가 **최소 두 바퀴**는 보이는가 (COMMON_STANDARDS §27, 2026-09-11).
//
// 왜 있나: PC 스플래시에 하한이 없어서 **0.1초 만에 스쳐 지나갔다.** Bumm님이
// 실제 화면에서 발견하셨다. 모바일에는 하한이 있었는데(`MINIMUM_TURNS = 2`)
// 🔴 **한쪽에 넣은 하한은 다른 쪽에 가지 않는다** — 그래서 기기마다 따로 넣고
// 따로 잰다.
//
// 🔴 하한은 조용히 사라지는 종류다. 다음에 누가 부트 경로를 손대면(예: 자료가
// 도착하자마자 걷어내게 바꾸면) 상수는 그대로인데 도로 0.1초가 된다. 그래서
// **상수를 읽지 않고 화면에 실제로 보인 시간을 잰다.**
//
// 🔴 재는 조건이 중요하다:
//   - **학교 미설정** — 설정돼 있으면 자료를 기다려 3.5초가 나와 하한이 안 보인다
//   - **warm 캐시 · 스로틀 없음** — 느린 조건에서만 재면 하한이 없어도 통과한다
//     (대표님 기계에서 0.1초가 나온 것이 정확히 그 경우다)
//
// 🔴 이 저장소의 Playwright는 CI에서 안 돈다. 이 자리를 건드리는 사람은 직접 돌린다:
//   node functions/test/localStaticServer.js &
//   npx playwright test tests/splashFloor.spec.js
import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:8001";
// 막대 애니메이션 주기. PC/태블릿은 `index.html`의 `aiways-boot-bar 1.15s`,
// 학생 앱은 `authGate.js`의 `FALLBACK_PERIOD_MS = 1100`.
const PC_PERIOD_MS = 1150;
const MOBILE_PERIOD_MS = 1100;
const MINIMUM_TURNS = 2;
// 재는 오차(프레임 단위 관찰 + 페이드)를 감안해 조금 낮춰 잡는다. 하한이
// 아예 없으면 0.1~0.9초가 나오므로 이 값으로도 충분히 갈린다.
const TOLERANCE_MS = 150;

const WATCH_BOOT_SPLASH = () => {
  window.__tl = [];
  const tick = () => {
    const el = document.getElementById("bootSplash");
    let state = "요소없음";
    if (el) {
      const cs = getComputedStyle(el);
      state = cs.display === "none" ? "none" : (Number(cs.opacity) < 0.05 ? "투명" : "보임");
    }
    const prev = window.__tl[window.__tl.length - 1];
    if (!prev || prev[1] !== state) window.__tl.push([Math.round(performance.now()), state]);
    if (performance.now() < 12000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const WATCH_AUTH_GATE = () => {
  window.__tl = [];
  const tick = () => {
    const gate = document.getElementById("authGate");
    const root = document.getElementById("appRoot");
    let state = "게이트없음";
    if (gate) {
      const cs = getComputedStyle(gate);
      state = cs.display === "none" ? "사라짐" : (cs.position === "sticky" ? "띠" : "스플래시");
    }
    const key = `${state}/${root && !root.classList.contains("hidden") ? "앱보임" : "앱가림"}`;
    const prev = window.__tl[window.__tl.length - 1];
    if (!prev || prev[1] !== key) window.__tl.push([Math.round(performance.now()), key]);
    if (performance.now() < 15000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

// warm 캐시로 다시 열고, 학교 설정은 비운다(하한이 드러나는 조건).
async function openWarm(ctx, url, watcher) {
  await ctx.addInitScript(watcher);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto("about:blank");
  await page.goto(url, { waitUntil: "commit", timeout: 120000 });
  return page;
}

function visibleMs(timeline, isShown, isGone) {
  const shown = timeline.find((entry) => isShown(entry[1]));
  const gone = timeline.find((entry) => shown && entry[0] > shown[0] && isGone(entry[1]));
  return shown && gone ? gone[0] - shown[0] : null;
}

for (const [label, width, height, touch] of [
  ["PC", 1440, 900, false],
  ["태블릿 세로", 768, 1024, true],
  ["태블릿 가로", 1180, 820, true],
]) {
  test(`${label} 스플래시가 최소 두 바퀴는 보인다`, async ({ browser }) => {
    test.setTimeout(300000);
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    const page = await openWarm(ctx, `${BASE}/index.html`, WATCH_BOOT_SPLASH);
    await page.waitForTimeout(9000);
    const timeline = await page.evaluate(() => window.__tl);
    const ms = visibleMs(timeline, (s) => s === "보임", (s) => s === "투명" || s === "none");
    console.log(`    ${label}: ${ms}ms (${ms === null ? "-" : (ms / PC_PERIOD_MS).toFixed(2)}바퀴)  ${timeline.map(([t, s]) => t + "=" + s).join(" → ")}`);
    // 🔴 "못 봤다"를 통과로 읽지 않는다 - 그건 화면이 안 떴다는 뜻이다(§21).
    expect(ms, `${label}: 스플래시가 보였다 사라지는 것을 관찰하지 못했습니다 - 화면이 안 떴는지 확인하세요.`).not.toBeNull();
    expect(ms, `${label}: 스플래시가 ${ms}ms만 보였습니다 - 최소 ${MINIMUM_TURNS}바퀴(${PC_PERIOD_MS * MINIMUM_TURNS}ms)는 보여야 합니다.`)
      .toBeGreaterThanOrEqual(PC_PERIOD_MS * MINIMUM_TURNS - TOLERANCE_MS);
    await ctx.close();
  });
}

test("학생 앱 스플래시가 최소 두 바퀴는 보인다", async ({ browser }) => {
  test.setTimeout(300000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await openWarm(ctx, `${BASE}/mobile/index.html`, WATCH_AUTH_GATE);
  await page.waitForTimeout(12000);
  const timeline = await page.evaluate(() => window.__tl);
  const ms = visibleMs(timeline, (s) => s.startsWith("스플래시"), (s) => s.endsWith("앱보임"));
  console.log(`    학생 앱: ${ms}ms (${ms === null ? "-" : (ms / MOBILE_PERIOD_MS).toFixed(2)}바퀴)  ${timeline.map(([t, s]) => t + "=" + s).join(" → ")}`);
  expect(ms, "학생 앱: 스플래시가 걷히는 것을 관찰하지 못했습니다.").not.toBeNull();
  expect(ms, `학생 앱: 스플래시가 ${ms}ms만 보였습니다 - 최소 ${MINIMUM_TURNS}바퀴(${MOBILE_PERIOD_MS * MINIMUM_TURNS}ms)는 보여야 합니다.`)
    .toBeGreaterThanOrEqual(MOBILE_PERIOD_MS * MINIMUM_TURNS - TOLERANCE_MS);
  await ctx.close();
});

test("부팅이 실패해도 상한(5초)이 스플래시를 걷어낸다", async ({ browser }) => {
  test.setTimeout(300000);
  // 🔴 하한을 넣다가 상한을 깨뜨리면 **장애 때 화면이 영영 안 걷힌다.**
  //    app.js를 막아 boot이 끝나지 않는 상태를 만든다.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("**/app.js", (route) => route.abort());
  await ctx.addInitScript(WATCH_BOOT_SPLASH);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: "commit", timeout: 120000 });
  await page.waitForTimeout(9000);
  const timeline = await page.evaluate(() => window.__tl);
  const hidden = timeline.find((entry) => entry[1] === "투명" || entry[1] === "none");
  console.log(`    상한: ${hidden ? hidden[0] + "ms에 걷힘" : "안 걷힘"}  ${timeline.map(([t, s]) => t + "=" + s).join(" → ")}`);
  expect(hidden, "부팅이 실패했는데 스플래시가 걷히지 않았습니다 - 상한이 깨졌습니다.").toBeTruthy();
  expect(hidden[0], `상한이 ${hidden[0]}ms에 걸렸습니다 - 5초 안팎이어야 합니다.`).toBeLessThan(7000);
  await ctx.close();
});
