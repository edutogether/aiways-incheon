# Stage 7.5-B 디자인 시스템·시각 표현

## 시작점과 목표

- 시작 브랜치/HEAD: `feature/visual-alignment-stage7-5-a` / `ab6e3b29a1c5f1064bd6896208e08abc7c1048a3`
- 작업 브랜치: `feature/design-system-stage7-5-b`

배치·정보구조·문구·기능을 바꾸지 않고, AI Ways Incheon을 신뢰할 수 있는 생활형 환경 데이터 도구로 보이게 하는 디자인 토큰과 상태 표현을 완성한다. AI는 참고 후보를 제안하고 사용자가 최종 판단한다는 경계는 시각적으로도 분리한다.

## 보존 계약

nav와 section 순서, 대시보드 hero 왼쪽/card group 오른쪽 관계, 각 콘텐츠 소속, 모바일 DOM stack, 기존 `id`·`data-*`·App Check·API 계약을 유지한다. Firebase, Functions, Rules, Hosting, `main`, GitHub Pages는 바꾸지 않는다.

## 디자인 시스템

- canvas/elevated/surface 1~3: blue-black 기반의 계층적 배경
- text primary/secondary/tertiary: 눈부심을 줄인 blue-white 계열
- accent primary: 행동·성공의 mint, accent secondary/info: 데이터·AI 참고의 blue
- caution/error: 보류와 오류에만 제한 적용
- line subtle/default/strong, shadow low/medium/high, glow subtle: 깊이와 상호작용을 역할별로 분리
- radius small/medium/large/pill, spacing scale, type scale, 44px control height, 180ms easing을 공통 토큰으로 사용

raw color는 tokens layer의 의미 토큰, canvas/header/modal의 투명도, chart/SVG의 데이터 대비에만 남겼다. 컴포넌트 표면·border·shadow·radius는 토큰을 사용한다.

## 컴포넌트 표현

카드는 surface·border·shadow를 분리하고 실제 interactive card에만 2px 이내 hover 상승을 적용한다. primary/secondary control, tab active, input focus, disabled, modal surface와 close button의 위계를 통일했다. KPI는 tabular 성격의 숫자 대비를 강화하고, chart/donut/progress는 동일한 data surface에 배치했다.

3초판단에서 blue AI candidate 영역과 사용자 체크리스트·수정 영역을 분리했다. 완료는 success, 보류는 caution, 오류는 error로 텍스트·border·surface를 함께 표시한다. loading spinner는 실제 값처럼 보이지 않는 보조 표현이며 reduced-motion에서는 즉시 전환한다.

## 접근성·motion

모든 control은 최소 44px 높이를 유지하고 focus-visible은 `--focus` outline을 사용한다. 보조 텍스트는 tertiary token을 사용하되 dark surface에서 판독 가능한 대비를 확보한다. `prefers-reduced-motion`에서 animation/transition duration을 1ms로 축소한다.

## 자동 검증과 산출물

design system·visual state smoke는 localhost CDP fixture만 사용한다. 실제 Gemini·Firestore·App Check token·이미지 전송은 수행하지 않는다. 상태 fixture는 기본, preview, loading, candidate, uncertainty, user selection, checklist, complete, hold, error, network, records, modal, reduced-motion을 포괄한다.

- Stage 7.5-A 참고 추출 및 Stage 7.5-B capture: `C:\Users\817be\AppData\Local\Temp\aiways-stage7-5-b-comparison`
- contact sheet: 위 임시 폴더의 `stage7-5-a-stage7-5-b-contact-sheet.png`

Stage 7.5-C에서는 실제 모바일·태블릿·desktop browser, keyboard focus, camera permission, 실제 이미지 선택, 저사양 렌더링을 실기기에서 최종 검수한다.
