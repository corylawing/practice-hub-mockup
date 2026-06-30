/* Practice Hub — shared chrome + interactivity.
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

const PRACTICE = "Summit Orthodontics";

function buildHeader() {
  const active = document.body.dataset.page || "";
  const navItems = [
    {label:"Home", href:"index.html", key:"home"},
    ...MODULES.map(m => ({label:m.label, href:m.href, key:m.key})),
  ];
  const nav = navItems.map(n =>
    `<a href="${n.href}" class="${n.key===active?'active':''}">${n.label}</a>`).join("");

  const hdr = `
  <div class="demo-ribbon">PROTOTYPE — sample content &amp; branding for discussion. Not a live system.</div>
  <header class="site-header">
    <div class="hdr-inner">
      <a class="brand" href="index.html">
        <span class="mark">PH</span>
        <span>Practice Hub<span class="sub">${PRACTICE}</span></span>
      </a>
      <div class="hdr-search" onclick="openSearch()">
        <input type="text" placeholder="Search PTO, expense, handbook, vendor…" readonly>
        <span class="s-icon">${ICONS.search}</span>
      </div>
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
      <div>© 2026 ${PRACTICE} · Practice Hub <span style="opacity:.6">(prototype)</span></div>
      <div><a href="index.html">Home</a> · <a href="it.html">IT Help</a> · <a href="directory.html">Directory</a></div>
    </div>
  </footer>`;
  const slot = document.getElementById("ftr");
  if (slot) slot.outerHTML = ftr;
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
    <div class="modal-note">📄 <b>Prototype preview.</b> In the real Practice Hub this opens the actual file in Microsoft 365 — viewable and editable right in your browser or phone.</div>`;
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

/* Open any [data-doc] / [data-form] element */
function handleDelegatedClick(e) {
  const docEl = e.target.closest("[data-doc]");
  if (docEl) { e.preventDefault(); openDoc(docEl.getAttribute("data-doc")); return; }
  const formEl = e.target.closest("[data-form]");
  if (formEl) { e.preventDefault(); openForm(formEl.getAttribute("data-form")); return; }
}

document.addEventListener("DOMContentLoaded", () => {
  buildHeader(); buildFooter(); buildSearchOverlay(); buildModal(); buildHomeTiles(); buildDirectory();
  document.addEventListener("click", handleDelegatedClick);
  const si = document.getElementById("searchInput");
  if (si) si.addEventListener("input", e => renderSearch(e.target.value));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeSearch(); closeModal(); }
    if ((e.metaKey||e.ctrlKey) && e.key === "k") { e.preventDefault(); openSearch(); }
  });
  const ov = document.getElementById("searchOverlay");
  if (ov) ov.addEventListener("click", e => { if (e.target===ov) closeSearch(); });
});
