// 2. 3초 퀴즈 탭.
export function QuizTab() {
  return (
    <div id="tab-quiz" className="tab-content hidden space-y-5">
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-center space-y-2">
        <span className="text-base font-extrabold text-blue-600">🎮 3초 퀴즈! 분리배출 O/X 챌린지</span>
        <p className="text-sm font-semibold text-slate-600">분리배출 관련 500문제 중 10문제가 랜덤으로 출제돼요.</p>
        <div id="quizRankLadder" className="grid grid-cols-3 gap-1.5 pt-1.5"></div>
      </div>

      <div id="quiz-box" className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 relative min-h-[220px] flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-slate-400">
            <span id="quiz-progress">질문 1 / 5</span>
            <span id="quiz-score" className="text-blue-600">현재 점수: 0점</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div id="quiz-progress-bar" className="bg-blue-500 h-full transition-all duration-300" style={{ width: "20%" }}></div>
          </div>
        </div>

        <div className="text-center py-4 space-y-2">
          <span id="quiz-emoji" className="text-4xl block">📦</span>
          <h4 id="quiz-question" className="text-sm sm:text-base font-extrabold text-slate-800 leading-snug">질문 텍스트가 여기에 나옵니다.</h4>
        </div>

        <div className="grid grid-cols-2 gap-4" id="quiz-buttons">
          <button data-quiz-answer="true" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-md transition-all active:scale-[0.97] text-xl">O</button>
          <button data-quiz-answer="false" className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-2xl shadow-md transition-all active:scale-[0.97] text-xl">X</button>
        </div>

        <div id="quiz-explanation-panel" className="hidden space-y-3">
          <div className="p-3.5 rounded-xl border flex items-start gap-2.5" id="explanation-box-color">
            <span id="explanation-emoji" className="text-lg">🎉</span>
            <div>
              <p id="explanation-title" className="text-xs font-extrabold"></p>
              <p id="explanation-desc" className="text-[11px] leading-relaxed mt-0.5 text-slate-600"></p>
            </div>
          </div>
          <button id="nextQuizBtn" type="button" className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-3 rounded-xl transition-all">다음 문제 풀기 ➔</button>
        </div>
      </div>

      <div id="quiz-result-summary" className="hidden text-center p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
        <h3 id="quiz-result-title" className="text-xl font-extrabold text-slate-800">🏆 AI Ways 자원순환 마스터</h3>
        <p id="quiz-result-message" className="text-xs font-semibold text-blue-600">완벽해요. 오늘의 분리배출 챔피언입니다 🏆</p>
        <p id="quiz-result-score-text" className="text-sm font-semibold text-slate-600 pt-1">10문제 중 8개 정답 · 160점</p>
        <button id="restartQuizBtn" type="button" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-3 rounded-xl transition-all mt-2">다시 도전하기 🔄</button>
      </div>
    </div>
  );
}
