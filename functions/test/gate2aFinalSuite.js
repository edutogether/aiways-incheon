"use strict";
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const evidenceLog = process.env.AIWAYS_GATE2A_LOG || "";
function write(value) { process.stdout.write(value); if (evidenceLog) fs.appendFileSync(evidenceLog, value, "utf8"); }
const tasks = [
  { name: "gate1", command: process.execPath, args: ["test/gate1FinalSuite.js"] },
  { name: "gate2a-frontend", command: process.execPath, args: ["--test", "test/edu2gBetaFrontend.test.js"] },
  { name: "gate2a-browser", command: process.execPath, args: ["test/edu2gBetaBrowserSmoke.js"] },
  { name: "diff-check", command: "git", args: ["diff", "--check"] }
];
for (const task of tasks) {
  const started = Date.now(); write(`GATE2A ${task.name} start ${new Date().toISOString()}\n`);
  const result = spawnSync(task.command, task.args, { cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 300000 });
  if (result.stdout) write(result.stdout); if (result.stderr) write(result.stderr);
  const code = result.error ? 1 : (result.status ?? 1); write(`GATE2A ${task.name} end durationMs=${Date.now() - started} exitCode=${code}\n`);
  if (code !== 0) process.exit(code);
}
write("GATE2A FINAL PASS fail=0 skip=0\n");
