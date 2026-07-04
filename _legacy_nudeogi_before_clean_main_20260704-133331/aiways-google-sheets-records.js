(() => {
  const AIWAYS_SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbxU_zhG_U6pIz_hnEkzxJFX-19nyDPdzUe-PwmNzIORxJ5x8t7HoSuC4d8QwchoqHgcZg/exec";
  const AIWAYS_RECORD_COLUMNS = [
    "timestamp",
    "local_time",
    "school",
    "grade",
    "class_name",
    "group_id",
    "privacy_id",
    "input_type",
    "ai_engine",
    "ai_raw_label",
    "ai_confidence",
    "mapped_item",
    "suggested_category",
    "final_decision",
    "hold_flag",
    "hold_score",
    "action",
    "image_saved",
    "app_version"
  ];

  const SHEET_CACHE_KEY = "aiways_sheet_records";
  const SESSION_RECORD_KEY = "aiways_session_records";
  const LEGACY_RECORD_KEY = "aiways_records";
  const SENT_KEY = "aiways_sheet_sent_keys";
  const PRIVACY_KEY = "aiways_session_id";
  const GROUP_KEY = "aiways_group_id";
  const SELECTED_CLASS_KEY = "aiways_selected_class";

  let loadStarted = false;
  const sentThisPage = new Set();

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("AIWays ?? ?? ??:", key, error);
    }
  }

  function bool(value) {
    return value === true || value === "true" || value === "TRUE" || value === "Y" || value === "1";
  }

  function normalize(row) {
    const record = {};
    AIWAYS_RECORD_COLUMNS.forEach(key => {
      record[key] = row && row[key] !== undefined && row[key] !== null ? row[key] : "";
    });
    record.hold_flag = bool(record.hold_flag);
    record.image_saved = false;
    record.ai_confidence = record.ai_confidence === "" ? "" : Number(record.ai_confidence);
    record.hold_score = record.hold_score === "" ? "" : Number(record.hold_score);
    return record;
  }

  function recordKey(row) {
    const record = normalize(row);
    return [
      record.timestamp,
      record.privacy_id,
      record.grade,
      record.class_name,
      record.input_type,
      record.ai_raw_label,
      record.mapped_item,
      record.final_decision,
      record.action
    ].join("|");
  }

  function dedupe(records) {
    const map = new Map();
    records
      .map(normalize)
      .filter(row => row.timestamp || row.local_time || row.class_name || row.mapped_item || row.final_decision)
      .forEach(row => map.set(recordKey(row), row));
    return Array.from(map.values()).sort((a, b) => {
      const at = new Date(a.timestamp || a.local_time || 0).getTime();
      const bt = new Date(b.timestamp || b.local_time || 0).getTime();
      return bt - at;
    });
  }

  function sessionId() {
    let id = localStorage.getItem(PRIVACY_KEY);
    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(PRIVACY_KEY, id);
    }
    return id;
  }

  function gradeFromClass(name) {
    const match = String(name || "").match(/[3-6]??/);
    return match ? match[0] : "5??";
  }

  function selectedClass() {
    return localStorage.getItem(SELECTED_CLASS_KEY) || "5?? 1?";
  }

  function enrich(row) {
    const selected = selectedClass();
    const normalized = normalize(row);
    const now = new Date();
    normalized.timestamp = normalized.timestamp || now.toISOString();
    normalized.local_time = normalized.local_time || now.toLocaleString("ko-KR");
    normalized.school = normalized.school || "????";
    normalized.class_name = normalized.class_name || selected;
    normalized.grade = normalized.grade || gradeFromClass(normalized.class_name);
    normalized.group_id = normalized.group_id || localStorage.getItem(GROUP_KEY) || "";
    normalized.privacy_id = normalized.privacy_id || sessionId();
    normalized.input_type = normalized.input_type || "image";
    normalized.ai_engine = normalized.ai_engine || "MobileNet + ??? ???? ??";
    normalized.action = normalized.action || (normalized.hold_flag ? "?? ??? ??" : "?? ?? ??");
    normalized.app_version = "aiways-google-sheets-v1";
    normalized.image_saved = false;
    return normalized;
  }

  function payload(row) {
    const record = enrich(row);
    const data = {};
    AIWAYS_RECORD_COLUMNS.forEach(key => {
      data[key] = record[key] === undefined || record[key] === null ? "" : record[key];
    });
    data.image_saved = false;
    return data;
  }

  function mergeIntoLocal(records) {
    const merged = dedupe([
      ...records,
      ...readJson(LEGACY_RECORD_KEY, []),
      ...readJson(SESSION_RECORD_KEY, [])
    ]);
    writeJson(LEGACY_RECORD_KEY, merged);
    writeJson(SESSION_RECORD_KEY, merged);
    return merged;
  }

  function saveLocal(record) {
    mergeIntoLocal([record]);
  }

  function sentKeys() {
    return new Set(readJson(SENT_KEY, []));
  }

  function rememberSent(key) {
    const keys = sentKeys();
    keys.add(key);
    writeJson(SENT_KEY, Array.from(keys).slice(-500));
  }

  function sendRecord(record) {
    if (!AIWAYS_SHEET_ENDPOINT.includes("script.google.com")) return;
    const data = payload(record);
    const key = recordKey(data);
    const keys = sentKeys();
    if (keys.has(key) || sentThisPage.has(key)) return;
    sentThisPage.add(key);
    rememberSent(key);

    fetch(AIWAYS_SHEET_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(data)
    }).catch(error => {
      console.warn("Google Sheets ?? ??. localStorage?? ???? ????.", error);
    });
  }

  function latestRecord(finalChoice) {
    const records = dedupe([
      ...readJson(LEGACY_RECORD_KEY, []),
      ...readJson(SESSION_RECORD_KEY, [])
    ]);
    const now = Date.now();
    return records.find(row => {
      if (finalChoice && row.final_decision !== finalChoice) return false;
      const time = new Date(row.timestamp || row.local_time || 0).getTime();
      return !Number.isFinite(time) || Math.abs(now - time) < 120000;
    }) || records[0] || null;
  }

  function fallbackRecord(button) {
    const result = button.closest(".aiways-mf-result, .aiways-mf-card, section, article, div") || document;
    const finalChoice = button.dataset.mfFinal || button.textContent.trim();
    const selected = selectedClass();
    const item = result.querySelector("h3")?.textContent.trim() || "";
    const badges = Array.from(result.querySelectorAll(".aiways-mf-badge")).map(el => el.textContent.trim());
    const confidenceText = badges.find(text => text.includes("???")) || "";
    const confidence = Number((confidenceText.match(/\d+/) || [""])[0]);
    const category = badges.find(text => !text.includes("AI") && !text.includes("???")) || finalChoice;

    return {
      timestamp: new Date().toISOString(),
      local_time: new Date().toLocaleString("ko-KR"),
      school: "????",
      grade: gradeFromClass(selected),
      class_name: selected,
      group_id: localStorage.getItem(GROUP_KEY) || "",
      privacy_id: sessionId(),
      input_type: "image",
      ai_engine: "MobileNet + ??? ???? ??",
      ai_raw_label: "",
      ai_confidence: Number.isFinite(confidence) ? confidence : "",
      mapped_item: item,
      suggested_category: category,
      final_decision: finalChoice,
      hold_flag: finalChoice === "?? ??",
      hold_score: "",
      action: finalChoice === "?? ??" ? "?? ??? ??" : "?? ?? ??",
      image_saved: false,
      app_version: "aiways-google-sheets-v1"
    };
  }

  function handleFinalClick(button) {
    if (button.dataset.aiwaysSheetHandled === "1") return;
    button.dataset.aiwaysSheetHandled = "1";
    const finalChoice = button.dataset.mfFinal || button.textContent.trim();
    setTimeout(() => {
      const record = enrich(latestRecord(finalChoice) || fallbackRecord(button));
      saveLocal(record);
      sendRecord(record);
      window.dispatchEvent(new CustomEvent("aiways:record-saved", { detail: record }));
    }, 80);
  }

  function loadRecords(force = false) {
    if (loadStarted && !force) return;
    if (!AIWAYS_SHEET_ENDPOINT.includes("script.google.com")) return;
    loadStarted = true;
    const callbackName = "aiwaysRecordsCallback_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const separator = AIWAYS_SHEET_ENDPOINT.includes("?") ? "&" : "?";
    let finished = false;

    function cleanup() {
      script.remove();
      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }
    }

    window[callbackName] = data => {
      finished = true;
      if (data && data.ok && Array.isArray(data.rows)) {
        const rows = dedupe(data.rows);
        writeJson(SHEET_CACHE_KEY, rows);
        mergeIntoLocal(rows);
        window.dispatchEvent(new CustomEvent("aiways:records-loaded", { detail: rows }));
      }
      cleanup();
    };

    script.onerror = () => {
      finished = true;
      console.warn("Google Sheets ?? ???? ??. localStorage ???? ?? ?????.");
      cleanup();
    };

    script.src = AIWAYS_SHEET_ENDPOINT + separator + "callback=" + encodeURIComponent(callbackName) + "&t=" + Date.now();
    document.body.appendChild(script);

    setTimeout(() => {
      if (!finished) {
        console.warn("Google Sheets ?? ???? ?? ??. localStorage ???? ?? ?????.");
        cleanup();
      }
    }, 9000);
  }

  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-mf-final]");
    if (button) handleFinalClick(button);
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => loadRecords(), { once: true });
  } else {
    loadRecords();
  }

  window.aiwaysGoogleSheetsRecords = { loadRecords };
})();
