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
  const EMULATOR_FUNCTIONS_BASE = "http://127.0.0.1:5001/demo-aiways-incheon/asia-northeast3";
  const $ = (id) => document.getElementById(id);
  let authRef = null;

  // firebaseBetaAuth.js와 같은 로컬 전용 게이트 - 로컬 검증 시에만 인증
  // 에뮬레이터로 붙는다(프로덕션 계정 없이도 화면을 확인할 수 있게).
  function emulatorRequested() {
    return (location.hostname === "localhost" || location.hostname === "127.0.0.1") && new URLSearchParams(location.search).get("auth-emulator") === "1";
  }

  async function getAuthRef() {
    if (authRef) return authRef;
    const [{ initializeApp }, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js")
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = authMod.getAuth(app);
    if (emulatorRequested()) authMod.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    authRef = { auth, ...authMod };
    return authRef;
  }

  async function callSuperadminFunction(name, idToken, payload) {
    if (emulatorRequested()) {
      let response;
      try {
        response = await fetch(`${EMULATOR_FUNCTIONS_BASE}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify(payload) });
      } catch { return { ok: false, code: "network_error" }; }
      let body = null;
      try { body = await response.json(); } catch {}
      return { ok: response.ok && body?.ok !== false, code: body?.code || (response.ok ? "ok" : "invalid_response") };
    }
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

    // 2026-09-09(Bumm님 지시) - 예전에는 임의 코드를 직접 입력해서 발급했는데,
    // 서버엔 scrypt 해시로만 저장돼 대표님이 종이에 적어두지 않으면 다시 볼 수
    // 없었다. 그 번거로움을 없애려고 코드를 "학교+학년+반"에서 규칙으로
    // 파생시킨다 - 적어둘 필요 없이 언제든 다시 만들 수 있다.
    //
    // 학교 영문 표기는 국어의 로마자 표기법 기준이다. 청라만 주의가 필요한데,
    // 표기법은 글자가 아니라 "발음"을 옮기므로 [청나]로 소리나는 청라는
    // CHEONGRA가 아니라 CHEONGNA다(인천시 공식 표기도 Cheongna International
    // City이고, 학교 홈페이지 도메인도 cheongna.icees.kr이다).
    const SCHOOL_CODE_PREFIX = {
      "7321030": "SEOHEUNG",  // 인천서흥초
      "7361073": "CHEONGNA",  // 인천청라초
      "7341025": "DONGBANG",  // 인천동방초
      "7361064": "MAJEON"     // 인천마전초
    };
    function deriveTeacherCode(schoolId, grade, classNum) {
      const prefix = SCHOOL_CODE_PREFIX[String(schoolId || "").trim()];
      const g = String(grade || "").trim();
      const c = String(classNum || "").trim();
      if (!prefix || !g || !c) return "";
      // 반은 두 자리로 맞춘다 - 사람이 읽을 때 "502"(5학년 2반)가 자연스럽다는
      // 판단(Bumm님). 학년이 학교마다 고정이라 앞자리가 늘 같지만, 짧게 줄이면
      // 오히려 낯설다는 이유로 그대로 둔다.
      return `${prefix}${g}${c.padStart(2, "0")}`;
    }
    function refreshDerivedCode() {
      const schoolId = $("teacherCodeSchoolId")?.value;
      const grade = $("teacherCodeGrade")?.value;
      const classNum = $("teacherCodeClassNum")?.value;
      const field = $("teacherCodeValue");
      const hint = $("teacherCodeHint");
      if (!field) return;
      const derived = deriveTeacherCode(schoolId, grade, classNum);
      // 추가 등록 중에는 코드 칸을 건드리지 않는다.
      //
      // 개인 코드(EDU2G SANGHYUN)를 적어 놓고 학년·반을 다시 만지면, 자동
      // 채움이 그 자리를 규칙 코드로 덮어쓴다. 손으로 발급하는 화면이라
      // 그 순간을 못 보고 그대로 눌러버리면 **엉뚱한 코드가 추가 등록된다.**
      const addMode = $("teacherCodeAddMode")?.checked === true;
      if (addMode) {
        if (hint) hint.textContent = derived
          ? `추가 등록 중입니다 - 코드 칸은 그대로 둡니다. 이 반의 규칙 코드는 «${derived}»입니다.`
          : "추가 등록 중입니다 - 코드 칸은 그대로 둡니다.";
        return;
      }
      if (derived) {
        field.value = derived;
        if (hint) hint.textContent = `이 반의 인증코드는 «${derived}»입니다. 그대로 발급하거나 직접 고쳐도 됩니다.`;
      } else if (hint) {
        hint.textContent = String(schoolId || "").trim()
          ? "등록된 4개 학교(서흥·청라·동방·마전)가 아니면 코드를 자동으로 만들지 않습니다. 직접 입력해 주세요."
          : "";
      }
    }
    ["teacherCodeSchoolId", "teacherCodeGrade", "teacherCodeClassNum"].forEach((id) => {
      $(id)?.addEventListener("input", refreshDerivedCode);
    });
    // 체크를 껐다 켤 때도 안내 문구가 따라와야 한다.
    $("teacherCodeAddMode")?.addEventListener("change", refreshDerivedCode);
    $("teacherCodeSubmitBtn")?.addEventListener("click", async () => {
      const status = $("teacherCodeStatus");
      const schoolId = $("teacherCodeSchoolId")?.value.trim();
      const grade = $("teacherCodeGrade")?.value.trim();
      const classNum = $("teacherCodeClassNum")?.value.trim();
      const code = $("teacherCodeValue")?.value.trim();
      if (!schoolId || !grade || !classNum || !code) { status.textContent = "학교 코드, 학년/반, 새 인증코드를 모두 입력해주세요."; return; }
      status.textContent = "처리 중...";
      const { auth } = await getAuthRef();
      const user = auth.currentUser;
      if (!user) { status.textContent = "먼저 로그인해주세요."; return; }
      const idToken = await user.getIdToken();
      // 추가 모드면 기존 코드를 두고 하나 더 붙인다(공존). 서버가 대표
      // 코드가 없는 반에는 추가를 거부하므로, 규칙 코드를 먼저 발급한 뒤에
      // 개인 코드를 붙이는 순서가 된다.
      const addMode = $("teacherCodeAddMode")?.checked === true;
      const label = $("teacherCodeLabel")?.value.trim() || "";
      const result = await callSuperadminFunction("manageTeacherCode", idToken, {
        schoolId, grade, classNum, code,
        mode: addMode ? "add" : "replace",
        ...(addMode && label ? { label } : {})
      });
      status.textContent = result.ok ? (addMode ? "추가 코드로 등록했어요. 기존 코드도 그대로 통합니다." : "발급/회전 완료했어요.")
        : result.code === "superadmin_required" ? "이 계정은 관리자 권한이 없어요."
        : result.code === "teacher_code_not_set" ? "이 반에는 아직 기본 코드가 없어요. 먼저 체크를 풀고 규칙 코드를 발급해주세요."
        : result.code === "too_many_codes" ? "추가 코드는 한 반에 3개까지만 등록할 수 있어요."
        : result.code === "invalid_request" ? "학교 코드 형식 또는 인증코드 길이(6자 이상)를 확인해주세요."
        : "처리하지 못했어요. 다시 시도해주세요.";
    });
  });
})();
