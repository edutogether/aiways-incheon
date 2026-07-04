(() => {
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  function setTextByIncludes(selectorCandidates, includesList, newText) {
    const nodes = selectorCandidates.flatMap((selector) => $$(selector));
    const target = nodes.find((node) => {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      return includesList.some((key) => text.includes(key));
    });
    if (target) target.textContent = newText;
    return target;
  }

  function removeDemoWord() {
    $$(".aiw-demo-badge, .badge, .chip, .pill").forEach((el) => {
      const text = (el.textContent || "").trim();
      if (!/demo/i.test(text)) return;
      el.textContent = text.replace(/demo\s*·?\s*/gi, "").replace(/demo/gi, "").trim() || "수업용 데이터";
    });
  }

  function cardByText(pattern) {
    return $$(".aiw-card, .dashboard-card, .card").find((el) => pattern.test(el.textContent || ""));
  }

  function cardDescription(card) {
    return $(".aiw-card-desc", card) || $("p:not(.aiw-card-kicker)", card);
  }

  function setKpiMetric(key, value, labelText) {
    const counter = document.querySelector(`[data-counter][data-kpi="${key}"]`);
    if (!counter) return;

    counter.dataset.target = String(value);
    const label = counter.parentElement?.querySelector("span");
    if (label && labelText) label.textContent = labelText;

    counter.textContent = String(value);
    try {
      metricValues[key] = value;
    } catch {
      /* metricValues is owned by script.js when available. */
    }
  }

  function patchTexts() {
    const desc = $$(".aiw-description, .hero-desc, .copy-desc, .hero-copy p").find((el) =>
      (el.textContent || "").includes("환경")
    );
    if (desc) {
      desc.innerHTML = `
AIWays Incheon은 환경 보호 포스터를 만드는 수업이 아닙니다.<br>
우리가 실제로 쓰레기를 버리는 순간을 관찰하고,<br>
AI를 통해 데이터를 1차 판단한 뒤 사람이 중심이 되어 다시 확인하는,<br>
우리 학교의 자원순환 UX를 개선하는 H-A-H 기반 수업 프로젝트입니다.
      `.trim();
    }

    setTextByIncludes([".section-label", ".story-label", ".page-label", ".section-kicker", ".eyebrow"], ["Project Frame"], "슬로건");

    const projectTitle = $$("h2, h3, .section-title, .story-title").find((el) =>
      (el.textContent || "").includes("포스터를 만드는 수업이 아니라")
    );
    if (projectTitle) {
      projectTitle.innerHTML = "환경 보호 포스터를 만드는 수업이 아니라,<br />학교의 버리는 순간을 바꾸는 수업입니다.";
    }

    const schoolCard = cardByText(/우리학교 자원순환\s*대시보드/);
    const classCard = cardByText(/우리반 자원순환\s*대시보드/);
    const landfillCard = cardByText(/수도권매립지 모니터|수도권 매립지 모니터/);
    const uploadCard = cardByText(/버려지는 순간을 기록하세요/);

    if (schoolCard) {
      const description = cardDescription(schoolCard);
      if (description) {
        description.textContent = "학교 전체의 배출 흐름을 빠르게 읽고, 우리반의 실천 변화를 함께 비교하는 자원순환 현황판입니다.";
      }
      let footer = $(".school-footer-line", schoolCard);
      if (!footer) {
        footer = document.createElement("div");
        footer.className = "school-footer-line";
        const anchor = $(".school-card-grid", schoolCard) || schoolCard.lastElementChild;
        if (anchor) anchor.insertAdjacentElement("afterend", footer);
        else schoolCard.appendChild(footer);
      }
      footer.textContent = "학년별 참여 현황과 보류 데이터를 함께 확인하며 학교 전체 흐름을 살펴봅니다.";
    }

    if (classCard) {
      const description = cardDescription(classCard);
      if (description) description.textContent = "우리반의 버리는 순간을 AI와 함께 분류하고, 다시 확인한 기록입니다.";

      const rankingBox = $$(".ranking-box, .class-card-bottom div, .rank-box", classCard).find((el) =>
        /랭킹|1위|2위|DEMO/i.test(el.textContent || "")
      );
      if (rankingBox) {
        rankingBox.innerHTML = `
          <h3>우리반 랭킹</h3>
          <strong>학년 내 1위 · 학교 내 2위</strong>
          <small title="클릭하면 랭킹 페이지로 이동합니다.">랭킹 보기</small>
        `;
        rankingBox.style.cursor = "pointer";
        rankingBox.addEventListener("click", () => {
          const target = document.querySelector("#ranking, .ranking-section");
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      $$(".class-main-kpi, .class-mini-kpis div, .kpi-card, .aiw-kpi-tile", classCard).forEach((el) => {
        const text = (el.textContent || "").replace(/\s+/g, " ");
        const label = $("span", el);

        if (text.includes("오늘 관찰")) {
          setKpiMetric("today-observed", 128, "오늘 관찰");
          if (label) label.textContent = "오늘 관찰";
        }
        if (text.includes("AI 1차 분류") || text.includes("AI 분류")) {
          setKpiMetric("ai-classified", 37, "AI 분류");
          if (label) label.textContent = "AI 분류";
        }
        if (text.includes("학생 재확인") || text.includes("재확인")) {
          setKpiMetric("human-confirmed", 18, "재확인");
          if (label) label.textContent = "재확인";
        }
      });
    }

    if (landfillCard) {
      const description = cardDescription(landfillCard);
      if (description) {
        description.textContent = "수도권매립지 흐름을 한눈에 읽을 수 있도록 정리한 실시간 모니터 시제품입니다.";
      }

      const liveDot = $(".live-dot", landfillCard);
      if (liveDot) {
        liveDot.className = "landfill-refresh";
        liveDot.setAttribute("role", "button");
        liveDot.setAttribute("tabindex", "0");
        liveDot.title = "실시간 새로고침";
        liveDot.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 11a8 8 0 1 0 2 5"></path>
            <path d="M20 4v7h-7"></path>
          </svg>
        `;
      }

      const side = $(".landfill-progress", landfillCard);
      if (side) side.classList.add("landfill-side");

      if (side && !$(".landfill-donut-wrap", side)) {
        const wrap = document.createElement("div");
        wrap.className = "landfill-donut-wrap";
        wrap.innerHTML = '<div class="landfill-donut"></div>';
        side.appendChild(wrap);
        $(".landfill-donut", wrap)?.setAttribute("data-label", "잔여\n36.6%");
      }

      if (!$(".landfill-live-note", landfillCard)) {
        const note = document.createElement("div");
        note.className = "landfill-live-note";
        note.textContent = "실시간 갱신 중 · 수치와 그래프가 주기적으로 업데이트됩니다.";
        landfillCard.appendChild(note);
      }
    }

    if (uploadCard && !document.querySelector(".ny-app")) {
      const description = cardDescription(uploadCard);
      if (description) description.textContent = "사진을 찍어 AI와 함께 분류하며 판단합니다.";

      $$("small, p, .note, .upload-note, .caption", uploadCard).forEach((el) => {
        const text = (el.textContent || "").trim();
        if (text.includes("큐시트") || text.includes("발표 시연") || text.includes("발표 중") || text.includes("미리보기로 사용됩니다")) {
          el.remove();
        }
      });

      const guessButton = $$("button, a", uploadCard).find((el) => /AI 1차 추정 시작|AI 1차 분류 제안/.test(el.textContent || ""));
      if (guessButton) guessButton.textContent = "버려지는 순간을 기록하기";

      if (!$(".upload-actions-two", uploadCard)) {
        const actions = document.createElement("div");
        actions.className = "upload-actions-two";
        actions.innerHTML = `
          <button type="button">카메라로 지금 찍기</button>
          <button type="button">찍은 사진 올리기</button>
        `;
        const drop = $(".upload-drop", uploadCard);
        if (drop) drop.insertAdjacentElement("afterend", actions);
      }

      const strong = $$("strong", uploadCard).find((el) => /사진 업로드/.test(el.textContent || ""));
      if (strong) strong.textContent = "사진 기록";
    }

    removeDemoWord();
  }

  function animateNumber(el, from, to, formatter, duration = 900) {
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (to - from) * eased;
      el.textContent = formatter(value);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function landfillLiveAnimation() {
    const landfillCard = cardByText(/수도권매립지 모니터|수도권 매립지 모니터/);
    if (!landfillCard) return;

    const candidates = $$(".aiw-kpi-tile, .kpi-card", landfillCard).filter((el) => $("b", el));

    function refreshOnce() {
      const values = [
        18380 + Math.floor(Math.random() * 120),
        62.4 + Math.random() * 2.2,
        35.8 + Math.random() * 1.8,
      ];

      candidates.forEach((tile) => {
        const labelEl = $("span", tile);
        const valueEl = $("b", tile);
        if (!labelEl || !valueEl) return;

        const label = (labelEl.textContent || "").replace(/\s+/g, "");
        if (label.includes("반입량")) {
          const oldValue = parseFloat((valueEl.textContent || "0").replace(/[^\d.]/g, "")) || 18420;
          animateNumber(valueEl, oldValue, values[0], (value) => `${Math.round(value).toLocaleString()}t`);
        } else if (label.includes("반입률")) {
          const oldValue = parseFloat((valueEl.textContent || "0").replace(/[^\d.]/g, "")) || 63.4;
          animateNumber(valueEl, oldValue, values[1], (value) => `${value.toFixed(1)}%`);
        } else if (label.includes("여력") || label.includes("잔여")) {
          const oldValue = parseFloat((valueEl.textContent || "0").replace(/[^\d.]/g, "")) || 36.6;
          animateNumber(valueEl, oldValue, values[2], (value) => `${value.toFixed(1)}%`);
        }
      });

      const donut = $(".landfill-donut", landfillCard);
      if (donut) {
        const value = values[2].toFixed(1);
        donut.style.setProperty("--val", value);
        donut.setAttribute("data-label", `잔여\n${value}%`);
      }

      const refresh = $(".landfill-refresh", landfillCard);
      if (refresh) {
        refresh.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
          duration: 700,
          easing: "cubic-bezier(.2,.7,.3,1)",
        });
      }
    }

    $(".landfill-refresh", landfillCard)?.addEventListener("click", refreshOnce);
    refreshOnce();
    window.setInterval(refreshOnce, 4200);
  }

  function smoothScrollPolish() {
    const revealTargets = $$(".section-shell, .story-section, .ranking-section");
    if (!revealTargets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-revealed", entry.isIntersecting);
        });
      },
      {
        threshold: 0.34,
        rootMargin: "-8% 0px -8% 0px",
      }
    );

    revealTargets.forEach((el) => observer.observe(el));
    document.documentElement.style.scrollBehavior = "smooth";
  }

  function fixCardHeights() {
    const schoolCard = cardByText(/우리학교 자원순환\s*대시보드/);
    const classCard = cardByText(/우리반 자원순환\s*대시보드/);
    const landfillCard = cardByText(/수도권매립지 모니터|수도권 매립지 모니터/);

    if (schoolCard) schoolCard.style.minHeight = "330px";
    if (classCard) classCard.style.minHeight = "286px";
    if (landfillCard) landfillCard.style.minHeight = "330px";
  }

  function init() {
    patchTexts();
    fixCardHeights();
    landfillLiveAnimation();
    smoothScrollPolish();
    window.setTimeout(() => {
      patchTexts();
      fixCardHeights();
    }, 120);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
    return;
  }

  init();
})();
