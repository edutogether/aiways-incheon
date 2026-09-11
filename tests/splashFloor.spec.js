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

// 🔴 **CSS 상태가 아니라 "화면 맨 위에 무엇이 있는가"를 본다.**
//
// 2026-09-11에 이 검사가 초록불인데 실제 첫 방문에서는 스플래시가 29ms만 보였다.
// 원인은 이 검사가 `getComputedStyle(#bootSplash)`만 봤기 때문이다 — 요소는
// `보임`이지만 그 위를 **top-layer `<dialog>`가 덮고 있었다**(`showModal()`은
// z-index로 못 이긴다). **요소가 보이는 것과 사용자가 보는 것은 다르다.**
// 그래서 `elementFromPoint`로 한가운데에 실제로 무엇이 있는지 같이 본다.
const WATCH_BOOT_SPLASH = () => {
  window.__tl = [];
  const tick = () => {
    const el = document.getElementById("bootSplash");
    let state = "요소없음";
    if (el) {
      const cs = getComputedStyle(el);
      state = cs.display === "none" ? "none" : (Number(cs.opacity) < 0.05 ? "투명" : "보임");
    }
    const top = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
    const onTop = !top ? "-"
      : top.closest("#bootSplash") ? "스플래시"
      : top.closest("dialog[open]") ? "모달"
      : "화면";
    const key = `${state}|맨위=${onTop}`;
    const prev = window.__tl[window.__tl.length - 1];
    if (!prev || prev[1] !== key) window.__tl.push([Math.round(performance.now()), key]);
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
    // 🔴 "스플래시가 **맨 위에 있는** 동안"을 잰다. 요소가 살아 있어도 top-layer
    //    모달에 덮이면 사용자는 못 본다 - 그게 이 검사가 한 번 놓친 것이다.
    const ms = visibleMs(timeline, (s) => s === "보임|맨위=스플래시", (s) => !s.startsWith("보임|맨위=스플래시"));
    console.log(`    ${label}: ${ms}ms (${ms === null ? "-" : (ms / PC_PERIOD_MS).toFixed(2)}바퀴)  ${timeline.map(([t, s]) => t + "=" + s).join(" → ")}`);
    // 🔴 "못 봤다"를 통과로 읽지 않는다 - 그건 화면이 안 떴다는 뜻이다(§21).
    expect(ms, `${label}: 스플래시가 맨 위에 있다가 사라지는 것을 관찰하지 못했습니다 - 화면이 안 떴는지 확인하세요.`).not.toBeNull();
    expect(ms, `${label}: 스플래시가 화면 맨 위에 ${ms}ms만 있었습니다 - 최소 ${MINIMUM_TURNS}바퀴(${PC_PERIOD_MS * MINIMUM_TURNS}ms)는 보여야 합니다. 무언가가 덮고 있는지(top-layer <dialog> 등) 확인하세요.`)
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

test("첫 방문 순서 — 스플래시 → 메인+모달 같이 → 모달 해제 후 밝아짐", async ({ browser }) => {
  test.setTimeout(300000);
  // 🔴 이 순서가 사양이다(2026-09-11 Bumm님). 예전에는 모달이 64ms에 열려
  //    스플래시를 덮었고, 화면에는 어두운 배경과 흰 모달만 보였다.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await openWarm(ctx, `${BASE}/index.html`, WATCH_BOOT_SPLASH);
  // 모달이 언제 열리는지 따로 본다.
  await page.evaluate(() => {
    window.__modalAt = null;
    const tick = () => {
      const d = document.getElementById("dashboardSchoolModal");
      if (window.__modalAt === null && d && d.hasAttribute("open")) window.__modalAt = Math.round(performance.now());
      if (performance.now() < 12000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(9000);
  const timeline = await page.evaluate(() => window.__tl);
  const modalAt = await page.evaluate(() => window.__modalAt);
  const splashStart = timeline.find((e) => e[1] === "보임|맨위=스플래시");
  const covered = timeline.find((e) => splashStart && e[0] > splashStart[0] && !e[1].startsWith("보임|맨위=스플래시"));
  console.log(`    스플래시 ${splashStart?.[0]}ms~${covered?.[0]}ms · 모달 ${modalAt}ms · ${timeline.map(([t, s]) => t + "=" + s).join(" → ")}`);

  expect(splashStart, "스플래시가 맨 위에 온 적이 없습니다.").toBeTruthy();
  expect(modalAt, "학교 모달이 열리지 않았습니다 - 학교를 고를 방법이 사라집니다.").not.toBeNull();
  // ① 스플래시가 먼저, 두 바퀴 이상
  expect(modalAt - splashStart[0],
    `모달이 스플래시 시작 ${modalAt - splashStart[0]}ms 만에 열렸습니다 - 스플래시를 덮습니다. 최소 ${PC_PERIOD_MS * MINIMUM_TURNS}ms 뒤여야 합니다.`)
    .toBeGreaterThanOrEqual(PC_PERIOD_MS * MINIMUM_TURNS - TOLERANCE_MS);
  // ② 모달이 열릴 때 대시보드가 **이미 그려져 있어야** 한다
  const dashboardReady = await page.evaluate(() => {
    const grid = document.querySelector("#dashboard .dashboard-grid");
    return !!grid && grid.querySelectorAll(":scope > article, :scope > .panel").length >= 4;
  });
  expect(dashboardReady, "모달이 열렸는데 뒤에 대시보드가 없습니다 - 어두운 화면에 모달만 뜹니다.").toBe(true);
  // ③ 모달을 닫으면 밝아진다(backdrop이 사라진다)
  await page.evaluate(() => {
    const d = document.getElementById("dashboardSchoolModal");
    if (d && d.close) d.close();
    document.body.classList.remove("modal-open");
  });
  await page.waitForTimeout(800);
  const afterClose = await page.evaluate(() => {
    const d = document.getElementById("dashboardSchoolModal");
    const top = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
    return { open: d ? d.hasAttribute("open") : false, top: top ? (top.closest("dialog[open]") ? "모달" : "화면") : "-" };
  });
  expect(afterClose.open, "모달을 닫았는데 열린 상태입니다.").toBe(false);
  expect(afterClose.top, "모달을 닫았는데 화면 맨 위가 여전히 모달입니다.").toBe("화면");
  await ctx.close();
});

test("애니메이션이 멈춰 있어도 상한이 스플래시를 걷어낸다", async ({ browser }) => {
  test.setTimeout(300000);
  // 🔴 2026-09-11에 실제로 이렇게 깨져 있었다. 하한은 막대 애니메이션의
  //    `currentTime`으로 계산하는데, hide()가 그 값이 0이 될 때까지 **자기를
  //    다시 부르는** 구조였다. 애니메이션이 안 흐르면 그 값이 영원히 줄지 않아
  //    hide()가 무한히 자기를 부르고, **상한(5초)마저 같은 루프로 들어가**
  //    스플래시가 영영 안 걷혔다.
  //
  //    애니메이션이 안 흐르는 실제 상황: **탭이 백그라운드로 내려가면** 브라우저가
  //    애니메이션을 멈춘다. 학생이 부팅 중에 다른 앱을 보다 돌아오면 스플래시에
  //    갇힌다. 모션 최소화 설정, 테스트의 가짜 시계도 같다.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(WATCH_BOOT_SPLASH);
  // 화면에 붙는 애니메이션을 전부 멈춘 채로 시작한다 - currentTime이 안 흐른다.
  await ctx.addInitScript(() => {
    const freeze = () => {
      const list = document.getAnimations ? document.getAnimations() : [];
      list.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch { /* 멈출 수 없는 것은 둔다 */ } });
      return list.length;
    };
    let frozen = 0;
    const timer = setInterval(() => { frozen = Math.max(frozen, freeze()); }, 30);
    setTimeout(() => clearInterval(timer), 9000);
    Object.defineProperty(window, "__frozenCount", { get: () => frozen });
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: "commit", timeout: 120000 });
  await page.waitForTimeout(9000);
  const timeline = await page.evaluate(() => window.__tl);
  const frozen = await page.evaluate(() => window.__frozenCount);
  // 🔴 하한을 고정값으로 못박는다 - 멈출 애니메이션이 하나도 없었다면 이 검사는
  //    아무것도 확인하지 않은 것이다(COMMON_STANDARDS §21).
  expect(frozen, "멈춘 애니메이션이 0개입니다 - 이 검사가 아무것도 확인하지 않았습니다.").toBeGreaterThan(0);
  const hidden = timeline.find((entry) => entry[1].startsWith("투명") || entry[1].startsWith("none"));
  console.log(`    애니메이션 ${frozen}개 멈춤 → ${hidden ? hidden[0] + "ms에 걷힘" : "🔴 안 걷힘"}`);
  expect(hidden, "애니메이션이 멈춰 있으니 스플래시가 영영 안 걷힙니다 - 상한이 하한 계산을 거치고 있습니다.").toBeTruthy();
  expect(hidden[0], `${hidden[0]}ms에 걷혔습니다 - 상한 5초 안팎이어야 합니다.`).toBeLessThan(7000);
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
  // 🔴 키 형식이 `상태|맨위=…`라 앞부분으로 본다. 예전에 `=== "투명"`으로 뒀다가
  //    키 형식을 바꾼 뒤 **영영 안 맞아 거짓 실패**가 났다.
  const hidden = timeline.find((entry) => entry[1].startsWith("투명") || entry[1].startsWith("none"));
  console.log(`    상한: ${hidden ? hidden[0] + "ms에 걷힘" : "안 걷힘"}  ${timeline.map(([t, s]) => t + "=" + s).join(" → ")}`);
  expect(hidden, "부팅이 실패했는데 스플래시가 걷히지 않았습니다 - 상한이 깨졌습니다.").toBeTruthy();
  expect(hidden[0], `상한이 ${hidden[0]}ms에 걸렸습니다 - 5초 안팎이어야 합니다.`).toBeLessThan(7000);
  await ctx.close();
});
