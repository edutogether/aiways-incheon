"use strict";
// 학교별·학년별 실제 학급 수를 NEIS에서 받아 schoolClassCounts.js로 저장한다.
//
// 왜 파일로 굳히나: 관리자 화면이 매번 NEIS를 부르게 하면 외부 서비스가 하나
// 더 끼어들고(브라우저 CORS·장애·응답 지연), 그 화면은 코드를 발급하는 자리라
// 조용히 비어 버리면 안 된다. 자료는 1년에 한 번쯤 바뀌므로 받아서 커밋하고,
// **언제 어디서 받았는지를 파일 안에 같이 남긴다** - 내년에 이 숫자가 왜
// 이런지 물을 사람이 반드시 나온다.
//
// 출처: NEIS 학교기본정보 개방포털 학급정보(classInfo).
//   https://open.neis.go.kr/hub/classInfo?ATPT_OFCDC_SC_CODE=E10&SD_SCHUL_CODE=<코드>&AY=<학년도>&GRADE=<학년>
// 응답 머리의 list_total_count가 곧 그 학년의 학급 수다. **인증키 없이도 이 값은
// 정확하다** - 키 없는 호출은 행(row)이 5개로 잘리지만 총 개수는 안 잘린다.
//
// 실행: node scripts/fetchSchoolClassCounts.js
const fs = require("node:fs");
const path = require("node:path");

const OFFICE_CODE = "E10"; // 인천광역시교육청
const SCHOOL_YEAR = "2026";
const GRADES = [1, 2, 3, 4, 5, 6];
const OUT_FILE = path.resolve(__dirname, "..", "schoolClassCounts.js");

// 파일럿 참여 4개교. 학교를 늘릴 때 여기에 추가한다.
const SCHOOLS = [
  { schoolId: "7321030", name: "인천서흥초등학교", short: "서흥초" },
  { schoolId: "7361073", name: "인천청라초등학교", short: "청라초" },
  { schoolId: "7341025", name: "인천동방초등학교", short: "동방초" },
  { schoolId: "7361064", name: "인천마전초등학교", short: "마전초" }
];

async function classCount(schoolId, grade) {
  const url = `https://open.neis.go.kr/hub/classInfo?ATPT_OFCDC_SC_CODE=${OFFICE_CODE}`
    + `&SD_SCHUL_CODE=${encodeURIComponent(schoolId)}&AY=${SCHOOL_YEAR}&GRADE=${grade}`
    + "&Type=json&pIndex=1&pSize=5";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NEIS 응답이 ${response.status}입니다 (${schoolId} ${grade}학년)`);
  const body = await response.json();
  // 자료가 없으면 NEIS는 최상위 RESULT로 알려준다(INFO-200 = 해당 자료 없음).
  if (body.RESULT) return { count: 0, note: `${body.RESULT.CODE} ${body.RESULT.MESSAGE}` };
  const total = body.classInfo?.[0]?.head?.[0]?.list_total_count;
  if (typeof total !== "number") throw new Error(`총 개수를 못 읽었습니다 (${schoolId} ${grade}학년)`);
  return { count: total, note: "" };
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const schools = [];
  for (const school of SCHOOLS) {
    const classesByGrade = {};
    for (const grade of GRADES) {
      const { count, note } = await classCount(school.schoolId, grade);
      if (note) console.warn(`  ${school.short} ${grade}학년: ${note}`);
      classesByGrade[grade] = count;
    }
    const total = Object.values(classesByGrade).reduce((sum, n) => sum + n, 0);
    // 한 학교의 모든 학년이 0이면 학교 코드가 틀렸거나 응답 모양이 바뀐 것이다.
    // 그런 값을 파일로 굳히면 화면에 반이 하나도 안 뜨는데 이유를 알 수 없다.
    if (total === 0) throw new Error(`${school.short}(${school.schoolId})의 학급 수가 전부 0입니다 - 학교 코드나 응답 형식을 확인하세요.`);
    console.log(`${school.short}: ${JSON.stringify(classesByGrade)}`);
    schools.push({ ...school, classesByGrade });
  }

  const payload = {
    source: "NEIS 학교기본정보 개방포털 - 학급정보(classInfo)",
    sourceUrl: "https://open.neis.go.kr/hub/classInfo",
    officeCode: OFFICE_CODE,
    schoolYear: SCHOOL_YEAR,
    fetchedAt,
    schools
  };

  const file = [
    '"use strict";',
    "// 이 파일은 손으로 고치지 않는다. scripts/fetchSchoolClassCounts.js가 만든다.",
    "//",
    `// 출처: ${payload.source}`,
    `// 받은 시각: ${fetchedAt} (${SCHOOL_YEAR}학년도, ${OFFICE_CODE} 인천광역시교육청)`,
    "//",
    "// 학급 수는 해마다 바뀐다. 새 학년도가 되면 위 스크립트를 다시 돌린다.",
    `window.AIWaysSchoolClassCounts = ${JSON.stringify(payload, null, 2)};`,
    ""
  ].join("\n");
  fs.writeFileSync(OUT_FILE, file);
  console.log(`\n저장: ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(`실패: ${error.message}`);
  process.exit(1);
});
