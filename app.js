(() => {
  "use strict";

  const SHEETS_URL = "https://script.google.com/macros/s/AKfycbxU_zhG_U6pIz_hnEkzxJFX-19nyDPdzUe-PwmNzIORxJ5x8t7HoSuC4d8QwchoqHgcZg/exec";
  const STORAGE_RECORDS = "aiways_clean_records";
  const STORAGE_PENDING = "aiways_clean_pending_records";
  const STORAGE_PRIVACY = "aiways_clean_privacy_id";

  const BASE_DASHBOARD = {
    schoolObserved: 115,
    schoolClasses: 4,
    schoolHold: 9,
    todayObserved: 24,
    aiClassified: 3,
    humanConfirmed: 20,
    holdCount: 0
  };

  const BASE_CLASS_DATA = {
    "3학년 1반": { today: 94, hold: 6, converted: 18, rank: "학년 내 2위 · 학교 내 8위" },
    "3학년 2반": { today: 88, hold: 5, converted: 17, rank: "학년 내 3위 · 학교 내 9위" },
    "3학년 3반": { today: 102, hold: 7, converted: 21, rank: "학년 내 1위 · 학교 내 7위" },
    "4학년 1반": { today: 97, hold: 5, converted: 19, rank: "학년 내 3위 · 학교 내 10위" },
    "4학년 2반": { today: 108, hold: 6, converted: 22, rank: "학년 내 2위 · 학교 내 6위" },
    "4학년 3반": { today: 91, hold: 7, converted: 16, rank: "학년 내 4위 · 학교 내 12위" },
    "4학년 4반": { today: 116, hold: 5, converted: 23, rank: "학년 내 1위 · 학교 내 5위" },
    "5학년 1반": { today: 24, hold: 3, converted: 20, rank: "3위 · 전체 14개 학급 중" },
    "5학년 2반": { today: 119, hold: 8, converted: 21, rank: "학년 내 3위 · 학교 내 4위" },
    "5학년 3반": { today: 126, hold: 6, converted: 25, rank: "학년 내 2위 · 학교 내 3위" },
    "5학년 4반": { today: 113, hold: 8, converted: 20, rank: "학년 내 4위 · 학교 내 7위" },
    "6학년 1반": { today: 121, hold: 6, converted: 23, rank: "학년 내 2위 · 학교 내 5위" },
    "6학년 2반": { today: 117, hold: 5, converted: 22, rank: "학년 내 3위 · 학교 내 6위" },
    "6학년 3반": { today: 132, hold: 7, converted: 27, rank: "학년 내 1위 · 학교 내 1위" }
  };

  const fallbackRecords = [
    { input_type: "base", mapped_item: "school-baseline", suggested_category: "base", final_decision: "base", hold_flag: false, image_saved: false }
  ];

  const quickItems = {
    paper: {
      item: "종이류",
      category: "종이류",
      guidance: "오염되지 않은 종이는 종이류로 분리배출할 수 있습니다. 물기, 음식물, 테이프, 코팅이 있으면 다시 확인합니다."
    },
    milk: {
      item: "우유갑",
      category: "종이팩",
      guidance: "내용물을 비우고 물로 헹군 뒤 펼쳐서 말려 배출합니다. 일반 종이와 섞지 않는 것이 좋습니다."
    },
    cup: {
      item: "플라스틱컵",
      category: "플라스틱류",
      guidance: "남은 음료를 비우고 빨대와 뚜껑을 분리한 뒤 학교 기준에 맞게 배출합니다."
    },
    snack: {
      item: "과자 봉지",
      category: "비닐류 또는 판단 보류",
      guidance: "내용물을 털어내고 오염이 적으면 비닐류로 배출합니다. 기름기와 양념이 많으면 보류 판단이 필요합니다."
    },
    ramen: {
      item: "라면용기",
      category: "일반쓰레기 검토",
      guidance: "국물 자국과 기름기가 남아 있으면 일반쓰레기로 검토합니다. 깨끗한 재질만 학교 기준에 따라 분리합니다."
    },
    can: {
      item: "캔류",
      category: "캔류",
      guidance: "내용물을 비우고 가능한 한 눌러서 캔류로 배출합니다. 이물질이 들어 있으면 먼저 제거합니다."
    },
    receipt: {
      item: "영수증",
      category: "일반쓰레기",
      guidance: "감열지 영수증은 특수 코팅이 되어 있어 일반쓰레기로 배출합니다."
    },
    vinyl: {
      item: "비닐",
      category: "비닐류",
      guidance: "오염이 적은 비닐은 비닐류로 분리합니다. 음식물이나 기름기가 많으면 판단 보류가 필요합니다."
    }
  };

  let modelPromise = null;
  let currentDraft = null;
  let pendingDecision = null;
  let previewUrl = "";
  let countUpNextDashboard = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function privacyId() {
    let id = localStorage.getItem(STORAGE_PRIVACY);
    if (!id) {
      id = "anon-" + Date.now().toString(36);
      localStorage.setItem(STORAGE_PRIVACY, id);
    }
    return id;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }

  // COMMON_FINAL_FIX_START
  function animateNumber(node, target) {
    const end = Number(target);
    if (!Number.isFinite(end)) {
      node.textContent = target;
      return;
    }

    const duration = 540;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = Math.round(end * eased).toLocaleString("ko-KR");
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function setDashboardNumber(selector, value) {
    const node = $(selector);
    if (!node) return;
    if (countUpNextDashboard) animateNumber(node, value);
    else node.textContent = Number(value).toLocaleString("ko-KR");
  }
  // COMMON_FINAL_FIX_END

  function renderHoldList(records) {
    const list = $("#holdList");
    if (!list) return;

    const holdRecords = records.filter(record => record.hold_flag || cleanText(record.final_decision).includes("보류"));
    if (!holdRecords.length) {
      list.innerHTML = "<li>아직 보류 기록이 없습니다.</li>";
      return;
    }

    list.innerHTML = holdRecords
      .slice(-6)
      .reverse()
      .map(record => `<li><strong>${record.mapped_item || "미확인 물건"}</strong><span>${record.suggested_category || "분류 검토"} · ${record.local_time || "임시 기록"}</span></li>`)
      .join("");
  }

  function classifyRecordType(record) {
    return cleanText(record.input_type).toLowerCase();
  }

  function normalizeRecords(records) {
    return records
      .filter(record => record && typeof record === "object")
      .map(record => ({
        timestamp: record.timestamp || record.created_at || "",
        local_time: record.local_time || "",
        grade: record.grade || "",
        class_name: record.class_name || "",
        input_type: classifyRecordType(record),
        final_decision: record.final_decision || record.action || "",
        hold_flag: String(record.hold_flag || "").toLowerCase() === "true" || record.hold_flag === true,
        mapped_item: record.mapped_item || record.item || "",
        suggested_category: record.suggested_category || record.category || "",
        image_saved: false
      }));
  }

  function selectedClassName() {
    const select = $("#classSelect");
    return select ? select.value : "5학년 1반";
  }

  function classParts(className) {
    const match = String(className || "5학년 1반").match(/(\d학년)\s*(\d반)/);
    return {
      grade: match ? match[1] : "5학년",
      className: match ? match[2] : "1반"
    };
  }

  function formatClassRanking(className, classes) {
    const { grade } = classParts(className);
    const classEntries = Object.entries(classes)
      .filter(([, data]) => data && Number.isFinite(Number(data.today)))
      .map(([name, data]) => ({ name, today: Number(data.today) }));
    const gradeEntries = classEntries
      .filter(item => item.name.startsWith(grade))
      .sort((a, b) => b.today - a.today || a.name.localeCompare(b.name, "ko"));
    const allEntries = [...classEntries].sort((a, b) => b.today - a.today || a.name.localeCompare(b.name, "ko"));

    const gradeRank = Math.max(1, gradeEntries.findIndex(item => item.name === className) + 1);
    const totalRank = Math.max(1, allEntries.findIndex(item => item.name === className) + 1);
    const allTotal = Math.max(allEntries.length, 1);

    return `RANKING 🥇 ${grade} 중 ${gradeRank}위 · 🥉 전체 ${allTotal}개 학급 중 ${totalRank}위`;
  }

  function localRecords() {
    return normalizeRecords(readJson(STORAGE_RECORDS, []));
  }

  function allStoredRecords(extra = []) {
    return normalizeRecords([...fallbackRecords, ...localRecords(), ...extra]);
  }

  function splitRecords(records) {
    const normalized = normalizeRecords(records);
    return {
      base: normalized.filter(record => record.input_type === "base"),
      actual: normalized.filter(record => record.input_type === "image" || record.input_type === "search")
    };
  }

  function baseDataFromRecords(baseRecords) {
    const dashboard = { ...BASE_DASHBOARD };
    const classes = Object.fromEntries(
      Object.entries(BASE_CLASS_DATA).map(([name, data]) => [name, { ...data }])
    );

    baseRecords.forEach(record => {
      const key = cleanText(record.mapped_item || record.ai_raw_label);
      const valueText = cleanText(record.final_decision || record.suggested_category);
      const value = Number(valueText);

      if (Object.prototype.hasOwnProperty.call(dashboard, key) && Number.isFinite(value)) {
        dashboard[key] = value;
        return;
      }

      const classMatch = key.match(/^class:(.+):(today|hold|converted|rank)$/);
      if (!classMatch) return;

      const [, className, field] = classMatch;
      classes[className] = classes[className] || { today: 0, hold: 0, converted: 0, rank: "" };
      classes[className][field] = field === "rank" ? valueText : Number.isFinite(value) ? value : classes[className][field];
    });

    return { dashboard, classes };
  }

  function applyDashboard(records) {
    const { base, actual } = splitRecords(records.length ? records : allStoredRecords());
    const { dashboard, classes } = baseDataFromRecords(base);
    const baseImage = base.filter(record => record.input_type === "base");
    const imageRecords = actual.filter(record => record.input_type === "image");
    const holdRecords = actual.filter(record => record.hold_flag || cleanText(record.final_decision).includes("보류"));
    const className = selectedClassName();
    const profile = classes[className] || classes["5학년 1반"];
    const classActual = actual.filter(record => {
      const label = [record.grade, record.class_name].filter(Boolean).join(" ");
      return !label || label === className;
    });

    const observed = dashboard.schoolObserved + actual.length;
    const today = profile.today + classActual.length;
    const classHold = profile.hold + classActual.filter(record => record.hold_flag || cleanText(record.final_decision).includes("보류")).length;
    const classified = classHold;
    const confirmed = profile.converted + classActual.filter(record => !record.hold_flag).length;
    const hold = dashboard.schoolHold + holdRecords.length;

    setDashboardNumber("[data-school-observed]", observed);
    setDashboardNumber("[data-school-classes]", dashboard.schoolClasses);
    setDashboardNumber("[data-school-hold]", hold);
    setDashboardNumber("[data-today-observed]", today);
    setDashboardNumber("[data-ai-classified]", classified);
    setDashboardNumber("[data-human-confirmed]", confirmed);
    setDashboardNumber("[data-real-count]", actual.length);
    setDashboardNumber("[data-hold-count]", holdRecords.length);
    setDashboardNumber("[data-pending-count]", readJson(STORAGE_PENDING, []).length);

    if (baseImage.length) {
      document.body.dataset.hasSheetBase = "true";
    }

    const rankNote = $(".rank-note");
    if (rankNote) rankNote.textContent = formatClassRanking(className, classes);
    renderHoldList(holdRecords);
  }

  function loadRemoteRecords() {
    return new Promise(resolve => {
      const callbackName = "aiwaysCleanCallback_" + Date.now().toString(36);
      const script = document.createElement("script");
      let settled = false;

      window[callbackName] = data => {
        if (settled) return;
        settled = true;
        const records = Array.isArray(data) ? data : data.records || data.data || [];
        const normalized = normalizeRecords(records);
        writeJson(STORAGE_RECORDS, normalized);
        applyDashboard(allStoredRecords());
        cleanup();
        resolve(normalized);
      };

      function cleanup() {
        delete window[callbackName];
        script.remove();
      }

      script.onerror = () => {
        if (settled) return;
        settled = true;
        applyDashboard(allStoredRecords());
        cleanup();
        resolve([]);
      };

      script.src = SHEETS_URL + "?action=list&callback=" + encodeURIComponent(callbackName);
      document.body.appendChild(script);

      window.setTimeout(() => {
        if (settled) return;
        settled = true;
        applyDashboard(allStoredRecords());
        cleanup();
        resolve([]);
      }, 6500);
    });
  }

  async function appendRecord(record) {
    const parts = classParts(selectedClassName());
    const safeRecord = {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      school: "우리학교",
      grade: parts.grade,
      class_name: parts.className,
      group_id: "",
      privacy_id: privacyId(),
      input_type: record.input_type,
      ai_engine: record.ai_engine,
      ai_raw_label: record.ai_raw_label,
      ai_confidence: record.ai_confidence,
      mapped_item: record.mapped_item,
      suggested_category: record.suggested_category,
      final_decision: record.final_decision,
      hold_flag: record.hold_flag,
      hold_score: record.hold_flag ? 1 : 0,
      action: record.hold_flag ? "hold" : "confirm",
      image_saved: false,
      app_version: "clean-2026-07"
    };

    const nextRecords = localRecords();
    nextRecords.push(safeRecord);
    writeJson(STORAGE_RECORDS, nextRecords);
    applyDashboard(allStoredRecords());

    try {
      await fetch(SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(safeRecord)
      });
      return true;
    } catch {
      const pending = readJson(STORAGE_PENDING, []);
      pending.push(safeRecord);
      writeJson(STORAGE_PENDING, pending);
      applyDashboard(allStoredRecords());
      return false;
    }
  }

  // COMMON_FINAL_FIX_START
  function initNavigation() {
    if (window.__AIWAYS_CLEAN_PAGE_FIX_NAV__) return;
    window.__AIWAYS_CLEAN_PAGE_FIX_NAV__ = true;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    const navPairs = [
      ["대시보드", "dashboard"],
      ["프로젝트", "project"],
      ["교육과정", "curriculum"],
      ["H-A-H", "hah"],
      ["차시흐름", "flow"],
      ["갤러리", "gallery"],
      ["3초판단", "sorting"],
      ["자료실", "resources"]
    ];
    const labels = new Set(navPairs.map(pair => pair[0]));
    const links = $$(".main-nav a").filter(link => labels.has(cleanText(link.textContent)));
    const sections = navPairs.map(([, id]) => document.getElementById(id)).filter(Boolean);
    let currentId = "";
    let snapLocked = false;
    let scrollTicking = false;

    function activate(section) {
      if (!section) return;
      const id = section.id;
      const label = navPairs.find(([, sectionId]) => sectionId === id)?.[0] || section.dataset.nav;
      currentId = id;

      sections.forEach(item => item.classList.toggle("is-active", item === section));
      links.forEach(link => {
        const active = cleanText(link.textContent) === label;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    }

    function nearestSection() {
      const center = window.innerHeight / 2;
      return sections
        .map(section => ({ section, distance: Math.abs(section.getBoundingClientRect().top + section.getBoundingClientRect().height / 2 - center) }))
        .sort((a, b) => a.distance - b.distance)[0]?.section || sections[0];
    }

    function activateByScroll() {
      activate(nearestSection());
      scrollTicking = false;
    }

    function resetToDashboard() {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      window.scrollTo(0, 0);
      activate(sections[0]);
    }

    function shouldSkipSnap(event) {
      return Boolean(event.target.closest("input, textarea, select, option, button, dialog, .ai-modal, [role='dialog']"));
    }

    function snapByWheel(event) {
      if (shouldSkipSnap(event) || Math.abs(event.deltaY) < 18 || snapLocked) return;
      const active = sections.find(section => section.id === currentId) || nearestSection();
      const currentIndex = Math.max(0, sections.indexOf(active));
      const nextIndex = Math.min(sections.length - 1, Math.max(0, currentIndex + (event.deltaY > 0 ? 1 : -1)));
      if (nextIndex === currentIndex) return;

      event.preventDefault();
      snapLocked = true;
      const target = sections[nextIndex];
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", "#" + target.id);
      activate(target);
      window.setTimeout(() => {
        snapLocked = false;
      }, 760);
    }

    if (!sections.length) return;

    links.forEach(link => {
      const label = cleanText(link.textContent);
      const id = navPairs.find(([navLabel]) => navLabel === label)?.[1];
      if (!id) return;
      link.setAttribute("href", "#" + id);
      link.addEventListener("click", event => {
        const section = document.getElementById(id);
        if (!section) return;
        event.preventDefault();
        history.replaceState(null, "", "#" + id);
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        activate(section);
      });
    });

    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.7)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible || visible.target.id === currentId) return;
      activate(visible.target);
    }, {
      threshold: [0.68, 0.7, 0.72, 0.75],
      rootMargin: "-24% 0px -24% 0px"
    });

    sections.forEach(section => observer.observe(section));

    window.addEventListener("scroll", () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(activateByScroll);
    }, { passive: true });

    window.addEventListener("wheel", snapByWheel, { passive: false });

    resetToDashboard();
    window.addEventListener("pageshow", () => requestAnimationFrame(resetToDashboard), { once: true });
    window.addEventListener("load", () => requestAnimationFrame(resetToDashboard), { once: true });
    requestAnimationFrame(resetToDashboard);
  }
  // COMMON_FINAL_FIX_END

  function initQuickButtons() {
    const buttons = $$("[data-quick-item]");
    const category = $("[data-quick-category]");
    const guidance = $("[data-quick-guidance]");

    buttons.forEach(button => {
      button.addEventListener("click", () => {
        const item = quickItems[button.dataset.quickItem] || quickItems.paper;
        buttons.forEach(target => target.classList.toggle("is-active", target === button));
        if (category) category.textContent = "AI 1차 제안: " + item.category;
        if (guidance) guidance.textContent = item.guidance;
      });
    });

    $("#searchButton")?.addEventListener("click", () => {
      const value = cleanText($("#searchInput")?.value);
      if (!value) return;
      const draft = chooseDraftFromLabel(value, null);
      showDraftModal({
        input_type: "search",
        ai_engine: "mapping-rule",
        ai_raw_label: value,
        ai_confidence: "",
        mapped_item: draft.item,
        suggested_category: draft.category,
        final_decision: draft.category,
        hold_flag: false
      }, draft.guidance);
    });
  }

  function chooseDraftFromLabel(label, confidence) {
    const normalized = cleanText(label).toLowerCase();

    if (normalized.includes("carton") || normalized.includes("milk")) return { ...quickItems.milk, confidence };
    if (normalized.includes("cup") || normalized.includes("plastic") || normalized.includes("bottle")) return { ...quickItems.cup, confidence };
    if (normalized.includes("bag") || normalized.includes("packet") || normalized.includes("wrapper")) return { ...quickItems.snack, confidence };
    if (normalized.includes("ramen") || normalized.includes("noodle") || normalized.includes("라면")) return { ...quickItems.ramen, confidence };
    if (normalized.includes("can") || normalized.includes("캔")) return { ...quickItems.can, confidence };
    if (normalized.includes("receipt") || normalized.includes("영수증")) return { ...quickItems.receipt, confidence };
    if (normalized.includes("vinyl") || normalized.includes("비닐")) return { ...quickItems.vinyl, confidence };
    return { ...quickItems.paper, confidence };
  }

  async function loadTeachableMachineModel(modelUrl) {
    if (!modelUrl || !window.tmImage) return null;
    const baseUrl = modelUrl.endsWith("/") ? modelUrl : modelUrl + "/";
    return window.tmImage.load(baseUrl + "model.json", baseUrl + "metadata.json");
  }

  async function classifyImage(image) {
    if (!modelPromise && window.mobilenet) {
      modelPromise = window.mobilenet.load();
    }

    if (modelPromise) {
      try {
        const model = await modelPromise;
        const result = await model.classify(image);
        const top = result && result[0] ? result[0] : null;
        if (top) return chooseDraftFromLabel(top.className, top.probability);
      } catch {
        modelPromise = null;
      }
    }

    return { ...quickItems.paper, confidence: null, ruleBased: true };
  }

  function openModal() {
    const modal = $("#aiModal");
    if (!modal) return;
    document.body.classList.add("modal-open");
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function closeModal() {
    const modal = $("#aiModal");
    if (!modal) return;
    if (typeof modal.close === "function") modal.close();
    else {
      modal.removeAttribute("open");
      document.body.classList.remove("modal-open");
      setScanning(false);
    }
  }

  function setSaveState(message) {
    const state = $("#saveState");
    if (state) state.textContent = message;
  }

  function setDecisionConfirm(visible, category = "") {
    const box = $("#decisionConfirm");
    const text = $("#pendingDecisionText");
    if (!box) return;
    box.hidden = !visible;
    if (text) text.textContent = category ? `${category} 판단을 저장할까요?` : "선택한 판단을 저장할까요?";
  }

  function setScanning(active) {
    const modal = $("#aiModal");
    if (modal) modal.classList.toggle("is-scanning", Boolean(active));
  }

  function formatConfidence(draftRecord) {
    const confidence = Number(draftRecord.ai_confidence);
    if (draftRecord.ai_engine === "mobilenet" && Number.isFinite(confidence) && confidence > 0) {
      return Math.round(confidence * 100) + "%";
    }
    return draftRecord.input_type === "search" ? "규칙 기반 제안" : "참고 제안";
  }

  function showDraftModal(draftRecord, guidance) {
    currentDraft = draftRecord;
    setScanning(false);
    const image = $("#modalPreview");
    if (image && draftRecord.input_type !== "image") image.removeAttribute("src");

    $("#draftTitle").textContent = draftRecord.mapped_item + "로 보입니다";
    $("#draftDesc").textContent = guidance || "AI raw label을 수업용 mapping rule로 연결한 1차 제안입니다. 최종 판단은 학생이 확정합니다.";
    $("#draftItem").textContent = draftRecord.mapped_item;
    $("#draftCategory").textContent = draftRecord.suggested_category;
    $("#draftConfidence").textContent = formatConfidence(draftRecord);
    pendingDecision = null;
    setDecisionConfirm(false);
    setSaveState("");
    openModal();
  }

  async function handleImage(file) {
    if (!file || !file.type.startsWith("image/")) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);

    const image = $("#modalPreview");
    if (!image) return;

    image.src = previewUrl;
    currentDraft = {
      input_type: "image",
      ai_engine: window.mobilenet ? "mobilenet" : "fallback",
      ai_raw_label: "pending",
      ai_confidence: 0,
      mapped_item: "분석 중",
      suggested_category: "분석 중",
      final_decision: "",
      hold_flag: false
    };

    $("#draftTitle").textContent = "AI가 분류를 제안하고 있습니다";
    $("#draftDesc").textContent = "학생이 최종 판단을 누르기 전까지 기록은 저장되지 않습니다.";
    $("#draftItem").textContent = "분석 중";
    $("#draftCategory").textContent = "분석 중";
    $("#draftConfidence").textContent = "-";
    setSaveState("");
    setScanning(true);
    openModal();

    image.onload = async () => {
      const draft = await classifyImage(image);
      currentDraft = {
        input_type: "image",
        ai_engine: draft.ruleBased ? "fallback-rule" : "mobilenet",
        ai_raw_label: draft.item,
        ai_confidence: draft.ruleBased ? "" : Number(draft.confidence || 0).toFixed(4),
        mapped_item: draft.item,
        suggested_category: draft.category,
        final_decision: draft.category,
        hold_flag: false
      };

      showDraftModal(currentDraft, draft.guidance);
    };

    image.onerror = () => {
      setScanning(false);
      setSaveState("사진을 불러오지 못했습니다. 다른 사진을 선택해 주세요.");
    };
  }

  function initTabs() {
    const tabs = $$("[data-tab]");
    const panels = $$("[data-panel]");

    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(item => item.classList.toggle("is-active", item === tab));
        panels.forEach(panel => panel.classList.toggle("is-active", panel.dataset.panel === tab.dataset.tab));
      });
    });

    $("[data-quiz-answer]")?.addEventListener("click", () => {
      const result = $("#quizResult");
      if (result) result.textContent = "맞아요. 오염이 심하면 AI 제안보다 보류 판단이 먼저입니다.";
    });
  }

  // PAGE_FINAL_FIX_06_GALLERY_START
  function initGallery() {
    const stage = $("#galleryStage");
    const detail = $("#galleryDetail");
    const back = $("#galleryBack");
    const grid = $("#galleryDetailGrid", detail);
    if (!stage || !detail || !grid) return;

    const titleNode = $("#galleryDetailTitle", detail);
    const numberNode = $("#galleryDetailNumber", detail);
    const captionNode = $("#galleryDetailCaption", detail);
    const galleryItems = {
      "학생 VOC 활동지": {
        number: "01",
        caption: "학생들이 발견한 불편함을 실제 활동지 이미지로 확인합니다.",
        images: ["assets/gallery/01-1.png", "assets/gallery/01-2.png"]
      },
      "쓰레기매립지 알아보기": {
        number: "02",
        caption: "우리 지역의 쓰레기 흐름과 매립지 문제를 탐구한 기록입니다.",
        images: ["assets/gallery/02-1.png", "assets/gallery/02-2.png"]
      },
      "아이디어 확장하기": {
        number: "03",
        caption: "AI와 함께 확장한 자원순환 UX 아이디어 산출물입니다.",
        images: ["assets/gallery/03-1.jpg", "assets/gallery/03-2.jpg"]
      },
      "딜레마 토론": {
        number: "04",
        caption: "AI 제안을 사람이 다시 판단한 토론 기록입니다.",
        images: ["assets/gallery/04-1.jpg", "assets/gallery/04-2.jpg"]
      },
      "블록코딩": {
        number: "05",
        caption: "AI 이미지 분류 원리를 블록코딩으로 이해한 활동입니다.",
        images: ["assets/gallery/05-1.jpg", "assets/gallery/05-2.jpg"]
      },
      "이미지 모델 학습 자료": {
        number: "06",
        caption: "Teachable Machine을 위한 이미지 모델 학습 자료입니다.",
        images: ["assets/gallery/06-1.png", "assets/gallery/06-2.png"]
      },
      "3초판단 앱 프로토타입": {
        number: "07",
        caption: "학생 확인을 중심에 둔 3초판단 앱 프로토타입입니다.",
        images: ["assets/gallery/07-1.png", "assets/gallery/07-2.png"]
      },
      "H-A-H 토의하기": {
        number: "08",
        caption: "Human → AI → Human 흐름으로 판단을 조정한 토의 기록입니다.",
        images: ["assets/gallery/08-1.jpg", "assets/gallery/08-2.jpg"]
      }
    };

    function showMissingSlot() {
      return '<figure class="gallery-detail-photo is-missing"><span>이미지 준비 중</span></figure>';
    }

    function openDetail(card) {
      const title = card.dataset.gallery || cleanText(card.textContent) || "학생 산출물";
      const item = galleryItems[title] || {
        number: "--",
        caption: "이미지 준비 중",
        images: []
      };

      if (numberNode) numberNode.textContent = item.number;
      if (titleNode) titleNode.textContent = title;
      if (captionNode) captionNode.textContent = item.caption;
      grid.innerHTML = item.images.length
        ? item.images.map((src, index) => `
            <figure class="gallery-detail-photo">
              <img src="${src}" alt="${title} ${index + 1}" loading="lazy" />
              <figcaption>${item.number}-${index + 1}</figcaption>
            </figure>
          `).join("")
        : showMissingSlot() + showMissingSlot();

      $$("img", grid).forEach(img => {
        img.addEventListener("error", () => {
          const photo = img.closest(".gallery-detail-photo");
          if (!photo) return;
          photo.classList.add("is-missing");
          photo.innerHTML = "<span>이미지 준비 중</span>";
        }, { once: true });
      });

      stage.classList.add("is-detail");
    }

    stage.addEventListener("click", event => {
      const card = event.target.closest("[data-gallery]");
      if (!card || !stage.contains(card)) return;
      event.preventDefault();
      openDetail(card);
    });

    back?.addEventListener("click", () => {
      stage.classList.remove("is-detail");
      grid.innerHTML = "";
    });
  }
  // PAGE_FINAL_FIX_06_GALLERY_END

  // PAGE_FINAL_FIX_01_DASHBOARD_START
  function initRefreshControls() {
    const refresh = $("[data-refresh-records]");
    if (!refresh) return;

    refresh.addEventListener("click", async event => {
      event.stopPropagation();
      refresh.classList.add("is-loading");
      refresh.setAttribute("aria-busy", "true");
      countUpNextDashboard = true;
      document.body.classList.add("is-refreshing-dashboard");
      await loadRemoteRecords();
      window.setTimeout(() => {
        countUpNextDashboard = false;
        document.body.classList.remove("is-refreshing-dashboard");
      }, 680);
      refresh.classList.remove("is-loading");
      refresh.removeAttribute("aria-busy");
    });
  }

  function initLandfillSourceLink() {
    const panel = $(".landfill-panel[data-source-url]");
    if (!panel) return;

    panel.addEventListener("click", event => {
      if (event.target.closest("a, button, input, select, label")) return;
      const url = panel.dataset.sourceUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }
  // PAGE_FINAL_FIX_01_DASHBOARD_END

  function initSelectors() {
    const seenClasses = new Set();
    $$("#classSelect option").forEach(option => {
      const label = cleanText(option.textContent);
      if (seenClasses.has(label)) option.remove();
      else seenClasses.add(label);
    });
    $("#gradeSelect")?.addEventListener("change", () => applyDashboard(allStoredRecords()));
    $("#classSelect")?.addEventListener("change", () => applyDashboard(allStoredRecords()));
  }

  function initUpload() {
    const cameraInput = $("#cameraInput");
    const uploadInput = $("#uploadInput");

    $$("[data-upload]").forEach(button => {
      button.addEventListener("click", () => {
        if (button.dataset.upload === "camera") cameraInput?.click();
        else uploadInput?.click();
      });
    });

    [cameraInput, uploadInput].forEach(input => {
      input?.addEventListener("change", () => {
        const file = input.files && input.files[0];
        handleImage(file);
        input.value = "";
      });
    });

    $$("[data-final-category]").forEach(button => {
      button.addEventListener("click", () => {
        if (!currentDraft) return;
        const finalCategory = button.dataset.finalCategory;
        const isHold = finalCategory === "판단 보류";
        pendingDecision = {
          ...currentDraft,
          hold_flag: isHold,
          final_decision: finalCategory,
          suggested_category: currentDraft.suggested_category
        };
        $$("[data-final-category]").forEach(item => item.classList.toggle("is-selected", item === button));
        setDecisionConfirm(true, finalCategory);
        setSaveState("확인을 누르면 판단 기록만 저장됩니다.");
      });
    });

    $("#confirmDecision")?.addEventListener("click", async () => {
      if (!pendingDecision) return;
      setSaveState(pendingDecision.hold_flag ? "판단 보류 저장 중입니다..." : "학생 최종 판단 저장 중입니다...");
      const saved = await appendRecord(pendingDecision);
      pendingDecision = null;
      setDecisionConfirm(false);
      $$("[data-final-category]").forEach(item => item.classList.remove("is-selected"));
      setSaveState(saved ? "Google Sheets로 전송했습니다." : "네트워크 문제로 localStorage에 임시 저장했습니다.");
    });

    $("#cancelDecision")?.addEventListener("click", () => {
      pendingDecision = null;
      setDecisionConfirm(false);
      $$("[data-final-category]").forEach(item => item.classList.remove("is-selected"));
      setSaveState("저장하지 않았습니다. 다시 판단을 선택할 수 있습니다.");
    });

    $("#aiModal")?.addEventListener("close", () => {
      pendingDecision = null;
      setScanning(false);
      document.body.classList.remove("modal-open");
      setDecisionConfirm(false);
      $$("[data-final-category]").forEach(item => item.classList.remove("is-selected"));
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
    });

    $("#aiModal")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeModal();
    });

    $(".close-btn")?.addEventListener("click", closeModal);
  }

  function boot() {
    initNavigation();
    initQuickButtons();
    initTabs();
    initGallery();
    initSelectors();
    initUpload();
    initRefreshControls();
    initLandfillSourceLink();
    applyDashboard(allStoredRecords());
    loadRemoteRecords();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
