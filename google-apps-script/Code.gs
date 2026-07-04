const SPREADSHEET_ID = "";
const SHEET_NAME = "logs";

const HEADERS = [
  "timestamp",
  "date",
  "weekday",
  "school",
  "grade",
  "className",
  "itemName",
  "predictedLabel",
  "finalLabel",
  "confidence",
  "decision",
  "source",
  "imageName",
  "note",
  "input_type",
  "hold_flag",
  "image_saved"
];

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    appendLog_(payload);
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doGet(e) {
  try {
    const rows = getLogs_();
    const callback = e && e.parameter ? e.parameter.callback : "";
    return json_({ ok: true, rows: rows }, callback);
  } catch (error) {
    const callback = e && e.parameter ? e.parameter.callback : "";
    return json_({ ok: false, rows: [], error: String(error && error.message ? error.message : error) }, callback);
  }
}

function spreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_() {
  const spreadsheet = spreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }

  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
  const hasAllHeaders = HEADERS.every(function(header, index) {
    return current[index] === header;
  });

  if (!hasAllHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function parsePayload_(e) {
  const contents = e && e.postData ? e.postData.contents : "";
  if (contents) {
    try {
      return JSON.parse(contents);
    } catch (error) {
      return (e && e.parameter) || {};
    }
  }
  return (e && e.parameter) || {};
}

function appendLog_(payload) {
  const sheet = sheet_();
  const now = new Date();
  const date = payload.date || Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd");
  const weekday = payload.weekday || ["일", "월", "화", "수", "목", "금", "토"][now.getDay()];
  const normalized = {
    timestamp: payload.timestamp || now.toISOString(),
    date: date,
    weekday: weekday,
    school: payload.school || "AIWays초",
    grade: payload.grade || "",
    className: payload.className || payload.class_name || "",
    itemName: payload.itemName || payload.mapped_item || payload.item || "",
    predictedLabel: payload.predictedLabel || payload.ai_raw_label || payload.suggested_category || "",
    finalLabel: payload.finalLabel || payload.final_decision || "",
    confidence: payload.confidence || payload.ai_confidence || "",
    decision: payload.decision || payload.action || "",
    source: payload.source || payload.input_type || "miniapp",
    imageName: payload.imageName || "",
    note: payload.note || "",
    input_type: payload.input_type || payload.source || "image",
    hold_flag: payload.hold_flag === true || String(payload.hold_flag).toLowerCase() === "true",
    image_saved: false
  };

  sheet.appendRow(HEADERS.map(function(header) {
    return normalized[header] === undefined ? "" : normalized[header];
  }));
}

function getLogs_() {
  const sheet = sheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values.map(function(row) {
    return HEADERS.reduce(function(record, header, index) {
      record[header] = row[index];
      return record;
    }, {});
  });
}

function json_(obj, callback) {
  const text = callback ? String(callback) + "(" + JSON.stringify(obj) + ");" : JSON.stringify(obj);
  return ContentService
    .createTextOutput(text)
    .setMimeType(callback ? ContentService.MimeType.TEXT : ContentService.MimeType.JSON);
}
