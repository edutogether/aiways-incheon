// S2 진행 중 — 원본 index.html의 섹션을 하나씩 옮긴다.
//
// 순서는 원본과 같아야 한다(스크롤 순서가 곧 화면이다). 지금은 대시보드
// 한 섹션만 있고, 나머지 여섯은 아직 원본에만 있다.
//
// 무엇을 지켜야 하는지는 tests/baseline/PC-BASELINE.md에 있다 - 특히
// **전환 전부터 있던 결함 셋은 그대로 재현해야 한다**는 것.
import { DashboardSection } from "./sections/DashboardSection";

export function App() {
  return <DashboardSection />;
}
