"use strict";
// Text-only fallback for the judge tab's search box: when what the user typed
// doesn't match one of the 12 tracked disposal categories locally, ask Gemini
// (analyzeSortingText, same production Cloud Function family as the photo
// judgment call) to identify the object from its name and suggest a category
// or hold. Mirrors sortingVision.js's contract closely on purpose so the
// result can flow through the exact same renderResult() "AI guess" UI.
(() => {
  const SCHEMA_VERSION = "sorting-text-tip-v1";
  const PROVIDER = "future_gemini";
  const LIMITS = { candidates: 3, cautions: 5, labelLength: 40, cautionLength: 100, queryLength: 60 };
  let sequence = 0;

  function requestId() {
    sequence += 1;
    return `mobile-text-${Date.now().toString(36)}-${sequence.toString(36)}`;
  }

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function confidenceBand(value) {
    return ["high", "medium", "low", "unknown"].includes(value) ? value : "unknown";
  }

  function normalizeResponse(raw, expectedRequestId) {
    const value = raw && typeof raw === "object" ? raw : {};
    if (value.schemaVersion !== SCHEMA_VERSION) return null;
    if (value.provider !== PROVIDER) return null;
    if (clean(value.requestId) !== expectedRequestId) return null;
    if (!Array.isArray(value.objectCandidates)) return null;
    if (!["low", "medium", "high"].includes(value.uncertainty)) return null;
    const db = window.AIWaysMobileData?.sortingDbV2 || {};
    const seen = new Set();
    const objectCandidates = value.objectCandidates
      .map(candidate => ({
        label: clean(candidate?.label).slice(0, LIMITS.labelLength),
        itemId: clean(candidate?.itemId),
        confidenceBand: confidenceBand(candidate?.confidenceBand)
      }))
      .filter(candidate => candidate.label && db[candidate.itemId])
      .filter(candidate => !seen.has(candidate.itemId) && seen.add(candidate.itemId))
      .slice(0, LIMITS.candidates);
    const materialCandidates = Array.isArray(value.materialCandidates)
      ? value.materialCandidates
          .map(c => ({ label: clean(c?.label).slice(0, LIMITS.labelLength), confidenceBand: confidenceBand(c?.confidenceBand) }))
          .filter(c => c.label)
          .slice(0, LIMITS.candidates)
      : [];
    const visibleCautions = Array.isArray(value.visibleCautions)
      ? [...new Set(value.visibleCautions.map(c => clean(c).slice(0, LIMITS.cautionLength)).filter(Boolean))].slice(0, LIMITS.cautions)
      : [];
    return {
      objectCandidates,
      materialCandidates,
      visibleCautions,
      uncertainty: value.uncertainty,
      needsUserCheck: typeof value.needsUserCheck === "boolean" ? value.needsUserCheck : true
    };
  }

  async function analyzeText(query) {
    const client = window.AIWaysEdu2gClient;
    if (!client?.analyzeSortingText) return { ok: false, code: "provider_unavailable" };
    const q = clean(query).slice(0, LIMITS.queryLength);
    if (!q) return { ok: false, code: "invalid_query" };
    const reqId = requestId();
    const requestMetadata = {
      schemaVersion: SCHEMA_VERSION,
      requestId: reqId,
      sessionId: `session-${Date.now().toString(36)}`,
      idempotencyKey: window.crypto?.randomUUID ? window.crypto.randomUUID() : reqId,
      locale: "ko-KR",
      source: PROVIDER,
      query: q
    };
    try {
      const response = await client.analyzeSortingText(requestMetadata);
      if (!response.ok) return { ok: false, code: clean(response.code) || "provider_unavailable" };
      const normalized = normalizeResponse(response.data, reqId);
      if (!normalized) return { ok: false, code: "invalid_response" };
      return { ok: true, value: normalized };
    } catch {
      return { ok: false, code: "analysis_failed" };
    }
  }

  window.AIWaysMobileTextTip = { analyzeText };
})();
