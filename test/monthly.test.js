/* MONTHLY REPORT (Heather's monitor report, 18/11/2026).
       node test/monthly.test.js
   Heather's email 2 is the list; the old Excel's ratios and goals row are the maths; OrthoFi fills its numbers in every
   night and never over a number a person typed. Made-up numbers only. */
const fs=require('fs'), path=require('path');
require(path.join(__dirname,'..','v1','monthly.js'));
const M=globalThis.PH_MONTHLY;
const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const U=read('user.js'), A=read('admin.html'), P=read('monthly.html');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const near=(a,b)=>Math.abs(a-b)<0.011;

/* the list - exactly Heather's email 2, nothing more */
const HEATHER=['Gross production','Gross collections','Net production adjustments','Net production','Accounts receivable','Number of accounts receivable',
  'Delinquent accounts past 30 days','$ 90+ days past due','New patient exams','Active patients','Total discounts','RIP sold','Over estimated completion date','Comfort percentage',
  'Medicaid submissions','Medicaid denials','Medicaid approvals','Medicaid bandings','Medicaid production','Medicaid collections'];
t('the report asks for exactly the 20 things in Heather’s email 2 (case starts / case acceptance from the old sheet are not on it)',
  M.FIELDS.length===20 && HEATHER.every(n=>M.FIELDS.some(f=>f.n===n)) && !M.FIELDS.some(f=>/start|accept/i.test(f.n)));
t('…Medicaid, over-estimated completion date and comfort % are typed from the practice software (her words); the rest is OrthoFi’s',
  M.FIELDS.filter(f=>f.medicaid).every(f=>f.from==='pms') && M.BY.oecd.from==='pms' && M.BY.cmf.from==='pms' && M.BY.gp.from==='orthofi' && M.BY.del.from==='orthofi');
t('…the 6 Medicaid numbers only for the Medicaid offices (Heather can change which in Settings)',
  M.fieldsFor('Clovis', M.cleanSettings(null)).length===20 && M.fieldsFor('San Angelo', M.cleanSettings(null)).length===14 &&
  M.fieldsFor('San Angelo', M.cleanSettings({medicaid:['San Angelo']})).length===20);

/* the maths - the old sheet's own formulas (D=C/B, F=E/B, I=H/B) and its goals row */
const v={gp:300000, gc:270000, adj:-30000, np:270000, ar:1800000, arn:900, del:8, ar90:120000, npe:60};
const c=M.calc(v);
t('Collection % = collections ÷ production, Adjustment % = adjustments ÷ production, A/R ratio = A/R ÷ production (the old sheet’s columns D, F, I)',
  near(c.colpct,90) && near(c.adjpct,10) && near(c.ratio,6));
t('…nothing divided by an empty production', M.calc({gc:5}).colpct===null && M.calc({}).ratio===null);
t('the goals are the old sheet’s goals row: 91–93%, 7–9%, 5.5–6×, 5–7%',
  JSON.stringify(M.DEF_GOALS)===JSON.stringify({col:[91,93], adj:[7,9], ratio:[5.5,6], del:[5,7]}));
t('collecting MORE is good, adjusting/late MORE is bad, A/R outside its range is a "watch" either way',
  M.tone('col',95)==='good' && M.tone('col',88)==='bad' && M.tone('adj',10)==='bad' && M.tone('adj',6)==='good' && M.tone('ratio',7)==='watch' && M.tone('ratio',4)==='watch' && M.tone('del',6)==='ok');

/* what needs a conversation - in dollars */
const ins=M.insights(v, {goals:M.DEF_GOALS});
const col=ins.find(i=>i.k==='col'), adj=ins.find(i=>i.k==='adj');
t('below the collection goal says the gap in dollars: 91% of $300,000 is $273,000, so $3,000 short', col && col.tone==='bad' && near(col.usd,3000) && /\$3,000 short of the 91% goal/.test(col.text));
t('adjustments over goal say how much more than the 9% allows ($30,000 − $27,000 = $3,000)', adj && near(adj.usd,3000));
t('late accounts say about how many families (8% of 900 = 72)', ins.some(i=>i.k==='del' && /about 72 families/.test(i.text)));
t('the most pressing first: off goal before "watch", the bigger dollar gap first', ins[0].tone==='bad' && ins.findIndex(i=>i.tone==='watch')>ins.findIndex(i=>i.tone==='bad'));
const mk=p=>({gp:100000, gc:p*1000});
t('"fallen three months running" only when it is heading somewhere (below the top of the goal, down 2+ points)',
  M.insights(mk(90), {hist:[mk(94), mk(92)]}).some(i=>i.k==='coltrend') &&
  !M.insights(mk(95.5), {hist:[mk(97), mk(96)]}).some(i=>i.k==='coltrend') &&
  !M.insights(mk(91.6), {hist:[mk(92.2), mk(92)]}).some(i=>i.k==='coltrend'));
t('a 20%+ swing in new patient exams is said; a small one is not',
  M.insights({npe:40}, {prev:{npe:60}}).some(i=>i.k==='npe' && /down 33%/.test(i.text)) && !M.insights({npe:55}, {prev:{npe:60}}).some(i=>i.k==='npe'));

/* the whole practice */
const T=M.practiceTotals([{gp:100, gc:90, del:10, arn:100, oecd:10}, {gp:300, gc:280, del:2, arn:300, oecd:20}, null]);
t('the whole practice adds up activity and balances, weights late % by accounts, averages the typed percents',
  T.gp===400 && T.gc===370 && near(T.del,4) && near(T.oecd,15));

/* OrthoFi in - never over a person */
const yr={o:{Hobbs:{'10':{v:{gp:1000, rip:5}, src:{gp:'typed', rip:'typed'}}}}};
let x=M.mergeOrthofi(yr, 'Hobbs', 10, {gp:1200, gc:900, rip:99, nope:1}, '2026-11-02T09:00:00Z');
const r=x.rec.o.Hobbs['10'];
t('OrthoFi fills its own boxes and stamps them', r.v.gc===900 && r.src.gc==='orthofi' && r.by.gc==='OrthoFi' && r.of==='2026-11-02T09:00:00Z');
t('…never over a number a person typed - theirs stays, OrthoFi’s is kept beside it', r.v.gp===1000 && r.src.gp==='typed' && r.ofv.gp===1200);
t('…never a practice-software box (RIP) and never an unknown one', r.v.rip===5 && r.ofv.rip===undefined && r.v.nope===undefined);
t('…and the page can say where typed and OrthoFi disagree', JSON.stringify(M.mismatches(r))===JSON.stringify([{k:'gp', typed:1000, orthofi:1200}]));
const fin={o:{Hobbs:{'09':{v:{gp:5}, src:{gp:'orthofi'}, final:{at:'2026-10-08T00:00:00Z', by:'H'}}}}};
x=M.mergeOrthofi(fin, 'Hobbs', 9, {gp:7});
t('…and never into a month marked final', x.changed===0 && x.why==='final' && x.rec.o.Hobbs['09'].v.gp===5);
x=M.mergeOrthofi(null, 'Lubbock', 11, {gp:'$12,345.678', del:'6.5%'});
t('…a brand-new month is made, and "$12,345.678" / "6.5%" are read as numbers', x.rec.o.Lubbock['11'].v.gp===12345.68 && x.rec.o.Lubbock['11'].v.del===6.5);

/* keeping it clean */
const cm=M.cleanMonth({v:{gp:'abc', npe:3.6, del:5000, mds:-2}, notes:[{t:'  hi  ', by:'x'}, {t:''}, 7], extra:'<script>'});
t('junk is dropped: words in a number box, a 5000% percent, a negative count; counts are whole', cm.v.gp===undefined && cm.v.npe===4 && cm.v.del===undefined && cm.v.mds===undefined && cm.extra===undefined);
t('notes keep only real text (trimmed), at most 50', cm.notes.length===1 && cm.notes[0].t==='hi' && M.cleanMonth({notes:Array.from({length:70},(_, i)=>({t:'n'+i}))}).notes.length===50);
const s=M.cleanSettings({medicaid:['Hobbs','Hobbs',' '], goals:{col:[95,90], adj:[6,8]}, due:40});
t('settings: a goal the wrong way round falls back to the sheet’s, the due day stays 1–28, no duplicate offices',
  JSON.stringify(s.goals.col)==='[91,93]' && JSON.stringify(s.goals.adj)==='[6,8]' && s.due===28 && s.medicaid.length===1);

/* the year sheet */
const Y=M.yearRows(m=>m<=3 ? {gp:m*100, ar:1000*m, del:m} : null, M.FIELDS);
t('Year sheet: YTD adds up the month’s activity only (not A/R, not a percent), quarters and the year average the months',
  Y.ytd.gp===600 && Y.ytd.ar===null && Y.ytd.del===null && Y.quarters[0].v.gp===200 && Y.quarters[1].v.gp===null && Y.avg.ar===2000);

/* where a month stands */
const NOW='2026-11-18T12:00:00';
t('a month is final, sent, still going ("so far"), late after the due day, or not started',
  M.status({final:{at:'x'}},2026,10,null,NOW)==='final' && M.status({sent:{at:'x'}},2026,10,null,NOW)==='sent' && M.status(null,2026,11,null,NOW)==='open' &&
  M.status({v:{gp:1}},2026,10,null,NOW)==='late' && M.status({v:{gp:1}},2026,10,{due:20},NOW)==='started' && M.status(null,2026,10,{due:20},NOW)==='');
t('the month to report at the start of a month is the one before (January reports December)', JSON.stringify(M.lastMonth('2026-01-03'))==='{"y":2025,"m":12}' && M.lastMonth(NOW).m===10);

/* switches and permissions */
t('OFF on the live site until Cory says "monthly live" (an admin can preview with ?monthlypreview)', /const MONTHLY_LIVE=false;/.test(U) && /function monthlyOn\(\)/.test(U) && /monthlypreview/.test(U));
t('a tab: everyone in the sandbox; live = the switch, then Teams & Access (or an admin)',
  /\{k:'monthly',\s+n:'[^']*Monthly Report',\s+href:'monthly\.html',\s+show:\(\)=>env\(\)!=='live' \|\| \(monthlyOn\(\) && \(isAdmin\(me\(\)\) \|\| atLeast\('monthly','view'\)\)\)\}/.test(U));
t('starting permissions: Admin everything, Executive + Leadership read, Office Managers fill in',
  /'admin':[^\n]*monthly:'manage'/.test(U) && /'executive team':[^\n]*monthly:'view'/.test(U) && /'leadership team':[^\n]*monthly:'view'/.test(U) && /'office managers':[^\n]*monthly:'edit'/.test(U) && !/'staff':[^\n]*monthly/.test(U));
t('…counted for a team until an admin sets the new column', /if\(c\.monthly===undefined && DEPT_CAN\[d\] && DEPT_CAN\[d\]\.monthly\)/.test(U));
t('Teams & Access gets a Monthly column (none / See / Fill in / Everything), off its grid on the live site until the report is on',
  /PH\.monthlyOn && !PH\.monthlyOn\(\)\) \? \[\] : \[\{k:'monthly'/.test(A) && /monthly:\['none','view','edit','manage'\]/.test(A) && /monthly:\{view:'See',edit:'Fill in',manage:'Everything'\}/.test(A));

/* the page */
t('the page loads the rules', /<script src="monthly\.js\?v=hc\d+"><\/script>/.test(P));
t('made-up numbers ONLY in the sandbox - the live site never makes any', /if\(!LIVE && \(!rec \|\| !rec\.o/.test(P));
t('saving changes only the boxes typed, merged into whatever is saved now (PH_STORE.update)', /PH_STORE\.update\(M\.KEY\(Y\), cur=>/.test(P) && /function applyEdits\(r\)/.test(P));
t('OrthoFi’s nightly numbers go through the same rule (mergeOrthofi)', /async function importOrthofi[\s\S]{0,300}M\.mergeOrthofi\(rec, o, m, byOffice\[o\], stamp\)/.test(P));
t('the live site shows OrthoFi as not connected until ORTHOFI_LIVE is turned on', /const ORTHOFI_LIVE=false;/.test(P) && /const ORTHOFI_CONNECTED=LIVE \? ORTHOFI_LIVE : true;/.test(P));
t('an office manager types first; OrthoFi’s numbers sit below as a compact grid', P.indexOf("{t: typ ? 'Type these'")>0 && P.indexOf("<h3>From OrthoFi</h3>")>P.indexOf("{t: typ ? 'Type these'"));
t('Medicaid box asks for numbers only, never a patient', /Numbers only — never a patient’s name\./.test(P));
t('the summary for leadership is copied for Teams or email', /async function copy\(\)/.test(P) && /navigator\.clipboard\.writeText/.test(P));
t('no real figures in the files (the sandbox makes its own)', !/\b(483|1206|1181)\b/.test(P) && !/\b(483|1206|1181)\b/.test(read('monthly.js')));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
