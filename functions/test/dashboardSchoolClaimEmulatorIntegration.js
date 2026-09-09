"use strict";

// 비용절감 4번(2026-09-02 대표님 승인, 실시간 리스너 마이그레이션) 1단계 검증.
// getSchoolDashboard가 school-lock을 처음 확정할 때 dashboardSchoolId 커스텀
// 클레임을 실제로 심는지, 그리고 firestore.rules가 그 클레임만으로 schools/
// {schoolId}(+classes 서브컬렉션)를 정확히 학교별로 격리해서 여닫는지를
// 실제 에뮬레이터(Auth+Firestore)로 끝까지 검증한다 - 부품 단위로는 확인이
// 안 되는 "클레임이 실제로 Firestore 보안규칙 판정에 반영되는지"까지 본다.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createGetSchoolDashboardHandler } = require("../lib/schoolDashboard");
const { createRegisterStudentProfileHandler } = require("../lib/studentProfile");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const firestoreBase = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents`;
const ACTOR_A = "dashboard_claim_test_actor_a";
const ACTOR_B = "dashboard_claim_test_actor_b";
const SCHOOL_A = "7321071";
const SCHOOL_OTHER = "7321072";

function signup() {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: authEmulator.hostname, port: authEmulator.port, path: "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let body = ""; res.on("data", (chunk) => (body += chunk)); res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end(JSON.stringify({ returnSecureToken: true }));
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

async function firestoreGet(path, token) {
  const res = await fetch(`${firestoreBase}/${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return res.status;
}

test("dashboardSchoolId custom claim is set on first school-lock and firestore.rules gates schools/{schoolId}(+classes) by it, PII students subcollection stays closed", async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uidA = "", uidB = "", uidC = "", teacherUid = "";
  try {
    const signedA = await signup(), signedB = await signup();
    uidA = (await auth.verifyIdToken(signedA.idToken)).uid;
    uidB = (await auth.verifyIdToken(signedB.idToken)).uid;

    async function bind(actorId, uid) {
      await db.collection("actors").doc(actorId).set({ status: "active", plan: "closed_beta" });
      await db.collection("actors").doc(actorId).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174811" });
      await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId, status: "active" });
    }
    await bind(ACTOR_A, uidA);
    await bind(ACTOR_B, uidB);
    await db.collection("schools").doc(SCHOOL_A).set({ schoolName: "테스트초등학교" });
    await db.collection("schools").doc(SCHOOL_A).collection("classes").doc("5_1").set({ grade: "5", classNum: "1", observedToday: 3, completedTotal: 3, heldTotal: 0, itemCounts: {} });
    await db.collection("schools").doc(SCHOOL_A).collection("classes").doc("5_1").collection("students").doc("9").set({ studentNumber: "9", studentName: "홍길동", completedTotal: 3 });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const dashboard = createGetSchoolDashboardHandler({ db, access, rateLimiter, actorRateLimiter, appCheck, auth, logger: () => {} });

    // 최초 호출로 school-lock을 확정 -- 이 시점에 dashboardSchoolId 클레임이 같이 심겨야 한다.
    const firstCall = await call(dashboard, signedA.idToken, { schoolId: SCHOOL_A });
    assert.equal(firstCall.status, 200);

    const beforeRefresh = await auth.getUser(uidA);
    assert.equal(beforeRefresh.customClaims?.dashboardSchoolId, SCHOOL_A, "claim must be set on first school-lock, readable via Admin SDK immediately");

    // 클라이언트는 토큰을 강제 갱신해야 새 클레임이 idToken에 실린다(설계안 명시).
    const refreshedA = await refreshIdToken(signedA.refreshToken);
    const tokenA = refreshedA.id_token;

    // rules: 같은 학교 클레임을 가진 토큰은 반 집계를 읽을 수 있다.
    assert.equal(await firestoreGet(`schools/${SCHOOL_A}`, tokenA), 200, "matching school claim must be able to read the school doc");
    assert.equal(await firestoreGet(`schools/${SCHOOL_A}/classes/5_1`, tokenA), 200, "matching school claim must be able to read class aggregates");

    // rules: PII가 들어간 students 서브컬렉션은 클레임이 맞아도 여전히 기본거부.
    assert.equal(await firestoreGet(`schools/${SCHOOL_A}/classes/5_1/students/9`, tokenA), 403, "students subcollection must stay closed even for a matching school claim");

    // rules: 다른 학교 클레임(또는 클레임 없음)은 거절돼야 한다.
    assert.equal(await firestoreGet(`schools/${SCHOOL_A}`, signedB.idToken), 403, "a token with no/other dashboardSchoolId claim must be denied");
    assert.equal(await firestoreGet(`schools/${SCHOOL_A}`), 403, "unauthenticated read must still be denied");

    // dashboardSchoolClaim.js는 "dashboardSchoolId가 정해지거나 바뀌는 모든
    // 지점에서 클레임도 같이 맞춘다"를 불변식으로 명시한다. 2026-09-07
    // 종합감사가 가입 승인 경로에서 이 호출이 빠진 것을 잡았는데,
    // 2026-09-09에 승인 대기열을 없애고 가입 즉시 등록으로 바꾸면서 그
    // 자리가 registerStudentProfile로 옮겨왔다 - 같은 불변식을 새 자리에서
    // 다시 확인한다. 잘못된 학교로 먼저 고정(+클레임까지 발급)된 기기가
    // 다른 학교로 가입하면, 문서만 새 학교로 바뀌고 클레임은 옛 학교로
    // 남아 그 옛 학교의 반 집계를 계속 실시간 구독으로 읽을 수 있다.
    // 클레임을 실제로 심으려면 actorId가 곧 uid여야 하므로(open_access
    // 프로비저닝과 동일) 이 시나리오만 actorId=uid로 만든다.
    const signedC = await signup();
    uidC = (await auth.verifyIdToken(signedC.idToken)).uid;
    await bind(uidC, uidC);
    await db.collection("actors").doc(uidC).set({ status: "active", plan: "closed_beta", dashboardSchoolId: SCHOOL_OTHER }, { merge: true });
    await auth.setCustomUserClaims(uidC, { dashboardSchoolId: SCHOOL_OTHER });

    const register = createRegisterStudentProfileHandler({ db, access, rateLimiter, actorRateLimiter, appCheck, auth, serverTimestamp: () => FieldValue.serverTimestamp(), logger: () => {}, searchSchool: async () => ({ ok: true, schoolName: "테스트초등학교" }) });
    const registered = await call(register, signedC.idToken, { schoolId: SCHOOL_A, schoolName: "테스트초등학교", grade: "5", classNum: "1", studentNumber: "21", name: "김철수", confirm: true });
    assert.equal(registered.status, 200, `가입이 성공해야 한다 (실제: ${JSON.stringify(registered.body)})`);
    const afterRegister = await auth.getUser(uidC);
    assert.equal(afterRegister.customClaims?.dashboardSchoolId, SCHOOL_A, "가입이 커스텀 클레임을 새 학교로 옮겨야 한다 - 옛 학교로 남으면 그 학교 집계를 계속 읽을 수 있다");

    process.stdout.write(JSON.stringify({ dashboardSchoolClaimEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const cleanupBatch = db.batch();
    if (uidC) {
      cleanupBatch.delete(db.collection("registrationRequests").doc(uidC));
      cleanupBatch.delete(db.collection("studentNumberClaims").doc(`${SCHOOL_A}_5_1_21`));
    }
    await cleanupBatch.commit();
    const batch = db.batch();
    for (const [actorId, uid] of [[ACTOR_A, uidA], [ACTOR_B, uidB], [uidC || "_none_c", uidC], [teacherUid || "_none_t", teacherUid]]) {
      if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
      const actorRoot = db.collection("actors").doc(actorId);
      const devices = await actorRoot.collection("trustedDevices").get();
      devices.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(actorRoot);
    }
    const classRef = db.collection("schools").doc(SCHOOL_A).collection("classes").doc("5_1");
    batch.delete(classRef.collection("students").doc("9"));
    batch.delete(classRef);
    batch.delete(db.collection("schools").doc(SCHOOL_A));
    await batch.commit();
  }
});
