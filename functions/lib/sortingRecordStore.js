"use strict";

// Extracted out of index.js (2026-08-26) after a real production incident:
// this was the ONLY implementation of the idempotent record-write contract,
// living inline where no test could reach it. sortingRecord.js's own test
// uses an injected fake store, so when sortingRecord.js stopped supplying
// `expireAt` (90-day TTL removal), nothing caught that this file's
// `expireAt: response.expireAt` still read the now-missing field as
// `undefined` -- which Firestore's admin SDK rejects outright (it throws
// synchronously unless `ignoreUndefinedProperties` is set, which this
// project does not set). Every saveSortingRecord call 500'd in production
// with all 120 unit tests green. Pulling this into its own file with
// dependency injection is what makes createRecordStore.test.js possible.
function createRecordStore({ db }) {
  return {
    async createOrGet(actorId, idempotencyKey, record, response) {
      const actor = db.collection("actors").doc(actorId);
      const idempotency = actor.collection("_idempotency").doc(idempotencyKey);
      return db.runTransaction(async (transaction) => {
        const existing = await transaction.get(idempotency);
        if (existing.exists) return { ...existing.data(), duplicate: true };
        const recordRef = actor.collection("records").doc();
        transaction.create(recordRef, record);
        transaction.create(idempotency, { recordId: recordRef.id, status: record.status, createdAt: response.createdAt });
        return { recordId: recordRef.id, status: record.status, ...response, duplicate: false };
      });
    }
  };
}

module.exports = { createRecordStore };
