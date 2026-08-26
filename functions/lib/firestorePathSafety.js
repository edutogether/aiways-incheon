"use strict";

// schoolId/grade/classNum end up as Firestore document path segments
// (schools/{schoolId}, schools/{schoolId}/classes/{grade}_{classNum}).
// cleanText() alone only blocks <>/control characters, not "/", so a client
// could smuggle extra path segments into a request and land the write at an
// unrelated document -- or, worse, get that bad value permanently cached as
// this device's dashboardSchoolId (schoolDashboard.js), locking it out of
// ever loading its real school again. Every accept point for these three
// fields must run through here instead of a bare cleanText().
const SCHOOL_ID = /^\d{1,12}$/;
const NO_PATH_CHARS = /^[^/\x00-\x1f]{1,10}$/;

function cleanSchoolId(value) {
  return typeof value === "string" && SCHOOL_ID.test(value) ? value : "";
}
function cleanPathSegment(value, max = 10) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max && NO_PATH_CHARS.test(trimmed) ? trimmed : "";
}

module.exports = { cleanSchoolId, cleanPathSegment };
