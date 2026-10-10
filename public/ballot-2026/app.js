(() => {
  const STORAGE_KEY = "scc-ballot-2026:v1";
  const VOTE_LABELS = { yes: "Yes", no: "No", skip: "Skip" };
  const { sections } = window.BALLOT;

  const allMeasures = sections.flatMap((s) => s.measures.map((m) => ({ ...m, section: s.id })));
  const localJurisdictions = [...new Set(sections.find((s) => s.id === "local").measures.map((m) => m.jurisdiction))];

  // ---- persistence ----
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && typeof raw === "object") {
        return { votes: raw.votes || {}, notes: raw.notes || {}, areas: raw.areas || [], status: raw.status || "all" };
      }
    } catch {}
    return { votes: {}, notes: {}, areas: [], status: "all" };
  }
  const state = load();
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  // ---- helpers ----
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  function inMyAreas(m) {
    return m.section !== "local" || state.areas.length === 0 || state.areas.includes(m.jurisdiction);
  }

  // ---- render cards ----
  const tpl = $("#card-tpl");
  const sectionsRoot = $("#sections");
  const cards = new Map();

  function renderExtra(m) {
    if (!m.yes) return null;
    const frag = document.createDocumentFragment();
    frag.append(el("dl", { class: "yesno" }, el("dt", { class: "y" }, "A YES vote means"), el("dd", {}, m.yes), el("dt", { class: "n" }, "A NO vote means"), el("dd", {}, m.no)));
    const more = el("details", { class: "more" }, el("summary", {}, "Fiscal impact, supporters & opponents"));
    more.append(el("p", {}, el("strong", {}, "Fiscal impact: "), m.fiscal), el("p", {}, el("strong", {}, "Supporters: "), m.supporters), el("p", {}, el("strong", {}, "Opponents: "), m.opponents));
    frag.append(more);
    return frag;
  }

  for (const section of sections) {
    const sec = el("section", { class: "ballot-section", id: section.id });
    sec.append(el("h2", {}, section.title), el("p", { class: "section-blurb" }, section.blurb));
    let lastJur = null;
    for (const m of section.measures) {
      if (section.id === "local" && m.jurisdiction !== lastJur) {
        lastJur = m.jurisdiction;
        sec.append(el("h3", { class: "jur-heading", "data-jur": m.jurisdiction }, m.jurisdiction));
      }
      const card = tpl.content.firstElementChild.cloneNode(true);
      card.id = m.id;
      card.dataset.jur = m.jurisdiction;
      $(".badge", card).textContent = m.label;
      $(".jur", card).textContent = m.jurisdiction;
      $(".card-title", card).textContent = m.title;
      $(".type", card).textContent = m.type;
      $(".threshold", card).textContent = m.threshold;
      $(".official-text", card).textContent = m.official;
      const extra = renderExtra(m);
      if (extra) $(".extra", card).append(extra);
      $(".plain-text", card).textContent = m.plain;
      const toggle = $(".official-toggle", card);
      toggle.textContent = m.yes ? "Official text, what Yes/No means, fiscal impact" : "Official ballot question";
      toggle.addEventListener("click", () => {
        const open = card.classList.toggle("show-official");
        toggle.setAttribute("aria-expanded", String(open));
      });
      $(".vote-group", card).setAttribute("aria-label", `Your vote on ${m.label}`);

      for (const btn of $$(".vote", card)) {
        btn.addEventListener("click", () => {
          const v = btn.dataset.vote;
          if (state.votes[m.id] === v) delete state.votes[m.id];
          else state.votes[m.id] = v;
          save();
          update();
        });
      }
      const ta = $("textarea", card);
      ta.value = state.notes[m.id] || "";
      if (ta.value) $(".note", card).open = true;
      ta.addEventListener("input", () => {
        if (ta.value.trim()) state.notes[m.id] = ta.value;
        else delete state.notes[m.id];
        save();
      });

      cards.set(m.id, card);
      sec.append(card);
    }
    sectionsRoot.append(sec);
  }

  // ---- jump nav ----
  const jump = $("#jump .jump-inner");
  const jumpLinks = new Map();
  for (const m of allMeasures) {
    const short = m.label.replace(/^Prop /, "").replace(/^Measure /, "");
    const a = el("a", { href: `#${m.id}`, title: `${m.label}: ${m.title}` }, short);
    jumpLinks.set(m.id, a);
    jump.append(a);
  }

  // On narrow screens the jump strip scrolls sideways; keep the measure in view highlighted.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        for (const a of jumpLinks.values()) a.classList.remove("current");
        const link = jumpLinks.get(e.target.id);
        link.classList.add("current");
        if (jump.scrollWidth > jump.clientWidth) {
          jump.scrollTo({ left: link.offsetLeft - jump.clientWidth / 2 + link.offsetWidth / 2, behavior: "smooth" });
        }
      }
    },
    { rootMargin: "-30% 0px -60% 0px" },
  );
  for (const card of cards.values()) observer.observe(card);

  // ---- areas filter ----
  const areasBtn = $("#areas-btn");
  const areasPanel = $("#areas-panel");
  const areasList = $("#areas-list");
  for (const j of localJurisdictions) {
    const id = "area-" + j.replace(/\W+/g, "-").toLowerCase();
    const input = el("input", { type: "checkbox", id, value: j });
    input.checked = state.areas.includes(j);
    input.addEventListener("change", () => {
      state.areas = $$("input", areasList)
        .filter((i) => i.checked)
        .map((i) => i.value);
      save();
      update();
    });
    areasList.append(el("label", { class: "chip", for: id }, input, j));
  }
  areasBtn.addEventListener("click", () => {
    areasPanel.hidden = !areasPanel.hidden;
    areasBtn.setAttribute("aria-expanded", String(!areasPanel.hidden));
  });
  $("#areas-done").addEventListener("click", () => {
    areasPanel.hidden = true;
    areasBtn.setAttribute("aria-expanded", "false");
  });
  $("#areas-clear").addEventListener("click", () => {
    state.areas = [];
    $$("input", areasList).forEach((i) => (i.checked = false));
    save();
    update();
  });

  // ---- status filter ----
  for (const b of $$(".seg button")) {
    b.addEventListener("click", () => {
      state.status = b.dataset.status;
      save();
      update();
    });
  }

  // ---- update view ----
  function update() {
    const visible = allMeasures.filter(inMyAreas);
    let decided = 0;

    for (const m of allMeasures) {
      const card = cards.get(m.id);
      const vote = state.votes[m.id];
      card.dataset.vote = vote || "";
      for (const btn of $$(".vote", card)) btn.setAttribute("aria-checked", String(btn.dataset.vote === vote));

      const areaOk = inMyAreas(m);
      if (areaOk && vote) decided++;
      const statusOk = state.status === "all" || (state.status === "decided" ? Boolean(vote) : !vote);
      card.hidden = !(areaOk && statusOk);

      const link = jumpLinks.get(m.id);
      link.hidden = !areaOk;
      link.dataset.vote = vote || "";
    }

    // hide jurisdiction headings with no visible cards
    for (const h of $$(".jur-heading")) {
      h.hidden = !$$(`.card[data-jur="${CSS.escape(h.dataset.jur)}"]`).some((c) => !c.hidden);
    }
    for (const sec of $$(".ballot-section")) {
      sec.hidden = !$$(".card", sec).some((c) => !c.hidden);
    }

    for (const n of $$(".progress-count")) n.textContent = decided;
    for (const n of $$(".progress-total")) n.textContent = visible.length;
    for (const n of $$(".progress-fill")) n.style.width = visible.length ? `${(decided / visible.length) * 100}%` : "0";
    $("#areas-label").textContent = state.areas.length === 0 ? "All" : `${state.areas.length} selected`;
    for (const b of $$(".seg button")) b.classList.toggle("active", b.dataset.status === state.status);
  }

  // ---- summary dialog ----
  const dialog = $("#summary-dialog");
  function summaryRows() {
    return allMeasures.filter(inMyAreas).map((m) => ({ m, vote: state.votes[m.id], note: state.notes[m.id] }));
  }
  function renderSummary() {
    const body = $("#summary-body");
    body.replaceChildren();
    const table = el("table", { class: "summary" });
    for (const { m, vote, note } of summaryRows()) {
      const tr = el("tr", { "data-vote": vote || "" }, el("th", {}, m.label), el("td", { class: "s-title" }, m.title, note ? el("div", { class: "s-note" }, note) : null), el("td", { class: "s-vote" }, vote ? VOTE_LABELS[vote] : "—"));
      tr.addEventListener("click", () => {
        dialog.close();
        cards.get(m.id).scrollIntoView({ behavior: "smooth", block: "start" });
      });
      table.append(tr);
    }
    body.append(table);
  }
  for (const b of $$(".summary-btn")) {
    b.addEventListener("click", () => {
      renderSummary();
      dialog.showModal();
    });
  }
  $("#summary-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  $("#copy-btn").addEventListener("click", async () => {
    const lines = ["My picks: Santa Clara County, Nov 3 2026", ""];
    for (const { m, vote, note } of summaryRows()) {
      lines.push(`${m.label} (${m.title}): ${vote ? (vote === "skip" ? "leave blank" : VOTE_LABELS[vote]) : "undecided"}${note ? ` (${note})` : ""}`);
    }
    const btn = $("#copy-btn");
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      btn.textContent = "Copied!";
    } catch {
      btn.textContent = "Copy failed";
    }
    setTimeout(() => (btn.textContent = "Copy as text"), 1500);
  });
  $("#print-btn").addEventListener("click", () => {
    document.body.classList.add("print-summary");
    window.print();
    document.body.classList.remove("print-summary");
  });

  // ---- reset ----
  $("#reset-btn").addEventListener("click", () => {
    if (!confirm("Clear all your picks and notes in this browser?")) return;
    state.votes = {};
    state.notes = {};
    save();
    $$("textarea").forEach((t) => (t.value = ""));
    update();
  });

  // keep multiple tabs in sync
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    Object.assign(state, load());
    for (const m of allMeasures) $("textarea", cards.get(m.id)).value = state.notes[m.id] || "";
    $$("input", areasList).forEach((i) => (i.checked = state.areas.includes(i.value)));
    update();
  });

  update();
})();
