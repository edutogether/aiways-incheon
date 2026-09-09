// localStorage 읽고 쓰기.
//
// 원본 app.js는 모든 접근을 try/catch로 감쌌다. 사파리 사생활 보호 모드처럼
// localStorage 자체가 던지는 환경이 실제로 있고, 거기서 예외가 새어 나가면
// 앱이 통째로 멈춘다. 그 성질을 그대로 지킨다 - 실패하면 조용히 기본값으로
// 간다(기록이 안 남는 것보다 화면이 안 뜨는 게 훨씬 나쁘다).

export const STORAGE_KEYS = {
  stats: "aiways_mobile_stats_v1",
  hold: "aiways_mobile_hold_v1",
  classContext: "aiways_mobile_class_v1",
  signupBannerDismissed: "aiways_mobile_signup_banner_dismissed_v1"
} as const;

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 못 해도 화면은 계속 돈다 */
  }
}

export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 위와 같다 */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 위와 같다 */
  }
}

export interface ClassContext {
  schoolId: string;
  schoolName: string;
  grade: string;
  classNum: string;
}

// 학교·학년·반이 모두 있어야 "우리 반 기록"으로 집계된다. 하나라도 비면
// 없는 것으로 친다 - 원본 loadClassContext()와 같은 판단이다.
export function loadClassContext(): ClassContext | null {
  const saved = readJson<Partial<ClassContext> | null>(STORAGE_KEYS.classContext, null);
  if (!saved?.schoolId || !saved.grade || !saved.classNum) return null;
  return {
    schoolId: saved.schoolId,
    schoolName: saved.schoolName ?? "",
    grade: saved.grade,
    classNum: saved.classNum
  };
}
