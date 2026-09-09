# aiways-incheon 개별 규칙
헌법(D:\Projects\CLAUDE.md → _shared/CONVENTIONS.md)에 없는 것만.

## 앱
- 무엇: 인천 지역 초등학교 자원순환(분리배출) 교육용 웹앱. 학생이 모바일로 물건을 찍으면 Gemini가 분리배출 방법을 판정하고, 교사는 PC 대시보드에서 반 현황·랭킹을 본다.
- 사용자: 파일럿 참여 학교의 실제 초등학생과 담임교사. 상시 운영(행사용 아님). 교원연구회 출품작이며 참여 반 동의서·가정통신문 발송을 마친 상태에서 시작됐다.
- 배포: Firebase Hosting + Functions. 라이브 <https://incheon.edutogether.kr> (2026-09-01에 GitHub Pages에서 이전, 구 주소는 갱신 안 됨)

## 배포 폴더
- `firebase.json` public = `_hosting_site`. `scripts/stageHostingSite.js`가 **화이트리스트로** 골라 담는 스테이징 디렉터리라 `_docs/`, `docs/`, `.claude/`, `functions/`, `scripts/`는 애초에 들어갈 수 없다 — 블랙리스트가 아니라 화이트리스트라는 점이 이 저장소의 안전장치다(확인일 9/8)
- 그래서 **새 정적 파일을 추가했는데 배포에 안 올라가면** 그 화이트리스트에 없어서다. 파일 추가 시 `scripts/stageHostingSite.js`도 같이 볼 것

## 데이터
- 개인정보·미성년자 데이터: **있음.** 초등학생의 학교(NEIS 코드)/학년/반/번호 + 자율입력 이름. GPS는 교내·교외 판정 결과(boolean)만 저장하고 좌표 자체는 저장하지 않는다
- 보관·삭제 정책: 90일 자동삭제는 폐지된 결정(자동삭제 없음). 삭제 요청 대응 경로는 교사가 실행하는 익명화(`anonymizeStudent`)이며, 현재 소속 반 개인랭킹 문서와 과거 기록의 `classContext` PII까지 함께 정리한다
- rules: `firestore.rules` 있음 + 에뮬레이터 rules 테스트(`test/firestoreRulesEmulatorSmoke.js`) 있음. 클라이언트가 반 집계를 실시간 구독하므로 rules가 실제 방어선이다 — `students` 서브컬렉션은 커스텀 클레임이 맞아도 계속 차단한다

## 이 앱에서 절대 하면 안 되는 것
- **PC 화면의 시각적 레이아웃·디자인을 건드리지 않는다.** `index.html` / `style.css` / `styles/` / `app.js`의 렌더링·배치·폰트·반응형 CSS는 Bumm님이 직접 관리하는 영역이다. 백엔드·기능 작업 중 화면이 깨져 보여도 고치지 말고 목록으로 보고만 한다. 화면 모양을 바꾸지 않는 동작 수정(로깅 추가, 버그 수정)은 정상 진행한다
- **개인랭킹("우리반 실천왕")의 자율입력 이름 노출을 재논의하지 않는다** — 실명검증 없이 허용하기로 이미 확정된 제품결정
- **`google-apps-script/`를 되살리지 않는다** — 2026-08-26에 Firestore 단일 백엔드로 이전 완료, 참고용 보존일 뿐
- **`mobile-freeze-20260812` 태그를 "모바일은 동결"이라는 뜻으로 읽지 않는다.** 이 태그는 2026-08-19~25 백엔드 전면 재설계 **이전**의 낡은 롤백 지점일 뿐이고, 그 뒤로도 `mobile/`에는 정상적으로 개발·승인이 계속됐다(3단 권한체계 8/31, 가입경로 통합 9/2 등). `mobile/`은 다른 폴더와 똑같이 작업 대상이다 — 2026-09-07에 팀장 세션이 이 혼동을 명시적으로 정정했다. 단 태그 자체는 삭제·이동하지 않는다(pre-push 훅이 막는다)

## 도메인 (2026-09-09 확정·완료)

이 앱의 정식 주소는 **`https://incheon.edutogether.kr`**다(Firebase 주소를 노출하지 않기 위함).
처음엔 `aiways.edutogether.kr`로 잡았다가 가비아에서 `incheon`으로 확정됐다 — **`aiways`는 DNS에
존재하지 않으니 어디에도 남기지 말 것**(허용목록에 미리 넣었다가 실제로 틀린 이름이었던 적이 있다).

**Firebase Hosting은 커스텀 도메인을 "추가"하는 것이지 기본 도메인을 대체하지 않는다** — 지금도
`incheon.edutogether.kr` / `ai-ways-incheon.web.app` / `ai-ways-incheon.firebaseapp.com`이 전부 살아
있다. 그래서 옛 주소로 들어오는 사용자를 끊지 않으려고 CORS 허용목록에도 넷을 다 남겨둔다.

**도메인이 붙은 것만으로는 부족하다** — 2026-09-09에 실제로 겪었다. 새 도메인은 정적 파일과 보안
헤더는 정상인데 **Functions 호출이 전부 `invalid_origin` 403**이었다(CORS 허용목록 미갱신). 정적
파일 해시만 비교해서는 이 층이 안 보인다. 그래서 `scripts/postDeploySmoke.js`가 **두 오리진을 모두**
검사한다 — 둘 중 하나만 깨지는 상황이 이 스크립트가 잡아야 할 사고다.

**남은 미확인**: 새 도메인에서 App Check가 실사용자에게 통하는지는 **실제 휴대폰으로만** 확인된다
(자동화 브라우저는 승인 여부와 무관하게 항상 403 — 위 함정 참고).
## 마감 절차 — 익명 계정 정리 (2026-09-09 Bumm님 예약 지시)

**지금 하지 말 것.** 테스트하는 동안 익명 계정은 계속 생기므로 중간에 지우면 의미가 없다.

**시점**: 최종 배포가 끝나고 **freeze 태그를 찍기 직전**. "이제 100점이고 배포하고 정기감사만 기다리자" 하는 그 자리.

**대상과 주의**:
- Firebase Authentication의 **익명 계정 전부**(2026-09-09 기준 472개, 계속 증가 중)
- 🔴 **Firestore 데이터는 별개다.** 인증 계정만 지우면 `actors/{actorId}`의 학생 프로필·기록, `studentNumberClaims`의 번호 점유가 **그대로 남는다.** 이 앱은 `actorId`가 곧 uid라(자동 프로비저닝) 인증 계정만 지우면 **주인 없는 데이터**가 된다 — 함께 지울지 반드시 판단할 것
- 🔴 **되돌릴 수 없다.** 실행 전에 **무엇을 몇 건 지우는지 확인받고** 진행한다
- **익명 계정 30일 자동 정리**가 Firebase 콘솔에서 켜져 있는지 먼저 확인한다(Authentication → Settings → User account management). 켜져 있으면 급하지 않다는 뜻이고, 수동 삭제 범위도 줄어든다

## 명령
루트에 `package.json`이 없다. 전부 `functions/`에서 실행한다.
- 테스트: `cd functions && npm test` (vitest)
- 린트: `cd functions && npm run lint`
- 문법 검사: `cd functions && npm run check`
- 에뮬레이터: `cd functions && npm run emulator:test:<이름>` — 파일 하나당 스크립트 하나(전체 목록은 `functions/package.json`)
- 로컬 데모 데이터: `node functions/scripts/seedLocalPreviewDemo.js` 후 `?auth-emulator=1`로 접속
- 배포 후 라이브 확인: `node scripts/postDeploySmoke.js` (코드가 아니라 실제 라이브 응답을 보는 유일한 층)

## 자주 틀리는 것
- **App Check가 ENFORCED라 자동화 브라우저(Playwright 등)는 라이브에서 403 `App attestation failed`를 받는다. 이건 라이브 장애가 아니라 정상 동작이다.** reCAPTCHA Enterprise가 사람/봇 점수를 매기는데 자동화 브라우저는 `navigator.webdriver === true`라 낮은 점수를 받고 App Check가 그 토큰을 거부한다 — **헤드풀(`channel:"chrome"`)로 띄워도 똑같다. 헤드리스 여부가 아니라 자동화 여부가 감지된다.** 2026-09-09에 이 세션이 "라이브 다운"으로 오판해 보고했고, 같은 날 CLASSCADE도 같은 함정에 걸렸다. 라이브가 실제로 살아 있는지는 **사람이 실제 휴대폰으로 열어보는 것**이 유일하게 확실한 확인이다
- **자동화로 인증 이후 흐름을 보려면 디버그 토큰이 필요하고, 그건 localhost에서만 켜진다.** `firebaseAppCheck.js`의 `debugMode()`는 hostname이 `localhost`/`127.0.0.1`이고 쿼리에 `appcheck-debug=1`이 있을 때만 참이다(라이브 주소에서는 절대 안 켜진다). 그 상태로 열면 콘솔에 새 UUID가 찍히는데, **그 UUID를 Firebase 콘솔 > App Check > 앱 > 디버그 토큰 관리에 등록해야** 통과한다. Playwright는 실행마다 새 프로필이라 UUID가 매번 바뀌므로, 고정 토큰을 쓰려면 `?appcheck-debug=1` 없이 `addInitScript`로 `self.FIREBASE_APPCHECK_DEBUG_TOKEN = "<등록한 UUID>"`를 앱 스크립트보다 먼저 심는다(쿼리를 주면 코드가 `= true`로 덮어써서 매번 새로 생성된다). **등록된 디버그 토큰은 App Check를 우회하는 값이라 저장소에 커밋하지 않는다**

- **`functions/package.json`의 `check`는 하드코딩 목록이다.** 새 파일을 추가하고 여기 안 넣으면 문법 게이트에서 조용히 빠진다. eslint는 `functions/` 안만 보므로 루트 `.js`는 어느 게이트에도 안 걸린다 — 2026-09-07 감사에서 실제로 9개가 빠져 있었다
- **새 에뮬레이터 테스트는 네 군데에 등록해야 한다**: `vitest.emulator.config.js`의 `include`(빠지면 "No test files found") / `eslint.config.js`의 globals 오버라이드(빠지면 `'test' is not defined`) / `functions/package.json`(`check` + 새 `emulator:test:*` 스크립트) / `.github/workflows/deploy.yml` 스텝
- **에뮬레이터 테스트는 파일당 별도 프로세스로 격리한다** — 여러 파일이 같은 `teacherCodes` 문서 ID나 같은 `cb5_actor_*` 매트릭스를 써서 한 프로세스에 몰면 문서 경합으로 깨진다
- **무거운 테스트의 타임아웃은 실측으로 정한다** — 기본 20초인데 `cb5RecordResolveRecoveryEmulatorIntegration.js`만 실측 1분 26초라 파일 안에서 개별 타임아웃을 준다. 추측으로 늘리지 말 것
- **`saveSortingRecord`/`listSortingRecords`/`resolveSortingRecord`/`checkStudentProfile` 네 개는 일부러 `emulatorAppCheck`에서 빠져 있다** — 스모크 테스트가 실제 App Check 강제를 검증하기 때문이다. "일관성이 없어 보인다"고 우회를 추가하면 CI가 깨진다(실제로 한 번 깨뜨렸다)
- **레이트리밋이 전역/액터별 두 층이다.** 테스트에 가짜 시계를 주입할 땐 두 리미터와 대상 핸들러 **전부**에 같은 시계를 넣어야 한다 — 하나라도 실제 시계면 엉뚱한 리미터에 먼저 걸려 정작 검증하려던 로직에 도달하지 못한다
- **`transaction.set(ref, data, { merge: false })`는 문서를 통째로 갈아엎는다** — 나열 안 한 `status`/`plan`이 날아가 기기가 영구 잠긴 사고가 있었다. 필드 몇 개만 지우려면 `{ merge: true }` + `FieldValue.delete()`
- **폴링 주기를 줄일 땐 반드시 `perMinute`/`perDay` 상한과 같이 계산한다** — 계산 없이 줄였다가 등교시간에 켠 대시보드가 점심 전에 조용히 멈춘 장애가 있었다
- **실패한 CI를 그냥 재실행하지 않는다** — `gh run view --log-failed`로 원인부터 확인한다
- **배포는 push가 아니라 `success`를 눈으로 확인해야 끝난 것이다.** push 직후 "배포 중"이라고 보고하지 말고 `gh run list --branch main --limit 1`로 결과를 확인한 뒤 보고한다. 2026-09-09 하루에만 같은 유형이 두 번 났다 — ①긴급 CORS 수정을 push한 직후 문서 커밋을 밀어 넣어 **대기 중이던 그 배포가 취소**됐고(이 워크플로는 새 실행이 오면 대기 중 실행을 취소한다), ②승인 게이트 제거와 교사 관리 기능 두 커밋이 **연속으로 실패**했는데 세션은 "배포 중"으로 알고 시연 시나리오 작업으로 넘어가려 했다. 둘 다 팀장이 직접 CI를 확인해서 드러났다
- **긴급 수정을 push했으면 그 배포가 끝날 때까지 다른 것을 push하지 않는다** — 위 ①이 정확히 그 사고다
- **`functions/index.js`에서 함수 export를 지우면 CI 배포가 중단된다. 이건 고장이 아니라 안전장치다.** Firebase는 "프로젝트에는 있는데 소스에는 없는 함수"를 발견하면 삭제 여부를 물어야 하는데 CI는 비대화형이라 물을 수 없어서 `Aborting because deletion cannot proceed in non-interactive mode`로 멈춘다. **`--force`로 뚫지 마라** — 그러면 앞으로 누가 실수로 export를 지워도 프로덕션 함수가 조용히 삭제된다. 2026-09-09에 이 장치가 실제로 작동해 세션을 멈춰 세웠다. 올바른 절차는 ①`firebase functions:list`로 삭제 대상이 정확히 무엇인지 확인 ②팀장 승인 ③`firebase functions:delete <이름> --region asia-northeast3 --project ai-ways-incheon`으로 명시 삭제 ④재배포
- **새 클론·새 worktree에서는 `git config core.hooksPath .githooks`를 한 번 실행해야** freeze 태그 보호 훅이 켜진다(루트에 package.json이 없어 자동 설치가 안 됨)
