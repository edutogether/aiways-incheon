// PC 앱과 공유하는 전역들의 타입 선언.
//
// firebaseAppCheck.js / firebaseBetaAuth.js / edu2gBetaClient.js는 PC 앱이
// 같이 쓰는 파일이라 이번 전환 대상이 아니다. 계속 <script>로 로드해서
// window에서 읽되, **여기 한 곳에서만** 읽고 타입을 붙인다 - 전역을 앱
// 곳곳에서 직접 만지면 "무엇이 있는지"를 아무도 모르게 된다.

export type ConfidenceBand = "high" | "medium" | "low" | "unknown";
export type Uncertainty = "low" | "medium" | "high";

// 서버 응답의 공통 껍데기. 성공/실패를 code로 구분한다.
export interface ClientResponse<T = unknown> {
  ok: boolean;
  status?: number;
  code?: string;
  data?: T;
}

// edu2gBetaClient.js가 window에 붙이는 것 중 mobile/이 실제로 쓰는 것만
// 적는다. 안 쓰는 것까지 옮겨 적으면 원본이 바뀔 때 여기가 조용히 낡는다.
export interface Edu2gClient {
  errorMessageFor?: (code: string) => string;
  analyzeSortingImage?: (payload: unknown) => Promise<ClientResponse>;
  analyzeSortingText?: (payload: unknown) => Promise<ClientResponse>;
  saveSortingRecord?: (payload: unknown) => Promise<ClientResponse<{ recordId?: string }>>;
  resolveSortingRecord?: (payload: unknown) => Promise<ClientResponse>;
  checkStudentProfile?: () => Promise<ClientResponse>;
  previewStudentProfile?: (payload: unknown) => Promise<ClientResponse>;
  registerStudentProfile?: (payload: unknown) => Promise<ClientResponse>;
  checkCampusLocation?: (payload: { schoolId: string; lat: number; lng: number }) => Promise<ClientResponse<{ campusCheckId?: string }>>;
  previewClassChange?: (payload: { grade: string; classNum: string }) => Promise<ClientResponse>;
  changeStudentClass?: (payload: { grade: string; classNum: string }) => Promise<ClientResponse>;
  getClassRanking?: (payload: { schoolId: string; grade: string; classNum?: string }) => Promise<ClientResponse>;
  searchSchool?: (payload: { query: string }) => Promise<ClientResponse>;
}

declare global {
  interface Window {
    AIWaysEdu2gClient?: Edu2gClient;
    // authGate.js가 인증 통과 직후 부른다. 게이트가 #appRoot를 실제로 드러낸
    // 뒤에야 높이를 잴 수 있어서 존재하는 연결점이다.
    AIWaysMobileApp?: { syncTabHeights: () => void };
  }
}

export function edu2gClient(): Edu2gClient | undefined {
  return window.AIWaysEdu2gClient;
}
