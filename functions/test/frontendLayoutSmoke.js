"use strict";

// Runs only against the local static server and a local Chrome DevTools port.
// It never sends a Functions, Firestore, Gemini, or App Check request.
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const WebSocket = require("ws");

const targetUrl = "http://127.0.0.1:8001/";
const widths = [...Array.from({ length: 41 }, (_, index) => 320 + index * 40), 671, 672, 673, 1023, 1024, 1025];
const heights = [568, 667, 720, 768, 844, 915, 1024, 1080];
const heightWidths = [360, 768, 1024, 1366];
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function request(pathname, method = "GET") { return new Promise((resolve, reject) => { const request = http.request({ hostname: "127.0.0.1", port: 9239, path: pathname, method }, (response) => { let body = ""; response.on("data", (chunk) => body += chunk); response.on("end", () => resolve(JSON.parse(body))); }); request.on("error", reject); request.end(); }); }
function connect(url) { return new Promise((resolve, reject) => { const socket = new WebSocket(url); let id = 0; const pending = new Map(); socket.on("open", () => resolve({ send(method, params = {}) { return new Promise((done, fail) => { const messageId = ++id; pending.set(messageId, { done, fail }); socket.send(JSON.stringify({ id: messageId, method, params })); }); }, close: () => socket.close() })); socket.on("message", (message) => { const packet = JSON.parse(message); if (!packet.id || !pending.has(packet.id)) return; const current = pending.get(packet.id); pending.delete(packet.id); packet.error ? current.fail(packet.error) : current.done(packet.result); }); socket.on("error", reject); }); }
async function evaluate(page, expression) { return (await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value; }
async function navigate(page, width, height) {
  await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 430 });
  await page.send("Page.navigate", { url: targetUrl });
  await delay(180);
  return evaluate(page, `(() => {
    const client = document.documentElement.clientWidth;
    const primary = document.querySelector('#sorting .sorting-app, #sorting');
    const rect = primary?.getBoundingClientRect();
    const focusable = [...document.querySelectorAll('button, a, input, select')].filter(node => { const box = node.getBoundingClientRect(); return box.width && box.height; });
    const tooSmall = focusable.filter(node => { const box = node.getBoundingClientRect(); return box.width < 40 || box.height < 40; }).length;
    return { width: innerWidth, height: innerHeight, html: document.documentElement.scrollWidth, body: document.body.scrollWidth, client, primaryVisible: Boolean(rect && rect.width > 0), tooSmall, initialRuntimeScripts: [...document.scripts].filter(script => /tensorflow|mobilenet|teachable/i.test(script.src)).length };
  })()`);
}

(async () => {
  const target = await request(`/json/new?${encodeURIComponent(targetUrl)}`, "PUT");
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send("Page.enable");
  const rows = [];
  for (const width of [...new Set(widths)].sort((a, b) => a - b)) rows.push(await navigate(page, width, 768));
  for (const width of heightWidths) for (const height of heights) rows.push(await navigate(page, width, height));
  const interactions = await evaluate(page, `(() => {
    const quick = document.querySelector('[data-sorting-mode="quick"]'); quick?.click();
    document.querySelector('[data-quick-item="milk"]')?.click();
    const search = document.querySelector('[data-sorting-mode="search"]'); search?.click();
    const input = document.querySelector('#searchInput'); if (input) { input.value = '우유갑'; document.querySelector('#searchButton')?.click(); }
    document.querySelector('[data-tab="holds"]')?.click();
    document.querySelector('[data-tab="classify"]')?.click();
    return { result: Boolean(document.querySelector('[data-sorting-result]')), mode: document.querySelector('.sorting-app')?.dataset.sortingMode, runtimeScripts: [...document.scripts].filter(script => /tensorflow|mobilenet|teachable/i.test(script.src)).length, noStoredImage: !Object.keys(localStorage).some(key => /base64|image|photo/i.test(String(localStorage.getItem(key) || ''))) };
  })()`);
  const fixtures = await evaluate(page, `(() => {
    const result = document.querySelector('[data-sorting-result]');
    const holds = document.querySelector('#holdList');
    const timeline = document.querySelector('#sortingTimeline');
    const modal = document.querySelector('#aiModal');
    if (!result || !holds || !timeline || !modal) return { ready: false };
    result.innerHTML = '<header class="judgement-result-head"><p>AI가 확인할 항목을 제안합니다.</p><strong>복합 재질의 아주 긴 교실 물건 이름</strong><span>최종 배출 판단은 사용자가 결정합니다.</span></header><details class="judgement-details" open><summary>물체·재질 후보</summary><div class="judgement-chip-row">' + Array.from({length: 8}, (_, i) => '<span class="judgement-chip"><b>참고 후보 ' + (i + 1) + '</b><em>사진 기반 참고 후보와 장문 주의 설명</em></span>').join('') + '</div></details><details class="judgement-details judgement-cautions" open><summary>보이는 주의 요소</summary><ul>' + Array.from({length: 6}, (_, i) => '<li>오염·코팅·내용물·학교 수거 기준을 다시 확인하는 긴 주의 항목 ' + (i + 1) + '</li>').join('') + '</ul></details><section class="judgement-checklist"><h4>배출 전 체크리스트</h4><div>' + Array.from({length: 7}, (_, i) => '<button class="judgement-check"><span></span>체크 항목 ' + (i + 1) + '</button>').join('') + '</div></section>';
    holds.innerHTML = Array.from({length: 12}, (_, i) => '<li><span>판단 보류 물건 ' + (i + 1) + ' · 긴 한글 사유</span><button>확인</button></li>').join('');
    timeline.innerHTML = Array.from({length: 8}, (_, i) => '<li>실천 기록 ' + (i + 1) + ' · 장문 설명</li>').join('');
    document.querySelector('#draftTitle').textContent = '긴 후보와 주의 요소가 있는 이미지 분류 초안';
    document.querySelector('#draftDesc').textContent = '사진은 참고 후보만 제안하며 학생이 오염과 학교 기준을 확인한 뒤 최종 판단합니다.';
    modal.showModal?.();
    const opened = modal.open;
    document.querySelector('[data-close-analysis]')?.click();
    return { ready: true, opened, closed: !modal.open, html: document.documentElement.scrollWidth, body: document.body.scrollWidth, client: document.documentElement.clientWidth };
  })()`);
  await page.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  const zoom = await evaluate(page, "({ scale: visualViewport.scale, html: document.documentElement.scrollWidth, body: document.body.scrollWidth, client: document.documentElement.clientWidth })");
  await page.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  const screenshot = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const screenshotPath = path.join(os.tmpdir(), `aiways-stage7-5-0-${Date.now()}.png`);
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  page.close();
  const failed = rows.find((row) => row.html !== row.client || row.body !== row.client || !row.primaryVisible || row.initialRuntimeScripts !== 0);
  if (failed) throw new Error(`layout contract failed: ${JSON.stringify(failed)}`);
  if (!interactions.result || interactions.runtimeScripts !== 0 || !interactions.noStoredImage) throw new Error(`interaction contract failed: ${JSON.stringify(interactions)}`);
  if (!fixtures.ready || !fixtures.opened || !fixtures.closed || fixtures.html !== fixtures.client || fixtures.body !== fixtures.client) throw new Error(`fixture contract failed: ${JSON.stringify(fixtures)}`);
  if (zoom.html !== zoom.client || zoom.body !== zoom.client || zoom.scale < 1) throw new Error(`zoom contract failed: ${JSON.stringify(zoom)}`);
  process.stdout.write(`${JSON.stringify({ viewportChecks: rows.length, interactions, fixtures, zoom, screenshotPath })}\n`);
})().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
