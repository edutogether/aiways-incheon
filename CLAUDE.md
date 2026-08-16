# CLAUDE.md — aiways-incheon

이 폴더가 **정본(canonical) 작업 저장소**다. 활성 개발은 전부 여기서 진행한다.

## 폴더 정리 이력 (2026-08-14)

한동안 `aiways-incheon`(폴더 이름은 "본체" 같았지만 실제로는 오래된 `feature/owner-visual-recovery` 브랜치를 체크아웃 중이었음)과 `aiways-incheon-closed-beta`(실제 `main`을 체크아웃 중이던, 진짜 활성 작업 폴더)가 분리되어 있어 혼란이 있었다. 아래와 같이 정리해 **이 폴더 하나로 통합**했다:
- `aiways-incheon-closed-beta` 워크트리를 제거하고, 이 폴더(`aiways-incheon`)를 `main`으로 전환 — 지금 이 폴더가 곧 예전 closed-beta다.
- `feature/owner-visual-recovery`는 삭제하지 않고 `archive/owner-visual-recovery-20260814`로 이름만 옮겨 보관(커밋 보존, 활성 브랜치 목록에서만 제외).
- `aiways-pc-design-worktree`(브랜치 `feature/pc-frontend-design`, 이미 main에 전부 병합 확인됨)와 `D:\Project\_review-packages`/`_review-tools`/`_handoff`(git 추적 안 되는 순수 스크래치 파일, 총 5.3GB+)를 삭제.
- D 참조본(`_visual-recovery/aiways-candidate-d`)은 아래 섹션대로 그대로 보존.

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

## 모바일 앱 프리즈 (2026-08-12)

모바일 앱(`mobile/`) 전방위 검토를 마치고 **`mobile-freeze-20260812`** 태그로 복구 지점을 고정했다. 상세 검토 결과는 태그 메시지에 전부 기록되어 있음 (`git show mobile-freeze-20260812`).

**태그 보호**: `.githooks/pre-push`가 freeze/baseline/reference 태그의 삭제·이동을 차단한다. 새 클론이나 새 worktree에서는 아래를 한 번 실행해야 활성화된다 (이 저장소는 루트에 package.json이 없어 자동 활성화가 안 됨):
```
git config core.hooksPath .githooks
```
보호 대상 패턴: `*-freeze-*`, `pc-visual-master-*`, `*-baseline*`, `v*-stable-*`. 새 태그 생성은 허용되고, 기존 태그의 삭제·강제이동만 막는다.

**프리즈 시점에 알고 있는, 수용된 항목**:
- 탭 버튼 73×37px, 검색 트리거 20×20px — 모바일 터치 타깃 권장치(44px) 미만. 기능엔 문제 없고 시연에도 지장 없어 이번 라운드에서는 그대로 둠.
- App Check가 localhost를 막아서 로컬에서는 인증 게이트를 통과할 수 없음. UI 검증이 필요하면 게이트를 화면상으로만 열고(`authGate`에 `hidden` 추가 + `appRoot`에서 제거) 테스트할 것 — 실제 보안은 전부 Functions 쪽에서 강제되므로 이 방식이 보안을 우회하지는 않는다.

## 배포

GitHub Pages. `main` 브랜치가 배포 대상 (최상위 CLAUDE.md의 공통 Git 원칙 상속 — merge/배포는 사용자 명시적 허가 후에만).
