/* THE SANDBOX NEVER OPENS THE PRACTICE'S WORKBOOK.
       node test/sandboxwb.test.js

   13/10/2026. Cory: the sandbox (GitHub) must not show the real numbers or be connected to
   the excel - "be sure to not screw up anything in production or sandbox". It was
   connected: signed in, the sandbox dashboard read Heather's file and the sandbox's Enter
   Production could write to it. These checks hold both halves: the sandbox cannot reach the
   file at all, and the real site (and the server) still reads and writes it exactly as
   before. No real figures anywhere in here. */
const fs=require('fs'), path=require('path');
const V1=path.join(__dirname,'..','v1');
const W=require('../v1/workbook.js');
const ok=[], bad=[];
function t(name, cond){ (cond?ok:bad).push(name); }

function as(host, search, ph){
  if(host===null) delete globalThis.location; else globalThis.location={hostname:host, search:search||''};
  if(ph===undefined) delete globalThis.PH; else globalThis.PH=ph;
}
const LIVE='kind-hill-00da87410.3.azurestaticapps.net', SANDBOX='corylawing.github.io';

(async function(){
  /* ---------- which site is which ---------- */
  as(null);                     t('Node (the server, these tests) is never the sandbox', W.sandbox()===false);
  as(LIVE);                     t('The Azure site is live', W.sandbox()===false);
  as('hub.example.com');        t('A hub.* domain is live', W.sandbox()===false);
  as(SANDBOX);                  t('GitHub is the sandbox', W.sandbox()===true);
  as('localhost');              t('A local copy is the sandbox', W.sandbox()===true);
  as('localhost', '?env=live'); t('?env=live is live, as in user.js', W.sandbox()===false);
  as(SANDBOX, '', {env:()=>'live'});   t('A page with user.js follows PH.env()', W.sandbox()===false);
  as(LIVE, '', {env:()=>'sandbox'});   t('...both ways', W.sandbox()===true);

  /* ---------- the sandbox cannot read or write the file ---------- */
  let graphCalls=0, fetches=0, tokens=0;
  const graph=()=>{ graphCalls++; return Promise.resolve({lastModifiedDateTime:'x', values:[]}); };
  const token=()=>{ tokens++; return Promise.resolve('tok'); };
  globalThis.fetch=()=>{ fetches++; return Promise.resolve({ok:true, status:200, json:()=>Promise.resolve({})}); };

  as(SANDBOX);
  let err=null; try{ await W.load(graph, 'drive', 'item'); }catch(e){ err=e; }
  t('Sandbox: reading the workbook is refused, and says why', err && err.sandbox===true && /sandbox/i.test(err.message));
  t('Sandbox: Microsoft is never even asked', graphCalls===0);
  err=null; try{ await W.writeCell(token, 'drive', 'item', 'Hobbs', 'tc', 9, 123); }catch(e){ err=e; }
  t('Sandbox: writing a cell is refused', !!err);
  try{ await W.readCell(token, 'drive', 'item', 'Hobbs', 'tc', 9); }catch(_){}
  try{ await W.roundTrip(token, 'drive', 'item', 'Hobbs', 9); }catch(_){}
  try{ await W.openSession(token, 'drive', 'item'); }catch(_){}
  t('Sandbox: no write, read-back, round trip or session ever reaches Microsoft', fetches===0 && tokens===0);

  /* ---------- the real site and the server still read it ---------- */
  as(LIVE);
  let res=null; try{ res=await W.load(graph, 'drive', 'item'); }catch(e){ res=e; }
  t('Live: the workbook is read as before', graphCalls>0 && res && res.offices && !res.demo);
  as(null);
  const before=graphCalls; try{ await W.load(graph, 'drive', 'item'); }catch(_){}
  t('Server (Node): the workbook is read as before', graphCalls>before);
  as(LIVE); const f0=fetches;
  try{ await W.openSession(token, 'drive', 'item', true); }catch(_){}
  t('Live: writing still goes to Microsoft', fetches>f0);

  /* ---------- the sandbox's made-up numbers ---------- */
  const d1=W.demo(new Date(2026,9,13)), d2=W.demo(new Date(2026,9,13));
  t('Made-up numbers: the same for everyone', JSON.stringify(d1)===JSON.stringify(d2) && d1.demo===true);
  t('Made-up numbers: all eight offices', Object.keys(d1.offices).length===8 && Object.keys(W.TABS).every(k=>d1.offices[k]));
  // The same fields the real reader returns, so the pages run the same code on both sites.
  const realShape=Object.keys(W.office([], false)).sort().join(','), demoShape=Object.keys(d1.offices.Hobbs).sort().join(',');
  t('Made-up numbers: exactly the real reader’s shape', realShape===demoShape);
  const series=['act','goal','stretch','ly','sAct','sGoal','mdStarts','lyStarts','days','done','tc','adj'];
  t('Made-up numbers: twelve real numbers in every series', Object.values(d1.offices).every(o=>series.every(k=>o[k].length===12 && o[k].every(Number.isFinite))));
  t('Made-up numbers: months not here yet are empty', Object.values(d1.offices).every(o=>o.act[11]===0 && o.done[11]===0));
  t('Made-up numbers: Medicaid only where the practice has it', Object.keys(d1.offices).every(k=>!!W.MEDICAID[k] || (d1.offices[k].fee===0 && d1.offices[k].mdStarts.every(x=>x===0))));

  /* ---------- the pages ---------- */
  const read=f=>fs.readFileSync(path.join(V1,f),'utf8');
  const idx=read('index.html'), prod=read('production.html'), conn=read('connect.html');
  const zerosOnly=src=>!/\b(act|goal|stretch|ly|sAct|sGoal|mdStarts|lyStarts|days|done|tc|mds|adj|dys|str):\[[^\]]*[1-9][^\]]*\]/.test(src);
  const base=prod.slice(prod.indexOf('const BASE={'), prod.indexOf('\n  };', prod.indexOf('const BASE={')));
  t('Enter Production’s public file holds no figures (placeholders all 0)', base.length>100 && zerosOnly(base));
  const offs=idx.slice(idx.indexOf('const OFFICES=['), idx.indexOf('];', idx.indexOf('const OFFICES=[')));
  t('The dashboard’s public file holds no figures', offs.length>100 && zerosOnly(offs));
  const hyd=src=>src.slice(src.indexOf('async function hydrate(){'));
  t('Dashboard: the sandbox branch comes before the workbook is read', hyd(idx).indexOf('PH_WB.demo()')>0 && hyd(idx).indexOf('PH_WB.demo()')<hyd(idx).indexOf('PH_WB.load('));
  t('Enter Production: the sandbox branch comes before the workbook is read', hyd(prod).indexOf('PH_WB.demo()')>0 && hyd(prod).indexOf('PH_WB.demo()')<hyd(prod).indexOf('PH_WB.load('));
  const push=prod.slice(prod.indexOf('async function pushToWorkbook(){'));
  t('Enter Production: Save on the sandbox stops before any write', push.indexOf('PH.isLive()')>0 && push.indexOf('PH.isLive()')<push.indexOf('PH_WB.writeCell'));
  t('The setup-check page refuses the file’s cells on the sandbox', /if \(SANDBOX && /.test(conn) && conn.indexOf('var SANDBOX')<conn.indexOf('async function graph(path)'));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})();
