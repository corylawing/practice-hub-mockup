/* Home-Brace server side.
   The point of this file: the workbook access lives HERE, not with the people. Nobody
   needs the file shared with them any more. They ask this, this checks who they are and
   which offices they are allowed, and it does the work on their behalf.

   Two separate identities, and keeping them separate is the whole security model:
     - THE CALLER's token, sent by their browser. Used ONLY to find out who they are.
       Never used to touch the workbook.
     - THE APP's own token, from the client credentials below. Used ONLY to touch the
       workbook, and only after the caller has been checked.

   The caller's token is validated by handing it to Microsoft (`GET /me`). If Microsoft
   accepts it we know it is genuine and who it belongs to. That is deliberately instead of
   verifying the signature here: Microsoft is better at it than any code I would write,
   and a subtly wrong check is the one bug that would matter most. */

const GRAPH = 'https://graph.microsoft.com/v1.0';

function cfg(){
  const c = {
    tenant: process.env.HB_TENANT_ID,
    clientId: process.env.HB_CLIENT_ID,
    secret: process.env.HB_CLIENT_SECRET,
    drive: process.env.HB_WB_DRIVE,
    item: process.env.HB_WB_ITEM
  };
  const missing = Object.keys(c).filter(k => !c[k]);
  if (missing.length) throw new Error('Server is not configured: missing ' + missing.join(', '));
  return c;
}

/* ---- the app's own token (client credentials) ------------------------------ */
let appTok = null;                      // { value, expires }
async function appToken(){
  const c = cfg();
  if (appTok && appTok.expires > Date.now() + 60000) return appTok.value;
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.secret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });
  const res = await fetch('https://login.microsoftonline.com/' + c.tenant + '/oauth2/v2.0/token',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Could not get the app token: ' + (j.error_description || res.status));
  appTok = { value: j.access_token, expires: Date.now() + (j.expires_in || 3600) * 1000 };
  return appTok.value;
}

/* ---- who is calling -------------------------------------------------------- */
/* A B2B guest signs in as jenny_lascrucessmiles.com#EXT#@host.onmicrosoft.com.
   Turn that back into the address the roster knows them by. Mirrors user.js. */
function realAddress(v){
  const raw = String(v || '').toLowerCase().trim();
  const i = raw.indexOf('#ext#');
  if (i < 0) return raw;
  const left = raw.slice(0, i);
  const u = left.lastIndexOf('_');
  return u < 0 ? left : left.slice(0, u) + '@' + left.slice(u + 1);
}

async function whoIsCalling(req){
  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return { error: 'Not signed in.' };
  const res = await fetch(GRAPH + '/me?$select=displayName,mail,userPrincipalName',
    { headers: { Authorization: 'Bearer ' + m[1] } });
  if (!res.ok) return { error: 'Your sign-in could not be verified. Sign in again.' };
  const me = await res.json();
  const mail = String(me.mail || '').toLowerCase().trim() || realAddress(me.userPrincipalName);
  if (!mail) return { error: 'Your account has no address the hub can match.' };
  return { mail, name: me.displayName || mail };
}

/* ---- what they are allowed ------------------------------------------------- */
/* Read server-side from the roster that ships with the app. Deliberately NOT taken
   from anything the browser sends - the browser could claim anything. */
const fs = require('fs');
const path = require('path');

let roster = null;
function loadRoster(){
  if (roster) return roster;
  const tries = [
    path.join(__dirname, '_people.json'),
    path.join(__dirname, '..', 'v1', '_people.json')
  ];
  for (const p of tries){
    try { roster = JSON.parse(fs.readFileSync(p, 'utf8')).people; return roster; } catch (_) {}
  }
  roster = [];
  return roster;
}

// Mirrors DEPT_CAN in user.js: who may write production numbers.
const MAY_WRITE = ['admin', 'executive team', 'leadership team',
                   'office managers', 'tcs', 'financial coordinator team'];
// These teams are not tied to one office.
const ALL_OFFICES = ['admin', 'executive team', 'leadership team'];

function permissionsFor(mail, overrides){
  const row = loadRoster().find(p => String(p.email || '').toLowerCase().trim() === mail) || null;
  const ovr = (overrides && overrides[mail]) || null;

  const teams = ((ovr && ovr.teams && ovr.teams.length) ? ovr.teams : (row ? row.teams : []) || [])
    .map(t => String(t).toLowerCase().trim());
  const offices = (ovr && ovr.locs && ovr.locs.length) ? ovr.locs
                : (row ? (row.offices || []) : []);

  return {
    known: !!(row || ovr),
    teams,
    canWrite: teams.some(t => MAY_WRITE.indexOf(t) >= 0),
    everyOffice: teams.some(t => ALL_OFFICES.indexOf(t) >= 0)
                 || offices.indexOf('All offices') >= 0,
    offices: offices.filter(o => o !== 'All offices')
  };
}

/* ---- Graph, as the app ----------------------------------------------------- */
async function graph(method, urlPath, body, sessionId){
  const t = await appToken();
  const headers = { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' };
  if (sessionId) headers['workbook-session-id'] = sessionId;
  const res = await fetch(GRAPH + urlPath,
    { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return {};
  const j = await res.json().catch(() => ({}));
  if (!res.ok){
    const msg = (j.error && j.error.message) || res.statusText;
    const e = new Error('Graph ' + res.status + ': ' + msg);
    e.status = res.status;
    throw e;
  }
  return j;
}

const sheetBase = tab => {
  const c = cfg();
  return '/drives/' + c.drive + '/items/' + c.item +
         "/workbook/worksheets('" + encodeURIComponent(tab) + "')";
};

function reply(context, status, obj){
  context.res = {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(obj)
  };
}

module.exports = { cfg, appToken, whoIsCalling, permissionsFor, graph, sheetBase, reply,
                   realAddress, loadRoster, MAY_WRITE, ALL_OFFICES };
