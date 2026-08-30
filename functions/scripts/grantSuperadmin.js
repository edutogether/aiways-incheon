"use strict";
// 개발자 전용 1회성 실행 스크립트 - 실제 Firebase Auth 계정(이메일/비밀번호)을
// 가진 사용자에게 role:"superadmin" 커스텀 클레임을 부여한다. 계정 자체는
// Firebase 콘솔 > Authentication > 사용자 추가에서 대표님이 직접 만들어야
// 한다(비밀번호를 남이 대신 만들어주지 않는다) - 그 계정의 uid를 이 스크립트에
// 넘기면 된다.
// 사용법 (functions/ 폴더에서):
//   node scripts/grantSuperadmin.js <firebase-auth-uid>
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const [uid] = process.argv.slice(2);
if (!uid) {
  process.stderr.write("사용법: node scripts/grantSuperadmin.js <firebase-auth-uid>\n");
  process.exitCode = 1;
} else {
  (async () => {
    const app = getApps()[0] || initializeApp({ projectId: process.env.GCLOUD_PROJECT || "ai-ways-incheon" });
    const auth = getAuth(app);
    await auth.setCustomUserClaims(uid, { role: "superadmin" });
    process.stdout.write(`uid ${uid}에 superadmin 권한을 부여했습니다. 기존 로그인 세션이 있다면 재로그인해야 반영됩니다.\n`);
  })().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
}
