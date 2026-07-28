"use strict";
const { createHash } = require("node:crypto");
const ANALYSIS_REQUEST_SCHEMA = "analysis-request-v1";
const ANALYSIS_REQUEST_TTL_MS = 10 * 60 * 1000;
const PROCESSING_LOCK_MS = 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9-]{16,80}$/;
function validateIdempotencyKey(value) { return typeof value === "string" && KEY_PATTERN.test(value); }
function hashIdempotencyKey(value) { return createHash("sha256").update(value).digest("hex"); }
function getAnalysisRequestState(data, now = new Date()) { if (!data?.state) return "new"; if (data.state === "processing" && data.processingExpiresAt?.toDate ? data.processingExpiresAt.toDate() <= now : data.processingExpiresAt instanceof Date && data.processingExpiresAt <= now) return "expired"; return data.state; }
function createAnalysisIdempotency({ db, now = () => new Date(), serverTimestamp = () => new Date(), model }) {
  const refFor = key => db.collection("system_analysis_requests").doc(hashIdempotencyKey(key));
  async function claimAnalysisRequest(key) {
    const current=new Date(now()), keyHash=hashIdempotencyKey(key), ref=refFor(key);
    try { return await db.runTransaction(async tx=>{const snap=await tx.get(ref), data=snap.exists?(snap.data()||{}):{}, state=getAnalysisRequestState(data,current); if(state!=="new")return {state,result:data.result,errorCode:data.errorCode,httpStatus:data.httpStatus}; tx.create(ref,{schemaVersion:ANALYSIS_REQUEST_SCHEMA,keyHash,state:"processing",provider:"future_gemini",model,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),expireAt:new Date(current.getTime()+ANALYSIS_REQUEST_TTL_MS),processingExpiresAt:new Date(current.getTime()+PROCESSING_LOCK_MS)});return {state:"claimed",keyHash};}); }catch{return {state:"unavailable"};}
  }
  async function completeAnalysisRequest(key,result) { try { await db.runTransaction(async tx=>tx.update(refFor(key),{state:"completed",updatedAt:serverTimestamp(),result})); return true;}catch{return false;} }
  async function failAnalysisRequest(key,errorCode,httpStatus,retryAfterUntil) { try { await db.runTransaction(async tx=>tx.update(refFor(key),{state:"failed",updatedAt:serverTimestamp(),errorCode,httpStatus,...(retryAfterUntil?{retryAfterUntil}: {})})); return true;}catch{return false;} }
  return { claimAnalysisRequest, completeAnalysisRequest, failAnalysisRequest };
}
module.exports={ANALYSIS_REQUEST_SCHEMA,ANALYSIS_REQUEST_TTL_MS,PROCESSING_LOCK_MS,validateIdempotencyKey,hashIdempotencyKey,getAnalysisRequestState,createAnalysisIdempotency};
