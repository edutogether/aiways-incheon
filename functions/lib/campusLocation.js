"use strict";

// Turns a raw GPS coordinate into a pass/fail "on campus?" flag and nothing
// else -- the coordinate itself is used only in memory for one distance
// calculation and is never written to Firestore or logged. What gets stored
// is a short-lived, single-use check id (actors/{actorId}/campusChecks/{id})
// that saveSortingRecord later consumes to attach onCampus to a record.
const { protectActorRequest } = require("./protectedActor");
const { cleanSchoolId } = require("./firestorePathSafety");
const { cleanText, applyCors } = require("./httpGuard");

const MAX_BODY_BYTES = 1 * 1024;
const CHECK_TTL_MS = 2 * 60 * 1000;

// Haversine distance in meters.
function distanceMeters(aLat, aLng, bLat, bLng) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a = sinLat * sinLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function createCheckCampusLocationHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  const now = dependencies.now || (() => new Date());
  return async (req, res) => {
    if (!applyCors(req, res)) return res.status(403).json({ ok: false, code: "invalid_origin" });
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ ok: false, code: "method_not_allowed" });

    const protectedActor = await protectActorRequest({ req, functionName: "checkCampusLocation", access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck, blockedActors: dependencies.blockedActors });
    if (!protectedActor.ok) {
      if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds));
      return res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) });
    }

    const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
    if (bodyBytes > MAX_BODY_BYTES) return res.status(413).json({ ok: false, code: "request_too_large" });

    const body = req.body || {};
    const allowed = new Set(["schoolId", "lat", "lng"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const schoolId = cleanSchoolId(body.schoolId);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!schoolId || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, code: "invalid_request" });
    }

    // 2026-09-01 종합감사(B그룹 3번): Firestore 읽기/쓰기에 try/catch가
    // 없어서 일시적 장애 시 classRanking.js 등에 이미 있는 503
    // protection_unavailable 컨벤션 대신 타임아웃까지 응답 없이 멈출 수
    // 있었다 - 같은 컨벤션 적용.
    try {
      const campusSnap = await db.collection("schoolCampuses").doc(schoolId).get();
      let onCampus = false;
      if (campusSnap.exists) {
        const campus = campusSnap.data() || {};
        const campusLat = Number(campus.lat), campusLng = Number(campus.lng), radius = Number(campus.radiusMeters);
        if (Number.isFinite(campusLat) && Number.isFinite(campusLng) && Number.isFinite(radius) && radius > 0) {
          onCampus = distanceMeters(lat, lng, campusLat, campusLng) <= radius;
        }
      }
      // lat/lng go out of scope here -- nothing below this line ever sees them again.

      const checkRef = db.collection("actors").doc(protectedActor.actorId).collection("campusChecks").doc();
      await checkRef.set({ schoolId, onCampus, consumed: false, createdAt: serverTimestamp(), expiresAt: new Date(now().getTime() + CHECK_TTL_MS) });
      return res.status(200).json({ ok: true, onCampus, campusCheckId: checkRef.id });
    } catch {
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

module.exports = { createCheckCampusLocationHandler, distanceMeters, CHECK_TTL_MS };
