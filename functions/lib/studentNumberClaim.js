"use strict";

// 학생 소속 자기신고 검증 구멍 좁히기(2026-09-07, 100점+실사용 단계) -
// registerStudentProfile은 schoolId만 NEIS로 검증되고 학년/반/번호/이름은
// 전부 자기신고다. 교사 승인(registrationApproval.js)은 "사람이 실명을
// 눈으로 봤다"는 신원증명일 뿐, "그 번호가 이미 다른 학생 차지인지"는
// 아무도 확인하지 않았다 - 서로 다른 두 기기가 각각 "5학년 1반 3번"으로
// 승인되거나(registrationApproval.js), 이미 승인된 학생이 반 이동으로
// 그 자리에 들어와도(changeStudentClass) 조용히 통과해 랭킹/집계가
// 뒤섞일 수 있었다. tx.create()가 "이미 있으면 실패"하는 원자성을 이용해
// 학교+학년+반 안에서 번호 하나당 actor 하나만 붙게 강제한다 - 완전히
// 새로운 인증 체계가 아니라 기존 승인/반이동 트랜잭션 안에 있는 구멍을
// 막는 것뿐이다.
function studentNumberClaimDocId(schoolId, grade, classNum, studentNumber) {
  return `${schoolId}_${grade}_${classNum}_${studentNumber}`;
}

function studentNumberClaimRef(db, schoolId, grade, classNum, studentNumber) {
  return db.collection("studentNumberClaims").doc(studentNumberClaimDocId(schoolId, grade, classNum, studentNumber));
}

module.exports = { studentNumberClaimDocId, studentNumberClaimRef };
