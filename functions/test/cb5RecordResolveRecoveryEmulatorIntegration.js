"use strict";

const assert = require("node:assert/strict");
const { FieldValue } = require("firebase-admin/firestore");
const { createActorRateLimiter } = require("../lib/globalRateLimit");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");
const {
  createListSortingRecordsHandler,
  createResolveSortingRecordHandler,
} = require("../lib/sortingRecordQuery");
const { createAnalysisIdempotency } = require("../lib/analysisIdempotency");
const { createAnalyzeSortingHandler } = require("../lib/sortingVision");
const {
  call,
  cleanupCb5Fixture,
  revokeAndReplaceDevice,
  setupCb5DeviceMatrix,
} = require("./cb5EmulatorFixture");

const imageData =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+QKQe2QAAAABJRU5ErkJggg==";

function key(actorIndex, label) {
  return `cb5-${actorIndex}-${label}-idempotency-key`;
}

function recordPayload(idempotencyKey, status = "completed") {
  return {
    schemaVersion: "sorting-record-v1",
    status,
    provider: "future_gemini",
    analysis: {
      objectCandidates: [
        {
          label: "PET bottle",
          itemId: "pet-bottle",
          objectType: "pet-bottle",
          confidenceBand: "high",
        },
      ],
      materialCandidates: [{ label: "plastic", confidenceBand: "medium" }],
      visibleCautions: [],
    },
    checklist: [{ id: "empty", label: "Empty", checked: true }],
    userDecision: {
      selectedItemId: "pet-bottle",
      action: status === "held" ? "held" : "recorded",
      userConfirmed: true,
    },
    hold: status === "held" ? { recommended: true, reasons: ["check"] } : null,
    idempotencyKey,
  };
}

function resolutionPayload(recordId, idempotencyKey) {
  return {
    recordId,
    idempotencyKey,
    resolutionType: "confirmed_after_review",
    userDecision: { userConfirmed: true },
    checklist: [{ checked: true }],
  };
}

function analysisPayload(idempotencyKey, requestId) {
  return {
    schemaVersion: "sorting-vision-v1",
    requestId,
    sessionId: "cb5-emulator-session",
    idempotencyKey,
    locale: "ko-KR",
    source: "future_gemini",
    image: { mimeType: "image/png", data: imageData },
    imageMetadata: { mimeType: "image/png", width: 1, height: 1, byteLength: 70 },
    userContext: {},
  };
}

function analysisResponse(requestId) {
  return {
    text: JSON.stringify({
      schemaVersion: "sorting-vision-v1",
      requestId,
      provider: "future_gemini",
      objectCandidates: [],
      materialCandidates: [],
      visibleCautions: [],
      uncertainty: "high",
      needsUserCheck: true,
    }),
  };
}

function createRecordStores(db) {
  return {
    records: {
      async createOrGet(actorId, idempotencyKey, record, response) {
        const actor = db.collection("actors").doc(actorId);
        const idempotency = actor.collection("_idempotency").doc(idempotencyKey);
        return db.runTransaction(async (transaction) => {
          const existing = await transaction.get(idempotency);
          if (existing.exists) return { ...existing.data(), duplicate: true };
          const recordRef = actor.collection("records").doc();
          transaction.create(recordRef, record);
          transaction.create(idempotency, {
            recordId: recordRef.id,
            status: record.status,
            createdAt: response.createdAt,
            expireAt: response.expireAt,
          });
          return { recordId: recordRef.id, status: record.status, ...response, duplicate: false };
        });
      },
    },
    queries: {
      async list(actorId, size, cursor, filter) {
        const actor = db.collection("actors").doc(actorId);
        let query = actor.collection("records").orderBy("createdAt", "desc").limit(size + 1);
        if (filter !== "all") query = query.where("status", "==", filter);
        if (cursor) query = query.startAfter(await actor.collection("records").doc(cursor).get());
        const snapshot = await query.get();
        const records = snapshot.docs.slice(0, size);
        return {
          records: records.map((document) => ({ id: document.id, data: document.data() })),
          nextCursor: snapshot.docs.length > size ? records.at(-1).id : null,
        };
      },
      async resolve(actorId, body, serverTime) {
        const actor = db.collection("actors").doc(actorId);
        const record = actor.collection("records").doc(body.recordId);
        const idempotency = actor.collection("_resolutions").doc(body.idempotencyKey);
        return db.runTransaction(async (transaction) => {
          const existing = await transaction.get(idempotency);
          if (existing.exists) return { ...existing.data(), duplicate: true };
          const snapshot = await transaction.get(record);
          if (!snapshot.exists) return { code: "not_found" };
          if (snapshot.data().status !== "held") return { code: "conflict" };
          const result = {
            recordId: body.recordId,
            status: "completed",
            resolutionType: body.resolutionType,
            duplicate: false,
          };
          transaction.update(record, {
            status: "completed",
            updatedAt: serverTime,
            resolvedAt: serverTime,
            resolutionType: body.resolutionType,
            userDecision: body.userDecision,
            checklist: body.checklist,
          });
          transaction.create(idempotency, result);
          return result;
        });
      },
    },
  };
}

function isSuccess(response) {
  return response.statusCode === 200 || response.statusCode === 201;
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

(async () => {
  const fixture = await setupCb5DeviceMatrix();
  const metrics = {
    actors: 5,
    activeDevices: 25,
    recordRequests: 0,
    recordSuccess: 0,
    idempotentReuses: 0,
    rateLimits: 0,
    finalRecords: 0,
    duplicateRecords: 0,
    resolveRequests: 0,
    resolveSuccess: 0,
    conflicts: 0,
    stateRegressions: 0,
    paginationDuplicateIds: 0,
    missingRecords: 0,
    revokedDeviceBlocks: 0,
    actorCrossBlocks: 0,
    timeouts: 0,
    retrySuccess: 0,
    completed: 0,
    held: 0,
    orphan: 0,
  };

  try {
    const { db, access, users, actorKeys } = fixture;
    const { records, queries } = createRecordStores(db);
    const actorRateLimiter = createActorRateLimiter({
      db,
      serverTimestamp: () => FieldValue.serverTimestamp(),
    });
    const dependencies = {
      access,
      appCheck: async () => ({ status: "valid" }),
      rateLimiter: { check: async () => ({ allowed: true, outcome: "allowed" }) },
      actorRateLimiter,
      serverTimestamp: () => FieldValue.serverTimestamp(),
    };
    const save = createSaveSortingRecordHandler({ ...dependencies, store: records });
    const list = createListSortingRecordsHandler({ ...dependencies, store: queries });
    const resolve = createResolveSortingRecordHandler({ ...dependencies, store: queries });
    const expectedRecordIds = actorKeys.map(() => new Set());
    const actorRequestCounts = actorKeys.map(() => 0);

    async function saveRecord(actorIndex, deviceIndex, payload, handler = save) {
      metrics.recordRequests += 1;
      actorRequestCounts[actorIndex] += 1;
      const response = await call(handler, users[actorIndex][deviceIndex].token, payload);
      if (isSuccess(response)) {
        metrics.recordSuccess += 1;
        if (response.body.duplicate) metrics.idempotentReuses += 1;
        else expectedRecordIds[actorIndex].add(response.body.recordId);
      }
      if (response.statusCode === 429) metrics.rateLimits += 1;
      return response;
    }

    async function resolveRecord(actorIndex, deviceIndex, payload, handler = resolve) {
      metrics.resolveRequests += 1;
      const response = await call(handler, users[actorIndex][deviceIndex].token, payload);
      if (response.statusCode === 200) {
        metrics.resolveSuccess += 1;
        if (response.body.duplicate) metrics.idempotentReuses += 1;
      }
      if (response.statusCode === 409) metrics.conflicts += 1;
      if (response.statusCode === 429) metrics.rateLimits += 1;
      return response;
    }

    const heldForSameKey = [];
    const heldForDifferentKey = [];
    const heldForRecovery = [];
    const sharedKey = "cb5-shared-idempotency-key";

    for (let actorIndex = 0; actorIndex < actorKeys.length; actorIndex += 1) {
      const shared = await Promise.all([
        saveRecord(actorIndex, 0, recordPayload(sharedKey)),
        saveRecord(actorIndex, 1, recordPayload(sharedKey)),
      ]);
      assert.deepEqual(
        shared.map((response) => response.statusCode).sort(),
        [200, 201],
      );
      assert.equal(shared[0].body.recordId, shared[1].body.recordId);

      const distinct = await Promise.all([
        saveRecord(actorIndex, 2, recordPayload(key(actorIndex, "distinct-a"))),
        saveRecord(actorIndex, 3, recordPayload(key(actorIndex, "distinct-b"), "held")),
      ]);
      assert.deepEqual(distinct.map((response) => response.statusCode).sort(), [201, 201]);
      assert.notEqual(distinct[0].body.recordId, distinct[1].body.recordId);
      heldForSameKey.push(distinct[1].body.recordId);

      const samePayload = await Promise.all([
        saveRecord(actorIndex, 4, recordPayload(key(actorIndex, "same-payload-a"), "held")),
        saveRecord(actorIndex, 0, recordPayload(key(actorIndex, "same-payload-b"), "held")),
      ]);
      assert.deepEqual(samePayload.map((response) => response.statusCode).sort(), [201, 201]);
      assert.notEqual(samePayload[0].body.recordId, samePayload[1].body.recordId);
      heldForDifferentKey.push(samePayload[1].body.recordId);

      const lostResponse = await saveRecord(
        actorIndex,
        1,
        recordPayload(key(actorIndex, "lost-response"), "held"),
      );
      assert.equal(lostResponse.statusCode, 201);
      heldForRecovery.push(lostResponse.body.recordId);
      const retry = await saveRecord(
        actorIndex,
        2,
        recordPayload(key(actorIndex, "lost-response"), "held"),
      );
      assert.equal(retry.statusCode, 200);
      assert.equal(retry.body.recordId, lostResponse.body.recordId);
      metrics.retrySuccess += 1;
    }

    for (let index = 0; index < 4; index += 1) {
      assert.equal(
        (await saveRecord(4, index, recordPayload(key(4, `rate-fill-${index}`)))).statusCode,
        201,
      );
    }
    const recordRateLimit = await saveRecord(4, 4, recordPayload(key(4, "rate-limited")));
    assert.equal(recordRateLimit.statusCode, 429);
    assert.equal(recordRateLimit.body.code, "rate_limit_exceeded");

    const firstPage = await call(list, users[0][0].token, { pageSize: 3 });
    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.body.hasMore, true);
    assert.equal(firstPage.body.hasMore, Boolean(firstPage.body.nextCursor));
    const createdDuringPagination = await saveRecord(0, 3, recordPayload(key(0, "pagination-create")));
    assert.equal(createdDuringPagination.statusCode, 201);

    for (let actorIndex = 0; actorIndex < actorKeys.length; actorIndex += 1) {
      const resolution = resolutionPayload(heldForSameKey[actorIndex], key(actorIndex, "resolve-same"));
      const responses = await Promise.all([
        resolveRecord(actorIndex, 0, resolution),
        resolveRecord(actorIndex, 2, resolution),
      ]);
      assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 200]);
      assert.equal(responses[0].body.recordId, responses[1].body.recordId);
      assert.equal(responses.some((response) => response.body.duplicate === true), true);
    }

    const differentKeyRecord = heldForDifferentKey[0];
    const differentResolutions = await Promise.all([
      resolveRecord(0, 0, resolutionPayload(differentKeyRecord, key(0, "resolve-first"))),
      resolveRecord(0, 3, resolutionPayload(differentKeyRecord, key(0, "resolve-second"))),
    ]);
    assert.deepEqual(differentResolutions.map((response) => response.statusCode).sort(), [200, 409]);

    let releaseDelayedResolve;
    let delayedResolveStarted;
    const delayedResolveStartedPromise = new Promise((resolveStarted) => {
      delayedResolveStarted = resolveStarted;
    });
    const delayedResolve = createResolveSortingRecordHandler({
      ...dependencies,
      store: {
        ...queries,
        async resolve(...argumentsList) {
          delayedResolveStarted();
          await new Promise((resolveDelay) => {
            releaseDelayedResolve = resolveDelay;
          });
          return queries.resolve(...argumentsList);
        },
      },
    });
    const delayedPayload = resolutionPayload(heldForRecovery[0], key(0, "resolve-timeout"));
    const delayedRequest = resolveRecord(0, 4, delayedPayload, delayedResolve);
    await delayedResolveStartedPromise;
    const timeoutObserved = await Promise.race([
      delayedRequest.then(() => false),
      pause(10).then(() => true),
    ]);
    assert.equal(timeoutObserved, true);
    metrics.timeouts += 1;
    releaseDelayedResolve();
    assert.equal((await delayedRequest).statusCode, 200);
    const delayedRetry = await resolveRecord(0, 2, delayedPayload);
    assert.equal(delayedRetry.statusCode, 200);
    assert.equal(delayedRetry.body.duplicate, true);
    metrics.retrySuccess += 1;

    const lateResolve = await resolveRecord(
      0,
      1,
      resolutionPayload(differentKeyRecord, key(0, "resolve-late")),
    );
    assert.equal(lateResolve.statusCode, 409);

    const secondPage = await call(list, users[0][0].token, {
      pageSize: 3,
      cursor: firstPage.body.nextCursor,
    });
    assert.equal(secondPage.statusCode, 200);
    assert.equal(secondPage.body.hasMore, Boolean(secondPage.body.nextCursor));
    const firstPageIds = new Set(firstPage.body.records.map((record) => record.recordId));
    secondPage.body.records.forEach((record) => {
      if (firstPageIds.has(record.recordId)) metrics.paginationDuplicateIds += 1;
    });
    assert.equal(metrics.paginationDuplicateIds, 0);

    const transientSave = createSaveSortingRecordHandler({
      ...dependencies,
      store: { createOrGet: async () => { throw new Error("transient_store_failure"); } },
    });
    await assert.rejects(
      () => saveRecord(1, 0, recordPayload(key(1, "transient-retry")), transientSave),
      /transient_store_failure/,
    );
    const transientRecovery = await saveRecord(1, 1, recordPayload(key(1, "transient-retry")));
    assert.equal(transientRecovery.statusCode, 201);
    metrics.retrySuccess += 1;

    const invalidAppCheckSave = createSaveSortingRecordHandler({
      ...dependencies,
      appCheck: async () => ({ httpStatus: 401, code: "app_check_invalid" }),
      store: records,
    });
    const appCheckFailure = await saveRecord(
      0,
      0,
      recordPayload(key(0, "app-check-failure")),
      invalidAppCheckSave,
    );
    assert.equal(appCheckFailure.statusCode, 401);
    assert.equal(appCheckFailure.body.code, "app_check_invalid");

    const crossActor = await resolveRecord(
      1,
      0,
      resolutionPayload(heldForDifferentKey[0], key(1, "cross-actor")),
    );
    assert.equal(crossActor.statusCode, 404);
    metrics.actorCrossBlocks += 1;

    const { revoked, replacement } = await revokeAndReplaceDevice(fixture, 2);
    const revokedRecord = await call(save, revoked.token, recordPayload(key(2, "revoked-save")));
    assert.equal(revokedRecord.statusCode, 403);
    metrics.revokedDeviceBlocks += 1;
    const revokedResolve = await call(
      resolve,
      revoked.token,
      resolutionPayload(heldForDifferentKey[2], key(2, "revoked-resolve")),
    );
    assert.equal(revokedResolve.statusCode, 403);
    metrics.revokedDeviceBlocks += 1;

    let analysisCalls = 0;
    let releaseAnalysis;
    const analysisGate = new Promise((resolveGate) => {
      releaseAnalysis = resolveGate;
    });
    const analysisRequests = createAnalysisIdempotency({
      db,
      model: "test",
      serverTimestamp: () => FieldValue.serverTimestamp(),
    });
    const analysisCommon = {
      ...dependencies,
      analysisRequests,
      getApiKey: () => "mock",
    };
    const analysisA = createAnalyzeSortingHandler({
      ...analysisCommon,
      createClient: () => ({
        models: {
          generateContent: async () => {
            analysisCalls += 1;
            await analysisGate;
            return analysisResponse("cb5-analysis-a");
          },
        },
      }),
    });
    const analysisB = createAnalyzeSortingHandler({
      ...analysisCommon,
      createClient: () => ({
        models: {
          generateContent: async () => {
            analysisCalls += 1;
            return analysisResponse("cb5-analysis-b");
          },
        },
      }),
    });
    const analysisKey = "cb5-analysis-shared-idempotency-key";
    const firstAnalysis = call(analysisA, users[0][0].token, analysisPayload(analysisKey, "cb5-analysis-a"));
    await pause(20);
    const duplicateWhileProcessing = await call(
      analysisA,
      users[0][2].token,
      analysisPayload(analysisKey, "cb5-analysis-a"),
    );
    assert.equal(duplicateWhileProcessing.statusCode, 409);
    metrics.conflicts += 1;
    releaseAnalysis();
    assert.equal((await firstAnalysis).statusCode, 200);
    assert.equal(
      (await call(analysisA, users[0][3].token, analysisPayload(analysisKey, "cb5-analysis-a"))).statusCode,
      200,
    );
    assert.equal(
      (await call(analysisB, users[1][0].token, analysisPayload(analysisKey, "cb5-analysis-b"))).statusCode,
      200,
    );
    assert.equal(analysisCalls, 2);
    assert.equal(
      (
        await call(
          analysisA,
          users[0][4].token,
          analysisPayload(key(0, "analysis-fill"), "cb5-analysis-a"),
        )
      ).statusCode,
      200,
    );
    const analysisRateLimit = await call(
      analysisA,
      users[0][0].token,
      analysisPayload(key(0, "analysis-limit"), "cb5-analysis-a"),
    );
    assert.equal(analysisRateLimit.statusCode, 429);
    assert.equal(analysisRateLimit.body.code, "rate_limit_exceeded");
    metrics.rateLimits += 1;
    const revokedAnalysis = await call(
      analysisA,
      revoked.token,
      analysisPayload(key(2, "analysis-revoked"), "cb5-analysis-a"),
    );
    assert.equal(revokedAnalysis.statusCode, 403);
    metrics.revokedDeviceBlocks += 1;

    async function listAll(actorIndex, token) {
      const ids = [];
      let cursor = "";
      do {
        const page = await call(list, token, { pageSize: 3, ...(cursor ? { cursor } : {}) });
        assert.equal(page.statusCode, 200);
        assert.equal(page.body.hasMore, Boolean(page.body.nextCursor));
        page.body.records.forEach((record) => ids.push(`${record.recordId}:${record.status}`));
        cursor = page.body.nextCursor;
      } while (cursor);
      return ids;
    }

    const finalLists = [];
    for (let actorIndex = 0; actorIndex < actorKeys.length; actorIndex += 1) {
      const activeToken = actorIndex === 2 ? replacement.token : users[actorIndex][0].token;
      const firstRead = await listAll(actorIndex, activeToken);
      const secondRead = await listAll(actorIndex, activeToken);
      assert.deepEqual(secondRead, firstRead);
      assert.equal(new Set(firstRead).size, firstRead.length);
      finalLists.push(firstRead);
      const visibleIds = new Set(firstRead.map((value) => value.split(":")[0]));
      assert.deepEqual(visibleIds, expectedRecordIds[actorIndex]);
      assert.ok(actorRequestCounts[actorIndex] >= expectedRecordIds[actorIndex].size);
    }

    const actorCActiveDevices = users[2].filter((device) => device.uid !== revoked.uid);
    for (const device of actorCActiveDevices) {
      assert.deepEqual(await listAll(2, device.token), finalLists[2]);
    }
    assert.equal(finalLists[1].some((value) => value.startsWith(`${heldForDifferentKey[0]}:`)), false);

    const allRecordIds = new Set();
    for (let actorIndex = 0; actorIndex < actorKeys.length; actorIndex += 1) {
      const actor = db.collection("actors").doc(`cb5_actor_${actorKeys[actorIndex]}`);
      const recordsSnapshot = await actor.collection("records").get();
      assert.equal(recordsSnapshot.size, expectedRecordIds[actorIndex].size);
      for (const record of recordsSnapshot.docs) {
        const data = record.data();
        if (allRecordIds.has(record.id)) metrics.duplicateRecords += 1;
        allRecordIds.add(record.id);
        if (Object.hasOwn(data, "actorId")) metrics.orphan += 1;
        const serialized = JSON.stringify(data);
        for (const forbidden of [imageData, "data:image", "base64", "authorization", "apiKey", "PASS"]) {
          assert.equal(serialized.includes(forbidden), false);
        }
        if (data.status === "completed") {
          metrics.completed += 1;
          if (!data.resolvedAt && data.hold?.recommended) metrics.stateRegressions += 1;
          if (data.resolvedAt) {
            assert.ok(data.updatedAt?.toDate?.() instanceof Date);
            assert.ok(data.resolvedAt?.toDate?.() instanceof Date);
            assert.ok(data.updatedAt.toDate().getTime() >= data.resolvedAt.toDate().getTime());
          }
        } else if (data.status === "held") {
          metrics.held += 1;
        } else {
          metrics.stateRegressions += 1;
        }
      }
      const idempotencySnapshot = await actor.collection("_idempotency").get();
      const resolutionSnapshot = await actor.collection("_resolutions").get();
      for (const document of [...idempotencySnapshot.docs, ...resolutionSnapshot.docs]) {
        const recordId = document.data().recordId;
        if (!recordId || !(await actor.collection("records").doc(recordId).get()).exists) metrics.orphan += 1;
      }
    }
    metrics.finalRecords = allRecordIds.size;
    metrics.missingRecords = expectedRecordIds.reduce((total, ids) => total + ids.size, 0) - metrics.finalRecords;
    assert.equal(metrics.duplicateRecords, 0);
    assert.equal(metrics.missingRecords, 0);
    assert.equal(metrics.stateRegressions, 0);
    assert.equal(metrics.orphan, 0);

    const analysisDocuments = await db.collection("system_analysis_requests").get();
    for (const document of analysisDocuments.docs) {
      const serialized = JSON.stringify(document.data());
      for (const forbidden of [imageData, "data:image", "base64", "authorization", "apiKey", "actorId"]) {
        assert.equal(serialized.includes(forbidden), false);
      }
    }
    process.stdout.write(`${JSON.stringify({ cb5RecordResolveRecovery: "passed", ...metrics })}\n`);
  } finally {
    await cleanupCb5Fixture(fixture);
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
