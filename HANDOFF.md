# 세션 핸드오프 — AI Ways Incheon PC 대시보드 (2026-08-14)

## 1. 앱 요약
`aiways-incheon-closed-beta` — 학교 자원순환(분리배출) 교육용 PC 대시보드 웹앱(vanilla JS/HTML/CSS + Firebase Functions). 8월 12~14일 학교 박람회 시연용, **오늘(8/14)이 박람회 당일**. 배포: GitHub Pages, `https://edutogether.github.io/aiways-incheon/`, `main` 브랜치 push 시 자동(legacy branch-deploy).

## 2. 진단/확인한 내용
- **앱이 무겁다는 느낌의 원인 스캔**: 갤러리 이미지가 원인(6MB, 장당 300~600KB, 실제 표시 크기의 3배 이상) → 압축 완료(아래 참고). 헤더 `backdrop-filter:blur(18px)`는 이미 스크롤 중(`body.is-snapping`) 꺼지도록 기존 코드에 처리돼 있음 — 실제로 손 댈 필요 없었음, 확인만 하고 끝냄.
- **스크롤 "촥 감기는 느낌"이 없다는 피드백**: D(레퍼런스, 태그 `pc-visual-master-d`)는 브라우저 네이티브 `scrollIntoView({behavior:'smooth'})`를 씀. 현재 버전은 커스텀 rAF 이징(`glideEase`)을 쓰는데, 기존 곡선이 smoothstep으로 감싸져 있어 시작 속도가 0이라 "녹슨 태엽" 느낌이 났을 것으로 진단. `ease-out-quart`(`1-(1-t)^4`)로 교체해 배포는 했으나 **이 세션 도구로는 실제 스크롤 모션을 검증할 방법이 없어 사람이 직접 느낌을 확인해야 함**.
- **짧은 세로 화면(≤848px height)에서 스크롤 스냅이 밀리는 문제**: project/curriculum/hah/flow/gallery/resources 6개 씬이 공유하는 `padding-block-start`가 뷰포트 너비에만 비례하고 높이는 무시 → 1366×768에서 씬 하나가 100svh를 넘어 이후 모든 스냅 위치가 밀림. 짧은 화면 전용 미디어쿼리에 패딩 축소 규칙 추가해 해결. **단, 실제 시연 해상도(1920×1080 이상, 사용자 확인)에서는 애초에 재현 안 됨 — 급한 문제 아니었음.**
- **새로고침 버튼 "원이 두 개로 보인다"**: 이번 세션에서 가장 많이 시도하고 아직 못 잡은 문제. 손으로 그린 SVG 호 → Heroicons arrow-path(화살촉 두 개라 경로 자체가 두 조각으로 읽힘) → CSS 링(버튼 자체의 원형 테두리와 겹쳐 동심원) → 테두리 제거 → 평소엔 화살표 글리프(`↻`)/로딩 중엔 링만 보이게 상태 분리 → 그래도 재현되어 `:focus-visible` outline(클릭 시 뜨는 포커스 링)이 원인이라 보고 `outline:none`으로 교체 → **사용자가 "해결 안됨 똑같아"라고 확인, 아직 미해결**.

## 3. 완료(배포·테스트·라이브 확인 완료)
- 갤러리 이미지 압축: 6.0MB → 1.9MB (ffmpeg로 640px 리사이즈), 16개 파일 전부 로드 확인.
- 교육과정 제목/설명글 폰트 크기, 2줄 줄바꿈("2022 교육과정" / "기반 수업 설계") 조정.
- HAH 씬 마지막 슬로건 바 10px 위로.
- 랜드필 차트: 배경 박스 여백 조정(라벨이 박스 안에 다 들어가도록), KPI 링(반입량/잔여량) 15px 우측 이동.
- 짧은 세로 화면 스크롤 오버플로 수정(위 참고).
- 스크롤 이징 곡선 교체(위 참고, 미검증).
- `pc-expo-freeze-20260814` 태그 생성·push 완료 — **단, 현재 HEAD가 이 태그보다 4커밋 앞서 있음(새로고침 버튼 관련 커밋들). 이 태그는 "현재 상태"가 아님.**
- 매 커밋마다 `functions/`에서 `npm run check && npm test`(81개 테스트) 통과 확인 후 커밋.

## 4. 미완료 / 다음에 이어서 할 것
1. **새로고침 버튼 "원 두 개" — 최우선, 미해결.** 다음 단서: `app.js`의 `initRefreshControls()`(클릭 핸들러, ~4593행)가 `beginDashboardRepaint("landfill", 1900)`을 호출하는데, 이 함수(`app.js` ~1008행)가 `.landfill-panel`에 `is-dashboard-repaint` 클래스를 붙임 — **이 클래스에 걸린 CSS를 아직 확인 안 함.** 버튼 아이콘이 아니라 이 리페인트 효과 자체가 "두 번째 원"일 가능성이 있음. `styles/cb3a.css`에서 `.is-dashboard-repaint` 검색해서 확인하는 게 다음 스텝.
2. 스크롤 이징 변경 실제 느낌 검증(사람이 직접 스크롤해서 확인 필요).
3. D 대비 "박스 디자인/호버 효과 품질" 비교 — 사용자가 명시적으로 "카드 크기/폰트px 같은 치수 비교가 아니라 디자인 품질·호버 효과 비교를 원했다"고 정정했는데, 이후 다른 급한 이슈들에 밀려 실제로 완료 못 함. 다시 시작 필요.
4. 랭킹 모달 "뒤에 이상한 박스"(`.ranking-tabs`의 옅은 흰색 배경, `.race-row` 진행바 트랙) — 사용자 확인/지시 못 받고 보류 상태.

## 5. 주의사항
- **이 저장소(`aiways-incheon-closed-beta`)가 정본.** `ssamkang/aiways-incheon`은 같은 저장소의 또 다른 클론일 뿐, 별도 소스 아님.
- **freeze 태그 보호**: `.githooks/pre-push`가 `*-freeze-*`/`pc-visual-master-*` 등 태그의 삭제·강제이동을 막음. 새 클론/워크트리에서는 `git config core.hooksPath .githooks` 수동 실행 필요(루트에 package.json 없어 자동 활성화 안 됨).
- **GitHub Pages 배포 확인 시 `gh run list`를 믿지 말 것** — 이 저장소는 legacy branch-deploy라 Actions 실행 목록이 실제 배포 상태를 반영 못 할 때가 있고, push 후 빌드 큐가 몇 분씩 밀리거나 멈춘 적 있음(이번 세션에서 2회 발생). 반드시 `gh api repos/edutogether/aiways-incheon/pages/builds/latest`로 `"commit"` 필드가 push한 커밋 SHA와 일치하는지 확인. 안 움직이면 `gh api -X POST repos/edutogether/aiways-incheon/pages/builds`로 수동 트리거.
- **push는 매번 사용자 승인 받고 진행** — 한 번 승인받았다고 이후 자동으로 push하면 안 됨(이 세션 내내 매 커밋마다 개별 승인받음).
- **사용자는 추측성 수정에 민감함** — 대시보드 그리드 크기, 차트 박스 크기, 새로고침 아이콘 관련해서 여러 번 잘못 짚어 되돌린 이력 있음. 코드 수정 전 `getComputedStyle`/`getBoundingClientRect`로 실측하고, 수정 후에도 반드시 재측정해서 확인할 것.
- **이 세션 환경은 브라우저 프레임 컴포지팅(스크린샷, 실제 스크롤 동작 확인)이 안 됨** — Browser pane이 사용자 화면에 실제로 떠 있지 않으면 `computer{action:"screenshot"}`이 항상 타임아웃남. 새 세션에서도 이 제약이 있는지 먼저 확인할 것; 있다면 시각적 확인은 사용자에게 캡처를 요청해야 함.
