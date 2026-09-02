"use strict";

// 비용절감 4번 2단계(2026-09-02 대표님 승인) - schools/{schoolId}/classes(PII
// 없는 반 집계)를 Functions 폴링(5초) 대신 Firestore onSnapshot으로 직접
// 구독한다. firestore.rules/dashboardSchoolClaim.js(1단계, 이미 배포됨)가
// request.auth.token.dashboardSchoolId 클레임으로만 학교 격리를 강제하므로,
// 여기서 하는 집계(school 합계/gradeBars/반별 순위/topItems)는 schoolDashboard.js의
// 순수 계산 로직을 그대로 클라이언트로 옮긴 것이다 - 실명이 들어가는
// topStudents만은 이 경로로 절대 못 받는다(rules가 students 서브컬렉션은
// 계속 막음) - 그 필드는 기존 getSchoolDashboard 폴링이 계속 채워준다.
//
// 병행 운영 원칙(설계안 ④단계 전까지): 이 모듈은 기존 5초 폴링을 대체하지
// 않는다. 폴링은 그대로 두고, 이 실시간 구독은 "더 빠른 갱신"만 추가로
// 제공한다 - 리스너가 실패해도(권한 문제/네트워크) 폴링이 그대로 화면을
// 계속 갱신하므로 사용자 관점에서 아무것도 깨지지 않는다.
(() => {
  const SDK_VERSION = "11.10.0";
  let firestorePromise = null;
  async function loadFirestore() {
    if (firestorePromise) return firestorePromise;
    firestorePromise = import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`);
    return firestorePromise;
  }

  function classSummary(data) {
    const completedTotal = Number(data?.completedTotal) || 0;
    const heldTotal = Number(data?.heldTotal) || 0;
    return {
      grade: String(data?.grade ?? ""), classNum: String(data?.classNum ?? ""),
      observedToday: Number(data?.observedToday) || 0,
      completedTotal, heldTotal, observedTotal: completedTotal + heldTotal,
      convertedTotal: Number(data?.convertedTotal) || 0,
      itemCounts: data?.itemCounts && typeof data.itemCounts === "object" ? data.itemCounts : {}
    };
  }

  function topItems(itemCounts, limit = 5) {
    return Object.entries(itemCounts || {})
      .map(([itemId, count]) => ({ itemId, count: Number(count) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // functions/lib/schoolDashboard.js의 집계 로직과 동일하게 유지할 것 -
  // 서버가 바뀌면 여기도 같이 바꿔야 두 경로가 어긋나지 않는다.
  function computeDashboardData({ classDocs, schoolName, grade, classNum, previousTopStudents }) {
    const classes = classDocs.map(classSummary);
    const byGrade = new Map();
    let schoolObservedToday = 0, schoolCompletedTotal = 0, schoolHeldTotal = 0;
    const schoolItemCounts = {};
    for (const item of classes) {
      schoolObservedToday += item.observedToday;
      schoolCompletedTotal += item.completedTotal;
      schoolHeldTotal += item.heldTotal;
      byGrade.set(item.grade, (byGrade.get(item.grade) || 0) + item.observedToday);
      for (const [id, count] of Object.entries(item.itemCounts)) schoolItemCounts[id] = (schoolItemCounts[id] || 0) + count;
    }
    const gradeBars = [...byGrade.entries()].map(([g, observedToday]) => ({ grade: g, observedToday })).sort((a, b) => a.grade.localeCompare(b.grade, "ko"));

    let selectedClass = null;
    if (grade && classNum) {
      const match = classes.find((item) => item.grade === grade && item.classNum === classNum) || { grade, classNum, observedToday: 0, completedTotal: 0, heldTotal: 0, observedTotal: 0, convertedTotal: 0, itemCounts: {} };
      const gradeSiblings = [...classes.filter((item) => item.grade === grade)].sort((a, b) => b.observedToday - a.observedToday);
      const schoolRanked = [...classes].sort((a, b) => b.observedToday - a.observedToday);
      const gradeRank = gradeSiblings.findIndex((item) => item.classNum === classNum);
      const schoolRank = schoolRanked.findIndex((item) => item.grade === grade && item.classNum === classNum);
      selectedClass = {
        grade: match.grade, classNum: match.classNum,
        observedToday: match.observedToday, completedTotal: match.completedTotal, heldTotal: match.heldTotal, convertedTotal: match.convertedTotal,
        topItems: topItems(match.itemCounts), topStudents: Array.isArray(previousTopStudents) ? previousTopStudents : [],
        rankInGrade: gradeRank >= 0 ? gradeRank + 1 : gradeSiblings.length + 1,
        gradeSize: Math.max(gradeSiblings.length, 1),
        rankInSchool: schoolRank >= 0 ? schoolRank + 1 : schoolRanked.length + 1,
        schoolSize: Math.max(schoolRanked.length, 1)
      };
    }

    return {
      ok: true, schoolName, classCount: classes.length,
      school: { observedToday: schoolObservedToday, completedTotal: schoolCompletedTotal, heldTotal: schoolHeldTotal, observedTotal: schoolCompletedTotal + schoolHeldTotal, topItems: topItems(schoolItemCounts) },
      gradeBars, selectedClass
    };
  }

  // schoolId의 school-lock이 처음 확정된 "이후"에만 호출해야 한다(그래야
  // 커스텀 클레임이 서버에 이미 심겨 있다). 클레임은 토큰 재발급 전까진
  // idToken에 안 실리므로, 구독 시작 전에 강제로 한 번 갱신한다.
  //
  // grade/classNum은 구독 시점 값을 고정하지 않는다 - 사용자가 반을
  // 바꿔도 재구독 없이 최신 선택을 반영하도록, 스냅샷이 올 때마다
  // onUpdate가 raw classDocs/schoolName만 받고 grade/classNum은 호출부가
  // 그 순간 다시 읽어서 computeDashboardData를 직접 부른다.
  async function subscribeSchoolClasses({ schoolId, onUpdate, onError }) {
    try {
      const betaAuth = window.AIWaysBetaAuth;
      if (!betaAuth) throw new Error("beta_auth_unavailable");
      await betaAuth.getEdu2gDeviceSession({ forceRefresh: true });
      const base = await window.AIWaysAppCheck?.initializeAIWaysAppCheck?.();
      if (!base?.app) throw new Error("firebase_app_unavailable");
      const { getFirestore, collection, doc, onSnapshot, connectFirestoreEmulator } = await loadFirestore();
      const db = getFirestore(base.app);
      if (betaAuth.emulatorRequested?.()) connectFirestoreEmulator(db, "127.0.0.1", 8080);

      let schoolName = "";
      const unsubSchool = onSnapshot(doc(db, "schools", schoolId), (snap) => {
        schoolName = snap.exists() ? String(snap.data()?.schoolName || "") : "";
      }, (error) => onError?.(error));

      const unsubClasses = onSnapshot(collection(db, "schools", schoolId, "classes"), (snap) => {
        onUpdate({ classDocs: snap.docs.map((d) => d.data()), schoolName });
      }, (error) => onError?.(error));

      return () => { unsubSchool(); unsubClasses(); };
    } catch (error) {
      onError?.(error);
      return () => {};
    }
  }

  window.AIWaysDashboardRealtime = { subscribeSchoolClasses, computeDashboardData };
})();
