// 자체 디자인 커스텀 확인용 모달. 제목·설명·아이콘·확인 버튼 색을 부르는
// 쪽이 채워 넣는 공용 모달이라, 여기 적힌 문구는 자리표시용 기본값이다.
export function ConfirmModal() {
  return (
    <div id="customModal" className="hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-100 transform scale-95 opacity-0 transition-all duration-300" id="modalBox">
        <div className="text-center space-y-2">
          <span id="modalIcon" className="text-3xl block">⚠️</span>
          <h4 id="modalTitle" className="text-base font-extrabold text-slate-800">모달 제목</h4>
          <p id="modalDesc" className="text-xs text-slate-500 leading-relaxed">상세 내용 설명이 표시되는 구간입니다.</p>
        </div>
        <div className="flex gap-2.5">
          <button id="modalCancelBtn" type="button" className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2.5 rounded-xl transition-all">취소</button>
          <button id="modalConfirmBtn" type="button" className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all">확인</button>
        </div>
      </div>
    </div>
  );
}
