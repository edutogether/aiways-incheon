"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const WebSocket = require("ws");

const [url, output, label] = process.argv.slice(2);
if (!url || !output || !label) throw new Error("Usage: cb3aHistoricalCapture <url> <output> <label>");
fs.mkdirSync(output, { recursive: true });

function request(pathname, method = "GET") {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: "127.0.0.1", port: 9239, path: pathname, method }, (response) => {
      let body = "";
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.on("error", reject);
    request.end();
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url); let id = 0;
    const pending = new Map(); const events = [];
    socket.on("open", () => resolve({
      events,
      send(method, params = {}) {
        return new Promise((done, fail) => {
          const messageId = ++id; pending.set(messageId, { done, fail });
          socket.send(JSON.stringify({ id: messageId, method, params }));
        });
      },
      close: () => socket.close(),
    }));
    socket.on("message", (message) => {
      const packet = JSON.parse(message);
      if (packet.id && pending.has(packet.id)) {
        const item = pending.get(packet.id); pending.delete(packet.id);
        return packet.error ? item.fail(packet.error) : item.done(packet.result);
      }
      if (packet.method === "Fetch.requestPaused") {
        const fixture = Buffer.from(JSON.stringify({ idToken: "fixture.id.token", refreshToken: "fixture.refresh.token", expiresIn: "3600", localId: "visual-fixture" })).toString("base64");
        socket.send(JSON.stringify({ id: ++id, method: "Fetch.fulfillRequest", params: { requestId: packet.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: fixture } }));
      }
      if (["Runtime.exceptionThrown", "Log.entryAdded"].includes(packet.method)) events.push(packet);
    });
    socket.on("error", reject);
  });
}

async function evaluate(page, expression) {
  return (await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
}

async function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function capture(page, name, selector) {
  const exists = await evaluate(page, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  if (!exists) return { name, selector, missing: true };
  await evaluate(page, `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: "start", behavior: "instant" })`);
  await wait(100);
  const data = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = `${name}.png`;
  fs.writeFileSync(path.join(output, file), Buffer.from(data.data, "base64"));
  return { name, selector, file, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(output, file))).digest("hex") };
}

(async () => {
  const target = await request(`/json/new?${encodeURIComponent(url)}`, "PUT");
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send("Page.enable"); await page.send("Runtime.enable"); await page.send("Log.enable");
  await page.send("Fetch.enable", { patterns: [{ urlPattern: "https://identitytoolkit.googleapis.com/*", requestStage: "Request" }] });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const client = Object.freeze({
      getSession: async () => ({ ok: false, status: 401, code: "device_not_registered", data: null }),
      listTrustedDevices: async () => ({ ok: false, status: 401, code: "device_not_registered", data: null }),
      requestAccess: async () => ({ ok: false, status: 401, code: "login_not_approved", data: null }),
      confirmDeviceRegistration: async () => ({ ok: false, status: 401, code: "login_not_approved", data: null }),
      revokeTrustedDevice: async () => ({ ok: false, status: 401, code: "device_not_registered", data: null }),
      request: async () => ({ ok: false, status: 401, code: "device_not_registered", data: null }),
      getPlatformLabel: () => "Visual fixture",
      errorMessageFor: () => "연결 상태를 확인할 수 없습니다.",
    });
    Object.defineProperty(window, "AIWaysEdu2gClient", { configurable: true, get: () => client, set: () => {} });
  })()` });
  const captures = []; const dashboardGeometry = {}; const viewports = [[320, 568], [360, 800], [390, 844], [430, 932], [768, 1024], [820, 1180], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440]];
  for (const [width, height] of viewports) {
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 430 });
    await page.send("Page.navigate", { url }); await wait(850);
    if (process.env.AIWAYS_DISABLE_CB3A === "1") await evaluate(page, `document.querySelector('link[href*="styles/cb3a.css"]')?.setAttribute('disabled', 'disabled')`);
    captures.push(await capture(page, `${label}-dashboard-${width}x${height}`, "#dashboard"));
    dashboardGeometry[`${width}x${height}`] = await evaluate(page, `(() => { const rect = (selector) => { const box = document.querySelector(selector)?.getBoundingClientRect(); return box && { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), bottom: Math.round(box.bottom) }; }; return { dashboard: rect("#dashboard"), grid: rect(".dashboard-grid"), hero: rect(".hero-copy"), panels: [".school-panel", ".landfill-panel", ".class-panel", ".upload-panel"].map(rect) }; })()`);
  }
  for (const [width, height] of [[390, 844], [1366, 768], [1920, 1080]]) {
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 430 });
    await page.send("Page.navigate", { url }); await wait(850);
    if (process.env.AIWAYS_DISABLE_CB3A === "1") await evaluate(page, `document.querySelector('link[href*="styles/cb3a.css"]')?.setAttribute('disabled', 'disabled')`);
    for (const section of ["project", "curriculum", "hah", "flow", "gallery", "resources"]) captures.push(await capture(page, `${label}-${section}-${width}x${height}`, `#${section}`));
  }
  for (const [width, height] of [[390, 844], [1366, 768]]) {
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 430 });
    await page.send("Page.navigate", { url }); await wait(850);
    if (process.env.AIWAYS_DISABLE_CB3A === "1") await evaluate(page, `document.querySelector('link[href*="styles/cb3a.css"]')?.setAttribute('disabled', 'disabled')`);
    captures.push(await capture(page, `${label}-sorting-idle-${width}x${height}`, "#sorting"));
    await evaluate(page, `document.querySelector('[data-sorting-mode="quick"]')?.click(); document.querySelector('[data-quick-item="milk"]')?.click();`); await wait(80);
    captures.push(await capture(page, `${label}-sorting-result-${width}x${height}`, "[data-sorting-result]"));
    await evaluate(page, `document.querySelector('#practiceLogButton')?.click();`); await wait(80);
    captures.push(await capture(page, `${label}-sorting-completed-${width}x${height}`, "[data-sorting-result]"));
    await evaluate(page, `document.querySelector('#holdLogButton')?.click(); document.querySelector('[data-tab="holds"]')?.click();`); await wait(80);
    captures.push(await capture(page, `${label}-sorting-held-${width}x${height}`, "#holdList"));
    await evaluate(page, `document.querySelector('.edu2g-beta-trigger')?.click();`); await wait(80);
    captures.push(await capture(page, `${label}-edu2g-unregistered-${width}x${height}`, ".edu2g-beta-dialog"));
    await evaluate(page, `const root=document.querySelector('.edu2g-beta-content'); if(root){ root.replaceChildren(); const session=document.createElement('section'); session.className='edu2g-beta-session'; session.innerHTML='<strong>연결된 사용자</strong><p>현재 기기 · 1/5대 연결됨</p>'; root.append(session); }`); await wait(40);
    captures.push(await capture(page, `${label}-edu2g-registered-${width}x${height}`, ".edu2g-beta-dialog"));
    await evaluate(page, `const root=document.querySelector('.edu2g-beta-content'); if(root){ const devices=document.createElement('section'); devices.className='edu2g-beta-devices'; devices.innerHTML='<h3>신뢰 기기</h3><article class="edu2g-beta-device"><strong>현재 기기</strong><p>Visual fixture · 현재 기기 · 연결됨</p><button type="button">이 기기 해제</button></article>'; root.append(devices); }`); await wait(40);
    captures.push(await capture(page, `${label}-edu2g-devices-${width}x${height}`, ".edu2g-beta-dialog"));
    await evaluate(page, `const root=document.querySelector('.edu2g-beta-content'); if(root){ const confirm=document.createElement('p'); confirm.className='edu2g-beta-message'; confirm.textContent='이 기기의 연결을 해제할까요?'; root.append(confirm); }`); await wait(40);
    captures.push(await capture(page, `${label}-edu2g-revoke-confirm-${width}x${height}`, ".edu2g-beta-dialog"));
  }
  const metrics = await evaluate(page, `(() => {
    const rect = (selector) => { const box = document.querySelector(selector)?.getBoundingClientRect(); return box && { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), bottom: Math.round(box.bottom) }; };
    return {
      title: document.title,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth,
      bodyClass: document.body.className,
      sections: Array.from(document.querySelectorAll("main > section")).map((section) => section.id),
      loading: document.readyState,
      dashboard: rect("#dashboard"), dashboardGrid: rect(".dashboard-grid"), hero: rect(".hero-copy"),
      panels: [".school-panel", ".landfill-panel", ".class-panel", ".upload-panel"].map(rect),
    };
  })()`);
  const eventSummary = page.events.map((event) => {
    const rawUrl = event.params?.entry?.url || "";
    let origin = "";
    try { const parsed = new URL(rawUrl); origin = `${parsed.origin}${parsed.pathname}`; } catch (_) { origin = rawUrl ? "[REDACTED_URL]" : ""; }
    return { method: event.method, source: event.params?.entry?.source || event.params?.exceptionDetails?.exception?.className || "runtime", level: event.params?.entry?.level || "exception", origin };
  });
  await page.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  const zoom200 = await evaluate(page, `({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth })`);
  await page.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  const report = { label, url, captures, metrics, dashboardGeometry, zoom200, consoleEvents: page.events.length, eventSummary };
  fs.writeFileSync(path.join(output, "capture-report.json"), JSON.stringify(report, null, 2));
  page.close();
  process.stdout.write(JSON.stringify({ output, captureCount: captures.filter((entry) => !entry.missing).length, missing: captures.filter((entry) => entry.missing).length, consoleEvents: page.events.length, overflow: metrics.overflow }) + "\n");
})().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
