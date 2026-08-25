# CLAUDE.md — aiways-incheon

이 폴더가 **정본(canonical) 작업 저장소**다. 활성 개발은 전부 여기서 진행한다.

**`HANDOFF.md`와 이 파일의 역할 차이**: `HANDOFF.md`는 세션 간 인수인계용 상세 작업일지(진행 중인 이슈, 다음에 할 일, 미해결 버그의 시행착오 기록)라 오래되면 낡은 항목이 남아있을 수 있다(마지막 갱신 2026-08-19). `CLAUDE.md`(이 파일)는 저장소 전역 규칙·정착된 결정·구조 요약이며 새 세션이 항상 먼저 읽는 곳이다. 최신 상태 파악은 이 파일을 우선하고, 특정 기능의 구현 배경/시행착오가 궁금하면 `HANDOFF.md`를 참고할 것.

## LOCKED — 재논의·임의 수정 금지
- 개인랭킹("우리반 실천왕")의 자율입력 이름 노출은 실명검증 없이 허용하기로 이미 확정된 제품결정 — 재논의 금지.
- 🔴 `registerStudentProfile` 학생소속증명 우회 문제(아래 크로스체크 섹션 참고)는 대표 결정 전까지 임의 설계·수정 금지.

## 현재 상태 요약 (2026-08-25 기준)

**2026-08-19~25, 백엔드 전면 재설계 완료.** 8/19 사용자가 라이브 상태를 직접 캐물으며 코드를 확인한 결과 "실제로 작동하는 시스템이 아니었음"을 발견(모바일 앱에 네트워크 호출이 0줄, Code.gs/Firestore 이중 백엔드, 화면에 뜨는 최종 판단을 Gemini가 아니라 MobileNet이 정하고 있던 버그 등 — 상세 경위는 `HANDOFF.md` -1절). 그 자리에서 확정한 새 방향을 8단계로 순서대로 구현 완료했다:
- Firestore 단일 백엔드로 전환 — `mobile/`(진짜 3초판단 앱)과 대시보드 조회는 완료. MobileNet 완전 제거(Gemini 단독 판정). **단, PC `index.html`의 레거시 "AI 판단" 모달(`#aiModal`)은 아직 `appendRecord()`로 Code.gs/Google Sheets에 직접 기록을 쓰고 있어 "완전 폐기"는 아직 아니다(2026-08-26 문서 점검에서 발견, 상세는 `README.md`/`google-apps-script/README.md` 참고).**
- 최초 1회 실명 가입 + 기기 영구 고정(이중 확인창), 학교 식별자를 자유텍스트에서 NEIS 학교코드로 전환.
- GPS로 교내/교외만 판정(좌표 자체는 저장 안 하고 통과여부만 저장) — 교내 기록만 학급/학교 경쟁에 반영, 교외 기록은 개인 업적에만 반영.
- 반 변경 서버 쿨다운, 안전관찰자 조건부 호출(메인 판별이 애매할 때만), 개수 제한 대신 이상 패턴 감지.
- 학교별 데이터 완전 격리 + 2단 랭킹(우리 학교 안 반별 상세공개 / 전국은 총점만), actor 차단, 개인별 랭킹("우리반 실천왕"), 폴링 5초 전환.

8/25 5개 앱 정기 크로스체크는 이 재설계 직후 진행되어 위 "2026-08-25 크로스체크 결과" 섹션의 6건(대부분 새로 만든 접근제어·레이트리밋·배포소스 관련)을 지적했다.

## 폴더 정리 이력 (2026-08-14)

한동안 `aiways-incheon`(폴더 이름은 "본체" 같았지만 실제로는 오래된 `feature/owner-visual-recovery` 브랜치를 체크아웃 중이었음)과 `aiways-incheon-closed-beta`(실제 `main`을 체크아웃 중이던, 진짜 활성 작업 폴더)가 분리되어 있어 혼란이 있었다. 아래와 같이 정리해 **이 폴더 하나로 통합**했다:
- `aiways-incheon-closed-beta` 워크트리를 제거하고, 이 폴더(`aiways-incheon`)를 `main`으로 전환 — 지금 이 폴더가 곧 예전 closed-beta다.
- `feature/owner-visual-recovery`는 삭제하지 않고 `archive/owner-visual-recovery-20260814`로 이름만 옮겨 보관(커밋 보존, 활성 브랜치 목록에서만 제외).
- `aiways-pc-design-worktree`(브랜치 `feature/pc-frontend-design`, 이미 main에 전부 병합 확인됨)와 `D:\Projects\_review-packages`/`_review-tools`/`_handoff`(git 추적 안 되는 순수 스크래치 파일, 총 5.3GB+)를 삭제.

## Git worktree 정리 이력 (2026-08-11)

과거 세션들이 비교용으로 만든 worktree가 20개까지 늘어나 있었다. 전부 확인한 결과 메인 클론과 이 저장소를 제외한 나머지는:
- detached-HEAD 스냅샷들은 전부 `main`/영구 태그에 이미 보존되어 있었고,
- 브랜치 기반 worktree들은 전부 origin에 이미 푸시 완료 상태였다.

→ 전부 `git worktree remove`로 안전하게 정리함(당시 메인 클론 경로는 `D:/Project/ssamkang/aiways-incheon`였으나, 이후 폴더 전체가 `D:\Projects`로 이동됨 — 현재 경로는 `D:\Projects\ssamkang\aiways-incheon`). 앞으로 새 후보 비교용 worktree를 만들 땐 다 쓴 뒤 바로 정리하는 습관을 들일 것 (`git worktree remove <path>`).

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

## 2026-08-25 크로스체크 결과 — 6건 중 5건 완료, 1건 대표 결정 대기

전체 5개 앱 크로스체크에서 평균 74.6/100(5개 앱 중 최저)으로 나왔다. 지적된 6건 중 5건은 당일 수정·검증·배포까지 끝남: blockedActors 배선(부품은 통과했지만 실제 핸들러까지 이어지는 배선이 안 돼 있던 것 발견해 연결), topStudents 접근제어, 폴링 레이트리밋 상향+429 표시, GitHub Pages 배포 소스를 legacy에서 Actions로 전환(레포 전체 소스 유출 차단), 정규식 위생정리. 나머지 1건은 재현해보니 애초에 기능버그가 아니었음을 확인해 종결.

**🔴 미해결 1건 — 대표 결정 대기 (임의 설계 금지)**: `registerStudentProfile`이 학교 소속을 실제로 증명하지 못한다 — `schoolId`만 NEIS API로 검증되고 학년/반/번호/이름은 자기신고이기 때문에, 시크릿창을 새로 열 때마다(=새 actor) 가짜 프로필로 등록하면 그 반 학생의 실명+번호를 무제한 조회할 수 있다. 이날 함께 고친 topStudents 접근제어가 바로 이 studentProfile을 신뢰 기준으로 삼는 구조라 더 문제가 된다. 해결하려면 교사가 발급하는 반 코드 같은 신규 기능(교사용 코드 발급 화면, 기존 가입자 소급처리, 분실/재발급 정책)이 필요해 단순 버그 수정이 아니라 제품설계 판단이 필요한 영역 — 대표 결정 없이는 진행하지 않는다. 상세는 `D:\Projects\_records\handoff\aiways-incheon.md` 참고.

**재발 방지 교훈**:
- "기능 완료" 자기보고를 실행 없이 믿지 말 것 — 부품 단위 테스트는 통과해도 배선(핸들러 끝까지 실제 호출) 테스트가 없으면 안 잡힌다. 안전기능은 핸들러 레벨로 실제 실행 검증할 것.
- GitHub Pages가 `path: .`면 저장소 전체(functions/lib 소스, 핸드오프 문서 등)가 공개된다. 워크플로 파일만 고쳐도 부족하고, 레포 Settings의 "Pages 소스" 자체가 legacy(브랜치 필터 없이 배포)로 남아있으면 워크플로와 무관하게 유출되므로 `gh api`로 Pages 소스를 GitHub Actions로 전환해야 한다.
- 5초 미만 폴링 주기는 반드시 `perDay`/`perMinute` 레이트리밋과 같이 계산할 것 — 계산 없이 줄이면 등교시간에 켠 대시보드가 점심 전에 화면 표시 없이 조용히 멈추는 장애가 재발한다(GPS 캠퍼스 미등록 장애와 동일 실패 패턴).

## 배포

GitHub Pages. `main` 브랜치가 배포 대상 (최상위 CLAUDE.md의 공통 Git 원칙 상속 — merge/배포는 사용자 명시적 허가 후에만).
