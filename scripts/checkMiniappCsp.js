"use strict";
// 🔴 CSP 인라인 해시가 **실제로 나갈 바이트**와 맞는지 배포 전에 확인한다 (2026-09-11).
//
// 왜 필요한가: CSP는 인라인 스크립트를 **바이트 sha256**으로 허용한다. 한 글자,
// 심지어 줄끝 하나만 달라져도 해시가 어긋나고 **브라우저가 조용히 막는다** -
// 콘솔에만 뜨고 서버 응답은 200이라 CI에서도, 스모크 테스트에서도 안 보인다.
//
// 실제로 `miniapp/3second.html`이 2026-09-01부터 열흘 동안 그렇게 죽어 있었고
// 아무도 몰랐다(전역 CSP를 <meta>에서 헤더로 옮긴 부작용). 검사가 없으면 같은 일이
// 또 조용히 일어난다.
//
// 같은 성질의 위험이 `index.html`(부트 스플래시)에도 있다 - 로컬은 CRLF, CI는 LF라
// 로컬에서 직접 배포하면 해시가 어긋난다. 그래서 둘 다 본다.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const firebase = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8"));

// 어떤 source 규칙이 그 경로를 덮는지 찾는다. Firebase는 뒤에 오는 규칙이
// 같은 키를 덮으므로 **마지막으로 매치되는 것**이 실제 값이다.
function cspFor(urlPath) {
  let value = null;
  for (const entry of firebase.hosting.headers) {
    const src = entry.source;
    const matches = src === "**"
      || (src.endsWith("/**") && urlPath.startsWith(src.slice(0, -3) + "/"))
      || src === urlPath;
    if (!matches) continue;
    const found = (entry.headers || []).find((h) => h.key === "Content-Security-Policy");
    if (found) value = found.value;
  }
  return value;
}

const TARGETS = [
  { file: "index.html", urlPath: "/index.html" },
  { file: "miniapp/3second.html", urlPath: "/miniapp/3second.html" },
];

let failed = 0;
for (const { file, urlPath } of TARGETS) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    console.error(`🔴 ${file} 이 없습니다 - 검사할 대상이 없으면 통과가 아니라 실패입니다.`);
    failed += 1;
    continue;
  }
  const csp = cspFor(urlPath);
  if (!csp) {
    console.error(`🔴 ${urlPath} 를 덮는 CSP가 firebase.json에 없습니다 - 기준이 없으면 통과시키지 않습니다.`);
    failed += 1;
    continue;
  }
  const allowed = new Set([...csp.matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)].map((m) => m[1]));
  if (!allowed.size) {
    console.error(`🔴 ${urlPath} 의 CSP에 sha256 해시가 하나도 없습니다 - 빈 기준으로 통과시킬 뻔했습니다.`);
    failed += 1;
    continue;
  }

  // 🔴 파일에 그대로 들어 있는 바이트로 잰다. 정규화하지 않는다 - 정규화하면
  // 이 검사가 막으려는 바로 그 차이(CRLF)를 스스로 지워 버린다.
  const html = fs.readFileSync(full, "utf8");
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).filter((s) => s.trim());
  if (inline.length !== 1) {
    console.error(`🔴 ${file} 의 인라인 스크립트가 ${inline.length}개입니다(1개여야 합니다). 늘었다면 CSP에 해시를 같이 넣어야 합니다.`);
    failed += 1;
    continue;
  }
  const got = crypto.createHash("sha256").update(inline[0], "utf8").digest("base64");
  if (!allowed.has(got)) {
    console.error(`🔴 ${file} 인라인 스크립트가 CSP 해시와 안 맞습니다 - 배포하면 브라우저가 조용히 막습니다.`);
    console.error(`     나온 값: sha256-${got}`);
    console.error(`     허용 값: ${[...allowed].map((h) => "sha256-" + h).join(", ")}`);
    if (html.includes("\r\n")) console.error(`     이 파일에 CRLF가 있습니다 - .gitattributes로 LF 고정이 됐는지 보세요.`);
    failed += 1;
    continue;
  }
  console.log(`✅ ${file} — sha256-${got} (CSP 허용값과 일치, CRLF ${html.includes("\r\n") ? "있음 🔴" : "없음"})`);
}

if (failed) {
  console.error(`\n${failed}건 불일치 - 배포를 멈춥니다.`);
  process.exit(1);
}
console.log("\nCSP 인라인 해시 검사 통과.");
