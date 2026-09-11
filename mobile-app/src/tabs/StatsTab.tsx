import { useEffect } from "react";
import { SignupCard } from "../signup/SignupCard";
import type { useClassRanking } from "../signup/useClassRanking";
import type { useSignup } from "../signup/useSignup";
import type { PracticeStats } from "../state/usePracticeStats";

interface StatsTabProps {
  hidden: boolean;
  minHeight: number;
  stats: PracticeStats;
  holdCount: number;
  signup: ReturnType<typeof useSignup>;
  ranking: ReturnType<typeof useClassRanking>;
  rankingReloadKey: number;
  onResetStats: () => void;
}

// 3. 실천 통계 탭.
export function StatsTab({ hidden, minHeight, stats, holdCount, signup, ranking, rankingReloadKey, onResetStats }: StatsTabProps) {
  const rankingLoad = ranking.load;
  // 처음 한 번, 그리고 가입·반 변경으로 소속이 바뀔 때마다 다시 불러온다.
  useEffect(() => {
    void rankingLoad();
  }, [rankingLoad, rankingReloadKey]);


  return (
    <div
      id="tab-stats"
      className={`tab-content${hidden ? " hidden" : ""} space-y-5`}
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
    >
      <SignupCard signup={signup} />


      <div id="classRankingCard" className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
            <span>🏆</span><span>우리 학년 반별 랭킹</span>
          </div>
          <button id="classRankingRefreshBtn" type="button" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700" onClick={() => void ranking.load()}>새로고침 🔄</button>
        </div>
        <p id="classRankingStatus" className="text-[10px] text-indigo-500 leading-snug">{ranking.status}</p>
        {/* 🔴 비어 있어도 화면이 비지 않게 한다(지시 Bumm - "아무리 없어도
            애니메이션은 있어야지, PC처럼"). 불러오는 중에는 자리를 잡아 두고
            반짝이게 하고, 결과가 없으면 왜 없는지를 그 자리에 남긴다. */}
        {ranking.loading && (
          <ol id="classRankingSkeleton" className="space-y-1.5" aria-hidden="true">
            {[0, 1, 2].map((n) => (
              <li key={n} className="ranking-skeleton flex items-center justify-between rounded-xl px-3 py-2 text-xs bg-white">
                <span className="ranking-skeleton-bar" style={{ width: "58%" }} />
                <span className="ranking-skeleton-bar" style={{ width: "18%" }} />
              </li>
            ))}
          </ol>
        )}
        {!ranking.loading && !ranking.rows.length && (
          <div id="classRankingEmpty" className="rounded-xl bg-white/70 px-3 py-4 text-center">
            <span className="block text-2xl" aria-hidden="true">🏅</span>
            <span className="block text-[11px] font-semibold text-indigo-700 mt-1">아직 보여줄 순위가 없어요.</span>
          </div>
        )}
        <ol id="classRankingList" className="space-y-1.5">
          {ranking.rows.map((row) => (
            <li key={row.classNum} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${row.isMine ? "bg-indigo-600 text-white font-bold" : "bg-white text-slate-600 font-semibold"}`}>
              <span>{`${row.rank}위 · ${ranking.grade}학년 ${row.classNum}반`}</span>
              <span>{`${row.score}회`}</span>
            </li>
          ))}
        </ol>
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
          <h5 id="stat-count" className="text-xl sm:text-2xl font-extrabold text-blue-600">{`${stats.totalCount}회`}</h5>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 leading-tight block">이산화탄소 저감량</span>
          <h5 id="stat-carbon" className="text-xl sm:text-2xl font-extrabold text-teal-600">{`${stats.carbonReduction.toFixed(1)}g`}</h5>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 leading-tight block">판단 보류 등록</span>
          <h5 id="stat-hold" className="text-xl sm:text-2xl font-extrabold text-amber-500">{`${holdCount}개`}</h5>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-800">📋 오늘의 실천 타임라인</span>
          <button id="resetStatsBtn" type="button" className="text-xs font-bold text-slate-500 hover:text-white bg-slate-100 hover:bg-rose-500 px-3 py-1.5 rounded-lg transition-colors" onClick={onResetStats}>기록 초기화 🗑️</button>
        </div>
        <div id="practice-logs-container" className="space-y-2 h-[190px] overflow-y-auto custom-scrollbar">
          <div id="no-logs-msg" className={`${stats.logs.length ? "hidden " : ""}text-center py-8 border border-dashed border-slate-200 rounded-2xl`}>
            <p className="text-[11px] text-slate-400">아직 기록된 실천이 없습니다.<br />&apos;3초 판단&apos;에서 가이드라인을 확인하고 실천해보세요 !</p>
          </div>
          {stats.logs.map((log, position) => (
            // 같은 물건을 같은 초에 두 번 기록할 수 있어 시간만으로는 키가
            // 겹친다. 목록은 맨 앞에만 쌓이고 재정렬이 없어서 자리로 잡아도
            // 안전하다.
            <div key={`${log.time}-${position}`} className="practice-item flex justify-between items-center bg-white p-3 border border-slate-100 rounded-xl shadow-sm text-xs transition-all duration-300">
              <div className="flex items-center gap-2">
                <span className="log-category bg-blue-50 text-blue-600 font-extrabold px-1.5 py-0.5 rounded text-[9px] shrink-0">{log.category}</span>{" "}
                <span className="log-name font-bold text-slate-700 truncate max-w-[150px] sm:max-w-xs">{log.name}</span>
              </div>{" "}
              <div className="text-right shrink-0">
                <span className="font-extrabold text-emerald-600 block">{`-${log.carbon}g CO₂`}</span>{" "}
                <span className="log-time text-[9px] text-slate-400 block">{log.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-2">
        <span className="text-sm font-bold text-blue-600">💡 왜 실천을 기록하나요 ?</span>
        <p className="text-xs text-slate-600 leading-relaxed">한 번의 올바른 분리배출은 작아 보이지만, 우리 반 전체가 매일 실천하면 학교 단위의 자원순환 데이터가 쌓입니다. 이 기록은 우리 학교가 실제로 자원을 얼마나 아끼고 있는지 보여주는 증거가 됩니다.</p>
        <p className="text-xs text-slate-600 leading-relaxed"><strong className="font-bold text-slate-700">🌍 깜짝 상식:</strong> 투명 페트병 1개를 제대로 분리배출하면 약 22g의 이산화탄소를 줄일 수 있어요. 하루에 우리 반 25명이 하나씩만 실천해도 약 550g을 절감하는 셈이에요.</p>
      </div>
    </div>
  );
}
