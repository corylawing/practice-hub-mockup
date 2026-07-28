# Practice Hub — Project Guide (for Claude Code)

> Read this first. It's the full context for the **Practice Hub** project so any Claude
> session (including on mobile) can make updates without re-learning everything.
> Last major update: 2026-07-28.

---

## 1. What this is

**Practice Hub** is a **clickable mockup of a Microsoft 365 / SharePoint intranet** for a
growing **8-office orthodontic practice** (the "Farnsworth" group — brands FFO, Sunflower/SUN,
LCO/Legacy). Cory is building it to help a friend (the practice's COO) **validate the concept
before the real build**. It's a "digital front door" — one calm, simple place for staff to find
docs, schedules, KPIs, and marketing.

- **Repo:** this folder (`~/practice-hub-mockup`), pushed to `github.com/corylawing/practice-hub-mockup`.
- **Live:** https://corylawing.github.io/practice-hub-mockup/ (GitHub Pages, `main` branch, root).
- **Stack:** plain static HTML/CSS/JS. **No framework, no build step.** Preview via
  `.claude/launch.json` config named **`practice-hub`** on **port 8790**.
- **Real build target (later):** SharePoint communication site + Teams + Microsoft Forms +
  Lists, living *inside their own Microsoft tenant*. This mockup is the prototype/validation layer.

### Guiding principles (from the friend's design brief — obey these)
1. **Simplicity & adoption over features.** Non-technical staff must "get it" instantly.
2. **Practice leadership must self-maintain it** — no consultant needed. Everything admin-editable.
3. **Mobile-first.** Most staff are deskless (clinical).
4. **Reusable** as a framework for future practices.
5. **"User friendly is the most important."** Repeatedly stressed. When in doubt, fewer clicks,
   plainer words, sensible defaults over configuration.

---

## 2. Two site trees in ONE repo (important mental model)

- **Root (`/index.html`, `/calendars.html`, `/assets/…`)** = the *original first-draft concept*
  mockup. Shared chrome via `assets/app.js` + `assets/styles.css` + `assets/data.js`. Kept as
  reference. The older interactive schedule is here (`calendars.html`) but lacks the newer
  features (availability filter, tour, per-day hours/tz/lunch).
- **`/v1/`** = **THE REAL BUILD** — what they've decided to actually build. Multi-page, and each
  page is **fully self-contained** (inline CSS + JS + data; own `:root` tokens). Do NOT reference
  `../assets/*` from V1 pages — that broke styling in preview before. Keep V1 pages standalone.

**Always do new work in `/v1/`** unless explicitly asked to touch the root concept.

### V1 pages (all share a top nav: Dashboard · Schedule · Marketing · Admin)
| File | Purpose |
|---|---|
| `v1/home.html` | **Logged-in Home** — the daily landing page. "Viewing as ▾" role switcher, personalized section tiles, an "Updates for you" feed, Documents folders. Shows the admin-vs-employee difference. |
| `v1/team.html` | **Team** — the who's-who directory (photo, role, office, tap-to-call phone, tap-to-email). Replaced a fictional "Staff Directory" the practice never had; they liked the idea, so it was built for real. |
| `v1/documents.html` | **Documents section** — persona-aware folder browser (persona persists via `localStorage.ph_viewas`). Add-a-document flow with audience control (Everyone / locations / teams + "who will see this"). Click a file → live **two-way SharePoint/OneDrive sync** demo (edit in hub ↔ drive). |
| `v1/index.html` | **Production Dashboard** — location-scoped. Main **and** stretch goals, last-year bars, per-office pages + an all-office **leaderboard** with production days remaining. |
| `v1/production.html` | **Enter Production** — the few boxes a manager types each month; math shown live; writes back to the SharePoint workbook and **drives the dashboard** (localStorage `ph_prod`). |
| `v1/schedule.html` | **Staff Schedule** — weekly board: which office open each day + which doctor where. |
| `v1/marketing.html` | **Marketing Kanban** — events/social posts move Ideas→Planned→In progress→Done; scored Good/Mixed/Bad. |
| `v1/admin.html` | **Admin Console** — People, Teams & Access, Sections & Files. Backend permissions & profiles. |
| `v1/user.js` | **The signed-in person** — SINGLE source of truth for personas + permissions. Header avatar, **My Profile**, and the demo "sign in as" switcher. `PH.can(section)`, `PH.atLeast(section,lvl)`, `PH.offices()`, `PH.readOnlyBanner()`. Include on every page. |
| `v1/tour.js` | Shared **guided walkthrough** engine. Steps support `pre()` (switch a tab first) and `opts.next` **chains the tour across pages** so the COO can walk the whole app alone. |

---

## 3. Design system (V1 tokens — keep consistent)

```
--navy:#0F2A4A  --navy2:#25456e  --teal:#149B96  --teal2:#2BC0B8
--teal-soft:#E5F4F3  --teal-600:#0F827E
--ink:#1F2D3D  --soft/--ink-soft:#56627A  --line:#E4E8EE  --canvas:#F4F6F8
--good:#2E9E6B  --good-soft:#E7F4EE  --bad:#D7503A  --bad-soft:#FBEAE7
--amber:#F2A03D  --blue:#1f6f9e  --blue-soft:#E3F0FA
Font: Inter (Google Fonts). Radius ~14px. Soft shadows. maxw ~1080–1180px.
```
- Structure/nav = navy; primary actions/accents = teal; success/goal = green; miss = red;
  in-progress/attention = amber.
- Every V1 page has: an **amber "PROTOTYPE" ribbon**, navy header with `PH` mark + "V1 preview"
  pill, and the `.v1nav` tab bar (horizontal-scroll on mobile).
- Branding/social meta: `favicon.svg`, `assets/og-image.png`, OG tags on each page.

---

## 4. Page-by-page detail

### 4a. `v1/index.html` — Production Dashboard (rebuilt 2026-07-28 from their feedback sheet)
Their written feedback, all implemented:
0. **STARTS COMES FIRST.** They asked for starts shown "just like Production but put starts first".
   The page is now two stacked sections: **🦷 Starts** then **💰 Production**, and the leaderboard is
   **ranked by % of starts goal** with Starts %/± as its first two columns. Starts data is derived
   from their sheet: `sGoal` = "Needed Number of Starts per day" × "Number of Production Days (2026)",
   `sAct` = that goal + their "Current # of Starts Ahead or Behind Goal" row, counted over the same
   reported months as production. Reconciles with their own variance row per office.
1. **Main AND stretch goal** everywhere (KPI card shows % of main with % of stretch beneath; the chart
   draws a **dashed main-goal line** and a **dotted stretch line** per month).
2. **Last-year column** on the bar chart — each month is a grey **2025** bar next to the 2026 bar.
3. **Removed** the "5 of 8 offices are ahead of goal…" ribbon.
4. All-Offices page now **mimics an office page** (same KPI cards + same chart, group totals) with a
   **leaderboard** as the bottom section, **best performance on top** (sorted by % of main goal).
5. Leaderboard shows **production days remaining** ("Days left").
6. **Location-scoped access** (their later note): a persona only sees its own offices. One office →
   lands straight on that office, no All-Offices tab and no leaderboard. No dashboard access → a
   clear "this role doesn't have the Dashboard" panel.

**Data is REAL, from `2026 PRODUCTION DASHBOARD (New)-2.xlsx`** (parsed from the xlsx XML; openpyxl
is not installed). Per office: `act` (their *2026 Actual TC ONLY + Medicaid* row — this is the row
their goal comparison uses, NOT the adjusted-net row), `goal`, `stretch`, `ly` (2025 net + 2025
Medicaid), `days`, `done`.
- **Templates differ per office**: Medicaid offices (Carlsbad, Clovis, Hobbs, Cruces LCO) use
  "2026 Total Production Goal (TC + Medicaid)"; TC-only offices (Lubbock, San Angelo, Mansfield,
  Cruces FFO) use "2026 TC Production Goal". Match labels flexibly, never fixed row numbers.
- **A month only counts when it has BOTH an actual and a goal** (`live()`), because Mansfield has
  production from January but goals only from April. Get this wrong and Mansfield reads 154% instead
  of 92%. With this rule every office reconciles **exactly** with their own
  "Current Tracking (Over/Under) to Goal" row.
- **Second workbook error found (report to the practice):** the Dashboard tab's 2026 total shows
  **+$449,954** vs goal; the eight offices actually sum to **+$406,663** — the total formula **skips
  Mansfield** (−$43,935). Shown in the page footer. (Earlier, separate finding was +$580,749 vs
  +$500,762 on the older file.)

### 4b. `v1/schedule.html` — Staff Schedule
- Weekly board (locations × Mon–Sat), color per doctor. Week nav with **real dates**
  (`weekDates`/`dayLabel`/`weekMon`); today column highlighted.
- Data model (all in one IIFE, exposed as `window.PS`):
  - `people[{n,c}]` (c = color index; 8-color `PALETTE`), `locations[]`.
  - `sched{loc:[6 cells]}` — cell = `null` | `{p,h,s,e}` (person/hours/start/end) | `{closed:true}`.
  - `openH{loc:[6 per-day {s,e}|null]}` — office hours WITH times per day.
  - `locTZ{loc}` (NM=MT, TX=CT — **confirmed correct**, editable), `locLunch{loc:{s,e}}`.
  - Times stored as **minutes**. Conflict = time overlap (`s1<e2 && s2<e1`), guarded by `conflictAt`.
- **Wording (their feedback):** a cell marked as "no doctor on site" is a **“● Yellow Dot Day”**
  (`.cell.ydot`, pale yellow) — NOT "Closed". "Closed" is reserved for a day the office has no
  office hours at all. The button reads **“Mark Yellow Dot Day.”**
- **`Cruces Legacy` was renamed `Cruces FFO`** everywhere (their instruction; the workbook tab is
  already "Cruces (FFO)" although cell A1 still says CRUCES (LEGACY)).
- Features: **availability-only** doctor picker (booked doctors greyed "· at [office]"),
  completeness bar (`#schedStatus`, "X open days still need a doctor"), Closed / "Needs doctor"
  cells, **"Apply these hours & lunch to all locations"** (`applyAll`).
- Add/edit/remove **locations** (`locModal`/`renderDayRows`/`dtog`/`dtime`/`setTZ`/`setLunch`/
  `saveLoc`/`delLoc`) and **doctors** (`personModal`/`savePerson`/`delPerson`, color picker).
- Edit pencils: `.ledit` (locations) faintly visible (opacity .4), `.pedit` (doctors).
- Tour: `Tour.init([...6 steps], {key:'sched'})`. Step 4 targets `#roster` (doctors).
- Real build = **ONE Microsoft List** (Office, Day, Open/Closed, Doctor, Hours), NOT a
  calendar-per-office.

### 4c. `v1/marketing.html` — Marketing Kanban
- Columns (`STAGES`): 💡 Ideas → 🗓️ Planned → 🚀 In progress → ✅ Done.
- Card `TYPES`: social / event / promo / email / referral (colored left stripe `.t-*`).
- **Result** set only in Done: `good` 🟢 / `mixed` 🟡 / `bad` 🔴 (`.res` chip, click to cycle).
  Summary row totals Good/Mixed/Bad. Move by **drag-and-drop** between columns (HTML5 DnD, listeners
  delegated on the persistent `#board`, `dropTo(id,stage)`; dropping into Done auto-sets Good) **or** the
  ◀ ▶ arrows (`move(id,dir)`). Click card → edit modal (`open`/`save`/`del`), add via `add(stage)`.
  All state in `cards[]`, API `window.MK`.
- Tour: `Tour.init([...4 steps], {key:'mkt'})`. Real build = Microsoft Lists / Planner.

### 4d. `v1/admin.html` — Admin Console (the backend/permissions)
**TOOLS vs DOCUMENT SECTIONS (corrected 2026-07-28 — the user's mental model, get this right):**
- **`TOOLS`** = real app features: Dashboard (Goals Tracker), Schedule, Marketing board, Staff
  Directory, Admin. **Fixed** — admins can NOT add/remove them, they only choose *who gets them*.
  Marketing is a Kanban tool, **not** a document folder — never list it alongside HR/Vendors.
- **`DOCSECS`** = document sections living inside **Documents** (HR, Office Docs, Office Forms,
  Vendors, Insurance/W-9, End-of-Month, + any the admin creates). **Admins CREATE these freely**
  via `+ New section` (`newSec`/`renderSecModal`/`saveSec`, editable/deletable via `editSec`/`delSec`,
  `resetSecs` restores defaults). Each has: name, icon (`ICONS`), `structure`
  (`plain` | `byLocation` → auto folder per office | `byBrand` → auto folder per brand), plus its
  audience (`locMode`/`locs` + `teamMode`/`teams`).
- **Locations/brands are FOLDERS inside a section, never sections themselves.**
- Persisted to `localStorage.ph_docsecs` so **documents.html picks up admin-created sections live**
  (`customSecs`/`customCap`/`accessibleSections`) — create "Training" for Staff in Admin, switch the
  Documents persona to Front Desk, and it's there. New sections auto-appear as matrix columns
  (`allSections()` = TOOLS + DOCSECS) and get View for their audience teams (`applySecAudience`).

**THE PERMISSION MODEL (simplified 2026-07-28 — user found "Roles" confusing/redundant, so it was
REMOVED): one rule — a person's TEAM decides WHAT they can do; their LOCATION decides WHICH offices'
stuff they see.** No separate role objects. Levels: None / View / Add files / Edit / Manage
(5 levels, `LEVELS`/`rank`; "Add files" is its own level per the user). Example: Staff team = View,
so a staff member at Carlsbad = view-only + Carlsbad folders only.

**Four tabs** (`window.AD`): People · Teams & Access · Document Sections · **Locations**.
**Locations tab (added 2026-07-28):** the practice may expand, so admins add offices themselves —
name, brand, state, time zone (`LOCS`, `DEFAULT_LOCS`, persisted to `localStorage.ph_locations`;
`LOCATIONS_OF()` / `BRANDS_OF()` are the live lists). Adding an office immediately creates its
Office Docs folder, adds it to people's location chips, and (once numbers exist) the dashboard.
Never hardcode a location list again — always call `LOCATIONS_OF()`.

All client-side demo state:

1. **People** — table of users; each **syncs from Microsoft 365** (name/email/photo). Admin sets
   **team(s), location, status**. Click a row → **profile modal**:
   - Left panel "From Microsoft 365 (SYNCED)" — read-only dashed fields (First/Last/Email/Phone/
     Employee ID) + Photo (badge **"EMPLOYEE CAN EDIT"**).
   - Right panel "Managed in Practice Hub" — Team(s) chips, Role, Location(s), Region, Brand,
     Status (**admin only**: Active/Paused/Inactive).
   - **About me** — badge "EMPLOYEE CAN EDIT" (self-service, like photo).
   - Live **"What [name] can access"** box = union of their teams' section access (highest level wins).
   - `users[]` fields: f,l,email,emp,loc,state,brand,teams[],region,phone,about,status,c(color).
2. **Teams & Access** — visual **matrix**: `TEAMS` (rows) × `SECTIONS` (cols). Cell = access level
   None/View/Edit/Manage; **tap to cycle** (`cycle(t,k)`). `access[team][sectionKey]`. A person's
   effective access = **best level across all their teams** (`userAccess`). This is the whole
   permission model — "way more user friendly than Salesforce."
3. **Sections & Files** — **KEY concept the practice asked for.** Documents in a section can be
   for **🌐 Everyone / 📍 By location(state) / 👥 By team**. Simplification to keep it easy:
   **audience is set on the FOLDER and files inherit it** — uploading a doc auto-shares it with the
   right people; only override a single file for an exception. Data = `SECFILES` (per section:
   `items[]` with `{n,aud,scope}`, or `byLocation`/`byBrand` auto-folders). `AUDCYC` cycles the
   audience (`cycFile`). Real HR example baked in: New-Hire/PTO split TX vs NM (location), payroll
   by team, discounts everyone.
(The old 4th tab "Roles" was deleted — redundant with the matrix and confused the user. Do not
   re-add a separate role concept; team+location is the whole model.)

- Tour: `Tour.init([...5 steps], {key:'admin'})`.

**The sections list (`SECTIONS`) reflects their real content areas:** Goals Tracker, Schedule, HR,
End-of-Month Reporting, Office Docs (Managers, per-location folders: Office Contracts / Equipment
Invoices / Dental Licenses), Office Forms (per-brand: FFO/Sunflower/LCO — DDS Referral / Medical
History / Invisalign-Vivera Scan Sheet), Vendors, Insurance/W-9, Marketing, Directory, Admin.

### 4f. `v1/home.html` — the logged-in Home (added 2026-07-28)
This is the corrected mental model after the friend clarified it:
- **Sections = the real areas of the app** (Dashboard, Schedule, Marketing, **Documents**, Admin) — NOT an admin
  config screen. **Locations and brands are just FOLDERS inside a section**, never their own section. You have
  ~5 sections; everything else is folders underneath, and permissions reach down to a single folder.
- **"Viewing as ▾"** persona switcher (`PERSONAS`: Administrator / Office Manager / Doctor / TC / Front Desk).
  Changing it re-renders the nav, the section tiles, the Documents folders (scoped to the persona's office/brand),
  and the Updates feed — so you can *show* the difference between admin and employee. `window.HOME.set(id)`.
- **Capabilities per section**: view / add (add files) / edit / manage — displayed as chips. (Friend asked that
  "adding files" be its own permission.)
- **"Updates for you" feed** (`UPDATES[]`, filtered by `canSee`/`matchScope`): new docs/changes that match the
  viewer's section access + scope (everyone / location / state TX·NM / brand FFO·Sunflower·LCO). Admin sees all,
  Staff sees a filtered subset. This is the notification model the friend described.
- **Two-way SharePoint/OneDrive sync (concept, represented not built):** files are NOT copies — the hub links to
  the real file on SharePoint/OneDrive. Change it on the drive → shows here + editors notified; update from the hub
  → writes back. One source of truth. Shown via the "opens in SharePoint ↗" hints + the explainer note.
- Home is the first nav item on every V1 page now.

### 4g. `v1/documents.html` — the Documents section (added 2026-07-28)
- Reached from Home (nav "Documents" + the Documents tile). Persona-aware: reads/writes
  `localStorage.ph_viewas` so the "Viewing as" choice **persists across pages** (home + documents
  both read it). Shows only the folders the persona can access; folders expand to files.
- **Add a document** (`addDoc`→`renderAdd`→`saveDoc`): pick a file from the drive, then set the
  **audience** — 🌐 Everyone / 📍 Specific locations (multi-select) / 👥 Specific teams (multi-select) —
  with a live "who will see this" line. Saved files appear with a 🆕 + audience chip. This is the
  answer to "how do I control what locations/teams can see?"
- **Live two-way sync viewer** (`openDoc`/`onCell`/`sim`): click a file → two panes ("In Practice
  Hub" + "Microsoft drive — Anna in Excel") over one shared data model. Typing in either updates the
  other instantly; "Someone edits on the drive →" (`sim`) pushes an external change into the hub.
  Demonstrates that files are one source of truth on SharePoint/OneDrive, not copies.
- Capabilities gate the UI: `view` personas see files read-only (no Add button); `add`/`edit`/`manage`
  see "+ Add file".

### 4e. `v1/tour.js` — guided walkthrough engine
- `Tour.init(steps, {key})`. Each step `{sel, title, body}`. Builds a pulsing **"👋 Show me around"**
  launcher (bottom-right). **Click-only — must NOT auto-start** (user requirement).
- Spotlight = fixed `.tour-hole` (big box-shadow overlay) + pulsing `.tour-ring` + `.tour-pop`
  popover with Back/Next/Skip.
- **Highlight-accuracy fix (2026-07-28):** `show()` uses **instant** scroll
  (`scrollIntoView({behavior:'auto'})`) + **double `requestAnimationFrame`** before `place()`, so
  the spotlight measures the target's final rect (was mis-measuring mid-smooth-scroll — the doctor
  step didn't land on the roster). If you add steps, verify each `sel` resolves and lands correctly.

---

## 5. PRODUCTION ARCHITECTURE — how sign-in & users actually work (decided 2026-07-28)

The practice barely uses technology; they're just starting on Microsoft ("OneDrive/SharePoint").
The mockup is the pitch; production must use **their existing Microsoft licenses for sign-in and
user creation**. Here is the plan:

### Identity & user creation (the answer to "how do we sign in?")
- **Sign in with Microsoft (Entra ID)** — included with EVERY Microsoft 365 license, even $2 F1.
  Staff tap "Sign in with Microsoft" and use their work account. **No new passwords, no separate
  user database, nothing for staff to remember.**
- **Creating a user = creating them in Microsoft 365** (the admin does this once in the M365 admin
  center, or we script it). The hub then sees them automatically via **Microsoft Graph API**
  (names, emails, photos — this is the "synced from Microsoft" behavior the mockup shows).
- **Teams in the hub = Microsoft Entra security groups.** Put a person in the "Office Managers"
  group → the hub (and SharePoint) grant access everywhere. One source of truth for permissions.

### Where things live (maps every mockup concept to Microsoft)
| Mockup concept | Production reality |
|---|---|
| Sign-in / user profiles | Entra ID + Microsoft Graph (`/me`, `/users`, photos) |
| Teams | Entra security groups (or M365 groups) |
| Documents section & folders | SharePoint document libraries; folder-level permissions per group/location |
| "Who can see this" on a file | SharePoint permissions + audience targeting (location AND team = group intersection) |
| Two-way sync ("one file, two doors") | It IS the same file — the hub embeds/links the SharePoint file; Office-for-the-web editor for in-hub editing |
| "Updates for you" notifications | Power Automate flow: file added/changed → notify matching group (Teams message, email, or push) |
| KPI Dashboard | Excel on SharePoint read via Graph API (or embedded Excel web part) |
| Schedule | One SharePoint List, read/written via Graph |
| Marketing Kanban | Microsoft Lists (board view) or Planner, surfaced in the hub |

### Build path (RECOMMENDED — hybrid)
- **Storage/permissions/identity = 100% Microsoft** (SharePoint + Entra + Graph). Never build our own.
- **Front-end = a small custom web app with the mockup's exact UX**, hosted on **Azure Static Web
  Apps (free tier) inside their tenant**, signing in via Entra (MSAL.js). Why not plain SharePoint
  pages? Because this practice needs the dead-simple, app-like UX the mockup shows — out-of-the-box
  SharePoint looks like SharePoint, and adoption is the whole game.
- Fallback if custom maintenance is a concern: plain SharePoint communication site (uglier but
  zero-code). Decision belongs to Cory + the practice; hybrid is the recommendation.
- **Hard prerequisite: Phase 0 tenant consolidation below.** Nothing ships across 3 tenants.

## 5b. ROLLOUT GAME PLAN (for Cory — do NOT put this in the mockup)

**Phase 0 — Foundation (weeks 1–4, runs in parallel with mockup feedback)**
1. CEO decision: one master tenant + who owns global admin. Wrangle the 3 IT companies.
2. Add all brand domains; license everyone (F1/F3 frontline ~$2–8, Business Standard for managers).
3. Create Entra groups matching the hub's teams; put the 69 staff in Microsoft 365.

**Phase 1 — Managers first (buy-in) (weeks 4–8)**
1. Load REAL content: their actual HR docs, office folders, vendor lists, the live KPI Excel.
2. Onboard the ~10 managers + 4 doctors personally (15-min walkthrough each — the built-in tours).
3. Managers run their week in it: schedule updates, EOM reporting, document lookups.
4. Weekly tweak loop with the COO — fix friction fast; managers must LOVE it before staff see it.

**Phase 2 — Everyone (weeks 8–12)**
1. Announce at office level, by the managers (not corporate email) — "here's where everything is now."
2. Every staff member gets sign-in on their phone (mobile-first was designed for exactly this).
3. Retire the old paths gradually: new docs go ONLY to the hub → checking it becomes necessary.
4. Notifications pull people back: new doc for your office/team = a ping.

**Adoption metrics (define "widely adopted"):** % staff signed in weekly · docs opened via hub vs.
sent by text/email · schedule questions to managers (should drop) · EOM reports on time.

**Key adoption rules:** managers announce it, not IT · nothing lives in two places · the hub is
where new things appear first · keep the home page under ~5 tiles · never require training beyond
the built-in "Show me around" tours.

## 5c. The real-world deployment story (context, not built here)

- The group is currently split across **MULTIPLE Microsoft 365 tenants** managed by **3 different
  IT companies** (e.g. "Legacy Smiles LC" and "Las Cruces Orthodontics" tenants; live KPI Excel
  sits in yet another — omegaorthodontics/farnsworthorthodontics). ~9 licenses today (only
  leadership/managers have accounts; most staff have no email yet).
- **SharePoint/Teams/search/permissions can't span tenants.** So **Phase 0 = consolidate the whole
  group into ONE master tenant** (add all brand domains so per-brand email survives). This is the
  long pole — bigger than building the hub.
- **Licensing:** Frontline **F1 (~$2.25)/F3 (~$8)** for deskless clinical staff + **Business
  Standard (~$12.50)/E3** for admins/leadership/doctors/managers.
- **KPI data:** stays in SharePoint; the live dashboard reads it via the **Excel web part** (one
  source of truth — the hub is a presentation layer, not new math).
- **Value-over-Excel proof:** their Excel "Dashboard" tab vs-goal total (**+$580,749**) only summed
  5 of 8 offices; correct all-8 = **+$500,762** (the app computes live). "A hub can't silently drop
  an office."

Full answers to the friend's 8 brief questions live in `~/Downloads/Practice Hub - Response to
Design Brief.docx` (regenerate via `build-response-doc.js`, which is gitignored).

---

## 6. How to work on this

```bash
# Preview (never use plain `python -m http.server` if you can use the preview tool):
# launch.json config is named "practice-hub" on port 8790.
# In Claude Code: preview_start {name:"practice-hub"}, then open /v1/<page>.html
```
- **Verify in the browser** after changes: check `read_console_messages` (should be zero errors),
  screenshot the affected page, and if you touched the tour, actually run it to the changed step.
- Preview can be racy: navigate with a full `http://localhost:8790/v1/<page>.html` URL and
  screenshot; restart the server if a page seems to serve stale JS/data.
- **No native `alert()`/`confirm()`** — they block browser automation and feel dated. Use in-page
  modals/hints (existing pattern).
- Keep V1 pages **self-contained**. Match the existing token set and component styles.
- Commit style: short imperative subject scoped by page, e.g. `V1 Admin: …`, `Schedule: …`.

### ONE nav, ONE persona list (2026-07-28)
`PH.nav(activeKey)` in `user.js` renders the tab bar on **every** page from a single ordered list:
**Home · Dashboard · Enter Production · Schedule · Marketing · Documents · Team · Admin**. The user
complained the menu **reordered itself** between pages — never build a per-page nav again. A tab only
appears if `atLeast()` passes; **Enter Production requires `edit`**, so people who can't type numbers
never see it. `user.js` MUST be loaded in `<head>` (before any page script) or `PH` is undefined.
Watch out: a `location.reload()` inside a persona setter needs a `booted` guard, or it reload-loops.

### Editing dashboard data is a PERMISSION (2026-07-28)
Section `production` levels: `view` (nothing useful), **`edit` = type the monthly actuals**,
**`manage` = also set the main and stretch goals**. In `production.html` the goal boxes render as
locked read-only inputs ("Set by leadership — you can't change this") unless
`PH.atLeast('production','manage')`. Goal edits flow to the dashboard via `_goal`.

### Permissions must be ENFORCED, not just displayed (2026-07-28)
The user caught that a Doctor with **View** on the schedule could still edit it. Any page that
renders editable UI must gate it: `const canEdit=()=>!window.PH||PH.atLeast('schedule','edit')`,
early-return from every mutating entry point, add `body.ph-view-only` (hides pencils/add buttons,
kills hover/cursor) and call `PH.readOnlyBanner('.wrap','schedule')`. Do the same for any new
editable surface. Personas live ONLY in `user.js` — never redefine them per page.

### Self-service profile (2026-07-28)
Every page has an **avatar top-right** (`PH.mount()`, auto-runs). It opens a menu → **My profile**
+ "sign in as" list. In the profile: **photo & About me are the person's own** (saved to
`localStorage.ph_me_<id>`); **name/email/phone/employee ID are read-only "from Microsoft 365"**;
**team/location/region/brand/status are read-only "set by your admin."** Never make the locked
fields editable there — the whole point is showing what a normal user can and can't change.

### UX interaction rules (locked in 2026-07-28 after user feedback)
- **NEVER use click-to-cycle** ("tap repeatedly until the right value appears"). The user called
  this out as unintuitive. Always **tap-to-pick**: one tap opens a small `.pk` menu showing ALL
  options with a plain-English description and a ✓ on the current one; one tap picks. This pattern
  now lives in admin.html (`openPk`/`pickLevel`/`pickAud`) and marketing.html (`pickRes`) — reuse it.
- Multi-value fields are **tappable chips**, never free-text (teams, locations in the profile).
- **Nothing consequential happens silently.** Dropping a card into Done *asks* "How did it go?"
  (`askResult`) instead of assuming Good; **+ Add file** asks who can open it before saving and
  warns when the choice differs from the folder. If a new action shares or scores something,
  it must prompt.
- **Document sections are expanded by default** in documents.html (`openSet`, reset per persona) —
  the user does not want people hunting for a disclosure triangle to find their files.
- **Team-restricted files must actually be hidden.** A file with `scope:'team'` carries a `teams`
  string (e.g. `'HR, Managers'`) and `teamScopeOK()` matches it against the viewer's `teamName`.
  Regression to avoid: Front Desk / Staff could see the **Payroll Tracking Sheet** because
  team-scoped files were being treated as visible-to-all-in-the-section. The chip reads
  "HR, Managers only" so it's obvious *why* a file is there.

### Recurring user preferences (learned the hard way — honor them)
- Tour: **click-only, never auto-start.**
- Don't invent copy/asides in the UI (once added a "(Fridays often differ)" note the user was only
  telling *me* — they made me remove it). Put explanations in tour steps, not permanent labels.
- Show **July as in-progress**, not omitted. Dashed **per-bar** monthly goals (not one flat line).
- Sparkline/trend belongs on the **individual office** view, not "All Offices" (minibar there).
- "Mark closed" must **visibly show "Closed."**
- **User-friendliness beats configurability** every time. Prefer inheritance/defaults over
  per-item settings (that's why file audience inherits from the folder).

---

## 7. Status & possible next steps

**Done & verified (2026-07-28):** KPI dashboard on real data; interactive schedule (hours/tz/lunch/
conflicts/availability/completeness); guided tour (highlight bug fixed); Marketing Kanban with
scored results; Admin console (People + M365-sync profiles w/ self-service photo & About me, Teams
×Sections access matrix, Sections & Files audience-inheritance model, Roles); nav wired across all
four V1 pages.

**Open / previously offered (unconfirmed):**
- Schedule: "Copy last week" + "Print this week"; click a "needs a doctor" cell to jump to it.
- Sync or retire the old root `calendars.html` (superseded by `v1/schedule.html`).
- Admin: make the per-location/brand folder audiences individually editable (currently the
  location folders are fixed-scoped by design; brand folders demo an "everyone" default).
- Real data refresh for the dashboard when the live Excel numbers change.
- A per-user "My Profile" self-service page (currently self-service is represented via badges in
  the admin profile modal).

When unsure what the friend wants, keep it **simple and self-maintainable** — that's the whole point.
