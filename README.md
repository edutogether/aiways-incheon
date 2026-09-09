# aiways-incheon

AI와 데이터로 학교 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.

## 실행 구조

| 폴더 | 무엇 | 고치는 곳 |
|---|---|---|
| 루트(`index.html`/`style.css`/`app.js`) | 교사용 PC 대시보드 | 그 파일들 |
| `mobile-app/` | **학생용 모바일 앱 소스** (React 18 + TypeScript) | `src/`, `public/` |
| `mobile/` | 위를 빌드한 **산출물**. git에 없다 | 고치지 않는다 |
| `functions/` | 백엔드(Cloud Functions) + 테스트 | 그 안에서 |
| `tests/baseline/` | 모바일 화면 비주얼 기준선(Playwright) | 화면을 의도적으로 바꿀 때만 |

🔴 **`mobile/` 안의 파일을 고치면 다음 빌드에 지워집니다.** 모바일 화면은
`mobile-app/src`에서 고치고 빌드합니다(2026-09-09 리액트 전환).

- `index.html`, `style.css`, `app.js`: 교사용 PC 대시보드
- `assets/brand/aiways-logo.png`: 브랜드 로고
- `assets/gallery/`: 갤러리 상세 이미지
- `base-data-seed.tsv`: 대시보드 데이터가 아직 안 왔을 때도 안정적으로 표시되도록 하는 고정 seed 데이터
- `google-apps-script/`: **더 이상 안 씀** — 과거 Google Sheets 연동 Apps Script(참고용으로만 보존, 2026-08-26)
- `miniapp/3second.html`: 독립 실행 3초 판단 도우미

## 데이터 연동 (2026-08-26 기준)

**Firestore 단일 백엔드.** 대시보드 조회는 `loadSchoolDashboardFromApi()`가 Firebase Functions(`getSchoolDashboard` 등, `functions/index.js`)를 통해 Firestore 집계 데이터를 읽는다. PC `index.html`의 "AI 판단" 모달(`#aiModal` → `#confirmDecision`)도 `app.js`의 `saveSortingRecordToFirestore()`를 통해 같은 Functions(`saveSortingRecord`)로 기록한다 — Google Sheets/Apps Script 연동은 2026-08-26에 완전히 제거됐다. `base-data-seed.tsv`는 Firestore 데이터가 아직 안 왔을 때만 쓰는 초기 표시용 seed다.

**진짜 학생용 3초판단 앱은 `mobile-app/`이다** (빌드하면 `mobile/`이 되어 배포된다).
`miniapp/3second.html`은 별도 구버전 체험 화면이라 혼동에 주의한다.

## 개발

명령이 폴더마다 다르다.

```bash
# 백엔드 - 유닛테스트 196개, 에뮬레이터 통합테스트는 파일당 스크립트 하나
cd functions && npm test

# 모바일 앱 - 타입검사·린트·단위테스트·빌드
cd mobile-app && npm run typecheck && npm run lint && npm test && npm run build

# 모바일 화면 비주얼 기준선(Playwright) - 빌드 후 4뷰포트 × 13개 상태 대조
npm test
```

`tests/baseline/`의 스냅샷은 **리액트 전환 전 화면에서 찍은 것**이고, 전환 뒤에도
그대로 두고 통과시켰다. 화면을 의도적으로 고칠 때만 다시 찍는다 — 통과시키려고
다시 찍으면 증명이 되지 않는다. 자세한 것은
`_docs/intents/2026-09-09-mobile-react-conversion/intent.md` 참고.

## 배포

**Firebase Hosting** — 라이브 주소는 <https://incheon.edutogether.kr>입니다(2026-09-01에 GitHub Pages에서 이전했고, 구 주소 `edutogether.github.io/aiways-incheon/`은 더 이상 갱신되지 않습니다). `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 test·frontend → deploy-backend(Firestore rules/indexes/Functions) → deploy-hosting 순서로 배포합니다. `deploy-hosting`은 `mobile-app`을 빌드해 `mobile/`을 만든 뒤 배포하고, 배포에 올라가는 파일은 `scripts/stageHostingSite.js`가 화이트리스트로 골라 담습니다(빌드를 잊으면 여기서 멈춥니다).

## 문서

- `CLAUDE.md` — 저장소 전역 규칙과 정착된 결정(클로드 세션이 자동으로 읽음)
- `AGENTS.md` — 도구 종류와 무관하게 알아야 할 명령·함정(Codex 등 타 도구용)
- `_docs/ops/` — 운영 문서(인수인계 일지, 배포 준비 패키지)
- `_docs/intents/` — 작업 전에 쓰는 intent 문서
- `_docs/archive/` — 지나간 시점의 기록(스테이지 산출물, 과거 감사)
