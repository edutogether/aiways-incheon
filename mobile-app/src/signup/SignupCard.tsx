import type { useSignup } from "./useSignup";

// 가입 카드. 상태에 따라 네 가지 중 하나로 그려진다.
//   form            아직 가입 전 - 입력 폼
//   locked          가입 완료 - 정보 확인 + 반 변경
//   pending         승인 대기(승인제였던 시절의 경로. 서버가 지금은 이 응답을
//                   내지 않지만, 배포 순서상 옛 클라이언트/새 서버가 잠시
//                   섞이는 구간이 있어 화면은 남겨 둔다)
//   teacherVerified 담임 인증 완료
export function SignupCard({ signup }: { signup: ReturnType<typeof useSignup> }) {
  const { state } = signup;

  if (state.kind === "locked") {
    const { profile } = state;
    const change = signup.classChange;
    return (
      <div id="signupCard" className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
          <span>🎓</span><span>가입 완료</span>
        </div>
        <p className="text-xs font-semibold text-blue-700" id="signupLockedInfo">
          {`${profile.schoolName || profile.schoolId} ${profile.grade}학년 ${profile.classNum}반 ${profile.studentNumber}번 ${profile.name}`}
        </p>
        <button id="classChangeToggleButton" type="button" className="text-[10px] font-bold text-blue-600 underline" onClick={change.toggle}>반이 바뀌었어요</button>
        <div id="classChangeForm" className={`${change.open ? "" : "hidden "}space-y-2 pt-1`}>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" inputMode="numeric" maxLength={2} id="classChangeGradeInput" placeholder="새 학년" className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                   value={change.grade} onChange={(event) => change.setGrade(event.target.value)} />
            <input type="text" inputMode="numeric" maxLength={2} id="classChangeClassInput" placeholder="새 반" className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                   value={change.classNum} onChange={(event) => change.setClassNum(event.target.value)} />
          </div>
          <button id="classChangeSubmitButton" type="button" disabled={change.submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded-xl transition-all" onClick={() => void change.submit()}>반 변경 요청</button>
          <p id="classChangeStatus" className="text-[10px] font-semibold text-blue-500">{change.status}</p>
        </div>
        <p className="text-[10px] text-blue-500 leading-snug">학교/번호/이름은 못 바꿔요(선생님께 말씀해 주세요). 반은 하루에 한 번만 바꿀 수 있어요.</p>
      </div>
    );
  }

  if (state.kind === "pending") {
    const { preview } = state;
    return (
      <div id="signupCard" className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
          <span>⏳</span><span>선생님 승인 대기중</span>
        </div>
        <p className="text-xs font-semibold text-amber-700" id="signupPendingInfo">
          {`${preview.schoolName || preview.schoolId} ${preview.grade}학년 ${preview.classNum}반 ${preview.studentNumber}번 ${preview.name}`}
        </p>
        <p className="text-[10px] text-amber-600 leading-snug">선생님이 확인하시면 가입이 완료돼요. 잠시 후 다시 열어서 확인해 주세요.</p>
      </div>
    );
  }

  if (state.kind === "teacherVerified") {
    const { summary } = state;
    return (
      <div id="signupCard" className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
          <span>🍎</span><span>담임 인증 완료</span>
        </div>
        {/* 성함은 선생님이 직접 친 값이라 텍스트로만 넣는다. */}
        <p className="text-xs font-semibold text-blue-700" data-role="teacherVerifiedSummary">
          {`${summary.schoolName || summary.schoolId} ${summary.grade}학년 ${summary.classNum}반 담임 ${summary.name}`}
        </p>
        <p className="text-[10px] text-blue-500 leading-snug">우리 반 학생들의 가입 승인은 PC 대시보드에서 처리할 수 있어요.</p>
      </div>
    );
  }

  const school = signup.school;
  const isHomeroom = signup.role === "homeroom";
  // 원본은 클래스를 통째로 갈아끼우지 않고 classList.toggle로 몇 개만
  // 켰다 껐다 한다. 그래서 담임 버튼에는 **처음부터 있던 border-blue-200이
  // 계속 남아 있고**, 선택됐을 때 border-blue-600이 더해져도 테두리 색은
  // border-blue-200 쪽이 이긴다(스타일시트에서 더 뒤에 있다). 보기엔
  // 사소하지만 실제 화면의 색이라, 여기서 "정리"하면 원본과 달라진다.
  const homeroomClass = isHomeroom
    ? "bg-blue-600 border border-blue-200 border-blue-600 text-white rounded-xl py-2 transition-all"
    : "bg-white border border-blue-200 text-blue-700 rounded-xl py-2 transition-all";
  const studentClass = isHomeroom
    ? "bg-white border text-blue-700 rounded-xl py-2 transition-all"
    : "bg-blue-600 border border-blue-600 text-white rounded-xl py-2 transition-all";

  return (
    <div id="signupCard" className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
        <span>🎓</span><span>정식 가입하기</span>
      </div>
      <p className="text-[10px] text-blue-600 leading-snug">한 번만 가입하면 이 기기에 영구히 저장돼요(다시 못 바꿔요). 가입하면 우리반 순위·통계에 내 기록이 정확히 반영됩니다. 안 해도 판단/퀴즈는 그대로 쓸 수 있어요.</p>
      <div id="signupRoleGroup" className="grid grid-cols-2 gap-2 text-xs font-bold" role="radiogroup" aria-label="가입 유형">
        <button type="button" id="signupRoleHomeroomBtn" data-role="homeroom" className={homeroomClass} aria-pressed={isHomeroom} onClick={() => signup.setRole("homeroom")}>담임 선생님</button>
        <button type="button" id="signupRoleStudentBtn" data-role="student" className={studentClass} aria-pressed={!isHomeroom} onClick={() => signup.setRole("student")}>학생</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 sm:col-span-1 relative">
          <input type="text" id="signupSchoolInput" placeholder="학교 이름 검색" autoComplete="off" className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                 value={school.query} onChange={(event) => school.onQueryChange(event.target.value)} onBlur={school.onBlur} />
          <input type="hidden" id="signupSchoolCode" value={school.selection?.schoolId ?? ""} />
          <div id="signupSchoolResults" className={`${school.results ? "" : "hidden "}absolute left-0 right-0 mt-1 bg-white border border-blue-200 rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto text-xs`}>
            {school.results?.length === 0 && <div className="px-3 py-2 text-slate-400">검색 결과가 없어요.</div>}
            {school.results?.map((result) => (
              // 같은 이름의 학교가 여러 지역에 있어 급별만으로는 구분이 안 될
              // 때가 있다 - 주소를 같이 보여줘야 정확히 고를 수 있다.
              <button key={result.schoolCode} type="button" className="block w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0" onClick={() => school.select(result)}>
                <span className="block font-semibold">{`${result.schoolName} (${result.schoolLevel})`}</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">{result.address || result.region}</span>
              </button>
            ))}
          </div>
        </div>
        <input type="text" inputMode="numeric" maxLength={2} id="signupGradeInput" placeholder="학년" className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
               value={signup.grade} onChange={(event) => signup.setGrade(event.target.value)} />
        <input type="text" inputMode="numeric" maxLength={2} id="signupClassInput" placeholder="반" className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
               value={signup.classNum} onChange={(event) => signup.setClassNum(event.target.value)} />
      </div>
      <div id="signupStudentFields" className={`${isHomeroom ? "hidden " : ""}grid grid-cols-3 gap-2`}>
        <input type="text" inputMode="numeric" maxLength={2} id="signupNumberInput" placeholder="번호" className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
               value={signup.studentNumber} onChange={(event) => signup.setStudentNumber(event.target.value)} />
        <input type="text" id="signupNameInput" placeholder="이름" className="col-span-2 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
               value={signup.studentName} onChange={(event) => signup.setStudentName(event.target.value)} />
      </div>
      <div id="signupHomeroomFields" className={`${isHomeroom ? "" : "hidden "}grid grid-cols-3 gap-2`}>
        <input type="text" id="signupHomeroomNameInput" placeholder="담임 선생님 성함" className="col-span-3 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
               value={signup.homeroomName} onChange={(event) => signup.setHomeroomName(event.target.value)} />
        {/* 성함을 적으면 그 이름으로 인사하고, 인증코드를 "운영자에게 받은
            것"이라고 안내한다(2026-09-09 Bumm님 지시). 코드를 주는 사람을
            무엇으로 부를지가 문제였는데, 앱 안에 이미 "선생님"과
            "슈퍼어드민"이 있어 "관리자"는 그 둘 다로 읽히고 "개발자"는
            선생님 입장에서 왜 그 사람이 코드를 주는지 설명이 안 된다. */}
        <p id="signupTeacherGreeting" className={`col-span-3 ${isHomeroom && signup.homeroomName.trim() ? "" : "hidden "}text-xs font-bold text-blue-800`}>
          {isHomeroom && signup.homeroomName.trim() ? `${signup.homeroomName.trim()} 선생님, 반갑습니다. 운영자에게 받으신 인증코드를 입력해 주세요.` : ""}
        </p>
        <input type="text" id="signupTeacherCodeInput" placeholder="운영자에게 받으신 인증코드" className="col-span-3 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
               value={signup.teacherCode} onChange={(event) => signup.setTeacherCode(event.target.value)} />
      </div>
      <button id="signupSubmitButton" type="button" disabled={signup.submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all" onClick={() => void signup.submit()}>가입하기</button>
      <p id="signupStatus" className="text-[10px] font-semibold text-blue-500">{signup.status}</p>
    </div>
  );
}
