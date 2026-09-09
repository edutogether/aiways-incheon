(() => {
  const config = { apiKey: "AIzaSyCvjSaf9j9IQYm61_sggbWDa_rVaCmc_5M", authDomain: "ai-ways-incheon.firebaseapp.com", projectId: "ai-ways-incheon", storageBucket: "ai-ways-incheon.firebasestorage.app", messagingSenderId: "367235994253", appId: "1:367235994253:web:9f4b82ca9d8e5a1ca0c8c4" };
  const siteKey = "6Len12ktAAAAAE6AbKWEIFMn5tb1-ZYiMVKmwui6";
  let appCheckPromise;
  // 🔴 2026-09-10: 마지막 실패 이유를 **버리지 않고 남긴다.**
  //
  // 예전에는 `catch { return ""; }` 하나로 끝나서, 토큰을 못 만든 이유가
  // 통째로 사라졌다. 그러면 화면에는 "연결을 다시 확인해 주세요"만 뜨고,
  // 실제 원인이 ①이 기기가 24시간 잠긴 것인지 ②도메인이 reCAPTCHA 승인
  // 목록에 없는 것인지 ③점수가 낮은 것인지 **아무도 구분할 수 없다.**
  // 실제로 그것 때문에 원인 규명이 하루를 잡아먹었다.
  //
  // 특히 SDK는 403을 한 번 받으면 그 브라우저에서 **24시간 동안 재시도조차
  // 하지 않는다**(appCheck/initial-throttle). 서버가 멀쩡해도 그 기기만
  // 하루 종일 죽은 것처럼 보이는데, 이유가 안 보이면 서버 장애로 오인한다.
  //
  // 콘솔에 찍지 않고 값으로만 남긴다 - 휴대폰에서는 아무도 콘솔을 못 열고,
  // 이 파일은 콘솔 출력을 금지하는 검사(firebaseAppCheckFrontend.test.js)가
  // 걸려 있다. 대신 authGate가 이 값을 **화면에** 보여준다.
  let lastFailure = null;
  function noteFailure(error) {
    // 코드와 메시지만 남긴다 - 토큰이나 키 같은 값은 담지 않는다.
    lastFailure = { code: error?.code || "unknown", message: String(error?.message || error || "").slice(0, 200), at: new Date().toISOString() };
    return lastFailure;
  }
  function debugMode() { const host=location.hostname; return (host === "localhost" || host === "127.0.0.1") && new URLSearchParams(location.search).get("appcheck-debug") === "1"; }
  async function initializeAIWaysAppCheck() {
    if (appCheckPromise) return appCheckPromise;
    appCheckPromise = (async () => { if (debugMode()) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true; const [{ initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken }] = await Promise.all([import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"), import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js")]); const app=initializeApp(config); const appCheck=initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(siteKey),isTokenAutoRefreshEnabled:true}); return { app, appCheck, getToken }; })();
    return appCheckPromise;
  }
  async function getAIWaysAppCheckToken() {
    try {
      const value = await initializeAIWaysAppCheck();
      const token = await value.getToken(value.appCheck, false);
      if (token?.token) { lastFailure = null; return token.token; }
      noteFailure({ code: "empty_token", message: "SDK가 토큰 없이 응답했습니다." });
      return "";
    } catch (error) { noteFailure(error); return ""; }
  }
  async function getAIWaysAppCheckHeaders() { const token=await getAIWaysAppCheckToken(); return token ? { "X-Firebase-AppCheck": token } : null; }
  // 사람이 기기에서 읽을 수 있는 한 줄. 화면에 그대로 붙인다.
  function lastFailureSummary() { return lastFailure ? `${lastFailure.code}` : ""; }
  window.AIWaysAppCheck = { initializeAIWaysAppCheck, getAIWaysAppCheckToken, getAIWaysAppCheckHeaders, debugMode, lastFailureSummary, get lastFailure() { return lastFailure; } };
})();
