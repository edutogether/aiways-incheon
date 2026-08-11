"use strict";

const SCHEMA = "sorting-text-tip-v1";
const { ITEM_TYPES } = require("./sortingVisionSchema");
const { validateIdempotencyKey } = require("./analysisIdempotency");
const MAX_QUERY_LENGTH = 60;
const MAX_REQUEST_BYTES = 4 * 1024;
const CONFIDENCE_BANDS = new Set(["high", "medium", "low", "unknown"]);
const UNCERTAINTY_BANDS = new Set(["low", "medium", "high"]);

function safeText(value, maxLength) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function errorResponse(code, requestId = "") {
  return { ok: false, code, requestId: safeText(requestId, 80) };
}

function validateRequest(body) {
  if (!body || typeof body !== "object") return { valid: false, code: "invalid_request", requestId: "" };
  const requestId = safeText(body.requestId, 80);
  if (body.schemaVersion !== SCHEMA) return { valid: false, code: "invalid_schema", requestId };
  if (!requestId || !safeText(body.sessionId, 100) || !safeText(body.locale, 20)) return { valid: false, code: "invalid_request", requestId };
  if (!validateIdempotencyKey(body.idempotencyKey)) return { valid: false, code: "invalid_idempotency_key", requestId };
  if (body.source !== "future_gemini") return { valid: false, code: "invalid_request", requestId };
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_REQUEST_BYTES) return { valid: false, code: "payload_too_large", requestId };
  const query = safeText(body.query, MAX_QUERY_LENGTH);
  if (!query || typeof body.query !== "string") return { valid: false, code: "invalid_query", requestId };
  return { valid: true, requestId, query };
}

function normalizeResponse(value) {
  const raw = value && typeof value === "object" ? value : {};
  const seenItems = new Set();
  const objectCandidates = (Array.isArray(raw.objectCandidates) ? raw.objectCandidates : []).map((candidate) => ({
    label: safeText(candidate?.label, 40), itemId: safeText(candidate?.itemId, 40), objectType: safeText(candidate?.objectType, 40),
    confidenceBand: CONFIDENCE_BANDS.has(candidate?.confidenceBand) ? candidate.confidenceBand : "unknown"
  })).filter((candidate) => candidate.label && ITEM_TYPES[candidate.itemId] === candidate.objectType && !seenItems.has(candidate.itemId) && seenItems.add(candidate.itemId)).slice(0, 3);
  const materialCandidates = (Array.isArray(raw.materialCandidates) ? raw.materialCandidates : []).map((candidate) => ({
    label: safeText(candidate?.label, 40), confidenceBand: CONFIDENCE_BANDS.has(candidate?.confidenceBand) ? candidate.confidenceBand : "unknown"
  })).filter((candidate) => candidate.label).slice(0, 3);
  const visibleCautions = [...new Set((Array.isArray(raw.visibleCautions) ? raw.visibleCautions : []).map((value2) => safeText(value2, 100)).filter(Boolean))].slice(0, 5);
  return { schemaVersion: raw.schemaVersion, requestId: safeText(raw.requestId, 80), provider: raw.provider, objectCandidates, materialCandidates, visibleCautions, uncertainty: UNCERTAINTY_BANDS.has(raw.uncertainty) ? raw.uncertainty : "high", needsUserCheck: typeof raw.needsUserCheck === "boolean" ? raw.needsUserCheck : true };
}

function validateResponse(value, expectedRequestId = "") {
  const normalized = normalizeResponse(value);
  const errors = [];
  if (!value || typeof value !== "object") errors.push("invalid_response");
  if (value?.schemaVersion !== SCHEMA) errors.push("invalid_schema");
  if (value?.provider !== "future_gemini") errors.push("invalid_provider");
  if (!normalized.requestId || (expectedRequestId && normalized.requestId !== expectedRequestId)) errors.push("invalid_request");
  const rawObjects = Array.isArray(value?.objectCandidates) ? value.objectCandidates : [];
  if (!Array.isArray(value?.objectCandidates) || normalized.objectCandidates.length !== rawObjects.length || rawObjects.some((candidate) => typeof candidate?.label !== "string" || candidate.label.length > 40 || /[\u0000-\u001f<>]/.test(candidate.label))) errors.push("invalid_candidate");
  if (!Array.isArray(value?.materialCandidates) || !Array.isArray(value?.visibleCautions)) errors.push("invalid_response");
  if (!UNCERTAINTY_BANDS.has(value?.uncertainty) || typeof value?.needsUserCheck !== "boolean") errors.push("invalid_response");
  return { valid: errors.length === 0, errors: [...new Set(errors)], normalized };
}

module.exports = { SCHEMA, MAX_QUERY_LENGTH, errorResponse, validateRequest, normalizeResponse, validateResponse };
