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
    // 2026-09-09(Bumm님 지시) - 학년·반을 숫자로 직접 치던 것을 고르는 방식으로.
    //
    // 없는 반의 코드가 발급되면 **아무도 쓸 수 없는 코드**가 생기고, 현장에서
    // 왜 안 되는지 아무도 모른다(코드가 틀린 것도 서버가 고장난 것도 아니고
    // 그냥 그 반이 없다). 학급 수는 NEIS 학급정보에서 받아 파일로 굳혀 둔다
    // - schoolClassCounts.js, 만드는 것은 scripts/fetchSchoolClassCounts.js.
    const CLASS_DATA = window.AIWaysSchoolClassCounts;
    // 자료가 없는 학교도 계속 다뤄야 한다(4개교 말고 다른 학교의 코드를 발급할
    // 일이 생길 수 있다). 그때는 넓게 보여주되 **확인되지 않았다는 것을 화면에
    // 드러낸다** - 조용히 그럴듯한 목록을 보여주는 것이 제일 나쁘다.
    const UNKNOWN_MAX_GRADE = 6, UNKNOWN_MAX_CLASS = 15;

    function classDataReady() {
      return !!CLASS_DATA && Array.isArray(CLASS_DATA.schools) && CLASS_DATA.schools.length > 0;
    }
    function schoolEntry(schoolId) {
      return CLASS_DATA?.schools?.find((school) => school.schoolId === String(schoolId || "").trim());
    }
    function fillSelect(id, values, placeholder, selected) {
      const el = $(id);
      if (!el) return;
      el.replaceChildren();
      const first = document.createElement("option");
      first.value = "";
      first.textContent = placeholder;
      el.append(first);
      for (const value of values) {
        const option = document.createElement("option");
        option.value = String(value.value);
        option.textContent = value.label;
        el.append(option);
      }
      el.value = values.some((v) => String(v.value) === String(selected)) ? String(selected) : "";
    }

    function renderClassOptions() {
      const school = schoolEntry($("teacherCodeSchoolId")?.value);
      const grade = $("teacherCodeGrade")?.value || "";
      const source = $("teacherCodeClassSource");
      const keep = $("teacherCodeClassNum")?.value;
      if (!grade) {
        fillSelect("teacherCodeClassNum", [], "먼저 학년을 고르세요", "");
        return;
      }
      const known = school?.classesByGrade?.[grade];
      const total = typeof known === "number" && known > 0 ? known : UNKNOWN_MAX_CLASS;
      const options = Array.from({ length: total }, (_, i) => ({ value: i + 1, label: `${i + 1}반` }));
      fillSelect("teacherCodeClassNum", options, "반을 고르세요", keep);
      if (source) {
        source.textContent = typeof known === "number" && known > 0
          ? `학급 수 출처: ${CLASS_DATA.source} (${CLASS_DATA.schoolYear}학년도, ${String(CLASS_DATA.fetchedAt).slice(0, 10)} 받음). ${school.short} ${grade}학년은 ${known}개 반입니다.`
          : "⚠️ 이 학교·학년의 학급 수 자료가 없습니다. 1~15반을 전부 보여주니, 실제로 있는 반인지 확인하고 고르세요.";
      }
    }

    function renderGradeOptions() {
      const school = schoolEntry($("teacherCodeSchoolId")?.value);
      const keep = $("teacherCodeGrade")?.value;
      const grades = school
        ? Object.entries(school.classesByGrade).filter(([, count]) => count > 0).map(([grade]) => ({ value: grade, label: `${grade}학년` }))
        : Array.from({ length: UNKNOWN_MAX_GRADE }, (_, i) => ({ value: i + 1, label: `${i + 1}학년` }));
      fillSelect("teacherCodeGrade", grades, "학년을 고르세요", keep);
      renderClassOptions();
    }

    // 🔴 자료를 못 읽었을 때 조용히 빈 목록을 보여주지 않는다(COMMON_STANDARDS §21).
    // 빈 목록은 "이 학교엔 반이 없다"처럼 보이는데, 실제로는 파일이 안 실린 것이다.
    if (!classDataReady()) {
      const source = $("teacherCodeClassSource");
      if (source) source.textContent = "🔴 학급 수 자료(schoolClassCounts.js)를 읽지 못했습니다. 발급을 막습니다 — scripts/fetchSchoolClassCounts.js로 파일을 만든 뒤 다시 여세요.";
      const submit = $("teacherCodeSubmitBtn");
      if (submit) submit.disabled = true;
    } else {
      fillSelect(
        "teacherCodeSchoolPreset",
        CLASS_DATA.schools.map((school) => ({ value: school.schoolId, label: `${school.name} (${school.schoolId})` })),
        "학교를 고르세요 (목록에 없으면 아래에 코드를 직접 입력)",
        ""
      );
      $("teacherCodeSchoolPreset")?.addEventListener("change", (event) => {
        const field = $("teacherCodeSchoolId");
        if (field) field.value = event.target.value;
        renderGradeOptions();
        refreshDerivedCode();
      });
      renderGradeOptions();
    }

    $("teacherCodeSchoolId")?.addEventListener("input", () => {
      renderGradeOptions();
      refreshDerivedCode();
    });
    $("teacherCodeGrade")?.addEventListener("change", () => {
      renderClassOptions();
      refreshDerivedCode();
    });
    $("teacherCodeClassNum")?.addEventListener("change", refreshDerivedCode);
    // 체크를 껐다 켤 때도 안내 문구가 따라와야 한다.
    $("teacherCodeAddMode")?.addEventListener("change", refreshDerivedCode);
    $("teacherCodeSubmitBtn")?.addEventListener("click", async () => {
      const status = $("teacherCodeStatus");
      const schoolId = $("teacherCodeSchoolId")?.value.trim();
      const grade = $("teacherCodeGrade")?.value.trim();
      const classNum = $("teacherCodeClassNum")?.value.trim();
      const code = $("teacherCodeValue")?.value.trim();
      // 버튼을 막아두긴 했지만, 자료 없이 발급이 나가는 길을 하나도 남기지 않는다.
      if (!classDataReady()) { status.textContent = "학급 수 자료를 읽지 못해 발급할 수 없어요."; return; }
      if (!schoolId || !grade || !classNum || !code) { status.textContent = "학교, 학년, 반, 새 인증코드를 모두 고르거나 입력해주세요."; return; }
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
