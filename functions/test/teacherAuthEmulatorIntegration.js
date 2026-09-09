"use strict";
// Demo emulators only. Confirms verifyTeacherCode: wrong code rejected, no
// code-set-for-class rejected distinctly, correct code marks the actor as
// teacherVerified for that schoolId+grade+classNum, and checkTeacherStatus
// reflects it.
const assert = require("node:assert/strict"), http = require("node:http");
const { hashTeacherCode } = require("../lib/teacherCodeHash");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createCheckTeacherStatusHandler, createVerifyTeacherCodeHandler, teacherCodeDocId } = require("../lib/teacherAuth");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const ACTOR_ID = "teacher_auth_test_actor";
const SCHOOL_ID = "7321071";
const GRADE = "5", CLASS_NUM = "1";
const CODE = "sunrise-teachers-2026";
// 2026-09-09(Bumm님 결정): 반 코드와 **같이** 통해야 하는 담임 개인 코드.
const PERSONAL_CODE = "EDU2G SANGHYUN";
const NO_CODE_SCHOOL_ID = "9999999";

function signup() {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: authEmulator.hostname, port: authEmulator.port, path: "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let body = ""; res.on("data", (chunk) => (body += chunk)); res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end(JSON.stringify({ returnSecureToken: true }));
  });
}

function call(handler, token, body) {
  const out = { headers: {} };
  const res = { set(k, v) { out.headers[k] = v; return this; }, status(s) { out.status = s; return this; }, json(v) { out.body = v; return this; }, send(v) { out.body = v; return this; } };
  return handler({ method: "POST", headers: { origin: "http://localhost:5173", "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body }, res).then(() => out);
}

test("verifyTeacherCode: wrong code rejected, unset class rejected distinctly, correct code verifies and corrects a mis-bound school-lock, checkTeacherStatus reflects it", async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uid = "";
  try {
    const signed = await signup();
    const token = signed.idToken;
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    await db.collection("actors").doc(ACTOR_ID).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(ACTOR_ID).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174601" });
    await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId: ACTOR_ID, status: "active" });
    await db.collection("teacherCodes").doc(teacherCodeDocId(SCHOOL_ID, GRADE, CLASS_NUM)).set({ ...hashTeacherCode(CODE), extraCodes: [{ label: "박상현", ...hashTeacherCode(PERSONAL_CODE) }] });
    // school-lock 교정(3단계) 확인용 - 이 기기가 엉뚱한 학교로 이미 고정돼
    // 있었다고 가정한다.
    await db.collection("actors").doc(ACTOR_ID).set({ dashboardSchoolId: NO_CODE_SCHOOL_ID }, { merge: true });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const deps = { access, rateLimiter, actorRateLimiter, appCheck, db, serverTimestamp: () => FieldValue.serverTimestamp() };
    const checkStatus = createCheckTeacherStatusHandler(deps);
    const verify = createVerifyTeacherCodeHandler(deps);

    const before = await call(checkStatus, token, {});
    assert.equal(before.status, 200);
    assert.equal(before.body.verified, false);

    const noSuchClass = await call(verify, token, { schoolId: NO_CODE_SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: CODE });
    assert.equal(noSuchClass.status, 404);
    assert.equal(noSuchClass.body.code, "teacher_code_not_set");

    const wrongCode = await call(verify, token, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: "wrong-code-123" });
    assert.equal(wrongCode.status, 401);
    assert.equal(wrongCode.body.code, "invalid_code");
    const stillUnverified = await call(checkStatus, token, {});
    assert.equal(stillUnverified.body.verified, false, "a wrong attempt must not verify the actor");

    const correct = await call(verify, token, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: CODE });
    assert.equal(correct.status, 200);
    assert.equal(correct.body.verified, true);
    assert.equal(correct.body.schoolId, SCHOOL_ID);
    assert.equal(correct.body.grade, GRADE);
    assert.equal(correct.body.classNum, CLASS_NUM);
    const correctedLock = (await db.collection("actors").doc(ACTOR_ID).get()).data();
    assert.equal(correctedLock.dashboardSchoolId, SCHOOL_ID, "verifying corrects a mis-bound school-lock (3단계)");

    const after = await call(checkStatus, token, {});
    assert.equal(after.status, 200);
    assert.equal(after.body.verified, true);
    assert.equal(after.body.schoolId, SCHOOL_ID);
    assert.equal(after.body.grade, GRADE);
    assert.equal(after.body.classNum, CLASS_NUM);

    // 공존 - 반 코드로 들어간 뒤에도 담임 개인 코드가 그대로 통해야 한다.
    // 대체로 만들면 개인 코드에 문제가 생겼을 때 그 선생님이 들어갈 길이
    // 하나도 없어진다.
    //
    // 일부러 **띄어쓰기와 대소문자를 틀린 형태**로 보낸다 - 공존과 정규화를
    // 한 번에 확인하려는 것이다(호출을 더 늘리면 액터별 레이트리밋에 걸려
    // 뒤따르는 검사가 429로 죽는다 - 실제로 그렇게 됐었다). 정규화가
    // 안 되면 실패가 쌓여 **그 반 전체가 15분 잠긴다**.
    const personal = await call(verify, token, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: "  edu2g   sanghyun " });
    assert.equal(personal.status, 200, "개인 코드가 막혔다(공존 또는 정규화 실패)");
    assert.equal(personal.body.verified, true);

    const invalid = await call(verify, token, { schoolId: "", grade: GRADE, classNum: CLASS_NUM, code: CODE });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "invalid_request");

    process.stdout.write(JSON.stringify({ teacherAuthEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    const actorRoot = db.collection("actors").doc(ACTOR_ID);
    for (const name of ["trustedDevices"]) {
      const snap = await actorRoot.collection(name).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(actorRoot);
    batch.delete(db.collection("teacherCodes").doc(teacherCodeDocId(SCHOOL_ID, GRADE, CLASS_NUM)));
    await batch.commit();
  }
});
