"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { protectActorRequest } = require("../lib/protectedActor");
test("protected actor order stops before identity when App Check is rejected", async () => {
  let resolved = 0, limited = 0;
  const result = await protectActorRequest({ req:{}, functionName:"saveSortingRecord", appCheck:async()=>({httpStatus:401,code:"app_check_missing"}), access:{resolve:async()=>{resolved+=1;}}, globalRateLimiter:{check:async()=>{limited+=1;}}, actorRateLimiter:{check:async()=>{limited+=1;}} });
  assert.deepEqual(result,{ok:false,httpStatus:401,code:"app_check_missing"}); assert.equal(resolved,0); assert.equal(limited,0);
});
test("protected actor resolves server actor then applies independent limits", async () => {
  const calls=[]; const result=await protectActorRequest({req:{},functionName:"saveSortingRecord",appCheck:async()=>({}),access:{resolve:async()=>({ok:true,actorId:"actor_alpha"})},globalRateLimiter:{check:async(...args)=>{calls.push(args);return{allowed:true};}},actorRateLimiter:{check:async(...args)=>{calls.push(args);return{allowed:true};}}});
  assert.equal(result.actorId,"actor_alpha"); assert.deepEqual(calls,[["saveSortingRecord","actor_alpha"],["saveSortingRecord","actor_alpha"]]);
});
