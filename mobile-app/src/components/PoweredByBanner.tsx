import { GeminiSpark } from "./GeminiSpark";

// 모든 탭 아래에 공통으로 붙는 배너.
export function PoweredByBanner() {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-center gap-1.5">
        <GeminiSpark gradientId="gemGradBanner" className="w-8 h-8 shrink-0" />
        <span className="text-xs font-bold"><span className="text-slate-400 font-medium">Powered by</span> <span className="text-slate-900">Google Gemini</span></span>
      </div>
      <p className="text-center text-[10.5px] leading-snug text-slate-500">본 플랫폼은 환경부 분리배출 및 인천광역시교육청 자원순환 공식 지침을 바탕으로 제작되었습니다.</p>
    </div>
  );
}
