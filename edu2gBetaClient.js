"use strict";

(() => {
  const REGION = "asia-northeast3";
  const EMULATOR_PROJECT = "demo-aiways-incheon";
  const ALLOWED = new Set(["redeemEdu2gPass", "getEdu2gSession", "listEdu2gTrustedDevices", "revokeEdu2gTrustedDevice", "analyzeSortingImage", "analyzeSortingText", "analyzeSortingSafetyObserver", "saveSortingRecord", "listSortingRecords", "resolveSortingRecord", "getSchoolDashboard", "checkStudentProfile", "registerStudentProfile", "checkCampusLocation", "changeStudentClass", "getClassRanking", "searchSchool"]);
  const LOCAL = new Set(["localhost", "127.0.0.1"]);

  function usingEmulator() {
    return LOCAL.has(location.hostname) && new URLSearchParams(location.search).get("auth-emulator") === "1";
  }
  function visualReviewRequested() {
    return window.AIWaysBetaAuth?.visualReviewRequested?.() === true;
  }
  async function functionUrl(name) {
    if (!ALLOWED.has(name)) throw new Error("endpoint_not_allowed");
    if (usingEmulator()) return `http://127.0.0.1:5001/${EMULATOR_PROJECT}/${REGION}/${name}`;
    const base = await window.AIWaysAppCheck?.initializeAIWaysAppCheck?.();
    const projectId = base?.app?.options?.projectId;
    if (!projectId) throw new Error("firebase_app_unavailable");
    return `https://${REGION}-${projectId}.cloudfunctions.net/${name}`;
  }
  async function safeJson(response) {
    try { return await response.json(); } catch { return null; }
  }
  function normalResponse(status, body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, status, code: "invalid_response", data: null };
    // Most endpoints return an explicit {ok:true|false,...}. analyzeSortingImage /
    // analyzeSortingSafetyObserver return their success payload bare (no "ok" field),
    // so a 2xx status with no explicit ok:false also counts as success.
    const ok = body.ok === true || (body.ok !== false && status >= 200 && status < 300);
    return { ok, status, code: typeof body.code === "string" ? body.code : ok ? "ok" : "invalid_response", data: body };
  }
  async function request(name, payload = {}, retried = false) {
    if (visualReviewRequested()) return { ok: false, status: 0, code: "auth_invalid", data: null };
    let headers;
    try { headers = await window.AIWaysBetaAuth?.getEdu2gProtectedHeaders?.({ forceRefresh: retried }); } catch { return { ok: false, status: 0, code: "auth_invalid", data: null }; }
    if (!headers?.Authorization || !headers["X-Firebase-AppCheck"]) return { ok: false, status: 0, code: "auth_invalid", data: null };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(await functionUrl(name), { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload), signal: controller.signal });
      const result = normalResponse(response.status, await safeJson(response));
      if (result.status === 401 && !retried) return request(name, payload, true);
      return result;
    } catch (error) {
      return { ok: false, status: 0, code: error?.name === "AbortError" ? "request_timeout" : "network_error", data: null };
    } finally { clearTimeout(timer); }
  }
  function getPlatformLabel() {
    const value = navigator.userAgentData?.platform || navigator.platform || "";
    if (/win/i.test(value)) return "Windows";
    if (/android/i.test(value)) return "Android";
    if (/(iphone|ipad|ipod)/i.test(value)) return "iOS";
    if (/mac/i.test(value)) return "macOS";
    if (/cros/i.test(value)) return "ChromeOS";
    if (/linux/i.test(value)) return "Linux";
    return "Other";
  }
  function errorMessageFor(code) {
    return ({ login_not_approved: "승인된 이름 또는 아이디를 확인해 주세요.", device_limit_reached: "등록 가능한 기기 수에 도달했습니다. 기존 기기 하나를 선택해 교체해 주세요.", device_already_bound: "이 기기는 이미 다른 사용자에게 연결되어 있습니다.", device_not_registered: "이 기기는 아직 등록되지 않았습니다.", device_revoked: "이 기기는 해제되었습니다.", actor_unavailable: "일시적으로 접속을 확인하지 못했습니다. 다시 시도해 주세요.", access_state_invalid: "연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.", auth_missing: "연결을 다시 확인해 주세요.", auth_invalid: "연결을 다시 확인해 주세요.", anonymous_auth_required: "익명 인증 연결이 필요합니다. 다시 시도해 주세요.", app_check_missing: "보안 확인을 다시 시도해 주세요.", app_check_invalid: "보안 확인을 다시 시도해 주세요.", app_check_unavailable: "보안 확인 서비스가 일시적으로 준비되지 않았습니다.", protection_unavailable: "보안 확인 서비스가 일시적으로 준비되지 않았습니다.", origin_not_allowed: "허용되지 않은 접속 환경입니다.", device_not_trusted: "이 기기의 권한을 다시 확인해 주세요.", rate_limited: "잠시 후 다시 시도해 주세요.", request_in_progress: "같은 요청을 처리하고 있습니다. 잠시 후 다시 확인해 주세요.", request_expired: "요청 시간이 지나 다시 분석해 주세요.", provider_unavailable: "분석 서비스를 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.", invalid_model_response: "분석 결과를 확인하지 못했습니다. 다시 시도해 주세요.", analysis_failed: "분석에 실패했습니다. 다시 시도해 주세요.", request_timeout: "응답 시간이 초과되었습니다. 다시 시도해 주세요.", network_error: "네트워크 연결을 확인해 주세요.", invalid_response: "응답을 확인하지 못했습니다. 다시 시도해 주세요.", invalid_request: "입력 내용을 다시 확인해 주세요.", invalid_query: "검색어를 다시 확인해 주세요." }[code] || "일시적인 문제가 발생했습니다. 다시 시도해 주세요.");
  }
  window.AIWaysEdu2gClient = {
    functionUrl, usingEmulator, visualReviewRequested, request, getPlatformLabel, errorMessageFor,
    requestAccess: ({ loginId, deviceLabel, platform }) => request("redeemEdu2gPass", { loginId, deviceLabel, platform, confirm: false }),
    confirmDeviceRegistration: ({ loginId, deviceLabel, platform, replaceManagementId = "" }) => request("redeemEdu2gPass", { loginId, deviceLabel, platform, confirm: true, ...(replaceManagementId ? { replaceManagementId } : {}) }),
    getSession: () => request("getEdu2gSession"),
    listTrustedDevices: () => request("listEdu2gTrustedDevices"),
    revokeTrustedDevice: ({ targetManagementId }) => request("revokeEdu2gTrustedDevice", { targetManagementId, confirm: true }),
    analyzeSortingImage: (payload) => request("analyzeSortingImage", payload),
    analyzeSortingText: (payload) => request("analyzeSortingText", payload),
    analyzeSortingSafetyObserver: (payload) => request("analyzeSortingSafetyObserver", payload),
    saveSortingRecord: (payload) => request("saveSortingRecord", payload),
    listSortingRecords: ({ pageSize = 20, cursor = "", statusFilter = "all" } = {}) => request("listSortingRecords", { pageSize, ...(cursor ? { cursor } : {}), statusFilter }),
    resolveSortingRecord: (payload) => request("resolveSortingRecord", payload),
    getSchoolDashboard: ({ schoolId, grade = "", classNum = "" } = {}) => request("getSchoolDashboard", { schoolId, ...(grade ? { grade } : {}), ...(classNum ? { classNum } : {}) }),
    checkStudentProfile: () => request("checkStudentProfile", {}),
    previewStudentProfile: ({ schoolId, schoolName, grade, classNum, studentNumber, name }) => request("registerStudentProfile", { schoolId, schoolName, grade, classNum, studentNumber, name, confirm: false }),
    registerStudentProfile: ({ schoolId, schoolName, grade, classNum, studentNumber, name }) => request("registerStudentProfile", { schoolId, schoolName, grade, classNum, studentNumber, name, confirm: true }),
    checkCampusLocation: ({ schoolId, lat, lng }) => request("checkCampusLocation", { schoolId, lat, lng }),
    previewClassChange: ({ grade, classNum }) => request("changeStudentClass", { grade, classNum, confirm: false }),
    changeStudentClass: ({ grade, classNum }) => request("changeStudentClass", { grade, classNum, confirm: true }),
    getClassRanking: ({ schoolId, grade, classNum = "" } = {}) => request("getClassRanking", { schoolId, grade, ...(classNum ? { classNum } : {}) }),
    searchSchool: ({ query }) => request("searchSchool", { query })
  };
})();
