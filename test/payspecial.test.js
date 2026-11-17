/* SPECIAL BONUS (Haley's idea, 17/11/2026 - Cory: "build it"). SANDBOX ONLY until payroll.html SPECIAL_LIVE is true.
       node test/payspecial.test.js

   The office types a one-off Special bonus $ for a person on its own sheet and must say what it's for. It counts at
   once: into Heather's Extra and the Total, "Worth a second look", the combined sheet and the download. Heather's own
   list of categories (Settings) starts EMPTY; once it has one, the office picks one too. Made-up people. */
const fs=require('fs'), path=require('path');
const R=require(path.join(__dirname,'..','v1','payrules.js'));
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=H.indexOf('{', i);
  for(let k=j;k<H.length;k++){ if(H[k]==='{') d++; else if(H[k]==='}'){ d--; if(!d) return H.slice(i, k+1); } } return ''; };

t('ON for the live site (hc175, Cory: "special bonus live"); setting SPECIAL_LIVE false again leaves only the sandbox with it',
  /const SPECIAL_LIVE=true;/.test(H) && /const SPBON=\(\)=>SPECIAL_LIVE \|\| !\(window\.PH && PH\.isLive && PH\.isLive\(\)\);/.test(H));

const per={hol:null}, p={start:'2020-01-01'};
const c=x=>R.calc(p, x, per, undefined, 0, {});
t('$75 special bonus = $75 more in Extra and in Total (nothing else moves)', c({spb:75}).extra===75 && c({spb:75}).total===75 && c({}).total===0);
t('…added to Heather’s own Extra and any exception commuter pay', R.calc(p, {spb:75, exc:20}, per, undefined, 0, {extra:100}).extra===195);
t('the page adds it the same way, and keeps the amount on its own (for the lines under Extra)',
  /extra=r2\(num\(x\.extra\)\+num\(x\.exc\)\+num\(x\.spb\)\)/.test(H) && /spb:num\(x\.spb\)/.test(H));

const I=fn('issues');
t('an amount without what it’s for can’t be sent ("say what it’s for")',
  /if\(spbHas\(x\) && !String\(x\.spbWhy\|\|''\)\.trim\(\)\) out\.push\(\{p, t:'<b>'\+nm\+'<\/b>: special bonus of '\+money\(num\(x\.spb\)\)\+' — say what it’s for\.'\}\);/.test(I));
t('…once Heather has categories, the office must pick one too', /if\(spbHas\(x\) && spbTypes\(\)\.length && !x\.spbType\) out\.push\(\{p, t:'<b>'\+nm\+'<\/b>: special bonus — pick its category\.'\}\);/.test(I));
t('the word is "category" (Cory: "Add a kind is strange language" ... "yah Categories")', /<h2>Special bonus categories<\/h2>/.test(H) && />\+ Add a category<\/button>/.test(H) &&
  /<option value="">Category…<\/option>/.test(H) && !/Add a kind|Kind…|Add a type|>Type…</.test(H));
t('…and the Send button stops on anything in that list (as before)', /const o=R\(\)\.office, list=issues\(per,o\);\n\s*if\(list\.length\)\{ toast\('Fix the '/.test(H));

/* the kinds list: Heather's, names only */
const m=fn('cleanSpbTypes'); const clean=new Function(m+' return cleanSpbTypes;')();
t('categories: trimmed, once each (any case), 40 letters at most, 30 at most, junk ignored',
  clean({list:['  Patient   referral ','patient referral','', null, 'x'.repeat(80), 7]}).join('|')==='Patient referral|'+'x'.repeat(40)+'|7' &&
  clean(null).length===0 && clean({list:'nope'}).length===0 && clean({list:Array.from({length:40},(_,i)=>'k'+i)}).length===30);
t('categories start EMPTY and live in the shared list ph_pay_spbtypes (read by the senders too, with the holidays)',
  /const SPB_KEY='ph_pay_spbtypes';\n\s*let SPBTYPES=\[\];/.test(H) && /loadHolEdits\(\),\n\s*loadSpbTypes\(\),\n\s*lv==='send' \? null/.test(H));

const T=fn('sheetTable');
t('the office sheet: Special bonus $ + What it’s for - shown when the switch is on, or whenever an amount was typed',
  /const spbCol=SPBON\(\) \|\| ppl\.some\(p=>spbHas\(s\.rows\[p\.id\]\)\)/.test(T) && /info\('Special bonus \$'/.test(T) && /info\('What it’s for'/.test(T) &&
  /\(spbCol \? '<td class="n gl">'\+cell\(p,'spb',66,x\.spb\)\+'<\/td><td>'\+spbWhy\(p,x\)\+'<\/td>' : ''\)/.test(T));
t('…the Category picker only when there are categories; one taken off since stays on the row that used it; names escaped',
  /return \(ks\.length \? '<select/.test(T) && /if\(x\.spbType && ks\.indexOf\(x\.spbType\)<0\) ks\.push\(x\.spbType\);/.test(T) &&
  /'<option value="'\+esc\(k\)\+'"'/.test(T) && /value="'\+esc\(x\.spbWhy\|\|''\)\+'"/.test(T));
t('typing in them is saved like Notes (text, 200 letters at most)', /\['notes','comTo','mg','bonus','cutBy','spbWhy','spbType'\]\.indexOf\(f\)>=0\) x\[f\]=f==='spbWhy' \? String\(t\.value\)\.slice\(0,200\) : t\.value;/.test(H));
t('the office’s "Heather’s rules" mention it only when it’s on', /\(SPBON\(\) \? '<li><b>Special bonus:<\/b>/.test(H));

t('Heather: "Worth a second look" lists every special bonus (amount, type, what for)',
  /if\(spbHas\(x\)\) F\.spb\.push\(\{p,o,t:'Special bonus '\+spbLine\(x\)\}\);/.test(fn('flags')) && /\['spb','🎁 Special bonuses'\]/.test(H) &&
  /const spbLine=x=>money\(num\(x\.spb\)\)\+\(x\.spbType\?' · '\+esc\(x\.spbType\):''\)\+\(String\(x\.spbWhy\|\|''\)\.trim\(\)\?' · “'\+esc\(/.test(H));
t('…the combined sheet shows "+ $75 special" under Extra (what for on hover), and the download’s Notes say it',
  /\(c\.spb\?'<div class="small muted" title="'\+esc\('Special bonus: '/.test(fn('combined')) &&
  /spbHas\(x\) \? '\[Special bonus '\+money\(num\(x\.spb\)\)\+\(x\.spbType\?' - '\+x\.spbType:''\)\+': '\+String\(x\.spbWhy\|\|''\)\.trim\(\)\+'\]' : ''/.test(fn('csv')));

const K=fn('spbCard'), A=H.slice(H.indexOf("if((act==='spbadd' || act==='spbdel') && SPBON()){"), H.indexOf("if((act==='spbadd' || act==='spbdel') && SPBON()){")+900);
t('Settings → Special bonus categories: only when it’s on; only whoever manages payroll can add or take off',
  /if\(!SPBON\(\)\) return '';/.test(K) && /can=holCan\(\)/.test(K) && /if\(!holCan\(\)\) return;/.test(A) && /h\+=colsCard\(\);\n\s*h\+=spbCard\(\);/.test(H));
t('…a category already there isn’t added twice; taking one off leaves the sheets that used it as they are',
  /spbTypes\(\)\.some\(k=>k\.toLowerCase\(\)===nm\.toLowerCase\(\)\)/.test(A) && /sheets that used it keep it/.test(A));
t('…a save that doesn’t reach SharePoint changes nothing and says so', /e=>toast\('Not saved - '\+\(\(e && e\.message\) \|\| 'check the connection'\)\+'\. Nothing changed\.'\)/.test(fn('spbSave')) &&
  /PH_STORE\.update\(SPB_KEY, cur=>\(\{list:cleanSpbTypes\(\{list:change\(cleanSpbTypes\(cur\)\)\}\)/.test(fn('spbSave')));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
