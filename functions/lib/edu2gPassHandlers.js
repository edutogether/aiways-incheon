"use strict";

const { UID } = require("./edu2gDeviceAccess");
const { MAX_DEVICES } = require("./edu2gPassRegistry");
const { observeAppCheck } = require("./appCheckProtection");
const { randomUUID } = require("node:crypto");

const ORIGIN = /^(https:\/\/edutogether\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const LABEL = /^[^\u0000-\u001f\u007f<>]{1,48}$/u;
const PLATFORM = /^[^\u0000-\u001f\u007f<>]{1,32}$/u;
const MANAGEMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(res, status, body) { return res.status(status).json(body); }
function allowedOrigin(req, res) {
  const origin = req.headers?.origin;
  if (!origin) return true;
  if (!ORIGIN.test(origin)) { response(res, 403, { ok: false, code: "origin_not_allowed" }); return false; }
  res.set("Access-Control-Allow-Origin", origin); res.set("Vary", "Origin"); return true;
}
function baseGuard(req, res, fields) {
  if (!allowedOrigin(req, res)) return false;
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Methods", "POST, OPTIONS"); res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck"); res.status(204).send(); return false; }
  if (req.method !== "POST") { response(res, 405, { ok: false, code: "method_not_allowed" }); return false; }
  const contentType = String(req.headers?.["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) { response(res, 415, { ok: false, code: "content_type_invalid" }); return false; }
  if (Number(req.headers?.["content-length"] || 0) > 2048) { response(res, 413, { ok: false, code: "request_too_large" }); return false; }
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !fields.includes(key))) { response(res, 400, { ok: false, code: "invalid_request" }); return false; }
  return true;
}
async function protect(req, res, functionName, dependencies) {
  const appCheck = dependencies.appCheck || (options => observeAppCheck(options.req, options));
  const observed = await appCheck({ req, functionName, logger: dependencies.logAppCheck });
  if (observed.httpStatus) { response(res, observed.httpStatus, { ok: false, code: observed.code }); return null; }
  const access = await (functionName === "redeemEdu2gPass" ? dependencies.access.authenticate(req) : dependencies.access.resolve(req));
  if (!access.ok) { response(res, access.httpStatus, { ok: false, code: access.code }); return null; }
  // redeemEdu2gPass hasn't resolved an actorId yet at this point (only a raw
  // uid) -- its own blockedActors check happens later in redeem(), once the
  // registry lookup produces the actorId being redeemed against.
  if (dependencies.blockedActors && access.actorId) {
    const blocked = await dependencies.blockedActors.isBlocked(access.actorId).catch(() => false);
    if (blocked) { response(res, 403, { ok: false, code: "actor_blocked" }); return null; }
  }
  const limit = await dependencies.rateLimiter.check(functionName);
  if (!limit?.allowed) { response(res, limit?.outcome === "unavailable" ? 503 : 429, { ok: false, code: limit?.outcome === "unavailable" ? "protection_unavailable" : "rate_limited" }); return null; }
  const scoped = await dependencies.actorRateLimiter?.check?.(functionName, functionName === "redeemEdu2gPass" ? access.uid : access.actorId);
  if (scoped && !scoped.allowed) { response(res, scoped.outcome === "unavailable" ? 503 : 429, { ok: false, code: scoped.outcome === "unavailable" ? "protection_unavailable" : "rate_limited" }); return null; }
  return access;
}

function createFirestoreDeviceStore({ db, serverTimestamp = () => new Date(), createManagementId = randomUUID }) {
  const actorRef = actorId => db.collection("actors").doc(actorId);
  return {
    async prepare({ uid, actor }) {
      const bindingSnap = await db.collection("edu2gDeviceBindings").doc(uid).get();
      if (bindingSnap.exists && bindingSnap.data()?.actorId !== actor.actorId) return { code: "device_already_bound" };
      if (bindingSnap.exists && bindingSnap.data()?.status === "active") return { ok: true, alreadyRegistered: true };
      const actorSnap = await actorRef(actor.actorId).get(); const current = actorSnap.exists ? actorSnap.data() || {} : null;
      if (current && (current.status !== "active" || current.plan !== "closed_beta" || current.maxDevices !== MAX_DEVICES)) return { code: "actor_unavailable" };
      const activeDeviceCount = Number(current?.activeDeviceCount || 0);
      if (!Number.isInteger(activeDeviceCount) || activeDeviceCount < 0) return { code: "access_state_invalid" };
      if (activeDeviceCount < MAX_DEVICES) return { ok: true, requiresDeviceConfirmation: true, activeDeviceCount };
      const devices = await actorRef(actor.actorId).collection("trustedDevices").where("status", "==", "active").get();
      return { code: "device_limit_reached", devices: devices.docs.map(doc => { const data = doc.data() || {}; return { managementId: data.managementId, deviceLabel: data.deviceLabel, platform: data.platform }; }) };
    },
    async redeem({ uid, actor, replaceManagementId = "" }) {
      const bindingRef = db.collection("edu2gDeviceBindings").doc(uid);
      const userActorRef = actorRef(actor.actorId);
      const deviceRef = userActorRef.collection("trustedDevices").doc(uid);
      return db.runTransaction(async tx => {
        const [bindingSnap, actorSnap, deviceSnap] = await Promise.all([tx.get(bindingRef), tx.get(userActorRef), tx.get(deviceRef)]);
        if (bindingSnap.exists) {
          const binding = bindingSnap.data() || {};
          if (binding.actorId !== actor.actorId) return { code: "device_already_bound" };
          if (binding.status !== "active" || !deviceSnap.exists || deviceSnap.data()?.status !== "active" || !MANAGEMENT_ID.test(deviceSnap.data()?.managementId || "") || !actorSnap.exists || actorSnap.data()?.status !== "active") return { code: "access_state_invalid" };
          return { ok: true, alreadyRegistered: true, actor: actorSnap.data(), device: deviceSnap.data() };
        }
        const current = actorSnap.exists ? actorSnap.data() || {} : null;
        if (current && (current.status !== "active" || current.plan !== "closed_beta" || current.maxDevices !== MAX_DEVICES)) return { code: "actor_unavailable" };
        const activeDeviceCount = Number(current?.activeDeviceCount || 0);
        if (!Number.isInteger(activeDeviceCount) || activeDeviceCount < 0) return { code: "access_state_invalid" };
        let replacement = null;
        if (activeDeviceCount >= MAX_DEVICES) {
          if (!MANAGEMENT_ID.test(replaceManagementId || "")) return { code: "device_limit_reached" };
          const matches = await tx.get(userActorRef.collection("trustedDevices").where("managementId", "==", replaceManagementId).limit(2));
          if (matches.empty || matches.size !== 1 || matches.docs[0].data()?.status !== "active") return { code: "device_limit_reached" };
          replacement = matches.docs[0];
        }
        let managementId = "";
        for (let attempt = 0; attempt < 4; attempt += 1) { const candidate = createManagementId(); if (!MANAGEMENT_ID.test(candidate || "")) return { code: "access_state_invalid" }; const collision = await tx.get(userActorRef.collection("trustedDevices").where("managementId", "==", candidate).limit(1)); if (collision.empty) { managementId = candidate; break; } }
        if (!managementId) return { code: "access_state_invalid" };
        const now = serverTimestamp(); const nextCount = activeDeviceCount - (replacement ? 1 : 0) + 1; const actorData = current || { plan: "closed_beta", status: "active", displayName: actor.displayName, maxDevices: MAX_DEVICES, activeDeviceCount: 0, createdAt: now };
        const device = { uid, managementId, status: "active", deviceLabel: actor.deviceLabel, platform: actor.platform, createdAt: now, lastSeenAt: now };
        if (replacement) { const oldUid = replacement.id; tx.update(replacement.ref, { status: "revoked", revokedAt: now, revokedByUid: uid, lastSeenAt: now }); tx.update(db.collection("edu2gDeviceBindings").doc(oldUid), { status: "revoked", revokedAt: now }); }
        tx.set(userActorRef, { ...actorData, displayName: actor.displayName, maxDevices: MAX_DEVICES, activeDeviceCount: nextCount, updatedAt: now }, { merge: true });
        tx.create(deviceRef, device); tx.create(bindingRef, { actorId: actor.actorId, status: "active", createdAt: now, lastSeenAt: now });
        return { ok: true, alreadyRegistered: false, actor: { ...actorData, activeDeviceCount: nextCount }, device };
      });
    },
    async session(access) { return { actor: access.actor, device: access.device }; },
    async list(access) {
      const snap = await actorRef(access.actorId).collection("trustedDevices").get();
      const rows = snap.docs.map(doc => ({ currentDevice: doc.id === access.uid, ...doc.data() }));
      if (rows.some(row => !MANAGEMENT_ID.test(row.managementId || ""))) throw new Error("access_state_invalid");
      return rows.map(({ uid, revokedByUid, ...row }) => row);
    },
    async revoke(access, targetManagementId) {
      if (!MANAGEMENT_ID.test(targetManagementId || "")) return { code: "not_found" };
      const actor = actorRef(access.actorId); const matches = await actor.collection("trustedDevices").where("managementId", "==", targetManagementId).limit(2).get();
      if (matches.empty || matches.size !== 1) return { code: "not_found" };
      const deviceRef = matches.docs[0].ref; const targetUid = deviceRef.id; const bindingRef = db.collection("edu2gDeviceBindings").doc(targetUid);
      return db.runTransaction(async tx => {
        const [actorSnap, deviceSnap, bindingSnap] = await Promise.all([tx.get(actor), tx.get(deviceRef), tx.get(bindingRef)]);
        if (!deviceSnap.exists || !bindingSnap.exists || bindingSnap.data()?.actorId !== access.actorId) return { code: "not_found" };
        const device = deviceSnap.data() || {}; const binding = bindingSnap.data() || {};
        if (device.status === "revoked" && binding.status === "revoked") return { ok: true, alreadyRevoked: true };
        const count = Math.max(0, Number(actorSnap.data()?.activeDeviceCount || 0) - (device.status === "active" ? 1 : 0)); const now = serverTimestamp();
        tx.update(actor, { activeDeviceCount: count, updatedAt: now }); tx.update(deviceRef, { status: "revoked", revokedAt: now, revokedByUid: access.uid, lastSeenAt: now }); tx.update(bindingRef, { status: "revoked", revokedAt: now });
        return { ok: true, alreadyRevoked: false, activeDeviceCount: count };
      });
    }
  };
}

function createEdu2gHandlers(dependencies) {
  const redeem = async (req, res) => {
    if (!baseGuard(req, res, ["loginId", "deviceLabel", "platform", "confirm", "replaceManagementId"])) return;
    const access = await protect(req, res, "redeemEdu2gPass", dependencies); if (!access) return;
    const body = req.body || {};
    if (typeof body.loginId !== "string" || typeof body.confirm !== "boolean" || (body.replaceManagementId !== undefined && !MANAGEMENT_ID.test(body.replaceManagementId || "")) || !LABEL.test(body.deviceLabel || "") || !PLATFORM.test(body.platform || "")) return response(res, 400, { ok: false, code: "invalid_request" });
    const match = await dependencies.registry.identify(body.loginId); if (!match.ok) return response(res, 403, { ok: false, code: "login_not_approved" });
    if (dependencies.blockedActors) {
      const blocked = await dependencies.blockedActors.isBlocked(match.actor.actorId).catch(() => false);
      if (blocked) return response(res, 403, { ok: false, code: "actor_blocked" });
    }
    const actor = { ...match.actor, deviceLabel: body.deviceLabel, platform: body.platform };
    if (!body.confirm) { const prepared = await dependencies.store.prepare({ uid: access.uid, actor }); if (!prepared.ok) return response(res, prepared.code === "device_limit_reached" || prepared.code === "device_already_bound" ? 409 : 503, { ok: false, code: prepared.code, devices: prepared.devices }); return response(res, 200, { ok: true, displayName: actor.displayName, maxDevices: MAX_DEVICES, ...prepared }); }
    const result = await dependencies.store.redeem({ uid: access.uid, actor, replaceManagementId: body.replaceManagementId || "" });
    if (!result.ok) return response(res, result.code === "device_limit_reached" ? 409 : result.code === "device_already_bound" ? 409 : 503, { ok: false, code: result.code });
    return response(res, 200, { ok: true, displayName: result.actor.displayName, deviceLabel: result.device.deviceLabel, activeDeviceCount: result.actor.activeDeviceCount, maxDevices: MAX_DEVICES, alreadyRegistered: !!result.alreadyRegistered });
  };
  const session = async (req, res) => { if (!baseGuard(req, res, [])) return; const access = await protect(req, res, "getEdu2gSession", dependencies); if (!access) return; const value = await dependencies.store.session(access); return response(res, 200, { ok: true, displayName: value.actor.displayName, plan: value.actor.plan, deviceLabel: value.device.deviceLabel, activeDeviceCount: value.actor.activeDeviceCount, maxDevices: value.actor.maxDevices, status: value.device.status }); };
  const list = async (req, res) => { if (!baseGuard(req, res, [])) return; const access = await protect(req, res, "listEdu2gTrustedDevices", dependencies); if (!access) return; try { const rows = await dependencies.store.list(access); return response(res, 200, { ok: true, devices: rows }); } catch { return response(res, 503, { ok: false, code: "access_state_invalid" }); } };
  const revoke = async (req, res) => { if (!baseGuard(req, res, ["targetManagementId", "confirm"])) return; const access = await protect(req, res, "revokeEdu2gTrustedDevice", dependencies); if (!access) return; const body = req.body || {}; if (!MANAGEMENT_ID.test(body.targetManagementId || "") || body.confirm !== true) return response(res, 400, { ok: false, code: "invalid_request" }); const value = await dependencies.store.revoke(access, body.targetManagementId); if (!value.ok) return response(res, value.code === "not_found" ? 404 : 503, { ok: false, code: value.code }); return response(res, 200, { ok: true, alreadyRevoked: !!value.alreadyRevoked, activeDeviceCount: value.activeDeviceCount }); };
  return { redeem, session, list, revoke };
}

module.exports = { ORIGIN, LABEL, PLATFORM, MANAGEMENT_ID, createFirestoreDeviceStore, createEdu2gHandlers };
