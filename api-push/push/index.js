/* POST /api/push - Home-Brace's alert sender. For now it lives in a TEST SLOT of the Azure site and answers the sandbox
   pages only; the live site joins ORIGINS when alerts go live (Cory decides).
   Body (JSON sent as text/plain, so a browser sends it without a CORS preflight):
     {sub:{endpoint, keys:{p256dh, auth}}, title, body, url, tag, delay}
   It sends ONE alert to ONE device - the device whose alert address (subscription) the page sends. It holds no Microsoft
   keys and reads no practice data: only its own alert key, from vapid.json next to this file (copied in at deploy, never
   in git) or the VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY settings. */
'use strict';
const fs = require('fs'), path = require('path');
const { send, okEndpoint } = require('../webpush');

const ORIGINS = ['https://corylawing.github.io', 'http://localhost:8790'];
const SUBJECT = 'https://corylawing.github.io/practice-hub-mockup/';
function alertKey() {
  try { const k = JSON.parse(fs.readFileSync(path.join(__dirname, 'vapid.json'), 'utf8')); if (k.publicKey && k.privateKey) return k; } catch (_) {}
  const e = process.env;
  return e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY ? { publicKey: e.VAPID_PUBLIC_KEY, privateKey: e.VAPID_PRIVATE_KEY, subject: e.VAPID_SUBJECT } : null;
}
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async function (context, req) {
  const h = req.headers || {}, origin = h.origin || h.Origin || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (ORIGINS.indexOf(origin) >= 0) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
  const reply = (status, body) => { context.res = { status, headers, body: JSON.stringify(body) }; };
  if (req.method === 'OPTIONS') {
    headers['Access-Control-Allow-Methods'] = 'POST'; headers['Access-Control-Allow-Headers'] = 'Content-Type';
    return reply(204, {});
  }
  if (ORIGINS.indexOf(origin) < 0) return reply(403, { ok: false, error: 'not from a Home-Brace page' });
  const key = alertKey(); if (!key) return reply(500, { ok: false, error: 'the alert key is not set up' });
  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.rawBody || '{}')); }
  catch (_) { return reply(400, { ok: false, error: 'not JSON' }); }
  const sub = b && b.sub;
  if (!sub || !okEndpoint(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return reply(400, { ok: false, error: 'bad subscription' });
  const message = { title: clip(b.title || 'Home-Brace', 80), body: clip(b.body, 240),
    url: /^\/[^\/]/.test(String(b.url || '')) ? clip(b.url, 300) : '',       // a path on the page's own site, nothing else
    tag: clip(b.tag, 60) };
  const delay = Math.max(0, Math.min(10, Number(b.delay) || 0));               // "in a few seconds", so a phone can be put away first
  if (delay) await sleep(delay * 1000);
  try {
    const r = await send(sub, message, key, key.subject || SUBJECT);
    return reply(r.status < 300 ? 200 : 502, { ok: r.status < 300, status: r.status, gone: r.gone });
  } catch (e) { return reply(500, { ok: false, error: clip(e && e.message, 120) }); }
};
