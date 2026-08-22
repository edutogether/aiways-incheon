"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const { createAnalyzeSortingHandler } = require("./lib/sortingVision");
const { createAnalyzeSortingTextHandler } = require("./lib/sortingTextTip");
const { createSortingSafetyObserverHandler } = require("./lib/sortingSafetyObserver");
const { createSaveSortingRecordHandler } = require("./lib/sortingRecord");
const { createListSortingRecordsHandler, createResolveSortingRecordHandler } = require("./lib/sortingRecordQuery");
const { createSortingRecordAggregator } = require("./lib/schoolDashboardAggregate");
const { createGetSchoolDashboardHandler } = require("./lib/schoolDashboard");
const { createCheckStudentProfileHandler, createRegisterStudentProfileHandler, createChangeStudentClassHandler } = require("./lib/studentProfile");
const { createCheckCampusLocationHandler } = require("./lib/campusLocation");
const { createGetNationalRankingHandler } = require("./lib/nationalRanking");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { createGlobalRateLimiter, createActorRateLimiter } = require("./lib/globalRateLimit");
const { createAnalysisIdempotency } = require("./lib/analysisIdempotency");
const { createEdu2gPassRegistry } = require("./lib/edu2gPassRegistry");
const { createEdu2gDeviceAccess } = require("./lib/edu2gDeviceAccess");
const { createFirestoreDeviceStore, createEdu2gHandlers } = require("./lib/edu2gPassHandlers");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const edu2gPassRegistrySecret = defineSecret("EDU2G_PASS_REGISTRY_JSON");
if (!getApps().length) initializeApp();
const db = getFirestore();
const rateLimiter = createGlobalRateLimiter({ db, serverTimestamp: () => FieldValue.serverTimestamp() });
const actorRateLimiter = createActorRateLimiter({ db, serverTimestamp: () => FieldValue.serverTimestamp() });
const deviceAccess = createEdu2gDeviceAccess({ auth: getAuth(), db, serverTimestamp: () => FieldValue.serverTimestamp() });
const analysisRequests = createAnalysisIdempotency({ db, serverTimestamp: () => FieldValue.serverTimestamp(), model: "gemini-3.5-flash-lite" });
const logAppCheck = (metadata) => logger.write({ severity: metadata?.status === "invalid" || metadata?.status === "unavailable" ? "WARNING" : "INFO", ...metadata });
exports.analyzeSortingImage = onRequest({
  region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 30, minInstances: 0, maxInstances: 2, concurrency: 1,
  secrets: [geminiApiKey], cors: false
}, createAnalyzeSortingHandler({ getApiKey: () => geminiApiKey.value(), access: deviceAccess, rateLimiter, actorRateLimiter, analysisRequests, logAppCheck }));
exports.analyzeSortingText = onRequest({
  region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 20, minInstances: 0, maxInstances: 2, concurrency: 2,
  secrets: [geminiApiKey], cors: false
}, createAnalyzeSortingTextHandler({ getApiKey: () => geminiApiKey.value(), access: deviceAccess, rateLimiter, actorRateLimiter, analysisRequests, logAppCheck }));
exports.analyzeSortingSafetyObserver = onRequest({ region:"asia-northeast3", memory:"256MiB", timeoutSeconds:30, minInstances:0, maxInstances:2, concurrency:1, secrets:[geminiApiKey], cors:false }, createSortingSafetyObserverHandler({getApiKey:()=>geminiApiKey.value(),access:deviceAccess,rateLimiter,actorRateLimiter,analysisRequests,logAppCheck}));
const recordStore = {
  async createOrGet(actorId, idempotencyKey, record, response) {
    const actor = db.collection("actors").doc(actorId);
    const idempotency = actor.collection("_idempotency").doc(idempotencyKey);
    return db.runTransaction(async (transaction) => {
      const existing = await transaction.get(idempotency);
      if (existing.exists) return { ...existing.data(), duplicate: true };
      const recordRef = actor.collection("records").doc();
      transaction.create(recordRef, record);
      transaction.create(idempotency, { recordId: recordRef.id, status: record.status, createdAt: response.createdAt, expireAt: response.expireAt });
      return { recordId: recordRef.id, status: record.status, ...response, duplicate: false };
    });
  }
};
exports.saveSortingRecord = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createSaveSortingRecordHandler({
  serverTimestamp: () => FieldValue.serverTimestamp(), store: recordStore, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, db
}));
const queryStore = {
  async list(actorId, size, cursor, filter) { let q=db.collection("actors").doc(actorId).collection("records").orderBy("createdAt","desc").limit(size+1); if(filter!=="all") q=q.where("status","==",filter); if(cursor) q=q.startAfter(await db.collection("actors").doc(actorId).collection("records").doc(cursor).get()); const snap=await q.get(); const docs=snap.docs.slice(0,size); return {records:docs.map(d=>({id:d.id,data:d.data()})),nextCursor:snap.docs.length>size?docs.at(-1).id:null}; },
  async resolve(actorId,b,serverTime) { const record=db.collection("actors").doc(actorId).collection("records").doc(b.recordId); const key=db.collection("actors").doc(actorId).collection("_resolutions").doc(b.idempotencyKey); return db.runTransaction(async tx=>{const prior=await tx.get(key); if(prior.exists)return {...prior.data(),duplicate:true}; const snap=await tx.get(record); if(!snap.exists)return {code:"not_found"}; if(snap.data().status!=="held")return {code:"conflict"}; const result={recordId:b.recordId,status:"completed",resolutionType:b.resolutionType,duplicate:false}; tx.update(record,{status:"completed",updatedAt:serverTime,resolvedAt:serverTime,resolutionType:b.resolutionType,userDecision:b.userDecision,checklist:b.checklist}); tx.create(key,result); return result;}); }
};
exports.listSortingRecords=onRequest({region:"asia-northeast3",memory:"256MiB",timeoutSeconds:15,minInstances:0,maxInstances:2,concurrency:5,cors:false},createListSortingRecordsHandler({store:queryStore,access:deviceAccess,rateLimiter,actorRateLimiter,logAppCheck}));
exports.resolveSortingRecord=onRequest({region:"asia-northeast3",memory:"256MiB",timeoutSeconds:15,minInstances:0,maxInstances:2,concurrency:5,cors:false},createResolveSortingRecordHandler({store:queryStore,access:deviceAccess,serverTimestamp:()=>FieldValue.serverTimestamp(),rateLimiter,actorRateLimiter,logAppCheck}));
// Keeps schools/{schoolId}/classes/{grade_classNum} aggregate docs in sync
// with every sorting record create (saveSortingRecord) and held->completed
// transition (resolveSortingRecord) -- the PC dashboard reads only these
// small aggregate docs, never a student's individual records.
const aggregateSortingRecordWrite = createSortingRecordAggregator({ db, serverTimestamp: () => FieldValue.serverTimestamp() });
exports.onSortingRecordWritten = onDocumentWritten({ region: "asia-northeast3", document: "actors/{actorId}/records/{recordId}" }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  await aggregateSortingRecordWrite(before, after);
});
exports.getSchoolDashboard = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createGetSchoolDashboardHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck
}));
exports.checkStudentProfile = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createCheckStudentProfileHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck
}));
exports.registerStudentProfile = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createRegisterStudentProfileHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, serverTimestamp: () => FieldValue.serverTimestamp()
}));
exports.checkCampusLocation = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createCheckCampusLocationHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, serverTimestamp: () => FieldValue.serverTimestamp()
}));
exports.changeStudentClass = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createChangeStudentClassHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck, serverTimestamp: () => FieldValue.serverTimestamp()
}));
exports.getNationalRanking = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false }, createGetNationalRankingHandler({
  db, access: deviceAccess, rateLimiter, actorRateLimiter, logAppCheck
}));
const edu2gHandlers = createEdu2gHandlers({
  registry: createEdu2gPassRegistry({ getSecret: () => edu2gPassRegistrySecret.value() }),
  access: deviceAccess,
  store: createFirestoreDeviceStore({ db, serverTimestamp: () => FieldValue.serverTimestamp() }), rateLimiter, actorRateLimiter, logAppCheck
});
const edu2gOptions = { region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 15, minInstances: 0, maxInstances: 2, concurrency: 5, cors: false };
exports.redeemEdu2gPass = onRequest({ ...edu2gOptions, secrets: [edu2gPassRegistrySecret] }, edu2gHandlers.redeem);
exports.getEdu2gSession = onRequest(edu2gOptions, edu2gHandlers.session);
exports.listEdu2gTrustedDevices = onRequest(edu2gOptions, edu2gHandlers.list);
exports.revokeEdu2gTrustedDevice = onRequest(edu2gOptions, edu2gHandlers.revoke);
