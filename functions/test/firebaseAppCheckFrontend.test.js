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
  // 그리고 그 이유가 실제로 화면에 붙어야 한다 - 휴대폰에서는 콘솔을 못 연다.
  assert.match(gate,/lastFailureSummary/);
});
