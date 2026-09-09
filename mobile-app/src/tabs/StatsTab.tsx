// 3. 실천 통계 탭.
export function StatsTab() {
  return (
    <div id="tab-stats" className="tab-content hidden space-y-5">
      {/* 정식 가입: 최초 1회만, 가입하면 이 기기에 영구히 고정된다(다시 못
          바꿈). 안 해도 판단/퀴즈는 그대로 쓸 수 있고(강제 아님), 가입하면
          우리반 순위·통계에 정확히 반영된다. 가입 완료 시 이 카드는 JS가
          읽기전용 상태로 바꿔치기한다. */}
      <div id="signupCard" className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
          <span>🎓</span><span>정식 가입하기</span>
        </div>
        <p className="text-[10px] text-blue-600 leading-snug">한 번만 가입하면 이 기기에 영구히 저장돼요(다시 못 바꿔요). 가입하면 우리반 순위·통계에 내 기록이 정확히 반영됩니다. 안 해도 판단/퀴즈는 그대로 쓸 수 있어요.</p>
        <div id="signupRoleGroup" className="grid grid-cols-2 gap-2 text-xs font-bold" role="radiogroup" aria-label="가입 유형">
          <button type="button" id="signupRoleHomeroomBtn" data-role="homeroom" className="bg-white border border-blue-200 text-blue-700 rounded-xl py-2 transition-all" aria-pressed="false">담임 선생님</button>
          <button type="button" id="signupRoleStudentBtn" data-role="student" className="bg-blue-600 border border-blue-600 text-white rounded-xl py-2 transition-all" aria-pressed="true">학생</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1 relative">
            <input type="text" id="signupSchoolInput" placeholder="학교 이름 검색" autoComplete="off" className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="hidden" id="signupSchoolCode" />
            <div id="signupSchoolResults" className="hidden absolute left-0 right-0 mt-1 bg-white border border-blue-200 rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto text-xs"></div>
          </div>
          <input type="text" inputMode="numeric" maxLength={2} id="signupGradeInput" placeholder="학년" className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" inputMode="numeric" maxLength={2} id="signupClassInput" placeholder="반" className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div id="signupStudentFields" className="grid grid-cols-3 gap-2">
          <input type="text" inputMode="numeric" maxLength={2} id="signupNumberInput" placeholder="번호" className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" id="signupNameInput" placeholder="이름" className="col-span-2 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div id="signupHomeroomFields" className="hidden grid grid-cols-3 gap-2">
          <input type="text" id="signupHomeroomNameInput" placeholder="담임 선생님 성함" className="col-span-3 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <p id="signupTeacherGreeting" className="col-span-3 hidden text-xs font-bold text-blue-800"></p>
          <input type="text" id="signupTeacherCodeInput" placeholder="운영자에게 받으신 인증코드" className="col-span-3 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <button id="signupSubmitButton" type="button" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all">가입하기</button>
        <p id="signupStatus" className="text-[10px] font-semibold text-blue-500"></p>
      </div>

      {/* 임시 학교/반 입력: 가입 안 한 학생의 기록에 붙일 값. 가입하면 이
          카드는 숨겨지고(서버가 가입 정보로 대체), 안 하면 계속 쓸 수 있다. */}
      <div id="interimClassCard" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <span>🏫</span><span>내 학교/반 (임시 입력)</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-snug">우리 반 기록으로 집계되려면 학교/학년/반을 적어 주세요. 정식 가입 기능이 열리면 이 입력은 자동으로 대체됩니다.</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1 relative">
            <input type="text" id="classSchoolInput" placeholder="학교 이름 검색" autoComplete="off" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="hidden" id="classSchoolCode" />
            <div id="classSchoolResults" className="hidden absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto text-xs"></div>
          </div>
          <input type="text" inputMode="numeric" id="classGradeInput" placeholder="학년" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" id="classNumInput" placeholder="반" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <p id="classContextStatus" className="text-[10px] font-semibold text-slate-400"></p>
      </div>

      <div id="classRankingCard" className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
            <span>🏆</span><span>우리 학년 반별 랭킹</span>
          </div>
          <button id="classRankingRefreshBtn" type="button" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700">새로고침 🔄</button>
        </div>
        <p id="classRankingStatus" className="text-[10px] text-indigo-500 leading-snug">학교/반을 연결하면 우리 반 순위가 표시돼요.</p>
        <ol id="classRankingList" className="space-y-1.5"></ol>
      </div>

      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-3xl">🌳</span>
        <div>
          <h4 className="text-sm sm:text-base font-bold text-teal-800">나의 분리배출 작은 실천 효과</h4>
          <p className="text-xs text-teal-600 mt-0.5">올바른 3초 분리배출 실천이 모여 깨끗한 지구를 만듭니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 leading-tight block">누적 올바른 배출</span>
          <h5 id="stat-count" className="text-xl sm:text-2xl font-extrabold text-blue-600">0회</h5>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 leading-tight block">이산화탄소 저감량</span>
          <h5 id="stat-carbon" className="text-xl sm:text-2xl font-extrabold text-teal-600">0.0g</h5>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 leading-tight block">판단 보류 등록</span>
          <h5 id="stat-hold" className="text-xl sm:text-2xl font-extrabold text-amber-500">0개</h5>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-800">📋 오늘의 실천 타임라인</span>
          <button id="resetStatsBtn" type="button" className="text-xs font-bold text-slate-500 hover:text-white bg-slate-100 hover:bg-rose-500 px-3 py-1.5 rounded-lg transition-colors">기록 초기화 🗑️</button>
        </div>
        <div id="practice-logs-container" className="space-y-2 h-[190px] overflow-y-auto custom-scrollbar">
          <div id="no-logs-msg" className="text-center py-8 border border-dashed border-slate-200 rounded-2xl">
            <p className="text-[11px] text-slate-400">아직 기록된 실천이 없습니다.<br />&apos;3초 판단&apos;에서 가이드라인을 확인하고 실천해보세요!</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-2">
        <span className="text-sm font-bold text-blue-600">💡 왜 실천을 기록하나요?</span>
        <p className="text-xs text-slate-600 leading-relaxed">한 번의 올바른 분리배출은 작아 보이지만, 우리 반 전체가 매일 실천하면 학교 단위의 자원순환 데이터가 쌓입니다. 이 기록은 우리 학교가 실제로 자원을 얼마나 아끼고 있는지 보여주는 증거가 됩니다.</p>
        <p className="text-xs text-slate-600 leading-relaxed"><strong className="font-bold text-slate-700">🌍 깜짝 상식:</strong> 투명 페트병 1개를 제대로 분리배출하면 약 22g의 이산화탄소를 줄일 수 있어요. 하루에 우리 반 25명이 하나씩만 실천해도 약 550g을 절감하는 셈이에요.</p>
      </div>
    </div>
  );
}
