# 세션 핸드오프 — AI Ways Incheon PC 대시보드 (2026-08-17 갱신)

## 1. 앱 요약
`aiways-incheon` — 학교 자원순환(분리배출) 교육용 PC 대시보드 웹앱(vanilla JS/HTML/CSS + Firebase Functions + Google Apps Script). 8/12~14 학교 박람회 시연 완료, 현재는 박람회 이후 정리·보안 점검 단계. 배포: GitHub Pages, `https://edutogether.github.io/aiways-incheon/`, `main` 브랜치 push 시 자동(legacy branch-deploy).

**폴더 이름이 바뀌었다**: 예전 `aiways-incheon-closed-beta`(정본이었음)와 `aiways-incheon`(오래된 브랜치 체크아웃)이 8/14에 통합되어, 지금은 이 폴더(`aiways-incheon`) 하나가 곧 `main`이다. 다른 문서에 `-closed-beta` 경로가 나오면 낡은 참조다.

## 2. 완료 (배포·테스트·라이브 확인 완료)
- **박람회 대비 PC 대시보드 다듬기**: 갤러리 이미지 압축(6.0MB→1.9MB), 교육과정 제목/설명 폰트·줄바꿈, HAH 슬로건 바 위치, 랜드필 차트 배경박스 여백, KPI 링 위치, 짧은 세로 화면 스크롤 오버플로 수정.
- **새로고침 버튼 "원 두 개로 보임" — 해결됨.** 진짜 원인은 아이콘이 아니라 클릭 시 뜨는 브라우저 기본 포커스 outline이 버튼 자체의 원형 테두리/로딩 링과 겹친 것이었다. 최종형: 평소엔 화살표 글리프(`↻`), 로딩 중엔 링만 표시, `outline:none`으로 교체. 사용자 확인 완료.
- **스크롤 이징 곡선(`glideEase` → ease-out-quart) — 사용자가 직접 라이브에서 확인, "잘 맞아" 승인.** 더 이상 미검증 항목 아님.
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
1. **CSP가 App Check/reCAPTCHA 전체 흐름까지는 검증 안 됨.** JSONP·Firebase SDK 로딩은 확인했지만, 로그인/인증 관련 실제 흐름은 로컬호스트가 Firebase 프로젝트에 승인 안 된 도메인이라 라이브 도메인에서 한 번 써봐야 함.
2. **D 참조본(`_visual-recovery/aiways-candidate-d`) 대비 "박스 디자인/호버 효과 품질" 비교.** 사용자가 "치수 비교 말고 디자인 품질·호버 효과 비교를 원했다"고 명확히 정정했는데, 이후 급한 이슈들에 밀려 다시 시작 못 함.
3. **랭킹 모달 "뒤에 이상한 박스"** — `.ranking-tabs` 탭 바 뒤 옅은 흰색 배경, `.race-row` 진행바 트랙 배경이 이상해 보인다는 지적. 사용자 확인/지시 못 받고 보류.
4. **`functions/test/splitSafetyObserver.test.js`가 `npm test`에 안 묶여 있음** — 안전 관찰자 기능 테스트 파일이 있는데 `package.json`의 `test` 스크립트 목록에서 빠져 있어, 실제로는 한 번도 실행된 적 없는 죽은 테스트. 이번 rate-limit/idempotency 수정과 관련 있으니 다음에 같이 정리하면 좋음.

## 4. 주의사항
- **이 폴더(`aiways-incheon`)가 정본.** 예전 `-closed-beta` 이름은 더 이상 존재하지 않음 (8/14 통합).
- **freeze 태그 보호**: `.githooks/pre-push`가 `*-freeze-*`/`pc-visual-master-*` 등 태그의 삭제·강제이동을 막음. 새 클론/워크트리에서는 `git config core.hooksPath .githooks` 수동 실행 필요(루트에 package.json 없어 자동 활성화 안 됨).
- **GitHub Pages 배포 확인 시 `gh run list`를 믿지 말 것** — legacy branch-deploy라 Actions 실행 목록이 실제 배포 상태를 반영 못 할 때가 있고, push 후 빌드 큐가 몇 분씩 밀리거나 멈추기도 함(이 세션에서 2회 발생). 반드시 `gh api repos/edutogether/aiways-incheon/pages/builds/latest`로 `"commit"` 필드가 push한 커밋 SHA와 일치하는지 확인. 안 움직이면 `gh api -X POST repos/edutogether/aiways-incheon/pages/builds`로 수동 트리거.
- **`google-apps-script/Code.gs`와 `functions/`는 git push만으로 배포 안 됨.** 전자는 Apps Script 편집기에서 수동 재배포, 후자는 `firebase deploy --only functions` 실행이 각각 별도로 필요 (둘 다 사용자만 할 수 있음 — Claude가 접근 불가).
- **push는 매번 사용자 승인 받고 진행** — 한 번 승인받았다고 이후 자동으로 push하면 안 됨.
- **사용자는 추측성 수정에 민감함** — 대시보드 그리드 크기, 차트 박스 크기, 새로고침 아이콘 관련해서 여러 번 잘못 짚어 되돌린 이력 있음. 코드 수정 전 `getComputedStyle`/`getBoundingClientRect`로 실측하고, 수정 후에도 반드시 재측정해서 확인할 것.
- **이 세션 환경은 브라우저 프레임 컴포지팅(스크린샷, 실제 스크롤 동작 확인)이 안 됨** — Browser pane이 사용자 화면에 실제로 떠 있지 않으면 `computer{action:"screenshot"}`이 항상 타임아웃남. 새 세션에서도 이 제약이 있는지 먼저 확인할 것; 있다면 시각적 확인은 사용자에게 캡처를 요청해야 함.
- **`D:\Project\CLAUDE.md`의 최상위 원칙(성장 지원 10계명)이 이 프로젝트에도 자동 적용된다**: 용어는 매번 새로 설명, 코드는 항상 실물 인용, 반복 패턴은 이름 붙여 재등장 카운트, 1줄급 수정은 사용자가 GitHub에서 직접 하도록 안내, 위험 발견마다 구체적 시나리오 한 문장 첨부. 상세는 `D:\Project\CLAUDE.md` 0번 섹션 참고.
