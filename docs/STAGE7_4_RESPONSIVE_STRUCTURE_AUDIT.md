# Stage 7.4 반응형 구조·프론트 구조 부채 감사

## 감사 목적과 기준

- 목적: 현 UI를 보정하거나 재디자인하지 않고, 반응형 검증기의 현재 보안 계약을 정상화하고 Stage 7.5-0 전면 재구축에 필요한 구조 부채를 기록한다.
- 시작 브랜치/HEAD: `feature/responsive-structure-stage7-4` / `b05b5022de68992901d17b2bd4f1b5ce99979120`
- 이번 작업에서는 `functions/test/browserSmoke.js`와 이 문서만 변경했다. UI, 백엔드, Firebase, Firestore Rules, Hosting, main, GitHub Pages는 변경하지 않았다.

## browser smoke 실패 이력과 최종 계약

1. 첫 실패: 기존 smoke는 보안 적용 전의 `analysis_failed`를 고정 기대했다. 일반 로컬 브라우저에서는 App Check 헤더를 얻지 못하므로, 현재 프론트 계약은 Gemini 요청 전에 `app_check_unavailable`으로 안전하게 실패하는 것이다.
2. 두 번째 실패: TensorFlow.js, MobileNet, Teachable Machine의 초기 로드를 smoke의 hard failure로 잘못 분류했다. 세 런타임의 초기 로드는 현재 구조 부채이며 Stage 7.5-0에서 제거·대체·지연 로딩할 대상이지, 이번 smoke의 합격·불합격 조건은 아니다.

최종 smoke는 다음을 각각 독립적으로 검사한다.

- `futureProvider` endpoint 존재
- 정확히 `app_check_unavailable`인 로컬 fallback
- 원본 이미지·Base64 형태 데이터의 localStorage 미저장
- 기존 viewport의 HTML/body 가로 overflow 없음 및 핵심 UI 존재
- TensorFlow.js, MobileNet, Teachable Machine 초기 로드 여부는 결과 객체에 관찰값으로 남기되 합격·불합격에는 사용하지 않음

실제 App Check 토큰, Gemini 성공 호출, Firestore 읽기·쓰기는 수행하지 않는다.

## 자동 검증 범위

- browser smoke viewport: 1366×768, 1024×768, 820×1180, 768×1024, 430×932, 390×844, 360×740
- 반응형 감사 viewport: 320×568, 360×800, 375×812, 390×844, 412×915, 768×1024, 820×1180, 1024×768, 1280×720, 1366×768, 1440×900, 1920×1080
- 단순 scrollWidth 검사는 가로 overflow만 검출한다. 카드 정렬, 비율, 시각적 중심, 숨겨진 잘림, breakpoint 직전·직후의 급격한 변화는 통과해도 정상으로 판정할 수 없다.
- P0/P1이 자동 탐지되지 않았더라도 전체 UI가 정상이라는 뜻이 아니다.

## 화면·상태 16개 그룹

| 그룹 | 구조 감사 결과 | fixture/수동 검증 필요 |
| --- | --- | --- |
| 헤더·내비게이션 | 고정된 정보 밀도와 nowrap·다중 breakpoint 영향 | 긴 메뉴, 200% 확대, 가로 회전 |
| 첫 대시보드 | 액자형 section과 보정 계층의 영향을 함께 받음 | 낮은 높이와 장문 소개 |
| 학교·학급 통계 카드 | 다열 grid와 카드별 보정 반복 | 실제 수치·빈 카드 증가 |
| 사진 업로드 | 런타임 초기 로드와 입력 영역이 결합됨 | 카메라 권한, 실제 이미지, 오류 |
| 프로젝트 | page final 보정 구간 의존 | 긴 한글 문구 |
| 교육과정 | 대형 grid 최소폭과 카드 열 수 전환 위험 | 320px, 200% 확대 |
| H-A-H | section별 padding·타이포그래피 중복 | 장문과 화면 높이 568px |
| 흐름 | 단계 카드와 다열 layout 보정 | 가로 회전, 항목 증가 |
| 갤러리 | 상세 패널과 목록 구조가 분리됨 | 상세 열기·닫기, 카드 증가 |
| 3초 판단 앱 | 입력·결과·체크리스트가 하나의 복합 grid에 중첩 | 작은 폭, 낮은 높이 |
| 검색·빠른 선택 | 사진/검색/빠른 선택 상태가 같은 결과 영역을 공유 | 긴 검색어, 빈 결과 |
| AI 결과·체크리스트 | 동적 후보 chip과 체크 항목 수에 따라 높이가 증가 | 후보·주의 항목 증가 |
| 완료·보류 | CTA와 상태 문구가 같은 영역에 밀집 | 긴 오류·보류 사유 |
| 보류함·기록 | 목록·상세·통계가 서로 다른 정렬 규칙을 가짐 | 빈 상태, 다수 기록 |
| 모달·닫기 버튼 | max-height·overflow·fixed/absolute 규칙의 조합 위험 | 이미지 로딩, 장문, 낮은 높이 |
| 자료실·푸터·로딩/빈/오류 | 정적 본문과 동적 상태 fixture가 분리됨 | 모든 오류·로딩·빈 상태 |

## CSS·HTML 구조 부채 수치

아래 수치는 `style.css`와 `index.html`의 실제 선언을 집계한 것이다. 정규식 수치에는 의도된 선언도 포함될 수 있으므로, 수 자체와 레이아웃 의미를 분리해 해석한다.

| 항목 | 집계 | 해석 |
| --- | ---: | --- |
| CSS style rule | 1,881 | 단일 파일에 누적된 큰 규칙 집합 |
| 중복 재정의 핵심 selector | 465 | 선언 순서와 우선순위 의존 위험 |
| Reference-screen calibration 재정의 selector | 112 | 특정 기준 화면 보정 의존 |
| PAGE_FIX 블록 | 5 | 사후 화면 보정 계층 |
| PAGE_FIX 내부 selector | 50 | 공통 구조보다 보정에 의존 |
| HTML COMMON_FINAL_FIX 시작 marker | 1 | 공통 임시 보정 경계 |
| HTML PAGE_FINAL_FIX 시작 marker | 8 | 페이지별 임시 보정 경계 |
| `!important` | 1,124 | 우선순위 경쟁이 구조화됨 |
| `overflow: hidden` | 27 | 내용 잘림을 숨길 가능성 |
| 고정 height | 54 | 낮은 높이·동적 콘텐츠 압축 위험 |
| `max-height` | 26 | 모달·패널 내부 스크롤과 함께 검토 필요 |
| 고정 `min-width` | 8 | 좁은 폭에서 grid 이탈 위험 |
| `position: absolute` / `fixed` | 29 / 3 | 겹침·고정 UI 가림 위험 |
| `white-space: nowrap` | 58 | 긴 한글·확대 시 줄바꿈 실패 위험 |
| scroll-snap 선언 | 13 | 짧은 높이·키보드/터치 흐름 간섭 가능성 |
| media query | 67 | breakpoint 규칙 중첩 |
| 고유 breakpoint 조건 | 11 | 420, 560, 768, 769, 980, 981, 1180, 1181, 1366, 1601, 2560 경계 사용 |
| 서로 다른 grid-template-columns를 가진 selector | 74 | 동일 요소가 폭에 따라 다수의 열 구조를 교체 |
| 초기 외부 AI 런타임 script | 3 | 첫 화면에 TensorFlow.js·MobileNet·Teachable Machine image 로드 |

## 초기 AI 런타임 로드

세 AI 런타임은 첫 화면 기능에 즉시 필요한 구조가 아니다. 실제 사용은 사진 입력 또는 학습 모델 기능 진입 뒤에 발생하며, MobileNet·Teachable Machine은 참고 후보·백업 수단일 뿐 최종 판단 주체가 아니다. Stage 7.5-0에서는 다음을 수행한다.

- 첫 페이지의 정적 script 태그를 제거하거나 기능 진입 시점의 지연 로딩으로 전환
- 로딩 실패·오프라인 상태를 사진 입력의 advisory fallback으로 명확히 분리
- 초기 번들·네트워크 비용을 사진 기능을 실제 여는 사용자에게만 귀속
- AI 후보 제안과 사용자의 최종 판단 원칙은 보존

## 화면 폭·높이별 위험

- 320~430px: 고정 min-width, nowrap, 다열 CTA 및 결과 chip이 압축될 수 있다.
- 431~767px: 모바일 규칙과 태블릿 규칙 사이의 다열 grid 전환이 급격하다.
- 768~1024px: tablet/desktop 규칙이 중첩되고 2열·1열 전환이 selector 순서에 의존한다.
- 1025~1180px 및 1181~1366px: 기준 화면 calibration과 max-width 규칙이 동시에 적용될 수 있다.
- 1367~1919px 및 1920px 이상: 넓은 화면 보정과 과도한 빈 공간, 중심축 불일치를 다시 검토해야 한다.
- 높이 568/720/768px, 세로·가로 회전, 200% 확대: 100dvh, 고정 height, scroll-snap, fixed 요소와 모달의 조합을 fixture로 검증해야 한다.
- 긴 한글, 동적 결과 카드, 모달 콘텐츠 증가는 scrollWidth 통과와 무관하게 padding·행 정렬·내부 overflow를 깨뜨릴 수 있다.

## 가장 심각한 구조 원인 10개

1. 1,124개의 `!important`에 의존하는 우선순위 경쟁
2. 465개 핵심 selector의 중복 재정의
3. 67개 media query와 중첩된 breakpoint 경계
4. Reference-screen calibration 112개 selector
5. PAGE_FIX 및 FINAL_FIX 사후 보정 계층
6. 74개 selector의 상이한 grid 열 정의
7. 54개 고정 height와 27개 hidden overflow의 조합
8. 58개 nowrap 선언으로 인한 한글·확대 취약성
9. 첫 화면의 AI 런타임 3개 초기 로드
10. 모달·동적 결과·보류/기록 상세의 결정적 fixture 부재

## Stage 7.5-0 철거·재구축·보존 지도

### 철거

- Reference-screen calibration, PAGE_FIX, COMMON_FINAL_FIX/PAGE_FINAL_FIX 방식의 사후 보정
- 레이아웃 문제를 숨기는 overflow, 불필요한 nowrap, 과도한 고정 height·min-width
- 중복 breakpoint와 `!important` 우선순위 싸움
- 첫 페이지의 불필요한 AI 런타임 초기 로드

### 재구축

- 공통 page shell, content container, 자연스러운 section 흐름
- 반응형 grid, 카드, 버튼·CTA, 헤더·내비게이션 시스템
- 모달과 3초 판단 입력·결과·체크리스트 영역
- 기록·보류함의 목록/상세 구조
- AI 런타임의 기능 진입 시점 로딩 전략

### 보존

- 확정 문구, 비즈니스 로직, sortingDb 및 사용자 판단 데이터 구조
- AI는 후보만 제안하고 사용자가 최종 판단하는 원칙
- App Check 연동과 Firebase Functions API 계약
- 기능 이벤트 및 로직에 필요한 DOM id·data 속성
- 정상 접근성 속성

보존해야 할 식별자는 3초 판단과 기록 흐름의 `#sorting`, 입력 id, 결과·모달 id, `data-judgement-*` 계열처럼 app.js가 직접 참조하는 계약이다. section의 중첩 구조, 시각 class, calibration/fix class는 재구축 과정에서 변경 가능하다.

## Stage 7.5 이관 범위

- Stage 7.5-0: 위 철거·재구축 지도를 기준으로 layout 기반 전면 재구축과 AI 런타임 지연 로딩 설계
- Stage 7.5-A: 정보구조·동선·section 순서 재설계
- Stage 7.5-B: 카드·CTA·타이포그래피·시각 시스템 통합
- Stage 7.5-C: 모바일·태블릿·노트북별 fixture와 실제 콘텐츠를 이용한 최종 최적화

모달, 로딩, 실제 이미지, 빈 상태, 오류 상태, 보류·기록 상세는 결정적 fixture가 필요하다. 이번 자동 감사는 이 상태들을 성공으로 추측하지 않는다.
