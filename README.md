# aiways-incheon

AI와 데이터로 학교 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.

## 실행 구조

- `index.html`, `style.css`, `app.js`: GitHub Pages 메인 사이트
- `assets/brand/aiways-logo.png`: 브랜드 로고
- `assets/gallery/`: 갤러리 상세 이미지
- `base-data-seed.tsv`: Google Sheets 연결 전에도 대시보드가 안정적으로 표시되도록 하는 고정 seed 데이터
- `google-apps-script/`: 판단 기록을 Google Sheets에 누적하기 위한 Apps Script
- `miniapp/3second.html`: 독립 실행 3초 판단 도우미

## 데이터 연동 (2026-08-25 기준)

**대시보드 조회는 Firestore가 기준이다.** PC 대시보드는 `loadSchoolDashboardFromApi()`가 Firebase Functions(`getSchoolDashboard` 등, `functions/index.js`)를 통해 Firestore 집계 데이터를 읽는다. `base-data-seed.tsv`는 이 데이터가 아직 안 왔을 때만 쓰는 초기 표시용 seed다.

**진짜 학생용 3초판단 앱은 `mobile/`이다** (`miniapp/3second.html`은 별도 구버전 체험 화면, 혼동 주의). `mobile/`은 Firestore/Functions에 직접 연결되어 있다.

**남은 레거시**: PC `index.html`의 "AI 판단" 모달(`#aiModal` → `#confirmDecision`)은 아직 `app.js`의 `appendRecord()`를 통해 `DATA_CONFIG.appsScriptUrl`(Google Apps Script/Sheets, `google-apps-script/`)로 직접 기록을 전송한다 — 2026-08-19~25 백엔드 재설계(Firestore 단일화)가 실제로는 `mobile/`과 대시보드 읽기 경로만 이관했고, 이 PC 모달 쓰기 경로는 아직 옮겨지지 않은 상태다(2026-08-26 문서 점검에서 발견, 정리 필요 여부는 팀장 판단 대기).

## 배포

GitHub Pages는 `main` 브랜치의 root 기준으로 배포합니다. `.nojekyll`을 유지해 정적 파일이 그대로 배포되게 합니다.
