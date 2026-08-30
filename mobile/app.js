"use strict";
(() => {
  const DATA = window.AIWaysMobileData;
  const STATS_KEY = "aiways_mobile_stats_v1";
  const HOLD_KEY = "aiways_mobile_hold_v1";
  const CLASS_KEY = "aiways_mobile_class_v1";
  const SIGNUP_BANNER_DISMISS_KEY = "aiways_mobile_signup_banner_dismissed_v1";

  let practiceStats = { totalCount: 0, carbonReduction: 0, logs: [] };
  let holdBoxList = [];
  let activeResultItem = null;
  let activeResultContext = {};
  let currentQuizSet = [];
  let currentQuizIndex = 0;
  let userQuizScore = 0;
  // GPS 교내판정(5단계)이 어느 학교를 기준으로 검사할지 알아야 하는데,
  // 가입한 학생이면 서버가 확인한 학교명이 더 신뢰도 높다.
  let registeredSchoolId = "";

  const $ = id => document.getElementById(id);
  const normalize = value => (value || "").toString().normalize("NFKC").trim().toLowerCase();

  // -----------------------------------------------------------------
  // Tabs
  // -----------------------------------------------------------------
  // All 4 tabs get a min-height matching whichever is naturally tallest, so
  // the card doesn't visibly shrink/grow when switching. Nothing is
  // hardcoded: a tab's real height is only ever measured while it's actually
  // visible in normal flow (never guessed via a hidden/position:absolute
  // trick, which can measure the wrong width and under-report height), so
  // this stays accurate regardless of viewport width or copy changes.
  // The only cost is that a tab not yet visited this session doesn't
  // contribute to the shared height until the user actually opens it, which
  // resolves itself within the first couple of tab switches.
  let sharedTabMinHeight = 0;
  function growSharedTabHeight(fromTab) {
    fromTab.style.minHeight = "";
    const natural = fromTab.scrollHeight;
    if (natural <= sharedTabMinHeight) { fromTab.style.minHeight = `${sharedTabMinHeight}px`; return; }
    sharedTabMinHeight = natural;
    document.querySelectorAll(".tab-content").forEach(tab => { tab.style.minHeight = `${sharedTabMinHeight}px`; });
  }
  function syncTabHeights() {
    const active = document.querySelector(".tab-content:not(.hidden)");
    if (active) growSharedTabHeight(active);
  }

  // -----------------------------------------------------------------
  // Interim class context (school/grade/class) + real backend recording
  // -----------------------------------------------------------------
  // Step 4 (one-time real-name signup + permanent device lock) will replace
  // this free-text form. Until then, this is the only way a record can be
  // tied to a class, so it stays optional: without it, saveSortingRecord
  // still succeeds, the record just has no classContext.
  function loadClassContext() {
    try {
      const saved = JSON.parse(localStorage.getItem(CLASS_KEY) || "null");
      return saved?.schoolId && saved?.grade && saved?.classNum ? saved : null;
    } catch { return null; }
  }

  // 학교 검색 위젯: 자유 텍스트 입력 대신 나이스(NEIS) 학교기본정보 API로
  // 실제 검색해서 목록에서 고르게 한다 - 오타로 같은 학교 학생이 다른
  // 집계 단위로 쪼개지는 걸 막기 위함(교사 지적 사항). 입력창엔 학교
  // "이름"이 보이지만, 실제로 서버에 보내는 schoolId는 그 학교의 나이스
  // 표준학교코드다. 검색 결과에서 고르기 전까지는 코드가 비어있어서
  // (getSelection()이 null 반환) 자유 텍스트만 쳐놓고 제출하는 걸 막는다.
  function initSchoolSearch({ inputId, hiddenId, resultsId }) {
    const input = $(inputId), hidden = $(hiddenId), results = $(resultsId);
    if (!input || !hidden || !results) return null;
    const client = window.AIWaysEdu2gClient;
    let debounceTimer = 0;
    let selectedLabel = "";
    function hideResults() { results.classList.add("hidden"); results.replaceChildren(); }
    function renderSchools(schools) {
      results.replaceChildren();
      if (!schools.length) {
        const empty = document.createElement("div");
        empty.className = "px-3 py-2 text-slate-400";
        empty.textContent = "검색 결과가 없어요.";
        results.append(empty);
      } else {
        // 같은 이름의 학교가 여러 지역에 있을 수 있어 급별만으론 못 구분할
        // 때가 있다 - 도로명주소를 같이 보여줘야 정확히 구분해서 고를 수 있다.
        schools.slice(0, 15).forEach(school => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "block w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0";
          const title = document.createElement("span");
          title.className = "block font-semibold";
          title.textContent = `${school.schoolName} (${school.schoolLevel})`;
          const address = document.createElement("span");
          address.className = "block text-[11px] text-slate-400 mt-0.5";
          address.textContent = school.address || school.region;
          item.append(title, address);
          item.addEventListener("click", () => {
            input.value = school.schoolName;
            selectedLabel = school.schoolName;
            hidden.value = school.schoolCode;
            hideResults();
          });
          results.append(item);
        });
      }
      results.classList.remove("hidden");
    }
    input.addEventListener("input", () => {
      if (input.value.trim() !== selectedLabel) hidden.value = "";
      clearTimeout(debounceTimer);
      const query = input.value.trim();
      if (query.length < 2) { hideResults(); return; }
      debounceTimer = setTimeout(async () => {
        const response = await client?.searchSchool?.({ query });
        renderSchools(response?.ok ? (response.data?.schools || []) : []);
      }, 300);
    });
    input.addEventListener("blur", () => setTimeout(hideResults, 150));
    return {
      setValue(schoolId, schoolName) {
        hidden.value = schoolId || "";
        input.value = schoolName || "";
        selectedLabel = schoolName || "";
      },
      getSelection() {
        return hidden.value ? { schoolId: hidden.value, schoolName: input.value.trim() } : null;
      }
    };
  }

  function initClassContextForm() {
    const gradeInput = $("classGradeInput");
    const numInput = $("classNumInput");
    const status = $("classContextStatus");
    const search = initSchoolSearch({ inputId: "classSchoolInput", hiddenId: "classSchoolCode", resultsId: "classSchoolResults" });
    if (!search || !gradeInput || !numInput || !status) return;
    const saved = loadClassContext();
    if (saved) {
      search.setValue(saved.schoolId, saved.schoolName);
      gradeInput.value = saved.grade;
      numInput.value = saved.classNum;
    }
    function sync() {
      const selection = search.getSelection();
      const grade = gradeInput.value.trim();
      const classNum = numInput.value.trim();
      if (selection && grade && classNum) {
        try { localStorage.setItem(CLASS_KEY, JSON.stringify({ schoolId: selection.schoolId, schoolName: selection.schoolName, grade, classNum })); } catch {}
        status.textContent = "저장됨 · 이제부터 이 반 기록으로 저장돼요.";
      } else {
        try { localStorage.removeItem(CLASS_KEY); } catch {}
        status.textContent = "학교를 검색해서 목록에서 고르고, 학년/반을 입력해야 우리 반 기록에 반영돼요.";
      }
    }
    [$("classSchoolInput"), gradeInput, numInput].forEach(input => input.addEventListener("change", sync));
    $("classSchoolResults").addEventListener("click", () => setTimeout(sync, 0));
    sync();
  }

  // -----------------------------------------------------------------
  // 정식 가입 (최초 1회, 기기 영구고정) — 이중 확인창까지 포함한 흐름
  // -----------------------------------------------------------------
  function currentSchoolId() {
    return registeredSchoolId || loadClassContext()?.schoolId || "";
  }

  function hideSignupBanner() {
    $("signupBanner")?.classList.add("hidden");
  }

  function initSignupBanner() {
    const banner = $("signupBanner");
    if (!banner) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(SIGNUP_BANNER_DISMISS_KEY) === "1"; } catch {}
    if (!dismissed) banner.classList.remove("hidden");
    $("signupBannerGoBtn")?.addEventListener("click", () => {
      switchTab("tab-stats");
      $("signupSchoolInput")?.focus();
    });
    $("signupBannerDismissBtn")?.addEventListener("click", () => {
      hideSignupBanner();
      try { localStorage.setItem(SIGNUP_BANNER_DISMISS_KEY, "1"); } catch {}
    });
  }

  function showSignupLocked(profile) {
    registeredSchoolId = profile.schoolId;
    hideSignupBanner();
    const card = $("signupCard");
    if (!card) return;
    card.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-bold text-blue-800">
        <span>🎓</span><span>가입 완료</span>
      </div>
      <p class="text-xs font-semibold text-blue-700">${profile.schoolName || profile.schoolId} ${profile.grade}학년 ${profile.classNum}반 ${profile.studentNumber}번 ${profile.name}</p>
      <button id="classChangeToggleButton" type="button" class="text-[10px] font-bold text-blue-600 underline">반이 바뀌었어요</button>
      <div id="classChangeForm" class="hidden space-y-2 pt-1">
        <div class="grid grid-cols-2 gap-2">
          <input type="text" inputmode="numeric" id="classChangeGradeInput" placeholder="새 학년" class="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" inputmode="numeric" id="classChangeClassInput" placeholder="새 반" class="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <button id="classChangeSubmitButton" type="button" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded-xl transition-all">반 변경 요청</button>
        <p id="classChangeStatus" class="text-[10px] font-semibold text-blue-500"></p>
      </div>
      <p class="text-[10px] text-blue-500 leading-snug">학교/번호/이름은 못 바꿔요(선생님께 말씀해 주세요). 반은 하루에 한 번만 바꿀 수 있어요.</p>
    `;
    $("interimClassCard")?.classList.add("hidden");
    initClassChangeControls();
    loadClassRanking();
  }

  // 3단 권한체계 2단계(2026-08-31) - 가입 신청은 교사 승인이 나야 studentProfile이
  // 생긴다. registerStudentProfile 응답이 이제 즉시 profile을 안 돌려주므로
  // (pending:true, preview만) 승인 전까지는 이 대기 상태를 보여준다.
  function showSignupPending(preview) {
    hideSignupBanner();
    const card = $("signupCard");
    if (!card) return;
    card.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-bold text-amber-800">
        <span>⏳</span><span>선생님 승인 대기중</span>
      </div>
      <p class="text-xs font-semibold text-amber-700">${preview.schoolName || preview.schoolId} ${preview.grade}학년 ${preview.classNum}반 ${preview.studentNumber}번 ${preview.name}</p>
      <p class="text-[10px] text-amber-600 leading-snug">선생님이 확인하시면 가입이 완료돼요. 잠시 후 다시 열어서 확인해 주세요.</p>
    `;
    $("interimClassCard")?.classList.add("hidden");
  }

  function formatCooldownWait(retryAfterSeconds) {
    const hours = Math.ceil((retryAfterSeconds || 0) / 3600);
    return hours > 1 ? `${hours}시간 뒤에 다시 시도해 주세요.` : "잠시 뒤에 다시 시도해 주세요.";
  }

  // -----------------------------------------------------------------
  // 반별 랭킹 (2026-08-26, 전국 랭킹 폐지 후 축소) — 같은 학교, 같은 학년의
  // 반끼리만 비교한다. 백엔드(getClassRanking)가 애초에 다른 학교/다른
  // 학년 데이터를 조회하지도, 응답에 담지도 않는다.
  // -----------------------------------------------------------------
  async function loadClassRanking() {
    const list = $("classRankingList");
    const status = $("classRankingStatus");
    if (!list || !status) return;
    const client = window.AIWaysEdu2gClient;
    if (!client?.getClassRanking) { status.textContent = "지금은 랭킹을 불러올 수 없어요."; return; }
    const context = loadClassContext();
    const schoolId = currentSchoolId();
    const grade = context?.grade || "";
    const classNum = context?.classNum || "";
    if (!schoolId || !grade) { status.textContent = "학교/반을 연결하면 우리 반 순위가 표시돼요."; return; }
    status.textContent = "불러오는 중입니다...";
    list.replaceChildren();
    const result = await client.getClassRanking({ schoolId, grade, classNum });
    if (!result.ok) {
      status.textContent = client.errorMessageFor?.(result.data?.code) || "랭킹을 불러오지 못했어요. 다시 시도해 주세요.";
      return;
    }
    const classes = Array.isArray(result.data?.classes) ? result.data.classes : [];
    if (!classes.length) { status.textContent = "아직 같은 학년 반 기록이 없어요."; return; }
    status.textContent = "우리 반은 굵게 표시돼요.";
    classes.forEach(classItem => {
      const item = document.createElement("li");
      item.className = `flex items-center justify-between rounded-xl px-3 py-2 text-xs ${classItem.isMine ? "bg-indigo-600 text-white font-bold" : "bg-white text-slate-600 font-semibold"}`;
      const left = document.createElement("span");
      left.textContent = `${classItem.rank}위 · ${grade}학년 ${classItem.classNum}반`;
      const right = document.createElement("span");
      right.textContent = `${classItem.score}회`;
      item.append(left, right);
      list.append(item);
    });
  }

  function initClassChangeControls() {
    const toggleBtn = $("classChangeToggleButton");
    const form = $("classChangeForm");
    const submitBtn = $("classChangeSubmitButton");
    const status = $("classChangeStatus");
    if (!toggleBtn || !form || !submitBtn || !status) return;
    const client = window.AIWaysEdu2gClient;

    toggleBtn.addEventListener("click", () => form.classList.toggle("hidden"));

    submitBtn.addEventListener("click", async () => {
      const grade = cleanForSignup($("classChangeGradeInput")?.value);
      const classNum = cleanForSignup($("classChangeClassInput")?.value);
      if (!grade || !classNum) { status.textContent = "학년/반을 모두 입력해 주세요."; return; }
      if (!client?.previewClassChange || !client?.changeStudentClass) { status.textContent = "지금은 변경을 처리할 수 없어요."; return; }
      submitBtn.disabled = true;
      status.textContent = "확인 중입니다...";
      const preview = await client.previewClassChange({ grade, classNum });
      submitBtn.disabled = false;
      if (!preview.ok) {
        status.textContent = preview.data?.code === "cooldown_active" ? formatCooldownWait(preview.data.retryAfterSeconds)
          : preview.data?.code === "no_change" ? "이미 그 반으로 등록돼 있어요."
          : "입력 내용을 다시 확인해 주세요.";
        return;
      }
      const p = preview.data.preview;
      openCustomModal(
        "반 변경 확인",
        `정말 "${p.schoolName || p.schoolId} ${p.grade}학년 ${p.classNum}반"으로 바꾸시겠어요? 반 변경은 하루에 한 번만 할 수 있어요.`,
        "🔄",
        "bg-blue-600 hover:bg-blue-700",
        async () => {
          status.textContent = "변경하는 중입니다...";
          const result = await client.changeStudentClass({ grade, classNum });
          if (result.ok) { showSignupLocked(result.data.profile); showVisualAlert(`🔄 ${p.grade}학년 ${p.classNum}반으로 변경 완료!`, "emerald"); }
          else status.textContent = result.data?.code === "cooldown_active" ? formatCooldownWait(result.data.retryAfterSeconds) : "변경에 실패했어요. 다시 시도해 주세요.";
        }
      );
    });
  }

  function initSignupForm() {
    const card = $("signupCard");
    const submitBtn = $("signupSubmitButton");
    const status = $("signupStatus");
    if (!card || !submitBtn || !status) return;
    const client = window.AIWaysEdu2gClient;

    client?.checkStudentProfile?.().then(response => {
      if (response.ok && response.data?.hasProfile) showSignupLocked(response.data.profile);
      else if (response.ok && response.data?.pending) showSignupPending(response.data.pendingProfile || {});
      else initSignupBanner();
    }).catch(() => initSignupBanner());

    const schoolSearch = initSchoolSearch({ inputId: "signupSchoolInput", hiddenId: "signupSchoolCode", resultsId: "signupSchoolResults" });

    submitBtn.addEventListener("click", async () => {
      const schoolSelection = schoolSearch?.getSelection();
      const grade = cleanForSignup($("signupGradeInput")?.value);
      const classNum = cleanForSignup($("signupClassInput")?.value);
      const studentNumber = cleanForSignup($("signupNumberInput")?.value);
      const name = cleanForSignup($("signupNameInput")?.value);
      if (!schoolSelection || !grade || !classNum || !studentNumber || !name) {
        status.textContent = "학교를 검색해서 목록에서 고르고, 학년/반/번호/이름을 모두 입력해 주세요.";
        return;
      }
      const { schoolId, schoolName } = schoolSelection;
      if (!client?.previewStudentProfile || !client?.registerStudentProfile) {
        status.textContent = "지금은 가입을 처리할 수 없어요. 잠시 후 다시 시도해 주세요.";
        return;
      }
      submitBtn.disabled = true;
      status.textContent = "확인 중입니다...";
      const preview = await client.previewStudentProfile({ schoolId, schoolName, grade, classNum, studentNumber, name });
      submitBtn.disabled = false;
      if (!preview.ok) {
        status.textContent = preview.data?.code === "already_registered" ? "이미 가입된 기기예요." : "입력 내용을 다시 확인해 주세요.";
        if (preview.data?.profile) showSignupLocked(preview.data.profile);
        return;
      }
      openCustomModal(
        "가입 정보 확인",
        `정말 "${schoolName} ${grade}학년 ${classNum}반 ${studentNumber}번 ${name}" 학생이 맞나요? 가입하면 이 기기에 영구히 저장되고 다시 바꿀 수 없어요.`,
        "🎓",
        "bg-blue-600 hover:bg-blue-700",
        async () => {
          status.textContent = "가입하는 중입니다...";
          const result = await client.registerStudentProfile({ schoolId, schoolName, grade, classNum, studentNumber, name });
          if (result.ok && result.data?.pending) { showSignupPending(result.data.preview); showVisualAlert(`⏳ "${name}" 학생 가입 신청 완료! 선생님 승인을 기다려 주세요.`, "amber"); }
          else {
            status.textContent = result.data?.code === "already_registered" ? "이미 가입된 기기예요."
              : result.data?.code === "request_pending" ? "이미 승인 대기중이에요." : "가입에 실패했어요. 다시 시도해 주세요.";
            if (result.data?.profile) showSignupLocked(result.data.profile);
          }
        }
      );
    });
  }

  function cleanForSignup(value) {
    return (value || "").toString().trim();
  }

  function createRecordIdempotencyKey() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = window.crypto?.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(4)) : [Date.now(), Math.random() * 1e9, Math.random() * 1e9, Math.random() * 1e9];
    return Array.from(bytes, value => Number(value >>> 0).toString(36)).join("-");
  }

  // Fire-and-forget: this is the actual network call HANDOFF.md flagged as
  // missing ("mobile/에 fetch가 단 한 줄도 없다"). It never blocks the UI --
  // the student's confirmation is already reflected locally before this
  // resolves, matching the "사진찍는 것도 귀찮은데" no-friction requirement.
  // GPS 교내판정(5단계): 좌표는 이 함수 밖으로 절대 안 나간다 - 서버에
  // checkCampusLocation을 한 번 호출해서 참/거짓 판정 + 일회용 확인ID만
  // 받아오고, 좌표 자체는 어디에도 저장하지 않는다. 권한 거부/타임아웃/학교
  // 미확인 등 뭐가 실패하든 그냥 ""를 돌려주고 제출은 계속 진행한다(그
  // 기록은 개인 기록으로만 남고 우리반 경쟁에는 반영 안 됨 - 결정된 사항).
  function getCurrentPosition(timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error("no_geolocation")); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: timeoutMs, maximumAge: 60000 });
    });
  }

  async function resolveCampusCheckId() {
    const client = window.AIWaysEdu2gClient;
    const schoolId = currentSchoolId();
    if (!schoolId || !client?.checkCampusLocation) return "";
    try {
      const position = await getCurrentPosition(4000);
      const response = await client.checkCampusLocation({ schoolId, lat: position.coords.latitude, lng: position.coords.longitude });
      return response.ok && response.data?.campusCheckId ? response.data.campusCheckId : "";
    } catch {
      return "";
    }
  }

  async function submitSortingRecord({ status, selectedItemId, provider, objectCandidates = [], holdReasons = [] }) {
    const client = window.AIWaysEdu2gClient;
    if (!client?.saveSortingRecord || !selectedItemId) return;
    const classContext = loadClassContext();
    const campusCheckId = await resolveCampusCheckId();
    const payload = {
      schemaVersion: "sorting-record-v1",
      status,
      provider: provider.slice(0, 80),
      analysis: { objectCandidates, materialCandidates: [], visibleCautions: [] },
      checklist: [],
      userDecision: { selectedItemId: selectedItemId.slice(0, 40), action: status === "held" ? "held" : "recorded", userConfirmed: true },
      hold: status === "held" ? { recommended: true, reasons: holdReasons.slice(0, 5) } : null,
      ...(classContext ? { classContext } : {}),
      ...(campusCheckId ? { campusCheckId } : {}),
      idempotencyKey: createRecordIdempotencyKey()
    };
    try { await client.saveSortingRecord(payload); } catch { /* best-effort; local UI already reflects the action */ }
  }

  function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.add("hidden"));
    const target = $(tabId);
    target.classList.remove("hidden");
    growSharedTabHeight(target);
    document.querySelectorAll("[data-tab-btn]").forEach(btn => {
      const active = btn.dataset.tabBtn === tabId;
      btn.className = active
        ? "text-center py-2.5 rounded-xl transition-all duration-300 bg-white text-slate-900 shadow-sm"
        : "text-center py-2.5 rounded-xl transition-all duration-300 text-slate-500 hover:text-slate-800";
    });
  }

  // -----------------------------------------------------------------
  // Judge tab: quick-select grid
  // -----------------------------------------------------------------
  function renderQuickSelectGrid() {
    const grid = $("quickSelectGrid");
    grid.replaceChildren();
    DATA.QUICK_SELECT_ORDER.forEach(id => {
      const item = DATA.sortingDbV2[id];
      if (!item) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flex flex-col items-center gap-1 p-2.5 bg-slate-50 border border-slate-100 hover:border-blue-300 hover:bg-blue-50/40 rounded-2xl transition-all duration-200 active:scale-95";
      btn.innerHTML = `<span class="text-xl">${item.emoji}</span><span class="text-xs font-bold text-slate-700 text-center leading-tight">${item.label.split(" / ")[0]}</span><span class="text-[9px] font-semibold text-slate-400 text-center leading-tight">${item.category}</span>`;
      btn.addEventListener("click", () => renderResult(id));
      grid.append(btn);
    });
  }

  function findItemId(query) {
    const q = normalize(query);
    if (!q) return null;
    const db = DATA.sortingDbV2;
    for (const id in db) { if (id !== "hold" && normalize(db[id].label) === q) return id; }
    for (const id in db) {
      if (id === "hold") continue;
      const item = db[id];
      const haystacks = [item.label, ...(item.searchKeywords || [])].map(normalize);
      if (haystacks.some(h => h && (h.includes(q) || q.includes(h)))) return id;
    }
    return null;
  }

  // -----------------------------------------------------------------
  // Search box live emoji icon: idle rotation through a broad pool of item
  // emojis, snaps to whatever best matches once the user pauses typing.
  // Real sortingDbV2 items (with actual disposal guidance) win over the
  // purely decorative lookup; "?" only shows when nothing matches either.
  // -----------------------------------------------------------------
  function matchDecorativeEmoji(query) {
    const q = normalize(query);
    if (!q) return null;
    for (const [emoji, keywords] of DATA.DECORATIVE_EMOJI_LOOKUP) {
      if (keywords.some(k => { const nk = normalize(k); return q.includes(nk) || nk.includes(q); })) return emoji;
    }
    return null;
  }

  function initSearchEmojiIcon() {
    const icon = $("searchEmojiIcon");
    const input = $("searchInput");
    if (!icon || !input) return;

    const rotationPool = [
      ...Object.values(DATA.sortingDbV2).filter(item => !item.isHold).map(item => item.emoji),
      ...DATA.DECORATIVE_EMOJI_LOOKUP.map(([emoji]) => emoji)
    ];
    let lastShown = "";
    let rotationTimer = 0;
    let debounceTimer = 0;

    function showIcon(emoji) {
      icon.style.opacity = "0";
      setTimeout(() => { icon.textContent = emoji; icon.style.opacity = "1"; }, 60);
    }

    function nextRandomEmoji() {
      let pick = lastShown;
      while (pick === lastShown) pick = rotationPool[Math.floor(Math.random() * rotationPool.length)];
      lastShown = pick;
      return pick;
    }

    function startRotation() {
      stopRotation();
      showIcon(nextRandomEmoji());
      rotationTimer = setInterval(() => showIcon(nextRandomEmoji()), 350);
    }
    function stopRotation() { clearInterval(rotationTimer); }

    function matchNow() {
      const value = input.value.trim();
      if (!value) { startRotation(); return; }
      stopRotation();
      const realId = findItemId(value);
      const emoji = realId ? DATA.sortingDbV2[realId].emoji : matchDecorativeEmoji(value);
      showIcon(emoji || "❓");
    }

    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(matchNow, 350);
    });

    startRotation();
  }

  function openJudgeModal() {
    $("judgeScanState").classList.add("hidden");
    $("judgeTextScanState").classList.add("hidden");
    $("judgeResultState").classList.remove("hidden");
    $("judgeModal").classList.remove("hidden");
    $("judgeModalBox").scrollTop = 0;
  }
  function closeJudgeModal() {
    $("judgeModal").classList.add("hidden");
  }

  function renderResult(itemId, opts = {}) {
    const db = DATA.sortingDbV2;
    const item = db[itemId] || db.hold;
    activeResultItem = item;
    activeResultContext = opts;

    // AI photo results that land on "hold" still carry Gemini's best-effort
    // read of the object and its likely material -- surface that instead of
    // just the generic hold boilerplate, so "I don't know" always comes with
    // a best guess and a reason, not a dead end.
    const aiGuess = opts.isAiResult && item.isHold && opts.aiLabel;
    if (aiGuess) {
      const materials = (opts.materialCandidates || []).map(m => m.label).filter(Boolean);
      const materialText = materials.length ? `재질은 ${materials.slice(0, 2).join(", ")}(으)로 추정돼요.` : "재질은 사진만으로 확신하기 어려워요.";
      $("resCategory").textContent = "AI 추정 · 확인 필요";
      $("resTitle").textContent = `❓ ${opts.aiLabel}`;
      $("resBody").textContent = `AI가 살펴본 결과 "${opts.aiLabel}"(으)로 보여요. ${materialText} 정확한 분리배출 방법은 확신할 수 없어 학교 판단 보류함에 기록하는 것을 추천해요.`;
      $("resTip").textContent = (opts.cautions && opts.cautions[0]) || item.tip;
    } else {
      $("resCategory").textContent = item.category;
      $("resTitle").textContent = `${item.emoji} ${item.label}`;
      $("resBody").textContent = item.guide;
      $("resTip").textContent = (opts.isAiResult && opts.cautions && opts.cautions[0]) || item.tip;
    }

    const candidatesBox = $("resCandidates");
    if (opts.isAiResult && Array.isArray(opts.candidates) && opts.candidates.length > 1) {
      candidatesBox.classList.remove("hidden");
      candidatesBox.replaceChildren();
      const tag = document.createElement("span");
      tag.className = "text-[10px] text-slate-400 font-bold w-full";
      tag.textContent = "다른 후보였나요?";
      candidatesBox.append(tag);
      opts.candidates.forEach(candidate => {
        const candidateItem = db[candidate.itemId];
        if (!candidateItem || candidate.itemId === itemId) return;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-slate-600 transition-colors";
        chip.textContent = `${candidateItem.emoji} ${candidateItem.label.split(" / ")[0]}`;
        chip.addEventListener("click", () => renderResult(candidate.itemId, { isAiResult: true }));
        candidatesBox.append(chip);
      });
    } else {
      candidatesBox.classList.add("hidden");
    }

    const holdForm = $("hold-registration-form");
    const holdInput = $("holdItemName");
    const practiceRow = $("practiceActionRow");
    const tag = $("resActionTag");

    if (item.isHold) {
      holdInput.value = opts.rawQuery || "";
      holdForm.classList.remove("hidden");
      practiceRow.classList.add("hidden");
      tag.textContent = "🛑 보류함 보관 권장";
      tag.className = "inline-block text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200";
    } else {
      holdForm.classList.add("hidden");
      practiceRow.classList.remove("hidden");
      tag.textContent = opts.isAiResult ? "🤖 AI 사진 판단" : "🔍 배출 가이드 확인";
      tag.className = "inline-block text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200";
    }
    openJudgeModal();
  }

  // -----------------------------------------------------------------
  // Judge tab: search + autocomplete
  // -----------------------------------------------------------------
  function initSearchAutocomplete() {
    const container = $("search-suggestions");
    container.replaceChildren();
    Object.values(DATA.sortingDbV2).forEach(item => {
      if (item.isHold) return;
      const div = document.createElement("div");
      div.className = "px-4 py-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors";
      div.innerHTML = `<span class="font-semibold text-slate-700">${item.emoji} ${item.label}</span><span class="text-[9px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md">${item.category}</span>`;
      div.addEventListener("click", () => {
        $("searchInput").value = item.label;
        renderResult(item.id);
        container.classList.add("hidden");
      });
      container.append(div);
    });
  }

  function handleSearch(event) {
    const inputVal = event.target.value.trim();
    const suggestions = $("search-suggestions");
    if (!inputVal) { suggestions.classList.add("hidden"); return; }
    let matches = 0;
    Array.from(suggestions.children).forEach(child => {
      const visible = child.textContent.toLowerCase().includes(inputVal.toLowerCase());
      child.classList.toggle("hidden", !visible);
      if (visible) matches += 1;
    });
    suggestions.classList.toggle("hidden", matches === 0);
    if (event.key === "Enter") triggerSearch();
  }

  function triggerSearch() {
    const val = $("searchInput").value.trim();
    if (!val) return;
    $("search-suggestions").classList.add("hidden");
    const id = findItemId(val);
    if (id) { renderResult(id, { rawQuery: val }); return; }
    // Not one of the 12 tracked categories locally -- ask Gemini what the
    // typed phrase most likely is and whether it fits one of them anyway.
    if (window.AIWaysMobileTextTip?.analyzeText) { runTextAnalysis(val); return; }
    renderResult("hold", { rawQuery: val });
  }

  // -----------------------------------------------------------------
  // Judge tab: photo -> real AI judgment
  // -----------------------------------------------------------------
  // Scan animation stays up at least this long so it never flashes by
  // even when the real Gemini response comes back fast.
  const SCAN_MIN_MS = 2500;

  function showScanState(imageUrl) {
    $("judgeScanImage").src = imageUrl;
    $("judgeScanState").classList.remove("hidden");
    $("judgeResultState").classList.add("hidden");
    $("judgeModal").classList.remove("hidden");
  }

  function runPhotoAnalysis(imageEl, imageUrl) {
    const btn = $("photoTriggerBtn");
    btn.disabled = true;
    showScanState(imageUrl);
    const startedAt = Date.now();
    return window.AIWaysMobileVision.analyzePhoto(imageEl, { searchQuery: $("searchInput").value })
      .then(async result => {
        const remaining = SCAN_MIN_MS - (Date.now() - startedAt);
        if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
        btn.disabled = false;
        if (!result.ok) {
          closeJudgeModal();
          showVisualAlert(window.AIWaysEdu2gClient?.errorMessageFor?.(result.code) || "사진 분석에 실패했습니다. 다시 시도해 주세요.", "amber");
          return;
        }
        const top = result.value.objectCandidates[0];
        if (!top) {
          renderResult("hold", { isAiResult: true, materialCandidates: result.value.materialCandidates, cautions: result.value.visibleCautions });
          return;
        }
        renderResult(top.itemId, {
          isAiResult: true,
          candidates: result.value.objectCandidates,
          aiLabel: top.label,
          materialCandidates: result.value.materialCandidates,
          cautions: result.value.visibleCautions
        });
      });
  }

  // -----------------------------------------------------------------
  // Judge tab: search box -> local match, or Gemini text lookup fallback
  // -----------------------------------------------------------------
  // Kept in sync with the loading-bar-fill CSS animation duration (1.4s) so the
  // bar always visibly finishes filling before the result swaps in.
  const TEXT_SCAN_MIN_MS = 1400;

  function showTextScanState(query) {
    $("judgeTextScanQuery").textContent = query;
    $("judgeTextScanState").classList.remove("hidden");
    $("judgeResultState").classList.add("hidden");
    $("judgeModal").classList.remove("hidden");
  }

  function runTextAnalysis(query) {
    showTextScanState(query);
    const startedAt = Date.now();
    return window.AIWaysMobileTextTip.analyzeText(query)
      .then(async result => {
        const remaining = TEXT_SCAN_MIN_MS - (Date.now() - startedAt);
        if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
        if (!result.ok) {
          closeJudgeModal();
          showVisualAlert(window.AIWaysEdu2gClient?.errorMessageFor?.(result.code) || "검색어 분석에 실패했습니다. 다시 시도해 주세요.", "amber");
          return;
        }
        const top = result.value.objectCandidates[0];
        if (!top) {
          renderResult("hold", { isAiResult: true, rawQuery: query, materialCandidates: result.value.materialCandidates, cautions: result.value.visibleCautions });
          return;
        }
        renderResult(top.itemId, {
          isAiResult: true,
          rawQuery: query,
          candidates: result.value.objectCandidates,
          aiLabel: top.label,
          materialCandidates: result.value.materialCandidates,
          cautions: result.value.visibleCautions
        });
      });
  }

  function initPhotoCapture() {
    const input = $("photoInput");
    $("photoTriggerBtn").addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { runPhotoAnalysis(img, url).finally(() => URL.revokeObjectURL(url)); };
      img.onerror = () => { URL.revokeObjectURL(url); showVisualAlert("사진을 불러오지 못했습니다. 다시 시도해 주세요.", "amber"); };
      img.src = url;
    });
  }

  // -----------------------------------------------------------------
  // Practice logging
  // -----------------------------------------------------------------
  function logPractice(item) {
    if (!item || item.isHold) {
      showVisualAlert("🛑 판단 유예 항목입니다. 보류함에 기록해 주세요.", "amber");
      return;
    }
    const isAiResult = activeResultContext.isAiResult === true;
    submitSortingRecord({
      status: "completed",
      selectedItemId: item.id,
      provider: isAiResult ? "future_gemini" : "manual_select",
      objectCandidates: isAiResult ? [{ label: activeResultContext.aiLabel || item.label, itemId: item.id, objectType: item.objectType || item.id, confidenceBand: "unknown" }] : []
    });
    practiceStats.totalCount += 1;
    practiceStats.carbonReduction += item.carbonSaved || 0;
    const timestamp = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    practiceStats.logs.unshift({ name: `${item.emoji} ${item.label}`, category: item.category, carbon: item.carbonSaved || 0, time: timestamp });
    if (practiceStats.logs.length > 30) practiceStats.logs.pop();
    try { localStorage.setItem(STATS_KEY, JSON.stringify(practiceStats)); } catch {}
    updateStatsUI();
    showVisualAlert(`🌳 올바른 실천! CO2 ${item.carbonSaved || 0}g이 절감되었습니다.`, "emerald");
  }

  function updateHoldCountStat() {
    $("stat-hold").textContent = `${holdBoxList.length}개`;
    $("judge-stat-hold").textContent = `${holdBoxList.length}개`;
  }

  function updateStatsUI() {
    $("stat-count").textContent = `${practiceStats.totalCount}회`;
    $("stat-carbon").textContent = `${practiceStats.carbonReduction.toFixed(1)}g`;
    $("judge-stat-count").textContent = `${practiceStats.totalCount}회`;
    $("judge-stat-carbon").textContent = `${practiceStats.carbonReduction.toFixed(1)}g`;
    updateHoldCountStat();
    const container = $("practice-logs-container");
    const noLogs = $("no-logs-msg");
    container.querySelectorAll(".practice-item").forEach(el => el.remove());
    if (practiceStats.logs.length === 0) { noLogs.classList.remove("hidden"); return; }
    noLogs.classList.add("hidden");
    practiceStats.logs.forEach(log => {
      const div = document.createElement("div");
      div.className = "practice-item flex justify-between items-center bg-white p-3 border border-slate-100 rounded-xl shadow-sm text-xs transition-all duration-300";
      // Item names/categories can originate outside this file (search results,
      // and the AI text-lookup fallback), so they are assigned as text rather
      // than interpolated into markup. carbon is a number computed here.
      div.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="log-category bg-blue-50 text-blue-600 font-extrabold px-1.5 py-0.5 rounded text-[9px] shrink-0"></span>
          <span class="log-name font-bold text-slate-700 truncate max-w-[150px] sm:max-w-xs"></span>
        </div>
        <div class="text-right shrink-0">
          <span class="font-extrabold text-emerald-600 block">-${log.carbon}g CO₂</span>
          <span class="log-time text-[9px] text-slate-400 block"></span>
        </div>`;
      div.querySelector(".log-category").textContent = log.category;
      div.querySelector(".log-name").textContent = log.name;
      div.querySelector(".log-time").textContent = log.time;
      container.append(div);
    });
  }

  // -----------------------------------------------------------------
  // Hold box
  // -----------------------------------------------------------------
  function addHoldItem(name) {
    const today = new Date();
    holdBoxList.unshift({ id: crypto.randomUUID(), name, date: `${today.getMonth() + 1}월 ${today.getDate()}일` });
    try { localStorage.setItem(HOLD_KEY, JSON.stringify(holdBoxList)); } catch {}
    submitSortingRecord({ status: "held", selectedItemId: name, provider: "manual_hold", holdReasons: ["학생 직접 등록"] });
    updateHoldUI();
    showVisualAlert(`❓ "${name}"이(가) 회의 안건 목록에 등록되었습니다.`, "amber");
  }

  function updateHoldUI() {
    const container = $("hold-list-container");
    const noHold = $("no-hold-items-msg");
    $("hold-count-badge").textContent = holdBoxList.length;
    updateHoldCountStat();
    container.querySelectorAll(".hold-item-card").forEach(el => el.remove());
    if (holdBoxList.length === 0) { noHold.classList.remove("hidden"); return; }
    noHold.classList.add("hidden");
    holdBoxList.forEach(item => {
      const div = document.createElement("div");
      div.className = "hold-item-card flex justify-between items-center bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm text-xs hover:border-amber-200 transition-all";
      // item.name is free text the user typed into the hold form, so it is
      // assigned as text -- interpolating it into markup would let a name like
      // "<img src=x onerror=...>" run as script on every later page load,
      // since the hold list is replayed from localStorage.
      div.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 mr-2">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
          <span class="hold-item-name font-extrabold text-slate-800 truncate"></span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="hold-item-date text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md"></span>
          <button type="button" class="resolve-hold-btn bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl font-bold text-[10px] transition-colors">해결 완료</button>
        </div>`;
      div.querySelector(".hold-item-name").textContent = item.name;
      div.querySelector(".hold-item-date").textContent = item.date;
      div.querySelector(".resolve-hold-btn").addEventListener("click", () => resolveHoldItem(item.id, item.name));
      container.append(div);
    });
  }

  function resolveHoldItem(id, name) {
    openCustomModal("분류 기준 수립 및 보류 해결", `"${name}" 품목의 세부 분리배출 기준이 확정되었나요? 확인을 누르면 보류 목록에서 정리됩니다.`, "🎉", "bg-emerald-600 hover:bg-emerald-700", () => {
      holdBoxList = holdBoxList.filter(item => item.id !== id);
      try { localStorage.setItem(HOLD_KEY, JSON.stringify(holdBoxList)); } catch {}
      updateHoldUI();
      showVisualAlert(`💡 "${name}" 품목이 보류함에서 정리되었습니다.`, "emerald");
    });
  }

  // -----------------------------------------------------------------
  // Modal + toast
  // -----------------------------------------------------------------
  let modalActionCallback = null;
  function openCustomModal(title, desc, icon, confirmClass, onConfirm) {
    $("modalTitle").textContent = title;
    $("modalDesc").textContent = desc;
    $("modalIcon").textContent = icon;
    const confirmBtn = $("modalConfirmBtn");
    confirmBtn.className = `flex-1 ${confirmClass} text-white font-bold text-xs py-2.5 rounded-xl transition-all`;
    modalActionCallback = onConfirm;
    $("customModal").classList.remove("hidden");
    setTimeout(() => $("modalBox").classList.remove("scale-95", "opacity-0"), 50);
  }
  function closeCustomModal() {
    $("modalBox").classList.add("scale-95", "opacity-0");
    setTimeout(() => $("customModal").classList.add("hidden"), 300);
  }

  function showVisualAlert(msg, colorType) {
    const toast = document.createElement("div");
    let bgClass = "bg-slate-800 text-white";
    if (colorType === "emerald") bgClass = "bg-emerald-600 text-white";
    if (colorType === "amber") bgClass = "bg-amber-600 text-white";
    toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3.5 rounded-2xl shadow-xl font-bold text-xs ${bgClass} transition-all duration-300 transform translate-y-10 opacity-0 z-50 text-center min-w-[280px] max-w-sm`;
    toast.textContent = msg;
    document.body.append(toast);
    setTimeout(() => toast.classList.remove("translate-y-10", "opacity-0"), 50);
    setTimeout(() => { toast.classList.add("translate-y-10", "opacity-0"); setTimeout(() => toast.remove(), 300); }, 3200);
  }

  // -----------------------------------------------------------------
  // Quiz
  // -----------------------------------------------------------------
  const QUIZ_RANK_RANGES = [
    { min: 0, label: "0~2개" }, { min: 3, label: "3~4개" }, { min: 5, label: "5~6개" },
    { min: 7, label: "7~8개" }, { min: 9, label: "9개" }, { min: 10, label: "10개" }
  ];

  function renderQuizRankLadder() {
    const container = $("quizRankLadder");
    container.replaceChildren();
    QUIZ_RANK_RANGES.forEach(range => {
      const rank = DATA.quizRank(range.min);
      const chip = document.createElement("div");
      chip.className = "bg-white border border-blue-100 rounded-xl py-2.5 px-1 text-center";
      chip.innerHTML = `<div class="text-xl">${rank.emoji}</div><div class="text-xs font-bold text-slate-700">${range.label}</div><div class="text-[11px] font-semibold text-slate-500 leading-tight mt-0.5">${rank.title}</div>`;
      container.append(chip);
    });
  }

  let autoAdvanceTimer = null;
  function clearAutoAdvance() {
    if (autoAdvanceTimer) { clearInterval(autoAdvanceTimer); autoAdvanceTimer = null; }
    $("nextQuizBtn").textContent = "다음 문제 풀기 ➔";
  }
  function startAutoAdvance() {
    clearAutoAdvance();
    let remaining = 3;
    $("nextQuizBtn").textContent = `${remaining}초 뒤 다음 문제 ➔`;
    autoAdvanceTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) { clearAutoAdvance(); nextQuiz(); return; }
      $("nextQuizBtn").textContent = `${remaining}초 뒤 다음 문제 ➔`;
    }, 1000);
  }

  function startQuiz() {
    clearAutoAdvance();
    currentQuizSet = DATA.pickQuizSet();
    currentQuizIndex = 0;
    userQuizScore = 0;
    $("quiz-box").classList.remove("hidden");
    $("quiz-result-summary").classList.add("hidden");
    showCurrentQuizQuestion();
  }

  function showCurrentQuizQuestion() {
    clearAutoAdvance();
    const data = currentQuizSet[currentQuizIndex];
    $("quiz-progress").textContent = `질문 ${currentQuizIndex + 1} / ${currentQuizSet.length}`;
    $("quiz-score").textContent = `현재 점수: ${userQuizScore}점`;
    $("quiz-progress-bar").style.width = `${((currentQuizIndex + 1) / currentQuizSet.length) * 100}%`;
    $("quiz-emoji").textContent = data.emoji;
    $("quiz-question").innerHTML = data.question;
    $("quiz-buttons").classList.remove("hidden");
    $("quiz-explanation-panel").classList.add("hidden");
  }

  function submitQuizAnswer(userAns) {
    const data = currentQuizSet[currentQuizIndex];
    const isCorrect = userAns === data.answer;
    if (isCorrect) userQuizScore += 10;
    $("quiz-score").textContent = `현재 점수: ${userQuizScore}점`;
    const expTitle = $("explanation-title"), expDesc = $("explanation-desc"), expEmoji = $("explanation-emoji"), expBox = $("explanation-box-color");
    if (isCorrect) {
      expEmoji.textContent = "🎉";
      expTitle.textContent = "정답입니다! 훌륭한 실력이에요.";
      expTitle.className = "text-xs font-extrabold text-emerald-800";
      expBox.className = "p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-start gap-2.5";
    } else {
      expEmoji.textContent = "💡";
      expTitle.textContent = "아쉽네요! 자원순환 규칙을 배워봐요.";
      expTitle.className = "text-xs font-extrabold text-rose-800";
      expBox.className = "p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 flex items-start gap-2.5";
    }
    expDesc.textContent = data.explanation;
    $("quiz-buttons").classList.add("hidden");
    $("quiz-explanation-panel").classList.remove("hidden");
    startAutoAdvance();
  }

  function nextQuiz() {
    currentQuizIndex += 1;
    if (currentQuizIndex < currentQuizSet.length) { showCurrentQuizQuestion(); return; }
    $("quiz-box").classList.add("hidden");
    $("quiz-result-summary").classList.remove("hidden");
    const correctCount = Math.round(userQuizScore / 10);
    const rank = DATA.quizRank(correctCount);
    $("quiz-result-score-text").textContent = `${currentQuizSet.length}문제 중 ${correctCount}개 정답 · ${userQuizScore}점`;
    $("quiz-result-title").textContent = `${rank.emoji} ${rank.title}`;
    $("quiz-result-message").textContent = rank.message;
  }

  // -----------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------
  function restoreLocal() {
    try {
      const savedStats = localStorage.getItem(STATS_KEY);
      if (savedStats) { practiceStats = JSON.parse(savedStats); }
    } catch {}
    try {
      const savedHold = localStorage.getItem(HOLD_KEY);
      if (savedHold) { holdBoxList = JSON.parse(savedHold); }
    } catch {}
    updateStatsUI();
    updateHoldUI();
  }

  function init() {
    document.querySelectorAll("[data-tab-btn]").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tabBtn)));

    renderQuickSelectGrid();
    initSearchAutocomplete();
    initSearchEmojiIcon();
    initPhotoCapture();
    restoreLocal();
    initClassContextForm();
    initSignupForm();
    loadClassRanking();
    $("classRankingRefreshBtn")?.addEventListener("click", loadClassRanking);
    renderQuizRankLadder();
    startQuiz();
    syncTabHeights();
    document.fonts?.ready?.then(syncTabHeights).catch(() => {});
    // Belt-and-suspenders: the Pretendard webfont can swap in and reflow text
    // (changing which line a sentence wraps to) slightly after fonts.ready
    // resolves in some browsers, which can leave one tab a few px off. Cheap
    // to re-run, so just catch it a couple more times shortly after load.
    setTimeout(syncTabHeights, 400);
    setTimeout(syncTabHeights, 1200);
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncTabHeights, 200);
    });

    $("searchInput").addEventListener("keyup", handleSearch);
    $("searchTriggerBtn").addEventListener("click", triggerSearch);
    $("holdQuickBtn").addEventListener("click", () => renderResult("hold"));
    $("judgeModalClose").addEventListener("click", closeJudgeModal);
    $("judgeModal").addEventListener("click", event => { if (event.target === $("judgeModal")) closeJudgeModal(); });
    $("btnLogPractice").addEventListener("click", () => logPractice(activeResultItem));
    $("registerHoldBtn").addEventListener("click", () => {
      const value = $("holdItemName").value.trim();
      if (!value) { showVisualAlert("⚠️ 보류함에 올릴 물건의 이름을 적어 주세요.", "amber"); return; }
      addHoldItem(value);
      $("holdItemName").value = "";
      $("hold-registration-form").classList.add("hidden");
    });
    $("addHoldDirectBtn").addEventListener("click", () => {
      const input = $("directHoldInput");
      const value = input.value.trim();
      if (!value) { showVisualAlert("⚠️ 안건 이름을 입력해 주세요.", "amber"); return; }
      addHoldItem(value);
      input.value = "";
    });
    $("resetStatsBtn").addEventListener("click", () => {
      openCustomModal("실천 타임라인 비우기", "지금까지 쌓은 실천 횟수와 감축 이력이 사라집니다. 정말 초기화할까요?", "🗑️", "bg-rose-500 hover:bg-rose-600", () => {
        practiceStats = { totalCount: 0, carbonReduction: 0, logs: [] };
        try { localStorage.removeItem(STATS_KEY); } catch {}
        updateStatsUI();
        showVisualAlert("🗑️ 실천 내역이 초기화되었습니다.", "slate");
      });
    });
    $("resetHoldBtn").addEventListener("click", () => {
      openCustomModal("보류함 목록 초기화", "보류함에 등록된 모든 대기 목록을 비우시겠습니까?", "🗑️", "bg-rose-500 hover:bg-rose-600", () => {
        holdBoxList = [];
        try { localStorage.removeItem(HOLD_KEY); } catch {}
        updateHoldUI();
        showVisualAlert("🗑️ 보류함이 비워졌습니다.", "slate");
      });
    });
    $("modalCancelBtn").addEventListener("click", closeCustomModal);
    $("modalConfirmBtn").addEventListener("click", () => { modalActionCallback?.(); closeCustomModal(); });
    document.querySelectorAll("[data-quiz-answer]").forEach(btn => btn.addEventListener("click", () => submitQuizAnswer(btn.dataset.quizAnswer === "true")));
    $("nextQuizBtn").addEventListener("click", () => { clearAutoAdvance(); nextQuiz(); });
    $("restartQuizBtn").addEventListener("click", startQuiz);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  // #appRoot is display:none until the auth gate reveals it, so the
  // scrollHeight-based measurement above runs against a hidden (0-height)
  // tree at DOMContentLoaded time. authGate.js calls this after it actually
  // un-hides #appRoot, when heights are real.
  window.AIWaysMobileApp = { syncTabHeights: () => syncTabHeights() };
})();
