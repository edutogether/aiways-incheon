# aiways-incheon

AI와 데이터로 학교 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.

## 실행 구조

- `index.html`, `style.css`, `app.js`: GitHub Pages 메인 사이트
- `assets/brand/aiways-logo.png`: 브랜드 로고
- `assets/gallery/`: 갤러리 상세 이미지
- `base-data-seed.tsv`: Google Sheets 연결 전에도 대시보드가 안정적으로 표시되도록 하는 고정 seed 데이터
- `google-apps-script/`: 판단 기록을 Google Sheets에 누적하기 위한 Apps Script
- `miniapp/3second.html`: 독립 실행 3초 판단 도우미

## 데이터 연동

`app.js`의 `DATA_CONFIG.appsScriptUrl`에 Apps Script 웹앱 URL을 넣으면 Google Sheets 데이터를 우선 읽습니다. URL이 비어 있거나 연결에 실패하면 `base-data-seed.tsv`를 사용하고, seed도 실패하면 앱 내부 고정값으로 표시합니다.

미니앱은 `miniapp/3second.html`의 `AIWAYS_SYNC_CONFIG.appsScriptUrl`에 같은 URL을 넣으면 판단 기록을 전송합니다. 사진 파일이나 base64 이미지는 저장하지 않습니다.

## 배포

GitHub Pages는 `main` 브랜치의 root 기준으로 배포합니다. `.nojekyll`을 유지해 정적 파일이 그대로 배포되게 합니다.
