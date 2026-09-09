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

  // 로그인 상태의 ID 토큰. 인증 SDK를 못 불러오거나 로그인 전이면 빈 문자열.
  // **여기서 "권한 있음/없음"을 판단하지 않는다** - 판단은 서버가 한다.
  async function currentIdToken() {
    try {
      const { auth } = await getAuthRef();
      return auth.currentUser ? await auth.currentUser.getIdToken() : "";
    } catch { return ""; }
  }

  async function callSuperadminFunction(name, idToken, payload) {
    if (emulatorRequested()) {
      let response;
      try {
        response = await fetch(`${EMULATOR_FUNCTIONS_BASE}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify(payload) });
      } catch { return { ok: false, code: "network_error" }; }
      let body = null;
      try { body = await response.json(); } catch {}
      return { ok: response.ok && body?.ok !== false, code: body?.code || (response.ok ? "ok" : "invalid_response"), body };
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
    return { ok: response.ok && body?.ok !== false, code: body?.code || (response.ok ? "ok" : "invalid_response"), body };
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
        onLogin();
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
    const addModeOn = () => $("teacherCodeAddMode")?.checked === true;
    // 한 요소와 그 라벨을 같이 보이거나 감춘다.
    function show(id, visible) {
      const el = $(id);
      const label = $(`${id}Label`);
      if (el) el.hidden = !visible;
      if (label) label.hidden = !visible;
    }

    function refreshDerivedCode() {
      const schoolId = $("teacherCodeSchoolId")?.value;
      const grade = $("teacherCodeGrade")?.value;
      const classNum = $("teacherCodeClassNum")?.value;
      const field = $("teacherCodeValue");
      const hint = $("teacherCodeHint");
      if (!field) return;
      const derived = deriveTeacherCode(schoolId, grade, classNum);
      // 2026-09-09(Bumm님 지적) - 추가 코드는 **아예 다른 칸**에 적는다.
      //
      // 예전에는 위쪽 코드 칸에 개인 코드(EDU2G SANGHYUN)를 적고 아래 칸에
      // 이름을 적는 구조였는데, 화면 배치상 체크박스 바로 아래 칸이 "추가할
      // 코드를 적는 칸"으로 읽힌다. 만든 사람만 아는 순서였다. 칸을 나누면
      // "추가 등록 중에는 코드 칸을 덮어쓰지 않는다"도 구조로 보장된다 -
      // 애초에 자동 채움이 건드리는 칸이 아니다.
      const addMode = addModeOn();
      show("teacherCodeExtra", addMode);
      show("teacherCodeLabel", addMode);
      // 추가 모드에서 위 칸은 "그 반의 규칙 코드가 무엇인지" 보여주는 용도로만.
      field.readOnly = addMode;
      const valueLabel = $("teacherCodeValueLabel");
      if (valueLabel) valueLabel.textContent = addMode ? "이 반의 규칙 코드 (참고용)" : "이 반의 인증코드";
      if (derived) field.value = derived;
      if (hint) {
        hint.textContent = addMode
          ? (derived
            ? `«${derived}»는 그대로 둡니다. 아래 칸에 적은 코드가 하나 더 붙습니다 - 둘 다 통합니다.`
            : "아래 칸에 적은 코드가 이 반에 하나 더 붙습니다 - 기존 코드도 그대로 통합니다.")
          : derived
            ? `이 반의 인증코드는 «${derived}»입니다. 그대로 발급하거나 직접 고쳐도 됩니다.`
            : String(schoolId || "").trim()
              ? "등록된 4개 학교(서흥·청라·동방·마전)가 아니면 코드를 자동으로 만들어 드리지 못합니다. 위 칸에 코드를 직접 적어주세요."
              : "";
      }
    }
    // 2026-09-09(Bumm님 지시) - 버튼 글자가 예전에는 개발 용어였고, 두 경우를
    // 빗금으로 붙여둔 탓에 지금 무엇을 하는 건지가 안 보였다. 그 반에 코드가
    // 있는지를 서버에 물어보고 버튼이 그때그때 맞는 말을 하게 한다.
    //
    // 서버에 묻는 이유: teacherCodes 문서는 firestore.rules 기본거부에 걸려
    // 클라이언트가 못 읽는다(해시와 솔트가 든 문서다 - 읽을 수 있으면 안 된다).
    // teacherCodeStatus는 **있는지 없는지와 개수만** 돌려준다.
    // "확인 못 했다"를 "코드가 없다"와 섞지 않는다(COMMON_STANDARDS §21).
    let codeExists = null; // true | false | null(모름)
    let loggedIn = false;
    let statusToken = 0;

    function refreshSubmitLabel() {
      const submit = $("teacherCodeSubmitBtn");
      const note = $("teacherCodeReplaceNote");
      if (!submit) return;
      const ready = !!($("teacherCodeSchoolId")?.value.trim() && $("teacherCodeGrade")?.value.trim() && $("teacherCodeClassNum")?.value.trim());
      // 학교·학년·반이 다 정해지기 전에는 누를 수 없다. 그 전에는 이 반에
      // 코드가 있는지도 물어볼 수 없어서 버튼이 "발급인지 교체인지" 정직하게
      // 말할 수 없는데, **눌리는 버튼이 애매한 말을 하고 있는 것**이 제일
      // 나쁘다. 자료를 못 읽어 이미 막아둔 경우는 그대로 막아둔다(§21).
      if (classDataReady()) submit.disabled = !ready;
      if (addModeOn()) {
        submit.textContent = "추가 코드 등록";
        if (note) note.textContent = "";
        return;
      }
      submit.textContent = !ready ? "코드 발급"
        : codeExists === true ? "코드 교체"
          : codeExists === false ? "코드 발급"
            : "코드 발급 또는 교체";
      if (!note) return;
      // 무슨 일이 일어나는지를 그 자리에서 말해주는 것이, 용어를 가르치는
      // 것보다 낫다(Bumm님).
      note.textContent = codeExists === true
        ? "이 반에는 이미 코드가 있습니다. 교체하면 새 코드로 바뀌고 이전 코드는 쓸 수 없습니다."
        // 🔴 못 물어봤을 때 "발급"이라고 단정하지 않는다. 단정하면 버튼은
        // 발급이라고 말하는데 실제로는 있던 코드가 교체된다(§21 - 모르는 것을
        // 아는 것처럼 말하지 않는다).
        : codeExists === null && ready && loggedIn
          ? "⚠️ 이 반에 코드가 있는지 확인하지 못했습니다 — 이미 있으면 교체됩니다."
          : "";
    }

    async function refreshCodeExistence() {
      const schoolId = $("teacherCodeSchoolId")?.value.trim();
      const grade = $("teacherCodeGrade")?.value.trim();
      const classNum = $("teacherCodeClassNum")?.value.trim();
      codeExists = null;
      refreshSubmitLabel();
      // 로그인 전에는 물어볼 수 없다(서버가 401로 거절한다). 인증 SDK를
      // 불러오지도 않는다 - 로그인 화면에서 바깥으로 나가는 요청을 만들지 않는다.
      if (!loggedIn || !schoolId || !grade || !classNum) return;
      const mine = ++statusToken;
      const { auth } = await getAuthRef();
      const user = auth.currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();
      const result = await callSuperadminFunction("teacherCodeStatus", idToken, { schoolId, grade, classNum });
      // 고르는 사이에 답이 늦게 오면 엉뚱한 반의 결과가 버튼에 붙는다.
      if (mine !== statusToken) return;
      codeExists = result.ok ? result.body?.exists === true : null;
      refreshSubmitLabel();
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
      renderGradeOptions();
    }

    // 2026-09-10(Bumm님 지시) - 학교는 **이름으로 찾는다.**
    //
    // 첫 칸이 "학교 코드(NEIS 표준학교코드, 숫자)"였는데 그 숫자를 아는
    // 사람은 없다. 학생 앱이 쓰는 것과 같은 방식(NEIS 학교기본정보 검색 →
    // 목록에서 고르기)으로 맞추고, 숫자 칸은 화면에서 없앴다. 고른 학교의
    // 코드는 hidden 칸에만 담긴다 - 사람이 볼 값이 아니다.
    //
    // 학생 앱의 searchSchool은 actor(익명 인증)를 요구해서 이 화면에서는
    // 못 쓴다(여기는 superadmin 이메일 계정이다). 서버에 문지기만 다른
    // adminSearchSchool을 뒀고, NEIS 호출은 같은 코드를 쓴다.
    const SEARCH_DEBOUNCE_MS = 300, MIN_QUERY = 2, MAX_RESULTS = 15;
    let searchTimer = null, searchToken = 0;

    function chooseSchool(schoolCode, schoolName) {
      const field = $("teacherCodeSchoolId");
      if (field) field.value = schoolCode || "";
      const chosenName = $("teacherCodeSchoolChosenName");
      if (chosenName) chosenName.textContent = schoolName || "";
      $("teacherCodeSchoolChosen").hidden = !schoolCode;
      show("teacherCodeSchoolQuery", !schoolCode);
      $("teacherCodeSchoolResults")?.replaceChildren();
      const status = $("teacherCodeSchoolStatus");
      if (status) status.textContent = "";
      renderGradeOptions();
      refreshDerivedCode();
      refreshCodeExistence();
    }

    function renderSearchResults(schools) {
      const list = $("teacherCodeSchoolResults");
      const status = $("teacherCodeSchoolStatus");
      if (!list) return;
      list.replaceChildren();
      // 🔴 결과가 없을 때 조용히 빈 목록만 두지 않는다 - "검색이 안 되는 것"과
      // "그런 학교가 없는 것"이 화면에서 똑같아 보이면 안 된다.
      if (!schools.length) {
        if (status) status.textContent = "그 이름으로 찾은 학교가 없어요. 학교 이름을 다시 확인해 주세요.";
        return;
      }
      if (status) status.textContent = "";
      for (const school of schools.slice(0, MAX_RESULTS)) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        // 같은 이름의 학교가 여러 지역에 있어서 주소까지 보여줘야 고를 수 있다.
        const name = document.createElement("strong");
        name.textContent = school.schoolName;
        const where = document.createElement("small");
        where.textContent = [school.region, school.address].filter(Boolean).join(" · ");
        button.append(name, where);
        button.addEventListener("click", () => chooseSchool(school.schoolCode, school.schoolName));
        item.append(button);
        list.append(item);
      }
    }

    $("teacherCodeSchoolQuery")?.addEventListener("input", (event) => {
      const trimmed = String(event.target.value || "").trim();
      if (searchTimer !== null) window.clearTimeout(searchTimer);
      $("teacherCodeSchoolResults")?.replaceChildren();
      const status = $("teacherCodeSchoolStatus");
      if (trimmed.length < MIN_QUERY) { if (status) status.textContent = ""; return; }
      searchTimer = window.setTimeout(async () => {
        if (status) status.textContent = "찾는 중...";
        const mine = ++searchToken;
        const result = await callSuperadminFunction("adminSearchSchool", await currentIdToken(), { query: trimmed });
        if (mine !== searchToken) return;
        if (!result.ok) {
          // 못 찾은 것과 못 물어본 것을 섞지 않는다.
          if (status) status.textContent = result.code === "superadmin_required" ? "이 계정은 관리자 권한이 없어요."
            : result.code === "auth_missing" || result.code === "auth_invalid" ? "먼저 로그인해주세요."
            : "학교를 찾지 못했어요. 잠시 뒤 다시 시도해주세요.";
          return;
        }
        renderSearchResults(Array.isArray(result.body?.schools) ? result.body.schools : []);
      }, SEARCH_DEBOUNCE_MS);
    });
    $("teacherCodeSchoolReset")?.addEventListener("click", () => {
      const query = $("teacherCodeSchoolQuery");
      if (query) query.value = "";
      chooseSchool("", "");
    });

    $("teacherCodeGrade")?.addEventListener("change", () => {
      renderClassOptions();
      refreshDerivedCode();
      refreshCodeExistence();
    });
    $("teacherCodeClassNum")?.addEventListener("change", () => {
      refreshDerivedCode();
      refreshCodeExistence();
    });
    // 체크를 껐다 켤 때도 안내 문구와 버튼 글자가 따라와야 한다.
    $("teacherCodeAddMode")?.addEventListener("change", () => {
      refreshDerivedCode();
      refreshCodeExistence();
    });
    // 로그인해야 그 반에 코드가 있는지 물어볼 수 있다(서버가 401로 막는다).
    // 로그인 직후 지금 고른 반의 상태를 한 번 확인해 버튼 글자를 맞춘다.
    function onLogin() {
      loggedIn = true;
      refreshCodeExistence();
    }
    // 첫 화면의 버튼 글자와 칸 보임 여부를 한 번 맞춰 둔다.
    refreshDerivedCode();
    refreshSubmitLabel();

    $("teacherCodeSubmitBtn")?.addEventListener("click", async () => {
      const status = $("teacherCodeStatus");
      const schoolId = $("teacherCodeSchoolId")?.value.trim();
      const grade = $("teacherCodeGrade")?.value.trim();
      const classNum = $("teacherCodeClassNum")?.value.trim();
      // 추가 모드면 기존 코드를 두고 하나 더 붙인다(공존). 서버가 대표
      // 코드가 없는 반에는 추가를 거부하므로, 규칙 코드를 먼저 발급한 뒤에
      // 개인 코드를 붙이는 순서가 된다.
      //
      // 🔴 추가할 코드는 위쪽 칸이 아니라 체크박스 아래 칸에서 온다 -
      // 그래야 자동 채움이 그 자리를 덮어쓸 길이 애초에 없다.
      const addMode = addModeOn();
      const code = (addMode ? $("teacherCodeExtra") : $("teacherCodeValue"))?.value.trim();
      // 버튼을 막아두긴 했지만, 자료 없이 발급이 나가는 길을 하나도 남기지 않는다.
      if (!classDataReady()) { status.textContent = "학급 수 자료를 읽지 못해 발급할 수 없어요."; return; }
      if (!schoolId || !grade || !classNum) { status.textContent = "학교, 학년, 반을 모두 고르세요."; return; }
      if (!code) { status.textContent = addMode ? "등록할 추가 코드를 입력해주세요." : "인증코드를 입력해주세요."; return; }
      status.textContent = "처리 중...";
      const { auth } = await getAuthRef();
      const user = auth.currentUser;
      if (!user) { status.textContent = "먼저 로그인해주세요."; return; }
      const idToken = await user.getIdToken();
      const replacing = codeExists === true;
      const label = $("teacherCodeLabel")?.value.trim() || "";
      const result = await callSuperadminFunction("manageTeacherCode", idToken, {
        schoolId, grade, classNum, code,
        mode: addMode ? "add" : "replace",
        ...(addMode && label ? { label } : {})
      });
      // 무엇을 했는지 그대로 말한다. 예전 문구는 둘 중 무엇이 일어났는지를
      // 알려주지 않았다.
      if (result.ok) refreshCodeExistence();
      status.textContent = result.ok
        ? (addMode ? "추가 코드로 등록했어요. 기존 코드도 그대로 통합니다." : replacing ? "교체했어요. 이전 코드는 이제 쓸 수 없습니다." : "발급했어요.")
        : result.code === "superadmin_required" ? "이 계정은 관리자 권한이 없어요."
        : result.code === "teacher_code_not_set" ? "이 반에는 아직 기본 코드가 없어요. 먼저 체크를 풀고 규칙 코드를 발급해주세요."
        : result.code === "too_many_codes" ? "추가 코드는 한 반에 3개까지만 등록할 수 있어요."
        : result.code === "invalid_request" ? "학교 코드 형식 또는 인증코드 길이(6자 이상)를 확인해주세요."
        : "처리하지 못했어요. 다시 시도해주세요.";
    });
  });
})();
