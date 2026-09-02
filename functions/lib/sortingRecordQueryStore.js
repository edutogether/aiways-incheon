"use strict";

// 2026-09-02 재감사(아키텍처): listSortingRecords/resolveSortingRecord가 쓰는
// Firestore 계약이 functions/index.js 안에 인라인 객체로만 존재했다 -
// sortingRecordStore.js가 바로 이 이유로(“유일한 구현이 테스트가 닿을 수 없는
// index.js 안에 있어서, 필드 하나가 바뀐 걸 유닛테스트 120개가 전부 초록불인
// 채로 프로덕션까지 통과시킨” 실제 장애) 별도 파일로 분리됐는데, 조회/재검토
// 쪽은 같은 정리가 안 돼 같은 함정이 그대로 남아 있었다. 여기로 옮겨
// 의존성 주입 형태로 만들고 sortingRecordQueryStore.test.js로 계약을 고정한다.
//
// 같이 고친 결함: 예전 인라인 구현은 cursor로 넘어온 recordId가 실제로 없는
// 문서일 때 존재하지 않는 DocumentSnapshot을 그대로 startAfter에 넘겼다 -
// Firestore 어드민 SDK가 예외를 던져 조회 전체가 503으로 떨어진다(기록을
// 지운 뒤 예전 커서를 들고 재시도하면 재현). 없는 커서는 "커서 없음"과 같게
// 첫 페이지부터 돌려준다.
function createRecordQueryStore({ db }) {
  const recordsOf = (actorId) => db.collection("actors").doc(actorId).collection("records");
  return {
    async list(actorId, size, cursor, filter) {
      const records = recordsOf(actorId);
      let query = records.orderBy("createdAt", "desc").limit(size + 1);
      if (filter !== "all") query = query.where("status", "==", filter);
      if (cursor) {
        const cursorSnap = await records.doc(cursor).get();
        if (cursorSnap.exists) query = query.startAfter(cursorSnap);
      }
      const snap = await query.get();
      const docs = snap.docs.slice(0, size);
      return {
        records: docs.map((doc) => ({ id: doc.id, data: doc.data() })),
        nextCursor: snap.docs.length > size ? docs.at(-1).id : null
      };
    },
    async resolve(actorId, body, serverTime) {
      const record = recordsOf(actorId).doc(body.recordId);
      const key = db.collection("actors").doc(actorId).collection("_resolutions").doc(body.idempotencyKey);
      return db.runTransaction(async (transaction) => {
        const prior = await transaction.get(key);
        if (prior.exists) return { ...prior.data(), duplicate: true };
        const snap = await transaction.get(record);
        if (!snap.exists) return { code: "not_found" };
        if (snap.data().status !== "held") return { code: "conflict" };
        const result = { recordId: body.recordId, status: "completed", resolutionType: body.resolutionType, duplicate: false };
        transaction.update(record, {
          status: "completed", updatedAt: serverTime, resolvedAt: serverTime,
          resolutionType: body.resolutionType, userDecision: body.userDecision, checklist: body.checklist
        });
        transaction.create(key, result);
        return result;
      });
    }
  };
}

module.exports = { createRecordQueryStore };
