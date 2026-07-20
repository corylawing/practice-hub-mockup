/* Practice Hub — demo content + search index.
   This is the single place a "super user" would conceptually add items.
   `syn` = synonyms so search works even when people don't know the exact name
   (e.g. "vacation" finds the PTO Policy). In real SharePoint this maps to
   Microsoft Search bookmarks/acronyms — no metadata project required. */

const MODULES = [
  { key: "office",   label: "Manage My Office", href: "manage-my-office.html", icon: "office",
    desc: "Your daily workspace — KPIs, expenses, vendors, supplies." },
  { key: "hr",       label: "HR",               href: "hr.html",              icon: "hr",
    desc: "Handbook, PTO, benefits, policies & new-hire resources." },
  { key: "forms",    label: "Forms & Requests", href: "forms.html",           icon: "forms",
    desc: "Submit PTO, expense, IT, maintenance & other requests." },
  { key: "ops",      label: "Operations Manual",href: "operations.html",      icon: "ops",
    desc: "SOPs, checklists & training — how we do things here." },
  { key: "scorecards",label:"Scorecards & KPIs", href: "scorecards.html",      icon: "chart",
    desc: "Production, collections, conversion & office metrics." },
  { key: "calendars",label: "Schedule",           href: "calendars.html",       icon: "cal",
    desc: "Which office is open each day & who's working." },
  { key: "directory",label: "Directory",         href: "directory.html",       icon: "people",
    desc: "Searchable contacts for every office & team." },
  { key: "leadership",label:"Leadership",         href: "leadership.html",      icon: "lead", locked:true,
    desc: "Strategy, priorities & executive resources." },
  { key: "it",       label: "IT Help",           href: "it.html",              icon: "it",
    desc: "Get help, request access & find quick how-tos." },
];

/* Searchable resources across the hub */
const RESOURCES = [
  { t:"Employee Handbook 2026", d:"Policies, conduct & expectations", sec:"HR", href:"hr.html", ic:"doc",
    syn:["handbook","rules","conduct","policy manual"] },
  { t:"PTO Policy 2026", d:"Paid time off, accrual & how to request", sec:"HR", href:"hr.html", ic:"doc",
    syn:["pto","vacation","time off","sick","holiday","leave","days off"] },
  { t:"Submit a PTO Request", d:"Microsoft Form — request time off", sec:"Forms", href:"forms.html", ic:"lnk",
    syn:["pto","vacation","time off request","book days","request leave"] },
  { t:"Benefits Overview", d:"Health, dental, vision & 401(k)", sec:"HR", href:"hr.html", ic:"pdf",
    syn:["benefits","insurance","health","401k","retirement","medical"] },
  { t:"Holiday Schedule 2026", d:"Observed holidays & office closures", sec:"HR", href:"hr.html", ic:"doc",
    syn:["holidays","closures","days off","calendar"] },
  { t:"Expense Report", d:"Submit an expense for reimbursement", sec:"Forms", href:"forms.html", ic:"lnk",
    syn:["expense","reimbursement","receipt","spending","money back"] },
  { t:"Monthly KPI Template", d:"Office scorecard template", sec:"Manage My Office", href:"manage-my-office.html", ic:"xls",
    syn:["kpi","scorecard","metrics","numbers","report"] },
  { t:"Vendor Contact List", d:"Approved suppliers & reps", sec:"Manage My Office", href:"manage-my-office.html", ic:"xls",
    syn:["vendor","supplier","rep","contacts","ordering"] },
  { t:"Supply Ordering", d:"How to order clinical & office supplies", sec:"Manage My Office", href:"manage-my-office.html", ic:"lnk",
    syn:["supply","order","inventory","stock","reorder"] },
  { t:"Opening Checklist", d:"Daily office opening steps", sec:"Operations", href:"operations.html", ic:"doc",
    syn:["opening","open","morning","checklist","startup"] },
  { t:"Closing Checklist", d:"End-of-day closing steps", sec:"Operations", href:"operations.html", ic:"doc",
    syn:["closing","close","end of day","checklist","shutdown"] },
  { t:"Front Desk Procedures", d:"Check-in, scheduling & phones", sec:"Operations", href:"operations.html", ic:"doc",
    syn:["front desk","reception","check in","phones","schedule"] },
  { t:"New Hire Onboarding", d:"First-week guide for new employees", sec:"HR", href:"hr.html", ic:"doc",
    syn:["new hire","onboarding","training","first day","new employee"] },
  { t:"Maintenance Request", d:"Report a facilities or equipment issue", sec:"Forms", href:"forms.html", ic:"lnk",
    syn:["maintenance","repair","broken","facilities","fix","equipment"] },
  { t:"IT Request", d:"Get tech help or request access", sec:"Forms", href:"it.html", ic:"lnk",
    syn:["it","tech","computer","password","login","access","help"] },
  { t:"Marketing Request", d:"Request marketing or social support", sec:"Forms", href:"forms.html", ic:"lnk",
    syn:["marketing","social","ads","flyer","promotion","event"] },
  { t:"Office Budget", d:"Current monthly budget by office", sec:"Manage My Office", href:"manage-my-office.html", ic:"xls",
    syn:["budget","finance","spending","money"] },
  { t:"Practice Calendar", d:"Practice-wide events & key dates", sec:"Calendars", href:"calendars.html", ic:"lnk",
    syn:["calendar","schedule","events","dates"] },
  { t:"Quarterly Priorities — Q3 2026", d:"Leadership focus areas", sec:"Leadership", href:"leadership.html", ic:"doc",
    syn:["priorities","goals","strategy","quarter","okr"] },
  { t:"Staff Directory", d:"Find anyone across all 8 offices", sec:"Directory", href:"directory.html", ic:"lnk",
    syn:["directory","contact","phone","email","who","staff list"] },
];

/* ---- Document previews ----
   Each opens in a SharePoint-style preview so the demo never dead-ends.
   `body` is illustrative sample content. */
const DOCS = {
  "handbook": { t:"Employee Handbook 2026", fi:"doc", sec:"HR", updated:"Updated Jan 2026", type:"Word document",
    body:`<p class="lead">Welcome to Summit Orthodontics. This handbook explains what you can expect from us and what we ask of you.</p>
    <h4>1. Our mission</h4><p>To deliver exceptional orthodontic care while building a workplace people are proud of.</p>
    <h4>2. Hours & attendance</h4><p>Standard clinic hours are 8:00a–5:00p. Notify your office manager as early as possible if you'll be out — see the <b>PTO Policy</b> for how to request time off.</p>
    <h4>3. Conduct</h4><ul><li>Treat patients and teammates with respect.</li><li>Protect patient privacy at all times (HIPAA).</li><li>Keep work communication in Practice Hub / Teams, not personal text.</li></ul>
    <h4>4. Benefits</h4><p>Eligible employees receive health, dental, vision, and 401(k). See the <b>Benefits Overview</b> for details.</p>` },
  "pto-policy": { t:"PTO Policy 2026", fi:"doc", sec:"HR", updated:"Updated Jan 2026", type:"Word document",
    body:`<p class="lead">How paid time off is earned, requested, and approved.</p>
    <h4>Accrual</h4><p>Full-time employees accrue PTO each pay period based on tenure. Balances are visible on your paystub.</p>
    <h4>How to request</h4><p>Submit the <b>PTO Request form</b> from the Forms page at least two weeks in advance. Your office manager is notified automatically and approves in the system — no more texting.</p>
    <h4>Holidays</h4><p>Observed holidays are listed on the Holiday Schedule and do not count against PTO.</p>` },
  "benefits": { t:"Benefits Overview 2026", fi:"pdf", sec:"HR", updated:"Updated Feb 2026", type:"PDF",
    body:`<p class="lead">A summary of the benefits available to eligible employees.</p>
    <div class="kv"><span>Medical</span><span>3 plan options · coverage starts day 31</span><span>Dental</span><span>100% preventive, in-house discount</span><span>Vision</span><span>Annual exam + materials allowance</span><span>401(k)</span><span>Match up to 4% after 90 days</span><span>Life</span><span>Employer-paid basic life</span></div>
    <h4>Questions?</h4><p>Reach out through the HR section or submit an IT/HR request.</p>` },
  "holiday-schedule": { t:"Holiday Schedule 2026", fi:"doc", sec:"HR", updated:"Updated Jan 2026", type:"Word document",
    body:`<p class="lead">Paid holidays observed across all offices in 2026.</p>
    <ul><li>New Year's Day</li><li>Memorial Day</li><li>Juneteenth</li><li>Independence Day</li><li>Labor Day</li><li>Thanksgiving (Thu & Fri)</li><li>Christmas Eve & Christmas Day</li></ul>` },
  "new-hire": { t:"New Hire Onboarding Guide", fi:"doc", sec:"HR", updated:"Updated Mar 2026", type:"Word document",
    body:`<p class="lead">Your first week, step by step.</p>
    <h4>Day 1</h4><ul><li>Get your Practice Hub login and install Teams on your phone.</li><li>Meet your office manager and team.</li><li>Review the Employee Handbook.</li></ul>
    <h4>Week 1</h4><ul><li>Complete required training in the Operations Manual.</li><li>Shadow your role's daily checklist.</li></ul>` },
  "code-of-conduct": { t:"Code of Conduct", fi:"pdf", sec:"HR", updated:"Updated Jan 2026", type:"PDF",
    body:`<p class="lead">The standards we hold ourselves to.</p><ul><li>Patient safety and privacy come first.</li><li>Be honest, professional, and kind.</li><li>Speak up about concerns — leadership is listening.</li></ul>` },
  "policies": { t:"HR Policies", fi:"doc", sec:"HR", updated:"Updated 2026", type:"Document set",
    body:`<p class="lead">Current HR policies, all in one place.</p><ul><li>Attendance & punctuality</li><li>Dress code & PPE</li><li>Social media</li><li>Harassment & reporting</li><li>Performance review process</li></ul>` },

  "kpi-template": { t:"Monthly KPI Scorecard Template", fi:"xls", sec:"Manage My Office", updated:"Updated Jun 2026", type:"Excel template",
    body:`<p class="lead">The standard monthly scorecard every office completes.</p>
    <div class="kv"><span>Production</span><span>$ for the month</span><span>Collections</span><span>$ collected</span><span>Conversion %</span><span>Consults → starts</span><span>New starts</span><span># of new cases</span><span>No-show rate</span><span>% of appts</span></div>
    <p>Fill this in monthly; the COO rolls all offices into the practice dashboard.</p>` },
  "budget": { t:"Office Budget 2026", fi:"xls", sec:"Manage My Office", updated:"Updated Jun 2026", type:"Excel workbook",
    body:`<p class="lead">Your office's monthly operating budget vs. actual.</p>
    <div class="kv"><span>Supplies</span><span>$6,500 / mo</span><span>Lab</span><span>$9,200 / mo</span><span>Marketing</span><span>$3,000 / mo</span><span>Facilities</span><span>$2,400 / mo</span></div>
    <p>Submit anything over budget through the Expense form for approval.</p>` },
  "vendor-list": { t:"Vendor Contact List", fi:"xls", sec:"Manage My Office", updated:"Updated May 2026", type:"Excel workbook",
    body:`<p class="lead">Approved suppliers and reps for all offices.</p>
    <div class="kv"><span>Brackets/Wire</span><span>OrthoSupply Co — Rep: M. Diaz</span><span>Aligners</span><span>ClearPath Labs</span><span>Office supplies</span><span>Staples Business</span><span>IT/Equipment</span><span>TechCare Managed Services</span></div>` },
  "supply-guide": { t:"Supply Order Guide", fi:"pdf", sec:"Operations", updated:"Updated Apr 2026", type:"PDF",
    body:`<p class="lead">How to order clinical and office supplies.</p>
    <h4>Steps</h4><ul><li>Check the par levels sheet before ordering.</li><li>Place orders by the Friday cutoff.</li><li>Log the order in the office budget tracker.</li></ul>` },
  "opening-checklist": { t:"Opening Checklist", fi:"doc", sec:"Operations", updated:"Updated Mar 2026", type:"Checklist",
    body:`<p class="lead">Complete every morning before the first patient.</p>
    <ul><li>Disarm alarm, unlock, lights on</li><li>Power on computers & imaging</li><li>Review today's schedule and huddle</li><li>Sterilization area ready</li><li>Front desk float counted</li></ul>` },
  "closing-checklist": { t:"Closing Checklist", fi:"doc", sec:"Operations", updated:"Updated Mar 2026", type:"Checklist",
    body:`<p class="lead">Complete every evening after the last patient.</p>
    <ul><li>Confirm tomorrow's schedule & confirmations sent</li><li>Run end-of-day reports</li><li>Sterilize & restock operatories</li><li>Secure cash/float</li><li>Lights off, set alarm, lock up</li></ul>` },
  "manager-notes": { t:"Manager Meeting Notes — Jun 24", fi:"doc", sec:"Manage My Office", updated:"Jun 24, 2026", type:"Meeting notes",
    body:`<p class="lead">Weekly office manager sync.</p>
    <h4>Updates</h4><ul><li>New PTO form is live — push your teams to use it.</li><li>Supply cutoff moving to Thursdays next month.</li></ul>
    <h4>Action items</h4><ul><li>Each office: post Q3 priorities in the break room.</li><li>Submit June scorecards by the 5th.</li></ul>` },

  "front-desk": { t:"Front Desk Procedures", fi:"doc", sec:"Operations", updated:"Framework", type:"SOP collection",
    body:`<p class="lead">Standard procedures for the front desk. This section grows over time — here's the starting framework.</p>
    <ul><li>New patient check-in</li><li>Insurance verification</li><li>Phone & scheduling scripts</li><li>End-of-day reconciliation</li></ul>
    <p><i>More front-desk SOPs will be added here as they're documented.</i></p>` },
  "scheduling": { t:"Scheduling Procedures", fi:"doc", sec:"Operations", updated:"Framework", type:"SOP collection",
    body:`<p class="lead">How we book and manage the schedule.</p><ul><li>Template & block scheduling</li><li>Handling cancellations & no-shows</li><li>Recall & reactivation</li></ul><p><i>Framework — more to come.</i></p>` },
  "clinical": { t:"Clinical Procedures", fi:"doc", sec:"Operations", updated:"Framework", type:"SOP collection",
    body:`<p class="lead">Chairside and clinical workflows.</p><ul><li>Sterilization & infection control</li><li>Bonding / debonding setup</li><li>Records & imaging</li></ul><p><i>Framework — more to come.</i></p>` },
  "financial": { t:"Financial Procedures", fi:"doc", sec:"Operations", updated:"Framework", type:"SOP collection",
    body:`<p class="lead">Billing, collections, and posting.</p><ul><li>Insurance verification SOP</li><li>Payment posting</li><li>Contracts & financing</li></ul><p><i>Framework — more to come.</i></p>` },
  "office-mgmt": { t:"Office Management Procedures", fi:"doc", sec:"Operations", updated:"Framework", type:"SOP collection",
    body:`<p class="lead">Daily operations and facilities.</p><ul><li>Opening & closing checklists</li><li>Supply ordering</li><li>Equipment & maintenance</li></ul><p><i>Framework — more to come.</i></p>` },
  "training-videos": { t:"Training Videos", fi:"vid", sec:"Operations", updated:"Updated 2026", type:"Video library",
    body:`<p class="lead">Short how-to videos by topic.</p><ul><li>New patient check-in (3 min)</li><li>Using Practice Hub on your phone (4 min)</li><li>Sterilization walkthrough (6 min)</li></ul>` },
  "checkin-video": { t:"New Patient Check-In (video)", fi:"vid", sec:"Operations", updated:"Updated 2026", type:"Training video",
    body:`<p class="lead">▶ A 3-minute walkthrough of the front-desk check-in process.</p><p style="background:#0F2A4A;color:#cdd9ea;border-radius:10px;padding:40px;text-align:center">▶ Video player (sample)</p>` },
  "insurance-sop": { t:"Insurance Verification SOP", fi:"pdf", sec:"Operations", updated:"Apr 2026", type:"SOP",
    body:`<p class="lead">Verify benefits before the first visit.</p><ul><li>Collect insurance info at booking</li><li>Verify eligibility & ortho benefit</li><li>Record max, percentage, and remaining benefit</li></ul>` },
  "sterilization-sop": { t:"Sterilization Procedure", fi:"doc", sec:"Operations", updated:"2026", type:"Clinical SOP",
    body:`<p class="lead">Infection-control standard for all operatories.</p><ul><li>PPE on, surfaces barrier-wrapped</li><li>Instruments cleaned, bagged, autoclaved</li><li>Spore testing logged weekly</li></ul>` },

  "strategic-plan": { t:"Strategic Plan 2026–2028", fi:"pdf", sec:"Leadership", updated:"Feb 2026", type:"PDF", locked:true,
    body:`<p class="lead">Our three-year direction. Restricted to leadership.</p>
    <h4>Vision</h4><p>Grow from 8 to 12 offices while keeping a consistent, high-trust patient experience.</p>
    <h4>Pillars</h4><ul><li>Standardize operations across all locations</li><li>Invest in team development & retention</li><li>Modernize systems (Practice Hub is step one)</li></ul>` },
  "quarterly-priorities": { t:"Quarterly Priorities — Q3 2026", fi:"doc", sec:"Leadership", updated:"Jun 2026", type:"Word document", locked:true,
    body:`<p class="lead">Where leadership is focused this quarter.</p>
    <h4>Q3 focus areas</h4><ul><li>Launch Practice Hub to all 8 offices</li><li>Move work communication off personal text → Teams</li><li>Standardize the monthly KPI scorecard</li><li>Hire & onboard 2 treatment coordinators</li></ul>` },
  "financial-reports": { t:"Consolidated Financials — May 2026", fi:"xls", sec:"Leadership", updated:"Jun 2026", type:"Excel workbook", locked:true,
    body:`<p class="lead">Practice-wide financial summary. Restricted to leadership.</p>
    <div class="kv"><span>Production</span><span>$842,000</span><span>Collections</span><span>$791,000</span><span>Collection rate</span><span>94%</span><span>Overhead</span><span>58%</span></div>
    <p>Per-office detail is in the Scorecards section.</p>` },
  "leadership-notes": { t:"Leadership Meeting Notes — Jun 2026", fi:"doc", sec:"Leadership", updated:"Jun 2026", type:"Meeting notes", locked:true,
    body:`<p class="lead">Monthly leadership meeting.</p><h4>Decisions</h4><ul><li>Approved Practice Hub rollout plan.</li><li>Set Q3 priorities (see Quarterly Priorities).</li></ul>` },

  "doctor-calendars": { t:"Doctor Calendars", fi:"lnk", sec:"Calendars", updated:"How this works", type:"Personal calendars",
    body:`<p class="lead">Where each doctor is <b>working</b> is shown on the weekly board above — that's the practice-wide rotation.</p>
    <h4>Each doctor's personal calendar</h4><p>For their own day-to-day (appointments, meetings, time off), each doctor keeps a personal Microsoft 365 (Outlook) calendar. In the real build you'd open a doctor's calendar right here.</p>
    <h4>Tip</h4><p>To see everywhere a specific doctor works this week, use the <b>“Highlight a doctor”</b> filter at the top of this page.</p>` },
  "practice-events": { t:"Practice Events", fi:"lnk", sec:"Calendars", updated:"Updated weekly", type:"Shared calendar",
    body:`<p class="lead">Practice-wide events and key dates everyone should know.</p>
    <ul><li>All-staff call — last Wednesday monthly</li><li>Office manager meeting — every other Wednesday</li><li>Supply order cutoff — Fridays</li><li>Q3 planning offsite — Aug 14</li><li>Staff appreciation lunch — Jul 25</li></ul>
    <p>In the real build this is a shared Microsoft 365 group calendar everyone can subscribe to.</p>` },
};

/* ---- Forms (Microsoft Forms-style intake) ---- */
const FORMS = {
  "pto": { t:"Time Off (PTO) Request", routesTo:"your office manager",
    fields:[ {l:"Type of time off", type:"select", req:true, opts:["Vacation","Sick","Personal","Bereavement"]},
      {l:"Start date", type:"date", req:true}, {l:"End date", type:"date", req:true},
      {l:"Notes for your manager", type:"textarea"} ] },
  "expense": { t:"Expense Report", routesTo:"the finance team",
    fields:[ {l:"Expense description", type:"text", req:true}, {l:"Amount ($)", type:"text", req:true},
      {l:"Category", type:"select", opts:["Supplies","Lab","Marketing","Travel","Other"]},
      {l:"Receipt", type:"file"} ] },
  "maintenance": { t:"Maintenance Request", routesTo:"facilities",
    fields:[ {l:"Office", type:"select", req:true, opts:["Summit North","Summit South","Summit East","Summit West"]},
      {l:"What needs attention?", type:"textarea", req:true}, {l:"Urgency", type:"select", opts:["Low","Normal","Urgent"]} ] },
  "it": { t:"IT Request", routesTo:"IT support",
    fields:[ {l:"What do you need help with?", type:"select", req:true, opts:["Password / login","New equipment","Access to something","Something is broken","Other"]},
      {l:"Describe the issue", type:"textarea", req:true} ] },
  "marketing": { t:"Marketing Request", routesTo:"the marketing team",
    fields:[ {l:"Request type", type:"select", opts:["Social post","Flyer / print","Event support","Other"]},
      {l:"Details", type:"textarea", req:true}, {l:"Needed by", type:"date"} ] },
  "equipment": { t:"Equipment Request", routesTo:"your office manager",
    fields:[ {l:"Item needed", type:"text", req:true}, {l:"Reason", type:"textarea"} ] },
  "new-employee": { t:"New Employee Request", routesTo:"HR & leadership",
    fields:[ {l:"Role", type:"text", req:true}, {l:"Office", type:"select", opts:["Summit North","Summit South","Summit East","Summit West"]},
      {l:"Why is this role needed?", type:"textarea", req:true} ] },
  "travel": { t:"Travel Request", routesTo:"your office manager",
    fields:[ {l:"Destination / purpose", type:"text", req:true}, {l:"Dates", type:"text"}, {l:"Estimated cost", type:"text"} ] },
};

/* ---- Office & Doctor rotation ----
   In the real build this is ONE SharePoint List (Office, Day, Open?, Doctor, Hours)
   shown as the weekly board below + per-office and per-doctor filtered views.
   Cell = null (closed) or {dr, hrs}. Day order: Mon→Sat. */
const SCHED_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat"];
const WK = "8:00a–5:00p", SAT = "8:00a–1:00p";
const SCHEDULE = {
  "Summit North":     [{dr:"Dr. Chen",hrs:WK}, null, {dr:"Dr. Rao",hrs:WK}, null, {dr:"Dr. Chen",hrs:WK}, null],
  "Summit South":     [{dr:"Dr. Rao",hrs:WK}, null, {dr:"Dr. Chen",hrs:WK}, null, null, {dr:"Dr. Lopez",hrs:SAT}],
  "Summit East":      [null, {dr:"Dr. Chen",hrs:WK}, null, {dr:"Dr. Rao",hrs:WK}, null, null],
  "Summit West":      [null, {dr:"Dr. Rao",hrs:WK}, null, {dr:"Dr. Chen",hrs:WK}, null, null],
  "Summit Downtown":  [{dr:"Dr. Mehta",hrs:WK}, null, {dr:"Dr. Lopez",hrs:WK}, null, {dr:"Dr. Rao",hrs:WK}, null],
  "Summit Lakeside":  [null, {dr:"Dr. Mehta",hrs:WK}, null, {dr:"Dr. Ford",hrs:WK}, {dr:"Dr. Mehta",hrs:WK}, null],
  "Summit Hilltop":   [{dr:"Dr. Lopez",hrs:WK}, null, {dr:"Dr. Mehta",hrs:WK}, null, {dr:"Dr. Ford",hrs:WK}, null],
  "Summit Riverside": [null, {dr:"Dr. Ford",hrs:WK}, null, {dr:"Dr. Lopez",hrs:WK}, null, {dr:"Dr. Mehta",hrs:SAT}],
};

/* Demo directory rows */
const PEOPLE = [
  ["Jordan Avery","COO","All Offices","(555) 100-2001","javery@summitortho.example","Leadership"],
  ["Dr. Maya Chen","Owner Doctor","Summit North","(555) 100-2002","mchen@summitortho.example","Clinical"],
  ["Dr. Patel Rao","Owner Doctor","Summit South","(555) 100-2003","prao@summitortho.example","Clinical"],
  ["Tasha Brooks","Office Manager","Summit North","(555) 100-2010","tbrooks@summitortho.example","Operations"],
  ["Liam Ortiz","Office Manager","Summit South","(555) 100-2011","lortiz@summitortho.example","Operations"],
  ["Priya Nair","Treatment Coordinator","Summit North","(555) 100-2020","pnair@summitortho.example","Clinical"],
  ["Sam Whitfield","Clinic Lead","Summit West","(555) 100-2021","swhitfield@summitortho.example","Clinical"],
  ["Dana Kim","Marketing","All Offices","(555) 100-2030","dkim@summitortho.example","Marketing"],
  ["Carlos Mendez","Office Manager","Summit East","(555) 100-2012","cmendez@summitortho.example","Operations"],
  ["Rachel Goldberg","Treatment Coordinator","Summit South","(555) 100-2022","rgoldberg@summitortho.example","Clinical"],
];
