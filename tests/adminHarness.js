// 관리자 화면 검사들이 같이 쓰는 준비 작업.
//
// 이 화면은 로그인해야 보이고, 학교 검색은 서버(adminSearchSchool)를 부른다.
// 검사에서는 **그 응답만** 가짜로 세우고 나머지는 실제 화면 코드를 그대로
// 돌린다 - 화면이 검색 결과를 어떻게 그리고 무엇을 고르는지가 검사 대상이라,
// 그 부분까지 흉내내면 아무것도 검증하지 못한다.
import { expect } from "@playwright/test";

// 실제 NEIS 응답에서 우리가 쓰는 모양 그대로.
export const SCHOOLS = [
  { schoolCode: "7321030", schoolName: "인천서흥초등학교", schoolLevel: "초등학교", region: "인천", address: "인천광역시 미추홀구" },
  { schoolCode: "7361073", schoolName: "인천청라초등학교", schoolLevel: "초등학교", region: "인천", address: "인천광역시 서구" },
  { schoolCode: "7341025", schoolName: "인천동방초등학교", schoolLevel: "초등학교", region: "인천", address: "인천광역시 남동구" },
  { schoolCode: "7361064", schoolName: "인천마전초등학교", schoolLevel: "초등학교", region: "인천", address: "인천광역시 서구" },
  // 학급 수 자료에 **없는** 학교. 4개교 말고 다른 학교의 코드를 발급할 일이
  // 생길 수 있고, 그때 화면이 어떻게 구는지도 검사 대상이다.
  { schoolCode: "7010057", schoolName: "서울대도초등학교", schoolLevel: "초등학교", region: "서울", address: "서울특별시 강남구" }
];

export async function openAdmin(page, { schools = SCHOOLS, searchStatus = 200 } = {}) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // App Check는 실제 브라우저 자동화에서 절대 통과하지 못한다(자동화 여부가
  // 감지된다). 검사 대상이 아니므로 헤더만 세워 둔다 - 실제 강제는 서버가 한다.
  // firebaseAppCheck.js가 나중에 window.AIWaysAppCheck를 덮어쓰므로,
  // 그 파일 자체를 자리만 채우는 것으로 바꾼다.
  await page.route("**/firebaseAppCheck.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: "window.AIWaysAppCheck={getAIWaysAppCheckHeaders:async()=>({'X-Firebase-AppCheck':'test'})};"
  }));
  await page.route("**/adminSearchSchool", (route) =>
    route.fulfill({
      status: searchStatus,
      contentType: "application/json",
      body: JSON.stringify(searchStatus === 200 ? { ok: true, schools } : { ok: false, code: "auth_missing" })
    })
  );
  await page.goto("/admin.html");
  // 이 구역은 로그인해야 보인다. 화면상으로만 열어서 확인한다 - 실제 권한은
  // 전부 서버의 superadmin 클레임 검증으로 강제된다(에뮬레이터로 실행 확인함).
  await page.evaluate(() => document.getElementById("teacherCodeSection")?.removeAttribute("hidden"));
  await expect(page.locator("#teacherCodeSchoolQuery")).toBeVisible();
  return errors;
}

// 이름으로 찾아서 목록에서 고르는, 실제 사용자와 같은 경로.
export async function pickSchool(page, name) {
  await page.locator("#teacherCodeSchoolReset").click({ timeout: 1000 }).catch(() => {});
  await page.fill("#teacherCodeSchoolQuery", name.slice(0, 4));
  await page.locator(`#teacherCodeSchoolResults button:has-text("${name}")`).click();
  await expect(page.locator("#teacherCodeSchoolChosen")).toBeVisible();
}
