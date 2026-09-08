// 리액트 전환 전에 mobile/ 현재 화면을 "정답"으로 고정해 두기 위한 설정.
// 전환 뒤 같은 스펙을 그대로 돌려서 스크린샷·computed style이 바뀌지
// 않았음을 증명하는 것이 목적이라, 여기서 흔들리는 값(애니메이션 진행
// 중 캡처, 폰트 로딩 타이밍 등)이 생기면 증명 자체가 무의미해진다.
// 루트 package.json에 "type": "module"을 두지 않는다 - 루트 .js 파일들은
// 브라우저가 <script>로 읽는 고전 스크립트이고, functions/test의 여러
// 테스트가 그걸 require()로 읽는다. type:module을 넣었더니 실제로
// classProfileExperienceWiring.test.js가 CI에서 깨졌다. 그래서 이 설정도
// CommonJS로 둔다(스펙 파일의 import 구문은 Playwright가 직접 변환한다).
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  // 기준선은 순서·병렬성에 따라 값이 달라지면 안 된다.
  workers: 1,
  fullyParallel: false,
  // 실패를 재시도로 덮으면 "가끔 다르게 나오는" 항목을 못 잡는다.
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8001",
    // 스크린샷 비교의 기준. 폰트 안티에일리어싱 차이로 전체가 실패하는
    // 것을 막되, 실제 레이아웃 변화는 반드시 잡히도록 좁게 잡는다.
    screenshot: "off"
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled" }
  },
  webServer: {
    command: "node functions/test/localStaticServer.js",
    url: "http://127.0.0.1:8001/mobile/index.html",
    reuseExistingServer: true,
    timeout: 30000
  }
});
