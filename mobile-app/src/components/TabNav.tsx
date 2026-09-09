// 탭 버튼. data-tab-btn 속성은 원본 app.js가 붙잡는 지점이라 그대로 둔다.
// 어느 탭이 활성인지에 따른 className 분기는 S4(상태)에서 붙인다 - 지금은
// 원본 HTML의 초기 상태(판단 탭 활성)를 그대로 옮긴다.
const ACTIVE = "text-center py-2.5 rounded-xl transition-all duration-300 bg-white text-slate-900 shadow-sm";
const INACTIVE = "text-center py-2.5 rounded-xl transition-all duration-300 text-slate-500 hover:text-slate-800";

export function TabNav() {
  return (
    <nav className="grid grid-cols-4 gap-1 bg-slate-100 p-1.5 rounded-2xl text-[11px] sm:text-xs font-bold">
      <button data-tab-btn="tab-judge" className={ACTIVE}>🔍 판단</button>
      <button data-tab-btn="tab-quiz" className={INACTIVE}>🎮 퀴즈</button>
      <button data-tab-btn="tab-stats" className={INACTIVE}>🌱 통계</button>
      <button data-tab-btn="tab-hold" className={INACTIVE}>❓ 보류함</button>
    </nav>
  );
}
