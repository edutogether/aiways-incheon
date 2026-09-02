"use strict";
// 개발자 전용 1회성 실행 스크립트 - 학교+학년+반별 담임 인증코드를 발급/회전한다.
// admin.html에서도 같은 일을 할 수 있지만(manageTeacherCode), 로컬에서 빠르게
// 심어야 할 때는 이 스크립트가 더 편하다.
// 사용법 (functions/ 폴더에서):
//   node scripts/setTeacherCode.js <schoolId> <grade> <classNum> <code>
// 예: node scripts/setTeacherCode.js 7321071 5 1 sunrise-teachers-2026
// 프로덕션에 쓰려면 firebase-tools 로그인 상태거나
// GOOGLE_APPLICATION_CREDENTIALS 환경변수가 배포용 서비스계정을 가리켜야 한다.
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { hashTeacherCode } = require("../lib/teacherCodeHash");
const { teacherCodeDocId } = require("../lib/teacherAuth");

const [schoolId, grade, classNum, code] = process.argv.slice(2);
const DIGITS = /^\d{1,2}$/;
if (!schoolId || !/^\d{1,12}$/.test(schoolId) || !grade || !DIGITS.test(grade) || !classNum || !DIGITS.test(classNum)) {
  process.stderr.write("사용법: node scripts/setTeacherCode.js <schoolId 숫자> <grade> <classNum> <code>\n");
  process.exitCode = 1;
} else if (!code || code.length < 6) {
  process.stderr.write("code는 6자 이상이어야 합니다 (추측하기 쉬운 코드는 브루트포스에 취약).\n");
  process.exitCode = 1;
} else {
  (async () => {
    const app = getApps()[0] || initializeApp({ projectId: process.env.GCLOUD_PROJECT || "ai-ways-incheon" });
    const db = getFirestore(app);
    const { codeHash, codeSalt } = hashTeacherCode(code);
    await db.collection("teacherCodes").doc(teacherCodeDocId(schoolId, grade, classNum)).set({ codeHash, codeSalt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    process.stdout.write(`schoolId ${schoolId} ${grade}학년 ${classNum}반의 교사코드를 설정했습니다.\n`);
  })().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
}
