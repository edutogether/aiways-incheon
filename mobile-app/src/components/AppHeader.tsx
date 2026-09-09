export function AppHeader() {
  return (
    <header className="text-center max-w-lg w-full my-4">
      <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3.5 py-1 rounded-full text-[11px] font-bold mb-3 shadow-sm border border-blue-100">
        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
        AI Ways Incheon - 버리는 순간을 바꾸다.
      </div>
      {/* ♻️ 와 "도우미" 사이 공백은 렌더 결과에 남는다 - 한 줄로 붙여 둔다.
          JSX는 줄바꿈으로 나뉜 요소 사이의 공백을 없애기 때문에, 여기서
          줄을 나누면 원본과 간격이 달라진다. */}
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex justify-center items-center gap-2">
        ♻️ <span className="text-blue-600">3초 판단</span> 도우미
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-medium">AI와 데이터로 실천하는 학교 자원순환 UX 개선 프로젝트</p>
    </header>
  );
}
