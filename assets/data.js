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
  { key: "calendars",label: "Calendars",         href: "calendars.html",       icon: "cal",
    desc: "Practice, doctor & holiday schedules in one place." },
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
