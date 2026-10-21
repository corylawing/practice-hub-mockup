/* PRODUCTION: PLAN A YEAR, OFFICE BY OFFICE.

       node test/prodplan.test.js

   21/10/2026. Cory: "Yes build the Plan 2027 screen" ... "This all needs to come together and make
   sense and be easy for her year after year to continue". An office's year asked as she thinks of
   it - grow over last year by a %, stretch above the goal by a %, the production days, the case
   fee - and written as her own kind of formulas. Months that differ stay as they are unless changed;
   a month nobody touched is never rewritten. Made-up workbook (test/madeup-workbook.js). */
const B=require('../v1/prodbook.js');
const WB=require('../v1/workbook.js');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const near=(a,b)=>Math.abs((a||0)-(b||0))<0.005;
const {workbook}=require('./madeup-workbook.js')(B);

const LS={}; global.localStorage={getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}};
const DB={}; const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
global.PH_STORE={ get:k=>Promise.resolve(clone(DB[k])??null), set:(k,v)=>{ DB[k]=clone(v); return Promise.resolve({}); },
  update:(k,f)=>{ const n=f(clone(DB[k])); if(n!==undefined) DB[k]=clone(n); return Promise.resolve({value:n}); } };
let LIVE=false, ADMIN=true;
global.PH={isLive:()=>LIVE, isAdmin:()=>ADMIN, me:()=>({displayName:'Sample Admin'}), name:p=>p&&p.displayName||''};
global.PH_WB=WB; global.PH_BOOK=B;
require('../v1/prodfx.js'); require('../v1/prodstore.js');
const P=global.PH_PROD;

(async()=>{
  await P.copyFromBytes(workbook(2026,{typedGoal:true}), {how:'upload', name:'2026.xlsx'});

  /* 1. An office read the way she thinks of it */
  const m=await P.planModel(2026,'Carlsbad'), D=P.planDraft(m);
  t('the plan knows the offices and last year, month by month', m.offices.join(',')==='Carlsbad,Lubbock' && near(m.ly[0],90000) && near(m.lyMed[0],8000) && m.med);
  t('growth reads as a % over last year: 4%', D.tc.main===4 && D.md.main===4);
  t('a dollar goal typed in for a month stays that month\'s', D.tc.months[0].amount===123456 && D.tc.months[1].own==null);
  t('the stretch reads as "the goal + 10%"', D.stBase==='goal' && D.st.main===10);
  t('production days and the case fees are there', D.days.every(v=>v===9) && D.fee===5000 && D.mdFee===4000);
  t('saving it as it is changes nothing', (await P.planSave(2026,'Carlsbad',P.planPayload(D),{preview:true})).changes.length===0);

  /* 2. Change the growth */
  D.tc.main=5;
  const pv=await P.planSave(2026,'Carlsbad',P.planPayload(D),{preview:true});
  t('a new growth % changes the months that follow it (not the typed one)', pv.changes.length===11 && !pv.changes.some(c=>c.cell==='B12') && pv.changes.every(c=>/\*1\.05$/.test(c.toF)));
  t('...and the preview gives each month\'s goal: TC goal + Medicaid goal', near(pv.months[1].goal, 91000*1.05 + 8000*1.04) && near(pv.months[1].stretch, (91000*1.05 + 8000*1.04)*1.1));
  const sv=await P.planSave(2026,'Carlsbad',P.planPayload(D));
  t('saving writes her kind of formula: last year x 1.05', sv.saved && (await P.formulaModel(2026,'Carlsbad (FFO)')).rows.find(r=>r.row===12).groups[1].named==='[2025 Net Production (Non-Medicaid)] × 1.05');
  const lg=(await P.log(2026))[0];
  t('History: "plan", the office, each change', lg.from.how==='plan' && lg.from.office==='Carlsbad' && lg.changes.length===11);
  t('the office shows as planned', !!(await P.planModel(2026,'Carlsbad')).planned.Carlsbad);
  await P.formulaUndo(2026, sv.at);
  t('Undo puts the plan back', P.planDraft(await P.planModel(2026,'Carlsbad')).tc.main===4);

  /* 3. A month that differs, a dollar goal, days, fees */
  const D2=P.planDraft(await P.planModel(2026,'Carlsbad'));
  D2.tc.months[10].own=12; D2.tc.months[1].amount=200000; D2.days[0]=10; D2.fee=5100; D2.mdFee=4100;
  await P.planSave(2026,'Carlsbad',P.planPayload(D2));
  const d=DB['ph_prod_data_2026'].data['Carlsbad (FFO)'], c12=(await P.formulaModel(2026,'Carlsbad (FFO)')).rows.find(r=>r.row===12);
  t('one month can grow differently (Nov +12%)', c12.boxes[10].f==='L8*1.12');
  t('a dollar goal sits over her formula, which stays underneath', d.C12===200000 && c12.boxes[1].kind==='formula' && near((await P.dashboardData(2026)).offices.Carlsbad.goal[1], 200000 + 8000*1.04));
  t('days and fees are saved as numbers', d.B21===10 && d.B29===5100 && d.B30===4100);
  const D3=P.planDraft(await P.planModel(2026,'Carlsbad'));
  t('...and read back: Nov +12%, Feb $200,000, Jan 10 days', D3.tc.months[10].own===12 && D3.tc.months[1].amount===200000 && D3.days[0]===10 && D3.fee===5100);
  D3.tc.months[1].amount=null;
  await P.planSave(2026,'Carlsbad',P.planPayload(D3));
  t('emptying a dollar goal goes back to the growth %', DB['ph_prod_data_2026'].data['Carlsbad (FFO)'].C12===undefined && near((await P.dashboardData(2026)).offices.Carlsbad.goal[1], 91000*1.04 + 8000*1.04));

  /* 4. A TC-only office whose stretch comes from last year */
  const L=P.planDraft(await P.planModel(2026,'Lubbock'));
  t('Lubbock: +10%, November +75%, the stretch "last year + 25%"', L.tc.main===10 && L.tc.months[10].own===75 && L.stBase==='last' && L.st.main===25 && !L.md);
  L.stBase='goal'; L.st=P.planLine(await P.planModel(2026,'Lubbock'),'stretch','goal'); L.st.main=10;
  const lv=await P.planSave(2026,'Lubbock',P.planPayload(L),{preview:true});
  t('switching the stretch to "the goal + 10%" rewrites every stretch month that way', lv.changes.length===12 && lv.changes.every(c=>/^[B-M]10\*1\.1$/.test(c.toF)));
  t('an office with no usual growth changes nothing until one is typed', P.planPayload({tc:{main:null, months:Array(12).fill(0).map(()=>({own:null, amount:null, was:null}))}, md:null, st:null, stBase:'goal', days:null}).tc.every(x=>x===null));

  /* 5. Next year, planned in its own book */
  const pv27=await P.previewNextYear(2026); await P.createNextYear(pv27);
  const m27=await P.planModel(2027,'Carlsbad'), D27=P.planDraft(m27);
  t('2027\'s plan starts from 2026: last year = 2026\'s production, the same growth', near(m27.ly[0], 100000) && D27.tc.main===4);
  D27.tc.main=6; await P.planSave(2027,'Carlsbad',P.planPayload(D27));
  t('planning 2027 leaves 2026 alone', P.planDraft(await P.planModel(2026,'Carlsbad')).tc.main===4 && P.planDraft(await P.planModel(2027,'Carlsbad')).tc.main===6);
  LIVE=true; ADMIN=false;
  t('only admins save a plan (a preview is fine)', await P.planSave(2027,'Carlsbad',P.planPayload(D27)).then(()=>false,e=>/Only admins/.test(e.message)) && (await P.planSave(2027,'Carlsbad',P.planPayload(D27),{preview:true})).preview);
  LIVE=false; ADMIN=true;

  console.log(ok.map(n=>'  PASS  '+n).join('\n'));
  if(bad.length) console.log(bad.map(n=>'  FAIL  '+n).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.error('CRASH', e); process.exit(1); });
