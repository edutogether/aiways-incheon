"use strict";

const { protectActorRequest } = require("./protectedActor");
const { cleanSchoolId, cleanPathSegment } = require("./firestorePathSafety");

const MAX_BODY_BYTES = 4 * 1024;
const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

function cleanText(value, max = 80) {
  return typeof value === "string" && value.length <= max && value.trim() && !/[<>\x00-\x1f]/.test(value) ? value.trim() : "";
}
function isAllowedOrigin(origin) {
  return origin === "https://edutogether.github.io" || ALLOWED_ORIGIN.test(origin);
}
function applyCors(req, res) {
  const origin = String(req.headers?.origin || "");
  if (origin && !isAllowedOrigin(origin)) return false;
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck, Authorization");
  }
  return true;
}

function topItems(itemCounts, limit = 5) {
  return Object.entries(itemCounts && typeof itemCounts === "object" ? itemCounts : {})
    .map(([itemId, count]) => ({ itemId, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function classSummary(doc) {
  const data = doc.data() || {};
  const completedTotal = Number(data.completedTotal) || 0;
  const heldTotal = Number(data.heldTotal) || 0;
  return {
    grade: cleanText(data.grade, 10), classNum: cleanText(data.classNum, 10),
    observedToday: Number(data.observedToday) || 0,
    completedTotal, heldTotal, observedTotal: completedTotal + heldTotal,
    convertedTotal: Number(data.convertedTotal) || 0,
    itemCounts: data.itemCounts && typeof data.itemCounts === "object" ? data.itemCounts : {}
  };
}

// 2026-08-26 재감사 지적: 화면이 5초마다 이 함수를 다시 부르는데, 매번
// 그 학교의 반 전체 컬렉션을 캐시 없이 다시 읽고 있었다("요청 수" 상한은
// 있어도 "요청 하나당 읽기 수"는 안 세서, 실질적으로 하루 수백만 건
// 읽기가 가능했던 원인 중 하나). 학교 단위로 짧은 인스턴스 메모리
// 캐시를 둔다 - Cloud Functions 인스턴스가 따뜻한 상태로 재사용되는
// 동안에는 연속된 폴링 다수가 이 캐시 하나를 공유해서 실제 Firestore
// 읽기 횟수를 줄인다. 격리 원칙은 그대로 유지된다 - 캐시 키가 schoolId라
// 학교 간 데이터가 섞이지 않는다.
// TTL은 폴링 주기(5초)보다 반드시 길어야 한다(2026-08-27 재감사에서
// 처음 4초로 잡았던 게 5초보다 짧아 "같은 기기의 바로 다음 폴링"이
// 매번 캐시 만료 직후라 거의 항상 다시 읽고 있던 걸 지적받음 - 캐시가
// 도움이 되는 경우가 "같은 학교의 여러 기기가 우연히 겹치는 순간"뿐이라
// 실효성이 낮았다). 5.5초로 늘려 같은 기기의 바로 다음 폴링도 캐시를
// 맞히게 한다 - 그만큼 화면이 최대 5.5초까지 늦게 반영될 수 있지만,
// 이미 5초 폴링 자체가 그 정도 지연은 전제하고 있다.
const DASHBOARD_CACHE_TTL_MS = 5500;
function createSchoolDashboardCache() {
  const store = new Map();
  return {
    get(schoolId, now) {
      const entry = store.get(schoolId);
      if (!entry || now - entry.cachedAt > DASHBOARD_CACHE_TTL_MS) return null;
      return entry.value;
    },
    set(schoolId, value, now) {
      store.set(schoolId, { value, cachedAt: now });
    }
  };
}

function createGetSchoolDashboardHandler(dependencies = {}) {
  const db = dependencies.db;
  const now = dependencies.now || (() => Date.now());
  const cache = dependencies.cache || createSchoolDashboardCache();
  return async (req, res) => {
    if (!applyCors(req, res)) return res.status(403).json({ ok: false, code: "invalid_origin" });
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ ok: false, code: "method_not_allowed" });

    const protectedActor = await protectActorRequest({ req, functionName: "getSchoolDashboard", access: dependencies.access, appCheck: dependencies.appCheck, globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter, logAppCheck: dependencies.logAppCheck, blockedActors: dependencies.blockedActors });
    if (!protectedActor.ok) {
      if (protectedActor.retryAfterSeconds) res.set("Retry-After", String(protectedActor.retryAfterSeconds));
      return res.status(protectedActor.httpStatus).json({ ok: false, code: protectedActor.code, ...(protectedActor.retryAfterSeconds ? { retryAfterSeconds: protectedActor.retryAfterSeconds } : {}) });
    }

    const bodyBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body || {}));
    if (bodyBytes > MAX_BODY_BYTES) return res.status(413).json({ ok: false, code: "request_too_large" });

    const body = req.body || {};
    const allowed = new Set(["schoolId", "grade", "classNum"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const schoolId = cleanSchoolId(body.schoolId);
    if (!schoolId) return res.status(400).json({ ok: false, code: "invalid_school_id" });
    const grade = cleanPathSegment(body.grade);
    const classNum = cleanPathSegment(body.classNum);
    if ((grade && !classNum) || (!grade && classNum)) return res.status(400).json({ ok: false, code: "invalid_class_selector" });

    // 실명가입(4단계)이 들어오기 전까지의 임시 격리: 이 actor(기기)가 처음
    // 요청한 schoolId로 actors/{actorId}.dashboardSchoolId를 한 번만 고정한다
    // (edu2gDeviceAccess.js의 "첫 접속 시 기기 고정" 패턴과 동일). 그 다음부터는
    // 다른 schoolId를 보내도 거절돼서, 최소한 "아무 학교나 조회 가능"은 막힌다.
    // 4단계가 들어오면 이 필드를 실제 가입 시 확인된 값으로 대체하면 된다.
    const actorRef = db.collection("actors").doc(protectedActor.actorId);
    const binding = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(actorRef);
      const data = snap.exists ? snap.data() : null;
      const boundSchoolId = cleanText(data?.dashboardSchoolId, 80);
      if (!boundSchoolId) {
        transaction.set(actorRef, { dashboardSchoolId: schoolId }, { merge: true });
        return { ok: true, profile: data?.studentProfile || null };
      }
      return { ok: boundSchoolId === schoolId, profile: data?.studentProfile || null };
    });
    if (!binding.ok) return res.status(403).json({ ok: false, code: "school_mismatch" });

    const schoolRef = db.collection("schools").doc(schoolId);
    const requestTime = now();
    const cached = cache.get(schoolId, requestTime);
    let classes, schoolName;
    if (cached) {
      ({ classes, schoolName } = cached);
    } else {
      const [classesSnap, schoolSnap] = await Promise.all([schoolRef.collection("classes").get(), schoolRef.get()]);
      classes = classesSnap.docs.map(classSummary);
      schoolName = cleanText(schoolSnap.exists ? schoolSnap.data()?.schoolName : "", 80);
      cache.set(schoolId, { classes, schoolName }, requestTime);
    }

    const byGrade = new Map();
    let schoolObservedToday = 0, schoolCompletedTotal = 0, schoolHeldTotal = 0;
    const schoolItemCounts = {};
    for (const item of classes) {
      schoolObservedToday += item.observedToday;
      schoolCompletedTotal += item.completedTotal;
      schoolHeldTotal += item.heldTotal;
      byGrade.set(item.grade, (byGrade.get(item.grade) || 0) + item.observedToday);
      for (const [id, count] of Object.entries(item.itemCounts)) schoolItemCounts[id] = (schoolItemCounts[id] || 0) + count;
    }
    const gradeBars = [...byGrade.entries()].map(([grade2, observedToday]) => ({ grade: grade2, observedToday })).sort((a, b) => a.grade.localeCompare(b.grade, "ko"));

    let selectedClass = null;
    if (grade && classNum) {
      const match = classes.find((item) => item.grade === grade && item.classNum === classNum) || { grade, classNum, observedToday: 0, completedTotal: 0, heldTotal: 0, observedTotal: 0, convertedTotal: 0, itemCounts: {} };
      const gradeSiblings = [...classes.filter((item) => item.grade === grade)].sort((a, b) => b.observedToday - a.observedToday);
      const schoolRanked = [...classes].sort((a, b) => b.observedToday - a.observedToday);
      const gradeRank = gradeSiblings.findIndex((item) => item.classNum === classNum);
      const schoolRank = schoolRanked.findIndex((item) => item.grade === grade && item.classNum === classNum);
      // 개인별 랭킹(6단계) - 실명 검증 없이 학생이 자율로 적은 번호/이름
      // 그대로 보여준다(교사가 부모 동의 하에 결정, 마스킹 없음). 단,
      // 위 dashboardSchoolId 잠금은 "이 기기가 처음 요청한 schoolId"만
      // 고정하는 약한 잠금이라 브라우저 저장소를 지우면 매번 새 actor로
      // 아무 학교/반이나 골라 무제한 조회할 수 있었다(실측으로 확인된
      // 취약점) - 개인 실명·번호가 걸린 topStudents만큼은 이 약한
      // 잠금이 아니라, 서버가 실제로 아는 검증된 studentProfile(정식
      // 가입 시 확정, 그 액터가 스스로 못 바꿈)의 schoolId/grade/classNum이
      // 요청과 정확히 일치할 때만 내려준다. 가입 안 한 액터(=검증된
      // 소속이 없음)에게는 topStudents를 아예 비워서 준다.
      const profile = binding.profile;
      const profileMatches = !!profile && profile.schoolId === schoolId && profile.grade === grade && profile.classNum === classNum;
      const studentsSnap = profileMatches ? await schoolRef.collection("classes").doc(`${grade}_${classNum}`).collection("students").get() : null;
      const topStudents = !studentsSnap ? [] : studentsSnap.docs
        .map((doc) => doc.data())
        .map((item) => ({ studentNumber: cleanText(item.studentNumber, 10), studentName: cleanText(item.studentName, 80), completedTotal: Number(item.completedTotal) || 0 }))
        .filter((item) => item.studentNumber && item.completedTotal > 0)
        .sort((a, b) => b.completedTotal - a.completedTotal)
        .slice(0, 5);
      selectedClass = {
        grade: match.grade, classNum: match.classNum,
        observedToday: match.observedToday, completedTotal: match.completedTotal, heldTotal: match.heldTotal, convertedTotal: match.convertedTotal,
        topItems: topItems(match.itemCounts), topStudents,
        rankInGrade: gradeRank >= 0 ? gradeRank + 1 : gradeSiblings.length + 1,
        gradeSize: Math.max(gradeSiblings.length, 1),
        rankInSchool: schoolRank >= 0 ? schoolRank + 1 : schoolRanked.length + 1,
        schoolSize: Math.max(schoolRanked.length, 1)
      };
    }

    return res.status(200).json({
      ok: true, schoolId, schoolName, classCount: classes.length,
      school: { observedToday: schoolObservedToday, completedTotal: schoolCompletedTotal, heldTotal: schoolHeldTotal, observedTotal: schoolCompletedTotal + schoolHeldTotal, topItems: topItems(schoolItemCounts) },
      gradeBars, selectedClass
    });
  };
}

module.exports = { createGetSchoolDashboardHandler };
