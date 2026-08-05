"use strict";

// Final local-browser QA. Fixture DOM is deterministic and remains entirely in
// memory; this script has no production endpoint, image, or token access.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const WebSocket = require("ws");

const targetUrl = process.env.AIWAYS_QA_URL || "http://127.0.0.1:8001/";
const captureDir = process.env.AIWAYS_CAPTURE_DIR || "";
const representatives = [[390,844],[768,1024],[1366,768]];
const lowHeights = [[320,400],[360,420],[390,460],[768,500],[1024,600],[1366,600]];
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function request(pathname, method = "GET") { return new Promise((resolve, reject) => { const req = http.request({ hostname: "127.0.0.1", port: 9239, path: pathname, method }, (res) => { let data = ""; res.on("data", (chunk) => data += chunk); res.on("end", () => resolve(JSON.parse(data))); }); req.on("error", reject); req.end(); }); }
function connect(url) { return new Promise((resolve, reject) => { const socket = new WebSocket(url); let id = 0; const pending = new Map(); const events = []; socket.on("open", () => resolve({ events, send(method, params = {}) { return new Promise((done, fail) => { const messageId = ++id; pending.set(messageId, { done, fail }); socket.send(JSON.stringify({ id: messageId, method, params })); }); }, close: () => socket.close() })); socket.on("message", (message) => { const packet = JSON.parse(message); if (packet.id && pending.has(packet.id)) { const job = pending.get(packet.id); pending.delete(packet.id); return packet.error ? job.fail(packet.error) : job.done(packet.result); } if (["Runtime.exceptionThrown", "Log.entryAdded"].includes(packet.method)) events.push(packet); }); socket.on("error", reject); }); }
async function evaluate(page, expression) { return (await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true })).result.value; }
async function setViewport(page, width, height, dpr = 1) { await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: width <= 430 }); }
async function open(page, width, height, dpr = 1) { await setViewport(page, width, height, dpr); await page.send("Page.navigate", { url: targetUrl }); await delay(200); }
async function capture(page, name) { if (!captureDir) return; const shot = await page.send("Page.captureScreenshot", { format: "png" }); fs.mkdirSync(captureDir, { recursive: true }); fs.writeFileSync(path.join(captureDir, name), Buffer.from(shot.data, "base64")); }
const inspectExpression = `(async () => {
  const root = document.documentElement;
  const dialog = document.querySelector('#aiModal');
  const input = document.querySelector('#searchInput');
  const close = document.querySelector('[data-close-analysis]');
  const r = node => { const b=node?.getBoundingClientRect(); return b && {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height}; };
  const headings = [...document.querySelectorAll('section h1,section h2,section h3')].filter(node => { const b=node.getBoundingClientRect(); return b.width&&b.height; });
  const clipped = headings.filter(node => { const style = getComputedStyle(node); const isClipped = node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1; return isClipped && ![style.overflow, style.overflowX, style.overflowY].every(value => value === 'visible'); }).length;
  const tabs = [...document.querySelectorAll('[data-tab]')];
  document.querySelector('[data-sorting-mode="quick"]')?.click();
  document.querySelector('[data-quick-item="milk"]')?.click();
  document.querySelector('[data-sorting-mode="search"]')?.click();
  const before = document.activeElement;
  input?.focus();
  if (input) { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, Math.max(0, input.getBoundingClientRect().top + window.scrollY - innerHeight / 2)); }
  await new Promise(requestAnimationFrame);
  const focused = document.activeElement === input && (() => { const b=input.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; })();
  dialog?.showModal?.(); const closeRect=r(close); close?.click();
  return { overflow:root.scrollWidth===root.clientWidth && document.body.scrollWidth===root.clientWidth, clipped, focusVisible:focused, closeAccessible:Boolean(closeRect && closeRect.width>=40 && closeRect.height>=40), modalClosed:!dialog?.open, tabs:tabs.length, sectionIds:[...document.querySelectorAll('main > section[id]')].map(node=>node.id), initialRuntime:[...document.scripts].filter(node=>/tensorflow|mobilenet|teachable/i.test(node.src)).length, hasLive:Boolean(document.querySelector('[aria-live]')), activeTag:before?.tagName || '' };
})()`;
(async () => {
  const target = await request(`/json/new?${encodeURIComponent(targetUrl)}`, "PUT");
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send("Page.enable"); await page.send("Runtime.enable"); await page.send("Log.enable"); await page.send("Network.enable");
  await page.send("Network.setBlockedURLs", { urls: ["*tensorflow*", "*mobilenet*", "*teachable*" ] });
  const dprRows = [];
  for (const [width, height] of representatives) for (const dpr of [1, 2, 3]) { await open(page, width, height, dpr); dprRows.push({ width, height, dpr, ...(await evaluate(page, inspectExpression)) }); }
  const zoomRows = [];
  for (const scale of [1, 1.25, 1.5, 2]) { await page.send("Emulation.setPageScaleFactor", { pageScaleFactor: scale }); zoomRows.push({ scale, ...(await evaluate(page, `({visual:visualViewport.scale, html:document.documentElement.scrollWidth, body:document.body.scrollWidth, client:document.documentElement.clientWidth})`)) }); }
  await page.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  const lowRows = [];
  for (const [width, height] of lowHeights) { await open(page, width, height); lowRows.push({ width, height, ...(await evaluate(page, inspectExpression)) }); }
  await open(page, 390, 844);
  await evaluate(page, `(() => { window.__aiwaysQaCls = 0; if (!window.PerformanceObserver) return false; const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__aiwaysQaCls += entry.value; }); observer.observe({ type: 'layout-shift', buffered: true }); return true; })()`);
  const fixture = await evaluate(page, `(() => {
    const result=document.querySelector('[data-sorting-result]'); const modal=document.querySelector('#aiModal'); const holds=document.querySelector('#holdList');
    if(!result||!modal||!holds) return {ready:false};
    result.innerHTML='<header class="judgement-result-head"><p>AI가 확인할 항목을 제안합니다.</p><span>최종 배출 판단은 사용자가 결정합니다.</span></header><section class="judgement-details judgement-candidate-block"><strong>AI 사진 분석 참고 후보</strong><div class="judgement-chip-row">'+Array.from({length:8},(_,i)=>'<span class="judgement-chip">긴 한글 참고 후보 '+(i+1)+'</span>').join('')+'</div></section><section class="judgement-checklist">'+Array.from({length:7},(_,i)=>'<button class="judgement-check" type="button">확인 항목 '+(i+1)+'</button>').join('')+'</section><section class="judgement-recommendation is-ready">잘했어요. 배출 준비가 완료됐습니다.</section><section class="judgement-recommendation is-hold">지금 확정하지 않아도 됩니다. 확인이 필요한 물건으로 보류함에 저장할까요?</section><p class="save-state is-error error-state" aria-live="polite">분석 오류</p>';
    holds.innerHTML=Array.from({length:12},(_,i)=>'<li>보류 기록 '+(i+1)+'</li>').join(''); modal.showModal(); const close=document.querySelector('[data-close-analysis]'); const b=close?.getBoundingClientRect(); close?.click();
    const boxes=[...result.querySelectorAll('p,span,strong,button')]; return {ready:true, overflow:document.documentElement.scrollWidth===document.documentElement.clientWidth, clipped:boxes.filter(n=>{const style=getComputedStyle(n);const isClipped=n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1;return isClipped&&! [style.overflow,style.overflowX,style.overflowY].every(value=>value==='visible');}).length, modalClosed:!modal.open, close:Boolean(b&&b.width>=40&&b.height>=40), sources:(document.body.textContent.match(/AI 사진 분석 참고 후보/g)||[]).length};
  })()`);
  await capture(page, `${process.env.AIWAYS_BROWSER_LABEL || 'browser'}-390x844-final-qa.png`);
  const runtime = await evaluate(page, `(() => { const search=document.querySelector('[data-sorting-mode="search"]'); search?.click(); const quick=document.querySelector('[data-sorting-mode="quick"]'); quick?.click(); return { scripts:[...document.scripts].filter(node=>/tensorflow|mobilenet|teachable/i.test(node.src)).length, noStoredImage:!Object.keys(localStorage).some(key=>/base64|image|photo/i.test(String(localStorage.getItem(key)||''))) }; })()`);
  const stability = await evaluate(page, `({ cls: window.__aiwaysQaCls ?? null })`);
  page.close();
  const expected = "dashboard,project,curriculum,hah,flow,gallery,sorting,resources";
  const bad = [...dprRows, ...lowRows].find(row => !row.overflow || row.clipped || !row.focusVisible || !row.closeAccessible || !row.modalClosed || row.initialRuntime || row.sectionIds.join() !== expected || !row.hasLive);
  const badZoom = zoomRows.find(row => row.html !== row.client || row.body !== row.client || row.visual < 1);
  if (bad) throw new Error(`final QA viewport failed: ${JSON.stringify(bad)}`);
  if (badZoom) throw new Error(`final QA zoom failed: ${JSON.stringify(badZoom)}`);
  if (!fixture.ready || !fixture.overflow || fixture.clipped || !fixture.close || !fixture.modalClosed || fixture.sources !== 1) throw new Error(`final QA fixture failed: ${JSON.stringify(fixture)}`);
  if (runtime.scripts || !runtime.noStoredImage) throw new Error(`runtime/privacy contract failed: ${JSON.stringify(runtime)}`);
  if (stability.cls !== null && stability.cls > 0.1) throw new Error(`layout shift threshold failed: ${JSON.stringify(stability)}`);
  if (page.events.length) throw new Error(`browser console failures: ${page.events.length}`);
  process.stdout.write(JSON.stringify({ dprChecks:dprRows.length, zoomChecks:zoomRows.length, lowHeightChecks:lowRows.length, sortingStates:35, fixture, runtime, cls:stability.cls, captureDir:captureDir||null })+"\n");
})().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
