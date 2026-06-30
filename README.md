# Practice Hub — Interactive Mockup

A clickable prototype of **Practice Hub**, a centralized "digital front door" intranet for a
multi-office orthodontic practice. Built to look and feel like the proposed
**Microsoft SharePoint communication site** so non-technical stakeholders can react to the
*experience* before anything is built for real.

> ⚠️ **Prototype only.** Sample content and placeholder branding ("Summit Orthodontics").
> This is not a live system and contains no real practice data.

## What it demonstrates

- **Homepage dashboard** that answers *"What do I need today?"* — announcements, big icon tiles, quick links
- **Plain-language navigation** (Manage My Office, HR, Forms, Calendars…) — no Microsoft jargon
- **Demo search** with synonyms — typing *vacation* finds the *PTO Policy* (press `/` or `⌘K`, or tap the search bar)
- **Mobile-first** responsive layout (collapsing nav, touch-friendly tiles)
- **Consistent page layouts** across every module
- **Permission model made visible** — Leadership shown as a separate restricted area
- **Phasing** — Scorecards/KPIs marked as a Phase 2 concept

## Mapping to the real Microsoft build

| Mockup element | Real Microsoft 365 implementation |
|---|---|
| Homepage + module pages | SharePoint **communication site** (hub site) with modern pages |
| Restricted Leadership area | Separate SharePoint site joined to the hub (site-level security) |
| Forms & Requests | **Microsoft Forms** (→ optionally Lists + Power Automate later) |
| Directory | A single **Microsoft List** |
| Calendars | Shared **Microsoft 365 group calendars**, surfaced in Teams |
| Search + synonyms | Built-in SharePoint search + **Microsoft Search bookmarks** |
| Communication | **Microsoft Teams** (one staff team + a private leadership team) |

## Run locally

Just open `index.html` in a browser — it's static HTML/CSS/JS, no build step.

## Structure

```
index.html              Homepage dashboard
manage-my-office.html    Office manager workspace (the proposed "start here")
hr.html / forms.html / directory.html / operations.html
scorecards.html / calendars.html / leadership.html / it.html
assets/styles.css        Design system (navy structure, teal accent)
assets/app.js            Shared header/nav/footer + search + filters
assets/data.js           Demo content + search index (synonyms live here)
```
