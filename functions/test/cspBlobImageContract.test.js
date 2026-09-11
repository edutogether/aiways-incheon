"use strict";

// 🔴 2026-09-11: PC 대시보드와 학생 앱의 "AI 판단"이 **라이브에서 열흘 넘게**
// 모든 사진에 대해 "사진을 불러오지 못했습니다"로 끝나고 있었다. 원인은
// App Check가 아니라 CSP였다 - 사진 미리보기가 `URL.createObjectURL(file)`로
// 만든 `blob:` 주소인데 `img-src`에 `blob:`이 없어서 브라우저가 막았고,
// `image.onload`가 영영 안 불려 분석 자체가 시작되지 않았다.
//
// 🔴 이 결함은 콘솔에만 남고 화면에는 "사진을 다시 골라 주세요"로 보여서,
// 사람이 볼 때는 "사진이 이상한가 보다"로 읽힌다. 그래서 검사로 못박는다.
//
// 이 검사는 **CSP 문자열을 외우지 않는다.** 소스가 실제로 blob 이미지를 쓰는지
// 먼저 확인하고, 쓴다면 CSP가 그것을 허용하는지 본다 - 소스가 안 쓰게 바뀌면
// 이 검사도 같이 필요 없어진다.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// 사진을 blob 주소로 만들어 <img>에 넣는 자리들. 하나라도 빠지면 그 화면만
// 조용히 죽으므로 파일을 명시적으로 적는다(§21 - 대상을 못 찾으면 통과하는
// 검사를 만들지 않는다).
const BLOB_IMAGE_SOURCES = ["app.js", "mobile-app/src/judge/useJudge.ts"];

function mainCsp() {
  const config = JSON.parse(read("firebase.json"));
  const headers = config.hosting.headers.flatMap((entry) =>
    entry.source === "**" ? entry.headers : []);
  const csp = headers.find((h) => h.key === "Content-Security-Policy");
  expect(csp, "firebase.json의 ** 항목에 CSP가 없다").toBeTruthy();
  return Object.fromEntries(
    csp.value.split(";").map((part) => part.trim()).filter(Boolean)
      .map((part) => [part.split(/\s+/)[0], part.split(/\s+/).slice(1)]));
}

describe("CSP가 사진 미리보기(blob:)를 허용하는가", () => {
  it("소스가 실제로 blob 이미지를 쓴다 - 이 검사의 전제", () => {
    let uses = 0;
    for (const file of BLOB_IMAGE_SOURCES) {
      const text = read(file);
      // createObjectURL로 만든 주소를 Image/`<img>`의 src에 넣는 형태
      if (/createObjectURL/.test(text) && /new Image\(\)|#modalPreview|scanImageUrl/.test(text)) uses += 1;
    }
    // 하한을 고정값으로 적는다 - 목록에서 세면 목록이 비어도 통과한다
    expect(uses, `blob 이미지를 쓰는 파일이 ${uses}개다(2개여야 한다)`).toBe(2);
  });

  it("img-src가 blob:을 허용한다", () => {
    expect(mainCsp()["img-src"]).toContain("blob:");
  });

  it("blob:을 남발하지 않는다 - script-src/object-src에는 없다", () => {
    const csp = mainCsp();
    expect(csp["script-src"]).not.toContain("blob:");
    expect(csp["object-src"]).toEqual(["'none'"]);
  });
});
