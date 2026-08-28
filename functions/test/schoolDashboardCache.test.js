"use strict";
// 2026-08-26 재감사 지적: 5초마다 폴링하는 대시보드가 매번 학교의 반
// 전체 컬렉션을 캐시 없이 다시 읽고 있었다. 짧은 인스턴스 캐시가 실제로
// Firestore 읽기 횟수를 줄이는지, 그리고 학교 간에 캐시가 섞이지 않는지
// 확인한다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createGetSchoolDashboardHandler } = require("../lib/schoolDashboard");

function makeCountingDb(schools, actorsInit = {}) {
  let classesReadCount = 0;
  let studentsReadCount = 0;
  let actorReadCount = 0;
  const actors = { ...actorsInit };
  function classDocRef(schoolId, classDocId) {
    const school = schools[schoolId] || { classes: {} };
    const students = (school.students && school.students[classDocId]) || [];
    return {
      collection(name) {
        assert.equal(name, "students");
        return { async get() { studentsReadCount += 1; return { docs: students.map((s) => ({ data: () => s })) }; } };
      }
    };
  }
  function schoolDocRef(schoolId) {
    const school = schools[schoolId] || { classes: {} };
    return {
      async get() { return { exists: true, data: () => school }; },
      collection(name) {
        if (name === "classes") return {
          async get() { classesReadCount += 1; return { docs: Object.values(school.classes).map((c) => ({ data: () => c })) }; },
          doc: (classDocId) => classDocRef(schoolId, classDocId)
        };
        throw new Error("unsupported subcollection " + name);
      }
    };
  }
  const db = {
    collection(name) {
      if (name === "actors") return { doc: (id) => ({ async get() { actorReadCount += 1; const data = actors[id]; return { exists: !!data, data: () => data }; }, set(data, opts) { actors[id] = opts?.merge ? { ...(actors[id] || {}), ...data } : data; } }) };
      if (name === "schools") return { doc: schoolDocRef };
      throw new Error("unsupported collection " + name);
    },
    async runTransaction(cb) { return cb({ async get(ref) { return ref.get(); }, set(ref, data, opts) { ref.set(data, opts); } }); }
  };
  return { db, readCount: () => classesReadCount, studentsReadCount: () => studentsReadCount, actorReadCount: () => actorReadCount };
}
async function call(handler, body) {
  const result = {};
  await handler({ method: "POST", body, headers: {} }, { set() { return this; }, status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; }, send() { return this; } });
  return result;
}

test("repeated polls within the cache TTL reuse the cached classes read", async () => {
  const { db, readCount } = makeCountingDb({ "7341025": { classes: {} } });
  let clock = 1000;
  const handler = createGetSchoolDashboardHandler({
    appCheck: async () => ({ status: "valid" }), access: { resolve: async () => ({ ok: true, actorId: "actor_1" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) }, actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    db, now: () => clock
  });
  await call(handler, { schoolId: "7341025" });
  assert.equal(readCount(), 1);
  clock += 2000; // still inside the 4s TTL
  await call(handler, { schoolId: "7341025" });
  assert.equal(readCount(), 1, "second poll inside TTL should not re-read Firestore");
  clock += 5000; // now past the TTL
  await call(handler, { schoolId: "7341025" });
  assert.equal(readCount(), 2, "poll after TTL expiry should re-read Firestore");
});

test("cache is isolated per school", async () => {
  const { db, readCount } = makeCountingDb({ "7341025": { classes: {} }, "9999999": { classes: {} } });
  let clock = 1000;
  const handler = createGetSchoolDashboardHandler({
    appCheck: async () => ({ status: "valid" }), access: { resolve: async () => ({ ok: true, actorId: "actor_1" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) }, actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    db, now: () => clock
  });
  const first = await call(handler, { schoolId: "7341025" });
  assert.equal(first.status, 200);
  // Same actor requesting a different school is blocked by the school-lock
  // (school_mismatch), which is correct and separate from caching -- so this
  // test only asserts the cache read count is per-schoolId, using a fresh
  // actor for the second school to isolate the cache behavior being tested.
  const handler2 = createGetSchoolDashboardHandler({
    appCheck: async () => ({ status: "valid" }), access: { resolve: async () => ({ ok: true, actorId: "actor_2" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) }, actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    db, now: () => clock
  });
  const second = await call(handler2, { schoolId: "9999999" });
  assert.equal(second.status, 200);
  assert.equal(readCount(), 2, "each school's first request should read Firestore independently");
});

test("2026-08-29 (cost review): repeated polls within TTL reuse the cached school-lock check, but a different school from the same actor is still correctly rejected", async () => {
  const { db, actorReadCount } = makeCountingDb({ "7341025": { classes: {} }, "9999999": { classes: {} } });
  let clock = 1000;
  const handler = createGetSchoolDashboardHandler({
    appCheck: async () => ({ status: "valid" }), access: { resolve: async () => ({ ok: true, actorId: "actor_1" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) }, actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    db, now: () => clock
  });
  const first = await call(handler, { schoolId: "7341025" });
  assert.equal(first.status, 200);
  assert.equal(actorReadCount(), 1);
  clock += 2000; // still inside the 5.5s lock-cache TTL
  const second = await call(handler, { schoolId: "7341025" });
  assert.equal(second.status, 200);
  assert.equal(actorReadCount(), 1, "second poll inside TTL should reuse the cached lock check, not re-read the actor doc");
  // Regression check (this exact bug shipped once and was caught by classRanking's
  // equivalent test): the cache must not blindly replay the FIRST request's verdict --
  // a request for a different schoolId, even while the lock cache is still warm,
  // must still be freshly compared and rejected.
  const thirdWrongSchool = await call(handler, { schoolId: "9999999" });
  assert.equal(thirdWrongSchool.status, 403);
  assert.equal(thirdWrongSchool.body.code, "school_mismatch");
});

test("topStudents (2026-08-27 fix) also reuses the cache within TTL for a verified profile's own class", async () => {
  const { db, studentsReadCount } = makeCountingDb(
    { "7341025": { classes: {}, students: { "5_1": [{ studentNumber: "3", studentName: "김철수", completedTotal: 4 }] } } },
    { actor_1: { studentProfile: { schoolId: "7341025", grade: "5", classNum: "1" } } }
  );
  let clock = 1000;
  const handler = createGetSchoolDashboardHandler({
    appCheck: async () => ({ status: "valid" }), access: { resolve: async () => ({ ok: true, actorId: "actor_1" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) }, actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    db, now: () => clock
  });
  const first = await call(handler, { schoolId: "7341025", grade: "5", classNum: "1" });
  assert.equal(first.body.selectedClass.topStudents.length, 1);
  assert.equal(studentsReadCount(), 1);
  clock += 2000; // still inside the 5.5s TTL
  await call(handler, { schoolId: "7341025", grade: "5", classNum: "1" });
  assert.equal(studentsReadCount(), 1, "second poll inside TTL should reuse the cached student list");
  clock += 5000; // now past the TTL
  await call(handler, { schoolId: "7341025", grade: "5", classNum: "1" });
  assert.equal(studentsReadCount(), 2, "poll after TTL expiry should re-read the student list");
});
