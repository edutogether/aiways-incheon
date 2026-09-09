"use strict";
// Demo emulators only. teacherCodeStatus tells the admin screen whether a
// class already has a code, so the button can honestly say "발급" or "교체".
//
// 이 값이 틀리면 화면은 "발급"이라고 말하는데 실제로는 있던 코드가 교체되고,
// 그 반 선생님이 쓰던 코드가 조용히 죽는다. 그래서 **실제로 발급하기 전/후의
// 답이 갈리는지**를 본다 - 응답 모양만 보는 것이 아니라.
//
// 🔴 코드도 해시도 솔트도 돌려주지 않는다는 것까지 여기서 못박는다. 발급한
// 사람이 코드를 다시 볼 방법은 여전히 없어야 하고(그래서 규칙으로 파생시킨다),
// 이 조회 기능이 그 성질을 뚫는 구멍이 되면 안 된다.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createGlobalRateLimiter } = require("../lib/globalRateLimit");
const { createManageTeacherCodeHandler, createTeacherCodeStatusHandler } = require("../lib/superadmin");
const { teacherCodeDocId } = require("../lib/teacherAuth");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const SCHOOL_ID = "7361099";
const GRADE = "2", CLASS_NUM = "7";
const CODE = "status-probe-code-2026";
const EXTRA_CODE = "EDU2G STATUSPROBE";

function signup(payload = { returnSecureToken: true }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: authEmulator.hostname, port: authEmulator.port, path: "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let body = ""; res.on("data", (chunk) => (body += chunk)); res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end(JSON.stringify(payload));
  });
}

function refreshIdToken(refreshToken) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: authEmulator.hostname, port: authEmulator.port, path: "/securetoken.googleapis.com/v1/token?key=fake-api-key", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }, (res) => {
      let body = ""; res.on("data", (chunk) => (body += chunk)); res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end(`grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`);
  });
}

function call(handler, token, body) {
  const out = { headers: {} };
  const res = { set(k, v) { out.headers[k] = v; return this; }, status(s) { out.status = s; return this; }, json(v) { out.body = v; return this; }, send(v) { out.body = v; return this; } };
  return handler({ method: "POST", headers: { origin: "http://localhost:5173", "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body }, res).then(() => out);
}

test("teacherCodeStatus: refuses non-superadmins, flips from exists:false to exists:true once a code is issued, and never returns the code itself", async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uid = "";
  try {
    const signed = await signup({ email: `code-status-${Date.now()}@example.com`, password: "test-password-123", returnSecureToken: true });
    uid = signed.localId;
    const rateLimiter = createGlobalRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const deps = { db, rateLimiter, appCheck, verifyIdToken: (token) => auth.verifyIdToken(token), serverTimestamp: () => FieldValue.serverTimestamp() };
    const status = createTeacherCodeStatusHandler(deps);
    const manage = createManageTeacherCodeHandler(deps);
    const target = { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM };

    // 권한 없는 사람에게는 이 조회도 열리지 않는다. 어느 반에 코드가 있고
    // 없는지는 그 자체로 알려줄 이유가 없는 정보다.
    const noToken = await call(status, "", target);
    assert.equal(noToken.status, 401);
    assert.equal(noToken.body.code, "auth_missing");
    const forbidden = await call(status, signed.idToken, target);
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "superadmin_required", "a logged-in user without the claim must not read code status");

    await auth.setCustomUserClaims(uid, { role: "superadmin" });
    const superadminToken = (await refreshIdToken(signed.refreshToken)).id_token;

    // 발급 전에는 없다고 답해야 한다. 여기서 잘못 true가 나오면 버튼이
    // "교체"라고 말하는데 실제로는 처음 발급하는 것이 된다.
    await db.collection("teacherCodes").doc(teacherCodeDocId(SCHOOL_ID, GRADE, CLASS_NUM)).delete();
    const before = await call(status, superadminToken, target);
    assert.equal(before.status, 200);
    assert.equal(before.body.exists, false, "a class with no code must report exists:false");
    assert.equal(before.body.extraCount, 0);

    await call(manage, superadminToken, { ...target, code: CODE });
    const after = await call(status, superadminToken, target);
    assert.equal(after.body.exists, true, "after issuing, the same class must report exists:true");

    // 추가 코드 개수도 실제로 따라 움직여야 한다(한 반 3개 상한을 화면이 안내한다).
    await call(manage, superadminToken, { ...target, code: EXTRA_CODE, mode: "add", label: "상태확인" });
    const withExtra = await call(status, superadminToken, target);
    assert.equal(withExtra.body.extraCount, 1);
    assert.deepEqual(withExtra.body.extraLabels, ["상태확인"]);

    // 🔴 코드/해시/솔트가 응답에 절대 섞이지 않는다.
    const serialized = JSON.stringify(withExtra.body);
    for (const secret of ["codeHash", "codeSalt", CODE, EXTRA_CODE]) {
      assert.equal(serialized.includes(secret), false, `the status response must not carry ${secret}`);
    }

    // 잘못된 입력은 조용히 "없다"고 답하지 않는다 - 그러면 화면이 "발급"이라
    // 말하면서 엉뚱한 문서를 만들 수 있다.
    const bad = await call(status, superadminToken, { ...target, grade: "abc" });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, "invalid_request");
  } finally {
    await db.collection("teacherCodes").doc(teacherCodeDocId(SCHOOL_ID, GRADE, CLASS_NUM)).delete().catch(() => {});
    if (uid) await auth.deleteUser(uid).catch(() => {});
  }
  console.log(JSON.stringify({ teacherCodeStatusEmulatorIntegration: "passed" }));
});
