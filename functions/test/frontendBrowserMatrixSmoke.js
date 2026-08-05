"use strict";

// Local static-page browser matrix only. It never calls Firebase, Functions,
// Firestore, Gemini, App Check, or external AI runtimes.
const http = require("node:http");
const WebSocket = require("ws");

const targetUrl = process.env.AIWAYS_QA_URL || "http://127.0.0.1:8001/?visual-review=1";
const matrix = process.env.AIWAYS_MATRIX === "representative" ? [
  [320, 568], [360, 800], [390, 844], [768, 1024], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]
] : [
  [320,568],[360,640],[360,740],[360,800],[375,667],[375,812],[390,844],[393,852],[412,915],[430,932],
  [568,320],[640,360],[667,375],[740,360],[800,360],[812,375],[844,390],[915,412],[932,430],
  [600,960],[768,1024],[800,1280],[820,1180],[1024,768],[1180,820],[1280,800],
  [1024,768],[1280,720],[1280,800],[1366,768],[1440,900],[1536,864],[1600,900],[1920,1080],
  ...Array.from({ length: 41 }, (_, index) => [320 + index * 40, 768]),
  [671,768],[672,768],[673,768],[1023,768],[1024,768],[1025,768]
];
const rotations = [[390,844],[844,390],[390,844],[412,915],[915,412],[412,915],[768,1024],[1024,768],[768,1024],[820,1180],[1180,820],[820,1180],[1366,768],[1024,768],[1366,768]];
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function request(pathname, method = "GET") { return new Promise((resolve, reject) => { const req = http.request({ hostname: "127.0.0.1", port: 9239, path: pathname, method }, (res) => { let data = ""; res.on("data", (chunk) => data += chunk); res.on("end", () => resolve(JSON.parse(data))); }); req.on("error", reject); req.end(); }); }
function connect(url) { return new Promise((resolve, reject) => { const socket = new WebSocket(url); let id = 0; const pending = new Map(); const events = []; socket.on("open", () => resolve({ events, send(method, params = {}) { return new Promise((done, fail) => { const messageId = ++id; pending.set(messageId, { done, fail }); socket.send(JSON.stringify({ id: messageId, method, params })); }); }, close: () => socket.close() })); socket.on("message", (message) => { const packet = JSON.parse(message); if (packet.id && pending.has(packet.id)) { const job = pending.get(packet.id); pending.delete(packet.id); return packet.error ? job.fail(packet.error) : job.done(packet.result); } if (["Runtime.exceptionThrown", "Log.entryAdded"].includes(packet.method)) events.push(packet); }); socket.on("error", reject); }); }
async function evaluate(page, expression) { return (await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value; }
async function metrics(page, width, height, refresh) {
  await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 430 });
  if (refresh) { await page.send("Page.navigate", { url: targetUrl }); await delay(180); }
  return evaluate(page, `(() => {
    const ids = [...document.querySelectorAll('main > section[id]')].map(node => node.id);
    const nav = [...document.querySelectorAll('header nav a')].map(node => node.textContent.trim());
    const headings = [...document.querySelectorAll('section h1, section h2, section h3')].filter(node => { const box=node.getBoundingClientRect(); return box.width && box.height; });
    const clipped = headings.filter(node => { const style = getComputedStyle(node); const isClipped = node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1 || node.getBoundingClientRect().right > document.documentElement.clientWidth + 1; return isClipped && ![style.overflow, style.overflowX, style.overflowY].every(value => value === 'visible'); }).length;
    const sorting = document.querySelector('#sorting .sorting-app, #sorting');
    const box = sorting?.getBoundingClientRect();
    return { ids, nav, clipped, html: document.documentElement.scrollWidth, body: document.body.scrollWidth, client: document.documentElement.clientWidth, sorting: Boolean(box && box.width > 0), runtime: [...document.scripts].filter(script => /tensorflow|mobilenet|teachable/i.test(script.src)).length };
  })()`);
}
(async () => {
  const target = await request(`/json/new?${encodeURIComponent(targetUrl)}`, "PUT");
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send("Page.enable"); await page.send("Runtime.enable"); await page.send("Log.enable");
  const rows = [];
  for (const [width, height] of matrix) rows.push({ width, height, ...(await metrics(page, width, height, true)) });
  await metrics(page, rotations[0][0], rotations[0][1], true);
  const resizeRows = [];
  for (const [width, height] of rotations.slice(1)) resizeRows.push({ width, height, ...(await metrics(page, width, height, false)) });
  const expectedIds = ["dashboard","project","curriculum","hah","flow","gallery","sorting","resources"];
  const expectedNav = ["대시보드","프로젝트","교육과정","H-A-H","차시흐름","갤러리","3초판단","자료실"];
  const bad = [...rows, ...resizeRows].find(row => row.html !== row.client || row.body !== row.client || !row.sorting || row.runtime || row.clipped || row.ids.join() !== expectedIds.join() || row.nav.join() !== expectedNav.join());
  page.close();
  if (bad) throw new Error(`browser matrix failed: ${JSON.stringify(bad)}`);
  if (page.events.length) throw new Error(`browser console failures: ${page.events.length}`);
  process.stdout.write(JSON.stringify({ browser: process.env.AIWAYS_BROWSER_LABEL || "browser", matrix: process.env.AIWAYS_MATRIX || "full", viewportChecks: rows.length, resizeChecks: resizeRows.length, continuousSweep: process.env.AIWAYS_MATRIX === "representative" ? 0 : 41, breakpoints: process.env.AIWAYS_MATRIX === "representative" ? 0 : 6 }) + "\n");
})().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
