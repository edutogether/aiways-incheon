// 기준선 하네스의 공용 부분.
//
// 원래 mobileBaseline.spec.js 안에 전부 들어 있었는데, 상호작용 상태를
// 재는 두 번째 스펙(mobileInteraction.spec.js)이 같은 측정 방식을 써야
// 해서 여기로 뺐다. 두 스펙이 서로 다른 방식으로 재면 "같다"는 주장의
// 기준이 두 개가 되어 버린다.
//
// 옮기면서 함수 본문은 바꾸지 않았다 - page.evaluate에 넘길 때 함수
// 원문이 직렬화되므로, 본문이 한 글자라도 달라지면 기존에 고정해 둔
// 스냅샷이 흔들린다.

export const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 }
];

// 정지 상태에서 재는 것. 레이아웃·타이포·색에 실제로 영향을 주는 것만
// 추린다 - 전부 덤프하면 브라우저 기본값까지 diff에 섞여 신호가 묻힌다.
export const LAYOUT_PROPS = [
  "display", "position", "width", "height", "margin", "padding",
  "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
  "color", "background-color", "border", "border-radius", "box-shadow",
  "flex-direction", "justify-content", "align-items", "gap", "grid-template-columns",
  "opacity", "overflow", "z-index"
];

// 움직임. 선언값이라 재생 진행도와 무관하게 안정적이다.
export const MOTION_PROPS = [
  "transition-property", "transition-duration", "transition-timing-function", "transition-delay",
  "animation-name", "animation-duration", "animation-timing-function", "animation-delay",
  "animation-iteration-count", "transform"
];

// dumpStyles가 훑는 기본 범위. 정적 화면에는 이걸로 충분하다.
export const DEFAULT_SCOPE = "[id], [data-role], button, .tab-btn";

// 상호작용 상태에서 쓰는 넓은 범위. 기본 범위는 id가 붙은 요소와 버튼만
// 보는데, 이 앱이 실행 중에 만들어 내는 것들(보류함 카드, 검색 자동완성
// 항목, 퀴즈 등급표 칩, 반 랭킹 줄, 화면 아래 토스트)은 id가 없어서
// 기본 범위로는 **하나도 안 잡힌다.** 전환에서 가장 깨지기 쉬운 게
// 정확히 그 "실행 중에 만들어지는" 부분이라, 상호작용 스펙은 여기까지
// 본다. 기본 범위를 넓히지 않고 따로 둔 이유는, 이미 고정해 둔 정적
// 스냅샷을 흔들지 않기 위해서다.
export const INTERACTION_SCOPE = [
  DEFAULT_SCOPE,
  ".hold-item-card",
  ".hold-item-card span",
  ".practice-item",
  ".practice-item span",
  "#search-suggestions > div",
  "#quickSelectGrid > button",
  "#quizRankLadder > div",
  "#classRankingList > li",
  "#resCandidates > *",
  "body > div.fixed"
].join(", ");

// 화면에 안 보이지만 사라지면 기능이 죽거나 접근성이 무너지는 값들.
// 스크린샷·computed style로는 절대 안 잡힌다 - 다른 저장소(Voice Cinema)가
// 전환 과정에서 요소 id 20여 개를 잃은 것을 이 대조로 잡았다. 이 앱은
// app.js/mobile/app.js가 getElementById로 DOM을 직접 붙잡는 구조라
// **id 하나만 사라져도 그 기능이 조용히 죽는다** - 더 취약하다.
export function dumpSemantics() {
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

// page.evaluate에 넘길 때 함수 본문만 직렬화되므로 key()를 안에 다시 둔다.
//
// 인자를 배열 하나로 받아서 안에서 푸는 이유(2026-09-09에 실제로 당한 것):
// page.evaluate(fn, [A, B])는 배열을 **인자 하나로** 넘긴다. 예전 시그니처가
// dumpStyles(propList, withBox)여서 propList에 [PROPS, false]가 통째로 들어갔고,
// for (const p of propList)가 "배열"과 "false"를 돌면서 getPropertyValue에
// 넘겨 **전부 빈 문자열**을 받았다. 그래서 3주 가까이 layout/motion 스냅샷이
// 실제로는 아무 값도 재지 않은 채 통과하고 있었다(요소 키 목록과 스크린샷만
// 유효했다). 인자를 하나로 받으면 이 실수가 구조적으로 불가능해진다.
export function dumpStyles([propList, withBox, scope]) {
  const key = (el) => {
    if (el.id) return `#${el.id}`;
    if (el.dataset && el.dataset.role) return `[data-role=${el.dataset.role}]`;
    return `${el.tagName.toLowerCase()}:${(el.textContent || "").trim().slice(0, 12)}`;
  };
  const out = {};
  for (const el of document.querySelectorAll(scope || "[id], [data-role], button, .tab-btn")) {
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

// 시계를 고정하는 시각. 실제 값을 재기 시작하자 두 가지가 매 실행 흔들렸다:
//
//  1) #searchEmojiIcon - initSearchEmojiIcon()이 350ms 간격으로 이모지를
//     바꾸는데, 바꿀 때마다 opacity를 0으로 내렸다가 60ms 뒤 1로 올린다.
//     즉 350ms 중 60ms 동안은 투명하다 - 캡처 시점에 따라 opacity가 0이나
//     1로 갈렸다.
//  2) 보류함/실천 기록의 날짜 문구("9월 9일") - new Date()를 그대로 쓴다.
//     실행한 날에 따라 값이 달라진다.
//
// 둘 다 "앱이 시계를 본다"는 같은 원인이라 시계 자체를 고정한다. 임의의
// 순간을 찍는 대신 **정해진 시각에 정해진 만큼 시간을 흘려보내고** 잰다.
// 앱 코드는 건드리지 않는다.
const FROZEN_TIME = new Date("2026-09-09T09:00:00Z");
// 시계를 고정한 뒤 흘려보낼 시간. 앱이 걸어두는 지연이 전부 지나가되
// (syncTabHeights 400ms/1200ms, 이모지 회전 350ms 주기), 흘려보낸 끝이
// 회전의 "투명한 60ms" 구간에 걸리지 않는 값이어야 한다.
const WARMUP_MS = 2000;

export async function openApp(page) {
  // install()만 하면 가짜 시계가 실제 시간과 같이 흐른다. 날짜 문구는 이걸로
  // 고정되지만, 이모지 회전 위상까지 고정되지는 않는다(아래 참고).
  // 로드 "전"에 시계를 세워 버리는 방법도 해봤는데, App Check/Functions
  // 클라이언트가 내부적으로 타이머를 쓰기 때문에 요청이 영영 안 끝난다
  // (waitForFunction이 15초 타임아웃으로 죽었다). 그래서 세우는 것은
  // 로드가 끝난 뒤에 한다.
  await page.clock.install({ time: FROZEN_TIME });
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
  // 가입 배너(#signupBanner)는 checkStudentProfile 응답이 온 "뒤에" 결정된다
  // - 프로필이 있으면 숨기고, 없거나 실패하면 띄운다. 그 응답을 기다리지
  // 않고 찍으면 배너가 있다 없다 한다. 로컬에서는 App Check가 막혀 항상
  // 실패 경로(=배너 노출)로 끝나므로, 그 최종 상태가 될 때까지 기다린다.
  await page.waitForFunction(() => {
    const banner = document.getElementById("signupBanner");
    return !!banner && !banner.classList.contains("hidden");
  }, null, { timeout: 15000 });
  // 여기서부터 시간은 우리가 흘려보내는 만큼만 흐른다. 읽어온 시각에 여유를
  // 두는 이유: 읽는 사이에도 시계는 흐르고 있어서, 방금 읽은 값을 그대로
  // 주면 "과거로는 못 간다"며 거부당한다(실제로 겪었다).
  const PAUSE_MARGIN_MS = 3000;
  const pageNow = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(pageNow + PAUSE_MARGIN_MS));
  // 앱이 로드 시점에 걸어둔 지연(syncTabHeights 400ms/1200ms)을 소진시킨다.
  await page.clock.runFor(WARMUP_MS);

  // 이모지 회전의 "위상"을 고정한다.
  //
  // initSearchEmojiIcon()은 350ms마다 이모지를 바꾸는데, 바꿀 때마다
  // opacity를 0으로 내렸다가 60ms 뒤 1로 올린다. 즉 350ms 중 60ms는
  // 투명하다. 시계를 세워도 **세운 순간이 회전의 어디쯤인지**는 페이지
  // 로딩에 걸린 실제 시간에 따라 달라져서, 그대로 재면 opacity가 0과 1로
  // 갈린다(실제로 겪었다).
  //
  // 그래서 앱 스스로 회전을 다시 시작하게 만든 뒤, 그 시점부터 정확히
  // 세어서 잰다. 빈 검색창에 input 이벤트를 주면 350ms 디바운스 뒤
  // matchNow()가 돌고, 값이 비어 있으므로 startRotation()으로 되돌아간다
  // - 화면에 남는 흔적은 없다(값은 그대로 빈 문자열이다).
  await page.locator("#searchInput").dispatchEvent("input");
  await page.clock.runFor(350); // 디바운스 만료 -> startRotation -> opacity 0
  await page.clock.runFor(100); // showIcon의 60ms 뒤 -> opacity 1 (다음 회전은 +350)
  await page.waitForTimeout(300);
}

// 진행 중인 애니메이션·트랜지션을 끝난 상태로 고정한다. 선언값을 지우는
// 게 아니라(그건 모션 명세에서 이미 따로 기록했다) 재생만 멈추는 것이다.
//
// 주입한 스타일에 id를 다는 이유: 이건 "0s로 덮어쓰기"라서, 한 페이지에서
// 여러 화면을 연속으로 재는 동안 남아 있으면 **그 다음 화면의 모션 선언값이
// 전부 0s로 읽힌다.** 실제로 이 파일의 스펙은 탭 4개를 한 페이지에서 도는데,
// 지우지 않으면 2~4번째 탭의 모션 명세가 통째로 무의미해진다. 그래서 재고
// 나면 unsettle()로 반드시 걷어낸다.
const SETTLE_STYLE_ID = "aiways-baseline-settle";
export async function settle(page) {
  await page.addStyleTag({
    content: `#${SETTLE_STYLE_ID}{}
    *, *::before, *::after {
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

// settle()이 덮어쓴 0s를 걷어낸다. 위 주석 참고.
export async function unsettle(page) {
  await page.evaluate((id) => {
    for (const style of document.querySelectorAll("style")) {
      if (style.textContent.includes(`#${id}{}`)) style.remove();
    }
  }, "aiways-baseline-settle");
}
