"use strict";

// Stage 8-A deliberately exposes no PASS UI. This adapter only creates a
// browser-local anonymous device session and combines its token with App Check.
(() => {
  let authPromise = null;
  function emulatorRequested() { const query = new URLSearchParams(location.search); return (location.hostname === "localhost" || location.hostname === "127.0.0.1") && query.get("auth-emulator") === "1"; }
  function visualReviewRequested() { const query = new URLSearchParams(location.search); return (location.hostname === "localhost" || location.hostname === "127.0.0.1") && query.get("visual-review") === "1"; }
  async function getBetaAuth() {
    if (visualReviewRequested()) throw new Error("visual_review_auth_isolated");
    if (authPromise) return authPromise;
    authPromise = (async () => {
      const base = await window.AIWaysAppCheck?.initializeAIWaysAppCheck?.();
      if (!base?.app) throw new Error("firebase_app_unavailable");
      const { getAuth, setPersistence, browserLocalPersistence, signInAnonymously, connectAuthEmulator, signOut } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js");
      const auth = getAuth(base.app);
      if (emulatorRequested()) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      await setPersistence(auth, browserLocalPersistence);
      await auth.authStateReady();
      if (!auth.currentUser) await signInAnonymously(auth);
      return { auth, signOut };
    })();
    return authPromise;
  }
  async function getEdu2gDeviceSession({ forceRefresh = false } = {}) { const { auth } = await getBetaAuth(); const user = auth.currentUser; if (!user) throw new Error("anonymous_auth_unavailable"); return { uid: user.uid, idToken: await user.getIdToken(!!forceRefresh) }; }
  // 로컬 에뮬레이터 검증 시엔 실제 App Check 토큰을 못 딴다(localhost가
  // reCAPTCHA를 막음, HANDOFF.md에 이미 기록된 제약) - 서버쪽도
  // functions/index.js의 emulatorAppCheck가 같은 조건(FUNCTIONS_EMULATOR)
  // 으로 검증을 건너뛰므로, 클라이언트도 여기서만 App Check 헤더 없이
  // 요청을 보낸다. 프로덕션(emulatorRequested()===false)에서는 기존과
  // 동일하게 App Check 헤더가 없으면 요청 자체를 안 보낸다.
  async function getEdu2gProtectedHeaders({ forceRefresh = false } = {}) { const session = await getEdu2gDeviceSession({ forceRefresh }); const appCheck = await window.AIWaysAppCheck?.getAIWaysAppCheckHeaders?.(); if (!appCheck && !emulatorRequested()) return null; return { ...appCheck, Authorization: `Bearer ${session.idToken}` }; }
  async function clearEdu2gDeviceSession() { const { auth, signOut } = await getBetaAuth(); await signOut(auth); authPromise = null; }
  window.AIWaysBetaAuth = { getBetaAuth, getEdu2gDeviceSession, getEdu2gProtectedHeaders, clearEdu2gDeviceSession, emulatorRequested, visualReviewRequested };
})();
