(() => {
  "use strict";

  const SHEETS_URL = "https://script.google.com/macros/s/AKfycbxU_zhG_U6pIz_hnEkzxJFX-19nyDPdzUe-PwmNzIORxJ5x8t7HoSuC4d8QwchoqHgcZg/exec";
  const STORAGE_RECORDS = "aiways_clean_records";
  const STORAGE_PENDING = "aiways_clean_pending_records";
  const STORAGE_PRIVACY = "aiways_clean_privacy_id";

  const baseDashboard = {
    schoolObserved: 115,
    schoolClasses: 4,
    schoolHold: 9,
    todayObserved: 24,
    aiClassified: 3,
    humanConfirmed: 20,
    holdCount: 0
  };

  const fallbackRecords = [
    { input_type: "base", mapped_item: "school-baseline", suggested_category: "base", final_decision: "base", hold_flag: false, image_saved: false }
  ];

  const classProfiles = {
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
  let previewUrl = "";

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

  function applyDashboard(records) {
    const { base, actual } = splitRecords(records.length ? records : allStoredRecords());
    const baseImage = base.filter(record => record.input_type === "base");
    const imageRecords = actual.filter(record => record.input_type === "image");
    const holdRecords = actual.filter(record => record.hold_flag || cleanText(record.final_decision).includes("보류"));
    const className = selectedClassName();
    const profile = classProfiles[className] || classProfiles["5학년 1반"];
    const classActual = actual.filter(record => {
      const label = [record.grade, record.class_name].filter(Boolean).join(" ");
      return !label || label === className;
    });

    const observed = baseDashboard.schoolObserved + actual.length;
    const today = profile.today + classActual.length;
    const classHold = profile.hold + classActual.filter(record => record.hold_flag || cleanText(record.final_decision).includes("보류")).length;
    const classified = classHold;
    const confirmed = profile.converted + classActual.filter(record => !record.hold_flag).length;
    const hold = baseDashboard.schoolHold + holdRecords.length;

    setText("[data-school-observed]", observed.toLocaleString("ko-KR"));
    setText("[data-school-classes]", baseDashboard.schoolClasses.toLocaleString("ko-KR"));
    setText("[data-school-hold]", hold.toLocaleString("ko-KR"));
    setText("[data-today-observed]", today.toLocaleString("ko-KR"));
    setText("[data-ai-classified]", classified.toLocaleString("ko-KR"));
    setText("[data-human-confirmed]", confirmed.toLocaleString("ko-KR"));
    setText("[data-real-count]", actual.length.toLocaleString("ko-KR"));
    setText("[data-hold-count]", holdRecords.length.toLocaleString("ko-KR"));
    setText("[data-pending-count]", readJson(STORAGE_PENDING, []).length.toLocaleString("ko-KR"));

    if (baseImage.length) {
      document.body.dataset.hasSheetBase = "true";
    }

    const classBadge = $(".class-panel .panel-head > span");
    if (classBadge) classBadge.textContent = className;
    const rankNote = $(".rank-note");
    if (rankNote) rankNote.textContent = profile.rank + " · DEMO RANKING";
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

  function initNavigation() {
    const links = $$(".main-nav a");
    const sections = $$(".scene[data-nav]");

    function activate(section) {
      const label = section.dataset.nav;
      sections.forEach(item => item.classList.toggle("is-active", item === section));
      links.forEach(link => {
        const active = cleanText(link.textContent) === label;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    }

    if (!sections.length) return;
    activate(sections[0]);

    links.forEach(link => {
      link.addEventListener("click", event => {
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("#")) return;
        const section = document.getElementById(href.slice(1));
        if (!section) return;
        event.preventDefault();
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        history.pushState(null, "", href);
        activate(section);
      });
    });

    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.7)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) activate(visible.target);
    }, {
      threshold: [0.68, 0.7, 0.75],
      rootMargin: "-18% 0px -18% 0px"
    });

    sections.forEach(section => observer.observe(section));

    if (window.location.hash) {
      const section = document.getElementById(window.location.hash.slice(1));
      if (section) {
        requestAnimationFrame(() => {
          section.scrollIntoView({ block: "start" });
          activate(section);
        });
      }
    }
  }

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
      const draft = chooseDraftFromLabel(value, 0.82);
      showDraftModal({
        input_type: "search",
        ai_engine: "mapping-rule",
        ai_raw_label: value,
        ai_confidence: "0.82",
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

    return { ...quickItems.paper, confidence: 0.86 };
  }

  function openModal() {
    const modal = $("#aiModal");
    if (!modal) return;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function closeModal() {
    const modal = $("#aiModal");
    if (!modal) return;
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }

  function setSaveState(message) {
    const state = $("#saveState");
    if (state) state.textContent = message;
  }

  function showDraftModal(draftRecord, guidance) {
    currentDraft = draftRecord;
    const image = $("#modalPreview");
    if (image && draftRecord.input_type !== "image") image.removeAttribute("src");

    $("#draftTitle").textContent = draftRecord.mapped_item + "로 보입니다";
    $("#draftDesc").textContent = guidance || "AI raw label을 수업용 mapping rule로 연결한 1차 제안입니다. 최종 판단은 학생이 확정합니다.";
    $("#draftItem").textContent = draftRecord.mapped_item;
    $("#draftCategory").textContent = draftRecord.suggested_category;
    $("#draftConfidence").textContent = Math.round(Number(draftRecord.ai_confidence || 0) * 100) + "%";
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
    openModal();

    image.onload = async () => {
      const draft = await classifyImage(image);
      currentDraft = {
        input_type: "image",
        ai_engine: window.mobilenet ? "mobilenet" : "fallback",
        ai_raw_label: draft.item,
        ai_confidence: Number(draft.confidence || 0).toFixed(2),
        mapped_item: draft.item,
        suggested_category: draft.category,
        final_decision: draft.category,
        hold_flag: false
      };

      showDraftModal(currentDraft, draft.guidance);
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

  function initGallery() {
    const detail = $("#galleryDetail");
    if (!detail) return;

    $$("[data-gallery]").forEach(card => {
      card.addEventListener("click", () => {
        const title = card.dataset.gallery;
        detail.querySelector("strong").textContent = title;
        detail.querySelector("p").textContent = title + " 사진 업로드 예정 슬롯";
      });
    });
  }

  function initSelectors() {
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
      button.addEventListener("click", async () => {
        if (!currentDraft) return;
        const finalCategory = button.dataset.finalCategory;
        const isHold = finalCategory === "판단 보류";
        setSaveState(isHold ? "판단 보류 저장 중입니다..." : "학생 최종 판단 저장 중입니다...");
        const saved = await appendRecord({
          ...currentDraft,
          hold_flag: isHold,
          final_decision: finalCategory,
          suggested_category: currentDraft.suggested_category
        });
        setSaveState(saved ? "Google Sheets로 전송했습니다." : "네트워크 문제로 localStorage에 임시 저장했습니다.");
      });
    });

    $("#aiModal")?.addEventListener("close", () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
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
    applyDashboard(allStoredRecords());
    loadRemoteRecords();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

// CLEAN_EMERGENCY_NAV_FIX_START
(() => {
  if (window.__AIWAYS_CLEAN_EMERGENCY_NAV_FIX__) return;
  window.__AIWAYS_CLEAN_EMERGENCY_NAV_FIX__ = true;

  const NAV = [
    ["대시보드", "dashboard"],
    ["프로젝트", "project"],
    ["교육과정", "curriculum"],
    ["H-A-H", "hah"],
    ["차시흐름", "flow"],
    ["갤러리", "gallery"],
    ["3초판단", "sorting"],
    ["자료실", "resources"]
  ];

  const normalize = value => (value || "").replace(/\s+/g, " ").trim();

  function sectionFor(id) {
    return (
      document.getElementById(id) ||
      document.querySelector(`section[data-section="${id}"]`) ||
      document.querySelector(`.${id}-section`)
    );
  }

  function headerHeight() {
    const header =
      document.querySelector("header") ||
      document.querySelector(".site-header") ||
      document.querySelector(".clean-header") ||
      document.querySelector(".topbar") ||
      document.querySelector(".navbar");

    return header ? Math.ceil(header.getBoundingClientRect().height) : 72;
  }

  function navItems() {
    const labels = NAV.map(([label]) => label);

    return Array.from(document.querySelectorAll("header a, header button, nav a, nav button, header [data-nav], nav [data-nav], [data-target]"))
      .filter(el => !el.matches("section, .scene, .clean-section, .page-section"))
      .filter(el => {
        const text = normalize(el.textContent);
        const target = normalize(el.dataset.nav || el.dataset.target || "");
        const href = el.getAttribute("href") || "";

        return (
          labels.includes(text) ||
          NAV.some(([label, id]) => target === label || target === id || href === `#${id}`)
        );
      });
  }

  function labelOfItem(el) {
    const text = normalize(el.textContent);
    const dataset = normalize(el.dataset.nav || el.dataset.target || "");
    const href = el.getAttribute("href") || "";

    for (const [label, id] of NAV) {
      if (text === label || dataset === label || dataset === id || href === `#${id}`) {
        return label;
      }
    }

    return "";
  }

  function setActive(id) {
    const label = NAV.find(([, sectionId]) => sectionId === id)?.[0];

    navItems().forEach(item => {
      const isActive = labelOfItem(item) === label;

      item.classList.toggle("is-active", isActive);
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-current", isActive ? "page" : "false");
    });

    document.querySelectorAll("section, .clean-section, .page-section").forEach(section => {
      const sectionId = section.id || section.dataset.section || "";
      section.classList.toggle("is-active-section", sectionId === id);
    });
  }

  function scrollToSection(id) {
    const section = sectionFor(id);
    if (!section) return;

    section.scrollIntoView({ behavior: "smooth", block: "start" });
    history.pushState(null, "", `#${id}`);
    setActive(id);
  }

  function bindNav() {
    navItems().forEach(item => {
      if (item.dataset.cleanNavBound === "1") return;

      const label = labelOfItem(item);
      const id = NAV.find(([navLabel]) => navLabel === label)?.[1];

      if (!id) return;

      item.dataset.cleanNavBound = "1";
      item.dataset.nav = label;

      if (item.tagName.toLowerCase() === "a") {
        item.setAttribute("href", `#${id}`);
      }

      item.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        scrollToSection(id);
      }, true);
    });
  }

  function installObserver() {
    if (window.__AIWAYS_CLEAN_ACTIVE_OBSERVER__) {
      try {
        window.__AIWAYS_CLEAN_ACTIVE_OBSERVER__.disconnect();
      } catch (error) {}
    }

    const sections = NAV
      .map(([, id]) => sectionFor(id))
      .filter(Boolean);

    if (!sections.length) return;

    let currentId = "";

    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      const id = visible.target.id || visible.target.dataset.section || "";

      if (id && id !== currentId) {
        currentId = id;
        setActive(id);
      }
    }, {
      threshold: [0.68, 0.72, 0.76],
      rootMargin: "-18% 0px -34% 0px"
    });

    sections.forEach(section => observer.observe(section));
    window.__AIWAYS_CLEAN_ACTIVE_OBSERVER__ = observer;

    const closest = sections
      .map(section => {
        const rect = section.getBoundingClientRect();
        return {
          section,
          distance: Math.abs(rect.top - headerHeight())
        };
      })
      .sort((a, b) => a.distance - b.distance)[0];

    if (closest) {
      setActive(closest.section.id || closest.section.dataset.section || "");
    }
  }

  function hideHahBottomLine() {
    const hah = sectionFor("hah");
    if (!hah) return;

    const candidates = Array.from(hah.querySelectorAll("p, small, span, div"))
      .filter(el => {
        if (!normalize(el.textContent)) return false;
        if (el.children.length > 0) return false;
        if (el.closest("button, a, nav")) return false;

        const rect = el.getBoundingClientRect();
        const hahRect = hah.getBoundingClientRect();

        return (
          rect.height > 0 &&
          rect.height <= 34 &&
          rect.top > hahRect.top + hahRect.height * 0.82
        );
      })
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);

    if (candidates[0]) {
      candidates[0].classList.add("clean-hide-bottom-line");
    }
  }

  function boot() {
    bindNav();
    installObserver();
    hideHahBottomLine();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("load", boot, { once: true });
  window.addEventListener("resize", () => {
    window.clearTimeout(window.__AIWAYS_CLEAN_NAV_FIX_RESIZE__);
    window.__AIWAYS_CLEAN_NAV_FIX_RESIZE__ = window.setTimeout(boot, 160);
  }, { passive: true });
})();
// CLEAN_EMERGENCY_NAV_FIX_END
