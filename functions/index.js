"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { createAnalyzeSortingHandler } = require("./lib/sortingVision");
const { createSaveSortingRecordHandler } = require("./lib/sortingRecord");
const { createListSortingRecordsHandler, createResolveSortingRecordHandler } = require("./lib/sortingRecordQuery");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
exports.analyzeSortingImage = onRequest({
  region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 30, minInstances: 0, maxInstances: 2, concurrency: 1,
  secrets: [geminiApiKey], cors: false
}, createAnalyzeSortingHandler({ getApiKey: () => geminiApiKey.value() }));

if (!getApps().length) initializeApp();
const db = getFirestore();
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
  allowTestActor: process.env.FUNCTIONS_EMULATOR === "true",
  serverTimestamp: () => FieldValue.serverTimestamp(), store: recordStore
}));
const queryStore = {
  async list(actorId, size, cursor, filter) { let q=db.collection("actors").doc(actorId).collection("records").orderBy("createdAt","desc").limit(size+1); if(filter!=="all") q=q.where("status","==",filter); if(cursor) q=q.startAfter(await db.collection("actors").doc(actorId).collection("records").doc(cursor).get()); const snap=await q.get(); const docs=snap.docs.slice(0,size); return {records:docs.map(d=>({id:d.id,data:d.data()})),nextCursor:snap.docs.length>size?docs.at(-1).id:null}; },
  async resolve(actorId,b,serverTime) { const record=db.collection("actors").doc(actorId).collection("records").doc(b.recordId); const key=db.collection("actors").doc(actorId).collection("_resolutions").doc(b.idempotencyKey); return db.runTransaction(async tx=>{const prior=await tx.get(key); if(prior.exists)return {...prior.data(),duplicate:true}; const snap=await tx.get(record); if(!snap.exists)return {code:"not_found"}; if(snap.data().status!=="held")return {code:"conflict"}; const result={recordId:b.recordId,status:"completed",resolutionType:b.resolutionType,duplicate:false}; tx.update(record,{status:"completed",updatedAt:serverTime,resolvedAt:serverTime,resolutionType:b.resolutionType,userDecision:b.userDecision,checklist:b.checklist}); tx.create(key,result); return result;}); }
};
exports.listSortingRecords=onRequest({region:"asia-northeast3",memory:"256MiB",timeoutSeconds:15,minInstances:0,maxInstances:2,concurrency:5,cors:false},createListSortingRecordsHandler({store:queryStore,allowTestActor:process.env.FUNCTIONS_EMULATOR==="true"}));
exports.resolveSortingRecord=onRequest({region:"asia-northeast3",memory:"256MiB",timeoutSeconds:15,minInstances:0,maxInstances:2,concurrency:5,cors:false},createResolveSortingRecordHandler({store:queryStore,allowTestActor:process.env.FUNCTIONS_EMULATOR==="true",serverTimestamp:()=>FieldValue.serverTimestamp()}));
