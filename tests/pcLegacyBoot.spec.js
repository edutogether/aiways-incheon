// S4: 리액트가 `app.js`의 진입점을 **실제로 부르는가**, 그리고 원본은 그대로인가.
//
// 🔴 처음에 학년 <select>의 <option> 개수로 확인하려다 틀렸다. **그 값은 boot이
// 안 돌아도 4개다** — 마크업에 이미 들어 있기 때문이다. 그대로 뒀으면 완전히
// 죽은 화면에서도 초록불이 났다. "이 검사가 성공했다"가 아니라 **"이 검사의
// 성공이 무엇을 증명하는가"**를 봐야 한다.
//
// 그래서 boot이 돈 것과 안 돈 것을 **실제로 재서** 갈리는 값만 골랐다:
//
//   지표                     안 돎    돎
//   ---------------------   ------  ------
//   boot 호출 횟수            0       1
//   부트 스플래시             grid    none    ← 안 돌면 학생이 5초간 로고만 본다
//   [data-school-observed]   "0"     "214"
//   도넛 --pct                0       77.6
//   .combo-chart 자식 수      54      72
//   #gradeSelect option       4       4      ← **갈리지 않는다. 쓰면 안 된다**
import { test, expect } from "@playwright/test";

const SEED = () => {
  try {
    localStorage.setItem("aiways_pc_dashboard_school_v1", "7361073");
    localStorage.setItem("aiways_pc_dashboard_school_name_v1", "인천청라초등학교");
    localStorage.setItem("aiways_pc_dashboard_classnum_v1", "1");
  } catch { /* 저장이 막힌 환경 */ }
};

// 🔴 boot이 **몇 번** 불렸는지 직접 기록한다. 화면 값만 보면 "돌긴 돌았다"까지만
// 알 수 있고, StrictMode 때문에 두 번 도는 경우(리스너가 겹친다)를 못 본다.
const COUNT_BOOT = () => {
  window.__bootCalls = 0;
  let store;
  Object.defineProperty(window, "AIWaysPcDashboard", {
    configurable: true,
    get() { return store; },
    set(value) {
      store = value && typeof value.boot === "function"
        ? { ...value, boot: (...args) => { window.__bootCalls += 1; return value.boot(...args); } }
        : value;
    }
  });
};

const measure = () => ({
  bootCalls: window.__bootCalls,
  flag: window.__AIWAYS_PC_REACT_BOOT === true,
  hasEntry: typeof window.AIWaysPcDashboard?.boot === "function",
  splashDisplay: document.getElementById("bootSplash")?.style.display ?? "(없음)",
  schoolObserved: (document.querySelector("[data-school-observed]")?.textContent || "").trim(),
  donutStyle: document.querySelector(".donut")?.getAttribute("style") || "",
  chartNodes: document.querySelectorAll(".combo-chart *").length
});

async function load(browser, target) {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:8001",
    viewport: { width: 1440, height: 900 }
  });
  await context.addInitScript(SEED);
  await context.addInitScript(COUNT_BOOT);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(target ? `/${target}/index.html` : "/index.html", { waitUntil: "load" });
  await page.waitForTimeout(4000);
  return { context, page, errors };
}

// 화면이 실제로 채워졌는가. **누가 불렀는지는 여기서 보지 않는다** - 원본과
// 전환본이 서로 다른 경로로 부르기 때문이다(아래 각 검사에서 따로 본다).
function expectBooted(got, where) {
  expect(got.hasEntry, `${where}: app.js가 진입점을 안 내놨다 - 스크립트가 404거나 순서가 어긋났다`).toBe(true);
  expect(got.splashDisplay, `${where}: 부트 스플래시가 안 걷혔다 - 화면이 안 채워졌다는 뜻이다`).toBe("none");
  expect(got.schoolObserved, `${where}: 학교 관찰 수가 안 채워졌다`).not.toBe("0");
  expect(Number(got.schoolObserved), `${where}: 학교 관찰 수가 숫자가 아니다`).toBeGreaterThan(0);
  expect(got.donutStyle, `${where}: 도넛이 0인 채다`).not.toContain("--pct: 0;");
  expect(got.chartNodes, `${where}: 매립지 차트가 다시 안 그려졌다`).toBeGreaterThan(60);
}

test("전환본: 리액트가 그린 뒤 app.js가 실제로 돌아 화면을 채운다", async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page, errors } = await load(browser, "pc-next");
  try {
    const got = await page.evaluate(measure);
    expect(got.flag, "pcReactBoot.js가 안 실렸다 - 깃발이 없으면 app.js가 리액트보다 먼저 돈다").toBe(true);
    // 🔴 전환본은 **밖에서** 부른다. 노출된 진입점을 거치므로 계수기에 잡힌다.
    // 정확히 한 번이어야 한다 - StrictMode가 effect를 두 번 부를 때 리스너가
    // 겹치는 것을 여기서 잡는다.
    expect(got.bootCalls, "전환본: 리액트가 진입점을 정확히 한 번 불러야 한다").toBe(1);
    expectBooted(got, "전환본");
    expect(errors.filter((e) => /AIWaysPcDashboard|진입점/.test(e)), "진입점을 못 찾았다는 오류").toEqual([]);
  } finally {
    await context.close();
  }
});

test("원본: 깃발이 없으면 예전처럼 스스로 돈다 (라이브는 S5까지 그대로)", async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page } = await load(browser, "");
  try {
    const got = await page.evaluate(measure);
    expect(got.flag, "원본에 전환용 깃발이 새어 들어갔다 - 그러면 라이브가 영영 안 뜬다").toBe(false);
    // 🔴 원본은 **안에서** 스스로 부른다(클로저를 직접 호출). 노출된 진입점을
    // 거치지 않으므로 계수기에 안 잡히는 것이 정상이고, 그런데도 화면은 채워져
    // 있어야 한다. 여기가 1이 되면 원본이 전환본 경로로 도는 것이라 회귀다.
    expect(got.bootCalls, "원본이 밖에서 불린 것처럼 보인다 - 자동 실행 경로가 바뀌었다").toBe(0);
    expectBooted(got, "원본");
  } finally {
    await context.close();
  }
});
