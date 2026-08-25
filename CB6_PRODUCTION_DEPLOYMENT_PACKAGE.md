# CB-6 프로덕션 배포 준비 패키지

`CB6_PRODUCTION_DEPLOYMENT = WAITING_USER_APPROVAL`

이 문서는 배포 승인 뒤에만 사용하는 실행 계약이다. 이번 감사에서는 프로덕션 Firebase, GitHub Pages, 비밀 값, 실제 사용자 데이터에 변경을 수행하지 않았다.

## 배포 대상

- Firebase 프로젝트: `ai-ways-incheon` (프로젝트 번호 `367235994253`)
- Functions 리전: `asia-northeast3`
- 런타임: Node.js `22`
- Functions: 이 목록은 2026-08 초 기준이라 낡았다 — 2026-08-19~25 백엔드 재설계로 함수가 8개에서 18개로 늘었다(`analyzeSortingText`, `onSortingRecordWritten`, `getSchoolDashboard`, `checkStudentProfile`, `registerStudentProfile`, `checkCampusLocation`, `changeStudentClass`, `getNationalRanking`, `searchSchool` 신규 추가, 2026-08-26 확인). 실제 배포 대상 함수 목록은 항상 `functions/index.js`의 `exports.*`를 기준으로 삼을 것 — 아래 배포 명령의 `--only functions:...` 목록도 그 기준으로 갱신 필요.
- Firestore Rules: `firestore.rules` — 클라이언트 직접 접근 전면 거부, Functions Admin SDK만 사용
- Firestore 복합 인덱스: `records` 컬렉션 범위의 `status ASC`, `createdAt DESC`
- 정적 웹 출처: `https://edutogether.github.io`
- 필요 Secret 이름: `GEMINI_API_KEY`, `EDU2G_PASS_REGISTRY_JSON`

## 승인 전 필수 확인 및 중지 조건

다음 중 하나라도 확인되지 않으면 배포를 중지한다.

1. Firebase Console에서 `ai-ways-incheon` 프로젝트·번호·결제·필수 API가 일치하고, Cloud Functions (2nd gen), Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Firestore, Firebase Authentication, reCAPTCHA Enterprise 사용 가능 상태인지 확인한다.
2. Firebase Authentication에서 익명 로그인 제공자가 활성화되어 있고 `edutogether.github.io`가 승인된 도메인인지 확인한다.
3. Firebase App Check에서 웹 앱 ID `1:367235994253:web:9f4b82ca9d8e5a1ca0c8c4`, reCAPTCHA Enterprise 제공자, Cloud Functions 보호 상태가 운영 정책과 일치하는지 확인한다. 서버는 모든 보호 함수에서 App Check 토큰을 직접 검증하므로 누락·무효 토큰은 통과하면 안 된다.
4. `GEMINI_API_KEY`와 `EDU2G_PASS_REGISTRY_JSON`은 이름과 사용 가능한 활성 버전만 확인한다. 값, 인증 토큰은 표시·기록·교체하지 않는다. 두 번째 Secret은 비밀번호·초대 코드·PASS 저장소가 아니라 승인된 참가자 레지스트리다. `version: 2`, `participants` 배열, 각 참가자의 `actorId`, `loginId`, 익명화된 `displayName`, `enabled`, `maxDevices: 5`를 사용하며 선택적 `aliases`도 같은 정규화·중복 금지 규칙을 따른다. 입력은 NFKC 정규화 후 앞뒤 공백을 제거하고 연속 공백을 하나로 합친 뒤 영문 대소문자를 구분하지 않는다.
5. Firestore 데이터베이스가 존재하고 `records(status ASC, createdAt DESC)` 인덱스가 `READY`가 될 때까지 다음 단계로 진행하지 않는다.
6. GitHub Pages가 정적 파일을 `https://edutogether.github.io`로 제공하며, 로컬 전용 `auth-emulator=1`, `appcheck-debug=1`, `visual-review=1` 경로가 운영 URL에 포함되지 않는지 확인한다.

## 승인 후 배포 순서

1. 승인된 커밋에서 깨끗한 작업 트리를 확인한다.
2. Rules와 인덱스를 먼저 배포한다.

   ```powershell
   firebase deploy --project ai-ways-incheon --only firestore:rules,firestore:indexes
   ```

3. `records(status ASC, createdAt DESC)` 인덱스가 `READY`인 것을 확인한다. 인덱스 빌드 중에는 상태 필터 조회를 포함한 클로즈드 베타 시작을 하지 않는다.
4. 명시한 함수만 배포한다. **아래 목록은 2026-08 초 기준으로 낡았다(위 "배포 대상" 절 참고) — 실행 전 `functions/index.js`의 `exports.*` 전체와 대조해 갱신할 것.**

   ```powershell
   firebase deploy --project ai-ways-incheon --only functions:analyzeSortingImage,functions:saveSortingRecord,functions:listSortingRecords,functions:resolveSortingRecord,functions:redeemEdu2gPass,functions:getEdu2gSession,functions:listEdu2gTrustedDevices,functions:revokeEdu2gTrustedDevice
   ```

5. 기존 승인 절차로 정적 GitHub Pages를 게시한다. Firebase Hosting 배포는 이 계약의 대상이 아니다.

## 승인 후 스모크 및 클로즈드 베타 시작 기준

1. `https://edutogether.github.io`에서 HTTPS, CORS, App Check, 익명 로그인, 보호 함수 리전을 확인한다.
2. 사전 승인된 actor 한 명의 첫 기기에서 PASS 등록, 세션 조회, 기기 목록, 분석, 기록 저장, `completed`·`held` 상태 필터 조회, 보류 기록 해결을 확인한다.
3. actor 5명 각각에 활성 기기 5대를 등록해 총 25대를 확인하고, 각 actor의 여섯 번째 등록이 `device_limit_reached`로 차단되는지 확인한다.
4. 각 actor에서 기기 하나를 해제하고 대체 기기 하나를 등록한다. 해제된 기기는 `device_revoked`로 차단되고 활성 수가 다시 5인지 확인한다.
5. Functions 로그에서 App Check 누락·무효, 인증, 기기, 제한, 5xx 오류를 확인한다. PASS·토큰·이미지 원문·Secret 값은 로그에 남기지 않는다.

## 롤백 기준과 절차

다음은 즉시 롤백 조건이다: App Check 또는 익명 인증 실패, CORS 출처 불일치, 인덱스 미준비, `device_limit_reached` 또는 해제 후 대체 등록 계약 불일치, 기록 상태 필터/해결 실패, 연속된 보호 함수 5xx 오류.

1. 신규 클로즈드 베타 참여와 정적 웹 릴리스를 중지한다.
2. 마지막 검증 완료 커밋의 같은 함수 이름만 다시 배포한다. 함수 삭제, 사용자·기기·기록 데이터 삭제, Secret 삭제·값 변경은 롤백 수단으로 사용하지 않는다.
3. Rules 또는 인덱스가 원인인 경우, 검증된 이전의 추적된 정의만 검토 후 재배포한다. 인덱스 상태가 `READY`일 때까지 스모크를 재개하지 않는다.
4. 롤백 뒤에는 한 actor·한 기기 스모크와 해제 기기 차단을 다시 확인한 뒤에만 재개 결정을 한다.
