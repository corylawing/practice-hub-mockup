/* POST /api/orthofi - Home-Brace's window onto OrthoFi (20/11/2026; Cory put the client ID + secret in the site's settings).
   OrthoFi's API (https://api.data.orthofi.com/v1/openapi): OAuth2 client credentials - the client_id + client_secret are
   POSTed (form-encoded, grant_type=client_credentials) to https://auth.data.orthofi.com/oauth2/token for a pass
   (access_token), then each GET carries it. The ID and secret are the site's settings ORTHOFI_CLIENT_ID /
   ORTHOFI_CLIENT_SECRET, typed into Azure by Cory - never in git, never in a page, never sent back, never logged.

   WHAT IT ANSWERS - TOTALS, NEVER PEOPLE. Several OrthoFi lists are one row per patient (A/R, delinquent, discounts,
   treatments). This never sends a row back: it adds the rows up per practice location (sums and counts of the number
   fields, ids left out) and can count rows that meet a rule (e.g. "past due 30+ > 0"), or split the totals by a field from
   a short list that never holds a person (product line, treatment status, discount type ...). Patient and guardian names,
   ids, dates and notes never leave it.
     {idt, ask:'locations'}                                   -> {ok, locations:[{id, name, practice, city, state}]}
     {idt, ask:'sum', path, locs:[ids], params:{}, group, count:[{name, any:[fields], min:{field:n}}]}
                                                              -> {ok, rows, fields:[names], by:{locId:{n, sum, nz, cnt, groups}}}
   Only the paths in ALLOWED, only their date-type params. Only people signed in to the practice (idtoken.js), only from a
   Home-Brace page (ORIGINS - the sandbox included: it shows the real numbers to a signed-in admin, stores none).
   Answers are kept 10 minutes (OrthoFi refreshes overnight), the pass until just before it expires. */
'use strict';
const { verify } = require('../idtoken');

const ORIGINS = ['https://corylawing.github.io', 'http://localhost:8790', 'https://kind-hill-00da87410.3.azurestaticapps.net'];
const AUTH_URL = 'https://auth.data.orthofi.com/oauth2/token', API = 'https://api.data.orthofi.com';
const D = 'date', B = 'bool', LIST = 'list', IDS = 'ids';
const ALLOWED = {
  '/v1/practice-locations/production': { 'start-date': D, 'end-date': D },
  '/v1/practice-locations/collection': { 'start-date': D, 'end-date': D },
  '/v1/practice-locations/business-health': { 'month-date-start-date': D, 'month-date-end-date': D },
  '/v1/practice-locations/patient-accounts-receivable': { 'as-of-date': D },
  '/v1/history/patient-accounts-receivable': { 'as-of-date': D },
  '/v1/practice-locations/insurance-accounts-receivable': { 'as-of-date': D, 'limit-submission-status': B },
  '/v1/history/insurance-accounts-receivable': { 'as-of-date': D, 'limit-submission-status': B },
  '/v1/practice-locations/delinquent': {},
  '/v1/practice-locations/discounts': { 'created-on-start-date': D, 'created-on-end-date': D },
  '/v1/practice-locations/write-offs': { 'start-date': D, 'end-date': D },
  '/v1/practice-locations/new-patient-counts': { 'start-date': D, 'end-date': D },
  '/v1/practice-locations/start-counts': { 'start-date': D, 'end-date': D },
  '/v1/practice-locations/exam-counts': { 'start-date': D, 'end-date': D },
  '/v1/practice-locations/adjustments': { 'created-on-start-date': D, 'created-on-end-date': D },
  '/v1/practice-locations/costs-courtesies': { 'created-on-start-date': D, 'created-on-end-date': D },
  '/v1/practice-locations/collection-summary': {},
  /* GROSS COLLECTIONS (20/11/2026, Heather: "I get it from the monthly balance sheet"): money deposited - OrthoFi's day
     sheet (deposits, by the day entered) and its collection details (each payment, by payment date). Sums only; the
     rows' payer and patient names never leave here (summarize adds up numbers, and only top-level ones). */
  '/v1/practice-locations/deposits': { 'created-on-start-date': D, 'created-on-end-date': D },
  /* NEW PATIENT EXAMS (20/11/2026): OrthoFi's "kept NPE report" list, by exam date - counted, never a name */
  '/v1/practice-locations/patient-exams': { 'exam-date-start-date': D, 'exam-date-end-date': D },
  /* NET PRODUCTION ADJUSTMENTS (21/11/2026): Heather's number is the Monthly Balance Sheet's "Adjustments Total" =
     production adjustments (the adjustments list, every type) + "Additional Charges" (misc charges, late fees, NSF fees,
     interest earned). These two lists carry the additional charges - added up, never a row. */
  '/v1/practice-locations/miscellaneous-charges': { 'created-on-start-date': D, 'created-on-end-date': D },
  '/v1/practice-locations/interest': { 'accrual-start-date': D, 'accrual-end-date': D },
  '/v1/practice-locations/fees': { 'created-on-start-date': D, 'created-on-end-date': D, 'invoice-due-date-start-date': D, 'invoice-due-date-end-date': D },
  '/v1/practice-locations/charges': { 'charge-date-start-date': D, 'charge-date-end-date': D },
  '/v1/practice-locations/non-contract-charges': { 'start-date': D, 'end-date': D },
  '/v1/practice-locations/collection-details': { 'payment-start-date': D, 'payment-end-date': D },
  '/v1/practice-locations/treatments': { 'product-lines': LIST, 'treatment-status-ids': IDS,
    'contract-signed-on-start-date': D, 'contract-signed-on-end-date': D, 'appliance-date-start-date': D, 'appliance-date-end-date': D,
    'created-on-start-date': D, 'created-on-end-date': D }
};
/* fields a total may be split by - none of them ever holds a person */
const GROUPS = ['productLine', 'treatmentTypeName', 'treatmentStatusName', 'treatmentStatusId', 'discountType', 'discountName', 'adjustmentType',
  'submissionStatus', 'collectionType', 'monthDate', 'endDate', 'creditTier', 'planPriority', 'dentition', 'keptExamFlag', 'examTypeName', 'patientExamResultName', 'miscellaneousChargeType', 'contractInterestTypeName', 'contractFeeTypeName', 'chargeTypeName', 'dateType', 'includedInContract', 'paymentTypeName', 'paymentClassName', 'invoiceTypeName'];
const KEEP_MS = 10 * 60e3;
/* OrthoFi's "the answer is too big" (507, seen 20/11/2026 on insurance A/R and all treatments for 9 locations at once):
   then the same question one location at a time, 3 at once, and the rows put back together. */
const SPLIT_AT = [507, 413];
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
const r2 = x => Math.round(x * 100) / 100;
const isId = k => /id$|ids$/i.test(k);

let deps = { verify, fetch: (...a) => fetch(...a), env: () => process.env, now: () => Date.now() };
let pass = { v: '', exp: 0 }, cache = new Map();
function reset() { pass = { v: '', exp: 0 }; cache = new Map(); }

function fail(code, msg, status) { const e = new Error(msg); e.code = code; if (status) e.status = status; return e; }
async function timed(url, opts) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null, t = ac ? setTimeout(() => ac.abort(), 25000) : null;
  try { return await deps.fetch(url, Object.assign({}, opts, ac ? { signal: ac.signal } : {})); }
  catch (_) { throw fail('net', 'OrthoFi could not be reached'); }
  finally { if (t) clearTimeout(t); }
}
async function token(force) {
  if (!force && pass.v && deps.now() < pass.exp - 60e3) return pass.v;
  const e = deps.env(), id = String(e.ORTHOFI_CLIENT_ID || '').trim(), secret = String(e.ORTHOFI_CLIENT_SECRET || '').trim();
  if (!id || !secret) throw fail('setup', 'OrthoFi is not set up: the client ID and secret are not in the site settings');
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret });
  if (e.ORTHOFI_SCOPE) body.set('scope', String(e.ORTHOFI_SCOPE).trim());
  const r = await timed(String(e.ORTHOFI_AUTH_URL || AUTH_URL).trim(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: body.toString() });
  if (!r.ok) throw fail('auth', 'OrthoFi did not accept the client ID and secret (' + r.status + ')', r.status);   // its words are never passed on
  let j = null; try { j = await r.json(); } catch (_) {}
  if (!j || !j.access_token) throw fail('auth', 'OrthoFi gave no pass');
  pass = { v: String(j.access_token), exp: deps.now() + Math.max(60, Math.min(86400, +j.expires_in || 3600)) * 1000 };
  return pass.v;
}
async function get(path, params) {
  const u = new URL(API + path); Object.keys(params || {}).forEach(k => u.searchParams.set(k, params[k]));
  const go = async t => timed(u.toString(), { headers: { Authorization: 'Bearer ' + t, Accept: 'application/json' } });
  let r = await go(await token(false));
  if (r.status === 401 || r.status === 403) r = await go(await token(true));    // a pass that ran out early
  if (!r.ok) throw fail('api', 'OrthoFi answered ' + r.status, r.status);
  let j; try { j = await r.json(); } catch (_) { throw fail('api', 'OrthoFi sent something that is not JSON'); }
  if (Array.isArray(j)) return j;
  for (const k of ['data', 'items', 'results', 'value']) if (j && Array.isArray(j[k])) return j[k];
  return j && typeof j === 'object' ? [j] : [];
}

/* adds one row's number fields into a total (ids left out); nz = how many rows had it non-zero */
function addRow(T, row) {
  Object.keys(row).forEach(k => { const v = row[k]; if (typeof v !== 'number' || !isFinite(v) || isId(k)) return;
    T.sum[k] = r2((T.sum[k] || 0) + v); if (v !== 0) T.nz[k] = (T.nz[k] || 0) + 1; });
}
function meets(row, c) {
  const any = (c.any || []).filter(f => !isId(f)), min = c.min || {}, is = c.is || {}, isF = Object.keys(is);
  if (any.length && !any.some(f => typeof row[f] === 'number' && row[f] > 0)) return false;
  /* is: {field: [values]} - the row's value for ANY of the fields is one of its values (case ignored). OrthoFi's own
     insurance A/R report counts only certain claim statuses (their docs, 20/11/2026). */
  if (isF.length && !isF.some(f => row[f] != null && is[f].indexOf(String(row[f]).trim().toLowerCase()) >= 0)) return false;
  /* on: {field, from, to} - the row's own date (YYYY-MM-DD...) falls in that span (21/11/2026: OrthoFi dates each misc
     charge by its contract's signing or its creation - "dateType" says which - and the balance sheet counts it so) */
  if (c.on) { const d = String(row[c.on.field] == null ? '' : row[c.on.field]).slice(0, 10); if (!(d >= c.on.from && d <= c.on.to)) return false; }
  return Object.keys(min).every(f => typeof row[f] === 'number' && row[f] >= +min[f]);
}
/* PATIENTS, not contracts (OrthoFi: "UI report is grouped by patient, and our endpoint is at the contract level"): how
   many DIFFERENT patients - only the count leaves here, never an id. */
function summarize(rows, group, counts) {
  const by = {}, fields = new Set(), P = {};
  (rows || []).forEach(row => {
    if (!row || typeof row !== 'object') return;
    Object.keys(row).forEach(k => fields.add(k));
    const loc = String(row.practiceLocationId != null ? row.practiceLocationId : (row.PracticeLocationId != null ? row.PracticeLocationId : 'all'));
    const L = by[loc] = by[loc] || { n: 0, sum: {}, nz: {}, cnt: {}, csum: {}, pat: 0, patc: {}, groups: {} };
    const S = P[loc] = P[loc] || { all: new Set(), c: {} }, pid = row.patientId != null ? String(row.patientId) : '';
    L.n++; addRow(L, row); if (pid) S.all.add(pid);
    (counts || []).forEach(c => { if (!meets(row, c)) return;
      L.cnt[c.name] = (L.cnt[c.name] || 0) + 1;
      const C = L.csum[c.name] = L.csum[c.name] || { sum: {}, nz: {} }; addRow(C, row);
      if (pid) (S.c[c.name] = S.c[c.name] || new Set()).add(pid); });
    if (group) { const gv = clip(row[group] == null ? '(none)' : row[group], 80), G = L.groups[gv] = L.groups[gv] || { n: 0, sum: {}, nz: {} }; G.n++; addRow(G, row); }
  });
  Object.keys(by).forEach(loc => { const S = P[loc]; by[loc].pat = S.all.size; Object.keys(S.c).forEach(k => { by[loc].patc[k] = S.c[k].size; }); });
  return { by, fields: [...fields].sort() };
}
/* the request, cleaned: only what ALLOWED says, in the shapes it says */
function cleanAsk(b) {
  const path = String(b.path || ''); const allow = ALLOWED[path]; if (!allow) throw fail('bad', 'that OrthoFi list is not one Home-Brace reads');
  const locs = (Array.isArray(b.locs) ? b.locs : []).map(x => Math.floor(+x)).filter(x => x > 0).slice(0, 60);
  if (!locs.length) throw fail('bad', 'no practice locations');
  const params = { 'practice-location-ids': locs.join(',') }, p = b.params || {};
  Object.keys(p).forEach(k => { const kind = allow[k], v = String(p[k] == null ? '' : p[k]).trim(); if (!kind || !v) return;
    if (kind === D && /^\d{4}-\d{2}-\d{2}$/.test(v)) params[k] = v;
    else if (kind === B && /^(true|false)$/.test(v)) params[k] = v;
    else if (kind === IDS && /^\d+(,\d+){0,30}$/.test(v)) params[k] = v;
    else if (kind === LIST && /^[\w &'().,\-\/]{1,200}$/.test(v)) params[k] = v; });
  const group = GROUPS.indexOf(b.group) >= 0 ? b.group : '';
  const count = (Array.isArray(b.count) ? b.count : []).slice(0, 12).map(c => ({ name: clip(c && c.name, 40).replace(/[^\w]/g, ''),
    any: (Array.isArray(c && c.any) ? c.any : []).map(f => clip(f, 60)).filter(f => /^\w+$/.test(f)).slice(0, 12),
    min: Object.keys((c && c.min) || {}).filter(f => /^\w+$/.test(f) && isFinite(+c.min[f])).slice(0, 4).reduce((o, f) => (o[f] = +c.min[f], o), {}),
    is: Object.keys((c && c.is) || {}).filter(f => /^\w+$/.test(f) && !isId(f) && Array.isArray(c.is[f])).slice(0, 2)
      .reduce((o, f) => (o[f] = c.is[f].map(x => clip(x, 40).trim().toLowerCase()).filter(x => /^[\w &'().,\-\/]+$/.test(x)).slice(0, 12), o), {}),
    on: (c && c.on && /^\w+(On|Date)$/.test(c.on.field) && /^\d{4}-\d{2}-\d{2}$/.test(c.on.from) && /^\d{4}-\d{2}-\d{2}$/.test(c.on.to)) ? { field: c.on.field, from: c.on.from, to: c.on.to } : null }))
    .filter(c => c.name && (c.any.length || Object.keys(c.min).length || Object.keys(c.is).length || c.on));
  return { path, params, group, count };
}
async function each(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; out[k] = await fn(list[k]); } }));
  return out;
}
async function rowsFor(a) {
  try { return await get(a.path, a.params); }
  catch (e) {
    const locs = String(a.params['practice-location-ids'] || '').split(',').filter(Boolean);
    if (locs.length < 2 || SPLIT_AT.indexOf(e.status) < 0) throw e;
    const parts = await each(locs, 3, loc => get(a.path, Object.assign({}, a.params, { 'practice-location-ids': loc }))
      .catch(e2 => { throw fail('api', 'OrthoFi answered ' + (e2.status || '?') + ' even for one location', e2.status); }));
    return [].concat(...parts);
  }
}
async function answer(b) {
  /* The treatment statuses OrthoFi knows (names and ids only - reference data, no patient in it). */
  if (b.ask === 'statuses') {
    const hit = cache.get('statuses'); if (hit && deps.now() - hit.at < KEEP_MS) return hit.v;
    const r = (await get('/v1/reference-data', {}))[0] || {};
    const v = { ok: true, statuses: (Array.isArray(r.patientTreatmentStatuses) ? r.patientTreatmentStatuses : [])
      .map(x => ({ id: Math.floor(+(x && x.id)), name: clip(x && x.name, 80) })).filter(x => x.id > 0 && x.name).slice(0, 200) };
    cache.set('statuses', { at: deps.now(), v }); return v;
  }
  if (b.ask === 'locations') {
    const rows = await get('/v1/practice-locations', {});
    return { ok: true, locations: rows.map(r => ({ id: r.practiceLocationId, name: clip(r.practiceLocationName, 120), practice: clip(r.practiceName, 120),
      city: clip(r.city, 80), state: clip(r.stateAbbreviation, 8) })).filter(x => x.id) };
  }
  if (b.ask === 'sum') {
    const a = cleanAsk(b), key = JSON.stringify(a), hit = cache.get(key);
    if (hit && deps.now() - hit.at < KEEP_MS) return hit.v;
    const rows = await rowsFor(a), s = summarize(rows, a.group, a.count);
    const v = { ok: true, rows: rows.length, fields: s.fields, by: s.by };
    if (cache.size > 300) cache.clear(); cache.set(key, { at: deps.now(), v });
    return v;
  }
  throw fail('bad', 'unknown question');
}

async function handler(context, req) {
  const h = req.headers || {}, origin = h.origin || h.Origin || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (ORIGINS.indexOf(origin) >= 0) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
  const reply = (status, body) => { context.res = { status, headers, body: JSON.stringify(body) }; };
  if (req.method === 'OPTIONS') { headers['Access-Control-Allow-Methods'] = 'POST'; headers['Access-Control-Allow-Headers'] = 'Content-Type'; return reply(204, {}); }
  if (ORIGINS.indexOf(origin) < 0) return reply(403, { ok: false, error: 'not from a Home-Brace page' });
  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.rawBody || '{}')); }
  catch (_) { return reply(400, { ok: false, error: 'not JSON' }); }
  try { await deps.verify(b && b.idt); }
  catch (e) { return reply(401, { ok: false, signin: true, error: clip(e && e.message, 80) }); }
  try { return reply(200, await answer(b || {})); }
  catch (e) {
    const code = (e && e.code) || 'err', status = code === 'bad' ? 400 : code === 'setup' ? 503 : 502;
    return reply(status, { ok: false, code, status: e && e.status, error: clip(e && e.message, 160) });
  }
}
module.exports = handler;
module.exports._t = { setDeps: d => { deps = Object.assign({}, deps, d); }, reset, summarize, cleanAsk, token, ALLOWED, GROUPS, ORIGINS };
