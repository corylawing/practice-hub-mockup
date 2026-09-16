# Not in use

This is a working, tested server-side route that would have let the **app** hold the
production workbook's access instead of every person needing the file shared with them.
It checks who is calling, checks the office is theirs, and writes with the app's own
credentials.

**The practice decided not to run a server, so nothing here is deployed and nothing in
the app calls it.** A normal deploy leaves it out; `./deploy/deploy-production.sh <token>
--with-api` would include it.

It is kept rather than deleted because it is finished and tested — `node api/test.js`
runs 45 checks — and because the question it answers comes back whenever someone asks
"can we stop giving people the whole workbook?".

## What it would take to switch on

1. Adam grants the **Home-Brace** app registration `Sites.ReadWrite.All` as an
   **Application** permission (not Delegated) with admin consent, and creates a secret.
2. Five settings on the Static Web App: `HB_TENANT_ID`, `HB_CLIENT_ID`,
   `HB_CLIENT_SECRET`, `HB_WB_DRIVE`, `HB_WB_ITEM`.
3. Deploy with `--with-api`, and re-add the client call in `v1/production.html`
   (removed deliberately — see the comment in `pushToWorkbook`).

## Known gaps, if it is ever revived

These were found in review and are **not fixed**, because the code is not running:

- The caller's token is checked only by handing it to Graph `/me`. That proves the token
  is real; it does **not** prove it was issued for this app or this tenant. It needs an
  `aud`/`appid`/`tid` check before it can be trusted as an authorization boundary.
- `permissionsFor()` accepts an `overrides` argument that is never passed, so everything
  set in Admin → People and Teams & Access is invisible to it, in both directions —
  including `status: 'Inactive'`, which means revoking someone would not revoke anything.
- `loadRoster()` caches an empty result permanently, so one unreadable `_people.json`
  would lock everybody out until the instance recycled.
