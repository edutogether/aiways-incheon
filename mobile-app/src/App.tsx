import { AppHeader } from "./components/AppHeader";
import { PoweredByBanner } from "./components/PoweredByBanner";
import { TabNav } from "./components/TabNav";
import { ConfirmModal } from "./modals/ConfirmModal";
import { JudgeModal } from "./modals/JudgeModal";
import { HoldTab } from "./tabs/HoldTab";
import { JudgeTab } from "./tabs/JudgeTab";
import { QuizTab } from "./tabs/QuizTab";
import { StatsTab } from "./tabs/StatsTab";

// #appRoot 안쪽 전체. 원본 index.html의 구조를 그대로 옮긴 것이라, 여기
// 순서를 바꾸면 화면이 바뀐다 - 모달 두 개가 <main> 바깥, 탭들 뒤에 오는
// 것도 원본 그대로다(fixed 오버레이라 위치 자체는 화면에 안 나타나지만,
// DOM 순서는 겹침 순서에 영향을 준다).
export function App() {
  return (
    <>
      <AppHeader />

      <main className="relative max-w-lg w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-4 sm:p-6 space-y-6">
        <TabNav />
        <JudgeTab />
        <QuizTab />
        <StatsTab />
        <HoldTab />
        <PoweredByBanner />
      </main>

      <JudgeModal />
      <ConfirmModal />
    </>
  );
}
