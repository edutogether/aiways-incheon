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

**Firebase Hosting** — 라이브 주소는 <https://ai-ways-incheon.web.app>입니다(2026-09-01에 GitHub Pages에서 이전했고, 구 주소 `edutogether.github.io/aiways-incheon/`은 더 이상 갱신되지 않습니다). `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 test → deploy-backend(Firestore rules/indexes/Functions) → deploy-hosting 순서로 배포합니다. 배포에 올라가는 파일은 `scripts/stageHostingSite.js`가 화이트리스트로 골라 담습니다.

## 문서

- `CLAUDE.md` — 저장소 전역 규칙과 정착된 결정(클로드 세션이 자동으로 읽음)
- `AGENTS.md` — 도구 종류와 무관하게 알아야 할 명령·함정(Codex 등 타 도구용)
- `_docs/ops/` — 운영 문서(인수인계 일지, 배포 준비 패키지)
- `docs/intents/` — 작업 전에 쓰는 intent 문서
