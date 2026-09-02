"use strict";

// 2026-09-01 종합감사(B그룹 6번): 교사코드는 학교당 코드 1개를 여러 교사가
// 공유하는 구조라(개인별 계정 아님), 그 코드 1개가 새면 사실상 학교 전체가
// 뚫린다. 이전엔 솔트 없는 단일 sha256이라 문서(teacherCodes/{schoolId})가
// 유출되면 레인보우테이블/사전공격으로 원문 코드를 사실상 즉시 역산할 수
// 있었다 - scrypt(느리고, 솔트가 코드마다 달라 사전테이블 재사용도 불가)로
// 교체한다. 코드 자체가 6자 이상의 사람이 고른 문자열이라 bcrypt/scrypt급
// 저속 해시가 필요한 전형적인 케이스(무작위 API 키였다면 sha256도 충분했을
// 것 - 그건 다른 파일들이 여전히 sha256을 쓰는 이유이기도 함).
const { randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");

const KEY_LENGTH = 64;

function hashTeacherCode(code) {
  const codeSalt = randomBytes(16).toString("hex");
  const codeHash = scryptSync(code, codeSalt, KEY_LENGTH).toString("hex");
  return { codeHash, codeSalt };
}

function verifyTeacherCode(code, stored) {
  if (typeof stored?.codeHash !== "string" || typeof stored?.codeSalt !== "string") return false;
  const candidate = scryptSync(code, stored.codeSalt, KEY_LENGTH);
  const expected = Buffer.from(stored.codeHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

module.exports = { hashTeacherCode, verifyTeacherCode };
