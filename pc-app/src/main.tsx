// PC 화면 리액트 전환의 진입점.
//
// 🔴 리액트를 **id 없는 래퍼**에 붙이고 그 래퍼를 `display: contents`로 둔다.
//
// 원본은 header·main·dialog들이 전부 <body>의 직계 자식이다. 리액트를 붙이려면
// 그릇이 하나 필요한데, 그 그릇이 레이아웃에 끼면 body의 자식 구성이 달라진다.
// `display: contents`는 그 상자를 레이아웃에서 빼서 **자식들이 body의 자식처럼**
// 배치되게 한다(이 저장소 CSS에 `body >` 선택자가 없는 것을 확인했다).
//
// id를 안 붙이는 이유: 기준선이 `[id]`를 전부 모아 비교하므로, 원본에 없는
// id가 하나라도 생기면 **그 대조가 영원히 빨간불**이 된다. 원본에 없는 것을
// 만들지 않는 것이 이 전환의 규칙이다.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.createElement("div");
container.style.display = "contents";
document.body.append(container);

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
