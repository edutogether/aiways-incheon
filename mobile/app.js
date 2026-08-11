"use strict";
(() => {
  const DATA = window.AIWaysMobileData;
  const STATS_KEY = "aiways_mobile_stats_v1";
  const HOLD_KEY = "aiways_mobile_hold_v1";

  let practiceStats = { totalCount: 0, carbonReduction: 0, logs: [] };
  let holdBoxList = [];
  let activeResultItem = null;
  let currentQuizSet = [];
  let currentQuizIndex = 0;
  let userQuizScore = 0;

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
      setTimeout(() => { icon.textContent = emoji; icon.style.opacity = "1"; }, 90);
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
      rotationTimer = setInterval(() => showIcon(nextRandomEmoji()), 650);
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
  const TEXT_SCAN_MIN_MS = 900;

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
      div.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="bg-blue-50 text-blue-600 font-extrabold px-1.5 py-0.5 rounded text-[9px] shrink-0">${log.category}</span>
          <span class="font-bold text-slate-700 truncate max-w-[150px] sm:max-w-xs">${log.name}</span>
        </div>
        <div class="text-right shrink-0">
          <span class="font-extrabold text-emerald-600 block">-${log.carbon}g CO₂</span>
          <span class="text-[9px] text-slate-400 block">${log.time}</span>
        </div>`;
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
      div.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 mr-2">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
          <span class="font-extrabold text-slate-800 truncate">${item.name}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">${item.date}</span>
          <button type="button" class="resolve-hold-btn bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl font-bold text-[10px] transition-colors">해결 완료</button>
        </div>`;
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
