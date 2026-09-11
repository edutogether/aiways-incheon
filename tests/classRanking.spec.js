// 학생 앱의 "우리 학년 반별 랭킹" (2026-09-11, 보고 Bumm - "작동 안 함").
//
// 🔴 무엇이 문제였나: 랭킹이 학년·반을 `classContext`(임시 입력 카드가 쓰는 값)
// 에서만 읽었는데, **가입 흐름은 그 값을 쓰지 않는다.** 그래서 가입을 마친 학생은
// 서버에 학년·반이 있는데도 화면이 "학교/반을 연결하면…"에 멈춰 있었고,
// 새로고침을 눌러도 **서버를 부르지도 않았다**(실측: 호출 0회).
//
// 🔴 왜 스텁을 심는가: 이 흐름은 `checkStudentProfile`이 프로필을 돌려줘야 시작되는데
// 자동화 브라우저는 App Check를 절대 통과하지 못한다(app.md "자주 틀리는 것").
// 그래서 **서버 응답만** 흉내내고, 보려는 것은 하나다 - 화면이 그 프로필의
// 학년·반을 실제로 랭킹 조회에 쓰는가.
import { test, expect } from "@playwright/test";

const BASE = process.env.AIWAYS_STATIC_BASE || "http://127.0.0.1:8011";

const STUB = () => {
  const stub = {
    errorMessageFor: (code) => `코드:${code}`,
    checkStudentProfile: async () => ({
      ok: true,
      data: {
        hasProfile: true,
        profile: {
          schoolId: "7321030", schoolName: "인천서흥초등학교",
          grade: "1", classNum: "2", studentNumber: "7", name: "홍길동"
        }
      }
    }),
    getClassRanking: async (payload) => {
      window.__rankCalls = (window.__rankCalls || []).concat([payload]);
      // 불러오는 중 화면을 볼 수 있게 일부러 늦춘다.
      await new Promise((resolve) => setTimeout(resolve, 900));
      return {
        ok: true,
        data: {
          classes: [
            { rank: 1, classNum: "2", score: 42, isMine: true },
            { rank: 2, classNum: "1", score: 31 },
            { rank: 3, classNum: "3", score: 18 }
          ]
        }
      };
    },
    listSortingRecords: async () => ({ ok: true, data: { records: [] } })
  };
  Object.defineProperty(window, "AIWaysEdu2gClient", { configurable: true, get: () => stub, set: () => {} });
};

async function openStats(page) {
  await page.goto(`${BASE}/mobile/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  // 자동화는 App Check를 못 지나가 인증 띠가 100% 뜬다 - 화면을 밀어내므로 떼어낸다.
  await page.evaluate(() => { document.getElementById("authGate")?.remove(); });
  // 🔴 저장된 프로필이 없으면 가입 모달이 **저절로 뜬다**(2026-09-11, 지시 Bumm).
  //    `<dialog>`는 네이티브 top-layer라 그 아래 클릭이 전부 막힌다 - 사용자와 같은
  //    길(닫기 버튼)로 닫는다. `dialog.close()`를 직접 부르면 리액트가 다시 연다.
  await page.evaluate(async () => {
    for (let i = 0; i < 30; i += 1) {
      if (document.querySelector("#signupModal[open]")) {
        document.querySelector("#signupModal .signup-modal-close")?.click();
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  await page.locator("button, a").filter({ hasText: /현황|통계|기록/ }).first().click();
  await page.waitForTimeout(500);
}

test.describe("우리 학년 반별 랭킹", () => {
  test.beforeEach(async ({ context }) => { await context.addInitScript(STUB); });

  test("🔴 가입한 학생의 학년·반으로 실제로 조회한다", async ({ page }) => {
    await openStats(page);
    await page.locator("#classRankingRefreshBtn").click();
    await page.waitForFunction(() => (window.__rankCalls || []).length > 0, { timeout: 8000 });
    const calls = await page.evaluate(() => window.__rankCalls);
    // 🔴 하한을 고정값으로 못박는다 - 호출이 0건이면 아래 단언이 통째로 사라진다(§21).
    expect(calls.length, "랭킹 조회를 한 번도 안 했습니다 - 새로고침이 아무 일도 안 한다는 뜻입니다.").toBeGreaterThan(0);
    expect(calls[0]).toMatchObject({ schoolId: "7321030", grade: "1", classNum: "2" });
  });

  test("불러오는 동안 화면이 비지 않는다", async ({ page }) => {
    await openStats(page);
    await page.locator("#classRankingRefreshBtn").click();
    // 뼈대가 자리를 잡고 있어야 한다 - 텅 비면 "눌렀는데 아무 일도 안 일어난" 것처럼 보인다.
    await expect(page.locator("#classRankingSkeleton li")).toHaveCount(3);
    await expect(page.locator("#classRankingStatus")).toHaveText("불러오는 중입니다...");
    // 끝나면 뼈대는 사라지고 진짜 줄이 들어온다.
    await expect(page.locator("#classRankingList li")).toHaveCount(3, { timeout: 8000 });
    await expect(page.locator("#classRankingSkeleton")).toHaveCount(0);
    await expect(page.locator("#classRankingList li").first()).toContainText("1위");
    await expect(page.locator("#classRankingList li").first()).toContainText("2반");
  });
});

test("결과가 없을 때도 빈 화면을 두지 않는다", async ({ page, context }) => {
  await context.addInitScript(() => {
    const stub = {
      errorMessageFor: (code) => `코드:${code}`,
      checkStudentProfile: async () => ({ ok: true, data: {} }),
      listSortingRecords: async () => ({ ok: true, data: { records: [] } })
    };
    Object.defineProperty(window, "AIWaysEdu2gClient", { configurable: true, get: () => stub, set: () => {} });
  });
  await openStats(page);
  await expect(page.locator("#classRankingEmpty")).toHaveCount(1);
  await expect(page.locator("#classRankingEmpty")).toContainText("아직 보여줄 순위가 없어요");
});
