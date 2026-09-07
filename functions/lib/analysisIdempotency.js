"use strict";
const { createHash } = require("node:crypto");
const ANALYSIS_REQUEST_SCHEMA = "analysis-request-v1";
const ANALYSIS_REQUEST_TTL_MS = 10 * 60 * 1000;
const PROCESSING_LOCK_MS = 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9-]{16,80}$/;
function validateIdempotencyKey(value) { return typeof value === "string" && KEY_PATTERN.test(value); }
function hashIdempotencyKey(actorId, value) { return createHash("sha256").update(`${actorId}\u0000${value === undefined ? actorId : value}`).digest("hex"); }
function getAnalysisRequestState(data, now = new Date()) { if (!data?.state) return "new"; if (data.state === "processing" && data.processingExpiresAt?.toDate ? data.processingExpiresAt.toDate() <= now : data.processingExpiresAt instanceof Date && data.processingExpiresAt <= now) return "expired"; return data.state; }
// 2026-09-07 종합감사 - 이 세 함수는 전부 catch{return ...}로 끝나서
// 실패 원인이 어디에도 로깅되지 않고 있었다(이번 세션에서 다른 15곳은
// 이미 보강했는데 이 파일만 빠져 있었음). completeAnalysisRequest는
// 특히 Gemini 호출을 이미 성공적으로 끝낸(=비용은 이미 나간) 뒤 결과를
// 저장하는 지점이라, 여기서 조용히 실패하면 "AI는 정상 응답했는데
// 학생 화면엔 계속 503만 뜨고 원인은 아무 데도 안 남는" 상태가 관측
// 불가능하게 지속된다 - logger를 주입해 나머지 파일들과 같은 패턴으로
// 맞춘다.
function createAnalysisIdempotency({ db, now = () => new Date(), serverTimestamp = () => new Date(), model, logger = () => {} }) {
  const refFor = (actorId, key) => db.collection("system_analysis_requests").doc(hashIdempotencyKey(actorId, key));
  async function claimAnalysisRequest(actorId, key) {
    const current=new Date(now()), keyHash=hashIdempotencyKey(actorId,key), ref=refFor(actorId,key);
    try { return await db.runTransaction(async tx=>{const snap=await tx.get(ref), data=snap.exists?(snap.data()||{}):{}, state=getAnalysisRequestState(data,current); if(state!=="new")return {state,result:data.result,errorCode:data.errorCode,httpStatus:data.httpStatus}; tx.create(ref,{schemaVersion:ANALYSIS_REQUEST_SCHEMA,keyHash,state:"processing",provider:"future_gemini",model,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),expireAt:new Date(current.getTime()+ANALYSIS_REQUEST_TTL_MS),processingExpiresAt:new Date(current.getTime()+PROCESSING_LOCK_MS)});return {state:"claimed",keyHash};}); }catch(error){logger({severity:"ERROR",message:"claim_analysis_request_failed",actorId,error:String(error?.message||error)});return {state:"unavailable"};}
  }
  async function completeAnalysisRequest(actorId,key,result) { try { await db.runTransaction(async tx=>tx.update(refFor(actorId,key),{state:"completed",updatedAt:serverTimestamp(),result})); return true;}catch(error){logger({severity:"ERROR",message:"complete_analysis_request_failed",actorId,error:String(error?.message||error)});return false;} }
  async function failAnalysisRequest(actorId,key,errorCode,httpStatus,retryAfterUntil) { try { await db.runTransaction(async tx=>tx.update(refFor(actorId,key),{state:"failed",updatedAt:serverTimestamp(),errorCode,httpStatus,...(retryAfterUntil?{retryAfterUntil}: {})})); return true;}catch(error){logger({severity:"ERROR",message:"fail_analysis_request_failed",actorId,error:String(error?.message||error)});return false;} }
  return { claimAnalysisRequest, completeAnalysisRequest, failAnalysisRequest };
}
module.exports={ANALYSIS_REQUEST_SCHEMA,ANALYSIS_REQUEST_TTL_MS,PROCESSING_LOCK_MS,validateIdempotencyKey,hashIdempotencyKey,getAnalysisRequestState,createAnalysisIdempotency};
