// 발급 화면이 **스스로 설명하는지**.
//
// 2026-09-09에 Bumm님이 화면을 열고 "어디서부터 뭘 써야 돼? 그리고 회전은
// 뭔 말이야?"라고 하셨다. 만든 사람만 아는 말과 순서로 되어 있었다는 뜻이다.
// 여기서 지키는 것은 화면의 모양이 아니라 **처음 여는 사람이 따라갈 수 있는
// 구조**다 - 단계가 보이는지, 각 칸이 무엇을 받는지 말하는지, 개발 용어가
// 남아 있지 않은지.
import { test, expect } from "@playwright/test";

async function openForm(page) {
  await page.goto("/admin.html");
  // 이 구역은 로그인해야 보인다. 화면상으로만 열어서 확인한다 - 실제 권한은
  // 전부 서버의 superadmin 클레임 검증으로 강제된다(에뮬레이터로 실행 확인함).
  await page.evaluate(() => document.getElementById("teacherCodeSection")?.removeAttribute("hidden"));
  await expect(page.locator("#teacherCodeSchoolPreset")).toBeVisible();
}

test("학교는 골라서 넣고, 목록에 없는 학교는 직접 입력으로 넘어간다", async ({ page }) => {
  await openForm(page);
  // 첫 칸이 "학교 코드(NEIS 표준학교코드, 숫자)"였다. 그 숫자를 아는 사람은 없다.
  const labels = await page.$$eval("#teacherCodeSchoolPreset option", (nodes) => nodes.map((n) => n.textContent.trim()));
  expect(labels.filter((text) => /\(\d{7}\)$/.test(text)).length, "등록된 학교가 목록에 없다").toBeGreaterThanOrEqual(4);
  expect(labels.some((text) => text.includes("직접 입력")), "목록에 없는 학교를 다루는 길이 사라졌다").toBe(true);

  // 학교를 고르면 숫자 칸은 나오지 않는다.
  await page.selectOption("#teacherCodeSchoolPreset", "7361073");
  await expect(page.locator("#teacherCodeSchoolId")).toBeHidden();
  // 직접 입력을 고를 때만 나온다.
  await page.selectOption("#teacherCodeSchoolPreset", "__manual__");
  await expect(page.locator("#teacherCodeSchoolId")).toBeVisible();
});

test("추가 코드는 체크박스 바로 아래 칸에 적는다", async ({ page }) => {
  await openForm(page);
  await page.selectOption("#teacherCodeSchoolPreset", "7321030"); // 서흥초
  await page.selectOption("#teacherCodeGrade", "1");
  await page.selectOption("#teacherCodeClassNum", "3");
  await expect(page.locator("#teacherCodeValue")).toHaveValue("SEOHEUNG103");

  // 평소에는 추가 코드 칸이 없다.
  await expect(page.locator("#teacherCodeExtra")).toBeHidden();
  await page.check("#teacherCodeAddMode");
  await expect(page.locator("#teacherCodeExtra")).toBeVisible();
  await expect(page.locator("#teacherCodeLabel")).toBeVisible();

  // 🔴 자동 채움이 추가 코드를 덮어쓸 길이 **구조적으로** 없어야 한다.
  // 예전에는 같은 칸을 썼기 때문에, 개인 코드를 적어두고 반을 한 번 다시
  // 건드리면 규칙 코드로 바뀌어 엉뚱한 것이 등록됐다.
  await page.fill("#teacherCodeExtra", "EDU2G SANGHYUN");
  await page.selectOption("#teacherCodeClassNum", "2");
  await expect(page.locator("#teacherCodeExtra")).toHaveValue("EDU2G SANGHYUN");
  // 위 칸은 그 반의 규칙 코드를 보여주는 참고용이라 읽기 전용이다.
  await expect(page.locator("#teacherCodeValue")).toHaveJSProperty("readOnly", true);
  await expect(page.locator("#teacherCodeValue")).toHaveValue("SEOHEUNG102");
});

test("개발 용어(회전)가 화면에 남아 있지 않다", async ({ page }) => {
  await openForm(page);
  // "회전"은 rotate를 그대로 옮긴 말이라 아무도 모른다. 버튼은 실제로
  // 일어나는 일을 말해야 한다.
  const text = await page.locator("#teacherCodeSection").innerText();
  expect(text, "화면에 '회전'이 남아 있다").not.toContain("회전");
  await expect(page.locator("#teacherCodeSubmitBtn")).not.toHaveText(/\//);
  // 단계가 보여야 한다 - 칸 네 개가 나란히 있으면 어디서 시작하는지 모른다.
  const steps = await page.$$eval("#teacherCodeSection .step", (nodes) => nodes.map((n) => n.textContent.trim()));
  expect(steps.length, "단계 표시가 사라졌다").toBeGreaterThanOrEqual(3);
});
