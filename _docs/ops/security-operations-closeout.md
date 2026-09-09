# Stage 7 보안·비용 보호 운영 기준서

작성 시각: 2026-08-01 22:56 KST
기준 저장소: `https://github.com/edutogether/aiways-incheon.git`
기준 브랜치/HEAD: `feature/security-cost-protection-stage7` / `b661460a1972bf0beffcf1f62305fec54a187292`
Firebase 프로젝트/리전: `ai-ways-incheon` / `asia-northeast3`

## A. 기준 상태

- 공식 공개 URL은 GitHub Pages이며, Firebase Hosting은 사용하거나 배포하지 않는다.
- `origin/main`은 안정 기준점 `bf97d593bf5ed93fe00d2799035d86fa253e293b`를 유지한다.
- GitHub Pages와 `origin/main`은 이 감사에서 변경하지 않았다.
- Functions 런타임은 Node.js 22이며, App Check enforcement는 활성화(`true`) 상태다.
- 등록된 App Check 디버그 토큰의 값은 기록·조회·변경·삭제하지 않았다.

## B. 배포 함수 기준

| 함수 | 역할 | 런타임/리전 | 메모리 | timeout | min/max | concurrency | Secret reference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `analyzeSortingImage` | 이미지 관찰 후보 분석; 최종 판단은 사용자 검증에 남김 | Node.js 22 / asia-northeast3 | 256MiB | 30초 | 0 / 2 | 1 | 있음 (`GEMINI_API_KEY`, 값 미조회) |
| `saveSortingRecord` | 확인된 분류 기록 저장 | Node.js 22 / asia-northeast3 | 256MiB | 15초 | 0 / 2 | 5 | 없음 |
| `listSortingRecords` | 현재 actor의 기록 목록 조회 | Node.js 22 / asia-northeast3 | 256MiB | 15초 | 0 / 2 | 5 | 없음 |
| `resolveSortingRecord` | 사용자 검토 후 기록 해결 | Node.js 22 / asia-northeast3 | 256MiB | 15초 | 0 / 2 | 5 | 없음 |

네 함수의 Active·리전·Node.js 22 상태는 Firebase CLI 읽기 전용 감사로 확인했다. memory, timeout, 인스턴스, concurrency 및 Secret reference는 현재 소스 선언과 직전 배포 보고 기준이며, 이번 CLI 감사에서는 세부 런타임 값을 별도로 열람하지 않았다.

## C. 적용된 보호 계층

- App Check: 네 HTTP 함수가 공통 보호 모듈을 사용하며 enforcement가 활성화되어 있다.
- CORS: `https://edutogether.github.io` 및 로컬 개발 주소로만 제한한다. Firebase Functions 기본 CORS는 활성화하지 않는다.
- payload·이미지 검증: 요청 크기, 허용 형식, Base64 형식, 이미지 signature, 최대 바이트·가로세로·픽셀 수를 검증한다.
- rate limit: 전역 제한과 함수별 비용 보호를 적용하며 보호 계층 unavailable은 안전하게 실패한다.
- idempotency: 분석 요청 키는 SHA-256 해시로만 보관하고, TTL 및 processing lock을 둔다.
- Firestore: 클라이언트 Rules는 deny-all이다. 원본 이미지·idempotency key 원문·프롬프트는 Firestore에 저장하지 않는다.
- Secret 관리: `GEMINI_API_KEY`는 Functions Secret reference로만 선언하며 값은 코드·Git·로그·테스트 fixture에 기록하지 않는다.
- 로그: App Check 관찰 로그에는 상태·함수명·요청 식별자·지연시간·enforcement만 남기며 토큰·헤더 원문은 남기지 않는다.
- 리소스 상한: 함수별 memory, timeout, min/max instances, concurrency는 위 표의 상한을 유지한다.
- Gemini: 관찰 후보를 제공할 뿐 최종 배출 판단이나 사용자 체크리스트 완료를 결정하지 않는다.

## D. 예상 HTTP 동작

| 조건 | 기대 동작 |
| --- | --- |
| App Check missing | `401` / `app_check_missing` |
| App Check invalid | `401` / `app_check_invalid` |
| App Check verification unavailable | `503` / `protection_unavailable` |
| valid App Check + 잘못된 빈 본문 | 각 함수의 후속 입력·actor 검증에 따라 `400` 또는 `503` |

`400` 또는 `503`의 후속 결과는 App Check 실패가 아니라 입력 또는 actor 검증 결과다. 차단 요청은 rate limiter, idempotency, Firestore, Gemini보다 먼저 종료된다.

## E. 현재 제한사항

- EDU2G PASS와 실제 actor 식별은 Stage 8에서 구현한다.
- record 함수는 운영 actor가 확정되지 않은 상태에서 `actor_not_resolved`로 안전하게 실패한다.
- 현재 단계는 5인 클로즈드 베타 이전이며, 한 반 전체 현장 운영이나 교육 효과 검증 단계가 아니다.
- 반응형·해상도별 UI 깨짐은 후속 Stage 7.4와 Stage 7.5에서 해결한다.

## F. 운영 점검표

- 오류율 및 Functions 호출량
- App Check missing/invalid 급증
- Gemini 오류 및 rate-limit 증가
- Firestore 사용량과 비용 알림
- Artifact Registry 정리 정책
- 로그의 민감정보 노출 여부

Google Cloud 결제 알림, Gemini 선불 잔액·자동 충전, App Check Console provider 상세값, Artifact Registry cleanup policy는 외부 콘솔 설정이므로 이번 CLI 감사에서는 미검증이며 사용자 확인 기준으로 관리한다.

## G. 디버그 토큰 관리

- 등록 토큰의 값을 이 문서에 기록하지 않으며 사용자에게 제출을 요구하지 않는다.
- 노출이 의심되면 즉시 삭제한다.
- 실제 외부 베타 전 불필요한 개발 토큰 정리를 검토한다.
- 이번 작업에서는 현재 등록 토큰을 변경하거나 삭제하지 않았다.

## H. 변경 금지 대상

- `be-a-r-33599`
- `codyssey-calendar`
- Firebase Hosting
- `origin/main`
- GitHub Pages
- `GEMINI_API_KEY` 값

## I. 장애 대응 원칙

- App Check enforcement를 임의로 끄지 않는다.
- 운영 장애 시 먼저 로그와 Firebase 상태를 확인한다.
- 보안 완화, rollback, 재배포는 사용자 명시 승인 후에만 수행한다.
- Secret 값을 출력하거나 복사하지 않는다.

## J. 다음 단계

- Stage 7 완료
- 다음 단계: Stage 7.4 반응형 구조·치명적 깨짐 전수 점검
- 이후: Stage 7.5-A 정보구조·동선 재설계, Stage 7.5-B 디자인 완성, Stage 7.5-C 모바일·태블릿·노트북 최적화
- Stage 8: EDU2G PASS 및 5인 클로즈드 베타
