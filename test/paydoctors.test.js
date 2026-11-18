/* DOCTORS PAID BY THE DAY - STAND OUT, AND THEIR PAY (Heather 17/11/2026). SANDBOX ONLY until DOCPAY_LIVE is true.
       node test/paydoctors.test.js
   Heather: "Dr. Lightheart kind of blends in with the sheet and I almost forgot to pay him" and "an amount per doctor per
   day worked ... and it will do the math for me" / "a box so I can enter in the dollar amount ... only visible to me".
   Runs the page's own cleanDocRate / docRateAt / docPay. Made-up doctors. */
const fs=require('fs'), path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=H.indexOf('{', i);
  for(let k=j;k<H.length;k++){ if(H[k]==='{') d++; else if(H[k]==='}'){ d--; if(!d) return H.slice(i, k+1); } } return ''; };
const line=re=>{ const m=H.match(re); if(!m) throw new Error('missing '+re); return m[0]; };

const env=new Function('S','P', [line(/const num=[^\n]*/), line(/const r2=[^\n]*/), fn('cleanDocRate'), line(/const docRateAt=[^\n]*/), line(/const dpayKey=[^\n]*/), fn('docPay'),
  'return {cleanDocRate, docRateAt, docPay, dpayKey};'].join('\n'));
const S={docRate:{}, dpay:{}}, starts={21:'2026-09-20', 22:'2026-10-04', 23:'2026-10-18', 24:'2026-11-01'};
const E=env(S, n=>({start:starts[n]}));
const doc={id:'d9', n:'Dr. Quill', office:'cruceslco'};

t('day rates: sound ones only, in start order; junk and silly amounts dropped',
  JSON.stringify(E.cleanDocRate({d9:[{from:'2026-11-01', amt:'550'}, {from:'2026-10-04', amt:500}, {from:'nope', amt:1}, {from:'2026-10-18', amt:-5}, {from:'2026-10-18', amt:99999}, {from:'2026-10-18', amt:''}], x:'junk'}))===
  '{"d9":[{"from":"2026-10-04","amt":500},{"from":"2026-11-01","amt":550}]}' && JSON.stringify(E.cleanDocRate(null))==='{}');
S.docRate=E.cleanDocRate({d9:[{from:'2026-10-04', amt:500}, {from:'2026-11-01', amt:550}]});
t('the rate of the pay period: none before it starts; $500 from #22; $550 from #24 - an earlier pay period keeps its rate',
  E.docRateAt('d9','2026-09-20')===null && E.docRateAt('d9','2026-10-04')===500 && E.docRateAt('d9','2026-10-18')===500 && E.docRateAt('d9','2026-11-01')===550);
let p=E.docPay(22, doc, {w1:2, w2:'1.5'});
t('it does the maths: 3.5 days x $500 = $1,750', p.days===3.5 && p.rate===500 && p.over===null && p.pay===1750);
S.dpay[E.dpayKey(22,'d9')]=1800;
p=E.docPay(22, doc, {w1:2, w2:'1.5'});
t('…a typed amount for that pay period wins', p.pay===1800 && p.over===1800);
S.dpay[E.dpayKey(22,'d9')]='';
t('…and an emptied box goes back to the maths', E.docPay(22, doc, {w1:2, w2:'1.5'}).pay===1750);
t('no day rate and nothing typed: no amount (it says so, never $0 by accident)', E.docPay(21, doc, {w1:1}).pay===null);

t('ON for the live site (hc188, Cory: "doctors live"); false again = off', /const DOCPAY_LIVE=true;/.test(H) && /const DOCPAYON=\(\)=>DOCPAY_LIVE \|\| !\(window\.PH && PH\.isLive && PH\.isLive\(\)\);/.test(H));
t('STANDS OUT on the combined sheet: highlighted, 🩺, "Pay separately", and days x rate on the row',
  /h\+='<tr class="docr'\+\(dp\?' pay':''\)\+'"><td class="nm">'\+\(dp\?'🩺 ':''\)/.test(fn('combined')) && /Pay separately/.test(fn('combined')) &&
  /table\.comb tr\.docr\.pay td\{background:#FFF4E2 !important/.test(H) && /' × '\+money\(dp\.rate\)\+' a day = <b>'/.test(fn('combined')));
t('…and at the top of "Worth a second look": every doctor with days, what to pay, or "no day rate yet"',
  /\['doc','🩺 Doctors to pay \(paid by the day\)'\]/.test(H) && /F\.doc\.push\(\{who:d\.n, o,/.test(fn('flags')) && /no day rate yet/.test(fn('flags')) && /esc\(f\.who \|\| disp\(f\.p\)\)/.test(H));
t('the box on the row: only while that office isn’t entered; saved in HER folder (cols), never the office’s',
  /onD=!entOff\(n,k\) && !R\(\)\.ro/.test(fn('combined')) && /if\(LIVEPAY\) liveCols\(per, t\.dataset\.o, t\.dataset\.df, 'dpay', v\);/.test(fn('onDocPay')) &&
  /if\(t\.dataset\.df\)\{ onDocPay\(t\); return; \}/.test(H));
t('…read back from her folder, and a doctor’s amount never becomes a staff row', /S\.dpay\[dpayKey\(n,pid\)\]=v\.dpay;/.test(fn('takeCols')) && /if\(Object\.keys\(v\)\.every\(f=>f==='dpay'\)\) return;/.test(fn('takeCols')));
t('day rates live in her settings.json (the senders never read it); changed only by whoever manages payroll, from a pay period not entered yet',
  /S\.docRate=cleanDocRate\(st\.docRate\);/.test(H) && /x\.docRate=add\(x\.docRate\);/.test(fn('docRateSave')) && /\(act==='docrateok' && DOCPAYON\(\) && holCan\(\)\)/.test(H) &&
  /if\(rateStarts\(\)\.indexOf\(m\)<0\)\{ err\('Pick a pay period that hasn’t been entered yet\.'\); return; \}/.test(H));
t('the office’s own sheet never shows a rate or a pay (only days)', !/docRateAt|docPay|dpay/.test(fn('docsHTML')));
t('the download: Rate per day and Pay for each doctor', /\['Rate per day','Pay'\]/.test(fn('csv')) && /dp\.rate!==null \? dp\.rate : '', dp\.pay!==null \? dp\.pay : ''/.test(fn('csv')));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
