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
// 화면이 제대로 뜨지 않았을 때의 빈 결과를 "정답"으로 받아들이지 않기
// 위한 하한. 실제로 잡히는 값은 id 110개 / 요소 128개쯤이라, 절반 아래로
// 떨어졌다면 그건 회귀가 아니라 **페이지가 안 뜬 것**이다. 이 하한이
// 없으면 빈 스냅샷끼리 비교해 초록불이 나고, 더 나쁘게는 그 빈 결과가
// --update-snapshots로 기준선에 들어앉는다(COMMON_STANDARDS §21).
const MIN_IDS = 60;
const MIN_ELEMENTS = 60;

export function dumpSemantics() {
  // 글자를 잴 때 공백을 하나로 접는다. 원본 HTML은 줄바꿈+들여쓰기가
  // 텍스트 노드로 남고 JSX는 그 자리를 비우는데, 화면에서는 둘 다
  // 똑같이 보인다(공백은 접혀서 렌더된다). 접지 않고 비교하면 "소스를
  // 어떻게 줄 나눴는가"를 비교하게 되어, 실제 차이가 아닌 것으로 계속
  // 빨간불이 뜬다. 공백이 "있었는지 없었는지"는 접은 뒤에도 남으므로
  // 진짜 유실은 여전히 잡힌다.
  const text = (value) => (value || "").replace(/\s+/g, " ").trim();
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
      .map((a) => `${a.getAttribute("href")} | ${text(a.textContent).slice(0, 30)} | rel=${a.getAttribute("rel") || ""} | target=${a.getAttribute("target") || ""}`)
      .sort(),
    inputs: [...document.querySelectorAll("input, select, textarea")].filter((e) => !inGate(e))
      .map((el) => `${el.id || el.name || el.tagName}: ${JSON.stringify(attrsOf(el, ["type", "name", "placeholder", "maxlength", "minlength", "required", "inputmode", "pattern", "autocomplete", "min", "max", "step", "disabled", "readonly"]))}`)
      .sort(),
    // 버튼은 접근 가능한 이름이 사라지면 스크린리더에서 "버튼"으로만 읽힌다.
    buttons: [...document.querySelectorAll("button")].filter((e) => !inGate(e))
      .map((b) => `${b.id || "(무id)"}: ${text(b.textContent).slice(0, 24)} | ${JSON.stringify(attrsOf(b, ["type", "disabled"]))}`)
      .sort()
  };
}

// 위 두 덤프가 "아무것도 못 찾았다"를 조용히 통과시키지 않게 하는 문지기.
// 재는 쪽에서 부른다 - 덤프 함수 자체는 page.evaluate로 직렬화돼 넘어가므로
// 바깥 상수를 참조할 수 없다.
export function assertNotEmpty({ semantics, styles }) {
  if (semantics) {
    if (semantics.ids.length < MIN_IDS) throw new Error(`화면에 id가 ${semantics.ids.length}개뿐입니다(최소 ${MIN_IDS}) - 페이지가 제대로 안 뜬 상태를 기준선으로 삼을 뻔했습니다.`);
    if (!semantics.title) throw new Error("document.title이 비었습니다 - 페이지가 제대로 안 뜬 상태입니다.");
  }
  if (styles) {
    const count = Object.keys(styles).length;
    if (count < MIN_ELEMENTS) throw new Error(`잰 요소가 ${count}개뿐입니다(최소 ${MIN_ELEMENTS}) - 페이지가 제대로 안 뜬 상태를 기준선으로 삼을 뻔했습니다.`);
  }
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
    // id가 없는 요소는 글자로 구분한다. 이때 공백을 하나로 접는 이유는
    // dumpSemantics와 같다 - 원본 HTML은 줄바꿈+들여쓰기가 텍스트 노드로
    // 남고 JSX는 그 자리를 비운다. 접지 않으면 같은 요소가 서로 다른
    // 키를 갖게 되어, 실제로는 같은 화면인데 "원본에만 있는 요소"와
    // "전환본에만 있는 요소"가 잔뜩 생긴다.
    return `${el.tagName.toLowerCase()}:${(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 12)}`;
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

// 어느 화면을 잴 것인가. mobile/이 곧 배포되는 화면이다.
//
// **여기 걸린 스냅샷은 리액트 전환 "전"의 화면에서 찍은 것이고, 전환 뒤에도
// 그대로 두고 통과시켰다.** 새로 찍어 맞춘 것이 아니다 - 그게 이 구조의
// 핵심이다. 앞으로도 화면을 고칠 때만 다시 찍고, "통과시키려고" 다시 찍지
// 않는다. 전환 전 원본은 mobile-react-freeze-20260909 태그에 남아 있다.
//
// 배포된 주소를 그대로 재고 싶으면 AIWAYS_BASELINE_BASE_URL을 준다
// (playwright.config.js 참고) - 롤백이 같은 화면을 되살리는지 확인할 때 썼다.
export const TARGET = process.env.AIWAYS_BASELINE_TARGET || "mobile";

// target을 인자로 받을 수 있게 해 둔 이유: 원본과 전환본을 **한 테스트 안에서
// 나란히 띄워 비교**하는 스펙(reactMarkup.spec.js)이 있기 때문이다. 환경변수
// 하나로는 한쪽만 고를 수 있다.
export async function openApp(page, target = TARGET) {
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
    const START = 42;
    let seed = START;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    // 아래 "퀴즈 문제 맞추기" 주석 참고.
    window.__aiwaysBaselineResetRandom = () => { seed = START; };
  });
  await page.goto(`/${target}/index.html`);
  // 앱이 화면을 그린 뒤에 게이트를 연다.
  //
  // 순서가 중요하다. 실제 서비스에서는 authGate.js가 **인증이 끝난 뒤**
  // #appRoot를 드러내므로, 그 시점에는 앱이 이미 초기화를 마친 상태다.
  // 그런데 하네스가 로드 직후 곧바로 열어버리면, 번들이 늦게 도착하는
  // 환경(원격 주소 대조 등)에서는 앱이 '이미 보이는 화면'에서 초기화를
  // 시작하게 되어 탭 높이 측정 결과가 달라진다 - 실제로 라이브 주소로
  // 대조했을 때 탭 공유 높이가 710px/857px로 갈렸다. 그릴 것을 다 그린
  // 뒤에 여는 쪽이 실제 동작에 가깝고, 환경에 따라 흔들리지도 않는다.
  await page.waitForFunction(() => (document.getElementById("appRoot")?.childElementCount ?? 0) > 0, null, { timeout: 15000 });
  await page.evaluate(() => {
    const gate = document.getElementById("authGate");
    const root = document.getElementById("appRoot");
    // 🔴 숨기는 것이 아니라 **떼어낸다**(2026-09-10).
    //
    // 2026-09-10부터 authGate.js는 앱을 가리지 않고, 인증 확인이 실패했을 때만
    // 화면 맨 위에 띠로 남는다. 그런데 **자동화는 App Check를 절대 통과하지
    // 못하므로 여기서는 그 실패가 100% 일어난다** - `display:none`으로만 숨기면
    // 잠시 뒤 탐침이 실패하면서 띠가 스스로 다시 나타나 **화면 전체를 54px
    // 밀어낸다.** 실제로 그렇게 기준선 21개가 깨졌다.
    //
    // 학생이 정상적으로 접속했을 때는 이 띠가 없다. 기준선이 담아야 하는 것은
    // 그 화면이므로, 자동화에서만 생기는 이 띠를 아예 떼어낸다. 게이트 안쪽은
    // 원래부터 덤프에서 제외돼 있어(아래 inGate) 떼어내도 재는 값은 안 바뀐다.
    if (gate) gate.remove();
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

  // 퀴즈 문제 맞추기.
  //
  // 난수를 고정 시드로 바꿔도 **소비 순서**가 다르면 뽑히는 문제가 달라진다.
  // 원본은 시작할 때 검색창 이모지 회전이 난수를 먼저 쓰고 그 다음에 문제를
  // 뽑는데, 리액트는 첫 렌더에서 문제를 먼저 뽑는다. 어느 쪽이 옳고 그른
  // 순서가 아니라 그냥 다를 뿐이라, 순서를 억지로 맞추는 대신 **둘 다 같은
  // 자리에서 다시 뽑게** 한다: 시드를 처음으로 되돌리고 "다시 도전하기"를
  // 누른다. 두 구현 모두 그 버튼이 문제를 새로 뽑는 유일한 입구다.
  //
  // 이 일을 **아래 이모지 위상 고정보다 먼저** 하는 이유: 이모지 쪽은
  // 검색창에 글자를 넣었다 지우는 조작이라 리액트에 상태 갱신이 밀려 있게
  // 되는데, 그 상태에서 버튼을 누르면 리액트가 밀린 일을 먼저 처리하면서
  // 문제를 뽑는 시점이 어긋난다(실제로 두 화면이 다른 문제를 냈다).
  // 아무것도 밀려 있지 않은 지금 뽑아 두면 그 문제가 생기지 않는다.
  await page.evaluate(() => {
    window.__aiwaysBaselineResetRandom?.();
    document.getElementById("restartQuizBtn")?.click();
  });
  await page.waitForTimeout(150);

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
  // 한 글자를 넣었다가 지운다. 넣으면 회전이 멈추고, 지우면 그 순간부터
  // 회전이 처음부터 다시 시작한다 - 그 시작점을 우리가 알기 때문에 위상을
  // 셀 수 있다. (값 자체는 결국 빈 문자열로 돌아오므로 화면에 흔적이 없다.
  //  빈 입력창에 input 이벤트만 주는 방법도 써봤는데, 값이 안 바뀌면
  //  리액트 쪽은 아무 일도 일어나지 않아서 두 구현에 다르게 동작했다.)
  // 위상뿐 아니라 **어떤 이모지가 뽑히는지**도 맞춰야 한다. 회전이 다시
  // 시작될 때 난수를 쓰는데, 그 시점의 난수 위치가 두 구현에서 다르면
  // 화면에 다른 그림이 남는다. 여기서 시드를 한 번 더 처음으로 돌려두면,
  // 아래 두 번의 입력 사이에는 난수를 쓰는 코드가 없으므로 회전이 다시
  // 시작되는 순간의 난수 위치가 양쪽 모두 같아진다.
  await page.evaluate(() => window.__aiwaysBaselineResetRandom?.());
  await page.locator("#searchInput").fill("ㄱ");
  await page.clock.runFor(350); // 디바운스 만료 -> 회전 정지
  await page.locator("#searchInput").fill("");
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
