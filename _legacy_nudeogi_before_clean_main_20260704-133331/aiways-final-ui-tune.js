(() => {
  const NAV_ORDER = ["대시보드", "프로젝트", "교육과정", "H-A-H", "차시흐름", "산출물"];
  const ACTIVE_CLASS = "aiways-final-active";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const tx = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const includes = (el, str) => tx(el).includes(str);

  function findHeader() {
    return $("header") || $(".site-header") || $(".header");
  }

  function findHeaderNav(header) {
    if (!header) return null;
    return $("nav", header) || $('[class*="nav"]', header) || header;
  }

  function removeTopRightCTA(header) {
    if (!header) return;

    const ctaCandidates = $$("a,button,div,span", header).filter(el => {
      const text = tx(el);
      return text.includes("지금 분류하기") || text.includes("지금 버려지는 순간 찰칵") || text.includes("지금 버려지는 순간");
    });

    ctaCandidates.forEach(el => {
      const kill = el.closest("a,button,div");
      if (kill) kill.classList.add("aiways-final-cta-removed");
    });
  }

  function patchHeaderNav() {
    const header = findHeader();
    if (!header) return;

    removeTopRightCTA(header);

    const nav = findHeaderNav(header);
    if (!nav) return;

    // 6차시 -> 차시흐름
    $$("a,button,span,li,div", nav).forEach(el => {
      if (tx(el) === "6차시") el.textContent = "차시흐름";
    });

    // 메뉴 후보 수집
    let links = $$("a,button,span", nav).filter(el => {
      const text = tx(el);
      return ["프로젝트", "교육과정", "H-A-H", "차시흐름", "산출물", "6차시"].includes(text);
    });

    if (!links.length) return;

    nav.classList.add("aiways-final-nav-wrap");

    // 대시보드 메뉴 추가
    const first = links[0];
    const existsDash = $$("a,button,span", nav).find(el => tx(el) === "대시보드");

    if (!existsDash && first) {
      const dash = document.createElement(first.tagName.toLowerCase() === "span" ? "span" : first.tagName.toLowerCase());
      dash.textContent = "대시보드";
      if ("href" in dash) dash.href = "#top";
      dash.className = first.className;
      dash.setAttribute("data-aiways-nav", "대시보드");
      first.parentNode.insertBefore(dash, first);
    }

    // 다시 링크 수집 + 클래스 부여
    links = $$("a,button,span", nav).filter(el => NAV_ORDER.includes(tx(el)));
    links.forEach(el => el.classList.add("aiways-final-nav-link"));
  }

  function allPageSections() {
    const blocks = $$("main > section, body > section, section, article, [data-section]").filter(el => {
      if (el === document.body || el.tagName === "MAIN" || el.tagName === "HEADER" || el.tagName === "NAV") return false;
      const rect = el.getBoundingClientRect();
      const text = tx(el);
      return rect.width > 420 && rect.height > 220 && text.length > 20;
    });

    const unique = [];
    blocks.forEach(el => {
      if (unique.some(parent => parent.contains(el))) return;
      unique.push(el);
    });

    return unique;
  }

  function findSectionByText(texts) {
    return allPageSections().find(sec => texts.some(t => tx(sec).includes(t))) || null;
  }

  function getSectionLabelMap() {
    const sections = allPageSections();
    const map = [];

    sections.forEach((sec, idx) => {
      const text = tx(sec);
      let label = null;

      if (text.includes("버리는 순간") && text.includes("데이터가 되다") && text.includes("AIWays Incheon은")) {
        label = "대시보드";
      } else if (text.includes("교육과정 기반 수업설계")) {
        label = "교육과정";
      } else if (text.includes("H-A-H") && !text.includes("버려지는 순간을 기록하세요")) {
        label = "H-A-H";
      } else if (
        text.includes("6차시 여정") ||
        text.includes("1~2차시") ||
        text.includes("2차시") ||
        text.includes("3차시") ||
        text.includes("4차시") ||
        text.includes("5차시") ||
        text.includes("6차시")
      ) {
        label = "차시흐름";
      } else if (
        text.includes("학생 산출물 갤러리") ||
        text.includes("3-Second Sorting Helper App") ||
        text.includes("3초 판단 앱") ||
        text.includes("버려지는 순간을 기록하세요")
      ) {
        label = "산출물";
      }

      // 차시흐름 이후 모든 페이지는 산출물
      if (!label) {
        const prevFlowIndex = map.findIndex(item => item.label === "차시흐름");
        if (prevFlowIndex >= 0 && idx > prevFlowIndex) label = "산출물";
      }

      map.push({ sec, label });
    });

    return map;
  }

  function updateActiveNav() {
    const header = findHeader();
    if (!header) return;

    const nav = findHeaderNav(header);
    if (!nav) return;

    const items = $$("a,button,span", nav).filter(el => NAV_ORDER.includes(tx(el)));
    if (!items.length) return;

    const sectionMap = getSectionLabelMap().filter(item => item.label);
    if (!sectionMap.length) return;

    const center = window.scrollY + window.innerHeight * 0.45;

    let best = sectionMap[0];
    let bestDistance = Infinity;

    sectionMap.forEach(item => {
      const rectTop = item.sec.offsetTop;
      const rectCenter = rectTop + item.sec.offsetHeight * 0.45;
      const d = Math.abs(rectCenter - center);
      if (d < bestDistance) {
        bestDistance = d;
        best = item;
      }
    });

    items.forEach(el => el.classList.toggle(ACTIVE_CLASS, tx(el) === best.label));
  }

  function patchHeroText() {
    const hero = findSectionByText(["버리는 순간", "데이터가 되다"]);
    if (!hero) return;

    const copyCandidates = $$("p,div", hero).filter(el => {
      const text = tx(el);
      return text.startsWith("AIWays Incheon은") && text.includes("H-A-H 기반 수업 프로젝트입니다.");
    });

    const copy = copyCandidates.sort((a, b) => b.textContent.length - a.textContent.length)[0];
    if (!copy) return;

    copy.classList.add("aiways-final-hero-copy");

    const wrap = copy.parentElement;
    if (wrap) wrap.classList.add("aiways-final-hero-copy-wrap");
  }

  function findCardByHeading(headingText) {
    const card = $$("article, .aiw-card, .op-card, [data-op-card], [class*='card']").find(el => {
      const text = tx(el);
      const rect = el.getBoundingClientRect();
      return text.includes(headingText) && rect.width > 260 && rect.height > 140;
    });

    if (card) return card;

    const heading = $$("h1,h2,h3,h4,h5,div,span,p").find(el => tx(el).includes(headingText));
    if (!heading) return null;

    let node = heading;
    while (node && node !== document.body) {
      const text = tx(node);
      if (text.includes(headingText) && node.getBoundingClientRect().width > 260 && node.getBoundingClientRect().height > 140) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function reduceMetricLabel(card, labels) {
    if (!card) return;

    labels.forEach(labelText => {
      const labelNode = $$("*", card).find(el => tx(el) === labelText);
      if (labelNode) {
        labelNode.classList.add("aiways-final-label");
        const valueNode = labelNode.parentElement ? $$("*", labelNode.parentElement).find(el => /^[0-9]+/.test(tx(el)) && el !== labelNode) : null;
        if (valueNode) valueNode.classList.add("aiways-final-value");
      }
    });
  }

  function reduceSmallTitles(card, labels) {
    if (!card) return;
    labels.forEach(textLabel => {
      const node = $$("*", card).find(el => tx(el) === textLabel);
      if (node) node.classList.add("aiways-final-small-title");
    });
  }

  function patchDonutBoxes(card, titles) {
    if (!card) return;

    titles.forEach(titleText => {
      const titleNode = $$("*", card).find(el => tx(el) === titleText);
      if (!titleNode) return;

      const box = titleNode.parentElement;
      if (!box) return;

      box.classList.add("aiways-final-donut-box");
      titleNode.classList.add("aiways-final-donut-title");

      const chartNode = $$("*", box).find(el => {
        const hasCanvas = $("canvas", el);
        const hasSvg = $("svg", el);
        const cls = (el.className || "").toString().toLowerCase();
        return el !== titleNode && (hasCanvas || hasSvg || cls.includes("donut") || cls.includes("chart") || cls.includes("graph"));
      });

      if (chartNode) chartNode.classList.add("aiways-final-donut-fit");
    });
  }

  function patchSchoolCard() {
    const card = findCardByHeading("우리학교 자원순환 대시보드");
    if (!card) return;

    card.classList.add("aiways-final-school-card");

    reduceMetricLabel(card, ["참여 학급", "배출 관찰", "판단 보류"]);
    reduceSmallTitles(card, ["학년별 참여", "배출 성공률", "판단 보류 비율"]);

    // 학년별 참여 텍스트
    $$("*", card).forEach(el => {
      if (/^[3456]학년$/.test(tx(el))) el.classList.add("aiways-final-bar-label");
      if (/^[0-9]+$/.test(tx(el)) && el.parentElement && /학년/.test(tx(el.parentElement))) el.classList.add("aiways-final-bar-value");
    });

    patchDonutBoxes(card, ["배출 성공률", "판단 보류 비율"]);
  }

  function patchClassCard() {
    const card = findCardByHeading("우리반 자원순환 대시보드");
    if (!card) return;

    card.classList.add("aiways-final-class-card");

    reduceMetricLabel(card, ["오늘 관찰", "판단 보류", "전환 사례"]);
    reduceSmallTitles(card, ["헷갈린 물건 TOP 5"]);

    patchTop5(card);
  }

  function patchTop5(card) {
    const title = $$("*", card).find(el => tx(el) === "헷갈린 물건 TOP 5");
    if (!title) return;

    let box = title.parentElement;
    while (box && box !== card) {
      const text = tx(box);
      if (text.includes("헷갈린 물건 TOP 5")) break;
      box = box.parentElement;
    }
    if (!box || box.dataset.aiwaysTop5Done === "1") return;

    const lines = tx(box).split(/\s*(?:\n|(?=\d\.\s))/).map(v => v.trim()).filter(Boolean);
    const parsed = [];

    lines.forEach(line => {
      const m = line.match(/^\d+\.\s*(.+?)\s+(\d+)$/);
      if (m) parsed.push({ label: m[1], value: Number(m[2]) });
    });

    if (!parsed.length) return;

    box.dataset.aiwaysTop5Done = "1";

    const wrap = document.createElement("div");
    wrap.className = "aiways-final-top5";

    const max = Math.max(...parsed.map(item => item.value), 1);

    parsed.forEach(item => {
      const row = document.createElement("div");
      row.className = "aiways-final-top5-row";
      row.innerHTML = `
        <div class="aiways-final-top5-label">${item.label}</div>
        <div class="aiways-final-top5-track">
          <div class="aiways-final-top5-fill" style="width:${(item.value / max) * 100}%"></div>
        </div>
        <div class="aiways-final-top5-value">${item.value}</div>
      `;
      wrap.appendChild(row);
    });

    // 제목 외 다른 텍스트 노드 비우고 새 UI 삽입
    const nodes = Array.from(box.childNodes);
    nodes.forEach(node => {
      if (node.nodeType === 3) node.textContent = "";
    });

    // 기존 숫자줄들 숨기기
    $$("*", box).forEach(el => {
      if (el !== title) el.classList.add("aiways-final-hide");
    });

    title.insertAdjacentElement("afterend", wrap);
  }

  function patchAppCard() {
    const appCard = $("#classify") || findCardByHeading("버려지는 순간을 기록하세요");
    if (!appCard || appCard.closest("#quick-app")) return;

    appCard.classList.add("aiways-final-app-card-compact");

    $$("button, a", appCard).forEach(el => {
      const text = tx(el);
      if (text === "카메라로 지금 찍기" || text === "찍은 사진 올리기") {
        el.classList.add("aiways-final-hide");
      }
    });

    // 안내문 삭제
    $$("p,div,span", appCard).forEach(el => {
      const text = tx(el);
      if (text.includes("발표 중 업로드한 사진은 이 브라우저 안에서만 미리보기로 사용됩니다.")) {
        if (el.tagName === "P" || el.className.toString().includes("note")) el.remove();
      }
      if (text.includes("OX 퀴즈") || text.includes("퀴즈 1 / 10")) {
        const kill = el.closest(".tune-quiz, .op-quiz, [id*='quiz'], [class*='quiz']");
        if (kill) kill.remove();
      }
    });

    // AI분류 대기중 자리 찾기/생성
    const resultArea = $("#tune-result-area", appCard);
    const resultAreaHasSavedResult =
      resultArea &&
      resultArea.dataset.aiwaysFinalWaitMounted === "1" &&
      !tx(resultArea).includes("AI분류 대기");

    let waitBox = $("#aiways-final-app-wait", appCard);
    if (!waitBox && resultAreaHasSavedResult) {
      hookUploadProgress(appCard);
      return;
    }

    if (!waitBox) {
      waitBox = document.createElement("div");
      waitBox.id = "aiways-final-app-wait";
      waitBox.className = "aiways-final-app-wait";
      waitBox.innerHTML = `
        <div class="aiways-final-app-wait-title" id="aiways-final-app-title">AI분류 대기중</div>
        <div class="aiways-final-app-wait-sub" id="aiways-final-app-sub">사진을 촬영하거나 파일을 업로드하면 단계별로 분석 상태가 표시됩니다.</div>
        <div class="aiways-final-progress" id="aiways-final-progress">
          <div class="aiways-final-progress-label">
            <span id="aiways-final-progress-step">대기 중</span>
            <span id="aiways-final-progress-percent">0%</span>
          </div>
          <div class="aiways-final-progress-track">
            <div class="aiways-final-progress-fill" id="aiways-final-progress-fill"></div>
          </div>
        </div>
      `;

      if (resultArea && resultArea.dataset.aiwaysFinalWaitMounted !== "1") {
        resultArea.innerHTML = "";
        resultArea.appendChild(waitBox);
        resultArea.dataset.aiwaysFinalWaitMounted = "1";
        hookUploadProgress(appCard);
        return;
      }

      const insertTarget =
        $(".tune-result", appCard) ||
        $("#tune-result", appCard) ||
        $(".tune-quiz", appCard) ||
        $("#dropZone", appCard) ||
        $("#startAiGuess", appCard);

      if (insertTarget && insertTarget.parentElement) {
        insertTarget.parentElement.insertBefore(waitBox, insertTarget);
      } else {
        appCard.appendChild(waitBox);
      }
    }

    hookUploadProgress(appCard);
  }

  function hookUploadProgress(root) {
    const fileInputs = $$('input[type="file"]', root);
    const triggerButtons = $$("button, a", root).filter(el => {
      const text = tx(el);
      return (
        text.includes("카메라") ||
        text.includes("사진") ||
        text.includes("지금 버려지는 순간 찰칵") ||
        text.includes("기록해둔 순간 판단하기")
      );
    });

    const title = $("#aiways-final-app-title");
    const sub = $("#aiways-final-app-sub");
    const progress = $("#aiways-final-progress");
    const step = $("#aiways-final-progress-step");
    const percent = $("#aiways-final-progress-percent");
    const fill = $("#aiways-final-progress-fill");

    if (!title || !sub || !progress || !step || !percent || !fill) return;

    let timer = null;

    function runProgress() {
      if (timer) clearInterval(timer);

      const phases = [
        { label: "사진 불러오는 중", value: 20 },
        { label: "이미지 전처리 중", value: 42 },
        { label: "분류 후보 추출 중", value: 64 },
        { label: "분리배출 기준 대조 중", value: 82 },
        { label: "판단 카드 생성 중", value: 100 }
      ];

      title.textContent = "AI분류 진행중";
      sub.textContent = "사진을 기반으로 물체 후보와 분리배출 가이드를 준비하고 있습니다.";
      progress.classList.add("visible");

      let i = 0;
      step.textContent = phases[0].label;
      percent.textContent = "0%";
      fill.style.width = "0%";

      timer = setInterval(() => {
        const current = phases[i];
        step.textContent = current.label;
        percent.textContent = `${current.value}%`;
        fill.style.width = `${current.value}%`;
        i += 1;

        if (i >= phases.length) {
          clearInterval(timer);
          timer = null;
          setTimeout(() => {
            title.textContent = "AI분류 결과 확인";
            sub.textContent = "이제 AI가 제안한 분리배출 결과를 사람이 다시 판단할 차례입니다.";
          }, 280);
        }
      }, 650);
    }

    triggerButtons.forEach(btn => {
      if (btn.dataset.aiwaysHooked === "1") return;
      btn.dataset.aiwaysHooked = "1";
      btn.addEventListener("click", () => {
        title.textContent = "AI분류 준비중";
        sub.textContent = "입력된 이미지가 들어오면 분석을 시작합니다.";
      });
    });

    fileInputs.forEach(input => {
      if (input.dataset.aiwaysHooked === "1") return;
      input.dataset.aiwaysHooked = "1";
      input.addEventListener("change", () => {
        if (input.files && input.files.length) runProgress();
      });
    });
  }

  function boot() {
    patchHeaderNav();
    patchHeroText();
    patchSchoolCard();
    patchClassCard();
    patchAppCard();
    updateActiveNav();

    window.addEventListener("scroll", updateActiveNav, { passive: true });
    window.addEventListener("resize", () => {
      patchHeaderNav();
      patchHeroText();
      patchSchoolCard();
      patchClassCard();
      patchAppCard();
      updateActiveNav();
    }, { passive: true });

    // 렌더 지연 보정
    let tries = 0;
    const retry = setInterval(() => {
      tries += 1;
      patchHeaderNav();
      patchHeroText();
      patchSchoolCard();
      patchClassCard();
      patchAppCard();
      updateActiveNav();
      if (tries > 18) clearInterval(retry);
    }, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

