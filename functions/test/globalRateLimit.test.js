"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { RATE_LIMIT_SCHEMA, getUtcBuckets, getRetryAfterSeconds, createGlobalRateLimiter } = require("../lib/globalRateLimit");
const { createAnalyzeSortingHandler } = require("../lib/sortingVision");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");
const { createListSortingRecordsHandler, createResolveSortingRecordHandler } = require("../lib/sortingRecordQuery");

function memoryDb() { const docs=new Map(); return { docs, collection(name){return {doc(id){return {key:`${name}/${id}`};}}}, async runTransaction(work){const tx={get:async ref=>({exists:docs.has(ref.key),data:()=>docs.get(ref.key)}),set:(ref,data)=>docs.set(ref.key,{...(docs.get(ref.key)||{}),...data})};return work(tx);} }; }
function response() { const out={headers:{}}; return { out, set(k,v){out.headers[k]=v;return this;}, status(s){out.status=s;return this;}, json(b){out.body=b;return this;}, send(b){out.body=b;return this;} }; }
async function invoke(handler, body={}) { const res=response(); await handler({method:"POST",headers:{"content-type":"application/json"},body},res); return res.out; }
const imageData=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+QKQe2QAAAABJRU5ErkJggg==","base64").toString("base64");
const imageBody={schemaVersion:"sorting-vision-v1",requestId:"rate-request",sessionId:"rate-session",idempotencyKey:"123e4567-e89b-42d3-a456-426614174000",locale:"ko-KR",source:"future_gemini",image:{mimeType:"image/png",data:imageData},imageMetadata:{mimeType:"image/png",width:1,height:1,byteLength:70},userContext:{}};

test("uses UTC buckets, retry bounds and deterministic rate-limit documents", async () => {
  let now=new Date("2026-07-28T23:59:59.500Z"); const db=memoryDb(); const limiter=createGlobalRateLimiter({db,now:()=>now,serverTimestamp:()=>"SERVER"});
  assert.deepEqual(getUtcBuckets(now),{utcDate:"20260728",minuteKey:"2359"}); assert.equal(getRetryAfterSeconds(now,"minute_limited"),1); assert.equal(getRetryAfterSeconds(now,"daily_limited"),1);
  for(let i=0;i<8;i++)assert.equal((await limiter.check("analyzeSortingImage")).allowed,true);
  const limited=await limiter.check("analyzeSortingImage"); assert.equal(limited.outcome,"minute_limited"); assert.equal(limited.retryAfterSeconds,1);
  const doc=db.docs.get("system_rate_limits/analyzeSortingImage-20260728"); assert.equal(doc.schemaVersion,RATE_LIMIT_SCHEMA); assert.equal(doc.functionName,"analyzeSortingImage"); assert.equal(doc.utcDate,"20260728"); assert.equal(doc.totalCount,8); assert.equal(doc.minuteCounts["2359"],8); assert.equal(doc.expireAt.toISOString(),"2026-07-31T00:00:00.000Z");
  now=new Date("2026-07-29T00:00:00.000Z"); assert.equal((await limiter.check("analyzeSortingImage")).allowed,true); assert.ok(db.docs.has("system_rate_limits/analyzeSortingImage-20260729"));
});

test("enforces daily and record-function minute limits", async () => {
  const db=memoryDb(); const limiter=createGlobalRateLimiter({db,now:()=>new Date("2026-07-28T12:00:00Z")});
  for(let i=0;i<200;i++){ const value=await limiter.check("analyzeSortingImage"); if((i+1)%8===0) db.docs.get("system_rate_limits/analyzeSortingImage-20260728").minuteCounts={}; }
  assert.equal((await limiter.check("analyzeSortingImage")).outcome,"daily_limited");
  for (const [name,max] of [["saveSortingRecord",60],["listSortingRecords",120],["resolveSortingRecord",60]]) { const own=createGlobalRateLimiter({db:memoryDb(),now:()=>new Date("2026-07-28T12:00:00Z")}); for(let i=0;i<max;i++)assert.equal((await own.check(name)).allowed,true); assert.equal((await own.check(name)).outcome,"minute_limited"); }
});

test("handlers reject limits and failures before provider or record operations", async () => {
  let provider=0; const limited={check:async()=>({allowed:false,outcome:"minute_limited",retryAfterSeconds:9})};
  const requests={claimAnalysisRequest:async()=>({state:"claimed"}),completeAnalysisRequest:async()=>true,failAnalysisRequest:async()=>true}; const analyze=createAnalyzeSortingHandler({getApiKey:()=>"mock",rateLimiter:limited,analysisRequests:requests,createClient:()=>({models:{generateContent:async()=>{provider++;}}})}); const result=await invoke(analyze,imageBody); assert.equal(result.status,429); assert.equal(result.body.code,"rate_limit_exceeded"); assert.equal(result.headers["Retry-After"],"9"); assert.equal(provider,0);
  const unavailable=createAnalyzeSortingHandler({getApiKey:()=>"mock",rateLimiter:{check:async()=>({allowed:false,outcome:"unavailable"})},analysisRequests:requests,createClient:()=>({models:{generateContent:async()=>{provider++;}}})}); assert.equal((await invoke(unavailable,imageBody)).body.code,"protection_unavailable"); assert.equal(provider,0);
  const guard={check:async()=>{throw new Error("must not run")}}; const save=createSaveSortingRecordHandler({allowTestActor:false,rateLimiter:guard,store:{}}); assert.equal((await invoke(save,{})).body.code,"invalid_schema");
  const list=createListSortingRecordsHandler({allowTestActor:false,rateLimiter:guard,store:{}}); assert.equal((await invoke(list,{})).body.code,"actor_not_resolved");
  const resolve=createResolveSortingRecordHandler({allowTestActor:false,rateLimiter:guard,store:{}}); assert.equal((await invoke(resolve,{})).body.code,"actor_not_resolved");
});
