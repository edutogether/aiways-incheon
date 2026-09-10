// 대시보드가 **어느 화면에서도 자기 칸 안에 들어가는지**.
//
// 2026-09-10에 제가 이 검사를 가로 방향만 재게 만들어 놓고 "넘침 0"이라고
// 보고했다. 실제로는 도넛이 패널 아래로 잘려나가고 QR이 글자 위에 겹치고
// 있었는데, 한 축만 보는 문지기라 전부 통과시켰다. 어제부터 이 저장소에서
// 계속 다룬 §21과 같은 종류이고, 이번엔 검사 쪽이 그 병에 걸렸다.
//
// 그래서 이 파일은 세 가지를 **같이** 본다.
//   1. 가로로 칸을 넘는가
//   2. 세로로 칸을 넘는가
//   3. 형제 요소끼리 겹치는가 (넘치지 않아도 겹칠 수 있다 - QR이 그랬다)
//
// 🔴 로컬 전용이다. 이 저장소의 Playwright는 CI에서 돌지 않는다
// (.claude/rules/app.md "검사가 CI에서 실제로 도는 범위" 참고).
import { test, expect, devices } from "@playwright/test";

// 🔴 지금은 **기본으로 건너뛴다.** 검사는 맞게 돌지만 화면이 아직 이 기준을
// 통과하지 못한다 - 아래 크기들에서 패널 내용이 칸을 넘어 스크롤된다
// (2026-09-10 착수 시점 실측: 1024x768 매립지 31px·3초모듈 122px /
// 768x1024 매립지 11px / 960x600 네 패널 모두 / 600x960 매립지 75px·3초모듈 103px).
//
// 통과 못 하는 검사를 초록불로 바꾸지 않고 **끄지도 않는다** - 남겨두고
// 하나씩 줄여 나가다가, 전부 0이 되면 이 건너뛰기를 지운다. 그때부터가
// 진짜 문지기다. 지금 돌려보려면: AIWAYS_DASHBOARD_FIT=1 npx playwright test tests/dashboardFit.spec.js
//
// 진행 상황(2026-09-10): **1024x768 가로와 768x1024 세로는 이제 통과한다.**
// 남은 것은 960x600 · 600x960(작은 태블릿)과 PC 1440x900이다.
test.skip(process.env.AIWAYS_DASHBOARD_FIT !== "1", "화면이 아직 이 기준을 통과하지 못한다 - 남은 항목은 파일 머리말 참고");

// 학교 선택 모달을 정상 경로로 지나간다 - 자동화 브라우저는 App Check를
// 통과하지 못해 학교 "검색"을 실행할 수 없으므로, 화면 코드가 읽는 값을
// 미리 넣어 준다(같은 키를 화면이 직접 쓴다).
const SEED = () => {
  try {
    localStorage.setItem("aiways_pc_dashboard_school_v1", "7361073");
    localStorage.setItem("aiways_pc_dashboard_school_name_v1", "인천청라초등학교");
    localStorage.setItem("aiways_pc_dashboard_classnum_v1", "1");
  } catch { /* 시크릿 모드 등 - 그때는 모달이 뜨고 검사가 실패한다 */ }
};

const SIZES = [
  { name: "PC 1440x900", width: 1440, height: 900, touch: false },
  { name: "태블릿 가로 1024x768", width: 1024, height: 768, touch: true },
  { name: "태블릿 세로 768x1024", width: 768, height: 1024, touch: true },
  { name: "소형 태블릿 가로 960x600", width: 960, height: 600, touch: true },
  { name: "소형 태블릿 세로 600x960", width: 600, height: 960, touch: true }
];

// 검사가 "대상을 못 찾아서" 조용히 통과하는 것을 막는 하한.
const MIN_PANELS = 4;
const MIN_MEASURED = 40;

async function openDashboard(browser, size) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    hasTouch: size.touch, isMobile: size.touch,
    ...(size.touch ? { userAgent: devices["iPad (gen 7)"].userAgent } : {}),
    baseURL: "http://127.0.0.1:8001"
  });
  await context.addInitScript(SEED);
  const page = await context.newPage();
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  return { context, page };
}

function report(rows) {
  return rows.map((r) => `${r.panel} > ${r.el} ${r.how}`).join("\n");
}

for (const size of SIZES) {
  test(`${size.name}: 대시보드 요소가 패널을 넘거나 서로 겹치지 않는다`, async ({ browser }) => {
    const { context, page } = await openDashboard(browser, size);
    try {
      const result = await page.evaluate(() => {
        const panels = Array.from(document.querySelectorAll(".dashboard-grid > .panel"))
          .filter((p) => p.getBoundingClientRect().width > 0);
        const 넘침 = [];
        const 겹침 = [];
        let 잰개수 = 0;
        const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/)[0] || "-"}`;

        for (const panel of panels) {
          const pb = panel.getBoundingClientRect();
          const cs = getComputedStyle(panel);
          // 패널 자체가 스크롤을 허용하면 세로로 넘치는 것은 정상이다.
          const 세로스크롤 = cs.overflowY === "auto" || cs.overflowY === "scroll";
          for (const el of panel.querySelectorAll("*")) {
            const b = el.getBoundingClientRect();
            if (!b.width || !b.height) continue;
            잰개수 += 1;
            if (b.right > pb.right + 1 || b.left < pb.left - 1)
              넘침.push({ panel: panel.className.split(" ")[1] || "panel", el: label(el), how: `가로로 ${Math.round(Math.max(b.right - pb.right, pb.left - b.left))}px` });
            if (!세로스크롤 && (b.bottom > pb.bottom + 1 || b.top < pb.top - 1))
              넘침.push({ panel: panel.className.split(" ")[1] || "panel", el: label(el), how: `세로로 ${Math.round(Math.max(b.bottom - pb.bottom, pb.top - b.top))}px` });
          }

          // 형제끼리 겹치는가. 겹치도록 만든 것(절대배치·transform·음수 여백)은
          // 뺀다 - 그건 의도된 연출이고, 여기서 잡으려는 것은 자리가 모자라
          // 밀려서 서로 올라탄 경우다.
          const kids = Array.from(panel.children).filter((el) => {
            const s = getComputedStyle(el);
            const b = el.getBoundingClientRect();
            return b.width > 1 && b.height > 1 && s.position === "static" && s.transform === "none";
          });
          for (let i = 0; i < kids.length; i += 1) {
            for (let j = i + 1; j < kids.length; j += 1) {
              const a = kids[i].getBoundingClientRect(), c = kids[j].getBoundingClientRect();
              const w = Math.min(a.right, c.right) - Math.max(a.left, c.left);
              const h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
              if (w > 2 && h > 2)
                겹침.push({ panel: panel.className.split(" ")[1] || "panel", el: `${label(kids[i])} ↔ ${label(kids[j])}`, how: `${Math.round(w)}x${Math.round(h)}px 겹침` });
            }
          }
        }
        // 🔴 패널이 스크롤한다는 것은 "내용이 안 들어갔다"는 뜻이다.
        // 세로 넘침을 스크롤 가능한 패널에서 봐주면, 잘려서 안 보이는 것을
        // 검사가 통과시킨다 - 실제로 QR 안내가 그렇게 잘려 있었다.
        const 안들어감 = panels
          .filter((p) => p.scrollHeight > p.clientHeight + 2)
          .map((p) => ({ panel: p.className.split(" ")[1] || "panel", el: "(패널 내용)",
            how: `${p.scrollHeight - p.clientHeight}px 만큼 넘쳐 스크롤됨` }));
        return { panels: panels.length, 잰개수, 넘침, 겹침, 안들어감 };
      });

      // 아무것도 못 재고 통과하는 일이 없게 하한부터 못박는다.
      expect(result.panels, "패널을 못 찾았다 - 화면이 안 떴거나 선택자가 바뀌었다").toBeGreaterThanOrEqual(MIN_PANELS);
      expect(result.잰개수, "잰 요소가 너무 적다 - 화면이 덜 그려진 상태로 쟀다").toBeGreaterThanOrEqual(MIN_MEASURED);

      expect(result.넘침, `패널 밖으로 나가는 요소\n${report(result.넘침)}`).toEqual([]);
      expect(result.겹침, `서로 겹치는 요소\n${report(result.겹침)}`).toEqual([]);
      expect(result.안들어감, `내용이 패널에 안 들어가 스크롤되는 패널\n${report(result.안들어감)}`).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
