/* TC TRACKER STORAGE - its own locked folder.
       node test/tcstore.test.js

   17/10/2026. Patient details go to files in "Home-Brace TC Tracker" (one per office-month),
   never to the hub's shared list. These checks run tcstore.js against a stand-in SharePoint
   document library: the folder is found (or made the first time), every page of it is read,
   someone without access is told so (not shown an empty tracker), a save never writes over
   what it could not read, two saves at once both land, and nothing is ever deleted.
   Made-up records only. */
const ok=[], bad=[];
function t(name, cond){ (cond?ok:bad).push(name); }
const FOLDER_URL='/drives/D1/root:/Home-Brace%20TC%20Tracker?$select=id,folder';

function library(opts){
  opts=opts||{};
  const sp={files:{}, folder:opts.noFolder||opts.hidden||opts.madeMeanwhile ? null : 'F1', next:1, etagN:1, calls:[]};
  const add=(name, text)=>{ const id='I'+(sp.next++); sp.files[id]={id, name, text, eTag:'"e'+(sp.etagN++)+'"'}; return sp.files[id]; };
  sp.add=add;
  const view=f=>({id:f.id, name:f.name, file:{}, eTag:f.eTag, '@microsoft.graph.downloadUrl':'https://download.test/'+f.id+'?v='+f.eTag});
  const R=(st,b)=>Promise.resolve({ok:st<300, status:st, statusText:'x', json:()=>Promise.resolve(b), text:()=>Promise.resolve(typeof b==='string'?b:JSON.stringify(b))});
  sp.fetch=async (url, o)=>{
    o=o||{}; const m=o.method||'GET';
    if(url.indexOf('https://download.test/')===0){
      sp.calls.push('DOWNLOAD '+url.slice(22).split('?')[0]);
      if(o.headers && o.headers.Authorization) return R(400,'no auth header allowed on a download address');
      const f=sp.files[url.slice(22).split('?')[0]]; return f ? R(200, f.text) : R(404,'gone');
    }
    const p=url.replace('https://graph.microsoft.com/v1.0',''); sp.calls.push(m+' '+p);
    if(m==='DELETE') return R(500,{error:{message:'no deletes expected'}});
    if(p==='/sites/omegaorthodontics.sharepoint.com:/sites/Home-Brace?$select=id') return R(200,{id:'S1'});
    if(p==='/sites/S1/drive?$select=id') return R(200,{id:'D1'});
    if(p===FOLDER_URL){ if(opts.denied) return R(403,{error:{message:'accessDenied'}}); return sp.folder ? R(200,{id:sp.folder, folder:{}}) : R(404,{error:{message:'itemNotFound'}}); }
    if(m==='POST' && p==='/drives/D1/root/children'){
      if(opts.hidden) return R(409,{error:{message:'nameAlreadyExists'}});
      if(opts.madeMeanwhile){ sp.folder='F1'; return R(409,{error:{message:'nameAlreadyExists'}}); }   // someone else made it first
      sp.folder='F1'; return R(201,{id:'F1', folder:{}}); }
    let mm;
    if((mm=/^\/drives\/D1\/items\/F1\/children\?\$top=200(?:&page=(\d))?$/.exec(p))){
      const all=Object.values(sp.files), pg=Number(mm[1]||0), size=2;
      return R(200,{value:all.slice(pg*size,pg*size+size).map(view), '@odata.nextLink': all.length>(pg+1)*size ? 'https://graph.microsoft.com/v1.0/drives/D1/items/F1/children?$top=200&page='+(pg+1) : undefined});
    }
    if((mm=/^\/drives\/D1\/items\/(I\d+)$/.exec(p)) && m==='GET'){
      const f=sp.files[mm[1]]; if(!f) return R(404,{error:{message:'gone'}});
      if(opts.raceOnce && !sp.raced){ sp.raced=true; const cur=JSON.parse(f.text); cur.consults.other={id:'other', name:'Someone else'}; const before=view(f); f.text=JSON.stringify(cur); f.eTag='"e'+(sp.etagN++)+'"'; return R(200, before); }
      return R(200, view(f));
    }
    if(m==='PUT' && (mm=/^\/drives\/D1\/items\/F1:\/([^:]+):\/content\?@microsoft\.graph\.conflictBehavior=fail$/.exec(p))){
      const name=decodeURIComponent(mm[1]); if(Object.values(sp.files).some(f=>f.name===name)) return R(409,{error:{message:'nameAlreadyExists'}});
      return R(201, view(add(name, await o.body.text())));
    }
    if(m==='PUT' && (mm=/^\/drives\/D1\/items\/(I\d+)\/content$/.exec(p))){
      const f=sp.files[mm[1]]; const im=o.headers && o.headers['If-Match'];
      if(im && im!==f.eTag) return R(412,{error:{message:'changed since you read it'}});
      f.text=await o.body.text(); f.eTag='"e'+(sp.etagN++)+'"'; return R(200, view(f));
    }
    return R(400,{error:{message:'unexpected '+m+' '+p}});
  };
  return sp;
}
function fresh(liveSite, sp){
  delete require.cache[require.resolve('../v1/tcstore.js')];
  globalThis.PH={isLive:()=>liveSite};
  globalThis.PH_AUTH={token:()=>Promise.resolve('tok')};
  globalThis.fetch=sp ? sp.fetch : ()=>Promise.reject(new Error('no network in the sandbox'));
  const LS={};
  globalThis.PH_STORE={ update:(k, mut)=>{ const cur=LS[k]?JSON.parse(LS[k]):undefined; const nx=mut(cur); if(nx!==undefined) LS[k]=JSON.stringify(nx); return Promise.resolve({local:true, value:nx}); } };
  globalThis.localStorage={ get length(){ return Object.keys(LS).length; }, key:i=>Object.keys(LS)[i], getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);} };
  return {S:require('../v1/tcstore.js'), LS};
}
const rec=(id, name)=>JSON.stringify({v:1, office:'Hobbs', month:'2026-10', consults:{[id]:{id, name, date:'2026-10-02'}}});
const addConsult=(id, name)=>cur=>{ const v=cur?JSON.parse(JSON.stringify(cur)):{v:1, office:'Hobbs', month:'2026-10', consults:{}}; v.consults[id]={id, name, date:'2026-10-05'}; return v; };
const content=(sp,name)=>{ const f=Object.values(sp.files).find(x=>x.name===name); return f && JSON.parse(f.text); };

(async()=>{
  /* ---------- reading ---------- */
  { const sp=library(); sp.add('ph_tclog_hobbs_2026-10.json', rec('a','Ava')); sp.add('ph_tclog_hobbs_2026-09.json', rec('b','Ben'));
    sp.add('notes.txt','hello'); sp.add('ph_tclog_clovis_2026-10.json', rec('c','Cam'));
    const {S}=fresh(true, sp); const all=await S.getAll('ph_tclog_');
    t('Live: reads the TC Tracker folder only, every page of it', Object.keys(all).length===3 && all['ph_tclog_clovis_2026-10'].consults.c.name==='Cam');
    t('Live: only its own files (.json with the prefix)', !('notes' in all) && !Object.keys(all).some(k=>/notes/.test(k)));
    t('Files are read through their download address, with no sign-in header (the browser way)', sp.calls.filter(c=>/^DOWNLOAD/.test(c)).length===3);
    t('Never the hub’s shared list', !sp.calls.some(c=>/\/lists\//.test(c))); }
  { const sp=library(); sp.add('ph_tclog_hobbs_2026-10.json', '{not json');
    const {S}=fresh(true, sp); let err=null; try{ await S.getAll('ph_tclog_'); }catch(e){ err=e; }
    t('A file that can’t be read stops the read and says so (no half tracker)', err && /could not be read/.test(err.message)); }
  { const sp=library({noFolder:true}); const {S}=fresh(true, sp); const all=await S.getAll('ph_tclog_');
    t('First use: the folder is made, the tracker starts empty', sp.folder==='F1' && Object.keys(all).length===0 && sp.calls.some(c=>c==='POST /drives/D1/root/children')); }
  { const sp=library({hidden:true}); const {S}=fresh(true, sp); let err=null; try{ await S.getAll('ph_tclog_'); }catch(e){ err=e; }
    t('Locked and not given access: told so - never an empty tracker', err && err.status===403 && /doesn’t have access/.test(err.message)); }
  { const sp=library({denied:true}); const {S}=fresh(true, sp); let err=null; try{ await S.getAll('ph_tclog_'); }catch(e){ err=e; }
    t('SharePoint says "access denied": the same plain message', err && err.status===403 && /doesn’t have access/.test(err.message)); }
  { const sp=library({madeMeanwhile:true}); sp.add('ph_tclog_hobbs_2026-10.json', rec('a','Ava')); const {S}=fresh(true, sp);
    const all=await S.getAll('ph_tclog_');
    t('Two people open the tracker for the very first time together: the second just uses the folder the first made',
      all['ph_tclog_hobbs_2026-10'].consults.a.name==='Ava' && sp.calls.filter(c=>c==='GET '+FOLDER_URL).length===2); }

  /* ---------- saving ---------- */
  { const sp=library(); const {S}=fresh(true, sp);
    await S.update('ph_tclog_hobbs_2026-10', addConsult('n1','New Patient'));
    t('First consult of a month: its file is created (and would refuse to replace one made a moment ago)',
      content(sp,'ph_tclog_hobbs_2026-10.json').consults.n1.name==='New Patient' && sp.calls.some(c=>/conflictBehavior=fail/.test(c)));
    await S.update('ph_tclog_hobbs_2026-10', addConsult('n2','Second'));
    const c=content(sp,'ph_tclog_hobbs_2026-10.json');
    t('Next consult: added to the same file, the first kept', Object.keys(sp.files).length===1 && c.consults.n1 && c.consults.n2);
    t('Saves say which version they change (If-Match)', sp.calls.some(c=>/^PUT \/drives\/D1\/items\/I\d+\/content$/.test(c))); }
  { const sp=library(); const {S}=fresh(true, sp);
    // Two people create the same month at once: the second is refused, reads the first's, adds its own.
    sp.add('ph_tclog_hobbs_2026-11.json', rec('first','First in'));
    await S.update('ph_tclog_hobbs_2026-11', addConsult('second','Second in'));
    const c=content(sp,'ph_tclog_hobbs_2026-11.json');
    t('Same month started by two people at once: both kept', c.consults.first && c.consults.second && Object.keys(sp.files).length===1); }
  { const sp=library({raceOnce:true}); sp.add('ph_tclog_hobbs_2026-10.json', rec('a','Ava')); const {S}=fresh(true, sp);
    await S.update('ph_tclog_hobbs_2026-10', addConsult('mine','Mine'));
    const c=content(sp,'ph_tclog_hobbs_2026-10.json');
    t('Someone else saved in between: read again, BOTH changes kept', c.consults.a && c.consults.other && c.consults.mine); }
  { const sp=library(); sp.add('ph_tclog_hobbs_2026-10.json', '{broken'); const {S}=fresh(true, sp);
    let err=null; try{ await S.update('ph_tclog_hobbs_2026-10', addConsult('x','X')); }catch(e){ err=e; }
    t('A file that can’t be read is never written over', err && /was not written over/.test(err.message) &&
      Object.values(sp.files)[0].text==='{broken' && !sp.calls.some(c=>/^PUT/.test(c))); }
  { const sp=library(); sp.add('ph_tclog_hobbs_2026-10.json', rec('a','Ava')); const {S}=fresh(true, sp);
    const r=await S.update('ph_tclog_hobbs_2026-10', ()=>undefined);
    t('Nothing to change: nothing written', r.unchanged && !sp.calls.some(c=>/^PUT/.test(c))); }
  { const sp=library(); const {S}=fresh(true, sp);
    for(let i=0;i<5;i++) await S.update('ph_tclog_hobbs_2026-10', addConsult('k'+i,'P'+i));
    await S.getAll('ph_tclog_');
    t('Nothing is ever deleted', !sp.calls.some(c=>/^DELETE/.test(c)) && Object.keys(content(sp,'ph_tclog_hobbs_2026-10.json').consults).length===5); }

  /* ---------- sandbox ---------- */
  { const {S, LS}=fresh(false, null);
    await S.update('ph_tclog_hobbs_2026-10', addConsult('s1','Sandbox'));
    const all=await S.getAll('ph_tclog_');
    t('Sandbox: the browser only, through PH_STORE - no network', all['ph_tclog_hobbs_2026-10'].consults.s1.name==='Sandbox' && JSON.parse(LS['ph_tclog_hobbs_2026-10']).consults.s1); }

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})();
