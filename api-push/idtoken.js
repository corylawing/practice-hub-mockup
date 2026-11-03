/* WHO IS ASKING (03/11/2026). The page sends its Microsoft sign-in (the ID token MSAL keeps for Home-Brace); this checks
   that it is real - signed with a key Microsoft publishes for the practice's tenant - that it was issued to Home-Brace
   (aud), by the practice's tenant (tid, iss), and that it hasn't expired. So only people signed in to the practice can
   use the alert sender. It needs no Microsoft secrets: the keys it checks with are public, and so are both IDs. */
'use strict';
const crypto = require('crypto');
const TENANT = 'edb81e45-7fa8-4147-982f-2f31c6298086', CLIENT = '2122a06f-b6e9-4618-9106-3b6d6a84b5eb';
const ISSUER = 'https://login.microsoftonline.com/' + TENANT + '/v2.0';
const KEYS_URL = 'https://login.microsoftonline.com/' + TENANT + '/discovery/v2.0/keys';
const SKEW = 300;                                   // seconds of clock difference allowed either way
let cache = { at: 0, keys: [] }, lastForced = 0;
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

async function keys(force, fetchImpl, now) {
  if (!force && cache.keys.length && now - cache.at < 12 * 3600e3) return cache.keys;
  const r = await (fetchImpl || fetch)(KEYS_URL);
  if (!r || !r.ok) throw new Error('could not get Microsoft’s keys');
  const j = await r.json();
  cache = { at: now, keys: (j && Array.isArray(j.keys)) ? j.keys : [] };
  return cache.keys;
}

/* Resolves {who, oid} or throws. opts: {fetch, now} for tests. */
async function verify(token, opts) {
  opts = opts || {};
  const now = opts.now || Date.now();
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('not signed in');
  let head, body;
  try { head = JSON.parse(unb64u(parts[0]).toString()); body = JSON.parse(unb64u(parts[1]).toString()); }
  catch (_) { throw new Error('not a sign-in'); }
  if (head.alg !== 'RS256' || !head.kid) throw new Error('not a sign-in');
  let ks = await keys(false, opts.fetch, now), jwk = ks.find(k => k.kid === head.kid);
  if (!jwk && now - lastForced > 300e3) {           // Microsoft rotates its keys now and then - fetch again, at most every 5 min
    lastForced = now; ks = await keys(true, opts.fetch, now); jwk = ks.find(k => k.kid === head.kid);
  }
  if (!jwk || jwk.kty !== 'RSA') throw new Error('signed with a key Microsoft doesn’t list');
  const pub = crypto.createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
  if (!crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), pub, unb64u(parts[2]))) throw new Error('the signature doesn’t match');
  const t = Math.floor(now / 1000);
  if (body.aud !== CLIENT) throw new Error('not a Home-Brace sign-in');
  if (body.tid !== TENANT || body.iss !== ISSUER) throw new Error('not the practice’s sign-in');
  if (!(Number(body.exp) > t - SKEW)) throw new Error('sign-in expired');
  if (body.nbf && Number(body.nbf) > t + SKEW) throw new Error('sign-in not valid yet');
  return { who: String(body.preferred_username || body.email || '').toLowerCase(), oid: String(body.oid || '') };
}
module.exports = { verify, TENANT, CLIENT, ISSUER, KEYS_URL, _reset() { cache = { at: 0, keys: [] }; lastForced = 0; } };
