/* PRODUCTION BOOKS, KEPT - copying Heather's Excel into Home-Brace's own books, year by year.

       node test/prodstore.test.js

   21/10/2026. Cory: build our own production data beside the live Excel and "run them parallel
   for a bit to make sure everything works correctly". Against a stand-in SharePoint and a
   stand-in shared store: the first copy keeps the year; a later copy lists exactly what changed,
   in the workbook's own words; nothing is copied when she hasn't saved; her workbook is only ever
   READ; a changed layout keeps every number in its row and month; years never touch each other;
   the Excel downloaded back is hers with Home-Brace's numbers. Made-up workbooks only. */
const B=require('../v1/prodbook.js');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };

/* ---- a made-up production workbook. extra: a row added above "Completed Days" (a new layout) ---- */
function workbook(o){
  o=Object.assign({year:2026, tc:[100000,120000], days:[10,12], mult:1.1, extra:false}, o||{});
  const labels=['OFFICE A','Jan','Feb','TC Net Production','Medicaid Starts','Completed Days',o.year+' Goal','Total','DASHBOARD'];
  const S=i=>labels.indexOf(i);
  const r=o.extra?1:0, goal=o.tc.map(v=>v*o.mult), rows=[];
  rows.push('<row r="1"><c r="A1" t="s"><v>'+S('OFFICE A')+'</v></c><c r="B1" t="s"><v>'+S('Jan')+'</v></c><c r="C1" t="s"><v>'+S('Feb')+'</v></c></row>');
  rows.push('<row r="2"><c r="A2" t="s"><v>'+S('TC Net Production')+'</v></c><c r="B2" s="1"><v>'+o.tc[0]+'</v></c><c r="C2" s="1"><v>'+o.tc[1]+'</v></c></row>');
  if(o.extra) rows.push('<row r="3"><c r="A3" t="s"><v>'+S('Medicaid Starts')+'</v></c><c r="B3"/><c r="C3"/></row>');
  rows.push('<row r="'+(3+r)+'"><c r="A'+(3+r)+'" t="s"><v>'+S('Completed Days')+'</v></c><c r="B'+(3+r)+'"><v>'+o.days[0]+'</v></c><c r="C'+(3+r)+'"><v>'+o.days[1]+'</v></c></row>');
  rows.push('<row r="'+(4+r)+'"><c r="A'+(4+r)+'" t="s"><v>'+S(o.year+' Goal')+'</v></c><c r="B'+(4+r)+'" s="1"><f>B2*'+o.mult+'</f><v>'+goal[0]+'</v></c><c r="C'+(4+r)+'" s="1"><f>C2*'+o.mult+'</f><v>'+goal[1]+'</v></c></row>');
  rows.push('<row r="'+(5+r)+'"><c r="A'+(5+r)+'" t="s"><v>'+S('Total')+'</v></c><c r="B'+(5+r)+'"><f>SUM(B'+(4+r)+':C'+(4+r)+')</f><v>'+(goal[0]+goal[1])+'</v></c></row>');
  const sheet1='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.join('')+'</sheetData></worksheet>';
  const sheet2='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>'+S('DASHBOARD')+'</v></c></row>'+
    "<row r=\"2\"><c r=\"B2\"><f>'Office (A)'!B"+(4+r)+"</f><v>"+goal[0]+"</v></c></row></sheetData></worksheet>";
  return B.writeZip({
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Office (A)" sheetId="1" r:id="rId1"/><sheet name="Dashboard" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/sharedStrings.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+labels.map(x=>'<si><t>'+x+'</t></si>').join('')+'</sst>',
    'xl/styles.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf/><xf numFmtId="4" applyNumberFormat="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml':sheet1, 'xl/worksheets/sheet2.xml':sheet2
  });
}

/* ---- stand-ins: the page's PH, the shared store, SharePoint/Graph, the browser ---- */
const LS={}; global.localStorage={getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}};
const DB={}; const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
global.PH_STORE={ get:k=>Promise.resolve(clone(DB[k])??null), set:(k,v)=>{ DB[k]=clone(v); return Promise.resolve({}); },
  update:(k,f)=>{ const n=f(clone(DB[k])); if(n!==undefined) DB[k]=clone(n); return Promise.resolve({value:n}); } };
let LIVE=false, ADMIN=true;
global.PH={isLive:()=>LIVE, isAdmin:()=>ADMIN, me:()=>({displayName:'Sample Admin'}), name:p=>p&&p.displayName||'', WORKBOOK:{drive:'wbdrive', item:'wbitem'}};
global.PH_AUTH={token:()=>Promise.resolve('tok')};
const CALLS=[], FILES={}, SP={site:false, folder:false};
let WB={bytes:workbook(), modified:'2026-10-21T15:00:00Z', by:'Sample Owner', name:'2026 PRODUCTION DASHBOARD (New).xlsx'};
global.fetch=async(url, opt)=>{
  opt=opt||{}; const m=(opt.method||'GET'); CALLS.push(m+' '+url);
  const J=(st,o)=>({ok:st<300, status:st, json:async()=>o, arrayBuffer:async()=>new ArrayBuffer(0)});
  if(url==='https://download/wb') return {ok:true, status:200, arrayBuffer:async()=>WB.bytes.buffer.slice(WB.bytes.byteOffset, WB.bytes.byteOffset+WB.bytes.byteLength)};
  if(url.startsWith('https://download/file/')){ const f=FILES[decodeURIComponent(url.slice(22))]; return {ok:!!f, status:f?200:404, arrayBuffer:async()=>f.buffer.slice(f.byteOffset,f.byteOffset+f.byteLength)}; }
  const p=url.replace('https://graph.microsoft.com/v1.0','');
  if(p.startsWith('/drives/wbdrive/items/wbitem')){
    if(m!=='GET') return J(400,{error:{message:'the test says: never write to her workbook'}});
    return J(200,{name:WB.name, lastModifiedDateTime:WB.modified, lastModifiedBy:{user:{displayName:WB.by}}, '@microsoft.graph.downloadUrl':'https://download/wb'});
  }
  if(p==='/sites/omegaorthodontics.sharepoint.com:/sites/Home-Brace') return J(200,{id:'site1'});
  if(p==='/sites/site1/drive?$select=id') return J(200,{id:'sitedrive'});
  if(p.startsWith('/drives/sitedrive/root:/Home-Brace%20Production?')) return SP.folder ? J(200,{id:'f1', folder:{}}) : J(404,{error:{message:'not found'}});
  if(p==='/drives/sitedrive/root/children' && m==='POST'){ SP.folder=true; return J(201,{id:'f1', folder:{}}); }
  const put=/^\/drives\/sitedrive\/root:\/Home-Brace%20Production\/(.+):\/content$/.exec(p);
  if(put && m==='PUT'){ const name=decodeURIComponent(put[1]); FILES[name]=new Uint8Array(await opt.body.arrayBuffer()); return J(200,{id:'t-'+name, name, webUrl:'https://sp/'+name}); }
  const get=/^\/drives\/sitedrive\/root:\/Home-Brace%20Production\/(.+)$/.exec(p);
  if(get && m==='GET'){ const name=decodeURIComponent(get[1]); return FILES[name] ? J(200,{name, '@microsoft.graph.downloadUrl':'https://download/file/'+encodeURIComponent(name)}) : J(404,{error:{message:'not found'}}); }
  return J(404,{error:{message:'stand-in has no '+m+' '+p}});
};
require('../v1/prodstore.js');
const P=global.PH_PROD;

(async()=>{
  // 1. The sandbox: a workbook chosen by hand, kept in this browser
  let r=await P.copyFromBytes(workbook(), {how:'upload', name:'try.xlsx'});
  t('a workbook becomes its year\'s book (the year read from its goal rows)', r.year===2026 && r.first===true && r.numbers===4);
  t('every formula checked against what Excel saved - all the same', r.check.formulas===4 && r.check.differ===0);
  t('on the sandbox the layout stays in this browser, never SharePoint', !!LS['ph_prod_tpl_2026'] && !CALLS.some(c=>/graph\.microsoft/.test(c)));
  let idx=await P.index();
  t('the index knows the year, its numbers and its formulas', idx.years[2026].numbers===4 && idx.years[2026].formulas===4 && idx.years[2026].check.differ===0);
  t('an uploaded file does not pose as a copy of her Excel', !idx.source);
  let dl=await P.downloadYear(2026), back=await B.open(dl.bytes);
  t('the Excel downloaded back has the numbers and the formulas', back.sheets['Office (A)'].cells.C2.v===120000 && back.sheets['Office (A)'].cells.B4.f==='B2*1.1' && dl.name==='2026 PRODUCTION DASHBOARD (from Home-Brace).xlsx');
  t('...and the formatting', back.sheets['Office (A)'].cells.B2.s===1);

  // 2. Live: copying her Excel
  Object.keys(LS).forEach(k=>delete LS[k]); Object.keys(DB).forEach(k=>delete DB[k]); P.reset(); LIVE=true; CALLS.length=0;
  r=await P.syncFromWorkbook();
  t('the first copy keeps the year', r.year===2026 && r.first===true);
  t('her workbook is only ever READ - not one write to it', CALLS.filter(c=>/wbitem/.test(c)).every(c=>c.startsWith('GET ')) && CALLS.some(c=>c==='GET https://download/wb'));
  t('the layout goes into the "Home-Brace Production" folder on the site', !!FILES['2026 production template.xlsx'] && SP.folder);
  const tpl=await B.open(FILES['2026 production template.xlsx']);
  t('...as her workbook without the typed numbers (formulas kept)', tpl.sheets['Office (A)'].cells.B2.v==='' && tpl.sheets['Office (A)'].cells.B4.f==='B2*1.1');
  t('the numbers go into the shared store, by tab and cell', DB['ph_prod_data_2026'].data['Office (A)'].C2===120000 && DB['ph_prod_data_2026'].from.by==='Sample Owner');
  idx=await P.index();
  t('it remembers which save of hers it copied', idx.source.modified==='2026-10-21T15:00:00Z' && idx.source.by==='Sample Owner');
  CALLS.length=0;
  r=await P.syncFromWorkbook();
  t('nothing is downloaded again until she saves again', r.skipped==='unchanged' && !CALLS.includes('GET https://download/wb'));
  ADMIN=false; r=await P.syncFromWorkbook({force:true}); ADMIN=true;
  t('only admins copy', r.skipped==='not an admin');
  ADMIN=false; const refused=await P.copyFromBytes(workbook(),{}).then(()=>false,e=>/Only admins/.test(e.message)); ADMIN=true;
  t('...and a non-admin cannot save a copy any other way', refused);

  // 3. She saves new numbers
  WB={...WB, bytes:workbook({tc:[100000,125500], days:[10,13]}), modified:'2026-10-22T09:00:00Z'};
  const putsBefore=Object.keys(FILES).length; CALLS.length=0;
  r=await P.syncFromWorkbook();
  t('a new save is copied, and it says how many numbers changed', r.changes===2 && r.first===false);
  const log=await P.log(2026), e=log[0];
  t('the history names each change in the workbook\'s own words', e.changes.some(c=>c.tab==='Office (A)' && c.label==='TC Net Production' && c.head==='Feb' && c.from===120000 && c.to===125500));
  t('...with whose save it was', e.from.by==='Sample Owner' && e.from.modified==='2026-10-22T09:00:00Z');
  t('the layout is not saved again when only numbers changed', !CALLS.some(c=>/^PUT .*production%20template/.test(c)) && e.layout===null);

  // 4. Her layout changes: a row added in the middle
  WB={...WB, bytes:workbook({tc:[100000,125500], days:[10,13], extra:true}), modified:'2026-10-23T09:00:00Z'};
  r=await P.syncFromWorkbook();
  t('a changed layout is noticed and saved again', !!r.layout && r.layout!=='new' && r.layout.includes('Office (A)'));
  t('copied from her Excel, the numbers come with the new layout', DB['ph_prod_data_2026'].data['Office (A)'].C4===13 && DB['ph_prod_data_2026'].data['Office (A)'].C3===undefined);

  // 5. A changed layout uploaded for a year, keeping Home-Brace's numbers
  Object.keys(DB).forEach(k=>delete DB[k]); Object.keys(FILES).forEach(k=>delete FILES[k]); P.reset();
  await P.copyFromBytes(workbook({tc:[50000,60000], days:[9,8], year:2027}), {how:'upload', name:'2027.xlsx'});
  r=await P.copyFromBytes(workbook({tc:[0,0], days:[0,0], year:2027, extra:true}), {how:'upload', name:'2027 new layout.xlsx', layoutOnly:true});
  const d27=DB['ph_prod_data_2027'].data['Office (A)'];
  t('keeping the numbers: each moves to the row and month with the same name', d27.C2===60000 && d27.B4===9 && d27.C4===8 && d27.B3===undefined);
  t('...and nothing was left without a place', r.kept && r.kept.moved===4 && r.kept.lost.length===0);
  const L27=await P.log(2027);
  t('the history says the layout changed and the numbers were moved', L27[0].kept.moved===4 && L27[0].from.how==='upload');

  // 6. Years stand alone
  await P.copyFromBytes(workbook({tc:[70000,80000], mult:1.25}), {how:'upload', name:'2026.xlsx'});
  idx=await P.index();
  t('two years are kept side by side', Object.keys(idx.years).sort().join(',')==='2026,2027');
  t('2026 has its own formulas, 2027 keeps its own', (await B.open(FILES['2026 production template.xlsx'])).sheets['Office (A)'].cells.B4.f==='B2*1.25' &&
    (await B.open(FILES['2027 production template.xlsx'])).sheets['Office (A)'].cells.B5.f==='B2*1.1');
  t('...and changing 2026 left 2027\'s numbers alone', DB['ph_prod_data_2027'].data['Office (A)'].C2===60000);
  const ex27=await P.downloadYear(2027), b27=await B.open(ex27.bytes), ev27=B.evaluate(b27);
  t('a year\'s Excel is worked out with that year\'s own formulas', ev27.value('Office (A)','B5')===55000.00000000001 || Math.abs(ev27.value('Office (A)','B5')-55000)<1e-6);

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
