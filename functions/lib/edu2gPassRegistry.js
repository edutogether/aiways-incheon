"use strict";

const crypto = require("node:crypto");

const MAX_PASS_LENGTH = 128;
const MAX_DEVICES = 5;
const ACTOR_ID = /^[A-Za-z0-9_-]{3,64}$/;

function normalizePass(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toUpperCase();
}

function validDisplayName(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= 80 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function safeEqual(left, right) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseEdu2gPassRegistry(raw, { maxPassLength = MAX_PASS_LENGTH } = {}) {
  let parsed;
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { throw new Error("invalid_registry"); }
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.passes) || !parsed.passes.length) throw new Error("invalid_registry");
  const passes = parsed.passes.map((entry) => {
    const pass = normalizePass(entry?.pass);
    if (!pass || pass.length > maxPassLength || !ACTOR_ID.test(entry?.actorId || "") || !validDisplayName(entry?.displayName) || typeof entry?.enabled !== "boolean" || entry?.maxDevices !== MAX_DEVICES) throw new Error("invalid_registry");
    return { pass, actorId: entry.actorId, displayName: entry.displayName, enabled: entry.enabled, maxDevices: MAX_DEVICES };
  });
  const seenPasses = new Set(); const seenActors = new Set();
  for (const entry of passes) {
    if (seenPasses.has(entry.pass) || seenActors.has(entry.actorId)) throw new Error("invalid_registry");
    seenPasses.add(entry.pass); seenActors.add(entry.actorId);
  }
  return { version: 1, passes };
}

function createEdu2gPassRegistry({ getSecret = () => "", compare = safeEqual, maxPassLength = MAX_PASS_LENGTH } = {}) {
  return {
    async redeem(input) {
      const normalized = normalizePass(input);
      if (!normalized || normalized.length > maxPassLength) return { ok: false, code: "invalid_pass" };
      let registry;
      try { registry = parseEdu2gPassRegistry(getSecret(), { maxPassLength }); } catch { return { ok: false, code: "invalid_pass" }; }
      let matched = null;
      for (const entry of registry.passes) {
        const equal = compare(normalized, entry.pass);
        if (equal && entry.enabled) matched = entry;
      }
      return matched ? { ok: true, actor: { actorId: matched.actorId, displayName: matched.displayName, maxDevices: matched.maxDevices } } : { ok: false, code: "invalid_pass" };
    }
  };
}

module.exports = { MAX_PASS_LENGTH, MAX_DEVICES, normalizePass, validDisplayName, safeEqual, parseEdu2gPassRegistry, createEdu2gPassRegistry };
