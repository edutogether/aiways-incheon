"use strict";

// 3단 권한체계 확장(2026-09-02 대표님 승인) - 개인정보보호법상 정정·삭제
// 요구권에 대응하는 첫 실행 경로. 지금까지 학생·학부모가 자기 데이터를
// 지우거나 교사가 대신 지울 수 있는 코드 경로가 전혀 없었다(90일 자동삭제
// 폐지는 별개의 기존 결정이라 그대로 유지 - 이건 "요청 시 삭제" 수단
// 자체가 없다는 지적에 대한 대응).
//
// "삭제"가 아니라 "익명화"로 설계한 이유: 반/학교 집계(schools/*/classes/*.
// completedTotal 등)는 학생 개별 문서가 아니라 별도 집계 문서에 이미 반영돼
// 있어서, 학생 문서를 완전히 지운다고 그 집계가 줄지 않는다(오히려 집계와
// 개별 기록 수가 어긋나는 게 더 큰 문제). 그래서 이 기능은 개인 식별
// 필드(이름/번호)만 지우고, 반 집계는 그대로 둔다 - "그 학생이 기여한
// 실천 횟수는 유지하되, 누가 했는지는 더 이상 알 수 없게" 만드는 것.
//
// teacherVerified 교사만, 자기 학교 학생만 대상으로 할 수 있다(classExport.js/
// registrationApproval.js와 같은 스코프 원칙) - 학생 본인이 직접 부르는
// 엔드포인트가 아니다(자기 자신을 익명화해서 반 집계를 조작할 수 있게 되는
// 것을 막기 위함 - 삭제 요청은 현실에서도 보통 학부모가 담임에게 말해서
// 처리되는 절차이므로 이 흐름이 실제 운영과도 맞는다).
const { cleanText } = require("./httpGuard");
const { guardedTeacher } = require("./teacherAuth");
const { classDocId } = require("./schoolDashboardAggregate");

function createAnonymizeStudentHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    const teacher = await guardedTeacher(req, res, "anonymizeStudent", dependencies);
    if (!teacher) return;
    const body = req.body || {};
    const allowed = new Set(["targetActorId"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const targetActorId = cleanText(body.targetActorId, 200);
    if (!targetActorId) return res.status(400).json({ ok: false, code: "invalid_request" });

    const actorRef = db.collection("actors").doc(targetActorId);
    try {
      const result = await db.runTransaction(async (transaction) => {
        const actorSnap = await transaction.get(actorRef);
        const profile = actorSnap.exists ? actorSnap.data()?.studentProfile : null;
        if (!profile) return { code: "not_found" };
        // 다른 학교 학생이면 "없는 것"처럼 404로 응답한다 - registrationApproval.js/
        // classExport.js와 같은 이유(학교 소속을 넘어선 actorId 추측으로도
        // 다른 학교 학생 정보가 새어나가지 않게).
        if (profile.schoolId !== teacher.schoolId) return { code: "not_found" };
        if (profile.anonymized === true) return { code: "already_anonymized" };

        const studentRef = db.collection("schools").doc(profile.schoolId)
          .collection("classes").doc(classDocId(profile.grade, profile.classNum))
          .collection("students").doc(profile.studentNumber || "");

        // studentProfile에서 이름/번호만 제거하고 나머지(schoolId/grade/classNum)는
        // 남긴다 - 이 기기가 앞으로도 판단 활동 자체는 계속할 수 있게 하되
        // (반 집계에는 계속 기여), 개인 랭킹에는 더 이상 이름/번호로 안 뜬다
        // (saveSortingRecord가 studentNumber 없는 profile은 classContext에
        // studentNumber/studentName을 안 실으므로 - sortingRecord.js:140 참고).
        transaction.set(actorRef, {
          studentProfile: {
            schoolId: profile.schoolId, schoolName: profile.schoolName, grade: profile.grade, classNum: profile.classNum,
            registeredAt: profile.registeredAt || null,
            anonymized: true, anonymizedAt: serverTimestamp(), anonymizedByActorId: teacher.actorId
          }
        }, { merge: false });

        // 개인 랭킹(schools/*/classes/*/students/{번호}) 문서는 번호 자체가
        // 그 학생을 가리키는 식별자라 이름만 지워서는 부족하다 - 문서를
        // 통째로 지운다. completedTotal은 원래도 반 집계 문서(classRef)에
        // 이미 합산 반영돼 있던 값이라(schoolDashboardAggregate.js), 이
        // 학생 문서를 지워도 반/학교 집계 숫자는 줄지 않는다.
        if (profile.studentNumber) transaction.delete(studentRef);

        return { ok: true, schoolId: profile.schoolId, grade: profile.grade, classNum: profile.classNum };
      });
      if (result.code === "not_found") return res.status(404).json({ ok: false, code: "student_not_found" });
      if (result.code === "already_anonymized") return res.status(409).json({ ok: false, code: "already_anonymized" });
      logger({ severity: "INFO", message: "student_anonymized", teacherActorId: teacher.actorId, schoolId: teacher.schoolId, targetActorId });
      return res.status(200).json({ ok: true, targetActorId });
    } catch {
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

module.exports = { createAnonymizeStudentHandler };
