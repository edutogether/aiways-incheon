"use strict";
// 부품(protectedActor.js)이 아니라 배선을 검증한다 - protectActorRequest
// 자체는 blockedActors를 올바르게 처리하는데도(protectedActor.test.js),
// 9개 핸들러 파일이 각자 dependencies.blockedActors를 실제 호출부에
// 전달하는 걸 깜빡하면 아무 효과가 없었다(실제로 그랬던 버그).
// 이 테스트는 각 실제 export된 핸들러를 blockedActors.isBlocked=true로
// 직접 호출해서, 진짜 403 actor_blocked가 나오는지 하나씩 확인한다.
const test = require("node:test");
const assert = require("node:assert/strict");

function res() {
  const out = {};
  return {
    out,
    set() { return this; },
    status(code) { out.status = code; return this; },
    json(value) { out.body = value; return this; },
    send(value) { out.body = value; return this; }
  };
}

const baseDeps = {
  appCheck: async () => ({ status: "valid" }),
  access: { resolve: async () => ({ ok: true, actorId: "blocked_actor" }) },
  rateLimiter: { check: async () => ({ allowed: true }) },
  actorRateLimiter: { check: async () => ({ allowed: true }) },
  logAppCheck: () => {},
  blockedActors: { isBlocked: async (actorId) => actorId === "blocked_actor" },
  db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }) },
  serverTimestamp: () => "SERVER_TIMESTAMP",
  getApiKey: () => "fake-key",
  store: {}
};

async function assertBlocked(name, handler, body = {}, extraHeaders = {}) {
  const response = res();
  await handler({ method: "POST", headers: { origin: "https://edutogether.github.io", ...extraHeaders }, body }, response);
  assert.equal(response.out.status, 403, `${name}: expected 403, got ${response.out.status} (${JSON.stringify(response.out.body)})`);
  assert.equal(response.out.body?.code, "actor_blocked", `${name}: expected actor_blocked`);
}

test("blocked actor is rejected by every handler that wires blockedActors through", async () => {
  const { createCheckStudentProfileHandler, createRegisterStudentProfileHandler, createChangeStudentClassHandler } = require("../lib/studentProfile");
  await assertBlocked("checkStudentProfile", createCheckStudentProfileHandler(baseDeps));
  await assertBlocked("registerStudentProfile", createRegisterStudentProfileHandler(baseDeps));
  await assertBlocked("changeStudentClass", createChangeStudentClassHandler(baseDeps));

  const { createCheckCampusLocationHandler } = require("../lib/campusLocation");
  await assertBlocked("checkCampusLocation", createCheckCampusLocationHandler(baseDeps));

  const { createGetClassRankingHandler } = require("../lib/classRanking");
  await assertBlocked("getClassRanking", createGetClassRankingHandler(baseDeps));

  const { createGetSchoolDashboardHandler } = require("../lib/schoolDashboard");
  await assertBlocked("getSchoolDashboard", createGetSchoolDashboardHandler(baseDeps));

  const { createSearchSchoolHandler } = require("../lib/schoolSearch");
  await assertBlocked("searchSchool", createSearchSchoolHandler(baseDeps));

  const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");
  await assertBlocked("saveSortingRecord", createSaveSortingRecordHandler(baseDeps));

  const { createAnalyzeSortingHandler } = require("../lib/sortingVision");
  await assertBlocked("analyzeSortingImage", createAnalyzeSortingHandler(baseDeps));

  const { createAnalyzeSortingTextHandler } = require("../lib/sortingTextTip");
  await assertBlocked("analyzeSortingText", createAnalyzeSortingTextHandler(baseDeps));

  const { createSortingSafetyObserverHandler } = require("../lib/sortingSafetyObserver");
  await assertBlocked("analyzeSortingSafetyObserver", createSortingSafetyObserverHandler(baseDeps));
});

test("blocked actor is rejected by every edu2g handler (session/list/revoke/redeem)", async () => {
  const { createEdu2gHandlers } = require("../lib/edu2gPassHandlers");
  const edu2gDeps = {
    ...baseDeps,
    access: { resolve: async () => ({ ok: true, actorId: "blocked_actor", uid: "blocked_uid" }), authenticate: async () => ({ ok: true, uid: "blocked_uid" }) },
    registry: { identify: async () => ({ ok: true, actor: { actorId: "blocked_actor", displayName: "테스트" } }) },
    store: { prepare: async () => ({ ok: true }), session: async () => ({ actor: {}, device: {} }), list: async () => [], revoke: async () => ({ ok: true }) }
  };
  const handlers = createEdu2gHandlers(edu2gDeps);
  const json = { "content-type": "application/json" };
  await assertBlocked("getEdu2gSession", handlers.session, {}, json);
  await assertBlocked("listEdu2gTrustedDevices", handlers.list, {}, json);
  await assertBlocked("revokeEdu2gTrustedDevice", handlers.revoke, { targetManagementId: "00000000-0000-4000-8000-000000000001", confirm: true }, json);
  await assertBlocked("redeemEdu2gPass", handlers.redeem, { loginId: "student alpha", deviceLabel: "내 기기", platform: "web", confirm: true }, json);
});
