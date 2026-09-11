// 스플래시가 **걷히기 시작하는 순간**에 무언가를 한다 (2026-09-11, 지시 Bumm).
//
// 🔴 PC와 같은 타이밍이다. `app.js`의 `afterBootSplashStartsFading()`이 PC 대시보드에서
// 학교 선택 모달을 여는 자리이고, 학생 앱 가입 모달도 같은 순간에 떠야 한다:
//   ①스플래시 → ②걷히면서 화면과 모달이 함께 등장 → ③닫으면 화면이 밝아진다
//
// **다 걷힌 뒤가 아니라 페이드를 시작하는 순간**이어야 "함께 등장"이 된다 - 다 걷힌 뒤에
// 열면 화면만 보였다가 모달이 튀어나온다.
//
// 🔴 스플래시가 어떤 이유로도 안 걷히면 **모달이 영영 안 열려 가입할 방법이 사라지므로**,
// 넉넉한 시간이 지나면 그냥 연다(PC도 같은 안전장치를 둔다).
import { useEffect } from "react";

const POLL_MS = 50;
const GUARD_MS = 7000;

export function useAfterSplashFades(ready: boolean, run: () => void) {
  useEffect(() => {
    if (!ready) return undefined;
    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      window.clearTimeout(guard);
      run();
    };
    // authGate.js의 showApp()이 `gate.style.opacity = "0"`으로 페이드를 시작한다.
    // 게이트가 아예 없으면(하네스가 떼어낸 경우 등) 기다릴 것이 없다.
    const fading = () => {
      const gate = document.getElementById("authGate");
      return !gate || gate.style.opacity === "0" || getComputedStyle(gate).display === "none";
    };
    if (fading()) {
      // 이미 걷히는 중이어도 같은 프레임에 열지는 않는다 - 화면이 자리를 잡은 뒤에 연다.
      const immediate = window.setTimeout(fire, 0);
      return () => window.clearTimeout(immediate);
    }
    const timer = window.setInterval(() => { if (fading()) fire(); }, POLL_MS);
    const guard = window.setTimeout(fire, GUARD_MS);
    return () => { window.clearInterval(timer); window.clearTimeout(guard); };
  }, [ready, run]);
}
