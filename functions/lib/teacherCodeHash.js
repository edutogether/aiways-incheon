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

// 한 반이 받아들이는 추가 코드의 최대 개수.
//
// 왜 상한이 필요한가: 검증할 때마다 등록된 코드 수만큼 scrypt를 돌린다.
// scrypt는 일부러 느린 함수라(그게 존재 이유다) 개수가 늘면 검증 한 번의
// 비용이 그대로 늘어난다. 반별 실패 잠금(10분에 10회)이 이미 시도 횟수를
// 묶어두지만, 상한을 같이 두는 편이 안전하다.
const MAX_EXTRA_CODES = 3;

/**
 * 코드를 비교하기 전에 모양을 맞춘다 - **공백을 전부 없애고 대문자로**.
 *
 * 이게 없으면 "EDU2G SANGHYUN"을 "edu2g sanghyun"이나 "EDU2G  SANGHYUN"으로
 * 친 선생님이 실패한다. 그냥 한 번 더 치면 되는 문제로 보이지만 그렇지 않다 -
 * 이 앱은 **반 단위로 실패를 잠근다**(10분에 10회 실패하면 그 반의 코드
 * 검증이 15분 차단된다). 띄어쓰기 하나 때문에 몇 번 틀리면 그 반 선생님이
 * 수업 시간에 아예 못 들어가는 사고가 된다.
 */
function normalizeTeacherCode(code) {
  return typeof code === "string" ? code.replace(/\s+/g, "").toUpperCase() : "";
}

/** 저장할 형태로 만든다. 저장되는 것은 **정규화된 코드의 해시**다. */
function hashTeacherCode(code) {
  const codeSalt = randomBytes(16).toString("hex");
  const codeHash = scryptSync(normalizeTeacherCode(code), codeSalt, KEY_LENGTH).toString("hex");
  return { codeHash, codeSalt };
}

function matchesEntry(candidate, entry) {
  if (typeof entry?.codeHash !== "string" || typeof entry?.codeSalt !== "string") return false;
  const actual = scryptSync(candidate, entry.codeSalt, KEY_LENGTH);
  const expected = Buffer.from(entry.codeHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function extraEntries(stored) {
  return Array.isArray(stored?.extraCodes) ? stored.extraCodes.slice(0, MAX_EXTRA_CODES) : [];
}

/**
 * 이 반이 받아들이는 코드인가.
 *
 * 한 반이 **여러 코드**를 받는다(2026-09-09 Bumm님 결정). 규칙으로 만든 반
 * 코드(`SEOHEUNG103`)와, 그 반 선생님 개인 코드(`EDU2G SANGHYUN`)가 같이
 * 통한다. 대체가 아니라 공존인 이유: 대체로 만들면 개인 코드에 문제가 생겼을
 * 때 그 선생님이 들어갈 길이 하나도 없어진다.
 *
 * 정규화한 값으로 먼저 다 대조하고, 그래도 안 맞을 때만 **원문 그대로**를
 * 대표 코드 하나에 대해 한 번 더 본다. 정규화를 도입하기 전에 발급된 코드가
 * 소문자나 공백을 품고 있을 수 있어서다 - 그 경우까지 계속 통하게 두려는
 * 것이고, 대신 scrypt 호출 수가 무한정 늘지 않도록 이 한 번으로 제한한다.
 */
function verifyTeacherCode(code, stored) {
  const entries = [stored, ...extraEntries(stored)];
  const normalized = normalizeTeacherCode(code);
  if (normalized && entries.some((entry) => matchesEntry(normalized, entry))) return true;

  const raw = typeof code === "string" ? code.trim() : "";
  return !!raw && raw !== normalized && matchesEntry(raw, stored);
}

module.exports = { MAX_EXTRA_CODES, hashTeacherCode, normalizeTeacherCode, verifyTeacherCode };
