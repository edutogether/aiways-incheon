// 학년·반 드롭다운 (2026-09-11, 지시 Bumm - "운영체제 기본 선택 상자라 촌스럽다").
//
// 🔴 여기서 지키려는 것은 **모양이 아니라 잃지 않아야 할 것들**이다:
//   - 값의 주인은 여전히 `<select>`다. 껍데기만 바꾼 것이라 `app.js`가 읽는 값이
//     그대로여야 한다 - 반이 틀리면 그 반 선생님이 아예 못 들어간다.
//   - 키보드로 끝까지 쓸 수 있어야 한다(기본 `<select>`가 하던 만큼).
//   - 두 상자가 같은 크기이고 모달 밖으로 나가지 않아야 한다(대표님 지적 1·3).
import { test, expect } from "@playwright/test";

const BASE = process.env.AIWAYS_STATIC_BASE || "http://127.0.0.1:8011";

async function openClassStep(page) {
  await page.goto(`${BASE}/index.html`, { waitUntil: "commit" });
  await page.waitForSelector("#dashboardSchoolModal[open]", { timeout: 25000 });
  await page.waitForFunction(
    () => performance.getEntriesByType("resource").some((e) => /school-list\.tsv/.test(e.name) && e.responseEnd > 0),
    { timeout: 20000 });
  await page.evaluate(() => {
    const input = document.getElementById("dashboardSchoolInput");
    input.value = "인천서흥";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#dashboardSchoolResults button").first().click();
  await page.waitForSelector("#dashboardSchoolStepClass:not([hidden])");
}

test("껍데기를 씌워도 값의 주인은 <select>다", async ({ page }) => {
  await openClassStep(page);
  const buttons = page.locator("#dashboardSchoolStepClass .aiways-picker-button");
  // 🔴 껍데기가 아예 안 붙었으면 아래 확인이 전부 무의미하다. 개수부터 못박는다.
  await expect(buttons, "드롭다운 껍데기가 안 붙었습니다").toHaveCount(2);

  await buttons.first().click();
  await page.locator(".aiways-picker-list li", { hasText: "3학년" }).first().click();
  // 화면에 보이는 것과 <select>가 가진 값이 같아야 한다
  await expect(buttons.first()).toHaveText(/3학년/);
  expect(await page.locator("#dashboardGradeSelect").inputValue()).toBe("3");
});

test("키보드만으로 고를 수 있다", async ({ page }) => {
  await openClassStep(page);
  const gradeButton = page.locator("#dashboardSchoolStepClass .aiways-picker-button").first();
  await gradeButton.focus();
  await page.keyboard.press("Enter");                       // 연다
  await expect(gradeButton).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");                   // 1학년 -> 2학년
  await page.keyboard.press("Enter");                       // 고른다
  await expect(gradeButton).toHaveAttribute("aria-expanded", "false");
  expect(await page.locator("#dashboardGradeSelect").inputValue()).toBe("2");

  // Esc로 닫으면 값이 안 바뀌어야 한다
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  expect(await page.locator("#dashboardGradeSelect").inputValue()).toBe("2");
});

test("스크린리더가 읽을 것이 붙어 있다", async ({ page }) => {
  await openClassStep(page);
  const gradeButton = page.locator("#dashboardSchoolStepClass .aiways-picker-button").first();
  await expect(gradeButton).toHaveAttribute("role", "combobox");
  await expect(gradeButton).toHaveAttribute("aria-haspopup", "listbox");
  // 원래 <select>가 갖고 있던 이름을 물려받아야 한다
  await expect(gradeButton).toHaveAttribute("aria-label", "학년");
  await gradeButton.click();
  await expect(page.locator("#dashboardSchoolStepClass .aiways-picker-list").first()).toHaveAttribute("role", "listbox");
  // 지금 어디에 있는지를 알려준다
  await expect(gradeButton).toHaveAttribute("aria-activedescendant", /option-\d+/);
});

test("🔴 두 상자가 같은 크기이고 모달 밖으로 나가지 않는다", async ({ page }) => {
  await openClassStep(page);
  // 학년을 고르면 반 목록이 짧아진다 - 예전에는 이때 두 상자 크기가 달라졌다
  // (실측 학년 198px vs 반 112px).
  await page.evaluate(() => {
    const grade = document.getElementById("dashboardGradeSelect");
    grade.value = "1";
    grade.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const sizes = await page.evaluate(() => {
    const card = document.querySelector(".school-setup-modal").getBoundingClientRect();
    return [...document.querySelectorAll("#dashboardSchoolStepClass .aiways-picker-button")].map((el) => {
      const box = el.getBoundingClientRect();
      return { w: Math.round(box.width), left: Math.round(box.left - card.left), right: Math.round(card.right - box.right) };
    });
  });
  expect(sizes.length, "잴 상자가 없습니다").toBe(2);
  expect(sizes[0].w, `학년 ${sizes[0].w}px / 반 ${sizes[1].w}px - 크기가 다릅니다`).toBe(sizes[1].w);
  for (const box of sizes) {
    expect(box.left, `상자가 모달 왼쪽으로 ${-box.left}px 나갔습니다`).toBeGreaterThanOrEqual(0);
    expect(box.right, `상자가 모달 오른쪽으로 ${-box.right}px 나갔습니다`).toBeGreaterThanOrEqual(0);
  }
});
