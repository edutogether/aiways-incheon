"use strict";
// Demo emulators only. 2026-09-07 종합감사 - 교사코드는 반당 1개를 여러
// 교사가 공유하는 구조라 유출되면 그 반 전체 실명+번호 CSV/가입승인/
// 익명화 권한이 통째로 넘어간다. 방어가 "느린 해시 + 전역 분당 상한"뿐
// 이었고, registerStudentProfile(role:"homeroom")이 이 로직을 재사용하는
// 경로는 그 전역 상한이 학생 가입 트래픽 때문에 넉넉해서 사실상 교사코드
// 시도 상한도 같이 넓어져 있었다 - 반 단위 실패 잠금이 이 문제를 근본적으로
// 닫는지 확인한다.
//
// 각 시도를 서로 다른 익명 계정(actorId)으로 보낸다 - 실제 무차별 대입
// 공격자도 액터별 리밋(verifyTeacherCode 5/분)을 우회하려고 매번 새
// 익명 계정을 만들 것이므로, 이게 "반 단위 잠금이 실제로 막아야 하는"
// 정확한 시나리오다(같은 액터로 반복하면 액터별 리밋에 먼저 걸려 반
// 단위 잠금 자체를 검증할 수 없다 - 처음 이 테스트를 그렇게 짰다가
// 5번째에 rate_limit_exceeded로 잘못 걸리는 걸 직접 겪었다).
const assert = require("node:assert/strict"), http = require("node:http");
const { hashTeacherCode } = require("../lib/teacherCodeHash");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createVerifyTeacherCodeHandler, teacherCodeDocId } = require("../lib/teacherAuth");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const SCHOOL_ID = "7361064";
const GRADE = "6", CLASS_NUM = "3";
const CODE = "lockout-test-code-2026";
const ACTOR_PREFIX = "teacher_lockout_test_actor_";

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

test("verifyTeacherCode: 10 wrong attempts from different actors lock the class, correct code is rejected while locked, unlocks after the window, success resets the counter", async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const uids = [];
  const actorIds = [];
  let clock = new Date("2026-09-07T00:00:00.000Z");
  try {
    async function newActor(index) {
      const actorId = `${ACTOR_PREFIX}${index}`;
      const signed = await signup();
      const token = signed.idToken;
      const uid = (await auth.verifyIdToken(token)).uid;
      await db.collection("actors").doc(actorId).set({ status: "active", plan: "closed_beta" });
      await db.collection("actors").doc(actorId).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: `123e4567-e89b-42d3-a456-42661417${String(4700 + index).padStart(4, "0")}` });
      await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId, status: "active" });
      uids.push(uid); actorIds.push(actorId);
      return token;
    }

    await db.collection("teacherCodes").doc(teacherCodeDocId(SCHOOL_ID, GRADE, CLASS_NUM)).set(hashTeacherCode(CODE));

    // 전역/액터별 레이트리밋(verifyTeacherCode: 전역 10/분, 액터별 5/분)이
    // 이 테스트의 목적(반 단위 잠금)과 별개로 걸리지 않게, 같은 가짜
    // 시계를 공유시키고 시도마다 분 경계 밖으로 시간을 흘려보낸다 -
    // 실제로는 서로 다른 액터가 서로 다른 시각에 시도하는 것과 같다.
    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db, now: () => clock });
    const actorRateLimiter = createActorRateLimiter({ db, now: () => clock });
    const appCheck = async () => ({ status: "valid" });
    const verify = createVerifyTeacherCodeHandler({ access, rateLimiter, actorRateLimiter, appCheck, db, serverTimestamp: () => FieldValue.serverTimestamp(), now: () => clock });

    // 9번의 서로 다른 액터가 각각 한 번씩 틀려도 아직 잠기지 않는다(threshold=10).
    for (let i = 0; i < 9; i += 1) {
      const token = await newActor(i);
      const attempt = await call(verify, token, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: "wrong-code" });
      assert.equal(attempt.status, 401, `attempt ${i + 1} should still be a normal rejection`);
      assert.equal(attempt.body.code, "invalid_code");
      clock = new Date(clock.getTime() + 61 * 1000);
    }

    // 10번째(또 다른 액터)의 실패로 잠금 임계값에 도달한다(이 응답 자체는 여전히 invalid_code).
    const tenthToken = await newActor(9);
    const tenth = await call(verify, tenthToken, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: "wrong-code" });
    assert.equal(tenth.status, 401);
    assert.equal(tenth.body.code, "invalid_code");
    clock = new Date(clock.getTime() + 61 * 1000);

    // 이제 (또 다른 액터가) 맞는 코드를 넣어도 잠겨서 429 - 여러 익명
    // 계정으로 우회해도 반 단위 잠금은 뚫리지 않는지 확인.
    const lockedToken = await newActor(10);
    const lockedEvenWithCorrectCode = await call(verify, lockedToken, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: CODE });
    assert.equal(lockedEvenWithCorrectCode.status, 429);
    assert.equal(lockedEvenWithCorrectCode.body.code, "teacher_code_locked");
    assert.ok(Number(lockedEvenWithCorrectCode.body.retryAfterSeconds) > 0);
    assert.equal(lockedEvenWithCorrectCode.headers["Retry-After"], String(lockedEvenWithCorrectCode.body.retryAfterSeconds));

    // 잠금 시간이 지나면 다시 시도할 수 있다.
    clock = new Date(clock.getTime() + 15 * 60 * 1000 + 1000);
    const unlockToken = await newActor(11);
    const afterUnlock = await call(verify, unlockToken, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: CODE });
    assert.equal(afterUnlock.status, 200);
    assert.equal(afterUnlock.body.verified, true);

    // 성공했으니 카운터가 리셋돼서, 다시 실패해도(또 다른 액터) 곧바로 잠기지 않는다.
    const attemptRef = db.collection("teacherCodeAttempts").doc(teacherCodeDocId(SCHOOL_ID, GRADE, CLASS_NUM));
    assert.equal((await attemptRef.get()).exists, false, "a successful verification must clear the failure counter");
    const resetToken = await newActor(12);
    const afterReset = await call(verify, resetToken, { schoolId: SCHOOL_ID, grade: GRADE, classNum: CLASS_NUM, code: "wrong-again" });
    assert.equal(afterReset.status, 401);
    assert.equal(afterReset.body.code, "invalid_code", "one failure right after a reset must not still be locked");

    process.stdout.write(JSON.stringify({ teacherCodeLockoutEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    for (let i = 0; i < uids.length; i += 1) {
      batch.delete(db.collection("edu2gDeviceBindings").doc(uids[i]));
      const actorRoot = db.collection("actors").doc(actorIds[i]);
      const devices = await actorRoot.collection("trustedDevices").get();
      devices.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(actorRoot);
    }
    batch.delete(db.collection("teacherCodes").doc(teacherCodeDocId(SCHOOL_ID, GRADE, CLASS_NUM)));
    batch.delete(db.collection("teacherCodeAttempts").doc(teacherCodeDocId(SCHOOL_ID, GRADE, CLASS_NUM)));
    await batch.commit();
  }
});
