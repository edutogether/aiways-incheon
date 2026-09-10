"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","..","firebaseAppCheck.js"),"utf8"),app=fs.readFileSync(path.join(__dirname,"..","..","app.js"),"utf8");
const gate=fs.readFileSync(path.join(__dirname,"..","..","mobile-app","public","authGate.js"),"utf8");
const client=fs.readFileSync(path.join(__dirname,"..","..","edu2gBetaClient.js"),"utf8");
test("frontend App Check adapter uses enterprise, refresh and restricted debug mode",()=>{assert.match(source,/ReCaptchaEnterpriseProvider\(siteKey\)/);assert.match(source,/isTokenAutoRefreshEnabled:true/);assert.match(source,/host === "localhost" \|\| host === "127.0.0.1"/);assert.match(source,/appcheck-debug/);assert.match(source,/X-Firebase-AppCheck/);assert.doesNotMatch(source,/Math\.random|localStorage|sessionStorage|console\./);assert.match(app,/AIWaysEdu2gClient/);assert.match(app,/analyzeSortingImage/);assert.match(app,/getSortingVisionEndpoint/);});

// 🔴 App Check가 왜 실패했는지를 **버리지 않는다**(COMMON_STANDARDS §21).
//
// 2026-09-10에 실제로 당했다. 토큰을 못 만든 이유를 catch가 통째로 삼켜서,
// 사람이 "안 돼요"라고 알려와도 ①이 기기가 24시간 잠긴 것인지(SDK는 403을
// 한 번 받으면 그 브라우저에서 하루 동안 재시도조차 안 한다) ②도메인이
// reCAPTCHA 승인 목록에 없는 것인지 ③서버가 죽은 것인지 구분할 수 없었다.
// 원인 규명이 하루를 잡아먹었고, 그 사이 서버 장애로 오인할 뻔했다.
test("App Check 실패 이유를 버리지 않고 화면까지 전달한다",()=>{
  // 이유를 값으로 남긴다.
  assert.match(source,/lastFailure/);
  assert.match(source,/lastFailureSummary/);
  assert.match(source,/noteFailure/);
  // 헤더가 없을 때를 '연결 문제'와 섞지 않는다 - 이 경우 요청은 아예 나가지
  // 않아 서버 로그에도 안 남으므로, 화면이 말해주지 않으면 알 방법이 없다.
  assert.match(client,/code: "app_check_unavailable"/);
  assert.doesNotMatch(client,/!headers\["X-Firebase-AppCheck"\] && !usingEmulator\(\)\) return \{ ok: false, status: 0, code: "auth_invalid"/);
  // 그리고 사람이 볼 수 있는 곳까지 실제로 전달돼야 한다.
  assert.match(gate,/lastFailureSummary/);   // 콘솔 한 줄
  assert.match(gate,/lastFailureAdvice/);    // 화면 안내
  // 화면 안내는 원인 계열과 **할 수 있는 일**을 말한다. 내부 코드가 아니라.
  assert.match(source,/시크릿 창으로 열거나 잠시 후 다시 시도해 주세요/);
});

// 안내 규칙 자체를 실제로 실행해서 확인한다(소스에 그 글자가 있는지가 아니라).
//
// 쓰로틀은 사용자가 스스로 풀 수 있는 유일한 실패다 - 시크릿 창이나 시간이
// 지나면 풀린다. 그 길을 화면이 알려주지 않으면, 사용자는 할 수 있는 것이
// 하나도 없는 것처럼 느낀다. 2026-09-10에 실제로 그랬다.
test("App Check 실패 안내가 쓰로틀과 그 밖을 갈라서 말한다", () => {
  const sandbox = { window: {}, self: {}, location: { hostname: "example.com", search: "" }, URLSearchParams };
  const run = new Function("window", "self", "location", "URLSearchParams", source);
  run(sandbox.window, sandbox.self, sandbox.location, sandbox.URLSearchParams);
  const api = sandbox.window.AIWaysAppCheck;
  assert.equal(typeof api.lastFailureAdvice, "function");

  for (const code of ["appCheck/throttled", "appCheck/initial-throttle"]) {
    const advice = api.lastFailureAdvice(code);
    assert.match(advice, /시크릿 창/, `${code}는 스스로 푸는 길을 알려줘야 한다`);
  }
  // 그 밖의 실패는 시크릿 창으로 안 풀리므로 그렇게 말하면 안 된다.
  const other = api.lastFailureAdvice("appCheck/fetch-status-error");
  assert.doesNotMatch(other, /시크릿 창/);
  assert.match(other, /다시 시도/);
  // 🔴 어느 쪽이든 **내부 코드를 그대로 내보내지 않는다** - 학생이 쓰는 화면이다.
  for (const advice of [api.lastFailureAdvice("appCheck/throttled"), other]) {
    assert.doesNotMatch(advice, /appCheck\//);
  }
  // 실패가 없으면 아무 말도 하지 않는다.
  assert.equal(api.lastFailureAdvice(), "");
});
