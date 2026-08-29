"use strict";

// 2026-08-29: firestore.rules는 클라이언트발 직접 read/write를 전부 막고
// 모든 접근이 Admin SDK를 쓰는 Cloud Functions를 거치게 강제한다
// (`allow read, write: if false`). 이 파일이 그 배선을 실제 에뮬레이터로
// 검증한다 - 규칙 문법 자체는 `firebase deploy`가 실패하면 걸러지지만,
// "누군가 실수로 규칙을 느슨하게 고쳐도 문법은 유효해서 배포는 성공하는"
// 경우까지는 못 잡는다. CI의 배포 게이트(rules 배포 전 테스트)로 쓴다.
const assert = require("node:assert/strict");
const projectId = "demo-aiways-incheon";
const base = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents`;

(async () => {
  const createResponse = await fetch(`${base}/rulesSmokeCheck`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { probe: { stringValue: "should-be-denied" } } })
  });
  assert.equal(createResponse.status, 403, "unauthenticated client write must be denied by firestore.rules");
  const createBody = await createResponse.json();
  assert.match(createBody?.error?.status || "", /PERMISSION_DENIED/);

  const readResponse = await fetch(`${base}/rulesSmokeCheck/anyDoc`, { method: "GET" });
  assert.equal(readResponse.status, 403, "unauthenticated client read must be denied by firestore.rules");

  process.stdout.write("Firestore rules emulator smoke checks passed\n");
})().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
