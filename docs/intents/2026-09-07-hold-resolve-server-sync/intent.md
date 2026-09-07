# 보류함 "해결완료"를 서버 기록(resolveSortingRecord)과 실제로 동기화

## 문제

모바일 앱의 보류함(hold box) "해결완료" 버튼은 지금 localStorage 목록에서
항목을 지우고 토스트만 띄울 뿐, 그 항목을 만들 때 서버에 저장했던
sortingRecord(`status:"held"`)는 전혀 갱신하지 않는다. 백엔드에는 이미
`resolveSortingRecord` 엔드포인트와 `schoolDashboardAggregate.js`의
"보류→완료 전환" 집계 로직이 완성돼 있는데, 클라이언트가 이 배선을 아예
하지 않고 있어서 학급/학교 대시보드의 `heldTotal`/`completedTotal`이 실제
해결 여부와 항상 어긋난다(과대평가된 heldTotal, 과소평가된 completedTotal이
계속 누적).

## 원하는 결과

학생이 보류함에서 "해결완료"를 누르면 `resolveSortingRecord`가 실제로
호출되어 해당 기록이 서버에서 completed로 전환되고, 그 결과
`schoolDashboardAggregate.js`의 기존 "보류→완료" 집계(heldTotal 감소,
completedTotal/convertedTotal 증가)가 실제로 반영된다. 서버 호출이 실패하면
로컬 목록에서 항목이 사라지지 않고, 사용자에게 실패를 알리며 재시도할 수
있다.

## 영향받는 사용자·시스템

- 실사용자: 보류함을 쓰는 학생 전원(모바일 앱). 대표님(Bumm님)이 보는 PC
  대시보드의 heldTotal/completedTotal 수치도 이 변경 이후 정확해진다.
- 코드: `mobile/app.js`(addHoldItem/resolveHoldItem/submitSortingRecord),
  `edu2gBetaClient.js`(resolveSortingRecord 클라이언트 래퍼 — 이미 있음),
  백엔드는 변경 없음(`functions/lib/sortingRecordQuery.js`의
  `resolveSortingRecord` 핸들러, `schoolDashboardAggregate.js`의 전환
  로직 — 둘 다 기존 그대로 재사용).

## 제약

- Project Engineering(팀장) 경유 대표님 지시로 명시된 최소 요건:
  - 서버 호출이 실패하면 로컬 목록에서 항목을 지우지 않는다(실적 유실 방지).
  - 실패 시 사용자에게 실패를 알리고(무한 로딩/무반응 금지), 재시도 가능하게 한다.
  - `schoolDashboardAggregate.js`가 기대하는 상태 전이(held→completed,
    `resolutionType` 등)와 정확히 맞물리는지 에뮬레이터 테스트로 검증한다.
- 그 외 실패 처리 UX 세부(버튼 로딩 상태 표시 방식, 에러 메시지 문구 등)는
  이 저장소의 기존 컨벤션(다른 쓰기 핸들러의 503 처리 패턴,
  `edu2gBetaClient.js`의 `errorMessageFor` 매핑, `showVisualAlert` 토스트
  패턴)과 일관되게 세션이 설계한다 — 새로운 UI 패턴을 발명하지 않는다.
- 기존 `submitSortingRecord`의 "fire-and-forget, 실패해도 로컬 UI는 이미
  반영됨" 원칙은 최초 보류 등록 자체에는 그대로 유지한다(이번 변경은
  "해결완료" 시점의 후속 동기화만 대상).

## 미결 질문

없음 — 이전에 옵션 (a)/(b)로 나눠 보고했고, Project Engineering을 통해
대표님이 (b)로 확정했다. 실패 처리 세부는 위 제약에 따라 세션이 기존
컨벤션 안에서 판단한다.

## 메타데이터

- **작성자**: aiways-incheon 세션 (Claude)
- **작성 시각**: 2026-09-07
- **등급**: 1
- **상태**: done
