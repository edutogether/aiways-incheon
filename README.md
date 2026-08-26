# aiways-incheon

AI와 데이터로 학교 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.

## 실행 구조

- `index.html`, `style.css`, `app.js`: GitHub Pages 메인 사이트
- `assets/brand/aiways-logo.png`: 브랜드 로고
- `assets/gallery/`: 갤러리 상세 이미지
- `base-data-seed.tsv`: 대시보드 데이터가 아직 안 왔을 때도 안정적으로 표시되도록 하는 고정 seed 데이터
- `google-apps-script/`: **더 이상 안 씀** — 과거 Google Sheets 연동 Apps Script(참고용으로만 보존, 2026-08-26)
- `miniapp/3second.html`: 독립 실행 3초 판단 도우미

## 데이터 연동 (2026-08-26 기준)

**Firestore 단일 백엔드.** 대시보드 조회는 `loadSchoolDashboardFromApi()`가 Firebase Functions(`getSchoolDashboard` 등, `functions/index.js`)를 통해 Firestore 집계 데이터를 읽는다. PC `index.html`의 "AI 판단" 모달(`#aiModal` → `#confirmDecision`)도 `app.js`의 `saveSortingRecordToFirestore()`를 통해 같은 Functions(`saveSortingRecord`)로 기록한다 — Google Sheets/Apps Script 연동은 2026-08-26에 완전히 제거됐다. `base-data-seed.tsv`는 Firestore 데이터가 아직 안 왔을 때만 쓰는 초기 표시용 seed다.

**진짜 학생용 3초판단 앱은 `mobile/`이다** (`miniapp/3second.html`은 별도 구버전 체험 화면, 혼동 주의). `mobile/`은 Firestore/Functions에 직접 연결되어 있다.

## 배포

GitHub Pages는 `main` 브랜치의 root 기준으로 배포합니다. `.nojekyll`을 유지해 정적 파일이 그대로 배포되게 합니다.
