"use strict";

// 2026-09-02 재감사(아키텍처): 이 계약(listSortingRecords/resolveSortingRecord가
// 실제로 Firestore를 어떻게 두드리는지)은 index.js 인라인 객체라 테스트가 전혀
// 닿지 않았다 - sortingRecordStore.js가 같은 이유로 분리되면서 남겨둔 교훈이
// 조회 쪽에는 적용이 안 돼 있었다. lib/sortingRecordQueryStore.js로 옮기고
// 여기서 고정한다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRecordQueryStore } = require("../lib/sortingRecordQueryStore");

function fakeDb({ records = [], existingCursorIds = [], resolutions = {} } = {}) {
  const calls = { startAfter: null, filter: null, limit: null, updates: null, created: null };
  const makeQuery = () => ({
    orderBy() { return this; },
    limit(value) { calls.limit = value; return this; },
    where(field, op, value) { calls.filter = { field, op, value }; return this; },
    startAfter(snapshot) { calls.startAfter = snapshot; return this; },
    async get() { return { docs: records.map((record) => ({ id: record.id, data: () => record.data })) }; }
  });
  const recordDoc = (id) => ({
    id,
    async get() { return { exists: existingCursorIds.includes(id), id, data: () => ({ status: "held" }) }; }
  });
  const db = {
    collection() {
      return {
        doc() {
          return {
            collection(name) {
              if (name === "_resolutions") {
                return { doc: (key) => ({ key, exists: !!resolutions[key] }) };
              }
              const query = makeQuery();
              return Object.assign(query, { doc: recordDoc });
            }
          };
        }
      };
    },
    async runTransaction(handler) {
      return handler({
        async get(ref) {
          if (ref.key !== undefined) return { exists: !!resolutions[ref.key], data: () => resolutions[ref.key] };
          return { exists: true, data: () => ({ status: "held" }) };
        },
        update(ref, value) { calls.updates = value; },
        create(ref, value) { calls.created = value; }
      });
    }
  };
  return { db, calls };
}

test("list returns one page plus a cursor only when there is genuinely another page", async () => {
  const rows = [1, 2, 3].map((n) => ({ id: `record_${n}`, data: { status: "completed" } }));
  const { db, calls } = fakeDb({ records: rows });
  const store = createRecordQueryStore({ db });
  const page = await store.list("actor_a", 2, "", "all");
  assert.equal(calls.limit, 3, "must fetch pageSize+1 so hasMore is known without an extra empty request");
  assert.equal(calls.filter, null, "statusFilter 'all' must not add a where clause");
  assert.deepEqual(page.records.map((r) => r.id), ["record_1", "record_2"]);
  assert.equal(page.nextCursor, "record_2");

  const { db: db2 } = fakeDb({ records: rows.slice(0, 2) });
  const lastPage = await createRecordQueryStore({ db: db2 }).list("actor_a", 2, "", "held");
  assert.equal(lastPage.nextCursor, null, "an exactly-full final page must not hand out a cursor");
});

test("a status filter is pushed into the query, not applied in memory", async () => {
  const { db, calls } = fakeDb({ records: [] });
  await createRecordQueryStore({ db }).list("actor_a", 20, "", "held");
  assert.deepEqual(calls.filter, { field: "status", op: "==", value: "held" });
});

test("a cursor pointing at a deleted record falls back to the first page instead of throwing", async () => {
  // 예전 index.js 인라인 구현은 존재하지 않는 DocumentSnapshot을 그대로
  // startAfter에 넘겨서 Firestore SDK 예외 -> 조회 전체가 503이 됐다.
  const { db, calls } = fakeDb({ records: [], existingCursorIds: [] });
  await createRecordQueryStore({ db }).list("actor_a", 20, "record_gone", "all");
  assert.equal(calls.startAfter, null, "a cursor for a record that no longer exists must be ignored");

  const { db: db2, calls: calls2 } = fakeDb({ records: [], existingCursorIds: ["record_here"] });
  await createRecordQueryStore({ db: db2 }).list("actor_a", 20, "record_here", "all");
  assert.equal(calls2.startAfter?.id, "record_here", "a valid cursor must still be applied");
});

test("resolve replays the stored result for a duplicate idempotency key instead of writing again", async () => {
  const stored = { recordId: "record_1", status: "completed", resolutionType: "confirmed_after_review" };
  const { db, calls } = fakeDb({ resolutions: { key_abc: stored } });
  const result = await createRecordQueryStore({ db }).resolve("actor_a", { recordId: "record_1", idempotencyKey: "key_abc", resolutionType: "confirmed_after_review" }, "SERVER");
  assert.equal(result.duplicate, true);
  assert.equal(calls.updates, null, "a duplicate resolution must not touch the record again");
});

test("resolve completes a held record and records the idempotency key in the same transaction", async () => {
  const { db, calls } = fakeDb({});
  const body = { recordId: "record_1", idempotencyKey: "key_new", resolutionType: "corrected_after_review", userDecision: { userConfirmed: true }, checklist: [{ id: "a", checked: true }] };
  const result = await createRecordQueryStore({ db }).resolve("actor_a", body, "SERVER");
  assert.equal(result.status, "completed");
  assert.equal(result.duplicate, false);
  assert.equal(calls.updates.status, "completed");
  assert.equal(calls.updates.resolvedAt, "SERVER");
  assert.equal(calls.created.recordId, "record_1");
});
