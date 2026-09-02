"use strict";

const { SCHEMA_VERSION } = require("./sortingRecord");
const { protectActorRequest } = require("./protectedActor");
const { isAllowedOrigin } = require("./httpGuard");

const MAX_BODY = 12 * 1024;

function send(res, code, body) {
  return res.status(code).json(body);
}

function allowedOrigin(value) {
  return isAllowedOrigin(value);
}

function guard(req, res) {
  const value = String(req.headers?.origin || "");
  if (value && !allowedOrigin(value)) return false;
  if (value) {
    res.set("Access-Control-Allow-Origin", value);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck, Authorization");
  }
  if (req.method === "OPTIONS") { res.status(204).send(""); return false; }
  if (req.method !== "POST") { send(res, 405, { ok: false, code: "method_not_allowed" }); return false; }
  if ((req.rawBody?.length || Buffer.byteLength(JSON.stringify(req.body || {}))) > MAX_BODY) { send(res, 413, { ok: false, code: "request_too_large" }); return false; }
  if (req.headers?.["content-type"] && !String(req.headers["content-type"]).includes("application/json")) { send(res, 415, { ok: false, code: "invalid_content_type" }); return false; }
  return true;
}

function validKey(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(value);
}

function timestamp(value) {
  return value?.toDate ? value.toDate().toISOString() : (value instanceof Date ? value.toISOString() : value || null);
}

function publicRecord(id, data) {
  const out = { recordId: id };
  for (const key of ["schemaVersion", "status", "provider", "model", "analysis", "checklist", "userDecision", "hold", "resolutionType", "appVersion", "sourceSchemaVersion"]) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  for (const key of ["createdAt", "updatedAt", "expireAt", "resolvedAt"]) {
    if (data[key] !== undefined) out[key] = timestamp(data[key]);
  }
  return out;
}

async function actor(req, res, functionName, dependencies) {
  const result = await protectActorRequest({
    req, functionName,
    access: dependencies.access, appCheck: dependencies.appCheck,
    globalRateLimiter: dependencies.rateLimiter, actorRateLimiter: dependencies.actorRateLimiter,
    logAppCheck: dependencies.logAppCheck, blockedActors: dependencies.blockedActors
  });
  if (result.ok) return result;
  if (result.retryAfterSeconds) res.set("Retry-After", String(result.retryAfterSeconds));
  send(res, result.httpStatus, { ok: false, code: result.code, ...(result.retryAfterSeconds ? { retryAfterSeconds: result.retryAfterSeconds } : {}) });
  return null;
}

function createListSortingRecordsHandler(dependencies = {}) {
  return async (req, res) => {
    if (!guard(req, res)) {
      if (req.headers?.origin && !allowedOrigin(String(req.headers.origin))) return send(res, 403, { ok: false, code: "invalid_origin" });
      return;
    }
    const active = await actor(req, res, "listSortingRecords", dependencies);
    if (!active) return;
    const b = req.body || {};
    if (Object.keys(b).some((k) => !["pageSize", "cursor", "statusFilter"].includes(k))) return send(res, 400, { ok: false, code: "unknown_field" });
    const size = b.pageSize === undefined ? 20 : Number(b.pageSize);
    if (!Number.isInteger(size) || size < 1 || size > 40 || !["all", "completed", "held"].includes(b.statusFilter || "all") || (b.cursor && !validKey(b.cursor))) {
      return send(res, 400, { ok: false, code: "invalid_request" });
    }
    const page = await dependencies.store.list(active.actorId, size, b.cursor || "", b.statusFilter || "all");
    return send(res, 200, { records: page.records.map((r) => publicRecord(r.id, r.data)), nextCursor: page.nextCursor || null, hasMore: !!page.nextCursor, schemaVersion: SCHEMA_VERSION });
  };
}

function createResolveSortingRecordHandler(dependencies = {}) {
  return async (req, res) => {
    if (!guard(req, res)) {
      if (req.headers?.origin && !allowedOrigin(String(req.headers.origin))) return send(res, 403, { ok: false, code: "invalid_origin" });
      return;
    }
    const active = await actor(req, res, "resolveSortingRecord", dependencies);
    if (!active) return;
    const b = req.body || {};
    if (Object.keys(b).some((k) => !["recordId", "idempotencyKey", "resolutionType", "userDecision", "checklist"].includes(k))) return send(res, 400, { ok: false, code: "unknown_field" });
    if (!validKey(b.recordId) || !validKey(b.idempotencyKey) || !["confirmed_after_review", "corrected_after_review"].includes(b.resolutionType) || !b.userDecision?.userConfirmed || !Array.isArray(b.checklist) || b.checklist.some((x) => !x?.checked)) {
      return send(res, 400, { ok: false, code: "invalid_resolution" });
    }
    const result = await dependencies.store.resolve(active.actorId, b, dependencies.serverTimestamp?.());
    return send(res, result.code === "not_found" ? 404 : result.code === "conflict" ? 409 : 200, result);
  };
}

module.exports = { createListSortingRecordsHandler, createResolveSortingRecordHandler, publicRecord };
