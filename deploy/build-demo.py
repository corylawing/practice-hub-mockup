#!/usr/bin/env python3
"""THE PUBLIC DEMO (25/11/2026, Cory: "It needs to be demoable for other practices to see what they can do").

Builds demo/ - the whole Home-Brace app as it is in the sandbox (v1/), for a MADE-UP practice:
  * every real office, doctor, staff member, brand, email domain and host is swapped for an invented one (MAP below);
  * no Microsoft sign-in: demo-shim.js signs in a pretend admin and answers Microsoft itself - nothing leaves the browser;
  * the sandbox banners read "DEMO", with a "Start over" button; whatever a visitor does stays in their own browser,
    kept apart from the sandbox's (same website, different saved-data names).
It is a COPY, never edited by hand: change v1/, then run this again. Production never ships demo/
(deploy-production.sh copies v1/ and assets/ only).

Safety: it copies only files git tracks (never snapshot.json, _people.json or anything else kept off GitHub), drops the
pages that only make sense with the real practice, and REFUSES to finish if any real name is left anywhere in demo/ -
checked against the list below AND, on Cory's Mac, against the practice's real roster (v1/_people.json, never in git).

    python3 deploy/build-demo.py          # builds demo/ and checks it
"""
import json, os, re, shutil, subprocess, sys, time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, 'v1')
OUT = os.path.join(REPO, 'demo')
SHIM = os.path.join(REPO, 'deploy', 'demo-shim.js')

# Pages that only make sense with the real practice (setup checkers, restore, the real OrthoFi link, the sign-in
# landing page, the Excel guide whose pictures show real figures). Links to them are switched off in the copy.
SKIP_PAGES = {'alerts-test.html', 'alerts-test.webmanifest', 'connect.html', 'restore.html', 'datepick-demo.html',
              'guide-production.html', 'orthofi.html', 'auth.html'}
SKIP_DIRS = ('guide/',)
# The sandbox's tray photo says the real office; the portfolio's redrawn one says Lakeview (= Hobbs below).
SWAP_FILES = {'chat-demo/trays.jpg': os.path.join(REPO, 'demo-chat', 'trays.jpg')}

# REAL -> MADE-UP. Longest first is handled automatically. Each pair also covers its lower-case, UPPER-case and
# no-space lower-case forms ("San Angelo" -> "sanangelo"), so data keys stay consistent across every file.
MAP = [
  # practice names, brands, domains, hosts
  ('Farnsworth Legacy', 'Brightline Legacy'),
  ('Farnsworth Family Orthodontics', 'Brightline Family Orthodontics'),
  ('Farnsworth Orthodontics', 'Brightline Orthodontics'),
  ('Las Cruces Orthodontics', 'Riverbend Orthodontics'),
  ('Sunflower Orthodontics', 'Maple Orthodontics'),
  ('Omega Orthodontics', 'Brightline Orthodontics'),
  ('farnsworthorthodontics.com', 'brightline.example'),
  ('ffortho.com', 'brightline.example'),
  ('fortholascruces.com', 'brightline.example'),
  ('lascrucessmiles.com', 'riverbend.example'),
  ('sunflowerorthomansfield.com', 'maple.example'),
  ('omegaorthodontics.sharepoint.com', 'brightline.sharepoint.example'),
  ('omegaorthodontics', 'brightline'),
  ('kind-hill-00da87410-alerts.centralus.3.azurestaticapps.net', 'alerts.brightline.example'),
  ('kind-hill-00da87410.3.azurestaticapps.net', 'app.brightline.example'),
  ('kind-hill-00da87410', 'brightline-app'),
  ('Zihua Partners', 'Keystone Partners'),
  ('Zihua', 'Keystone'),
  ('Sunflower', 'Maple'),
  ('FOLC', 'BRB'),
  ('FFO', 'BFO'),
  ('LCO', 'RBO'),
  ('SUN', 'MPL'),
  # offices (Hobbs -> Lakeview so the chat's tray photo matches)
  ('Cruces FFO', 'Riverbend'),
  ('Cruces LCO', 'Meadow Park'),
  ('Las Cruces', 'Riverbend'),
  ('Cruces', 'Riverbend'),
  ('San Angelo', 'Brookside'),
  ('Carlsbad', 'Cedar Grove'),
  ('Hobbs', 'Lakeview'),
  ('Clovis', 'Northpoint'),
  ('Lubbock', 'Westfield'),
  ('Mansfield', 'Hillcrest'),
  # doctors and people (names that are already in the public sandbox's files)
  ('Dr. David Farnsworth', 'Dr. Maya Chen'),
  ('David Farnsworth', 'Maya Chen'),
  ('Dr. Farnsworth', 'Dr. Chen'),
  ('Farnsworth', 'Brightline'),
  ('Corey Lawing', 'Jordan Avery'),
  ('Cory Lawing', 'Jordan Avery'),
  ('Lawing', 'Avery'),
  ('Corey', 'Jordan'),
  ('Cory', 'Jordan'),
  ('Heather', 'Morgan'),
  ('Selene', 'Renee'),
  ('Jessica', 'Jamie'),
  ('Noemi', 'Nora'),
  ('Elizabeth', 'Elise'),
  ('Adam', 'Evan'),
  ('Keanu', 'Kendall'),
  ('Jenny', 'Jules'),
  ('Alyssa', 'Alana'),
  ('Smith', 'Parker'),
  ('Reyes', 'Ramsey'),
  ('Melinda', 'Marlene'),
  ('Tavarez', 'Talbot'),
  ('Lily', 'Ivy'),
  ('Garcia', 'Grant'),
  ('Espinosa', 'Easton'),
  ('Alexandra', 'Alexis'),
  ('Lexi', 'Tess'),
  ('Maria', 'Marina'),
  ('David', 'Dylan'),
  ('Jae', 'Patel'),
  ('Mia', 'Zoe'),
  ('Yessenia', 'Yolanda'),
  ('Rebecca', 'Bianca'),
  ('Fluhman', 'Fulton'),
  ('Martinez', 'Marsh'),
  ('Sanchez', 'Sutton'),
  ('Gossett', 'Garrity'),
  ('Alicyn', 'Allison'),
  ('Haley', 'Hollie'),
  ('Yvonne', 'Yvette'),
  ('Erica', 'Erin'),
  ('Gomez', 'Gable'),
  ('Serenity', 'Sienna'),
  ('Rico', 'Rocco'),
  ('Herrera', 'Hale'),
  ('Medina', 'Meade'),
  ('Carla', 'Celia'),
  ('Hernandez', 'Hayes'),
  ('Latricia', 'Lorraine'),
  ('Amanda', 'Amelia'),
  ('Torres', 'Tate'),
  ('Flores', 'Fleming'),
  ('Tara', 'Tina'),
]
# The practice's Microsoft sign-in ids (already public in the sandbox, but they mean nothing in a demo).
IDS = [('2122a06f-b6e9-4618-9106-3b6d6a84b5eb', '00000000-0000-0000-0000-000000000001'),
       ('edb81e45-7fa8-4147-982f-2f31c6298086', '00000000-0000-0000-0000-000000000002')]

TEXT = ('.html', '.js', '.json', '.webmanifest', '.css', '.txt')


EXACT = {'FFO', 'LCO', 'SUN', 'FOLC'}                # codes: never their lower-case ("sun" is a day)


def variants(old, new):
    out = [(old, new)]
    if old in EXACT: return out
    if old.lower() != old: out.append((old.lower(), new.lower()))
    if old.upper() != old and len(old) > 3: out.append((old.upper(), new.upper()))
    if ' ' in old: out.append((old.lower().replace(' ', ''), new.lower().replace(' ', '')))
    return out


PAIRS = {}
for o, n in MAP:
    for a, b in variants(o, n):
        PAIRS.setdefault(a, b)
# Whole words only (so "Mia" never touches "Miami"), except where a name runs into an identifier ("heatherSheet").
# A name may also start a camelCase word ("onHeather") or take an s ("heathers columns").
RX = re.compile(r'(?:(?<![A-Za-z0-9])|(?<=[a-z])(?=[A-Z]))(' + '|'.join(re.escape(k) for k in sorted(PAIRS, key=len, reverse=True)) + r')(?=s?(?![a-z0-9]))')


def swap(text):
    text = RX.sub(lambda m: PAIRS[m.group(1)], text)
    for a, b in IDS: text = text.replace(a, b)
    return text


# The banner per page, worded for a visiting practice (the rest keep the sandbox's words, minus "MOCK-UP for ...").
RIBBONS = {
  'home.html': 'a made-up practice. Use “Viewing as” to see how Home-Brace changes for each role.',
  'index.html': 'made-up numbers. In a real practice this reads the practice’s own production workbook.',
  'production.html': 'made-up numbers. What you type stays in your browser.',
  'admin.html': 'the admin console. In a real practice people sync from Microsoft 365 and access is managed here.',
  'marketing.html': 'the marketing board: events, social posts and what each campaign brought in.',
  'schedule.html': 'a sample staff schedule: which office is open each day and who’s working.',
  'team.html': 'everyone’s contact card. In a real practice this list builds itself from Microsoft 365.',
  'documents.html': 'Documents. You see only the folders your role, office and team allow.',
  'payroll.html': 'made-up people and amounts. Use “Try it as”: an office sending its payroll, then the person who runs payroll.',
  'monthly.html': 'made-up numbers. Use “Try it as”: an office manager first, then the practice administrator.',
  'tc.html': 'made-up patients. Use “Try it as” to see it as a TC, an office manager or a leader.',
  'academy.html': 'made-up people and sample lessons. Use “Try it as”: a new hire, an office manager or the trainer.',
  'tasks.html': 'made-up people. Use “Try it as” to give a task, then as the person who ticks it off.',
}
PAGE = ['']
# On-screen words that say "sandbox" - a visitor sees a demo. (Applied after the names are swapped.)
WORDING = [
  ("<b>Sandbox:</b> made-up numbers. The practice\\'s real workbook is never opened here.",
   "<b>Demo:</b> made-up numbers. In a real practice this reads the practice\\'s own workbook."),
  ('<b>Sandbox:</b> saved in this browser only. The practice\\u2019s real workbook is never touched here.',
   '<b>Demo:</b> saved in this browser only.'),
  ('<b>Sandbox:</b> made-up numbers. Saving here stays in this browser \\u2014 the practice\\u2019s real workbook is never touched.',
   '<b>Demo:</b> made-up numbers. What you type stays in this browser.'),
  ('<b>In this sandbox</b>', '<b>In this demo</b>'),
  (' \u00b7 sample OrthoFi numbers (sandbox)', ' \u00b7 sample OrthoFi numbers'),
  ("'<div class=\"pp-demo\">Sandbox: see what ", "'<div class=\"pp-demo\">Demo: see what "),
  ('data-v="0">Mock-up</button>', 'data-v="0">Sample</button>'),
  ('<b>Sandbox.</b> On the live site', '<b>Demo.</b> In a real practice'),
]


def ribbon(m):
    """The sandbox banner, worded for a visitor: 'MOCK-UP for Heather - made-up ...' -> 'DEMO - made-up ...'."""
    attrs, body = m.group(1), m.group(2)
    if PAGE[0] in RIBBONS: return '<div class="ribbon"' + attrs + '>DEMO \u2014 ' + RIBBONS[PAGE[0]] + '</div>'
    body = re.sub(r'^\s*(MOCK-UP(?: for [^—-]+)?|PROTOTYPE|SANDBOX|PREVIEW(?: for [^—-]+)?)\s*[—-]\s*', '', body)
    return '<div class="ribbon"' + attrs + '>DEMO — ' + body + '</div>'


def main():
    tracked = subprocess.check_output(['git', 'ls-files', 'v1'], cwd=REPO).decode().split('\n')
    files = [f[3:] for f in tracked if f.startswith('v1/')]
    keep = [f for f in files if f not in SKIP_PAGES and not f.startswith(SKIP_DIRS)]
    stamp = time.strftime('d%Y%m%d%H%M')

    if os.path.isdir(OUT): shutil.rmtree(OUT)          # demo/ is generated - nothing in it is ever hand-made
    for f in keep:
        src, dst = os.path.join(SRC, f), os.path.join(OUT, f)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if f in SWAP_FILES: shutil.copyfile(SWAP_FILES[f], dst); continue
        if not f.endswith(TEXT): shutil.copyfile(src, dst); continue
        t = swap(open(src, encoding='utf-8').read())
        for a, b in WORDING: t = t.replace(a, b)
        if f.endswith('.html'):
            t = re.sub(r'\?v=(hc\d+)', r'?v=\1' + stamp, t)
            # no Microsoft sign-in library: the shim stands in for it (and for Microsoft), before anything else runs
            t = re.sub(r'\s*<script src="https://cdn\.jsdelivr\.net/npm/@azure/msal-browser@[^"]+"></script>', '', t)
            t = re.sub(r'(<head[^>]*>)', r'\1\n<script src="demo-shim.js?v=' + stamp + '"></script>', t, count=1)
            PAGE[0] = f
            t = re.sub(r'<div class="ribbon"([^>]*)>(.*?)</div>', ribbon, t, count=1, flags=re.S)
            t = t.replace('<span class="v1">V1 preview</span>', '<span class="v1">Demo</span>')
            # links to the pages left out go nowhere instead of to a missing page
            for p in SKIP_PAGES:
                t = re.sub(r'href="' + re.escape(p) + r'[^"]*"', 'href="#" data-demo-off', t)
        open(dst, 'w', encoding='utf-8').write(t)
    allt = ''.join(open(os.path.join(OUT, f), encoding='utf-8').read() for f in keep if f.endswith(TEXT))
    for a, b in WORDING:
        if b not in allt: print('  note: wording not found any more (the sandbox changed?): ' + a[:70])
    shutil.copyfile(SHIM, os.path.join(OUT, 'demo-shim.js'))
    open(os.path.join(OUT, 'index-demo.txt'), 'w').write('Generated by deploy/build-demo.py ' + stamp + ' - do not edit by hand.\n')
    print('demo/: %d files from v1/ (%d left out), stamp %s' % (len(keep), len(files) - len(keep), stamp))
    return leak_check()


def leak_check():
    """Nothing real may be left. Fails the build (exit 1) and lists each hit with its place."""
    words = set()
    for o, _ in MAP: words.add(o)
    words |= {'Heather', 'Selene', 'Jessica', 'Farnsworth', 'Sunflower', 'Cruces', 'Lubbock', 'Clovis', 'Hobbs',
              'Carlsbad', 'San Angelo', 'Mansfield', 'Omega', 'Lawing', 'farnsworth', 'kind-hill'}
    roster = os.path.join(SRC, '_people.json')        # the real roster - only on Cory's Mac, never in git
    if os.path.exists(roster):
        d = json.load(open(roster))
        for r in (d.get('people', []) if isinstance(d, dict) else d):
            nm = re.sub(r'\bDr\.?\s*', '', (r.get('name') or '')).strip()
            if not nm: continue
            words.add(nm)
            for part in re.split(r'[\s,()"]+', nm):
                if len(part) >= 4: words.add(part)
            e = r.get('email') or ''
            if '@' in e: words.add(e.split('@')[1].lower())          # the domain (the part before @ is often a word)
    else:
        print('  note: no v1/_people.json here - checked the built-in list only')
    # Short common words that happen to be roster names are checked whole-word and case-sensitive only.
    rx = re.compile(r'(?:(?<![A-Za-z])|(?<=[a-z])(?=[A-Z]))(' + '|'.join(re.escape(w) for w in sorted(words, key=len, reverse=True)) + r')(?![a-z])')
    ci = re.compile('|'.join(re.escape(w) for w in ['farnsworth', 'lascruces', 'sunflowerortho', 'omegaortho',
                                                     'kind-hill', 'heather', 'selene', 'lubbock', 'clovis',
                                                     'carlsbad', 'sanangelo', 'mansfield', 'cruces']), re.I)
    hits = []
    for root, _, fs in os.walk(OUT):
        for f in fs:
            p = os.path.join(root, f)
            if not f.endswith(TEXT): continue
            t = open(p, encoding='utf-8').read()
            for r_ in (rx, ci):
                for m in r_.finditer(t):
                    a = max(0, m.start() - 40)
                    hits.append('%s: %r' % (os.path.relpath(p, REPO), t[a:m.end() + 40].replace('\n', ' ')))
    allow = set()                                       # nothing allowed today
    hits = [h for h in hits if h not in allow]
    if hits:
        print('LEAK CHECK FAILED - real names left in demo/ (%d):' % len(hits))
        for h in sorted(set(hits))[:200]: print('  ' + h)
        return 1
    print('leak check: clean (%d names checked)' % len(words))
    return 0


if __name__ == '__main__':
    sys.exit(main())
