const SHEET_NAME = "records";

const HEADERS = [
  "timestamp",
  "local_time",
  "privacy_id",
  "school",
  "grade",
  "class_name",
  "group_id",
  "input_type",
  "ai_raw_label",
  "ai_confidence",
  "mapped_item",
  "suggested_category",
  "final_decision",
  "hold_flag",
  "hold_score",
  "hold_reason",
  "contamination_check",
  "action",
  "image_saved",
  "app_version"
];

function doPost(e) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  const body = JSON.parse(e.postData.contents || "{}");
  const row = HEADERS.map(function(key) {
    return body[key] === undefined ? "" : body[key];
  });

  sheet.appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService
    .createTextOutput("AIWays Incheon webhook is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}
