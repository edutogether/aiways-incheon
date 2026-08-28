"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createGetClassRankingHandler } = require("../lib/classRanking");

// Fake covering both things classRanking.js touches: the actors/{actorId}
// school-lock transaction, and schools/{schoolId}/classes queries.
function fakeDb(classDocsBySchool) {
  const actors = new Map();
  return {
    collection(name) {
      if (name === "actors") {
        return {
          doc(actorId) {
            const path = `actors/${actorId}`;
            return { _path: path, actorId };
          }
        };
      }
      assert.equal(name, "schools");
      return {
        doc(schoolId) {
          return {
            collection(sub) {
              assert.equal(sub, "classes");
              return {
                where(field, op, value) {
                  assert.equal(field, "grade"); assert.equal(op, "==");
                  const all = classDocsBySchool[schoolId] || [];
                  const matched = all.filter((doc) => doc.grade === value);
                  return { async get() { return { docs: matched.map((data) => ({ data: () => data })) }; } };
                }
              };
            }
          };
        }
      };
    },
    async runTransaction(fn) {
      return fn({
        async get(ref) { const data = actors.get(ref._path); return { exists: !!data, data: () => data }; },
        set(ref, data) { actors.set(ref._path, { ...(actors.get(ref._path) || {}), ...data }); }
      });
    },
    _actors: actors
  };
}
function setup(classDocsBySchool) {
  const db = fakeDb(classDocsBySchool);
  return { db, handler: createGetClassRankingHandler({
    appCheck: async () => ({ status: "valid" }),
    access: { resolve: async () => ({ ok: true, actorId: "actor_1" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    db
  }) };
}
async function call(handler, body) {
  const result = {};
  await handler({ method: "POST", body, headers: {} }, { set() { return this; }, status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; }, send() { return this; } });
  return result;
}

test("only returns classes from the requested school and grade, ranked by score, own class flagged", async () => {
  const { handler } = setup({
    7341025: [
      { grade: "5", classNum: "1", completedTotal: 10, heldTotal: 2 },
      { grade: "5", classNum: "2", completedTotal: 30, heldTotal: 1 },
      { grade: "6", classNum: "1", completedTotal: 999, heldTotal: 0 } // wrong grade, must not appear
    ],
    7341099: [
      { grade: "5", classNum: "9", completedTotal: 999, heldTotal: 0 } // wrong school, must not appear
    ]
  });
  const result = await call(handler, { schoolId: "7341025", grade: "5", classNum: "1" });
  assert.equal(result.status, 200);
  assert.equal(result.body.classCount, 2);
  assert.deepEqual(result.body.classes.map((c) => c.classNum), ["2", "1"]); // ranked by score desc
  assert.equal(result.body.classes.find((c) => c.classNum === "1").isMine, true);
  assert.equal(result.body.classes.find((c) => c.classNum === "2").isMine, false);
});

test("rejects a schoolId containing a path separator or non-digit characters", async () => {
  const { handler } = setup({});
  const result = await call(handler, { schoolId: "a/b", grade: "5" });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "invalid_request");
});

test("rejects a missing grade", async () => {
  const { handler } = setup({});
  const result = await call(handler, { schoolId: "7341025" });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "invalid_request");
});

test("locks the actor's device to the first school it requests, rejects a later different school", async () => {
  const { handler } = setup({ 7341025: [], 9999999: [] });
  const first = await call(handler, { schoolId: "7341025", grade: "5" });
  assert.equal(first.status, 200);
  const second = await call(handler, { schoolId: "9999999", grade: "5" });
  assert.equal(second.status, 403);
  assert.equal(second.body.code, "school_mismatch");
  const third = await call(handler, { schoolId: "7341025", grade: "6" });
  assert.equal(third.status, 200); // same school, different grade is fine
});

test("repeated polls within the cache TTL reuse the cached classes read (2026-08-29: read-cost redesign)", async () => {
  let classesReadCount = 0;
  const db = fakeDb({ 7341025: [{ grade: "5", classNum: "1", completedTotal: 10, heldTotal: 0 }] });
  const rawCollection = db.collection.bind(db);
  db.collection = (name) => {
    const col = rawCollection(name);
    if (name !== "schools") return col;
    const rawDoc = col.doc.bind(col);
    return { doc: (schoolId) => {
      const docRef = rawDoc(schoolId);
      const rawSub = docRef.collection.bind(docRef);
      return { ...docRef, collection: (sub) => {
        const subCol = rawSub(sub);
        const rawWhere = subCol.where.bind(subCol);
        return { ...subCol, where: (...args) => {
          const query = rawWhere(...args);
          const rawGet = query.get.bind(query);
          return { ...query, get: async () => { classesReadCount += 1; return rawGet(); } };
        } };
      } };
    } };
  };
  const handler = createGetClassRankingHandler({
    appCheck: async () => ({ status: "valid" }),
    access: { resolve: async () => ({ ok: true, actorId: "actor_1" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    db
  });
  await call(handler, { schoolId: "7341025", grade: "5" });
  await call(handler, { schoolId: "7341025", grade: "5" });
  const third = await call(handler, { schoolId: "7341025", grade: "5" });
  assert.equal(classesReadCount, 1);
  assert.equal(third.body.classCount, 1);
});

test("returns 503 protection_unavailable instead of crashing when the school-lock transaction throws", async () => {
  const db = fakeDb({ 7341025: [] });
  db.runTransaction = async () => { throw new Error("firestore unavailable"); };
  const handler = createGetClassRankingHandler({
    appCheck: async () => ({ status: "valid" }),
    access: { resolve: async () => ({ ok: true, actorId: "actor_1" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    db
  });
  const result = await call(handler, { schoolId: "7341025", grade: "5" });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "protection_unavailable");
});
