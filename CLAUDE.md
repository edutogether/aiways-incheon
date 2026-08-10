# CLAUDE.md — aiways-incheon

학교 자원순환 UX 프로젝트 (Vanilla JS + Firebase Functions + Apps Script, GitHub Pages 배포). 상위 원칙은 [D:\Project\CLAUDE.md](../../CLAUDE.md) 상속 — 여기는 이 앱 전용 상태/이슈만 기록한다.

## 현재 상태 (2026-08-10 기준)
- 이 폴더의 브랜치: `feature/owner-visual-recovery`
- 2026-08-10 외부 리뷰: `docs/EXTERNAL_HEALTH_REVIEW_20260810.md`

## 알려진 이슈 — 다음 작업 후보

같은 저장소가 **worktree 21개**로 3군데(`ssamkang/aiways-incheon/`, `_aiways-design-candidates-20260806/`, `_visual-recovery/`, Windows Temp)에 흩어져 있다. 이 폴더("정본")가 `aiways-incheon-closed-beta` 브랜치보다 뒤처져 있는 건 사실이지만, **이건 실수가 아니라 사용자가 클로즈드 베타 작업을 직접 지시해서 생긴 의도된 상태** — 사용자가 이미 알고 있던 부분이다 (2026-08-10 확인). "정본이 방치돼서 뒤처졌다"는 식으로 다루지 않는다.

배경: 이 프로젝트는 사용자가 처음으로 "제대로 각 잡고" 만들어본 프로젝트라 worktree 관리(21개로 흩어진 것 자체)에 시행착오가 많았다. 코드 자체 품질은 리뷰상 양호.

## 이번 라운드 목표 (2026-08-10 갱신)

**이번엔 시연(demo)만이 목표.** 21개 worktree 전체 정리는 이번 범위가 아님 — 지금 다 하려 하지 않는다.

만점(10/10) 기준 = "시연이 실제로 잘 되는 것":
1. **시연에 쓸 worktree/브랜치를 명확히 하나로 확정** — 최종 판단은 이 세션에서 실제 콘텐츠/기능 확인 후. `git worktree list` 실측 결과(2026-08-10):
   - `aiways-incheon`(정본, 이 폴더) — `feature/owner-visual-recovery`, 2026-08-02 (가장 오래됨)
   - `aiways-incheon-closed-beta` — `wip/cb3b-frontend-handoff-20260803`, 2026-08-09 (origin/main과 동일 커밋)
   - `aiways-incheon-main-release-20260806` — `main`, 2026-08-09
   - 유력 후보는 위 두 8/9일자 중 하나. 노트북/데스크탑 두 기기에서 sync 없이 작업한 게 원인 — worktree 21개(ssamkang/ 7개, `_aiways-design-candidates-20260806/` 5개, `_visual-recovery/` 1개, Windows Temp 8개)는 사용자도 "얼추 알고 있었다"고 확인(2026-08-10), 다만 정확히 어느 게 최신·완성본인지는 이 세션에서 재확인 필요.
2. 그 worktree가 실제로 정상 동작하는지 확인 (로컬 구동 + 핵심 화면 브라우저 확인).
3. 나머지 20개 worktree는 시연에 영향 없으면 이번엔 건드리지 않음.

**다음 라운드(시연 이후) 후보:** worktree 정리·통합.
1. 어느 worktree가 실제 최신·정본인지 먼저 확정 (`aiways-incheon-closed-beta` 포함 전 브랜치 비교).
2. 정본을 하나로 확정한 뒤 나머지 worktree는 정리 — 확실히 폐기할 것은 최상위 CLAUDE.md 공통 원칙대로 바로 삭제하지 말고 `archive/` 네임스페이스로 이동해 보관.
3. Windows Temp에 있는 worktree는 재부팅/정리 시 유실 위험이 있으니 우선순위 높게 처리 (이번 라운드에서도 최소한 "삭제되지 않게" 확인은 해둘 것).
