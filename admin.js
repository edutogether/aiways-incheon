"use strict";

// 3단 권한체계 4단계(2026-08-31) - 이 앱 최초의 진짜(이메일/비밀번호) 로그인
// 화면. 계정은 대표님이 Firebase 콘솔에서 직접 만들고
// functions/scripts/grantSuperadmin.js로 superadmin 클레임을 받아야 실제로
// 뭔가 할 수 있다 - 로그인 자체는 클레임 없는 계정도 성공하지만, 그 뒤
// manageTeacherCode 호출은 서버가 클레임을 확인해 403으로 거절한다(이
// 페이지는 그 실패를 그대로 보여줄 뿐, 자체적으로 권한을 판단하지 않는다).
(() => {
  const FIREBASE_CONFIG = { apiKey: "AIzaSyCvjSaf9j9IQYm61_sggbWDa_rVaCmc_5M", authDomain: "ai-ways-incheon.firebaseapp.com", projectId: "ai-ways-incheon", storageBucket: "ai-ways-incheon.firebasestorage.app", messagingSenderId: "367235994253", appId: "1:367235994253:web:9f4b82ca9d8e5a1ca0c8c4" };
  const FUNCTIONS_BASE = "https://asia-northeast3-ai-ways-incheon.cloudfunctions.net";
  const $ = (id) => document.getElementById(id);
  let authRef = null;

  async function getAuthRef() {
    if (authRef) return authRef;
    const [{ initializeApp }, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js")
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    authRef = { auth: authMod.getAuth(app), ...authMod };
    return authRef;
  }

  async function callSuperadminFunction(name, idToken, payload) {
    const appCheckHeaders = await window.AIWaysAppCheck?.getAIWaysAppCheckHeaders?.();
    if (!appCheckHeaders) return { ok: false, code: "app_check_unavailable" };
    let response;
    try {
      response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...appCheckHeaders }, body: JSON.stringify(payload)
      });
    } catch { return { ok: false, code: "network_error" }; }
    let body = null;
    try { body = await response.json(); } catch {}
    return { ok: response.ok && body?.ok !== false, code: body?.code || (response.ok ? "ok" : "invalid_response") };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = $("adminLoginBtn");
    const loginStatus = $("adminLoginStatus");
    const teacherCodeSection = $("teacherCodeSection");

    loginBtn?.addEventListener("click", async () => {
      const email = $("adminEmail")?.value.trim();
      const password = $("adminPassword")?.value || "";
      if (!email || !password) { loginStatus.textContent = "이메일/비밀번호를 입력해주세요."; return; }
      loginStatus.textContent = "로그인 중...";
      try {
        const { auth, signInWithEmailAndPassword } = await getAuthRef();
        await signInWithEmailAndPassword(auth, email, password);
        loginStatus.textContent = "로그인 완료.";
        teacherCodeSection.hidden = false;
      } catch {
        loginStatus.textContent = "로그인에 실패했어요. 이메일/비밀번호를 확인해주세요.";
      }
    });

    $("teacherCodeSubmitBtn")?.addEventListener("click", async () => {
      const status = $("teacherCodeStatus");
      const schoolId = $("teacherCodeSchoolId")?.value.trim();
      const code = $("teacherCodeValue")?.value.trim();
      if (!schoolId || !code) { status.textContent = "학교 코드와 새 인증코드를 입력해주세요."; return; }
      status.textContent = "처리 중...";
      const { auth } = await getAuthRef();
      const user = auth.currentUser;
      if (!user) { status.textContent = "먼저 로그인해주세요."; return; }
      const idToken = await user.getIdToken();
      const result = await callSuperadminFunction("manageTeacherCode", idToken, { schoolId, code });
      status.textContent = result.ok ? "발급/회전 완료했어요."
        : result.code === "superadmin_required" ? "이 계정은 관리자 권한이 없어요."
        : result.code === "invalid_request" ? "학교 코드 형식 또는 인증코드 길이(6자 이상)를 확인해주세요."
        : "처리하지 못했어요. 다시 시도해주세요.";
    });
  });
})();
