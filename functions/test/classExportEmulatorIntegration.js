"use strict";
// Demo emulators only. Confirms exportClassRecords: teacherVerified is
// required, results are scoped to the teacher's own school+grade+classNum
// (a record from a different class or a different school never leaks in),
// and rows carry the per-student fields a CSV export actually needs.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createExportClassRecordsHandler } = require("../lib/classExport");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const SCHOOL_A = "7321071";
const SCHOOL_B = "9999999";
const TEACHER_ACTOR_ID = "class_export_test_teacher";
const STUDENT_ACTOR_IDS = ["class_export_test_student_1", "class_export_test_student_2", "class_export_test_student_other_class", "class_export_test_student_other_school"];

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

function record(schoolId, grade, classNum, studentNumber, studentName, createdAtMs) {
  return {
    schemaVersion: "sorting-record-v1", status: "completed", provider: "manual_select",
    userDecision: { selectedItemId: "pet-bottle", action: "recorded", userConfirmed: true },
    classContext: { schoolId, grade, classNum, studentNumber, studentName },
    createdAt: new Date(createdAtMs)
  };
}

(async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let teacherUid = "";
  try {
    const base = Date.now();
    const seeds = [
      [STUDENT_ACTOR_IDS[0], record(SCHOOL_A, "5", "1", "3", "김민준", base)],
      [STUDENT_ACTOR_IDS[1], record(SCHOOL_A, "5", "1", "7", "이서연", base + 1000)],
      [STUDENT_ACTOR_IDS[2], record(SCHOOL_A, "5", "2", "1", "다른반학생", base + 2000)],
      [STUDENT_ACTOR_IDS[3], record(SCHOOL_B, "5", "1", "1", "다른학교학생", base + 3000)]
    ];
    for (const [actorId, data] of seeds) {
      await db.collection("actors").doc(actorId).collection("records").add(data);
    }

    const teacherSignup = await signup();
    teacherUid = (await auth.verifyIdToken(teacherSignup.idToken)).uid;
    await db.collection("actors").doc(TEACHER_ACTOR_ID).set({ status: "active", plan: "closed_beta", teacherVerified: { schoolId: SCHOOL_A } });
    await db.collection("actors").doc(TEACHER_ACTOR_ID).collection("trustedDevices").doc(teacherUid).set({ uid: teacherUid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174631" });
    await db.collection("edu2gDeviceBindings").doc(teacherUid).set({ actorId: TEACHER_ACTOR_ID, status: "active" });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const appCheck = async () => ({ status: "valid" });
    const exportHandler = createExportClassRecordsHandler({ db, access, rateLimiter, actorRateLimiter, appCheck });

    // 인증 안 된 기기(teacherVerified 없는 별도 로그인)는 거절.
    const otherSignup = await signup();
    const otherResponse = await call(exportHandler, otherSignup.idToken, { grade: "5", classNum: "1" });
    assert.equal(otherResponse.status, 403);
    assert.equal(otherResponse.body.code, "teacher_verification_required");

    const result = await call(exportHandler, teacherSignup.idToken, { grade: "5", classNum: "1" });
    assert.equal(result.status, 200);
    assert.equal(result.body.records.length, 2, "must include only this school+grade+class, not the other class or the other school");
    assert.deepEqual(result.body.records.map((r) => r.studentName), ["김민준", "이서연"], "must be ordered by createdAt ascending");
    assert.equal(result.body.records[0].studentNumber, "3");
    assert.equal(result.body.records[0].selectedItemId, "pet-bottle");
    assert.equal(result.body.records[0].status, "completed");

    const invalid = await call(exportHandler, teacherSignup.idToken, { grade: "", classNum: "1" });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "invalid_request");

    process.stdout.write(JSON.stringify({ classExportEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (teacherUid) batch.delete(db.collection("edu2gDeviceBindings").doc(teacherUid));
    const teacherRoot = db.collection("actors").doc(TEACHER_ACTOR_ID);
    const devices = await teacherRoot.collection("trustedDevices").get();
    devices.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(teacherRoot);
    for (const actorId of STUDENT_ACTOR_IDS) {
      const recordsSnap = await db.collection("actors").doc(actorId).collection("records").get();
      recordsSnap.docs.forEach((d) => batch.delete(d.ref));
    }
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
