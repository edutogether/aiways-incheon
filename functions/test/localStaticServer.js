"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(process.env.AIWAYS_STATIC_ROOT || path.resolve(__dirname, "..", ".."));
const port = Number(process.env.AIWAYS_STATIC_PORT || 8001);
const types = { ".bin": "application/octet-stream", ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const relative = (url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, ""));
  const file = path.resolve(root, relative);
  if (!file.startsWith(root)) return response.writeHead(403).end();
  fs.readFile(file, (error, content) => {
    if (error) return response.writeHead(404).end();
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    response.end(content);
  });
}).listen(port, "127.0.0.1");
