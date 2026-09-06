"use strict";
// D:\Projects\_shared\CONVENTIONS.md 5.1 - node --test에서 vitest로 이전.
// 1단계(A군): 에뮬레이터 없이 도는 순수 유닛테스트 40개(test/*.test.js)만
// 대상. B군(firebase emulators:exec 기반 통합/스모크 스크립트, *.test.js가
// 아닌 이름 - EmulatorIntegration.js/EmulatorSmoke.js/FinalSuite.js 등)과
// test:frontend:layout/visual/states(CDP 기반 브라우저 스크립트)는
// 이 include 패턴에 애초에 안 걸린다 - 다음 단계에서 별도로 다룬다.
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    environment: "node",
    // 이 저장소는 CommonJS(functions/package.json에 "type" 없음)라 테스트
    // 파일에서 require("vitest")를 쓸 수 없다(vitest 5가 CJS의 require()
    // 자체를 막음) - test/describe 등을 전역으로 주입받는 방식(globals:true)을
    // 쓴다. 각 테스트 파일은 원래 node:test에서 쓰던 것과 동일하게
    // require("node:assert/strict")만 그대로 쓰고, test 함수 자체는 더 이상
    // import/require하지 않는다.
    globals: true,
    // blockedActorsWiring.test.js 하나가 테스트 본문 안에서 lib/*.js
    // 15개를 그때그때 require해서 첫 실행(캐시 없는 CI 매번 그렇다)엔
    // esbuild 변환 비용이 테스트 실행시간에 그대로 잡혀 기본 5초 타임아웃에
    // 걸릴 수 있음을 로컬에서 실제로 재현했다(6.14s 중 85%가 import) -
    // 캐시가 워밍업된 이후엔 문제 없었지만 CI는 매번 npm ci로 새로 시작하므로
    // 넉넉하게 올려둔다.
    testTimeout: 15000
  }
});
