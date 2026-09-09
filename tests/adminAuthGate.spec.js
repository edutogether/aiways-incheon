// 로그인 전에는 발급 화면이 **실제로 안 보여야** 한다.
//
// 2026-09-09에 Bumm님이 관리자 화면을 직접 열어보고 지적하셨다 - 로그인도
// 안 했는데 교사 인증코드 발급 화면이 그대로 보였다. `admin.html`에는
// `<section id="teacherCodeSection" hidden>`이 분명히 적혀 있었는데도.
//
// 원인은 CSS 우선순위였다. 브라우저 기본 스타일의 `[hidden]{display:none}`은
// **작성자 스타일에 진다.** 같은 파일의 `section { display: grid }`가 이겨서,
// hidden 속성이 붙어 있어도 계속 그려지고 있었다.
//
// 🔴 그래서 이 파일은 **속성이 붙어 있는지를 보지 않는다.** 속성은 처음부터
// 붙어 있었고, 그것만 봤다면 이 결함을 못 잡았다. 브라우저가 실제로 계산한
// 값(getComputedStyle의 display, 그리고 화면 차지 여부)을 본다.
import { test, expect } from "@playwright/test";

// 검사가 "대상을 못 찾아서" 조용히 통과하는 것을 막는 하한(COMMON_STANDARDS §21).
// 지금 admin.html에서 hidden으로 시작하는 요소는 발급 섹션 하나다.
const MIN_HIDDEN_ELEMENTS = 1;

test("로그인 전에는 교사 인증코드 발급 화면이 보이지 않는다", async ({ page }) => {
  await page.goto("/admin.html");
  // 스크립트가 다 붙은 뒤를 본다 - admin.js가 DOMContentLoaded에서 화면을
  // 만지므로, 그보다 먼저 재면 "아직 안 그려서" 통과할 수 있다.
  await expect(page.locator("#teacherCodeSchoolQuery")).toHaveCount(1);

  // 로그인 화면은 반대로 반드시 보여야 한다. 이게 없으면 "페이지가 통째로
  // 안 떴다"와 "잘 숨겼다"를 구분하지 못한다.
  await expect(page.locator("#loginSection")).toBeVisible();
  await expect(page.locator("#teacherCodeSection")).toBeHidden();

  // 화면을 실제로 차지하고 있지 않은지까지 본다.
  const box = await page.locator("#teacherCodeSection").boundingBox();
  expect(box, "숨겨진 섹션이 화면에서 자리를 차지하고 있다").toBeNull();
});

test("hidden 속성이 붙은 요소는 전부 실제로 display:none이다", async ({ page }) => {
  // 같은 병에 걸린 자리가 더 있는지 화면 전체로 훑는다. 지금은 하나뿐이지만,
  // 앞으로 hidden을 쓰는 요소가 늘어날 때 같은 실수가 반복되는 것을 막는다.
  await page.goto("/admin.html");
  await expect(page.locator("#teacherCodeSchoolQuery")).toHaveCount(1);

  const shown = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[hidden]"))
      .map((el) => ({ id: el.id || el.tagName.toLowerCase(), display: getComputedStyle(el).display }))
      .filter((entry) => entry.display !== "none")
  );
  const total = await page.locator("[hidden]").count();

  // 하한이 없으면 hidden 요소가 하나도 없을 때 빈 배열끼리 비교해 초록불이 난다.
  expect(total, "hidden 속성이 붙은 요소를 하나도 못 찾았다 - 검사 대상이 사라졌다").toBeGreaterThanOrEqual(MIN_HIDDEN_ELEMENTS);
  expect(shown, "hidden인데 실제로는 그려지고 있는 요소").toEqual([]);
});
