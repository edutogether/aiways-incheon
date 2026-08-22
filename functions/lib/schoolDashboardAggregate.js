"use strict";

// Keeps one small per-class aggregate document up to date on every sorting
// record write, so the PC dashboard can read a single cheap document instead
// of scanning every student's records. Only records that carry a
// classContext (the interim school/grade/class the student picked) affect
// any aggregate -- records without one are simply not counted anywhere yet.
function classDocId(grade, classNum) {
  return `${grade}_${classNum}`;
}

function seoulDateString(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function createSortingRecordAggregator({ db, serverTimestamp, now = () => new Date() }) {
  return async function aggregateSortingRecordWrite(before, after) {
    if (!after) return; // record deleted -- this app never deletes records, but ignore defensively
    const classContext = after.classContext;
    if (!classContext || typeof classContext !== "object") return;
    const schoolId = classContext.schoolId, grade = classContext.grade, classNum = classContext.classNum;
    if (!schoolId || !grade || !classNum) return;

    const isNew = !before;
    const wasHeld = before?.status === "held";
    const isCompleted = after.status === "completed";
    const isHeld = after.status === "held";
    const itemId = typeof after.userDecision?.selectedItemId === "string" ? after.userDecision.selectedItemId : "";

    // Only two transitions ever change the aggregate: a brand-new record, or
    // an existing held record getting resolved to completed. Anything else
    // (e.g. an idempotent re-save of the same completed record) is a no-op.
    if (!isNew && !(wasHeld && isCompleted)) return;

    const classRef = db.collection("schools").doc(schoolId).collection("classes").doc(classDocId(grade, classNum));
    const today = seoulDateString(now());

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(classRef);
      const data = snap.exists ? snap.data() : {};
      const observedToday = data.lastResetDate === today ? Number(data.observedToday) || 0 : 0;
      const itemCounts = { ...(data.itemCounts && typeof data.itemCounts === "object" ? data.itemCounts : {}) };
      let completedTotal = Number(data.completedTotal) || 0;
      let heldTotal = Number(data.heldTotal) || 0;
      let convertedTotal = Number(data.convertedTotal) || 0;
      let observedTodayNext = observedToday;

      if (isNew) {
        observedTodayNext += 1;
        if (itemId) itemCounts[itemId] = (itemCounts[itemId] || 0) + 1;
        if (isCompleted) completedTotal += 1;
        if (isHeld) heldTotal += 1;
      } else {
        heldTotal = Math.max(0, heldTotal - 1);
        completedTotal += 1;
        convertedTotal += 1;
      }

      transaction.set(classRef, {
        schoolId, grade, classNum,
        observedToday: observedTodayNext, lastResetDate: today,
        completedTotal, heldTotal, convertedTotal, itemCounts,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  };
}

module.exports = { createSortingRecordAggregator, seoulDateString, classDocId };
