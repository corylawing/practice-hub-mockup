#!/usr/bin/env bash
# THE ALERT SENDER'S TEST SLOT - phone alerts, step 1 (22/10/2026, Cory: "go", sandbox first).
#   ./deploy/deploy-alerts-test.sh <deployment token>
# Deploys ONLY the alert sender (api-push/) and a placeholder page to a separate environment of the Home-Brace Static
# Web App, named "alerts". It is NOT the live site: the production environment, its pages and its data are untouched,
# no Home-Brace pages are uploaded here, and the sender reads no practice data. The sandbox pages call it.
# The alert key (deploy/.vapid.json, never in git) is copied into the sender's own folder, which is not served.
set -euo pipefail
TOKEN="${1:?usage: deploy/deploy-alerts-test.sh <deployment token>}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$REPO/deploy/.vapid.json" ] || { echo "deploy/.vapid.json is missing (the alert key - it never goes in git)"; exit 1; }
node "$REPO/test/push.test.js" >/dev/null || { echo "test/push.test.js failed - not deploying"; exit 1; }

STAGE="$(mktemp -d)"
mkdir -p "$STAGE/site" "$STAGE/api"
cat > "$STAGE/site/index.html" <<'HTML'
<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Home-Brace alert sender (test)</title>
<body style="font-family:system-ui,sans-serif;padding:24px;color:#0F2A4A">Home-Brace alert sender - test slot. Nothing to see here.</body></html>
HTML
rsync -a --exclude 'vapid.json' "$REPO/api-push/" "$STAGE/api/"
cp "$REPO/deploy/.vapid.json" "$STAGE/api/push/vapid.json"
chmod 644 "$STAGE/api/push/vapid.json"   # the copy here is locked to this Mac's user; the function runs as another user

# The CLI refuses to run from inside the artifact folder, so deploy from its parent.
cd "$STAGE"
SWA_CLI_DEPLOYMENT_TOKEN="$TOKEN" \
  npx --yes @azure/static-web-apps-cli@2.0.10 deploy ./site --env alerts --api-location ./api --api-language node --api-version 22
rm -rf "$STAGE"
