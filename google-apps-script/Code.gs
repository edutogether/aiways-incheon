/**
 * AI Ways Incheon — 판단 기록 수집 스크립트
 *
 * 시트 구성 (전부 자동으로 생성됨):
 *   더미데이터   행사 전 대시보드가 비어 보이지 않도록 하는 기본 수치.
 *                Bumm님이 직접 숫자를 고치거나, 행 전체를 지워도 됩니다.
 *   EDU+WEEK    박람회/행사 기간 QR 방문 기록 전용. 실제 방문객이 사진을 찍으면 여기 쌓입니다.
 *   판단기록     그 외 일반 사용 기록(향후 실제 학급 사용 시). EDU+WEEK와 섞이지 않습니다.
 *   반별요약     EDU+WEEK를 반/물건 기준으로 자동 집계한 표. 시트를 열면 바로 보입니다.
 *
 * 대시보드가 읽어가는 action=list / action=summary 는 "더미데이터 + EDU+WEEK"를
 * 합쳐서 돌려줍니다 — app.js가 원래 기본 수치(TSV) 위에 실제 기록을 얹어서
 * 세는 구조를 그대로 재사용하는 것입니다.
 *
 * 개인정보: 학생 이름·이메일·IP·기기 정보는 절대 저장하지 않습니다.
 * "세션ID"는 브라우저 저장소에서 만드는 익명 랜덤값이며 실제 신원과 연결되지 않습니다.
 * 사진 파일이나 base64 이미지는 어떤 경우에도 저장하지 않습니다.
 *
 * 처음 한 번만 할 일: Apps Script 편집기 상단의 함수 선택 드롭다운에서
 * "seedDummyData" 를 고르고 ▶ 실행 버튼을 누르세요. "더미데이터" 시트가
 * 자동으로 만들어지고 기본 수치가 채워집니다. 나중에 그 시트 값을 자유롭게
 * 고치거나, 행사 끝나고 필요 없어지면 시트를 통째로 지워도 안전합니다
 * (없으면 그냥 기본 수치 없이 실시간 기록만 보여줍니다).
 */

const SPREADSHEET_ID = "";
const DUMMY_SHEET_NAME = "더미데이터";
const EXPO_SHEET_NAME = "EDU+WEEK";
const LOG_SHEET_NAME = "판단기록";
const SUMMARY_SHEET_NAME = "반별요약";
const EXPO_CHANNEL_TAG = "expo_kiosk";

// 이 웹앱은 인증 없는 공개 엔드포인트다 - URL이 app.js에 그대로 노출되므로
// 진짜 비밀은 아니지만, 이 토큰이 없는 요청(자동화된 무작위 스팸 등)은
// 최소한 걸러낸다. app.js가 보내는 값과 반드시 같아야 한다.
const SHARED_SUBMIT_TOKEN = "aiways-2026-expo-9f3c";

// 내부 필드명(app.js가 실제로 보내는 키) → 시트에 표시될 한글 헤더.
// 순서가 곧 시트의 열 순서입니다. 더미데이터/EDU+WEEK/판단기록 모두 같은 구조를 씁니다.
const FIELDS = [
  { key: "date", label: "날짜" },
  { key: "weekday", label: "요일" },
  { key: "time", label: "시각" },
  { key: "school", label: "학교" },
  { key: "grade", label: "학년" },
  { key: "class_name", label: "반" },
  { key: "group_id", label: "모둠" },
  { key: "privacy_id", label: "세션ID(익명)" },
  { key: "input_type", label: "입력방식" },
  { key: "ai_engine", label: "AI엔진" },
  { key: "ai_raw_label", label: "AI인식결과" },
  { key: "ai_confidence", label: "AI신뢰도" },
  { key: "mapped_item", label: "물건분류(기본수치 키)" },
  { key: "suggested_category", label: "AI제안분류" },
  { key: "final_decision", label: "최종판단(기본수치 값)" },
  { key: "action", label: "처리유형" },
  { key: "hold_flag", label: "판단보류" },
  { key: "image_saved", label: "사진저장여부" },
  { key: "app_version", label: "앱버전" },
  { key: "timestamp", label: "원본타임스탬프" }
];

const HEADER_ROW = FIELDS.map(function (field) { return field.label; });

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    if (payload.shared_token !== SHARED_SUBMIT_TOKEN) {
      return json_({ ok: false, error: "unauthorized" });
    }
    const targetSheetName = payload.event_channel === EXPO_CHANNEL_TAG ? EXPO_SHEET_NAME : LOG_SHEET_NAME;
    appendLog_(targetSheetName, payload);
    if (targetSheetName === EXPO_SHEET_NAME) rebuildSummary_();
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doGet(e) {
  const callback = e && e.parameter ? e.parameter.callback : "";
  const action = (e && e.parameter && e.parameter.action) || "list";
  const token = (e && e.parameter && e.parameter.token) || "";
  try {
    if (token !== SHARED_SUBMIT_TOKEN) {
      return json_({ ok: false, error: "unauthorized", rows: [], summary: null }, callback);
    }
    if (action === "summary") {
      return json_({ ok: true, summary: readSummary_() }, callback);
    }
    // 대시보드가 쓰는 기본 조회: 더미데이터(기본 수치) + EDU+WEEK(실제 방문 기록)를 합쳐서 반환.
    const rows = readSheetRows_(DUMMY_SHEET_NAME).concat(readSheetRows_(EXPO_SHEET_NAME));
    return json_({ ok: true, rows: rows }, callback);
  } catch (error) {
    return json_({ ok: false, rows: [], summary: null, error: String(error && error.message ? error.message : error) }, callback);
  }
}

function spreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function namedSheet_(name) {
  const spreadsheet = spreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER_ROW);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setFontWeight("bold");
    return;
  }
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADER_ROW.length)).getValues()[0];
  const matches = HEADER_ROW.every(function (label, index) { return current[index] === label; });
  if (!matches) sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
}

function parsePayload_(e) {
  const contents = e && e.postData ? e.postData.contents : "";
  if (contents) {
    try { return JSON.parse(contents); } catch (error) { return (e && e.parameter) || {}; }
  }
  return (e && e.parameter) || {};
}

function appendLog_(sheetName, payload) {
  const sheet = namedSheet_(sheetName);
  const now = new Date();
  const source = String(payload.timestamp || "");
  const instant = source && !isNaN(Date.parse(source)) ? new Date(source) : now;

  const normalized = {
    date: payload.date || Utilities.formatDate(instant, "Asia/Seoul", "yyyy-MM-dd"),
    weekday: payload.weekday || ["일", "월", "화", "수", "목", "금", "토"][instant.getDay()],
    time: Utilities.formatDate(instant, "Asia/Seoul", "HH:mm:ss"),
    school: payload.school || "AIWays초",
    grade: payload.grade || "",
    class_name: payload.class_name || payload.className || "",
    group_id: payload.group_id || "",
    privacy_id: payload.privacy_id || "",
    input_type: payload.input_type || payload.source || "",
    ai_engine: payload.ai_engine || "",
    ai_raw_label: payload.ai_raw_label || "",
    ai_confidence: payload.ai_confidence || "",
    mapped_item: payload.mapped_item || payload.itemName || "",
    suggested_category: payload.suggested_category || "",
    final_decision: payload.final_decision || payload.finalLabel || "",
    action: payload.action || payload.decision || "",
    // 반드시 진짜 boolean으로 유지 — app.js의 normalizeRecords()가 이 값을 직접
    // 읽어 판단보류/완료를 구분합니다. "예"/"아니오" 문자열로 바꾸면 안 됩니다.
    hold_flag: payload.hold_flag === true || String(payload.hold_flag).toLowerCase() === "true",
    image_saved: "아니오",
    app_version: payload.app_version || "",
    timestamp: source || instant.toISOString()
  };

  sheet.appendRow(FIELDS.map(function (field) { return normalized[field.key]; }));
  // 날짜/시각 칸은 반드시 일반 텍스트로 고정 — 안 그러면 구글 시트가
  // "yyyy-MM-dd"/"HH:mm:ss" 패턴을 실제 날짜로 자동 인식해버려서,
  // API로 다시 읽을 때 엉뚱한 옛날 타임스탬프로 깨져 나옵니다.
  const rowIndex = sheet.getLastRow();
  const dateColumn = FIELDS.findIndex(function (f) { return f.key === "date"; }) + 1;
  const timeColumn = FIELDS.findIndex(function (f) { return f.key === "time"; }) + 1;
  sheet.getRange(rowIndex, dateColumn).setNumberFormat("@");
  sheet.getRange(rowIndex, timeColumn).setNumberFormat("@");
}

function readSheetRows_(sheetName) {
  const spreadsheet = spreadsheet_();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, FIELDS.length).getValues();
  return values.map(function (row) {
    return FIELDS.reduce(function (record, field, index) {
      record[field.key] = row[index];
      return record;
    }, {});
  });
}

/**
 * EDU+WEEK(실제 방문 기록)만 반/물건 기준으로 집계해 "반별요약" 시트에 다시 쓴다.
 * 더미데이터는 집계에 포함하지 않는다 — 이 표는 "오늘 실제로 몇 명이 참여했는지"를
 * 보여주기 위한 것이라, 기본 수치가 섞이면 의미가 없어진다.
 */
function rebuildSummary_() {
  const rows = readSheetRows_(EXPO_SHEET_NAME);
  const today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  const byClass = {};
  const itemCounts = {};

  rows.forEach(function (row) {
    const classKey = [row.grade, row.class_name].filter(Boolean).join(" ") || "미지정";
    if (!byClass[classKey]) byClass[classKey] = { class: classKey, observedToday: 0, held: 0, completed: 0 };
    const bucket = byClass[classKey];
    if (row.date === today) bucket.observedToday += 1;
    if (row.hold_flag === true) bucket.held += 1; else bucket.completed += 1;

    if (row.mapped_item) itemCounts[row.mapped_item] = (itemCounts[row.mapped_item] || 0) + 1;
  });

  const classSummary = Object.values(byClass).sort(function (a, b) { return b.observedToday - a.observedToday; });
  const topItems = Object.entries(itemCounts)
    .map(function (entry) { return { item: entry[0], count: entry[1] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 5);

  writeSummarySheet_(classSummary, topItems);
  return { classSummary: classSummary, topItems: topItems, updatedAt: new Date().toISOString() };
}

function writeSummarySheet_(classSummary, topItems) {
  const spreadsheet = spreadsheet_();
  let sheet = spreadsheet.getSheetByName(SUMMARY_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SUMMARY_SHEET_NAME);
  sheet.clear();

  sheet.getRange(1, 1, 1, 4).setValues([["반", "오늘 관찰", "판단 보류", "완료"]]).setFontWeight("bold");
  if (classSummary.length) {
    sheet.getRange(2, 1, classSummary.length, 4).setValues(
      classSummary.map(function (row) { return [row.class, row.observedToday, row.held, row.completed]; })
    );
  }

  const itemStartRow = classSummary.length + 3;
  sheet.getRange(itemStartRow, 1, 1, 2).setValues([["헷갈린 물건 TOP 5", "건수"]]).setFontWeight("bold");
  if (topItems.length) {
    sheet.getRange(itemStartRow + 1, 1, topItems.length, 2).setValues(
      topItems.map(function (row) { return [row.item, row.count]; })
    );
  }

  sheet.autoResizeColumns(1, 4);
  sheet.setFrozenRows(1);
}

function readSummary_() {
  return rebuildSummary_();
}

/**
 * 처음 한 번만 수동 실행. "더미데이터" 시트를 만들고 행사 전 기본 수치를 채운다.
 * 이미 값이 있으면 건드리지 않는다(중복 실행 안전).
 * 다시 실행해서 초기화하고 싶으면 시트에서 2행부터 전부 지우고 실행하면 된다.
 */
function seedDummyData() {
  const sheet = namedSheet_(DUMMY_SHEET_NAME);
  if (sheet.getLastRow() > 1) return; // 이미 채워져 있으면 아무것도 안 함

  const base = { school: "AIWays초", input_type: "base", ai_engine: "seed", suggested_category: "base", action: "seed", app_version: "clean-2026-07", privacy_id: "base-seed", group_id: "seed" };
  const schoolWide = { schoolObserved: 887, schoolClasses: 14, schoolHold: 130 };
  const landfillByWeekday = { "월": 22800, "화": 18900, "수": 20600, "목": 17200, "금": 21900, "토": 18100, "일": 16400 };
  const classData = {
    "3학년 1반": { today: 13, weekly: 72, hold: 8, converted: 25, correct: 56, recycle: 31, reuse: 7, contamination: 6 },
    "3학년 2반": { today: 11, weekly: 64, hold: 9, converted: 21, correct: 48, recycle: 27, reuse: 6, contamination: 8 },
    "3학년 3반": { today: 15, weekly: 78, hold: 7, converted: 28, correct: 62, recycle: 35, reuse: 8, contamination: 5 },
    "4학년 1반": { today: 14, weekly: 74, hold: 8, converted: 27, correct: 58, recycle: 32, reuse: 8, contamination: 6 },
    "4학년 2반": { today: 17, weekly: 88, hold: 9, converted: 34, correct: 70, recycle: 40, reuse: 10, contamination: 6 },
    "4학년 3반": { today: 12, weekly: 67, hold: 10, converted: 22, correct: 50, recycle: 29, reuse: 5, contamination: 9 },
    "4학년 4반": { today: 22, weekly: 116, hold: 6, converted: 44, correct: 92, recycle: 54, reuse: 15, contamination: 4 },
    "5학년 1반": { today: 24, weekly: 128, hold: 4, converted: 52, correct: 104, recycle: 62, reuse: 18, contamination: 3 },
    "5학년 2반": { today: 21, weekly: 103, hold: 8, converted: 41, correct: 84, recycle: 48, reuse: 13, contamination: 5 },
    "5학년 3반": { today: 19, weekly: 97, hold: 10, converted: 37, correct: 76, recycle: 44, reuse: 11, contamination: 7 },
    "5학년 4반": { today: 14, weekly: 78, hold: 14, converted: 24, correct: 55, recycle: 30, reuse: 6, contamination: 11 },
    "6학년 1반": { today: 29, weekly: 142, hold: 3, converted: 60, correct: 118, recycle: 72, reuse: 20, contamination: 2 },
    "6학년 2반": { today: 20, weekly: 101, hold: 9, converted: 40, correct: 82, recycle: 49, reuse: 12, contamination: 6 },
    "6학년 3반": { today: 18, weekly: 95, hold: 11, converted: 34, correct: 74, recycle: 43, reuse: 10, contamination: 8 }
  };

  const today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date().getDay()];
  const rows = [];

  function pushRow(grade, className, key, value) {
    const normalized = Object.assign({}, base, {
      date: today, weekday: weekday, time: "00:00:00",
      grade: grade || "", class_name: className || "",
      mapped_item: key, final_decision: String(value), hold_flag: false, timestamp: new Date().toISOString()
    });
    rows.push(FIELDS.map(function (field) { return normalized[field.key]; }));
  }

  Object.entries(schoolWide).forEach(function (entry) { pushRow("", "", entry[0], entry[1]); });
  Object.entries(landfillByWeekday).forEach(function (entry) { pushRow("", "", "landfill:" + entry[0], entry[1]); });
  Object.entries(classData).forEach(function (entry) {
    const className = entry[0];
    const grade = className.split(" ")[0];
    Object.entries(entry[1]).forEach(function (metric) { pushRow(grade, className.split(" ")[1], "class:" + className + ":" + metric[0], metric[1]); });
  });

  sheet.getRange(2, 1, rows.length, FIELDS.length).setValues(rows);
  const dateColumn = FIELDS.findIndex(function (f) { return f.key === "date"; }) + 1;
  const timeColumn = FIELDS.findIndex(function (f) { return f.key === "time"; }) + 1;
  sheet.getRange(2, dateColumn, rows.length, 1).setNumberFormat("@");
  sheet.getRange(2, timeColumn, rows.length, 1).setNumberFormat("@");
}

function json_(obj, callback) {
  const text = callback ? String(callback) + "(" + JSON.stringify(obj) + ");" : JSON.stringify(obj);
  // JSONP(callback 있음) 응답은 반드시 JAVASCRIPT MIME 타입으로 보내야 한다.
  // TEXT(=text/html)로 보내면 구글이 함께 붙이는 X-Content-Type-Options: nosniff
  // 헤더 때문에 브라우저가 <script src>로 실행하길 거부해서(onerror), 실제
  // 웹사이트에서는 항상 조용히 실패하고 curl/fetch로 볼 때만 정상으로 보인다.
  return ContentService
    .createTextOutput(text)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
