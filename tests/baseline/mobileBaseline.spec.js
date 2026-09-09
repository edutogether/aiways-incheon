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
// 인증 게이트는 App Check가 localhost를 막아 로컬에서 통과할 수 없다.
// CLAUDE.md에 기록된 방식대로 화면상으로만 열어서 검사한다 - 제품 코드는
// 건드리지 않으며, 실제 보안은 전부 Functions 쪽에서 강제되므로 이 우회가
// 보안을 우회하지는 않는다.
import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 }
];

const TABS = ["판단", "퀴즈", "통계", "보류함"];

// 정지 상태에서 재는 것. 레이아웃·타이포·색에 실제로 영향을 주는 것만
// 추린다 - 전부 덤프하면 브라우저 기본값까지 diff에 섞여 신호가 묻힌다.
const LAYOUT_PROPS = [
  "display", "position", "width", "height", "margin", "padding",
  "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
  "color", "background-color", "border", "border-radius", "box-shadow",
  "flex-direction", "justify-content", "align-items", "gap", "grid-template-columns",
  "opacity", "overflow", "z-index"
];

// 움직임. 선언값이라 재생 진행도와 무관하게 안정적이다.
const MOTION_PROPS = [
  "transition-property", "transition-duration", "transition-timing-function", "transition-delay",
  "animation-name", "animation-duration", "animation-timing-function", "animation-delay",
  "animation-iteration-count", "transform"
];

// 화면에 안 보이지만 사라지면 기능이 죽거나 접근성이 무너지는 값들.
// 스크린샷·computed style로는 절대 안 잡힌다 - 다른 저장소(Voice Cinema)가
// 전환 과정에서 요소 id 20여 개를 잃은 것을 이 대조로 잡았다. 이 앱은
// app.js/mobile/app.js가 getElementById로 DOM을 직접 붙잡는 구조라
// **id 하나만 사라져도 그 기능이 조용히 죽는다** - 더 취약하다.
function dumpSemantics() {
  // dumpStyles와 같은 이유로 인증 게이트 안은 제외한다(비동기 렌더로 흔들린다).
  const inGate = (el) => !!el.closest("#authGate");
  const attrsOf = (el, names) => {
    const out = {};
    for (const n of names) if (el.hasAttribute(n)) out[n] = el.getAttribute(n);
    for (const a of el.attributes) if (a.name.startsWith("aria-")) out[a.name] = a.value;
    return out;
  };
  return {
    // id는 정렬해서 전체를 통째로 비교한다 - 하나라도 없어지면 diff에 뜬다.
    ids: [...document.querySelectorAll("[id]")].filter((e) => !inGate(e)).map((e) => e.id).sort(),
    meta: [...document.querySelectorAll("meta")]
      .map((m) => `${m.getAttribute("name") || m.getAttribute("property") || m.getAttribute("charset") || "?"}=${(m.getAttribute("content") || "").slice(0, 120)}`)
      .sort(),
    title: document.title,
    lang: document.documentElement.lang,
    images: [...document.querySelectorAll("img")].filter((e) => !inGate(e))
      .map((i) => `${(i.getAttribute("src") || "").split("/").pop()} | alt=${i.getAttribute("alt")}`)
      .sort(),
    links: [...document.querySelectorAll("a[href]")].filter((e) => !inGate(e))
      .map((a) => `${a.getAttribute("href")} | ${(a.textContent || "").trim().slice(0, 30)} | rel=${a.getAttribute("rel") || ""} | target=${a.getAttribute("target") || ""}`)
      .sort(),
    inputs: [...document.querySelectorAll("input, select, textarea")].filter((e) => !inGate(e))
      .map((el) => `${el.id || el.name || el.tagName}: ${JSON.stringify(attrsOf(el, ["type", "name", "placeholder", "maxlength", "minlength", "required", "inputmode", "pattern", "autocomplete", "min", "max", "step", "disabled", "readonly"]))}`)
      .sort(),
    // 버튼은 접근 가능한 이름이 사라지면 스크린리더에서 "버튼"으로만 읽힌다.
    buttons: [...document.querySelectorAll("button")].filter((e) => !inGate(e))
      .map((b) => `${b.id || "(무id)"}: ${(b.textContent || "").trim().slice(0, 24)} | ${JSON.stringify(attrsOf(b, ["type", "disabled"]))}`)
      .sort()
  };
}

function keyFor(el) {
  if (el.id) return `#${el.id}`;
  if (el.dataset && el.dataset.role) return `[data-role=${el.dataset.role}]`;
  return `${el.tagName.toLowerCase()}:${(el.textContent || "").trim().slice(0, 12)}`;
}

// page.evaluate에 넘길 때 함수 본문만 직렬화되므로 keyFor를 안에 다시 둔다.
function dumpStyles(propList, withBox) {
  const key = (el) => {
    if (el.id) return `#${el.id}`;
    if (el.dataset && el.dataset.role) return `[data-role=${el.dataset.role}]`;
    return `${el.tagName.toLowerCase()}:${(el.textContent || "").trim().slice(0, 12)}`;
  };
  const out = {};
  for (const el of document.querySelectorAll("[id], [data-role], button, .tab-btn")) {
    // 인증 게이트는 우리가 화면상으로만 열어 우회한 영역이고, App Check 실패가
    // 비동기로 렌더되면서 "다시 시도" 버튼과 로고 이미지가 캡처 시점마다
    // 있었다 없었다 한다 - 기준선이 흔들리는 원인이었다. 우리가 재려는 것은
    // 게이트 통과 이후의 앱 화면이므로 게이트 안은 제외한다.
    if (el.closest("#authGate")) continue;
    const k = key(el);
    if (out[k]) continue;
    const cs = getComputedStyle(el);
    const row = {};
    if (withBox) {
      const r = el.getBoundingClientRect();
      row._box = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }
    for (const p of propList) row[p] = cs.getPropertyValue(p);
    out[k] = row;
  }
  return out;
}

async function openApp(page) {
  // 퀴즈 탭이 문제를 무작위로 뽑아서, 같은 화면을 두 번 찍으면 픽셀의 3%가
  // 매번 달랐다. 난수를 고정 시드로 바꿔야 "전환 전후가 같은가"를 비교할
  // 수 있다(앱 코드는 그대로 두고 테스트 쪽에서만 시드를 박는다).
  await page.addInitScript(() => {
    let seed = 42;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  });
  await page.goto("/mobile/index.html");
  await page.evaluate(() => {
    const gate = document.getElementById("authGate");
    const root = document.getElementById("appRoot");
    if (gate) gate.style.display = "none";
    if (root) { root.classList.remove("hidden"); root.style.display = ""; }
  });
  // 웹폰트가 늦게 오면 줄바꿈·높이가 달라져 캡처가 흔들린다.
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(300);
}

// 진행 중인 애니메이션·트랜지션을 끝난 상태로 고정한다. 선언값을 지우는
// 게 아니라(그건 모션 명세에서 이미 따로 기록했다) 재생만 멈추는 것이다.
async function settle(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`
  });
  await page.evaluate(() => {
    for (const a of document.getAnimations()) { a.finish(); }
  });
  await page.waitForTimeout(150);
}

for (const vp of VIEWPORTS) {
  test.describe(`mobile 기준선 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("탭별 정지 상태와 모션 명세", async ({ page }) => {
      await openApp(page);

      for (const tab of TABS) {
        const button = page.getByRole("button", { name: new RegExp(tab) }).first();
        if (await button.count()) {
          await button.click();
          await page.waitForTimeout(400);
        }

        // 0) 화면에 안 보이는 값 - id/meta/alt/aria/링크/입력 속성.
        const semantics = await page.evaluate(dumpSemantics);
        expect(JSON.stringify(semantics, null, 2)).toMatchSnapshot(`${vp.name}-${tab}.semantics.json`);

        // 1) 모션 명세 - 재생을 멈추기 "전"에 선언값을 읽는다.
        const motion = await page.evaluate(dumpStyles, [MOTION_PROPS, false]);
        expect(JSON.stringify(motion, null, 2)).toMatchSnapshot(`${vp.name}-${tab}.motion.json`);

        // 2) 정지 상태 - 재생을 끝낸 뒤 레이아웃을 잰다.
        await settle(page);
        const layout = await page.evaluate(dumpStyles, [LAYOUT_PROPS, true]);
        expect(JSON.stringify(layout, null, 2)).toMatchSnapshot(`${vp.name}-${tab}.layout.json`);
        await expect(page).toHaveScreenshot(`${vp.name}-${tab}.png`, { fullPage: true });
      }
    });
  });
}
