// 탭 버튼 네 개.
//
// data-tab-btn 값은 원본이 쓰던 것 그대로다 - 탭 컨테이너의 id와 짝을
// 이루고, 접근성 검사나 외부 스크립트가 이 값을 붙잡을 수 있다.
export type TabId = "tab-judge" | "tab-quiz" | "tab-stats" | "tab-hold";

const ACTIVE = "text-center py-2.5 rounded-xl transition-all duration-300 bg-white text-slate-900 shadow-sm";
const INACTIVE = "text-center py-2.5 rounded-xl transition-all duration-300 text-slate-500 hover:text-slate-800";

const TABS: { id: TabId; label: string }[] = [
  { id: "tab-judge", label: "🔍 판단" },
  { id: "tab-quiz", label: "🎮 퀴즈" },
  { id: "tab-stats", label: "🌱 통계" },
  { id: "tab-hold", label: "❓ 보류함" }
];

export function TabNav({ active, onSelect }: { active: TabId; onSelect: (tab: TabId) => void }) {
  return (
    <nav className="grid grid-cols-4 gap-1 bg-slate-100 p-1.5 rounded-2xl text-[11px] sm:text-xs font-bold">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          data-tab-btn={tab.id}
          className={tab.id === active ? ACTIVE : INACTIVE}
          onClick={() => onSelect(tab.id)}
        >{tab.label}</button>
      ))}
    </nav>
  );
}
