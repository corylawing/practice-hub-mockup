/* RATES THAT CHANGE (17/11/2026, Cory: "build rates"). SANDBOX ONLY until payroll.html RATES_LIVE is true.
       node test/payrates.test.js

   Heather: the mileage rate "says 'change it here' but it does not have the ability to actually change it". Whoever
   manages payroll can now change a rate (mileage, on call, holiday pay, DIBS) starting with a pay period no office has
   been entered for yet; every pay period before it keeps the rate it was paid at. Made-up people. */
const fs=require('fs'), path=require('path');
const R=require(path.join(__dirname,'..','v1','payrules.js'));
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=H.indexOf('{', i);
  for(let k=j;k<H.length;k++){ if(H[k]==='{') d++; else if(H[k]==='}'){ d--; if(!d) return H.slice(i, k+1); } } return ''; };

t('OFF on the live site: RATES_LIVE is false, the live site doesn’t even read the list, and nobody there can change a rate',
  /const RATES_LIVE=false;/.test(H) && /const RATESON=\(\)=>RATES_LIVE \|\| !\(window\.PH && PH\.isLive && PH\.isLive\(\)\);/.test(H) &&
  /if\(!RATESON\(\)\) return Promise\.resolve\(\);/.test(fn('loadRates')) && /const rateCh=\(\)=>!RATESON\(\) \? \[\]/.test(H) && /const rateCan=\(\)=>RATESON\(\) && holCan\(\);/.test(H));

/* the rule */
const ch=R.cleanRates({changes:[{id:'b', from:'2026-11-29', r:{mile:0.72}}, {id:'a', from:'2026-11-15', r:{mile:0.70, onCall:'60', junk:5}},
  {from:'not a date', r:{mile:1}}, {from:'2026-11-15', r:{mile:99}}, {id:'c', from:'2026-11-15', r:{mile:0.71}}, null, {from:'2026-11-15'}]});
t('only sound changes are kept: a real start day, known rates, sensible amounts (a $99 mile is refused), in start order',
  ch.map(c=>c.id).join()==='a,c,b' && ch[0].r.onCall===60 && ch[0].r.junk===undefined && !ch.some(c=>c.r.mile===99));
const on=d=>R.ratesOn(R.RATES, ch, d);
t('before the first change: the starting rates, untouched', on('2026-11-01').mile===0.76 && on('2026-11-01').onCall===50 && R.RATES.mile===0.76);
t('from its pay period on: the new rate (two starting together - the later one wins), until the next change',
  on('2026-11-15').mile===0.71 && on('2026-11-15').onCall===60 && on('2026-11-28').mile===0.71 && on('2026-11-29').mile===0.72 && on('2026-11-29').onCall===60);
const per={hol:null}, p={start:'2020-01-01'};
t('100 marketing miles: $76 in the pay period before, $71 from the change - the earlier one never moves',
  R.calc(p, {mkt:100}, per, on('2026-11-01'), 0, {}).reimb===76 && R.calc(p, {mkt:100}, per, on('2026-11-15'), 0, {}).reimb===71);

/* the page: every sum and every "$x each" uses its own pay period's rates */
t('the sums use the rates of the pay period they’re for (holiday, on call, DIBS, mileage)',
  /const RT=rt\(pr\.start\);/.test(fn('calc')) && !/RATE\./.test(fn('calc')) && /reimb:r2\(\(num\(x\.mkt\)\+num\(x\.oth\)\)\*RT\.mile\)/.test(fn('calc')));
t('…and so does what’s shown: the office sheet, its rules, the combined sheet, the download, the holiday box, the second look',
  /RATE=rt\(pr\.start\)/.test(fn('sheetTable')) && /RATE=rt\(pr\.start\)/.test(fn('combined')) && /RATE=rt\(pr\.start\)/.test(fn('csv')) &&
  /const RATE=rt\(pr\.start\);/.test(fn('holHTML')) && /RATE=rt\(pr\.start\)/.test(fn('flags')) && /money\(rtN\(n\)\[c\.each\]\)/.test(H) &&
  /combHead\(o\.k, anySp, RATE\)/.test(H) && /ownTip\(o,c,RATE\)/.test(H));

/* a change never reaches a pay period that's been entered */
const rs=fn('rateStarts');
const starts=(entered, CUR, NEXT, BEFORE)=>new Function('BEFORE','NEXT','CUR','enteredCount', rs+' return rateStarts();')(BEFORE, NEXT, CUR, m=>entered.indexOf(m)>=0 ? 1 : 0);
t('a change can start only with a pay period no office has been entered for - and none after it entered either',
  starts([], 22, 23, false).join()==='22,23,24,25,26,27,28,29,30' && starts([22], 22, 23, false)[0]===23 && starts([22,23], 22, 23, false)[0]===24 &&
  starts([], 22, 23, true)[0]===23);
const A=H.slice(H.indexOf("if(act==='rateok' && rateCan()){"), H.indexOf("if(act==='rateok' && rateCan()){")+1400);
t('Save checks the amount (within sensible limits) and that the pay period still isn’t entered',
  /if\(raw==='' \|\| !isFinite\(amt\) \|\| amt<lim\[0\] \|\| amt>lim\[1\]\)/.test(A) && /if\(rateStarts\(\)\.indexOf\(m\)<0\)\{ err\('Pick a pay period that hasn’t been entered yet\.'\); return; \}/.test(A) &&
  /from:P\(m\)\.start, r:\{\[k\]:v2\}/.test(A));
t('Undo only while its pay period isn’t entered; otherwise it stays as it was paid', /if\(!c \|\| !min \|\| c\.from<min\)\{ toast\('That pay period has been entered - it stays as it was paid'\); return; \}/.test(A));
t('a save that doesn’t reach SharePoint changes nothing and says so; the list is amounts only (shared, read by the senders too)',
  /e=>toast\('Not saved - '\+\(\(e && e\.message\) \|\| 'check the connection'\)\+'\. Nothing changed\.'\)/.test(fn('rateSave')) && R.RATE_KEY==='ph_pay_rates' &&
  /loadSpbTypes\(\),\n\s*loadRates\(\),\n\s*lv==='send' \? null/.test(H));
t('Settings: the rates for the pay period running now, Change for whoever manages payroll, a change coming up shown under it',
  /const now=rt\(P\(CUR\)\.start\)/.test(fn('ratesHTML')) && /can && st\.length\?'<button class="link small" data-act="rateedit"/.test(fn('ratesHTML')) && /' from '\+\(m===null\?/.test(fn('ratesHTML')));
t('the combined sheet still starts its grand total (a comment once swallowed it - Heather’s board stopped drawing)', /RATE=rt\(pr\.start\); let grand=\{reg:0,ot1:0,ot2:0,total:0,reimb:0\};/.test(fn('combined')));
t('Heather’s wording is gone: no "Change it here" where nothing can be changed', !/Change it here when the IRS does/.test(H) && /Press Change when the IRS changes it\./.test(H));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
