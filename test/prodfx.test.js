/* PRODUCTION: FORMULAS IN PLAIN WORDS, CHANGED IN HOME-BRACE.

       node test/prodfx.test.js

   21/10/2026. Cory: "build the formula screen remember clear and easy ux so she can and others can
   manage this". Every formula reads as row names ([2025 Net Production] × 1.04), turns back into
   the same Excel, and can be changed for one year - shown first, saved into that year's layout,
   in History, undoable. Against the made-up workbook laid out like hers (test/madeup-workbook.js).
   Made-up numbers only. */
const B=require('../v1/prodbook.js');
const WB=require('../v1/workbook.js');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const near=(a,b)=>Math.abs((a||0)-(b||0))<0.005;
const {workbook}=require('./madeup-workbook.js')(B);

/* ---- stand-ins (the sandbox: layouts kept in this browser's storage) ---- */
const LS={}; global.localStorage={getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}};
const DB={}; const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
global.PH_STORE={ get:k=>Promise.resolve(clone(DB[k])??null), set:(k,v)=>{ DB[k]=clone(v); return Promise.resolve({}); },
  update:(k,f)=>{ const n=f(clone(DB[k])); if(n!==undefined) DB[k]=clone(n); return Promise.resolve({value:n}); } };
let LIVE=false, ADMIN=true;
global.PH={isLive:()=>LIVE, isAdmin:()=>ADMIN, me:()=>({displayName:'Sample Admin'}), name:p=>p&&p.displayName||''};
global.PH_WB=WB; global.PH_BOOK=B;
const FX=require('../v1/prodfx.js');
require('../v1/prodstore.js');
const P=global.PH_PROD;

(async()=>{
  /* 1. Every formula, named and back: the same results */
  for(const opts of [{}, {typedGoal:true, black:true, yoy:true}]){
    const book=await B.open(workbook(2026, opts)), data=B.dataOf(book), tpl=await B.open(B.exportXlsx(B.blank(book),{},null)), ctx={tpl, data};
    const t2={names:tpl.names, sheets:{}, files:tpl.files, sst:tpl.sst}; let n=0, stable=true;
    tpl.names.forEach(s=>{ const nc={}; Object.entries(tpl.sheets[s].cells).forEach(([a,c])=>{ nc[a]=c; if(c.f==null) return; n++;
      const nm=FX.toNamed(ctx,s,a,c.f), f2=FX.fromNamed(ctx,s,a,nm); if(FX.toNamed(ctx,s,a,f2)!==nm) stable=false; nc[a]=Object.assign({},c,{f:f2}); });
      t2.sheets[s]={path:tpl.sheets[s].path, cells:nc}; });
    const e0=B.evaluate(B.withData(tpl,data)), e1=B.evaluate(B.withData(t2,data));
    t('every formula named and back gives the same result'+(opts.yoy?' (with typed goals, black-outs, the YOY table)':''), n>150 && stable && Object.keys(e0.all).every(k=>e0.all[k]===e1.all[k]));
  }

  /* 2. How they read */
  const book=await B.open(workbook(2026,{yoy:true})), data=B.dataOf(book), tpl=await B.open(B.exportXlsx(B.blank(book),{},null)), ctx={tpl, data};
  const N=(s,a)=>FX.toNamed(ctx,s,a,tpl.sheets[s].cells[a].f);
  t('a growth number on last year reads as the row and the number', N('Carlsbad (FFO)','K12')==='[2025 Net Production (Non-Medicaid)] × 1.04');
  t('a total of two rows', N('Carlsbad (FFO)','B16')==='[2026 TC Production Goal (Non-Medicaid)] + [2026 Medicaid Production Goal]');
  t('the case fee is one fixed box: its row and its column', N('Carlsbad (FFO)','K22')==='[2026 TC Production Goal (Non-Medicaid)] ÷ [Number of Production Days (2026)] ÷ [2025 Average Case Fee · Jan]');
  t('...the same in January, where the fee sits', N('Carlsbad (FFO)','B22')===N('Carlsbad (FFO)','K22'));
  t('another tab: the tab, then the row', N('Dashboard','E5')==='[Carlsbad (FFO) › Current Tracking (Over/Under) to Goal]');
  t('a year table says its columns by year', N('Dashboard','D34')==='[this row · 2026] - [this row · 2025]');
  t('...and boxes of another tab by their heading', N('Dashboard','B34')==='[Carlsbad (FFO) › 2026 Actual TC ONLY + Medicaid Production · Jan] ÷ [Carlsbad (FFO) › Completed Number of Production Days · Jan]');

  /* 3. Typing them */
  const F=(text,s='Carlsbad (FFO)',a='K12')=>FX.fromNamed(ctx,s,a,text);
  t('plain words become her Excel, month by month', F('[2025 Net Production (Non-Medicaid)] × 1.05')==='K8*1.05' && F('[2025 Net Production (Non-Medicaid)] × 1.05','Carlsbad (FFO)','B12')==='B8*1.05');
  t('* / x, a %, a leading = and any case all work', F('=[2025 net production (non-medicaid)] x 105%')==='K8*1.05' && F('[2025 Net Production (Non-Medicaid)]*2/4')==='K8*2/4');
  t('one fixed box, a run of a row, "this month"', F('[2025 Average Case Fee · Jan]')==='$B$29' && F('SUM([TC Net Production (Total - Discounts) · Jan–Mar])')==='SUM($B$3:$D$3)' && F('SUM([TC Net Production (Total - Discounts) · Jan–this month])')==='SUM($B$3:K3)');
  t('another tab, by its name or the office\'s', F('[Lubbock (FFO) › TC Net Production (Total - Discounts)]','Dashboard','K5')==="'Lubbock (FFO)'!K3" && F('[Lubbock › 2025 Net Production]','Dashboard','K5')==="'Lubbock (FFO)'!K8");
  const why=text=>{ try{ F(text); return ''; }catch(e){ return e.friendly ? e.message : 'NOT FRIENDLY: '+e.message; } };
  t('a row that isn\'t there is said plainly', /no row called “Net Prod”/.test(why('[Net Prod] × 1.04')));
  t('...so is a tab', /no tab called “Carlsbadd”/.test(why('[Carlsbadd › Net] × 1')));
  t('...a word outside [ ]', /“growth” isn’t a row or a number/.test(why('[2025 Net Production (Non-Medicaid)] × growth')));
  t('...an open [', /isn’t closed/.test(why('[2025 Net Production (Non-Medicaid) × 1.04')));
  t('...a box using itself', /this very box/.test(why('[this row] + 1')) && /this very box/.test(why('[2026 TC Production Goal (Non-Medicaid)] × 2')));
  t('...and broken arithmetic', /doesn’t read as a formula/.test(why('[2025 Net Production (Non-Medicaid)] × × 2')));

  /* 4. Changing one, for one year */
  await P.copyFromBytes(workbook(2026,{typedGoal:true}), {how:'upload', name:'2026.xlsx'});
  const m=await P.formulaModel(2026,'Carlsbad (FFO)'), goal=m.rows.find(r=>r.name==='2026 TC Production Goal (Non-Medicaid)');
  t('the screen lists each row with its formulas, months grouped', m.tabs.length===3 && goal.groups.length===2 && goal.groups[0].when==='Jan' && goal.groups[0].kind==='typed' && goal.groups[1].when==='Feb–Dec' && goal.groups[1].named==='[2025 Net Production (Non-Medicaid)] × 1.04');
  t('"Add a row" offers the case fee as its one box, and last year\'s production as the same month', m.picks.some(p=>p.tab==='Carlsbad (FFO)' && p.name==='2025 Average Case Fee' && p.one==='Jan') && m.picks.some(p=>p.name==='2025 Net Production (Non-Medicaid)' && p.one===''));
  const cols=goal.groups[1].cols;
  const pv=await P.formulaChange(2026,'Carlsbad (FFO)',12,cols,'[2025 Net Production (Non-Medicaid)] × 1.06',{preview:true});
  t('a preview shows each month before and after', pv.preview && pv.boxes.length===11 && near(pv.boxes[0].before, (90000+1000)*1.04) && near(pv.boxes[0].after, (90000+1000)*1.06));
  t('...what else moves (total goal, stretch, tracking, the Dashboard)', ['2026 Total Production Goal (TC + Medicaid)','2026 STRETCH Production Goal (TC + Medicaid)'].every(n=>pv.also.some(a=>a.name===n)) && pv.also.some(a=>a.tab==='Dashboard'));
  t('...and one month worked through with its numbers', pv.explain && pv.explain.head==='Feb' && pv.explain.text==='91,000 × 1.06' && near(pv.explain.value, 96460) && pv.explain.excel==='=C8*1.06');
  t('a preview saves nothing', DB['ph_prod_log_2026'].length===1 && !(await P.formulaModel(2026,'Carlsbad (FFO)')).rows.find(r=>r.row===12).groups[1].named.includes('1.06'));
  const sv=await P.formulaChange(2026,'Carlsbad (FFO)',12,cols,'[2025 Net Production (Non-Medicaid)] × 1.06');
  t('saving changes that year\'s formulas', sv.saved && (await P.formulaModel(2026,'Carlsbad (FFO)')).rows.find(r=>r.row===12).groups[1].named==='[2025 Net Production (Non-Medicaid)] × 1.06');
  t('...the dashboard follows (its goal = TC goal + Medicaid goal)', near((await P.dashboardData(2026)).offices.Carlsbad.goal[3], (90000+3000)*1.06 + 8000*1.04));
  const x26=await B.open((await P.downloadYear(2026)).bytes);
  t('...the Excel download carries the new formula', x26.sheets['Carlsbad (FFO)'].cells.D12.f==='D8*1.06' && x26.sheets['Carlsbad (FFO)'].cells.B12.f==null);
  const lg=(await P.log(2026))[0];
  t('...History has it in plain words, from and to', lg.from.how==='formulas' && lg.changes.length===11 && lg.changes[0].fromN==='[2025 Net Production (Non-Medicaid)] × 1.04' && lg.changes[0].toN==='[2025 Net Production (Non-Medicaid)] × 1.06');
  // a month typed by hand gets a formula; the typed number is kept in History and comes back with Undo
  const sv2=await P.formulaChange(2026,'Carlsbad (FFO)',12,[2],'[2025 Net Production (Non-Medicaid)] × 1.02');
  t('a typed month can be given a formula', near((await P.dashboardData(2026)).offices.Carlsbad.goal[0], 90000*1.02 + 8000*1.04) && DB['ph_prod_data_2026'].data['Carlsbad (FFO)'].B12===undefined && (await P.log(2026))[0].changes[0].from===123456);
  await P.formulaUndo(2026, sv2.at);
  t('Undo puts the typed number back', DB['ph_prod_data_2026'].data['Carlsbad (FFO)'].B12===123456 && near((await P.dashboardData(2026)).offices.Carlsbad.goal[0], 123456 + 8000*1.04) && (await P.log(2026))[0].from.undo===sv2.at);
  t('an earlier change undoes too, when nothing has changed its boxes since', await P.formulaUndo(2026, sv.at).then(()=>true,()=>false));
  t('...and the change before it undoes cleanly', (await P.formulaModel(2026,'Carlsbad (FFO)')).rows.find(r=>r.row===12).groups[1].named==='[2025 Net Production (Non-Medicaid)] × 1.04');
  const again=await P.formulaChange(2026,'Carlsbad (FFO)',12,[3],'[2025 Net Production (Non-Medicaid)] × 1.5');
  await P.formulaChange(2026,'Carlsbad (FFO)',12,[3],'[2025 Net Production (Non-Medicaid)] × 1.6');
  t('...but not when a later change replaced it', await P.formulaUndo(2026, again.at).then(()=>false, e=>/changed again/.test(e.message)));
  t('a formula that goes round in a circle is refused', await P.formulaChange(2026,'Carlsbad (FFO)',12,[5],'[2026 Total Production Goal (TC + Medicaid)] × 0.9').then(()=>false, e=>/circle/.test(e.message)));
  t('one that gives an error is shown, and refused', (await P.formulaChange(2026,'Carlsbad (FFO)',12,[5],'{A3} × 2',{preview:true})).blocked && await P.formulaChange(2026,'Carlsbad (FFO)',12,[5],'{A3} × 2').then(()=>false, e=>/#VALUE!/.test(e.message)));
  t('a box holding text can\'t take a formula', await P.formulaChange(2026,'Carlsbad (FFO)',12,[1],'1').then(()=>false, e=>/text/.test(e.message)));
  LIVE=true; ADMIN=false;
  t('only admins change formulas (a preview is fine)', await P.formulaChange(2026,'Carlsbad (FFO)',12,[5],'2').then(()=>false, e=>/Only admins/.test(e.message)));
  LIVE=false; ADMIN=true;

  /* 5. One year never moves another */
  const pv27=await P.previewNextYear(2026); await P.createNextYear(pv27);
  await P.formulaChange(2027,'Lubbock (FFO)',10,[2,3,4,5,6,7,8,9,10,11,12,13],'[2026 Net Production] × 1.2');
  t('a 2027 formula change leaves 2026 as it was', (await P.formulaModel(2026,'Lubbock (FFO)')).rows.find(r=>r.row===10).groups.every(g=>!/1\.2\b/.test(g.named||'')) && (await P.formulaModel(2027,'Lubbock (FFO)')).rows.find(r=>r.row===10).groups[0].named==='[2026 Net Production] × 1.2');

  console.log(ok.map(n=>'  PASS  '+n).join('\n'));
  if(bad.length) console.log(bad.map(n=>'  FAIL  '+n).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.error('CRASH', e); process.exit(1); });
