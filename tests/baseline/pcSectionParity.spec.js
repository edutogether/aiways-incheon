// 전환본의 한 섹션이 원본과 **같은 화면인가** (S2 진행 중 대조).
//
// 기준선 스냅샷(pcBaseline)은 전체 문서를 재므로, 섹션을 하나씩 옮기는 동안은
// 쓸 수 없다 — 아직 안 옮긴 섹션이 없어서 문서 전체가 다르기 때문이다. 이
// 파일은 그동안 쓰는 대조로, **원본과 전환본을 같은 조건으로 동시에 열어**
// 그 섹션의 부분만 비교한다.
//
// 🔴 저장된 스냅샷이 없다. 기대값이 **원본 화면 그 자체**라, 내가 만든 것을
// 기준으로 삼는 일이 구조적으로 생기지 않는다(§21-7).
//
// 🔴 컨텍스트를 따로 만든다. 같은 브라우저 컨텍스트에서 두 번째 페이지를 열면
// 익명 인증/App Check가 막혀 요청이 400으로 끝나고 응답이 안 온다(`mobile/`
// 전환에서 실제로 겪었다). `browser.newContext()`에는 playwright.config.js의
// `use`가 안 붙으므로 baseURL을 직접 넘긴다.
//
// 실행: AIWAYS_PC_SECTION=dashboard npx playwright test tests/baseline/pcSectionParity.spec.js
import { test, expect, devices } from "@playwright/test";

const SECTION = process.env.AIWAYS_PC_SECTION || "dashboard";
const BASE_URL = "http://127.0.0.1:8001";

// 옮기는 중에는 이 파일을 일부러 돌린다. 기본으로 켜두면 아직 안 옮긴 섹션
// 때문에 `npm test`가 늘 빨간불이 된다.
test.skip(process.env.AIWAYS_PC_SECTION === undefined, "AIWAYS_PC_SECTION=<섹션 id>로 돌린다 - S2 진행 중 대조용");

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900, touch: false },
  { name: "1024x768", width: 1024, height: 768, touch: true }
];

const SEED = () => {
  try {
    localStorage.setItem("aiways_pc_dashboard_school_v1", "7361073");
    localStorage.setItem("aiways_pc_dashboard_school_name_v1", "인천청라초등학교");
    localStorage.setItem("aiways_pc_dashboard_classnum_v1", "1");
  } catch { /* 저장이 막힌 환경 */ }
};

// 섹션 하나의 DOM 모양을 문자열로 만든다. 좌표가 아니라 **구조와 속성**을 본다
// - 전환본에는 아직 다른 섹션이 없어서 문서 높이가 달라 좌표는 맞을 수 없다.
// 좌표 대조는 섹션을 다 옮긴 뒤 기준선 스냅샷이 맡는다.
function dumpSection(id) {
  const root = document.getElementById(id);
  if (!root) return null;
  const out = [];
  const walk = (el, depth) => {
    const attrs = [...el.attributes]
      .map((a) => {
        // style은 **글자 그대로** 비교하면 안 된다. 리액트는 style 객체를 다시
        // 직렬화하므로 원본의 "background:#5ef7cd;"가 "background: rgb(94,247,205);"
        // 로 나온다 - 브라우저가 해석한 값은 같고 표기만 다르다. 양쪽 모두
        // 브라우저가 정규화한 cssText로 본다.
        if (a.name === "style") return `style=${el.style.cssText}`;
        // class는 순서가 아니라 집합이 같으면 된다(원본은 classList.toggle로
        // 붙였다 뗐다 하므로 순서가 실행 순서에 따라 달라진다).
        if (a.name === "class") return `class=${[...el.classList].sort().join(" ")}`;
        // 🔴 <option selected>는 리액트가 일부러 무시한다 - <select>의
        // defaultValue로 지정하라고 경고한다. 그래서 전환본에는 그 **속성**이
        // 없지만, 실제로 골라진 항목은 같다. 속성 대신 **골라졌는지**를 본다.
        if (a.name === "selected") return "";
        return `${a.name}=${a.value}`;
      })
      .sort()
      .join(" ");
    // option은 속성 대신 실제 선택 상태를 적는다(위 주석 참고).
    const picked = el.tagName === "OPTION" && el.selected ? " [선택됨]" : "";
    out.push(`${"  ".repeat(depth)}${el.tagName.toLowerCase()} ${attrs}${picked}`);
    for (const child of el.children) walk(child, depth + 1);
  };
  walk(root, 0);
  return {
    tree: out.join("\n"),
    // 글자는 공백을 접어서 본다. 원본 HTML은 줄바꿈+들여쓰기가 텍스트 노드로
    // 남고 JSX는 그 자리를 비우는데, 화면에서는 둘 다 똑같이 보인다.
    text: (root.textContent || "").replace(/\s+/g, " ").trim(),
    count: out.length
  };
}

// 🔴 아직 전환하지 않은 고전 스크립트를 **양쪽 모두에서 막는다.**
//
// S2는 마크업만 옮기는 단계다. 그런데 `app.js`는 DOMContentLoaded에
// `getElementById`로 DOM을 붙잡아 값을 채우는데, 리액트는 그보다 **뒤에**
// 그린다(번들이 defer 스크립트 뒤에 오므로). 그래서 전환본에서는 app.js가
// 채울 DOM을 못 찾고, 원본에서만 학년 목록·도넛 각도·차트 viewBox가 채워진다.
//
// 그 차이를 여기서 비교하면 **마크업이 맞는지를 못 본다.** 양쪽 다 스크립트가
// 손대기 전 상태로 놓고 비교해야 "옮긴 마크업이 원본과 같은가"를 답할 수 있다.
// app.js를 리액트 뒤에 실행시키는 문제는 S4에서 푼다(app.md에 적었다).
const LEGACY = [
  "deviceTier.js", "firebaseAppCheck.js", "firebaseBetaAuth.js", "edu2gBetaClient.js",
  "dashboardRealtime.js", "responsiveNavigation.js", "classProfileStore.js",
  "classroomSkillRegistry.js", "aiRuntimeLoader.js", "app.js"
];

async function open(browser, target, vp) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: vp.width, height: vp.height },
    ...(vp.touch ? { hasTouch: true, isMobile: true, userAgent: devices["iPad (gen 7)"].userAgent } : {})
  });
  await context.addInitScript(SEED);
  for (const name of LEGACY) {
    await context.route(`**/${name}`, (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  }
  const page = await context.newPage();
  await page.goto(target ? `/${target}/index.html` : "/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  return { context, page };
}

for (const vp of VIEWPORTS) {
  test(`${vp.name}: #${SECTION} 섹션이 원본과 같은 구조·글자다`, async ({ browser }) => {
    test.setTimeout(120000);
    const live = await open(browser, "", vp);
    const next = await open(browser, "pc-next", vp);
    try {
      const a = await live.page.evaluate(dumpSection, SECTION);
      const b = await next.page.evaluate(dumpSection, SECTION);

      expect(a, `원본에 #${SECTION} 섹션이 없다`).not.toBeNull();
      expect(b, `전환본에 #${SECTION} 섹션이 없다 - 아직 안 옮겼거나 id가 다르다`).not.toBeNull();
      // 아무것도 못 재고 통과하는 일이 없게 하한부터 못박는다.
      expect(a.count, "원본 섹션에서 잰 요소가 너무 적다").toBeGreaterThan(30);

      expect(b.tree, "구조나 속성이 원본과 다르다").toBe(a.tree);
      expect(b.text, "화면에 보이는 글자가 원본과 다르다").toBe(a.text);
    } finally {
      await live.context.close();
      await next.context.close();
    }
  });
}
