"use strict";
// 프리뷰 채널(대표님 확인용) 전용 스테이징 — 2026-09-11.
//
// 목적: 라이브와 **같은 조건**(https·실제 백엔드·실제 자료·Hosting 헤더)에서
// **전환본이 사이트 루트인** 모습을 보시게 한다. S5 이후의 실제 모습이 그것이다.
//
// **쓰는 법**
//   npm run build:pc && npm run build:mobile
//   node scripts/stageReviewChannel.js
//   firebase hosting:channel:deploy <채널이름> --expires 7d --project ai-ways-incheon
//
// 🔴 **언제 지우는가: S5로 라이브 `index.html`이 전환본이 되면 이 스크립트의 역할이
// 끝난다.** 그때는 `stageHostingSite.js` 하나가 곧 전환본을 담게 되므로, 이 파일과
// 그때까지 남아 있는 프리뷰 채널을 같이 정리한다. (`functions/lib/httpGuard.js`의
// 프리뷰 채널 CORS 정규식도 그때 같이 뺀다 - 거기에도 같은 메모를 적어 뒀다.)
//
// 🔴 라이브 배포 경로(`stageHostingSite.js`)는 한 글자도 건드리지 않는다.
// 이 스크립트는 그것을 그대로 돌린 뒤 `pc-next/`를 **덧씌우기만** 한다.
// 지우고 다시 만드는 것이 아니라 덧씌우는 이유: admin.html·miniapp·
// schoolClassCounts.js처럼 전환 대상이 아닌 것들이 그대로 남아야
// "S5 이후의 사이트 전체"가 되기 때문이다.
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "_hosting_site");
const NEXT = path.join(ROOT, "pc-next");

if (!fs.existsSync(path.join(NEXT, "index.html"))) {
  console.error("pc-next/index.html 이 없습니다 - 먼저 `npm run build:pc`를 실행하세요.");
  process.exit(1);
}

// 1) 라이브와 똑같은 화이트리스트 스테이징을 먼저 돌린다.
execFileSync(process.execPath, [path.join(ROOT, "scripts", "stageHostingSite.js")], { stdio: "inherit" });

// 2) 전환본을 루트에 덧씌운다.
let overlaid = 0;
for (const entry of fs.readdirSync(NEXT, { withFileTypes: true })) {
  const src = path.join(NEXT, entry.name), dst = path.join(OUT, entry.name);
  if (entry.isDirectory()) fs.cpSync(src, dst, { recursive: true });
  else fs.copyFileSync(src, dst);
  overlaid += 1;
}
// 덧씌운 게 0이면 조용히 "라이브 그대로"가 배포된다 - 그건 이 채널의 목적이 아니다(§21).
if (overlaid < 10) {
  console.error(`pc-next에서 덧씌운 것이 ${overlaid}개뿐입니다 - 전환본이 제대로 빌드됐는지 확인하세요.`);
  process.exit(1);
}

// 3) 🔴 배포 전에 **실제로 나갈 파일**을 검사한다. 로컬은 CRLF, CI는 LF라
//    같은 내용이라도 바이트가 다르고, CSP는 인라인 스크립트를 **바이트 해시**로
//    허용한다. 어긋나면 부트 스플래시가 조용히 차단된 채 배포된다.
const csp = require(path.join(ROOT, "firebase.json")).hosting.headers
  .flatMap((h) => h.headers || []).find((h) => h.key === "Content-Security-Policy");
if (!csp) { console.error("firebase.json에 CSP가 없습니다 - 검사할 기준이 없으므로 멈춥니다."); process.exit(1); }
const allowed = new Set([...csp.value.matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)].map((m) => m[1]));
if (!allowed.size) { console.error("CSP에 sha256 해시가 하나도 없습니다 - 기준이 비어 통과시킬 뻔했습니다."); process.exit(1); }

const html = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
if (inline.length !== 1) { console.error(`index.html의 인라인 스크립트가 ${inline.length}개입니다(1개여야 함).`); process.exit(1); }
const got = crypto.createHash("sha256").update(inline[0], "utf8").digest("base64");
if (!allowed.has(got)) {
  console.error(`index.html 인라인 스크립트 해시가 CSP와 안 맞습니다.\n  나온 값: ${got}\n  허용 값: ${[...allowed].join(", ")}\n  줄끝(CRLF)이 원인인 경우가 많습니다 - 그대로 배포하면 부트 스플래시가 조용히 차단됩니다.`);
  process.exit(1);
}

// 4) 전환본이 실제로 루트가 됐는지, 번들이 고전 스크립트 뒤인지.
const order = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
const bundleAt = order.findIndex((s) => s.includes("/bundle/"));
if (bundleAt < 0) { console.error("루트 index.html에 앱 번들이 없습니다 - 전환본이 덮이지 않았습니다."); process.exit(1); }
const lastLegacy = Math.max(...["app.js", "deviceTier.js", "responsiveNavigation.js"].map((n) => order.findIndex((s) => s.endsWith(n))));
if (lastLegacy < 0 || lastLegacy > bundleAt) { console.error("고전 스크립트가 번들보다 뒤에 옵니다 - 저장·로그인이 '가끔' 안 되는 형태로 깨집니다."); process.exit(1); }

for (const must of ["admin.html", "mobile/index.html", "miniapp/3second.html", "bundle", "style.css", "styles/cb3a.css"]) {
  if (!fs.existsSync(path.join(OUT, must))) { console.error(`배포물에 ${must}가 없습니다.`); process.exit(1); }
}

console.log(`\n✅ 리뷰 채널 스테이징 완료 — pc-next에서 ${overlaid}개 덧씌움`);
console.log(`   인라인 스크립트 해시 ${got} = CSP 허용값`);
console.log(`   번들 위치 ${bundleAt + 1}번째 / 고전 스크립트 마지막 ${lastLegacy + 1}번째 (번들이 뒤)`);
