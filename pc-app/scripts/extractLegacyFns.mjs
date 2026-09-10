// 원본 `app.js`에서 **함수 원문을 그대로 떼어 온다.**
//
// 왜 필요한가: S3는 계산 로직을 TS로 옮기는 단계인데, 옮긴 것이 맞는지
// 확인하려면 **원본 함수를 실제로 실행한 값**과 대조해야 한다. 그런데 `app.js`는
// 통째로 IIFE라 안쪽 함수를 밖에서 부를 수 없다.
//
// 🔴 원문을 복사해 픽스처로 만들어 두면 **기준을 감시 대상에서 가져오는 것**이
// 된다(§21-7). 그래서 검사할 때마다 **파일에서 그때그때 떼어 와서** 실행한다 —
// 원본이 바뀌면 대조도 같이 바뀐다.
import { readFileSync } from "node:fs";

// 이름으로 함수 원문을 찾아 중괄호 균형으로 끝을 찾는다.
export function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`app.js에서 ${name}() 를 찾지 못했습니다 - 이름이 바뀌었으면 대조가 조용히 사라집니다.`);
  let depth = 0;
  let started = false;
  for (let i = at; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; started = true; }
    else if (ch === "}") {
      depth -= 1;
      if (started && depth === 0) return source.slice(at, i + 1);
    }
  }
  throw new Error(`${name}() 의 끝을 찾지 못했습니다.`);
}

// 여러 함수를 한 덩어리로 떼어 와 같은 스코프에서 실행한다. 서로를 부르기
// 때문에 따로 떼면 "정의되지 않음"으로 죽는다.
export function loadLegacy(names, extraSource = "") {
  const source = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
  const bodies = names.map((n) => extractFunction(source, n)).join("\n\n");
  const factory = new Function(`${extraSource}\n${bodies}\nreturn { ${names.join(", ")} };`);
  return factory();
}
