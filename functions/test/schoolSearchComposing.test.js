"use strict";

// 한글을 치는 동안 학교 목록이 비었다 채워지는 것을 막는다 (2026-09-11).
//
// 🔴 무엇이 문제였나: 한글은 자모를 하나씩 치면서 글자가 완성된다. "인천서흥"을
// 치는 동안 입력칸을 거치는 값은 인 → 인ㅊ → 인처 → 인천 → 인천ㅅ → 인천서 →
// 인천서ㅎ → 인천서흐 → 인천서흥 이고, 글자 그대로 비교하면 이 중 **절반이 0건**이라
// 목록이 통째로 비었다 다시 채워졌다. 화면에는 "검색 결과가 없어요"가 번갈아 떴다.
// Bumm님이 "한 글자씩 치고 좀 쉬어야 한다"고 하신 것이 이것이다.
//
// 🔴 왜 여기(소스 추출)인가: `schoolListSearch.js`는 브라우저가 `<script>`로 읽는 즉시실행
// 함수라 `require`할 수 없고, 실제 타건을 재는 Playwright는 **이 저장소에서 CI를
// 돌지 않는다**. 그래서 소스에서 진짜 구현을 꺼내 이 자리에서 실행한다 -
// 다시 구현해서 비교하면 "내가 쓴 것끼리 맞는지"를 보는 검사가 되어 버린다.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.resolve(__dirname, "..", "..", "schoolListSearch.js"), "utf8");

function cut(label, pattern) {
  const found = APP.match(pattern);
  // 🔴 못 찾으면 조용히 통과시키지 않는다(§21). 이름이 바뀌면 여기서 멈춰야 한다.
  assert.ok(found, `schoolListSearch.js에서 ${label}을(를) 찾지 못했습니다 - 이름이 바뀌었다면 이 검사도 같이 고쳐야 합니다.`);
  return found[0];
}

// 실제 구현을 그대로 꺼내 돌린다.
const toJamo = new Function(`
  ${cut("HANGUL_CHO", /const HANGUL_CHO = \[[^\]]*\];/)}
  ${cut("HANGUL_JUNG", /const HANGUL_JUNG = \[[^\]]*\];/)}
  ${cut("HANGUL_JONG", /const HANGUL_JONG = \[[^\]]*\];/)}
  ${cut("toJamo", /function toJamo\(text\) \{[\s\S]*?\n  \}/)}
  return toJamo;
`)();

describe("한글을 치는 동안 학교 검색이 끊기지 않는가", () => {
  it("자모 분해표가 온전하다", () => {
    assert.equal(toJamo("가"), "ㄱㅏ");
    assert.equal(toJamo("각"), "ㄱㅏㄱ");
    // 복합 중성·종성은 두 번 쳐서 만드는 글자라 풀어야 한다
    assert.equal(toJamo("화"), "ㅎㅗㅏ");
    assert.equal(toJamo("값"), "ㄱㅏㅂㅅ");
    // 시프트 한 번으로 치는 것은 풀지 않는다
    assert.equal(toJamo("까"), "ㄲㅏ");
    // 한글이 아닌 글자는 그대로 둔다
    assert.equal(toJamo("AI 3"), "AI 3");
  });

  it("🔴 조합 중인 모든 중간 상태가 완성형의 앞부분으로 남는다", () => {
    const 목표 = toJamo("인천서흥초등학교");
    // 실제로 키를 누르는 동안 입력칸에 나타나는 값들
    const 중간 = ["인", "인ㅊ", "인처", "인천", "인천ㅅ", "인천서", "인천서ㅎ", "인천서흐", "인천서흥"];
    const 어긋난것 = 중간.filter((단계) => !목표.startsWith(toJamo(단계)));
    assert.deepEqual(어긋난것, [], `이 단계에서 목록이 비어 보입니다: ${어긋난것.join(", ")}`);
    // 하한을 고정값으로 적는다 - 목록이 비면 filter가 0개라 저절로 통과한다(§21)
    assert.equal(중간.length, 9);
  });

  it("다른 학교들도 조합 중간에 끊기지 않는다", () => {
    const 사례 = [["청라초등학교", ["청", "청ㄹ", "청라"]],
      ["동방초등학교", ["동", "동ㅂ", "동바", "동방"]],
      ["마전초등학교", ["마", "마ㅈ", "마저", "마전"]]];
    for (const [이름, 단계들] of 사례) {
      const 목표 = toJamo(이름);
      for (const 단계 of 단계들) {
        assert.ok(목표.startsWith(toJamo(단계)), `"${이름}"을 치다가 "${단계}"에서 끊깁니다.`);
      }
    }
    assert.equal(사례.length, 3);
  });

  it("검색이 그 분해를 실제로 쓴다 - 폴백 경로가 배선돼 있다", () => {
    // 색인이 만들어지는지
    assert.match(APP, /jamo: squeezed\.map\(toJamo\)/);
    // 글자 그대로 0건일 때만 자모로 다시 보는지 (이미 나오던 결과를 안 바꾸는 조건)
    assert.match(APP, /if \(!hits\.length && !isChosungQuery\) \{/);
    assert.match(APP, /const jamoQuery = toJamo\(query\);/);
  });
});
