// 검색창 왼쪽 이모지.
//
// 두 가지 상태를 오간다:
//  - 검색창이 비어 있으면 350ms마다 이모지를 바꾼다(가만히 있어도 살아있는
//    화면으로 보이게 하려는 연출)
//  - 뭔가 치면 350ms 기다렸다가(디바운스) 그 말에 맞는 이모지로 고정한다
// 바꿀 때마다 60ms 동안 투명해졌다 돌아오는데, 그 짧은 페이드가 없으면
// 글자가 툭툭 갈리는 것처럼 보인다.
import { useCallback, useEffect, useRef, useState } from "react";
import { DECORATIVE_EMOJI_LOOKUP, sortingDbV2 } from "../data/sortingData";
import { findItemId, matchDecorativeEmoji } from "./itemLookup";

const ROTATION_MS = 350;
const DEBOUNCE_MS = 350;
const FADE_MS = 60;

const ROTATION_POOL: string[] = [
  ...Object.values(sortingDbV2).filter((item) => !item.isHold).map((item) => item.emoji),
  ...DECORATIVE_EMOJI_LOOKUP.map(([emoji]) => emoji)
];

export function useSearchEmoji(query: string) {
  const [emoji, setEmoji] = useState("❓");
  const [faded, setFaded] = useState(false);
  const lastShown = useRef("");
  const rotationTimer = useRef<number | null>(null);
  const debounceTimer = useRef<number | null>(null);
  const fadeTimer = useRef<number | null>(null);

  const showIcon = useCallback((next: string) => {
    setFaded(true);
    if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
    fadeTimer.current = window.setTimeout(() => {
      setEmoji(next);
      setFaded(false);
    }, FADE_MS);
  }, []);

  const nextRandomEmoji = useCallback(() => {
    let pick = lastShown.current;
    // 같은 이모지가 연달아 나오면 "멈춘 것처럼" 보여서 다시 뽑는다.
    while (pick === lastShown.current) {
      pick = ROTATION_POOL[Math.floor(Math.random() * ROTATION_POOL.length)] ?? "❓";
    }
    lastShown.current = pick;
    return pick;
  }, []);

  const stopRotation = useCallback(() => {
    if (rotationTimer.current !== null) {
      window.clearInterval(rotationTimer.current);
      rotationTimer.current = null;
    }
  }, []);

  const startRotation = useCallback(() => {
    stopRotation();
    showIcon(nextRandomEmoji());
    rotationTimer.current = window.setInterval(() => showIcon(nextRandomEmoji()), ROTATION_MS);
  }, [stopRotation, showIcon, nextRandomEmoji]);

  // 첫 진입에서 회전을 시작한다.
  useEffect(() => {
    startRotation();
    return () => {
      stopRotation();
      if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
      if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
    };
  }, [startRotation, stopRotation]);

  // 입력이 바뀌면 디바운스 뒤에 확정한다. 첫 렌더에서는 위 효과가 이미
  // 회전을 걸었으므로 건너뛴다.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      const value = query.trim();
      if (!value) {
        startRotation();
        return;
      }
      stopRotation();
      const realId = findItemId(value);
      showIcon((realId ? sortingDbV2[realId]?.emoji : matchDecorativeEmoji(value)) || "❓");
    }, DEBOUNCE_MS);
  }, [query, startRotation, stopRotation, showIcon]);

  return { emoji, faded };
}
