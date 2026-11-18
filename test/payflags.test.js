/* PAYROLL "WORTH A SECOND LOOK" - EASIER TO READ (18/11/2026, Cory: "I don't like the layout its not userfriendly" ->
   mock-up -> "build it").    node test/payflags.test.js
   Chips at the top show one kind at a time; each row: who + office | what happened (note in grey under it) | the pay
   effect as a coloured tag + any button that fixes it. The download and the sums are untouched (t stays as it was). */
const fs=require('fs'), path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=H.indexOf('{', i);
  for(let k=j;k<H.length;k++){ if(H[k]==='{') d++; else if(H[k]==='}'){ d--; if(!d) return H.slice(i, k+1); } } return ''; };
const F=fn('flags');
const kinds=['ot','green','er','spb','pay','miles','doc','two','add'];
t('every kind says it in three parts: what happened (w), the tag (g) and its colour (k)', kinds.every(k=>new RegExp('F\\.'+k+'\\.push\\(\\{[\\s\\S]*?w:[\\s\\S]*?g:[\\s\\S]*?k:').test(F)));
t('the tags: no bonus / no day rate / not approved / over 40 = red; a cut = amber; kept / approved = green; extra pay or hours = teal',
  /g:x\.bonus==='none'\?'No bonus':x\.bonus==='partial'\?'−'\+cutText\(x\)\+' · '\+money\(c\.ppb\)\+' of '\+money\(bonusOf\(p\)\):'Full bonus kept', k:x\.bonus==='none'\?'bad':x\.bonus==='partial'\?'cut':'ok'/.test(F) &&
  /g:otOK\(x,w\)\?'Approved':'Not approved', k:otOK\(x,w\)\?'ok':'bad'/.test(F) && /g:'\+'\+num\(x\.ers\)\+' h pay', k:'info'/.test(F) && /k:w1>40\|\|w2>40\?'bad':'info'/.test(F) &&
  /const tag=\{bad:'p-late', cut:'p-go', ok:'p-done', info:'p-info'\};/.test(H));
t('notes go on a grey line under the row (the office’s own words in quotes), trimmed to one line with the whole note on hover', /nt:x\.notes\|\|''/.test(F) &&
  /'<div class="fnote" title="'\+esc\(f\.nt\)\+'">'/.test(H) && /\.fnote\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis/.test(H));
t('a doctor with no day rate gets "Set rate" right on the row (only for whoever manages payroll)', /btn:dp\.pay===null && holCan\(\) && rateStarts\(\)\.length \? '<button class="btn ghost sm" data-act="docrate"/.test(F) && /\+\(f\.btn\|\|''\)\+/.test(H));
t('chips at the top: All, then each kind with its count; one kind at a time; the choice stays while she works and the list doesn’t jump',
  /let tab='sheet', per=HOME\(\), look='', FLT='all';/.test(H) && /data-act="flt" data-v="'\+c\[0\]\+'" aria-pressed=/.test(H) && /shown\.filter\(g=>FLT==='all' \|\| FLT===g\[0\]\)/.test(H) &&
  /if\(act==='flt'\)\{ FLT=v\|\|'all'; const y=b\.getBoundingClientRect\(\)\.top; render\(\);/.test(H));
t('columns line up across every kind (fixed widths); one column on a phone', /\.fl\{display:grid;grid-template-columns:210px minmax\(0,1fr\) 250px;/.test(H) && /@media\(max-width:640px\)\{ \.fl\{grid-template-columns:1fr;/.test(H));
t('nothing typed by an office goes in as HTML (names, what, tags and notes all escaped)', /esc\(f\.who \|\| disp\(f\.p\)\)/.test(H) && /esc\(f\.w \|\| ''\)/.test(H) && /esc\(f\.g \|\| ''\)/.test(H) && /esc\(f\.on \|\| f\.o\.n\)/.test(H));
t('the old wording (t) is kept for anything else that reads it', kinds.every(k=>new RegExp('F\\.'+k+'\\.push\\(\\{[^}]*?t:').test(F) || new RegExp('F\\.'+k+'\\.push\\(\\{who:d\\.n, o, t:').test(F)));
console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
