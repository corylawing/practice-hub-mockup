/* A NEW OFFICE IN THE PRODUCTION NUMBERS (17/11/2026).
       node test/prodoffices.test.js

   Cory: "If another office is added it would have to add to the entire workflow" ... "be very careful we don't mess
   anything up" ... "you cannot push until we are 100% certain its good". An office from Admin -> Locations is set up
   like another office: its tab is a copy of that office's (rows, formulas, look; no numbers). These hold it to:
   nothing else in the file changes, no number is touched, the 8 never change, it can be taken out again while empty,
   a failure puts everything back. Against the made-up workbook only (test/madeup-workbook.js). */
const path=require('path'), fs=require('fs');
global.window=undefined;
const B=require('../v1/prodbook.js'); global.PH_BOOK=B;
require('../v1/workbook.js'); const WB=global.PH_WB;
const {workbook}=require('./madeup-workbook.js')(B);
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const td=new TextDecoder();

const LS={}; global.localStorage={getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}};
global.btoa=s=>Buffer.from(s,'binary').toString('base64'); global.atob=s=>Buffer.from(s,'base64').toString('binary');
const DB={}; const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
let BLOCK=null;
global.PH_STORE={ get:k=>Promise.resolve(clone(DB[k])??null), set:(k,v)=>{ DB[k]=clone(v); return Promise.resolve({}); },
  update:(k,f)=>{ if(BLOCK===k) return Promise.resolve({blocked:true, why:'test'}); const n=f(clone(DB[k])); if(n!==undefined) DB[k]=clone(n); return Promise.resolve({value:n}); },
  readFailed:()=>false };
let ADMIN=true;
global.PH={isLive:()=>false, isAdmin:()=>ADMIN, me:()=>({displayName:'Sample Admin'}), name:p=>p&&p.displayName||''};
require('../v1/prodstore.js'); const P=global.PH_PROD;
const b64=u8=>Buffer.from(u8).toString('base64');

(async()=>{
  // the 2027 layout = the made-up book with every number taken out (what Home-Brace keeps); 2026 the same, without the new office
  const book=await B.open(workbook(2027)), tpl=B.exportXlsx(B.blank(book), null, B.evaluate(B.blank(book)));
  LS.ph_prod_tpl_2027=b64(tpl); LS.ph_prod_tpl_2026=b64(B.exportXlsx(B.blank(await B.open(workbook(2026))), null, null));
  DB.ph_prod_index={years:{2026:{}, 2027:{}}}; DB.ph_prod_mode={source:'homebrace'};
  DB['ph_prod_data_2027']={year:2027, data:{'Carlsbad (FFO)':{B3:111111}}};
  const before=await B.readZip(tpl), dataBefore=JSON.stringify(DB['ph_prod_data_2027']);

  // refusals first - nothing may change
  ADMIN=false; let e=await P.addOffice(2027,'Newtown','Carlsbad').catch(x=>x.message); ADMIN=true;
  t('only an admin can add an office', /Only admins/.test(e) && LS.ph_prod_tpl_2027===b64(tpl));
  e=await P.addOffice(2027,'New/town','Carlsbad').catch(x=>x.message);
  t('a name Excel can’t use for a tab is refused', /can’t be a tab name/.test(e));
  e=await P.addOffice(2027,'Carlsbad','Lubbock').catch(x=>x.message);
  t('one of the 8 can’t be added again', /already one of the offices/.test(e));
  e=await P.addOffice(2027,'Newtown','Nowhere').catch(x=>x.message);
  t('it must be set up like an office that exists', /Pick an office/.test(e) && LS.ph_prod_tpl_2027===b64(tpl) && !DB.ph_prod_offices);

  // the list of offices doesn't save -> the layout goes back exactly as it was
  BLOCK='ph_prod_offices'; e=await P.addOffice(2027,'Newtown','Carlsbad').catch(x=>x.message); BLOCK=null;
  t('if the list of offices doesn’t save, the layout is put back exactly as it was', /put back as it was/.test(e) && LS.ph_prod_tpl_2027===b64(tpl) && !WB.TABS.Newtown);
  P.reset();

  // add it
  const r=await P.addOffice(2027,'Newtown','Carlsbad');
  const after=await B.readZip(Buffer.from(LS.ph_prod_tpl_2027,'base64')), nb=B.parseBook(after);
  t('added: 2027’s layout has a "Newtown" tab, at the end', r.office==='Newtown' && nb.names.join()==='Dashboard,Carlsbad (FFO),Lubbock (FFO),Newtown');
  t('NOTHING ELSE in the file changed: every other tab, the styles and the words are byte for byte the same',
    Object.keys(before).filter(k=>/worksheets\/sheet|styles|sharedStrings/.test(k)).every(k=>after[k] && Buffer.compare(Buffer.from(before[k]), Buffer.from(after[k]))===0));
  t('…and no number was touched', JSON.stringify(DB['ph_prod_data_2027'])===dataBefore);
  const c=nb.sheets.Newtown.cells, src=nb.sheets['Carlsbad (FFO)'].cells;
  t('the new tab = Carlsbad’s rows and formulas, no numbers; its title says NEWTOWN',
    c.A1.v==='NEWTOWN' && c.A3.v===src.A3.v && c.B12.f===src.B12.f && Object.keys(c).filter(a=>c[a].f==null && typeof c[a].v==='number').length===0);
  t('the list of offices: Newtown, its tab, Medicaid like Carlsbad', DB.ph_prod_offices.add.length===1 && DB.ph_prod_offices.add[0].n==='Newtown' && DB.ph_prod_offices.add[0].tab==='Newtown' && DB.ph_prod_offices.add[0].med===true && DB.ph_prod_offices.add[0].like==='Carlsbad');
  t('History says so', DB['ph_prod_log_2027'][0].from.how==='office' && DB['ph_prod_log_2027'][0].from.office==='Newtown' && DB['ph_prod_log_2027'][0].from.like==='Carlsbad');
  t('the 8 are still the 8, Newtown after them', WB.BASE.length===8 && WB.BASE.indexOf('Newtown')<0 && WB.TABS.Newtown==='Newtown' && WB.MEDICAID.Newtown===1 && WB.TABS.Carlsbad==='Carlsbad (FFO)');
  e=await P.addOffice(2027,'Newtown','Lubbock').catch(x=>x.message);
  t('it can’t be added twice', /already has a tab/.test(e));

  // everything reads it
  const D27=await P.dashboardData(2027);
  t('the Dashboard’s numbers have it (empty), and Carlsbad’s are unchanged', D27.offices.Newtown && D27.offices.Newtown.act.every(v=>!v) && D27.offices.Carlsbad.act[0]===111111 && !D27.errors.some(x=>/Newtown/.test(x)));   // (the made-up book has only 2 of the 8 tabs - the other 6 are reported, as always)
  const D26=await P.dashboardData(2026);
  t('a year it wasn’t added to: no Newtown and no error about it', !D26.offices.Newtown && !D26.errors.some(x=>/Newtown/.test(x)));
  const sv=await P.setValues(2027,'Newtown',0,{tc:4500});
  t('Enter Production saves into its own tab', sv.saved[0].address==='Newtown!B3' && DB['ph_prod_data_2027'].data.Newtown.B3===4500 && DB['ph_prod_data_2027'].data['Carlsbad (FFO)'].B3===111111);
  const dl=await P.downloadYear(2027), back=await B.open(dl.bytes);
  t('the Excel download has it, with its number', back.names.indexOf('Newtown')>=0 && back.sheets.Newtown.cells.B3.v===4500);
  const ta=await P.officesToAdd(2027,['Carlsbad','Newtown','Oldtown']);
  t('Admin’s card: Oldtown still to add, Newtown added, set-up choices include Newtown', ta.missing.join()==='Oldtown' && ta.added.join()==='Newtown' && ta.likes.indexOf('Newtown')>=0);
  const ta26=await P.officesToAdd(2026,['Newtown']);
  t('…and for 2026 Newtown can still be added', ta26.missing.join()==='Newtown' && !ta26.added.length);
  require('../v1/proddays.js');
  t('production days from the Schedule include it', global.PH_PRODDAYS.offices().indexOf('Newtown')>=0);

  // taking it out
  e=await P.removeOffice(2027,'Newtown').catch(x=>x.message);
  t('it can’t be taken out once a number is typed for it', /already has numbers/.test(e) && nb.names.length===4);
  delete DB['ph_prod_data_2027'].data.Newtown;
  e=await P.removeOffice(2027,'Carlsbad').catch(x=>x.message);
  t('one of the 8 can never be taken out', /original offices/.test(e));
  await P.removeOffice(2027,'Newtown');
  const out=await B.readZip(Buffer.from(LS.ph_prod_tpl_2027,'base64'));
  t('taken out while empty: the layout has exactly the tabs it had, each byte for byte', B.parseBook(out).names.join()==='Dashboard,Carlsbad (FFO),Lubbock (FFO)' &&
    Object.keys(before).filter(k=>/worksheets\/sheet/.test(k)).every(k=>out[k] && Buffer.compare(Buffer.from(before[k]), Buffer.from(out[k]))===0) && Object.keys(out).filter(k=>/worksheets\/sheet/.test(k)).length===3);

  // wiring on the pages
  const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
  const I=read('index.html'), X=read('production.html'), A=read('prodadmin.js'), W=read('workbook.js'), C=read('connect.html');
  t('the Dashboard gives an added office its place after the 8 (brand from Locations)', /function takeHB\(hb\)\{/.test(I) && /OFFICES\.push\(\{n, brand:\(loc && loc\.brand\)\|\|'FFO'/.test(I) && (I.match(/takeHB\(hb\)/g)||[]).length>=2);
  t('Enter Production offers only offices the year’s numbers have', /HB_OFFS = res\.source==='homebrace' \? Object\.keys\(res\.offices\|\|\{\}\) : null;/.test(X) && /filter\(o=>!HB_OFFS \|\| HB_OFFS\.indexOf\(o\)>=0\)/.test(X));
  t('Admin: the card only when the numbers are Home-Brace’s, only admins add, and it asks first', /if\(!IDX \|\| !P\(\)\.officesToAdd \|\| MODE && MODE\.source !== 'homebrace'\) return '';/.test(A) && /confirm\('Add '\+n\+' to the '\+y\+' production numbers/.test(A) && /var can = !!\(global\.PH && PH\.isAdmin && PH\.isAdmin\(\)\);/.test(A));
  t('her Excel is only ever read for the 8 (connect.html loads no added offices)', /var names = BASE\.slice\(\);/.test(W) && !/prodstore\.js/.test(C));

  // run the Dashboard's and Enter Production's own code with a year that has Newtown (they only take this path on the live site)
  { const src=I.slice(I.indexOf('  function takeHB(hb){'), I.indexOf('  /* PRODUCTION DAYS FROM THE SCHEDULE'));
    const z=()=>Array(12).fill(0), OFFICES=[{n:'Carlsbad', brand:'FFO', act:z()}, {n:'Lubbock', brand:'FFO', act:z()}];
    const window={PH:{locations:()=>[{n:'Newtown', brand:'SUN'}]}};
    eval(src+'; takeHB({offices:{Carlsbad:{act:[5]}, Newtown:{act:[7]}}});');
    t('the Dashboard’s own code: Newtown gets its place after the 8 with its Locations brand and its numbers; Carlsbad’s numbers land as before',
      OFFICES.length===3 && OFFICES[2].n==='Newtown' && OFFICES[2].brand==='SUN' && OFFICES[2].act[0]===7 && OFFICES[0].act[0]===5 && OFFICES[1].act[0]===0); }
  { const off=X.slice(X.indexOf('  let HB_OFFS=null;'), X.indexOf('  function render(){'));
    const fb=X.slice(X.indexOf('  function fillBase(res, reset){'), X.indexOf('  /* After the switch: say whose numbers'));
    const BASE={Carlsbad:{}, Lubbock:{}, Oldtown:{}}; let cur={offices:'all'};
    const r=eval(off+fb+'; fillBase({source:"homebrace", offices:{Carlsbad:{tc:[1]}, Lubbock:{tc:[2]}, Newtown:{tc:[3]}}}, false); [offices(), BASE.Newtown.tc[0]];');
    cur={offices:['Newtown','Oldtown']}; const mine=eval(off+'; HB_OFFS=["Carlsbad","Lubbock","Newtown"]; offices();');
    t('Enter Production’s own code: the year’s offices (Newtown in, an office with no place that year out); someone at Newtown sees Newtown',
      r[0].join()==='Carlsbad,Lubbock,Newtown' && r[1]===3 && mine.join()==='Newtown'); }

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('CRASH', e && e.stack || e); process.exit(1); });
