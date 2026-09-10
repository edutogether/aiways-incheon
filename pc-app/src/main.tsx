// PC 화면 리액트 전환의 진입점 (S1).
//
// 🔴 지금은 **아무것도 그리지 않는다.** S1의 목표는 "토대가 서고 기존
// 라이브는 그대로"이지, 화면을 만드는 것이 아니다. 마크업은 S2에서
// 원본 index.html을 옮기며 채운다.
//
// 붙는 자리를 #pcRoot로 따로 둔 이유: 원본에는 app.js가 붙잡는 id가
// 200개 가까이 있고, 그 이름들을 S2에서 **그대로** 가져와야 한다.
// 지금 임의로 겹치는 id를 만들어 두면 나중에 무엇이 원본 것이고
// 무엇이 내가 만든 것인지 구분이 안 된다.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("pcRoot");
// 조용히 아무 일도 안 하는 대신 큰 소리로 실패한다 - 붙을 자리가 없으면
// 화면이 통째로 안 뜨는 것이고, 그건 알아야 할 사고다.
if (!container) throw new Error("#pcRoot를 찾지 못했습니다 - 리액트가 붙을 자리가 없습니다.");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
