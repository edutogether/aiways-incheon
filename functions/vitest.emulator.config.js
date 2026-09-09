"use strict";
// D:\Projects\_shared\CONVENTIONS.md 5.1 - vitest 이전 B군(firebase
// emulators:exec 기반) 전체 21개. 각 파일은 여전히 emulators:exec가 매번
// 새로 띄우는 별도 에뮬레이터 프로세스 안에서 "한 파일씩 단독 실행"돼야
// 한다 - teacherAuthEmulatorIntegration.js와 superadminEmulatorIntegration.js는
// 같은 SCHOOL_ID/GRADE/CLASS_NUM/teacherCodes 문서ID를, cb5 두 파일은
// 같은 cb5_actor_* 액터 매트릭스를 쓰므로 한 vitest 프로세스에서 같이
// 돌리면 문서 경합이 난다. 그래서 vitest.config.js(A군, npm test)와는
// 별도 파일로 두고, package.json의 emulator:test:* 스크립트가 각자
// "vitest run --config vitest.emulator.config.js test/<그 파일>"처럼
// 파일 하나만 필터링해서 부른다 - include에는 대상 파일을 전부 등록해두되,
// 실제 실행은 CLI 인자로 좁힌다.
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    include: [
      "test/teacherAuthEmulatorIntegration.js",
      "test/teacherCodeLockoutEmulatorIntegration.js",
      "test/superadminEmulatorIntegration.js",
      "test/registrationApprovalEmulatorIntegration.js",
      "test/teacherModerationEmulatorIntegration.js",
      "test/cb5DeviceMatrixEmulatorIntegration.js",
      "test/cb5RecordResolveRecoveryEmulatorIntegration.js",
      "test/recordEmulatorSmoke.js",
      "test/analysisIdempotencyEmulatorSmoke.js",
      "test/appCheckEmulatorSmoke.js",
      "test/edu2gEmulatorSmoke.js",
      "test/protectedRecordsEmulatorIntegration.js",
      "test/mobileClassContextEmulatorIntegration.js",
      "test/schoolDashboardAggregateEmulatorIntegration.js",
      "test/studentProfileEmulatorIntegration.js",
      "test/studentAnonymizationEmulatorIntegration.js",
      "test/campusLocationEmulatorIntegration.js",
      "test/classChangeCooldownEmulatorIntegration.js",
      "test/protectedActorEmulatorIntegration.js",
      "test/firestoreRulesEmulatorSmoke.js",
      "test/classExportEmulatorIntegration.js",
      "test/dashboardSchoolClaimEmulatorIntegration.js",
      "test/dashboardRealtimeDiagnosticsEmulatorIntegration.js"
    ],
    environment: "node",
    globals: true,
    // 에뮬레이터 왕복(회원가입/Firestore 쓰기 여러 번)이 순수 유닛테스트보다
    // 느리다 - 캐시 없는 첫 실행 기준으로 여유 있게 잡는다. 이 값은 이
    // 클러스터의 나머지 4개(수 초 내 끝남)에 적용되고,
    // cb5RecordResolveRecoveryEmulatorIntegration.js만 훨씬 오래 걸려서
    // (실측: node로 직접 실행 시 에뮬레이터 기동 포함 1분 26초) 그 파일
    // 안에서 test()의 세 번째 인자로 개별 타임아웃을 따로 준다.
    testTimeout: 20000
  }
});
