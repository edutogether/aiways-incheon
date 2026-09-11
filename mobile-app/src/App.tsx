import { useCallback, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { PoweredByBanner } from "./components/PoweredByBanner";
import { TabNav, type TabId } from "./components/TabNav";
import { ToastLayer } from "./components/ToastLayer";
import { useJudge } from "./judge/useJudge";
import { ConfirmModal } from "./modals/ConfirmModal";
import { JudgeModal } from "./modals/JudgeModal";
import { submitSortingRecord } from "./records/sortingRecords";
import { useClassRanking } from "./signup/useClassRanking";
import { useSignup } from "./signup/useSignup";
import { useConfirmModal } from "./state/useConfirmModal";
import { useHoldBox } from "./state/useHoldBox";
import { usePracticeStats } from "./state/usePracticeStats";
import { useQuiz } from "./state/useQuiz";
import { useSharedTabHeight } from "./state/useSharedTabHeight";
import { useToasts } from "./state/useToasts";
import { HoldTab } from "./tabs/HoldTab";
import { JudgeTab } from "./tabs/JudgeTab";
import { QuizTab } from "./tabs/QuizTab";
import { StatsTab } from "./tabs/StatsTab";

// #appRoot 안쪽 전체. 원본 index.html의 구조를 그대로 옮긴 것이라, 여기
// 순서를 바꾸면 화면이 바뀐다 - 모달 두 개가 <main> 바깥, 탭들 뒤에 오는
// 것도 원본 그대로다.
export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("tab-judge");
  const { minHeight: tabMinHeight, requestSync: requestTabSync } = useSharedTabHeight(activeTab);

  const { toasts, showToast } = useToasts();
  const confirmModal = useConfirmModal();
  const practice = usePracticeStats();

  // 가입 정보가 바뀌면(가입 완료, 반 변경) 랭킹을 다시 불러와야 한다.
  const [rankingReloadKey, setRankingReloadKey] = useState(0);
  const signup = useSignup({
    showToast,
    openConfirm: confirmModal.open,
    onProfileChanged: () => setRankingReloadKey((key) => key + 1)
  });

  const registeredSchoolId = useCallback(() => signup.registeredSchoolId, [signup.registeredSchoolId]);
  // 🔴 가입을 마친 학생의 학년·반은 **서버가 준 프로필**에 있다. 이것을 안 주면
  //    랭킹이 임시 입력 카드에만 기대게 되어, 가입한 학생에게는 영영 안 뜬다.
  const registeredClass = useCallback(
    () => (signup.state.kind === "locked"
      ? { grade: signup.state.profile.grade, classNum: signup.state.profile.classNum }
      : null),
    [signup.state]);
  const ranking = useClassRanking(registeredSchoolId, registeredClass);
  const hold = useHoldBox({ showToast, registeredSchoolId });
  const quiz = useQuiz();
  const judge = useJudge({ showToast });

  // 판단 결과 모달에서 "실천 기록하기"를 눌렀을 때.
  const logPractice = useCallback(() => {
    const view = judge.result;
    const item = view?.item;
    if (!view || !item || item.isHold) {
      showToast("🛑 판단 유예 항목입니다. 보류함에 기록해 주세요.", "amber");
      return;
    }
    const isAiResult = view.isAiResult;
    void submitSortingRecord({
      status: "completed",
      selectedItemId: item.id,
      provider: isAiResult ? "future_gemini" : "manual_select",
      objectCandidates: isAiResult
        ? [{ label: view.aiLabel || item.label, itemId: item.id, objectType: item.objectType || item.id, confidenceBand: "unknown" }]
        : [],
      registeredSchoolId: signup.registeredSchoolId
    });
    practice.record(item);
    showToast(`🌳 올바른 실천 ! CO2 ${item.carbonSaved || 0}g이 절감되었습니다.`, "emerald");
  }, [judge.result, practice, showToast, signup.registeredSchoolId]);

  const goToSignup = useCallback(() => {
    setActiveTab("tab-stats");
    // 탭이 그려진 뒤에 포커스를 줘야 한다.
    window.setTimeout(() => document.getElementById("signupSchoolInput")?.focus(), 0);
  }, []);

  return (
    <>
      <AppHeader />

      <main className="relative max-w-lg w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-4 sm:p-6 space-y-6">
        <TabNav active={activeTab} onSelect={(tab) => { setActiveTab(tab); requestTabSync(); }} />

        <JudgeTab
          hidden={activeTab !== "tab-judge"}
          minHeight={tabMinHeight}
          judge={judge}
          stats={practice.stats}
          holdCount={hold.items.length}
          bannerVisible={signup.bannerVisible}
          onDismissBanner={signup.dismissBanner}
          onGoSignup={goToSignup}
        />
        <QuizTab hidden={activeTab !== "tab-quiz"} minHeight={tabMinHeight} quiz={quiz} />
        <StatsTab
          hidden={activeTab !== "tab-stats"}
          minHeight={tabMinHeight}
          stats={practice.stats}
          holdCount={hold.items.length}
          signup={signup}
          ranking={ranking}
          rankingReloadKey={rankingReloadKey}
          onResetStats={() => confirmModal.open({
            title: "실천 타임라인 비우기",
            description: "지금까지 쌓은 실천 횟수와 감축 이력이 사라집니다. 정말 초기화할까요 ?",
            icon: "🗑️",
            confirmClass: "bg-rose-500 hover:bg-rose-600",
            onConfirm: () => {
              practice.reset();
              showToast("🗑️ 실천 내역이 초기화되었습니다.", "slate");
            }
          })}
        />
        <HoldTab
          hidden={activeTab !== "tab-hold"}
          minHeight={tabMinHeight}
          items={hold.items}
          onAdd={hold.add}
          onResolve={(item) => confirmModal.open({
            title: "분류 기준 수립 및 보류 해결",
            description: `"${item.name}" 품목의 세부 분리배출 기준이 확정되었나요 ? 확인을 누르면 보류 목록에서 정리됩니다.`,
            icon: "🎉",
            confirmClass: "bg-emerald-600 hover:bg-emerald-700",
            onConfirm: () => { void hold.resolve(item.id); }
          })}
          onClearAll={() => confirmModal.open({
            title: "보류함 목록 초기화",
            description: "보류함에 등록된 모든 대기 목록을 비우시겠습니까 ?",
            icon: "🗑️",
            confirmClass: "bg-rose-500 hover:bg-rose-600",
            onConfirm: () => {
              hold.clear();
              showToast("🗑️ 보류함이 비워졌습니다.", "slate");
            }
          })}
          onInvalidName={() => showToast("⚠️ 안건 이름을 입력해 주세요.", "amber")}
        />

        <PoweredByBanner />
      </main>

      <JudgeModal
        judge={judge}
        onRegisterHold={(name) => {
          if (!name) {
            showToast("⚠️ 보류함에 올릴 물건의 이름을 적어 주세요.", "amber");
            return false;
          }
          hold.add(name);
          return true;
        }}
        onLogPractice={logPractice}
      />
      <ConfirmModal modal={confirmModal} />
      <ToastLayer toasts={toasts} />
    </>
  );
}
