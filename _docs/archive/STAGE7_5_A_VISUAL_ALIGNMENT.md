# Stage 7.5-A 배치 보존형 시각 정렬

## 시작점과 보존 계약

- 시작 브랜치/HEAD: `feature/frontend-foundation-stage7-5-0` / `174572404c489053654d973f5d29d1b6592b6a84`
- 작업 브랜치: `feature/visual-alignment-stage7-5-a`
- 참고 커밋: `1c6aec355e02c8ab0d68c2d93104e01f3a0e0830`

이번 단계는 정보구조를 바꾸지 않고, Stage 7.5-0의 반응형 기반 위에서 이전 화면이 의도한 배치 관계와 공통 기준선을 정렬하는 작업이다. nav 순서는 `대시보드 → 프로젝트 → 교육과정 → H-A-H → 차시흐름 → 갤러리 → 3초판단 → 자료실`로, section 순서는 `dashboard → project → curriculum → hah → flow → gallery → sorting → resources`로 고정했다.

각 section의 콘텐츠 소속, 확정 문구, `id`, `data-*`, 사용자 판단 흐름, App Check와 API 계약은 변경하지 않았다. Stage 8 인증 UI도 추가하지 않았다.

## 비교 방법과 관찰

참고 커밋은 현재 작업본을 전환하지 않고 OS 임시 폴더에 `git archive`로 추출했다. 현재·참고 버전을 각각 localhost 정적 서버로 제공하고 390×844, 768×1024, 1024×768, 1366×768, 1920×1080의 모든 section을 캡처했다. 비교 목적은 픽셀 복제가 아니라 좌우 그룹, 강조 순서, 중심축, 카드 묶음의 시각적 무게를 확인하는 것이었다.

Stage 7.5-0 이후 확인한 의도치 않은 변화는 넓은 화면의 대시보드 hero가 우측 dashboard-grid의 수직 중앙으로 밀려 첫 화면에서 사라지던 점, 카드 제목과 새로고침 아이콘의 크기가 카드 폭에 비해 과도하던 점, 카드 내부 요소 간 세로 간격이 균일하지 않던 점이다.

## section별 배치 의도와 수정

- 대시보드: 데스크톱에서 hero는 왼쪽, 학교·매립지·학급·사진 카드군은 오른쪽이라는 관계를 유지했다. hero는 우측 카드군 상단부와 함께 보이도록 정렬했고, 내부 dashboard-grid의 카드 우선순위와 DOM 순서는 바꾸지 않았다. 모바일은 hero 다음 카드군의 1열 stack을 유지한다.
- 프로젝트: 소개와 카드군의 기존 관계와 카드 순서를 유지하고, 카드의 상단 기준·내부 간격을 공통 카드 규칙에 맞췄다.
- 교육과정: 설명과 교육과정/성취기준 영역의 좌우 관계, 카드 순서와 자연 높이를 유지했다.
- H-A-H: 설명·callout과 3개 카드의 의미·순서를 보존하고, 넓은 화면의 균형 있는 3열 및 더 좁은 폭의 자연스러운 전환을 유지했다.
- 차시 흐름: 단계 번호·제목·본문의 간격을 카드 공통 규칙으로 정렬하고 기존 단계 순서를 보존했다.
- 갤러리: 카드와 상세 영역의 관계, 선택·상세 기능, 모바일의 문서 흐름을 유지했다.
- 3초판단: 입력, 검색, 빠른 선택, 후보, 체크리스트, 완료·보류·기록 순서를 그대로 두고 탭·입력·버튼·chip의 기준선을 공통 control 규칙으로 맞췄다.
- 자료실/footer: 카드 순서와 footer 정보를 보존하고 공통 콘텐츠 폭·gutter 안에서 정렬했다.

## 공통 정렬 기준

공통 content 폭과 gutter, section 간 간격, card padding·radius·내부 gap, 버튼·input 44px 이상 높이, label/control 간격, 통계 숫자와 설명의 grid 정렬, SVG/chart container, modal close button 44px 접근 영역을 일관되게 적용했다. 카드 제목은 panel 안에서 과도하게 커지지 않도록 별도 스케일을 적용했고, 매립지 새로고침 제어는 고정된 44px control 안에 SVG를 정렬했다.

이전 legacy의 고정 section height, 숨김 overflow, viewport별 보정, `!important`, scroll snap, 강제 min-width·nowrap은 복원하지 않았다.

## 반응형과 자동 검사

모바일·태블릿·노트북·데스크톱에서 문서 높이와 DOM 순서를 보존한다. 1024px 이상은 대시보드·주요 설명/콘텐츠 section의 좌우 관계를 유지하고, 그 아래에서는 원래 DOM 순서대로 stack한다. CSS는 기존 3개 media query만 사용한다.

`frontendVisualAlignmentSmoke.js`는 CDP와 localhost만 사용해 11개 viewport에서 다음을 검사한다.

- section 순서, 가로 overflow, 카드·footer의 container 이탈, 텍스트 clipping, 초기 AI runtime 정적 script
- visible button 40px 이상, modal close 40px 이상, 검색 input/button 중심선
- 같은 grid 행 카드의 top 차이 3px 이하, 모든 section left 기준선 spread 1px 이하
- 1024px 이상 hero 왼쪽/dashboard-grid 오른쪽, 그 아래 hero 다음 dashboard-grid stack
- runtime exception과 console log error 0

허용 오차는 sub-pixel rendering을 위한 1px(폭·left 기준)과 동일 grid 행/입력 중심선의 3px뿐이다. 넓은 viewport별 예외는 두지 않는다.

## CSS architecture와 산출물

최종 CSS 집계: 193 rules, media query 3개, 고유 viewport 조건 3개, selector 정의 최대 3회, `!important` 0개, 고정/최대 height 0개, 선언형 min-width 0개, nowrap 0개, hidden overflow 0개다.

- 참고 추출: `C:\Users\817be\AppData\Local\Temp\aiways-stage7-5-a-reference\site`
- 비교 캡처: `C:\Users\817be\AppData\Local\Temp\aiways-stage7-5-a-comparison\reference` 및 `...\current`
- 1366×768 contact sheet: `C:\Users\817be\AppData\Local\Temp\aiways-stage7-5-a-comparison\1366x768-reference-current-contact-sheet.png`

## 후속 단계 경계

Stage 7.5-B에는 컬러 체계, 장식 그래픽, 브랜드 표현, 고급 motion처럼 순수 시각 표현만 넘긴다. Stage 7.5-C에는 실제 모바일 기기·브라우저 조합, 카메라 권한과 실제 이미지 입력의 실기기 검수를 넘긴다.

Firebase, Functions, Firestore Rules, Hosting, GitHub Pages, `main`은 변경하지 않았다.
