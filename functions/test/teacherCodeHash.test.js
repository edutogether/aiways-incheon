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

// 2026-09-09(Bumm님 결정): 한 반이 코드를 여러 개 받는다. 규칙으로 만든 반
// 코드(SEOHEUNG103)와 그 반 선생님 개인 코드(EDU2G SANGHYUN)가 **같이** 통해야
// 한다 - 대체가 아니라 공존이다. 대체로 만들면 개인 코드에 문제가 생겼을 때
// 그 선생님이 들어갈 길이 하나도 없어진다.
test("반 코드와 개인 코드가 둘 다 통한다(공존)", () => {
  const classCode = hashTeacherCode("SEOHEUNG103");
  const personal = hashTeacherCode("EDU2G SANGHYUN");
  const stored = { ...classCode, extraCodes: [{ label: "박상현", ...personal }] };
  assert.equal(verifyTeacherCode("SEOHEUNG103", stored), true, "반 코드가 막혔다");
  assert.equal(verifyTeacherCode("EDU2G SANGHYUN", stored), true, "개인 코드가 막혔다");
});

test("개인 코드를 붙여도 다른 코드는 여전히 거부한다", () => {
  const stored = { ...hashTeacherCode("SEOHEUNG103"), extraCodes: [{ label: "박상현", ...hashTeacherCode("EDU2G SANGHYUN") }] };
  assert.equal(verifyTeacherCode("EDU2G GAYEON", stored), false);
  assert.equal(verifyTeacherCode("SEOHEUNG104", stored), false);
});

// 띄어쓰기·대소문자 때문에 실패하면 그 반 전체가 15분 잠긴다(10분에 10회
// 실패 시 반 단위 잠금). 실수로 잠기는 일이 없어야 한다.
test("띄어쓰기와 대소문자를 무시한다", () => {
  const stored = { ...hashTeacherCode("EDU2G SANGHYUN") };
  for (const typed of ["EDU2G SANGHYUN", "edu2g sanghyun", "EDU2GSANGHYUN", "  EDU2G   SANGHYUN  ", "Edu2g Sanghyun"]) {
    assert.equal(verifyTeacherCode(typed, stored), true, `"${typed}"이 막혔다`);
  }
});

test("공백을 지워도 다른 코드가 되지는 않는다", () => {
  const stored = { ...hashTeacherCode("EDU2G SANGHYUN") };
  assert.equal(verifyTeacherCode("EDU2G SANGHYEON", stored), false);
});

test("extraCodes가 이상한 값이어도 반 코드는 그대로 동작한다", () => {
  const base = hashTeacherCode("SEOHEUNG103");
  for (const extraCodes of [null, "문자열", [{ label: "깨짐" }], [{ codeHash: 1, codeSalt: 2 }]]) {
    assert.equal(verifyTeacherCode("SEOHEUNG103", { ...base, extraCodes }), true, `extraCodes=${JSON.stringify(extraCodes)}`);
    assert.equal(verifyTeacherCode("아무거나-틀린코드", { ...base, extraCodes }), false);
  }
});

test("추가 코드는 상한을 넘겨 저장돼 있어도 상한까지만 본다", () => {
  // 저장이 어떻게 잘못되든 검증 비용(scrypt 호출 수)이 무한정 늘지 않아야 한다.
  const base = hashTeacherCode("SEOHEUNG103");
  const many = Array.from({ length: 10 }, (_, i) => ({ label: `t${i}`, ...hashTeacherCode(`EXTRA-CODE-${i}`) }));
  const stored = { ...base, extraCodes: many };
  assert.equal(verifyTeacherCode("EXTRA-CODE-0", stored), true, "상한 안쪽 코드가 막혔다");
  assert.equal(verifyTeacherCode("EXTRA-CODE-9", stored), false, "상한 밖 코드가 통과했다");
});
