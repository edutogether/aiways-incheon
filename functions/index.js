"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { createAnalyzeSortingHandler } = require("./lib/sortingVision");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
exports.analyzeSortingImage = onRequest({
  region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 30, minInstances: 0,
  secrets: [geminiApiKey], cors: false
}, createAnalyzeSortingHandler({ getApiKey: () => geminiApiKey.value() }));
