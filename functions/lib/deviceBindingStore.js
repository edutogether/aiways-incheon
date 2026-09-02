"use strict";

// 2026-09-02: edu2gPassHandlers.js(클로즈베타 시크릿코드 시스템, 대표님
// 지시로 폐기)에서 분리했다. createFirestoreDeviceStore 자체는 "기기를
// actor에 등록/해제"하는 범용 Firestore 로직이라 폐기 대상이 아니고,
// cb5 통합테스트 픽스처(다수 기기를 심어 동시성을 검증하는 용도)가 계속
// 이 로직을 재사용한다 - 그래서 폐기되는 HTTP 핸들러(redeemEdu2gPass 등)와
// 분리해 여기 남긴다.
const { randomUUID } = require("node:crypto");

const MANAGEMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createFirestoreDeviceStore({ db, serverTimestamp = () => new Date(), createManagementId = randomUUID, maxDevices = 5 }) {
  const actorRef = actorId => db.collection("actors").doc(actorId);
  return {
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
        const activeDeviceCount = Number(current?.activeDeviceCount || 0);
        if (!Number.isInteger(activeDeviceCount) || activeDeviceCount < 0) return { code: "access_state_invalid" };
        let replacement = null;
        if (activeDeviceCount >= maxDevices) {
          if (!MANAGEMENT_ID.test(replaceManagementId || "")) return { code: "device_limit_reached" };
          const matches = await tx.get(userActorRef.collection("trustedDevices").where("managementId", "==", replaceManagementId).limit(2));
          if (matches.empty || matches.size !== 1 || matches.docs[0].data()?.status !== "active") return { code: "device_limit_reached" };
          replacement = matches.docs[0];
        }
        let managementId = "";
        for (let attempt = 0; attempt < 4; attempt += 1) { const candidate = createManagementId(); if (!MANAGEMENT_ID.test(candidate || "")) return { code: "access_state_invalid" }; const collision = await tx.get(userActorRef.collection("trustedDevices").where("managementId", "==", candidate).limit(1)); if (collision.empty) { managementId = candidate; break; } }
        if (!managementId) return { code: "access_state_invalid" };
        const now = serverTimestamp(); const nextCount = activeDeviceCount - (replacement ? 1 : 0) + 1; const actorData = current || { plan: "closed_beta", status: "active", displayName: actor.displayName, maxDevices, activeDeviceCount: 0, createdAt: now };
        const device = { uid, managementId, status: "active", deviceLabel: actor.deviceLabel, platform: actor.platform, createdAt: now, lastSeenAt: now };
        if (replacement) { const oldUid = replacement.id; tx.update(replacement.ref, { status: "revoked", revokedAt: now, revokedByUid: uid, lastSeenAt: now }); tx.update(db.collection("edu2gDeviceBindings").doc(oldUid), { status: "revoked", revokedAt: now }); }
        tx.set(userActorRef, { ...actorData, displayName: actor.displayName, maxDevices, activeDeviceCount: nextCount, updatedAt: now }, { merge: true });
        tx.create(deviceRef, device); tx.create(bindingRef, { actorId: actor.actorId, status: "active", createdAt: now, lastSeenAt: now });
        return { ok: true, alreadyRegistered: false, actor: { ...actorData, activeDeviceCount: nextCount }, device };
      });
    },
    async list(actorId, currentUid) {
      const snap = await actorRef(actorId).collection("trustedDevices").get();
      const rows = snap.docs.map(doc => ({ currentDevice: doc.id === currentUid, ...doc.data() }));
      if (rows.some(row => !MANAGEMENT_ID.test(row.managementId || ""))) throw new Error("access_state_invalid");
      return rows.map(({ uid, revokedByUid, ...row }) => row);
    },
    async revoke(actorId, targetManagementId, revokedByUid) {
      if (!MANAGEMENT_ID.test(targetManagementId || "")) return { code: "not_found" };
      const actor = actorRef(actorId); const matches = await actor.collection("trustedDevices").where("managementId", "==", targetManagementId).limit(2).get();
      if (matches.empty || matches.size !== 1) return { code: "not_found" };
      const deviceRef = matches.docs[0].ref; const targetUid = deviceRef.id; const bindingRef = db.collection("edu2gDeviceBindings").doc(targetUid);
      return db.runTransaction(async tx => {
        const [actorSnap, deviceSnap, bindingSnap] = await Promise.all([tx.get(actor), tx.get(deviceRef), tx.get(bindingRef)]);
        if (!deviceSnap.exists || !bindingSnap.exists || bindingSnap.data()?.actorId !== actorId) return { code: "not_found" };
        const device = deviceSnap.data() || {}; const binding = bindingSnap.data() || {};
        if (device.status === "revoked" && binding.status === "revoked") return { ok: true, alreadyRevoked: true };
        const count = Math.max(0, Number(actorSnap.data()?.activeDeviceCount || 0) - (device.status === "active" ? 1 : 0)); const now = serverTimestamp();
        tx.update(actor, { activeDeviceCount: count, updatedAt: now }); tx.update(deviceRef, { status: "revoked", revokedAt: now, revokedByUid, lastSeenAt: now }); tx.update(bindingRef, { status: "revoked", revokedAt: now });
        return { ok: true, alreadyRevoked: false, activeDeviceCount: count };
      });
    }
  };
}

module.exports = { MANAGEMENT_ID, createFirestoreDeviceStore };
