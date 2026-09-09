// 관리자 화면에서 **실제로 있는 반만** 고를 수 있는지.
//
// 없는 반의 코드가 발급되면 아무도 쓸 수 없는 코드가 생기고, 현장에서 왜 안
// 되는지 아무도 모른다 - 코드가 틀린 것도 서버가 고장난 것도 아니고 그냥 그
// 반이 없다. 그래서 화면에서 아예 못 고르게 막는 것이 이 기능의 목적이고,
// 이 파일이 그게 실제로 막히는지 본다.
//
// 학급 수 출처는 NEIS 학급정보이고 schoolClassCounts.js에 굳혀 뒀다
// (만드는 것은 scripts/fetchSchoolClassCounts.js).
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

// 데이터 파일을 노드 쪽에서도 읽어 기대값으로 쓴다. 화면이 스스로 만든 값을
// 화면에서 확인하면 아무것도 검증하지 못한다(COMMON_STANDARDS §21-7 - 기대치는
// 감시 대상 바깥에서 온다). 여기서는 같은 파일이지만, **화면이 계산한 결과**가
// 아니라 **원본 자료**를 기준으로 삼는다.
function loadClassCounts() {
  const source = readFileSync("schoolClassCounts.js", "utf8");
  const start = source.indexOf("{", source.indexOf("window.AIWaysSchoolClassCounts"));
  return JSON.parse(source.slice(start, source.lastIndexOf("}") + 1));
}

async function openAdmin(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/admin.html");
  // 이 구역은 로그인해야 보인다. 화면상으로만 열어서 확인한다 - 실제 권한은
  // 전부 서버의 superadmin 클레임 검증으로 강제되므로 우회가 아니다.
  await page.evaluate(() => document.getElementById("teacherCodeSection")?.removeAttribute("hidden"));
  return errors;
}

const optionValues = (page, id) =>
  page.$$eval(`#${id} option`, (nodes) => nodes.map((n) => n.value).filter(Boolean));

test("학급 수 자료가 실제로 들어 있다", () => {
  const data = loadClassCounts();
  // 자료가 비면 아래 화면 검사들이 "고를 게 없다"는 이유로 조용히 통과할 수
  // 있다. 개수부터 못박는다.
  expect(data.schools.length, "학교가 하나도 없다").toBeGreaterThanOrEqual(4);
  expect(data.source, "출처가 비었다").toBeTruthy();
  expect(data.fetchedAt, "받은 시각이 비었다").toBeTruthy();
  for (const school of data.schools) {
    const counts = Object.values(school.classesByGrade);
    expect(counts.length, `${school.short}의 학년 수`).toBe(6);
    expect(counts.some((n) => n > 0), `${school.short}의 학급 수가 전부 0이다`).toBe(true);
  }
});

test("학교와 학년을 고르면 그 학년에 실제로 있는 반만 뜬다", async ({ page }) => {
  const data = loadClassCounts();
  const errors = await openAdmin(page);

  for (const school of data.schools) {
    await page.selectOption("#teacherCodeSchoolPreset", school.schoolId);
    for (const [grade, count] of Object.entries(school.classesByGrade)) {
      if (!count) continue;
      await page.selectOption("#teacherCodeGrade", grade);
      const classes = await optionValues(page, "teacherCodeClassNum");
      expect(classes, `${school.short} ${grade}학년`).toEqual(
        Array.from({ length: count }, (_, i) => String(i + 1))
      );
    }
  }
  expect(errors, "페이지 오류").toEqual([]);
});

test("반을 고르면 인증코드가 규칙대로 채워진다", async ({ page }) => {
  await openAdmin(page);
  await page.selectOption("#teacherCodeSchoolPreset", "7361073"); // 인천청라초
  await page.selectOption("#teacherCodeGrade", "2");
  await page.selectOption("#teacherCodeClassNum", "7");
  // <학교영문><학년><반 두 자리>. 청라는 [청나]로 소리나므로 CHEONGNA다.
  await expect(page.locator("#teacherCodeValue")).toHaveValue("CHEONGNA207");
});

test("자료에 없는 학교는 넓게 보여주되 확인되지 않았다고 알린다", async ({ page }) => {
  await openAdmin(page);
  // 목록에 없는 학교를 다루는 길("직접 입력")은 없애지 않았다 - 4개교 말고
  // 다른 학교의 코드를 발급할 일이 생길 수 있다.
  await page.selectOption("#teacherCodeSchoolPreset", "__manual__");
  await expect(page.locator("#teacherCodeSchoolId")).toBeVisible();
  await page.locator("#teacherCodeSchoolId").fill("9999999");
  await page.selectOption("#teacherCodeGrade", "2");
  const classes = await optionValues(page, "teacherCodeClassNum");
  expect(classes.length, "자료 없는 학교도 고를 수는 있어야 한다").toBe(15);
  await expect(page.locator("#teacherCodeClassSource")).toContainText("학급 수 자료가 없습니다");
});

test("학급 수 자료를 못 읽으면 빈 목록을 보여주지 않고 발급을 막는다", async ({ page }) => {
  // COMMON_STANDARDS §21 - 자료를 못 읽었을 때 조용히 빈 목록을 보여주면
  // "이 학교엔 반이 없다"처럼 보인다. 실제로는 파일이 안 실린 것이다.
  await page.route("**/schoolClassCounts.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  await openAdmin(page);
  await expect(page.locator("#teacherCodeSubmitBtn")).toBeDisabled();
  await expect(page.locator("#teacherCodeClassSource")).toContainText("읽지 못했습니다");
  expect(await optionValues(page, "teacherCodeGrade"), "고를 수 있는 학년이 남아 있으면 안 된다").toEqual([]);
});
