/* PRODUCTION: THE SWITCH, STARTING A NEW YEAR, AND GOALS SET IN HOME-BRACE.

       node test/prodswitch.test.js

   21/10/2026. Cory: "go ahead and build step 4 and the switch", and "I want homebrace to be able to
   configure the formulas for future years". Home-Brace becomes where the production numbers live
   (her Excel only a download); until an admin flips the switch, nothing changes for anyone.
   Against a made-up workbook laid out like hers (her row names, her kinds of formulas), a stand-in
   shared store and a stand-in SharePoint. Made-up numbers only. */
const B=require('../v1/prodbook.js');
const WB=require('../v1/workbook.js');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const near=(a,b)=>Math.abs((a||0)-(b||0))<0.005;

/* ---- a made-up workbook laid out like hers (test/madeup-workbook.js) ---- */
const {workbook}=require('./madeup-workbook.js')(B);

/* ---- stand-ins ---- */
const LS={}; global.localStorage={getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}};
const DB={}; const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
global.PH_STORE={ get:k=>Promise.resolve(clone(DB[k])??null), set:(k,v)=>{ DB[k]=clone(v); return Promise.resolve({}); },
  update:(k,f)=>{ const n=f(clone(DB[k])); if(n!==undefined) DB[k]=clone(n); return Promise.resolve({value:n}); } };
let LIVE=false, ADMIN=true;
global.PH={isLive:()=>LIVE, isAdmin:()=>ADMIN, me:()=>({displayName:'Sample Admin'}), name:p=>p&&p.displayName||'', WORKBOOK:{drive:'wbdrive', item:'wbitem'}};
global.PH_AUTH={token:()=>Promise.resolve('tok')};
global.PH_WB=WB;
let XL={bytes:null, modified:'2026-10-21T15:00:00Z'}; const FILES={}; let folder=false;
global.fetch=async(url, opt)=>{
  opt=opt||{}; const m=opt.method||'GET', J=(st,o)=>({ok:st<300, status:st, json:async()=>o});
  if(url==='https://download/wb') return {ok:true, status:200, arrayBuffer:async()=>XL.bytes.buffer.slice(XL.bytes.byteOffset, XL.bytes.byteOffset+XL.bytes.byteLength)};
  if(url.startsWith('https://download/file/')){ const f=FILES[decodeURIComponent(url.slice(22))]; return {ok:!!f, status:f?200:404, arrayBuffer:async()=>f.buffer.slice(f.byteOffset,f.byteOffset+f.byteLength)}; }
  const p=url.replace('https://graph.microsoft.com/v1.0','');
  if(p.startsWith('/drives/wbdrive/items/wbitem')) return m==='GET' ? J(200,{name:'x.xlsx', lastModifiedDateTime:XL.modified, lastModifiedBy:{user:{displayName:'Sample Owner'}}, '@microsoft.graph.downloadUrl':'https://download/wb'}) : J(400,{error:{message:'never write'}});
  if(p==='/sites/omegaorthodontics.sharepoint.com:/sites/Home-Brace') return J(200,{id:'s1'});
  if(p==='/sites/s1/drive?$select=id') return J(200,{id:'d1'});
  if(p.startsWith('/drives/d1/root:/Home-Brace%20Production?')) return folder?J(200,{id:'f', folder:{}}):J(404,{error:{message:'nf'}});
  if(p==='/drives/d1/root/children'){ folder=true; return J(201,{id:'f', folder:{}}); }
  const put=/^\/drives\/d1\/root:\/Home-Brace%20Production\/(.+):\/content$/.exec(p);
  if(put){ FILES[decodeURIComponent(put[1])]=new Uint8Array(await opt.body.arrayBuffer()); return J(200,{id:'t', name:decodeURIComponent(put[1])}); }
  const get=/^\/drives\/d1\/root:\/Home-Brace%20Production\/(.+)$/.exec(p);
  if(get){ const n=decodeURIComponent(get[1]); return FILES[n]?J(200,{'@microsoft.graph.downloadUrl':'https://download/file/'+encodeURIComponent(n)}):J(404,{error:{message:'nf'}}); }
  return J(404,{error:{message:'no '+p}});
};
require('../v1/prodstore.js');
const P=global.PH_PROD;

(async()=>{
  const wb26=workbook(2026), book26=await B.open(wb26);
  await P.copyFromBytes(wb26, {how:'upload', name:'2026.xlsx'});

  // 1. The dashboard from Home-Brace's own book = the dashboard from the workbook
  const dd=await P.dashboardData();
  const fromXl=WB.office(B.grid(book26,{value:(s,a)=>book26.sheets[s].cells[a].v},'Carlsbad (FFO)'), true);
  t('the dashboard\'s numbers from Home-Brace are the workbook\'s, office for office', dd.year===2026 && JSON.stringify(dd.offices.Carlsbad)===JSON.stringify(fromXl));
  t('...for a TC-only office too', JSON.stringify(dd.offices.Lubbock)===JSON.stringify(WB.office(B.grid(book26,{value:(s,a)=>book26.sheets[s].cells[a].v},'Lubbock (FFO)'), false)));
  t('...and says which offices it could not find', dd.errors.length===6);

  // 2. Enter Production into Home-Brace
  const tpl=await B.open(B.exportXlsx(B.blank(book26),{},null));
  const at=P.cellFor(tpl,'Carlsbad','dys',2,2026), atg=P.cellFor(tpl,'Carlsbad','goal',9,2026), atl=P.cellFor(tpl,'Lubbock','goal',9,2026);
  t('a field lands where Enter Production puts it in her Excel', at.cell==='D5' && atg.cell==='K16' && atl.cell==='K10');
  const r=await P.setValues(2026,'Carlsbad',2,{dys:10, tc:111111});
  const d2=await P.dashboardData(2026);
  t('saved numbers flow into the dashboard', d2.offices.Carlsbad.done[2]===10 && d2.offices.Carlsbad.act[2]===111111+8000);
  t('each change is in the history, in the workbook\'s words', (await P.log(2026))[0].changes.some(c=>c.label==='Completed Number of Production Days' && c.head==='March' && c.from===9 && c.to===10));
  await P.setValues(2026,'Carlsbad',9,{goal:300000});
  t('a goal typed in wins over the formula, as in Excel', (await P.dashboardData(2026)).offices.Carlsbad.goal[9]===300000);
  await P.setValues(2026,'Carlsbad',9,{goal:''});
  t('...and clearing it brings the formula back', near((await P.dashboardData(2026)).offices.Carlsbad.goal[9], dd.offices.Carlsbad.goal[9]));
  await P.setValues(2026,'Carlsbad',2,{dys:9, tc:110000});

  // 3. The switch
  t('the numbers live in her Excel until someone switches', (await P.mode()).source==='excel');
  LIVE=true; ADMIN=false;
  t('only admins switch', await P.setMode({source:'homebrace'}).then(()=>false,e=>/Only admins/.test(e.message)));
  ADMIN=true;
  const mo=await P.setMode({source:'homebrace', mirror:true});
  t('an admin switches; who and when is kept', mo.source==='homebrace' && mo.mirror===true && mo.changedBy==='Sample Admin' && mo.history.length===1);
  // after the switch her Excel is only compared
  XL={bytes:workbook(2026), modified:'2026-10-22T09:00:00Z'};
  await P.setValues(2026,'Carlsbad',0,{tc:99999});
  const before=JSON.stringify(DB['ph_prod_data_2026']);
  const cmp=await P.syncFromWorkbook();
  t('after the switch her Excel is compared, never copied over Home-Brace', cmp.compared===true && JSON.stringify(DB['ph_prod_data_2026'])===before);
  t('...and the difference is counted, by name', cmp.differ===1 && cmp.sample[0].label==='TC Net Production (Total - Discounts)' && cmp.sample[0].from===99999);
  const back=await P.setMode({source:'excel'});
  t('and it switches back', back.source==='excel' && back.history.length===2);
  const re=await P.syncFromWorkbook();
  t('after switching back, her save that was only compared is copied', !re.skipped && re.changes===1 && DB['ph_prod_data_2026'].data['Carlsbad (FFO)'].B3!==99999);
  t('...once', (await P.syncFromWorkbook()).skipped==='unchanged');
  LIVE=false;
  await P.setValues(2026,'Carlsbad',0,{tc:100000});

  // 4. Starting the next year
  const pv=await P.previewNextYear(2026);
  const row=lab=>pv.rows.find(x=>x.tab==='Carlsbad (FFO)' && x.now===lab);
  t('last year\'s net production comes from the TC Net Production typed each month', row('2026 Net Production (Non-Medicaid)').action==='copied' && /TC Net Production/.test(row('2026 Net Production (Non-Medicaid)').source));
  t('last year\'s Medicaid production is starts x fee', /starts x fee/.test(row('2026 Medicaid Production').source));
  t('the year before moves down a row', /from 2026's "2025 Net Production/.test(row('2025 Net Production (Non-Medicaid)')?.source||'') || pv.rows.some(x=>x.tab==='Lubbock (FFO)' && x.now==='2025 Net Production' && x.action==='copied'));
  t('this year\'s monthly inputs start empty', row('TC Net Production (Total - Discounts)').action==='empty');
  t('the Medicaid case fee carries on; a year total starts again (and is pointed out)', row('Medicaid Case Fee').action==='kept' && pv.flags.some(f=>/Total Starts/.test(f.label)));
  t('a one-figure average fee gets the average of the year\'s months, to check', pv.rows.some(x=>x.tab==='Lubbock (FFO)' && x.now==='2026 Average Case Fee' && x.action==='copied') && pv.flags.some(f=>/average of 9 months/.test(f.flag)));
  t('an older year stays as it is', pv.rows.some(x=>x.now==='Number of NPE (2022)' && x.action==='kept'));
  t('the year headings in a small table move on one', pv.data.Dashboard.B33===2027 && pv.data.Dashboard.C33===2026);
  t('a figure under last year\'s heading takes the one that sat under this year\'s', near(pv.data.Dashboard.C34, B.evaluate(B.withData(tpl,DB['ph_prod_data_2026'].data)).value('Dashboard','B34')));
  t('a "sum typed as a formula" (=3*4000) starts empty next year', pv.template.sheets['Carlsbad (FFO)'].cells.M10.f==null);
  const made=await P.createNextYear(pv);
  t('2027 is created', made.year===2027 && (await P.index()).years[2027].started.from===2026);
  t('creating it twice is refused, so nothing typed for 2027 can be lost', await P.createNextYear(pv).then(()=>false,e=>/already kept/.test(e.message)));
  const d27=await P.dashboardData(2027), d26=await P.dashboardData(2026);
  t('2027\'s "last year" is 2026\'s production, month by month', d26.offices.Carlsbad.act.every((v,i)=>near(v,d27.offices.Carlsbad.ly[i])) && d26.offices.Lubbock.act.every((v,i)=>near(v,d27.offices.Lubbock.ly[i])));
  t('2027\'s goals are 2026\'s actuals x her growth numbers', near(d27.offices.Lubbock.goal[0], 60000*1.1) && near(d27.offices.Lubbock.goal[10], d26.offices.Lubbock.act[10]*1.75));
  t('2027 starts with no actuals', d27.offices.Carlsbad.act.every(v=>!v));
  t('2026 is exactly as it was', JSON.stringify(d26.offices.Carlsbad.goal)===JSON.stringify(dd.offices.Carlsbad.goal));
  const x27=await B.open((await P.downloadYear(2027)).bytes);
  t('2027\'s Excel: its labels a year on, her formulas kept', x27.sheets['Carlsbad (FFO)'].cells.A12.v==='2027 TC Production Goal (Non-Medicaid)' && x27.sheets['Carlsbad (FFO)'].cells.B12.f==='B8*1.04' && x27.sheets['Carlsbad (FFO)'].cells.A8.v==='2026 Net Production (Non-Medicaid)');
  // an office with no fee of this year's keeps the one its formulas divide by (Cory: keep the fee they use today)
  t('no 2026 average case fee: 2027 keeps the fee 2026 used, and says so', DB['ph_prod_data_2027'].data['Carlsbad (FFO)'].B29===5000 && x27.sheets['Carlsbad (FFO)'].cells.A29.v==='2026 Average Case Fee' && pv.flags.some(f=>/kept the one 2026 used \(\$5,000\)/.test(f.flag)));
  await P.saveGoals(2027,'Carlsbad',[{cell:'B21',set:'amount',value:9}]);       // 2027's production days, as Heather sets them
  const v22=B.evaluate((await P.loadYear(2027)).book).value('Carlsbad (FFO)','B22');
  t('...so 2027\'s starts per day work out, not #DIV/0!', typeof v22==='number' && isFinite(v22) && v22>0);

  // 4b. December typed in January: 2026's late numbers follow into 2027's "last year"
  const late=await P.setValues(2026,'Carlsbad',11,{tc:777777});
  t('a number saved later for 2026 is carried into 2027\'s "last year"', DB['ph_prod_data_2027'].data['Carlsbad (FFO)'].M8===777777 && late.next && late.next.changes===1);
  t('...the dashboard\'s 2027 "last year" has it', near((await P.dashboardData(2027)).offices.Carlsbad.ly[11], 777777));
  t('...and it is in 2027\'s History, said as such', (await P.log(2027))[0].from.how==='lastyear' && (await P.log(2027))[0].changes[0].to===777777);
  t('...2027\'s goals and formulas did not move', (await P.downloadYear(2027)).bytes && (await B.open((await P.downloadYear(2027)).bytes)).sheets['Carlsbad (FFO)'].cells.M12.f==='M8*1.04');
  await P.copyFromBytes(workbook(2026,{dec:999999}), {how:'upload', name:'2026.xlsx'});
  t('a copy of her Excel with December in it follows too', DB['ph_prod_data_2027'].data['Carlsbad (FFO)'].M8===999999);
  DB['ph_prod_data_2027'].data['Carlsbad (FFO)'].L8=12345;                     // changed by hand in 2027
  const late2=await P.setValues(2026,'Carlsbad',10,{tc:888888});
  t('a copy changed by hand in 2027 is left alone', DB['ph_prod_data_2027'].data['Carlsbad (FFO)'].L8===12345 && late2.next.kept===1 && late2.next.changes===0);
  t('a year with no next year started saves as before', (await P.setValues(2027,'Carlsbad',0,{tc:1})).next===null);

  // 5. Gaps and blacked-out months in a new year
  Object.keys(DB).forEach(k=>delete DB[k]); Object.keys(LS).forEach(k=>delete LS[k]); P.reset();
  await P.copyFromBytes(workbook(2026,{typedGoal:true, black:true}), {how:'upload'});
  const pv2=await P.previewNextYear(2026), c2=pv2.template.sheets['Carlsbad (FFO)'].cells, dsh=pv2.template.sheets['Dashboard'].cells;
  t('a goal typed by hand gets the row\'s formula next year, and is pointed out', c2.B12.f==='B8*1.04' && pv2.flags.some(f=>/Jan had no formula/.test(f.flag) && /B8\*1.04/.test(f.flag)));
  t('blacked-out months take the office\'s own colour next year', dsh.B5.s===3 && dsh.C5.s===3 && dsh.D5.s===3);
  t('...and get the row\'s formula, moved across', dsh.B5.f==="'Carlsbad (FFO)'!B24" && dsh.D5.f==="'Carlsbad (FFO)'!D24");

  // 6. Goals & formulas, set in Home-Brace
  await P.createNextYear(pv2);
  const gm=await P.goalModel(2027,'Carlsbad'), tc=gm.rows.find(r=>r.key==='tc'), tot=gm.rows.find(r=>r.key==='total');
  t('her rules read in her terms: last year x 1.04, the total as TC + Medicaid', tc.cells[1].rule.kind==='times' && tc.cells[1].rule.mult===1.04 && tc.cells[1].rule.base==='lyNet' && tot.cells[0].rule.kind==='sum');
  const pre=await P.saveGoals(2027,'Carlsbad',[{cell:'C12', set:'times', mult:1.1}],{preview:true});
  t('a preview shows the goals a change gives, without saving', pre.preview && near(pre.values.find(v=>v.cell==='C12').value, d26.offices.Carlsbad.act[1]-8000+0 ? (DB['ph_prod_data_2027'].data['Carlsbad (FFO)'].C8)*1.1 : 0) && (await P.goalModel(2027,'Carlsbad')).rows[0].cells[1].rule.mult===1.04);
  LIVE=true; ADMIN=false;
  t('only admins change goals', await P.saveGoals(2027,'Carlsbad',[{cell:'C12', set:'times', mult:1.1}]).then(()=>false,e=>/Only admins/.test(e.message)));
  ADMIN=true; LIVE=false;
  await P.saveGoals(2027,'Carlsbad',[{cell:'C12', set:'times', mult:1.1},{cell:'D12', set:'amount', value:150000},{cell:'B21', set:'amount', value:11}]);
  const g2=await P.dashboardData(2027), base27=DB['ph_prod_data_2027'].data['Carlsbad (FFO)'];
  t('a new growth number changes that month\'s goal', near(g2.offices.Carlsbad.goal[1], base27.C8*1.1 + base27.C10*1.04));
  t('an amount sets the goal; production days are saved', near(g2.offices.Carlsbad.goal[2], 150000 + base27.D10*1.04) && g2.offices.Carlsbad.days[0]===11);
  const x2=await B.open((await P.downloadYear(2027)).bytes);
  t('the Excel download carries the new formula and the amount', x2.sheets['Carlsbad (FFO)'].cells.C12.f==='C8*1.1' && x2.sheets['Carlsbad (FFO)'].cells.D12.v===150000);
  t('2026 never moves', JSON.stringify((await P.dashboardData(2026)).offices.Carlsbad.goal.slice(1,4))===JSON.stringify(dd.offices.Carlsbad.goal.slice(1,4)));
  await P.saveGoals(2027,'Carlsbad',[{cell:'D12', set:'formula'}]);
  t('emptying an amount goes back to the formula', near((await P.dashboardData(2027)).offices.Carlsbad.goal[2], base27.D8*1.04 + base27.D10*1.04));
  t('a rule that would give an error is refused, and nothing is saved', await P.saveGoals(2027,'Carlsbad',[{cell:'E12', set:'times', mult:0}]).then(()=>false,e=>/multiplier/.test(e.message)));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
