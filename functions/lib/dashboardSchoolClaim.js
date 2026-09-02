"use strict";

// 비용절감 4번(2026-09-02 대표님 승인, 실시간 리스너 마이그레이션) - firestore.rules가
// schools/{schoolId}(+classes 서브컬렉션) 직접 읽기를 request.auth.token.dashboardSchoolId로만
// 판정하므로, actors/{actorId}.dashboardSchoolId가 정해지거나 바뀌는 모든 지점
// (schoolDashboard.js/classRanking.js의 최초 잠금, teacherAuth.js의 잘못된 잠금 교정)에서
// 이 클레임도 같이 맞춰줘야 한다 - 안 그러면 rules가 보는 값과 실제 값이 어긋나 클라이언트의
// 실시간 구독이 계속 거절된다. 클레임 설정은 부가 최적화일 뿐(실패해도 폴링 경로가 그대로
// 살아있음)이라, 실패는 로그만 남기고 삼킨다 - 이 실패로 기존 기능(대시보드/랭킹/교사인증)까지
// 막으면 안 된다.
async function setDashboardSchoolClaim({ auth, uid, schoolId, logger }) {
  if (!auth || !uid || !schoolId) return;
  try {
    await auth.setCustomUserClaims(uid, { dashboardSchoolId: schoolId });
  } catch (error) {
    logger?.({ severity: "WARNING", message: "dashboard_school_claim_failed", uid, schoolId, error: error?.message });
  }
}

module.exports = { setDashboardSchoolClaim };
