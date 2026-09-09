# D 확정 참고자료 (Resolved Reference)

D 원본(`0bb2443`, 로컬 태그 `pc-visual-master-d`)의 `style.css`는 11,225줄에
같은 선택자가 5~10번씩 다시 선언된 "패치 위에 패치" 구조다. 매번 처음부터
어느 선언이 실제로 이기는지 다시 찾는 대신, 2026-08-10 세션에서 직접 D를
띄워 `getComputedStyle`로 최종 확정한 값만 여기 모아둔다.

**사용법**: 앞으로 PC(≥64rem) 화면을 D와 맞출 때, 아래 표에 있는 항목은
D 파일을 다시 뒤지지 말고 이 문서 값을 그대로 쓴다. 여기 없는 항목은
`D:\Project\_visual-recovery\aiways-candidate-d\style.css`에서 새로 찾아서
**이 문서에 추가**한다.

**검증 방법**: `clamp()`류 반응형 값은 반드시 1440 / 1728 / 1920 / 2560px
네 지점에서 D의 실제 `getComputedStyle` 값과 대조 후 확정한다. 한 지점만
확인하고 끝내면 다른 화면 크기에서 틀어진다 (2026-08-10에 실제로 겪음).

## 전역 토큰 (모든 페이지 공용)

| 대상 | D 확정 값 | 비고 |
|---|---|---|
| `.dashboard-scene h1` | `1181–1600px`: `clamp(3.7rem,5.6vw,6.6rem)` / `1601px+`: `clamp(3.9rem,6.1vw,8.25rem)` | 2단계 tier. 1440px에서 80.64px, 2560px에서 132px로 확인 |
| `--panel-pad` (`.dashboard-grid>.panel`) | `clamp(1.125rem,1.2vw,2.125rem)` | 1728px=20.7px, 1920px=23px, 2560px=34px로 확인 |
| `.kpi-row/.class-kpis/.landfill-metrics strong` | `clamp(1.32rem,1.55vw,2.02rem)` | 4개 폭 전부 정확히 일치 확인 |
| `.scene-copy h2` (project 제외 전 페이지 공용 제목) | `clamp(2.35rem,4.4vw,7.15rem)` (min-width:120rem에서 별도 ceiling 있음, 동일값으로 통일) | |
| `--scene-block-space` (페이지 위아래 여백) | `clamp(4rem,6.5vw,11.25rem)` | |
| `.main-nav a.is-active` | 배경 없음. `::after`로 그라디언트 밑줄: `position:absolute; inset-block-end:-8px; inset-inline:16px; block-size:2px; background:linear-gradient(90deg,transparent,#64eaff,#5ef7cd,transparent)` | 필박스 아님 |
| **모든 대제목/카드제목** (`h1`, `.scene-copy h2`, `.project-statement h2`, `.panel-head h2`) | `font-weight:950`, `line-height:.96`, `letter-spacing:normal` | **크기(font-size)만 맞추고 굵기는 놓쳤던 항목** — 기본 h1/h2는 브라우저 기본값(bold=700)으로 떨어져서 D보다 훨씬 얇아 보였음. letter-spacing도 D는 압축(negative) 안 씀 |
| `.brand-mark` (헤더 로고) | D는 원본 로고 파일(1440×960) 그대로 `object-fit:contain`, 크롭 안 함. D 자체 크기(52px)는 실측상 글자가 안 보일 정도로 작음 | 이 앱은 가독성을 위해 D보다 큰 3.5rem(56px)+흰 배경으로 의도적으로 확대 — D와 안 맞는 게 아니라 의도된 개선 |
| `.main-nav a` (비활성) | `color: rgba(225,242,255,.68)` / 활성 `color:#f6fdff`, `font-weight:760` | 배경/그림자 없음, 색상 대비만 |
| `.main-nav a` 크기 | `font-size:.92rem`(고정, clamp 아님), `min-height:2.375rem`, `padding-inline:.75rem`, `font-weight:760`. 2560px+: `1.18rem`/`3.25rem`/`1.25rem` | 반응형 계산식이 아니라 고정값 — 화면폭 줄어들수록 메뉴가 계속 작아지게 짜여있던 게 버그였음 |
| `.site-header` 좌우 여백 | `clamp(1.375rem,4vw,4.5rem)` (2560px+: `8rem`) | `.scene` 좌우 여백과 **다른 별개 변수**임. 같은 변수 재사용하면 헤더가 대시보드 여백만큼 과하게 넓어짐 |
| `--header-size` | `4.875rem`(78px), 2560px+: `7rem`(112px) | |
| `.scene` 전체 폭 | **상한선 없음** (`max-width:100%`, `width:100%`). 좌우 여백만 `clamp(3rem,5.4vw,8.625rem)`(2560px+: `11.25rem` 고정)으로 조절 | 예전엔 `--scene-content-max`로 전체 폭에 상한(96rem)을 걸어놨었는데, D는 화면 끝까지 채우고 패딩만 키우는 방식 — 초광폭 화면에서 양옆에 큰 빈 공간이 남는 원인이었음 |
| `html` 스크롤 | `scroll-snap-type:y mandatory` + 각 `.scene`에 `scroll-snap-align:start`, `min-block-size:100svh` | 이 자체가 아예 빠져있었음 — "스크롤 내리면 섹션 단위로 딱 멈추는" D 특유의 느낌이 전혀 없었던 원인 |
| `.hero-copy h1 span` | `display:block; white-space:nowrap;` | HTML엔 `<span>버리는 순간,</span><span>데이터가 되다</span>` 두 개가 이미 있었지만 이 CSS가 없어서 그냥 이어지는 한 줄처럼 취급돼 화면 폭에 따라 아무데서나 줄바꿈되고 있었음 |
| `.school-panel`/`.class-panel` 숫자칸 폭 | `7.875rem`(126px) 기본 / `6.5rem`(104px) 1181–1600px / `11.875rem`(190px) 2560px+ | D 파일 자체에 이 셀렉터가 여러 번 다시 선언돼 있어서, **어느 게 실제로 이기는지 라이브로 확인 안 하면 죽은 코드를 베낄 위험이 큼** — 실제로 처음엔 2560px 전용 `.dashboard-scene` 비율 규칙을 그대로 베꼈다가, 그건 D 파일 안에서도 더 뒤에 있는 무조건 규칙에 덮여 죽은 코드라는 걸 나중에 발견함 |

## 도넛/링 컴포넌트

| 대상 | D 확정 값 | 비고 |
|---|---|---|
| **기법** | 속이 빈 파이 아님. `radial-gradient(circle at center, #0b1c2d 46~56%, transparent 47~57%)`를 `conic-gradient` 위에 겹쳐서 가운데를 마스킹하는 "링" 기법 | 파이+작은원 방식과 완전히 다름 |
| `.landfill-kpi-ring` 크기 | `clamp(108px, 8.4vw, 136px)` (=`clamp(6.75rem,8.4vw,8.5rem)`) | 1728px 이상에서 136px로 고정 |
| `.school-panel .donut` | 링 기법 동일 적용, 하지만 자체 크기(app 쪽 좁은 컬럼용, D 그대로 쓰면 안 맞음) — 튜닝값: `clamp(5rem,6.6vw,6rem)`, 마스크 `radial-gradient(...46%,transparent 47%)` | D 원본 148px는 이 앱의 좁은 school-panel 컬럼엔 안 맞아서 로컬 조정 |

## 카드/배지 공통 패턴

| 대상 | D 확정 값 | 비고 |
|---|---|---|
| 카드 모서리 배지 (`.flow-card em`, `.gallery-grid article button`, `.subject-card em`) | 기본 `opacity:0; transform:translateY(8px)`, `:hover`/`:focus-within` 시 `opacity:1; transform:none`, `transition: opacity .18s, transform .18s` | **기본 상태에서 안 보임** — 스크린샷만 봐서는 아예 없는 걸로 착각하기 쉬움 |
| `.standards-grid article span` (성취기준 코드) | `border-radius:999px; padding:4px 10px; background:linear-gradient(135deg,#5ef7cd,#64eaff); color:#06111c; font-size:12.48px` | 텍스트 아님, 알약 배지 |
| `.resource-pending` (자료실 "업로드 예정") | `em { color: rgba(170,188,201,.62) }`, `cursor:default`, 배경 `rgba(255,255,255,.035)` | HTML에 이미 `class="resource-pending" aria-disabled="true"` 있음, CSS만 없었음 |
| `.gallery-grid article` | `min-height: 360px` (세로로 긴 폰 화면 비율), `align-content:center; justify-items:center; text-align:center` | 정사각형 아님 |

## 버튼/컨트롤 질감

| 대상 | D 확정 값 |
|---|---|
| `.primary-btn` | `border-radius:999px`, `box-shadow:0 18px 46px rgba(94,247,205,.18)`, `background:linear-gradient(135deg,#5ef7cd,#64eaff)` |
| `.upload-actions button` | `border:1px dashed rgba(94,247,205,.36)` (점선!), 나머지 primary-btn과 동일 글로우 |
| `.app-tabs button.is-active` | `background:linear-gradient(135deg,rgba(126,255,226,.96),rgba(86,218,255,.92))`, 밑줄 아님 |
| `#searchButton` / `.data-refresh-btn` | D엔 있지만 이 앱 스타일시트엔 배경 규칙 자체가 없어서 브라우저 기본 회색으로 새던 것 발견·수정 |

## H-A-H 페이지

- `text-align: start` (가운데 정렬 아님 — 상단 알약 뱃지만 봐서 가운데인 줄 착각하기 쉬움)
- 카드 안 상세 목록은 실제 `<ul><li>` (HTML엔 이미 있었음), `list-style:disc`, `padding-inline-start:40px`

## 로고

- D의 로고 파일도 "AI Ways Incheon" 전체 워드마크(1440×960)이지 정사각형 아이콘이 아님. 헤더에 쓸 아이콘은 별도로 다리 그림 부분만 크롭해서 써야 함 (`assets/brand/aiways-mark.png`, 크롭 좌표 `left:660,top:245,width:170,height:100`).

## 페이지별 제목/카드 (2026-08-11 8페이지 전수 확인)

| 대상 | D 확정 값 | 비고 |
|---|---|---|
| `.hah-title` (H-A-H 페이지 제목) | `width:min(1780px,100%)`, `font-size:clamp(4.95rem,5.48vw,7.45rem)`, `line-height:1.14`, `word-break:keep-all`. `span` 자식은 `display:block;white-space:nowrap` | HTML에 이미 `<span>` 2개로 나뉘어 있었는데 CSS가 없어서 그냥 이어진 한 줄처럼 취급되어 아무데서나 줄바꿈되던 버그. 대시보드 h1과 똑같은 패턴 |
| `.flow-scene/.gallery-scene/.sorting-scene/.resources-scene .scene-copy h2` | `font-size:clamp(4.4rem,5.4vw,7.15rem)` | 4페이지 공용, 일반 `.scene-copy h2`의 `clamp(2.35rem,4.4vw,7.15rem)`보다 커야 함 |
| `.standards-grid article span`(교육과정 성취기준 배지) | `font-weight:950` | `800`이 아님 |
| `.standards-grid article p` | `font-size:.82rem`, `font-weight:760`, `color:#9eb3c7` | 이 규칙 자체가 없어서 기본 본문 스타일(16px/400/흰색)로 새고 있었음 |
| `.flow-card h3` | `font-size:clamp(1.08rem,1.05vw,1.38rem)`, `line-height:1.24` | |
| `.flow-card p` | `font-size:clamp(.82rem,.76vw,.98rem)`, `line-height:1.54` | |
| `.gallery-grid article>span`(번호 라벨) | `color:rgb(164 191 216 / 78%)`, `font-weight:800` | |
| `.resource-grid a` | `font-size:.95rem`, `font-weight:880`, `padding:1.08rem` | |
| `.resource-grid a span`(번호) | `color:#5ef7cd`(mint), `font-weight:900` | 흰색이 아니라 민트색 |
| `.footer-credit` | `display:grid; grid-template-columns:1fr auto; justify-content:space-between; border-block-start:1px solid rgb(132 220 255 / 20%); padding-block-start:1.5rem`. 마지막 `p`는 `justify-self:end; text-align:end` | 둘 다 왼쪽에 쌓여있던 게 원래는 좌우로 나뉘어야 함 |

## 3초판단(sorting) 페이지 — D와 의도적으로 다름

D의 3초판단 섹션은 정적 목업(빠른선택 버튼, 검색창, Teachable Machine 링크 입력칸)이고, 지금 앱은 실제 카메라/AI 분류가 동작하는 완성된 기능입니다. **이 페이지는 D보다 발전된 상태라 1:1 비교 대상이 아닙니다.**

## 스크롤 스냅 — CSS로 새로 만들지 말 것

`app.js`에 이미 `snapByWheel`/`navigateToSection` 함수로 자체 스크롤 스냅이 구현돼 있습니다 (휠 이벤트를 가로채서 `scrollIntoView`로 다음 섹션으로 이동). 여기에 CSS `scroll-snap-type`을 추가하면 두 메커니즘이 충돌해서 스크롤 자체가 멈춥니다 — 2026-08-11에 실제로 이 사고를 내고 되돌렸습니다. 스크롤 관련 문제는 CSS가 아니라 `app.js`의 이 함수들을 먼저 확인할 것.

---
관련 메모리: `aiways-d-matching-method` (방법론), `aiways-current-milestone` (진행 상황)
