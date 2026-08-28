"use strict";

const { randomUUID } = require("node:crypto");

const UID = /^[A-Za-z0-9_-]{1,128}$/;
const MANAGEMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPEN_ACCESS_PLAN = "open_access";

function extractBearer(req) {
  const value = req?.headers?.authorization ?? req?.headers?.Authorization;
  const match = typeof value === "string" ? /^Bearer\s+([^\s]+)$/i.exec(value) : null;
  return match ? match[1] : "";
}

function failure(code, httpStatus) { return { ok: false, code, httpStatus }; }

function createEdu2gDeviceAccess({ auth, db, serverTimestamp = () => new Date() } = {}) {
  async function authenticate(req) {
      const token = extractBearer(req);
      if (!token) return failure("auth_missing", 401);
      let decoded;
      try { decoded = await auth?.verifyIdToken?.(token); } catch { return failure("auth_invalid", 401); }
      const uid = decoded?.uid;
      if (!UID.test(uid || "")) return failure("auth_invalid", 401);
      if (decoded?.firebase?.sign_in_provider !== "anonymous") return failure("anonymous_auth_required", 403);
      return { ok: true, uid };
  }
  // The closed-beta secret-code gate was retired: any legitimate anonymous
  // Firebase session (still gated by App Check, still Firebase-authenticated)
  // gets a fresh single-device "actor" auto-provisioned on its first request
  // instead of being rejected for lacking a device binding. This keeps every
  // downstream check (per-actor rate limiting, record storage keyed by
  // actorId, revocation) working unchanged -- it just removes the manual
  // code-redemption step in front of it.
  async function provisionOpenAccessActor(uid) {
    const now = serverTimestamp();
    const bindingRef = db.collection("edu2gDeviceBindings").doc(uid);
    const actorRef = db.collection("actors").doc(uid);
    const deviceRef = actorRef.collection("trustedDevices").doc(uid);
    try {
      return await db.runTransaction(async transaction => {
        const [bindingSnap, actorSnap, deviceSnap] = await Promise.all([transaction.get(bindingRef), transaction.get(actorRef), transaction.get(deviceRef)]);
        // 바인딩+액터+기기가 셋 다 이미 일관되게 있으면(동시요청 경합 또는
        // 이미 프로비저닝된 상태) 그대로 재사용한다.
        if (bindingSnap.exists && bindingSnap.data()?.status === "active" && actorSnap.exists && deviceSnap.exists) {
          return { ok: true, actorId: uid, uid, actor: actorSnap.data(), device: deviceSnap.data() };
        }
        // 그 외 모든 경우 - 바인딩이 아예 없거나(진짜 새 방문자), 바인딩은
        // 있는데 actor/device 문서가 없어진 경우(2026-08-27 실사용 제보로
        // 발견: 관리자가 actors 컬렉션만 지우고 edu2gDeviceBindings는 안
        // 지운 경우 이 상태가 되어 이 uid가 영구히 actor_unavailable로
        // 막혔었다) - 셋 다 새로 만든다. set()이라 기존 문서가 있어도
        // 덮어써서 안전하다(create()는 기존 문서가 있으면 예외를 던짐).
        const managementId = randomUUID();
        if (!MANAGEMENT_ID.test(managementId)) return failure("access_state_invalid", 503);
        const actor = { plan: OPEN_ACCESS_PLAN, status: "active", displayName: "공개 링크 방문자", maxDevices: 1, activeDeviceCount: 1, createdAt: now, updatedAt: now };
        const device = { uid, managementId, status: "active", deviceLabel: "공개 링크 접속", platform: "web", createdAt: now, lastSeenAt: now };
        transaction.set(actorRef, actor);
        transaction.set(deviceRef, device);
        transaction.set(bindingRef, { actorId: uid, status: "active", createdAt: now, lastSeenAt: now });
        return { ok: true, actorId: uid, uid, actor, device };
      });
    } catch { return failure("access_state_invalid", 503); }
  }
  return {
    authenticate,
    async resolve(req) {
      const identity = await authenticate(req);
      if (!identity.ok) return identity;
      const uid = identity.uid;
      try {
        const bindingRef = db.collection("edu2gDeviceBindings").doc(uid);
        const bindingSnap = await bindingRef.get();
        if (!bindingSnap.exists) return provisionOpenAccessActor(uid);
        const binding = bindingSnap.data() || {};
        if (binding.status === "revoked") return failure("device_revoked", 403);
        if (binding.status !== "active" || typeof binding.actorId !== "string") return failure("access_state_invalid", 503);
        const actorRef = db.collection("actors").doc(binding.actorId);
        const deviceRef = actorRef.collection("trustedDevices").doc(uid);
        const [actorSnap, deviceSnap] = await Promise.all([actorRef.get(), deviceRef.get()]);
        if (!actorSnap.exists) {
          // 2026-08-27 실사용 제보(searchSchool이 항상 403 actor_unavailable,
          // 이어서 카카오톡 인앱브라우저에서 아예 접속 자체가 안 됨)로 발견:
          // binding은 남아있는데 actors 문서만 없어지면(예: 관리자가 actors
          // 컬렉션만 지우고 edu2gDeviceBindings는 안 지운 경우) 이 uid가
          // 영구히 actor_unavailable로 막혔다 - 재시도해도, 새로고침해도
          // 절대 스스로 못 벗어남. 처음엔 open_access(actorId===uid)만
          // 자가치유 대상으로 좁혔었는데, closed_beta(공유 액터,
          // actorId!==uid)로 바인딩된 기기도 실사용에서 같은 증상으로
          // 걸리는 게 확인됐다 - closed-beta 시크릿코드 게이트 자체가
          // 이미 퇴역했으므로(위 provisionOpenAccessActor 주석 참고), 공유
          // 액터가 사라진 것도 더 이상 "의도적으로 막힌 상태"가 아니라
          // 똑같이 방치된 잔재일 뿐이다. actor 문서가 실제로 없으면(단순
          // status가 비활성인 것과는 다름, 아래 줄에서 별도 처리) 무조건
          // 이 기기를 새 open_access 방문자로 재프로비저닝한다.
          return provisionOpenAccessActor(uid);
        }
        if (actorSnap.data()?.status !== "active" || !["closed_beta", OPEN_ACCESS_PLAN].includes(actorSnap.data()?.plan)) return failure("actor_unavailable", 403);
        const device = deviceSnap.exists ? deviceSnap.data() || {} : null;
        if (!device) return failure("access_state_invalid", 503);
        if (device.status === "revoked") return failure("device_revoked", 403);
        if (device.status !== "active" || device.uid !== uid || !MANAGEMENT_ID.test(device.managementId || "")) return failure("access_state_invalid", 503);
        // 2026-08-27 재감사 지적: 이 자리에서 매 요청(14개 엔드포인트
        // 전부)마다 lastSeenAt을 문서 2개에 갱신하고 있었는데, 이 값을
        // 읽는 코드가 저장소 어디에도 없었다 - 아무도 안 쓰는 필드에
        // 요청마다 쓰기 비용만 나가고 있어서 제거함. (기기 생성/교체/
        // 해제 시점의 lastSeenAt은 edu2gPassHandlers.js에 그대로 남아있고,
        // 그건 일회성 이벤트라 이 항목과는 무관하다.)
        return { ok: true, actorId: binding.actorId, uid, actor: actorSnap.data(), device };
      } catch { return failure("access_state_invalid", 503); }
    }
  };
}

module.exports = { UID, MANAGEMENT_ID, extractBearer, createEdu2gDeviceAccess };
