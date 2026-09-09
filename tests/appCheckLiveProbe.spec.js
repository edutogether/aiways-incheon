// 라이브에서 App Check가 실제로 통하는지를 자동으로 확인한다.
//
// 이 저장소에는 "자동화 브라우저는 App Check를 통과 못 하니 사람이 휴대폰으로
// 확인하는 수밖에 없다"고 적혀 있었다. 다른 저장소(Voice Cinema)가 찾은 방법을
// 여기 구조에 맞는지 확인해서 옮긴 것이다.
//
// ## 왜 성립하는가
//
// 서버가 **App Check를 가장 먼저** 본다(functions/lib/protectedActor.js 9~10행:
// observeAppCheck -> 그 다음 actor 해석 -> 레이트리밋). 본문 파싱은 그 뒤다.
// 그래서 **본문도 인증도 없이** 보내면 응답 코드가 갈린다:
//
//   app_check_missing / app_check_invalid  -> App Check가 막았다
//   auth_missing (그 밖의 코드)             -> App Check는 통과했다
//
// 본문이 비어 있고 인증도 없으므로 **아무 데이터도 쓰이지 않는다.** 읽기조차
// 하지 않는다 - 인증 단계에서 멈춘다.
//
// ## 대조군 없이 판단하지 않는다
//
// 자동화 브라우저에서 App Check가 실패하면 그건 앱의 결함이 아닐 가능성이 높다.
// 그래서 **이미 정상 동작이 확인된 주소를 같은 조건으로 함께** 돌린다. 둘 다
// 막히면 그건 설정 문제가 아니라 자동화의 한계다. 한쪽만 막히면 그때가
// 진짜 설정 문제다.
//
// ## 실행
//
//   AIWAYS_APPCHECK_PROBE=1 npx playwright test tests/appCheckLiveProbe.spec.js
//
// 기본으로는 건너뛴다 - 실제 크롬 창을 띄우고 라이브를 두드리므로 CI에서
// 자동으로 돌 일이 아니다.
import { test, expect } from "@playwright/test";

const ENABLED = process.env.AIWAYS_APPCHECK_PROBE === "1";
const FUNCTIONS_BASE = "https://asia-northeast3-ai-ways-incheon.cloudfunctions.net";

// 확인하려는 주소와, 이미 정상으로 확인된 대조군.
const TARGETS = [
  { name: "정식 주소", origin: "https://incheon.edutogether.kr" },
  { name: "대조군(예전부터 등록돼 있던 주소)", origin: "https://ai-ways-incheon.firebaseapp.com" }
];

// 부작용이 없는 엔드포인트. 본문이 비어 있고 인증도 없으므로 인증 단계에서 멈춘다.
const PROBE_FUNCTION = "checkTeacherStatus";

const APP_CHECK_BLOCKED = new Set(["app_check_missing", "app_check_invalid", "protection_unavailable"]);

// 건너뛰기를 **파일 수준**에 둔다. 테스트 본문 안에서 건너뛰면 page 픽스처가
// 이미 만들어진 뒤라 실제 크롬 창이 떴다가 닫힌다 - 평소 `npm test`를 돌릴
// 때마다 창이 뜨면 안 된다.
test.skip(!ENABLED, "AIWAYS_APPCHECK_PROBE=1 일 때만 돈다 - 실제 크롬 창을 띄우고 라이브를 두드린다");
test.use({ headless: false, channel: "chrome" });

test("App Check가 라이브에서 실제로 통과하는가 (대조군과 함께)", async ({ page }) => {
  test.setTimeout(120000);

  const results = [];
  for (const target of TARGETS) {
    await page.goto(`${target.origin}/mobile/index.html`, { waitUntil: "domcontentloaded" });
    // App Check SDK가 준비될 때까지 기다린다. 토큰 발급은 네트워크를 탄다.
    await page.waitForFunction(() => typeof window.AIWaysAppCheck?.getAIWaysAppCheckHeaders === "function", null, { timeout: 30000 });

    const outcome = await page.evaluate(async ([base, fn]) => {
      let headers = null;
      try {
        headers = await window.AIWaysAppCheck.getAIWaysAppCheckHeaders();
      } catch (error) {
        return { tokenIssued: false, reason: String(error?.message || error) };
      }
      if (!headers) return { tokenIssued: false, reason: "헤더를 못 받았다" };
      const res = await fetch(`${base}/${fn}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        // 일부러 비운 본문. 서버가 헤더를 먼저 보므로 여기까지 오면 아무것도 안 쓴다.
        body: "{}"
      });
      const body = await res.json().catch(() => ({}));
      return { tokenIssued: true, status: res.status, code: body.code || "" };
    }, [FUNCTIONS_BASE, PROBE_FUNCTION]);

    const passed = outcome.tokenIssued && !APP_CHECK_BLOCKED.has(outcome.code);
    results.push({ ...target, ...outcome, appCheckPassed: passed });
    console.log(`${passed ? "통과" : "막힘"}  ${target.name}(${target.origin}) - ${JSON.stringify(outcome)}`);
  }

  // 결과 해석까지 여기서 못박는다. 사람이 로그를 보고 판단하게 두면, 그
  // 판단이 사람마다 달라진다.
  const [subject, control] = results;
  expect(results.length, "대조군 없이 판단하지 않는다").toBe(2);

  if (!control.appCheckPassed && !subject.appCheckPassed) {
    // 둘 다 막혔다 = 자동화 브라우저의 한계. 앱 설정 문제가 아니다.
    test.info().annotations.push({ type: "결론", description: "자동화로는 확인 불가 - 둘 다 막혔으므로 설정 문제가 아니다. 사람이 휴대폰으로 확인해야 한다." });
    test.skip(true, "대조군도 함께 막혔다 - 자동화 브라우저의 한계이지 앱의 결함이 아니다");
    return;
  }

  // 대조군은 되는데 정식 주소만 막혔다면 그때가 진짜 설정 문제다.
  expect(subject.appCheckPassed, `대조군은 통과했는데 ${subject.origin}만 막혔다 - reCAPTCHA 승인 도메인에 이 주소가 없을 가능성이 크다`).toBe(true);
});
