(() => {
  "use strict";

  const DATA_CONFIG = {
    appsScriptUrl: "",
    seedUrl: "./base-data-seed.tsv",
    currentSchool: "AIWays초",
    currentGrade: "5학년",
    currentClassName: "5학년 1반"
  };

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
    "3학년 1반": { today: 94, hold: 6, converted: 18, correct: 78, recycle: 43, reuse: 15, contamination: 7 },
    "3학년 2반": { today: 88, hold: 5, converted: 17, correct: 73, recycle: 39, reuse: 14, contamination: 6 },
    "3학년 3반": { today: 102, hold: 7, converted: 21, correct: 84, recycle: 48, reuse: 16, contamination: 8 },
    "4학년 1반": { today: 97, hold: 5, converted: 19, correct: 81, recycle: 45, reuse: 15, contamination: 7 },
    "4학년 2반": { today: 108, hold: 6, converted: 22, correct: 91, recycle: 52, reuse: 18, contamination: 7 },
    "4학년 3반": { today: 91, hold: 7, converted: 16, correct: 75, recycle: 40, reuse: 13, contamination: 9 },
    "4학년 4반": { today: 116, hold: 5, converted: 23, correct: 99, recycle: 56, reuse: 19, contamination: 6 },
    "5학년 1반": { today: 128, hold: 18, converted: 63, correct: 106, recycle: 63, reuse: 22, contamination: 7 },
    "5학년 2반": { today: 301, hold: 24, converted: 148, correct: 251, recycle: 148, reuse: 51, contamination: 19 },
    "5학년 3반": { today: 284, hold: 29, converted: 137, correct: 235, recycle: 137, reuse: 46, contamination: 20 },
    "5학년 4반": { today: 267, hold: 34, converted: 129, correct: 218, recycle: 129, reuse: 41, contamination: 23 },
    "6학년 1반": { today: 346, hold: 26, converted: 169, correct: 292, recycle: 169, reuse: 64, contamination: 15 },
    "6학년 2반": { today: 332, hold: 28, converted: 160, correct: 276, recycle: 160, reuse: 61, contamination: 17 },
    "6학년 3반": { today: 318, hold: 27, converted: 153, correct: 262, recycle: 153, reuse: 58, contamination: 18 }
  };

  const BASE_LANDFILL_DAYS = [
    { date: "2026-07-01", weekday: "월", landfillTons: 19100 },
    { date: "2026-07-02", weekday: "화", landfillTons: 18760 },
    { date: "2026-07-03", weekday: "수", landfillTons: 18940 },
    { date: "2026-07-04", weekday: "목", landfillTons: 18300 },
    { date: "2026-07-05", weekday: "금", landfillTons: 18420 },
    { date: "2026-07-06", weekday: "토", landfillTons: 17880 },
    { date: "2026-07-07", weekday: "일", landfillTons: 17540 }
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
  let seedRecords = [];
  let remoteRecords = [];
  let latestRanking = [];

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
    const type = cleanText(record.input_type).toLowerCase();
    if (type) return type;
    if (record.totalScans !== undefined || record.landfillTons !== undefined) return "base";
    return "";
  }

  function normalizeGrade(value) {
    const text = cleanText(value);
    const match = text.match(/([1-6])\s*학?년?/);
    return match ? `${match[1]}학년` : DATA_CONFIG.currentGrade;
  }

  function normalizeClassOnly(value) {
    const text = cleanText(value);
    const dash = text.match(/[1-6]\s*[-반]\s*([1-9])\s*반?/);
    if (dash) return `${dash[1]}반`;
    const match = text.match(/([1-9])\s*반/);
    return match ? `${match[1]}반` : "1반";
  }

  function normalizeFullClassName(grade, className) {
    const classText = cleanText(className);
    const full = classText.match(/([1-6])\s*학년\s*([1-9])\s*반/);
    if (full) return `${full[1]}학년 ${full[2]}반`;

    const compact = classText.match(/([1-6])\s*[-반]\s*([1-9])\s*반?/);
    if (compact) return `${compact[1]}학년 ${compact[2]}반`;

    return `${normalizeGrade(grade)} ${normalizeClassOnly(classText)}`;
  }

  function toNumber(value, fallback = 0) {
    if (value === undefined || value === null || cleanText(value) === "") return fallback;
    const number = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeRecords(records) {
    return records
      .filter(record => record && typeof record === "object")
      .map(record => ({
        timestamp: record.timestamp || record.created_at || "",
        local_time: record.local_time || record.date || "",
        date: record.date || "",
        weekday: record.weekday || "",
        school: record.school || DATA_CONFIG.currentSchool,
        grade: record.grade ? normalizeGrade(record.grade) : "",
        class_name: (record.class_name || record.className) ? normalizeClassOnly(record.class_name || record.className) : "",
        input_type: classifyRecordType(record),
        final_decision: record.final_decision || record.finalLabel || record.action || "",
        hold_flag: String(record.hold_flag || "").toLowerCase() === "true" || record.hold_flag === true,
        mapped_item: record.mapped_item || record.itemName || record.item || "",
        suggested_category: record.suggested_category || record.predictedLabel || record.category || "",
        ai_raw_label: record.ai_raw_label || record.predictedLabel || "",
        ai_confidence: record.ai_confidence ?? record.confidence ?? "",
        image_saved: false,
        totalScans: toNumber(record.totalScans, NaN),
        correctScans: toNumber(record.correctScans, NaN),
        holdCount: toNumber(record.holdCount, NaN),
        recycleCount: toNumber(record.recycleCount, NaN),
        reuseCount: toNumber(record.reuseCount, NaN),
        contaminationCount: toNumber(record.contaminationCount, NaN),
        landfillTons: toNumber(record.landfillTons, NaN)
      }));
  }

  function selectedClassName() {
    const select = $("#classSelect");
    return select ? select.value : DATA_CONFIG.currentClassName;
  }

  function classParts(className) {
    const match = String(className || DATA_CONFIG.currentClassName).match(/(\d학년)\s*(\d반)/);
    return {
      grade: match ? match[1] : DATA_CONFIG.currentGrade,
      className: match ? match[2] : "1반"
    };
  }

  function parseTsv(text) {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const headers = (lines.shift() || "").split("\t").map(header => header.trim());
    if (!headers.length) return [];

    return lines.map(line => {
      const cells = line.split("\t");
      return headers.reduce((row, header, index) => {
        row[header] = cells[index] === undefined ? "" : cells[index];
        return row;
      }, {});
    });
  }

  async function loadSeedData() {
    try {
      const response = await fetch(DATA_CONFIG.seedUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("seed response " + response.status);
      const text = await response.text();
      seedRecords = normalizeRecords(parseTsv(text));
      return seedRecords;
    } catch {
      seedRecords = [];
      return [];
    }
  }

  function localRecords() {
    return normalizeRecords(readJson(STORAGE_RECORDS, []));
  }

  function baseRecordsForDashboard() {
    const remoteBase = remoteRecords.filter(record => record.input_type === "base");
    if (remoteBase.length) return remoteBase;
    if (seedRecords.length) return seedRecords.filter(record => record.input_type === "base");
    return [];
  }

  function actualRecordsForDashboard() {
    return normalizeRecords([
      ...remoteRecords.filter(record => record.input_type === "image" || record.input_type === "search"),
      ...localRecords()
    ]);
  }

  function allStoredRecords(extra = []) {
    return normalizeRecords([...baseRecordsForDashboard(), ...actualRecordsForDashboard(), ...extra]);
  }

  function splitRecords(records) {
    const normalized = normalizeRecords(records);
    return {
      base: normalized.filter(record => record.input_type === "base"),
      actual: normalized.filter(record => record.input_type === "image" || record.input_type === "search")
    };
  }

  function cloneBaseClasses() {
    return Object.fromEntries(
      Object.entries(BASE_CLASS_DATA).map(([name, data]) => [name, { ...data }])
    );
  }

  function setClassMetric(classes, className, field, value) {
    if (!className || !Number.isFinite(value)) return;
    if (!classes[className]) return;
    classes[className] = classes[className] || { today: 0, hold: 0, converted: 0, correct: 0, recycle: 0, reuse: 0, contamination: 0 };
    classes[className][field] = value;
  }

  function baseDataFromRecords(baseRecords) {
    const dashboard = { ...BASE_DASHBOARD };
    const classes = cloneBaseClasses();
    const landfillDays = [];

    baseRecords.forEach(record => {
      const key = cleanText(record.mapped_item || record.ai_raw_label);
      const valueText = cleanText(record.final_decision || record.suggested_category);
      const value = toNumber(valueText, NaN);

      if (Object.prototype.hasOwnProperty.call(dashboard, key) && Number.isFinite(value)) {
        dashboard[key] = value;
        return;
      }

      const classFromColumns = record.class_name
        ? normalizeFullClassName(record.grade || DATA_CONFIG.currentGrade, record.class_name)
        : "";
      if (classFromColumns && Number.isFinite(record.totalScans)) {
        setClassMetric(classes, classFromColumns, "today", record.totalScans);
        setClassMetric(classes, classFromColumns, "correct", record.correctScans);
        setClassMetric(classes, classFromColumns, "hold", record.holdCount);
        setClassMetric(classes, classFromColumns, "converted", record.recycleCount);
        setClassMetric(classes, classFromColumns, "recycle", record.recycleCount);
        setClassMetric(classes, classFromColumns, "reuse", record.reuseCount);
        setClassMetric(classes, classFromColumns, "contamination", record.contaminationCount);
      }

      if (Number.isFinite(record.landfillTons)) {
        landfillDays.push({
          date: record.date || record.timestamp || "",
          weekday: record.weekday || "",
          landfillTons: record.landfillTons
        });
      }

      const landfillMatch = key.match(/^landfill:(.+)$/);
      if (landfillMatch && Number.isFinite(value)) {
        landfillDays.push({ date: "", weekday: landfillMatch[1], landfillTons: value });
        return;
      }

      const classMatch = key.match(/^class:(.+):(today|hold|converted|correct|recycle|reuse|contamination)$/);
      if (!classMatch || !Number.isFinite(value)) return;

      const [, className, field] = classMatch;
      setClassMetric(classes, className, field, value);
    });

    return { dashboard, classes, landfillDays };
  }

  function mergeActualIntoClasses(classes, actualRecords) {
    const merged = Object.fromEntries(Object.entries(classes).map(([name, data]) => [name, { ...data }]));

    actualRecords.forEach(record => {
      const className = record.class_name ? normalizeFullClassName(record.grade || DATA_CONFIG.currentGrade, record.class_name) : selectedClassName();
      const profile = merged[className] || { today: 0, hold: 0, converted: 0, correct: 0, recycle: 0, reuse: 0, contamination: 0 };
      const decision = cleanText(record.final_decision || record.suggested_category);
      const isHold = record.hold_flag || decision.includes("보류");

      profile.today += 1;
      if (isHold) profile.hold += 1;
      else {
        profile.correct += 1;
        profile.converted += 1;
      }

      if (decision.includes("재사용")) profile.reuse += 1;
      else if (decision.includes("일반") || decision.includes("오염")) profile.contamination += 1;
      else if (decision) profile.recycle += 1;

      merged[className] = profile;
    });

    return merged;
  }

  function calculateClassScore(row) {
    return Math.round((
      toNumber(row.correct, row.converted || 0) * 2 +
      toNumber(row.recycle, 0) +
      toNumber(row.reuse, 0) * 2 +
      toNumber(row.hold, 0) * 0.5 -
      toNumber(row.contamination, 0) * 1.5
    ) * 10) / 10;
  }

  function buildClassRanking(classes) {
    return Object.entries(classes)
      .map(([name, row]) => {
        const { grade, className } = classParts(name);
        return {
          name,
          grade,
          classOnly: className,
          score: calculateClassScore(row),
          scans: toNumber(row.today, 0),
          correct: toNumber(row.correct, row.converted || 0),
          hold: toNumber(row.hold, 0),
          contamination: toNumber(row.contamination, 0)
        };
      })
      .filter(item => item.scans > 0)
      .sort((a, b) => b.score - a.score || b.scans - a.scans || a.name.localeCompare(b.name, "ko"))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  function getCurrentClassRank(ranking, currentClassName) {
    const { grade } = classParts(currentClassName);
    const totalRank = ranking.find(item => item.name === currentClassName) || ranking[0];
    const gradeEntries = ranking.filter(item => item.grade === grade);
    const gradeRank = Math.max(1, gradeEntries.findIndex(item => item.name === currentClassName) + 1);

    return {
      grade,
      gradeRank,
      gradeTotal: Math.max(gradeEntries.length, 1),
      totalRank: totalRank ? totalRank.rank : 1,
      total: Math.max(ranking.length, 1)
    };
  }

  function formatClassRanking(className, ranking) {
    const rank = getCurrentClassRank(ranking, className);
    return `RANKING 🥇 ${rank.grade} 중 ${rank.gradeRank}위 · 🏫 전체 ${rank.total}개 학급 중 ${rank.totalRank}위`;
  }

  function landfillDaysForChart(days) {
    const byDate = new Map();
    [...BASE_LANDFILL_DAYS, ...days].forEach(item => {
      const key = item.date || item.weekday;
      if (!key || !Number.isFinite(item.landfillTons)) return;
      byDate.set(key, {
        date: item.date || key,
        weekday: item.weekday || key,
        landfillTons: item.landfillTons
      });
    });
    return Array.from(byDate.values()).slice(-7);
  }

  function yForChart(value, min, max, top, baseline) {
    if (max <= min) return baseline;
    return top + ((max - value) / (max - min)) * (baseline - top);
  }

  function renderLandfillChart(days) {
    const svg = $(".combo-chart");
    if (!svg) return;

    const chartDays = landfillDaysForChart(days);
    const values = chartDays.map(day => day.landfillTons);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const top = 26;
    const baseline = 166;
    const xs = [61, 110, 159, 208, 257, 306, 355];
    const spread = Math.max(1200, max - min);
    const chartMin = min - spread * 0.12;
    const chartMax = max + spread * 0.12;
    const points = chartDays.map((day, index) => ({
      ...day,
      x: xs[index] || xs[xs.length - 1],
      y: yForChart(day.landfillTons, chartMin, chartMax, top, baseline)
    }));

    const linePath = points.map((point, index) => `${index ? "L" : "M"}${point.x} ${Math.round(point.y)}`).join(" ");
    const first = points[0];
    const last = points[points.length - 1];
    const areaPath = first && last ? `${linePath} L${last.x} ${baseline} L${first.x} ${baseline} Z` : "";
    const area = $(".chart-area", svg);
    const line = $(".chart-line", svg);
    const bars = $$(".chart-bars rect", svg);
    const labels = $$(".chart-axis .x-label", svg);

    if (area && areaPath) {
      area.setAttribute("d", areaPath);
      area.setAttribute("opacity", "0.16");
    }
    if (line && linePath) line.setAttribute("d", linePath);

    points.forEach((point, index) => {
      const bar = bars[index];
      if (bar) {
        const barY = Math.round(point.y);
        bar.setAttribute("y", String(barY));
        bar.setAttribute("height", String(Math.max(16, Math.round(baseline - point.y))));
      }

      const label = labels[index];
      if (label) label.textContent = point.weekday || ["월", "화", "수", "목", "금", "토", "일"][index];
    });

    const totalNode = $(".landfill-metrics strong");
    if (totalNode && last) totalNode.textContent = Math.round(last.landfillTons).toLocaleString("ko-KR") + "t";
  }

  function escapeHtml(value) {
    return cleanText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureRankingModal() {
    let modal = $("#rankingModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "rankingModal";
    modal.className = "ranking-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="ranking-dialog" role="dialog" aria-modal="true" aria-labelledby="rankingModalTitle">
        <button class="ranking-close" type="button" aria-label="랭킹 닫기">×</button>
        <p class="eyebrow">Class Resource Ranking</p>
        <h2 id="rankingModalTitle">우리 학급 자원순환 랭킹</h2>
        <p class="ranking-help">기록 데이터를 기준으로 실천 점수를 계산합니다.</p>
        <div class="ranking-table-wrap">
          <table class="ranking-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>학년</th>
                <th>학급</th>
                <th>실천점수</th>
                <th>판독</th>
                <th>정확</th>
                <th>보류</th>
                <th>오염</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function renderRankingModalRows(modal) {
    const tbody = $(".ranking-table tbody", modal);
    if (!tbody) return;
    const current = selectedClassName();
    const rows = latestRanking.length ? latestRanking : buildClassRanking(cloneBaseClasses());

    tbody.innerHTML = rows.map(item => `
      <tr class="${item.name === current ? "is-current" : ""}">
        <td>${item.rank}</td>
        <td>${escapeHtml(item.grade)}</td>
        <td>${escapeHtml(item.classOnly)}</td>
        <td>${item.score.toLocaleString("ko-KR")}</td>
        <td>${item.scans.toLocaleString("ko-KR")}</td>
        <td>${item.correct.toLocaleString("ko-KR")}</td>
        <td>${item.hold.toLocaleString("ko-KR")}</td>
        <td>${item.contamination.toLocaleString("ko-KR")}</td>
      </tr>
    `).join("");
  }

  function openRankingModal() {
    const modal = ensureRankingModal();
    renderRankingModalRows(modal);
    modal.hidden = false;
    document.body.classList.add("ranking-modal-open");
    requestAnimationFrame(() => modal.classList.add("is-open"));
    $(".ranking-close", modal)?.focus();
  }

  function closeRankingModal() {
    const modal = $("#rankingModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    document.body.classList.remove("ranking-modal-open");
    window.setTimeout(() => {
      modal.hidden = true;
    }, 160);
  }

  function applyDashboard(records) {
    const { base, actual } = splitRecords(records.length ? records : allStoredRecords());
    const { dashboard, classes, landfillDays } = baseDataFromRecords(base);
    const baseImage = base.filter(record => record.input_type === "base");
    const imageRecords = actual.filter(record => record.input_type === "image");
    const holdRecords = actual.filter(record => record.hold_flag || cleanText(record.final_decision).includes("보류"));
    const className = selectedClassName();
    const mergedClasses = mergeActualIntoClasses(classes, actual);
    const profile = mergedClasses[className] || mergedClasses[DATA_CONFIG.currentClassName];
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

    latestRanking = buildClassRanking(mergedClasses);

    const rankNote = $(".rank-note");
    if (rankNote) {
      rankNote.textContent = formatClassRanking(className, latestRanking);
      rankNote.setAttribute("role", "button");
      rankNote.setAttribute("tabindex", "0");
      rankNote.setAttribute("aria-label", "우리 학급 자원순환 랭킹 상세 보기");
    }
    renderLandfillChart(landfillDays);
    renderHoldList(holdRecords);
  }

  function loadRemoteRecords() {
    return new Promise(resolve => {
      if (!DATA_CONFIG.appsScriptUrl) {
        remoteRecords = [];
        applyDashboard(allStoredRecords());
        resolve([]);
        return;
      }

      const callbackName = "aiwaysCleanCallback_" + Date.now().toString(36);
      const script = document.createElement("script");
      let settled = false;

      window[callbackName] = data => {
        if (settled) return;
        settled = true;
        const records = Array.isArray(data) ? data : data.rows || data.records || data.data || [];
        const normalized = normalizeRecords(records);
        remoteRecords = normalized;
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
        remoteRecords = [];
        applyDashboard(allStoredRecords());
        cleanup();
        resolve([]);
      };

      script.src = DATA_CONFIG.appsScriptUrl + "?action=list&callback=" + encodeURIComponent(callbackName);
      document.body.appendChild(script);

      window.setTimeout(() => {
        if (settled) return;
        settled = true;
        remoteRecords = [];
        applyDashboard(allStoredRecords());
        cleanup();
        resolve([]);
      }, 6500);
    });
  }

  async function loadDashboardRows() {
    await loadSeedData();
    applyDashboard(allStoredRecords());
    await loadRemoteRecords();
    return allStoredRecords();
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
      if (DATA_CONFIG.appsScriptUrl) {
        await fetch(DATA_CONFIG.appsScriptUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(safeRecord)
        });
        return true;
      }
      return "local";
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
      await loadDashboardRows();
      window.setTimeout(() => {
        countUpNextDashboard = false;
        document.body.classList.remove("is-refreshing-dashboard");
      }, 680);
      refresh.classList.remove("is-loading");
      refresh.removeAttribute("aria-busy");
    });
  }

  function initRankingModal() {
    const note = $(".rank-note");
    if (!note) return;

    note.addEventListener("click", openRankingModal);
    note.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openRankingModal();
    });

    document.addEventListener("click", event => {
      const modal = $("#rankingModal");
      if (!modal || modal.hidden) return;
      if (event.target === modal || event.target.closest(".ranking-close")) closeRankingModal();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeRankingModal();
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
      setSaveState(saved === true ? "Google Sheets로 전송했습니다." : saved === "local" ? "localStorage에 판단 기록을 저장했습니다." : "네트워크 문제로 localStorage에 임시 저장했습니다.");
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
    initRankingModal();
    initLandfillSourceLink();
    applyDashboard(allStoredRecords());
    loadDashboardRows();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
