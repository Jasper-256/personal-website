import { BALLOT, type BallotSection, type Measure, type StateMeasure } from "@/scripts/ballot-2026-data";

type Vote = "yes" | "no" | "skip";
type StatusFilter = "all" | "undecided" | "decided";
type BallotMeasure = Measure & { section: BallotSection["id"] };

interface State {
  votes: Record<string, Vote>;
  notes: Record<string, string>;
  areas: string[];
  status: StatusFilter;
}

interface CardRefs {
  card: HTMLElement;
  voteButtons: HTMLButtonElement[];
  textarea: HTMLTextAreaElement;
  jumpLink: HTMLAnchorElement;
}

const STORAGE_KEY = "scc-ballot-2026:v1";
const VOTES: readonly Vote[] = ["yes", "no", "skip"];
const STATUSES: readonly StatusFilter[] = ["all", "undecided", "decided"];
const VOTE_LABELS: Record<Vote, string> = { yes: "Yes", no: "No", skip: "Skip" };

const allMeasures: BallotMeasure[] = BALLOT.sections.flatMap((s) => s.measures.map((m) => ({ ...m, section: s.id })));
const localJurisdictions = [...new Set(allMeasures.filter((m) => m.section === "local").map((m) => m.jurisdiction))];

// ---- helpers ----
function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  return root.querySelector<T>(selector)!;
}

function $$<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return [...root.querySelectorAll<T>(selector)];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function isStateMeasure(m: Measure): m is StateMeasure {
  return "yes" in m;
}

function isVote(v: unknown): v is Vote {
  return VOTES.includes(v as Vote);
}

// ---- persistence ----
function load(): State {
  const fallback: State = { votes: {}, notes: {}, areas: [], status: "all" };
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return fallback;
  }
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Partial<Record<keyof State, unknown>>;

  const votes: State["votes"] = {};
  if (r.votes && typeof r.votes === "object") {
    for (const [id, v] of Object.entries(r.votes)) if (isVote(v)) votes[id] = v;
  }
  const notes: State["notes"] = {};
  if (r.notes && typeof r.notes === "object") {
    for (const [id, n] of Object.entries(r.notes)) if (typeof n === "string") notes[id] = n;
  }
  const areas = Array.isArray(r.areas) ? r.areas.filter((a): a is string => typeof a === "string") : [];
  const status = STATUSES.includes(r.status as StatusFilter) ? (r.status as StatusFilter) : "all";
  return { votes, notes, areas, status };
}

const state = load();

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode, quota); picks just won't persist.
  }
}

function inMyAreas(m: BallotMeasure): boolean {
  return m.section !== "local" || state.areas.length === 0 || state.areas.includes(m.jurisdiction);
}

// ---- render cards ----
const template = $<HTMLTemplateElement>("#card-tpl");
const sectionsRoot = $("#sections");
const jump = $("#jump .jump-inner");
const refs = new Map<string, CardRefs>();

function renderExtra(m: StateMeasure): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.append(el("dl", { class: "yesno" }, el("dt", { class: "y" }, "A YES vote means"), el("dd", {}, m.yes), el("dt", { class: "n" }, "A NO vote means"), el("dd", {}, m.no)));
  const more = el("details", { class: "more" }, el("summary", {}, "Fiscal impact, supporters & opponents"));
  more.append(el("p", {}, el("strong", {}, "Fiscal impact: "), m.fiscal), el("p", {}, el("strong", {}, "Supporters: "), m.supporters), el("p", {}, el("strong", {}, "Opponents: "), m.opponents));
  frag.append(more);
  return frag;
}

function renderCard(m: BallotMeasure): HTMLElement {
  const card = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  card.id = m.id;
  card.dataset.jur = m.jurisdiction;
  $(".badge", card).textContent = m.label;
  $(".jur", card).textContent = m.jurisdiction;
  $(".card-title", card).textContent = m.title;
  $(".type", card).textContent = m.type;
  $(".threshold", card).textContent = m.threshold;
  $(".official-text", card).textContent = m.official;
  $(".plain-text", card).textContent = m.plain;
  if (isStateMeasure(m)) $(".extra", card).append(renderExtra(m));
  $(".vote-group", card).setAttribute("aria-label", `Your vote on ${m.label}`);

  const toggle = $<HTMLButtonElement>(".official-toggle", card);
  toggle.textContent = isStateMeasure(m) ? "Official text, what Yes/No means, fiscal impact" : "Official ballot question";
  toggle.addEventListener("click", () => {
    const open = card.classList.toggle("show-official");
    toggle.setAttribute("aria-expanded", String(open));
  });

  const voteButtons = $$<HTMLButtonElement>(".vote", card);
  for (const btn of voteButtons) {
    btn.addEventListener("click", () => {
      const v = btn.dataset.vote;
      if (!isVote(v)) return;
      // Tapping the current choice again clears it.
      if (state.votes[m.id] === v) delete state.votes[m.id];
      else state.votes[m.id] = v;
      save();
      update();
    });
  }

  const textarea = $<HTMLTextAreaElement>("textarea", card);
  textarea.value = state.notes[m.id] ?? "";
  if (textarea.value) $<HTMLDetailsElement>(".note", card).open = true;
  textarea.addEventListener("input", () => {
    if (textarea.value.trim()) state.notes[m.id] = textarea.value;
    else delete state.notes[m.id];
    save();
  });

  const short = m.label.replace(/^(Prop|Measure) /, "");
  const jumpLink = el("a", { href: `#${m.id}`, title: `${m.label}: ${m.title}` }, short);
  jump.append(jumpLink);

  refs.set(m.id, { card, voteButtons, textarea, jumpLink });
  return card;
}

for (const section of BALLOT.sections) {
  const sec = el("section", { class: "ballot-section", id: section.id });
  sec.append(el("h2", {}, section.title), el("p", { class: "section-blurb" }, section.blurb));
  let lastJurisdiction: string | null = null;
  for (const m of allMeasures.filter((x) => x.section === section.id)) {
    if (section.id === "local" && m.jurisdiction !== lastJurisdiction) {
      lastJurisdiction = m.jurisdiction;
      sec.append(el("h3", { class: "jur-heading", "data-jur": m.jurisdiction }, m.jurisdiction));
    }
    sec.append(renderCard(m));
  }
  sectionsRoot.append(sec);
}

// On narrow screens the jump strip scrolls sideways; keep the measure in view highlighted.
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const link = refs.get(entry.target.id)?.jumpLink;
      if (!link) continue;
      for (const r of refs.values()) r.jumpLink.classList.remove("current");
      link.classList.add("current");
      if (jump.scrollWidth > jump.clientWidth) {
        jump.scrollTo({ left: link.offsetLeft - jump.clientWidth / 2 + link.offsetWidth / 2, behavior: "smooth" });
      }
    }
  },
  { rootMargin: "-30% 0px -60% 0px" },
);
for (const r of refs.values()) observer.observe(r.card);

// ---- areas filter ----
const areasBtn = $<HTMLButtonElement>("#areas-btn");
const areasPanel = $("#areas-panel");
const areasList = $("#areas-list");

function areaInputs(): HTMLInputElement[] {
  return $$<HTMLInputElement>("input", areasList);
}

function setAreasPanelOpen(open: boolean): void {
  areasPanel.hidden = !open;
  areasBtn.setAttribute("aria-expanded", String(open));
}

for (const jurisdiction of localJurisdictions) {
  const id = "area-" + jurisdiction.replace(/\W+/g, "-").toLowerCase();
  const input = el("input", { type: "checkbox", id, value: jurisdiction });
  input.checked = state.areas.includes(jurisdiction);
  input.addEventListener("change", () => {
    state.areas = areaInputs()
      .filter((i) => i.checked)
      .map((i) => i.value);
    save();
    update();
  });
  areasList.append(el("label", { class: "chip", for: id }, input, jurisdiction));
}
areasBtn.addEventListener("click", () => setAreasPanelOpen(areasBtn.getAttribute("aria-expanded") !== "true"));
$("#areas-done").addEventListener("click", () => setAreasPanelOpen(false));
$("#areas-clear").addEventListener("click", () => {
  state.areas = [];
  for (const i of areaInputs()) i.checked = false;
  save();
  update();
});

// ---- status filter ----
const statusButtons = $$<HTMLButtonElement>(".seg button");
for (const b of statusButtons) {
  b.addEventListener("click", () => {
    const status = b.dataset.status as StatusFilter;
    if (!STATUSES.includes(status)) return;
    state.status = status;
    save();
    update();
  });
}

// ---- update view ----
function update(): void {
  let visibleCount = 0;
  let decided = 0;

  for (const m of allMeasures) {
    const { card, voteButtons, jumpLink } = refs.get(m.id)!;
    const vote = state.votes[m.id];
    card.dataset.vote = vote ?? "";
    for (const btn of voteButtons) btn.setAttribute("aria-checked", String(btn.dataset.vote === vote));

    const areaOk = inMyAreas(m);
    if (areaOk) visibleCount++;
    if (areaOk && vote) decided++;
    const statusOk = state.status === "all" || (state.status === "decided") === Boolean(vote);
    card.hidden = !(areaOk && statusOk);

    jumpLink.hidden = !areaOk;
    jumpLink.dataset.vote = vote ?? "";
  }

  // Hide jurisdiction headings and sections with no visible cards.
  for (const h of $$(".jur-heading")) {
    h.hidden = !$$(`.card[data-jur="${CSS.escape(h.dataset.jur ?? "")}"]`).some((c) => !c.hidden);
  }
  for (const sec of $$(".ballot-section")) {
    sec.hidden = !$$(".card", sec).some((c) => !c.hidden);
  }

  for (const n of $$(".progress-count")) n.textContent = String(decided);
  for (const n of $$(".progress-total")) n.textContent = String(visibleCount);
  for (const n of $$(".progress-fill")) n.style.width = visibleCount ? `${(decided / visibleCount) * 100}%` : "0";
  $("#areas-label").textContent = state.areas.length === 0 ? "All" : `${state.areas.length} selected`;
  for (const b of statusButtons) b.classList.toggle("active", b.dataset.status === state.status);
}

// ---- summary dialog ----
const dialog = $<HTMLDialogElement>("#summary-dialog");
const copyBtn = $<HTMLButtonElement>("#copy-btn");

function summaryRows(): { m: BallotMeasure; vote: Vote | undefined; note: string | undefined }[] {
  return allMeasures.filter(inMyAreas).map((m) => ({ m, vote: state.votes[m.id], note: state.notes[m.id] }));
}

function renderSummary(): void {
  const table = el("table", { class: "summary" });
  for (const { m, vote, note } of summaryRows()) {
    const tr = el("tr", { "data-vote": vote ?? "" }, el("th", {}, m.label), el("td", { class: "s-title" }, m.title, note ? el("div", { class: "s-note" }, note) : null), el("td", { class: "s-vote" }, vote ? VOTE_LABELS[vote] : "—"));
    tr.addEventListener("click", () => {
      dialog.close();
      refs.get(m.id)!.card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    table.append(tr);
  }
  $("#summary-body").replaceChildren(table);
}

for (const b of $$(".summary-btn")) {
  b.addEventListener("click", () => {
    renderSummary();
    dialog.showModal();
  });
}
$("#summary-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => {
  // Clicks on the backdrop target the dialog element itself.
  if (e.target === dialog) dialog.close();
});

copyBtn.addEventListener("click", async () => {
  const lines = ["My picks: Santa Clara County, Nov 3 2026", ""];
  for (const { m, vote, note } of summaryRows()) {
    const pick = vote ? (vote === "skip" ? "leave blank" : VOTE_LABELS[vote]) : "undecided";
    lines.push(`${m.label} (${m.title}): ${pick}${note ? ` (${note})` : ""}`);
  }
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    copyBtn.textContent = "Copied!";
  } catch {
    copyBtn.textContent = "Copy failed";
  }
  setTimeout(() => (copyBtn.textContent = "Copy as text"), 1500);
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
  for (const r of refs.values()) r.textarea.value = "";
  update();
});

// Keep multiple tabs in sync.
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY) return;
  Object.assign(state, load());
  for (const [id, r] of refs) r.textarea.value = state.notes[id] ?? "";
  for (const i of areaInputs()) i.checked = state.areas.includes(i.value);
  update();
});

update();
