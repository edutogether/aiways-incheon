"use strict";
// 2026-09-07 종합감사: teacherCodeHash.js(교사코드 scrypt+솔트 해싱 -
// 학교당 코드 1개를 여러 교사가 공유하는 구조라 유출 시 파급력이 큰
// 보안 크리티컬 유틸)에 전용 유닛테스트가 없었다. teacherAuthEmulatorIntegration.js가
// hashTeacherCode를 시드 데이터 생성에 쓰긴 하지만, 그건 이 함수 자체의
// 정확성(같은 코드면 검증 통과, 다른 코드면 거부, 손상된 저장값을
// 안전하게 처리하는지)을 직접 검증하지 않는다.
const assert = require("node:assert/strict");
const { hashTeacherCode, verifyTeacherCode } = require("../lib/teacherCodeHash");

test("hashTeacherCode + verifyTeacherCode round-trip succeeds for the same code", () => {
  const { codeHash, codeSalt } = hashTeacherCode("demo-preview-2026");
  assert.equal(verifyTeacherCode("demo-preview-2026", { codeHash, codeSalt }), true);
});

test("verifyTeacherCode rejects a different code against the same stored hash", () => {
  const { codeHash, codeSalt } = hashTeacherCode("demo-preview-2026");
  assert.equal(verifyTeacherCode("wrong-code-000000", { codeHash, codeSalt }), false);
});

test("hashTeacherCode never reuses the same salt across calls (rainbow-table resistance)", () => {
  const a = hashTeacherCode("same-code-123456");
  const b = hashTeacherCode("same-code-123456");
  assert.notEqual(a.codeSalt, b.codeSalt);
  assert.notEqual(a.codeHash, b.codeHash);
  // But each independently still verifies against the same plaintext code.
  assert.equal(verifyTeacherCode("same-code-123456", a), true);
  assert.equal(verifyTeacherCode("same-code-123456", b), true);
});

test("verifyTeacherCode returns false (not throw) for malformed or missing stored data", () => {
  assert.equal(verifyTeacherCode("any-code", {}), false);
  assert.equal(verifyTeacherCode("any-code", { codeHash: 123, codeSalt: "abc" }), false);
  assert.equal(verifyTeacherCode("any-code", { codeHash: "abc", codeSalt: null }), false);
  assert.equal(verifyTeacherCode("any-code", null), false);
  assert.equal(verifyTeacherCode("any-code", undefined), false);
});

test("verifyTeacherCode safely rejects a stored hash of the wrong length instead of throwing", () => {
  // timingSafeEqual throws if buffer lengths differ -- verifyTeacherCode must
  // check length itself first rather than let a corrupted/truncated stored
  // hash crash the caller (which would surface as a 503 instead of a clean
  // invalid_code rejection).
  const { codeSalt } = hashTeacherCode("demo-preview-2026");
  assert.doesNotThrow(() => {
    assert.equal(verifyTeacherCode("demo-preview-2026", { codeHash: "ab", codeSalt }), false);
  });
});
