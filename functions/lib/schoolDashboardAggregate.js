"use strict";

// Keeps one small per-class aggregate document up to date on every sorting
// record write, so the PC dashboard can read a single cheap document instead
// of scanning every student's records. A record affects the aggregate only
// if it carries a classContext (school/grade/class) AND GPS verified it as
// on-campus (onCampus === true, set by saveSortingRecord after consuming a
// checkCampusLocation result) -- everything else (no classContext, GPS
// denied/failed, GPS never attempted) stays a personal-only record.
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
    // GPS 교내판정(5단계): "교내 기록만 학급/학교 경쟁에 반영, 교외는 개인
    // 배지만"이라는 결정을 애매한 중간상태 없이 그대로 구현한다 - onCampus가
    // true로 실제 검증된 기록만 집계하고, GPS를 거부/실패했거나 애초에 시도
    // 조차 안 한 기록은(둘 다 학생 입장에선 "확인 안 됨") 똑같이 제외한다.
    // 개인 기록·배지는 이 트리거와 무관한 클라이언트 로컬 통계라 그대로 남는다.
    if (after.onCampus !== true) return;

    const isNew = !before;
    const wasHeld = before?.status === "held";
    const isCompleted = after.status === "completed";
    const isHeld = after.status === "held";
    const itemId = typeof after.userDecision?.selectedItemId === "string" ? after.userDecision.selectedItemId : "";

    // Only two transitions ever change the aggregate: a brand-new record, or
    // an existing held record getting resolved to completed. Anything else
    // (e.g. an idempotent re-save of the same completed record) is a no-op.
    if (!isNew && !(wasHeld && isCompleted)) return;

    const schoolRef = db.collection("schools").doc(schoolId);
    const classRef = schoolRef.collection("classes").doc(classDocId(grade, classNum));
    const today = seoulDateString(now());
    // schoolId는 나이스 학교코드라 그 자체로는 사람이 못 읽는다 - 대시보드/
    // 랭킹 화면에 보여줄 표시용 이름을 학교 문서(부모) 하나에만 저장해둔다
    // (반마다 중복 저장할 필요 없음).
    const schoolName = typeof classContext.schoolName === "string" && classContext.schoolName.trim() ? classContext.schoolName.trim() : "";

    // 개인별 랭킹(6단계): 학생이 실명 검증 없이 자율로 적은 번호/이름을
    // 그대로 쓴다(교사가 부모 동의 하에 결정) - studentNumber가 있는
    // 기록만(가입 전 임시 입력 단계는 번호가 없을 수 있음) 반 문서 밑
    // students 서브컬렉션에 완료 횟수를 집계한다. 반 집계와 같은
    // 트랜잭션 안에서 처리해 둘이 서로 어긋나지 않게 한다.
    const studentNumber = typeof classContext.studentNumber === "string" ? classContext.studentNumber.trim() : "";
    const studentName = typeof classContext.studentName === "string" ? classContext.studentName.trim() : "";
    const studentRef = studentNumber ? classRef.collection("students").doc(studentNumber) : null;

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(classRef);
      const data = snap.exists ? snap.data() : {};
      // schoolName은 학생 자율입력이라 검증 수단이 없다 - 매번 최신 값으로
      // 덮어쓰면 아무 학생이나 전국 랭킹판에 뜨는 학교 표시명을 마음대로
      // 바꿔칠 수 있다. 그 학교의 첫 기록이 정한 이름을 그대로 고정해
      // ("최초 작성자 승리") 이후 기록은 절대 못 바꾸게 한다 - 완벽한
      // 검증은 아니지만 "누구나 아무때나 변조 가능"은 막는다.
      const schoolSnap = schoolName ? await transaction.get(schoolRef) : null;
      const schoolNameLocked = !!schoolSnap?.exists && typeof schoolSnap.data()?.schoolName === "string" && schoolSnap.data().schoolName;
      const observedToday = data.lastResetDate === today ? Number(data.observedToday) || 0 : 0;
      const itemCounts = { ...(data.itemCounts && typeof data.itemCounts === "object" ? data.itemCounts : {}) };
      let completedTotal = Number(data.completedTotal) || 0;
      let heldTotal = Number(data.heldTotal) || 0;
      let convertedTotal = Number(data.convertedTotal) || 0;
      let observedTodayNext = observedToday;
      const studentSnap = studentRef ? await transaction.get(studentRef) : null;

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
      if (schoolName && !schoolNameLocked) transaction.set(schoolRef, { schoolName, updatedAt: serverTimestamp() }, { merge: true });
      if (studentRef && isCompleted) {
        const studentData = studentSnap?.exists ? studentSnap.data() : {};
        const studentCompletedTotal = (Number(studentData.completedTotal) || 0) + 1;
        transaction.set(studentRef, {
          studentNumber, ...(studentName ? { studentName } : {}), completedTotal: studentCompletedTotal, updatedAt: serverTimestamp()
        }, { merge: true });
      }
    });
  };
}

module.exports = { createSortingRecordAggregator, seoulDateString, classDocId };
