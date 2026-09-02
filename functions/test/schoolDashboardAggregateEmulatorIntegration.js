"use strict";
// Demo emulators only, needs auth+firestore+functions running (the Firestore
// trigger only fires while the Functions emulator is up and watching the
// same Firestore emulator instance). Proves the full loop end to end: a
// saveSortingRecord write -> onSortingRecordWritten trigger -> aggregate doc
// update -> getSchoolDashboard read, including the held->completed
// conversion path via resolveSortingRecord.
const assert = require("node:assert/strict"), http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createEdu2gDeviceAccess } = require("../lib/edu2gDeviceAccess");
const { createGlobalRateLimiter, createActorRateLimiter } = require("../lib/globalRateLimit");
const { createSaveSortingRecordHandler } = require("../lib/sortingRecord");
const { createResolveSortingRecordHandler } = require("../lib/sortingRecordQuery");
const { createGetSchoolDashboardHandler } = require("../lib/schoolDashboard");

const projectId = process.env.GCLOUD_PROJECT || "demo-aiways-incheon";
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
// registerStudentProfile은 schoolId가 나이스 표준학교코드(숫자만)여야
// 통과시킨다(4단계 마이그레이션 이후 규칙) - 이 테스트가 registerStudentProfile을
// 처음 쓰기 전까지는 문자열 아무거나로도 괜찮았다.
const SCHOOL_ID = "9999999";

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

function recordPayload(key, { status = "completed", selectedItemId = "pet-bottle", grade = "5", classNum = "1", campusCheckId = "", schoolName = "", studentNumber = "", studentName = "" } = {}) {
  return {
    schemaVersion: "sorting-record-v1", status, provider: status === "held" ? "manual_hold" : "manual_select",
    analysis: { objectCandidates: [], materialCandidates: [], visibleCautions: [] }, checklist: [],
    userDecision: { selectedItemId, action: status === "held" ? "held" : "recorded", userConfirmed: true },
    hold: status === "held" ? { recommended: true, reasons: ["check"] } : null,
    classContext: { schoolId: SCHOOL_ID, ...(schoolName ? { schoolName } : {}), grade, classNum, ...(studentNumber ? { studentNumber } : {}), ...(studentName ? { studentName } : {}) }, idempotencyKey: key,
    ...(campusCheckId ? { campusCheckId } : {})
  };
}

async function pollUntil(check, { timeoutMs = 8000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() > deadline) throw new Error("timed out waiting for trigger effect");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

(async () => {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uid = "";
  let studentUid = "";
  let otherClassUid = "";
  let outsiderUid = "";
  const secondActorId = "dashboard_test_actor_student";
  const otherClassActorId = "dashboard_test_actor_other_class";
  const outsiderActorId = "dashboard_test_actor_outsider";
  try {
    const signed = await signup();
    const token = signed.idToken;
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    const actorId = "dashboard_test_actor";
    // 재감사 지적사항(2026-09-01, classContext 신뢰 문제) 대응으로
    // saveSortingRecord가 승인된 studentProfile 없는 actor의 classContext를
    // 이제 null로 만든다(집계에서 완전히 제외) - 이 스위트는 원래
    // "studentProfile 없는 actor가 보낸 기록도 반 집계엔 들어간다"는
    // 옛 동작을 전제로 짜여 있었는데, 그게 바로 이번에 닫은 구멍이라
    // 이 actor에도 정식 승인된 프로필을 심어서 집계 수학 자체는
    // 그대로 검증하고, "미승인 actor는 집계에서 제외"는 별도
    // registrationApprovalEmulatorIntegration.js/studentProfileEmulatorIntegration.js가
    // 이미 다루므로 여기서 중복 검증하지 않는다.
    await db.collection("actors").doc(actorId).set({ status: "active", plan: "closed_beta", studentProfile: { schoolId: SCHOOL_ID, schoolName: "실측초등학교", grade: "5", classNum: "1", studentNumber: "1", name: "학급대표" } });
    await db.collection("actors").doc(actorId).collection("trustedDevices").doc(uid).set({ uid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174401" });
    await db.collection("edu2gDeviceBindings").doc(uid).set({ actorId, status: "active" });

    const access = createEdu2gDeviceAccess({ auth, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const rateLimiter = createGlobalRateLimiter({ db });
    const actorRateLimiter = createActorRateLimiter({ db });
    const store = {
      async createOrGet(actorIdArg, key, record, response) {
        const actor = db.collection("actors").doc(actorIdArg);
        const idem = actor.collection("_idempotency").doc(key);
        return db.runTransaction(async (tx) => {
          const prior = await tx.get(idem);
          if (prior.exists) return { ...prior.data(), duplicate: true };
          const ref = actor.collection("records").doc();
          tx.create(ref, record);
          tx.create(idem, { recordId: ref.id, status: record.status, createdAt: response.createdAt });
          return { recordId: ref.id, status: record.status, ...response, duplicate: false };
        });
      },
      async resolve(actorIdArg, b, serverTime) {
        const record = db.collection("actors").doc(actorIdArg).collection("records").doc(b.recordId);
        const key = db.collection("actors").doc(actorIdArg).collection("_resolutions").doc(b.idempotencyKey);
        return db.runTransaction(async (tx) => {
          const prior = await tx.get(key);
          if (prior.exists) return { ...prior.data(), duplicate: true };
          const snap = await tx.get(record);
          if (!snap.exists) return { code: "not_found" };
          if (snap.data().status !== "held") return { code: "conflict" };
          const result = { recordId: b.recordId, status: "completed", resolutionType: b.resolutionType, duplicate: false };
          tx.update(record, { status: "completed", updatedAt: serverTime, resolvedAt: serverTime, resolutionType: b.resolutionType, userDecision: b.userDecision, checklist: b.checklist });
          tx.create(key, result);
          return result;
        });
      }
    };
    const appCheck = async () => ({ status: "valid" });
    const save = createSaveSortingRecordHandler({ access, rateLimiter, actorRateLimiter, appCheck, store, db, serverTimestamp: () => FieldValue.serverTimestamp() });
    const resolve = createResolveSortingRecordHandler({ store, access, appCheck, serverTimestamp: () => FieldValue.serverTimestamp(), rateLimiter, actorRateLimiter, logAppCheck: () => {} });
    const dashboard = createGetSchoolDashboardHandler({ db, access, appCheck, rateLimiter, actorRateLimiter, logAppCheck: () => {} });

    // This suite is about aggregation math, not GPS (that's campusLocationEmulatorIntegration.js's
    // job) -- seed already-verified on-campus checks directly rather than going through
    // checkCampusLocation, since step 5 now requires onCampus===true for anything to count.
    async function seedOnCampusCheck(actorIdArg = "dashboard_test_actor") {
      const ref = db.collection("actors").doc(actorIdArg).collection("campusChecks").doc();
      // schoolId 누락은 사전 버그였다(발견: 2026-09-01) - sortingRecord.js가
      // campusCheckId를 소비할 때 그 check의 schoolId가 기록의 classContext.schoolId와
      // 정확히 일치해야만 onCampus를 인정하는데(다른 학교 체크를 빌려쓰는 것 방지),
      // 이 필드가 없으면 항상 불일치로 처리돼 onCampus가 조용히 false가
      // 되고, 트리거가 매번 아무 것도 안 하고 조용히 리턴해 집계가 하나도
      // 안 쌓인다 - 이 파일이 CI에 안 걸려있어 아무도 몰랐던 사전 버그.
      await ref.set({ schoolId: SCHOOL_ID, onCampus: true, consumed: false, createdAt: FieldValue.serverTimestamp(), expireAt: new Date(Date.now() + 120000) });
      return ref.id;
    }

    // r3(5학년 2반)은 classContext가 이제 승인된 studentProfile에서만 나오므로
    // (재감사 대응, 위 참고) 5-1반 actor를 재사용할 수 없다 - 별도 actor로
    // 5-2반 프로필을 심어서 보낸다.
    const otherClassSignup = await signup();
    const otherClassToken = otherClassSignup.idToken;
    otherClassUid = (await auth.verifyIdToken(otherClassToken)).uid;
    await db.collection("actors").doc(otherClassActorId).set({ status: "active", plan: "closed_beta", studentProfile: { schoolId: SCHOOL_ID, schoolName: "실측초등학교", grade: "5", classNum: "2", studentNumber: "1", name: "이반학생" } });
    await db.collection("actors").doc(otherClassActorId).collection("trustedDevices").doc(otherClassUid).set({ uid: otherClassUid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174701" });
    await db.collection("edu2gDeviceBindings").doc(otherClassUid).set({ actorId: otherClassActorId, status: "active" });

    // Two completed records in 5학년 1반, one in 5학년 2반, one held record
    // in 5학년 1반 later resolved to completed (tests the conversion path).
    const r1 = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174501", { selectedItemId: "pet-bottle", campusCheckId: await seedOnCampusCheck(), schoolName: "실측초등학교" }));
    const r2 = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174502", { selectedItemId: "pet-bottle", campusCheckId: await seedOnCampusCheck() }));
    const r3 = await call(save, otherClassToken, recordPayload("123e4567-e89b-42d3-a456-426614174503", { grade: "5", classNum: "2", selectedItemId: "milk-carton", campusCheckId: await seedOnCampusCheck(otherClassActorId) }));
    const held = await call(save, token, recordPayload("123e4567-e89b-42d3-a456-426614174504", { status: "held", selectedItemId: "이상한 물건", campusCheckId: await seedOnCampusCheck() }));
    assert.equal(r1.status, 201); assert.equal(r2.status, 201); assert.equal(r3.status, 201); assert.equal(held.status, 201);

    const classRef = db.collection("schools").doc(SCHOOL_ID).collection("classes").doc("5_1");
    const afterCreates = await pollUntil(async () => {
      const snap = await classRef.get();
      const data = snap.data();
      return data && data.observedToday === 3 && data.heldTotal === 1 ? data : null;
    });
    assert.equal(afterCreates.completedTotal, 2);
    assert.equal(afterCreates.itemCounts["pet-bottle"], 2);
    assert.equal(afterCreates.itemCounts["이상한 물건"], 1);

    const resolved = await call(resolve, token, { recordId: held.body.recordId, idempotencyKey: "123e4567-e89b-42d3-a456-426614174505", resolutionType: "confirmed_after_review", userDecision: { userConfirmed: true }, checklist: [{ checked: true }] });
    assert.equal(resolved.status, 200);

    const afterResolve = await pollUntil(async () => {
      const snap = await classRef.get();
      const data = snap.data();
      return data && data.convertedTotal === 1 ? data : null;
    });
    assert.equal(afterResolve.heldTotal, 0);
    assert.equal(afterResolve.completedTotal, 3);
    // observedToday must NOT double-count the resolve -- it only counts new records.
    assert.equal(afterResolve.observedToday, 3);

    const schoolView = await call(dashboard, token, { schoolId: SCHOOL_ID });
    assert.equal(schoolView.status, 200);
    assert.equal(schoolView.body.schoolName, "실측초등학교", "schoolName written via classContext must surface on the parent school doc");
    assert.equal(schoolView.body.classCount, 2);
    assert.equal(schoolView.body.school.observedToday, 4);
    assert.equal(schoolView.body.school.completedTotal, 4);
    assert.equal(schoolView.body.school.heldTotal, 0);
    assert.deepEqual(schoolView.body.gradeBars, [{ grade: "5", observedToday: 4 }]);

    const classView = await call(dashboard, token, { schoolId: SCHOOL_ID, grade: "5", classNum: "1" });
    assert.equal(classView.status, 200);
    assert.equal(classView.body.selectedClass.observedToday, 3);
    assert.equal(classView.body.selectedClass.convertedTotal, 1);
    assert.equal(classView.body.selectedClass.topItems[0].itemId, "pet-bottle");
    assert.equal(classView.body.selectedClass.topItems[0].count, 2);
    assert.equal(classView.body.selectedClass.rankInGrade, 1);
    assert.equal(classView.body.selectedClass.gradeSize, 2);
    // topStudents 내용 자체은 아래(outsider/등록학생 구분) 섹션에서 전용
    // actor로 따로 검증한다 - 여기서는 안 건드린다. schoolDashboard.js의
    // topStudents 캐시(같은 schoolId/grade/classNum 키를 요청 actor와
    // 무관하게 공유)가 이 시점(dashboard_test_actor도 이제 승인된
    // studentProfile이 있어 캐시에 씀)과 아래 구간이 겹치면 타이밍에 따라
    // 흔들릴 수 있어, 검증 지점을 분리해 이 스위트를 안정적으로 유지한다.

    const badSelector = await call(dashboard, token, { schoolId: SCHOOL_ID, grade: "5" });
    assert.equal(badSelector.status, 400);
    assert.equal(badSelector.body.code, "invalid_class_selector");

    // This actor's first getSchoolDashboard call above locked it to SCHOOL_ID
    // (actors/{actorId}.dashboardSchoolId) -- any other schoolId must now be
    // rejected outright, even though App Check/auth are otherwise valid.
    const otherSchool = await call(dashboard, token, { schoolId: "1111111" });
    assert.equal(otherSchool.status, 403);
    assert.equal(otherSchool.body.code, "school_mismatch");
    const sameSchoolAgain = await call(dashboard, token, { schoolId: SCHOOL_ID });
    assert.equal(sameSchoolAgain.status, 200);

    // 개인별 랭킹(6단계) - 완전히 별도의 두 번째 actor로 격리해서 확인한다.
    // 같은 actor를 재사용하면 registerStudentProfile이 그 이후 모든
    // saveSortingRecord 호출의 classContext.grade/classNum을 프로필 값으로
    // 강제로 덮어써버려서(의도된 동작 - 학생이 임시 입력을 조작 못 하게),
    // 위에서 r3를 5학년 2반에 넣으려던 것까지 전부 5학년 1반으로 밀려나
    // 기존 검증이 깨진다.
    const signedStudent = await signup();
    const studentToken = signedStudent.idToken;
    studentUid = (await auth.verifyIdToken(studentToken)).uid;
    await db.collection("actors").doc(secondActorId).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(secondActorId).collection("trustedDevices").doc(studentUid).set({ uid: studentUid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174601" });
    await db.collection("edu2gDeviceBindings").doc(studentUid).set({ actorId: secondActorId, status: "active" });
    // registerStudentProfile은 이제 즉시 studentProfile을 쓰지 않고 교사
    // 승인대기열을 거친다(studentProfile.js, registrationApproval.js) - 그
    // 흐름 자체는 studentProfileEmulatorIntegration.js/
    // registrationApprovalEmulatorIntegration.js에서 이미 검증하므로, 이
    // 테스트는 "승인까지 끝난 뒤" 상태만 직접 만들어 집계 로직 검증에 집중한다.
    await db.collection("actors").doc(secondActorId).set({ studentProfile: { schoolId: SCHOOL_ID, schoolName: "실측초등학교", grade: "5", classNum: "1", studentNumber: "7", name: "우주제일킹왕짱스타", registeredAt: FieldValue.serverTimestamp() } }, { merge: true });

    async function seedOnCampusCheckFor(actorIdArg) {
      const ref = db.collection("actors").doc(actorIdArg).collection("campusChecks").doc();
      // 위 seedOnCampusCheck와 같은 이유로 schoolId를 반드시 넣어야 한다.
      await ref.set({ schoolId: SCHOOL_ID, onCampus: true, consumed: false, createdAt: FieldValue.serverTimestamp(), expireAt: new Date(Date.now() + 120000) });
      return ref.id;
    }
    // classContext는 registerStudentProfile로 저장된 프로필에서 서버가
    // 자동으로 채워넣으므로(정식 가입 이후엔 클라이언트가 studentNumber를
    // 직접 보내도 무시됨) payload에는 안 실어도 된다.
    const studentRecord = await call(save, studentToken, recordPayload("123e4567-e89b-42d3-a456-426614174601", { selectedItemId: "pet-bottle", campusCheckId: await seedOnCampusCheckFor(secondActorId) }));
    assert.equal(studentRecord.status, 201);

    const studentRef = classRef.collection("students").doc("7");
    const studentDoc = await pollUntil(async () => {
      const snap = await studentRef.get();
      const data = snap.data();
      return data && data.completedTotal === 1 ? data : null;
    });
    assert.equal(studentDoc.studentName, "우주제일킹왕짱스타");

    // topStudents는 실제로 그 반에 가입한 studentToken(secondActorId)이
    // 요청할 때만 보여야 한다 - studentProfile이 아예 없는 액터는 같은
    // 학교/반을 조회해도 topStudents가 비어 있어야 정상이다(실제로
    // 발견됐던 취약점: 검증된 소속 없이도 다른 반 학생의 실명·번호를
    // 볼 수 있었음). dashboard_test_actor(token)는 이제 이 반에 승인된
    // studentProfile이 있는 actor라(재감사 대응, 위 참고) 이 역할을 못
    // 하므로, studentProfile이 전혀 없는 별도 outsider actor를 새로 쓴다.
    const outsiderSignup = await signup();
    const outsiderToken = outsiderSignup.idToken;
    outsiderUid = (await auth.verifyIdToken(outsiderToken)).uid;
    await db.collection("actors").doc(outsiderActorId).set({ status: "active", plan: "closed_beta" });
    await db.collection("actors").doc(outsiderActorId).collection("trustedDevices").doc(outsiderUid).set({ uid: outsiderUid, status: "active", managementId: "123e4567-e89b-42d3-a456-426614174801" });
    await db.collection("edu2gDeviceBindings").doc(outsiderUid).set({ actorId: outsiderActorId, status: "active" });
    const classViewNoProfile = await call(dashboard, outsiderToken, { schoolId: SCHOOL_ID, grade: "5", classNum: "1" });
    assert.equal(classViewNoProfile.status, 200);
    assert.deepEqual(classViewNoProfile.body.selectedClass.topStudents, [], "actor without a matching studentProfile must not see other students' names/numbers");

    // topStudents는 (schoolId,grade,classNum) 단위로 요청 actor와 무관하게
    // 캐시된다(schoolDashboard.js DASHBOARD_CACHE_TTL_MS=5500ms) - 바로 위
    // classViewNoProfile 호출 이전에 dashboard_test_actor 자신도 이제
    // 승인된 프로필이 있어(재감사 대응) 캐시에 [학급대표]만 있는 상태로
    // 쓸 수 있다. TTL을 확실히 넘겨야 secondActorId의 새 기록이 반영된
    // 값을 읽는다.
    await new Promise((resolve) => setTimeout(resolve, 5700));
    const classViewWithStudent = await call(dashboard, studentToken, { schoolId: SCHOOL_ID, grade: "5", classNum: "1" });
    assert.equal(classViewWithStudent.status, 200);
    // topStudents는 completedTotal 내림차순이라, 이 반에 먼저 심어둔
    // dashboard_test_actor(completedTotal 3)가 secondActorId(1)보다 앞에
    // 온다 - 순서를 가정하지 않고 studentNumber로 직접 찾는다.
    const secondActorEntry = classViewWithStudent.body.selectedClass.topStudents.find((item) => item.studentNumber === "7");
    assert.ok(secondActorEntry, "registered student must appear somewhere in topStudents");
    assert.equal(secondActorEntry.studentName, "우주제일킹왕짱스타");
    assert.equal(secondActorEntry.completedTotal, 1);

    process.stdout.write(JSON.stringify({ schoolDashboardAggregateEmulatorIntegration: "passed" }) + "\n");
  } finally {
    const batch = db.batch();
    if (uid) batch.delete(db.collection("edu2gDeviceBindings").doc(uid));
    if (studentUid) batch.delete(db.collection("edu2gDeviceBindings").doc(studentUid));
    if (otherClassUid) batch.delete(db.collection("edu2gDeviceBindings").doc(otherClassUid));
    if (outsiderUid) batch.delete(db.collection("edu2gDeviceBindings").doc(outsiderUid));
    const actorRoot = db.collection("actors").doc("dashboard_test_actor");
    const secondActorRoot = db.collection("actors").doc(secondActorId);
    const otherClassActorRoot = db.collection("actors").doc(otherClassActorId);
    const outsiderActorRoot = db.collection("actors").doc(outsiderActorId);
    for (const root of [actorRoot, secondActorRoot, otherClassActorRoot, outsiderActorRoot]) {
      for (const name of ["records", "_idempotency", "_resolutions", "trustedDevices", "campusChecks"]) {
        const snap = await root.collection(name).get();
        snap.docs.forEach((d) => batch.delete(d.ref));
      }
      batch.delete(root);
    }
    const classesSnap = await db.collection("schools").doc(SCHOOL_ID).collection("classes").get();
    for (const classDoc of classesSnap.docs) {
      const studentsSnap = await classDoc.ref.collection("students").get();
      studentsSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(classDoc.ref);
    }
    batch.delete(db.collection("schools").doc(SCHOOL_ID));
    await batch.commit();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
