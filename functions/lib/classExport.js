"use strict";

// 3단 권한체계 5단계(2026-08-31 대표님 지시) - CSV 반전체 내보내기.
// app.js의 기존 CSV 내보내기(exportMySortingRecordsAsCsv)는 "이 기기(actor)가
// 저장한 기록"만 돌려준다(listSortingRecords) - 학교/반 전체를 모으는 진짜
// "선생님용 내보내기"는 교사 인증 개념이 없어서 막혀 있었다(1단계로 해결).
// teacherVerified된 actor만, 자기 학교의 특정 반 기록을 collectionGroup
// 쿼리로 모아 돌려준다 - actors/*/records는 개인 actor마다 나뉜 서브컬렉션
// 이라 반 단위로 보려면 collectionGroup 쿼리가 유일한 방법이다.
const { FieldPath } = require("firebase-admin/firestore");
const { guardedTeacher } = require("./teacherAuth");

const DIGITS = /^\d{1,2}$/;
// 2026-09-01 종합감사(B그룹 5번): 예전엔 createdAt(ms) 단독 커서라 ①같은
// 밀리초에 여러 기록이 있으면 페이지 경계에서 일부가 조용히 누락될 수
// 있었고(startAfter(Date)는 그 값 "이하" 전부를 건너뜀), ②정확히
// MAX_PAGE_SIZE인 마지막 페이지 뒤에 빈 요청이 한 번 더 나갔다. createdAt +
// 문서경로(actorId/recordId)를 함께 정렬·커서로 써서 완전히 결정론적인
// 페이지 경계를 만든다 - collectionGroup 쿼리라 이전 페이지의
// DocumentSnapshot을 들고 있을 수 없으므로, 커서 문자열 자체에 다음 페이지
// 시작점을 재구성할 수 있는 값(ms:actorId:recordId)을 왕복시킨다.
const CURSOR_PATTERN = /^\d{1,20}:[A-Za-z0-9_-]{1,128}:[A-Za-z0-9]{1,40}$/;
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
    if (body.cursor !== undefined && !CURSOR_PATTERN.test(String(body.cursor))) return res.status(400).json({ ok: false, code: "invalid_request" });

    let query = db.collectionGroup("records")
      .where("classContext.schoolId", "==", teacher.schoolId)
      .where("classContext.grade", "==", grade)
      .where("classContext.classNum", "==", classNum)
      .orderBy("createdAt", "asc")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(MAX_PAGE_SIZE + 1); // +1 so we know if there's a next page without a trailing empty request
    if (body.cursor) {
      const [ms, actorId, recordId] = String(body.cursor).split(":");
      const cursorRef = db.collection("actors").doc(actorId).collection("records").doc(recordId);
      query = query.startAfter(new Date(Number(ms)), cursorRef);
    }

    // 2026-09-01 종합감사(B그룹 3번): collectionGroup 쿼리에 try/catch가
    // 없어서 일시적 Firestore 장애 시 타임아웃까지 응답 없이 멈출 수 있었다 -
    // 다른 핸들러들과 같은 503 protection_unavailable 컨벤션 적용.
    try {
      const snap = await query.get();
      const hasMore = snap.docs.length > MAX_PAGE_SIZE;
      const pageDocs = hasMore ? snap.docs.slice(0, MAX_PAGE_SIZE) : snap.docs;
      const records = pageDocs.map((doc) => {
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
      const lastDoc = pageDocs.at(-1);
      const lastCreatedAt = lastDoc ? timestamp(lastDoc.data().createdAt) : null;
      const nextCursor = hasMore && lastCreatedAt && lastDoc
        ? `${new Date(lastCreatedAt).getTime()}:${lastDoc.ref.parent.parent.id}:${lastDoc.id}`
        : null;
      return res.status(200).json({ ok: true, records, nextCursor, hasMore });
    } catch {
      return res.status(503).json({ ok: false, code: "protection_unavailable" });
    }
  };
}

module.exports = { createExportClassRecordsHandler };
