# Stage 8-A EDU2G PASS·신뢰 기기 기반

## 기준과 범위

- 시작 branch / HEAD: `feature/final-browser-qa-stage7-5-c` / `d096f4baebfd7c7ec792644894c5566adba2417a`
- 작업 branch: `feature/edu2g-pass-foundation-stage8-a`
- 런타임: Node.js 22
- 이번 단계는 emulator·합성 PASS만 사용하며 production Authentication, Secret, Functions, Rules, Hosting을 변경하거나 배포하지 않는다.

Stage 8은 다음으로 분리한다.

1. 8-A: PASS registry·익명 Auth 기기 세션·신뢰 기기 backend 기반
2. 8-B: EDU2G PASS 입력과 신뢰 기기 관리 UI
3. 8-C: 기존 기록 Functions의 actor resolver 연결
4. 8-D: Console 설정, 실제 Secret 등록, 제한된 배포와 운영 검증

## 식별·인증 원칙

Firebase Anonymous Auth의 UID는 브라우저별 **기기 세션**이다. UID는 actorId가 아니며, 서버가 `edu2gDeviceBindings/{uid}`와 actor의 `trustedDevices/{uid}`를 모두 active로 확인할 때만 actorId를 해석한다. 클라이언트는 actorId를 제출하거나 선택하지 않는다.

App Check는 요청이 승인된 앱에서 왔는지를, Firebase ID token은 익명 기기 세션을, 신뢰 기기 binding은 EDU2G beta 권한을 확인한다. 셋은 서로 대체하지 않는다. 익명 로그인만으로는 권한이 생기지 않는다.

`firebaseBetaAuth.js`는 기존 App Check Firebase app을 재사용하고, Auth SDK를 지연 import하여 browser local persistence의 익명 세션과 보호 header를 제공한다. Auth Emulator 연결은 `localhost`/`127.0.0.1`의 명시적 `auth-emulator=1` query에서만 가능하다. production에서 emulator 연결 경로는 없다.

## Secret registry

Secret 이름은 `EDU2G_PASS_REGISTRY_JSON`이며 registry schema는 version 1과 PASS 배열이다. 각 PASS는 내부 actorId, 표시 이름, enabled, 정확히 5인 maxDevices를 가진다.

- 실제 PASS는 저장소, 테스트, 로그, 응답, Firestore에 존재하지 않는다.
- Secret이 비어 있거나 JSON/schema가 잘못되면 `invalid_pass`로 fail closed 한다.
- 비교 전 PASS는 NFKC normalize, trim, 연속 공백 축소, 대문자화한다.
- 최대 길이, 중복 normalized PASS, 중복 actorId, actorId 형식, 표시 이름 제어문자, maxDevices 오류를 거부한다.
- 비교는 일정 시간 비교를 사용하며 PASS나 해시를 기록하지 않는다.

## Firestore 구조와 5대 제한

```
actors/{actorId}
  plan: closed_beta, status: active, displayName, maxDevices: 5,
  activeDeviceCount, createdAt, updatedAt

actors/{actorId}/trustedDevices/{uid}
  uid, status, deviceLabel, platform, createdAt, lastSeenAt,
  revokedAt, revokedByUid

edu2gDeviceBindings/{uid}
  actorId, status, createdAt, lastSeenAt, revokedAt
```

redeem은 Firestore transaction에서 binding, actor, device를 읽어 같은 actor/active 기기의 재등록은 idempotent 성공으로 처리한다. 다른 actor binding은 차단하고, activeDeviceCount가 5이면 여섯 번째 등록을 거부한다. 새 binding·trusted device·counter 증가는 같은 transaction에서 수행한다.

PASS, ID token, App Check token, 이메일, 전화번호, 실명, 학교명, browser fingerprint, IP 원문, 전체 user-agent는 저장하지 않는다. deviceLabel/platform은 제어문자·HTML·과도한 길이가 없는 짧은 표시값만 허용한다.

## Endpoint 계약

네 endpoint 모두 asia-northeast3, Node.js 22, 256MiB, timeout 15초, min 0/max 2/concurrency 5, 제한 CORS, App Check, 익명 Firebase ID token, rate limit을 사용한다.

- `redeemEdu2gPass`: 합성/실제 PASS와 기기 표시값을 받아 binding을 transaction으로 등록한다. 실제 registry Secret 선언은 이 endpoint에만 있다.
- `getEdu2gSession`: 등록된 현재 기기의 displayName, plan, deviceLabel, activeDeviceCount, maxDevices, status만 반환한다.
- `listEdu2gTrustedDevices`: 현재 actor의 안전한 축약 device key, 표시값, platform, 상태, 시간, 현재 기기 여부만 반환한다.
- `revokeEdu2gTrustedDevice`: 현재 actor 소속 target과 `confirm: true`에 한해 transaction으로 device/binding을 함께 revoke하고 count를 감소시킨다. 타 actor target은 not_found처럼 처리한다.

missing/invalid App Check와 missing/invalid ID token은 보호 계층에서 막히며, 기기 미등록·revoke는 403, 보호 계층 불가/손상 상태는 503으로 fail closed 한다. redeem은 더 엄격한 별도 rate-limit 이름을 사용하고 invalid PASS는 한 응답으로 통일한다.

## Emulator 검증

`firebase.json`에는 Auth Emulator 9099만 추가했다. Functions/Firestore 기존 port와 demo project 설정은 보존했다. `demo-aiways-incheon` emulator에서 익명 signup과 새 endpoint의 App Check missing 401 gate를 검증했다. production Auth 사용자·Firestore·Secret·Function에는 접근하지 않았다.

단위 테스트는 registry parsing/normalization, auth resolver fail-closed, 등록·재등록, 1~5/여섯 번째 제한, actor 재바인딩 차단, 목록·revoke, OPTIONS/CORS/body/rate-limit, frontend Auth 계약을 다룬다.

## 아직 하지 않은 작업

- Firebase Console Anonymous provider 활성화
- 실제 `EDU2G_PASS_REGISTRY_JSON` Secret 등록
- 실제 PASS 배포 또는 UI 입력
- 기존 `analyzeSortingImage`, `saveSortingRecord`, `listSortingRecords`, `resolveSortingRecord`에 actor resolver 강제 연결
- Functions/Hosting/GitHub Pages 배포, Firestore Rules 변경, main 변경

Firebase, Rules, Hosting, main, GitHub Pages는 이번 단계에서 변경되지 않았다.
