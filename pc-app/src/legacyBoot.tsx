// 리액트가 마운트를 마친 뒤 `app.js`의 진입점을 **직접 부른다** (S4).
//
// 🔴 타이밍에 기대지 않는다. `app.js`는 원래 DOMContentLoaded에 스스로 돌았는데,
// 리액트는 그보다 뒤에 그리므로 그 순서로는 채울 DOM이 없다. 동적 import나
// setTimeout으로 "그때쯤이면 됐겠지"를 만드는 대신, **커밋이 끝난 뒤 실행되는
// effect에서 부른다** — 그 시점에는 DOM이 확실히 있다.
//
// 🔴 화면에는 아무것도 그리지 않는다(null). 원본에 없는 요소를 만들면 기준선의
// `[id]`/구조 대조가 영원히 어긋난다.
import { useEffect } from "react";

declare global {
  interface Window {
    AIWaysPcDashboard?: { boot?: () => void };
    __AIWAYS_PC_REACT_BOOT?: boolean;
  }
}

// StrictMode는 개발 중에 effect를 두 번 부른다. `boot()`은 리스너를 붙이므로
// 두 번 돌면 핸들러가 겹친다 — 모듈 수준 깃발로 한 번만 돌게 막는다.
let booted = false;

export function LegacyBoot(): null {
  useEffect(() => {
    if (booted) return;
    const boot = window.AIWaysPcDashboard?.boot;
    if (typeof boot !== "function") {
      // 🔴 조용히 넘어가지 않는다. 여기서 못 부르면 화면이 **빈 채로** 뜨는데,
      // 그건 "아무 일도 안 일어난 것"처럼 보여서 원인을 찾는 데 오래 걸린다.
      console.error("[aiways] app.js의 진입점(window.AIWaysPcDashboard.boot)을 찾지 못했습니다 - 고전 스크립트가 실리지 않았거나 순서가 어긋났습니다.");
      return;
    }
    booted = true;
    boot();
  }, []);
  return null;
}
