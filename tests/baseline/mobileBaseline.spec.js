// mobile/ 리액트 전환 "전" 화면을 정답으로 고정한다.
//
// 왜 이게 필요한가: mobile/은 실제 초등학생이 매일 쓰는 프로덕션 앱인데
// UI 자동 커버리지가 사실상 없었다(기존 검증은 frontendDomContract.test.js가
// mobile/app.js 원문을 grep하는 3줄이 전부라 렌더 결과를 보지 않는다).
// 전환 뒤 "체감까지 동일"을 증명하려면 눈대중이 아니라 실측값이 있어야
// 하고, 이 파일이 그 실측값을 만든다.
//
// 캡처를 두 종류로 나눈 이유(중요): 처음엔 한 번에 다 떴는데, 같은 화면을
// 두 번 캡처하면 opacity가 0.824944 / 1 로 갈렸다 - 페이드인이 아직
// 진행 중인 순간을 찍고 있었던 것이다. 흔들리는 기준선은 증명 수단이
// 될 수 없으므로 이렇게 나눈다:
//   1) 정지 상태(settled) - 애니메이션을 끝난 상태로 고정한 뒤 레이아웃·
//      색·타이포·박스를 잰다. 여기서 나온 값은 매번 같아야 한다.
//   2) 모션 명세(motion) - transition/animation의 duration·easing·name을
//      "선언값"으로 기록한다. 재생 중간값이 아니라 선언값이라 안정적이고,
//      전환 후 애니메이션 길이·이징이 달라졌는지를 이걸로 잡는다.
// 1번만 있으면 "모양은 같은데 움직임이 달라진" 회귀를 놓치고, 2번만
// 있으면 정지 화면이 틀어진 걸 놓친다. 둘 다 있어야 "체감까지 동일"이
// 증명된다.
//
// 이 파일이 재는 것은 **각 탭의 첫 화면**뿐이다. 모달이 열린 모습, 퀴즈
// 정·오답, 보류함에 항목이 있을 때 같은 상호작용 상태는 옆 파일
// (mobileInteraction.spec.js)이 맡는다 - 둘을 합치면 한 테스트가 너무
// 길어져서, 어디가 깨졌는지 읽기 어려워진다.
//
// 인증 게이트는 App Check가 localhost를 막아 로컬에서 통과할 수 없다.
// CLAUDE.md에 기록된 방식대로 화면상으로만 열어서 검사한다 - 제품 코드는
// 건드리지 않으며, 실제 보안은 전부 Functions 쪽에서 강제되므로 이 우회가
// 보안을 우회하지는 않는다.
import { test, expect } from "@playwright/test";
import { VIEWPORTS, LAYOUT_PROPS, MOTION_PROPS, assertNotEmpty, dumpSemantics, dumpStyles, openApp, settle, unsettle } from "./harness.js";

const TABS = ["판단", "퀴즈", "통계", "보류함"];

for (const vp of VIEWPORTS) {
  test.describe(`mobile 기준선 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("탭별 정지 상태와 모션 명세", async ({ page }) => {
      await openApp(page);

      for (const tab of TABS) {
        const button = page.getByRole("button", { name: new RegExp(tab) }).first();
        // 예전에는 버튼을 못 찾으면 조용히 안 누르고 지나갔다. 그러면 탭이
        // 사라져도 **직전 탭 화면을 그 탭의 정답으로 찍어** 초록불이 난다
        // (COMMON_STANDARDS §21). 못 찾으면 실패해야 한다.
        expect(await button.count(), `${tab} 탭 버튼을 찾지 못했다`).toBeGreaterThan(0);
        await button.click();
        await page.waitForTimeout(400);

        // 0) 화면에 안 보이는 값 - id/meta/alt/aria/링크/입력 속성.
        const semantics = await page.evaluate(dumpSemantics);
        // 빈 결과를 정답으로 굳히지 않는다(harness.js assertNotEmpty 주석 참고).
        assertNotEmpty({ semantics });
        expect(JSON.stringify(semantics, null, 2)).toMatchSnapshot(`${vp.name}-${tab}.semantics.json`);

        // 1) 모션 명세 - 재생을 멈추기 "전"에 선언값을 읽는다.
        const motion = await page.evaluate(dumpStyles, [MOTION_PROPS, false]);
        expect(JSON.stringify(motion, null, 2)).toMatchSnapshot(`${vp.name}-${tab}.motion.json`);

        // 2) 정지 상태 - 재생을 끝낸 뒤 레이아웃을 잰다.
        await settle(page);
        const layout = await page.evaluate(dumpStyles, [LAYOUT_PROPS, true]);
        assertNotEmpty({ styles: layout });
        expect(JSON.stringify(layout, null, 2)).toMatchSnapshot(`${vp.name}-${tab}.layout.json`);
        await expect(page).toHaveScreenshot(`${vp.name}-${tab}.png`, { fullPage: true });
        // 다음 탭의 모션 명세가 0s로 오염되지 않도록 반드시 걷어낸다.
        await unsettle(page);
      }
    });
  });
}
