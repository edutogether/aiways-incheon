import { createPortal } from "react-dom";
import { toastClassName, type Toast } from "../state/useToasts";

// 알림은 body 바로 아래에 붙인다. 원본이 document.body.append()로 붙였고,
// 화면 아래 고정(fixed)이라 앱 카드 안에 두면 카드의 overflow·transform에
// 갇혀 위치가 틀어진다.
export function ToastLayer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return createPortal(
    <>
      {toasts.map((toast) => (
        <div key={toast.id} className={toastClassName(toast.tone, toast.offscreen)}>{toast.message}</div>
      ))}
    </>,
    document.body
  );
}
