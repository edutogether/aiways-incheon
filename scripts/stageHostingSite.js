"use strict";
// Firebase Hosting은 "public" 디렉토리 안의 파일을 전부(ignore 패턴 제외)
// 공개하는 블랙리스트 모델이다 - 이 저장소는 과거 GitHub Pages legacy
// 브랜치 배포에서 이 실수(path:.로 저장소 전체가 공개됨, functions/lib
// 소스·인수인계 문서 등 유출)를 이미 한 번 겪었다(CLAUDE.md 참고). 그래서
// Firebase Hosting으로 옮기면서도 같은 실수를 반복하지 않도록, 실제
// 배포 대상만 화이트리스트로 골라 별도 스테이징 디렉토리(_hosting_site)에
// 모으고, firebase.json의 "public"은 그 스테이징 디렉토리만 가리키게
// 한다. .github/workflows/deploy-pages.yml의 기존 "Stage public files
// only" 단계와 정확히 같은 목록을 유지한다(둘이 갈라지지 않도록 이
// 스크립트 하나를 CI/로컬 양쪽에서 재사용).
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "_hosting_site");

function copyFile(name) {
  const src = path.join(ROOT, name);
  if (!fs.existsSync(src)) return;
  fs.copyFileSync(src, path.join(OUT_DIR, name));
}
function copyGlobExt(ext) {
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(ext)) copyFile(entry.name);
  }
}
function copyDir(name) {
  const src = path.join(ROOT, name);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, path.join(OUT_DIR, name), { recursive: true });
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// copyFile/copyDir은 없는 대상을 조용히 건너뛴다. 그래서 화면을 이루는
// 파일이 통째로 사라져도 배포는 성공하고 빈 사이트가 나간다. 반드시
// 있어야 하는 것들을 먼저 확인한다(COMMON_STANDARDS §21).
const REQUIRED = ["index.html", "admin.html", "style.css", "assets", "styles", "mobile", "schoolClassCounts.js"];
const missing = REQUIRED.filter((name) => !fs.existsSync(path.join(ROOT, name)));
if (missing.length) {
  console.error(`배포에 반드시 있어야 하는 것이 없습니다: ${missing.join(", ")}`);
  process.exit(1);
}

copyFile("index.html");
copyFile("admin.html");
copyGlobExt(".js");
copyGlobExt(".css");
copyFile("base-data-seed.tsv");
copyDir("assets");
copyDir("styles");
// mobile/은 빌드 산출물이다(2026-09-09 리액트 전환). 빌드를 잊고 배포하면
// 학생 화면이 통째로 사라지므로, 조용히 빈 폴더를 담아가지 않고 여기서
// 멈춘다. `npm run build:mobile`이 만든다.
const mobileEntry = path.join(ROOT, "mobile", "index.html");
if (!fs.existsSync(mobileEntry)) {
  console.error("mobile/index.html 이 없습니다 - 먼저 `npm run build:mobile`을 실행하세요.");
  process.exit(1);
}
copyDir("mobile");
copyDir("miniapp");

console.log(`Staged hosting site at ${OUT_DIR}`);
