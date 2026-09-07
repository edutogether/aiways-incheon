"use strict";
// D:\Projects\_shared\CONVENTIONS.md 5.2 - eslint 통일(없던 앱에 추가).
// poster-studio/functions/eslint.config.js와 같은 최소 설정 - 엄격한 스타일
// 강제보다는 실수(안 쓰는 변수, undefined 참조 등)를 잡는 데 초점.
// 기존 "check" 스크립트(node --check, 문법검사만)는 그대로 두고 이 lint는
// 별도로 추가된 것 - check를 대체하지 않는다.
module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        structuredClone: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-undef": "error"
    }
  },
  {
    // vitest.config.js/vitest.emulator.config.js의 globals:true로 test/describe
    // 등이 실행 시점에 전역으로 주입된다(이 저장소는 CommonJS라
    // require("vitest")를 못 씀) - eslint는 그걸 모르므로 이 파일들에 한해
    // 같은 이름을 전역으로 알려준다. B군에서 vitest로 옮긴 파일들
    // (*EmulatorIntegration.js/*EmulatorSmoke.js, *.test.js 명명규칙이
    // 아님)도 여기 추가 - 이제 B군 21개 전부 포함.
    files: [
      "test/**/*.test.js",
      "test/teacherAuthEmulatorIntegration.js",
      "test/teacherCodeLockoutEmulatorIntegration.js",
      "test/superadminEmulatorIntegration.js",
      "test/registrationApprovalEmulatorIntegration.js",
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
    languageOptions: {
      globals: {
        test: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly"
      }
    }
  }
];
