// PC 화면 리액트 전환의 빌드 설정 (S1).
//
// `mobile-app`과 같은 이유로 저장소 루트가 아니라 하위 폴더에 둔다: 루트
// package.json에 "type": "module"을 넣으면 루트 .js 파일들(브라우저가
// <script>로 읽는 고전 스크립트)이 ESM으로 해석되면서 functions/test의
// require()가 깨진다 — 실제로 CI가 한 번 이것 때문에 죽었다.
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

// 🔴 S5 전까지 산출물은 `pc-next/`로 나간다. 라이브(`index.html`)는 건드리지
// 않는다 — `mobile/` 전환 때 `mobile-next/`를 쓴 것과 같은 방식이다.
const OUT_DIR = resolve(REPO_ROOT, "pc-next");

// 손으로 쓴 스타일시트는 **바이트 그대로** 쓴다.
//
// 이번 전환의 비목표다(intent 참고). 같은 변경 안에서 CSS까지 다시 쓰면 화면에
// 차이가 났을 때 **전환 탓인지 CSS 탓인지 영원히 못 가린다.** Vite에 통과시키면
// 미니파이·순서 정규화로 바이트가 달라지므로, 빌드가 손대지 않고 복사만 한다.
//
// 🔴 S5에서 산출물이 저장소 루트로 갈 때는 이 복사를 끈다. 그때는 원본이 이미
// 그 자리에 있고, 복사하면 원본을 제 자신으로 덮어쓰게 된다.
const VERBATIM_STYLESHEETS = ["style.css", "styles/cb3a.css"];

// 아직 전환하지 않은 고전 스크립트. S3~S4에서 하나씩 TS로 옮기며 이 목록에서
// 뺀다. 순서는 원본 index.html과 **같아야 한다** — 서로 전역으로 의존한다.
const LEGACY_SCRIPTS = [
  // 🔴 맨 앞이어야 한다. app.js가 자동 실행을 건너뛸지 이 깃발로 판단하므로,
  // app.js보다 먼저 실행돼야 한다(public/pcReactBoot.js 주석 참고).
  "./pcReactBoot.js",
  "./deviceTier.js",
  "./firebaseAppCheck.js",
  "./firebaseBetaAuth.js",
  "./edu2gBetaClient.js",
  "./dashboardRealtime.js",
  "./responsiveNavigation.js",
  "./classProfileStore.js",
  "./classroomSkillRegistry.js",
  "./aiRuntimeLoader.js",
  "./classPicker.js",
  "./schoolListSearch.js",
  "./app.js"
];

// 위 목록 중 **저장소 루트에서 복사해 와야 하는 것들.** `pcReactBoot.js`는
// `pc-app/public/`에 있어 Vite가 알아서 산출물 루트로 옮기므로 뺀다.
// 🔴 S5에서 산출물이 저장소 루트로 갈 때는 이 복사도 끈다 — 그때는 원본이 이미
// 그 자리에 있고, 복사하면 원본을 제 자신으로 덮어쓰게 된다(스타일시트와 같다).
const LEGACY_FILES = LEGACY_SCRIPTS
  .filter((src) => src !== "./pcReactBoot.js")
  .map((src) => src.replace(/^\.\//, ""));

// 🔴 스크립트만으로는 부족하다. 화면이 **실행 중에** 받아오는 것들도 산출물에
// 있어야 한다. 없으면 404가 나는데, 그 실패가 **화면에 그대로 안 보인다**:
//   - `base-data-seed.tsv` — 대시보드 기본 자료. 없으면 app.js가 내장 기본값으로
//     떨어지는데, 그 값이 시드와 **우연히 같아서**(3학년 72+64+78 = 214) 숫자만
//     보면 정상으로 보인다. 2026-09-10에 실제로 그 상태를 "정상"으로 읽을 뻔했다.
//   - `assets/` — 부트 스플래시 로고와 파비콘.
const RUNTIME_FILES = ["base-data-seed.tsv"];
//   - `mobile/` — 🔴 폰 폭에서 `deviceTier.js`가 `./mobile/index.html`을 iframe에
//     띄운다. 산출물이 `pc-next/`에 있으므로 그 안에도 있어야 한다 - 없으면
//     **판정은 제대로 되는데(`data-tier="phone"`) iframe이 404로 비어** 학생이
//     빈 화면을 본다(2026-09-11 실측). 배포 산출물이 아니라 **미리보기용**이다.
const RUNTIME_DIRS = ["assets", "mobile"];

function aiwaysPcAssets(): Plugin {
  return {
    name: "aiways-pc-assets",
    // 스타일시트와 고전 스크립트를 손대지 않고 산출물로 옮긴다.
    //
    // 🔴 스크립트를 복사하지 않으면 **태그만 있고 파일이 없다.** 산출물은
    // `pc-next/`에 있고 태그는 `./app.js`라 `/pc-next/app.js`를 찾는데, 원본은
    // 저장소 루트에 있어 **10개가 전부 404**였다(2026-09-10 실측). 그 상태에서도
    // `pcShell.spec.js`의 순서 검사는 **통과한다** — 문서에 적힌 태그 순서만 보지
    // 파일이 실제로 실려 도는지는 안 보기 때문이다. 순서가 맞는 404 열 개도
    // 순서 검사에는 초록불이다(§21).
    closeBundle() {
      for (const rel of [...VERBATIM_STYLESHEETS, ...LEGACY_FILES, ...RUNTIME_FILES]) {
        const from = resolve(REPO_ROOT, rel);
        const to = resolve(OUT_DIR, rel);
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(from, to);
      }
      for (const rel of RUNTIME_DIRS) {
        const from = resolve(REPO_ROOT, rel);
        if (!existsSync(from)) {
          // 조용히 건너뛰지 않는다 - 빠지면 화면이 비는데 빌드는 성공한다(§21).
          throw new Error(`${rel}/ 이 없어 전환본에 담을 수 없습니다. \`npm run build:mobile\`을 먼저 돌리세요.`);
        }
        cpSync(from, resolve(OUT_DIR, rel), { recursive: true });
      }
    },
    transformIndexHtml: {
      // "post"인 이유는 mobile-app과 같다: Vite가 번들 <script type="module">을
      // head에 꽂은 **뒤에** 순서를 바로잡아야 한다. 번들이 공유 스크립트보다
      // 먼저 돌면 리액트가 window.AIWays*보다 먼저 실행돼 저장·로그인이
      // "가끔" 안 되는 형태로 깨진다 — 화면 스냅샷으로는 안 잡힌다.
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
    }
  };
}

export default defineConfig({
  plugins: [react(), aiwaysPcAssets()],
  // 산출물이 /pc-next/ 에 있든 나중에 루트로 가든 같은 HTML이 동작하도록
  // 상대 경로로 낸다.
  base: "./",
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    assetsDir: "bundle"
  }
});
