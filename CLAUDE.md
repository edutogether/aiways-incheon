# CLAUDE.md — aiways-incheon-closed-beta

이 폴더가 **정본(canonical) 작업 저장소**다. `ssamkang/aiways-incheon`(최상위 CLAUDE.md의 인덱스에 남아있는 이름)은 실제로는 이 저장소의 git 메인 클론일 뿐이며, 활성 개발은 전부 여기서 진행한다.

## D (PC Visual Master) 참조본 — 언제든 복원 가능

"D"는 이 앱의 PC(≥64rem) 비주얼을 맞춰나가는 기준점(2026-07-27 커밋)이다.

- **영구 보존**: git 태그 `pc-visual-master-d` (커밋 `0bb2443`). 이 태그가 있는 한 워크트리를 통째로 지워도 언제든 복원 가능.
- **현재 라이브 워크트리**: `D:/Project/_visual-recovery/aiways-candidate-d` (포트 8231에서 서빙 중일 때 사용). 이건 그냥 편의용 체크아웃이니, 지워도 아래 명령으로 즉시 재생성 가능:
  ```
  git worktree add D:/Project/_visual-recovery/aiways-candidate-d pc-visual-master-d
  ```
- **비교 방법론**: 화면을 눈으로만 비교하지 말고, 두 앱을 동시에 띄운 뒤 `getComputedStyle()`로 같은 CSS 클래스 조합의 실제 계산값(폰트크기·패딩·마진·gap·색상 등)을 element-by-element로 diff. 소스 CSS를 grep으로 훑는 것만으로는 patch-on-patch 구조 때문에 실제 이기는 규칙을 못 찾음 — 반드시 라이브 브라우저에서 확인.
- **여백/폰트크기는 D도 유동형(fluid)**: 대부분 `clamp()`로 뷰포트 너비에 비례해서 변한다. 한 뷰포트(예: 1728px)에서만 재고 고정값으로 박으면 다른 폭에서 어긋난다 — 최소 두 지점(예: 1440px + 2560px 또는 실제 배포 해상도 두 곳)에서 실측해서 `clamp()` 공식을 다시 유도해야 한다.

## Git worktree 정리 이력 (2026-08-11)

과거 세션들이 D 후보 탐색 과정에서 만든 worktree가 20개까지 늘어나 있었다. 전부 확인한 결과 메인 클론(`D:/Project/ssamkang/aiways-incheon`)과 이 저장소, D 참조본을 제외한 나머지 18개는:
- detached-HEAD 스냅샷들은 전부 `main`/영구 태그에 이미 보존되어 있었고,
- 브랜치 기반 worktree들은 전부 origin에 이미 푸시 완료 상태였다.

→ 전부 `git worktree remove`로 안전하게 정리함. 앞으로 새 후보 비교용 worktree를 만들 땐 다 쓴 뒤 바로 정리하는 습관을 들일 것 (`git worktree remove <path>`).

## 배포

GitHub Pages. `main` 브랜치가 배포 대상 (최상위 CLAUDE.md의 공통 Git 원칙 상속 — merge/배포는 사용자 명시적 허가 후에만).
