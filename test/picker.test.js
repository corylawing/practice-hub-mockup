/* MODERN PICKLISTS + SEVERAL PEOPLE IN "ADD TO PAYROLL" (17/11/2026). SANDBOX ONLY until user.js PICK_LIVE is true.
       node test/picker.test.js

   Cory: "Can we make more modern picklists please? Also ability to type to narrow down list?" Heather: "Could you make
   it to where I could select multiple people from an office but not everyone." Made-up people. */
const fs=require('fs'), path=require('path');
const U=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8');
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const line=(src,re)=>{ const m=src.match(re); if(!m) throw new Error('missing '+re); return m[0]; };
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };

const P=new Function(line(U,/const PICK_MIN=\d+;/)+'\n'+line(U,/const pickNorm=[^\n]*/)+'\n'+line(U,/const pickSplit=[^\n]*/)+'\n'+line(U,/const pickHit=[^\n]*/)+'\n'+
  line(U,/const pickWants=sel=>[^\n]*\n[^\n]*/)+'\nreturn {PICK_MIN, pickNorm, pickSplit, pickHit, pickWants};')();

t('OFF on the live site until Cory says so; on everywhere else (the sandbox)', /const PICK_LIVE=false;/.test(U) && /function pickOn\(\)\{ return PICK_LIVE \|\| env\(\)!=='live'; \}/.test(U) &&
  /if\(typeof document==='undefined' \|\| typeof window==='undefined' \|\| !pickOn\(\)\) return;/.test(U) && /window\.PH=\{PEOPLE,newHiresOn,pickOn,/.test(U));
t('typing narrows it down: any word, any order, any case, accents ignored, the office in grey counts too',
  P.pickHit('Alyssa Smith · Carlsbad','carl aly') && P.pickHit('Joemily "Emmy" Prieto · Cruces LCO','emmy') && P.pickHit('Ramírez, José','jose ramirez') &&
  !P.pickHit('Alyssa Smith · Carlsbad','hobbs') && P.pickHit('anything','') && P.pickHit('Ana · Hobbs','  '));
t('"Name · Office" shows the office in grey; a plain choice stays whole', P.pickSplit('Alyssa Smith · Carlsbad').join('|')==='Alyssa Smith|Carlsbad' && P.pickSplit('Carlsbad').join('|')==='Carlsbad|');
const S=(n, o)=>Object.assign({tagName:'SELECT', multiple:false, options:{length:n}, _a:{}, hasAttribute(k){ return k in this._a; }}, o||{});
t('which lists: '+P.PICK_MIN+' or more choices, one that takes several, or one marked data-pick - never a short Yes/No, never data-native, never twice',
  P.pickWants(S(P.PICK_MIN)) && !P.pickWants(S(P.PICK_MIN-1)) && !P.pickWants(S(2)) && P.pickWants(S(2,{multiple:true})) && P.pickWants(S(2,{_a:{'data-pick':1}})) &&
  !P.pickWants(S(30,{_a:{'data-native':1}})) && !P.pickWants(S(30,{_a:{'data-pk':1}})) && !P.pickWants({tagName:'INPUT'}));
t('the page’s own list stays underneath and keeps the value: picking sets it and fires its "change" (every page works as before)',
  /sel\.classList\.add\('phpk-hid'\)/.test(U) && /function fire\(sel\)\{ sel\.dispatchEvent\(new Event\('input',\{bubbles:true\}\)\); sel\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\); \}/.test(U) &&
  /if\(sel\.value!==was\) fire\(sel\);/.test(U) && /sel\.addEventListener\('change', \(\)=>paint\(sel\)\);/.test(U));
t('keyboard: arrows, Enter picks, Esc closes; typing on the closed box opens it with what was typed', /if\(e\.key==='ArrowDown'\)\{ e\.preventDefault\(\); hi\(act\+1\); \}/.test(U) &&
  /else if\(e\.key==='Enter'\)\{ e\.preventDefault\(\); choose\(vis\(\)\[act\]\); \}/.test(U) && /else if\(e\.key==='Escape'\)\{ e\.preventDefault\(\); close\(\); b\.focus\(\); \}/.test(U) &&
  /if\(e\.key\.length===1 && !e\.ctrlKey && !e\.metaKey && !e\.altKey && !OPEN\)\{ e\.preventDefault\(\); open\(sel, e\.key\); \}/.test(U));
t('several at once: tick boxes, "N chosen", Clear and Done; an "Everyone at …" choice stands alone', /\.phpk-box/.test(U) && /k\+' chosen'/.test(U) &&
  /if\(on && it\.o\.hasAttribute\('data-solo'\)\) \[\.\.\.sel\.options\]\.forEach\(o=>\{ if\(o!==it\.o\) o\.selected=false; \}\);/.test(U) &&
  /if\(on && !it\.o\.hasAttribute\('data-solo'\)\) \[\.\.\.sel\.options\]\.forEach\(o=>\{ if\(o\.hasAttribute\('data-solo'\)\) o\.selected=false; \}\);/.test(U));
t('lists drawn later (and in a tab in the background) are picked up: straight from the page-change callback, no animation frames',
  /new MutationObserver\(later\)\.observe\(document\.documentElement, \{childList:true, subtree:true\}\)/.test(U) && !/requestAnimationFrame/.test(fnOf(U,'later')) &&
  !/phpkin/.test(U));
t('what people typed is never put in as HTML (text only)', !/innerHTML=[^;]*o\.text/.test(U) && /tt\.textContent=t;/.test(U) && /v\.textContent=L\.t;/.test(U));
t('the test stand-in (no real browser) skips it', /typeof window\.addEventListener!=='function'/.test(U));

/* Payroll: several people */
const R=fnOf(H,'addRead');
t('Add to payroll: several people only with the new picker (live keeps one choice until both go live)',
  /const MULTI=\(\)=>!!\(window\.PH && PH\.pickOn && PH\.pickOn\(\)\);/.test(H) && /\(MULTI\(\) \? ' multiple data-pick data-ph="Pick who - one person, several, or everyone"' : ''\)/.test(H) &&
  /<option value="all"'\+\(MULTI\(\)\?' data-solo':''\)\+'>/.test(H) && /<option value="office:'\+o\.k\+'"'\+\(MULTI\(\)\?' data-solo':''\)/.test(H));
t('…two or more people = one entry for just them ({k:"some", ps:[{o, pid}]}); one = one person, as before',
  /if\(picked && picked\.length>1 && picked\.every\(v=>\/\^person:\/\.test\(v\)\)\)\{/.test(R) && /to:ps\.length>1 \? \{k:'some', ps\} : ps\.length \? \{k:'person', o:ps\[0\]\.o, pid:ps\[0\]\.pid\} : null/.test(R) && /howMany:ps\.length/.test(R));
t('…it lands on exactly those people’s rows, and shows who, how many and the total', /if\(t\.k==='some'\) return \(t\.ps\|\|\[\]\)\.some\(q=>q && q\.o===o && q\.pid===p\.id\);/.test(H) &&
  /t\.k==='some' \? \[\.\.\.new Set\(\(t\.ps\|\|\[\]\)\.map\(q=>q && q\.o\)\.filter\(k=>OFF\[k\]\)\)\]/.test(H) && /if\(t\.k==='some'\)\{ const ps=/.test(H) &&
  /money\(r\.amt\)\+' each × '\+r\.howMany\+' people = <b>'\+money\(r\.amt\*r\.howMany\)/.test(H));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
