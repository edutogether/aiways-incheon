"use strict";

const { observeAppCheck } = require("./appCheckProtection");

function unavailable() { return { ok: false, httpStatus: 503, code: "protection_unavailable" }; }

/** Applies the shared production order after the handler has accepted origin/method. */
async function protectActorRequest({ req, functionName, access, appCheck, globalRateLimiter, actorRateLimiter, logAppCheck, blockedActors }) {
  const observed = await (appCheck || (options => observeAppCheck(options.req, options)))({ req, functionName, logger: logAppCheck });
  if (observed.httpStatus) return { ok: false, httpStatus: observed.httpStatus, code: observed.code };
  const resolved = await access?.resolve?.(req);
  if (!resolved?.ok || !resolved.actorId) return resolved?.httpStatus ? resolved : unavailable();
  if (blockedActors) {
    const blocked = await blockedActors.isBlocked(resolved.actorId).catch(() => false);
    if (blocked) return { ok: false, httpStatus: 403, code: "actor_blocked" };
  }
  for (const limiter of [globalRateLimiter, actorRateLimiter]) {
    const limit = await limiter?.check?.(functionName, resolved.actorId);
    if (!limit?.allowed) return limit?.outcome === "unavailable" ? unavailable() : { ok: false, httpStatus: 429, code: "rate_limit_exceeded", retryAfterSeconds: limit.retryAfterSeconds || 1 };
  }
  return { ok: true, actorId: resolved.actorId };
}

module.exports = { protectActorRequest };
