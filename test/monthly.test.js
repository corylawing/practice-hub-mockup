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
  'Delinquent accounts past 30 days','$ 90+ days past due','New patient exams','Active patients','Total discounts','RIP sold (Retainer Insurance Program)','Over estimated completion date','Total appointments','Comfort appointments',
  'Medicaid submissions','Medicaid denials','Medicaid approvals','Medicaid bandings','Medicaid production','Medicaid collections'];
t('the report asks for exactly the things in Heather’s email 2 - comfort % as its two counts (case starts / case acceptance from the old sheet are not on it)',
  M.FIELDS.length===24 && HEATHER.every(n=>M.FIELDS.some(f=>f.n===n)) && M.FIELDS.filter(f=>HEATHER.indexOf(f.n)<0).map(f=>f.k).join()==='osp,osc,osar' && !M.FIELDS.some(f=>/start|accept/i.test(f.n)));
t('\u2026Medicaid, over-estimated completion date and comfort % are typed from the practice software (her words); the rest is OrthoFi\u2019s - RIP too (Heather 18/11: "It comes from Orthofi")',
  M.FIELDS.filter(f=>f.medicaid).every(f=>f.from==='pms') && M.BY.oecd.from==='pms' && M.BY.appts.from==='pms' && M.BY.cmfa.from==='pms' && M.BY.gp.from==='orthofi' && M.BY.deln.from==='orthofi' && M.BY.rip.from==='orthofi');
t('the boxes show US commas (300,800.85; 1,059) and tidy to that when you leave one; saving reads past the commas (Cory: "These are americas can we have the commas?")',
  /function showIn\(t, v\)/.test(P) && /minimumFractionDigits:2, maximumFractionDigits:2/.test(P) && /onblur="MONTHLY\.tidy\(this\)"/.test(P) && M.num('1,734,786.68')===1734786.68);
t('new patient exams are typed from the practice software (Heather 21/11: "New Patient exams are pulled from the PMS")', M.BY.npe.from==='pms');
t('nobody types a percentage that can be worked out: the delinquent COUNT is kept, the % is calculated (Heather: "Instead of them doing the math")',
  M.BY.deln.t==='#' && !M.BY.del && M.calc({arn:200, deln:12}).delpct===6);
t('…the 6 Medicaid numbers only for the Medicaid offices (Heather can change which in Settings)',
  M.fieldsFor('Clovis', M.cleanSettings(null)).length===21 && M.fieldsFor('San Angelo', M.cleanSettings(null)).length===15 &&
  M.fieldsFor('San Angelo', M.cleanSettings({medicaid:['San Angelo']})).length===21 && M.fieldsFor('Cruces LCO', M.cleanSettings(null)).length===24);
/* 20/11/2026 - the old system (Heather: Mansfield, FOLC and LCO; "The OMs should type that in") */
t('the 2 old-system boxes only for offices still on an old system: Mansfield, Cruces FFO, Cruces LCO (Heather can change which in Settings)',
  M.fieldsFor('Mansfield', M.cleanSettings(null)).some(f=>f.k==='osp') && M.fieldsFor('Cruces FFO', M.cleanSettings(null)).some(f=>f.k==='osar') &&
  !M.fieldsFor('Clovis', M.cleanSettings(null)).some(f=>f.oldsys) && !M.fieldsFor('Mansfield', M.cleanSettings({oldsys:[]})).some(f=>f.oldsys) &&
  M.BY.osp.from==='pms' && M.BY.osar.from==='pms' && M.BY.osp.flow===true && !M.BY.osar.flow);
{ const R0={v:1, o:{}};
  let x=M.mergeOrthofi(R0, 'Cruces FFO', 10, {gp:100000, ar:50000}, '2026-11-01T06:00:00Z');
  let r=x.rec.o['Cruces FFO']['10'];
  t('OrthoFi fills its PART: gross production and A/R = OrthoFi alone while nothing is typed', r.ofp.gp===100000 && r.v.gp===100000 && r.src.gp==='orthofi' && r.v.ar===50000 && r.ofp.ar===50000);
  const typed=M.cleanYear(x.rec); typed.o['Cruces FFO']['10'].v.osp=12000.5; typed.o['Cruces FFO']['10'].src.osp='typed'; typed.o['Cruces FFO']['10'].v.osar=3000; typed.o['Cruces FFO']['10'].src.osar='typed';
  r=M.cleanYear(typed).o['Cruces FFO']['10'];
  t('the office manager types the old-system numbers -> the totals update by themselves (OrthoFi + old system)', r.v.gp===112000.5 && r.v.ar===53000 && r.ofv.gp===112000.5);
  const med=M.cleanYear({v:1, o:{Clovis:{'10':{v:{mdp:25000.25}, src:{mdp:'typed'}}}}});
  r=M.mergeOrthofi(med, 'Clovis', 10, {gp:200000}, '2026-11-01T06:00:00Z').rec.o.Clovis['10'];
  t('...Medicaid production is added the same way (Heather: gross production = OrthoFi + Medicaid)', r.v.gp===225000.25 && r.ofp.gp===200000);
  r=M.mergeOrthofi(M.cleanYear({v:1, o:{Clovis:{'10':{v:{gp:1, mdp:5}, src:{gp:'typed', mdp:'typed'}}}}}), 'Clovis', 10, {gp:200000}).rec.o.Clovis['10'];
  t('...a gross production a person typed still wins (OrthoFi + Medicaid kept beside it for the "OrthoFi says" check)', r.v.gp===1 && r.src.gp==='typed' && r.ofv.gp===200005);
  r=M.mergeOrthofi(M.cleanYear({v:1, o:{'Cruces LCO':{'10':{v:{mdc:1000, osc:500.5}, src:{mdc:'typed', osc:'typed'}}}}}), 'Cruces LCO', 10, {gc:40000}).rec.o['Cruces LCO']['10'];
  t('...gross collections the same way: OrthoFi + Medicaid collections + old system collections', r.v.gc===41500.5 && r.ofp.gc===40000 && M.BY.osc.oldsys===true);
  r=M.mergeOrthofi(M.cleanYear({v:1, o:{Hobbs:{'10':{v:{mdp:3000}, src:{mdp:'typed'}}}}}), 'Hobbs', 10, {np:90000, adj:-1500}).rec.o.Hobbs['10'];
  t('...net production the same way (OrthoFi’s adjusted production + Medicaid production); adjustments are OrthoFi’s alone', r.v.np===93000 && r.ofp.np===90000 && r.v.adj===-1500);
  r=M.mergeOrthofi(M.cleanYear({v:1, o:{Clovis:{'10':{v:{mdp:5}, src:{mdp:'typed'}, final:{at:'2026-11-06T00:00:00Z', by:'Heather'}}}}}), 'Clovis', 10, {gp:200000}).rec.o.Clovis['10'];
  t('...a month marked final is never touched', r.v.gp===undefined && !r.ofp); }

t('comfort % is worked out: comfort appointments \u00f7 total appointments (Heather: "total appts" and "comfort appts"); LCO has the Medicaid boxes (Heather: "they do need it")', M.calc({appts:800, cmfa:40}).cmfpct===5 && M.calc({cmfa:40}).cmfpct===null);

/* the maths - the old sheet's own formulas (D=C/B, F=E/B, I=H/B) and its goals row */
const v={gp:300000, gc:270000, adj:-30000, np:270000, ar:1800000, arn:900, deln:72, ar90:120000, npe:60};
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
t('below the collection goal says the gap in dollars: 91% of $300,000 is $273,000, so $3,000 short', col && col.tone==='bad' && near(col.usd,3000) && /\$3,000 short of the 91% target/.test(col.text));
t('adjustments over goal say how much more than the 9% allows ($30,000 − $27,000 = $3,000)', adj && near(adj.usd,3000));
t('late accounts say the % and the count (72 of 900 = 8.0%)', ins.some(i=>i.k==='del' && /8\.0% of accounts .*\(72 of 900\)/.test(i.text)));
t('adjustments keep their sign: written off (minus) is a positive %, a month that ADDS to production is below zero, never a write-off',
  near(M.calc({gp:100, adj:-8}).adjpct, 8) && near(M.calc({gp:100, adj:12}).adjpct, -12) && M.tone('adj', M.calc({gp:100, adj:12}).adjpct)==='good');
t('the most pressing first: off goal before "watch", the bigger dollar gap first', ins[0].tone==='bad' && ins.findIndex(i=>i.tone==='watch')>ins.findIndex(i=>i.tone==='bad'));
const mk=p=>({gp:100000, gc:p*1000});
t('"fallen three months running" only when it is heading somewhere (below the top of the goal, down 2+ points)',
  M.insights(mk(90), {hist:[mk(94), mk(92)]}).some(i=>i.k==='coltrend') &&
  !M.insights(mk(95.5), {hist:[mk(97), mk(96)]}).some(i=>i.k==='coltrend') &&
  !M.insights(mk(91.6), {hist:[mk(92.2), mk(92)]}).some(i=>i.k==='coltrend'));
t('a 20%+ swing in new patient exams is said; a small one is not',
  M.insights({npe:40}, {prev:{npe:60}}).some(i=>i.k==='npe' && /down 33%/.test(i.text)) && !M.insights({npe:55}, {prev:{npe:60}}).some(i=>i.k==='npe'));

/* the whole practice */
const T=M.practiceTotals([{gp:100, gc:90, deln:10, arn:100, oecd:10}, {gp:300, gc:280, deln:6, arn:300, oecd:20}, null]);
t('the whole practice adds up activity, balances and counts (so its late % comes from its own counts: 16 of 400 = 4%), averages the typed percents',
  T.gp===400 && T.gc===370 && T.deln===16 && near(M.calc(T).delpct,4) && near(T.oecd,15));

/* OrthoFi in - never over a person */
const yr={o:{Hobbs:{'10':{v:{gp:1000, oecd:5}, src:{gp:'typed', oecd:'typed'}}}}};
let x=M.mergeOrthofi(yr, 'Hobbs', 10, {gp:1200, gc:900, oecd:99, nope:1}, '2026-11-02T09:00:00Z');
const r=x.rec.o.Hobbs['10'];
t('OrthoFi fills its own boxes and stamps them', r.v.gc===900 && r.src.gc==='orthofi' && r.by.gc==='OrthoFi' && r.of==='2026-11-02T09:00:00Z');
t('…never over a number a person typed - theirs stays, OrthoFi’s is kept beside it', r.v.gp===1000 && r.src.gp==='typed' && r.ofv.gp===1200);
t('\u2026never a practice-software box (over-estimated completion date) and never an unknown one', r.v.oecd===5 && r.ofv.oecd===undefined && r.v.nope===undefined);
t('…and the page can say where typed and OrthoFi disagree', JSON.stringify(M.mismatches(r))===JSON.stringify([{k:'gp', typed:1000, orthofi:1200}]));
const fin={o:{Hobbs:{'09':{v:{gp:5}, src:{gp:'orthofi'}, final:{at:'2026-10-08T00:00:00Z', by:'H'}}}}};
x=M.mergeOrthofi(fin, 'Hobbs', 9, {gp:7});
t('…and never into a month marked final', x.changed===0 && x.why==='final' && x.rec.o.Hobbs['09'].v.gp===5);
x=M.mergeOrthofi(null, 'Lubbock', 11, {gp:'$12,345.678', deln:'41'});
t('\u2026a brand-new month is made, and "$12,345.678" / "41" are read as numbers', x.rec.o.Lubbock['11'].v.gp===12345.68 && x.rec.o.Lubbock['11'].v.deln===41);

/* keeping it clean */
const cm=M.cleanMonth({v:{gp:'abc', npe:3.6, oecd:5000, mds:-2}, notes:[{t:'  hi  ', by:'x'}, {t:''}, 7], extra:'<script>'});
t('junk is dropped: words in a number box, a 5000% percent, a negative count; counts are whole', cm.v.gp===undefined && cm.v.npe===4 && cm.v.oecd===undefined && cm.v.mds===undefined && cm.extra===undefined);
t('notes keep only real text (trimmed), at most 50', cm.notes.length===1 && cm.notes[0].t==='hi' && M.cleanMonth({notes:Array.from({length:70},(_, i)=>({t:'n'+i}))}).notes.length===50);
const s=M.cleanSettings({medicaid:['Hobbs','Hobbs',' '], goals:{col:[95,90], adj:[6,8]}, due:40});
t('settings: a goal the wrong way round falls back to the sheet’s, the due day stays 1–28, no duplicate offices',
  JSON.stringify(s.goals.col)==='[91,93]' && JSON.stringify(s.goals.adj)==='[6,8]' && s.due===28 && s.medicaid.length===1);

/* the year sheet */
const Y=M.yearRows(m=>m<=3 ? {gp:m*100, ar:1000*m, oecd:m} : null, M.FIELDS);
t('Year sheet: YTD adds up the month’s activity only (not A/R, not a percent), quarters and the year average the months',
  Y.ytd.gp===600 && Y.ytd.ar===null && Y.ytd.oecd===null && Y.quarters[0].v.gp===200 && Y.quarters[1].v.gp===null && Y.avg.ar===2000);

/* where a month stands */
const NOW='2026-11-18T12:00:00';
t('a month is final, sent, still going ("so far"), late after the due day, or not started',
  M.status({final:{at:'x'}},2026,10,null,NOW)==='final' && M.status({sent:{at:'x'}},2026,10,null,NOW)==='sent' && M.status(null,2026,11,null,NOW)==='open' &&
  M.status({v:{gp:1}},2026,10,null,NOW)==='late' && M.status({v:{gp:1}},2026,10,{due:20},NOW)==='started' && M.status(null,2026,10,{due:20},NOW)==='');
t('the month to report at the start of a month is the one before (January reports December)', JSON.stringify(M.lastMonth('2026-01-03'))==='{"y":2025,"m":12}' && M.lastMonth(NOW).m===10);

/* who reads what (Heather 18/11: "All office managers can see all offices. I currently send this as an email to all OMs and TCs") */
t('by default everyone who can open the report reads every office; Heather can turn that off', M.cleanSettings(null).everyone===true && M.cleanSettings({everyone:false}).everyone===false);
t('…the page shows every office then, typing still only for your own', /if\(WHO\.offices==='all' \|\| SET\.everyone\) return all;/.test(P) && /function canType\(o,r\)\{ if\(!at\('edit'\) \|\| !mine\(o\)/.test(P));
t('TCs read it too (Office Managers fill in their own)', /'tcs':[^\n]*monthly:'view'/.test(U) && /set\('TCs',\{monthly:'view',/.test(A));

/* PAST MONTHS FROM THE OLD EXCEL - a made-up sheet in the old layout */
const cells={}; const put=(a,v)=>{ cells[a]={v}; };
['Gross\nProduction','Gross Collections','Collection %','Net Production\nAdjustments','Adjustment %','Net Production','Accounts Receivable','Ratio','# of Accounts Receivable','# of Delinquent Accounts (Pts. 30+)','% Of Del. Accts.','NP Exam']
  .forEach((h,i)=>put(String.fromCharCode(66+i)+'1', h));
put('A7','1st QUARTER AVERAGES'); put('A23','Goals'); put('B7', 99999);
put('A4','January'); put('A5','February'); put('A6','March'); put('A8','April');
/* a sheet that types write-offs as a PLUS and subtracts them (net = gross - adjustments) */
[[4,1000,900,50,950,6000,100,7,30],[5,2000,1900,100,1900,6100,110,8,40],[6,1500,1400,-20,1520,6200,120,9,35]].forEach(([r,gp,gc,adj,np,ar,arn,deln,npe])=>{
  put('B'+r,gp); put('C'+r,gc); put('E'+r,adj); put('G'+r,np); put('H'+r,ar); put('J'+r,arn); put('K'+r,deln); put('M'+r,npe); });
put('B8',3000); put('C8',2700); put('E8',100); put('G8',3500);          /* April: net is neither gross + nor - adjustments */
put('A24','Production/Collection Breakdown:'); put('Q24','A Patient Name'); /* text beside the block is never read */
['# of Medicaid Submission','# of Medicaid Denials','# Medicaid Approvals','Medicaid Bandings','Medicaid Production','Medicaid Collections','# of RIP Sold'].forEach((h,i)=>put(String.fromCharCode(66+i)+'25', h));
put('A26','January'); put('B26',10); put('C26',2); put('D26',8); put('E26',6); put('F26',5000); put('G26',4000); put('H26',3); put('R26','Another Name');
const XL=M.fromSheet(cells);
t('Excel: months found by their LABELS (quarter rows and the goals row skipped)', JSON.stringify(Object.keys(XL.months).sort())==='["01","02","03","04"]' && XL.months['01'].gp===1000);
t('Excel: this sheet types write-offs as a PLUS (net = gross - adjustments) - read as such and turned into a minus', XL.sign==='-' && XL.months['01'].adj===-50 && XL.months['03'].adj===20);
t('Excel: a month whose net production isn’t gross +/- adjustments is listed to look at', XL.checks.length===1 && XL.checks[0].m===4 && /April: net production/.test(XL.checks[0].text));
t('Excel: the delinquent COUNT and NP exams come in; the Medicaid block (with RIP) by its own header row', XL.months['01'].deln===7 && XL.months['01'].npe===30 && XL.medicaid && XL.months['01'].mds===10 && XL.months['01'].mdc===4000 && XL.months['01'].rip===3);
t('Excel: nothing but numbers from the named columns - no names typed beside the Medicaid block', !JSON.stringify(XL).includes('Name'));
const have={o:{Clovis:{'01':{v:{gp:1111}, src:{gp:'typed'}}, '02':{final:{at:'x',by:'H'}, v:{gp:5}, src:{gp:'typed'}}}}};
const IM=M.mergeImport(have, 'Clovis', XL.months, '2026-11-18T10:00:00Z', 'Excel import (H)'), c1=IM.rec.o.Clovis['01'];
t('Excel in: EMPTY boxes only - a number already here stays, and the difference is listed', c1.v.gp===1111 && IM.kept.length===1 && IM.kept[0].k==='gp' && IM.kept[0].sheet===1000 && c1.v.gc===900);
t('Excel in: the months count as sent (Heather has them already); a month marked final is not touched at all (not even its empty boxes)',
  !!c1.sent && /Excel import/.test(c1.sent.by) && !!IM.rec.o.Clovis['02'].final && JSON.stringify(IM.rec.o.Clovis['02'].v)==='{"gp":5}' && JSON.stringify(IM.skipped)==='[2]');

/* Heather 18/11: "change the wording to target instead of goal" */
t('people read "target", never "goal" (the old sheet\u2019s word - Heather didn\u2019t choose it)',
  !/(On|Off|Better than) goal|% goal|\(goal |the goal|goal is|Goals<|>goal |collection goal/.test(P) && !/% goal|the goal\.|\(goal |goal is under|above goal/.test(read('monthly.js')) &&
  /On target/.test(P) && /target is under/.test(read('monthly.js')));

/* Settings like the rest of the app (Cory 18/11: "very ux friendly like the rest of the app") */
t('Settings: every change saves the moment it is made and says so - switches, target boxes, a due-day picker, a drop zone; no Save button',
  /async function saveSet\(patch, said\)/.test(P) && /M\.cleanSettings\(Object\.assign\(\{\}, M\.cleanSettings\(cur\|\|SET\), patch\)\)/.test(P) && /role="switch"/.test(P) &&
  /class="drop" id="impdrop"/.test(P) && /ondrop="MONTHLY\.impDrop\(event\)"/.test(P) && !/Save settings/.test(P) && /The first number is the lower one/.test(P));

/* STREAKS (Cory 18/11: "Streaks on the Monthly Report ... as long as its animation motion art") */
const ON={gp:100, gc:93, adj:-7, arn:100, deln:5}, OFFC={gp:100, gc:85, adj:-7}, OFFA={gp:100, gc:93, adj:-12}, OFFD={gp:100, gc:93, adj:-7, arn:100, deln:9};
t('a month is on target only when collection, adjustments and late accounts all are (A/R ratio is not part of it); no numbers = no answer',
  M.onTarget(ON)===true && M.onTarget(OFFC)===false && M.onTarget(OFFA)===false && M.onTarget(OFFD)===false && M.onTarget(Object.assign({ar:900}, ON))===true && M.onTarget(null)===null && M.onTarget({gc:5})===null);
const RUN={'2025-12':ON, '2026-1':ON, '2026-2':ON, '2026-3':OFFC, '2026-4':ON}, at=(y,m)=>RUN[y+'-'+m];
t('a streak counts back month by month, across the new year, and stops at a miss or an empty month',
  M.streak(at, 2026, 2)===3 && M.streak(at, 2026, 3)===0 && M.streak(at, 2026, 4)===1 && M.streak(at, 2026, 5)===0);
t('milestones that burst: 3, 6, 12, 24 months', JSON.stringify(M.MILESTONES)==='[3,6,12,24]');
t('the page: an "On a roll" strip (longest first, a run that ended this month said), a flame in the table, a banner on the office - motion art, still for "less motion"',
  /<b>On a roll<\/b>/.test(P) && /run ended in '/.test(P) && /class="skmini"/.test(P) && /class="skban"/.test(P) && /@keyframes fl-flick/.test(P) && /@keyframes fl-ember/.test(P) &&
  /function freshMilestone\(o, y, m, n\)/.test(P) && /\.flame svg,\.flame svg \.in,\.flame \.em,\.streaks::before,\.burst i\{animation:none!important\}/.test(P));
t('a month still going counts the run up to the month before', /function runAt\(o, y, m\)\{ const p=isOpen\(y,m\) \? step\(y,m,-1\) : \{y,m\};/.test(P));

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
t('the page loads the rules and the Excel reader', /<script src="monthly\.js\?v=hc\d+"><\/script>/.test(P) && /<script src="prodbook\.js\?v=hc\d+"><\/script>/.test(P));
t('Settings has "Bring in past months from Excel": read in the browser, shown first, then only empty boxes filled', /Bring in past months from Excel/.test(P) && /PH_BOOK\.open\(/.test(P) && /M\.mergeImport\(/.test(P));
t('made-up numbers ONLY in the sandbox - the live site never makes any', /if\(!LIVE && \(!rec \|\| !rec\.o/.test(P));
t('saving changes only the boxes typed, merged into whatever is saved now (PH_STORE.update)', /PH_STORE\.update\(M\.KEY\(Y\), cur=>/.test(P) && /function applyEdits\(r\)/.test(P));
t('OrthoFi’s nightly numbers go through the same rule (mergeOrthofi)', /async function importOrthofi[\s\S]{0,300}M\.mergeOrthofi\(rec, o, m, byOffice\[o\], stamp\)/.test(P));
t('the live site shows OrthoFi as connected only once an admin has turned an office on (OrthoFi page, step 3)', /let ORTHOFI_CONNECTED=!LIVE;/.test(P) && /ORTHOFI_CONNECTED=!!\(OFMAP && Object\.keys\(PH_ORTHOFI\.autoOffices\(OFMAP\)\)\.length\);/.test(P));
t('the fill: live only, someone who can type the report, at most every 3 hours, last month + this month, through mergeOrthofi (never a typed number or a final month)',
  /if\(!LIVE \|\| !window\.PH_ORTHOFI \|\| !at\('edit'\)\) return;/.test(P) && /Date\.now\(\)-last<3\*3600e3/.test(P) && /\[\{y:LM\.y, m:LM\.m\}, \{y:NOW_Y, m:NOW_M\}\]/.test(P) && /M\.mergeOrthofi\(rec, o, m, byOffice\[o\], stamp\)/.test(P) && /autoFill\(false\);/.test(P));
t('Settings: the old-system offices are switched on and off like the Medicaid ones; the office form has an "Old system" group', /MONTHLY\.setOld\(this\.dataset\.o\)/.test(P) && /\{t:'Old system', s:'From your old practice software/.test(P));
t('an office manager types first; OrthoFi’s numbers sit below as a compact grid', P.indexOf("{t: typ ? 'Type these'")>0 && P.indexOf("<h3>From OrthoFi</h3>")>P.indexOf("{t: typ ? 'Type these'"));
t('Medicaid box asks for numbers only, never a patient', /Numbers only — never a patient’s name\./.test(P));
t('the summary for leadership is copied for Teams or email', /async function copy\(\)/.test(P) && /navigator\.clipboard\.writeText/.test(P));
t('no real figures in the files (the sandbox makes its own)', !/\b(483|1206|1181)\b/.test(P) && !/\b(483|1206|1181)\b/.test(read('monthly.js')));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
