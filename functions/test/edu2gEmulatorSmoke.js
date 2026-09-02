"use strict";
// Runs only under firebase emulators:exec with demo-aiways-incheon.
// 2026-09-02: getEdu2gSession(클로즈베타 시스템, 폐기)을 "실제 배포된
// HTTP 함수가 App Check 없는 요청을 401로 막는지" 확인하는 용도로만 썼다 -
// checkStudentProfile로 교체(같은 App Check 강제 경로, 코드는 그대로 유지).
const assert = require("node:assert/strict");
const http = require("node:http");
const authEmulator = new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`);
const functionsEmulator = new URL(`http://${process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001"}`);
function request(options, body = "") { return new Promise((resolve, reject) => { const req = http.request(options, res => { let data = ""; res.on("data", chunk => data += chunk); res.on("end", () => resolve({ status: res.statusCode, data })); }); req.on("error", reject); req.end(body); }); }
(async () => { const signup = await request({ hostname: authEmulator.hostname, port: authEmulator.port, path: "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", method: "POST", headers: { "Content-Type": "application/json" } }, JSON.stringify({ returnSecureToken: true })); assert.equal(signup.status, 200); const blocked = await request({ hostname: functionsEmulator.hostname, port: functionsEmulator.port, path: "/demo-aiways-incheon/asia-northeast3/checkStudentProfile", method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" } }, "{}"); assert.equal(blocked.status, 401); process.stdout.write(JSON.stringify({ authEmulator: "anonymous_signin_ok", appCheckGate: "401" }) + "\n"); })().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
