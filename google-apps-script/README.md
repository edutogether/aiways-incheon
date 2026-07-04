# AIWays Google Sheets 연동

AIWays 판단 기록을 Google Sheets에 누적하기 위한 Apps Script입니다.

## 설정

1. Google Sheets를 새로 만들고 첫 시트 이름을 `logs`로 둡니다.
2. `확장 프로그램 > Apps Script`를 열고 `Code.gs` 내용을 붙여넣습니다.
3. 같은 스프레드시트에 묶어 쓰면 `SPREADSHEET_ID`를 비워둬도 됩니다.
4. 별도 Apps Script 프로젝트라면 스프레드시트 URL의 ID를 `SPREADSHEET_ID`에 입력합니다.
5. `배포 > 새 배포 > 웹 앱`을 선택합니다.
6. 실행 사용자는 본인, 액세스 권한은 `Anyone` 또는 `Anyone with the link`로 설정합니다.
7. 배포 URL을 `app.js`의 `DATA_CONFIG.appsScriptUrl`에 넣으면 메인 대시보드가 Sheet 데이터를 우선 읽습니다.
8. `miniapp/3second.html`의 `AIWAYS_SYNC_CONFIG.appsScriptUrl`에 같은 URL을 넣으면 미니앱 기록도 전송됩니다.

URL이 비어 있거나 연결이 실패하면 메인 사이트는 `base-data-seed.tsv`의 고정 데이터로 표시됩니다. 사진 파일이나 base64 이미지는 저장하지 않고 판단 기록만 저장합니다.
