// 원본 index.html에 같은 SVG가 세 번 그대로 붙어 있었다(하단 배너, 사진 분석
// 중, 텍스트 분석 중). 그라디언트 id만 다르다 - SVG의 fill="url(#...)"은
// 문서 전역에서 id를 찾으므로, 세 곳이 같은 id를 쓰면 서로를 덮어쓴다.
// 그래서 id는 반드시 호출부가 서로 다르게 넘겨야 한다.
export function GeminiSpark({ gradientId, className }: { gradientId: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#EA4335" />
          <stop offset=".35" stopColor="#4285F4" />
          <stop offset=".65" stopColor="#34A853" />
          <stop offset="1" stopColor="#FBBC05" />
        </linearGradient>
      </defs>
      <path fill={`url(#${gradientId})`} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
    </svg>
  );
}
