#!/bin/bash
# Deploy Home-Brace to the practice's Azure Static Web App (their tenant).
#
# Production is NOT the repo root. It is: deploy/index.html (a redirect to
# v1/home.html) + v1/ + assets/. The repo root's own index.html is the old V0
# mockup home with invented announcements - deploying it would put fake posts
# from "Jordan Avery" on their real app. Hence the staging folder below.
#
# snapshot.json and _testgrids.json are excluded: both hold the practice's real
# figures, neither is used at runtime, and both are 404 in production today.
#
# Usage:  ./deploy/deploy-production.sh <deployment-token>
#   Token: Azure Portal -> Static Web App "kind-hill-00da87410"
#          -> Manage deployment token. Never commit it.
set -euo pipefail
TOKEN="${1:?Pass the deployment token as the first argument}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
# No deploy with a red test. Every incident this week was a class of bug the suite now
# replays - the blank year, the shared settings slot, the pre-sign-in read. A deploy
# that skips them is how one of those ships again.
if ! sh "$REPO/test/all.sh"; then
  echo "Tests failed - nothing was deployed." >&2
  exit 1
fi

STAGE="$(mktemp -d)/swa"

mkdir -p "$STAGE/v1"
cp "$REPO/deploy/index.html" "$STAGE/index.html"
# Site settings. Only a file type today: without it .mp4 is served as application/octet-stream,
# which iPhones may refuse to play.
cp "$REPO/deploy/staticwebapp.config.json" "$STAGE/staticwebapp.config.json"
# The staff sign-in guide. Root level and ungated on purpose: it is what you hand
# someone who cannot get in yet, so it must not sit behind the sign-in.
cp "$REPO/start.html" "$STAGE/start.html"
# The launch video that start.html plays. Not in git (it shows staff names; the repo is public),
# so it only exists on the machine that deploys. start.html hides the player if it is missing.
if [ -d "$REPO/media" ]; then cp -R "$REPO/media" "$STAGE/media"; else echo "  note: no media/ folder - start.html will show no video"; fi
cp -R "$REPO/assets" "$STAGE/assets"
# alerts-test.* is the sandbox's phone-alerts test page (no sign-in): it never goes to the live site.
rsync -a --exclude 'snapshot.json' --exclude '_testgrids.json' --exclude 'alerts-test.html' --exclude 'alerts-test.webmanifest' "$REPO/v1/" "$STAGE/v1/"

# The roster is a STATIC file on a site whose pages are public (the sign-in gate is
# drawn by JavaScript; it does not protect files). So anyone with the hub's URL can
# fetch it. The app only needs email -> teams/offices before sign-in, so strip the
# fields it does not need that far: personal notes and phone numbers. Names, work
# emails, offices and employee IDs remain - identity matching needs them (the employee
# ID is the stable person key, see CLAUDE.md). Locking the files behind a sign-in at the
# hosting level is the real fix; Cory chose to leave it for now (22/10/2026).
if [ -f "$STAGE/v1/_people.json" ]; then
  python3 - "$STAGE/v1/_people.json" <<'STRIP'
import json,sys
p=sys.argv[1]; d=json.load(open(p))
for row in d.get('people',[]):
    row.pop('about',None)
    row.pop('phone',None)
d['_note']=('Published copy: personal notes and phone numbers are removed at deploy '
            'time because this file is served without a sign-in. See deploy-production.sh.')
json.dump(d,open(p,'w'),indent=1,ensure_ascii=False)
print('  roster: removed notes and phone numbers from the published copy (employee IDs stay)')
STRIP
fi

# ---- the API (server side) -------------------------------------------------
# THE ALERT SENDER IS THE SITE'S API (04/11/2026, Cory: "Phone alerts can be on"). api-push/ answers /api/push: one
# alert to one device, only for someone signed in to the practice (it checks their Microsoft ID token); it holds no
# Microsoft keys and reads no practice data. Its alert key (deploy/.vapid.json, never in git) is copied next to it,
# exactly as deploy-alerts-test.sh does. EVERY deploy ships it - a deploy without it would take /api/push off the
# live site and every phone alert would stop.
# api/ (the server-side workbook writer, never deployed - it waits on Adam) can't ALSO be the API: a Static Web App
# has one. Merge it into api-push/ first if it is ever needed.
if [ "${2:-}" = "--with-api" ]; then
  echo "--with-api: api/ and api-push/ (the alert sender) would both need to be the site's API - merge them first. Nothing was deployed." >&2
  exit 1
fi
[ -f "$REPO/deploy/.vapid.json" ] || { echo "deploy/.vapid.json is missing (the alert key - never in git). Nothing was deployed." >&2; exit 1; }
API="$(dirname "$STAGE")/api"
rsync -a --exclude 'vapid.json' "$REPO/api-push/" "$API/"
cp "$REPO/deploy/.vapid.json" "$API/push/vapid.json"
chmod 644 "$API/push/vapid.json"   # the copy here is locked to this Mac's user; the function runs as another user

# The CLI refuses to run from inside the artifact folder, so deploy from its parent.
cd "$(dirname "$STAGE")"
SWA_CLI_DEPLOYMENT_TOKEN="$TOKEN" \
  npx --yes @azure/static-web-apps-cli@2.0.10 deploy ./swa --env production \
    --api-location ./api --api-language node --api-version 22

echo
echo "Deployed. Verify the cache stamp actually changed:"
echo "  curl -s https://kind-hill-00da87410.3.azurestaticapps.net/v1/production.html | grep -o 'v=hc[0-9]*' | sort -u"
