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
        if (bindingSnap.exists) {
          // Lost a race against a concurrent request for the same brand-new uid.
          if (bindingSnap.data()?.status !== "active" || !actorSnap.exists || !deviceSnap.exists) return failure("access_state_invalid", 503);
          return { ok: true, actorId: uid, uid, actor: actorSnap.data(), device: deviceSnap.data() };
        }
        const managementId = randomUUID();
        if (!MANAGEMENT_ID.test(managementId)) return failure("access_state_invalid", 503);
        const actor = { plan: OPEN_ACCESS_PLAN, status: "active", displayName: "공개 링크 방문자", maxDevices: 1, activeDeviceCount: 1, createdAt: now, updatedAt: now };
        const device = { uid, managementId, status: "active", deviceLabel: "공개 링크 접속", platform: "web", createdAt: now, lastSeenAt: now };
        transaction.create(actorRef, actor);
        transaction.create(deviceRef, device);
        transaction.create(bindingRef, { actorId: uid, status: "active", createdAt: now, lastSeenAt: now });
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
        if (!actorSnap.exists || actorSnap.data()?.status !== "active" || !["closed_beta", OPEN_ACCESS_PLAN].includes(actorSnap.data()?.plan)) return failure("actor_unavailable", 403);
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
