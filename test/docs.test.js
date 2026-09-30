/* DOCUMENTS IN SHAREPOINT, RUN FROM THE HUB - and nothing lost on the way.

       node test/docs.test.js

   30/09/2026. Cory: Heather should create folders from Home-Brace, drag files in, link
   files she already has, and "be able to remove folders she already created". Also:
   "Don't make a mistake take your time" and, from before, never delete data.

   The stand-in SharePoint below keeps a real folder tree, refuses a duplicate folder
   (409) the way SharePoint does, renames a clashing upload, takes big files in pieces,
   pages long folders, answers "busy" when told to, and moves removed items to a recycle
   bin instead of destroying them. These hold docs.js to: never overwrite, never touch
   anything outside "Home-Brace Documents", and un-link rather than delete a file kept
   elsewhere. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const SRC=fs.readFileSync(path.join(__dirname,'..','v1','docs.js'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };

function SharePoint(){
  const sp={items:{}, next:1, calls:[], recycle:[], sessions:{}, shares:{}, perms:{}, fail:[], pageSize:200};
  const root={id:'ROOT', name:'', folder:true, children:[], parent:null};
  sp.items.ROOT=root;
  const kids=it=>it.children.map(id=>sp.items[id]);
  const pathOf=it=>{ const parts=[]; let x=it; while(x && x.id!=='ROOT'){ parts.unshift(x.name); x=sp.items[x.parent]; } return parts.join('/'); };
  const view=it=>{ const par=sp.items[it.parent]; const pp=par.id==='ROOT'?'/drive/root:':'/drive/root:/'+pathOf(par).split('/').map(encodeURIComponent).join('/');
    const v={id:it.id, name:it.name, webUrl:'https://omegaorthodontics.sharepoint.com/sites/Home-Brace/Shared%20Documents/'+encodeURI(pathOf(it)),
      size:it.size||0, lastModifiedDateTime:'2026-09-30T10:00:00Z', lastModifiedBy:{user:{displayName:'Heather Beal'}},
      parentReference:{driveId:'D1', id:par.id, path:pp}};
    if(it.folder) v.folder={childCount:it.children.length}; else v.file={mimeType:it.type||''};
    return v; };
  const find=p=>{ let cur=root; for(const seg of p.split('/').filter(Boolean)){ const k=kids(cur).find(c=>c.name.toLowerCase()===seg.toLowerCase()); if(!k) return null; cur=k; } return cur; };
  const taken=(par,nm)=>kids(par).some(c=>c.name.toLowerCase()===nm.toLowerCase());
  const gone=it=>{ for(let x=it; x && x.id!=='ROOT'; x=sp.items[x.parent]) if(sp.recycle.includes(x)) return true; return false; };   // in the bin, or inside something that is
  const free=(par,nm)=>{ if(!taken(par,nm)) return nm; const d=nm.lastIndexOf('.'), b=d>0?nm.slice(0,d):nm, e=d>0?nm.slice(d):''; for(let n=1;;n++){ const c=b+' '+n+e; if(!taken(par,c)) return c; } };
  sp.add=(par,nm,folder,extra)=>{ const it=Object.assign({id:'I'+(sp.next++), name:nm, parent:par.id, children:[], folder:!!folder}, extra||{}); sp.items[it.id]=it; par.children.push(it.id); return it; };
  sp.find=find; sp.root=root; sp.view=view;
  sp.removeBehind=it=>{ const par=sp.items[it.parent]; par.children=par.children.filter(x=>x!==it.id); sp.recycle.push(it); };   // someone, in SharePoint itself
  const resp=(status,body)=>({status, ok:status<300, json:()=>Promise.resolve(body)});
  sp.fetch=async (url,o)=>{
    const method=(o&&o.method)||'GET', headers=(o&&o.headers)||{};
    sp.calls.push({method,url,headers});
    if(sp.fail.length && sp.fail[0].test(method,url)){ const f=sp.fail.shift(); return resp(f.status,{error:{message:'busy'}}); }
    let m;
    if((m=/^https:\/\/upload\.test\/s\/(\d+)$/.exec(url))){           // an upload session piece
      const s=sp.sessions[m[1]]; const r=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(headers['Content-Range']||'');
      if(r && !s.total) s.total=+r[3];                                 // the size, from the first piece
      if(!r || +r[1]!==s.got || +r[3]!==s.total || o.body.size!==(+r[2]-(+r[1])+1)) return resp(400,{error:{message:'bad range'}});
      s.got=+r[2]+1; s.pieces++;
      if(s.got<s.total) return resp(202,{nextExpectedRanges:[s.got+'-']});
      const it=sp.add(sp.items[s.parent], free(sp.items[s.parent], s.name), false, {size:s.total});
      return resp(201, view(it));
    }
    const u=new URL(url); const p=decodeURIComponent(u.pathname.replace(/^\/v1\.0/,'')); const q=u.searchParams;
    if(p==='/sites/omegaorthodontics.sharepoint.com:/sites/Home-Brace') return resp(200,{id:'site1'});
    if(p==='/sites/site1/drive') return resp(200,{id:'D1', webUrl:'https://omegaorthodontics.sharepoint.com/sites/Home-Brace/Shared%20Documents'});
    if((m=/^\/drives\/D1\/root:\/(.+):\/children$/.exec(p))){
      const it=find(m[1]); if(!it || !it.folder) return resp(404,{error:{message:'itemNotFound'}});
      const all=kids(it).map(view), skip=+(q.get('skip')||0), page=all.slice(skip, skip+sp.pageSize);
      const out={value:page}; if(skip+sp.pageSize<all.length) out['@odata.nextLink']='https://graph.microsoft.com'+u.pathname+'?skip='+(skip+sp.pageSize);
      return resp(200,out);
    }
    if((m=/^\/drives\/D1\/root:\/(.+)$/.exec(p)) && method==='GET'){ const it=find(m[1]); return it?resp(200,view(it)):resp(404,{error:{message:'itemNotFound'}}); }
    if(p==='/drives/D1/root/children' || (m=/^\/drives\/D1\/items\/([^/:]+)\/children$/.exec(p))){
      const par=p==='/drives/D1/root/children'?root:sp.items[m[1]];
      if(!par || gone(par)) return resp(404,{error:{message:'itemNotFound'}});
      if(method==='GET') return resp(200,{value:kids(par).map(view)});
      const b=JSON.parse(o.body);
      if(b['@microsoft.graph.conflictBehavior']!=='fail') return resp(400,{error:{message:'expected fail'}});
      if(taken(par,b.name)) return resp(409,{error:{code:'nameAlreadyExists',message:'exists'}});
      return resp(201, view(sp.add(par,b.name,true)));
    }
    if((m=/^\/drives\/D1\/items\/([^/:]+):\/(.+):\/content$/.exec(p)) && method==='PUT'){
      const par=sp.items[m[1]]; const how=q.get('@microsoft.graph.conflictBehavior');
      if(!par || gone(par)) return resp(404,{error:{message:'itemNotFound'}});
      if(how!=='rename') return resp(400,{error:{message:'expected rename'}});
      const it=sp.add(par, free(par,m[2]), false, {size:o.body.size, type:headers['Content-Type']});
      return resp(201, view(it));
    }
    if((m=/^\/drives\/D1\/items\/([^/:]+):\/(.+):\/createUploadSession$/.exec(p)) && method==='POST'){
      if(!sp.items[m[1]] || gone(sp.items[m[1]])) return resp(404,{error:{message:'itemNotFound'}});
      const b=JSON.parse(o.body); if(!b.item || b.item['@microsoft.graph.conflictBehavior']!=='rename') return resp(400,{error:{message:'expected rename'}});
      const id=String(sp.next++); sp.sessions[id]={parent:m[1], name:m[2], got:0, total:0, pieces:0};
      sp.pendingTotal=id; return resp(200,{uploadUrl:'https://upload.test/s/'+id});
    }
    if((m=/^\/drives\/D1\/items\/([^/:]+)$/.exec(p)) && method==='DELETE'){
      const it=sp.items[m[1]]; if(!it || gone(it)) return resp(404,{error:{message:'itemNotFound'}});
      const par=sp.items[it.parent]; par.children=par.children.filter(x=>x!==it.id); sp.recycle.push(it);   // to the bin, not destroyed
      return {status:204, ok:true, json:()=>Promise.resolve({})};
    }
    if((m=/^\/shares\/([^/]+)\/driveItem$/.exec(p))){ const it=sp.shares[m[1]]; return it?resp(200,it):resp(404,{error:{message:'itemNotFound'}}); }
    if((m=/^\/drives\/([^/]+)\/items\/([^/]+)\/permissions$/.exec(p))){ const pr=sp.perms[m[2]]; return pr instanceof Error?resp(403,{error:{message:'denied'}}):resp(200,{value:pr||[]}); }
    return resp(400,{error:{message:'unexpected '+method+' '+p}});
  };
  return sp;
}
function load(sp){
  const store={data:{}, writes:0,
    get:k=>Promise.resolve(store.data[k]===undefined?null:JSON.parse(JSON.stringify(store.data[k]))),
    update:(k,mut)=>{ const cur=store.data[k]===undefined?undefined:JSON.parse(JSON.stringify(store.data[k])); const nx=mut(cur);
      if(nx===undefined) return Promise.resolve({unchanged:true}); store.data[k]=nx; store.writes++; return Promise.resolve({value:nx}); }};
  const ctx={console,Promise,JSON,Math,Date,Object,Array,String,Number,Error,RegExp,URL,Blob,TextEncoder,btoa,setTimeout,clearTimeout,
    encodeURIComponent,decodeURIComponent,
    PH_AUTH:{token:()=>Promise.resolve('tok')}, PH_STORE:store, fetch:sp.fetch};
  ctx.window=ctx; vm.createContext(ctx); vm.runInContext(SRC,ctx,{filename:'docs.js'});
  ctx.PH_DOCS.setRetryWaits([2,2,2]);
  return {D:ctx.PH_DOCS, store, sp};
}
const file=(name,size,type)=>new File([new Uint8Array(size||10)], name, {type:type||'application/pdf'});
const calls=(sp,re,method)=>sp.calls.filter(c=>re.test(c.url)&&(!method||c.method===method));

(async()=>{
  /* 1. Names SharePoint will take - changed only where it has to be. */
  { const {D}=load(SharePoint());
    t('a forbidden character becomes a dash, the rest of the name stays', D.clean('Invoice: May?.pdf')==='Invoice- May-.pdf');
    t('"Insurance / W-9" is ONE folder, "Insurance - W-9"', D.path('Insurance / W-9')==='Home-Brace Documents/Insurance - W-9');
    t('path() nests section and office', D.path('Office Docs','Carlsbad')==='Home-Brace Documents/Office Docs/Carlsbad');
    t('under() goes several levels down for a dropped folder', D.under('Home-Brace Documents/HR','New Hire/Texas')==='Home-Brace Documents/HR/New Hire/Texas');
    t('a trailing dot or space is dropped (SharePoint refuses them)', D.clean('Notes. ')==='Notes');
    t('a reserved name is made safe, not refused', D.clean('CON')==='_CON');
    t('a very long name is shortened but keeps its extension', (n=>n.length<=200 && /\.docx$/.test(n))(D.clean('x'.repeat(260)+'.docx')));
    t('an empty name is "Untitled", never blank', D.clean('   ')==='Untitled');
    t('a link id is URL-safe base64 behind "u!"', /^u![A-Za-z0-9_-]+$/.test(D.shareId('https://omegaorthodontics.sharepoint.com/:x:/g/personal/heather/EaBc?e=1'))); }

  /* 2. Reading: an unstarted section is simply empty; folders and files come back sorted. */
  { const sp=SharePoint(), {D}=load(sp);
    const r0=await D.list(D.path('HR'));
    t('a section nobody has used yet reads as empty, not an error', r0.missing===true && !r0.files.length && !r0.folders.length);
    const base=sp.add(sp.root,'Home-Brace Documents',true), hr=sp.add(base,'HR',true);
    ['Policy 10.pdf','Policy 2.pdf','.DS_Store','Thumbs.db'].forEach(n=>sp.add(hr,n,false,{size:5}));
    sp.add(hr,'New Hire',true);
    const r=await D.list(D.path('HR'));
    t('folders and files are told apart', r.folders.length===1 && r.folders[0].name==='New Hire');
    t('numbers sort the way people read them (2 before 10)', r.files.map(f=>f.name).join('|')==='Policy 2.pdf|Policy 10.pdf');
    t('Mac and Windows clutter (.DS_Store, Thumbs.db) is not shown', !r.files.some(f=>/DS_Store|Thumbs/.test(f.name)));
    for(let i=0;i<250;i++) sp.add(hr,'Form '+i+'.pdf',false);
    const big=await D.list(D.path('HR'));
    t('a folder with more than one page of files is read to the end (252 files)', big.files.length===252);
    sp.fail.push({test:(m,u)=>/children/.test(u), status:503});
    const again=await D.list(D.path('HR'));
    t('SharePoint busy once: tried again, and the list came back', again.files.length===252);
    t('the site and library are looked up once, then remembered', calls(sp,/\/sites\/omegaorthodontics/).length===1 && calls(sp,/\/sites\/site1\/drive/).length===1); }

  /* 3. Folders: made when needed, never twice, never over a file. */
  { const sp=SharePoint(), {D}=load(sp);
    await D.ensureFolder(D.path('Office Docs','Carlsbad'));
    t('the whole path is made, one level at a time', !!sp.find('Home-Brace Documents/Office Docs/Carlsbad'));
    const n=sp.calls.length; await D.ensureFolder(D.path('Office Docs','Carlsbad'));
    t('asking again costs nothing (remembered)', sp.calls.length===n);
    const {D:D2}=load(sp);                                 // a second person, same moment
    await D2.ensureFolder(D2.path('Office Docs','Carlsbad'));
    t('a folder that already exists is used, not duplicated', sp.find('Home-Brace Documents/Office Docs').children.length===1);
    const hr=sp.add(sp.find('Home-Brace Documents'),'Vendors',false);   // a FILE where a folder should go
    let e=null; try{ await D.ensureFolder(D.path('Vendors')); }catch(x){ e=x; }
    t('a file where the folder should go is reported, never replaced', e && e.blocked===true && sp.items[hr.id]);
    t('every folder is made with conflictBehavior=fail (never replace)', calls(sp,/children$/,'POST').every(c=>true) && !sp.calls.some(c=>/replace/.test(c.url)));
    const made=await D.newFolder(D.path('HR'),'New Hire');
    let dup=null; try{ await D.newFolder(D.path('HR'),'new hire'); }catch(x){ dup=x; }
    t('+ New folder makes it', made && made.name==='New Hire');
    t('the same name twice says so instead of making "New Hire 1"', dup && dup.exists===true && sp.find('Home-Brace Documents/HR').children.length===1); }

  /* 4. Uploading: small in one go, big in pieces, a clash is renamed - never overwritten. */
  { const sp=SharePoint(), {D}=load(sp);
    const a=await D.upload(D.path('HR'), file('Uniform Policy.pdf',100));
    t('a small file lands in its section folder', a.name==='Uniform Policy.pdf' && !!sp.find('Home-Brace Documents/HR/Uniform Policy.pdf'));
    const b=await D.upload(D.path('HR'), file('Uniform Policy.pdf',200));
    t('the same name again arrives as "Uniform Policy 1.pdf" - the first is untouched',
      b.name==='Uniform Policy 1.pdf' && sp.find('Home-Brace Documents/HR/Uniform Policy.pdf').size===100);
    const c=await D.upload(D.path('HR'), file('Invoice: May.pdf',10));
    t('a name SharePoint refuses is cleaned, not rejected', c.name==='Invoice- May.pdf');
    let last=0; const big=file('Handbook.pdf', 11*1024*1024+123);
    const d=await D.upload(D.path('HR'), big, f=>{ last=f; });
    const s=sp.sessions[Object.keys(sp.sessions)[0]];
    t('a big file goes in pieces (3 for 11 MB) and arrives whole', s.pieces===3 && d.size===big.size && d.name==='Handbook.pdf');
    t('progress reaches 100%', last===1);
    t('no Authorization header is sent to the upload session', calls(sp,/upload\.test/).every(x=>!x.headers.Authorization));
    t('uploads never ask to replace', !sp.calls.some(x=>/conflictBehavior=replace/.test(x.url)) && !sp.calls.some(x=>/"replace"/.test(String(x.body||'')))); }

  /* 5. Many files and whole folders; one failure does not stop the rest. */
  { const sp=SharePoint(), {D}=load(sp);
    const entries=[{file:file('a.pdf')},{file:file('.DS_Store')},{dir:'New Hire'},{dir:'New Hire/Texas'},
      {file:file('b.pdf'),dir:'New Hire/Texas'},{dir:'Empty One'},{file:file('c.pdf'),dir:'New Hire'}];
    sp.fail.push({test:(m,u)=>m==='PUT'&&/b\.pdf/.test(u), status:400});
    let lastP=null; const r=await D.uploadAll(D.path('HR'), entries, p=>{ lastP=p; });
    t('a dropped folder keeps its shape (HR/New Hire/Texas)', !!sp.find('Home-Brace Documents/HR/New Hire/Texas'));
    t('an empty folder in the drop is still made', !!sp.find('Home-Brace Documents/HR/Empty One'));
    t('clutter in a dropped folder is skipped', !sp.find('Home-Brace Documents/HR/.DS_Store'));
    t('one file refused, the others still went', r.failed.length===1 && r.failed[0].name==='b.pdf' && r.uploaded.length===2);
    t('progress ends at done = total', lastP && lastP.done===lastP.total && lastP.total===3);
    const fi=D.fromInput([Object.assign(file('x.pdf'),{}), (()=>{ const f=file('y.pdf'); Object.defineProperty(f,'webkitRelativePath',{value:'Policies/2026/y.pdf'}); return f; })()]);
    t('a chosen folder keeps its own name as the first level', fi[0].dir==='' && fi[1].dir==='Policies/2026'); }

  /* 5b. A drop: folders walked; files alone when the browser gives no folder entries. */
  { const {D}=load(SharePoint());
    const fe=(n)=>({isFile:true,isDirectory:false,name:n,file:(ok)=>ok(file(n))});
    const de=(n,kids)=>({isFile:false,isDirectory:true,name:n,createReader:()=>{ let sent=false; return {readEntries:(ok)=>{ const batch=sent?[]:kids; sent=true; setTimeout(()=>ok(batch),0); }}; }});
    const dt={items:[{webkitGetAsEntry:()=>de('Policies',[fe('a.pdf'),de('2026',[fe('b.pdf')])])},{webkitGetAsEntry:()=>fe('c.pdf')}], files:[]};
    const got=await D.fromDrop(dt);
    t('a dropped folder is walked to the bottom', got.some(e=>e.file&&e.file.name==='b.pdf'&&e.dir==='Policies/2026') && got.some(e=>e.dir==='Policies'&&!e.file) && got.some(e=>e.file&&e.file.name==='c.pdf'&&e.dir===''));
    const bare=await D.fromDrop({items:[{webkitGetAsEntry:()=>null}], files:[file('d.pdf')]});
    t('no folder entries from the browser: the plain files still come through', bare.length===1 && bare[0].file.name==='d.pdf'); }

  /* 6. REMOVE: only inside Home-Brace Documents, and only to the recycle bin. */
  { const sp=SharePoint(), {D}=load(sp);
    const base=sp.add(sp.root,'Home-Brace Documents',true), hr=sp.add(base,'HR',true), nh=sp.add(hr,'New Hire',true);
    sp.add(nh,'packet.pdf',false); sp.add(nh,'w4.pdf',false); const deep=sp.add(nh,'Texas',true); sp.add(deep,'tx.pdf',false);
    const other=sp.add(sp.root,'Accounting',true);                       // someone else's folder in the same library
    const n=await D.tally(sp.view(nh));
    t('before removing, it says what is inside (3 files, 1 folder)', n.files===3 && n.folders===1);
    await D.remove(sp.view(nh));
    t('a folder inside a section is removed...', !sp.find('Home-Brace Documents/HR/New Hire'));
    t('...to the recycle bin, contents and all - not destroyed', sp.recycle.some(x=>x.id===nh.id) && sp.items[nh.id].children.length===3);
    const deletes=()=>calls(sp,/./,'DELETE').length, before=deletes();
    let e1=null; try{ await D.remove(sp.view(base)); }catch(x){ e1=x; }
    t('Home-Brace Documents itself can never be removed', e1 && e1.fenced && deletes()===before && !!sp.find('Home-Brace Documents'));
    let e2=null; try{ await D.remove(sp.view(other)); }catch(x){ e2=x; }
    t('a folder outside Home-Brace Documents can never be removed', e2 && e2.fenced && deletes()===before && !!sp.find('Accounting'));
    const onedrive={id:'OD1', name:'2026 PRODUCTION DASHBOARD (New).xlsx', parentReference:{driveId:'HEATHER-OD', path:'/drive/root:/Documents'}};
    let e3=null; try{ await D.remove(onedrive); }catch(x){ e3=x; }
    t('a file in someone\u2019s OneDrive can never be removed from here', e3 && e3.fenced && deletes()===before);
    let e4=null; try{ await D.remove({id:'x'}); }catch(x){ e4=x; }
    t('an item without its location is refused, not guessed at', e4 && e4.fenced && deletes()===before);
    t('looking a folder up never makes it', (await D.item(D.path('Nope')))===null && !sp.find('Home-Brace Documents/Nope'));
    t('looking a folder up finds it with its location', (it=>it && it.id===hr.id && D.insideBase(it,'D1'))(await D.item(D.path('HR'))));
    t('the source has exactly one DELETE, and no permanent delete', (SRC.match(/'DELETE'/g)||[]).length===1 && !/permanentDelete/.test(SRC)); }

  /* 6b. A folder the page already knew was removed since - here, or by someone in
         SharePoint itself. The next upload or new folder finds its way again. */
  { const sp=SharePoint(), {D}=load(sp);
    const base=sp.add(sp.root,'Home-Brace Documents',true); sp.add(base,'HR',true);
    await D.upload(D.path('HR','New Hire','Texas'), file('a.pdf'));
    const nh=sp.find('Home-Brace Documents/HR/New Hire');
    await D.remove(sp.view(nh));
    await D.upload(D.path('HR','New Hire','Texas'), file('b.pdf'));
    t('removed here, then an upload to the same place: the folders are made again and it lands',
      !!sp.find('Home-Brace Documents/HR/New Hire/Texas/b.pdf') && sp.find('Home-Brace Documents/HR/New Hire').id!==nh.id);
    t('...and the removed folder is still whole in the recycle bin', sp.recycle.includes(nh) && sp.items[nh.id].children.length===1);
    sp.removeBehind(sp.find('Home-Brace Documents/HR'));
    await D.upload(D.path('HR','New Hire','Texas'), file('c.pdf'));
    t('removed in SharePoint behind the page’s back: the upload still lands', !!sp.find('Home-Brace Documents/HR/New Hire/Texas/c.pdf'));
    sp.removeBehind(sp.find('Home-Brace Documents/HR'));
    const made=await D.newFolder(D.path('HR','New Hire'), 'Forms');
    t('...and so does a new folder', made && !!sp.find('Home-Brace Documents/HR/New Hire/Forms'));
    sp.removeBehind(sp.find('Home-Brace Documents/HR'));
    const r=await D.uploadAll(D.path('HR'), [{dir:'New Hire'},{file:file('d.pdf'), dir:'New Hire'}]);
    t('...and so does dropping a folder in', !r.failed.length && !!sp.find('Home-Brace Documents/HR/New Hire/d.pdf'));
    t('none of that ever sent a DELETE of its own', calls(sp,/./,'DELETE').length===1); }

  /* 7. Links to files kept elsewhere: checked, saved once, un-linked (never deleted). */
  { const sp=SharePoint(), {D,store}=load(sp);
    let e=null; try{ await D.resolveLink('https://www.dropbox.com/s/abc/file.pdf'); }catch(x){ e=x; }
    t('a link that is not SharePoint/OneDrive is explained without asking Microsoft', e && e.badLink && !calls(sp,/\/shares\//).length);
    const url='https://omegaorthodontics-my.sharepoint.com/:x:/g/personal/heather/EaBc?e=abc';
    const od={id:'OD1', name:'2026 PRODUCTION DASHBOARD (New).xlsx', webUrl:url, parentReference:{driveId:'HEATHER-OD', id:'P', path:'/drive/root:'}};
    sp.shares[D.shareId(url)]=od;
    const item=await D.resolveLink(url);
    t('a OneDrive link resolves to the file', item.name===od.name);
    sp.perms.OD1=[{grantedToV2:{group:{displayName:'Home-Brace Members'}}, roles:['write']}];
    t('shared with the Home-Brace group: everyone can open it', (await D.whoCanOpen(item))===true);
    sp.perms.OD1=[{link:{scope:'organization'}, roles:['read']}];
    t('shared with the whole practice: everyone can open it', (await D.whoCanOpen(item))===true);
    sp.perms.OD1=[{grantedToV2:{user:{displayName:'Jessica Lynch'}}, roles:['write']}];
    t('shared with named people only: says so, so the page can warn', (await D.whoCanOpen(item))===false);
    sp.perms.OD1=new Error('nope');
    t('when the check itself is refused, it says "don\u2019t know", not "fine"', (await D.whoCanOpen(item))===null);
    t('a file already in the Home-Brace library needs no check', (await D.whoCanOpen({id:'z', parentReference:{driveId:'D1'}}))===true);
    let bad=null; try{ await D.resolveLink('https://omegaorthodontics.sharepoint.com/:w:/s/x/nothere'); }catch(x){ bad=x; }
    t('a link to something you cannot see says what to do', bad && bad.badLink && /share the file/.test(bad.message));
    await D.addLink('hr','',item,true,'Heather Beal');
    await D.addLink('hr','',item,true,'Heather Beal');
    const L=await D.links();
    t('the same link twice is one entry', L.length===1 && L[0].name===od.name && L[0].sec==='hr');
    await D.unlink(L[0].id,'Heather Beal');
    const L2=await D.links();
    t('un-linking hides it and keeps the record - nothing deleted', L2.length===1 && L2[0].hidden===true && L2[0].hiddenBy==='Heather Beal');
    await D.addLink('hr','',item,true,'Heather Beal');
    t('linking it again brings it back', (await D.links())[0].hidden===false);
    const w=store.writes; await D.unlink('no-such-link');
    t('un-linking something that is not there writes nothing', store.writes===w); }

  /* 8. "Only certain people": saved for exactly the items, only when it says something. */
  { const sp=SharePoint(), {D,store}=load(sp);
    await D.setAudience(['I1','I2'],{teams:['Office Managers'],offices:['Carlsbad']},'Heather Beal');
    const m=await D.meta();
    t('who can see it is saved for each item', m.I1 && m.I2 && m.I1.teams[0]==='Office Managers' && m.I2.offices[0]==='Carlsbad');
    const w=store.writes; await D.setAudience(['I3'],{teams:[],offices:[]});
    t('"everyone who can open the folder" writes nothing', store.writes===w && !(await D.meta()).I3); }

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('  FAIL  crashed: '+(e&&e.stack||e)); console.log('\n0 passed, 1 failed'); process.exit(1); });
