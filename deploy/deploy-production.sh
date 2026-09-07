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
STAGE="$(mktemp -d)/swa"

mkdir -p "$STAGE/v1"
cp "$REPO/deploy/index.html" "$STAGE/index.html"
cp -R "$REPO/assets" "$STAGE/assets"
rsync -a --exclude 'snapshot.json' --exclude '_testgrids.json' "$REPO/v1/" "$STAGE/v1/"

# The CLI refuses to run from inside the artifact folder, so deploy from its parent.
cd "$(dirname "$STAGE")"
SWA_CLI_DEPLOYMENT_TOKEN="$TOKEN" \
  npx --yes @azure/static-web-apps-cli@2.0.10 deploy ./swa --env production

echo
echo "Deployed. Verify the cache stamp actually changed:"
echo "  curl -s https://kind-hill-00da87410.3.azurestaticapps.net/v1/production.html | grep -o 'v=hc[0-9]*' | sort -u"
