"use strict";

const UID = /^[A-Za-z0-9_-]{1,128}$/;
const MANAGEMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  return {
    authenticate,
    async resolve(req) {
      const identity = await authenticate(req);
      if (!identity.ok) return identity;
      const uid = identity.uid;
      try {
        const bindingRef = db.collection("edu2gDeviceBindings").doc(uid);
        const bindingSnap = await bindingRef.get();
        if (!bindingSnap.exists) return failure("device_not_registered", 403);
        const binding = bindingSnap.data() || {};
        if (binding.status === "revoked") return failure("device_revoked", 403);
        if (binding.status !== "active" || typeof binding.actorId !== "string") return failure("access_state_invalid", 503);
        const actorRef = db.collection("actors").doc(binding.actorId);
        const deviceRef = actorRef.collection("trustedDevices").doc(uid);
        const [actorSnap, deviceSnap] = await Promise.all([actorRef.get(), deviceRef.get()]);
        if (!actorSnap.exists || actorSnap.data()?.status !== "active" || actorSnap.data()?.plan !== "closed_beta") return failure("actor_unavailable", 403);
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
