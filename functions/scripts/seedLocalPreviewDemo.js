"use strict";
// 로컬 에뮬레이터 전용 - 프로덕션에는 아무 영향 없다(setTeacherCode.js/
// grantSuperadmin.js와 달리 이 스크립트는 항상 로컬 Firestore/Auth
// 에뮬레이터만 겨냥한다). 대표님/팀이 실제 화면으로 클릭해보고 싶을 때
// 쓰는 데모 데이터 시딩 스크립트다.
// 사용법: 1) firebase emulators:start --only auth,firestore,functions --project demo-aiways-incheon
//         2) (다른 터미널, functions/ 폴더에서) node scripts/seedLocalPreviewDemo.js
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const http = require("node:http");
const { createHash } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const app = initializeApp({ projectId: "demo-aiways-incheon" });
const auth = getAuth(app);
const db = getFirestore(app);

const SCHOOL_ID = "1234567";
const SCHOOL_NAME = "데모초등학교";
const TEACHER_CODE = "demo-preview-2026";
const STUDENT_ACTOR_ID = "demo_preview_student";
const APPROVED_ACTOR_ID = "demo_preview_student_approved";
const SUPERADMIN_EMAIL = "demo-superadmin@example.com";
const SUPERADMIN_PASSWORD = "demo-password-123456";

function signUp(email, password) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: 9099, path: "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end(JSON.stringify({ email, password, returnSecureToken: true }));
  });
}

(async () => {
  await db.collection("teacherCodes").doc(SCHOOL_ID).set({ codeHash: createHash("sha256").update(TEACHER_CODE).digest("hex"), updatedAt: FieldValue.serverTimestamp() });

  await db.collection("registrationRequests").doc(STUDENT_ACTOR_ID).set({
    schoolId: SCHOOL_ID, schoolName: SCHOOL_NAME, grade: "5", classNum: "1", studentNumber: "3", name: "김민준",
    status: "pending", submittedAt: FieldValue.serverTimestamp()
  });
  // 승인대기열 화면 확인 후 CSV 내보내기도 같이 확인할 수 있게, 이미 승인된
  // 두 번째 학생과 그 학생의 저장 기록도 하나 심어둔다.
  await db.collection("actors").doc(APPROVED_ACTOR_ID).set({
    status: "active", plan: "closed_beta",
    studentProfile: { schoolId: SCHOOL_ID, schoolName: SCHOOL_NAME, grade: "5", classNum: "1", studentNumber: "7", name: "이서연", registeredAt: FieldValue.serverTimestamp() }
  });
  await db.collection("actors").doc(APPROVED_ACTOR_ID).collection("records").add({
    schemaVersion: "sorting-record-v1", status: "completed", provider: "manual_select",
    userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true },
    classContext: { schoolId: SCHOOL_ID, grade: "5", classNum: "1", studentNumber: "7", studentName: "이서연" },
    createdAt: FieldValue.serverTimestamp()
  });

  const signed = await signUp(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
  await auth.setCustomUserClaims(signed.localId, { role: "superadmin" });

  console.log("데모 데이터 준비 완료:");
  console.log(`  학교코드(schoolId): ${SCHOOL_ID} (${SCHOOL_NAME})`);
  console.log(`  교사 인증코드: ${TEACHER_CODE}`);
  console.log(`  가입 승인대기: 5학년 1반 3번 김민준`);
  console.log(`  이미 승인된 학생(CSV 확인용): 5학년 1반 7번 이서연, 저장기록 1건`);
  console.log(`  슈퍼어드민 데모 계정: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`);
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
