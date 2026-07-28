(() => {
  const config = { apiKey: "AIzaSyCvjSaf9j9IQYm61_sggbWDa_rVaCmc_5M", authDomain: "ai-ways-incheon.firebaseapp.com", projectId: "ai-ways-incheon", storageBucket: "ai-ways-incheon.firebasestorage.app", messagingSenderId: "367235994253", appId: "1:367235994253:web:9f4b82ca9d8e5a1ca0c8c4" };
  const siteKey = "6Len12ktAAAAAE6AbKWEIFMn5tb1-ZYiMVKmwui6";
  let appCheckPromise;
  function debugMode() { const host=location.hostname; return (host === "localhost" || host === "127.0.0.1") && new URLSearchParams(location.search).get("appcheck-debug") === "1"; }
  async function initializeAIWaysAppCheck() {
    if (appCheckPromise) return appCheckPromise;
    appCheckPromise = (async () => { if (debugMode()) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true; const [{ initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken }] = await Promise.all([import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"), import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js")]); const app=initializeApp(config); const appCheck=initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(siteKey),isTokenAutoRefreshEnabled:true}); return { appCheck, getToken }; })();
    return appCheckPromise;
  }
  async function getAIWaysAppCheckToken() { try { const value=await initializeAIWaysAppCheck(); const token=await value.getToken(value.appCheck,false); return token?.token || ""; } catch { return ""; } }
  async function getAIWaysAppCheckHeaders() { const token=await getAIWaysAppCheckToken(); return token ? { "X-Firebase-AppCheck": token } : null; }
  window.AIWaysAppCheck = { initializeAIWaysAppCheck, getAIWaysAppCheckToken, getAIWaysAppCheckHeaders, debugMode };
})();
