"use strict";
// 개발자 전용 1회성 실행 스크립트 - 학교별 교사 공유코드를 발급/회전한다.
// 아직 관리자 화면이 없어서(슈퍼어드민 단계에서 만들 예정) 지금은 이 방법뿐이다.
// 사용법 (functions/ 폴더에서):
//   node scripts/setTeacherCode.js <schoolId> <code>
// 예: node scripts/setTeacherCode.js 7321071 sunrise-teachers-2026
// 프로덕션에 쓰려면 firebase-tools 로그인 상태거나
// GOOGLE_APPLICATION_CREDENTIALS 환경변수가 배포용 서비스계정을 가리켜야 한다.
const { createHash } = require("node:crypto");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const [schoolId, code] = process.argv.slice(2);
if (!schoolId || !/^\d{1,12}$/.test(schoolId)) {
  process.stderr.write("사용법: node scripts/setTeacherCode.js <schoolId 숫자> <code>\n");
  process.exitCode = 1;
} else if (!code || code.length < 6) {
  process.stderr.write("code는 6자 이상이어야 합니다 (추측하기 쉬운 코드는 브루트포스에 취약).\n");
  process.exitCode = 1;
} else {
  (async () => {
    const app = getApps()[0] || initializeApp({ projectId: process.env.GCLOUD_PROJECT || "ai-ways-incheon" });
    const db = getFirestore(app);
    const codeHash = createHash("sha256").update(code).digest("hex");
    await db.collection("teacherCodes").doc(schoolId).set({ codeHash, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    process.stdout.write(`schoolId ${schoolId}의 교사코드를 설정했습니다.\n`);
  })().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
}
