/* Home-Brace — shared chrome + interactivity.
   Header, nav and footer are injected here so navigation stays identical on
   every page (Design Rule: "Keep navigation consistent across the site"). */

const ICONS = {
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  office:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/><path d="M9 9v.01M9 12v.01M9 15v.01"/></svg>',
  hr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>',
  forms:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  ops:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M8 9l2 2 4-4M8 16h8"/></svg>',
  chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  people:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20v-1a4.5 4.5 0 0 0-3-4.2"/></svg>',
  lead:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18l3-9 4 4 3-7 4 6 4-3v9z"/></svg>',
  it:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  announce:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
  menu:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  arrow:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
};

// The public demo uses fictional brands and locations throughout.
// name, so the chrome carries no practice name at all.
const PRACTICE = "";

function buildHeader() {
  const active = document.body.dataset.page || "";
  const navItems = [
    {label:"Home", href:"index.html", key:"home"},
    ...MODULES.map(m => ({label:m.label, href:m.href, key:m.key})),
  ];
  const nav = navItems.map(n =>
    `<a href="${n.href}" class="${n.key===active?'active':''}">${n.label}</a>`).join("");

  const hdr = `
  <div class="demo-ribbon"><span>INTERACTIVE PORTFOLIO DEMO</span><span>Fictional data</span><span>No login required</span></div>
  <header class="site-header">
    <div class="hdr-inner">
      <a class="brand" href="index.html">
        <span class="mark" aria-label="Home-Brace"><img src="assets/logo-mark.png" alt="" width="34" height="34"></span>
        <span>Home-<i>Brace</i>${PRACTICE ? `<span class="sub">${PRACTICE}</span>` : ""}</span>
      </a>
      <div class="hdr-search" onclick="openSearch()">
        <input type="text" placeholder="Search PTO, expense, handbook, vendor…" readonly>
        <span class="s-icon">${ICONS.search}</span>
      </div>
      <button class="demo-launcher" type="button" onclick="toggleDemoGuide(true)">Explore demo</button>
      <div class="hdr-spacer"></div>
      <button class="menu-toggle" aria-label="Menu" onclick="toggleNav()">${ICONS.menu}</button>
    </div>
    <nav class="nav" id="primaryNav"><div class="nav-inner">${nav}</div></nav>
  </header>`;

  const slot = document.getElementById("hdr");
  if (slot) slot.outerHTML = hdr;
}

function buildFooter() {
  const ftr = `
  <footer class="site-footer">
    <div class="ftr-inner">
      <div>© 2026 Home-Brace <span style="opacity:.6">(prototype)</span></div>
      <div><a href="index.html">Home</a> · <a href="it.html">IT Help</a> · <a href="directory.html">Directory</a></div>
    </div>
  </footer>`;
  const slot = document.getElementById("ftr");
  if (slot) slot.outerHTML = ftr;
}

function buildDemoGuide() {
  const guide = document.createElement("aside");
  guide.id = "demoGuide";
  guide.className = "demo-guide";
  guide.setAttribute("aria-hidden", "true");
  guide.innerHTML = `
    <button class="demo-guide__scrim" type="button" aria-label="Close demo guide" onclick="toggleDemoGuide(false)"></button>
    <div class="demo-guide__panel" role="dialog" aria-modal="true" aria-labelledby="demoGuideTitle">
      <div class="demo-guide__top">
        <span class="demo-guide__eyebrow">Product walkthrough</span>
        <button type="button" aria-label="Close demo guide" onclick="toggleDemoGuide(false)">×</button>
      </div>
      <h2 id="demoGuideTitle">See how Home-Brace works</h2>
      <p>This demo uses fictional people and operational data. Pick a workflow and try it yourself.</p>
      <div class="demo-guide__links">
        <button type="button" onclick="toggleDemoGuide(false); runSearch('vacation')"><span>01</span><b>Search in plain language</b><small>“Vacation” finds the PTO policy.</small></button>
        <a href="forms.html"><span>02</span><b>Submit a sample request</b><small>Open PTO, expense, IT, or maintenance forms.</small></a>
        <a href="calendars.html"><span>03</span><b>Coordinate eight locations</b><small>Filter the weekly doctor and office schedule.</small></a>
        <a href="scorecards.html"><span>04</span><b>Explore operating performance</b><small>Compare KPIs and location-level signals.</small></a>
      </div>
      <div class="demo-guide__note"><strong>What this demonstrates</strong><span>Product strategy, information architecture, responsive UX, workflow automation, and operational analytics.</span></div>
    </div>`;
  document.body.appendChild(guide);
}

function toggleDemoGuide(open) {
  const guide = document.getElementById("demoGuide");
  if (!guide) return;
  guide.classList.toggle("open", !!open);
  guide.setAttribute("aria-hidden", open ? "false" : "true");
  document.body.classList.toggle("guide-open", !!open);
}

function toggleNav() { document.getElementById("primaryNav").classList.toggle("open"); }

/* ---- Home tiles ---- */
function buildHomeTiles() {
  const grid = document.getElementById("moduleTiles");
  if (!grid) return;
  grid.innerHTML = MODULES.map(m => `
    <a class="tile" href="${m.href}">
      ${m.locked ? '<span class="lock">🔒 Leadership</span>' : ''}
      <div class="ic">${ICONS[m.icon]||''}</div>
      <h3>${m.label}</h3>
      <p>${m.desc}</p>
    </a>`).join("");
}

/* ---- Search overlay ---- */
function openSearch() {
  document.getElementById("searchOverlay").classList.add("open");
  const i = document.getElementById("searchInput");
  i.value = ""; i.focus(); renderSearch("");
}
function closeSearch() { document.getElementById("searchOverlay").classList.remove("open"); }
function runSearch(term) {
  if (term) { openSearch(); document.getElementById("searchInput").value = term; renderSearch(term); }
}
function renderSearch(q) {
  const box = document.getElementById("searchResults");
  q = (q||"").trim().toLowerCase();
  let list = RESOURCES;
  if (q) {
    list = RESOURCES.filter(r =>
      r.t.toLowerCase().includes(q) ||
      r.d.toLowerCase().includes(q) ||
      r.sec.toLowerCase().includes(q) ||
      (r.syn||[]).some(s => s.includes(q) || q.includes(s)));
  }
  if (!list.length) {
    box.innerHTML = `<div class="sp-empty">No matches for “${q}”. Try <b>PTO</b>, <b>expense</b>, or <b>vendor</b>.</div>`;
    return;
  }
  box.innerHTML = list.slice(0,12).map(r => `
    <a href="${r.href}">
      <span class="r-ic">${ICONS.forms}</span>
      <span><span class="r-t">${r.t}</span><br><span class="r-d">${r.d}</span></span>
      <span class="r-sec">${r.sec}</span>
    </a>`).join("");
}

/* ---- Directory filter ---- */
function buildDirectory() {
  const body = document.getElementById("dirBody");
  if (!body) return;
  const render = (rows) => {
    body.innerHTML = rows.map(p => `
      <tr><td data-label="Name"><strong>${p[0]}</strong></td><td data-label="Title">${p[1]}</td><td data-label="Office">${p[2]}</td>
      <td data-label="Phone"><a href="tel:${p[3].replace(/[^0-9]/g,'')}">${p[3]}</a></td><td data-label="Email"><a href="mailto:${p[4]}">${p[4]}</a></td><td data-label="Department">${p[5]}</td></tr>`).join("")
      || `<tr><td colspan="6" style="text-align:center;color:#56627a;padding:22px">No matches.</td></tr>`;
  };
  render(PEOPLE);
  const q = document.getElementById("dirSearch");
  const off = document.getElementById("dirOffice");
  const apply = () => {
    const t = (q.value||"").toLowerCase();
    const o = off.value;
    render(PEOPLE.filter(p =>
      (o==="All" || p[2]===o || p[2]==="All Offices") &&
      (!t || p.join(" ").toLowerCase().includes(t))));
  };
  q.addEventListener("input", apply);
  off.addEventListener("change", apply);
  const offices = [...new Set(PEOPLE.map(p=>p[2]).filter(x=>x!=="All Offices"))].sort();
  off.innerHTML = `<option value="All">All offices</option>` + offices.map(o=>`<option>${o}</option>`).join("");
}

/* ---- Weekly office/doctor board ---- */
function buildSchedule() {
  const board = document.getElementById("schedBoard");
  if (!board || typeof SCHEDULE === "undefined") return;
  const offices = Object.keys(SCHEDULE);
  const doctors = [...new Set(Object.values(SCHEDULE).flat().filter(Boolean).map(c => c.dr))].sort();

  // today highlight: JS getDay 0=Sun..6=Sat -> Mon..Sat index 0..5
  const gd = new Date().getDay();
  const todayIdx = gd === 0 ? -1 : gd - 1; // Sun = none

  const head = `<tr><th class="off-col">Office</th>${SCHED_DAYS.map((d,i)=>
    `<th class="${i===todayIdx?'is-today':''}">${d}${i===todayIdx?' · Today':''}</th>`).join("")}</tr>`;
  const rows = offices.map(off => {
    const cells = SCHEDULE[off].map((c,i) => {
      const today = i===todayIdx ? ' is-today' : '';
      if (!c) return `<td class="cell closed${today}" data-dr="" data-off="${off}"><span class="x-closed">Closed</span></td>`;
      return `<td class="cell open${today}" data-dr="${c.dr}" data-off="${off}">
        <span class="c-dr">${c.dr}</span><span class="c-hrs">${c.hrs}</span></td>`;
    }).join("");
    return `<tr data-row-off="${off}"><th class="off-col">${off}</th>${cells}</tr>`;
  }).join("");
  board.innerHTML = `<table class="sched"><thead>${head}</thead><tbody>${rows}</tbody></table>`;

  // Today summary
  const sum = document.getElementById("schedToday");
  if (sum) {
    if (todayIdx === -1) {
      sum.innerHTML = `<b>It's the weekend.</b> Most offices are closed Sunday — here's the week at a glance.`;
    } else {
      const open = offices.filter(o => SCHEDULE[o][todayIdx]).map(o => `${o} (${SCHEDULE[o][todayIdx].dr})`);
      sum.innerHTML = open.length
        ? `<b>Open today (${SCHED_DAYS[todayIdx]}):</b> ${open.join(" · ")}`
        : `<b>All offices closed today.</b> Here's the week ahead.`;
    }
  }

  // Filters
  const docSel = document.getElementById("schedDoctor");
  const offSel = document.getElementById("schedOffice");
  if (docSel) docSel.innerHTML = `<option value="">Highlight a doctor…</option>` + doctors.map(d=>`<option>${d}</option>`).join("");
  if (offSel) offSel.innerHTML = `<option value="">Highlight an office…</option>` + offices.map(o=>`<option>${o}</option>`).join("");
  const apply = () => {
    const dr = docSel ? docSel.value : "";
    const off = offSel ? offSel.value : "";
    const filtering = dr || off;
    board.classList.toggle("filtering", !!filtering);
    board.querySelectorAll("td.cell").forEach(td => {
      const matchDr = !dr || td.getAttribute("data-dr") === dr;
      const matchOff = !off || td.getAttribute("data-off") === off;
      td.classList.toggle("dim", filtering && !(matchDr && matchOff && td.classList.contains("open")));
      td.classList.toggle("hit", filtering && matchDr && matchOff && td.classList.contains("open"));
    });
  };
  if (docSel) docSel.addEventListener("change", () => { if (docSel.value && offSel) offSel.value=""; apply(); });
  if (offSel) offSel.addEventListener("change", () => { if (offSel.value && docSel) docSel.value=""; apply(); });
}

function buildSearchOverlay() {
  const el = document.createElement("div");
  el.id = "searchOverlay";
  el.className = "search-overlay";
  el.innerHTML = `
    <div class="search-panel">
      <div class="sp-top">
        <span style="color:#56627a">${ICONS.search}</span>
        <input id="searchInput" type="text" placeholder="Search the hub — try “vacation”, “expense”, “handbook”…" autocomplete="off">
        <span class="esc">Esc</span>
      </div>
      <div class="sp-results" id="searchResults"></div>
      <div class="sp-hint">Tip: search works even if you don't know the exact name — typing <b>vacation</b> finds the <b>PTO Policy</b>.</div>
    </div>`;
  document.body.appendChild(el);
}

/* ---- Document / Form modal ---- */
const FILE_LABEL = { pdf:"PDF", doc:"DOC", xls:"XLS", vid:"VID", lnk:"LNK" };
let modalEl;
function buildModal() {
  modalEl = document.createElement("div");
  modalEl.id = "modal";
  modalEl.className = "modal-overlay";
  modalEl.innerHTML = `<div class="modal" id="modalCard"></div>`;
  document.body.appendChild(modalEl);
  modalEl.addEventListener("click", e => { if (e.target === modalEl) closeModal(); });
}
function closeModal() { if (modalEl) modalEl.classList.remove("open"); }

function openDoc(key) {
  const d = DOCS[key];
  if (!d) return;
  const fileType = (d.fi||"lnk");
  document.getElementById("modalCard").innerHTML = `
    <div class="modal-top">
      <span class="fi ${fileType}">${FILE_LABEL[fileType]||"DOC"}</span>
      <div>
        <h2>${d.t} ${d.locked?'<span class="badge lock">🔒 Restricted</span>':''}</h2>
        <div class="m-meta">${d.sec} · ${d.type} · ${d.updated}</div>
      </div>
      <button class="x" aria-label="Close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-toolbar">
      <button class="tbtn">⬇ Download</button>
      <button class="tbtn">🖨 Print</button>
      <button class="tbtn">🔗 Share</button>
      <button class="tbtn">★ Follow</button>
    </div>
    <div class="modal-body"><div class="doc-paper">${d.body}</div></div>
    <div class="modal-note">📄 <b>Prototype preview.</b> In the real Home-Brace this opens the actual file in Microsoft 365 — viewable and editable right in your browser or phone.</div>`;
  modalEl.classList.add("open");
}

function openForm(key) {
  const f = FORMS[key];
  if (!f) return;
  const fields = f.fields.map((fld,i) => {
    const req = fld.req ? ' <span class="req">*</span>' : '';
    const id = `f_${key}_${i}`;
    let input;
    if (fld.type === "textarea") input = `<textarea id="${id}"></textarea>`;
    else if (fld.type === "select") input = `<select id="${id}"><option value="" disabled selected>Choose…</option>${fld.opts.map(o=>`<option>${o}</option>`).join("")}</select>`;
    else if (fld.type === "file") input = `<input id="${id}" type="file">`;
    else if (fld.type === "date") input = `<input id="${id}" type="date">`;
    else input = `<input id="${id}" type="text">`;
    return `<div class="fld"><label>${fld.l}${req}</label>${input}</div>`;
  }).join("");
  document.getElementById("modalCard").innerHTML = `
    <div class="form-accent"></div>
    <div class="modal-top">
      <div>
        <h2>${f.t}</h2>
        <div class="m-meta">Microsoft Forms · ~1 minute · routes to ${f.routesTo}</div>
      </div>
      <button class="x" aria-label="Close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" id="formBody">${fields}</div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="submitForm('${key}')">Submit</button>
    </div>`;
  modalEl.classList.add("open");
}

function submitForm(key) {
  const f = FORMS[key];
  document.getElementById("formBody").innerHTML = `
    <div class="form-success">
      <div class="check"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>
      <h3>Thanks — your request was submitted!</h3>
      <p>In the real build this is saved and sent to <b>${f.routesTo}</b>, who can track and respond. You'd get a confirmation on your phone.</p>
    </div>`;
  const foot = document.querySelector("#modal .modal-foot");
  if (foot) foot.innerHTML = `<button class="btn" onclick="closeModal()">Done</button>`;
}

/* ---- Interactive scorecard demo ---- */
const SCORECARD_DATA = {
  all:       { name:"All locations", production:842, collections:791, conversion:68, starts:214, changes:[6.2,4.1,-2.0,11], spark:[[42,52,48,64,70,88],[45,50,56,60,69,82],[76,72,73,70,69,68],[43,49,55,61,70,84]] },
  cedar:     { name:"Cedar Grove", production:228, collections:219, conversion:74, starts:62, changes:[8.4,7.1,3.0,7], spark:[[35,48,44,61,72,92],[39,46,53,63,74,89],[62,65,68,69,72,78],[35,42,54,63,74,90]] },
  lakeview:  { name:"Lakeview", production:196, collections:181, conversion:65, starts:48, changes:[3.2,1.8,-4.0,-2], spark:[[50,54,58,60,64,70],[53,55,58,62,64,68],[75,72,70,68,66,64],[62,58,61,56,54,50]] },
  northpoint:{ name:"Northpoint", production:212, collections:199, conversion:69, starts:55, changes:[5.7,4.6,1.0,4], spark:[[42,47,55,57,68,82],[44,50,52,61,66,79],[63,65,66,68,67,72],[43,48,53,60,69,78]] },
  westfield: { name:"Westfield", production:206, collections:192, conversion:64, starts:49, changes:[4.9,3.5,-3.0,2], spark:[[48,52,56,63,66,76],[45,50,58,60,65,73],[73,71,69,67,65,63],[46,50,55,57,60,67]] }
};

function buildScorecards() {
  const office = document.getElementById("scoreOffice");
  if (!office) return;
  const reset = document.getElementById("scoreReset");
  const bars = document.getElementById("officeBars");
  const insights = document.getElementById("scoreInsights");
  const offices = ["cedar", "lakeview", "northpoint", "westfield"];

  const renderBars = selected => {
    bars.innerHTML = offices.map(key => {
      const row = SCORECARD_DATA[key];
      const pct = Math.min(100, Math.round(row.production / 230 * 100));
      const isSelected = selected === key;
      return `<button class="office-bar${isSelected ? " active" : ""}" type="button" data-office="${key}">
        <span class="office-bar__name">${row.name}<small>${row.conversion}% conversion</small></span>
        <span class="office-bar__track"><span style="width:${pct}%"></span><i style="left:91%"></i></span>
        <strong>$${row.production}k</strong>
      </button>`;
    }).join("");
    bars.querySelectorAll("[data-office]").forEach(button => button.addEventListener("click", () => { office.value = button.dataset.office; render(button.dataset.office); }));
  };

  const render = key => {
    const row = SCORECARD_DATA[key];
    const values = { production:`$${row.production}k`, collections:`$${row.collections}k`, conversion:`${row.conversion}%`, starts:String(row.starts) };
    ["production","collections","conversion","starts"].forEach((metric, index) => {
      document.querySelector(`[data-score="${metric}"]`).textContent = values[metric];
      const delta = document.querySelector(`[data-delta="${metric}"]`);
      const change = row.changes[index];
      delta.className = "delta " + (change >= 0 ? "up" : "down");
      delta.textContent = `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}${metric === "starts" ? "" : "%"} vs last month`;
      const spark = document.querySelector(`[data-spark="${metric}"]`);
      spark.innerHTML = row.spark[index].map((height, i) => `<span class="${i === row.spark[index].length - 1 ? "hi" : ""}" style="height:${height}%"></span>`).join("");
    });
    const signals = key === "all"
      ? [
          ["good", "Cedar Grove leads conversion at 74%", "Use its consultation follow-up as the peer benchmark."],
          ["watch", "Lakeview conversion is down 4 points", "Review no-show and unscheduled follow-up queues."],
          ["info", "Collections remain at 94% of production", "The practice is inside the operating target range."]
        ]
      : [
          [row.changes[0] >= 5 ? "good" : "info", `${row.name} production is ${row.changes[0] >= 0 ? "up" : "down"} ${Math.abs(row.changes[0])}%`, "Compare staffing, scheduling, and start volume before the manager review."],
          [row.conversion >= 70 ? "good" : "watch", `Conversion is ${row.conversion}%`, row.conversion >= 70 ? "Performance is above the 70% operating threshold." : "This is below the 70% operating threshold and needs follow-up."],
          ["info", `${row.starts} new starts this month`, "Open the source scorecard below for the supporting detail."]
        ];
    insights.innerHTML = signals.map(signal => `<div class="score-signal score-signal--${signal[0]}"><i></i><span><strong>${signal[1]}</strong><small>${signal[2]}</small></span></div>`).join("");
    renderBars(key);
  };

  office.addEventListener("change", () => render(office.value));
  reset.addEventListener("click", () => { office.value = "all"; render("all"); });
  render("all");
}

/* Open any [data-doc] / [data-form] element */
function handleDelegatedClick(e) {
  const docEl = e.target.closest("[data-doc]");
  if (docEl) { e.preventDefault(); openDoc(docEl.getAttribute("data-doc")); return; }
  const formEl = e.target.closest("[data-form]");
  if (formEl) { e.preventDefault(); openForm(formEl.getAttribute("data-form")); return; }
}

document.addEventListener("DOMContentLoaded", () => {
  buildHeader(); buildFooter(); buildDemoGuide(); buildSearchOverlay(); buildModal(); buildHomeTiles(); buildDirectory(); buildSchedule(); buildScorecards();
  document.addEventListener("click", handleDelegatedClick);
  const si = document.getElementById("searchInput");
  if (si) si.addEventListener("input", e => renderSearch(e.target.value));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeSearch(); closeModal(); toggleDemoGuide(false); }
    if ((e.metaKey||e.ctrlKey) && e.key === "k") { e.preventDefault(); openSearch(); }
  });
  const ov = document.getElementById("searchOverlay");
  if (ov) ov.addEventListener("click", e => { if (e.target===ov) closeSearch(); });
});
