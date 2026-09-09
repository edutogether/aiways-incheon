// 1. 3초 판단 탭.
export function JudgeTab() {
  return (
    <div id="tab-judge" className="tab-content space-y-5">

      {/* 첫 진입 가입 유도 배너: 가입은 여전히 선택(강제 게이트 아님)이지만,
          '통계' 탭 안에 숨어있어서 아무도 안 누르면 그 학생 기록이 우리반
          랭킹에 영영 안 잡히는 문제가 있어 눈에 띄게 배너로 유도한다.
          가입 완료되거나 '나중에'를 누르면 다시 안 뜬다. */}
      <div id="signupBanner" className="hidden bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 space-y-2 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
          <span>🎓</span><span>아직 가입 전이에요!</span>
        </div>
        <p className="text-[11px] text-blue-100 leading-snug">한 번만 가입하면 내 기록이 우리 학년 반별 순위에 정확히 반영돼요. 안 해도 판단/퀴즈는 그대로 쓸 수 있어요.</p>
        <div className="flex gap-2">
          <button id="signupBannerGoBtn" type="button" className="flex-1 bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs py-2 rounded-xl transition-all">지금 가입하기 →</button>
          <button id="signupBannerDismissBtn" type="button" className="text-blue-100 hover:text-white font-bold text-xs px-3 py-2 rounded-xl transition-all">나중에</button>
        </div>
      </div>

      {/* 오늘의 실천 현황 (통계 탭과 동일한 실데이터) */}
      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-lg">🌱</span>
          <span className="text-xs font-bold text-teal-800">오늘 나의 3초 판단 현황</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/70 rounded-xl py-2 text-center">
            <div className="text-[11px] font-semibold text-teal-700/80 leading-tight">누적 올바른 배출</div>
            <div id="judge-stat-count" className="text-lg font-extrabold text-blue-600">0회</div>
          </div>
          <div className="bg-white/70 rounded-xl py-2 text-center">
            <div className="text-[11px] font-semibold text-teal-700/80 leading-tight">이산화탄소 저감량</div>
            <div id="judge-stat-carbon" className="text-lg font-extrabold text-teal-600">0.0g</div>
          </div>
          <div className="bg-white/70 rounded-xl py-2 text-center">
            <div className="text-[11px] font-semibold text-teal-700/80 leading-tight">판단 보류 등록</div>
            <div id="judge-stat-hold" className="text-lg font-extrabold text-amber-500">0개</div>
          </div>
        </div>
      </div>

      {/* 사진으로 판단하기 (실제 AI 연결) */}
      <div>
        <div className="mb-2.5">
          <span className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
            <span className="text-base">📷</span>
            사진으로 3초 판단
          </span>
        </div>
        <input type="file" id="photoInput" accept="image/*" capture="environment" className="hidden" />
        <button id="photoTriggerBtn" type="button" className="w-full flex items-center justify-center gap-2.5 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all duration-200 active:scale-[0.98] font-bold text-sm shadow-sm">
          <span className="text-xl">📷</span>
          <span>사진 찍고 AI에게 물어보기</span>
        </button>
      </div>

      {/* 검색 + 자주 찾는 학교 쓰레기 */}
      <div>
        <label htmlFor="searchInput" className="block text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center gap-1">🗑️ 자주 찾는 학교 쓰레기</label>
        <div className="relative">
          <span id="searchEmojiIcon" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg leading-none pointer-events-none transition-opacity duration-150">❓</span>
          <input type="text" id="searchInput" placeholder="버리는 순간을 기록해주세요"
                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-12 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-300" />
          <button id="searchTriggerBtn" type="button" className="absolute right-3.5 top-3.5 text-slate-400 hover:text-blue-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </button>
          <div id="search-suggestions" className="hidden absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 max-h-52 overflow-y-auto divide-y divide-slate-100 text-xs custom-scrollbar"></div>
        </div>

        <div id="quickSelectGrid" className="grid grid-cols-4 gap-2 mt-3.5"></div>
        <button id="holdQuickBtn" type="button" className="w-full mt-2.5 flex items-center justify-center gap-2 p-3 bg-amber-50 hover:bg-amber-100/50 border border-amber-100 hover:border-amber-300 rounded-2xl transition-all duration-200 text-amber-800 active:scale-95">
          <span className="text-lg">❓</span>
          <span className="text-xs font-bold">잘 모르겠어요 (판단 보류함 기록)</span>
        </button>
      </div>
    </div>
  );
}
