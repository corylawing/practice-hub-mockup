/* SIGN-IN IN AN IPHONE HOME-SCREEN APP: auth.html's one script.
       node test/signin.test.js

   22/10/2026 (phone alerts): Apple only sends alerts to Home-Brace on the home screen, and a home-screen app can't use
   the sign-in popup, so there (sandbox only for now) gate.js sends the whole page to Microsoft and back. The answer
   lands on auth.html, which must hand it straight back to the page that started - and must NEVER run in a popup,
   where the opener reads the fragment itself (the original reason auth.html is blank). */
const fs=require('fs'), vm=require('vm'), path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','v1','auth.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
let lastNote='';
function run(o){
  const store=Object.assign({}, o.store||{}); let went=null; lastNote='';
  const window={ opener:o.opener||null };
  const body={ appendChild:d=>{ lastNote=d.innerHTML; } };
  const ctx={ window, sessionStorage:{ getItem:k=>k in store?store[k]:null },
    setTimeout:(f, ms)=>{ if(ms>=2000) f(); },          // only ever a delayed note: run it now
    document:{ body, createElement:()=>({style:{}, innerHTML:''}) },
    location:{ origin:'https://corylawing.github.io', hash:o.hash||'', replace:u=>{ went=u; } } };
  vm.runInNewContext(scripts[0], ctx);
  return went;
}
const BACK='https://corylawing.github.io/practice-hub-mockup/v1/chat.html';
t('exactly one script, no MSAL, no other files', scripts.length===1 && !/msal/i.test(scripts[0]) && !/<script src|<link /i.test(html));
t('a popup (it has an opener) is left alone - the opener reads the fragment', run({opener:{}, store:{ph_signin_redirect:BACK}, hash:'#code=abc&state=s'})===null);
t('back from Microsoft in the app: straight back to the page that started, answer and all', run({store:{ph_signin_redirect:BACK}, hash:'#code=abc&state=s'})===BACK+'#code=abc&state=s');
t('nothing to hand back without the page that started', run({hash:'#code=abc&state=s'})===null);
t('nothing to hand back without an answer', run({store:{ph_signin_redirect:BACK}})===null);
t('never to another site, whatever is stored', run({store:{ph_signin_redirect:'https://evil.example/x'}, hash:'#code=abc'})===null);
t('a stored address with an old fragment is trimmed first', run({store:{ph_signin_redirect:BACK+'#old'}, hash:'#code=abc'})===BACK+'#code=abc');
const gate=fs.readFileSync(path.join(__dirname,'..','v1','gate.js'),'utf8');
t('gate.js: the home-screen app signs in by redirect, on the sandbox and the live site (04/11)', /USE_REDIRECT = STANDALONE \|\| PHONE;/.test(gate));
/* 11/11/2026, hc144: Dr. Farnsworth "stuck after the authenticator" - phones and tablets sign in on the same tab too. */
{
  const m=/var PHONE = ([\s\S]*?);\n/.exec(gate);
  const phone=nav=>m && vm.runInNewContext(m[1].replace(/NAV/g,'nav'), {nav});
  t('gate.js: an iPhone signs in on the same tab', phone({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1', platform:'iPhone', maxTouchPoints:5})===true);
  t('gate.js: an Android phone too', phone({userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130 Mobile', platform:'Linux armv8l', maxTouchPoints:5})===true);
  t('gate.js: an iPad (which calls itself a Mac) too', phone({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1', platform:'MacIntel', maxTouchPoints:5})===true);
  t('gate.js: a Mac or Windows computer keeps the popup', phone({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130', platform:'MacIntel', maxTouchPoints:0})===false &&
    phone({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/130', platform:'Win32', maxTouchPoints:10})===false);
}
/* auth.html is never a dead end: a window still sitting on it says what to do. */
run({opener:{}, store:{}, hash:'#code=abc&state=s'});
t('auth.html: a sign-in window left behind says "go back to the Home-Brace tab"', /signed in/i.test(lastNote) && /Home-Brace tab/.test(lastNote));
t('auth.html: and the note never touches the answer in the address', run({opener:{}, hash:'#code=abc'})===null && !/location\.(hash|href)\s*=/.test(scripts[0]));
run({store:{}, hash:''});
t('auth.html: a sign-in that lost its way offers to open Home-Brace again', /didn.t finish/i.test(lastNote) && /href="home\.html"/.test(lastNote));
run({store:{ph_signin_redirect:BACK}, hash:'#code=abc'});
t('auth.html: a normal return goes straight back, with no note', lastNote==='');
t('gate.js: a normal browser still signs in with the popup', /app\.loginPopup\(\{ scopes: SCOPES \}\)/.test(gate) && /if \(USE_REDIRECT\)\{ goSignIn\(app\)/.test(gate));
t('gate.js: on the way back the in-progress sign-in is not wiped before MSAL reads it', /var BACKFROM = returning\(\);\s*if \(!BACKFROM\) try\{/.test(gate));
console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
