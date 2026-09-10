// 전환된 화면 마크업이 **원본에 없던 글자를 화면에 내지 않는지** 본다.
//
// 왜 있는가: 2026-09-11에 `App.tsx`에 `COMMENT0` … `COMMENT5`라는 글자가
// **여섯 개나 화면에 그대로 찍힌 채 프리뷰에 나갔다.** 헤더 바로 아래(y=79)에
// `COMMENT0 COMMENT1 COMMENT2`가 보이는 상태였고, 원본에는 없는 글자다.
// Bumm님이 화면을 보시고 발견하셨다.
//
// 원인은 `scripts/htmlToTsx.mjs`가 HTML 주석을 ` COMMENT<n> ` 자리표시자로 빼뒀다가
// 되돌리는데, 그 사이에 끼어든 `{" "}` 삽입 때문에 **되돌리기가 하나도 안 된 것**이다.
// 변환기 쪽에도 "남으면 멈춘다" 장치를 넣었지만, 🔴 **변환기는 빌드에 걸려 있지 않고
// 1회성으로 돌린 뒤 손으로 관리하는 파일이라** 그 장치만으로는 이 파일을 못 지킨다.
// 그래서 산출물 자체를 여기서 본다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");

describe("App.tsx 마크업", () => {
  it("변환기 자리표시자가 남아 있지 않다", () => {
    const leftover = APP.match(/COMMENT\d+/g) || [];
    expect(
      leftover,
      `변환기 자리표시자가 남아 있습니다(${[...new Set(leftover)].join(", ")}) - 화면에 글자로 찍힙니다.`
    ).toEqual([]);
  });

  it("원본 주석이 JSX 주석으로 살아 있다", () => {
    // 🔴 "자리표시자가 없다"만 보면 **전부 지워 버려도 통과한다**(§21).
    // 옮겨간 쪽에도 하한을 둔다. 6은 원본 index.html의 <header> ~ </body> 구간
    // 주석 수이고, 주석이 늘면 이 수도 늘기만 하므로 하한으로 둔다.
    const jsxComments = APP.match(/\{\/\*/g) || [];
    expect(
      jsxComments.length,
      `JSX 주석이 ${jsxComments.length}개뿐입니다(6개 이상이어야 합니다) - 주석이 통째로 사라졌는지 확인하세요.`
    ).toBeGreaterThanOrEqual(6);
  });

  it("JSX 주석이 문법을 깨뜨리지 않는다", () => {
    // 주석 본문에 */ 가 있으면 주석이 일찍 닫혀 그 뒤가 화면 글자가 된다.
    const bodies = [...APP.matchAll(/\{\/\*([\s\S]*?)\*\/\}/g)].map((m) => m[1] ?? "");
    expect(bodies.length, "JSX 주석을 하나도 못 찾았습니다 - 이 검사가 무엇을 보는지 다시 봐야 합니다.").toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body.includes("*/"), `주석 본문에 */ 가 들어 있습니다: ${body.slice(0, 40)}`).toBe(false);
    }
  });
});
