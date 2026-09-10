// miniapp/3second.html 의 주입 세 자리가 실제로 막혔는가 (CodeQL js/xss-through-dom).
//
// 🔴 이 저장소의 Playwright는 CI에서 돌지 않는다(app.md "검사가 CI에서 실제로 도는
// 범위" 참고). 이 파일도 로컬 전용이므로, 이 자리를 다시 건드리는 사람이 직접
// 돌려야 한다: npx playwright test tests/miniappInjection.spec.js
//
// 🔴 "고쳤다"는 말이 아니라 **안 된다는 실측**이다(§21-2). 고치기 전에 같은
// 페이로드로 실행되는 것을 확인했고(window.__xssRan === 1), 여기서는 같은 것을
// 넣어 **실행되지 않는 것**과 **글자로 그대로 보이는 것**을 함께 본다.
import { test, expect } from "@playwright/test";

const PAYLOAD = '<img src=x onerror=window.__xssRan=1>';   // 괄호 없음 - checkTrash가 '(' 에서 자른다
const QUOTE_NAME = "이건 '작은따옴표' 물건";                  // 864줄 속성 주입이 깨지던 값

async function open(page) {
  await page.goto("/miniapp/3second.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* 막힌 환경 */ } });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
}

test("검색 결과 제목에 넣은 태그가 실행되지 않고 글자로 보인다", async ({ page }) => {
  await open(page);
  await page.fill("#searchInput", PAYLOAD);
  await page.evaluate(() => window.triggerSearch());
  await page.waitForTimeout(800);

  expect(await page.evaluate(() => window.__xssRan === 1), "주입이 실행됐다").toBe(false);
  expect(await page.locator("#resTitle img").count(), "태그로 해석됐다").toBe(0);
  // 학생이 친 글자는 그대로 보여야 한다 - 조용히 사라지면 그것도 버그다.
  await expect(page.locator("#resTitle")).toContainText(PAYLOAD);
});

test("보류함에 등록해도 실행되지 않고, 새로고침 뒤에도 안 된다", async ({ page }) => {
  await open(page);
  await page.fill("#searchInput", PAYLOAD);
  await page.evaluate(() => window.triggerSearch());
  await page.waitForTimeout(600);
  await page.evaluate(() => window.registerHoldItem());
  await page.waitForTimeout(600);
  // 보류함은 다른 탭이라 눌러서 넘어가야 화면에 뜬다.
  await page.evaluate(() => window.switchTab("tab-hold"));
  await page.waitForTimeout(400);

  expect(await page.evaluate(() => window.__xssRan === 1), "등록 직후 실행됐다").toBe(false);
  const card = page.locator(".hold-item-card").first();
  await expect(card, "보류함에 안 들어갔다").toBeVisible();
  await expect(card).toContainText(PAYLOAD);
  expect(await card.locator("img").count(), "카드 안에서 태그로 해석됐다").toBe(0);

  // localStorage에 남아 새로고침마다 다시 그려지는 자리다.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.switchTab("tab-hold"));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__xssRan === 1), "새로고침 뒤 실행됐다").toBe(false);
  expect(await page.locator(".hold-item-card img").count()).toBe(0);
});

test("이름에 작은따옴표가 있어도 '해결 완료' 버튼이 동작한다", async ({ page }) => {
  await open(page);
  await page.evaluate((name) => {
    document.getElementById("directHoldInput").value = name;
    window.addHoldItemDirect();
  }, QUOTE_NAME);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.switchTab("tab-hold"));
  await page.waitForTimeout(400);

  const card = page.locator(".hold-item-card").first();
  await expect(card, "등록이 안 됐다").toBeVisible();
  await expect(card).toContainText(QUOTE_NAME);

  // 예전 구조에서는 이름의 ' 가 onclick 속성을 깨뜨려 버튼이 죽었다.
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await card.locator("[data-hold-resolve]").click();
  await page.waitForTimeout(600);
  expect(errors, "버튼을 눌렀더니 스크립트 오류가 났다").toEqual([]);

  // 확인 모달이 뜨고, 그 안에 이름이 글자 그대로 보여야 한다.
  await expect(page.locator("#customModal"), "확인 모달이 안 떴다 - 버튼이 죽은 것이다").toBeVisible();
  await expect(page.locator("#modalDesc")).toContainText(QUOTE_NAME);
  await page.click("#modalConfirmBtn");
  await page.waitForTimeout(700);
  expect(errors, "확인 후 스크립트 오류가 났다").toEqual([]);
  expect(await page.locator(".hold-item-card").count(), "해결 완료가 동작하지 않았다").toBe(0);
});
