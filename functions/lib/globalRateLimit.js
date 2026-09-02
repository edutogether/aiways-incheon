"use strict";

const { createHash } = require("node:crypto");

const RATE_LIMIT_SCHEMA = "global-rate-limit-v1";
// 2026-08-29 - 100점 목표 4번(비용상한을 "요청당 읽기수" 기준으로 재점검):
// 아래 perDay/perMinute는 전부 "요청 횟수" 상한이라, 요청 하나가 실제로
// 몇 번 Firestore를 읽는지는 함수마다 다른데도 숫자만 보면 똑같이
// 비교돼 왔다. 실측(핸들러 코드 기준 캐시 miss 최악의 경우)을 여기 남겨 둔다.
//
// 2026-09-02 재감사 - 이 표가 실제 코드와 크게 어긋나 있었다(예산 판단의
// 근거로 쓰라고 만든 표가 3~6배 과소계상이면 그 자체가 결함이다). 두 가지가
// 통째로 빠져 있었다:
//   (1) 공통 전처리 비용 - protectedActor.js의 protectActorRequest가 모든
//       액터 엔드포인트에서 매번 edu2gDeviceBindings 1 + actors 1 +
//       trustedDevices 1 (edu2gDeviceAccess.resolve) + blockedActors 1 =
//       4회를 읽는다. 여기에 전역 리미터 트랜잭션 읽기 + 액터 리미터
//       트랜잭션 읽기가 각 1회씩 더 붙는다.
//   (2) 다건 쿼리를 "1회"로 세고 있었다 - Firestore는 쿼리가 돌려주는
//       문서 수만큼 과금하므로 classes.get()은 그 학교 반 수(N)만큼이다.
//   추가로 getSchoolDashboard는 shards:8이라 전역 리미터만 8(합산 get)+1(증가
//   트랜잭션)=9회다(다른 함수는 shards 미지정이라 1회).
//
// 아래 BASE_*는 그 공통 전처리 비용이고, READS_PER_REQUEST_WORST_CASE는
// "공통 전처리 + 핸들러의 고정 읽기"의 합(=요청 하나가 무조건 내는 최소이자
// 고정 최악값)이다. 여기에 더해지는 "결과 건수만큼 늘어나는" 부분은 숫자로
// 못 박을 수 없으므로 VARIABLE_READS_PER_REQUEST에 따로 적는다 - 예산 계산은
// (perDay x 고정값) + (perDay x 가변부 상한)으로 해야 맞다.
const BASE_ACTOR_READS = 6; // 기기해석 3(binding+actor+device) + 차단목록 1 + 전역리미터 1 + 액터리미터 1
const BASE_ACTOR_READS_SHARDED = 14; // 위와 같되 전역리미터가 shards:8이라 1 -> 9
const READS_PER_REQUEST_WORST_CASE = Object.freeze({
  // 폴링(5초)으로 압도적 1위인 비용원. 캐시가 100% 적중해도 이 16은 그대로 나간다.
  getSchoolDashboard: BASE_ACTOR_READS_SHARDED + 2, // 락tx 1 + school 문서 1
  getClassRanking: BASE_ACTOR_READS + 1, // 락tx 1
  exportClassRecords: BASE_ACTOR_READS + 1, // 교사확인 1
  listPendingRegistrations: BASE_ACTOR_READS + 1, // 교사확인 1
  listSortingRecords: BASE_ACTOR_READS + 1, // 커서 문서 1
  // 핸들러 자체(액터 1 + campusCheck tx 1 + 기록 tx 1)에 더해
  // onSortingRecordWritten 트리거가 별도 호출로 반집계 1 + 학교 1 + 학생 1을
  // 더 읽는다(트리거는 리미터 밖이라 요청 상한엔 안 잡히지만 과금은 된다).
  saveSortingRecord: BASE_ACTOR_READS + 3 + 3,
  registerStudentProfile: BASE_ACTOR_READS + 3,
  decideRegistration: BASE_ACTOR_READS + 3, // 교사확인 1 + tx 2
  anonymizeStudent: BASE_ACTOR_READS + 2, // 교사확인 1 + tx(actor 조회) 1
  changeStudentClass: BASE_ACTOR_READS + 2,
  checkStudentProfile: BASE_ACTOR_READS + 2,
  resolveSortingRecord: BASE_ACTOR_READS + 2,
  checkCampusLocation: BASE_ACTOR_READS + 1,
  checkTeacherStatus: BASE_ACTOR_READS + 1,
  verifyTeacherCode: BASE_ACTOR_READS + 1,
  analyzeSortingImage: BASE_ACTOR_READS + 1, // 멱등성 tx 1
  analyzeSortingText: BASE_ACTOR_READS + 1,
  analyzeSortingSafetyObserver: BASE_ACTOR_READS + 1,
  // 액터 체계 밖(슈퍼어드민 ID토큰) - 전역 리미터 트랜잭션 1회만.
  manageTeacherCode: 1,
  // Firestore 조회는 전혀 없다(외부 NEIS API만 호출) - 공통 전처리만 든다.
  searchSchool: BASE_ACTOR_READS,
  // 비용절감 4번 ③단계 관찰용 - Firestore 조회 없이 Cloud Logging만 남긴다.
  logDashboardRealtimeEvent: BASE_ACTOR_READS
});
// 결과 건수에 비례해 늘어나는 부분(전부 캐시 miss / 최대 페이지 기준).
// N=그 학교의 반 수, K=그 학년의 반 수, M=그 반의 학생 수.
const VARIABLE_READS_PER_REQUEST = Object.freeze({
  getSchoolDashboard: "classes N + students M (둘 다 5.5초 인스턴스 캐시 miss 시에만)",
  getClassRanking: "classes K (5.5초 인스턴스 캐시 miss 시에만)",
  exportClassRecords: "기록 최대 201 (MAX_PAGE_SIZE+1, classExport.js)",
  listPendingRegistrations: "대기요청 최대 100 (MAX_LIST_SIZE, registrationApproval.js)",
  listSortingRecords: "기록 최대 41 (pageSize 최대 40 + 1)"
});
const RATE_LIMITS = Object.freeze({
  analyzeSortingImage: { perMinute: 20, perDay: 1000 },
  analyzeSortingSafetyObserver: { perMinute: 20, perDay: 1000 },
  analyzeSortingText: { perMinute: 20, perDay: 1000 },
  saveSortingRecord: { perMinute: 60 },
  listSortingRecords: { perMinute: 120 },
  resolveSortingRecord: { perMinute: 60 },
  // 대시보드가 5초마다 자동으로 다시 불러오는 폴링 방식이라(app.js) 기기
  // 한 대가 분당 12번을 쓴다 - 예전 120/min은 동시에 10대만 켜져 있어도
  // (파일럿 4개 학교 x PC/패드 여러 대) 전역 상한에 걸려 그 순간 모든
  // 사용자가 같이 막히는 구조였다(실측: 2000/일 액터 상한은 약 2시간
  // 47분 만에 소진). 이 파일럿 규모(4개 학교) 기준으로 여유 있게 올림.
  // perDay는 2026-08-26 정밀감사에서 빠진 게 발견됨 - 분당 상한만 있으면
  // 하루 종일 최대치로 돌리는 트래픽을 못 막는다. 5초 폴링 x 넉넉히
  // 20대(4학교 x PC/패드 5대) 기준 하루 약 34.5만 회(17,280 x 20)가
  // 정상 사용 상한선이라, 그 위에 여유를 둔 50만으로 잡는다.
  // shards: 이 함수만 분당 상한이 초당 1회를 크게 넘어(600/분=초당10회)
  // 실제 문서 경합 위험이 있다 - 나머지 13개 함수는 전부 분당 120 이하
  // (초당 2회 이하)라 애초에 단일 문서로도 경합이 안 난다. 2026-08-26에
  // 전체 함수에 샤딩을 걸었다가 요청당 읽기가 1→9로 늘어 비용이 오히려
  // 늘어난 걸 재감사에서 지적받아, 실제로 필요한 이 함수 하나에만 걸도록
  // 좁혔다(2026-08-27).
  getSchoolDashboard: { perMinute: 600, perDay: 500000, shards: 8 },
  checkStudentProfile: { perMinute: 30 }, registerStudentProfile: { perMinute: 10 },
  checkCampusLocation: { perMinute: 60 },
  changeStudentClass: { perMinute: 10 },
  // 전국 랭킹(collectionGroup 전수스캔)을 폐지하고 학교+학년 범위로 축소한
  // 뒤 이름도 그에 맞게 바꿈(2026-08-26) - 쿼리 자체가 훨씬 가벼워졌지만
  // perDay가 아예 없던 문제는 그대로 남아있어 같이 추가.
  getClassRanking: { perMinute: 60, perDay: 5000 },
  searchSchool: { perMinute: 60 }
  // 2026-08-31 - 교사 인증(1단계). verifyTeacherCode는 공유코드를 맞혀보는
  // 시도이므로 registerStudentProfile과 같은 수준(분당 10)으로 좁힌다.
  ,checkTeacherStatus: { perMinute: 30 }, verifyTeacherCode: { perMinute: 10 }
  // 2026-08-31 - 가입승인대기열(2단계). 교사 화면이 대기열을 자주 새로고침할
  // 수 있어 조회는 넉넉히, 승인/거절은 반 규모(수십 명) 감안해 60/분이면
  // 충분하고도 남는다.
  ,listPendingRegistrations: { perMinute: 30 }, decideRegistration: { perMinute: 60 }
  // 2026-08-31 - 슈퍼어드민(4단계). 유일한 정당 사용자가 대표님 한 명뿐이라
  // 액터별 상한은 의미가 없고(anonymous actorId 체계 밖에 있음), 전역
  // 상한만 방어적으로 낮게 건다.
  ,manageTeacherCode: { perMinute: 10, perDay: 100 }
  // 2026-08-31 - CSV 반전체 내보내기(5단계). collectionGroup 쿼리라
  // 페이지당 최대 200건을 읽을 수 있어(classExport.js MAX_PAGE_SIZE) 다른
  // 조회보다 상한을 좁게 잡는다.
  ,exportClassRecords: { perMinute: 10 }
  // 2026-09-02 - 학생 삭제·탈퇴 요청 대응(익명화). decideRegistration과
  // 같은 이유(교사 화면에서 드물게 쓰는 관리 작업)로 넉넉하게 잡는다.
  ,anonymizeStudent: { perMinute: 30 }
  // 2026-09-03 - 비용절감 4번 ③단계 관찰용 신호. PC 대시보드 세션당 1회
  // (구독 시작 또는 실패 시) 정도만 호출되는 저빈도 이벤트라 낮게 잡아도 된다.
  ,logDashboardRealtimeEvent: { perMinute: 10 }
});

function getUtcBuckets(now = new Date()) {
  const date = new Date(now);
  const utcDate = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  const minuteKey = `${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return { utcDate, minuteKey };
}

function getRetryAfterSeconds(now = new Date(), outcome) {
  const date = new Date(now);
  const end = outcome === "daily_limited"
    ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0)
    : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes() + 1, 0);
  return Math.max(1, Math.min(60, Math.ceil((end - date.getTime()) / 1000)));
}

function expireAtFor(now) {
  const date = new Date(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 3, 0, 0, 0));
}

// 2026-08-26 재감사 지적사항: 이전엔 함수 하나당 하루짜리 문서가 딱 1개라,
// 모든 actor의 모든 요청이 그 문서 하나를 두고 트랜잭션(읽기→쓰기)으로
// 경합했다. getSchoolDashboard의 분당 상한(600=초당10회)이 Firestore의
// 단일 문서 권장 쓰기 속도(초당~1회)를 크게 넘어서, 상한에 도달하기도
// 전에 문서 경합만으로 트랜잭션이 실패해 503이 났다. 여기서는 같은
// (함수,날짜) 카운터를 그 함수의 RATE_LIMITS 설정에 적힌 shards개
// 문서로 쪼개 분산시킨다 - 상한 판정은 모든 샤드를 합산(일반 읽기,
// 트랜잭션 불필요)해서 하고, 실제 카운트 증가만 무작위로 고른 샤드
// 1개에 트랜잭션으로 쓴다. 그 결과 한 문서가 받는 지속 쓰기 속도가
// 1/샤드수로 줄어든다.
// 트레이드오프: 합산 판정(읽기)과 실제 증가(쓰기) 사이에 아주 짧은
// 틈이 있어서, 상한 경계에서 동시 요청이 몰리면 몇 건이 상한을 살짝
// 넘겨 통과할 수 있다 - 이건 과금 방어용 소프트 상한이라 허용 가능한
// 수준이고(정확한 하드 리밋이 필요한 곳이 아님), 반대급부로 얻는
// "경합으로 인한 전체 503 방지"가 훨씬 중요하다.
// shards 미지정(대부분의 함수)이면 1로, 즉 기존과 똑같이 요청당 읽기
// 1회+쓰기 1회다 - 2026-08-27 재감사에서 "전체 14개 함수에 일괄로
// 8샤딩을 걸어서 요청당 읽기가 1→9로 늘었다"는 비용 회귀를 지적받아,
// 실제로 경합 위험이 있는 함수(초당 1회를 넘는 것)에만 좁혔다.
const DEFAULT_SHARD_COUNT = 1;

function createGlobalRateLimiter({ db, now = () => new Date(), serverTimestamp = () => new Date(), logger = () => {} }) {
  return {
    async check(functionName) {
      const limit = RATE_LIMITS[functionName];
      if (!limit || !db?.runTransaction) return { allowed: false, outcome: "unavailable" };
      const current = new Date(now());
      const { utcDate, minuteKey } = getUtcBuckets(current);
      const shardCount = Math.max(1, Number(limit.shards) || DEFAULT_SHARD_COUNT);
      const shardRefs = Array.from({ length: shardCount }, (_, index) => db.collection("system_rate_limits").doc(`${functionName}-${utcDate}-${index}`));
      try {
        // shardCount 1(대부분의 함수)일 땐 트랜잭션 밖에서 미리 합산할
        // 필요가 없다 - 트랜잭션 안에서 그 문서 하나만 읽고 바로 판정하면
        // 읽기 1회(+쓰기 1회)로 끝난다, 샤딩 이전과 정확히 같은 비용이다.
        // shardCount>1일 때만(지금은 getSchoolDashboard 하나) 모든 샤드를
        // 먼저 합산해서 판정한다.
        if (shardCount === 1) {
          const shardRef = shardRefs[0];
          return await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(shardRef);
            const data = snap.exists ? (snap.data() || {}) : {};
            const minuteCounts = data.minuteCounts && typeof data.minuteCounts === "object" ? data.minuteCounts : {};
            const minuteCount = Number(minuteCounts[minuteKey] || 0);
            const totalCount = Number(data.totalCount || 0);
            const outcome = minuteCount >= limit.perMinute ? "minute_limited" : (limit.perDay && totalCount >= limit.perDay ? "daily_limited" : "allowed");
            if (outcome !== "allowed") return { allowed: false, outcome, retryAfterSeconds: getRetryAfterSeconds(current, outcome) };
            transaction.set(shardRef, {
              schemaVersion: RATE_LIMIT_SCHEMA, functionName, utcDate,
              totalCount: totalCount + 1, minuteCounts: { ...minuteCounts, [minuteKey]: minuteCount + 1 },
              ...(snap.exists ? {} : { createdAt: serverTimestamp(), expireAt: expireAtFor(current) }), updatedAt: serverTimestamp()
            }, { merge: true });
            return { allowed: true, outcome: "allowed" };
          });
        }
        const snaps = await Promise.all(shardRefs.map((ref) => ref.get()));
        let minuteCount = 0, totalCount = 0;
        for (const snap of snaps) {
          const data = snap.exists ? (snap.data() || {}) : {};
          const minuteCounts = data.minuteCounts && typeof data.minuteCounts === "object" ? data.minuteCounts : {};
          minuteCount += Number(minuteCounts[minuteKey] || 0);
          totalCount += Number(data.totalCount || 0);
        }
        const outcome = minuteCount >= limit.perMinute ? "minute_limited" : (limit.perDay && totalCount >= limit.perDay ? "daily_limited" : "allowed");
        if (outcome !== "allowed") return { allowed: false, outcome, retryAfterSeconds: getRetryAfterSeconds(current, outcome) };
        const shardRef = shardRefs[Math.floor(Math.random() * shardCount)];
        await db.runTransaction(async (transaction) => {
          const snap = await transaction.get(shardRef);
          const data = snap.exists ? (snap.data() || {}) : {};
          const minuteCounts = data.minuteCounts && typeof data.minuteCounts === "object" ? data.minuteCounts : {};
          const shardMinuteCount = Number(minuteCounts[minuteKey] || 0);
          const shardTotalCount = Number(data.totalCount || 0);
          transaction.set(shardRef, {
            schemaVersion: RATE_LIMIT_SCHEMA, functionName, utcDate,
            totalCount: shardTotalCount + 1, minuteCounts: { ...minuteCounts, [minuteKey]: shardMinuteCount + 1 },
            ...(snap.exists ? {} : { createdAt: serverTimestamp(), expireAt: expireAtFor(current) }), updatedAt: serverTimestamp()
          }, { merge: true });
        });
        return { allowed: true, outcome: "allowed" };
      } catch (error) {
        // 이 리미터는 14개 엔드포인트 전부의 앞단에 있는 단일 장애점이다 -
        // 실패하면 전부 fail-closed(503)로 막히는데, 정작 그 실패 자체가
        // 어디에도 안 남으면 아무도 원인을 못 찾는다(2026-08-26 재감사 지적).
        logger({ message: "global_rate_limiter_failed", functionName, error: String(error && error.message ? error.message : error) });
        return { allowed: false, outcome: "unavailable" };
      }
    }
  };
}

const ACTOR_RATE_LIMITS = Object.freeze({
  analyzeSortingImage: { perMinute: 4, perDay: 50 }, analyzeSortingText: { perMinute: 6, perDay: 80 },
  // 2026-08-29 - 대표님 지시로 함수별 실제 최대 호출량을 점검하다 발견:
  // 이 함수만 액터별 상한이 아예 없었다(대응하는 ACTOR_RATE_LIMITS 항목이
  // 없으면 check()가 무조건 allowed=true를 돌려줌, 위 194행). 서버 조건부
  // 호출(analyzeSortingImage가 애매할 때만)이 원 설계지만, 클라이언트가
  // 직접 부를 수 있는 엔드포인트로도 노출돼 있어(edu2gBetaClient.js
  // ALLOWED 목록) 액터 하나가 이 함수 하나의 전역 상한(1000/일)을 혼자
  // 다 써버릴 수 있었다. analyzeSortingText와 같은 크기로 맞춘다.
  analyzeSortingSafetyObserver: { perMinute: 6, perDay: 80 },
  saveSortingRecord: { perMinute: 12, perDay: 200 },
  listSortingRecords: { perMinute: 60, perDay: 500 }, resolveSortingRecord: { perMinute: 20, perDay: 100 },
  // 24시간 내내 켜있는 키오스크 기기가 5초마다 폴링하면 하루 최대
  // 86400/5=17280번 호출한다 - 2000이면 약 2시간 47분 만에 소진돼서
  // 그 뒤로는 이 기기 하나만 대시보드가 조용히 멈춘다(429가 화면에
  // 아무 표시도 안 남기고 그냥 무시됐었음, 아래 app.js에서 별도 수정).
  // 여유 있게 20000으로 올림.
  getSchoolDashboard: { perMinute: 30, perDay: 20000 },
  checkStudentProfile: { perMinute: 10, perDay: 200 }, registerStudentProfile: { perMinute: 5, perDay: 20 },
  checkCampusLocation: { perMinute: 15, perDay: 300 },
  changeStudentClass: { perMinute: 15, perDay: 20 },
  getClassRanking: { perMinute: 30, perDay: 2000 },
  searchSchool: { perMinute: 20, perDay: 500 },
  // 액터별 상한 - 코드 추측 시도를 한 기기가 하루 종일 반복 못 하게 20회로
  // 막는다(registerStudentProfile과 동일 값 - 둘 다 "정상적으로는 하루 몇 번
  // 안 쓰는" 1회성/저빈도 액션).
  checkTeacherStatus: { perMinute: 10, perDay: 200 }, verifyTeacherCode: { perMinute: 5, perDay: 20 },
  listPendingRegistrations: { perMinute: 20, perDay: 2000 }, decideRegistration: { perMinute: 30, perDay: 500 },
  exportClassRecords: { perMinute: 6, perDay: 100 },
  anonymizeStudent: { perMinute: 20, perDay: 500 },
  logDashboardRealtimeEvent: { perMinute: 10, perDay: 200 }
});
function hashRateLimitScope(value) { return createHash("sha256").update(String(value)).digest("hex"); }
function createActorRateLimiter({ db, now = () => new Date(), serverTimestamp = () => new Date(), limits = ACTOR_RATE_LIMITS, logger = () => {} }) {
  return { async check(functionName, scope) {
    const limit = limits[functionName];
    if (!limit) return { allowed: true, outcome: "not_configured" };
    if (typeof scope !== "string" || !scope || !db?.runTransaction) return { allowed: false, outcome: "unavailable" };
    const current = new Date(now()), { utcDate, minuteKey } = getUtcBuckets(current);
    const ref = db.collection("system_actor_rate_limits").doc(`${functionName}-${hashRateLimitScope(scope)}-${utcDate}`);
    try { return await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref), data = snap.exists ? (snap.data() || {}) : {}, counts = data.minuteCounts && typeof data.minuteCounts === "object" ? data.minuteCounts : {};
      const minuteCount = Number(counts[minuteKey] || 0), totalCount = Number(data.totalCount || 0);
      const outcome = minuteCount >= limit.perMinute ? "minute_limited" : (limit.perDay && totalCount >= limit.perDay ? "daily_limited" : "allowed");
      if (outcome !== "allowed") return { allowed: false, outcome, retryAfterSeconds: getRetryAfterSeconds(current, outcome) };
      transaction.set(ref, { schemaVersion: "actor-rate-limit-v1", functionName, utcDate, totalCount: totalCount + 1, minuteCounts: { ...counts, [minuteKey]: minuteCount + 1 }, ...(snap.exists ? {} : { createdAt: serverTimestamp(), expireAt: expireAtFor(current) }), updatedAt: serverTimestamp() }, { merge: true });
      return { allowed: true, outcome: "allowed" };
    }); } catch (error) {
      logger({ message: "actor_rate_limiter_failed", functionName, error: String(error && error.message ? error.message : error) });
      return { allowed: false, outcome: "unavailable" };
    }
  } };
}

async function checkGlobalRateLimit(limiter, functionName) { return limiter.check(functionName); }

module.exports = { RATE_LIMIT_SCHEMA, RATE_LIMITS, ACTOR_RATE_LIMITS, READS_PER_REQUEST_WORST_CASE, VARIABLE_READS_PER_REQUEST, getUtcBuckets, getRetryAfterSeconds, expireAtFor, checkGlobalRateLimit, createGlobalRateLimiter, createActorRateLimiter, hashRateLimitScope };
