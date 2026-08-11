# PC 비주얼 D 대조 감사 — 2026-08-12

브랜치 `feature/pc-frontend-design` (워크트리 `D:/Project/ssamkang/aiways-pc-design-worktree`)에서
PC(≥64rem) 화면을 기준점 D(태그 `pc-visual-master-d`, 커밋 `0bb2443`)와 실측 대조한 기록이다.

## 1. 측정 방법

눈대중 비교를 배제하고 두 빌드를 동시에 서빙한 뒤 `getComputedStyle()`로 전수 대조했다.

- 현재 빌드 → `http://localhost:8240`, D 참조본(`D:/Project/_visual-recovery/aiways-candidate-d`) → `http://localhost:8241`
- `header.site-header` / `main.snap-root` / `footer` 이하 **모든 요소를 재귀 순회**하며 42개 속성 + 실제 박스 크기를 덤프
- 요소 대응 키는 조상 체인의 `태그#id.클래스(정렬)` 시그니처 + 동일 시그니처 형제 순번
- **1440px과 2560px 두 지점에서 측정** — 여백·폰트가 `clamp()` 유동형이라 한 지점만 재면 공식을 오판한다
- 노드 수: 현재 1127 / D 1004

## 2. 노이즈로 판명된 차이 — 대조 시 제외할 것

향후 세션에서 같은 함정을 반복하지 않도록 남긴다.

| 항목 | 규모 | 판정 |
|---|---|---|
| `font-family` | 782개 노드 | **무해.** D는 `Inter, Pretendard, …`, 현재는 `Pretendard, …`. 어느 빌드도 웹폰트를 로드하지 않고(`@font-face`·구글폰트 링크 전무) `Inter`는 미설치라, span 폭 프로브 실측 결과 두 스택 모두 Pretendard(100px 기준 784.88px)로 귀결. 렌더링 동일 |
| `text-align` | 132개 노드 | **무해.** `start`↔`left`, `end`↔`right` 논리 속성 표기 차이. 계산 결과 동일. 진짜 차이는 2개뿐 |
| DOM 노드 증감 | 대시보드 164/212 | **과장된 수치.** 비교 키에 `id`가 포함돼, 현재 빌드가 모바일 앵커용으로 추가한 `id="landfill"` / `id="ranking"` 때문에 두 패널의 자손 전부가 오탐. `id`·상태 클래스 정규화 후 실제 수치는 아래 |

`id` 정규화 후 실제 구조 차이:

```
_header      D에만  0 / 현재에만  8   (모바일 셸 바·햄버거 트리거 — 신규 기능)
_main        D에만 40 / 현재에만 105  (대부분 #sorting — 곧 삭제될 씬)
dashboard    D에만 32 / 현재에만  80  (매립지 차트 SVG가 현재 쪽이 더 풍부)
gallery      D에만  0 / 현재에만   1
──────────────────────────────────
공통 932 / D에만 72 / 현재에만 194
```

**3초판단 씬을 제외하면 DOM은 사실상 동일하다.** D 복원의 걸림돌은 구조가 아니라 CSS 결정이다.

## 3. 근본 배경 — 2026-08-02 프론트 전면 재구축

커밋 `1745724` "Rebuild Stage 7.5-0 frontend foundation"이 `style.css`를 11,832줄 삭제 / 202줄 추가로
교체했다(D 11,225줄 → 현재 263줄 + `styles/cb3a.css` 471줄).
[STAGE7_5_0_FRONTEND_FOUNDATION.md](STAGE7_5_0_FRONTEND_FOUNDATION.md)에 "이전 CSS를 남기거나 백업하지 않고
전면 교체했다"고 명시돼 있고 scroll snap·고정 높이·`!important`·viewport frame을 의도적으로 제거했다.

즉 현재 상태는 D에서 흘러내린 drift가 아니라 **의도적으로 지어진 다른 기반**이다.

## 4. 아키텍처 테스트의 실제 제약 (중요)

`functions/test/frontendCssArchitecture.test.js` 기준 통과 상태:

```json
{"rules":230,"media":5,"uniqueViewportConditions":5,"maxSelectorDefinitions":3,
 "important":0,"fixedHeightDeclarations":0,"maxHeightDeclarations":0,
 "minWidthDeclarations":0,"nowrapDeclarations":0,"overflowHiddenDeclarations":0}
```

- 룰 수는 230/700으로 여유가 있으나 **`uniqueViewportConditions`가 5/5, `maxSelectorDefinitions`가 3/3으로 한계**다.
  `style.css`에 새 미디어 조건을 추가하거나 같은 선택자를 네 번째로 정의하면 즉시 실패한다.
- 이 테스트는 **`style.css`와 `index.html`만 읽는다.** `styles/cb3a.css`는 검사 대상이 아니다.
  → 레이아웃 작업이 자연히 `cb3a.css`로 밀려나며, 이는 최상위 CLAUDE.md가 경고한 patch-on-patch 구조를
  다시 키우는 경로다. 우회 가능하다는 사실 자체를 위험으로 인식할 것.
- `assert.doesNotMatch(css, /scroll-snap/)` — `style.css`에서 `scroll-snap` 문자열 자체가 금지돼 있다.

모바일 세션과의 파일 충돌은 없다. `mobile/index.html`은 `mobile/tailwind.generated.css` + `mobile/mobile.css`만,
PC는 루트 `style.css` + `styles/cb3a.css`만 참조한다.

## 5. 실행한 수정 — 색 토큰 D 복원

D의 팔레트가 현재 빌드에서 전반적으로 탁해져 있었다. 배경은 밝아지고 강조색은 어두워져 **양쪽에서 대비를 깎는**
상태였다. 토큰 단위로만 복원했다(레이아웃 무변경).

| 역할 | 이전 | 적용값 | 근거 |
|---|---|---|---|
| 캔버스 | `#071522` | `#020611` | D `--bg` |
| 상단 표면 | `#0b1c2d` | `#081326` | D `--bg-2` |
| 본문 | `#edf8ff` | `#f6fbff` | D `--text` |
| 보조 텍스트 | `#88a3b5` | `#9eb3c7` | D `--muted` |
| 강조(민트) | `#4fe4cf` | `#5ef7cd` | D `--mint` |
| 보조 강조(블루) | `#5a9dff` | `#6aa9ff` | D `--blue` |
| info(시안) | `#77c9ff` | `#64eaff` | D `--cyan` |
| 바이올렛 | `#b598ff` | `#ad8cff` | D `--violet` |
| 경계선 3단 | `#1d4158` / `#2a5970` / `#4a8296` | `rgb(131 224 255 / 11%)` / `/ 18%` / `/ 32%` | D는 `--line` 단일값 `rgba(131,224,255,.18)`. 현재의 3단 위계는 유용하므로 **중간 단을 D 원본값에 정확히 고정하고 위아래로 전개** — 구조는 유지하되 D의 유리질 시안 성격을 채택한 판단 |

토큰이 아니라 하드코딩돼 있어 함께 고친 자리:

- `style.css` body 방사형 그라디언트 `rgb(79 228 207 / 7%)` → `rgb(94 247 205 / 7%)`
- `style.css` `--glow-subtle` 안의 `rgb(79 228 207 / 12%)` → `rgb(94 247 205 / 12%)`
- `style.css` `.site-header` 배경 `rgb(7 21 34 / 92%)` → `rgb(2 6 17 / 92%)`
- `styles/cb3a.css` PC 헤더 배경 `rgb(5 17 30 / 86%)` → `rgb(2 6 17 / 88%)` (이쪽이 PC에서 실제로 이김)
- `styles/cb3a.css` 도넛 차트 `#0b1c2d`·`#4fe4cf`·`rgb(79 228 207 / 12%)` → 신규 값

### 건드리지 않은 것 — 함정

**`--mint`는 절대 D 값으로 바꾸지 말 것.** D에서는 네온 강조색(`#5ef7cd`)이지만 현재 빌드에서는
`--mint: #123f4b`로 재정의돼 **어두운 표면색**으로 쓰인다(`.brand-mark` 배경, `.main-nav a:hover` 배경 등
`background:` 4곳 전부). 이름만 보고 덮으면 배경이 형광으로 터진다.

`--surface-1/2/3`, `--text-secondary`는 D에 대응 토큰이 없어 유지했다.

### 검증 결과

- 1440px / 2560px 양쪽에서 **D와 일치하게 된 색 75건, 역행(맞던 것이 틀어짐) 0건**
- **레이아웃 이동 0건** — 요소 크기 변화는 라이브 시계(`time.landfill-time-now`) 텍스트 길이 변동뿐
- 주요 텍스트 대비비 15.11~19.69:1 (WCAG AAA 기준 7:1)
- `frontendCssArchitecture` / `frontendDomContract` 테스트 4건 전부 통과
- 남은 색 차이 99건은 D가 11k줄에서 컴포넌트별로 직접 지정했던 값들로, 토큰 범위 밖

## 6. 미해결 — 스크롤 체감 저하와 "불이 늦게 켜짐"

사용자 보고 두 건이 **같은 뿌리**로 확인됐다.

### 확인된 사실

`styles/cb3a.css`의 PC 전용 블록(`@media (min-width:64rem)`)에 스포트라이트 연출이 있다.

```css
.scene { opacity:.56; filter:saturate(.68) brightness(.66);
         transition:opacity .43s …, filter .43s …, transform .42s …; }
.scene.is-active { opacity:1; filter:saturate(1.08) brightness(1.08); }
```

즉 **모든 씬은 `.is-active`를 받기 전까지 불투명도 56% + 밝기 66%로 어둡게 깔려 있다.**

`.is-active`를 붙이는 `app.js`의 `activateAfterSettle()` 지연 예산:

1. `rect.top`이 tolerance(= `max(8, innerHeight*0.014)` ≈ 900px에서 12px) 안에 들어올 때까지 매 프레임 대기
2. **또는 860ms 타임아웃 소진**
3. 그 뒤 `setTimeout(105ms)`
4. 그리고 CSS transition 430ms

라이브 계산값 대조:

| | 현재 | D |
|---|---|---|
| `html/body/main.snap-root`의 `scroll-snap-type` | `none` | `y mandatory` |
| `.scene`의 `scroll-snap-align` | `none` | `start` |

**인과**: D는 `scroll-snap-type: y mandatory`가 `rect.top`을 정확히 0으로 붙여줘서 1번 조건이 즉시 충족됐다.
스냅이 사라진 현재는 자유 스크롤이 12px 안에 멈추는 일이 거의 없어 **매번 860ms 타임아웃을 끝까지 소진**한다.
합계 최대 약 1.4초 — 이것이 "페이지가 엄청 늦게 밝아짐"의 정체이고, 스냅 제거 자체가 "스크롤이 부드럽지 않다"의 정체다.
`style.css`는 테스트가 `scroll-snap` 문자열을 금지하므로 복원은 `cb3a.css`의 PC 블록에서만 가능하다.

### 부수 발견 — 죽은 코드

`is-dashboard-preparing` / `is-dashboard-intro`는 **어떤 CSS 파일에도 정의가 없다.** Stage 7.5-0에서 CSS만
지워지고 `app.js`의 토글 로직(중첩 `requestAnimationFrame` 3단, `dashboardIntroPendingOnSettle` 플래그,
`prepareDashboardIntroState`)이 남았다. 로컬 실측에서 `is-dashboard-preparing`은 25초 뒤에도 body에 남아 있었으나
매칭되는 스타일이 없어 시각적 영향은 없다. 정리 대상.

## 7. 2차 작업 — 스크롤 복구·3초판단 제거·스크롤 큐·QR 조건부 노출

복구 지점: 태그 **`pc-front-palette-d-20260812`** (커밋 `439e2c2`). 아래 변경이 잘못되면
`git reset --hard pc-front-palette-d-20260812`로 색 복원까지만 남은 상태로 즉시 돌아온다.

### 7.1 스크롤 스냅 복구 + 대기 예산 축소

6절에서 규명한 원인에 대한 조치다. `styles/cb3a.css`의 `@media (min-width:64rem)` 블록에만 넣었다 —
`style.css`는 아키텍처 테스트가 `scroll-snap` 문자열을 금지한다.

```css
html { scroll-snap-type:y proximity; }
.scene { scroll-snap-align:start; scroll-snap-stop:normal; }
```

`mandatory`가 아니라 **`proximity`를 쓴 이유**: 갤러리 씬은 1440x900에서 높이가 922px로 뷰포트를 넘는다.
`mandatory`면 그 안에서 스크롤이 갇힌다.

`app.js` 대기 예산:

| 항목 | 이전 | 변경 |
|---|---|---|
| `waitForScrollSettle` 기본 `maxWait` | 860ms | 300ms |
| `activateAfterSettle`의 `maxWait` | 860ms | 300ms |
| `activateAfterSettle`의 `delay` | 105ms | 40ms |
| settle tolerance | `max(8, vh*0.014)` ≈ 12px | `max(24, vh*0.05)` ≈ 45px |
| `.scene` transition | 0.43s / 0.42s | 0.3s |

최악 예산이 약 1.4초 → 약 0.64초로 줄고, 스냅이 `rect.top`을 0 근처로 붙여주므로 실제로는 훨씬 앞당겨진다.

### 7.2 PC에서 3초판단 제거

**마크업은 지우지 않았다.** `frontendDomContract.test.js`가 `id="sorting"`을 비롯해 `searchInput`,
`tmModelInput`, `sortingTimeline`, `holdList`, `aiModal` 등을 `index.html`에 요구하고, 64rem 미만
모바일 레이아웃은 이 씬을 계속 쓴다. 그래서 PC에서만 숨겼다.

```css
.sorting-scene { display:none; }
.main-nav a[href="#sorting"] { display:none; }
```

`app.js`의 씬 목록도 맞췄다. 숨겨진 씬이 스크롤·키보드 순서에 남으면 갤러리에서 빈 칸을 거치게 된다.

```js
const sections = navPairs
  .map(([, id]) => document.getElementById(id))
  .filter(Boolean)
  .filter(section => getComputedStyle(section).display !== "none");
```

### 7.3 다음 씬 스크롤 큐

`.scene::before`에 CSS만으로 아래꺾쇠(테두리 두 변 + 45도 회전)를 그리고 위아래로 떠다니게 했다.
활성 씬에서만 보이고, 마지막 씬(`.resources-scene`)에서는 `content:none`으로 끈다.
`::after`는 기존 하단 헤어라인이 쓰고 있어 `::before`를 썼다.

### 7.4 QR 조건부 노출

QR(`assets/qr/kiosk-5-1.png`)은 원래 대시보드에서 **항상 보이는 상태**였다(실측 `display:flex`).
"다 보고 마지막에서 한 장 더 내려 맨 위로 되감겼을 때만" 뜨도록 바꿨다.

- `app.js` `rewindFromLastSection()`의 settle 콜백에서 `document.body.classList.add("is-rewound")`
- `activate()`에서 대시보드를 벗어나면 `is-rewound` 제거
- PC 블록에서 `.dashboard-scene .qr-invite { display:none }`, `body.is-rewound` 일 때 `display:flex` + 등장 애니메이션

3초판단 씬 안의 QR 사본은 그대로 뒀다 — PC에서 그 씬 자체가 `display:none`이다.

### 7.5 죽은 인트로 코드 정리

CSS 정의가 전혀 없던 `is-dashboard-preparing` / `is-dashboard-intro` 토글을 `app.js` 7곳과
`index.html`의 `<body class>`에서 제거했다. `playDashboardIntroForCurrentData()`의 3단 중첩
`requestAnimationFrame`은 그 클래스 제거를 순서 맞추려고 있던 것이라 1단으로 접었다(약 2프레임 단축).

`beginDashboardRepaint()`의 플래그 로직(`dashboardAnimationScope`, `countUpNextDashboard`,
`dashboardIntroActive`)은 숫자 카운트업 연출을 실제로 구동하므로 **남겼다**.
`is-dashboard-repaint` 클래스 역시 CSS 정의가 없어 죽은 상태지만, 이번엔 건드리지 않았다 — 후속 정리 대상.

### 7.6 검증 결과와 검증하지 못한 것

실측으로 확인한 것 (1440px / 2560px):

- `#sorting` `display:none`, 주 메뉴 노출 7개(3초판단 사라짐), 문서 높이 6411px(1440)
- `.scene`의 `scroll-snap-align:start`, 루트 `scroll-snap-type:y`(proximity)
- 꺾쇠: 활성 씬에서 `scene-scroll-cue` 애니메이션 동작, 자료실에서 `content:none`
- QR: 되감기 전 `display:none` → `is-rewound` 부여 시 `display:flex`(높이 89px, 등장 애니메이션) → 제거 시 다시 `none`
- **모바일(<64rem) 무영향**: 3초판단 표시, 주 메뉴에 3초판단 있음, QR 표시, 스냅 없음, 씬 불투명도 1.0
- 테스트 4건 전부 통과

**검증하지 못한 것 — 반드시 실제 브라우저에서 확인할 것.** 이 세션의 브라우저 패널이 화면에 표시되지
않아 페이지가 프레임을 합성하지 않았고, 그 결과 `window.scrollTo()`를 호출해도 `scrollY`가 0에서
움직이지 않았다. 손대지 않은 D 참조본에서도 동일하게 재현되므로 코드 문제가 아니라 측정 환경 제약이다.
따라서 다음은 **정적 확인만 된 상태**다.

- 스냅이 실제로 붙는 감각과 갤러리 씬(뷰포트 초과)에서 갇히지 않는지
- 불 켜지는 체감 지연이 실제로 줄었는지
- 마지막 씬에서 한 번 더 내렸을 때 되감기가 발동하고 QR이 뜨는지

## 8. 재현 도구

측정 하네스는 세션 스크래치패드에 있고 저장소에는 커밋하지 않았다. 재구성 방법:

- 정적 서버 2개(현재/D)를 각각 다른 포트로 띄운다. D 참조본이 없으면
  `git worktree add D:/Project/_visual-recovery/aiways-candidate-d pc-visual-master-d`
- 두 탭에서 동일한 수집 스크립트를 `eval`로 주입해 전 요소 computed style을 덤프하고, 오프라인에서 diff
- 반드시 **두 뷰포트 이상**에서 수집할 것
