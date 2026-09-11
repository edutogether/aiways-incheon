import { QUIZ_RANK_RANGES, quizRank } from "../quiz/rankLadder";
import type { useQuiz } from "../state/useQuiz";

const CORRECT_TITLE = "정답입니다 ! 훌륭한 실력이에요.";
const WRONG_TITLE = "아쉽네요 ! 자원순환 규칙을 배워봐요.";
const CORRECT_TITLE_CLASS = "text-xs font-extrabold text-emerald-800";
const WRONG_TITLE_CLASS = "text-xs font-extrabold text-rose-800";
const CORRECT_BOX_CLASS = "p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-start gap-2.5";
const WRONG_BOX_CLASS = "p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 flex items-start gap-2.5";

// 2. 3초 퀴즈 탭.
export function QuizTab({ hidden, minHeight, quiz }: { hidden: boolean; minHeight: number; quiz: ReturnType<typeof useQuiz> }) {
  const { question, index, total, score, feedback, finished, countdown, summary } = quiz;
  const correct = feedback?.correct ?? true;

  return (
    <div
      id="tab-quiz"
      className={`tab-content${hidden ? " hidden" : ""} space-y-5`}
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
    >
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-center space-y-2">
        <span className="text-base font-extrabold text-blue-600">🎮 3초 퀴즈 ! 분리배출 O/X 챌린지</span>
        <p className="text-sm font-semibold text-slate-600">분리배출 500문제 중 10문제가 랜덤 출제돼요.</p>
        <div id="quizRankLadder" className="grid grid-cols-3 gap-1.5 pt-1.5">
          {QUIZ_RANK_RANGES.map((range) => {
            const rank = quizRank(range.min);
            return (
              <div key={range.label} className="bg-white border border-blue-100 rounded-xl py-2.5 px-1 text-center">
                <div className="text-xl">{rank.emoji}</div>
                <div className="text-xs font-bold text-slate-700">{range.label}</div>
                <div className="text-[11px] font-semibold text-slate-500 leading-tight mt-0.5">{rank.title}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div id="quiz-box" className={`${finished ? "hidden " : ""}bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 relative min-h-[220px] flex flex-col justify-between`}>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-slate-400">
            <span id="quiz-progress">{`질문 ${index + 1} / ${total}`}</span>
            <span id="quiz-score" className="text-blue-600">{`현재 점수: ${score}점`}</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div id="quiz-progress-bar" className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${((index + 1) / total) * 100}%` }}></div>
          </div>
        </div>

        <div className="text-center py-4 space-y-2">
          <span id="quiz-emoji" className="text-4xl block">{question?.emoji ?? ""}</span>
          {/* 문제 문장에 <br>이 들어 있다(줄을 자연스러운 곳에서 끊으려고 데이터에
              직접 넣어 둔 것이다). 이 값은 저장소 안의 고정 데이터이고 사용자
              입력이 아니라 그대로 마크업으로 넣는다 - 사용자가 친 글자를
              이렇게 넣으면 절대 안 된다. */}
          <h4 id="quiz-question" className="text-sm sm:text-base font-extrabold text-slate-800 leading-snug" dangerouslySetInnerHTML={{ __html: question?.question ?? "" }}></h4>
        </div>

        <div className={`grid grid-cols-2 gap-4${feedback ? " hidden" : ""}`} id="quiz-buttons">
          <button data-quiz-answer="true" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-md transition-all active:scale-[0.97] text-xl" onClick={() => quiz.answer(true)}>O</button>
          <button data-quiz-answer="false" className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-2xl shadow-md transition-all active:scale-[0.97] text-xl" onClick={() => quiz.answer(false)}>X</button>
        </div>

        <div id="quiz-explanation-panel" className={`${feedback ? "" : "hidden "}space-y-3`}>
          <div className={feedback ? (correct ? CORRECT_BOX_CLASS : WRONG_BOX_CLASS) : "p-3.5 rounded-xl border flex items-start gap-2.5"} id="explanation-box-color">
            <span id="explanation-emoji" className="text-lg">{feedback ? (correct ? "🎉" : "💡") : "🎉"}</span>
            <div>
              <p id="explanation-title" className={feedback ? (correct ? CORRECT_TITLE_CLASS : WRONG_TITLE_CLASS) : "text-xs font-extrabold"}>{feedback ? (correct ? CORRECT_TITLE : WRONG_TITLE) : ""}</p>
              <p id="explanation-desc" className="text-[11px] leading-relaxed mt-0.5 text-slate-600">{feedback?.explanation ?? ""}</p>
            </div>
          </div>
          <button id="nextQuizBtn" type="button" className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-3 rounded-xl transition-all" onClick={quiz.goNext}>
            {countdown === null ? "다음 문제 풀기 ➔" : `${countdown}초 뒤 다음 문제 ➔`}
          </button>
        </div>
      </div>

      <div id="quiz-result-summary" className={`${finished ? "" : "hidden "}text-center p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-2`}>
        <h3 id="quiz-result-title" className="text-xl font-extrabold text-slate-800">{finished ? `${summary.rank.emoji} ${summary.rank.title}` : "🏆 AI Ways 자원순환 마스터"}</h3>
        <p id="quiz-result-message" className="text-xs font-semibold text-blue-600">{finished ? summary.rank.message : "완벽해요. 오늘의 분리배출 챔피언입니다 🏆"}</p>
        <p id="quiz-result-score-text" className="text-sm font-semibold text-slate-600 pt-1">{finished ? `${summary.total}문제 중 ${summary.correctCount}개 정답 · ${summary.score}점` : "10문제 중 8개 정답 · 160점"}</p>
        <button id="restartQuizBtn" type="button" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-3 rounded-xl transition-all mt-2" onClick={quiz.restart}>다시 도전하기 🔄</button>
      </div>
    </div>
  );
}
