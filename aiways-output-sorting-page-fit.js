(() => {
  const clean = value => (value || "").replace(/\s+/g, " ").trim();
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function rectArea(el) {
    const r = el.getBoundingClientRect();
    return r.width * r.height;
  }

  function markSortingPage() {
    const sections = $$("section, article, .aiw-page-section, .aiways-final-scroll-page, .aiways-restore-page, [data-section], main > div, body > div");

    const page = sections.find(el => {
      const t = clean(el.textContent);
      const r = el.getBoundingClientRect();

      return r.width > 600
        && r.height > 360
        && t.includes("3초 판단 앱")
        && t.includes("버려지는 순간을 판단하세요");
    }) || sections.find(el => {
      const t = clean(el.textContent);
      const r = el.getBoundingClientRect();

      return r.width > 600
        && r.height > 360
        && t.includes("Output · 3-Second Sorting Helper App");
    });

    if (!page) return;

    page.classList.add("aiways-output-sorting-page");

    const candidates = $$("div, article, section", page)
      .filter(el => {
        const t = clean(el.textContent);
        const r = el.getBoundingClientRect();

        return r.width > 360
          && r.height > 280
          && t.includes("AI + 학생 판단")
          && t.includes("버려지는 순간을 판단하세요");
      })
      .sort((a, b) => rectArea(a) - rectArea(b));

    const appCard = candidates[0];

    if (appCard) {
      appCard.classList.add("aiways-output-sorting-app-card");
    }
  }

  function boot() {
    markSortingPage();

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      markSortingPage();

      if (tries >= 12) clearInterval(timer);
    }, 350);

    window.addEventListener("resize", markSortingPage, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
