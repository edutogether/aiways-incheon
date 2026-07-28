"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { createAnalyzeSortingHandler } = require("./lib/sortingVision");
const { createSaveSortingRecordHandler } = require("./lib/sortingRecord");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
exports.analyzeSortingImage = onRequest({
  region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 30, minInstances: 0,
  secrets: [geminiApiKey], cors: false
}, createAnalyzeSortingHandler({ getApiKey: () => geminiApiKey.value() }));

if (!getApps().length) initializeApp();
const db = getFirestore();
const recordStore = {
  async createOrGet(actorId, idempotencyKey, record, response) {
    const actor = db.collection("actors").doc(actorId);
    const idempotency = actor.collection("_idempotency").doc(idempotencyKey);
    return db.runTransaction(async (transaction) => {
      const existing = await transaction.get(idempotency);
      if (existing.exists) return { ...existing.data(), duplicate: true };
      const recordRef = actor.collection("records").doc();
      transaction.create(recordRef, record);
      transaction.create(idempotency, { recordId: recordRef.id, status: record.status, createdAt: response.createdAt, expireAt: response.expireAt });
      return { recordId: recordRef.id, status: record.status, ...response, duplicate: false };
    });
  }
};
exports.saveSortingRecord = onRequest({ region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 30, cors: false }, createSaveSortingRecordHandler({
  allowTestActor: process.env.FUNCTIONS_EMULATOR === "true",
  serverTimestamp: () => FieldValue.serverTimestamp(), store: recordStore
}));
