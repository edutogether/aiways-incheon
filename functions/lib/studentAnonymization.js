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
const { FieldValue } = require("firebase-admin/firestore");
const { cleanText } = require("./httpGuard");
const { guardedTeacher } = require("./teacherAuth");
const { classDocId } = require("./schoolDashboardAggregate");
const { studentNumberClaimRef } = require("./studentNumberClaim");

// 2026-09-07 종합감사 - 익명화는 studentProfile/개인랭킹 문서만 지우고
// actors/{actorId}/records/*.classContext에 남아있는 studentNumber/
// studentName은 전혀 건드리지 않고 있었다. exportClassRecords(CSV 반전체
// 내보내기)가 정확히 그 두 필드를 뽑아서 CSV에 싣기 때문에, 학부모가
// 삭제를 요청해 교사가 익명화를 실행해도 다음 CSV 내보내기에는 그 학생의
// 실명·번호가 전 기간 기록에 그대로 다시 나왔다 - 이 함수 자신이 스스로
// 정의한 "번호도 식별자라 지워야 한다"는 원칙(위 studentRef 삭제 이유)이
// records에는 적용 안 된 것. 기록 수가 학기 내내 쌓여 임의로 많을 수
// 있어 트랜잭션(문서 수 상한 있음) 대신 배치 페이지네이션으로 지운다 -
// "studentNumber가 아직 남아있는 문서"만 조건으로 걸어서, 이미 정리된
// 문서는 자동으로 건너뛰므로 중간에 실패해도 재실행(재익명화 시도는
// already_anonymized로 막히지만, 이 함수 자체는 별도로 재호출 가능하게
// 독립 함수로 뺐다) 시 안전하다.
async function anonymizeStudentRecords(db, actorId) {
  const recordsRef = db.collection("actors").doc(actorId).collection("records");
  const BATCH_SIZE = 400;
  let total = 0;
  for (;;) {
    const snap = await recordsRef.where("classContext.studentNumber", ">", "").limit(BATCH_SIZE).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, { "classContext.studentNumber": FieldValue.delete(), "classContext.studentName": FieldValue.delete() });
    }
    await batch.commit();
    total += snap.docs.length;
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return total;
}

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
        if (profile.schoolId !== teacher.schoolId || profile.grade !== teacher.grade || profile.classNum !== teacher.classNum) return { code: "not_found" };
        if (profile.anonymized === true) return { code: "already_anonymized" };

        const studentRef = db.collection("schools").doc(profile.schoolId)
          .collection("classes").doc(classDocId(profile.grade, profile.classNum))
          .collection("students").doc(profile.studentNumber || "");

        // studentProfile에서 이름/번호만 제거하고 나머지(schoolId/grade/classNum)는
        // 남긴다 - 이 기기가 앞으로도 판단 활동 자체는 계속할 수 있게 하되
        // (반 집계에는 계속 기여), 개인 랭킹에는 더 이상 이름/번호로 안 뜬다
        // (saveSortingRecord가 studentNumber 없는 profile은 classContext에
        // studentNumber/studentName을 안 실으므로 - sortingRecord.js:140 참고).
        // 2026-09-07 종합감사 - 여기가 merge:false였다. merge:false는
        // actors/{actorId} 문서 "전체"를 { studentProfile: {...} } 하나로
        // 통째로 교체하므로, edu2gDeviceAccess.js가 매 요청마다 검사하는
        // status/plan/dashboardSchoolId/teacherVerified 등 다른 최상위
        // 필드가 전부 사라졌다 - 그 결과 이 기기는 바로 다음 요청부터
        // actor_unavailable(403)로 영구히 막히고(문서가 "없는" 게 아니라
        // "있는데 필드가 없는" 상태라 자가치유 경로도 안 걸림), 새로고침/
        // 재접속으로도 절대 안 풀렸다. merge:true + FieldValue.delete()로
        // name/studentNumber 두 필드만 정확히 지운다.
        transaction.set(actorRef, {
          studentProfile: {
            schoolId: profile.schoolId, schoolName: profile.schoolName, grade: profile.grade, classNum: profile.classNum,
            registeredAt: profile.registeredAt || null,
            name: FieldValue.delete(), studentNumber: FieldValue.delete(),
            anonymized: true, anonymizedAt: serverTimestamp(), anonymizedByActorId: teacher.actorId
          }
        }, { merge: true });

        // 개인 랭킹(schools/*/classes/*/students/{번호}) 문서는 번호 자체가
        // 그 학생을 가리키는 식별자라 이름만 지워서는 부족하다 - 문서를
        // 통째로 지운다. completedTotal은 원래도 반 집계 문서(classRef)에
        // 이미 합산 반영돼 있던 값이라(schoolDashboardAggregate.js), 이
        // 학생 문서를 지워도 반/학교 집계 숫자는 줄지 않는다.
        if (profile.studentNumber) {
          transaction.delete(studentRef);
          // 이 번호를 익명화된 학생이 계속 붙들고 있으면 실제로 전학 온
          // 새 학생이 같은 번호를 못 받는다 - studentNumberClaim.js의
          // 클레임도 같이 풀어서 번호를 다시 쓸 수 있게 한다.
          transaction.delete(studentNumberClaimRef(db, profile.schoolId, profile.grade, profile.classNum, profile.studentNumber));
        }

        return { ok: true, schoolId: profile.schoolId, grade: profile.grade, classNum: profile.classNum };
      });
      if (result.code === "not_found") return res.status(404).json({ ok: false, code: "student_not_found" });
      if (result.code === "already_anonymized") return res.status(409).json({ ok: false, code: "already_anonymized" });
      // studentProfile/개인랭킹은 이미 위 트랜잭션으로 익명화됐다 - records
      // 정리가 실패해도 그 성공을 되돌리지 않는다(트랜잭션 재시도 대상이
      // 아님). 실패하면 ERROR로 남겨서 나중에 추적·재실행할 수 있게 한다.
      let recordsUpdated = 0;
      try {
        recordsUpdated = await anonymizeStudentRecords(db, targetActorId);
      } catch (error) {
        logger({ severity: "ERROR", message: "anonymize_student_records_failed", teacherActorId: teacher.actorId, targetActorId, error: String(error?.message || error) });
      }
      logger({ severity: "INFO", message: "student_anonymized", teacherActorId: teacher.actorId, schoolId: teacher.schoolId, targetActorId, recordsUpdated });
      return res.status(200).json({ ok: true, targetActorId });
    } catch (error) {
      logger({ severity: "ERROR", message: "anonymize_student_failed", teacherActorId: teacher.actorId, targetActorId, error: String(error?.message || error) });
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

module.exports = { createAnonymizeStudentHandler, anonymizeStudentRecords };
