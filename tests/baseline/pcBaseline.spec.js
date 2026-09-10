// PC 화면을 리액트로 옮기기 "전" 모습을 정답으로 고정한다 (S0).
//
// 🔴 **이 파일이 만든 스냅샷은 전환 중에 다시 찍지 않는다.** 전환 후에 새로
// 찍은 것과 비교하면 아무것도 검증하지 못한다 — 비교 대상이 내가 만든 것이면
// 그건 검사가 아니다(COMMON_STANDARDS §21). `--update-snapshots`를 이 파일에
// 쓰는 순간 이번 전환의 판정 기준이 사라진다.
//
// 재는 것은 `mobile/` 전환 때와 같은 네 가지다.
//   1. 화면에 안 보이는 값(id·meta·alt·aria·링크·입력 속성) — 스크린샷으로는
//      절대 안 잡히고, `app.js`가 getElementById로 DOM을 붙잡는 구조라
//      **id 하나만 사라져도 그 기능이 조용히 죽는다.**
//   2. 모션 명세(선언값) — 재생 중간값이 아니라 duration·easing·name.
//   3. 정지 상태의 좌표·색·타이포 — 애니메이션을 끝난 상태로 고정한 뒤.
//   4. 스크린샷.
//
// 1440×900 / 1920×1080은 PC, 1024×768 / 768×1024는 태블릿(터치 흉내)이다.
// 🔴 태블릿은 폭만이 아니라 `(hover:none) and (pointer:coarse)`도 보므로
// 터치를 흉내내지 않으면 실제 태블릿과 다른 화면을 재게 된다(app.md 참고).
//
// 로컬 전용이다 — 이 저장소의 Playwright는 CI에서 돌지 않는다.
import { test, expect } from "@playwright/test";
import { dumpSemantics, dumpStyles, settle, unsettle } from "./harness.js";
import {
  LAYOUT_PROPS, MOTION_PROPS, PC_SCOPE, PC_SECTIONS, PC_VIEWPORTS,
  assertPcNotEmpty, openDashboard, showSection
} from "./pcHarness.js";

for (const vp of PC_VIEWPORTS) {
  test.describe(`PC 기준선 ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      ...(vp.touch ? { hasTouch: true, isMobile: true } : {})
    });

    test("섹션별 정지 상태와 모션 명세", async ({ page }) => {
      test.setTimeout(180000);
      await openDashboard(page);

      for (const section of PC_SECTIONS) {
        // 태블릿 폭에서는 대시보드 말고 다른 섹션이 화면에서 빠진다
        // (그게 의도한 태블릿 화면이다 - app.md "태블릿 화면" 참고).
        // 없는 섹션을 억지로 찍지 않되, **없다는 사실 자체는 기록에 남긴다.**
        const visible = await page.evaluate((id) => {
          const el = document.getElementById(id);
          return !!el && el.getBoundingClientRect().width > 0;
        }, section.id);
        if (!visible) {
          expect(JSON.stringify({ 섹션: section.id, 상태: "이 폭에서는 화면에 없음" }, null, 2))
            .toMatchSnapshot(`${vp.name}-${section.id}.absent.json`);
          continue;
        }

        await showSection(page, section.id);

        // 0) 화면에 안 보이는 값. 문서 전체를 보므로 섹션마다 같지만,
        //    섹션을 오가며 스크립트가 id를 지우거나 더하는 경우를 잡는다.
        const semantics = await page.evaluate(dumpSemantics);
        assertPcNotEmpty({ semantics, where: `${vp.name} ${section.id}` });
        expect(JSON.stringify(semantics, null, 2)).toMatchSnapshot(`${vp.name}-${section.id}.semantics.json`);

        // 1) 모션 명세 — 재생을 멈추기 "전"에 선언값을 읽는다.
        const motion = await page.evaluate(dumpStyles, [MOTION_PROPS, false, PC_SCOPE]);
        expect(JSON.stringify(motion, null, 2)).toMatchSnapshot(`${vp.name}-${section.id}.motion.json`);

        // 2) 정지 상태 — 재생을 끝낸 뒤 좌표까지 잰다.
        await settle(page);
        const layout = await page.evaluate(dumpStyles, [LAYOUT_PROPS, true, PC_SCOPE]);
        assertPcNotEmpty({ styles: layout, where: `${vp.name} ${section.id}` });
        expect(JSON.stringify(layout, null, 2)).toMatchSnapshot(`${vp.name}-${section.id}.layout.json`);
        await expect(page).toHaveScreenshot(`${vp.name}-${section.id}.png`);
        // 다음 섹션의 모션 명세가 0s로 오염되지 않도록 반드시 걷어낸다.
        await unsettle(page);
      }
    });
  });
}
