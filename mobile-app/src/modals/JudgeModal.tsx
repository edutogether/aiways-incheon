import { GeminiSpark } from "../components/GeminiSpark";

// 3초 판단 결과 모달. 안에 세 가지 상태가 겹쳐 있고(사진 분석 중 / 텍스트
// 분석 중 / 결과), 어느 하나만 보이도록 나머지에 hidden이 붙는다.
export function JudgeModal() {
  return (
    <div id="judgeModal" className="hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-sm w-full max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl border border-slate-100 relative" id="judgeModalBox">
        <button id="judgeModalClose" type="button" aria-label="닫기" className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-lg font-bold transition-colors">×</button>

        {/* 사진 AI 분석 중 스캔 연출 */}
        <div id="judgeScanState" className="hidden space-y-3 pr-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square">
            <img id="judgeScanImage" className="w-full h-full object-cover opacity-80" alt="" />
            <span className="scan-line"></span>
          </div>
          <div className="flex items-center justify-center gap-2 text-base font-extrabold text-slate-700">
            <GeminiSpark gradientId="gemGradScan" className="w-7 h-7 animate-pulse shrink-0" />
            Powered by Google Gemini
          </div>
        </div>

        {/* 검색어 텍스트 AI 판단 중 연출 */}
        <div id="judgeTextScanState" className="hidden space-y-4 pr-4 py-6 text-center">
          <span id="judgeTextScanQuery" className="text-lg font-extrabold text-slate-800 block">검색어</span>
          <div className="w-full max-w-[220px] h-1.5 bg-slate-100 rounded-full loading-bar-track mx-auto">
            <div className="loading-bar-fill h-full"></div>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <GeminiSpark gradientId="gemGradTextScan" className="w-6 h-6 animate-pulse shrink-0" />
            분리배출 방법을 찾아보고 있어요
          </div>
        </div>

        <div id="judgeResultState" className="space-y-4">
          <div className="pr-9">
            <span id="resCategory" className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase mb-1">카테고리</span>
            <h3 id="resTitle" className="text-lg sm:text-xl font-bold text-slate-900">물건 이름</h3>
          </div>
          <span id="resActionTag" className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full">판단 대기</span>

          <p id="resBody" className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">안내 가이드라인 문장</p>

          <div id="resCandidates" className="hidden flex flex-wrap gap-1.5"></div>

          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-start gap-2">
            <span className="text-base shrink-0">💡</span>
            <div>
              <p className="text-xs font-bold text-slate-700 mb-0.5">핵심 팁</p>
              <p id="resTip" className="text-[11px] text-slate-500 leading-relaxed">추가 꿀팁이나 세부 사항이 표시됩니다.</p>
            </div>
          </div>

          <div id="hold-registration-form" className="hidden p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <span>❓</span><span>학교 판단 보류함에 실물 기록하기</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-snug">애매한 복합 쓰레기를 무단 투기하지 않고 보류함에 모아 자원순환 회의에 안건으로 제출해 보세요.</p>
            <div className="flex gap-2">
              <input type="text" id="holdItemName" placeholder="예: 스프링 공책, 부러진 자" className="flex-1 bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
              <button id="registerHoldBtn" type="button" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shrink-0">보류함 기록</button>
            </div>
          </div>

          <div className="pt-1 flex justify-end" id="practiceActionRow">
            <button id="btnLogPractice" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 active:scale-95">
              ✅ 가이드 확인 및 실천 기록하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
