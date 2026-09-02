"use strict";

// 3단 권한체계 2단계(2026-08-31 대표님 지시): "코드만 알면 자동가입"이 아니라
// "교사가 한 명씩 승인"하는 구조로 registerStudentProfile의 신원증명 문제를
// 실제로 닫는다. registerStudentProfile(studentProfile.js)은 이제 즉시
// studentProfile을 쓰지 않고 registrationRequests/{actorId}에 대기 상태로만
// 남긴다 - 여기 두 함수가 그 대기열을 teacherVerified된 actor에게만 열어준다.
const { cleanText } = require("./httpGuard");
const { guardedTeacher } = require("./teacherAuth");

const MAX_LIST_SIZE = 100;

function publicProfile(profile) {
  if (!profile) return null;
  const { schoolId, schoolName, grade, classNum, studentNumber, name } = profile;
  return { schoolId, schoolName, grade, classNum, studentNumber, name };
}

function createListPendingRegistrationsHandler(dependencies = {}) {
  const db = dependencies.db;
  return async (req, res) => {
    const teacher = await guardedTeacher(req, res, "listPendingRegistrations", dependencies);
    if (!teacher) return;
    const body = req.body || {};
    if (Object.keys(body).length) return res.status(400).json({ ok: false, code: "unknown_field" });
    // 2026-09-02 재감사: 같은 파일의 decideRegistration에는 503 컨벤션이
    // 붙어 있는데 이 조회만 try/catch가 없어서, 일시적 Firestore 장애 시
    // 교사 화면이 503이 아니라 정체불명의 500을 받았다.
    try {
      const snap = await db.collection("registrationRequests").where("schoolId", "==", teacher.schoolId).where("status", "==", "pending").limit(MAX_LIST_SIZE).get();
      const requests = snap.docs.map((doc) => ({ actorId: doc.id, ...publicProfile(doc.data()) }));
      // 대기열이 MAX_LIST_SIZE(100)를 넘으면 넘친 신청은 화면에 아예 안 보이는데
      // 예전엔 그 사실을 교사가 알 방법이 없었다(승인 안 되면 학생은 계속
      // "승인 대기중"만 본다) - 잘렸는지 여부를 같이 내려준다.
      return res.status(200).json({ ok: true, requests, truncated: requests.length >= MAX_LIST_SIZE });
    } catch {
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

function createDecideRegistrationHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    const teacher = await guardedTeacher(req, res, "decideRegistration", dependencies);
    if (!teacher) return;
    const body = req.body || {};
    const allowed = new Set(["targetActorId", "decision"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const targetActorId = cleanText(body.targetActorId, 200);
    const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : "";
    if (!targetActorId || !decision) return res.status(400).json({ ok: false, code: "invalid_request" });

    const requestRef = db.collection("registrationRequests").doc(targetActorId);
    const actorRef = db.collection("actors").doc(targetActorId);
    let result;
    try {
      result = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(requestRef);
        if (!snap.exists) return { code: "not_found" };
        const data = snap.data();
        // 다른 학교 요청이면 "없는 것"처럼 404로 응답한다 - 학교 소속을
        // 넘어선 actorId 추측 시도로도 다른 학교 학생 정보가 새어나가지 않게.
        if (data.schoolId !== teacher.schoolId) return { code: "not_found" };
        if (data.status !== "pending") return { code: "not_pending" };
        if (decision === "reject") {
          // 2026-09-01 종합감사(B그룹 5번): 승인 경로(67행)는 요청 문서를
          // 아예 삭제하는데 거절 경로만 ...data를 그대로 남겨서 학생
          // 실명+번호가 영구 잔존했다 - 재신청 가능 여부 판단(status)과
          // 교사 화면 표시(schoolId/schoolName/grade/classNum)에 필요한
          // 것만 남기고, 개인 식별용인 studentNumber/name은 뺀다(merge:false로
          // 완전 교체 - merge:true였다면 기존 필드가 안 지워짐).
          transaction.set(requestRef, { schoolId: data.schoolId, schoolName: data.schoolName, grade: data.grade, classNum: data.classNum, status: "rejected", decidedAt: serverTimestamp(), decidedByActorId: teacher.actorId });
          return { ok: true, decision: "rejected" };
        }
        const actorSnap = await transaction.get(actorRef);
        if (actorSnap.exists && actorSnap.data()?.studentProfile) return { code: "already_registered" };
        // 3단계(2026-08-31) - 승인은 교사가 사람이 눈으로 확인한 신원증명이므로,
        // 이 기기의 school-lock(dashboardSchoolId)도 승인된 학교로 같이
        // 바로잡는다(teacherAuth.js의 verifyTeacherCode와 같은 근거).
        // registeredByActorId(2026-09-01 종합감사 B그룹 6번) - 승인 경로는
        // 요청 문서 자체를 지우기 때문에(바로 아래), 감사기록은 승인 결과인
        // studentProfile 안에 같이 남겨야만 나중에도 "누가 승인했나"를 알 수 있다.
        transaction.set(actorRef, { studentProfile: { schoolId: data.schoolId, schoolName: data.schoolName, grade: data.grade, classNum: data.classNum, studentNumber: data.studentNumber, name: data.name, registeredAt: serverTimestamp(), registeredByActorId: teacher.actorId }, dashboardSchoolId: data.schoolId }, { merge: true });
        transaction.delete(requestRef);
        return { ok: true, decision: "approved" };
      });
    } catch {
      // 재감사 지적사항(2026-09-01) - 이 트랜잭션만 이 프로젝트의 다른 모든
      // runTransaction(schoolDashboard.js/classRanking.js)과 달리 try/catch가
      // 빠져있어서, 두 교사가 같은 요청을 동시에 승인/거절하는 경합이나
      // 일시적 장애 시 15초 타임아웃까지 조용히 걸리는 문제가 있었다.
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
    if (result.code === "not_found") return res.status(404).json({ ok: false, code: "request_not_found" });
    if (result.code === "not_pending") return res.status(409).json({ ok: false, code: "already_decided" });
    if (result.code === "already_registered") return res.status(409).json({ ok: false, code: "already_registered" });
    logger({ severity: "INFO", message: "registration_decided", teacherActorId: teacher.actorId, schoolId: teacher.schoolId, targetActorId, decision: result.decision });
    return res.status(200).json({ ok: true, decision: result.decision, targetActorId });
  };
}

module.exports = { createListPendingRegistrationsHandler, createDecideRegistrationHandler };
