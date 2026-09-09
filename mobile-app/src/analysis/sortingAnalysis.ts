// 사진·검색어를 Gemini에 물어보는 두 경로. mobile/sortingVision.js와
// mobile/sortingTextTip.js를 옮긴 것이다.
//
// 두 파일은 응답을 다듬는 부분(normalizeResponse)이 스키마 이름만 빼고 완전히
// 같은 코드였다 - 90줄이 두 벌 있었다. 여기서는 하나로 두고 스키마만 인자로
// 받는다. 값이 달라지지 않는다는 것은 sortingAnalysis.parity.test.ts가 원본
// 파일을 실제로 실행해 같은 입력에 같은 결과가 나오는지로 확인한다.
import { sortingDbV2 } from "../data/sortingData";
import { edu2gClient, type ConfidenceBand, type Uncertainty } from "../legacy/globals";

const PROVIDER = "future_gemini";
const VISION_SCHEMA = "sorting-vision-v1";
const TEXT_SCHEMA = "sorting-text-tip-v1";

const LIMITS = { candidates: 3, cautions: 5, labelLength: 40, cautionLength: 100, queryLength: 60 };

// 이미지 한 변의 최대 길이와 전송 상한. 원본 값 그대로다.
const MAX_IMAGE_EDGE = 768;
const JPEG_QUALITY = 0.78;
const MAX_IMAGE_BYTES = 1_500_000;

export interface ObjectCandidate {
  label: string;
  itemId: string;
  confidenceBand: ConfidenceBand;
}

export interface MaterialCandidate {
  label: string;
  confidenceBand: ConfidenceBand;
}

export interface AnalysisValue {
  objectCandidates: ObjectCandidate[];
  materialCandidates: MaterialCandidate[];
  visibleCautions: string[];
  uncertainty: Uncertainty;
  needsUserCheck: boolean;
}

export type AnalysisResult =
  | { ok: true; value: AnalysisValue }
  | { ok: false; code: string };

// 요청 식별자. 응답이 "내가 보낸 그 요청"의 것인지 확인하는 데 쓴다 - 늦게
// 도착한 이전 요청의 답이 최신 화면을 덮어쓰는 것을 막는다.
let sequence = 0;
function requestId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function confidenceBand(value: unknown): ConfidenceBand {
  return value === "high" || value === "medium" || value === "low" || value === "unknown" ? value : "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 모델 응답을 화면에 쓸 수 있는 형태로 다듬는다. 조건 하나라도 어긋나면
 * null을 돌려주고, 호출부는 그것을 "응답을 못 믿겠다"로 처리한다.
 *
 * 순서가 중요하다: 후보를 다듬고 → **DB에 있는 품목만 남기고** → 중복을
 * 지우고 → 개수를 자른다. 순서를 바꾸면 남는 후보가 달라진다.
 */
export function normalizeAnalysis(raw: unknown, expectedRequestId: string, schemaVersion: string): AnalysisValue | null {
  const value = isRecord(raw) ? raw : {};
  if (value.schemaVersion !== schemaVersion) return null;
  if (value.provider !== PROVIDER) return null;
  if (clean(value.requestId) !== expectedRequestId) return null;
  if (!Array.isArray(value.objectCandidates)) return null;
  if (value.uncertainty !== "low" && value.uncertainty !== "medium" && value.uncertainty !== "high") return null;

  const seen = new Set<string>();
  const objectCandidates: ObjectCandidate[] = [];
  for (const entry of value.objectCandidates) {
    const candidate: ObjectCandidate = {
      label: clean(isRecord(entry) ? entry.label : undefined).slice(0, LIMITS.labelLength),
      itemId: clean(isRecord(entry) ? entry.itemId : undefined),
      confidenceBand: confidenceBand(isRecord(entry) ? entry.confidenceBand : undefined)
    };
    // 원본과 동일하게 `sortingDbV2[itemId]`로만 확인한다. 그래서 itemId가
    // "constructor" 같은 프로토타입 속성 이름이면 통과해 버리는데(값이
    // 함수라 truthy다), **이건 원본에 있던 성질이라 여기서 고치지 않았다** -
    // 고치면 동작이 달라진다. 별건으로 보고했고, 그때 Object.hasOwn으로
    // 바꾸면서 회귀 테스트를 같이 바꾼다.
    if (!candidate.label || !sortingDbV2[candidate.itemId]) continue;
    if (seen.has(candidate.itemId)) continue;
    seen.add(candidate.itemId);
    objectCandidates.push(candidate);
    if (objectCandidates.length === LIMITS.candidates) break;
  }

  const materialCandidates: MaterialCandidate[] = Array.isArray(value.materialCandidates)
    ? value.materialCandidates
        .map((entry): MaterialCandidate => ({
          label: clean(isRecord(entry) ? entry.label : undefined).slice(0, LIMITS.labelLength),
          confidenceBand: confidenceBand(isRecord(entry) ? entry.confidenceBand : undefined)
        }))
        .filter((entry) => entry.label)
        .slice(0, LIMITS.candidates)
    : [];

  const visibleCautions: string[] = Array.isArray(value.visibleCautions)
    ? [...new Set(value.visibleCautions.map((entry) => clean(entry).slice(0, LIMITS.cautionLength)).filter(Boolean))].slice(0, LIMITS.cautions)
    : [];

  return {
    objectCandidates,
    materialCandidates,
    visibleCautions,
    uncertainty: value.uncertainty,
    needsUserCheck: typeof value.needsUserCheck === "boolean" ? value.needsUserCheck : true
  };
}

function newIdempotencyKey(fallback: string): string {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : fallback;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // readAsDataURL이므로 result는 항상 문자열이다. 원본은 String()으로
      // 감쌌는데, 만약 문자열이 아니면 "[object ArrayBuffer]"가 되어 어차피
      // 쉼표 뒤가 없으므로 빈 문자열로 끝난다 - 결과는 같고 의도는 더 분명하다.
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("image_encode_failed"));
    reader.readAsDataURL(blob);
  });
}

interface PreparedImage {
  mimeType: string;
  data: string;
  metadata: { mimeType: string; width: number; height: number; byteLength: number };
}

// 사진을 긴 변 768px로 줄이고 JPEG로 다시 인코딩한다. 그대로 보내면 요즘
// 휴대폰 사진이 수 MB라 업로드가 오래 걸리고 상한에도 걸린다.
async function prepareImage(imageEl: HTMLImageElement): Promise<PreparedImage | null> {
  const sourceWidth = imageEl.naturalWidth || imageEl.width || 0;
  const sourceHeight = imageEl.naturalHeight || imageEl.height || 0;
  if (!sourceWidth || !sourceHeight) return null;
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(imageEl, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob || blob.size > MAX_IMAGE_BYTES) return null;
  const data = await blobToBase64(blob);
  return data ? { mimeType: "image/jpeg", data, metadata: { mimeType: "image/jpeg", width, height, byteLength: blob.size } } : null;
}

export async function analyzePhoto(imageEl: HTMLImageElement, { searchQuery = "" }: { searchQuery?: string } = {}): Promise<AnalysisResult> {
  const client = edu2gClient();
  if (!client?.analyzeSortingImage) return { ok: false, code: "provider_unavailable" };
  try {
    // prepareImage(blobToBase64)는 FileReader 오류 시 reject할 수 있다 - 이
    // try 밖에 두면 analyzePhoto 자체가 reject해버려서, 호출부에 .catch가
    // 없으면 스캔 모달이 영원히 "분석 중"에 멈추고 버튼도 계속 비활성으로
    // 남는다(저사양 기기의 드문 인코딩 실패로 재현된 적이 있다). 다른 실패와
    // 똑같이 여기서 흡수한다.
    const imagePayload = await prepareImage(imageEl);
    if (!imagePayload) return { ok: false, code: "image_prepare_failed" };
    const reqId = requestId("mobile-sorting");
    const response = await client.analyzeSortingImage({
      schemaVersion: VISION_SCHEMA,
      requestId: reqId,
      sessionId: `session-${Date.now().toString(36)}`,
      idempotencyKey: newIdempotencyKey(reqId),
      locale: "ko-KR",
      source: PROVIDER,
      imageMetadata: imagePayload.metadata,
      userContext: { searchQuery: clean(searchQuery), selectedCorrectionType: "", locale: "ko-KR" },
      image: imagePayload
    });
    if (!response.ok) return { ok: false, code: clean(response.code) || "provider_unavailable" };
    const normalized = normalizeAnalysis(response.data, reqId, VISION_SCHEMA);
    if (!normalized) return { ok: false, code: "invalid_response" };
    return { ok: true, value: normalized };
  } catch {
    return { ok: false, code: "analysis_failed" };
  }
}

// 검색창에 친 말이 12개 품목 어디에도 안 걸릴 때의 대체 경로. 사진 판단과
// 같은 모양의 결과를 돌려줘서 결과 모달을 그대로 쓸 수 있게 한다.
export async function analyzeText(query: string): Promise<AnalysisResult> {
  const client = edu2gClient();
  if (!client?.analyzeSortingText) return { ok: false, code: "provider_unavailable" };
  const trimmed = clean(query).slice(0, LIMITS.queryLength);
  if (!trimmed) return { ok: false, code: "invalid_query" };
  const reqId = requestId("mobile-text");
  try {
    const response = await client.analyzeSortingText({
      schemaVersion: TEXT_SCHEMA,
      requestId: reqId,
      sessionId: `session-${Date.now().toString(36)}`,
      idempotencyKey: newIdempotencyKey(reqId),
      locale: "ko-KR",
      source: PROVIDER,
      query: trimmed
    });
    if (!response.ok) return { ok: false, code: clean(response.code) || "provider_unavailable" };
    const normalized = normalizeAnalysis(response.data, reqId, TEXT_SCHEMA);
    if (!normalized) return { ok: false, code: "invalid_response" };
    return { ok: true, value: normalized };
  } catch {
    return { ok: false, code: "analysis_failed" };
  }
}
