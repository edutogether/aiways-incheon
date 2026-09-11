"use strict";

// ── 전국 학교 목록을 브라우저 안에서 검색한다 (2026-09-11, 지시 Bumm)
//
// 왜: 타자마다 서버를 거쳐 느렸다(실측 콜드 1.89초 / 웜 0.16초). 목록을 갖고
// 있으면 검색이 **밀리초**로 끝나 "타자 치는 대로" 좁혀진다.
//
// 🔴 서버 검색(`searchSchool`)을 지우지 않는다 — 목록이 아직 안 왔거나 못
// 받았을 때 **그쪽으로 떨어진다**(폴백). 그래서 느린 회선·아낌 모드에서도
// 지금보다 나빠지는 경우가 없다.
//
// 🔴 **왜 루트의 공용 고전 스크립트인가**: PC 대시보드(`app.js`)와 학생 앱
// (`mobile-app`) 둘 다 같은 검색을 쓴다. 두 벌로 두면 한쪽만 고쳐지는 날이
// 반드시 오고, 그때 "학생 앱에서만 검색이 다른" 상태가 된다 — 이 저장소가
// `renderSchoolResults`를 하나로 묶어 둔 것과 같은 이유다. `firebaseAppCheck.js`·
// `edu2gBetaClient.js`처럼 양쪽이 `window.AIWays*`로 읽는 기존 방식을 따른다.
(() => {
  // 🔴 파일명 뒤 `?v=`는 **내용 해시**다. `scripts/fetchSchoolList.js`가 목록을
  // 다시 만들 때 이 줄을 같이 고친다. 경로는 그대로라 `firebase.json`의 1년
  // 불변 캐시 규칙이 계속 맞고, 내용이 바뀌면 주소가 달라져 새로 받는다.
  //
  // 🔴 `./`가 아니라 뿌리에서 시작하는 경로다 — 학생 앱은 `/mobile/`에서
  // 돌기 때문에 상대 경로로 두면 `/mobile/assets/...`를 찾아 404가 난다.
  const SCHOOL_LIST_URL = "/assets/school-list.tsv?v=4ea4f196d648";

  let schoolListPromise = null;
  let schoolListData = null;

  const HANGUL_CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  function toChosung(text) {
    let out = "";
    for (const ch of String(text)) {
      const code = ch.charCodeAt(0);
      out += (code >= 0xac00 && code <= 0xd7a3) ? HANGUL_CHO[Math.floor((code - 0xac00) / 588)] : ch;
    }
    return out;
  }

  // 한글을 자모 단위로 푼다 - 조합 중인 글자까지 맞춰보기 위해서다.
  //
  // 🔴 왜 필요한가: 한글은 자모를 하나씩 치면서 글자가 완성된다. "인천서흥"을
  // 치는 동안 입력칸을 거치는 값은 인 → 인ㅊ → 인처 → 인천 → 인천ㅅ → 인천서 →
  // 인천서ㅎ → 인천서흐 → 인천서흥 이다. 글자 그대로 비교하면 이 중 **절반이 0건**이
  // 되어 목록이 통째로 비었다 다시 채워진다 - Bumm님이 "한 글자씩 치고 좀 쉬어야
  // 한다"고 하신 것이 정확히 그것이다. 자모로 풀어 비교하면 모든 중간 상태가
  // 앞부분 일치로 남는다.
  //
  // 복합 중성(ㅘ=ㅗㅏ)과 복합 종성(ㄳ=ㄱㅅ)은 **두 번 쳐서 만드는 글자**라 같이 푼다.
  // ㄲ·ㅆ처럼 시프트 한 번으로 치는 것은 풀지 않는다.
  const HANGUL_JUNG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅗㅏ", "ㅗㅐ", "ㅗㅣ", "ㅛ", "ㅜ", "ㅜㅓ", "ㅜㅔ", "ㅜㅣ", "ㅠ", "ㅡ", "ㅡㅣ", "ㅣ"];
  const HANGUL_JONG = ["", "ㄱ", "ㄲ", "ㄱㅅ", "ㄴ", "ㄴㅈ", "ㄴㅎ", "ㄷ", "ㄹ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ", "ㄹㅅ", "ㄹㅌ", "ㄹㅍ", "ㄹㅎ", "ㅁ", "ㅂ", "ㅂㅅ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  function toJamo(text) {
    let out = "";
    for (const ch of String(text)) {
      const code = ch.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        const n = code - 0xac00;
        out += HANGUL_CHO[Math.floor(n / 588)] + HANGUL_JUNG[Math.floor((n % 588) / 28)] + HANGUL_JONG[n % 28];
      } else out += ch;
    }
    return out;
  }

  // 띄어쓰기를 무시하고 비교한다(교사코드 비교와 같은 방식).
  const squeeze = (text) => String(text || "").replace(/\s+/g, "");

  function parseSchoolList(text) {
    const lines = String(text).split("\n");
    const head = lines.filter((line) => line.startsWith("#"));
    const pick = (prefix) => (head.find((line) => line.startsWith(prefix)) || "").slice(prefix.length).split("|");
    const levels = pick("# 급별: ");
    const regions = pick("# 시도: ");
    const rows = [];
    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;
      const cell = line.split("\t");
      if (cell.length !== 5) continue;
      const region = regions[Number(cell[3])] || "";
      const tail = cell[4] || "";
      rows.push({
        schoolCode: cell[0],
        schoolName: cell[1],
        schoolLevel: levels[Number(cell[2])] || "",
        region,
        // 저장할 때 뺀 시도 접두를 다시 붙인다 - 화면에 나오는 주소가 원래와 같아야 한다.
        address: tail ? (region ? `${region} ${tail}` : tail) : ""
      });
    }
    // 🔴 빈 목록을 "그냥 결과 없음"으로 쓰지 않는다 - 그러면 검색이 조용히
    // 죽는다(COMMON_STANDARDS §21). 못 읽었으면 폴백으로 보낸다.
    if (rows.length < 10000) throw new Error(`학교 목록이 ${rows.length}개뿐입니다.`);
    const squeezed = rows.map((row) => squeeze(row.schoolName));
    return { rows, chosung: squeezed.map(toChosung), squeezed, jamo: squeezed.map(toJamo) };
  }

  function load() {
    if (schoolListPromise) return schoolListPromise;
    schoolListPromise = fetch(SCHOOL_LIST_URL, { credentials: "omit" })
      .then((res) => { if (!res.ok) throw new Error(`학교 목록 ${res.status}`); return res.text(); })
      .then((text) => { schoolListData = parseSchoolList(text); return schoolListData; })
      .catch((error) => {
        // 실패해도 화면은 서버 검색으로 계속 동작한다. 원인만 남긴다.
        console.warn("[학교목록] 받지 못해 서버 검색으로 갑니다:", error?.message || error);
        schoolListPromise = null;
        schoolListData = null;
        return null;
      });
    return schoolListPromise;
  }

  // 🔴 아낌 모드이거나 2G면 미리 받지 않는다 - 데이터를 아끼려는 사람에게
  // 164KB를 몰래 받게 하면 안 된다. 그때는 서버 검색(폴백)으로 간다.
  // 판정할 수단이 없는 브라우저에서는 그냥 받는다(기능이 없다는 것이
  // 회선이 느리다는 뜻은 아니다).
  function mayLoad() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return true;
    if (conn.saveData === true) return false;
    return !["slow-2g", "2g"].includes(conn.effectiveType);
  }

  // 유휴 시간에, 낮은 우선순위로만 받는다 - 첫 화면을 늦추지 않기 위해서다.
  function loadWhenIdle() {
    if (!mayLoad()) return;
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => load(), { timeout: 8000 });
    else window.setTimeout(() => load(), 3000);
  }

  // 🔴 화면이 필요해지는 순간에 받는다(학생 앱의 가입 화면·검색창).
  // 아낌 모드·2G면 받지 않고 서버 검색으로 간다 - 조건은 위와 같다.
  function loadNow() {
    if (!mayLoad()) return null;
    return load();
  }

  // 목록이 준비돼 있으면 그 자리에서 거른다. 없으면 null - 부르는 쪽이 서버로 간다.
  //
  // 순서: 완전 일치 > 앞부분 일치 > 부분 일치 > 초성 앞부분 > 초성 부분.
  // 같은 등급 안에서는 이름이 짧은 것부터(짧을수록 입력과 가깝다).
  function search(rawQuery) {
    if (!schoolListData) return null;
    const query = squeeze(rawQuery);
    if (!query) return [];
    const isChosungQuery = /^[ㄱ-ㅎ]+$/.test(query);
    const { rows, chosung, squeezed } = schoolListData;
    const hits = [];
    for (let i = 0; i < rows.length; i += 1) {
      const name = squeezed[i];
      let rank = -1;
      if (!isChosungQuery) {
        if (name === query) rank = 0;
        else if (name.startsWith(query)) rank = 1;
        else if (name.includes(query)) rank = 2;
      }
      if (rank < 0) {
        const cho = chosung[i];
        if (cho.startsWith(query)) rank = 3;
        else if (cho.includes(query)) rank = 4;
      }
      if (rank >= 0) hits.push({ rank, length: name.length, school: rows[i] });
    }
    // 🔴 글자 그대로는 한 건도 없는 때만 자모로 다시 본다. 이미 결과가 나오던
    // 질의의 동작은 한 글자도 안 바뀐다 - 조합 중이라 비어 보이던 자리만 채운다.
    if (!hits.length && !isChosungQuery) {
      const jamoQuery = toJamo(query);
      const { jamo } = schoolListData;
      for (let i = 0; i < rows.length; i += 1) {
        const name = jamo[i];
        let rank = -1;
        if (name.startsWith(jamoQuery)) rank = 5;
        else if (name.includes(jamoQuery)) rank = 6;
        if (rank >= 0) hits.push({ rank, length: squeezed[i].length, school: rows[i] });
      }
    }
    hits.sort((a, b) => a.rank - b.rank || a.length - b.length || a.school.schoolName.localeCompare(b.school.schoolName, "ko"));
    return hits.map((hit) => hit.school);
  }

  // isReady: 목록이 손에 있는지. 부르는 쪽이 "기다릴지 서버로 갈지"를 정할 때 쓴다.
  const isReady = () => !!schoolListData;
  window.AIWaysSchoolList = { search, isReady, load, loadNow, loadWhenIdle, mayLoad, toChosung, toJamo, parse: parseSchoolList };
})();
