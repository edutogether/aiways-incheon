// 판단 보류함.
//
// 등록은 낙관적으로 처리한다 - 화면 목록에 먼저 넣고 서버 저장은 뒤에서
// 한다. 대신 idempotencyKey를 **등록 시점에 미리 고정해** 항목에 붙여 두는데,
// 그래야 그때 저장이 실패했더라도(오프라인 등) 나중에 "해결 완료"를 누를 때
// 같은 키로 안전하게 재시도할 수 있다(중복 생성 없이 흡수된다).
import { useCallback, useRef, useState } from "react";
import { createRecordIdempotencyKey, submitSortingRecord } from "../records/sortingRecords";
import { edu2gClient } from "../legacy/globals";
import { STORAGE_KEYS, readJson, removeKey, writeJson } from "./storage";
import type { ToastTone } from "./useToasts";

export interface HoldItem {
  id: string;
  name: string;
  date: string;
  recordId: string | null;
  idempotencyKey: string;
}

interface HoldBoxOptions {
  showToast: (message: string, tone?: ToastTone) => void;
  registeredSchoolId: () => string;
}

function todayLabel(): string {
  const today = new Date();
  return `${today.getMonth() + 1}월 ${today.getDate()}일`;
}

export function useHoldBox({ showToast, registeredSchoolId }: HoldBoxOptions) {
  const [items, setItems] = useState<HoldItem[]>(() => readJson<HoldItem[]>(STORAGE_KEYS.hold, []));
  // 서버 응답이 늦게 와서 목록을 고쳐야 할 때, 그 사이 사용자가 목록을
  // 바꿨을 수도 있다. 최신 값을 항상 보게 참조를 하나 들고 간다.
  const latest = useRef(items);
  latest.current = items;

  const persist = useCallback((next: HoldItem[]) => {
    latest.current = next;
    writeJson(STORAGE_KEYS.hold, next);
    setItems(next);
  }, []);

  const add = useCallback((name: string) => {
    const holdId = crypto.randomUUID();
    const idempotencyKey = createRecordIdempotencyKey();
    persist([{ id: holdId, name, date: todayLabel(), recordId: null, idempotencyKey }, ...latest.current]);
    showToast(`❓ "${name}"이(가) 회의 안건 목록에 등록되었습니다.`, "amber");

    void submitSortingRecord({
      status: "held",
      selectedItemId: name,
      provider: "manual_hold",
      holdReasons: ["학생 직접 등록"],
      idempotencyKey,
      registeredSchoolId: registeredSchoolId()
    }).then((result) => {
      if (!result.recordId) return;
      // 응답이 오기 전에 사용자가 이미 해결·초기화했을 수 있다.
      const target = latest.current.find((entry) => entry.id === holdId);
      if (!target) return;
      persist(latest.current.map((entry) => (entry.id === holdId ? { ...entry, recordId: result.recordId } : entry)));
    });
  }, [persist, showToast, registeredSchoolId]);

  const clear = useCallback(() => {
    removeKey(STORAGE_KEYS.hold);
    latest.current = [];
    setItems([]);
  }, []);

  /**
   * "해결 완료". 서버 기록을 completed로 바꾼 **뒤에만** 목록에서 지운다.
   *
   * 2026-09-07(intent: hold-resolve-server-sync) - 예전에는 로컬 목록만 지우고
   * 서버 기록은 held로 남겨서, 학급 대시보드의 집계가 실제 해결 여부와 항상
   * 어긋났다. 서버 호출이 실패하면 목록에 그대로 두고 실패를 알린다(실적이
   * 사라지는 것보다 다시 시도하는 편이 낫다).
   */
  const resolve = useCallback(async (id: string): Promise<boolean> => {
    const client = edu2gClient();
    const item = latest.current.find((entry) => entry.id === id);
    if (!item) return false;

    let recordId = item.recordId;
    if (!recordId && client?.saveSortingRecord) {
      // 최초 등록이 서버에 반영되지 못한 경우 - 같은 키로 재시도한다.
      const retryKey = item.idempotencyKey || createRecordIdempotencyKey();
      const retry = await submitSortingRecord({
        status: "held",
        selectedItemId: item.name,
        provider: "manual_hold",
        holdReasons: ["학생 직접 등록"],
        idempotencyKey: retryKey,
        registeredSchoolId: registeredSchoolId()
      });
      recordId = retry.recordId;
      persist(latest.current.map((entry) => (entry.id === id ? { ...entry, idempotencyKey: retryKey, recordId } : entry)));
    }

    if (!recordId || !client?.resolveSortingRecord) {
      showToast("⚠️ 아직 서버에 등록되지 않은 항목이에요. 네트워크 연결을 확인하고 다시 시도해 주세요.", "amber");
      return false;
    }

    const result = await client.resolveSortingRecord({
      recordId,
      idempotencyKey: createRecordIdempotencyKey(),
      resolutionType: "confirmed_after_review",
      userDecision: { userConfirmed: true },
      checklist: [{ id: "hold_resolved", label: "보류함에서 해결 완료 처리", checked: true }]
    });
    if (!result.ok) {
      showToast(client.errorMessageFor?.(result.code ?? "") || "해결 처리에 실패했어요. 다시 시도해 주세요.", "amber");
      return false;
    }

    persist(latest.current.filter((entry) => entry.id !== id));
    showToast(`💡 "${item.name}" 품목이 보류함에서 정리되었습니다.`, "emerald");
    return true;
  }, [persist, showToast, registeredSchoolId]);

  return { items, add, clear, resolve };
}
