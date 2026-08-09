"use strict";

(() => {
  const STORAGE_KEY = "aiways.classProfile.v1";
  const PROFILE_VERSION = 1;
  const MODES = new Set(["personal", "class_device"]);
  const REQUIRED = ["schoolId", "schoolName", "grade", "classId", "className"];

  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function iso(value, fallback) {
    const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
  }
  function profileError(code) { const error = new Error(code); error.code = code; return error; }

  function createClassProfile(input = {}, now = new Date().toISOString()) {
    const profile = {
      profileVersion: PROFILE_VERSION,
      schoolId: text(input.schoolId),
      schoolName: text(input.schoolName),
      grade: text(input.grade),
      classId: text(input.classId),
      className: text(input.className),
      mode: text(input.mode) || "personal",
      connectedAt: iso(input.connectedAt, now),
      updatedAt: iso(input.updatedAt, now)
    };
    return validateClassProfile(profile);
  }

  function validateClassProfile(profile) {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) throw profileError("class_profile_invalid");
    if (profile.profileVersion !== PROFILE_VERSION) throw profileError("class_profile_version_unsupported");
    for (const field of REQUIRED) if (!text(profile[field])) throw profileError(`class_profile_${field}_required`);
    if (!MODES.has(profile.mode)) throw profileError("class_profile_mode_invalid");
    const connectedAt = iso(profile.connectedAt, "");
    const updatedAt = iso(profile.updatedAt, "");
    if (!connectedAt || !updatedAt) throw profileError("class_profile_timestamp_invalid");
    return Object.freeze({
      profileVersion: PROFILE_VERSION,
      schoolId: text(profile.schoolId), schoolName: text(profile.schoolName), grade: text(profile.grade),
      classId: text(profile.classId), className: text(profile.className), mode: profile.mode,
      connectedAt, updatedAt
    });
  }

  function createClassProfileStore({ storage = globalThis.localStorage, now = () => new Date().toISOString() } = {}) {
    if (!storage) throw profileError("class_profile_storage_unavailable");
    const loadClassProfile = () => {
      try { const raw = storage.getItem(STORAGE_KEY); return raw ? validateClassProfile(JSON.parse(raw)) : null; } catch { return null; }
    };
    const saveClassProfile = input => {
      const previous = loadClassProfile();
      const profile = createClassProfile({ ...input, connectedAt: input.connectedAt || previous?.connectedAt || now(), updatedAt: now() }, now());
      storage.setItem(STORAGE_KEY, JSON.stringify(profile));
      return loadClassProfile();
    };
    const clearClassProfile = () => storage.removeItem(STORAGE_KEY);
    return { storageKey: STORAGE_KEY, createClassProfile, validateClassProfile, saveClassProfile, loadClassProfile, clearClassProfile };
  }

  const api = { STORAGE_KEY, PROFILE_VERSION, createClassProfile, validateClassProfile, createClassProfileStore };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.AIWaysClassProfileStore = api;
})();
