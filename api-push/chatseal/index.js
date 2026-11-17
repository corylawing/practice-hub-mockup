/* POST /api/chatseal - the page asks for this device's instant-chat-alert link (see ../chatkeys.js).
   Body (JSON sent as text/plain, no CORS preflight): {idt, sub:{endpoint, keys:{p256dh, auth}}}
   idt = the person's Microsoft sign-in (ID token, checked like /api/push). Answers {ok, url, clientState, cert, certId}.
   The live site only: Microsoft must be able to call the address it hands back. */
'use strict';
const { okEndpoint } = require('../webpush');
const { verify } = require('../idtoken');
const K_ = require('../chatkeys');

const ORIGIN = 'https://kind-hill-00da87410.3.azurestaticapps.net';
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

module.exports = async function (context, req) {
  const h = req.headers || {}, origin = h.origin || h.Origin || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (origin === ORIGIN) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
  const reply = (status, body) => { context.res = { status, headers, body: JSON.stringify(body) }; };
  if (req.method === 'OPTIONS') { headers['Access-Control-Allow-Methods'] = 'POST'; headers['Access-Control-Allow-Headers'] = 'Content-Type'; return reply(204, {}); }
  if (origin !== ORIGIN) return reply(403, { ok: false, error: 'the live Home-Brace site only' });
  const K = K_.keys(); if (!K) return reply(500, { ok: false, error: 'instant chat alerts are not set up' });
  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.rawBody || '{}')); }
  catch (_) { return reply(400, { ok: false, error: 'not JSON' }); }
  let who;
  try { who = await verify(b && b.idt); } catch (e) { return reply(401, { ok: false, signin: true, error: clip(e && e.message, 80) }); }
  if (!who.oid) return reply(401, { ok: false, signin: true, error: 'no Microsoft id in the sign-in' });
  const sub = b && b.sub;
  if (!sub || !okEndpoint(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return reply(400, { ok: false, error: 'bad subscription' });
  const sealed = K_.seal({ v: 1, u: who.oid, s: { endpoint: sub.endpoint, keys: { p256dh: clip(sub.keys.p256dh, 200), auth: clip(sub.keys.auth, 100) } } }, K);
  return reply(200, { ok: true, url: ORIGIN + '/api/chatnote?d=' + sealed, clientState: K_.clientState(sealed, K), cert: K.cert, certId: K.certId });
};
