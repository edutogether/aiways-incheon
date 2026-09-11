// mobile/ 리액트 전환의 빌드 설정.
//
// 이 프로젝트가 저장소 루트가 아니라 하위 폴더에 있는 이유: 루트
// package.json에 "type": "module"을 넣으면 루트 .js 파일들(브라우저가
// <script>로 읽는 고전 스크립트)이 ESM으로 해석되면서 functions/test의
// require()가 깨진다 - 실제로 CI가 한 번 이것 때문에 죽었다. 자기
// package.json을 가진 하위 폴더로 두면 그 문제 자체가 생기지 않는다.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

// 산출물이 곧 배포되는 화면이다(2026-09-09 S5에서 교체). mobile/은 이제
// 손으로 쓰는 폴더가 아니라 **빌드 결과물**이라 git에 들어가지 않는다
// (.gitignore). 배포 스테이징(scripts/stageHostingSite.js)이 이 폴더를
// 통째로 담아가므로, 빌드하지 않고 배포하면 화면이 통째로 사라진다 -
// 그래서 스테이징 스크립트가 산출물 유무를 먼저 확인한다.
const OUT_DIR = resolve(REPO_ROOT, "mobile");

// 스타일시트를 Vite에 맡기지 않고 "있는 그대로" 내보내는 이유:
// tailwind.generated.css는 빌드 파이프라인 없이 만들어져 커밋된 24KB짜리
// 사전 생성 번들이다. 여기서 다시 만들거나 Vite에 통과시키면 purge 범위나
// 미니파이 방식 차이로 화면이 미세하게 달라질 수 있는데, 그 차이는
// "체감까지 동일"을 깨뜨리면서 눈으로 찾기는 어렵다.
//
// public/에 두면 Vite가 손대지 않고 산출물로 그대로 복사한다. 해시가
// 정말 같은지는 reactShell.spec.js가 매번 대조한다.
const VERBATIM_STYLESHEETS = ["tailwind.generated.css", "mobile.css"];

// 상위 폴더의 공유 스크립트는 PC 앱과 같이 쓰는 것이라 이번 전환에서
// 건드리지 않고, 지금처럼 전역(window.AIWays*)으로 읽는다.
// mobile/ 안의 데이터·판정 스크립트는 S3에서, 화면 로직은 S4에서 TS로 옮겨
// 이 목록에서 빠졌다.
const LEGACY_SCRIPTS = [
  "../firebaseAppCheck.js",
  "../firebaseBetaAuth.js",
  "../edu2gBetaClient.js",
  // 학교 검색을 브라우저 안에서 한다(PC와 같은 구현 한 벌).
  "../schoolListSearch.js",
  // 인증 게이트는 **일부러 옮기지 않았다.** App Check 실패 화면과 재시도가
  // 들어 있고 리액트 밖의 #authGate를 다시 그리는 구조라 화면 이식과 성격이
  // 다르다. 같이 건드리면 문제가 났을 때 전환 때문인지 게이트 때문인지
  // 구분이 안 된다 - 전환이 안정된 뒤 별건으로 한다(app.md 남은 항목).
  // public/에 있으므로 산출물에서는 같은 폴더에 놓인다.
  "./authGate.js"
];

function aiwaysLegacyAssets(): Plugin {
  return {
    name: "aiways-legacy-assets",
    transformIndexHtml: {
      // "post"인 이유: Vite가 번들 <script type="module">을 head에 꽂은 "뒤에"
      // 우리가 순서를 바로잡아야 하기 때문이다. 태그 목록을 돌려주는 방식은
      // 위치를 head 맨 앞이나 맨 끝 중에서만 고를 수 있는데, 맨 앞에 넣으면
      // <meta charset>이 뒤로 밀리고, 맨 끝에 넣으면 번들이 공유 스크립트보다
      // 먼저 실행된다(리액트가 window.AIWaysEdu2gClient보다 먼저 도는 뜻이다).
      // 원본 순서 - meta들 → 스타일시트 → 공유 스크립트 → 앱 스크립트 - 를
      // 그대로 재현한다.
      order: "post",
      handler(html: string) {
        const viteTags: string[] = [];
        const lift = (pattern: RegExp) => {
          html = html.replace(pattern, (match) => {
            viteTags.push(match.trim());
            return "";
          });
        };
        lift(/\s*<link rel="modulepreload"[^>]*>/g);
        lift(/\s*<script type="module"[^>]*><\/script>/g);

        const injected = [
          ...VERBATIM_STYLESHEETS.map((href) => `<link rel="stylesheet" href="./${href}" />`),
          ...LEGACY_SCRIPTS.map((src) => `<script defer src="${src}"></script>`),
          ...viteTags
        ].map((tag) => `    ${tag}`).join("\n");

        return html.replace("</head>", `${injected}\n</head>`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), aiwaysLegacyAssets()],
  // 산출물이 /mobile-next/ 에 있든 나중에 /mobile/ 로 가든 같은 HTML이
  // 동작하도록 상대 경로로 낸다.
  base: "./",
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    assetsDir: "bundle"
  }
});
