"use strict";
// 2026-09-01 종합감사(B그룹 4번): 이 파일은 어떤 테스트에서도 한 번도
// require된 적 없었다. 이 함수의 판정 결과(RETAKE/CAUTION/SAFE)가
// 그대로 학생에게 "다시 찍어주세요"/"확인해주세요" UX로 노출되므로,
// poor/caution 각 판정 조건 하나하나가 실제로 맞물려 동작하는지 확인한다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateAnalysisSafety } = require("../lib/sortingAnalysisSafety");

test("defaults to SAFE with no reasons when nothing is flagged", () => {
  const result = evaluateAnalysisSafety({});
  assert.equal(result.safetyLevel, "SAFE");
  assert.equal(result.retakeRecommended, false);
  assert.equal(result.directSelectionRecommended, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.uxState, "safe");
});

test("also defaults to SAFE when called with no argument at all", () => {
  const result = evaluateAnalysisSafety();
  assert.equal(result.safetyLevel, "SAFE");
});

for (const flag of [
  { targetVisibility: "poor" },
  { imageQuality: "poor" },
  { occlusion: "severe" },
  { multiObject: true, targetDominance: "low" },
  { backgroundClutter: "high", targetVisibility: "partial" },
]) {
  test(`RETAKE (poor) for ${JSON.stringify(flag)}`, () => {
    const result = evaluateAnalysisSafety(flag);
    assert.equal(result.safetyLevel, "RETAKE");
    assert.equal(result.retakeRecommended, true);
    assert.deepEqual(result.reasons, ["image_ambiguity"]);
    assert.equal(result.uxState, "retake");
  });
}

test("backgroundClutter=high alone with a clear target is NOT poor -- clutter only counts against a non-clear view", () => {
  const result = evaluateAnalysisSafety({ backgroundClutter: "high", targetVisibility: "clear" });
  assert.equal(result.safetyLevel, "SAFE");
});

for (const flag of [
  { targetVisibility: "partial" },
  { backgroundClutter: "medium" },
  { deformation: true },
  { contamination: true },
  { multiObject: true },
  { occlusion: "mild" },
]) {
  test(`CAUTION for ${JSON.stringify(flag)}`, () => {
    const result = evaluateAnalysisSafety(flag);
    assert.equal(result.safetyLevel, "CAUTION");
    assert.equal(result.retakeRecommended, false);
    assert.deepEqual(result.reasons, ["check_visible_condition"]);
    assert.equal(result.uxState, "caution");
  });
}

test("poor takes priority over caution when both conditions are present", () => {
  // multiObject alone is a caution signal, but combined with targetDominance
  // "low" it escalates to poor (RETAKE), not caution.
  const result = evaluateAnalysisSafety({ multiObject: true, targetDominance: "low" });
  assert.equal(result.safetyLevel, "RETAKE");
});
