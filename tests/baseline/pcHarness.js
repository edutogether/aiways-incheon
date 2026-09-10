// PC 대시보드 기준선의 공용 부분 (S0).
//
// `mobile/` 전환 때 쓴 harness.js와 **재는 방식은 같고 여는 방식만 다르다.**
// 두 하네스가 다른 방식으로 재면 "같다"는 주장의 기준이 두 개가 된다.
//
// PC가 다른 점 셋:
//   1. 인증 게이트가 없다. 대신 **학교 선택 모달**을 지나야 대시보드가 보인다.
//   2. 한 페이지에 섹션이 일곱 개 있고 스크롤로 넘어간다(모바일은 탭 4개).
//   3. 매립지 패널에 **현재 시각**이 찍힌다 - 시계를 안 세우면 기준선이
//      찍을 때마다 달라진다.
import { LAYOUT_PROPS, MOTION_PROPS } from "./harness.js";

export { LAYOUT_PROPS, MOTION_PROPS };

// 무엇을 재는가. 기본은 지금 라이브인 루트 index.html이고, 전환본을 재려면
// AIWAYS_PC_TARGET=pc-next 로 바꾼다 - `mobile/` 전환 때 쓴 것과 같은 방식이다.
//
// 🔴 **기준선 파일은 그대로 두고 대상만 바꾼다.** 전환본을 재면서 스냅샷을
// 다시 찍으면 비교 대상이 자기가 만든 것이 되어 검사가 아니게 된다(§21-7).
const TARGET = process.env.AIWAYS_PC_TARGET || "";
export const PAGE = TARGET ? `/${TARGET}/index.html` : "/index.html";

// 시각이 화면에 그대로 찍히므로 고정한다. harness.js와 같은 값을 쓴다.
const FROZEN_TIME = new Date("2026-09-01T09:00:00+09:00");
const WARMUP_MS = 2000;
const PAUSE_MARGIN_MS = 3000;

export const PC_VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900, touch: false },
  { name: "1920x1080", width: 1920, height: 1080, touch: false },
  { name: "1024x768", width: 1024, height: 768, touch: true },
  { name: "768x1024", width: 768, height: 1024, touch: true }
];

// 스크롤로 넘어가는 일곱 섹션. id는 index.html에 이미 붙어 있다.
export const PC_SECTIONS = [
  { id: "dashboard", name: "대시보드" },
  { id: "project", name: "프로젝트" },
  { id: "curriculum", name: "교육과정" },
  { id: "hah", name: "가정연계" },
  { id: "flow", name: "흐름" },
  { id: "gallery", name: "갤러리" },
  { id: "resources", name: "자료" }
];

// PC는 id 없는 요소가 많아서(패널 안 카드·차트·범례) 기본 범위만으로는
// 정작 깨지기 쉬운 곳이 하나도 안 잡힌다. 실제로 오늘 태블릿에서 깨진
// 것들(막대 표, 도넛, QR)이 전부 id가 없다.
export const PC_SCOPE = [
  "[id]", "[data-role]", "button", "select", "input",
  ".dashboard-grid > .panel",
  ".panel-head", ".kpi-row > div", ".class-kpis > div", ".landfill-metrics > div",
  ".bar-list > div", ".bar-list > div > *",
  ".confusion > div", ".confusion > div > *",
  ".donut", ".donut-pair", ".landfill-kpi-ring",
  ".chart-wrap", ".combo-chart",
  ".qr-invite", ".qr-invite > *",
  ".upload-highlights li",
  ".project-cards > *", ".subject-grid > *", ".flow-card", ".gallery-grid > *", ".resource-grid > *"
].join(", ");

// 화면이 제대로 안 뜬 상태를 정답으로 굳히지 않기 위한 하한.
// 실제로 잡히는 값은 id 200개 안팎 / 요소 300개 안팎이다.
const MIN_IDS = 80;
const MIN_ELEMENTS = 80;

export function assertPcNotEmpty({ semantics, styles, where }) {
  const 어디 = where ? ` (${where})` : "";
  if (semantics) {
    if (semantics.ids.length < MIN_IDS)
      throw new Error(`화면에 id가 ${semantics.ids.length}개뿐입니다(최소 ${MIN_IDS})${어디} - 페이지가 제대로 안 뜬 상태를 기준선으로 삼을 뻔했습니다.`);
    if (!semantics.title) throw new Error(`document.title이 비었습니다${어디} - 페이지가 제대로 안 뜬 상태입니다.`);
  }
  if (styles) {
    const count = Object.keys(styles).length;
    if (count < MIN_ELEMENTS)
      throw new Error(`잰 요소가 ${count}개뿐입니다(최소 ${MIN_ELEMENTS})${어디} - 페이지가 제대로 안 뜬 상태를 기준선으로 삼을 뻔했습니다.`);
  }
}

// 학교 선택 모달을 정상 경로로 지나간다.
//
// 자동화 브라우저는 App Check를 통과하지 못해 학교 "검색"을 실행할 수 없다
// (reCAPTCHA가 자동화를 거부한다 - app.md "자주 틀리는 것" 참고). 그래서
// 화면 코드가 읽는 값과 **같은 키**를 미리 넣어 고른 상태로 만든다. 제품
// 코드는 건드리지 않으며, 실제 권한은 전부 서버가 강제한다.
const SEED_SCHOOL = () => {
  try {
    localStorage.setItem("aiways_pc_dashboard_school_v1", "7361073");
    localStorage.setItem("aiways_pc_dashboard_school_name_v1", "인천청라초등학교");
    localStorage.setItem("aiways_pc_dashboard_classnum_v1", "1");
  } catch { /* 저장이 막힌 환경 - 그때는 모달이 뜨고 아래 대기에서 실패한다 */ }
};

export async function openDashboard(page) {
  // 로드 "전"에 시계를 세우면 App Check/Functions 클라이언트의 내부 타이머가
  // 멈춰 요청이 영영 안 끝난다(harness.js에서 실제로 겪은 것). 세우는 것은
  // 로드가 끝난 뒤에 한다.
  await page.clock.install({ time: FROZEN_TIME });
  await page.addInitScript(SEED_SCHOOL);
  await page.addInitScript(() => {
    const START = 42;
    let seed = START;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    window.__aiwaysBaselineResetRandom = () => { seed = START; };
  });
  await page.goto(PAGE);
  // 대시보드 그리드가 실제로 자리를 잡을 때까지 기다린다. 존재 여부가 아니라
  // **폭이 잡혔는지**를 본다 - 부모가 display:none이면 요소는 있어도 0이다.
  await page.waitForFunction(() => {
    const grid = document.querySelector(".dashboard-grid");
    return !!grid && grid.getBoundingClientRect().width > 0;
  }, null, { timeout: 20000 });
  // 웹폰트가 늦게 오면 줄바꿈·높이가 달라져 캡처가 흔들린다.
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // 여기서부터 시간은 우리가 흘려보내는 만큼만 흐른다. 읽는 사이에도 시계가
  // 흐르므로 여유를 둔다 - 그러지 않으면 "과거로는 못 간다"고 거부당한다.
  const pageNow = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(pageNow + PAUSE_MARGIN_MS));
  await page.clock.runFor(WARMUP_MS);
  await page.waitForTimeout(300);
}

// 섹션 하나를 화면에 올린다.
//
// 🔴 스크롤 위치가 **정확히 같아야** 한다. 처음에 scrollIntoView만 썼더니
// 같은 화면을 두 번 재는데 좌표가 통째로 5px씩 어긋났다 - 크기는 전부 같고
// y만 밀린 것이라, 레이아웃이 아니라 **스크롤이 멎은 위치**가 달랐던 것이다.
// 이 앱은 scroll-snap을 쓰는데 스냅이 비동기로 자리를 잡아서, 재는 순간이
// 그 전인지 후인지에 따라 갈렸다. 흔들리는 기준선은 증명 수단이 못 된다.
//
// 그래서 스냅과 부드러운 스크롤을 끄고 정수 위치로 직접 옮긴 뒤, **실제로
// 그 자리에 멎었는지 확인**한다. 끄는 것은 스크롤 "동작"이지 이 기준선이
// 재는 값(좌표·색·타이포)이 아니다.
const SCROLL_STYLE_ID = "aiways-pc-baseline-scroll";

export async function showSection(page, id) {
  await page.addStyleTag({
    content: `#${SCROLL_STYLE_ID}{}
    html, body, .snap-root, .scene {
      scroll-behavior: auto !important;
      scroll-snap-type: none !important;
      scroll-snap-align: none !important;
    }`
  });
  const target = await page.evaluate((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return null;
    const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
    window.scrollTo(0, top);
    return top;
  }, id);
  // 못 찾으면 **직전 섹션 화면을 그 섹션의 정답으로 찍게 된다**(§21).
  if (target === null) throw new Error(`섹션 #${id}을 찾지 못했습니다 - 기준선을 엉뚱한 화면으로 찍을 뻔했습니다.`);
  await page.waitForTimeout(400);

  // 스냅이나 지연 로딩이 자리를 다시 옮겼으면 한 번 더 맞춘다.
  const landed = await page.evaluate((top) => {
    if (Math.abs(window.scrollY - top) > 0.5) window.scrollTo(0, top);
    return Math.round(window.scrollY);
  }, target);
  await page.waitForTimeout(200);

  const finalY = await page.evaluate(() => Math.round(window.scrollY));
  // 문서가 짧아 목표까지 못 내려가는 마지막 섹션은 정상이다. 그 경우가
  // 아닌데 어긋났다면 그대로 재면 안 된다 - 5px 밀린 기준선이 만들어진다.
  const maxScroll = await page.evaluate(() => Math.round(document.documentElement.scrollHeight - window.innerHeight));
  if (finalY !== target && finalY !== Math.min(target, maxScroll)) {
    throw new Error(`섹션 #${id}에서 스크롤이 ${target}px에 멎지 않았습니다(실제 ${finalY}px, 최대 ${maxScroll}px) - 흔들리는 기준선을 만들 뻔했습니다.`);
  }
  return landed;
}

// showSection이 끼워 넣은 스크롤 무력화 스타일을 걷어낸다.
export async function unfreezeScroll(page) {
  await page.evaluate((id) => {
    for (const style of document.querySelectorAll("style")) {
      if (style.textContent.includes(`#${id}{}`)) style.remove();
    }
  }, SCROLL_STYLE_ID);
}
