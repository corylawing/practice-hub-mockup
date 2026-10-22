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
function run(o){
  const store=Object.assign({}, o.store||{}); let went=null;
  const window={ opener:o.opener||null };
  const ctx={ window, sessionStorage:{ getItem:k=>k in store?store[k]:null },
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
t('gate.js: the home-screen sign-in is sandbox only for now (never on the live site)', /USE_REDIRECT = STANDALONE && !LIVE/.test(gate));
t('gate.js: a normal browser still signs in with the popup', /app\.loginPopup\(\{ scopes: SCOPES \}\)/.test(gate) && /if \(USE_REDIRECT\)\{ goSignIn\(app\)/.test(gate));
t('gate.js: on the way back the in-progress sign-in is not wiped before MSAL reads it', /var BACKFROM = returning\(\);\s*if \(!BACKFROM\) try\{/.test(gate));
console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
