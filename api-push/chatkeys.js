/* INSTANT CHAT ALERTS - the shared keys (18/11/2026). Cory: "build instant chat alerts" - a Home-Brace alert for EVERY
   Teams chat message (also ones typed in the Teams app), the moment Microsoft has it.
   How (all DELEGATED - no Microsoft secret, no app permission, nothing stored here):
     1. A pilot member's page asks /api/chatseal for a link: this device's alert address, SEALED with a key only this
        sender has (AES-256-GCM; derived from its own alert key, so there is no new secret), inside the address
        Microsoft will call (/api/chatnote?d=...), plus a check value (clientState) and this sender's PUBLIC certificate.
     2. The page, with the person's own sign-in, asks Microsoft to tell that address about new messages in their chats
        (/users/{them}/chats/getAllMessages, with the message encrypted to the certificate). Up to 3 days; every visit
        renews it. Microsoft allows 10 per person - one per device.
     3. Microsoft calls /api/chatnote with the message, encrypted. Only this sender can open the sealed address and
        decrypt the message (its private key: deploy/.chatcert.json, copied here at deploy, never in git). It skips the
        person's own messages and sends one alert to that device - then forgets it all. */
'use strict';
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const TENANT = 'edb81e45-7fa8-4147-982f-2f31c6298086';
const SUBJECT = 'https://corylawing.github.io/practice-hub-mockup/';
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const readJSON = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } };

/* The alert key (the same one /api/push signs with) and the chat certificate. null = not set up. */
let cache = null;
function alertKey() {
  const k = readJSON(path.join(__dirname, 'push', 'vapid.json'));
  if (k && k.publicKey && k.privateKey) return k;
  const e = process.env;
  return e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY ? { publicKey: e.VAPID_PUBLIC_KEY, privateKey: e.VAPID_PRIVATE_KEY, subject: e.VAPID_SUBJECT } : null;
}
function keys() {
  if (cache) return cache;
  const v = alertKey(), c = readJSON(path.join(__dirname, 'chatcert.json'));
  if (!v || !c || !c.privateKeyPem || !c.cert || !c.certId) return null;
  const seal = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(String(v.privateKey)), Buffer.from('home-brace chat alerts'), Buffer.from('seal v1'), 32));
  cache = { seal, cert: c.cert, certId: c.certId, priv: crypto.createPrivateKey(c.privateKeyPem), alert: v };
  return cache;
}

function seal(obj, K) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', K.seal, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return b64u(Buffer.concat([iv, ct, c.getAuthTag()]));
}
function open(str, K) {
  try {
    const raw = unb64u(str); if (raw.length < 29) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', K.seal, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(raw.length - 16));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]).toString('utf8'));
  } catch (_) { return null; }
}
/* The value Microsoft repeats with every notification for this link (max 128 characters). */
const clientState = (sealed, K) => b64u(crypto.createHmac('sha256', K.seal).update('cs|' + sealed).digest()).slice(0, 43);

/* Microsoft's encrypted message (https://learn.microsoft.com/graph/change-notifications-with-resource-data): the key is
   RSA-OAEP (SHA-1) to our certificate; the data is AES-256-CBC with that key (the IV = its first 16 bytes), signed with
   HMAC-SHA256. A signature that doesn't match = not opened. */
function decrypt(enc, K) {
  try {
    if (!enc || enc.encryptionCertificateId !== K.certId) return null;
    const key = crypto.privateDecrypt({ key: K.priv, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, Buffer.from(enc.dataKey, 'base64'));
    const data = Buffer.from(enc.data, 'base64');
    const sig = crypto.createHmac('sha256', key).update(data).digest('base64');
    if (!enc.dataSignature || sig !== enc.dataSignature) return null;
    const d = crypto.createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
    return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
  } catch (_) { return null; }
}

/* What the alert says: the words (plain text, like the alerts Home-Brace sends now), or what was sent. */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function preview(m) {
  const html = String((m && m.body && m.body.content) || '');
  let t = html.replace(/<emoji[^>]*alt="([^"]*)"[^>]*>(?:<\/emoji>)?/gi, '$1').replace(/<br\s*\/?>|<\/p>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (x, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] || x))
    .replace(/\s+/g, ' ').trim();
  const att = (m && m.attachments) || [], hc = (m && m.hostedContents) || [];
  const video = att.some(a => /\.(mp4|mov|m4v|webm|3gp)$/i.test(String((a && a.name) || '')));
  const media = video ? '🎥 Sent a video' : (/<img/i.test(html) || hc.length) ? '📷 Sent a photo' : att.length ? '📎 Sent a file' : '';
  if (!t) t = media || 'New message';
  else if (media) t = media.slice(0, 2) + ' ' + t;
  return t.length > 140 ? t.slice(0, 139) + '…' : t;
}

module.exports = { keys, alertKey, seal, open, clientState, decrypt, preview, b64u, unb64u, TENANT, SUBJECT,
  _set(k) { cache = k; } };
