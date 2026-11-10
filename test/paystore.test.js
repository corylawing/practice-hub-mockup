/* PAYROLL STORAGE - its own locked folder, one folder per office.
       node test/paystore.test.js

   01/11/2026, Heather: "We can go live with the payroll sheet." These run paystore.js against a stand-in SharePoint
   library that knows who may open which folder: whoever manages payroll (the whole thing), an office's sender (their
   own office's folder only), and someone with no access. The folders are made by a manager only; a sender is told
   when theirs isn't set up yet; someone without access is told so (never shown an empty sheet); a save never writes
   over what it couldn't read; two saves at once both land; nothing is ever deleted. Made-up people only. */
const ok=[], bad=[];
function t(name, cond){ (cond?ok:bad).push(name); }

function library(opts){
  opts=opts||{};
  const sp={items:{}, next:1, etagN:1, calls:[], who:opts.who||'manager'};
  const add=(parent, name, isFolder, text)=>{ const id=(isFolder?'F':'I')+(sp.next++); sp.items[id]={id, parent, name, folder:isFolder, text, eTag:'"e'+(sp.etagN++)+'"'}; return sp.items[id]; };
  sp.add=add;
  const pathOf=it=>{ const out=[]; let x=it; while(x){ out.unshift(x.name); x=sp.items[x.parent]; } return out; };
  const findPath=parts=>{ let parent=null, it=null; for(const n of parts){ it=Object.values(sp.items).find(x=>x.parent===parent && x.name===n); if(!it) return null; parent=it.id; } return it; };
  /* who may open what: a manager everything; 'sender:<Office>' only that office's folder and what's in it */
  const canSee=it=>{
    if(sp.who==='manager') return true;
    if(sp.who==='none') return false;
    const office=sp.who.split(':')[1], p=pathOf(it);
    return p[0]==='Home-Brace Payroll' && p[1]===office;
  };
  const view=f=>({id:f.id, name:f.name, file:{}, eTag:f.eTag, '@microsoft.graph.downloadUrl':'https://download.test/'+f.id+'?v='+f.eTag});
  const R=(st,b)=>Promise.resolve({ok:st<300, status:st, statusText:'x', json:()=>Promise.resolve(b), text:()=>Promise.resolve(typeof b==='string'?b:JSON.stringify(b))});
  sp.fetch=async (url, o)=>{
    o=o||{}; const m=o.method||'GET';
    if(url.indexOf('https://download.test/')===0){
      const id=url.slice(22).split('?')[0]; sp.calls.push('DOWNLOAD '+id);
      if(o.headers && o.headers.Authorization) return R(400,'no auth header allowed on a download address');
      const f=sp.items[id]; if(!f || !canSee(f)) return R(404,'gone');
      if(opts.unreadable && f.name===opts.unreadable) return R(200,'{not json');
      return R(200, f.text);
    }
    const p=url.replace('https://graph.microsoft.com/v1.0',''); sp.calls.push(m+' '+p);
    if(m==='DELETE') return R(500,{error:{message:'no deletes expected'}});
    if(p==='/sites/omegaorthodontics.sharepoint.com:/sites/Home-Brace?$select=id') return R(200,{id:'S1'});
    if(p==='/sites/S1/drive?$select=id') return R(200,{id:'D1'});
    let mm;
    if((mm=/^\/drives\/D1\/root:\/(.+)\?\$select=id,folder$/.exec(p))){
      const parts=mm[1].split('/').map(decodeURIComponent), it=findPath(parts);
      if(!it) return R(sp.who==='none'?403:404,{error:{message:'itemNotFound'}});
      if(!canSee(it)) return R(sp.who==='none'?403:(parts.length===1?404:403),{error:{message:'accessDenied'}});
      return R(200,{id:it.id, folder:it.folder?{}:undefined});
    }
    if(m==='POST' && (p==='/drives/D1/root/children' || (mm=/^\/drives\/D1\/items\/(F\d+)\/children$/.exec(p)))){
      if(sp.who!=='manager') return R(403,{error:{message:'accessDenied'}});
      const parent=p==='/drives/D1/root/children'?null:mm[1], b=JSON.parse(o.body);
      if(Object.values(sp.items).some(x=>x.parent===parent && x.name===b.name)) return R(409,{error:{message:'nameAlreadyExists'}});
      return R(201,{id:add(parent, b.name, true).id, folder:{}});
    }
    if((mm=/^\/drives\/D1\/items\/(F\d+)\/children\?\$top=200(?:&page=(\d+))?$/.exec(p))){
      const F=sp.items[mm[1]]; if(!F) return R(404,{error:{message:'itemNotFound'}}); if(!canSee(F)) return R(403,{error:{message:'accessDenied'}});
      const all=Object.values(sp.items).filter(x=>x.parent===F.id && !x.folder), pg=Number(mm[2]||0), size=2;
      return R(200,{value:all.slice(pg*size,pg*size+size).map(view), '@odata.nextLink': all.length>(pg+1)*size ? 'https://graph.microsoft.com/v1.0/drives/D1/items/'+F.id+'/children?$top=200&page='+(pg+1) : undefined});
    }
    if((mm=/^\/drives\/D1\/items\/(I\d+)$/.exec(p)) && m==='GET'){
      const f=sp.items[mm[1]]; if(!f) return R(404,{error:{message:'gone'}});
      if(opts.raceOnce && !sp.raced){ sp.raced=true; const before=view(f); const cur=JSON.parse(f.text); cur.rows.other={w1:9}; f.text=JSON.stringify(cur); f.eTag='"e'+(sp.etagN++)+'"'; return R(200, before); }
      return R(200, view(f));
    }
    if(m==='PUT' && opts.busyPuts>0){ opts.busyPuts--; return R(503,{error:{message:'busy'}}); }
    if(m==='PUT' && (mm=/^\/drives\/D1\/items\/(F\d+):\/([^:]+):\/content\?@microsoft\.graph\.conflictBehavior=fail$/.exec(p))){
      const F=sp.items[mm[1]]; if(!canSee(F)) return R(403,{error:{message:'accessDenied'}});
      const name=decodeURIComponent(mm[2]); if(Object.values(sp.items).some(x=>x.parent===F.id && x.name===name)) return R(409,{error:{message:'nameAlreadyExists'}});
      return R(201, view(add(F.id, name, false, await o.body.text())));
    }
    if(m==='PUT' && (mm=/^\/drives\/D1\/items\/(I\d+)\/content$/.exec(p))){
      const f=sp.items[mm[1]]; const im=o.headers && o.headers['If-Match'];
      if(im && im!==f.eTag) return R(412,{error:{message:'changed since you read it'}});
      f.text=await o.body.text(); f.eTag='"e'+(sp.etagN++)+'"';
      return R(200, view(f));
    }
    return R(400,{error:{message:'unexpected '+m+' '+p}});
  };
  sp.file=(office, name)=>{ const F=findPath(['Home-Brace Payroll', office]); const f=F && Object.values(sp.items).find(x=>x.parent===F.id && x.name===name); return f && JSON.parse(f.text); };
  sp.folderAt=parts=>findPath(parts);
  return sp;
}
function fresh(liveSite, sp){
  delete require.cache[require.resolve('../v1/paystore.js')];
  globalThis.PH={isLive:()=>liveSite};
  globalThis.PH_AUTH={token:()=>Promise.resolve('tok')};
  globalThis.fetch=sp ? sp.fetch : ()=>Promise.reject(new Error('no network in the sandbox'));
  const LS={};
  globalThis.localStorage={ get length(){ return Object.keys(LS).length; }, key:i=>Object.keys(LS)[i], getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{ delete LS[k]; } };
  return {P:require('../v1/paystore.js'), LS};
}
const addRow=(id, w1)=>cur=>{ const v=cur?JSON.parse(JSON.stringify(cur)):{v:1, status:'draft', rows:{}}; v.rows[id]={w1}; return v; };

(async()=>{
  /* ---- 1. Whoever manages payroll opens it first: the folders are made ---- */
  {
    const sp=library({who:'manager'}); const {P}=fresh(true, sp);
    const made=await P.ensure(['Carlsbad','Hobbs']);
    t('the manager makes the payroll folder, each office’s and Heather’s', !!sp.folderAt(['Home-Brace Payroll']) && !!sp.folderAt(['Home-Brace Payroll','Carlsbad']) &&
      !!sp.folderAt(['Home-Brace Payroll','Hobbs']) && !!sp.folderAt(['Home-Brace Payroll','Heather']) && Object.keys(made).length===3);
    t('beside Home-Brace Documents, at the top of Documents - never inside it', sp.folderAt(['Home-Brace Payroll']).parent===null);
    await P.ensure(['Carlsbad','Hobbs']);
    t('opening it again makes nothing twice', Object.values(sp.items).filter(x=>x.folder).length===4);
    await P.at('Carlsbad', true).update('sheet_2026-23', addRow('p1', 38));
    const v=await P.at('Carlsbad', true).get('sheet_2026-23');
    t('a sheet is saved in its office’s folder and read back', v && v.rows.p1.w1===38 && sp.file('Carlsbad','sheet_2026-23.json').rows.p1.w1===38);
    t('the Heather folder is just another folder for the manager', (await P.at('Heather', true).update('settings', ()=>({bonus:{p1:150}}))).value.bonus.p1===150);
    t('nothing was ever deleted', !sp.calls.some(c=>/^DELETE/.test(c)));
  }
  /* ---- 2. An office's sender: their own folder, nothing else ---- */
  {
    const sp=library({who:'manager'}); let {P}=fresh(true, sp);
    await P.ensure(['Carlsbad','Hobbs']); await P.at('Hobbs', true).update('sheet_2026-23', addRow('h1', 40));
    sp.who='sender:Carlsbad'; sp.calls=[]; ({P}=fresh(true, sp));
    await P.at('Carlsbad').update('sheet_2026-23', addRow('c1', 36.5));
    t('the Carlsbad sender saves Carlsbad’s sheet', sp.file('Carlsbad','sheet_2026-23.json').rows.c1.w1===36.5);
    t('...and reads it back', (await P.at('Carlsbad').getAll('sheet_'))['sheet_2026-23'].rows.c1.w1===36.5);
    let e=null; try{ await P.at('Hobbs').get('sheet_2026-23'); }catch(x){ e=x; }
    t('another office’s folder: "doesn’t have access", never its sheet', e && e.status===403 && /access to Payroll/.test(e.message));
    e=null; try{ await P.at('Heather').get('settings'); }catch(x){ e=x; }
    t('Heather’s folder: no access for a sender', e && e.status===403);
    t('a sender never makes or deletes a folder', !sp.calls.some(c=>/^POST|^DELETE/.test(c)));
  }
  /* ---- 3. A sender whose office folder isn't there yet ---- */
  {
    const sp=library({who:'manager'}); let {P}=fresh(true, sp);
    await P.ensure(['Hobbs']);
    sp.who='sender:Clovis'; ({P}=fresh(true, sp));
    let e=null; try{ await P.at('Clovis').getAll('sheet_'); }catch(x){ e=x; }
    t('not set up yet: told so (ask whoever manages payroll to open it once)', e && e.status===404 && /isn’t set up yet/.test(e.message));
    e=null; try{ await P.at('Clovis').update('sheet_2026-23', addRow('x', 1)); }catch(x){ e=x; }
    t('...and a save doesn’t pretend to work', e && /isn’t set up yet/.test(e.message) && !sp.folderAt(['Home-Brace Payroll','Clovis']));
  }
  /* ---- 4. Someone with no payroll access at all ---- */
  {
    const sp=library({who:'manager'}); let {P}=fresh(true, sp);
    await P.ensure(['Carlsbad']); await P.at('Carlsbad', true).update('sheet_2026-23', addRow('c1', 30));
    sp.who='none'; ({P}=fresh(true, sp));
    let e=null; try{ await P.at('Carlsbad').getAll('sheet_'); }catch(x){ e=x; }
    t('no access: an error that says so, never an empty payroll', e && e.status===403 && /access to Payroll/.test(e.message));
  }
  /* ---- 5. Two saves at once, a busy SharePoint, a file that can't be read, many files ---- */
  {
    const sp=library({who:'manager', raceOnce:true}); let {P}=fresh(true, sp);
    await P.ensure(['Carlsbad']); await P.at('Carlsbad', true).update('sheet_2026-23', addRow('c1', 30));
    await P.at('Carlsbad', true).update('sheet_2026-23', addRow('c2', 31));
    const f=sp.file('Carlsbad','sheet_2026-23.json');
    t('two saves at once: both land (read again, change again)', f.rows.c1 && f.rows.c2 && f.rows.other);
  }
  {
    const sp=library({who:'manager', busyPuts:2}); const {P}=fresh(true, sp);
    await P.ensure(['Carlsbad']); await P.at('Carlsbad', true).update('people', ()=>({people:[{id:'p1'}]}));
    t('busy SharePoint: tried again, saved', sp.file('Carlsbad','people.json').people[0].id==='p1');
  }
  {
    const sp=library({who:'manager', unreadable:'sheet_2026-22.json'}); const {P}=fresh(true, sp);
    await P.ensure(['Carlsbad']);
    const F=sp.folderAt(['Home-Brace Payroll','Carlsbad']); sp.add(F.id, 'sheet_2026-22.json', false, '{x');
    let e=null; try{ await P.at('Carlsbad', true).update('sheet_2026-22', addRow('c1', 1)); }catch(x){ e=x; }
    t('a sheet that can’t be read is never written over', e && /not written over/.test(e.message) && sp.items[Object.keys(sp.items).find(k=>sp.items[k].name==='sheet_2026-22.json')].text==='{x');
    e=null; try{ await P.at('Carlsbad', true).getAll('sheet_'); }catch(x){ e=x; }
    t('reading every sheet with one broken: an error, not half a payroll', e && e.status===422);
    await P.at('Carlsbad', true).update('sheet_2026-23', addRow('c1', 2));
    const part=await P.at('Carlsbad', true).getAll('sheet_', {partial:true});
    t('...or, when asked, the rest and which one couldn’t be read', part['sheet_2026-23'] && part.unread.join()==='sheet_2026-22' && Object.keys(part).indexOf('unread')<0);
  }
  {
    const sp=library({who:'manager'}); const {P}=fresh(true, sp);
    await P.ensure(['Carlsbad']);
    for(let i=10;i<17;i++) await P.at('Carlsbad', true).update('sheet_2026-'+i, addRow('c'+i, i));
    const all=await P.at('Carlsbad', true).getAll('sheet_');
    t('every page of a long folder is read', Object.keys(all).length===7 && all['sheet_2026-16'].rows.c16.w1===16);
  }
  /* ---- 6. The sandbox: this browser, each office kept apart ---- */
  {
    const {P, LS}=fresh(false, null);
    await P.at('Carlsbad').update('sheet_2026-23', addRow('c1', 30));
    await P.at('Hobbs').update('sheet_2026-23', addRow('h1', 40));
    const c=await P.at('Carlsbad').getAll('sheet_'), h=await P.at('Hobbs').get('sheet_2026-23');
    t('sandbox: saved in this browser', Object.keys(LS).length===2);
    t('sandbox: each office kept apart', Object.keys(c).join()==='sheet_2026-23' && c['sheet_2026-23'].rows.c1 && h.rows.h1 && !h.rows.c1);
    t('sandbox: nothing to write means nothing written', (await P.at('Carlsbad').update('x', ()=>undefined)).unchanged===true && Object.keys(LS).length===2);
    let e=null; try{ P.at('../Hobbs'); }catch(x){ e=x; }
    t('a folder name can’t reach outside Payroll', !!e);
  }
  /* ---- Speed (10/11/2026): the same answers with fewer trips ---- */
  {
    const sp=library({who:'manager'}); let {P}=fresh(true, sp);
    await P.ensure(['Carlsbad','Hobbs']);
    await P.at('Carlsbad', true).update('people', ()=>({people:[{id:'p1'}], docs:[]}));
    await P.at('Carlsbad', true).update('sheet_2026-23', addRow('p1', 38));
    ({P}=fresh(true, sp)); sp.calls=[];
    const [pf, sh]=await Promise.all([P.at('Carlsbad', true).get('people'), P.at('Carlsbad', true).getAll('sheet_')]);
    t('speed: people and sheets read together come back exactly as saved', pf.people[0].id==='p1' && sh['sheet_2026-23'].rows.p1.w1===38);
    t('speed: the folder is listed once for both, not twice', sp.calls.filter(c=>/\/children\?\$top=200$/.test(c)).length===1);
    t('speed: a file is read through the list’s own address - no second trip to ask for it', !sp.calls.some(c=>/^GET \/drives\/D1\/items\/I\d+$/.test(c)));
    ({P}=fresh(true, sp)); sp.calls=[];
    await P.ensure(['Carlsbad','Hobbs']);
    t('speed: the folders are checked together, and opening again makes nothing', Object.values(sp.items).filter(x=>x.folder).length===4 && !sp.calls.some(c=>/^POST/.test(c)));
    ({P}=fresh(true, sp)); sp.calls=[];
    t('speed: warming up only finds the library - no payroll file is touched', (await P.warm())===true && sp.calls.length===2 && sp.calls.every(c=>/^GET \/sites\//.test(c)));
    t('speed: nothing was ever deleted', !sp.calls.some(c=>/^DELETE/.test(c)));
  }
  /* ---- Recent first (10/11/2026, Cory: "make this stable for the future"): Payroll reads the recent pay periods
     when it opens and the older ones only when History needs them - so opening it doesn't slow down as sheets pile up ---- */
  {
    const sp=library({who:'manager'}); let {P}=fresh(true, sp);
    await P.ensure(['Carlsbad']);
    for(const k of ['2026-24','2026-25','2027-01','2027-02']) await P.at('Carlsbad', true).update('sheet_'+k, addRow('c'+k.replace('-',''), 30));
    await P.at('Carlsbad', true).update('people', ()=>({people:[{id:'p1'}], docs:[]}));
    const before=JSON.stringify(Object.values(sp.items).map(x=>[x.name, x.text]));
    const recent=k=>k>='sheet_2027-01', older=k=>!recent(k);
    ({P}=fresh(true, sp)); sp.calls=[];
    const [pf, now]=await Promise.all([P.at('Carlsbad', true).get('people'), P.at('Carlsbad', true).getAll('sheet_', {partial:true, only:recent})]);
    t('recent first: only the pay periods asked for come back', Object.keys(now).sort().join()==='sheet_2027-01,sheet_2027-02' && now['sheet_2027-02'].rows.c202702.w1===30);
    t('recent first: the older sheets are not even opened (2 sheets + people read, not 5 files)', sp.calls.filter(c=>/^DOWNLOAD/.test(c)).length===3 && pf.people[0].id==='p1');
    sp.calls=[];
    const then=await P.at('Carlsbad', true).getAll('sheet_', {partial:true, only:older});
    t('recent first: History gets the older ones, exactly as saved', Object.keys(then).sort().join()==='sheet_2026-24,sheet_2026-25' && then['sheet_2026-24'].rows.c202624.w1===30);
    t('recent first: together they are every sheet, nothing twice', Object.keys(now).concat(Object.keys(then)).sort().join()===Object.keys(await P.at('Carlsbad', true).getAll('sheet_')).sort().join());
    t('recent first: without it, every sheet is read as before', Object.keys(await P.at('Carlsbad', true).getAll('sheet_')).length===4);
    t('recent first: nothing asked for = nothing read, and no error', Object.keys(await P.at('Carlsbad', true).getAll('sheet_', {partial:true, only:()=>false})).length===0);
    t('recent first: a broken chooser reads nothing rather than failing', Object.keys(await P.at('Carlsbad', true).getAll('sheet_', {only:()=>{ throw new Error('x'); }})).length===0);
    t('recent first: reading writes nothing and deletes nothing', JSON.stringify(Object.values(sp.items).map(x=>[x.name, x.text]))===before && !sp.calls.some(c=>/^(PUT|POST|DELETE)/.test(c)));
    const sb=fresh(false, null);
    for(const k of ['2026-24','2027-02']) await sb.P.at('Carlsbad').update('sheet_'+k, addRow('s', 8));
    t('recent first: the sandbox (this browser) chooses the same way', Object.keys(await sb.P.at('Carlsbad').getAll('sheet_', {only:recent})).join()==='sheet_2027-02');
  }
  /* The page side: every screen except History stays inside the recent ten, and History waits for the older ones */
  {
    const src=require('fs').readFileSync(require('path').join(__dirname,'..','v1','payroll.html'),'utf8');
    const backs=[...src.matchAll(/CUR-(\d+)/g)].map(m=>+m[1]);
    t('recent first: the recent ten are CUR-9 on, and no screen but History reaches further back', /const RECENT=CUR-9;/.test(src) && Math.max(...backs)===9);
    t('recent first: opening Payroll reads only the recent sheets and columns', /getAll\('sheet_', \{partial:true, only:isRecent\}\)/.test(src) && /getAll\('cols_', \{partial:true, only:isRecent\}\)/.test(src));
    t('recent first: History reads the older ones, sheets before Heather’s columns', /only:isOlder\}\)\)\),\s*store\('_h'\)\.getAll\('cols_', \{partial:true, only:isOlder\}\)/.test(src) && /perOffice\.forEach\(\(sh, i\)=>takeSheets\(offs\[i\], sh, miss\)\);\s*takeCols\(cols, miss\);/.test(src));
    t('recent first: an older row has no Open button until it is read', /if\(waiting\(n\)\)\{[^\n]*Loading…[^\n]*continue; \}/.test(src) && !/if\(waiting\(n\)\)\{[^\n]*data-act="open"/.test(src));
    t('recent first: a sender never reads the older ones (no History)', /const hasOlder=\(\)=>LIVEPAY && LIVE\.ready && LEVEL\(\)!=='send' && RECENT>FIRST_N;/.test(src));
  }
  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
