// 학생 앱이 **인증 확인을 기다리지 않고 바로 보이는가**, 그리고 확인이 실패하면
// **그 사실이 화면에 계속 남는가** (2026-09-10).
//
// 왜 바꿨나: 예전에는 `checkStudentProfile()` 왕복이 끝날 때까지 앱을 통째로
// 가려 뒀다. 그런데 실측해 보니 **앱은 2초에 이미 다 그려져 있었고**(요소 368개)
// `display:none`으로 가려져만 있었다. 기다리던 5.5초는 Firebase SDK 285KB와
// reCAPTCHA 2.5MB를 내려받아 초기화하는 시간이다 — 화면을 그리는 데는 필요 없다.
//
// 🔴 **성공 경로는 자동화로 못 잰다.** 자동화 브라우저는 App Check를 통과하지
// 못하므로(reCAPTCHA가 자동화를 거부 — app.md 참고) 이 파일이 재는 것은 전부
// **실패 경로**다. 그래서 오히려 이 파일이 중요하다: 실패했을 때 학생이 그 사실을
// 알 수 있는지가 이 변경의 유일한 위험이기 때문이다.
//
// 🔴 이 저장소의 Playwright는 CI에서 돌지 않는다. 이 자리를 다시 건드리는 사람은
// 직접 돌려야 한다: npx playwright test tests/mobileGateNonBlocking.spec.js
import { test, expect, devices } from "@playwright/test";

const PAGE = "http://127.0.0.1:8001/mobile/index.html";

async function open(browser) {
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  await page.goto(PAGE, { waitUntil: "commit" });
  return { context, page };
}

test("앱이 인증 확인을 기다리지 않고 바로 보인다", async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page } = await open(browser);
  try {
    const started = Date.now();
    // #appRoot가 드러나고 **내용이 실제로 들어찬** 순간.
    await page.waitForFunction(() => {
      const root = document.getElementById("appRoot");
      return !!root && !root.classList.contains("hidden") && root.querySelectorAll("*").length > 50;
    }, null, { timeout: 30000 });
    const shown = Date.now() - started;
    console.log(`    앱이 보이기까지 ${shown}ms`);

    // 🔴 하한이 아니라 상한을 못박는다. 예전 구조에서는 탐침이 끝나야 보였고,
    // 자동화에서는 탐침이 실패로 끝나 **영영 안 보였다.**
    expect(shown, "앱이 보이기까지 너무 오래 걸린다 - 다시 기다리는 구조가 됐는지 확인하라").toBeLessThan(15000);

    // 탐침은 아직 안 끝났어야 정상이다(끝났다면 이 검사가 무의미해진다).
    const probeDone = await page.evaluate(() => {
      const gate = document.getElementById("authGate");
      return !!gate && gate.style.position === "sticky";
    });
    console.log(`    이 시점에 탐침이 이미 끝났나: ${probeDone}`);
  } finally {
    await context.close();
  }
});

test("인증 확인이 실패하면 이유가 화면에 계속 남는다", async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page } = await open(browser);
  try {
    // 자동화에서는 App Check가 막혀 반드시 실패 경로로 간다.
    await page.waitForFunction(() => {
      const gate = document.getElementById("authGate");
      return !!gate && gate.style.position === "sticky";
    }, null, { timeout: 40000 });

    const gate = page.locator("#authGate");
    await expect(gate, "실패했는데 띠가 안 보인다").toBeVisible();
    await expect(gate, "무엇이 안 되는지 안 적혀 있다").toContainText("저장·분석이 안 됩니다");
    await expect(gate.locator("button"), "다시 시도 단추가 없다").toHaveText("다시 시도");

    // 🔴 사라지지 않아야 한다. 토스트였다면 학생이 못 보고 지나친다.
    await page.waitForTimeout(6000);
    await expect(gate, "6초 뒤 띠가 사라졌다 - 학생이 못 보고 지나친다").toBeVisible();

    // 앱은 그 와중에도 쓸 수 있어야 한다(가려지지 않는다).
    const usable = await page.evaluate(() => {
      const root = document.getElementById("appRoot");
      return !!root && !root.classList.contains("hidden") && root.querySelectorAll("button").length > 3;
    });
    expect(usable, "띠가 앱을 다시 가리고 있다").toBe(true);
  } finally {
    await context.close();
  }
});

test("확인이 실패한 상태에서 분석을 누르면 그 자리에서 이유가 나온다", async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page } = await open(browser);
  try {
    await page.waitForFunction(() => {
      const root = document.getElementById("appRoot");
      return !!root && !root.classList.contains("hidden") && root.querySelectorAll("*").length > 50;
    }, null, { timeout: 30000 });

    // 검색으로 분석을 시도한다(사진 없이 갈 수 있는 서버 경로).
    const box = page.locator("#appRoot input[type=text], #appRoot input:not([type])").first();
    await expect(box, "검색 입력칸을 찾지 못했다 - 이 검사가 무엇을 누르는지 다시 봐야 한다").toBeVisible({ timeout: 15000 });
    // 🔴 **내장 품목 12개에 없는 말**이어야 서버로 간다. 처음에 "페트병"으로
    // 눌렀다가 아무 일도 안 일어나 "조용히 실패한다"고 읽을 뻔했는데, 사실은
    // `findItemId`가 내장 목록에서 찾아 **서버를 아예 안 부르는 경로**로 간
    // 것이었다. 검사가 정말 그 길을 지나는지부터 봐야 한다.
    await box.fill("낡은 우산살");
    // Enter가 아니라 돋보기 단추가 방아쇠다.
    await page.click("#searchTriggerBtn");

    // 🔴 조용히 아무 일도 안 일어나면 안 된다. 학생이 "눌렀는데 반응이 없다"가
    // 되는 것이 이 변경에서 가장 나쁜 결과다.
    //
    // 알림은 `#appRoot` 안이 아니라 **body 바로 아래**에 붙는다(ToastLayer가
    // createPortal로 옮긴다 - 카드의 overflow에 갇히지 않게 하려는 원본 동작).
    // 처음에 `#appRoot` 안에서 찾다가 못 찾고, 대신 숨어 있던 장식 글자를
    // 잡을 뻔했다.
    const toast = page.locator("body > .fixed.bottom-6").first();
    await expect(toast, "분석이 막혔는데 아무 말도 안 나온다").toBeVisible({ timeout: 25000 });
    console.log(`    분석 시도 뒤 화면 문구: ${(await toast.textContent() || "").trim().slice(0, 60)}`);
  } finally {
    await context.close();
  }
});
