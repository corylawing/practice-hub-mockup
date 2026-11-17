/* POST /api/chatnote?d=<sealed> - Microsoft calls this when a message arrives in one of the person's Teams chats
   (see ../chatkeys.js). It answers Microsoft's "is this you?" check (validationToken), opens the sealed address, checks
   the value Microsoft repeats (clientState), decrypts the message, SKIPS the person's own, and sends one alert to that
   device. Lifecycle notices (&l=1: "renew me", "removed", "missed") need nothing here - the page renews the link on
   the person's next visit. It always answers quickly (Microsoft wants an answer within 3 seconds) and says nothing
   about why something was skipped. */
'use strict';
const { send } = require('../webpush');
const K_ = require('../chatkeys');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

module.exports = async function (context, req) {
  const q = req.query || {};
  if (q.validationToken) { context.res = { status: 200, headers: { 'Content-Type': 'text/plain' }, body: clip(q.validationToken, 2000) }; return; }
  const done = () => { context.res = { status: 202, headers: { 'Content-Type': 'text/plain' }, body: '' }; };
  const K = K_.keys(); if (!K) return done();
  let b = {};
  try { b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.rawBody || '{}')); }
  catch (_) { return done(); }
  if (q.l) return done();                                             // a lifecycle notice
  const sealed = String(q.d || ''), box = K_.open(sealed, K);
  if (!box || !box.u || !box.s) return done();
  const cs = K_.clientState(sealed, K), jobs = [];
  (Array.isArray(b && b.value) ? b.value : []).slice(0, 50).forEach(n => {
    if (!n || n.clientState !== cs) return;                           // not Microsoft calling about this link
    if (n.tenantId && n.tenantId !== K_.TENANT) return;
    if (n.lifecycleEvent || n.changeType !== 'created' || !n.encryptedContent) return;
    const m = K_.decrypt(n.encryptedContent, K);
    if (!m || m.messageType !== 'message' || m.deletedDateTime) return;
    const from = m.from && m.from.user;
    if (!from || !from.id || from.id === box.u) return;               // their own message: no alert
    const chatId = m.chatId || ((/chats\('([^']+)'\)/.exec(n.resource || '') || [])[1]) || '';
    jobs.push(send(box.s, { title: clip(from.displayName || 'Home-Brace', 80), body: K_.preview(m),
      url: '/v1/chat.html' + (chatId ? '#chat=' + encodeURIComponent(chatId) : ''), tag: 'hb-chat' }, K.alert, K.alert.subject || K_.SUBJECT).catch(() => null));
  });
  if (jobs.length) await Promise.race([Promise.all(jobs), sleep(2500)]);
  done();
};
