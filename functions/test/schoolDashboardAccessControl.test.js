"use strict";
// 개인별 랭킹(topStudents)이 검증된 studentProfile 없이는 절대 안 나가는지
// 확인한다. 예전엔 "이 기기가 처음 요청한 schoolId"만 고정하는 약한
// 잠금(dashboardSchoolId) 하나로 topStudents까지 같이 내려줬는데, 이건
// 브라우저 저장소만 지우면 매번 새 actor로 아무 학교/반이나 골라 실제
// 학생 번호+이름을 무제한 조회할 수 있는 구멍이었다(실제 아이들 정보라
// 심각도 최상단).
const test = require("node:test");
const assert = require("node:assert/strict");
const { createGetSchoolDashboardHandler } = require("../lib/schoolDashboard");

function makeFakeDb({ actors = {}, schools = {} } = {}) {
  function actorDocRef(id) {
    return {
      async get() {
        const data = actors[id];
        return { exists: !!data, data: () => data };
      },
      set(data, opts) {
        actors[id] = opts?.merge ? { ...(actors[id] || {}), ...data } : data;
      }
    };
  }
  function classDocRef(schoolId, classDocId) {
    const school = schools[schoolId] || {};
    const classes = school.classes || {};
    const cls = classes[classDocId] || {};
    return {
      collection(name) {
        if (name !== "students") throw new Error("unsupported subcollection " + name);
        const students = cls.students || [];
        return { async get() { return { docs: students.map((s) => ({ data: () => s })) }; } };
      }
    };
  }
  function schoolDocRef(schoolId) {
    const school = schools[schoolId];
    return {
      async get() { return { exists: !!school, data: () => school }; },
      collection(name) {
        if (name === "classes") {
          const classes = (school && school.classes) || {};
          return {
            async get() { return { docs: Object.values(classes).map((c) => ({ data: () => c })) }; },
            doc: (classDocId) => classDocRef(schoolId, classDocId)
          };
        }
        throw new Error("unsupported subcollection " + name);
      }
    };
  }
  return {
    collection(name) {
      if (name === "actors") return { doc: (id) => actorDocRef(id) };
      if (name === "schools") return { doc: (id) => schoolDocRef(id) };
      throw new Error("unsupported collection " + name);
    },
    async runTransaction(cb) {
      const tx = {
        async get(ref) { return ref.get(); },
        set(ref, data, opts) { return ref.set(data, opts); }
      };
      return cb(tx);
    }
  };
}

function baseDeps(db) {
  return {
    db,
    access: { resolve: async () => ({ ok: true, actorId: "actor_1" }) },
    appCheck: async () => ({ status: "valid" }),
    rateLimiter: { check: async () => ({ allowed: true }) },
    actorRateLimiter: { check: async () => ({ allowed: true }) },
    logAppCheck: () => {}
  };
}
function call(handler, body) {
  const out = {};
  const res = { set() { return this; }, status(c) { out.status = c; return this; }, json(v) { out.body = v; return this; }, send() { return this; } };
  return handler({ method: "POST", headers: { origin: "https://edutogether.github.io" }, body }, res).then(() => out);
}

const SCHOOL = { schoolName: "테스트초", classes: { "5_1": { grade: "5", classNum: "1", observedToday: 3, completedTotal: 2, heldTotal: 1, convertedTotal: 0, itemCounts: {}, students: [{ studentNumber: "7", studentName: "홍길동", completedTotal: 2 }] } } };

test("actor with no studentProfile gets an empty topStudents even though the class has real student data", async () => {
  const db = makeFakeDb({ actors: {}, schools: { "111": SCHOOL } });
  const handler = createGetSchoolDashboardHandler(baseDeps(db));
  const result = await call(handler, { schoolId: "111", grade: "5", classNum: "1" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.selectedClass.topStudents, []);
});

test("actor whose verified profile is a DIFFERENT class still gets an empty topStudents for this class", async () => {
  const db = makeFakeDb({
    actors: { actor_1: { dashboardSchoolId: "111", studentProfile: { schoolId: "111", grade: "5", classNum: "2" } } },
    schools: { "111": SCHOOL }
  });
  const handler = createGetSchoolDashboardHandler(baseDeps(db));
  const result = await call(handler, { schoolId: "111", grade: "5", classNum: "1" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.selectedClass.topStudents, []);
});

test("actor whose verified profile matches this exact school/grade/class DOES get topStudents", async () => {
  const db = makeFakeDb({
    actors: { actor_1: { dashboardSchoolId: "111", studentProfile: { schoolId: "111", grade: "5", classNum: "1" } } },
    schools: { "111": SCHOOL }
  });
  const handler = createGetSchoolDashboardHandler(baseDeps(db));
  const result = await call(handler, { schoolId: "111", grade: "5", classNum: "1" });
  assert.equal(result.status, 200);
  assert.equal(result.body.selectedClass.topStudents.length, 1);
  assert.equal(result.body.selectedClass.topStudents[0].studentName, "홍길동");
});

test("class-level aggregate numbers (observedToday, topItems, rank) are unaffected by profile matching", async () => {
  const db = makeFakeDb({ actors: {}, schools: { "111": SCHOOL } });
  const handler = createGetSchoolDashboardHandler(baseDeps(db));
  const result = await call(handler, { schoolId: "111", grade: "5", classNum: "1" });
  assert.equal(result.body.selectedClass.observedToday, 3);
  assert.equal(result.body.selectedClass.completedTotal, 2);
});
