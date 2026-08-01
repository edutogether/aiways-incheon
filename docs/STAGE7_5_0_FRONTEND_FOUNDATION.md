# Stage 7.5-0 프런트 레이아웃 기반

## 목표와 경계

Stage 7.5-0은 기존 화면 보정 규칙을 유지한 채 덧대는 작업이 아니라, 같은 학습 콘텐츠와 동작 계약 위에 모바일 우선 레이아웃 기반을 다시 세운 단계다. Firebase, Firestore, Functions, App Check 설정과 AI API 계약은 변경하지 않았다.

- 기준 브랜치/HEAD: `feature/responsive-structure-stage7-4` / `1c6aec355e02c8ab0d68c2d93104e01f3a0e0830`
- 작업 브랜치: `feature/frontend-foundation-stage7-5-0`
- 보존: section id, `data-*` 이벤트 훅, 사진 입력, 검색·빠른 선택, 사용자 최종 판단, 보류·기록 흐름, App Check 어댑터와 Firebase API 호출 경로
- 제외: Firebase Console/배포, Functions 코드·설정, Firestore Rules, Secret, Hosting, GitHub Pages, `main`

## 철거와 재구축

`style.css`는 이전 CSS를 남기거나 백업하지 않고 전면 교체했다. 고정 기준 화면 보정 marker, PAGE/COMMON final 보정, `!important`, scroll snap, section 단위 viewport frame, 레이아웃 overflow 숨김, 강제 높이·최소폭·광범위 nowrap을 제거했다.

새 파일은 다음 cascade layer 순서만 사용한다.

`reset → tokens → base → layout → components → sections → states → responsive → utilities`

모바일에서는 단일 흐름과 자연 높이를 기본으로 하고, 672px와 1024px에서 카드와 작업 영역을 점진적으로 다열화한다. 모든 장문 본문은 줄바꿈 가능하며, 모달은 문서 흐름을 보존하는 dialog 내부 스크롤만 사용한다.

## DOM·학습 계약

다음은 구조 변경과 무관하게 유지하는 핵심 계약이다.

- `#sorting`, 사진 입력·검색·Teachable Machine 입력, 결과·보류·통계·모달의 기존 id
- `data-upload`, `data-tab`, `data-panel`, `data-sorting-mode`, `data-quick-item`, `data-judgement-*`, `data-final-category`, `data-close-analysis`
- “AI가 후보를 제안하고 사용자가 최종 판단한다”는 문구와 기록 전 확인 원칙
- App Check가 준비되지 않으면 원격 분석 전에 안전하게 실패하는 기존 경로

## 지연 AI 런타임

초기 HTML에서는 TensorFlow.js, MobileNet, Teachable Machine script를 모두 제거했다. `aiRuntimeLoader.js`는 공유 Promise로 다음을 지연 로드한다.

- 사진 분류 시 MobileNet 경로
- 학교 학습 모델 URL을 적용할 때 Teachable Machine 경로
- 런타임 timeout·load error는 참고 후보를 생략하고 기존 규칙 기반/안전 실패로 귀결

로더는 토큰·헤더·이미지·사용자 데이터를 저장하거나 App Check 흐름에 관여하지 않는다. 런타임은 후보일 뿐 최종 분리배출 판단을 변경하지 않는다.

## 자동 검증 기준

`frontendDomContract.test.js`는 핵심 id와 이벤트 attribute, 학습자 문구, runtime script 순서와 초기 정적 AI runtime 부재를 확인한다.

`frontendCssArchitecture.test.js`는 rule 수, media 수, viewport 조건, selector 중복, 금지 선언을 JSON으로 집계한다. 현재 기준은 177 rules, media 3, viewport 조건 3, selector 정의 최대 3, `!important`·고정/최대 height·선언형 min-width·nowrap·hidden overflow 모두 0이다.

`frontendLayoutSmoke.js`는 로컬 정적 서버와 CDP만 사용한다. 320~1920px의 40px 간격과 모든 실제 breakpoint 전후, 4개 폭 × 8개 높이, CDP 200% page scale에서 가로 overflow·핵심 3초판단 영역·초기 runtime request를 검사한다. 빠른 선택·검색·탭 상호작용 뒤에도 초기 runtime이 로드되지 않고 이미지 형태 localStorage가 없음을 확인한다. CDP fixture는 장문 후보·재질·주의 항목·체크리스트, 다수 보류·기록 목록, 장문 모달과 닫기 흐름을 넣어 레이아웃만 검증한다. 스크린샷은 OS 임시 폴더에만 저장한다.

이 검증은 실제 이미지, Gemini, Firestore, App Check 토큰을 사용하지 않는다. 실제 파일 선택·등록된 App Check 토큰 경로와 고도 확대의 브라우저 렌더링 차이는 운영 입력 없이 자동화 가능한 범위에서 분리해 두었다.
