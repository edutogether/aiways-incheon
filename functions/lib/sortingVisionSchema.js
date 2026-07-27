"use strict";

const SCHEMA = "sorting-vision-v1";
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_REQUEST_BYTES = 2_000_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ITEM_TYPES = Object.freeze({
  "pet-bottle": "pet-bottle", "plastic-cup": "plastic-cup", "paper-cup": "paper-cup",
  "milk-carton": "milk-carton", can: "can", "glass-bottle": "glass-bottle",
  "snack-wrapper": "snack-wrapper", "vinyl-bag": "vinyl-bag",
  "ramen-container": "ramen-container", receipt: "receipt", "tape-box": "tape-box", hold: "hold"
});
const CONFIDENCE_BANDS = new Set(["high", "medium", "low", "unknown"]);
const UNCERTAINTY_BANDS = new Set(["low", "medium", "high"]);

function safeText(value, maxLength) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function errorResponse(code, requestId = "") {
  return { ok: false, code, requestId: safeText(requestId, 80) };
}

function decodedByteLength(base64) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

function isBase64(value) {
  return typeof value === "string" && value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function validateRequest(body) {
  if (!body || typeof body !== "object") return { valid: false, code: "invalid_request", requestId: "" };
  const requestId = safeText(body.requestId, 80);
  if (body.schemaVersion !== SCHEMA) return { valid: false, code: "invalid_schema", requestId };
  if (!requestId || !safeText(body.sessionId, 100) || !safeText(body.locale, 20)) return { valid: false, code: "invalid_request", requestId };
  if (body.source !== "future_gemini") return { valid: false, code: "invalid_request", requestId };
  const image = body.image || {};
  if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) return { valid: false, code: "unsupported_image_type", requestId };
  if (!isBase64(image.data)) return { valid: false, code: "invalid_image", requestId };
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_REQUEST_BYTES) return { valid: false, code: "image_too_large", requestId };
  const byteLength = decodedByteLength(image.data);
  if (byteLength > MAX_IMAGE_BYTES) return { valid: false, code: "image_too_large", requestId };
  const metadata = image.metadata || body.imageMetadata || {};
  if (Number(metadata.byteLength) > MAX_IMAGE_BYTES) return { valid: false, code: "image_too_large", requestId };
  if (!Number.isInteger(metadata.byteLength) || metadata.byteLength < 1 || Math.abs(metadata.byteLength - byteLength) > 2) return { valid: false, code: "invalid_image", requestId };
  if (metadata.mimeType && metadata.mimeType !== image.mimeType) return { valid: false, code: "invalid_image", requestId };
  if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) || metadata.width < 1 || metadata.height < 1) return { valid: false, code: "invalid_image", requestId };
  if (safeText(body.userContext?.searchQuery, 120) !== String(body.userContext?.searchQuery || "").trim() || safeText(body.userContext?.selectedCorrectionType, 80) !== String(body.userContext?.selectedCorrectionType || "").trim()) return { valid: false, code: "invalid_request", requestId };
  return { valid: true, requestId };
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
  const visibleCautions = [...new Set((Array.isArray(raw.visibleCautions) ? raw.visibleCautions : []).map((value) => safeText(value, 100)).filter(Boolean))].slice(0, 5);
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
  if (!Array.isArray(value?.objectCandidates) || normalized.objectCandidates.length !== rawObjects.length || rawObjects.some((candidate) => typeof candidate?.label !== "string" || candidate.label.length > 40 || /[<>\u0000-\u001f]/.test(candidate.label))) errors.push("invalid_candidate");
  if (!Array.isArray(value?.materialCandidates) || !Array.isArray(value?.visibleCautions)) errors.push("invalid_response");
  if (!UNCERTAINTY_BANDS.has(value?.uncertainty) || typeof value?.needsUserCheck !== "boolean") errors.push("invalid_response");
  return { valid: errors.length === 0, errors: [...new Set(errors)], normalized };
}

module.exports = { SCHEMA, MAX_IMAGE_BYTES, MAX_REQUEST_BYTES, ALLOWED_IMAGE_TYPES, ITEM_TYPES, errorResponse, validateRequest, normalizeResponse, validateResponse };
