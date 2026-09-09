// 판단 기록을 서버에 남기는 경로.
//
// 화면을 절대 붙잡지 않는다(fire-and-forget). 학생 눈에는 이미 반영된 것이
// 보이고, 저장은 뒤에서 조용히 이뤄진다 - "사진 찍는 것도 귀찮은데"라는
// 요구사항에서 나온 설계다. 실패해도 화면은 그대로 간다.
//
// GPS: 좌표는 이 파일 밖으로 나가지 않는다. 서버에 checkCampusLocation을
// 한 번 물어 "교내인가"의 결과(일회용 확인 ID)만 받아오고 좌표 자체는
// 아무 데도 저장하지 않는다. 권한 거부·타임아웃·학교 미확인 등 뭐가
// 실패하든 빈 문자열을 돌려주고 제출은 계속한다(그 기록은 개인 기록으로만
// 남고 반 경쟁에는 안 들어간다 - 결정된 사항).
import { edu2gClient } from "../legacy/globals";
import { loadClassContext } from "../state/storage";

const GPS_TIMEOUT_MS = 4000;
const GPS_MAX_AGE_MS = 60000;

export type RecordStatus = "completed" | "held";

export interface SubmitRecordInput {
  status: RecordStatus;
  selectedItemId: string;
  provider: string;
  objectCandidates?: unknown[];
  holdReasons?: string[];
  idempotencyKey?: string;
  /** 가입한 학생이면 서버가 확인한 학교가 더 믿을 만하다. */
  registeredSchoolId?: string;
}

export interface SubmitRecordResult {
  ok: boolean;
  recordId: string | null;
  idempotencyKey: string;
}

/**
 * 같은 기록을 두 번 만들지 않게 하는 키.
 *
 * 호출부가 미리 만들어 들고 있을 수 있게 밖으로 뺐다 - 보류함은 "처음
 * 등록이 실패했을 때 같은 키로 안전하게 재시도"해야 하는데, 그러려면 키가
 * 그 항목에 붙어 있어야 한다.
 */
export function createRecordIdempotencyKey(): string {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = window.crypto?.getRandomValues
    ? Array.from(window.crypto.getRandomValues(new Uint32Array(4)))
    : [Date.now(), Math.random() * 1e9, Math.random() * 1e9, Math.random() * 1e9];
  return bytes.map((value) => Number(value >>> 0).toString(36)).join("-");
}

function getCurrentPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("no_geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: timeoutMs, maximumAge: GPS_MAX_AGE_MS });
  });
}

async function resolveCampusCheckId(registeredSchoolId: string): Promise<string> {
  const client = edu2gClient();
  const schoolId = registeredSchoolId || loadClassContext()?.schoolId || "";
  if (!schoolId || !client?.checkCampusLocation) return "";
  try {
    const position = await getCurrentPosition(GPS_TIMEOUT_MS);
    const response = await client.checkCampusLocation({
      schoolId,
      lat: position.coords.latitude,
      lng: position.coords.longitude
    });
    return response.ok && response.data?.campusCheckId ? response.data.campusCheckId : "";
  } catch {
    return "";
  }
}

export async function submitSortingRecord({
  status,
  selectedItemId,
  provider,
  objectCandidates = [],
  holdReasons = [],
  idempotencyKey = createRecordIdempotencyKey(),
  registeredSchoolId = ""
}: SubmitRecordInput): Promise<SubmitRecordResult> {
  const client = edu2gClient();
  if (!client?.saveSortingRecord || !selectedItemId) return { ok: false, recordId: null, idempotencyKey };
  const classContext = loadClassContext();
  const campusCheckId = await resolveCampusCheckId(registeredSchoolId);
  const payload = {
    schemaVersion: "sorting-record-v1",
    status,
    provider: provider.slice(0, 80),
    analysis: { objectCandidates, materialCandidates: [], visibleCautions: [] },
    checklist: [],
    userDecision: { selectedItemId: selectedItemId.slice(0, 40), action: status === "held" ? "held" : "recorded", userConfirmed: true },
    hold: status === "held" ? { recommended: true, reasons: holdReasons.slice(0, 5) } : null,
    ...(classContext ? { classContext } : {}),
    ...(campusCheckId ? { campusCheckId } : {}),
    idempotencyKey
  };
  try {
    const result = await client.saveSortingRecord(payload);
    return { ok: result.ok, recordId: result.ok ? (result.data?.recordId ?? null) : null, idempotencyKey };
  } catch {
    return { ok: false, recordId: null, idempotencyKey };
  }
}
