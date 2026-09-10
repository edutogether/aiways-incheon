"use strict";

// 3초판단 화면(`miniapp/3second.html`)에서 **학생이 친 글자가 다시 마크업이 되는
// 길**이 되살아나지 않게 막는다 (2026-09-10 CodeQL js/xss-through-dom 수정 후).
//
// 🔴 왜 여기 있는가: 이 저장소의 Playwright는 **CI에서 돌지 않는다.** 실제 실행
// 검증은 `tests/miniappInjection.spec.js`에 있지만 그건 로컬 전용이라, 누가
// `textContent`를 `innerHTML`로 되돌려도 CI는 초록불이다. 이 파일은 브라우저 없이
// **소스 글자만 보고** CI(`test` job)에서 도는 값싼 문지기다. 실행 검증을 대신하는
// 것이 아니라, 실행 검증이 없는 동안 그 자리를 지킨다.
//
// 🔴 "인라인 onclick을 전부 금지"하지 않는다. 이 파일에는 `switchTab('tab-judge')`
// 처럼 **우리가 직접 적은 고정 문자열** onclick이 스무 개쯤 있고 그건 위험하지
// 않다. 위험한 것은 **값을 문자열로 엮어 만든 핸들러**(`onclick="f('${name}')"`)라,
// 그 형태만 막는다. 넓게 막으면 무해한 것을 잡고 사람들이 검사를 꺼 버린다.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const miniapp = fs.readFileSync(path.join(root, "miniapp", "3second.html"), "utf8");

test("검사가 실제 파일을 읽었다", () => {
  // 빈 파일이나 잘린 파일을 읽고 아래 doesNotMatch들이 통째로 통과하는 일이
  // 없도록 하한부터 못박는다(COMMON_STANDARDS §21).
  assert.ok(miniapp.length > 20000, `3second.html이 ${miniapp.length}자뿐입니다 - 파일을 제대로 못 읽었습니다.`);
  assert.match(miniapp, /function checkTrash\(/, "checkTrash가 없습니다 - 파일 구조가 바뀌었으면 이 검사도 다시 봐야 합니다.");
  assert.match(miniapp, /function updateHoldUI\(|hold-item-card/, "보류함 렌더가 없습니다 - 이 검사가 지킬 대상이 사라졌습니다.");
});

test("검색 결과 제목은 textContent로 넣는다", () => {
  // refinedKey는 학생이 검색창에 친 글자다. innerHTML로 넣으면 실행된다
  // (고치기 전 실측으로 확인했다).
  assert.doesNotMatch(
    miniapp,
    /resTitle['"]\)\s*\.innerHTML/,
    "resTitle에 innerHTML을 쓰고 있습니다 - 학생이 친 글자가 그대로 실행됩니다."
  );
  assert.match(
    miniapp,
    /resTitle['"]\)\s*\.textContent/,
    "resTitle을 textContent로 넣는 코드가 사라졌습니다."
  );
});

test("보류함 카드의 이름·날짜는 textContent로 넣는다", () => {
  // localStorage에 남는 자리라, 한 번 들어가면 새로고침할 때마다 다시 실행된다.
  assert.match(miniapp, /data-hold-name/, "보류함 카드의 이름 자리 표시가 없습니다.");
  assert.match(
    miniapp,
    /\[data-hold-name\]['"]\)\s*\.textContent\s*=/,
    "보류함 카드 이름을 textContent로 넣지 않고 있습니다."
  );
  assert.match(
    miniapp,
    /\[data-hold-date\]['"]\)\s*\.textContent\s*=/,
    "보류함 카드 날짜를 textContent로 넣지 않고 있습니다."
  );
});

test("값을 문자열로 엮어 만든 인라인 핸들러가 없다", () => {
  // 🔴 이름이 작은따옴표 속성 안에 들어가던 구조라, 이름에 ' 하나만 있어도
  // 속성이 깨졌다 - 장난이 아니라 실수로도 화면이 망가진다.
  assert.doesNotMatch(
    miniapp,
    /onclick\s*=\s*(["'])[^"']*\$\{/,
    "인라인 onclick 안에 값을 끼워 넣고 있습니다 - addEventListener로 넘기세요."
  );
  assert.doesNotMatch(
    miniapp,
    /resolveHoldItem\(\s*['"]\$\{/,
    "resolveHoldItem에 값을 문자열로 엮어 넘기고 있습니다."
  );
  assert.match(
    miniapp,
    /\[data-hold-resolve\]['"]\)[\s\S]{0,120}addEventListener/,
    "해결 완료 버튼을 addEventListener로 잇는 코드가 사라졌습니다."
  );
});

test("고정 문자열 인라인 onclick은 그대로 둔다 - 이 검사가 과잉이 아닌지 확인", () => {
  // 이 파일에는 우리가 직접 적은 고정 onclick이 많다. 위 검사가 그것까지
  // 잡기 시작하면 사람들이 검사를 꺼 버리므로, **잡지 않는다는 것**도 못박는다.
  const staticOnclicks = miniapp.match(/onclick\s*=\s*"[^"]*"/g) || [];
  assert.ok(
    staticOnclicks.length >= 10,
    `고정 onclick이 ${staticOnclicks.length}개뿐입니다 - 위 검사가 무엇을 걸러내는지 다시 봐야 합니다.`
  );
});
