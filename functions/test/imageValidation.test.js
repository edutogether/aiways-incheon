"use strict";
// 2026-09-01 종합감사(B그룹 4번): imageValidation.js는 어떤 테스트에서도
// 한 번도 require된 적 없었다 - 업로드 크기/이미지폭탄 방어(§2 보안 인접)
// 로직이 완전 미검증 상태였다. PNG/JPEG/WEBP 각 포맷의 최소 유효 바이트를
// 직접 구성해서 dimensions() 파싱 경로와 validateImage()의 4가지 실패
// 코드(invalid_base64/image_too_large/image_signature_mismatch/
// image_dimensions_too_large)를 전부 확인한다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_IMAGE_BYTES, MAX_EDGE, MAX_PIXELS, validateImage } = require("../lib/imageValidation");

function b64(buffer) { return buffer.toString("base64"); }

function makePng(width, height) {
  const buf = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buf, 0);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function makeJpeg(width, height) {
  const buf = Buffer.alloc(30);
  buf[0] = 0xff; buf[1] = 0xd8; // SOI
  buf[2] = 0xff; buf[3] = 0xc0; // SOF0
  buf.writeUInt16BE(17, 4); // segment length
  buf[6] = 8; // precision
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  return buf;
}

function makeWebpVp8x(width, height) {
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0);
  buf.write("WEBP", 8);
  buf.write("VP8X", 12);
  buf.writeUIntLE(width - 1, 24, 3);
  buf.writeUIntLE(height - 1, 27, 3);
  return buf;
}

test("rejects non-base64 and malformed-length input", () => {
  assert.equal(validateImage("not base64 at all!!", "image/png").code, "invalid_base64");
  assert.equal(validateImage("abc", "image/png").code, "invalid_base64"); // length not multiple of 4
  assert.equal(validateImage("", "image/png").code, "invalid_base64");
  assert.equal(validateImage(null, "image/png").code, "invalid_base64");
  assert.equal(validateImage(undefined, "image/png").code, "invalid_base64");
});

test("rejects a payload decoding to more than MAX_IMAGE_BYTES regardless of content", () => {
  const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1);
  const result = validateImage(b64(oversized), "image/png");
  assert.equal(result.code, "image_too_large");
});

test("rejects valid base64 whose bytes match no known image signature", () => {
  const junk = Buffer.from("this is definitely not an image file header");
  const result = validateImage(b64(junk), "image/png");
  assert.equal(result.code, "image_signature_mismatch");
});

test("accepts a well-formed small PNG and reports its real dimensions", () => {
  const png = makePng(100, 50);
  const result = validateImage(b64(png), "image/png");
  assert.equal(result.ok, true);
  assert.equal(result.w, 100);
  assert.equal(result.h, 50);
  assert.equal(result.bytes, png.length);
});

test("accepts a well-formed small JPEG (SOF0) and reports its real dimensions", () => {
  const jpeg = makeJpeg(120, 80);
  const result = validateImage(b64(jpeg), "image/jpeg");
  assert.equal(result.ok, true);
  assert.equal(result.w, 120);
  assert.equal(result.h, 80);
});

test("accepts a well-formed small WEBP (VP8X) and reports its real dimensions", () => {
  const webp = makeWebpVp8x(200, 150);
  const result = validateImage(b64(webp), "image/webp");
  assert.equal(result.ok, true);
  assert.equal(result.w, 200);
  assert.equal(result.h, 150);
});

test("rejects a PNG whose declared edge exceeds MAX_EDGE", () => {
  const png = makePng(MAX_EDGE + 1, 100);
  const result = validateImage(b64(png), "image/png");
  assert.equal(result.code, "image_dimensions_too_large");
});

test("rejects a PNG whose declared pixel count exceeds MAX_PIXELS even with both edges individually under MAX_EDGE", () => {
  // 4900 * 4900 = 24,010,000 > MAX_PIXELS (16,000,000), but both edges are < MAX_EDGE (5000).
  const png = makePng(4900, 4900);
  const result = validateImage(b64(png), "image/png");
  assert.equal(result.code, "image_dimensions_too_large");
});

test("accepts a PNG right at the edge/pixel limits (boundary, not just interior)", () => {
  const png = makePng(MAX_EDGE, 1); // edge exactly at MAX_EDGE, well under MAX_PIXELS
  const result = validateImage(b64(png), "image/png");
  assert.equal(result.ok, true);
});

test("declared mimeType must match the actual byte signature -- a PNG's bytes sent as image/jpeg is a mismatch, not a silent pass", () => {
  const png = makePng(100, 100);
  const result = validateImage(b64(png), "image/jpeg");
  assert.equal(result.code, "image_signature_mismatch");
});
