"use strict";
// Demo emulators only. Confirms the approval queue itself: a teacher only
// sees/decides pending requests for their OWN schoolId (cross-school
// isolation), rejecting a request lets the student resubmit, deciding a
// request twice fails cleanly, and a non-teacher actor is refused outright.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createRegisterStudentProfileHandler, createCheckStudentProfileHandler } = require("../lib/studentProfile");
const { createListPendingRegistrationsHandler, createDecideRegistrationHandler } = require("../lib/registrationApproval");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const STUDENT_ACTOR_ID = "registration_approval_test_student";
const TEACHER_A_ID = "registration_approval_test_teacher_a";
const TEACHER_B_ID = "registration_approval_test_teacher_b";
const SCHOOL_A = "7321071";
const SCHOOL_B = "9999999";
const student = { schoolId: SCHOOL_A, schoolName: "테스트초등학교", grade: "5", classNum: "1", studentNumber: "12", name: "홍길동" };

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

(async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let studentUid = "", teacherAUid = "", teacherBUid = "";
  try {
    const studentSignup = await signup(), teacherASignup = await signup(), teacherBSignup = await signup();
    const studentToken = studentSignup.idToken, teacherAToken = teacherASignup.idToken, teacherBToken = teacherBSignup.idToken;
    studentUid = (await auth.verifyIdToken(studentToken)).uid;
    teacherAUid = (await auth.verifyIdToken(teacherAToken)).uid;
    teacherBUid = (await auth.verifyIdToken(teacherBToken)).uid;

    async function bind(actorId, uid) {
      await db.collection("actors").doc(actorId).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174611" });
      await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId, status: "active" });
    }
    await db.collection("actors").doc(STUDENT_ACTOR_ID).set({ status: "active", plan: "closed_beta", dashboardSchoolId: SCHOOL_B });
    await bind(STUDENT_ACTOR_ID, studentUid);
    await db.collection("actors").doc(TEACHER_A_ID).set({ status: "active", plan: "closed_beta", teacherVerified: { schoolId: SCHOOL_A } });
    await bind(TEACHER_A_ID, teacherAUid);
    await db.collection("actors").doc(TEACHER_B_ID).set({ status: "active", plan: "closed_beta", teacherVerified: { schoolId: SCHOOL_B } });
    await bind(TEACHER_B_ID, teacherBUid);

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const deps = { access, rateLimiter, actorRateLimiter, appCheck, db, serverTimestamp: () => FieldValue.serverTimestamp() };
    const register = createRegisterStudentProfileHandler(deps);
    const check = createCheckStudentProfileHandler(deps);
    const list = createListPendingRegistrationsHandler(deps);
    const decide = createDecideRegistrationHandler(deps);

    // 교사 인증 없이(teacherVerified 없는 학생 토큰으로) 대기열 접근 시도 -
    // 거절돼야 한다.
    const studentTriesList = await call(list, studentToken, {});
    assert.equal(studentTriesList.status, 403);
    assert.equal(studentTriesList.body.code, "teacher_verification_required");

    await call(register, studentToken, { ...student, confirm: true });

    // 학교B 교사에게는 이 요청이 아예 안 보인다(스쿨 격리).
    const teacherBList = await call(list, teacherBToken, {});
    assert.equal(teacherBList.status, 200);
    assert.deepEqual(teacherBList.body.requests, []);

    // 학교B 교사가 actorId를 알아내 직접 승인/거절을 시도해도 "없는 요청"처럼
    // 404로 막힌다(다른 학교 학생 정보가 새어나가는 신호조차 안 줌).
    const teacherBDecide = await call(decide, teacherBToken, { targetActorId: STUDENT_ACTOR_ID, decision: "approve" });
    assert.equal(teacherBDecide.status, 404);
    assert.equal(teacherBDecide.body.code, "request_not_found");

    const teacherAList = await call(list, teacherAToken, {});
    assert.equal(teacherAList.status, 200);
    assert.equal(teacherAList.body.requests.length, 1);
    assert.deepEqual(teacherAList.body.requests[0], { actorId: STUDENT_ACTOR_ID, ...student });

    // 거절 -> 학생이 다시 신청할 수 있어야 한다(재신청 허용).
    const rejected = await call(decide, teacherAToken, { targetActorId: STUDENT_ACTOR_ID, decision: "reject" });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.decision, "rejected");
    const afterReject = await call(check, studentToken, {});
    assert.equal(afterReject.body.pending, false);
    assert.equal(afterReject.body.rejected, true);

    const resubmit = await call(register, studentToken, { ...student, confirm: true });
    assert.equal(resubmit.status, 202, "a rejected request must be resubmittable, not permanently stuck");

    // 이번엔 승인 -> studentProfile이 실제로 생기고, 대기열에서 사라진다.
    const approved = await call(decide, teacherAToken, { targetActorId: STUDENT_ACTOR_ID, decision: "approve" });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.decision, "approved");
    const afterApprove = await call(check, studentToken, {});
    assert.equal(afterApprove.body.hasProfile, true);
    assert.deepEqual(afterApprove.body.profile, student);
    const emptyList = await call(list, teacherAToken, {});
    assert.deepEqual(emptyList.body.requests, []);
    const correctedLock = (await db.collection("actors").doc(STUDENT_ACTOR_ID).get()).data();
    assert.equal(correctedLock.dashboardSchoolId, SCHOOL_A, "approval corrects a mis-bound school-lock to the approved school (3단계)");

    // 이미 결정된 요청을 다시 결정하려 하면 깔끔히 실패한다.
    const redecide = await call(decide, teacherAToken, { targetActorId: STUDENT_ACTOR_ID, decision: "approve" });
    assert.equal(redecide.status, 404, "the request document is gone once approved, so this looks the same as not_found");

    process.stdout.write(JSON.stringify({ registrationApprovalEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    for (const [actorId, uid] of [[STUDENT_ACTOR_ID, studentUid], [TEACHER_A_ID, teacherAUid], [TEACHER_B_ID, teacherBUid]]) {
      if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
      const actorRoot = db.collection("actors").doc(actorId);
      const devices = await actorRoot.collection("trustedDevices").get();
      devices.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(actorRoot);
    }
    batch.delete(db.collection("registrationRequests").doc(STUDENT_ACTOR_ID));
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
