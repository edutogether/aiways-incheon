"use strict";
// 이 파일은 손으로 고치지 않는다. scripts/fetchSchoolClassCounts.js가 만든다.
//
// 출처: NEIS 학교기본정보 개방포털 - 학급정보(classInfo)
// 받은 시각: 2026-09-09T13:10:58.439Z (2026학년도, E10 인천광역시교육청)
//
// 학급 수는 해마다 바뀐다. 새 학년도가 되면 위 스크립트를 다시 돌린다.
window.AIWaysSchoolClassCounts = {
  "source": "NEIS 학교기본정보 개방포털 - 학급정보(classInfo)",
  "sourceUrl": "https://open.neis.go.kr/hub/classInfo",
  "officeCode": "E10",
  "schoolYear": "2026",
  "fetchedAt": "2026-09-09T13:10:58.439Z",
  "schools": [
    {
      "schoolId": "7321030",
      "name": "인천서흥초등학교",
      "short": "서흥초",
      "classesByGrade": {
        "1": 3,
        "2": 3,
        "3": 3,
        "4": 4,
        "5": 3,
        "6": 4
      }
    },
    {
      "schoolId": "7361073",
      "name": "인천청라초등학교",
      "short": "청라초",
      "classesByGrade": {
        "1": 6,
        "2": 7,
        "3": 9,
        "4": 8,
        "5": 9,
        "6": 9
      }
    },
    {
      "schoolId": "7341025",
      "name": "인천동방초등학교",
      "short": "동방초",
      "classesByGrade": {
        "1": 3,
        "2": 3,
        "3": 3,
        "4": 4,
        "5": 4,
        "6": 3
      }
    },
    {
      "schoolId": "7361064",
      "name": "인천마전초등학교",
      "short": "마전초",
      "classesByGrade": {
        "1": 4,
        "2": 4,
        "3": 5,
        "4": 6,
        "5": 6,
        "6": 7
      }
    }
  ]
};
