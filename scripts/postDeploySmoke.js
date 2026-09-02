"use strict";
// 2026-09-01: 배포 후 라이브 사이트를 실제로 두드려서 확인하는 스텝이 없어서,
// 그날 도메인 이전(GitHub Pages -> Firebase Hosting)이 "CORS 허용목록 미갱신으로
// 모든 API가 403"인 상태로 그대로 나갔는데도 CI는 초록불이었다. 이 스크립트는
// deploy-hosting 배포 직후 실행되어, 배포된 코드가 아니라 배포된 "결과"(실제
// 라이브 응답)를 확인한다 - 로컬 유닛테스트로는 못 잡는 층이다.
const PROD_ORIGIN = "https://ai-ways-incheon.web.app";
const FUNCTIONS_BASE = "https://asia-northeast3-ai-ways-incheon.cloudfunctions.net";
const HOSTING_BASE = "https://ai-ways-incheon.web.app";

async function checkCorsNotBlocked(functionName) {
  const res = await fetch(`${FUNCTIONS_BASE}/${functionName}`, {
    method: "POST",
    headers: { Origin: PROD_ORIGIN, "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 403 && body.code === "invalid_origin") {
    throw new Error(`${functionName}: 프로덕션 오리진(${PROD_ORIGIN})이 CORS에서 거부됨 (invalid_origin) - 허용목록 확인 필요`);
  }
  const acao = res.headers.get("access-control-allow-origin");
  if (acao !== PROD_ORIGIN) {
    throw new Error(`${functionName}: Access-Control-Allow-Origin 헤더가 "${acao}"로, 기대값 "${PROD_ORIGIN}"과 다름`);
  }
  console.log(`OK  ${functionName}: CORS 통과 (status ${res.status})`);
}

async function checkHostingHeaders() {
  const res = await fetch(`${HOSTING_BASE}/index.html`);
  if (res.status !== 200) throw new Error(`index.html이 200이 아님 (${res.status})`);
  const required = ["x-frame-options", "x-content-type-options", "content-security-policy"];
  for (const header of required) {
    if (!res.headers.get(header)) throw new Error(`index.html에 ${header} 헤더가 없음 - firebase.json hosting.headers 확인 필요`);
  }
  console.log("OK  index.html: 보안 헤더 정상 부착");
}

async function main() {
  const checks = [
    () => checkCorsNotBlocked("checkStudentProfile"),
    () => checkCorsNotBlocked("listSortingRecords"),
    () => checkCorsNotBlocked("analyzeSortingSafetyObserver"),
    () => checkCorsNotBlocked("checkTeacherStatus"),
    () => checkHostingHeaders(),
  ];
  const failures = [];
  for (const check of checks) {
    try {
      await check();
    } catch (error) {
      failures.push(error.message);
      console.error(`FAIL ${error.message}`);
    }
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length}개 스모크테스트 실패`);
    process.exit(1);
  }
  console.log("\n모든 배포 후 스모크테스트 통과");
}

main().catch((error) => {
  console.error("스모크테스트 실행 자체가 실패:", error);
  process.exit(1);
});
