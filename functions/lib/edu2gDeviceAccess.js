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
          // 2026-08-27 실사용 제보(searchSchool이 항상 403 actor_unavailable)로
          // 발견: open_access 방식(1기기=1액터, actorId===uid)은 binding은
          // 남아있는데 actors 문서만 없어지면(예: 관리자가 actors 컬렉션만
          // 지우고 edu2gDeviceBindings는 안 지운 경우) 이 uid가 영구히
          // actor_unavailable로 막혔다 - 재시도해도, 새로고침해도 절대
          // 스스로 못 벗어남. 이 조합(actorId===uid)만 새 방문자처럼
          // 재프로비저닝해서 자가치유시킨다. closed_beta(공유 액터,
          // actorId!==uid)는 대상에서 제외 - 공유 액터가 사라진 건 다른
          // 종류의 이상 상태라 그대로 차단 유지한다.
          if (binding.actorId === uid) return provisionOpenAccessActor(uid);
          return failure("actor_unavailable", 403);
        }
        if (actorSnap.data()?.status !== "active" || !["closed_beta", OPEN_ACCESS_PLAN].includes(actorSnap.data()?.plan)) return failure("actor_unavailable", 403);
        const device = deviceSnap.exists ? deviceSnap.data() || {} : null;
        if (!device) return failure("access_state_invalid", 503);
        if (device.status === "revoked") return failure("device_revoked", 403);
        if (device.status !== "active" || device.uid !== uid || !MANAGEMENT_ID.test(device.managementId || "")) return failure("access_state_invalid", 503);
        await Promise.all([bindingRef.update({ lastSeenAt: serverTimestamp() }), deviceRef.update({ lastSeenAt: serverTimestamp() })]);
        return { ok: true, actorId: binding.actorId, uid, actor: actorSnap.data(), device };
      } catch { return failure("access_state_invalid", 503); }
    }
  };
}

module.exports = { UID, MANAGEMENT_ID, extractBearer, createEdu2gDeviceAccess };
