"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const { createAnalyzeSortingHandler } = require("./lib/sortingVision");
const { createAnalyzeSortingTextHandler } = require("./lib/sortingTextTip");
const { createSortingSafetyObserverHandler } = require("./lib/sortingSafetyObserver");
const { createSaveSortingRecordHandler } = require("./lib/sortingRecord");
const { createRecordStore } = require("./lib/sortingRecordStore");
const { createRecordQueryStore } = require("./lib/sortingRecordQueryStore");
const { createListSortingRecordsHandler, createResolveSortingRecordHandler } = require("./lib/sortingRecordQuery");
const { createSortingRecordAggregator } = require("./lib/schoolDashboardAggregate");
const { createGetSchoolDashboardHandler } = require("./lib/schoolDashboard");
const { createCheckStudentProfileHandler, createRegisterStudentProfileHandler, createChangeStudentClassHandler } = require("./lib/studentProfile");
const { createCheckCampusLocationHandler } = require("./lib/campusLocation");
const { createGetClassRankingHandler } = require("./lib/classRanking");
const { createSearchSchoolHandler } = require("./lib/schoolSearch");
const { createCheckTeacherStatusHandler, createVerifyTeacherCodeHandler } = require("./lib/teacherAuth");
const { createListPendingRegistrationsHandler, createDecideRegistrationHandler } = require("./lib/registrationApproval");
const { createManageTeacherCodeHandler } = require("./lib/superadmin");
const { createExportClassRecordsHandler } = require("./lib/classExport");
const { createAnonymizeStudentHandler } = require("./lib/studentAnonymization");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { createGlobalRateLimiter, createActorRateLimiter } = require("./lib/globalRateLimit");
const { createAnalysisIdempotency } = require("./lib/analysisIdempotency");
const { createEdu2gDeviceAccess } = require("./lib/edu2gDeviceAccess");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const neisApiKey = defineSecret("NEIS_API_KEY");
if (!getApps().length) initializeApp();
const db = getFirestore();
const rateLimiterFailureLogger = (metadata) => logger.error(metadata);
const rateLimiter = createGlobalRateLimiter({ db, serverTimestamp: () => FieldValue.serverTimestamp(), logger: rateLimiterFailureLogger });
const actorRateLimiter = createActorRateLimiter({ db, serverTimestamp: () => FieldValue.serverTimestamp(), logger: rateLimiterFailureLogger });
const deviceAccess = createEdu2gDeviceAccess({ auth: getAuth(), db, serverTimestamp: () => FieldValue.serverTimestamp() });
const analysisRequests = createAnalysisIdempotency({ db, serverTimestamp: () => FieldValue.serverTimestamp(), model: "gemini-3.5-flash-lite" });
const logAppCheck = (metadata) => logger.write({ severity: metadata?.status === "invalid" || metadata?.status === "unavailable" ? "WARNING" : "INFO", ...metadata });
// 2026-09-01 종합감사(B그룹 6번): 교사코드 실패시도/CSV 반전체 내보내기/
// 가입승인·거절에 감사로그가 전혀 없었다 - "누가 언제 우리 반 명단을
// 뽑았나"에 답할 수 없던 문제를 닫는다. 호출부가 metadata.severity로
// WARNING(실패시도)/INFO(정상 감사기록)를 직접 고른다.
const auditLog = (metadata) => logger.write({ severity: metadata?.severity || "INFO", ...metadata });
// FUNCTIONS_EMULATOR는 firebase emulators:start가 Functions 에뮬레이터
// 프로세스에만 자동으로 심어주는 값이라(프로덕션 Cloud Functions 런타임에는
// 절대 안 생김 - recordEmulatorSmoke.js/edu2gEmulatorSmoke.js에서도 이미
// 같은 방식으로 씀) 로컬 검증 시에만 App Check 강제를 건너뛴다. 실제
// 브라우저에서 HTTP로 로컬 시연할 때 App Check가 localhost를 막는 문제를
// (functionName마다 dependencies.appCheck를 직접 목업해야 하는 유닛테스트와
// 달리) 실제 에뮬레이터 HTTP 서버 경로에서도 우회할 유일한 방법이다.
const emulatorAppCheck = process.env.FUNCTIONS_EMULATOR === "true" ? async () => ({ status: "valid" }) : undefined;
// 실명 검증이 없어 학생이 자율로 이름/번호를 적게 두기로 한 만큼("우주제일킹왕짱스타"도
// 허용), 문제가 생겼을 때 "누구인지 특정"은 못 해도 "그 계정을 더 이상 못 쓰게"는
// 할 수 있어야 한다 - protectActorRequest에서 모든 엔드포인트 공통으로 걸리는
// 차단 목록. blockedActors/{actorId} 문서가 있으면(내용 무관, 존재 자체가 신호)
// 그 actor의 모든 요청을 403으로 거절한다.
const blockedActors = { async isBlocked(actorId) { const snap = await db.collection("blockedActors").doc(actorId).get(); return snap.exists; } };
exports.analyzeSortingImage = onRequest({
  region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 30, minInstances: 0, maxInstances: 2, concurrency: 1,
  secrets: [geminiApiKey], cors: false
}, createAnalyzeSortingHandler({ getApiKey: () => geminiApiKey.value(), access: deviceAccess, rateLimiter, actorRateLimiter, analysisRequests, logAppCheck, blockedActors }));
exports.analyzeSortingText = onRequest({
  region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 20, minInstances: 0, maxInstances: 2, concurrency: 2,
  secrets: [geminiApiKey], cors: false
}, createAnalyzeSortingTextHandler({ getApiKey: () => geminiApiKey.value(), access: deviceAccess, rateLimiter, actorRateLimiter, analysisRequests, logAppCheck, blockedActors }));
exports.analyzeSortingSafetyObserver = onRequest({ region:"asia-northeast3", memory:"256MiB", timeoutSeconds:30, minInstances:0, maxInstances:2, concurrency:1, secrets:[geminiApiKey], cors:false }, createSortingSafetyObserverHandler({getApiKey:()=>geminiApiKey.value(),access:deviceAccess,rateLimiter,actorRateLimiter,analysisRequests,logAppCheck,blockedActors}));
const recordStore = createRecordStore({ db });
exports.saveSortingRecord = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createSaveSortingRecordHandler({
  serverTimestamp: () => FieldValue.serverTimestamp(), store: recordStore, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, blockedActors, db
}));
const queryStore = createRecordQueryStore({ db });
exports.listSortingRecords=onRequest({region:"asia-northeast3",memory:"256MiB",timeoutSeconds:15,minInstances:0,maxInstances:2,concurrency:5,cors:false},createListSortingRecordsHandler({store:queryStore,access:deviceAccess,rateLimiter,actorRateLimiter,logAppCheck,blockedActors}));
exports.resolveSortingRecord=onRequest({region:"asia-northeast3",memory:"256MiB",timeoutSeconds:15,minInstances:0,maxInstances:2,concurrency:5,cors:false},createResolveSortingRecordHandler({store:queryStore,access:deviceAccess,serverTimestamp:()=>FieldValue.serverTimestamp(),rateLimiter,actorRateLimiter,logAppCheck,blockedActors}));
// Keeps schools/{schoolId}/classes/{grade_classNum} aggregate docs in sync
// with every sorting record create (saveSortingRecord) and held->completed
// transition (resolveSortingRecord) -- the PC dashboard reads only these
// small aggregate docs, never a student's individual records.
const aggregateSortingRecordWrite = createSortingRecordAggregator({ db, serverTimestamp: () => FieldValue.serverTimestamp() });
// 2026-09-02 재감사(비용 안전장치): 이 저장소의 20개 함수 중 유일하게 이
// 트리거만 memory/maxInstances가 비어 있었다 - HTTP 함수들은 전부
// maxInstances:2로 동시 인스턴스 수(=과금 상한)를 못박아 뒀는데, 기록이
// 써질 때마다 뜨는 이 트리거만 플랫폼 기본값(수백 인스턴스까지 확장 가능)
// 이라 컴퓨트 비용 상한이 사실상 없었다. 상류인 saveSortingRecord가 이미
// 전역 60/분으로 막혀 있어 실제 유입은 초당 1건 수준이고, 인스턴스 2개면
// (트랜잭션 1회당 ~100ms) 그 10배 이상을 처리한다.
exports.onSortingRecordWritten = onDocumentWritten({ region: "asia-northeast3", memory: "256MiB", maxInstances: 2, document: "actors/{actorId}/records/{recordId}" }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  try {
    await aggregateSortingRecordWrite(before, after);
  } catch (error) {
    // A failure here used to vanish silently: the student's record still
    // saves fine (this trigger runs after the fact), but the class/school
    // aggregate that saveSortingRecordCompleted and the dashboard both fed
    // on would quietly stop matching reality with no signal anywhere. Log
    // it at ERROR severity so it surfaces in Cloud Logging/alerts instead.
    logger.error({ message: "sorting_record_aggregation_failed", actorId: event.params?.actorId, recordId: event.params?.recordId, error: String(error && error.message ? error.message : error) });
    throw error;
  }
});
exports.getSchoolDashboard = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createGetSchoolDashboardHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, blockedActors
}));
exports.checkStudentProfile = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createCheckStudentProfileHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, blockedActors
}));
exports.registerStudentProfile = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createRegisterStudentProfileHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, blockedActors, serverTimestamp: () => FieldValue.serverTimestamp()
}));
exports.checkCampusLocation = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createCheckCampusLocationHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, blockedActors, serverTimestamp: () => FieldValue.serverTimestamp()
}));
exports.changeStudentClass = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createChangeStudentClassHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, blockedActors, serverTimestamp: () => FieldValue.serverTimestamp()
}));
exports.getClassRanking = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createGetClassRankingHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, blockedActors
}));
exports.searchSchool = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, secrets: [neisApiKey], cors: false }, createSearchSchoolHandler({
  getApiKey: () => neisApiKey.value(), access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, blockedActors, logger: (metadata) => logger.error(metadata)
}));
exports.checkTeacherStatus = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createCheckTeacherStatusHandler({
  db, access: deviceAccess, appCheck: emulatorAppCheck, rateLimiter, actorRateLimiter, logAppCheck, blockedActors
}));
exports.verifyTeacherCode = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createVerifyTeacherCodeHandler({
  db, access: deviceAccess, appCheck: emulatorAppCheck, rateLimiter, actorRateLimiter, logAppCheck, blockedActors, serverTimestamp: () => FieldValue.serverTimestamp(), logger: auditLog
}));
exports.listPendingRegistrations = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createListPendingRegistrationsHandler({
  db, access: deviceAccess, appCheck: emulatorAppCheck, rateLimiter, actorRateLimiter, logAppCheck, blockedActors
}));
exports.decideRegistration = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createDecideRegistrationHandler({
  db, access: deviceAccess, appCheck: emulatorAppCheck, rateLimiter, actorRateLimiter, logAppCheck, blockedActors, serverTimestamp: () => FieldValue.serverTimestamp(), logger: auditLog
}));
exports.manageTeacherCode = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createManageTeacherCodeHandler({
  db, appCheck: emulatorAppCheck, rateLimiter, logAppCheck, verifyIdToken: (token) => getAuth().verifyIdToken(token), serverTimestamp: () => FieldValue.serverTimestamp(), logger: auditLog
}));
exports.exportClassRecords = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 30, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createExportClassRecordsHandler({
  db, access: deviceAccess, appCheck: emulatorAppCheck, rateLimiter, actorRateLimiter, logAppCheck, blockedActors, logger: auditLog
}));
exports.anonymizeStudent = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createAnonymizeStudentHandler({
  db, access: deviceAccess, appCheck: emulatorAppCheck, rateLimiter, actorRateLimiter, logAppCheck, blockedActors, serverTimestamp: () => FieldValue.serverTimestamp(), logger: auditLog
}));
