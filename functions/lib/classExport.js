"use strict";

// 3단 권한체계 5단계(2026-08-31 대표님 지시) - CSV 반전체 내보내기.
// app.js의 기존 CSV 내보내기(exportMySortingRecordsAsCsv)는 "이 기기(actor)가
// 저장한 기록"만 돌려준다(listSortingRecords) - 학교/반 전체를 모으는 진짜
// "선생님용 내보내기"는 교사 인증 개념이 없어서 막혀 있었다(1단계로 해결).
// teacherVerified된 actor만, 자기 학교의 특정 반 기록을 collectionGroup
// 쿼리로 모아 돌려준다 - actors/*/records는 개인 actor마다 나뉜 서브컬렉션
// 이라 반 단위로 보려면 collectionGroup 쿼리가 유일한 방법이다.
const { guardedTeacher } = require("./teacherAuth");

const DIGITS = /^\d{1,2}$/;
const CURSOR_PATTERN = /^\d{1,20}$/;
const MAX_PAGE_SIZE = 200;

function timestamp(value) {
  return value?.toDate ? value.toDate().toISOString() : (value instanceof Date ? value.toISOString() : value || null);
}

function createExportClassRecordsHandler(dependencies = {}) {
  const db = dependencies.db;
  return async (req, res) => {
    const teacher = await guardedTeacher(req, res, "exportClassRecords", dependencies);
    if (!teacher) return;
    const body = req.body || {};
    const allowed = new Set(["grade", "classNum", "cursor"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ ok: false, code: "unknown_field" });
    const grade = typeof body.grade === "string" && DIGITS.test(body.grade) ? body.grade : "";
    const classNum = typeof body.classNum === "string" && DIGITS.test(body.classNum) ? body.classNum : "";
    if (!grade || !classNum) return res.status(400).json({ ok: false, code: "invalid_request" });
    // 커서는 마지막으로 받은 기록의 createdAt(ms since epoch)이다 - collectionGroup
    // 쿼리라 이전 페이지의 DocumentSnapshot을 들고 있을 수 없어서, startAfter에
    // 쓸 수 있는 값(createdAt) 자체를 커서로 왕복시킨다.
    if (body.cursor !== undefined && !CURSOR_PATTERN.test(String(body.cursor))) return res.status(400).json({ ok: false, code: "invalid_request" });

    let query = db.collectionGroup("records")
      .where("classContext.schoolId", "==", teacher.schoolId)
      .where("classContext.grade", "==", grade)
      .where("classContext.classNum", "==", classNum)
      .orderBy("createdAt", "asc")
      .limit(MAX_PAGE_SIZE);
    if (body.cursor) query = query.startAfter(new Date(Number(body.cursor)));

    const snap = await query.get();
    const records = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        recordId: doc.id,
        createdAt: timestamp(data.createdAt),
        status: data.status,
        selectedItemId: data.userDecision?.selectedItemId || "",
        resolutionType: data.resolutionType || "",
        studentNumber: data.classContext?.studentNumber || "",
        studentName: data.classContext?.studentName || ""
      };
    });
    const lastDoc = snap.docs.at(-1);
    const lastCreatedAt = lastDoc ? timestamp(lastDoc.data().createdAt) : null;
    const nextCursor = snap.docs.length === MAX_PAGE_SIZE && lastCreatedAt ? String(new Date(lastCreatedAt).getTime()) : null;
    return res.status(200).json({ ok: true, records, nextCursor, hasMore: !!nextCursor });
  };
}

module.exports = { createExportClassRecordsHandler };
