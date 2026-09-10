---
status: draft
등급: 2
작성자: aiways-incheon 세션 (팀장 지시, 2026-09-11)
작성 시각: 2026-09-11
---

# `miniapp/3second.html`을 전역 CSP만으로 통과하게 만든다 (인라인 스크립트 외부화 + tailwind CDN 제거)

🔴 **S5(PC 리액트 전환)가 끝난 뒤에 한다. 지금 하지 않는다.**

## 문제

2026-09-11에 이 파일을 되살리면서(`a3d3d0c`) **그 경로에만 다른 CSP를 주는 방식**을
썼다 — `firebase.json`의 `source: "/miniapp/**"`에 `script-src 'self' 'sha256-…'
https://cdn.tailwindcss.com`. 전역 CSP는 한 글자도 안 넓혔고 `'unsafe-inline'`·
`'unsafe-hashes'`도 안 썼으므로 **지금 상태가 위험한 것은 아니다.**

다만 두 가지가 남는다:

1. **`cdn.tailwindcss.com`이 그 경로에서 열려 있다.** 제3자 CDN이 스크립트를 주는
   구조라, 그쪽이 침해되면 이 경로가 통로가 된다. 게다가 tailwind play CDN은
   **프로덕션용이 아니다** — 브라우저 콘솔이 매번 그렇게 경고한다.
2. **인라인 `<script>`가 해시로 허용된다.** 파일을 고칠 때마다 해시가 바뀌므로
   `firebase.json`을 같이 고쳐야 한다. `scripts/checkMiniappCsp.js`가 잊으면
   배포를 멈춰 주지만, **손이 한 번 더 가는 구조인 것은 사실**이다.

## 원하는 결과

`miniapp/3second.html`이 **전역 CSP(`source:"**"`)만으로 그대로 동작한다.**
`firebase.json`에서 `/miniapp/**` 항목을 통째로 지워도 버튼이 다 먹고 화면이 같다.

구체적으로:
- 인라인 `<script>`를 외부 `.js`로 뺀다 → `'self'`로 통과하므로 해시가 필요 없어진다.
- tailwind CDN 의존을 없앤다 → `script-src`에 CDN을 열 필요가 없어진다.
- 그 결과 `checkMiniappCsp.js`의 miniapp 대상 검사도 필요 없어진다(`index.html`
  부트 스플래시 검사는 남는다 — 그건 여전히 해시로 허용되는 자리다).

## 영향받는 사용자·시스템

- **실사용자 영향 있음.** `index.html:582`의 "7차시 · Vibe Coding 체험하기" 카드에서
  학생·교사가 여는 화면이다. 🔴 다만 **학생 QR 동선의 종착점은 아니다** — QR은
  `https://incheon.edutogether.kr/mobile/index.html`(학생 앱)을 가리킨다(2026-09-11에
  PNG를 디코드해 확인).
- `firebase.json` · `scripts/checkMiniappCsp.js` · `functions/test/miniappInjectionContract.test.js`가
  같이 움직인다.

## 제약

- 🔴 **화면 모양과 동작이 달라지면 안 된다.** 이 파일은 tailwind 유틸리티 클래스로
  화면 전체가 짜여 있어, CDN을 걷어내는 순간 **스타일을 다시 만들어야 하고 거기서
  화면이 미세하게 달라질 위험이 크다.** `app.md`의 "`mobile/tailwind.generated.css`를
  다시 만들지 않는다"가 경고하는 것과 같은 함정이다(purge 범위·버전 차이로 달라지는데
  발견이 어렵다).
- **인라인 이벤트 핸들러를 되살리지 않는다.** 2026-09-11에 21개를 전부
  `addEventListener`로 옮겼고 `miniappInjectionContract.test.js`가 지킨다.
- **전역 CSP를 넓히지 않는다.** 이 작업의 목적이 그 반대다.
- **S5와 섞지 않는다.**

## 선택지 — 🔴 세션이 고르지 않는다

tailwind를 걷어내는 방법이 갈리고, 셋 다 화면이 달라질 위험의 크기가 다르다.

| | 무엇 | 화면이 달라질 위험 | 비고 |
|---|---|---|---|
| **A** | tailwind CLI로 이 파일 전용 CSS를 **빌드해서** 정적 파일로 넣는다 | 낮음~중간 — 같은 tailwind가 같은 클래스를 만들지만 **버전·purge 범위가 다르면 미세하게 달라진다** | 빌드 단계가 하나 늘어난다. `mobile-app`처럼 자기 package.json이 필요해질 수 있다 |
| **B** | 쓰이는 클래스만 **손으로 추려** 정적 CSS로 옮긴다 | 높음 — 빠뜨린 클래스가 화면에서 바로 티가 난다 | 빌드 단계가 안 는다. 대신 이후 클래스를 추가할 때마다 손이 간다 |
| **C** | tailwind를 아예 안 쓰고 이 화면의 CSS를 새로 쓴다 | 가장 높음 | 사실상 재작성 |

**인라인 `<script>` 외부화는 셋과 무관하게 먼저 할 수 있고, 화면이 달라질 위험이
없다**(같은 코드가 파일만 옮겨간다). 🔴 **그것만 먼저 하고 tailwind는 따로 두는
것도 선택지**이며, 그러면 `script-src`에서 해시는 빠지고 CDN만 남는다.

## 미결 질문

- **A/B/C 중 무엇으로 갈 것인가?** 셋 다 화면이 달라질 수 있어 Bumm님이 정하실 일이다.
- **인라인 스크립트 외부화만 먼저 하고 tailwind는 나중에 둘 것인가?** 위험 크기가
  달라서 나눌 수 있다.
- **애초에 이 작업을 할 것인가?** 지금 상태(경로 한정 CSP + 게이트)로도 안전하고
  동작한다. **"더 깨끗하게"가 화면을 흔들 값어치가 있는지**는 제품 판단이다.
