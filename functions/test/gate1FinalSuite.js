"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const tasks = [
  { name: "unit", command: "npm.cmd", args: ["test"] },
  { name: "static", command: "npm.cmd", args: ["run", "check"] },
  { name: "record", command: process.execPath, args: ["test/recordEmulatorSmoke.js"] },
  { name: "analysis", command: process.execPath, args: ["test/analysisIdempotencyEmulatorSmoke.js"] },
  { name: "appcheck", command: process.execPath, args: ["test/appCheckEmulatorSmoke.js"] },
  { name: "edu2g", command: process.execPath, args: ["test/edu2gEmulatorSmoke.js"] },
  { name: "edu2g-integration", command: process.execPath, args: ["test/edu2gFirestoreEmulatorIntegration.js"] },
  { name: "protected-actor", command: process.execPath, args: ["test/protectedActorEmulatorIntegration.js"] },
  { name: "protected-records", command: process.execPath, args: ["test/protectedRecordsEmulatorIntegration.js"] }
];
for (const task of tasks) {
  const started = Date.now();
  process.stdout.write(`GATE1 ${task.name} start ${new Date().toISOString()}\n`);
  const result = spawnSync(task.command, task.args, { cwd: path.resolve(__dirname, ".."), stdio: "inherit", timeout: 180000, shell: process.platform === "win32" && task.command === "npm.cmd" });
  const durationMs = Date.now() - started;
  const code = result.error ? 1 : (result.status ?? 1);
  process.stdout.write(`GATE1 ${task.name} end durationMs=${durationMs} exitCode=${code}\n`);
  if (code !== 0) process.exit(code);
}
process.stdout.write("GATE1 FINAL PASS fail=0 skip=0\n");
