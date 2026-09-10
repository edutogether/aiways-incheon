"use strict";
// 2026-09-01: 배포 후 라이브 사이트를 실제로 두드려서 확인하는 스텝이 없어서,
// 그날 도메인 이전(GitHub Pages -> Firebase Hosting)이 "CORS 허용목록 미갱신으로
// 모든 API가 403"인 상태로 그대로 나갔는데도 CI는 초록불이었다. 이 스크립트는
// deploy-hosting 배포 직후 실행되어, 배포된 코드가 아니라 배포된 "결과"(실제
// 라이브 응답)를 확인한다 - 로컬 유닛테스트로는 못 잡는 층이다.
// 2026-09-09: 정식 주소는 incheon.edutogether.kr 하나다. 옛 Firebase 기본
// 주소는 Bumm님 지시로 CORS 허용목록에서 뺐으므로 검사 대상도 아니다 -
// 그 주소는 페이지만 뜨고 API는 거부되는 것이 의도한 상태다.
// 2026-09-10: 정식 주소가 막혔을 때 들어갈 대비용 주소(Bumm님 판단)라,
// **둘 다 실제로 통하는지** 배포마다 확인한다 - 대비용이 정작 필요할 때
// 안 되면 대비가 아니다.
const PROD_ORIGINS = ["https://incheon.edutogether.kr", "https://ai-ways-incheon.web.app"];
const FUNCTIONS_BASE = "https://asia-northeast3-ai-ways-incheon.cloudfunctions.net";

async function checkCorsNotBlocked(functionName, origin) {
  const res = await fetch(`${FUNCTIONS_BASE}/${functionName}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 403 && body.code === "invalid_origin") {
    throw new Error(`${functionName}: 프로덕션 오리진(${origin})이 CORS에서 거부됨 (invalid_origin) - 허용목록 확인 필요`);
  }
  const acao = res.headers.get("access-control-allow-origin");
  if (acao !== origin) {
    throw new Error(`${functionName}: Access-Control-Allow-Origin 헤더가 "${acao}"로, 기대값 "${origin}"과 다름`);
  }
  console.log(`OK  ${functionName} @ ${origin}: CORS 통과 (status ${res.status})`);
}

async function checkHostingHeaders(base) {
  const res = await fetch(`${base}/index.html`);
  if (res.status !== 200) throw new Error(`${base}/index.html이 200이 아님 (${res.status})`);
  const required = ["x-frame-options", "x-content-type-options", "content-security-policy"];
  for (const header of required) {
    if (!res.headers.get(header)) throw new Error(`${base}/index.html에 ${header} 헤더가 없음 - firebase.json hosting.headers 확인 필요`);
  }
  console.log(`OK  ${base}/index.html: 보안 헤더 정상 부착`);
}

// 🔴 HTML이 **쓰기 전에 서버에 물어보는지** 확인한다 (2026-09-11 추가).
//
// 규칙이 없어 Firebase 기본값(max-age=3600)이 나가고 있었다. 그러면 브라우저가
// 최대 한 시간 동안 서버에 묻지도 않고 옛 HTML을 쓰고, 옛 HTML은 옛 해시 번들을
// 가리킨다 - 배포 직후 들어온 사람이 "옛 HTML + 새 번들"이라는 시험된 적 없는
// 조합을 받는다. 되돌려도 **이미 캐시된 브라우저에는 안 닿는다.**
//
// 헤더는 조용히 되돌아가는 종류다(firebase.json 한 줄이면 사라지고, 화면에는
// 아무 표시도 안 난다). 그래서 라이브 응답으로 확인하는 이 층에 둔다.
//
// 🔴 학생 앱(mobile/)을 반드시 같이 본다 - 제일 중요한 화면인데 규칙에서 빠지면
// 그 화면만 옛 것을 계속 쓰게 된다.
const HTML_PATHS = ["/", "/index.html", "/mobile/index.html", "/admin.html", "/miniapp/3second.html"];

async function checkHtmlNotCached(base) {
  // 대상이 줄면 조용히 통과한다 - 고정 하한으로 못박는다(§21).
  const MIN_HTML_PATHS = 5;
  if (HTML_PATHS.length < MIN_HTML_PATHS) {
    throw new Error(`HTML 캐시 검사 대상이 ${HTML_PATHS.length}개뿐입니다(${MIN_HTML_PATHS}개 이상이어야 합니다).`);
  }
  for (const path of HTML_PATHS) {
    const res = await fetch(`${base}${path}`);
    if (res.status !== 200) throw new Error(`${base}${path}이 200이 아님 (${res.status})`);
    const cache = String(res.headers.get("cache-control") || "");
    // no-store가 아니라 no-cache여야 한다 - no-store면 매번 통째로 다시 받는다.
    if (!/no-cache/.test(cache)) {
      throw new Error(`${base}${path}의 Cache-Control이 "${cache}"입니다 - no-cache여야 합니다. 브라우저가 옛 HTML을 서버에 묻지도 않고 쓰게 되고, 되돌려도 캐시된 브라우저에는 안 닿습니다.`);
    }
  }
  console.log(`OK  ${base}: HTML ${HTML_PATHS.length}개 전부 no-cache`);
}

async function main() {
  const functionNames = ["checkStudentProfile", "listSortingRecords", "analyzeSortingSafetyObserver", "checkTeacherStatus"];
  const checks = [
    ...PROD_ORIGINS.flatMap(origin => functionNames.map(name => () => checkCorsNotBlocked(name, origin))),
    ...PROD_ORIGINS.map(base => () => checkHostingHeaders(base)),
    ...PROD_ORIGINS.map(base => () => checkHtmlNotCached(base)),
  ];
  // 검사 목록이 비면 실패가 0건이라 "전부 통과"로 끝나 버린다. 오리진이나
  // 함수 이름 목록을 잘못 비우면 **배포가 깨져도 초록불**이 된다 - 이 파일이
  // 라이브를 실제로 확인하는 유일한 층이라 특히 위험하다(COMMON_STANDARDS §21).
  //
  // 기대치를 **고정값으로 적는다.** 처음엔 PROD_ORIGINS/functionNames 길이로
  // 계산했는데, 목록을 비우면 기대치도 같이 0이 되어 그대로 통과했다 -
  // 문지기가 감시 대상에서 기준을 가져오면 감시가 되지 않는다.
  const MIN_FUNCTIONS = 4, MIN_ORIGINS = 1, MIN_CHECKS = 6;
  if (functionNames.length < MIN_FUNCTIONS || PROD_ORIGINS.length < MIN_ORIGINS || checks.length < MIN_CHECKS) {
    console.error(`스모크 검사 대상이 줄었습니다 - 함수 ${functionNames.length}/${MIN_FUNCTIONS}, 오리진 ${PROD_ORIGINS.length}/${MIN_ORIGINS}, 검사 ${checks.length}/${MIN_CHECKS}. 검사 없이 통과할 뻔했습니다.`);
    process.exit(1);
  }
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
