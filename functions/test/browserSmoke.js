"use strict";

const http = require("node:http");
const WebSocket = require("ws");
const targetUrl = "http://127.0.0.1:8001/?visual-review=1";
const viewports = [[1366, 768], [1024, 768], [820, 1180], [768, 1024], [430, 932], [390, 844], [360, 740]];
function request(path, method = "GET") { return new Promise((resolve, reject) => { const req = http.request({ hostname: "127.0.0.1", port: 9239, path, method }, (res) => { let data = ""; res.on("data", (chunk) => data += chunk); res.on("end", () => resolve(JSON.parse(data))); }); req.on("error", reject); req.end(); }); }
function connect(url) { return new Promise((resolve, reject) => { const socket = new WebSocket(url); let id = 0; const pending = new Map(); socket.on("open", () => resolve({ send(method, params = {}) { return new Promise((done, fail) => { const messageId = ++id; pending.set(messageId, { done, fail }); socket.send(JSON.stringify({ id: messageId, method, params })); }); }, close: () => socket.close() })); socket.on("message", (message) => { const packet = JSON.parse(message); if (packet.id && pending.has(packet.id)) { const item = pending.get(packet.id); pending.delete(packet.id); packet.error ? item.fail(packet.error) : item.done(packet.result); } }); socket.on("error", reject); }); }
async function evaluate(page, expression) { return (await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value; }
(async () => {
  const target = await request(`/json/new?${encodeURIComponent(targetUrl)}`, "PUT");
  const page = await connect(target.webSocketDebuggerUrl);
  const rows = [];
  for (const [width, height] of viewports) {
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 430 });
    await page.send("Page.navigate", { url: targetUrl });
    await new Promise((resolve) => setTimeout(resolve, 1300));
    rows.push(await evaluate(page, `({ width: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth, client: document.documentElement.clientWidth, tm: Boolean(document.querySelector('[data-tm-model-url], #tmModelUrl, .tm-model-line')), sorting: Boolean(document.querySelector('#sorting')) })`));
  }
  const result = await evaluate(page, `(async () => {
    const contract = window.AIWaysSortingVisionContract;
    const fallback = await contract.futureProvider.analyze({ requestMetadata: { requestId: 'browser-smoke', schemaVersion: contract.schemaVersion }, imagePayload: { mimeType: 'image/jpeg', data: 'YWl3YXlz', metadata: { mimeType: 'image/jpeg', width: 1, height: 1, byteLength: 6 } } });
    return { endpoint: contract.futureProvider ? 'available' : 'missing', fallback: fallback.code, noStoredImage: !Object.keys(localStorage).some(key => /base64|image|photo/i.test(String(localStorage.getItem(key) || ''))), sortingScripts: ['tensorflow','mobilenet','teachable'].map(word => [...document.scripts].some(script => script.src.toLowerCase().includes(word))) };
  })()`);
  page.close();
  const brokenViewport = rows.find((row) => row.html !== row.client || row.body !== row.client || !row.tm || !row.sorting);
  if (brokenViewport) throw new Error(`viewport contract failed: ${JSON.stringify(brokenViewport)}`);
  if (result.endpoint !== "available") throw new Error("endpoint contract failed: futureProvider unavailable");
  if (result.fallback !== "auth_invalid") throw new Error(`fallback contract failed: ${result.fallback}`);
  if (!result.noStoredImage) throw new Error("privacy contract failed: image-like localStorage value detected");
  process.stdout.write(JSON.stringify({ rows, result }) + "\n");
})().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
