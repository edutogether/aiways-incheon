# AGENTS.md — aiways-incheon

이 저장소에서 작업하는 **모든 도구**(Claude Code, Codex 등)가 읽는 문서다. 도구에 상관없이
알아야 하는 것만 여기 둔다 — 클로드 전용 규칙·조직 소통 경로는 `CLAUDE.md`에 있다.

## 이 앱이 뭔가

인천 지역 초등학교 자원순환(분리배출) 교육용 웹앱. **교원연구회 출품작이고 이미 실사용 중이다** —
파일럿 참여 학교의 실제 학생이 쓴다. 참여 반에서 동의서를 걷고 가정통신문도 발송한 상태이지만,
그렇다고 접근제어를 느슨하게 해도 되는 건 아니다(동의를 받았어도 "다른 반 학생 정보를 아무나
조회할 수 있다"는 여전히 결함이다).

구성:
- `index.html` + `app.js` — PC 교사용 대시보드
- `mobile/` — **학생이 실제로 쓰는 3초 판단 앱**(`miniapp/3second.html`은 별도 구버전 체험 화면, 혼동 주의)
- `admin.html` + `admin.js` — 슈퍼어드민(교사코드 발급). 사이트 어디에도 링크가 없고 주소 직접 입력으로만 접근
- `functions/` — Cloud Functions(Node 22, CommonJS). 엔드포인트 21개
- `firestore.rules` / `firestore.indexes.json`

## 명령

루트에는 `package.json`이 없다. **모든 명령은 `functions/`에서 실행한다.**

```bash
cd functions
npm run check   # 문법 검사(node --check). 아래 "함정 1" 반드시 읽을 것
npm run lint    # eslint
npm test        # vitest 유닛테스트 (41파일 196테스트, 수 초)
```

에뮬레이터 통합테스트는 **파일 하나당 스크립트 하나**다(`npm run emulator:test:*`). 예:

```bash
npm run emulator:test:teacher-auth
npm run emulator:test:student-profile
npm run emulator:test:teacher-code-lockout
```

전체 목록은 `functions/package.json`의 `scripts`를 보면 된다. 각 스크립트는
`firebase emulators:exec ... "vitest run --config vitest.emulator.config.js test/<파일>"` 형태다.

로컬에서 실제 화면을 클릭해 보려면 `node functions/scripts/seedLocalPreviewDemo.js`로 데모
데이터를 심고 `?auth-emulator=1` 쿼리를 붙여 접속한다.

## 배포

`main`에 푸시하면 `.github/workflows/deploy.yml`이 test → deploy-backend(rules/indexes/Functions)
→ deploy-hosting 순으로 돈다. 라이브: <https://ai-ways-incheon.web.app>

배포되는 정적 파일은 `scripts/stageHostingSite.js`가 **화이트리스트로** 골라 `_hosting_site/`에
모으고 `firebase.json`의 `hosting.public`이 그것만 가리킨다. 과거 GitHub Pages를 저장소 루트
기준으로 배포해서 백엔드 소스와 내부 문서가 통째로 공개된 사고가 있었기 때문이다 — **새 정적
파일을 추가했는데 배포에 안 올라간다면 이 스크립트의 화이트리스트에 없어서다.**

롤백 절차는 계층마다 다르다(Hosting은 콘솔/CLI 릴리스 롤백, Functions는 revert 후 재배포,
rules는 콘솔 버전 이력). 상세는 `CLAUDE.md`의 "롤백 절차" 참고.

## 절대 하면 안 되는 것

- **PC 화면(`index.html`, `style.css`, `styles/`, `app.js`의 렌더링·레이아웃)의 시각적 디자인을
  건드리지 마라.** 배치·스타일·폰트·반응형 CSS는 Bumm님이 직접 관리하는 영역이다. 백엔드/기능
  작업 중 PC 화면이 깨져 보여도 고치지 말고 보고만 한다. 화면 모양을 바꾸지 않는 동작 수정
  (로깅 추가, 버그 수정 등)은 정상 진행해도 된다.
- **freeze/baseline 태그를 지우거나 옮기지 마라.** `.githooks/pre-push`가 막는다. 새 클론에서는
  `git config core.hooksPath .githooks`를 한 번 실행해야 훅이 켜진다(루트에 package.json이
  없어 자동 설치가 안 된다).
- **`google-apps-script/`를 되살리지 마라.** 2026-08-26에 Firestore 단일 백엔드로 완전히
  이전했고, 이 폴더는 참고용 보존일 뿐이다.
- 시크릿을 코드에 넣지 마라. Functions 시크릿은 전부 `defineSecret`으로 주입한다
  (노출돼 있는 Firebase web apiKey와 reCAPTCHA site key는 설계상 공개값이라 정상이다).

## 함정 — 여기서 실제로 여러 번 사고가 났다

**1. `functions/package.json`의 `check` 스크립트는 하드코딩된 파일 목록이다.**
`node --check A && node --check B && ...` 식으로 파일을 일일이 나열한다. 새 파일을 추가하고
이 목록에 안 넣으면 **문법 게이트에서 조용히 빠진다** — 게다가 `npm run lint`(eslint)는
`functions/` 안만 보므로 루트 `.js` 파일은 어느 게이트에도 안 걸린다. 2026-09-07 감사에서 실제로
배포되는 루트 스크립트 7개와 lib 2개가 빠져 있었다. **파일을 새로 만들면 이 목록에 추가할 것.**

**2. 새 에뮬레이터 통합테스트는 네 군데에 등록해야 한다.** 하나라도 빠지면 조용히 안 돌거나
에러가 난다:
- `functions/vitest.emulator.config.js`의 `include` 배열 — 빠지면 "No test files found"
- `functions/eslint.config.js`의 globals 오버라이드 `files` 목록 — `*.test.js` 명명규칙이 아닌
  파일(`*EmulatorIntegration.js` 등)은 빠지면 `'test' is not defined` 에러
- `functions/package.json` — `check` 목록 + 새 `emulator:test:<이름>` 스크립트
- `.github/workflows/deploy.yml`의 test job 스텝

**3. 에뮬레이터 테스트는 파일당 별도 프로세스로 격리해야 한다.** 여러 파일이 같은
`SCHOOL_ID`/`teacherCodes` 문서 ID나 같은 `cb5_actor_*` 액터 매트릭스를 쓰기 때문에, 한
vitest 프로세스에서 같이 돌리면 문서 경합으로 깨진다. 그래서 `include`에는 전부 등록하되
실행은 CLI 인자로 파일 하나만 좁혀서 부른다.

**4. 무거운 테스트의 타임아웃은 실측으로 정한다.** 로컬과 CI의 성능 편차가 크다. 기본
`testTimeout`은 20초인데 `cb5RecordResolveRecoveryEmulatorIntegration.js`만 훨씬 오래 걸려서
(에뮬레이터 기동 포함 실측 1분 26초) 그 파일 안에서 `test()`의 세 번째 인자로 개별 타임아웃을
따로 준다. 추측으로 늘리지 말고 실제로 재서 정할 것.

**5. App Check 우회는 `FUNCTIONS_EMULATOR` 환경변수로만 열린다**(프로덕션 런타임엔 절대 없는
값). 단 `saveSortingRecord` / `listSortingRecords` / `resolveSortingRecord` / `checkStudentProfile`
네 개는 **일부러** 그 우회에서 빠져 있다 — 스모크 테스트가 실제 App Check 강제를 검증하기
때문이다. "일관성이 없어 보인다"고 이 네 개에 우회를 추가하면 CI가 깨진다(실제로 한 번 깨졌다).

**6. 레이트리밋이 두 층이다.** `globalRateLimit.js`의 `RATE_LIMITS`(전역)와
`ACTOR_RATE_LIMITS`(액터별)는 별개의 맵이고 함수마다 값이 다르다. 테스트에서 가짜 시계를
주입할 땐 **두 리미터와 대상 핸들러 전부에 같은 시계를 넣어야 한다** — 하나라도 실제 시계를
쓰면 엉뚱한 리미터에 먼저 걸려서 정작 검증하려던 로직에 도달하지 못한다.

**7. Firestore `transaction.set(ref, data, { merge: false })`는 문서를 통째로 갈아엎는다.**
나열하지 않은 최상위 필드(`status`, `plan` 등)가 전부 사라져서 그 기기가 영구 잠기는 사고가
있었다. 필드 몇 개만 지우려면 `{ merge: true }` + `FieldValue.delete()`를 쓸 것.

**8. 폴링 주기를 줄이려면 반드시 `perMinute`/`perDay` 상한과 같이 계산하라.** 계산 없이 줄였다가
등교시간에 켠 대시보드가 점심 전에 조용히 멈추는 장애가 난 적이 있다.

**9. 실패한 CI를 그냥 재실행(rerun)하지 마라.** `gh run view --log-failed`로 원인을 먼저 확인한다.
이 저장소는 "테스트는 다 초록불인데 프로덕션은 안 돌아가던" 사고를 이미 겪었다.

## Git

단일 트렁크(`main`) 직접 커밋, PR 없음. 커밋 메시지는 `type: 한글 설명` 형식이고 type은
feat / fix / docs / chore / refactor / test 여섯 개만 쓴다.

**push와 배포는 Bumm님 승인이 있을 때만 한다.** 승인 경로는 `CLAUDE.md`의 "소통 경로" 참고.
