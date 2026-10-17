/* TC TRACKER STORAGE - its own locked SharePoint list.
       node test/tcstore.test.js

   17/10/2026. Patient details go to "HomeBraceConsults", never to the hub's shared list.
   These checks run tcstore.js against a stand-in SharePoint: the list is found by name,
   every page is read, a save never writes over what it could not read, two saves at once
   both land, and nothing is ever deleted. Made-up records only. */
const ok=[], bad=[];
function t(name, cond){ (cond?ok:bad).push(name); }
const SITE='site1', LIST='L9';

function sharepoint(opts){
  opts=opts||{};
  const sp={items:{}, next:1, calls:[], etagN:1};
  const add=(title, payload)=>{ const id=String(sp.next++); sp.items[id]={id, eTag:'"e'+(sp.etagN++)+'"', fields:{Title:title, Payload:payload}}; return sp.items[id]; };
  sp.add=add;
  const R=(st, b)=>Promise.resolve({ok:st<300, status:st, statusText:'x', json:()=>Promise.resolve(b)});
  sp.fetch=(url, o)=>{
    o=o||{}; const m=o.method||'GET'; sp.calls.push(m+' '+url.replace('https://graph.microsoft.com/v1.0',''));
    const p=url.replace('https://graph.microsoft.com/v1.0','');
    if(m==='DELETE') return R(500, {error:{message:'no deletes expected'}});
    if(p==='/sites/omegaorthodontics.sharepoint.com:/sites/Home-Brace?$select=id') return R(200, {id:SITE});
    if(p==='/sites/'+SITE+'/lists?$select=id,displayName&$top=200')
      return R(200, {value:[{id:'L1', displayName:'HomeBraceData'}].concat(opts.noList?[]:[{id:LIST, displayName:'HomeBraceConsults'}])});
    let mm;
    if((mm=/^\/sites\/site1\/lists\/L9\/items\?\$expand=fields\(\$select=Title,Payload\)&\$top=200(?:&page=(\d))?$/.exec(p))){
      const all=Object.values(sp.items), pg=Number(mm[1]||0), size=2;
      const slice=all.slice(pg*size, pg*size+size), more=all.length>(pg+1)*size;
      return R(200, {value:JSON.parse(JSON.stringify(slice)), '@odata.nextLink': more ? 'https://graph.microsoft.com/v1.0/sites/site1/lists/L9/items?$expand=fields($select=Title,Payload)&$top=200&page='+(pg+1) : undefined});
    }
    if((mm=/^\/sites\/site1\/lists\/L9\/items\/(\d+)\?\$expand=fields\(\$select=Title,Payload\)$/.exec(p))){
      const it=sp.items[mm[1]]; if(!it) return R(404, {error:{message:'gone'}});
      if(opts.raceOnce && !sp.raced){ sp.raced=true; const cur=JSON.parse(it.fields.Payload); cur.consults.other={id:'other', name:'Someone else'}; it.fields.Payload=JSON.stringify(cur); const snap=JSON.parse(JSON.stringify(it)); snap.eTag='"stale"'; return R(200, snap); }
      return R(200, JSON.parse(JSON.stringify(it)));
    }
    if(m==='POST' && p==='/sites/site1/lists/L9/items'){ const b=JSON.parse(o.body); return R(201, add(b.fields.Title, b.fields.Payload)); }
    if(m==='PATCH' && (mm=/^\/sites\/site1\/lists\/L9\/items\/(\d+)\/fields$/.exec(p))){
      const it=sp.items[mm[1]]; const im=o.headers && o.headers['If-Match'];
      if(im && im!==it.eTag) return R(412, {error:{message:'changed since you read it'}});
      it.fields.Payload=JSON.parse(o.body).Payload; it.eTag='"e'+(sp.etagN++)+'"'; return R(200, it.fields);
    }
    return R(400, {error:{message:'unexpected '+m+' '+p}});
  };
  return sp;
}
function fresh(liveSite, sp){
  delete require.cache[require.resolve('../v1/tcstore.js')];
  globalThis.PH={isLive:()=>liveSite};
  globalThis.PH_AUTH={token:()=>Promise.resolve('tok')};
  globalThis.fetch=sp ? sp.fetch : ()=>Promise.reject(new Error('no network in the sandbox'));
  globalThis.PH_STORE={ pack:r=>Promise.resolve(r), unpack:p=>Promise.resolve(p),
    update:(k, mut)=>{ const cur=LS[k]?JSON.parse(LS[k]):undefined; const nx=mut(cur); if(nx!==undefined) LS[k]=JSON.stringify(nx); return Promise.resolve({local:true, value:nx}); } };
  const LS={}; globalThis.localStorage={ get length(){ return Object.keys(LS).length; }, key:i=>Object.keys(LS)[i], getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);} };
  return {S:require('../v1/tcstore.js'), LS};
}
const rec=(id, name)=>({v:1, office:'Hobbs', month:'2026-10', consults:{[id]:{id, name, date:'2026-10-02'}}});
const addConsult=(id, name)=>cur=>{ const v=cur?JSON.parse(JSON.stringify(cur)):{v:1, office:'Hobbs', month:'2026-10', consults:{}}; v.consults[id]={id, name, date:'2026-10-05'}; return v; };

(async()=>{
  /* ---------- reading ---------- */
  { const sp=sharepoint(); sp.add('ph_tclog_hobbs_2026-10', JSON.stringify(rec('a','Ava'))); sp.add('ph_tclog_hobbs_2026-09', JSON.stringify(rec('b','Ben')));
    sp.add('ph_other_key', '{"x":1}'); sp.add('ph_tclog_clovis_2026-10', JSON.stringify(rec('c','Cam')));
    const {S}=fresh(true, sp); const all=await S.getAll('ph_tclog_');
    t('Live: reads only its own list, found by name (not the hub’s shared list)', sp.calls.some(c=>/lists\/L9\/items/.test(c)) && !sp.calls.some(c=>/lists\/L1\//.test(c)));
    t('Live: every page is read', Object.keys(all).length===3 && all['ph_tclog_clovis_2026-10'].consults.c.name==='Cam');
    t('Live: only keys with the prefix', !('ph_other_key' in all)); }
  { const sp=sharepoint(); sp.add('ph_tclog_hobbs_2026-10', JSON.stringify(rec('a','Ava'))); sp.add('ph_tclog_hobbs_2026-10', JSON.stringify(rec('b','Ben')));
    const {S}=fresh(true, sp); const all=await S.getAll('ph_tclog_'); const vals=Object.values(all);
    t('A key saved twice at once (two rows): both are read, nothing lost', vals.length===2 && vals.some(v=>v.consults.a) && vals.some(v=>v.consults.b)); }
  { const sp=sharepoint(); sp.add('ph_tclog_hobbs_2026-10', '{not json');
    const {S}=fresh(true, sp); let err=null; try{ await S.getAll('ph_tclog_'); }catch(e){ err=e; }
    t('A record that can’t be read stops the read and says so (no half tracker)', err && /could not be read/.test(err.message)); }
  { const sp=sharepoint({noList:true}); const {S}=fresh(true, sp); let err=null; try{ await S.getAll('ph_tclog_'); }catch(e){ err=e; }
    t('No list (not set up, or no access): a plain message, nothing else tried', err && /can’t find its SharePoint list/.test(err.message) && !sp.calls.some(c=>/^(POST|PATCH)/.test(c))); }

  /* ---------- saving ---------- */
  { const sp=sharepoint(); const {S}=fresh(true, sp);
    await S.update('ph_tclog_hobbs_2026-10', addConsult('n1','New Patient'));
    const it=Object.values(sp.items)[0];
    t('First consult of a month: the record is created in the TC list', it && it.fields.Title==='ph_tclog_hobbs_2026-10' && JSON.parse(it.fields.Payload).consults.n1.name==='New Patient');
    await S.update('ph_tclog_hobbs_2026-10', addConsult('n2','Second'));
    const p=JSON.parse(Object.values(sp.items)[0].fields.Payload);
    t('Next consult: added to the same record, the first one kept', Object.keys(sp.items).length===1 && p.consults.n1 && p.consults.n2);
    t('Saves say which version they change (If-Match)', sp.calls.some(c=>/^PATCH /.test(c))); }
  { const sp=sharepoint({raceOnce:true}); sp.add('ph_tclog_hobbs_2026-10', JSON.stringify(rec('a','Ava'))); const {S}=fresh(true, sp);
    await S.update('ph_tclog_hobbs_2026-10', addConsult('mine','Mine'));
    const p=JSON.parse(Object.values(sp.items)[0].fields.Payload);
    t('Someone else saved in between: read again, BOTH changes kept', p.consults.a && p.consults.other && p.consults.mine && sp.calls.filter(c=>/^PATCH/.test(c)).length===2); }
  { const sp=sharepoint(); sp.add('ph_tclog_hobbs_2026-10', '{broken'); const {S}=fresh(true, sp);
    let err=null; try{ await S.update('ph_tclog_hobbs_2026-10', addConsult('x','X')); }catch(e){ err=e; }
    t('A record that can’t be read is never written over', err && /was not written over/.test(err.message) && Object.values(sp.items)[0].fields.Payload==='{broken' && !sp.calls.some(c=>/^PATCH/.test(c))); }
  { const sp=sharepoint(); sp.add('ph_tclog_hobbs_2026-10', JSON.stringify(rec('a','Ava'))); const {S}=fresh(true, sp);
    const r=await S.update('ph_tclog_hobbs_2026-10', ()=>undefined);
    t('Nothing to change: nothing written', r.unchanged && !sp.calls.some(c=>/^(PATCH|POST)/.test(c))); }
  { const sp=sharepoint(); const {S}=fresh(true, sp);
    for(let i=0;i<5;i++) await S.update('ph_tclog_hobbs_2026-10', addConsult('k'+i,'P'+i));
    await S.getAll('ph_tclog_');
    t('Nothing is ever deleted', !sp.calls.some(c=>/^DELETE/.test(c))); }

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
