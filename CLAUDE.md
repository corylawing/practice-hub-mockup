# Home-Brace — Project Guide (for Claude Code)

> Read this first. It is the full context for **Home-Brace** so any session (including on a phone)
> can pick this up cold. Keep it current — the user asks for that explicitly.
> Last full update: **2026-08-08** (renamed Practice Hub → Home-Brace).

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

### Adding a file LINKS a live drive document — it never uploads a copy
`PH.drivePicker({ns,path,name,path2})` in `user.js` is the shared Microsoft-drive browser used by
**both** Documents ("+ Add file") and Admin → Document Sections. It shows the practice's SharePoint
tree, and the chosen file is stamped **"🔗 LINKED — always the live file"** with its drive path.
Device upload is offered second and explains it saves **onto the drive first**, then links.

Before 2026-08-17 both pages had a "Browse drive" button that just stubbed in a filename, so the
whole thing read like a device upload — which contradicts the app's core promise ("nothing here is
a copy"). The `DRIVE` sample tree lives in `user.js` only; do not copy it into a page.

### Month view is Mon–Fri, offices A–Z, all 8 visible without scrolling
Their goal: *see at a glance that every office has a doctor on every day, without visual overwhelm
or scrolling inside a day.*

- **Weekend columns removed** — `DOW` is Mon–Fri, `openOn()` guards `i<5`, `weekDays()` returns 5,
  and the month grid is `repeat(5,1fr)`. Five columns ≈ 231px each, so all eight offices fit.
- **Build the grid from WEEKDAYS.** Pad from the first *weekday* of the month (August 2026 starts on
  a Saturday, so the grid begins at Monday the 3rd with no blanks) and `continue` past any day with
  `dowIdx > 4`. Getting either wrong shifts every day into the wrong column — it did, twice.
- **Offices sorted A–Z** via `byName` at load and re-sorted after an add/rename. One sort, so the
  filter chips, week rows, month rows and counters all agree.
- **Row layout:** doctor rows stay **stacked** (office over doctor). Only the **Yellow Dot Day** row
  reads across — office left, "● Yellow Dot Day" pushed right — and it **keeps the office colour**;
  only the dot is yellow (`#FDE047` with a `#a16207` ring so it pops on any office background).

⚠️ **Clovis and Cruces FFO have Saturday hours** (`hours[5]`). With Saturday gone those no longer
appear anywhere. Raise it with the practice — either move those to weekdays in the office editor or
bring back a narrow Saturday column.

### A day can have SEVERAL doctors at one office
Cells store **`ps`** — an array of doctor indexes. Older saved cells hold a single `p`, so
**everything reads through `docsOf(cell)`** in `schedule.html`; never touch `cell.p` directly.
The day editor's doctor picker is multi-select ("tap as many as you need"); week grid stacks the
names, month view joins them with commas, and the counters credit **one doctor-day to the office
and one day to each doctor**.

**Being booked elsewhere is a warning, not a block.** It used to disable the button — but with
4 doctors across 8 offices every doctor is placed on a normal weekday, which made it impossible to
ever put two in one office. It also contradicted the **half day (8–2)** feature, which exists so
someone can split a day between two offices. The chip now shows "also at Lubbock" and an amber
line appears under the picker. (The seeded rota already double-books Coelho on one Wednesday, so
the hard block was inconsistent with the app's own data anyway.)

### Production leads, and starts has NO stretch goal
Reversed on 2026-08-17 after they saw it — earlier versions put starts first and carried a
*derived* starts stretch (starts goal × production stretch/goal ratio).

- **Production is the headline number.** Left gauge, first in the DOM (so it's top on mobile),
  first in the chart toggle, the chart's default view, and the leaderboard's rank + first columns.
- **Starts has no stretch anywhere** — no gauge marker, no footer figure, no dotted chart line, no
  legend entry. Their workbook has no starts stretch row and the derived one was dropped. Stretch
  stays on **production only**. Don't reintroduce it.

### A person has no region or brand
Both were editable fields on the Admin person record and both were **always blank and never read**.
They also duplicate the office: Carlsbad *is* FFO in New Mexico, so a person's brand and region
follow from the location(s) they're assigned to. Removed 2026-08-17 — if they're ever wanted back,
derive them from `PH.locations()`, don't store them per person.

### No abbreviations for state or time zone
The practice asked for full names ("New Mexico", "Mountain Time") — not NM/MT. `PH.locations()`
**normalises on read**, so stored records written by older versions get healed rather than showing
codes forever. The `TZSHORT` map is gone from both admin.html and schedule.html.

### Locations are ONE list — never hardcode offices again
`PH.locations()` / `PH.saveLocations()` / `PH.officeNames()` in `user.js` are the single source of
truth for the eight offices. **Admin owns brand/state/tz; Schedule owns colour/lunch/hours; both
write the whole record back** so neither wipes the other's fields. Every other page reads it.

Before 2026-08-17 **seven pages each had their own hardcoded office array** — adding a location in
Admin changed nothing anywhere else, and the copies had drifted (`documents.html` and `home.html`
listed a "Las Cruces FOLC" that has never existed). If a page needs offices, call `PH.officeNames()`.
Pages holding per-office DATA (dashboard, Enter Production) append any office they don't know about
with zeros so it shows up and can be filled in, rather than silently ignoring it.

### V1 pages
| File | Purpose |
|---|---|
| `v1/home.html` | **Home** — the daily landing page. Personalised section tiles, an **"Updates for you"** feed filtered by role/team/location. |
| `v1/index.html` | **Production Dashboard** — location-scoped. **Production LEFT, Starts RIGHT** (production is their headline number), MTD by default with a year toggle + month picker, production-days tiles, one toggled bar chart that **opens on Production**, and an all-office **leaderboard ranked by production %**. |
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
Every page: amber **PROTOTYPE** ribbon · navy header with the **logo mark** + "V1 preview" pill + the
**avatar** (from `user.js`) · `.v1nav` tab bar (horizontal-scroll on mobile).

### Logo & name (renamed to Home-Brace 2026-08-08)

The app is **Home-Brace**. The mark is a **white house outline with a braces archwire across it**
(brackets on a wire) on a teal-gradient square — supplied by Cory as finished artwork.

- **Source of truth: `~/Documents/homebracelogoV2.png`** (1254², full-bleed square, no margin,
  no rounded corners). V1 of the artwork was rejected — always use **V2**.
- `assets/logo-mark.png` (512²) — the header mark, rendered at 34×34.
- `assets/favicon.png` (256²) + `assets/icons/{favicon-32,icon-512,apple-touch-icon}.png`,
  all re-exported from the V2 source with Pillow.
- The artwork is a hard square, so the header rounds it in CSS:
  `.mark img{border-radius:9px}`. Don't bake rounding into the PNG.
- **Do NOT redraw this mark as SVG.** A hand-traced SVG version was rejected outright.
- Wordmark: **"Home-"** then **"Brace"** in `--teal2`, markup `Home-<i>Brace</i>`
  (`.brand i{font-style:normal;color:var(--teal2)}`). On light backgrounds "Home-" is `--navy`.
- Tagline from the logo lockup: **Centralize. Connect. Grow.** (used on the social card).
- `assets/og-image.png` (1200×630) is the **link-preview card** and is a PNG, so a
  find-and-replace rename will NOT touch it. It still said "PH / Practice Hub / Summit
  Orthodontics" for a while after the rename. Rebuild it whenever the name or mark changes.
- **No practice name in the chrome.** The placeholder "Summit Orthodontics" was removed 2026-08-08.
  There is no umbrella name — the practice runs three brands (FFO/Farnsworth, Sunflower, LCO) — so
  `PRACTICE` in `assets/app.js` is `""` and the header shows only the wordmark. Don't invent one.
  The root site's eight fake "Summit …" offices were renamed to the real eight: Carlsbad, Clovis,
  Hobbs, Cruces LCO, Cruces FFO, Lubbock, San Angelo, Mansfield.
- **All** shared assets carry a `?v=…` query (currently `hb19`) — **bump it** when editing `assets/app.js`,
  `assets/data.js`, `assets/styles.css`, `v1/user.js`, `v1/tour.js` or `v1/celebrate.js` —
  browsers cache them hard and will silently serve the old copy otherwise. This bit us twice.

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
| `doctor` | Dr. Carla Coelho | Associate Doctor, rotates | dashboard `view`, schedule **`view`** |
| `tc` | Elizabeth Reyes | TC, Hobbs | schedule `view`, documents `add` |
| `staff` | Serenity Gonzales | Clinical Assistant, Carlsbad | schedule `view`, documents `view` |

Heather's title is exactly **"COO (Admin)"** — she is the COO *and* the app's administrator.
Not "Practice Administrator". Don't relabel her.

### Permission levels
`none < view < add < edit < manage` (`RANK`). Sections: `dashboard`, `production`, `schedule`,
`marketing`, `documents`, `team`, `admin`.
- `PH.can(section)` → level · `PH.atLeast(section,'edit')` → bool · `PH.offices()` → `'all'` or list.

**Each section only offers the levels that DO something** (`SEC_LEVELS` in admin.html; anything
stored outside the allowed set is clamped by `clampAccess()`). The user asked for this after I
admitted the grid was showing five choices where two or three were dead:

| Section | Choices offered | What they mean |
|---|---|---|
| Dashboard | None · View | View = see the numbers **for their offices** |
| Enter Production | None · **Enter** · **Enter + goals** | `edit` = type the actuals; `manage` = also set main/stretch goals |
| Schedule | None · View · Edit | View = read-only rota; Edit = assign doctors, hours, offices |
| Marketing | None · View · Edit | View = read-only board; Edit = move cards + score results |
| Directory (Team) | None · View | contact cards |
| Admin | None · **Full control** | a read-only admin console isn't a thing |
| **Document sections** | the full ladder | View · **Add files** · Edit · Manage — this is where "Add" earns its place |

Per-section wording lives in `SEC_SHORT` (grid square) and `SEC_DESC` (picker description).
The grid corner reads **"Teams ↓"** and the Team section's column is **"Directory"** — they used to
both say "Team" and were indistinguishable.

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
**Rebuilt visually 2026-08-08 on the `-3` workbook.** Their note: *"these people are used to looking
at numbers on an excel and are visual learners… lets make it visual, they want to pull it up and tell
without much reading."*
- **Two big mirrored gauges** (`gauge()` / `gauges()`) — 🦷 **Starts** and 💰 **Production** in the
  same visual language: huge number, huge %, a fat progress bar with a **GOAL** mark and (production)
  a **STRETCH** mark, a colour band (green ≥100 / amber ≥90 / red below) and a one-line verdict
  ("✅ 28 starts ahead of goal"). The wall of small KPI tiles is gone.
- **Goals live in the same tile in small type** — "Main goal $1.51M · Stretch $1.67M (100% there)",
  plus **per day vs needed per day** for both metrics (their sheet tracks both) and days worked.
- **CELEBRATIONS** (`v1/celebrate.js`, canvas, no libraries): **fireworks** when the main goal is hit
  (their row 18), **confetti** for stretch, **both** when both. Fires once per office+period per
  session (`partied` Set) plus a **"Celebrate again"** button on the banner. Works on every office
  page *and* All Offices. Today: Carlsbad, Cruces LCO and San Angelo hit both; the group, Clovis and
  Hobbs hit main; Cruces FFO, Lubbock and Mansfield hit neither — a good spread for the demo.
- **"This month" = the newest month with any production that isn't fully worked** (`partial()`).
  It used to require `0 < done < days`, which broke for **Clovis and Hobbs**: they had August
  production but hadn't typed in any completed days, so the dashboard fell back to showing **July**
  while every other office showed August. When days worked aren't logged, the month is still "this
  month" but goals are **not** pace-scaled — it compares against the whole-month goal and says
  "days worked not logged yet" so nobody misreads a low percentage.
- **Partial months are handled honestly.** August is part-worked, so `live()` counts only **finished**
  months for the year, `partial()` finds the in-progress one, and in MTD view `paceRatio()` scales
  the goal to the days actually worked — otherwise every office looks catastrophic on the 2nd of the
  month. The wording switches to "ahead/behind **pace**" and shows "4 of 8 days".

**Round 2 of their feedback (2026-08-08):**
- **Production days** is one visual line (`daysTiles` → `.daycard`): "52 of 52 days worked" + a bar +
  a % + day pips when the count is small. The "days left remaining this year" tile is **gone**.
- **Starts chart now has last-year bars**, same as production, and the **starts/production toggle**
  sits on that one chart. Their words: *"comparison vs last year less important for lower level
  staff, but needs to be there"* — so it lives on the bottom chart, not in the headline tiles.
- **Look back at any finished month** — a "Look back at a month…" select next to This month /
  Year to date. A past month is judged against its **full** goal (no pace scaling).
- **Combine offices** — "➕ Combine offices" turns the chips into multi-select. **Bug fixed
  2026-08-08:** `isAll` (sel==='ALL') took precedence over combine mode, so starting from the
  All Offices tab the chips never selected and the view never changed. `isAll` is now
  `sel==='ALL' && !combine`, chip state reads from `combined` whenever combining, and picking
  nothing shows a "pick the offices you want to add together" prompt. It picking Carlsbad +
  Clovis + Hobbs shows one combined set of numbers and one combined celebration. **Permissioning is
  implicit**: you can only combine offices you can already see, so a single-office manager has
  nothing to combine and leadership can combine anything. No new permission level was invented.
- **Starts stretch is DERIVED.** Their workbook has no starts stretch goal, so it uses the same reach
  as production (`stretchRatio = production stretch ÷ production goal`) — e.g. San Angelo goal 310 →
  stretch 341. If they add a real starts stretch row, use theirs instead.
- **Last-year starts are DERIVED too**: 2025 production ÷ 2025 average case fee (+ Medicaid at its
  own fee). Stated in the chart legend. No such row exists in the workbook.
- Gauge marker labels are staggered when GOAL and STRETCH are close — they used to overlap and read
  as "GOALSTRETCH", which is why they thought stretch was missing.
- **Bug fixed:** All Offices showed **January** as the current month, because the group summed every
  office's scheduled days including months they never reported. `group()` now rolls up only each
  office's finished months plus its in-progress one.

#### (previous notes)
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
- **Workbook reconciliation (re-checked on the `-3` file, 2026-08-08):** the earlier "total skips
  Mansfield" error is **FIXED** in their new version — January to June now match the eight office
  tabs **to the cent**. What remains is **July $16,273 low** and **August $26,638 high** on the
  Dashboard tab versus the office tabs, most likely a total not yet stretched across the two Cruces
  columns. The page footer says exactly this. **Re-verify this claim whenever they send a new
  workbook — do not leave a stale accusation on screen.**

### 5b. `v1/production.html` — Enter Production
- Four boxes: TC net production, Medicaid (if the office bills it), adjustments, completed days.
  Maths (totals, % of main, % of stretch, per-day) updates live.
- **Editing dashboard data is a permission** (their words): `production` `edit` = type the monthly
  actuals; **`manage` = also set the main and stretch goals**. Without `manage` the goal boxes render
  as locked read-only inputs reading *"Set by leadership — you can't change this."*
- **Medicaid is a COUNT × a CASE FEE**, not a dollar entry (their ask, and how the workbook works:
  row 6 × row 42 = row 17). The form takes **Medicaid starts** and shows a live
  "16 starts × $4,200 = $67,200" line. The **case fee is leadership-only** (`canGoals()`, i.e.
  `manage`) and applies to **every month at that office**; managers see it locked.
- Edits persist to `localStorage.ph_prod` as `{tc,mds,fee,adj,dys,goal,str,_total,_days,_goal}`;
  `index.html` applies `_total`/`_days`/`_goal` on load. **Store the computed `_total`** — deriving
  it in the dashboard silently dropped the Medicaid portion once.

### 5c. `v1/schedule.html` — Schedule (rebuilt 2026-08-08)
**The OFFICE carries the colour, not the doctor** — their explicit instruction. `PALETTE` holds the
exact colours they named: Carlsbad **Hot Pink**, Mansfield **Purple**, San Angelo **Sky Blue**,
Clovis **Highlighter Orange**, Hobbs **Lime Green**, Lubbock **Highlighter Yellow**,
Cruces LCO **Light Pink**, Cruces FFO **Light Orange**. **Doctors have no colour** and no colour
picker — a day is tinted by its office.

**Date-keyed model** (this is why it was rebuilt): `sched['2026-08-10']['Carlsbad'] = {p,s,e} |
{ydot:true} | {closed:true}`, persisted to `localStorage.ph_sched`. The old model was one generic
week, which could never hold a year.

- **Opens on MONTH view** — that's where she works. Week is kept for day-to-day detail.
- **Yellow Dot / Closed are one tap from the calendar.** `+ Add / set day` on any month day opens the
  office picker, and each office row has **Yellow Dot** and **Closed** buttons (`quick()`) beside it,
  so a day can be set without going through the doctor step. The full editor still offers both too.
- **Filter by office AND/OR doctor** — both filters work in either view.
- **Yellow Dot Day de-select closes the office** (`markYdot`): tapping it once sets Yellow Dot,
  tapping again turns it off and sets **Closed**. Yellow Dot = open, no doctor; Closed = not open.
- **Half day is 8:00–2:00** (`HALF`), with a one-tap button (plus Full day 8–5).
- **Lunch is optional** — an office can have **no set lunch** (`lunch:null`, shown as "no set lunch").
  Lubbock and Cruces FFO are seeded that way.
- **No "build out the year" button** — they didn't want it. `buildYear()` survives only as the demo
  **seed** so the calendar isn't empty. The way you actually build the calendar is **Month view →
  `+ Add` on any day → pick the office → pick the doctor and hours** (`addTo`). She will live in
  Month view, so that flow is the primary one.
- `PATTERN` deliberately leaves some open days with **nobody rostered** (Clovis Sat, Lubbock Fri,
  Cruces FFO Sat) so real **Yellow Dot Days** appear — previously every day was covered and she
  couldn't see the feature. Yellow Dot is bright `#FDE047` with a dot marker in both views, and
  there's a colour key above the board.
- **Counters** (`tally`): doctor days per doctor, days covered per office, and doctor×office — each
  for **the displayed month and the whole year**, with bars.
- Availability guard still applies: a doctor already booked elsewhere that date is greyed out.
- Read-only enforcement unchanged (`canEdit`, view-only banner, hidden add/build buttons).

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
- **Live two-way sync viewer** (`openDoc`): two panes ("In Home-Brace" / "Microsoft drive") over
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
   → pick** (choices vary per section, see above). A person on two teams gets the **best** level.
   **Teams are editable**: "+ Add team", and a ✎ on each row to rename or delete. `TEAMS` is
   persisted to `ph_teams`; renaming rewrites the team on every user and every section audience.
   **A new team appears as a row immediately; a new document section appears as a column
   immediately** (both verified) — that's the whole point of the grid.
3. **Document Sections** — create/edit/delete sections: name, icon, structure
   (`plain` | `byLocation` → auto folder per office | `byBrand`), plus audience
   (`locMode`/`locs` + `teamMode`/`teams`). **+ Add file asks who can open it** before saving,
   defaulting to the folder and warning when it's an exception. Persisted to `ph_docsecs`, so new
   sections appear in Documents and as matrix columns immediately. "Reset to defaults" for demos.
4. **Locations** — the practice is expanding, so admins add offices themselves (name, brand, state,
   time zone). **States are all 50 + DC, spelled out** (`STATES`); **time zones are spelled out**
   (`TZS`: Eastern/Central/Mountain/Mountain-Arizona/Pacific/Alaska/Hawaii) with `TZSHORT` for the
   compact badges on the schedule board. Both are `<select>`s, not chips — 51 chips is not a UI.
   `LOCS`, `DEFAULT_LOCS`, persisted to `ph_locations`. **Always call `LOCATIONS_OF()` /
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

### Every section must actually enforce its level
Gaps found by auditing rather than by the user, and now closed: **Marketing had no enforcement at
all** (anyone who could open the board could drag cards and score results). It now gates
`add`/`open`/`move`/`dropTo`/`pickRes`, drops `draggable`, hides the arrows, the "+ Add" buttons and
"+ New idea", renders result chips as `<span>` not `<button>`, and shows the read-only banner.
**When adding any new interactive surface, gate it the same way.**

### One gate, in user.js — never per page
`PH.nav('<key>')` (which every page already calls) runs `guard()`. If the person fails that
section's `show()` rule it paints a **"You don't have access"** panel and adds `body.ph-locked`;
CSS then hides every other child of `.wrap`, so it holds even if the page re-renders later.
**Hiding a nav tab is not access control** — anyone can type the URL. Audit 2026-08-08 found
Admin, Marketing, Documents and Team all fully readable that way (the Admin console handed out
every name and email). Any new page gets this free as long as it calls `PH.nav()`.
Note this is client-side only — right for a mockup, but the real build must enforce server-side.

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

**OPEN DECISION (2026-08-08):** the practice is deciding whether people can *also* be created
directly in the hub, or **only** in Microsoft. **Microsoft-only is confirmed; hub-side creation is
"maybe".** The mockup currently reflects Microsoft-only: Admin → People has no "+ Add person", just
a **"Someone missing?"** explainer (`whyNoAdd`). If they say yes to both, re-add a create flow there.

**THE HUB OWNS ITS OWN PERMISSIONS.** (Corrected 2026-08-08 — an earlier draft of this
file said permissions came from Entra security groups. That is WRONG and the user rejected it.)

- **The hub has its own user list, its own teams, its own access rules.** Everything in the Admin
  console — People, Teams & Access, Document Sections, Locations — is the hub's own data, managed by
  the practice, not mirrored from Microsoft. Do not push permission decisions into Entra groups.
- **Microsoft is used for exactly two things:**
  1. **Signing in.** "Sign in with Microsoft" (Entra ID) so nobody needs another password. Needs only
     the delegated `User.Read` scope.
  2. **Knowing a new person exists.** When IT creates a Microsoft account, that person should appear
     in the hub automatically.
- **How auto-creation works (recommended: both):**
  - **Just-in-time on first sign-in** — an unknown but valid Microsoft account signs in, the hub
    creates their record from the token (name, email), sets them to **no access**, and flags them in
    Admin for the admin to assign a team + location. Requires nothing from IT beyond sign-in.
  - **A periodic staff-list sync** (`User.ReadBasic.All`) so new hires appear in Admin *before* they
    first log in, and leavers show as inactive.
- **Offboarding is automatic:** disabling the Microsoft account blocks sign-in, so hub access ends
  without anyone touching the hub.
- **Which fields come from where:** name + email + (optionally) employee ID arrive from Microsoft at
  creation. **Team, location, status and every access level are the hub's own.** Preferred name,
  photo, phone and About me belong to the person.

| Mockup concept | Production reality |
|---|---|
| Sign-in | Entra ID (`User.Read` only) |
| New person appears | JIT on first sign-in + optional staff-list sync (`User.ReadBasic.All`) |
| Teams & access levels | **The hub's own data** — not Entra groups |
| Documents & folders | SharePoint document libraries; folder permissions per group/location |
| "Who can see this" | The hub decides (team AND location), then requests the file from SharePoint |
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

Answers to the friend's original 8 brief questions: `~/Downloads/Home-Brace - Response to Design
Brief.docx` (regenerate via the gitignored `build-response-doc.js`).

---

## 9. Status & open questions

**Done and verified:** everything in §5. Real production + starts data reconciled to their workbook;
real roster and roles; permissions enforced and location-scoped; profile with photo upload, preferred
name and editable phone; chained walkthroughs on all pages; admin can create sections and add
locations; mobile verified at 375px on every page.

### Workbook reconciliation — full re-audit 2026-08-17
Verified with a **label-driven** parser (row numbers differ between tabs — see below).
**44 series across all 8 offices, zero mismatches**: actual production, main goal, stretch goal,
scheduled days, completed days, Medicaid starts, last-year production, case fees.

**Two different tab layouts.** Carlsbad / Clovis / Cruces LCO / Hobbs carry Medicaid rows
("Total Production Goal (TC + Medicaid)"). Cruces FFO / Lubbock / Mansfield / San Angelo have no
Medicaid at all and use "2026 TC Production Goal". **Never read these tabs by row number** — an
earlier pass did and silently compared the wrong rows. Match on the column-A label.
Note Cruces FFO's tab is titled **"CRUCES (LEGACY)"**.

**In the workbook, deliberately NOT in the app** (raise with Heather before the build):
- **Roswell** — a 9th office named in 4 places on the Dashboard sheet, no tab, no data yet.
- **Retainer Insurance** — monthly count per office (Dashboard r45–54).
- **Average Production per Day: 2026 vs 2025 vs YOY** table (Dashboard r32–42).
- **2024 baseline** — 2024 net production, 2024 Medicaid production, 2024 production days.
- **Comfort/Rebond % of Total Appointments** and **OECD (Over Estimated Completion Date)**.
- **Total Starts / Total Debands / Difference** — YTD single values per office.
- **Number of NPE (2022)** — New Patient Exams, only on the Cruces FFO and Lubbock tabs.
- Five unlabelled numbers at Dashboard B26:B30 (look like case fees; nothing identifies them).

**Two judgement calls that need Heather's sign-off:**
1. **Starts are reconstructed, not read.** The workbook has **no monthly actual-starts row**.
   The dashboard's headline starts = derived goal + "Current # of Starts (Ahead/Behind) Goal".
   Verified to reproduce their figures exactly, but it is a derivation, not their data.
2. **Adjusted vs unadjusted production.** The app shows "Actual TC ONLY + Medicaid"; the workbook's
   own YOY growth % uses "TOTAL Adjusted Net Production" (which adds write-offs). Carlsbad February
   differs by $16,042 between the two. Which is "the" number is theirs to decide.

**Fixed 2026-08-17:** San Angelo works **half days** (January = 10.5 production days). Both arrays
had rounded it to 10, understating the month and skewing that office's per-day and pace maths.

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
