/* PHONE ALERTS: the sender (api-push).
       node test/push.test.js

   22/10/2026, Cory: "yes for phone alerts we need that" - payroll reminders and chat alerts on phones and computers.
   The sender signs and sends ONE Web Push alert to ONE device. These check the encryption byte for byte against
   RFC 8291's worked example, the sender's signature (RFC 8292), and that the function refuses what it should:
   pages from elsewhere, alert addresses that aren't a real push service, links off the site. No network. */
const crypto=require('crypto'), path=require('path');
const W=require(path.join(__dirname,'..','api-push','webpush.js'));
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const strip=s=>s.replace(/\s+/g,'');

/* ---- 1. RFC 8291 Appendix A, byte for byte ---- */
{
  const plain=W.unb64u('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24');
  const out=W.encrypt(plain, 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    'BTBZMqHH6r4Tts7J_aSIgg', {asPrivate:'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', salt:'DGv6ra1nlYgDCS1FRnbzlw'});
  const header=strip('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z 9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml mlMoZIIgDll6e3vCYLocInmYWAmS6Tlz AC8wEqKK6PBru3jl7A8');
  const cipher=strip('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrd irN6GcG7sFz1y1sqLgVi1VhjVkHsUoEs bI_0LpXMuGvnzQ');
  t('the header is RFC 8291\'s 86 octets', out.length>=86 && W.b64u(out.subarray(0,86))===header);
  t('the ciphertext is RFC 8291\'s, byte for byte', W.b64u(out.subarray(86))===cipher);
  t('the message is the header followed by the ciphertext', W.b64u(out)===W.b64u(Buffer.concat([W.unb64u(header), W.unb64u(cipher)])));
}

/* ---- 2. A real round trip: a device's own keys open what the sender sealed ---- */
function open(body, uaEcdh, authSecret){
  const salt=body.subarray(0,16), idlen=body[20], asPublic=body.subarray(21,21+idlen), ct=body.subarray(21+idlen);
  const secret=uaEcdh.computeSecret(asPublic), uaPublic=uaEcdh.getPublicKey();
  const hk=(ikm,s,info,n)=>Buffer.from(crypto.hkdfSync('sha256',ikm,s,info,n));
  const ikm=hk(secret, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const cek=hk(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce=hk(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d=crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length-16));
  const pt=Buffer.concat([d.update(ct.subarray(0,ct.length-16)), d.final()]);
  return pt.subarray(0, pt.lastIndexOf(2)).toString();
}
{
  const ua=crypto.createECDH('prime256v1'); ua.generateKeys(); const auth=crypto.randomBytes(16);
  const msg=JSON.stringify({title:'Payroll sheet due today by 2 pm', body:'Cedar Grove · pay period #22'});
  const a=W.encrypt(Buffer.from(msg), W.b64u(ua.getPublicKey()), W.b64u(auth)), b=W.encrypt(Buffer.from(msg), W.b64u(ua.getPublicKey()), W.b64u(auth));
  t('the device opens it and reads the same message', open(a, ua, auth)===msg);
  t('every send uses a new key and salt (two sends never look alike)', !a.equals(b) && !a.subarray(0,16).equals(b.subarray(0,16)));
  let threw=false; try{ W.encrypt(Buffer.from('x'), W.b64u(Buffer.alloc(20)), W.b64u(auth)); }catch(_){ threw=true; }
  t('a broken device key is refused, not guessed at', threw);
}

/* ---- 3. The sender's signature (RFC 8292) ---- */
{
  const ec=crypto.createECDH('prime256v1'); ec.generateKeys();
  const keys={publicKey:W.b64u(ec.getPublicKey()), privateKey:W.b64u(ec.getPrivateKey())};
  const now=1792656000, hdr=W.vapid('https://fcm.googleapis.com/fcm/send/abc123', keys, 'https://corylawing.github.io/practice-hub-mockup/', now);
  const m=/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(hdr);
  t('the header is "vapid t=<token>, k=<public key>"', !!m && m[4]===keys.publicKey);
  const claims=JSON.parse(W.unb64u(m[2]).toString()), head=JSON.parse(W.unb64u(m[1]).toString());
  t('signed ES256', head.alg==='ES256' && head.typ==='JWT');
  t('addressed to the push service only (its origin, no path)', claims.aud==='https://fcm.googleapis.com');
  t('good for 12 hours (push services allow at most 24)', claims.exp===now+12*3600);
  t('names the sender with a web address, not a person\'s email', claims.sub==='https://corylawing.github.io/practice-hub-mockup/');
  const pub=W.unb64u(keys.publicKey);
  const pk=crypto.createPublicKey({format:'jwk', key:{kty:'EC', crv:'P-256', x:W.b64u(pub.subarray(1,33)), y:W.b64u(pub.subarray(33,65))}});
  t('the signature checks out with the sender\'s public key', crypto.verify('sha256', Buffer.from(m[1]+'.'+m[2]), {key:pk, dsaEncoding:'ieee-p1363'}, W.unb64u(m[3])));
}

/* ---- 4. Only real push services ---- */
t('Google (Chrome, Android) is a push service', W.okEndpoint('https://fcm.googleapis.com/fcm/send/x'));
t('Apple (iPhone, Safari) is a push service', W.okEndpoint('https://web.push.apple.com/QAbc'));
t('Microsoft (Edge) is a push service', W.okEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x'));
t('Mozilla (Firefox) is a push service', W.okEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'));
t('anything else is refused', !W.okEndpoint('https://example.com/fcm.googleapis.com') && !W.okEndpoint('https://fcm.googleapis.com.evil.example/x'));
t('plain http is refused', !W.okEndpoint('http://fcm.googleapis.com/fcm/send/x'));
t('junk is refused', !W.okEndpoint('not a url') && !W.okEndpoint(''));

/* ---- 5. The function itself ---- */
(async ()=>{
  const ec=crypto.createECDH('prime256v1'); ec.generateKeys();
  process.env.VAPID_PUBLIC_KEY=W.b64u(ec.getPublicKey()); process.env.VAPID_PRIVATE_KEY=W.b64u(ec.getPrivateKey());
  const fn=require(path.join(__dirname,'..','api-push','push','index.js'));
  const ua=crypto.createECDH('prime256v1'); ua.generateKeys(); const auth=crypto.randomBytes(16);
  const sub={endpoint:'https://web.push.apple.com/QAbc', keys:{p256dh:W.b64u(ua.getPublicKey()), auth:W.b64u(auth)}};
  let sent=null; const realFetch=global.fetch;
  global.fetch=async (url, o)=>{ sent={url, o}; return {status:201}; };
  const call=async (origin, body, method)=>{ const ctx={}; await fn(ctx, {method:method||'POST', headers:origin?{origin}:{}, body:typeof body==='string'?body:JSON.stringify(body)}); return {status:ctx.res.status, headers:ctx.res.headers, body:JSON.parse(ctx.res.body)}; };

  let r=await call('https://evil.example', {sub, title:'x'});
  t('a page from anywhere else is refused (403)', r.status===403 && !sent);
  r=await call('', {sub, title:'x'});
  t('no origin at all is refused too', r.status===403 && !sent);
  r=await call('https://corylawing.github.io', {sub:{endpoint:'https://example.com/x', keys:sub.keys}, title:'x'});
  t('an alert address that isn\'t a push service is refused (400)', r.status===400 && !sent);
  r=await call('https://corylawing.github.io', '{not json');
  t('junk is refused (400)', r.status===400 && !sent);
  r=await call('https://corylawing.github.io', {sub, title:'Payroll sheet due today by 2 pm', body:'Cedar Grove · pay period #22', url:'/practice-hub-mockup/v1/payroll.html', tag:'payroll-22'});
  t('the sandbox can send one (200, ok)', r.status===200 && r.body.ok===true && r.headers['Access-Control-Allow-Origin']==='https://corylawing.github.io');
  t('it went to that device\'s push service, encrypted, signed', !!sent && sent.url===sub.endpoint && sent.o.headers['Content-Encoding']==='aes128gcm' && /^vapid t=/.test(sent.o.headers.Authorization));
  t('and the device can read it', JSON.parse(open(Buffer.from(sent.o.body), ua, auth)).title==='Payroll sheet due today by 2 pm');
  sent=null;
  r=await call('https://corylawing.github.io', {sub, title:'x'.repeat(500), body:'y'.repeat(2000), url:'https://evil.example/phish'});
  const m=JSON.parse(open(Buffer.from(sent.o.body), ua, auth));
  t('long text is cut to size', m.title.length===80 && m.body.length===240);
  t('a link off the site is dropped (only a path on the page\'s own site)', m.url==='');
  global.fetch=async ()=>({status:410});
  r=await call('https://corylawing.github.io', {sub, title:'x'});
  t('a device that turned alerts off is reported as gone', r.status===502 && r.body.gone===true);
  global.fetch=realFetch;
  console.log(pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
