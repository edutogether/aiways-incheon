# Stage 7.5-C 최종 브라우저·반응형 QA

## 기준과 판정

- 시작 기준: `feature/design-system-stage7-5-b` / `209503f8b97fcdd63ca3d296fbdc72dad7c60ce0`
- 작업 브랜치: `feature/final-browser-qa-stage7-5-c`
- 제품 프론트 소스(`index.html`, `style.css`, `app.js`, `aiRuntimeLoader.js`) 변경: 없음
- 판정: **AUTOMATED_PASS**
- 판정하지 않음: **FULL_PASS** (실제 물리 기기 미검수)
- 실기기 상태: **REAL_DEVICE_PENDING / MANUAL_REQUIRED**

이번 단계는 Stage 7.5-B의 배치, 정보구조, 문구, 기능, 디자인 토큰을 고정한 채 로컬 정적 페이지에서 최종 검수만 수행했다. 제품 소스가 바뀌지 않아 Stage 7.5-B와 C의 화면 상태는 동일하다.

## 브라우저와 실행 조건

| 브라우저 | 경로 | 버전 | CDP 임시 프로필 | 결과 |
| --- | --- | --- | --- | --- |
| Google Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` | 150.0.7871.187 | 별도 임시 user-data-dir | PASS |
| Microsoft Edge | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` | 150.0.4078.105 | 별도 임시 user-data-dir | PASS |

기존 사용자 프로필, 로그인, 쿠키, 저장된 토큰을 사용하지 않았다. ADB는 설치되어 있지 않아 연결 Android 기기는 검수하지 않았다.

## 자동 viewport·입력 검수

- Chrome 전체 matrix: 81개 검사. 세로 모바일 10, 가로 모바일 9, 태블릿 7, 데스크톱 8, 320~1920px 연속 폭 41, 실제 breakpoint 671/672/673px 및 1023/1024/1025px 6개를 각각 집계했다.
- Edge 대표 matrix: 9개 검사(320×568, 360×800, 390×844, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, 1920×1080).
- DPR: Chrome/Edge 각각 390×844, 768×1024, 1366×768에서 1·2·3, 총 18개 PASS.
- 확대: 각 브라우저에서 100·125·150·200%, 총 8개 PASS. CDP page scale 기반이며 실제 브라우저 UI 확대와는 완전히 동일하지 않다.
- 회전·무새로고침 resize: 5개 왕복 시나리오, 브라우저별 14개의 전환 PASS. section/nav 순서, overflow, console 오류, 런타임 정적 로드가 모두 정상이다.
- 낮은 높이·소프트 키보드 유사: 320×400, 360×420, 390×460, 768×500, 1024×600, 1366×600에서 search mode와 focus/문서 스크롤 조건 PASS. 이것은 viewport 축소 자동 검증이며 실제 모바일 소프트 키보드 검증은 아니다.

모든 자동 viewport에서 가로 overflow, section heading clipping, sorting 영역 소실, 초기 AI runtime 정적 script를 발견하지 못했다. nav 순서는 `대시보드 → 프로젝트 → 교육과정 → H-A-H → 차시흐름 → 갤러리 → 3초판단 → 자료실`, section 순서는 `dashboard → project → curriculum → hah → flow → gallery → sorting → resources`로 유지됐다.

## 3초판단·사진 입력·AI runtime

- 결정적 로컬 fixture 35 상태와 기존 visual-state 14 상태(기본, preview, loading, 후보, 낮은 신뢰도, 사용자 선택, 체크리스트, 완료, 보류, 오류, network, 기록, modal, reduced-motion)를 검수했다.
- AI 후보·사용자 판단 구분, 체크리스트, 완료/보류 CTA, 긴 후보, 기록/오류, modal close를 점검했고 clipping·잔여 DOM·modal close 접근 불가가 없었다.
- 고정 문구와 `source: future_gemini` 계약은 정적 contract로 유지됐다. 실제 Gemini, Firestore, App Check 요청은 보내지 않았다.
- `cameraInput`과 `uploadInput`의 `image/*`, camera capture/environment, 파일 선택 fallback, 버튼 연결, 비이미지 거부, preview URL 해제, 원본 이미지/Base64 localStorage 저장 없음 계약을 PASS 처리했다. 실제 카메라 촬영·권한 거부는 검수하지 않았다.
- 최초 페이지, 검색, 빠른 선택 조건에서 TensorFlow/MobileNet/Teachable Machine static load는 0건이었다. CDP는 해당 런타임 URL을 차단한 상태로 검사했다. 로더의 pending dedupe, 12초 timeout, MobileNet과 Teachable Machine의 분리된 의존성 경로는 정적 계약으로 확인했다.

## 접근성·안정성

- focus-visible, aria-live, 검색 input focus, modal close, 40px 이상 close control, 숨은 section 순서, reduced-motion을 자동 검수했다.
- 실제 Tab/Enter/Space 전 구간, 실제 모바일 키보드, 실제 터치 포인터, 화면낭독기 트리 전체는 MANUAL_REQUIRED다.
- local fixture의 `PerformanceObserver` layout-shift 측정값은 Chrome 0, Edge 0이었다(목표 0.1 이하). 이는 로컬 fixture 상태 전환 측정이며 실제 네트워크/저사양 기기 성능의 대체값은 아니다.
- offline·느린 네트워크·Functions 응답 지연은 실제 endpoint를 호출하지 않고 runtime 차단 및 fixture 오류 상태로만 확인했다. 무한 spinner, 영구 disabled, console error, unhandled rejection은 자동 검수에서 관찰되지 않았다.

## Chrome·Edge 비교와 결함

- 비교 viewport: 390×844, 768×1024, 1024×768, 1366×768, 1920×1080 및 sorting fixture 대표 상태.
- 불허 항목(column/CTA 순서, clipping, modal 접근, overflow, nav/section 순서, 상태 표현) 차이: 없음.
- 허용 범위의 font rasterization 외 차이: 없음.
- P0: 0, P1: 0, P2: 0.
- 제품 코드 수정: 없음. 검수 자동화와 문서만 추가했다.

## CSS·회귀 기준

- CSS rules 203, media query 4, `!important` 0.
- legacy FIX marker 0, scroll-snap 0, 고정 layout height/min-width 0, 전체 페이지 overflow 숨김 0, 초기 외부 AI runtime 정적 script 0.
- Functions 운영 코드, Firebase, Firestore Rules, Hosting, main, GitHub Pages 변경: 없음.

## 스크린샷 산출물

- 임시 QA 루트: `C:\Users\817be\AppData\Local\Temp\aiways-stage7-5-c-qa`
- Chrome 대표 상태: `...\chrome`
- Edge 대표 상태: `...\edge`
- Stage 7.5-B/C contact sheet: `C:\Users\817be\AppData\Local\Temp\aiways-stage7-5-c-qa\stage7-5-b-to-c-contact-sheet.png`

스크린샷은 Git에 추가하지 않았다. B와 C는 제품 소스가 동일하므로 contact sheet는 동일 소스 상태 비교로 기록했다.

## MANUAL_REQUIRED 실기기 체크리스트

- iPhone Safari 실제 렌더링과 카메라 권한 허용/거부
- Android Chrome 실제 카메라와 파일 선택
- Samsung Internet 실제 렌더링
- 태블릿 실제 회전
- 실제 모바일 소프트 키보드
- 저사양 기기 스크롤·animation
- 실제 터치 오작동과 전체 키보드/보조기기 흐름

## Stage 8 진입 조건

자동 검수 기준으로 Stage 7.5-C는 완료 가능하다. Stage 8로 기능 작업을 시작할 수 있으나, 릴리스 수준의 FULL_PASS는 위 실기기 체크리스트의 직접 검증 증거가 있을 때만 선언할 수 있다.
