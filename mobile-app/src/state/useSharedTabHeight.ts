// 탭 네 개가 같은 최소 높이를 쓰게 만든다.
//
// 왜: 탭을 옮길 때마다 카드가 눈에 띄게 줄었다 늘었다 하면 화면이 튄다.
// 가장 높은 탭에 맞춰 최소 높이를 잡아두면 그 흔들림이 사라진다.
//
// 높이를 추측하지 않는다. 어떤 탭의 진짜 높이는 **그 탭이 실제로 화면에
// 보이는 동안에만** 잰다 - 숨긴 채로(또는 position:absolute로 빼놓고) 재면
// 너비가 달라져 높이가 실제보다 작게 나온다. 대신 아직 한 번도 안 열어본
// 탭은 공유 높이에 기여하지 못하는데, 탭을 두어 번 옮기면 저절로 해결된다.
import { useCallback, useEffect, useRef, useState } from "react";

const REFLOW_RECHECK_MS = [400, 1200];
const RESIZE_DEBOUNCE_MS = 200;

export function useSharedTabHeight(activeTab: string) {
  const [minHeight, setMinHeight] = useState(0);
  // 탭을 눌렀다는 사실 자체를 세어 둔다. 이미 열려 있는 탭을 또 눌러도
  // 원본은 높이를 다시 재는데(switchTab이 매번 growSharedTabHeight를
  // 부른다), 활성 탭 값만 보고 있으면 값이 안 바뀌어 다시 재지 않는다.
  // 그러면 아직 한 번도 안 열어본 탭의 높이가 영영 반영되지 않는다.
  const [syncTick, setSyncTick] = useState(0);
  const tallest = useRef(0);

  const sync = useCallback(() => {
    const active = document.querySelector<HTMLElement>(".tab-content:not(.hidden)");
    if (!active) return;
    // 잴 때만 최소 높이를 잠깐 걷어낸다 - 안 그러면 이전에 넣어둔 값이
    // 그대로 "자연 높이"로 읽혀서 높이가 영영 안 줄어든다.
    const applied = active.style.minHeight;
    active.style.minHeight = "";
    const natural = active.scrollHeight;
    active.style.minHeight = applied;
    if (natural <= tallest.current) return;
    tallest.current = natural;
    setMinHeight(natural);
  }, []);

  // 탭을 누를 때마다(같은 탭이어도) 새로 보이는 탭의 높이를 잰다.
  useEffect(() => {
    sync();
  }, [activeTab, syncTick, sync]);

  useEffect(() => {
    sync();
    // 웹폰트(Pretendard)가 늦게 바뀌면 줄바꿈이 달라져 높이가 몇 px 어긋난다.
    // fonts.ready 이후에도 브라우저에 따라 한 번 더 흔들리는 경우가 있어,
    // 비용이 거의 없는 재측정을 두 번 더 건다.
    void document.fonts?.ready.then(sync).catch(() => undefined);
    const timers = REFLOW_RECHECK_MS.map((delay) => window.setTimeout(sync, delay));

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(sync, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", onResize);

    // authGate.js가 인증 통과 직후 부른다. #appRoot가 실제로 드러난 뒤에야
    // 높이가 진짜 값이 되기 때문에 이 연결점이 필요하다.
    window.AIWaysMobileApp = { syncTabHeights: sync };

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      delete window.AIWaysMobileApp;
    };
  }, [sync]);

  return {
    minHeight,
    /** 탭을 눌렀다고 알린다 - 같은 탭이어도 높이를 다시 잰다. */
    requestSync: () => setSyncTick((tick) => tick + 1)
  };
}
