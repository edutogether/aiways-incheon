# 세션 핸드오프 — AI Ways Incheon PC 대시보드 (2026-08-18 갱신)

## 1. 앱 요약
`aiways-incheon` — 학교 자원순환(분리배출) 교육용 PC 대시보드 웹앱(vanilla JS/HTML/CSS + Firebase Functions + Google Apps Script). 8/12~14 학교 박람회 시연 완료, 현재는 박람회 이후 정리·보안 점검 단계. 배포: GitHub Pages, `https://edutogether.github.io/aiways-incheon/`, `main` 브랜치 push 시 자동(legacy branch-deploy).

**폴더 이름이 바뀌었다**: 예전 `aiways-incheon-closed-beta`(정본이었음)와 `aiways-incheon`(오래된 브랜치 체크아웃)이 8/14에 통합되어, 지금은 이 폴더(`aiways-incheon`) 하나가 곧 `main`이다. 다른 문서에 `-closed-beta` 경로가 나오면 낡은 참조다.

## 2. 완료 (배포·테스트·라이브 확인 완료)
- **박람회 대비 PC 대시보드 다듬기**: 갤러리 이미지 압축(6.0MB→1.9MB), 교육과정 제목/설명 폰트·줄바꿈, HAH 슬로건 바 위치, 랜드필 차트 배경박스 여백, KPI 링 위치, 짧은 세로 화면 스크롤 오버플로 수정.
- **스크롤 이징 곡선(`glideEase` → ease-out-quart) — 사용자가 직접 라이브에서 확인, "잘 맞아" 승인.** 더 이상 미검증 항목 아님.
- **8/17 전체 앱 감사에서 발견된 배경 글로우 중복(`project-scene` 등 3~4개씩 겹친 선언) 일부 정리.** 단, **전체 스타일시트를 다 감사한 건 아니다** — 사용자가 "이제 누더기는 완전히 없냐"고 물었을 때 "아니다, 이번엔 8개 씬 배경만 훑었다"고 명시적으로 답변함. 다른 영역(랭킹 모달, 카드 호버 등)에 비슷한 중복이 더 있을 수 있음.
- **대시보드 4개 패널 + 바깥 그리드 + 헤더를 "같교오락실"(edutogether/portal) 스타일 글래스모피즘으로 재작업.** `D:\Project\edutogether\portal\index.html` 소스를 직접 읽어서 실제 기법을 확인함 — 핵심은 (1) radial-gradient가 아니라 실제 `<span>` 원 + `filter:blur()`("오브"), (2) 카드 배경이 흰색 몇 % 틴트가 아니라 실제로 꽤 진한(~42%) 반투명, (3) `backdrop-filter`에 `blur()`뿐 아니라 `saturate(160~180%)`를 같이 걸어야 색이 안 씻겨나감, (4) 씬마다 자체 글로우까지 얹으면 body 배경+오브와 합쳐 3겹이 되어 명암 대비가 사라짐(2겹이 정답). `.dashboard-orbs`(5개 blur 원소, `index.html`)와 `.dashboard-grid > .panel` 등에 적용함. **사용자 최종 확인은 아직 못 받음 — 다음 세션에서 라이브로 확인 필요.**
- **보안 감사 후속 조치 (8/17, 다른 세션의 전체 앱 감사에서 발견)**:
  - 실제 성립하는 저장형 XSS 수정 — `app.js` `renderHoldList()`가 `record.mapped_item` 등을 `escapeHtml()` 없이 `innerHTML`에 꽂고 있었음 (같은 파일 5곳은 이미 올바르게 처리 중이었음). 수정 완료, 라이브 확인됨.
  - `google-apps-script/Code.gs`의 `doPost`에 공유 토큰 검증 추가 (원래 인증 전무 — 누구나 시트에 쓸 수 있었음). 코드는 push했고, **사용자가 Apps Script 편집기에서 직접 재배포까지 완료**.
  - `index.html`에 CSP meta 태그 추가, 로컬에서 `securitypolicyviolation` 리스너로 검증(JSONP·Firebase SDK 로딩 정상).
  - `analyzeSortingSafetyObserver`가 배포 이후 계속 503만 반환하던 죽은 기능 수정 — `functions/lib/globalRateLimit.js`의 `RATE_LIMITS` 테이블에 키가 아예 빠져 있었음. rate limit 추가 + idempotency 배선(메인 분석과 키 충돌 안 나게 `safety:` 접두사로 분리)까지 같이 처리해서 Gemini API 호출 2배 증가 없이 해결. **사용자가 `firebase deploy --only functions`까지 직접 완료.**
- **워크트리/폴더 정리 (8/14)**: `aiways-incheon-closed-beta`+`aiways-incheon` 통합, 안 쓰는 워크트리 2개 제거, 스크래치 폴더 5.3GB+ 삭제, 오래된 브랜치는 `archive/owner-visual-recovery-20260814`로 보관.
- `pc-expo-freeze-20260814`, `pc-expo-freeze-20260817` 태그 생성·push 완료.
- 매 커밋마다 `functions/`에서 `npm run check && npm test`(81개 테스트) 통과 확인 후 커밋.
- **분기말 정기 감사 예약됨** (다른 세션이 설정): 3/31, 6/30, 9/30, 12/31에 이 저장소 포함 5개 앱 자동 재감사.

## 3. 미완료 / 다음에 이어서 할 것
우선순위 순:
1. **새로고침 버튼 "원 두 개로 보임" — 아직도 미해결, 이번 세션 최대 난제.** 여러 번 "해결됨"이라 적었다가 스크린샷으로 계속 반박당했다. 시도한 것: 포커스 outline 제거(`outline:none`) → 여전히 재현 → 버튼 자체 배경 radial-gradient가 중심(50%/50%)이 아니라 좌상단(32%/26%)에 치우쳐 있던 것을 발견해 중심으로 맞춤 → **아직 사용자 확인 못 받음.** DOM에는 항상 링 요소가 하나뿐임을 `elementsFromPoint()`로 여러 번 재확인했으므로 요소 중복은 아니다. 다음 시도 전에 **반드시 새 스크린샷을 먼저 받을 것** — 이번 세션에서 스크린샷 없이 넘겨짚은 시도들은 전부 빗나갔다.
2. **CSP가 App Check/reCAPTCHA 전체 흐름까지는 검증 안 됨.** JSONP·Firebase SDK 로딩은 확인했지만, 로그인/인증 관련 실제 흐름은 로컬호스트가 Firebase 프로젝트에 승인 안 된 도메인이라 라이브 도메인에서 한 번 써봐야 함.
3. **글래스모피즘 재작업, 사용자 최종 확인 대기 중** (2번 항목 참고) — push까지는 이번에 같이 나갈 예정이지만, 실제 라이브에서 "이제 포탈이랑 비슷하다"는 확인은 아직.
4. **`functions/test/splitSafetyObserver.test.js`가 `npm test`에 안 묶여 있음** — 안전 관찰자 기능 테스트 파일이 있는데 `package.json`의 `test` 스크립트 목록에서 빠져 있어, 실제로는 한 번도 실행된 적 없는 죽은 테스트.
5. **스타일시트 전체 중복/죽은 규칙 감사 — 8개 씬 배경만 훑었을 뿐, 전체는 아직.** 사용자가 명시적으로 물어봤던 항목이니 다음에 우선순위 높게 잡을 것.

**해결됨(참고용으로 남김)**:
- D 참조본 대비 "박스 디자인/호버 효과 품질" 비교 — `d-reference-8246` 설정(`.claude/launch.json`, `ssamkang/` 레벨)으로 D를 로컬에 띄워 사용자가 직접 눈으로 비교, "이미 D를 거의 다 구현했고 오히려 대부분이 더 낫다"고 확인. 추가 작업 불필요.
- 랭킹 모달 "뒤에 이상한 박스" — 실제 문제는 탭바/진행바 트랙이 아니라 **닫기(×) 버튼에 뜬 브라우저 기본 골드색 포커스 outline**이었음(새로고침 버튼과 같은 원인). `.ranking-close`/`.close-btn`에 `:focus-visible{outline:none; background-tint}` 적용해 수정, push 완료.

## 4. 주의사항
- **이 폴더(`aiways-incheon`)가 정본.** 예전 `-closed-beta` 이름은 더 이상 존재하지 않음 (8/14 통합).
- **freeze 태그 보호**: `.githooks/pre-push`가 `*-freeze-*`/`pc-visual-master-*` 등 태그의 삭제·강제이동을 막음. 새 클론/워크트리에서는 `git config core.hooksPath .githooks` 수동 실행 필요(루트에 package.json 없어 자동 활성화 안 됨).
- **GitHub Pages 배포 확인 시 `gh run list`를 믿지 말 것** — legacy branch-deploy라 Actions 실행 목록이 실제 배포 상태를 반영 못 할 때가 있고, push 후 빌드 큐가 몇 분씩 밀리거나 멈추기도 함(이 세션에서 2회 발생). 반드시 `gh api repos/edutogether/aiways-incheon/pages/builds/latest`로 `"commit"` 필드가 push한 커밋 SHA와 일치하는지 확인. 안 움직이면 `gh api -X POST repos/edutogether/aiways-incheon/pages/builds`로 수동 트리거.
- **`google-apps-script/Code.gs`와 `functions/`는 git push만으로 배포 안 됨.** 전자는 Apps Script 편집기에서 수동 재배포, 후자는 `firebase deploy --only functions` 실행이 각각 별도로 필요 (둘 다 사용자만 할 수 있음 — Claude가 접근 불가).
- **push는 매번 사용자 승인 받고 진행** — 한 번 승인받았다고 이후 자동으로 push하면 안 됨.
- **사용자는 추측성 수정에 민감함** — 대시보드 그리드 크기, 차트 박스 크기, 새로고침 아이콘 관련해서 여러 번 잘못 짚어 되돌린 이력 있음. 코드 수정 전 `getComputedStyle`/`getBoundingClientRect`로 실측하고, 수정 후에도 반드시 재측정해서 확인할 것. **막연한 디자인 비교("포탈처럼 해줘" 등)를 요청받으면, 짐작하지 말고 그 프로젝트의 실제 소스를 직접 읽을 것** — `D:\Project\edutogether\portal\index.html`이 이번에 참고한 글래스모피즘 원본이다.
- **이 세션 환경은 브라우저 프레임 컴포지팅(스크린샷, 실제 스크롤 동작 확인)이 안 됨** — Browser pane이 사용자 화면에 실제로 떠 있지 않으면 `computer{action:"screenshot"}`이 항상 타임아웃남. 새 세션에서도 이 제약이 있는지 먼저 확인할 것; 있다면 시각적 확인은 사용자에게 캡처를 요청해야 함.
- **`D:\Project\CLAUDE.md`의 최상위 원칙(성장 지원 10계명)이 이 프로젝트에도 자동 적용된다**: 용어는 매번 새로 설명, 코드는 항상 실물 인용, 반복 패턴은 이름 붙여 재등장 카운트, 1줄급 수정은 사용자가 GitHub에서 직접 하도록 안내, 위험 발견마다 구체적 시나리오 한 문장 첨부. 상세는 `D:\Project\CLAUDE.md` 0번 섹션 참고.
