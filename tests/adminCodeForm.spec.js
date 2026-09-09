// 발급 화면이 **스스로 설명하는지**.
//
// 2026-09-09에 Bumm님이 화면을 열고 "어디서부터 뭘 써야 돼?"라고 하셨고,
// 버튼에 적힌 개발 용어도 무슨 말인지 물으셨다. 만든 사람만 아는 말과
// 순서로 되어 있었다는 뜻이다. 여기서 지키는 것은 화면의 모양이 아니라
// **처음 여는 사람이 따라갈 수 있는 구조**다 - 단계가 보이는지, 각 칸이
// 무엇을 받는지 말하는지, 사람이 모르는 값을 외우게 하지 않는지.
import { test, expect } from "@playwright/test";
import { openAdmin, pickSchool } from "./adminHarness.js";

test("학교는 이름으로 찾고, NEIS 코드를 사람이 칠 일은 없다", async ({ page }) => {
  await openAdmin(page);
  // 첫 칸이 "학교 코드(NEIS 표준학교코드, 숫자)"였다. 그 숫자를 아는 사람은
  // 없다. 화면에 보이는 입력칸 중 코드를 받는 칸이 하나도 없어야 한다.
  const typable = await page.$$eval("#teacherCodeSection input", (nodes) =>
    nodes.filter((n) => n.type !== "hidden" && !n.hidden && n.offsetParent !== null).map((n) => n.id));
  expect(typable.length, "입력칸을 하나도 못 찾았다 - 검사 대상이 사라졌다").toBeGreaterThan(0);
  expect(typable, "NEIS 코드를 직접 치는 칸이 남아 있다").not.toContain("teacherCodeSchoolId");

  // 두 글자부터 찾아서 목록에서 고른다(학생 앱과 같은 방식).
  await page.fill("#teacherCodeSchoolQuery", "인천청라");
  const results = page.locator("#teacherCodeSchoolResults button");
  await expect(results.first()).toBeVisible();
  await results.filter({ hasText: "인천청라초등학교" }).click();
  await expect(page.locator("#teacherCodeSchoolChosen")).toContainText("인천청라초등학교");
  // 고른 학교의 코드는 화면이 아니라 hidden 칸에만 담긴다.
  await expect(page.locator("#teacherCodeSchoolId")).toHaveValue("7361073");
});

test("학교 검색이 실패하면 조용히 빈 목록을 두지 않는다", async ({ page }) => {
  // COMMON_STANDARDS §21 - "검색이 안 되는 것"과 "그런 학교가 없는 것"이
  // 화면에서 똑같아 보이면 안 된다.
  await openAdmin(page, { searchStatus: 401 });
  await page.fill("#teacherCodeSchoolQuery", "인천청라");
  await expect(page.locator("#teacherCodeSchoolStatus")).toContainText("로그인");
  await expect(page.locator("#teacherCodeSchoolResults button")).toHaveCount(0);
});

test("추가 코드는 체크박스 바로 아래 칸에 적는다", async ({ page }) => {
  await openAdmin(page);
  await pickSchool(page, "인천서흥초등학교");
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

test("단계가 보이고, 개발 용어가 화면에 남아 있지 않다", async ({ page }) => {
  await openAdmin(page);
  // "회전"은 rotate를 그대로 옮긴 말이라 아무도 모른다. 버튼은 실제로
  // 일어나는 일을 말해야 한다.
  const text = await page.locator("#teacherCodeSection").innerText();
  expect(text.length, "화면 글자를 못 읽었다").toBeGreaterThan(0);
  expect(text, "화면에 '회전'이 남아 있다").not.toContain("회전");
  await expect(page.locator("#teacherCodeSubmitBtn")).not.toHaveText(/\//);
  // 단계가 보여야 한다 - 칸이 나란히 있기만 하면 어디서 시작하는지 모른다.
  const steps = await page.$$eval("#teacherCodeSection .step", (nodes) => nodes.map((n) => n.textContent.trim()));
  expect(steps.length, "단계 표시가 사라졌다").toBeGreaterThanOrEqual(3);
  // 제목이 카드 안에 있어야 한다(예전엔 카드 밖에 h1 하나만 떠 있었다).
  await expect(page.locator("#teacherCodeSection .card-title h1")).toBeVisible();
});

test("학교·학년·반이 다 정해지기 전에는 발급 버튼을 누를 수 없다", async ({ page }) => {
  // 그 전에는 이 반에 코드가 있는지 물어볼 수 없어서 버튼이 "발급인지 교체인지"
  // 정직하게 말할 수 없다. 눌리는 버튼이 애매한 말을 하고 있는 것이 제일 나쁘다.
  await openAdmin(page);
  const submit = page.locator("#teacherCodeSubmitBtn");
  await expect(submit).toBeDisabled();

  await pickSchool(page, "인천마전초등학교");
  await expect(submit, "학년·반을 아직 안 골랐다").toBeDisabled();
  await page.selectOption("#teacherCodeGrade", "6");
  await expect(submit, "반을 아직 안 골랐다").toBeDisabled();
  await page.selectOption("#teacherCodeClassNum", "7");
  await expect(submit).toBeEnabled();
  await expect(page.locator("#teacherCodeValue")).toHaveValue("MAJEON607");
});
