"use strict";
// 전국 학교 목록을 NEIS에서 받아 `assets/school-list.tsv`로 굳힌다.
//
// 왜 굳히나: 학교 검색이 타자마다 서버를 거쳐 느렸다(실측 콜드 1.89초 / 웜
// 0.16초). 목록을 브라우저가 갖고 있으면 검색이 **0.4~0.8ms**로 끝나
// "타자 치는 대로" 좁혀진다(2026-09-11 실측, 12,672개 기준).
//
// 🔴 `scripts/fetchSchoolClassCounts.js`와 같은 자리·같은 방식이다 — 학년도가
// 바뀌거나 학교가 신설·개명되면 이 스크립트를 다시 돌린다. 받은 시각을 파일
// 첫 줄에 적어 두므로 언제 받은 것인지 항상 알 수 있다.
//
// 실행:
//   NEIS_API_KEY=<키> node scripts/fetchSchoolList.js
//
// 🔴 인증키는 환경변수로만 받고 **어디에도 출력하지 않는다** — URL도 안 찍는다
//    (쿼리스트링에 키가 들어간다). 저장소·로그·커밋에 남기지 않는다.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const KEY = process.env.NEIS_API_KEY;
if (!KEY) {
  console.error("NEIS_API_KEY 환경변수가 없습니다. 키는 Secret Manager의 NEIS_API_KEY에 있습니다.");
  console.error("  실행 예: NEIS_API_KEY=\"$(gcloud secrets versions access latest --secret=NEIS_API_KEY --project=ai-ways-incheon)\" node scripts/fetchSchoolList.js");
  process.exit(1);
}

const BASE = "https://open.neis.go.kr/hub/schoolInfo";
const PAGE_SIZE = 1000; // NEIS 최대
const OUT = path.resolve(__dirname, "..", "assets", "school-list.tsv");

async function fetchPage(index) {
  const url = `${BASE}?KEY=${encodeURIComponent(KEY)}&Type=json&pIndex=${index}&pSize=${PAGE_SIZE}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  // 🔴 오류를 낼 때도 URL을 싣지 않는다(키가 들어 있다).
  if (!json) throw new Error(`페이지 ${index}: 응답을 JSON으로 읽지 못했습니다.`);
  if (json.RESULT) return { done: true, code: json.RESULT.CODE, message: json.RESULT.MESSAGE };
  const block = json.schoolInfo;
  if (!block) throw new Error(`페이지 ${index}: schoolInfo가 없습니다.`);
  return { done: false, total: block[0].head[0].list_total_count, rows: block[1]?.row || [] };
}

(async () => {
  const first = await fetchPage(1);
  if (first.done) throw new Error(`NEIS가 목록 대신 결과코드를 돌려줬습니다: ${first.code} ${first.message}`);
  const rows = [...first.rows];
  const pages = Math.ceil(first.total / PAGE_SIZE);
  for (let i = 2; i <= pages; i += 1) {
    const page = await fetchPage(i);
    if (page.done) throw new Error(`페이지 ${i}에서 멈췄습니다: ${page.code} ${page.message}`);
    rows.push(...page.rows);
  }

  // 🔴 받은 개수가 NEIS가 말한 것과 다르면 멈춘다. 조용히 일부만 담으면
  // "그 학교가 목록에 없어서 선생님이 못 들어가는" 사고가 된다.
  if (rows.length !== first.total) {
    throw new Error(`받은 행(${rows.length})이 NEIS가 보고한 전체(${first.total})와 다릅니다.`);
  }
  const MIN_EXPECTED = 10000;
  if (rows.length < MIN_EXPECTED) {
    throw new Error(`학교가 ${rows.length}개뿐입니다(${MIN_EXPECTED}개 이상이어야 합니다). 조용히 반쪽 목록을 굳히지 않습니다.`);
  }

  // 급별·시도는 종류가 적어 사전으로 빼고 번호만 적는다(원본이 크게 줄어든다).
  const levels = [...new Set(rows.map((r) => r.SCHUL_KND_SC_NM || ""))];
  const regions = [...new Set(rows.map((r) => r.LCTN_SC_NM || ""))];

  // 🔴 화면이 그리는 것에 맞춘다(app.js) — `${학교명} (${급별})`과
  //    `주소 || 시도`. 그래서 이 다섯이 필요하고, 그 외는 담지 않는다.
  const line = (r) => {
    const region = r.LCTN_SC_NM || "";
    let address = (r.ORG_RDNMA || "").trim();
    // 주소가 시도로 시작하면 그 접두를 뺀다 — 읽을 때 다시 붙인다(중복 제거).
    if (region && address.startsWith(region)) address = address.slice(region.length).trimStart();
    return [
      r.SD_SCHUL_CODE || "",
      (r.SCHUL_NM || "").replace(/\s+/g, " ").trim(),
      levels.indexOf(r.SCHUL_KND_SC_NM || ""),
      regions.indexOf(region),
      address,
    ].join("\t");
  };

  const body = rows.map(line);
  // 탭이나 줄바꿈이 값 안에 들어가면 줄이 밀린다 - 있으면 멈춘다.
  const broken = body.filter((l) => l.split("\t").length !== 5);
  if (broken.length) throw new Error(`값 안에 탭이 들어간 줄이 ${broken.length}개 있습니다.`);

  const header = [
    `# 전국 학교 목록 — NEIS 학교기본정보(schoolInfo)에서 받음`,
    `# 받은 시각: ${new Date().toISOString()}`,
    `# 학교 수: ${rows.length}`,
    `# 열: 학교코드 \t 학교명 \t 급별색인 \t 시도색인 \t 주소(시도 접두 제거)`,
    `# 급별: ${levels.join("|")}`,
    `# 시도: ${regions.join("|")}`,
    `# 다시 만들려면: NEIS_API_KEY=<키> node scripts/fetchSchoolList.js`,
  ];
  const text = header.concat(body).join("\n") + "\n";
  fs.writeFileSync(OUT, text, "utf8");

  // 🔴 `app.js`의 `?v=` 를 **내용 해시**로 같이 고친다.
  //
  // 경로(`assets/school-list.tsv`)는 그대로 둬야 `firebase.json`의 1년 불변
  // 캐시 규칙이 계속 맞고, 내용이 바뀌면 주소가 달라져 브라우저가 새로 받는다.
  // 손으로 고치게 두면 **목록만 바뀌고 주소는 그대로라 옛것을 1년 쓰는** 사고가
  // 난다 - 그래서 여기서 자동으로 고치고, 못 고치면 멈춘다.
  const hash = crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
  const appPath = path.resolve(__dirname, "..", "schoolListSearch.js");
  const app = fs.readFileSync(appPath, "utf8");
  const pattern = /const SCHOOL_LIST_URL = "\/assets\/school-list\.tsv\?v=[^"]*";/;
  if (!pattern.test(app)) {
    throw new Error("schoolListSearch.js에서 SCHOOL_LIST_URL 줄을 찾지 못했습니다 - 목록만 바뀌고 주소가 그대로면 옛것을 계속 쓰게 됩니다.");
  }
  const updated = app.replace(pattern, `const SCHOOL_LIST_URL = "/assets/school-list.tsv?v=${hash}";`);
  fs.writeFileSync(appPath, updated, "utf8");

  console.log(`${OUT} — 학교 ${rows.length}개, ${(fs.statSync(OUT).size / 1024).toFixed(1)}KB`);
  console.log(`  급별 ${levels.length}종 · 시도 ${regions.length}종`);
  console.log(`  schoolListSearch.js의 SCHOOL_LIST_URL을 ?v=${hash} 로 갱신했습니다.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
