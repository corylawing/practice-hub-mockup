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
# Usage:  ./deploy/deploy-production.sh <deployment-token> [--with-api]
#   Token: Azure Portal -> Static Web App "kind-hill-00da87410"
#          -> Manage deployment token. Never commit it.
set -euo pipefail
TOKEN="${1:?Pass the deployment token as the first argument}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)/swa"

mkdir -p "$STAGE/v1"
cp "$REPO/deploy/index.html" "$STAGE/index.html"
cp -R "$REPO/assets" "$STAGE/assets"
rsync -a --exclude 'snapshot.json' --exclude '_testgrids.json' "$REPO/v1/" "$STAGE/v1/"

# The roster is a STATIC file on a site whose pages are public (the sign-in gate is
# drawn by JavaScript; it does not protect files). So anyone with the hub's URL can
# fetch it. The app only needs email -> teams/offices before sign-in, so strip the
# fields it does not need that far: employee IDs and personal notes. Names, work
# emails and offices remain, because identity matching needs them.
if [ -f "$STAGE/v1/_people.json" ]; then
  python3 - "$STAGE/v1/_people.json" <<'STRIP'
import json,sys
p=sys.argv[1]; d=json.load(open(p))
for row in d.get('people',[]):
    row.pop('empId',None)
    row.pop('about',None)
    row.pop('phone',None)
d['_note']=('Published copy: employee IDs and personal notes are removed at deploy '
            'time because this file is served without a sign-in. See deploy-production.sh.')
json.dump(d,open(p,'w'),indent=1,ensure_ascii=False)
print('  roster: stripped employee IDs from the published copy')
STRIP
fi

# ---- the API (server side) -------------------------------------------------
# Only deployed once it is configured. Without the app credentials it cannot do
# anything, and the pages fall back to talking to Graph directly, so shipping it
# half-configured would just add a broken endpoint.
# Pass --with-api to include it. Off by default: it can do nothing until Adam has
# granted the app permission and the settings are in place, and adding an /api route
# to a working site for no benefit is not a risk worth taking on a normal deploy.
API=""
if [ "${2:-}" = "--with-api" ] && [ -d "$REPO/api" ]; then
  API="$(dirname "$STAGE")/api"
  rsync -a --exclude 'node_modules' "$REPO/api/" "$API/"
  # The function needs the shared writer and the roster NEXT TO IT - the v1 folder
  # is not deployed alongside the API.
  cp "$REPO/v1/workbook.js" "$API/workbook.js"
  [ -f "$REPO/v1/_people.json" ] && cp "$REPO/v1/_people.json" "$API/_people.json"
fi

# The CLI refuses to run from inside the artifact folder, so deploy from its parent.
cd "$(dirname "$STAGE")"
SWA_CLI_DEPLOYMENT_TOKEN="$TOKEN" \
  npx --yes @azure/static-web-apps-cli@2.0.10 deploy ./swa --env production \
    ${API:+--api-location ./api}

echo
echo "Deployed. Verify the cache stamp actually changed:"
echo "  curl -s https://kind-hill-00da87410.3.azurestaticapps.net/v1/production.html | grep -o 'v=hc[0-9]*' | sort -u"
