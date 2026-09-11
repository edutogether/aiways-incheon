import { useState } from "react";
import type { HoldItem } from "../state/useHoldBox";

interface HoldTabProps {
  hidden: boolean;
  minHeight: number;
  items: HoldItem[];
  onAdd: (name: string) => void;
  onResolve: (item: HoldItem) => void;
  onClearAll: () => void;
  onInvalidName: () => void;
}

// 4. 판단 보류함 탭.
export function HoldTab({ hidden, minHeight, items, onAdd, onResolve, onClearAll, onInvalidName }: HoldTabProps) {
  const [draft, setDraft] = useState("");

  const submitDraft = () => {
    const value = draft.trim();
    if (!value) {
      onInvalidName();
      return;
    }
    onAdd(value);
    setDraft("");
  };

  return (
    <div
      id="tab-hold"
      className={`tab-content${hidden ? " hidden" : ""} space-y-5`}
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
    >
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-3xl">❓</span>
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-amber-800">학교 판단 보류함 대기 목록</h4>
          <p className="text-[11px] text-amber-600 mt-0.5">애매한 물건을 무단 투기하지 않고 정기 자원순환 회의를 통해 올바른 해결법을 결정하는 보류함입니다.</p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <label htmlFor="directHoldInput" className="block text-[11px] font-extrabold text-slate-600">✍️ 회의 안건 수동 등록</label>
        <div className="flex gap-2">
          <input type="text" id="directHoldInput" placeholder="예: 코팅 박막 책 표지, 실리콘 케이스"
                 className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                 value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button id="addHoldDirectBtn" type="button" className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-sm shrink-0" onClick={submitDraft}>등록</button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400">보류 및 유예 처리 물건 (<span id="hold-count-badge">{items.length}</span>개)</span>
          <button id="resetHoldBtn" type="button" className="text-xs font-bold text-slate-500 hover:text-white bg-slate-100 hover:bg-rose-500 px-3 py-1.5 rounded-lg transition-colors" onClick={onClearAll}>목록 비우기 🗑️</button>
        </div>
        <div id="hold-list-container" className="space-y-2 h-[196px] overflow-y-auto custom-scrollbar">
          <div id="no-hold-items-msg" className={`${items.length ? "hidden " : ""}text-center py-8 border border-dashed border-slate-200 rounded-2xl`}>
            <p className="text-[11px] text-slate-400">기록된 판단 보류 물건이 없습니다.<br />&apos;3초 판단&apos;에서 애매한 쓰레기를 등록하거나, 직접 기재해 보세요 !</p>
          </div>
          {items.map((item) => (
            <div key={item.id} className="hold-item-card flex justify-between items-center bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm text-xs hover:border-amber-200 transition-all">
              <div className="flex items-center gap-2.5 min-w-0 mr-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>{" "}
                {/* 이름은 학생이 직접 친 값이라 반드시 텍스트로만 넣는다.
                    마크업으로 끼워 넣으면 localStorage에서 되살릴 때마다
                    그 문자열이 실행되는 통로가 된다. */}
                <span className="hold-item-name font-extrabold text-slate-800 truncate">{item.name}</span>
              </div>{" "}
              <div className="flex items-center gap-2 shrink-0">
                <span className="hold-item-date text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">{item.date}</span>{" "}
                <button type="button" className="resolve-hold-btn bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl font-bold text-[10px] transition-colors" onClick={() => onResolve(item)}>해결 완료</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 space-y-2">
        <span className="text-sm font-bold text-amber-700">💡 판단 보류는 왜 필요한가요 ?</span>
        <p className="text-xs text-slate-600 leading-relaxed">복합 재질이거나 오염 상태가 애매한 물건을 억지로 분류하면 오히려 재활용 라인 전체를 오염시킬 수 있어요. 아무 데나 버리지 않고 여기에 기록해두면, 정기 자원순환 회의에서 우리 학교만의 기준을 함께 정할 수 있습니다.</p>
        <p className="text-xs text-slate-600 leading-relaxed"><strong className="font-bold text-slate-700">🌍 깜짝 상식:</strong> 재활용품 중 약 25%는 오염이나 잘못된 분류 때문에 선별장에서 다시 일반쓰레기로 폐기된다고 해요. &quot;일단 보류함에&quot; 기록하는 습관이 이런 손실을 줄여줍니다.</p>
      </div>
    </div>
  );
}
