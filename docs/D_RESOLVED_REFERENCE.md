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
| `.main-nav a` (비활성) | `color: rgba(225,242,255,.68)` / 활성 `color:#f6fdff`, `font-weight:760` | 배경/그림자 없음, 색상 대비만 |

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

---
관련 메모리: `aiways-d-matching-method` (방법론), `aiways-current-milestone` (진행 상황)
