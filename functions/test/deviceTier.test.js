"use strict";
// 기기 라우팅: 이 폭·높이에서 학생 앱(iframe)으로 보낼 것인가, PC/태블릿
// 대시보드를 보여줄 것인가.
//
// 🔴 폭만으로 가르면 **폰을 가로로 눕혔을 때**(667×375) 폭이 667이라
// 대시보드가 뜨고, 반대로 폭 767 이하를 전부 폰으로 보면 **학교에 보급되는
// 600×960 소형 태블릿이 대시보드 대신 학생 앱을 받는다.** 2026-09-10에
// 두 번째가 실제로 그 상태였다.
//
// 그래서 판정 기준이 "짧은 변"이다 - 기기를 어느 방향으로 놓든 짧은 변은
// 그대로다. 이 파일은 **그 기준이 실제로 그렇게 도는지**를 본다(소스에 그런
// 글자가 있는지가 아니라, 돌려서 결과를 본다).
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "..", "deviceTier.js"), "utf8");

// deviceTier.js는 IIFE라 window/document를 넣어 주면 그대로 돌릴 수 있다.
function tierAt(width, height) {
  const attrs = {};
  const documentElement = {
    setAttribute(k, v) { attrs[k] = v; },
    removeAttribute(k) { delete attrs[k]; }
  };
  const frame = { src: "", removeAttribute() { this.src = ""; } };
  const doc = { getElementById: (id) => (id === "phoneShellFrame" ? frame : null), documentElement };
  const win = { innerWidth: width, innerHeight: height, addEventListener() {}, setTimeout: () => 0, clearTimeout() {} };
  const run = new Function("window", "document", "setTimeout", "clearTimeout", source);
  run(win, doc, () => 0, () => {});
  return { tier: attrs["data-tier"] || "not-phone", frameSrc: frame.src };
}

test("기기 라우팅은 폭이 아니라 짧은 변으로 가른다", () => {
  // 폰은 눕히든 세우든 학생 앱으로 간다.
  for (const [w, h, 이름] of [[390, 844, "폰 세로"], [844, 390, "폰 가로"], [667, 375, "폰 가로(작은 폰)"], [430, 932, "큰 폰 세로"]]) {
    const r = tierAt(w, h);
    assert.equal(r.tier, "phone", `${이름} ${w}x${h}는 학생 앱으로 가야 한다`);
    assert.equal(r.frameSrc, "./mobile/index.html", `${이름}은 앱 iframe이 실제로 붙어야 한다`);
  }

  // 태블릿은 눕히든 세우든 대시보드를 받는다. 600×960이 학교 보급 소형 기기다.
  for (const [w, h, 이름] of [[600, 960, "소형 태블릿 세로"], [960, 600, "소형 태블릿 가로"],
    [768, 1024, "표준 태블릿 세로"], [1024, 768, "표준 태블릿 가로"], [820, 1180, "에어 세로"]]) {
    const r = tierAt(w, h);
    assert.equal(r.tier, "not-phone", `${이름} ${w}x${h}는 대시보드를 받아야 한다`);
    assert.equal(r.frameSrc, "", `${이름}에는 앱 iframe이 붙으면 안 된다`);
  }

  // PC도 당연히 대시보드다.
  assert.equal(tierAt(1440, 900).tier, "not-phone");

  // 🔴 경계를 못박는다. 599와 600 사이에서 갈려야 하고, 그 값이 조용히
  // 움직이면 학교 기기 절반이 다른 화면을 받는다.
  assert.equal(tierAt(599, 900).tier, "phone", "짧은 변 599는 폰이다");
  assert.equal(tierAt(600, 900).tier, "not-phone", "짧은 변 600은 태블릿이다");
});
