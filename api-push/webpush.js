/* Web Push for Home-Brace's alert sender - no dependencies, Node's own crypto.
   encrypt(): RFC 8291 (aes128gcm) - the message is encrypted for ONE device, with the keys in its subscription.
   vapid():   RFC 8292 - the sender proves who it is with its own alert key (ES256). No Microsoft keys anywhere.
   send():    POST to the device's push service (Apple, Google, Microsoft or Mozilla).
   test/push.test.js checks encrypt() against RFC 8291's worked example, byte for byte. */
'use strict';
const crypto = require('crypto');

const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hkdf = (ikm, salt, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

/* fixed = {asPrivate, salt} only for the RFC example; a real send makes a new key and salt every time */
function encrypt(plaintext, uaPublicB64u, authSecretB64u, fixed) {
  const uaPublic = unb64u(uaPublicB64u), authSecret = unb64u(authSecretB64u);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('bad p256dh');
  if (authSecret.length !== 16) throw new Error('bad auth');
  const ecdh = crypto.createECDH('prime256v1');
  if (fixed && fixed.asPrivate) ecdh.setPrivateKey(unb64u(fixed.asPrivate)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();                                   // 65 bytes, uncompressed
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  const salt = fixed && fixed.salt ? unb64u(fixed.salt) : crypto.randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = hkdf(ecdhSecret, authSecret, keyInfo, 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);   // header (86 bytes) + ciphertext
}

/* keys = {publicKey, privateKey} (base64url: the 65-byte public point, the 32-byte private number), subject = https: or mailto: */
function vapid(endpoint, keys, subject, nowSec) {
  const pub = unb64u(keys.publicKey);
  const key = crypto.createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: keys.privateKey,
    x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
  const aud = new URL(endpoint).origin;
  const exp = (nowSec || Math.floor(Date.now() / 1000)) + 12 * 3600;     // at most 24 h ahead; 12 h is plenty
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' + b64u(JSON.stringify({ aud, exp, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head), { key, dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + head + '.' + b64u(sig) + ', k=' + keys.publicKey;
}

/* The push services a real browser's subscription points at. Anything else is refused. */
const PUSH_HOST = /(^|\.)(fcm\.googleapis\.com|push\.apple\.com|notify\.windows\.com|push\.services\.mozilla\.com)$/i;
function okEndpoint(endpoint) {
  try { const u = new URL(endpoint); return u.protocol === 'https:' && PUSH_HOST.test(u.hostname); } catch (_) { return false; }
}

async function send(sub, message, keys, subject, fetchImpl) {
  if (!sub || !okEndpoint(sub.endpoint) || !sub.keys) throw new Error('bad subscription');
  const body = encrypt(Buffer.from(JSON.stringify(message)), sub.keys.p256dh, sub.keys.auth);
  const r = await (fetchImpl || fetch)(sub.endpoint, { method: 'POST', body, headers: {
    'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', TTL: '86400', Urgency: 'high',
    Authorization: vapid(sub.endpoint, keys, subject) } });
  return { status: r.status, gone: r.status === 404 || r.status === 410 };   // gone = that device turned alerts off
}

module.exports = { encrypt, vapid, send, okEndpoint, b64u, unb64u };
