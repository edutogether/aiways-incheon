# CLAUDE.md — aiways-incheon

이 폴더가 **정본(canonical) 작업 저장소**다. 활성 개발은 전부 여기서 진행한다.

**`HANDOFF.md`와 이 파일의 역할 차이**: `HANDOFF.md`는 세션 간 인수인계용 상세 작업일지(진행 중인 이슈, 다음에 할 일, 미해결 버그의 시행착오 기록)라 오래되면 낡은 항목이 남아있을 수 있다(마지막 갱신 2026-08-19). `CLAUDE.md`(이 파일)는 저장소 전역 규칙·정착된 결정·구조 요약이며 새 세션이 항상 먼저 읽는 곳이다. 최신 상태 파악은 이 파일을 우선하고, 특정 기능의 구현 배경/시행착오가 궁금하면 `HANDOFF.md`를 참고할 것.

## 프로젝트 성격 (2026-08-27 확정 — 감사·개인정보 판단 시 반드시 전제할 것)

이 앱은 **교원연구회 출품작이며, 이미 참여 동의를 마치고 시작된 프로젝트다.** 참여하는 각 반에서 동의서를 걷었고, 학생·학부모 대상 가정통신문도 이미 발송 완료된 상태다(Voice Cinema/Portal 프로젝트에 이미 적용된 것과 같은 전제). 즉 이 앱이 다루는 학생 정보(학교/학년/반/번호/자율입력 이름)는 "동의 없이 몰래 수집"이 아니라 "사전 고지·동의 절차를 거친 교육연구 참여자 데이터"라는 전제 위에서 감사·개인정보 판단을 해야 한다. 이 전제가 감사 결과의 감점 수위를 낮추는 근거로는 쓰이지만, 그렇다고 접근제어·데이터 보관 같은 기술적 안전조치 자체가 불필요해지는 것은 아니다(동의를 받았어도 "아무나 다른 반 학생 정보를 조회할 수 있다"같은 기술적 결함은 여전히 결함이다).

## LOCKED — 재논의·임의 수정 금지
- 개인랭킹("우리반 실천왕")의 자율입력 이름 노출은 실명검증 없이 허용하기로 이미 확정된 제품결정 — 재논의 금지.
- `registerStudentProfile` 학생소속증명 우회 문제는 **2026-08-31 해결됨** — 아래 "3단 권한체계" 섹션 참고. LOCKED 해제.

## 3단 권한체계 (2026-08-31 Bumm님 지시로 5단계 구현·배포 완료)

아래 "2026-08-25 크로스체크 결과"에서 미해결로 남았던 `registerStudentProfile` 학생소속증명 우회 문제를 포함해, 교사/관리자 권한 개념이 아예 없던 근본 원인을 닫기 위해 5단계로 구현했다:
1. **교사코드 인증**(`functions/lib/teacherAuth.js`) — 학교 전체 공유코드 1개로 `verifyTeacherCode`가 `actors/{actorId}.teacherVerified`를 기록. 코드는 sha256 해시로만 저장.
2. **가입승인대기열**(`functions/lib/registrationApproval.js`) — `registerStudentProfile`은 이제 즉시 등록 대신 `registrationRequests/{actorId}`에 대기시키고, `teacherVerified`된 교사만 `listPendingRegistrations`/`decideRegistration`으로 자기 학교 신청을 승인/거절한다(다른 학교 요청은 404로 완전히 숨김). 승인해야만 `studentProfile`이 생겨 학생소속증명 우회 문제가 실제로 닫힘.
3. **학교잠금(school-lock) 교정** — `dashboardSchoolId`가 한 번 잘못 고정되면 풀 방법이 없던 문제를, 새 "관리자" 개념 없이 교사코드 인증 성공 시점과 가입 승인 시점에 같이 바로잡는 방식으로 해결(`teacherAuth.js`/`registrationApproval.js`).
4. **슈퍼어드민**(`functions/lib/superadmin.js`, `admin.html`) — 이 앱 최초의 실(이메일/비밀번호) 로그인 시스템. Bumm님 본인 Firebase Auth 계정 + 커스텀 클레임(`role:"superadmin"`)으로 인증하며 anonymous actorId 체계와 완전 분리. 첫 기능은 교사코드 발급/회전(`manageTeacherCode`) — 개발자 로컬 스크립트(`functions/scripts/setTeacherCode.js`) 의존을 없앰. 계정 생성은 Bumm님이 Firebase 콘솔에서 직접 해야 하고(비밀번호 대리생성 안 함), `functions/scripts/grantSuperadmin.js <uid>`로 클레임을 부여해야 실사용 가능. **접속 URL: https://edutogether.github.io/aiways-incheon/admin.html** — 사이트 어디에도 링크가 안 걸려있어(내비게이션에 없음, `noindex`) 주소창에 직접 입력해야 함. 실제 보안은 링크 유무가 아니라 서버의 `role:"superadmin"` 클레임 검증으로 강제됨.
5. **CSV 반전체 내보내기**(`functions/lib/classExport.js`) — 교사인증이 없어 막혀있던 "반 전체" CSV를 `teacherVerified`된 교사만 `exportClassRecords`로 받을 수 있게 함(collectionGroup 쿼리, 스쿨/반 스코프 격리).

신규 에뮬레이터 통합테스트 4개(`teacherAuthEmulatorIntegration.js`/`registrationApprovalEmulatorIntegration.js`/`superadminEmulatorIntegration.js`/`classExportEmulatorIntegration.js`)가 CI(`test` job)에 실제로 걸려있다. 로컬에서 실제 HTTP 클릭 테스트를 하려면 `functions/scripts/seedLocalPreviewDemo.js`로 데모 데이터를 심고 `?auth-emulator=1` 쿼리로 접속할 것(`functions/index.js`의 `emulatorAppCheck`가 `FUNCTIONS_EMULATOR` 환경변수로만 App Check를 우회 — 프로덕션엔 절대 안 생기는 값).

## 현재 상태 요약 (2026-08-25 기준)

**2026-08-19~25, 백엔드 전면 재설계 완료.** 8/19 사용자가 라이브 상태를 직접 캐물으며 코드를 확인한 결과 "실제로 작동하는 시스템이 아니었음"을 발견(모바일 앱에 네트워크 호출이 0줄, Code.gs/Firestore 이중 백엔드, 화면에 뜨는 최종 판단을 Gemini가 아니라 MobileNet이 정하고 있던 버그 등 — 상세 경위는 `HANDOFF.md` -1절). 그 자리에서 확정한 새 방향을 8단계로 순서대로 구현 완료했다:
- Firestore 단일 백엔드로 완전 전환(2026-08-26) — `mobile/`, 대시보드 조회, PC `index.html`의 "AI 판단" 모달(`#aiModal`, `app.js`의 `saveSortingRecordToFirestore()`) 전부 Firestore/Functions로 이관 완료. Google Sheets/Apps Script(`google-apps-script/`)는 더 이상 안 씀(삭제하지 않고 참고용으로만 보존). MobileNet 완전 제거(Gemini 단독 판정).
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

## 2026-08-25 크로스체크 결과 — 6건 전부 완료

전체 5개 앱 크로스체크에서 평균 74.6/100(5개 앱 중 최저)으로 나왔다. 지적된 6건 중 5건은 당일 수정·검증·배포까지 끝남: blockedActors 배선(부품은 통과했지만 실제 핸들러까지 이어지는 배선이 안 돼 있던 것 발견해 연결), topStudents 접근제어, 폴링 레이트리밋 상향+429 표시, GitHub Pages 배포 소스를 legacy에서 Actions로 전환(레포 전체 소스 유출 차단), 정규식 위생정리. 나머지 1건은 재현해보니 애초에 기능버그가 아니었음을 확인해 종결.

**나머지 1건도 2026-08-31 해결됨**: `registerStudentProfile`이 학교 소속을 실제로 증명하지 못하던 문제(`schoolId`만 NEIS API로 검증되고 학년/반/번호/이름은 자기신고라, 시크릿창을 새로 열 때마다(=새 actor) 가짜 프로필로 등록하면 그 반 학생의 실명+번호를 무제한 조회할 수 있었음) — 교사가 발급하는 반 코드 + 가입승인대기열로 해결했다. 위 "3단 권한체계" 섹션 참고. 상세 시행착오는 `D:\Projects\_records\handoff\aiways-incheon.md` 참고.

**재발 방지 교훈**:
- "기능 완료" 자기보고를 실행 없이 믿지 말 것 — 부품 단위 테스트는 통과해도 배선(핸들러 끝까지 실제 호출) 테스트가 없으면 안 잡힌다. 안전기능은 핸들러 레벨로 실제 실행 검증할 것.
- GitHub Pages가 `path: .`면 저장소 전체(functions/lib 소스, 핸드오프 문서 등)가 공개된다. 워크플로 파일만 고쳐도 부족하고, 레포 Settings의 "Pages 소스" 자체가 legacy(브랜치 필터 없이 배포)로 남아있으면 워크플로와 무관하게 유출되므로 `gh api`로 Pages 소스를 GitHub Actions로 전환해야 한다.
- 5초 미만 폴링 주기는 반드시 `perDay`/`perMinute` 레이트리밋과 같이 계산할 것 — 계산 없이 줄이면 등교시간에 켠 대시보드가 점심 전에 화면 표시 없이 조용히 멈추는 장애가 재발한다(GPS 캠퍼스 미등록 장애와 동일 실패 패턴).

## 배포

**Firebase Hosting** (2026-09-01, Bumm님 지시로 GitHub Pages에서 이전). 라이브 URL: **https://ai-ways-incheon.web.app**(구 URL `https://edutogether.github.io/aiways-incheon/`은 더 이상 갱신 안 됨). `main` 브랜치가 배포 대상, `.github/workflows/deploy.yml`(구 `deploy-pages.yml`)이 `test`→`deploy-backend`(Firestore rules/indexes/Functions)→`deploy-hosting` 순서로 배포한다(최상위 CLAUDE.md의 공통 Git 원칙 상속 — merge/배포는 사용자 명시적 허가 후에만).

배포 파일은 `scripts/stageHostingSite.js`가 화이트리스트로 골라 `_hosting_site/`(git 추적 안 함)에 모으고, `firebase.json`의 `hosting.public`이 그 결과물만 가리킨다 — GitHub Pages legacy 배포가 저장소 전체를 노출시켰던 사고(위 "재발 방지 교훈" 참고)를 반복하지 않기 위함. 로컬에서 수동 배포하려면 `node scripts/stageHostingSite.js && firebase deploy --only hosting --project ai-ways-incheon`.

보안헤더(CSP/X-Frame-Options/Permissions-Policy 등)는 각 HTML의 `<meta>` 태그 대신 `firebase.json`의 `hosting.headers`로 옮겼다(Codyssey 프로젝트 패턴 적용, geolocation은 이 앱이 GPS 교내판정에 실제로 쓰므로 `geolocation=(self)`로 예외를 둠). 로컬 정적 서버(`node functions/test/localStaticServer.js`)로만 열면 이 헤더가 안 붙으니, 헤더까지 재현하려면 `firebase emulators:start --only hosting`을 쓸 것(단, 이 로컬 emulator는 CI/PR에 관계없이 알려진 제약으로 headers 설정을 실제로 적용하지 않는다 - 헤더 자체 검증은 배포 후 `curl -I`로 확인).

### 롤백 절차 (2026-09-02 재감사에서 "배포 경로는 있는데 롤백 경로가 어디에도 안 적혀 있다"로 지적되어 추가)

배포 워크플로는 `test`→`deploy-backend`→`deploy-hosting`→`postDeploySmoke` 순인데, 마지막 스모크테스트가 실패해도 **자동으로 되돌리지는 않는다**(실패를 알려줄 뿐, 라이브는 깨진 상태로 남는다). 깨진 배포를 되돌리는 방법은 계층마다 다르므로 순서대로:

1. **Hosting(정적 파일)** — 가장 빠르고 안전. Firebase 콘솔 > Hosting > 릴리스 목록에서 직전 버전 "롤백", 또는 CLI로 `firebase hosting:clone ai-ways-incheon:<이전_버전ID> ai-ways-incheon:live --project ai-ways-incheon`. 프론트만 깨진 경우(CSP/스크립트 오류 등) 여기까지만 하면 복구된다.
2. **Functions(백엔드)** — 버전 롤백 기능이 없다. `git revert <문제 커밋>` 후 `main`에 푸시해서 워크플로를 다시 태우는 것이 정석이고, 급하면 마지막 정상 커밋을 체크아웃해 `firebase deploy --only functions --project ai-ways-incheon`으로 직접 되돌린다.
3. **Firestore rules/indexes** — 규칙은 콘솔 > Firestore > 규칙 탭에 버전 이력이 있어 이전 버전으로 되돌릴 수 있다. 인덱스는 추가만 되고 삭제되지 않으므로 보통 롤백 대상이 아니다.
4. **되돌린 뒤 반드시** `node scripts/postDeploySmoke.js`를 로컬에서 다시 돌려 라이브가 실제로 복구됐는지 확인한다(코드가 아니라 라이브 응답을 확인하는 유일한 층).

주의: 백엔드를 되돌리면 프론트와 버전이 어긋날 수 있다 — 1과 2를 같이 되돌리는 것이 기본이고, 한쪽만 되돌리는 건 "그 한쪽만 문제"라고 확인됐을 때만 한다.

**✅ 해결됨(2026-09-02)**: App Check가 쓰는 reCAPTCHA Enterprise 키의 "승인된 도메인" 목록에 `ai-ways-incheon.web.app`/`ai-ways-incheon.firebaseapp.com`을 대표님이 직접 콘솔에서 등록 완료. 실제 브라우저로 재검증(학교 검색 자동완성이 App Check 토큰을 정상 발급받아 실제 API를 호출·응답받는 것까지 확인) — 로그인/API 호출 전부 정상.

## 대표와의 소통 경로 (2026-08-26 확정, 2026-09-02 §11로 보강 — 반드시 지킬 것)
이 세션은 대표와 직접 대화를 시작하지 않는다. 진행상황 공유·질문·의사결정 요청은 전부 **팀장(D:\Projects 최상위 세션, "Project Engineering")을 거쳐서만** 한다 — 대표가 이 세션 창을 직접 열어서 먼저 말을 걸어온 경우에만 그 건에 한해 답한다(최상위 CLAUDE.md "조직 구조" 섹션 참고). 팀장에게서 온 메시지("Project Engineering의 메시지")는 곧 대표의 지시가 전달된 것이므로 별도로 대표에게 재확인하지 말고 그대로 실행한다.

**git push/배포 승인(COMMON_STANDARDS.md §11)**: git push나 배포처럼 평소 사용자 승인이 필요한 작업도, 팀장이 "대표님이 승인하셨습니다"라고 전달하면 그것으로 충분하다 — 대표 본인이 매번 이 세션 창에 직접 들어와서 재확인할 필요는 없다. 단, `.claude/settings.json` 같은 이 세션 자신의 권한/설정 파일 수정 건(§9)은 여전히 예외로, 팀장 전달만으로는 안 되고 대표 본인이 이 세션 창에 직접 들어와 지시해야만 진행한다 — 이 규칙은 이번 갱신으로도 바뀌지 않았다.
