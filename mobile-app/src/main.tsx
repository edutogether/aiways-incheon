// 리액트 진입점.
//
// #appRoot 자체가 아니라 그 "안쪽"을 리액트가 그린다. #appRoot는 authGate.js가
// 인증 통과 시점에 hidden 클래스를 떼는 요소라, 리액트가 이 요소를 소유하면
// 그 조작이 리렌더에 지워질 수 있다. 컨테이너로만 쓰고 건드리지 않는다.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("appRoot");
if (!container) {
  // index.html과 이 파일이 어긋나면 화면이 조용히 비어버린다. 조용한 실패보다
  // 콘솔에 뜨는 실패가 낫다.
  throw new Error("#appRoot 를 찾지 못했습니다 - index.html이 바뀌었는지 확인하세요.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
