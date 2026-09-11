import { GeminiSpark } from "./GeminiSpark";

// 모든 탭 아래에 공통으로 붙는 배너.
export function PoweredByBanner() {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-center gap-1.5">
        <GeminiSpark gradientId="gemGradBanner" className="w-8 h-8 shrink-0" />
        <span className="text-xs font-bold"><span className="text-slate-400 font-medium">Powered by</span> <span className="text-slate-900">Google Gemini</span></span>
      </div>
    </div>
  );
}
