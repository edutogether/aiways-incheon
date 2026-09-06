"use strict";
// D:\Projects\_shared\CONVENTIONS.md 5.1 - vitest 이전 2단계(B군, teacher-auth/
// superadmin/registration 클러스터). 각 파일은 여전히 firebase emulators:exec가
// 매번 새로 띄우는 별도 에뮬레이터 프로세스 안에서 "한 파일씩 단독 실행"돼야
// 한다 - teacherAuthEmulatorIntegration.js와 superadminEmulatorIntegration.js는
// 같은 SCHOOL_ID/GRADE/CLASS_NUM/teacherCodes 문서ID를 쓰므로, 한 vitest
// 프로세스에서 같이 돌리면 문서 경합이 난다. 그래서 vitest.config.js(A군,
// npm test)와는 별도 파일로 두고, package.json의 emulator:test:* 스크립트가
// 각자 "vitest run --config vitest.emulator.config.js test/<그 파일>"처럼
// 파일 하나만 필터링해서 부른다 - include에는 이 클러스터 3개를 전부
// 등록해두되, 실제 실행은 CLI 인자로 좁힌다.
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    include: [
      "test/teacherAuthEmulatorIntegration.js",
      "test/superadminEmulatorIntegration.js",
      "test/registrationApprovalEmulatorIntegration.js"
    ],
    environment: "node",
    globals: true,
    // 에뮬레이터 왕복(회원가입/Firestore 쓰기 여러 번)이 순수 유닛테스트보다
    // 느리다 - 캐시 없는 첫 실행 기준으로 여유 있게 잡는다.
    testTimeout: 20000
  }
});
