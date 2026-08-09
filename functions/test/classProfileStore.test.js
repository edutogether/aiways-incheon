"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { STORAGE_KEY, createClassProfileStore } = require("../../classProfileStore.js");

function memoryStorage() { const values = new Map(); return { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), has: key => values.has(key) }; }
const profile = (overrides = {}) => ({ schoolId: "aiways", schoolName: "AI Ways School", grade: "3", classId: "2", className: "3-2", mode: "personal", ...overrides });

test("class profile persists only validated class context and restores after reload", () => {
  const storage = memoryStorage(), store = createClassProfileStore({ storage, now: () => "2026-08-09T00:00:00.000Z" });
  assert.equal(store.loadClassProfile(), null);
  const saved = store.saveClassProfile({ ...profile(), studentName: "ignored", email: "ignored", password: "ignored", ip: "ignored", actorId: "ignored", token: "ignored" });
  assert.equal(saved.mode, "personal");
  assert.deepEqual(Object.keys(saved).sort(), ["classId", "className", "connectedAt", "grade", "mode", "profileVersion", "schoolId", "schoolName", "updatedAt"]);
  assert.deepEqual(createClassProfileStore({ storage }).loadClassProfile(), saved);
  assert.equal(storage.getItem(STORAGE_KEY).includes("ignored"), false);
});

test("supports class devices, replacement, invalid fallback and clear without touching other keys", () => {
  const storage = memoryStorage(), store = createClassProfileStore({ storage, now: () => "2026-08-09T00:00:00.000Z" });
  storage.setItem("aiways_classroom_skills", "keep"); storage.setItem("aiways_clean_records", "keep");
  assert.equal(store.saveClassProfile(profile({ mode: "class_device" })).mode, "class_device");
  assert.equal(store.saveClassProfile(profile({ classId: "3", className: "3-3" })).classId, "3");
  assert.equal(storage.getItem("aiways_classroom_skills"), "keep"); assert.equal(storage.getItem("aiways_clean_records"), "keep");
  storage.setItem(STORAGE_KEY, "{"); assert.equal(store.loadClassProfile(), null);
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...profile(), profileVersion: 9 })); assert.equal(store.loadClassProfile(), null);
  assert.throws(() => store.saveClassProfile(profile({ mode: "invalid" })), /class_profile_mode_invalid/);
  assert.throws(() => store.saveClassProfile(profile({ schoolId: "" })), /class_profile_schoolId_required/);
  store.clearClassProfile(); assert.equal(store.loadClassProfile(), null);
});
