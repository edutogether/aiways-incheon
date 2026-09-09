// 공용 확인 모달.
//
// 열고 닫는 연출 타이밍이 원본 그대로다:
//   열기: hidden을 떼고 50ms 뒤 scale-95/opacity-0을 떼서 커지며 나타남
//   닫기: scale-95/opacity-0을 다시 붙이고 300ms 뒤 hidden(연출이 끝난 뒤 숨김)
// 이 300ms를 안 지키면 모달이 "툭" 사라져서 체감이 달라진다.
import { useCallback, useEffect, useRef, useState } from "react";

const ENTER_DELAY_MS = 50;
const LEAVE_MS = 300;

export interface ConfirmRequest {
  title: string;
  description: string;
  icon: string;
  /** 확인 버튼의 색. 원본이 Tailwind 클래스 문자열을 그대로 받았다. */
  confirmClass: string;
  onConfirm: () => void;
}

export function useConfirmModal() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const [grown, setGrown] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
  }, []);

  const open = useCallback((next: ConfirmRequest) => {
    setRequest(next);
    setVisible(true);
    setGrown(false);
    timers.current.push(window.setTimeout(() => setGrown(true), ENTER_DELAY_MS));
  }, []);

  const close = useCallback(() => {
    setGrown(false);
    timers.current.push(window.setTimeout(() => {
      setVisible(false);
      setRequest(null);
    }, LEAVE_MS));
  }, []);

  const confirm = useCallback(() => {
    request?.onConfirm();
    close();
  }, [request, close]);

  return { request, visible, grown, open, close, confirm };
}
