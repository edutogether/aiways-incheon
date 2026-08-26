# AIWays Google Sheets 연동

> **2026-08-25 상태 갱신**: 2026-08-19~25 백엔드 재설계로 대시보드 조회와 `mobile/`(진짜 3초판단 앱)은 전부 Firestore로 이관됐다. 이 Apps Script는 더 이상 데이터를 "읽어가는" 경로가 아니고, PC `index.html`의 레거시 "AI 판단" 모달(`#aiModal`)이 여전히 여기로 기록을 쓰고 있는 잔존 경로다(`app.js`의 `appendRecord()` 참고). 완전 폐기 여부는 팀장 판단 대기 — 이 문서는 그 잔존 경로가 살아있는 동안의 설정 안내로만 유효하다.

AIWays 판단 기록을 Google Sheets에 사람이 읽기 좋은 형태로 누적하기 위한 Apps Script입니다.

## 시트 구성 (자동으로 생성됨, 미리 만들 필요 없음)

- **판단기록** — 판단 1건당 한 줄. 날짜/요일/시각/학교/학년/반/입력방식/AI인식결과/AI신뢰도/최종판단/판단보류여부 등 한글 헤더로 저장됩니다.
- **반별요약** — `판단기록`을 반 단위·물건 단위로 자동 집계한 표. 기록이 추가될 때마다 다시 계산됩니다. 대시보드가 실시간 숫자를 읽어갈 때 이 시트를 씁니다.

개인정보는 저장하지 않습니다: 학생 이름·이메일·IP·기기 정보 없음, 세션ID는 브라우저에서 만드는 익명 랜덤값입니다. 사진 파일·base64 이미지는 어떤 경우에도 저장하지 않습니다.

## 설정

1. Google Sheets를 새로 만듭니다 (시트 이름은 신경 쓰지 않아도 됩니다 — 스크립트가 `판단기록`/`반별요약` 탭을 알아서 만듭니다).
2. `확장 프로그램 > Apps Script`를 열고 `Code.gs` 내용을 붙여넣습니다.
3. 같은 스프레드시트에 묶어 쓰면 `SPREADSHEET_ID`를 비워둬도 됩니다.
4. 별도 Apps Script 프로젝트라면 스프레드시트 URL의 ID를 `SPREADSHEET_ID`에 입력합니다.
5. `배포 > 새 배포 > 웹 앱`을 선택합니다.
6. 실행 사용자는 본인, 액세스 권한은 `Anyone` 또는 `Anyone with the link`로 설정합니다.
7. 배포 URL을 `app.js`의 `DATA_CONFIG.appsScriptUrl`에 넣으면 메인 대시보드가 Sheet 데이터를 우선 읽습니다.
8. `miniapp/3second.html`의 `AIWAYS_SYNC_CONFIG.appsScriptUrl`에 같은 URL을 넣으면 미니앱 기록도 전송됩니다.

## 읽기 API (2026-08-26부터 인증 필요)

- `GET ?action=list&token=<SHARED_SUBMIT_TOKEN>` — 판단기록 원본 전체 (JSON, `callback=` 붙이면 JSONP)
- `GET ?action=summary&token=<SHARED_SUBMIT_TOKEN>` — 반별 오늘 관찰/판단보류/완료 건수 + 헷갈린 물건 TOP 5

**2026-08-26 정밀감사에서 발견**: 이 GET 엔드포인트에 원래 인증이 전혀 없어서, `app.js`에 노출된 배포 URL을 누구나 복사해 판단기록 전체를 조회할 수 있었습니다. `doPost`와 동일한 `SHARED_SUBMIT_TOKEN`을 쿼리파라미터로 요구하도록 고쳤습니다. 현재 `app.js`/`mobile/`은 이 GET 엔드포인트를 실제로 호출하지 않습니다(대시보드 조회는 Firestore로 이관 완료) — 이 API는 수동 점검용으로만 남아있는 상태입니다.

URL이 비어 있거나 연결이 실패하면 메인 사이트는 `base-data-seed.tsv`의 고정 데이터로 표시됩니다.

**Code.gs를 고친 뒤에는 Apps Script 편집기에서 `배포 > 배포 관리 > 수정(연필 아이콘) > 새 버전 > 배포`로 재배포해야 실제로 반영됩니다** — git push만으로는 라이브에 적용되지 않습니다(대표님만 실행 가능).
