"use strict";

const { getAppCheck } = require("firebase-admin/app-check");

const APP_CHECK_ENFORCEMENT = true;

function extractAppCheckToken(req) {
  const value = req.headers?.["x-firebase-appcheck"] ?? req.headers?.["X-Firebase-AppCheck"];
  return typeof value === "string" && value ? value : "";
}

async function verifyAppCheck(req, verifier = (token) => getAppCheck().verifyToken(token)) {
  const token = extractAppCheckToken(req);
  if (!token) return { status: "missing" };
  try {
    await verifier(token);
    return { status: "valid" };
  } catch (error) {
    return { status: error?.code === "unavailable" ? "unavailable" : "invalid" };
  }
}

async function observeAppCheck(req, { functionName, requestId = "", verifier, logger = () => {}, enforcement = APP_CHECK_ENFORCEMENT } = {}) {
  const started = Date.now();
  let result;
  try {
    result = await verifyAppCheck(req, verifier);
  } catch {
    result = { status: "unavailable" };
  }
  logger({ event: "app_check_observation", functionName, requestId, status: result.status, latencyMs: Date.now() - started, enforcement: !!enforcement });
  if (!enforcement || result.status === "valid") return result;
  return {
    ...result,
    httpStatus: result.status === "unavailable" ? 503 : 401,
    code: result.status === "missing" ? "app_check_missing" : result.status === "invalid" ? "app_check_invalid" : "protection_unavailable"
  };
}

module.exports = { APP_CHECK_ENFORCEMENT, extractAppCheckToken, verifyAppCheck, observeAppCheck };
