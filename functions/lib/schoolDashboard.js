"use strict";

const { protectActorRequest } = require("./protectedActor");
const { cleanSchoolId, cleanPathSegment } = require("./firestorePathSafety");
const { cleanText, applyCors } = require("./httpGuard");
const { setDashboardSchoolClaim } = require("./dashboardSchoolClaim");

const MAX_BODY_BYTES = 4 * 1024;

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
// 2026-09-01 종합감사(B그룹 5번): 만료된 항목을 지우지 않고 get()이 그냥
// null만 돌려주고 있어서, 이 캐시는 실제로는 schoolId 하나가 아니라
// lock:{actorId}/students:{schoolId}_{grade}_{classNum} 키도 같이 쓰다 보니
// 접속한 고유 기기 수만큼 무한정 쌓였다(만료돼도 메모리에는 계속 남음).
// 만료된 항목은 get()에서 실제로 삭제하고, 그래도 순간적으로 많은 키가
// 몰리는 상황에 대비해 크기 상한(MAX_CACHE_ENTRIES)을 두어 넘으면 가장
// 오래된 항목부터 지운다(Map은 삽입 순서를 보존하므로 첫 키가 최고령).
const MAX_CACHE_ENTRIES = 500;
function createSchoolDashboardCache() {
  const store = new Map();
  return {
    get(schoolId, now) {
      const entry = store.get(schoolId);
      if (!entry) return null;
      if (now - entry.cachedAt > DASHBOARD_CACHE_TTL_MS) { store.delete(schoolId); return null; }
      return entry.value;
    },
    set(schoolId, value, now) {
      if (!store.has(schoolId) && store.size >= MAX_CACHE_ENTRIES) store.delete(store.keys().next().value);
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
    const requestTimeForLock = now();
    // 2026-08-29 대표님 지시(비용 실측 결과) - 학교잠금 확인 트랜잭션은
    // 한 번 고정되면 절대 안 바뀌는 값인데도 폴링마다(5초) 매번 다시
    // 읽고 있었다 - 전체 Firestore 읽기 비용의 약 65%가 여기서 나가는
    // 걸 계산으로 확인했다. classes/school/students와 같은 캐시(같은
    // TTL, "폴링 주기(5초)보다 길게" 원칙 그대로 - 지연 체감 없이 캐시
    // 효율만 최대)를 actorId별로 하나 더 둬서, 이 읽기도 같은 방식으로
    // 줄인다. studentProfile은 등록 이후 바뀔 수 있는 값이라(가입/반변경)
    // 이 TTL(5.5초)만큼만 지연 반영되는 것도 나머지 대시보드 데이터와
    // 동일한 수준이라 문제 없다.
    // 캐시에는 "이 요청의 ok 여부"가 아니라 boundSchoolId/profile 자체(둘 다
    // 한 번 정해지면 이 TTL 동안은 그대로인 값)만 담는다 - ok는 매번 이번
    // 요청의 schoolId와 새로 비교해서 계산해야, 같은 기기가 (캐시가 아직
    // 살아있는 동안) 다른 schoolId로 다시 요청했을 때도 정확히 거절된다
    // (캐시된 "true"를 그대로 돌려주면 다른 학교 요청까지 통과되는 버그가 됨).
    const lockCacheKey = `lock:${protectedActor.actorId}`;
    let lockState = cache.get(lockCacheKey, requestTimeForLock);
    if (!lockState) {
      let newlyBound = false;
      try {
        lockState = await db.runTransaction(async (transaction) => {
          const snap = await transaction.get(actorRef);
          const data = snap.exists ? snap.data() : null;
          const boundSchoolId = cleanText(data?.dashboardSchoolId, 80);
          if (!boundSchoolId) {
            transaction.set(actorRef, { dashboardSchoolId: schoolId }, { merge: true });
            newlyBound = true;
            return { boundSchoolId: schoolId, profile: data?.studentProfile || null };
          }
          return { boundSchoolId, profile: data?.studentProfile || null };
        });
      } catch {
        return res.status(503).json({ ok: false, code: "protection_unavailable" });
      }
      cache.set(lockCacheKey, lockState, requestTimeForLock);
      // 클레임은 이 actor의 dashboardSchoolId가 "이번 트랜잭션에서 처음
      // 확정된" 경우에만 설정한다 - 이미 확정돼 있던 값을 캐시가 식을
      // 때마다(5.5초) 매번 다시 Admin Auth API로 재설정하면 활성 사용자
      // 수만큼 불필요한 API 호출이 반복된다(값 자체는 안 바뀌므로).
      if (newlyBound) await setDashboardSchoolClaim({ auth: dependencies.auth, uid: protectedActor.uid, schoolId: lockState.boundSchoolId, logger: dependencies.logger });
    }
    const binding = { ok: lockState.boundSchoolId === schoolId, profile: lockState.profile };
    if (!binding.ok) return res.status(403).json({ ok: false, code: "school_mismatch" });

    const schoolRef = db.collection("schools").doc(schoolId);
    const requestTime = now();
    const cached = cache.get(schoolId, requestTime);
    let classes, schoolName;
    if (cached) {
      ({ classes, schoolName } = cached);
    } else {
      // 2026-09-02 재감사: 바로 위 락 트랜잭션에는 503 컨벤션이 붙어 있는데
      // 정작 이 본 쿼리(반 전체 + 학교 문서)에는 try/catch가 없어서, 일시적
      // Firestore 장애 시 여기만 처리되지 않은 예외로 빠져나가 5초마다
      // 폴링하는 대시보드가 503 대신 정체불명의 500을 받았다.
      try {
        const [classesSnap, schoolSnap] = await Promise.all([schoolRef.collection("classes").get(), schoolRef.get()]);
        classes = classesSnap.docs.map(classSummary);
        schoolName = cleanText(schoolSnap.exists ? schoolSnap.data()?.schoolName : "", 80);
      } catch {
        return res.status(503).json({ ok: false, code: "protection_unavailable" });
      }
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
      // 2026-08-27 재감사 지적: topStudents가 위 캐시 범위 밖에 있어서
      // 특정 반을 선택한 폴링마다 학생 목록을 매번 다시 읽고 있었다.
      // 같은 (schoolId,grade,classNum) 캐시 공간을 studentsCacheKey로
      // 따로 둬서 위와 같은 TTL로 재사용한다 - 접근권한 검사
      // (profileMatches)는 캐시 조회보다 먼저 이미 끝나 있으므로, 캐시를
      // 쓴다고 권한 없는 요청에 새어나갈 위험은 없다(profileMatches가
      // false면애초에 이 블록에 안 들어옴).
      const studentsCacheKey = `students:${schoolId}_${grade}_${classNum}`;
      const cachedStudents = profileMatches ? cache.get(studentsCacheKey, requestTime) : null;
      let topStudents;
      if (cachedStudents) {
        topStudents = cachedStudents;
      } else {
        let studentsSnap = null;
        try {
          studentsSnap = profileMatches ? await schoolRef.collection("classes").doc(`${grade}_${classNum}`).collection("students").get() : null;
        } catch {
          return res.status(503).json({ ok: false, code: "protection_unavailable" });
        }
        topStudents = !studentsSnap ? [] : studentsSnap.docs
          .map((doc) => doc.data())
          .map((item) => ({ studentNumber: cleanText(item.studentNumber, 10), studentName: cleanText(item.studentName, 80), completedTotal: Number(item.completedTotal) || 0 }))
          .filter((item) => item.studentNumber && item.completedTotal > 0)
          .sort((a, b) => b.completedTotal - a.completedTotal)
          .slice(0, 5);
        if (profileMatches) cache.set(studentsCacheKey, topStudents, requestTime);
      }
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
