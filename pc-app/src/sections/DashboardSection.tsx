import type { CSSProperties } from "react";

// 대시보드 섹션 — 원본 index.html 161~445행을 **기계로** 옮긴 것이다.
//
// 🔴 손으로 다시 타이핑하지 않았다. `pc-app/scripts/htmlToTsx.mjs`가 JSX 문법에
// 맞추기만 하고 **내용은 한 글자도 바꾸지 않는다.** `mobile/` 전환에서 사람이
// 옮겨 적다가 텍스트 노드가 쪼개져 글자 폭이 소수점 아래에서 달라진 적이 있다.
//
// 값을 채우는 것은 아직 `app.js`가 한다(S2는 마크업만 옮긴다). 그래서 id와
// class 이름이 **원본과 정확히 같아야** 한다 - 하나라도 다르면 그 자리의
// 숫자가 조용히 안 채워진다.
export function DashboardSection() {
  return (
  <section className="scene dashboard-scene" id="dashboard" data-nav="대시보드">{" "}
    <div className="scene-orbs" aria-hidden="true">{" "}
      <span className="orb-xl" style={{ width: "620px", height: "620px", top: "-18%", left: "-6%", background: "#5ef7cd" }}></span>{" "}
      <span className="orb-xl" style={{ width: "520px", height: "520px", bottom: "-20%", right: "-8%", background: "#64a9ff" }}></span>{" "}
      <span className="orb-xl" style={{ width: "460px", height: "460px", top: "20%", left: "32%", background: "#ad8cff" }}></span>{" "}
      <span className="orb-xl" style={{ width: "400px", height: "400px", bottom: "-10%", left: "-4%", background: "#64a9ff" }}></span>{" "}
      <span className="orb" style={{ width: "300px", height: "300px", top: "2%", right: "4%", background: "#64a9ff" }}></span>{" "}
      <span className="orb2" style={{ width: "220px", height: "220px", bottom: "6%", left: "30%", background: "#ad8cff" }}></span>{" "}
      <span className="orb2" style={{ width: "260px", height: "260px", top: "44%", right: "-4%", background: "#5ef7cd" }}></span>{" "}
      <span className="orb2" style={{ width: "200px", height: "200px", top: "60%", left: "10%", background: "#5ef7cd" }}></span>{" "}
      <span className="orb-md" style={{ width: "210px", height: "210px", bottom: "-8%", right: "22%", background: "#64a9ff" }}></span>{" "}
      <span className="orb-md" style={{ width: "160px", height: "160px", top: "12%", left: "20%", background: "#ad8cff" }}></span>{" "}
      <span className="orb-sm" style={{ width: "120px", height: "120px", top: "34%", left: "56%", background: "#ad8cff" }}></span>{" "}
      <span className="orb-sm" style={{ width: "110px", height: "110px", bottom: "24%", left: "26%", background: "#64a9ff" }}></span>{" "}
    </div>{" "}
    <div className="hero-copy">{" "}
      <p className="eyebrow">학생의 버리는 순간을 읽는 자원순환 분석 엔진</p>{" "}
      <h1>{" "}
        <span>버리는 순간,</span>{" "}
        <span>데이터가 되다</span>{" "}
      </h1>{" "}
      <p className="hero-description">{" "}
        AI Ways Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다.<br />{" "}
        우리가 실제로 쓰레기를 버리는 순간을 관찰하고,<br />{" "}
        <span className="hero-fixed-line">AI를 통해 데이터를 1차 판단한 뒤 사람이 중심이 되어 다시 확인하는,</span>{" "}
        <span className="hero-fixed-line">우리 학교의 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.</span>{" "}
      </p>{" "}
      <p className="mobile-home-summary">우리 학교의 자원순환을 살펴보고, 지금 필요한 판단으로 바로 이동하세요.</p>{" "}
      <div className="hero-actions">{" "}
        <a className="primary-btn" href="#sorting">지금 분류하기</a>{" "}
      </div>{" "}
    </div>{" "}
    <p className="mobile-home-status" data-mobile-home-status="" role="status" hidden={true}></p>{" "}

    <div className="dashboard-grid" aria-label="실시간 자원순환 대시보드">{" "}
      <article className="panel school-panel">{" "}
        <div className="panel-head">{" "}
          <div>{" "}
            <p>School Resource Dashboard</p>{" "}
            <h2>우리학교 자원순환 대시보드</h2>{" "}
          </div>{" "}
          <span>수업용 데이터</span>{" "}
        </div>{" "}
        <label className="select-line">{" "}
          <span>학년 선택</span>{" "}
          <select id="gradeSelect" aria-label="학년 선택" defaultValue="5학년">{" "}
            <option>3학년</option>{" "}
            <option>4학년</option>{" "}
            <option>5학년</option>{" "}
            <option>6학년</option>{" "}
          </select>{" "}
        </label>{" "}
        <div className="kpi-row">{" "}
          <div><strong data-school-classes="">0</strong><span>참여 학급</span></div>{" "}
          <div><strong data-school-observed="">0</strong><span>배출 관찰</span></div>{" "}
          <div><strong data-school-hold="">0</strong><span>판단 보류</span></div>{" "}
        </div>{" "}
        <div className="school-visuals">{" "}
          <div className="bar-list" aria-label="학년별 참여" data-grade-bars="">{" "}
            <div><span>3학년</span><i style={{ "--value": "0%" } as CSSProperties}></i><b>0</b></div>{" "}
            <div><span>4학년</span><i style={{ "--value": "0%" } as CSSProperties}></i><b>0</b></div>{" "}
            <div><span>5학년</span><i style={{ "--value": "0%" } as CSSProperties}></i><b>0</b></div>{" "}
            <div><span>6학년</span><i style={{ "--value": "0%" } as CSSProperties}></i><b>0</b></div>{" "}
          </div>{" "}
          <div className="donut-pair">{" "}
            <div className="donut" style={{ "--pct": "0" } as CSSProperties}><span>0%</span><small>배출 성공률</small></div>{" "}
            <div className="donut violet" style={{ "--pct": "0" } as CSSProperties}><span>0%</span><small>판단 보류 비율</small></div>{" "}
          </div>{" "}
        </div>{" "}
      </article>{" "}

      <article className="panel landfill-panel" id="landfill" data-source-url="https://www.data.go.kr/tcs/dss/selectDataSetList.do?dType=API&amp;keyword=%EC%88%98%EB%8F%84%EA%B6%8C%EB%A7%A4%EB%A6%BD%EC%A7%80%20%EB%B0%98%EC%9E%85">{" "}
        <div className="panel-head">{" "}
          <div>{" "}
            <p>공식 관리 지표 구조 참고</p>{" "}
            <h2>수도권매립지 모니터</h2>{" "}
          </div>{" "}
          <div className="landfill-actions">{" "}
            <a className="source-link" href="https://www.data.go.kr/tcs/dss/selectDataSetList.do?dType=API&amp;keyword=%EC%88%98%EB%8F%84%EA%B6%8C%EB%A7%A4%EB%A6%BD%EC%A7%80%20%EB%B0%98%EC%9E%85" target="_blank" rel="noopener noreferrer">기록</a>{" "}
            <button className="data-refresh-btn" type="button" data-refresh-records="" aria-label="대시보드 데이터 새로고침">{" "}
              <span className="data-refresh-arrow" aria-hidden="true">&#8635;</span>{" "}
              <span className="data-refresh-ring" aria-hidden="true"></span>{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
        <div className="landfill-metrics">{" "}
          <div><strong>0t</strong><span>오늘 반입 총량</span></div>{" "}
          <div><strong>0%</strong><span>전일 대비</span></div>{" "}
          <div><strong>0%</strong><span>총량 대비 반입량</span></div>{" "}
          <div><strong>0%</strong><span>잔여 관리 여력</span></div>{" "}
        </div>{" "}
        <div className="chart-wrap">{" "}
          <div className="chart-title-row">{" "}
            <h3 className="chart-title">최근 일주일 반입량 추이</h3>{" "}
            <time className="landfill-time-now" dateTime="2026-07-05T00:00:00" data-landfill-clock="" aria-live="polite">26.07.05(일) 00:00:00</time>{" "}
          </div>{" "}
          <svg className="combo-chart" viewBox="-16 0 456 252" preserveAspectRatio="xMinYMid meet" role="img" aria-label="최근 일주일 반입량 막대와 선 그래프">{" "}
            <defs>{" "}
              <linearGradient id="cleanLineFill" x1="0" x2="0" y1="0" y2="1">{" "}
                <stop offset="0%" stop-color="#4bffe1" stop-opacity=".12" />{" "}
                <stop offset="58%" stop-color="#50b4ff" stop-opacity=".06" />{" "}
                <stop offset="100%" stop-color="#50b4ff" stop-opacity="0" />{" "}
              </linearGradient>{" "}
              <linearGradient id="cleanBarFill" x1="0" x2="0" y1="0" y2="1">{" "}
                <stop offset="0%" stop-color="#7affdf" stop-opacity=".96" />{" "}
                <stop offset="56%" stop-color="#56e9ff" stop-opacity=".72" />{" "}
                <stop offset="100%" stop-color="#5b96ff" stop-opacity=".42" />{" "}
              </linearGradient>{" "}
            </defs>{" "}
            <g className="chart-grid" stroke="rgba(220,245,255,.16)" stroke-width="1">{" "}
              <path d="M48 24 H400" />{" "}
              <path d="M48 57 H400" />{" "}
              <path d="M48 90 H400" />{" "}
              <path d="M48 122 H400" />{" "}
              <path d="M48 155 H400" />{" "}
              <path d="M48 188 H400" />{" "}
            </g>{" "}
            <g className="chart-axis" fill="rgba(220,245,255,.6)" font-size="10" font-weight="760">{" "}
              <text x="1" y="28">25K</text>{" "}
              <text x="1" y="61">20K</text>{" "}
              <text x="1" y="94">15K</text>{" "}
              <text x="1" y="126">10K</text>{" "}
              <text x="1" y="159">5K</text>{" "}
              <text x="1" y="192">0</text>{" "}
              <text className="x-label" x="64" y="216" text-anchor="middle"><tspan className="date-label" x="64">06.29</tspan><tspan className="weekday-label" x="64" dy="15">월</tspan></text><text className="x-label" x="114" y="216" text-anchor="middle"><tspan className="date-label" x="114">06.30</tspan><tspan className="weekday-label" x="114" dy="15">화</tspan></text><text className="x-label" x="164" y="216" text-anchor="middle"><tspan className="date-label" x="164">07.01</tspan><tspan className="weekday-label" x="164" dy="15">수</tspan></text><text className="x-label" x="214" y="216" text-anchor="middle"><tspan className="date-label" x="214">07.02</tspan><tspan className="weekday-label" x="214" dy="15">목</tspan></text><text className="x-label" x="264" y="216" text-anchor="middle"><tspan className="date-label" x="264">07.03</tspan><tspan className="weekday-label" x="264" dy="15">금</tspan></text><text className="x-label" x="314" y="216" text-anchor="middle"><tspan className="date-label" x="314">07.04</tspan><tspan className="weekday-label" x="314" dy="15">토</tspan></text><text className="x-label" x="364" y="216" text-anchor="middle"><tspan className="date-label" x="364">07.05</tspan><tspan className="weekday-label" x="364" dy="15">일</tspan></text>{" "}
            </g>{" "}
            <path className="chart-area" d="M64 188 L114 188 L164 188 L214 188 L264 188 L314 188 L364 188 L364 188 L64 188 Z" fill="url(#cleanLineFill)" opacity="0" />{" "}
            <g className="chart-bars" fill="url(#cleanBarFill)">{" "}
              <rect x="54" y="188" width="20" height="0" rx="6" />{" "}
              <rect x="104" y="188" width="20" height="0" rx="6" />{" "}
              <rect x="154" y="188" width="20" height="0" rx="6" />{" "}
              <rect x="204" y="188" width="20" height="0" rx="6" />{" "}
              <rect x="254" y="188" width="20" height="0" rx="6" />{" "}
              <rect x="304" y="188" width="20" height="0" rx="6" />{" "}
              <rect x="354" y="188" width="20" height="0" rx="6" />{" "}
            </g>{" "}
            <path className="chart-line" d="M64 188 L114 188 L164 188 L214 188 L264 188 L314 188 L364 188" fill="none" stroke="#65f4dc" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" opacity="0" />{" "}
          </svg>{" "}
          <div className="progress-stack">{" "}
            <label><span>총량 대비 반입량</span><b>0%</b><i><em style={{ width: "0%" }}></em></i></label>{" "}
            <label><span>잔여 관리 여력</span><b>0%</b><i><em style={{ width: "0%" }}></em></i></label>{" "}
          </div>{" "}
          <aside className="landfill-kpi-module" aria-label="총량 대비 반입량과 잔여 관리 여력">{" "}
            <div className="donut landfill-kpi-ring" style={{ "--pct": "0" } as CSSProperties}>{" "}
              <span>0%</span>{" "}
              <small>반입량</small>{" "}
            </div>{" "}
            <div className="donut landfill-kpi-ring landfill-kpi-ring--secondary" style={{ "--pct": "0" } as CSSProperties}>{" "}
              <span data-landfill-secondary-value="">0%</span>{" "}
              <small>잔여량</small>{" "}
            </div>{" "}
          </aside>{" "}
        </div>{" "}
      </article>{" "}

      <article className="panel class-panel" id="ranking">{" "}
        <div className="panel-head">{" "}
          <div>{" "}
            <p>Class Resource Dashboard</p>{" "}
            <h2>우리반 자원순환 대시보드</h2>{" "}
          </div>{" "}
        </div>{" "}
        <label className="select-line">{" "}
          <span>학급 선택</span>{" "}
          <select id="classSelect" aria-label="학급 선택" defaultValue="5학년 1반">{" "}
            <option>3학년 1반</option>{" "}
            <option>3학년 2반</option>{" "}
            <option>3학년 3반</option>{" "}
            <option>4학년 1반</option>{" "}
            <option>4학년 2반</option>{" "}
            <option>4학년 3반</option>{" "}
            <option>4학년 4반</option>{" "}
            <option>5학년 1반</option>{" "}
            <option>5학년 2반</option>{" "}
            <option>5학년 3반</option>{" "}
            <option>5학년 4반</option>{" "}
            <option>6학년 1반</option>{" "}
            <option>6학년 2반</option>{" "}
            <option>6학년 3반</option>{" "}
          </select>{" "}
        </label>{" "}
        <div className="class-kpis">{" "}
          <div><strong data-today-observed="">0</strong><span>오늘 관찰</span></div>{" "}
          <div><strong data-ai-classified="">0</strong><span>판단 보류</span></div>{" "}
          <div><strong data-human-confirmed="">0</strong><span>전환 사례</span></div>{" "}
        </div>{" "}
        <div className="confusion">{" "}
          <h3>헷갈린 물건 TOP 5</h3>{" "}
          <div><span>종이컵</span><i style={{ "--value": "0%" } as CSSProperties}></i><b>0</b></div>{" "}
          <div><span>우유갑</span><i style={{ "--value": "0%" } as CSSProperties}></i><b>0</b></div>{" "}
          <div><span>과자 포장지</span><i style={{ "--value": "0%" } as CSSProperties}></i><b>0</b></div>{" "}
          <div><span>컵라면 용기</span><i style={{ "--value": "0%" } as CSSProperties}></i><b>0</b></div>{" "}
          <div><span>영수증</span><i style={{ "--value": "0%" } as CSSProperties}></i><b>0</b></div>{" "}
        </div>{" "}
        <p className="rank-note">RANKING 🥇 5학년 중 1위 · 🏫 전교 0위</p>{" "}
      </article>{" "}

      <article className="panel upload-panel">{" "}
        <div className="panel-head">{" "}
          <div>{" "}
            <p>3 second Module</p>{" "}
            <h2>버려지는 순간을 기록하세요</h2>{" "}
          </div>{" "}
        </div>{" "}
        <p>사진을 찍어 AI와 함께 분류하며 판단합니다.</p>{" "}
        <ul className="upload-highlights">{" "}
          <li>AI가 확인할 항목을 제안합니다.</li>{" "}
          <li>최종 배출 판단은 사용자가 결정합니다.</li>{" "}
          <li>사진은 저장하지 않고 판단 기록만 남습니다.</li>{" "}
        </ul>{" "}
        <span className="gemini-credit"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c.6 4.6 5.4 9.4 10 10-4.6.6-9.4 5.4-10 10-.6-4.6-5.4-9.4-10-10 4.6-.6 9.4-5.4 10-10Z" /></svg>Powered by Gemini</span>{" "}
        <div className="experience-portal">{" "}
          <span className="portal-powered"><svg className="portal-gemini-star" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="geminiStarA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9ab00" /><stop offset=".55" stop-color="#4285f4" /><stop offset="1" stop-color="#4285f4" /></linearGradient><linearGradient id="geminiStarB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ea4335" stop-opacity=".95" /><stop offset=".45" stop-color="#ea4335" stop-opacity="0" /><stop offset=".62" stop-color="#34a853" stop-opacity="0" /><stop offset="1" stop-color="#34a853" stop-opacity=".95" /></linearGradient></defs><path fill="url(#geminiStarA)" d="M12 2c.6 4.6 5.4 9.4 10 10-4.6.6-9.4 5.4-10 10-.6-4.6-5.4-9.4-10-10 4.6-.6 9.4-5.4 10-10Z" /><path fill="url(#geminiStarB)" d="M12 2c.6 4.6 5.4 9.4 10 10-4.6.6-9.4 5.4-10 10-.6-4.6-5.4-9.4-10-10 4.6-.6 9.4-5.4 10-10Z" /></svg>Powered by Google Gemini</span>{" "}
          <div className="portal-frame">{" "}
            <p className="portal-teaser">모든 화면을 끝까지 둘러본 뒤 이곳으로 다시 돌아오면<br /><strong>새로운 자원 순환 UX 체험 포탈</strong>이 열립니다.</p>{" "}
            <span className="portal-arrow" aria-hidden="true"></span>{" "}
            <div className="qr-invite">{" "}
              <a href="./mobile/index.html" target="_blank" rel="noopener noreferrer">{" "}
                <img src="./assets/qr/kiosk-5-1.png" alt="내 폰으로 3초판단 바로 열기 QR코드" loading="lazy" />{" "}
              </a>{" "}
              <p>QR코드를 스캔하면<br />버리는 순간을 바꾸는<br /><strong>3초 판단 도우미 앱</strong>을<br />체험할 수 있어요.</p>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        <input id="cameraInput" type="file" accept="image/*" capture="environment" hidden={true} />{" "}
        <input id="uploadInput" type="file" accept="image/*" hidden={true} />{" "}
        <div className="upload-actions upload-card-actions">{" "}
          <button type="button" data-upload="camera">{" "}
            <span className="upload-icon" aria-hidden="true">{" "}
              <svg viewBox="0 0 24 24"><path d="M4 8h4l1.8-2h4.4L16 8h4v10H4z" /><circle cx="12" cy="13" r="3.4" /></svg>{" "}
            </span>{" "}
            <span>카메라로<br />지금 찍기</span>{" "}
          </button>{" "}
          <button type="button" data-upload="file">{" "}
            <span className="upload-icon" aria-hidden="true">{" "}
              <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M7 16l3.4-3.4 2.6 2.6 2-2L20 18" /><circle cx="15.5" cy="9.5" r="1.4" /></svg>{" "}
            </span>{" "}
            <span>찍은 사진<br />올리기</span>{" "}
          </button>{" "}
        </div>{" "}
        <small>※ 본 플랫폼은 환경부 분리배출 및 인천광역시교육청 자원순환 공식 지침을 바탕으로 제작되었습니다.</small>{" "}
      </article>{" "}
    </div>{" "}

    <article className="panel skill-panel">{" "}
      <div className="panel-head">{" "}
        <div>{" "}
          <p>Class Skill Registry</p>{" "}
          <h2>우리 반이 AI에게 가르친 것</h2>{" "}
        </div>{" "}
      </div>{" "}
      <details className="classroom-skill-panel" id="classroomSkillPanel">{" "}
        <summary>우리 반이 AI에게 가르친 것</summary>{" "}
        <p className="classroom-skill-intro">Gemini의 판단을 바꾸지 않고, 우리 반이 만든 Teachable Machine 기술을 참고용으로 누적합니다.</p>{" "}
        <div className="class-profile-panel" id="classProfilePanel">{" "}
          <p id="classProfileStatus" className="class-profile-status" role="status" aria-live="polite">반을 연결하면 우리 반 Skill만 참고용으로 사용합니다.</p>{" "}
          <form id="classProfileForm" className="class-profile-form">{" "}
            <label>학교 ID<input id="classProfileSchoolId" required={true} maxLength={80} placeholder="예: aiways-elementary" autoComplete="organization" /></label>{" "}
            <label>학교 이름<input id="classProfileSchoolName" required={true} maxLength={80} placeholder="예: AI Ways 초등학교" autoComplete="organization" /></label>{" "}
            <label>학년<input id="classProfileGrade" required={true} maxLength={12} placeholder="예: 3" inputMode="numeric" /></label>{" "}
            <label>반<input id="classProfileClassName" required={true} maxLength={24} placeholder="예: 3-2" /></label>{" "}
            <label>연결 방식<select id="classProfileMode"><option value="personal">개인 기기</option><option value="class_device">공용 기기</option></select></label>{" "}
            <button type="submit">우리 반 연결</button>{" "}
          </form>{" "}
          <div id="classProfileActions" className="class-profile-actions" hidden={true}>{" "}
            <button type="button" id="classProfileChangeButton">다른 반으로 연결</button>{" "}
            <button type="button" id="classProfileClearButton">반 연결 해제</button>{" "}
          </div>{" "}
        </div>{" "}
        <p id="classroomSkillCount" className="classroom-skill-count" aria-live="polite">우리 반이 AI에게 가르친 기술 0개</p>{" "}
        <button type="button" id="classroomSeedSkillButton">AI Ways Seed 분리수거 Skill 연결</button>{" "}
        <form id="classroomSkillForm" className="classroom-skill-form">{" "}
          <label>기술 이름<input id="classroomSkillName" required={true} maxLength={60} placeholder="예: 우리 반 페트병 구분" /></label>{" "}
          <label>무엇을 가르쳤는지<textarea id="classroomSkillDescription" required={true} maxLength={240} placeholder="예: 찌그러진 페트병과 일반 플라스틱을 구분했어요."></textarea></label>{" "}
          <label>Teachable Machine model URL<input id="classroomSkillUrl" type="url" required={true} placeholder="https://teachablemachine.withgoogle.com/models/..." /></label>{" "}
          <label>공개 범위<select id="classroomSkillVisibility"><option value="class">우리 반</option><option value="school">우리 학교</option><option value="public">공개</option></select></label>{" "}
          <button type="submit">기술 미리보기</button>{" "}
        </form>{" "}
        <div id="classroomSkillPreview" hidden={true}></div>{" "}
        <p id="classroomSkillStatus" role="status" aria-live="polite"></p>{" "}
        <ul id="classroomSkillList" className="classroom-skill-list"><li className="empty-state">아직 우리 반이 가르쳐준 기술이 없어요. 첫 번째 기술을 만들어볼까요? 🎓</li></ul>{" "}
      </details>{" "}
    </article>{" "}
  </section>
  );
}
