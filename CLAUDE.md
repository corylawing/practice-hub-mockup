# Practice Hub — Project Guide (for Claude Code)

> Read this first. It is the full context for **Practice Hub** so any session (including on a phone)
> can pick this up cold. Keep it current — the user asks for that explicitly.
> Last full update: **2026-07-29**.

---

## 1. What this is

A **clickable mockup of a centralized hub** for a **growing 8-office orthodontic practice** (brands
**FFO** = Farnsworth, **Sunflower/SUN**, **LCO** = Las Cruces Ortho). Cory is building it for the
practice's leadership to validate before a real build. Purpose: **one place for documents,
dashboards and updates**, for everyone from the COO to a clinical assistant.

- **Repo:** `~/practice-hub-mockup` → `github.com/corylawing/practice-hub-mockup`
- **Live:** https://corylawing.github.io/practice-hub-mockup/v1/home.html (GitHub Pages, `main`)
- **Stack:** plain static HTML/CSS/JS. **No framework, no build step.** Preview via
  `.claude/launch.json` config **`practice-hub`** on **port 8790**.

### Hard constraints (repeat offenders — obey these)
1. **"User friendly is the most important."** Said many times. Fewer clicks, plainer words,
   sensible defaults over configuration.
2. The practice is **very** low-tech and is only just starting on Microsoft/OneDrive. Nothing may
   require training beyond the built-in walkthroughs.
3. **Mobile-first** — most staff are deskless and will use phones.
4. Leadership must be able to **run it themselves**: no developer, no consultant.
5. **Rollout = managers first (buy-in), then all staff.**

---

## 2. Two site trees in ONE repo

- **Root** (`/index.html`, `/calendars.html`, `/assets/…`) = the original first-draft concept.
  Kept for reference only. Its `calendars.html` is a stale copy of the schedule.
- **`/v1/`** = **THE REAL BUILD.** Every page is **self-contained** (inline CSS + JS + data, own
  `:root` tokens). Do NOT reference `../assets/*` from V1 — it broke styling in preview before.

**Always work in `/v1/`.** The only shared files are `v1/user.js` and `v1/tour.js`.

### V1 pages
| File | Purpose |
|---|---|
| `v1/home.html` | **Home** — the daily landing page. Personalised section tiles, an **"Updates for you"** feed filtered by role/team/location. |
| `v1/index.html` | **Production Dashboard** — location-scoped. **Starts first, then Production**, MTD by default with a year toggle, production-days tiles, one toggled bar chart, and an all-office **leaderboard**. |
| `v1/production.html` | **Enter Production** — the few boxes a manager types each month. Writes back to the SharePoint workbook and **drives the dashboard**. Goals editable only with `manage`. |
| `v1/schedule.html` | **Schedule** — weekly board: which office is open each day and which doctor is where. Enforced read-only for view-only roles. |
| `v1/marketing.html` | **Marketing** — Kanban board (Ideas→Planned→In progress→Done, scored on arrival in Done) **plus a month calendar overview** at the bottom. |
| `v1/documents.html` | **Documents** — persona-aware folder browser, **collapsed by default**. Add-a-document with audience control. Live two-way SharePoint sync demo. |
| `v1/team.html` | **Team** — who's-who directory built from the practice's REAL roster: photo, preferred name, role, office, brand, tap-to-call, tap-to-email. |
| `v1/admin.html` | **Admin Console** — People · Teams & Access · Document Sections · Locations. |
| `v1/user.js` | **The signed-in person.** SINGLE source of truth for people, permissions and the nav. Avatar + My Profile. |
| `v1/tour.js` | Guided-walkthrough engine. Steps can switch tabs; tours **chain across pages**. |

---

## 3. Design system (V1 tokens)

```
--navy:#0F2A4A  --navy2:#25456e  --teal:#149B96  --teal2:#2BC0B8
--teal-soft:#E5F4F3  --teal-600:#0F827E
--ink:#1F2D3D  --soft:#56627A  --line:#E4E8EE  --canvas:#F4F6F8
--good:#2E9E6B  --good-soft:#E7F4EE  --bad:#D7503A  --bad-soft:#FBEAE7
--amber:#F2A03D  --blue:#1f6f9e  --blue-soft:#E3F0FA  --purple:#6b3fd0
Font: Inter. Radius ~14px. Soft shadows. maxw 1000–1180px.
```
Every page: amber **PROTOTYPE** ribbon · navy header with `PH` mark + "V1 preview" pill + the
**avatar** (from `user.js`) · `.v1nav` tab bar (horizontal-scroll on mobile).

---

## 4. `v1/user.js` — people, permissions, nav, profile

**This is the spine of the app. Read it before touching any page.**

### People
`PEOPLE[]` holds **five real staff** used as demo logins (the practice sent a real User Profile
sheet). Note **many staff hold dual roles** — `role` is often a combination:

| id | Person | Role | Access highlights |
|---|---|---|---|
| `admin` | **Heather Beal** | **COO (Admin)** | everything `manage` |
| `om` | Lily Rico | OM / Clinic Lead, Carlsbad | production `edit`, schedule `edit` |
| `doctor` | Dr. Carla Coehlo | Associate Doctor, rotates | dashboard `view`, schedule **`view`** |
| `tc` | Elizabeth Reyes | TC, Hobbs | schedule `view`, documents `add` |
| `staff` | Serenity Gonzales | Clinical Assistant, Carlsbad | schedule `view`, documents `view` |

Heather's title is exactly **"COO (Admin)"** — she is the COO *and* the app's administrator.
Not "Practice Administrator". Don't relabel her.

### Permission levels
`none < view < add < edit < manage` (`RANK`). Sections: `dashboard`, `production`, `schedule`,
`marketing`, `documents`, `team`, `admin`.
- `PH.can(section)` → level · `PH.atLeast(section,'edit')` → bool · `PH.offices()` → `'all'` or list.

### ONE nav (never build a per-page nav again)
`PH.nav(activeKey)` renders the tab bar on every page from one ordered list:
**Home · Dashboard · Enter Production · Schedule · Marketing · Documents · Team · Admin**.
The user complained the menu **reordered itself** between pages. A tab appears only if `atLeast()`
passes; **Enter Production requires `edit`**, so people who can't type numbers never see it.

⚠️ **`user.js` must be loaded in `<head>`** (before any page script) or `PH` is undefined.
⚠️ A `location.reload()` in a persona setter needs a `booted` guard or it **reload-loops**
(this actually happened on `production.html`).
⚠️ **`setMe()` redirects to `home.html` when the person you just became can't open the current
page** — otherwise switching from Admin to a Doctor left them sitting on the Admin console.

### My Profile (avatar → top right of every page)
The split the user specified, exactly:
- **Theirs to edit:** **photo** (real upload: file picker **+ drag-and-drop**, centre-cropped to
  256px, stored as a data URL in `localStorage.ph_me_<id>`), **preferred name**, **contact phone**
  (Microsoft does NOT hold this), **About me**.
- **From Microsoft 365, locked:** first name, last name, email, employee ID.
- **Set by your admin, locked:** role(s), team(s), location(s), region, brand, status.

`PH.faceStyle(p)` / `PH.face(p)` draw a person's picture (photo if set, else coloured initials) —
use them anywhere an avatar appears. `PH.name(p)` respects **preferred name**.

---

## 5. Page detail

### 5a. `v1/index.html` — Production Dashboard
**Their written feedback sheet, all of it, implemented:**
1. **Starts first**, then Production — two stacked sections (`🦷 Starts`, `💰 Production`).
2. **Toggle the bottom bar chart between Starts and Production** (`chartMode`, `chartToggle()`).
3. **Defaults to MTD**; **toggle to Year to date** (`period='mtd'|'ytd'`, `periodBar()`).
4. **Production days scheduled** and **completed** tiles (+ days left) via `daysTiles()`.
5. **Main AND stretch goals** — card shows % of main with % of stretch beneath; chart draws a
   **dashed main-goal line** and a **dotted stretch line**.
6. **Last-year column** — grey 2025 bar beside each 2026 bar.
7. **Removed** the "5 of 8 offices are ahead of goal…" ribbon.
8. All-Offices page **mirrors an office page**, with the **leaderboard** as the bottom section,
   **best on top** (ranked by **% of starts goal**), including **production days remaining**.
9. **Location-scoped** (their later note): a persona sees only its own offices. One office → lands
   straight there, no All-Offices tab, no leaderboard. No access → a clear panel.

**Data is REAL**, parsed from `2026 PRODUCTION DASHBOARD (New)-2.xlsx` (openpyxl is NOT installed —
the xlsx was unzipped and the sheet XML parsed directly).
- Production `act` = their **"2026 Actual TC ONLY + Medicaid Production"** row (the row their goal
  comparison uses — *not* the adjusted-net row). `goal`, `stretch`, `ly` (2025 net + 2025 Medicaid),
  `days`, `done`.
- Starts `sGoal` = "Needed Number of Starts per day" × "Number of Production Days (2026)";
  `sAct` = that goal + their "Current # of Starts Ahead or Behind Goal" row.
- **Templates differ per office.** Medicaid offices (Carlsbad, Clovis, Hobbs, Cruces LCO) use
  "2026 Total Production Goal (TC + Medicaid)"; TC-only offices (Lubbock, San Angelo, Mansfield,
  Cruces FFO) use "2026 TC Production Goal". **Match labels flexibly, never fixed row numbers.**
- **A month counts only when it has BOTH an actual and a goal** (`live()`). Mansfield has production
  from January but goals only from **April** — get this wrong and it reads 154% instead of 92%. With
  this rule **every office reconciles exactly** with their own tracking row.
- **Two workbook errors found (tell the practice):** the Dashboard tab's 2026 total shows
  **+$449,954** but the eight offices sum to **+$406,663** — the total formula **skips Mansfield**
  (−$43,935). Shown in the page footer. (An earlier, separate finding on the older file was
  +$580,749 vs +$500,762.)

### 5b. `v1/production.html` — Enter Production
- Four boxes: TC net production, Medicaid (if the office bills it), adjustments, completed days.
  Maths (totals, % of main, % of stretch, per-day) updates live.
- **Editing dashboard data is a permission** (their words): `production` `edit` = type the monthly
  actuals; **`manage` = also set the main and stretch goals**. Without `manage` the goal boxes render
  as locked read-only inputs reading *"Set by leadership — you can't change this."*
- Edits persist to `localStorage.ph_prod` as `{tc,mdp,adj,dys,goal,str,_total,_days,_goal}`;
  `index.html` applies `_total`/`_days`/`_goal` on load. **Store the computed `_total`** — deriving
  it in the dashboard silently dropped the Medicaid portion once.

### 5c. `v1/schedule.html` — Schedule
- Weekly board (locations × Mon–Sat), colour per doctor, real dates, today highlighted.
- Data (`window.PS`): `people[{n,c}]`, `locations[]`, `sched{loc:[6 cells]}` (cell = `null` |
  `{p,h,s,e}` | `{closed:true}`), `openH{loc:[6 × {s,e}|null]}`, `locTZ`, `locLunch`. Times in
  minutes; conflict = overlap (`s1<e2 && s2<e1`) guarded by `conflictAt`.
- **Wording (their feedback):** a cell with no doctor on site is a **"● Yellow Dot Day"**
  (`.cell.ydot`, pale yellow) — **not** "Closed". "Closed" means the office has no hours that day.
  Button reads **"Mark Yellow Dot Day."**
- **`Cruces Legacy` renamed `Cruces FFO`** everywhere (their instruction).
- Availability-only doctor picker; completeness bar; per-day hours + time zone + lunch with
  "apply to all"; add/edit/remove locations and doctors.
- **Read-only is enforced** — see §6.

### 5d. `v1/marketing.html` — Marketing
- Kanban `STAGES`: 💡 Ideas → 🗓️ Planned → 🚀 In progress → ✅ Done. Drag-and-drop **or** ◀ ▶.
- **Landing in Done asks "How did it go?"** (`askResult`) — 🟢 Good / 🟡 Mixed / 🔴 Underperformed.
  Never auto-score; the user caught that.
- **Exact dates** — `<input type="date">`, stored ISO (`2026-08-12`), displayed via `niceDate()`.
- **Calendar overview at the bottom** (`renderCalendar`): month grid, campaigns on their real dates,
  colour-coded by type, finished ones carry their result dot, today outlined, ‹ › + Today nav, and an
  **"No date yet"** row of undated cards you can tap to schedule. `TODAY` is pinned to 2026-07-28 so
  the mockup is stable.

### 5e. `v1/documents.html` — Documents
- Persona-aware; persona persists via `localStorage.ph_viewas`.
- **Folders start COLLAPSED for every person** — the user asked for this twice (they were expanded
  at first). `openSet` starts as an empty Set and is **reset to null on every persona change**, so a
  new sign-in never inherits someone else's open folders.
- **Add a document** asks the audience: **location AND team must both match** (`Everyone` /
  specific locations / specific teams) with a live "who will see this" line.
- **Team-restricted files are actually hidden** (`teamScopeOK`) — a file with `scope:'team'` carries
  a `teams` string and is matched against the viewer's team. Regression to avoid: Front Desk could
  once see the **Payroll Tracking Sheet**. Chips read "HR, Managers only" so it's obvious why.
- **Live two-way sync viewer** (`openDoc`): two panes ("In Practice Hub" / "Microsoft drive") over
  one shared model; typing in either updates the other; "Someone edits on the drive →" simulates an
  external change. Demonstrates one file, two doors — never a copy.
- Sections the admin created appear here automatically (`customSecs`, `localStorage.ph_docsecs`).

### 5f. `v1/team.html` — Team
- Built from the practice's **real roster** (`STAFF[]`, 70 people, from
  `Centralized Hub Ideas(User Profile).csv`): real **roles** (Clinical Asst, Front Desk, TC,
  OM/Clinic Lead, Financial Coord, Mktg Liaison combos, Clinic Lead, Records Tech, Associate Doctor,
  Owner/Doctor, COO, CSO, Marketing Director), real **offices**, real **brands**, real emails where
  supplied (others chipped **sample**).
- **Preferred name** is the display name (from the sheet's nicknames — Lexi, Haley, Liz, Emmy — or
  the person's own profile setting), with the legal name underneath.
- Search across name/nickname/role/office/brand/team/phone; filter chips per office + Doctors +
  Leadership; tap-to-call and tap-to-email; the signed-in person's card is outlined "You" with a
  shortcut to edit their profile.
- **This replaced a fabrication.** An earlier version listed a "Staff Directory" app tool that the
  practice never had — the user caught it. They liked the idea, so it was built for real. **Do not
  invent sections or tools they haven't asked for.**

### 5g. `v1/admin.html` — Admin Console
**Four tabs** (`window.AD`), all client-side demo state.

**TOOLS vs DOCUMENT SECTIONS — the user's mental model, get this right:**
- **`TOOLS`** = real app features: Dashboard, **Enter Production**, Schedule, Marketing board,
  **Team**, Admin. **Fixed** — admins only choose *who gets them*. Marketing is a board, **not** a
  document folder; never list it beside HR.
- **`DOCSECS`** = the folders inside **Documents** (HR, Office Docs, Office Forms, Vendors,
  Insurance/W-9, End-of-Month + any the admin creates). **Admins create these freely.**
- **Locations and brands are FOLDERS inside a section, never sections themselves.**

1. **People** — the real 70-person roster, synced from Microsoft. Admin sets **team(s), location(s),
   status** only. Row → profile modal (synced vs admin-managed vs self-service, live "what they can
   access" preview).
2. **Teams & Access** — matrix of **TEAMS × (tools + doc sections)**, grouped headers. **Tap a cell
   → pick** None / View / Add files / Edit / Manage. A person on two teams gets the **best** level.
3. **Document Sections** — create/edit/delete sections: name, icon, structure
   (`plain` | `byLocation` → auto folder per office | `byBrand`), plus audience
   (`locMode`/`locs` + `teamMode`/`teams`). **+ Add file asks who can open it** before saving,
   defaulting to the folder and warning when it's an exception. Persisted to `ph_docsecs`, so new
   sections appear in Documents and as matrix columns immediately. "Reset to defaults" for demos.
4. **Locations** — the practice is expanding, so admins add offices themselves (name, brand, state,
   time zone). `LOCS`, `DEFAULT_LOCS`, persisted to `ph_locations`. **Always call `LOCATIONS_OF()` /
   `BRANDS_OF()`** — never hardcode a location list. Adding an office immediately creates its Office
   Docs folder and appears on people's location chips.

**There is no "Roles" tab.** It was removed — the user found it confusing and redundant.
**One rule: team = what you can do; location = whose offices you see.** Do not reintroduce roles as
a permission object (`role` on a person is now just a job title from their sheet).

### 5h. `v1/tour.js` — the walkthrough
- `Tour.init(steps, {key, title, launch, next})`. Steps: `{sel, title, body, pre?}` — `pre()` runs
  first (e.g. `AD.tab('access')`) then the target is spotlighted.
- **`opts.next` chains tours across pages** (via `sessionStorage.ph_tour_auto`), so the COO can walk
  the entire app unaccompanied: Home → Dashboard → Enter Production → Schedule → Marketing →
  Documents → Admin. Admin has its own 10-step **"Teach me the admin side."**
- Spotlight uses **instant** scroll + **double `requestAnimationFrame`** before measuring — with
  smooth scroll the hole landed in the wrong place (the doctor step bug).
- Launcher is **click-only, never auto-start**.

---

## 6. Rules learned the hard way (violate these and the user notices)

### Permissions must be ENFORCED, not just displayed
A Doctor with **View** on the schedule could still edit it. Any page rendering editable UI must gate
it: `const canEdit=()=>!window.PH||PH.atLeast('schedule','edit')`, early-return from **every**
mutating entry point, add `body.ph-view-only` (hides pencils/add buttons, kills hover/cursor) and
call `PH.readOnlyBanner('.wrap','schedule')`.

### Never click-to-cycle
"Tap repeatedly until the right value appears" was called out as unintuitive. Always **tap-to-pick**:
one tap opens a `.pk` menu showing **all** options with a plain-English description and a ✓ on the
current one; one tap picks. Implemented as `openPk`/`pickLevel`/`pickAud` (admin) and `pickRes`
(marketing). Multi-value fields are **tappable chips**, never free text.

### Nothing consequential happens silently
Dropping a card into Done **asks** for the result. **+ Add file** asks who can open it. If a new
action shares or scores something, it must prompt.

### Don't invent things
The fake "Staff Directory" and my invented "Heather Farnsworth" were both caught. Use their real
data; where something is a placeholder, **label it** (e.g. emails chipped "sample"). If asked who
someone is or what a role should be, **ask** rather than guess.

### Other standing preferences
- No native `alert()`/`confirm()` — they block automation and feel dated. Use in-page modals.
- Show July/current month as in-progress rather than omitting it.
- Dashed **per-bar** monthly goals, not one flat line across the year.
- Keep the home page to ~5 tiles.
- Don't put explanatory asides into permanent UI labels — put them in tour steps.
- Keep V1 pages self-contained; match the token set.
- Commit style: short imperative subject scoped by page (`V1 Admin: …`).

---

## 7. Verifying work

```bash
# preview_start {name:"practice-hub"} → http://localhost:8790/v1/<page>.html
```
- After **every** change: `read_console_messages` (expect zero errors) + screenshot the page.
- Syntax-check inline scripts quickly:
  `node -e "..."` wrapping each `<script>` body in `new Function(...)`.
- Navigation in the preview is racy — assign the full URL then screenshot.
- The tour places its popover on a double rAF, so **don't** drive it with a synchronous loop; step
  with delays or verify each step's selector resolves.
- Demo state lives in `localStorage`: `ph_viewas`, `ph_me_<id>`, `ph_prod`, `ph_docsecs`,
  `ph_locations`. Clear them to reset a demo.

---

## 8. PRODUCTION ARCHITECTURE — how sign-in & users actually work

Production must use **their existing Microsoft licenses**.

- **Sign in with Microsoft (Entra ID)** — included with every M365 licence, even $2 F1. No new
  passwords, no separate user database.
- **Creating a user = creating them in Microsoft 365.** The hub reads them via **Microsoft Graph**
  (names, emails, photos — the "synced from Microsoft" behaviour the mockup shows).
- **Teams in the hub = Entra security groups.** One source of truth for permissions.

| Mockup concept | Production reality |
|---|---|
| Sign-in / profiles | Entra ID + Graph (`/me`, `/users`, photos) |
| Teams | Entra security groups |
| Documents & folders | SharePoint document libraries; folder permissions per group/location |
| "Who can see this" | SharePoint permissions + audience targeting (location AND team = group intersection) |
| Two-way sync | It IS the same file — hub links/embeds it; Office-for-the-web for in-hub editing |
| "Updates for you" | Power Automate: file added/changed → notify matching group |
| Dashboard | Excel on SharePoint via Graph (or the Excel web part) |
| Schedule | One SharePoint List via Graph |
| Marketing board | Microsoft Lists (board view) or Planner |

**Recommended build path (hybrid):** storage/permissions/identity 100% Microsoft; front-end = a small
custom web app with the mockup's UX on **Azure Static Web Apps (free tier) inside their tenant**,
signing in with MSAL.js. Plain SharePoint pages are the zero-code fallback but look like SharePoint,
and adoption is the whole game. **Hard prerequisite: one tenant (below).**

### Deployment reality (the long pole)
- The group is split across **multiple M365 tenants** run by **3 different IT companies**; the live
  KPI workbook sits in yet another. ~9 licences today — most staff have **no work email**.
- SharePoint/Teams/permissions **cannot span tenants** → **Phase 0 = consolidate into ONE master
  tenant**, adding all brand domains so per-brand email survives.
- **Licensing:** Frontline **F1 (~$2.25)/F3 (~$8)** for deskless clinical staff + **Business
  Standard (~$12.50)/E3** for admins, leadership, doctors, managers.

### Rollout game plan — for Cory only, do NOT put this in the mockup
**Phase 0 (wks 1–4):** CEO picks the master tenant + names its global admin; wrangle the 3 IT
companies; add domains; licence everyone; create Entra groups matching the hub's teams.
**Phase 1 — managers first (wks 4–8):** load their REAL content and live workbook; onboard the ~10
managers + 4 doctors personally (the built-in tours do the teaching); they run their week in it;
weekly friction-fix loop with the COO. Managers must love it before staff see it.
**Phase 2 — everyone (wks 8–12):** managers announce it office-by-office (not corporate email);
staff sign in on phones; **new documents go only to the hub** so checking it becomes necessary;
notifications pull people back.
**Adoption metrics:** % staff signed in weekly · docs opened via hub vs texted · schedule questions
to managers (should drop) · EOM reports on time.

Answers to the friend's original 8 brief questions: `~/Downloads/Practice Hub - Response to Design
Brief.docx` (regenerate via the gitignored `build-response-doc.js`).

---

## 9. Status & open questions

**Done and verified:** everything in §5. Real production + starts data reconciled to their workbook;
real roster and roles; permissions enforced and location-scoped; profile with photo upload, preferred
name and editable phone; chained walkthroughs on all pages; admin can create sections and add
locations; mobile verified at 375px on every page.

**Waiting on the practice:**
- **Team column is blank for most people** in their sheet — only some are marked "Staff". Which
  team does each role map to (e.g. is a Clinic Lead an "Office Manager" for access purposes)?
- Employee IDs, phone numbers, and the remaining emails (many are blank).
- Whether the two Las Cruces practices should be one location filtered by brand (their sheet says
  "Las Cruces" once) or two separate offices (the workbook tracks them separately).
- Do any of the End-of-Month / Medicaid / RIP tracker files contain **patient names**? If yes that's
  PHI and changes access, auditing and device policy.
- Whether managers should be able to overwrite **goals** — currently `manage` only.

**Ideas raised but not built:** a Requests/Forms section (PTO, supplies, IT) and an Announcements
broadcast — both real gaps against the original brief, both awaiting a yes.
