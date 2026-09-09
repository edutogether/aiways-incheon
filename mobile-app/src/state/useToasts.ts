// 화면 아래에 잠깐 떴다 사라지는 알림.
//
// 원본(showVisualAlert)은 body에 div를 직접 붙이고 타이머 세 개로 연출했다:
//   0ms    translate-y-10 opacity-0 상태로 붙임(화면 아래·투명)
//   +50ms  두 클래스를 떼서 올라오며 나타남(transition-all duration-300)
//   +3200ms 다시 붙여서 내려가며 사라짐
//   +3500ms 요소 제거
// 이 타이밍이 곧 "체감"이라 그대로 옮긴다. 리액트에서는 같은 클래스를
// 상태로 들고, 붙이는 자리는 createPortal로 body를 그대로 쓴다.
import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "slate" | "emerald" | "amber";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** 아직 화면 아래에 숨어 있는 상태인가(들어올 때와 나갈 때 모두 true) */
  offscreen: boolean;
}

const ENTER_DELAY_MS = 50;
const VISIBLE_MS = 3200;
const LEAVE_MS = 300;

const TONE_CLASS: Record<ToastTone, string> = {
  slate: "bg-slate-800 text-white",
  emerald: "bg-emerald-600 text-white",
  amber: "bg-amber-600 text-white"
};

export function toastClassName(tone: ToastTone, offscreen: boolean): string {
  const base = `fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3.5 rounded-2xl shadow-xl font-bold text-xs ${TONE_CLASS[tone]} transition-all duration-300 transform`;
  // 원본은 문자열 뒤에 translate-y-10 opacity-0을 붙였다 떼었다 했다.
  // 클래스 순서까지 같아야 비교가 깔끔하다.
  return offscreen
    ? `${base} translate-y-10 opacity-0 z-50 text-center min-w-[280px] max-w-sm`
    : `${base} z-50 text-center min-w-[280px] max-w-sm`;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "slate") => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current, { id, message, tone, offscreen: true }]);
    const setOffscreen = (offscreen: boolean) =>
      setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, offscreen } : toast)));

    timers.current.push(window.setTimeout(() => setOffscreen(false), ENTER_DELAY_MS));
    // 사라지기 시작하는 시각은 "붙인 때로부터 3200ms"다(들어오는 50ms를
    // 더하지 않는다) - 원본의 두 타이머가 둘 다 생성 시점을 기준으로 걸린다.
    timers.current.push(window.setTimeout(() => {
      setOffscreen(true);
      timers.current.push(window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, LEAVE_MS));
    }, VISIBLE_MS));
  }, []);

  return { toasts, showToast };
}
