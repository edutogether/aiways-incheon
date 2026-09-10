// `extractLegacyFns.mjs`의 타입. 이 파일은 검사에서만 쓰는 도구라 TS로 쓰지
// 않았고(빌드에 들어가지 않는다), 대신 여기서 모양만 알려준다.
export function extractFunction(source: string, name: string): string;
export function loadLegacy(names: string[], extraSource?: string): Record<string, unknown>;
export function legacySource(): string;
export function extractConst(source: string, name: string): string;
export function loadLegacyConsts(names: string[]): Record<string, unknown>;
