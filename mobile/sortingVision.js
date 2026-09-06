"use strict";
// Real photo -> AI judgment call, wired to the same production Cloud Function
// (analyzeSortingImage) that the PC app's 3-second judgment flow uses. This is a
// lean, standalone reimplementation of app.js's sorting-vision contract so the
// mobile page doesn't need to load the whole PC bundle.
(() => {
  const SCHEMA_VERSION = "sorting-vision-v1";
  const PROVIDER = "future_gemini";
  const LIMITS = { candidates: 3, cautions: 5, labelLength: 40, cautionLength: 100 };
  let sequence = 0;

  function requestId() {
    sequence += 1;
    return `mobile-sorting-${Date.now().toString(36)}-${sequence.toString(36)}`;
  }

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error("image_encode_failed"));
      reader.readAsDataURL(blob);
    });
  }

  async function prepareImage(imageEl) {
    const sourceWidth = imageEl?.naturalWidth || imageEl?.width || 0;
    const sourceHeight = imageEl?.naturalHeight || imageEl?.height || 0;
    if (!sourceWidth || !sourceHeight) return null;
    const scale = Math.min(1, 768 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(imageEl, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.78));
    if (!blob || blob.size > 1_500_000) return null;
    const data = await blobToBase64(blob);
    return data ? { mimeType: "image/jpeg", data, metadata: { mimeType: "image/jpeg", width, height, byteLength: blob.size } } : null;
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

  async function analyzePhoto(imageEl, { searchQuery = "" } = {}) {
    const client = window.AIWaysEdu2gClient;
    if (!client?.analyzeSortingImage) return { ok: false, code: "provider_unavailable" };
    try {
      // prepareImage(blobToBase64)는 FileReader 오류 시 reject할 수 있다 -
      // 이 try 밖에 있으면 analyzePhoto 자체가 reject해버려서, 호출부
      // (app.js runPhotoAnalysis)에 .catch가 없어 스캔 모달이 영원히
      // "분석 중"에 멈추고 버튼도 계속 비활성 상태로 남는다(저사양 기기의
      // 드문 인코딩 실패로 재현 가능) - 다른 실패와 동일하게 여기서 흡수한다.
      const imagePayload = await prepareImage(imageEl);
      if (!imagePayload) return { ok: false, code: "image_prepare_failed" };
      const reqId = requestId();
      const requestMetadata = {
        schemaVersion: SCHEMA_VERSION,
        requestId: reqId,
        sessionId: `session-${Date.now().toString(36)}`,
        idempotencyKey: window.crypto?.randomUUID ? window.crypto.randomUUID() : reqId,
        locale: "ko-KR",
        source: PROVIDER,
        imageMetadata: imagePayload.metadata,
        userContext: { searchQuery: clean(searchQuery), selectedCorrectionType: "", locale: "ko-KR" }
      };
      const response = await client.analyzeSortingImage({ ...requestMetadata, image: imagePayload, imageMetadata: imagePayload.metadata });
      if (!response.ok) return { ok: false, code: clean(response.code) || "provider_unavailable" };
      const normalized = normalizeResponse(response.data, reqId);
      if (!normalized) return { ok: false, code: "invalid_response" };
      return { ok: true, value: normalized };
    } catch {
      return { ok: false, code: "analysis_failed" };
    }
  }

  window.AIWaysMobileVision = { analyzePhoto };
})();
