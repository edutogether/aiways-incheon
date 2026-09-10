"use strict";
const assert = require("node:assert/strict");
const { cleanText, isAllowedOrigin, applyCors } = require("../lib/httpGuard");

test("cleanText trims, rejects control chars/angle brackets, and enforces max length", () => {
  assert.equal(cleanText("  hi  "), "hi");
  assert.equal(cleanText("<script>"), "");
  assert.equal(cleanText("a\x01b"), "");
  assert.equal(cleanText("a".repeat(80)), "a".repeat(80));
  assert.equal(cleanText("a".repeat(81)), "");
  assert.equal(cleanText("a".repeat(200), 200), "a".repeat(200));
  assert.equal(cleanText(""), "");
  assert.equal(cleanText(undefined), "");
});

test("isAllowedOrigin accepts the production origins and localhost dev ports only", () => {
  assert.equal(isAllowedOrigin("https://edutogether.github.io"), true);
  // 2026-09-09에 끊었다가 2026-09-10에 되살렸다(Bumm님 판단) - 정식 주소가
  // 막혔을 때 들어갈 길이 하나도 없으면 안 된다. **두 주소 모두 통해야 한다.**
  assert.equal(isAllowedOrigin("https://ai-ways-incheon.web.app"), true);
  assert.equal(isAllowedOrigin("https://ai-ways-incheon.firebaseapp.com"), true);
  assert.equal(isAllowedOrigin("https://edutogether.kr"), true);
  // 2026-09-09에 연결된 이 앱의 정식 주소.
  assert.equal(isAllowedOrigin("https://incheon.edutogether.kr"), true);
  // 한때 aiways.edutogether.kr로 잡았다가 incheon으로 확정됐다 - 그 이름은
  // DNS에 없으므로 허용 목록에 남아 있으면 안 된다.
  assert.equal(isAllowedOrigin("https://aiways.edutogether.kr"), false);
  // 서브도메인이라고 아무거나 통과하면 안 된다.
  assert.equal(isAllowedOrigin("https://evil.edutogether.kr"), false);
  assert.equal(isAllowedOrigin("http://localhost:5173"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:8080"), true);
  assert.equal(isAllowedOrigin("https://evil.example.com"), false);
  assert.equal(isAllowedOrigin("http://edutogether.github.io"), false);
  // 허용은 **목록에 있는 것만**이다(COMMON_STANDARDS §21-5 - 배제 방식이 아니라
  // 허용 목록 방식). 허용된 주소를 앞에 붙이거나 뒤에 이어붙인 것도 통하면 안 된다.
  assert.equal(isAllowedOrigin("https://ai-ways-incheon.web.app.evil.com"), false);
  assert.equal(isAllowedOrigin("https://evil-ai-ways-incheon.web.app"), false);
  assert.equal(isAllowedOrigin("https://incheon.edutogether.kr.evil.com"), false);
  assert.equal(isAllowedOrigin("https://example.com"), false);
  assert.equal(isAllowedOrigin(""), false);
});

test("isAllowedOrigin accepts this project's Hosting preview channels but nothing else shaped like one", () => {
  // 2026-09-11: S5 전환본을 라이브와 같은 조건에서 확인하려고 연 프리뷰 채널.
  // 🔴 S5 확인이 끝나고 채널이 만료되면 이 테스트와 lib 쪽 정규식을 같이 뺀다.
  //
  // **통해야 하는 것** - 실제로 발급된 주소와 같은 형태.
  assert.equal(isAllowedOrigin("https://ai-ways-incheon--pc-s5-review-5qopjkzi.web.app"), true);
  assert.equal(isAllowedOrigin("https://ai-ways-incheon--another-channel-ab12cd34.web.app"), true);

  // **막혀야 하는 것** - 여기가 이 테스트의 존재 이유다. 정규식을 넓게 고치면
  // 아래가 깨져서 알려준다.
  //
  // 프로젝트 이름이 다르다(`--`만 보고 통과시키면 이게 뚫린다).
  assert.equal(isAllowedOrigin("https://evil--pc.web.app"), false);
  assert.equal(isAllowedOrigin("https://evil-ai-ways-incheon--x.web.app"), false);
  // 다른 프로젝트의 채널.
  assert.equal(isAllowedOrigin("https://other-project--pc-s5-review.web.app"), false);
  // 뒤에 이어붙였다(끝을 $로 막지 않으면 뚫린다).
  assert.equal(isAllowedOrigin("https://ai-ways-incheon--pc.web.app.evil.com"), false);
  // 앞에 붙였다.
  assert.equal(isAllowedOrigin("https://evil.ai-ways-incheon--pc.web.app"), false);
  // https가 아니다.
  assert.equal(isAllowedOrigin("http://ai-ways-incheon--pc.web.app"), false);
  // 채널 이름 자리가 비어 있다(`+`가 `*`로 바뀌면 뚫린다).
  assert.equal(isAllowedOrigin("https://ai-ways-incheon--.web.app"), false);
  // web.app이 아닌 다른 TLD.
  assert.equal(isAllowedOrigin("https://ai-ways-incheon--pc.web.app.co"), false);
  assert.equal(isAllowedOrigin("https://ai-ways-incheon--pc.firebaseapp.com"), false);
  // 채널 이름에 점을 넣어 도메인을 하나 더 파고드는 것.
  assert.equal(isAllowedOrigin("https://ai-ways-incheon--a.evil.web.app"), false);
});

function fakeRes() {
  const headers = {};
  return { headers, set(key, value) { headers[key] = value; } };
}

test("applyCors sets headers for an allowed origin and returns true", () => {
  const res = fakeRes();
  const ok = applyCors({ headers: { origin: "https://edutogether.github.io" } }, res);
  assert.equal(ok, true);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://edutogether.github.io");
  assert.equal(res.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
});

test("applyCors rejects a disallowed origin without setting headers", () => {
  const res = fakeRes();
  const ok = applyCors({ headers: { origin: "https://evil.example.com" } }, res);
  assert.equal(ok, false);
  assert.deepEqual(res.headers, {});
});

test("applyCors allows requests with no Origin header at all (non-browser callers)", () => {
  const res = fakeRes();
  const ok = applyCors({ headers: {} }, res);
  assert.equal(ok, true);
  assert.deepEqual(res.headers, {});
});
