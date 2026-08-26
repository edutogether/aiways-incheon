"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createGetClassRankingHandler } = require("../lib/classRanking");

// A tiny fake matching only what classRanking.js actually calls:
// db.collection("schools").doc(schoolId).collection("classes").where("grade","==",grade).get()
function fakeDb(classDocsBySchool) {
  return {
    collection(name) {
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
    }
  };
}
function setup(classDocsBySchool) {
  return createGetClassRankingHandler({
    appCheck: async () => ({ status: "valid" }),
    access: { resolve: async () => ({ ok: true, actorId: "actor_1" }) },
    rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    actorRateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
    db: fakeDb(classDocsBySchool)
  });
}
async function call(handler, body) {
  const result = {};
  await handler({ method: "POST", body, headers: {} }, { set() { return this; }, status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; }, send() { return this; } });
  return result;
}

test("only returns classes from the requested school and grade, ranked by score, own class flagged", async () => {
  const handler = setup({
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
  const handler = setup({});
  const result = await call(handler, { schoolId: "a/b", grade: "5" });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "invalid_request");
});

test("rejects a missing grade", async () => {
  const handler = setup({});
  const result = await call(handler, { schoolId: "7341025" });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "invalid_request");
});
