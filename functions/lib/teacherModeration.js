"use strict";

// 2026-09-09(Bumm님 결정) - 가입 승인 대기열을 없애면서, 사전 차단이 하던
// 자리를 사후 정리가 대신한다. teacherVerified된 교사가 자기 반 학생의
// ①계정을 차단하고(그 기기로 더는 접속 못 함) ②그 학생이 남긴 기록을
// 삭제할 수 있다.
//
// 인지하고 받아들인 위험: 이 앱에는 이름으로 식별되는 교사 계정이 없다.
// 교사 권한은 "그 반 공유코드를 입력한 익명 기기"에 붙는 상태이고 코드에는
// 유효기간도 사용횟수 제한도 없다. 즉 그 반 코드를 아는 사람은 누구든 이
// 기능을 쓸 수 있다. 세션이 대안(삭제는 슈퍼어드민만 / 유예 후 삭제)과 함께
// 위험을 보고했고 Bumm님이 그 위에서 현재 방식을 선택하셨다 - 결함이 아니라
// 확정된 제품결정이다(COMMON_STANDARDS §4-4).
//
// 그래서 아래 장치들은 위험을 없애는 게 아니라, 사고가 났을 때 무엇이
// 일어났는지 알 수 있게 하고 범위를 그 반으로 묶어두기 위한 것이다:
//   - 반 스코프를 서버에서 강제하고, 다른 반이면 404로 존재 자체를 숨긴다
//     (studentAnonymization.js:80과 같은 패턴)
//   - 클라이언트가 학교/학년/반을 지정할 방법을 아예 주지 않는다
//     (classExport.js와 같은 방식 - 서버가 검증한 교사의 반만 쓴다)
//   - 무엇을 하든 감사로그를 남긴다(index.js:39에 "가입승인·거절에 감사로그가
//     전혀 없었다"는 지적이 이미 기록돼 있다)
const { cleanText, applyCors } = require("./httpGuard");
const { guardedTeacher } = require("./teacherAuth");
const { studentNumberClaimRef } = require("./studentNumberClaim");
const { classDocId } = require("./schoolDashboardAggregate");

const MAX_BODY_BYTES = 1024;
// 한 번에 지우는 기록 수. 트랜잭션이 아니라 배치라 중간에 끊겨도 다음 호출이
// 이어서 지운다(남은 건수를 응답에 실어 클라이언트가 다시 부를 수 있게 한다).
const DELETE_BATCH_SIZE = 300;

function badRequest(res, code, status = 400) {
  return res.status(status).json({ ok: false, code });
}

// 대상 학생이 이 교사의 반 학생인지 확인한다. 아니면(다른 반이거나 아예 없거나)
// 똑같이 not_found를 돌려준다 - actorId를 찍어보는 것으로 다른 반에 누가 있는지
// 알아낼 수 없어야 한다.
async function loadOwnClassStudent(db, teacher, targetActorId) {
  const actorRef = db.collection("actors").doc(targetActorId);
  const snap = await actorRef.get();
  const profile = snap.exists ? snap.data()?.studentProfile : null;
  if (!profile) return null;
  if (profile.schoolId !== teacher.schoolId || profile.grade !== teacher.grade || profile.classNum !== teacher.classNum) return null;
  return { actorRef, profile };
}

async function countRecords(db, targetActorId) {
  const snap = await db.collection("actors").doc(targetActorId).collection("records").count().get();
  return snap.data().count;
}

// 교사가 자기 반 학생 명부를 본다. 승인 대기열이 없어지면서 교사가 학생의
// actorId를 알 수 있는 경로가 아예 사라졌기 때문에 필요하다(대기열이 유일한
// 출처였다). 명부의 권위 소스는 studentNumberClaims다 - 문서ID가
// {schoolId}_{grade}_{classNum}_{번호}라 그 반 접두사로 범위 조회하면
// "기록이 아직 없는 학생"까지 빠짐없이 나온다(랭킹 문서는 기록이 있어야 생긴다).
const MAX_ROSTER = 60;
function createListClassStudentsHandler(dependencies = {}) {
  const db = dependencies.db;
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    if (!applyCors(req, res)) return badRequest(res, "invalid_origin", 403);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return badRequest(res, "method_not_allowed", 405);

    const teacher = await guardedTeacher(req, res, "listClassStudents", dependencies);
    if (!teacher) return;
    if (Object.keys(req.body || {}).length) return badRequest(res, "unknown_field");

    try {
      const prefix = `${teacher.schoolId}_${teacher.grade}_${teacher.classNum}_`;
      const claims = await db.collection("studentNumberClaims")
        // endAt의 는 유니코드에서 사실상 가장 큰 문자라, 이 범위가 그
        // 접두사로 시작하는 문서만 정확히 감싼다(접두사 범위 조회 관용구).
        .orderBy("__name__").startAt(prefix).endAt(`${prefix}`).limit(MAX_ROSTER).get();
      if (claims.empty) return res.status(200).json({ ok: true, students: [] });

      const actorIds = claims.docs.map((doc) => doc.data()?.actorId).filter(Boolean);
      const [actorSnaps, blockedSnaps] = await Promise.all([
        db.getAll(...actorIds.map((id) => db.collection("actors").doc(id))),
        db.getAll(...actorIds.map((id) => db.collection("blockedActors").doc(id)))
      ]);
      const blocked = new Set(blockedSnaps.filter((s) => s.exists).map((s) => s.id));
      const students = actorSnaps.map((snap) => {
        const profile = snap.exists ? snap.data()?.studentProfile : null;
        if (!profile) return null;
        // 교사 화면에서도 자기 반만 보여야 한다 - claim이 남아 있는데 학생이
        // 반을 옮긴 경우가 있을 수 있어 프로필 기준으로 한 번 더 거른다.
        if (profile.schoolId !== teacher.schoolId || profile.grade !== teacher.grade || profile.classNum !== teacher.classNum) return null;
        return { actorId: snap.id, studentNumber: profile.studentNumber, name: profile.name, blocked: blocked.has(snap.id) };
      }).filter(Boolean).sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));

      return res.status(200).json({ ok: true, students });
    } catch (error) {
      logger({ severity: "ERROR", message: "list_class_students_failed", teacherActorId: teacher.actorId, error: String(error?.message || error) });
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

// 삭제 전에 "무엇이 지워지는지"를 보여주기 위한 조회. 되돌릴 수 없는 조작이라
// 이름만이 아니라 기록 건수까지 알려줘야 교사가 판단할 수 있다.
function createDescribeStudentHandler(dependencies = {}) {
  const db = dependencies.db;
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    if (!applyCors(req, res)) return badRequest(res, "invalid_origin", 403);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return badRequest(res, "method_not_allowed", 405);
    if (Buffer.byteLength(JSON.stringify(req.body || {}), "utf8") > MAX_BODY_BYTES) return badRequest(res, "payload_too_large", 413);

    const teacher = await guardedTeacher(req, res, "describeStudent", dependencies);
    if (!teacher) return;
    const body = req.body || {};
    const allowed = new Set(["targetActorId"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return badRequest(res, "unknown_field");
    const targetActorId = cleanText(body.targetActorId, 200);
    if (!targetActorId) return badRequest(res, "invalid_request");

    try {
      const found = await loadOwnClassStudent(db, teacher, targetActorId);
      if (!found) return badRequest(res, "not_found", 404);
      const recordCount = await countRecords(db, targetActorId);
      const blocked = (await db.collection("blockedActors").doc(targetActorId).get()).exists;
      return res.status(200).json({
        ok: true,
        student: { grade: found.profile.grade, classNum: found.profile.classNum, studentNumber: found.profile.studentNumber, name: found.profile.name },
        recordCount,
        blocked
      });
    } catch (error) {
      logger({ severity: "ERROR", message: "describe_student_failed", teacherActorId: teacher.actorId, targetActorId, error: String(error?.message || error) });
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

// 계정 차단과 기록 삭제. 둘은 목적이 달라서 따로 실행할 수 있어야 한다 -
// 시연·테스트 가입 정리는 차단만으로 충분하고(기록이 없다), 장난 기록만
// 지우고 계정은 살려둬야 할 때도 있다. 화면에서 둘 다 고르면 한 번에 처리된다.
function createModerateStudentHandler(dependencies = {}) {
  const db = dependencies.db;
  const serverTimestamp = dependencies.serverTimestamp || (() => new Date());
  const logger = dependencies.logger || (() => {});
  return async (req, res) => {
    if (!applyCors(req, res)) return badRequest(res, "invalid_origin", 403);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return badRequest(res, "method_not_allowed", 405);
    if (Buffer.byteLength(JSON.stringify(req.body || {}), "utf8") > MAX_BODY_BYTES) return badRequest(res, "payload_too_large", 413);

    const teacher = await guardedTeacher(req, res, "moderateStudent", dependencies);
    if (!teacher) return;
    const body = req.body || {};
    const allowed = new Set(["targetActorId", "blockAccount", "deleteRecords"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return badRequest(res, "unknown_field");
    const targetActorId = cleanText(body.targetActorId, 200);
    const blockAccount = body.blockAccount === true;
    const deleteRecords = body.deleteRecords === true;
    if (!targetActorId) return badRequest(res, "invalid_request");
    if (!blockAccount && !deleteRecords) return badRequest(res, "invalid_request");

    try {
      const found = await loadOwnClassStudent(db, teacher, targetActorId);
      if (!found) return badRequest(res, "not_found", 404);
      const { profile } = found;

      let deleted = 0;
      let remaining = 0;
      if (deleteRecords) {
        const recordsRef = db.collection("actors").doc(targetActorId).collection("records");
        for (;;) {
          const snap = await recordsRef.limit(DELETE_BATCH_SIZE).get();
          if (snap.empty) break;
          const batch = db.batch();
          snap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          deleted += snap.docs.length;
          // 한 요청이 무한정 길어지지 않게 한 배치만 지우고 남은 건수를 알려준다.
          if (snap.docs.length === DELETE_BATCH_SIZE) { remaining = await countRecords(db, targetActorId); break; }
        }
        // 반 개인랭킹에 남은 이름·번호도 같이 정리한다 - 기록을 지웠는데
        // "우리반 실천왕"에 이름이 그대로 있으면 지웠다고 볼 수 없다.
        await db.collection("schools").doc(profile.schoolId)
          .collection("classes").doc(classDocId(profile.grade, profile.classNum))
          .collection("students").doc(String(profile.studentNumber)).delete().catch(() => {});
      }

      if (blockAccount) {
        await db.collection("blockedActors").doc(targetActorId).set({
          blockedAt: serverTimestamp(), blockedByActorId: teacher.actorId,
          schoolId: teacher.schoolId, grade: teacher.grade, classNum: teacher.classNum
        });
        // 번호 점유를 풀어줘야 그 번호로 다시 가입할 수 있다(잘못 가입한
        // 학생을 지우고 제대로 다시 넣는 것이 이 기능의 주 용도다).
        await studentNumberClaimRef(db, profile.schoolId, profile.grade, profile.classNum, profile.studentNumber).delete().catch(() => {});
      }

      logger({
        severity: "INFO", message: "student_moderated",
        teacherActorId: teacher.actorId, targetActorId,
        schoolId: teacher.schoolId, grade: teacher.grade, classNum: teacher.classNum,
        blockAccount, deleteRecords, deletedRecords: deleted, remainingRecords: remaining
      });
      return res.status(200).json({ ok: true, blocked: blockAccount, deletedRecords: deleted, remainingRecords: remaining });
    } catch (error) {
      logger({ severity: "ERROR", message: "moderate_student_failed", teacherActorId: teacher.actorId, targetActorId, error: String(error?.message || error) });
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

module.exports = { createListClassStudentsHandler, createDescribeStudentHandler, createModerateStudentHandler };
