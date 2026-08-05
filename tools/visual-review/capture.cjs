#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const toolingRoot = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const presetName = option("--preset");
const sourceRoot = path.resolve(option("--source") || toolingRoot);
const reviewMode = args.includes("--visual-review");
const presets = JSON.parse(fs.readFileSync(path.join(__dirname, "presets.json"), "utf8"));
const { startStaticServer } = require("./static-server.cjs");
const { launchChrome } = require("./chrome-cdp.cjs");
if (!presets[presetName]) throw new Error("Unknown preset. Use smoke or sections.");
if (!fs.existsSync(path.join(sourceRoot, "index.html"))) throw new Error("SOURCE_INDEX_MISSING");
const output = fs.mkdtempSync(path.join(os.tmpdir(), `aiways-visual-review-${presetName}-`));
const captureDir = path.join(output, "captures");
fs.mkdirSync(captureDir);
const specs = presetName === "sections"
  ? presets.sections.viewports.flatMap(([width, height]) => presets.sections.sections.map(section => ({ name: `${section}-${width}`, width, height, selector: `#${section}` })))
  : presets.smoke.captures;
const now = () => new Date().toISOString();
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const writeJson = (name, data) => fs.writeFileSync(path.join(output, name), JSON.stringify(data, null, 2));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const safeGit = values => { try { return execFileSync("git", ["-C", sourceRoot, ...values], { encoding: "utf8", windowsHide: true }).trim() || "UNKNOWN"; } catch (_) { return "UNKNOWN"; } };
const redact = value => String(value || "").replace(/(authorization|bearer)\s+[^\s,;]+/gi, "$1 [REDACTED]").replace(/AIza[\w-]{20,}/g, "[REDACTED_API_KEY]").replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[REDACTED_TOKEN]").replace(/\b(pass|token|uid|actorid|managementid)\s*[:=]\s*[^\s,;&]+/gi, "$1=[REDACTED]").replace(/[A-Za-z0-9+/_=-]{96,}/g, "[REDACTED_LONG_VALUE]").slice(0, 700);
const urlInfo = raw => { try { const url = new URL(raw); return { url: `${url.protocol}//${url.host}${url.pathname}`, host: url.host, path: url.pathname }; } catch (_) { return { url: "[REDACTED_INVALID_URL]", host: "UNKNOWN", path: "UNKNOWN" }; } };
const isLocal = host => host === "127.0.0.1" || host === "localhost";
const isProduction = host => /cloudfunctions\.net$|edutogether\.github\.io$|ai-ways-incheon\.web\.app$|identitytoolkit\.googleapis\.com$/i.test(host || "");
const isExpectedAuth = event => (((/(^|\.)google\.com$/i.test(event.host || "") && /\/recaptcha\/enterprise/i.test(event.path || "")) || /appcheck\/recaptcha-error/i.test(event.text || "")) && (event.errorText || event.blockedReason || event.status >= 400 || /error|blocked|failed/i.test(event.text || "")));
const compactArgs = values => (values || []).map(value => redact(value.value ?? value.description ?? value.type ?? "")).join(" | ");

(async () => {
  const startedAt = now();
  const records = [], events = [], requests = new Map();
  let browser, staticServer, runnerError;
  const add = event => events.push({ timestamp: now(), ...event });
  try {
    staticServer = await startStaticServer(sourceRoot);
    const wsModule = path.join(toolingRoot, "functions", "node_modules", "ws");
    if (!fs.existsSync(wsModule)) throw new Error("WS_DEPENDENCY_MISSING: run functions npm ci before capture");
    browser = await launchChrome(wsModule);
    for (const domain of ["Page", "Runtime", "Log", "Network"]) await browser.send(`${domain}.enable`);
    for (const spec of specs) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width: spec.width, height: spec.height, deviceScaleFactor: 1, mobile: spec.width === 390 });
      await browser.send("Page.navigate", { url: `${staticServer.base}/${reviewMode ? "?visual-review=1" : ""}` });
      await sleep(700);
      const ready = await browser.send("Runtime.evaluate", { returnByValue: true, awaitPromise: true, expression: `(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const e=document.querySelector(${JSON.stringify(spec.selector)}),h=document.querySelector('header'),hs=h?getComputedStyle(h):null;return{selector:Boolean(e),sticky:Boolean(hs)&&['sticky','fixed'].includes(hs.position),overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),url:location.href}})()` });
      const state = ready.result.value;
      add({ kind: "frame_state", ...urlInfo(state.url), resourceType: "Document", text: `selector=${state.selector}; sticky=${state.sticky}; overflow=${state.overflow}` });
      if (!state.selector) throw new Error(`SELECTOR_MISSING: ${spec.selector}`);
      if (!state.sticky) throw new Error("HEADER_NOT_STICKY");
      if (state.overflow) throw new Error(`HORIZONTAL_OVERFLOW: ${spec.name}, ${state.overflow}px`);
      const position = await browser.send("Runtime.evaluate", { returnByValue: true, expression: `(()=>{const target=document.querySelector(${JSON.stringify(spec.selector)});const root=document.documentElement;const rootBehavior=root.style.scrollBehavior;const bodyBehavior=document.body.style.scrollBehavior;root.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto';target.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});root.style.scrollBehavior=rootBehavior;document.body.style.scrollBehavior=bodyBehavior;const rect=target.getBoundingClientRect();return{scrollY:window.scrollY,targetTop:rect.top,headerHeight:document.querySelector('header')?.getBoundingClientRect().height||0}})()` });
      await sleep(100);
      const targetPosition = position.result.value;
      if (spec.name !== "dashboard-1366" && targetPosition.targetTop < targetPosition.headerHeight) throw new Error(`SECTION_POSITION_INVALID: ${spec.name}, top=${targetPosition.targetTop}, header=${targetPosition.headerHeight}`);
      add({ kind: "frame_position", host: "LOCAL", path: "LOCAL", resourceType: "Document", text: `selector=${spec.selector}; scrollY=${targetPosition.scrollY}; targetTop=${targetPosition.targetTop}; headerHeight=${targetPosition.headerHeight}` });
      const image = await browser.send("Page.captureScreenshot", { format: "webp", quality: 88 });
      const file = path.join(captureDir, `${spec.name}.webp`);
      fs.writeFileSync(file, Buffer.from(image.data, "base64"));
      records.push({ file: path.basename(file), viewport: [spec.width, spec.height], selector: spec.selector, bytes: fs.statSync(file).size, sha256: hash(file) });
    }
  } catch (error) {
    runnerError = error;
    add({ kind: "runner_error", host: "LOCAL", path: "LOCAL", resourceType: "runner", errorText: redact(error.message), text: redact(error.stack || error.message) });
  } finally {
    if (browser) {
      for (const message of browser.events) {
        const params = message.params || {};
        if (message.method === "Network.requestWillBeSent") { const info = urlInfo(params.request?.url); requests.set(params.requestId, { requestId: params.requestId, kind: "network", ...info, method: params.request?.method || "UNKNOWN", resourceType: params.type || "UNKNOWN" }); }
        else if (message.method === "Network.responseReceived") { const entry = requests.get(params.requestId) || { requestId: params.requestId, kind: "network", ...urlInfo(params.response?.url) }; entry.status = params.response?.status ?? "UNKNOWN"; entry.resourceType = params.type || entry.resourceType || "UNKNOWN"; requests.set(params.requestId, entry); }
        else if (message.method === "Network.loadingFailed") { const entry = requests.get(params.requestId) || { requestId: params.requestId, kind: "network", host: "UNKNOWN", path: "UNKNOWN", url: "[REDACTED_UNKNOWN_URL]" }; entry.errorText = redact(params.errorText); entry.blockedReason = redact(params.blockedReason); requests.set(params.requestId, entry); }
        else if (message.method === "Runtime.exceptionThrown") { const detail = params.exceptionDetails || {}; add({ kind: "runtime_exception", host: "UNKNOWN", path: "UNKNOWN", resourceType: "Script", source: redact(detail.url), text: redact(detail.text), exceptionDescription: redact(detail.exception?.description), stack: redact(detail.stackTrace?.callFrames?.map(frame => `${frame.functionName}@${frame.url}:${frame.lineNumber}`).join("\n")) }); }
        else if (message.method === "Runtime.consoleAPICalled") add({ kind: "console", host: "UNKNOWN", path: "UNKNOWN", resourceType: "Script", consoleLevel: params.type || "UNKNOWN", text: compactArgs(params.args), stack: redact(params.stackTrace?.callFrames?.map(frame => `${frame.functionName}@${frame.url}:${frame.lineNumber}`).join("\n")) });
        else if (message.method === "Log.entryAdded") { const entry = params.entry || {}, info = urlInfo(entry.url || ""); add({ kind: "log", ...info, resourceType: "Log", consoleLevel: entry.level || "UNKNOWN", source: redact(entry.source), text: redact(entry.text), stack: redact(entry.stackTrace) }); }
        else if (message.method === "Page.javascriptDialogOpening") add({ kind: "dialog", host: "LOCAL", path: "LOCAL", resourceType: "Document", text: redact(params.message), source: redact(params.type) });
      }
      await browser.close();
    }
    if (staticServer) staticServer.server.close();
  }
  for (const entry of requests.values()) add(entry);
  const categories = ["expected_external_auth_block", "required_local_failure", "unexpected_console_error", "unexpected_external_failure", "production_request", "harmless_browser_log", "unclassified"];
  const classified = events.map(event => {
    let category = "harmless_browser_log";
    if (isProduction(event.host)) category = "production_request";
    else if (event.kind === "runner_error") category = "required_local_failure";
    else if (isExpectedAuth(event)) category = "expected_external_auth_block";
    else if (event.kind === "runtime_exception") category = "unexpected_console_error";
    else if ((event.kind === "console" || event.kind === "log") && /error|exception|uncaught|unhandled/i.test(`${event.consoleLevel} ${event.text} ${event.exceptionDescription || ""}`)) category = "unclassified";
    else if (event.kind === "network" && (event.errorText || Number(event.status) >= 400)) category = isLocal(event.host) ? "required_local_failure" : "unexpected_external_failure";
    return { ...event, category, classificationBasis: category === "expected_external_auth_block" ? "reCAPTCHA/App Check failure evidence on expected external auth path" : category === "harmless_browser_log" ? "no error, failure, or production signal" : "normalized host, path, event type, status, and error evidence" };
  });
  const categoryCounts = Object.fromEntries(categories.map(category => [category, classified.filter(event => event.category === category).length]));
  const blocking = classified.find(event => ["required_local_failure", "unexpected_console_error", "unexpected_external_failure", "production_request", "unclassified"].includes(event.category)) || null;
  const pass = !runnerError && !blocking && records.length === specs.length;
  const manifest = { schemaVersion: 1, runId: path.basename(output), preset: presetName, startedAt, finishedAt: now(), exitCode: pass ? 0 : 1, result: pass ? "PASS" : "BLOCK", nodeVersion: process.version, platform: `${process.platform}-${process.arch}`, chromePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", sourceBranch: safeGit(["branch", "--show-current"]), sourceHead: safeGit(["rev-parse", "HEAD"]), captureCountExpected: specs.length, captureCountActual: records.length, categoryCounts, requiredLocalFailureCount: categoryCounts.required_local_failure, unexpectedConsoleErrorCount: categoryCounts.unexpected_console_error, unexpectedExternalFailureCount: categoryCounts.unexpected_external_failure, expectedExternalAuthBlockCount: categoryCounts.expected_external_auth_block, productionRequestCount: categoryCounts.production_request, harmlessBrowserLogCount: categoryCounts.harmless_browser_log, firstBlockingEvent: blocking, redactionApplied: true, artifacts: records.map(record => `captures/${record.file}`), shaManifestPath: "sha256.json", reports: ["browser-events.json", "network-report.json", "console-runtime-report.json", "classification-report.json", "classification-summary.json"], runnerError: runnerError ? redact(runnerError.message) : null };
  writeJson("browser-events.json", events);
  writeJson("network-report.json", classified.filter(event => event.kind === "network"));
  writeJson("console-runtime-report.json", classified.filter(event => ["runtime_exception", "console", "log", "dialog"].includes(event.kind)));
  writeJson("classification-report.json", classified);
  writeJson("classification-summary.json", { categoryCounts, firstBlockingEvent: blocking, result: manifest.result });
  writeJson("manifest.json", manifest);
  const files = fs.readdirSync(output).filter(name => name !== "sha256.json").flatMap(name => { const full = path.join(output, name); return fs.statSync(full).isDirectory() ? fs.readdirSync(full).map(child => path.join(name, child)) : [name]; });
  writeJson("sha256.json", Object.fromEntries(files.map(file => [file.replace(/\\/g, "/"), hash(path.join(output, file))])));
  console[pass ? "log" : "error"](JSON.stringify({ result: manifest.result, categoryCounts, firstBlockingEvent: blocking, output, manifest: path.join(output, "manifest.json"), shaManifest: path.join(output, "sha256.json") }));
  process.exitCode = manifest.exitCode;
})();
