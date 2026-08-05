"use strict";

// The Secret name is retained for deployment compatibility.  Its value is not
// a password/PASS store: it is the approved closed-beta participant registry.
const MAX_LOGIN_ID_LENGTH = 80;
const MAX_DEVICES = 5;
const ACTOR_ID = /^[A-Za-z0-9_-]{3,64}$/;

function normalizeLoginId(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

function validDisplayName(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= 80 && !/[\u0000-\u001f\u007f<>]/u.test(value);
}

function parseEdu2gPassRegistry(raw, { maxLoginIdLength = MAX_LOGIN_ID_LENGTH } = {}) {
  let parsed;
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { throw new Error("invalid_registry"); }
  if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.participants) || !parsed.participants.length) throw new Error("invalid_registry");
  const participants = parsed.participants.map(entry => {
    if (!entry || Object.keys(entry).some(key => /^(pass|password|passwordhash)$/iu.test(key))) throw new Error("invalid_registry");
    const loginId = normalizeLoginId(entry?.loginId);
    const aliases = Array.isArray(entry?.aliases) ? entry.aliases.map(normalizeLoginId) : [];
    if (!loginId || loginId.length > maxLoginIdLength || aliases.some(value => !value || value.length > maxLoginIdLength) || !ACTOR_ID.test(entry?.actorId || "") || !validDisplayName(entry?.displayName) || typeof entry?.enabled !== "boolean" || entry?.maxDevices !== MAX_DEVICES) throw new Error("invalid_registry");
    return { actorId: entry.actorId, loginId, aliases, displayName: entry.displayName, enabled: entry.enabled, maxDevices: MAX_DEVICES };
  });
  const seenActors = new Set(), seenLoginIds = new Set();
  for (const participant of participants) {
    if (seenActors.has(participant.actorId)) throw new Error("invalid_registry");
    seenActors.add(participant.actorId);
    for (const loginId of [participant.loginId, ...participant.aliases]) {
      if (seenLoginIds.has(loginId)) throw new Error("invalid_registry");
      seenLoginIds.add(loginId);
    }
  }
  return { version: 2, participants };
}

function createEdu2gPassRegistry({ getSecret = () => "", maxLoginIdLength = MAX_LOGIN_ID_LENGTH } = {}) {
  return {
    async identify(input) {
      const normalized = normalizeLoginId(input);
      if (!normalized || normalized.length > maxLoginIdLength) return { ok: false, code: "login_not_approved" };
      let registry;
      try { registry = parseEdu2gPassRegistry(getSecret(), { maxLoginIdLength }); } catch { return { ok: false, code: "login_not_approved" }; }
      const participant = registry.participants.find(entry => entry.loginId === normalized || entry.aliases.includes(normalized));
      return participant?.enabled ? { ok: true, actor: { actorId: participant.actorId, displayName: participant.displayName, maxDevices: participant.maxDevices } } : { ok: false, code: "login_not_approved" };
    }
  };
}

module.exports = { MAX_LOGIN_ID_LENGTH, MAX_DEVICES, normalizeLoginId, validDisplayName, parseEdu2gPassRegistry, createEdu2gPassRegistry };
