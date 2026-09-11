// mobile/ 의 **상호작용 상태**를 리액트 전환 전에 고정한다.
//
// 옆 파일(mobileBaseline.spec.js)은 각 탭의 "첫 화면"만 잰다. 그래서 이 앱
// 화면의 상당 부분이 어떤 스냅샷에도 안 잡혀 있었다 - 판단 결과 모달,
// 공용 확인 모달, 화면 아래 토스트, 퀴즈 정·오답 패널, 보류함에 항목이
// 있을 때의 목록, 검색 자동완성, 가입 폼의 담임 모드가 전부 그렇다.
// 이 요소들은 HTML에 있긴 하지만 display:none 상태라, 첫 화면 덤프에
// 찍히는 값은 **숨겨진 상태의 값**이다. 전환 후 "열린 모습"이 달라져도
// 안 잡힌다.
//
// 이 파일은 그 구멍을 메운다. 전환 착수 "전"에 만들어야 의미가 있어서
// (나중에 만들면 이미 바뀐 화면을 정답으로 굳히게 된다) 코드를 한 줄도
// 옮기기 전에 먼저 넣는다.
//
// 측정 범위가 옆 파일보다 넓다(INTERACTION_SCOPE). 기본 범위는 id가 붙은
// 요소와 버튼만 보는데, 여기서 재려는 것들(보류함 카드, 실천 기록 줄,
// 자동완성 항목, 토스트)은 대부분 id가 없기 때문이다.
import { test, expect } from "@playwright/test";
import {
  VIEWPORTS, LAYOUT_PROPS, MOTION_PROPS, INTERACTION_SCOPE, assertNotEmpty,
  dumpSemantics, dumpStyles, openApp, settle, unsettle
} from "./harness.js";

// 보류함·실천기록은 "비어 있는 상태"만 옆 파일에 잡혀 있다. 항목이 있을
// 때의 렌더링을 재려면 데이터가 있어야 하는데, 실제로 등록하면 서버 호출과
// 시각이 섞여 값이 흔들린다. 그래서 앱이 읽는 localStorage에 **고정된**
// 데이터를 미리 심는다 - 앱 코드는 건드리지 않고, 앱이 평소 하는 복원
// 경로(restoreLocal)를 그대로 태운다.
const SEEDED_HOLD = [
  { id: "seed-hold-1", name: "코팅된 책 표지", date: "9월 8일", recordId: null, idempotencyKey: "seed-key-1" },
  { id: "seed-hold-2", name: "실리콘 케이스", date: "9월 7일", recordId: null, idempotencyKey: "seed-key-2" }
];
const SEEDED_STATS = {
  totalCount: 3,
  carbonReduction: 41.5,
  logs: [
    { name: "📄 종이/신문/책자", category: "종이류", carbon: 12.5, time: "오전 09:12:03" },
    { name: "🥤 페트병", category: "플라스틱", carbon: 17.0, time: "오전 09:08:41" },
    { name: "🥫 캔", category: "금속캔", carbon: 12.0, time: "오전 09:01:19" }
  ]
};

async function openSeededApp(page) {
  await page.addInitScript((seed) => {
    localStorage.setItem("aiways_mobile_hold_v1", JSON.stringify(seed.hold));
    localStorage.setItem("aiways_mobile_stats_v1", JSON.stringify(seed.stats));
  }, { hold: SEEDED_HOLD, stats: SEEDED_STATS });
  await openApp(page);
}

// 한 상태를 옆 파일과 **같은 방식으로** 잰다. 재는 방법이 파일마다 다르면
// "같다"의 기준이 두 개가 되어 버린다.
async function capture(page, vp, state) {
  const semantics = await page.evaluate(dumpSemantics);
  // 빈 결과를 정답으로 굳히지 않는다(harness.js assertNotEmpty 주석 참고).
  assertNotEmpty({ semantics });
  expect(JSON.stringify(semantics, null, 2)).toMatchSnapshot(`${vp}-${state}.semantics.json`);

  const motion = await page.evaluate(dumpStyles, [MOTION_PROPS, false, INTERACTION_SCOPE]);
  expect(JSON.stringify(motion, null, 2)).toMatchSnapshot(`${vp}-${state}.motion.json`);

  await settle(page);
  const layout = await page.evaluate(dumpStyles, [LAYOUT_PROPS, true, INTERACTION_SCOPE]);
  assertNotEmpty({ styles: layout });
  expect(JSON.stringify(layout, null, 2)).toMatchSnapshot(`${vp}-${state}.layout.json`);
  await expect(page).toHaveScreenshot(`${vp}-${state}.png`, { fullPage: true });
  // 다음 상태의 모션 선언값이 0s로 오염되지 않게 반드시 걷어낸다.
  await unsettle(page);
}

const tab = (page, name) => page.getByRole("button", { name: new RegExp(name) }).first().click();

for (const vp of VIEWPORTS) {
  test.describe(`mobile 상호작용 기준선 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("판단 탭 - 자동완성과 결과 모달", async ({ page }) => {
      await openSeededApp(page);

      // 자동완성: keyup 핸들러(handleSearch)가 목록을 걸러 보여준다.
      await page.locator("#searchInput").fill("종이");
      await page.locator("#searchInput").dispatchEvent("keyup");
      // 검색창 이모지가 입력 350ms 뒤 matchNow()로 확정되고, 다시 60ms 뒤
      // 불투명해진다. 그 뒤까지 흘려보내야 값이 고정된다.
      await page.clock.runFor(350);
      await page.clock.runFor(100);
      await capture(page, vp.name, "판단-자동완성");

      // 결과 모달(일반 품목): 실천 기록 버튼 줄이 보이는 쪽.
      await page.locator("#searchInput").fill("");
      await page.locator("#searchInput").dispatchEvent("keyup");
      await page.locator("#quickSelectGrid > button").first().click();
      await capture(page, vp.name, "판단-결과모달");

      // 결과 모달(보류): 보류함 등록 폼이 보이는 쪽. 같은 모달인데 안이
      // 통째로 달라지므로 따로 잡는다.
      await page.locator("#judgeModalClose").click();
      await page.locator("#holdQuickBtn").click();
      await capture(page, vp.name, "판단-보류모달");
    });

    test("퀴즈 탭 - 정답과 오답 패널", async ({ page }) => {
      await openSeededApp(page);
      await tab(page, "퀴즈");

      // 정답 패널과 오답 패널은 색·문구가 통째로 다르다. 문제 순서는 난수를
      // 고정해 두어 매번 같지만, 몇 번째 문제가 O인지까지 여기서 하드코딩하면
      // 문제 은행을 고칠 때마다 이 테스트가 깨진다. 그래서 "O를 눌러보고
      // 어느 쪽이 나왔는지 읽어서" 아직 못 잡은 쪽을 채우는 식으로 돈다.
      const captured = new Set();
      for (let i = 0; i < 10 && captured.size < 2; i += 1) {
        await page.locator("[data-quiz-answer]").first().click();
        const correct = await page.evaluate(() =>
          document.getElementById("explanation-title").className.includes("emerald"));
        const state = correct ? "퀴즈-정답" : "퀴즈-오답";
        if (!captured.has(state)) {
          captured.add(state);
          await capture(page, vp.name, state);
        }
        await page.locator("#nextQuizBtn").click();
      }
      expect([...captured].sort()).toEqual(["퀴즈-오답", "퀴즈-정답"]);
    });

    test("보류함 탭 - 목록, 확인 모달, 토스트", async ({ page }) => {
      await openSeededApp(page);
      await tab(page, "보류함");

      // 항목이 있을 때의 목록(카드 렌더링). 비어 있을 때만 잡혀 있었다.
      await capture(page, vp.name, "보류함-목록");

      // 공용 확인 모달. 열릴 때 50ms 뒤 scale-95/opacity-0을 떼면서
      // 커지는 연출이 있어 그만큼 흘려보낸다.
      await page.locator("#resetHoldBtn").click();
      await page.clock.runFor(100);
      await capture(page, vp.name, "보류함-확인모달");

      // 닫는 연출은 300ms. 다 지나가야 다음 상태가 깨끗하다.
      await page.locator("#modalCancelBtn").click();
      await page.clock.runFor(400);

      // 토스트: body에 직접 붙는 요소라 id도 없고, 3.2초 뒤 스스로 사라진다.
      // 시계가 멈춰 있으므로 사라지지 않고 그대로 남아 측정된다.
      await page.locator("#directHoldInput").fill("테스트 안건");
      await page.locator("#addHoldDirectBtn").click();
      await page.clock.runFor(100);
      await capture(page, vp.name, "보류함-토스트");
    });

    test("통계 탭 - 실천 기록과 담임 가입 모드", async ({ page }) => {
      await openSeededApp(page);
      await tab(page, "통계");

      // 실천 타임라인에 줄이 있을 때. 이것도 비어 있을 때만 잡혀 있었다.
      await capture(page, vp.name, "통계-실천기록");

      // 담임 모드: 입력칸이 통째로 바뀌고 인사 문구가 새로 뜬다.
      // 🔴 2026-09-11부터 가입 입력은 **모달 안**에 있고, 저장된 프로필이 없는 기기에서는
      //    스플래시가 걷힐 때 **저절로 열린다**(지시 Bumm - PC 학교 선택 모달과 같은 동선).
      //    하네스(openApp)가 다른 탭을 찍기 위해 그것을 닫아 두므로, 여기서는 입구로 다시 연다.
      await page.locator("#signupOpenButton").click();
      await page.locator("#signupModal[open]").waitFor();
      await capture(page, vp.name, "통계-가입모달");
      await page.locator("#signupRoleHomeroomBtn").click();
      await page.locator("#signupHomeroomNameInput").fill("홍길동");
      await capture(page, vp.name, "통계-담임가입");
    });
  });
}
