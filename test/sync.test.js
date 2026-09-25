/* SAVING THROUGH SHAREPOINT'S LIMITS - AND NEVER LOSING WHAT IS HELD.

       node test/sync.test.js
       STORE=/path/to/an/older/store.js node test/sync.test.js    (shows what it catches)

   25/09/2026. Heather, entering 2027 doctor dates: "Your change was not saved for
   anyone else", several times. The whole schedule is one SharePoint list item, and a
   "Multiple lines of text" column holds 63,999 characters. Most of 2026 is ~60,000, so
   2027 took it over and every save bounced. The stand-in SharePoint below refuses a
   payload over that limit the way the real one does, answers "busy" when told to, and
   keeps a version history with authors - which is what store.js combines held changes
   against. Cory, same day: "Do not delete any data on the schedule." Several checks
   below exist only to hold store.js to that. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const SRC=fs.readFileSync(process.env.STORE || path.join(__dirname,'..','v1','store.js'),'utf8');
const LIMIT=63999;

const clone=v=>JSON.parse(JSON.stringify(v));
function same(a,b){
  if(a===b) return true;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object') return false;
  if(Array.isArray(a)!==Array.isArray(b)) return false;
  const ka=Object.keys(a), kb=Object.keys(b); if(ka.length!==kb.length) return false;
  return ka.every(k=>Object.prototype.hasOwnProperty.call(b,k) && same(a[k],b[k]));
}

function SharePoint(){
  const sp={items:[], next:1, inflight:{}, peak:{}, writes:0, attempts:0, fail:[], delay:0};
  const stamp=(it,by)=>{ it.at=new Date(Date.now()+sp.next*10+it.versions.length).toISOString();
    it.versions.unshift({id:(it.versions.length+1)+'.0', lastModifiedDateTime:it.at,
      lastModifiedBy:{user:{email:by.email, displayName:by.displayName}}, fields:{Payload:it.Payload}}); };
  sp.add=(Title,value,by)=>{ const it={id:String(sp.next++), Title, versions:[],
    Payload:typeof value==='string'?value:JSON.stringify(value)};
    stamp(it, by||{email:'seed@x.com',displayName:'Seed'}); sp.items.push(it); return it; };
  sp.payload=t=>{ const i=sp.items.find(x=>x.Title===t); return i?i.Payload:null; };
  const err=(st,msg)=>Object.assign(new Error('Graph '+st+': '+msg),{status:st});
  sp.graph=()=>async p=>{
    const f=sp.fail.length&&sp.fail[0].on==='read'?sp.fail.shift():null;
    if(f) throw err(f.status,'busy');
    if(/\/sites\/omega/.test(p)) return {id:'site'};
    if(/\/lists\?/.test(p)) return {value:[{id:'L',displayName:'HomeBraceData'}]};
    let m;
    if((m=/\/items\/(\d+)\/versions/.exec(p))){ const it=sp.items.find(i=>i.id===m[1]); return {value:it?it.versions.slice(0,10):[]}; }
    if((m=/\/items\/(\d+)\?/.exec(p))){ const it=sp.items.find(i=>i.id===m[1]); if(!it) throw err(404,'not found');
      return {id:it.id, lastModifiedDateTime:it.at, fields:{Title:it.Title, Payload:it.Payload}}; }
    if(/\/items\?/.test(p)){
      const skip=Number((/skip=(\d+)/.exec(p)||[])[1]||0);
      const r={value:sp.items.slice(skip,skip+200).map(i=>({id:i.id,lastModifiedDateTime:i.at,fields:{Title:i.Title,Payload:i.Payload}}))};
      if(skip+200<sp.items.length) r['@odata.nextLink']='https://graph.microsoft.com/v1.0/sites/site/lists/L/items?$expand=fields&$top=200&skip='+(skip+200);
      return r;
    }
    throw new Error('unexpected read '+p);
  };
  const resp=(status,body,ra)=>({status, ok:status<300, headers:{get:h=>(h==='Retry-After'&&ra!=null)?String(ra):null},
    json:()=>Promise.resolve(body)});
  sp.fetch=who=>async (url,o)=>{
    const b=JSON.parse(o.body), m=/\/items\/(\d+)\/fields/.exec(url);
    const target=m?sp.items.find(i=>i.id===m[1]):null, title=target?target.Title:(b.fields&&b.fields.Title);
    sp.attempts++;
    sp.inflight[title]=(sp.inflight[title]||0)+1; sp.peak[title]=Math.max(sp.peak[title]||0,sp.inflight[title]);
    try{
      if(sp.delay) await new Promise(r=>setTimeout(r,sp.delay));
      const f=sp.fail.length&&sp.fail[0].on==='write'?sp.fail.shift():null;
      if(f){ if(f.then) f.then(); return resp(f.status,{error:{message:f.msg||'busy'}},f.retryAfter); }
      const pay=m?b.Payload:b.fields.Payload;
      if(pay.length>LIMIT) return resp(400,{error:{code:'invalidRequest',message:'The field Payload is too long.'}});
      sp.writes++;
      if(m){ if(!target) return resp(404,{error:{message:'not found'}}); target.Payload=pay; stamp(target,who); return resp(200,{}); }
      const it={id:String(sp.next++),Title:title,Payload:pay,versions:[]}; stamp(it,who); sp.items.push(it);
      return resp(201,{id:it.id});
    } finally { sp.inflight[title]--; }
  };
  return sp;
}

function Browser(sp,who){
  const LS={}, events=[];
  const ctx={console,Promise,JSON,Math,Date,Object,Array,String,Number,Error,RegExp,TypeError,Uint8Array,
    Blob,Response,CompressionStream,DecompressionStream,btoa,atob,setTimeout,clearTimeout,
    localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]},
      key:i=>Object.keys(LS)[i], get length(){ return Object.keys(LS).length; }},
    document:{addEventListener(){},dispatchEvent:e=>{events.push(e);return true;}},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    PH:{isLive:()=>true},
    PH_AUTH:{account:{username:who.email,name:who.displayName},token:()=>Promise.resolve('t'),graph:sp.graph(who)},
    fetch:sp.fetch(who)};
  ctx.window=ctx; ctx.globalThis=ctx;
  vm.createContext(ctx); vm.runInContext(SRC,ctx,{filename:'store.js'});
  const S=ctx.PH_STORE;
  if(S.setRetryWaits) S.setRetryWaits([2,2,2]);
  if(S.setAutoResend) S.setAutoResend(false);
  const failedBanners=()=>events.filter(e=>e.type==='ph-save-failed');
  return {S,LS,events,failedBanners};
}
// An older store.js has no resend(); the nearest it has is reading the key again.
const resend=B=>B.S.resend ? B.S.resend()
  : Promise.all(Object.keys(B.LS).filter(k=>/__unsent$/.test(k)).map(k=>B.S.get(k.slice(0,-8))));
const unpacked=async (B,t,sp)=>{ const p=sp.payload(t); return JSON.parse(B.S.unpack?await B.S.unpack(p):p); };

// A year shaped exactly as schedule.html stores it: sched['YYYY-MM-DD'][office] = cell.
const OFF=['Carlsbad','Clovis','Hobbs','San Angelo','Lubbock','Mansfield','Cruces LCO','Cruces FFO'];
function year(y,fill,seed){
  let r=seed||7; const rnd=()=>{ r=(r*1103515245+12345)%2147483648; return r/2147483648; };
  const out={};
  for(let d=new Date(Date.UTC(y,0,1)); d.getUTCFullYear()===y; d.setUTCDate(d.getUTCDate()+1)){
    const w=d.getUTCDay(); if(w===0||w===6) continue;
    const k=d.toISOString().slice(0,10), day={};
    OFF.forEach(o=>{ if(rnd()>fill) return; const x=rnd();
      if(x<0.62) day[o]={ps:[Math.floor(rnd()*6)],s:450+30*Math.floor(rnd()*3),e:1020+30*Math.floor(rnd()*3)};
      else if(x<0.8) day[o]={closed:true}; else if(x<0.92) day[o]={ydot:true};
      else day[o]={ps:[Math.floor(rnd()*6)],s:480,e:1080,event:'Promo Day'}; });
    if(Object.keys(day).length) out[k]=day;
  }
  return out;
}
const H={email:'heather@farnsworthorthodontics.com',displayName:'Heather Beal'};
const J={email:'jenny@lascrucessmiles.com',displayName:'Jenny Whitefield'};

const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };

(async()=>{
  /* ---- 1. HEATHER'S SESSION, REPLAYED ------------------------------------------ */
  {
    const sp=SharePoint();
    const y26=Object.assign({__v:2},year(2026,0.75,11));   // ~61,000 characters: saves fine on its own
    t('(setup) most of 2026 is close to the column limit', JSON.stringify(y26).length>55000 && JSON.stringify(y26).length<LIMIT);
    sp.add('ph_sched2',y26,H);
    const A=Browser(sp,H);
    await A.S.get('ph_sched2');
    const y27=year(2027,0.3,12);
    const r=await A.S.update('ph_sched2',remote=>Object.assign({},remote,y27));
    const want=Object.assign({},y26,y27);
    t('(setup) 2026 plus some of 2027, as plain JSON, is over the limit', JSON.stringify(want).length>LIMIT);
    t('entering 2027 dates saves', r && !r.error && !r.blocked);
    t('with no red banner', A.failedBanners().length===0);
    t('what SharePoint holds fits in its column', sp.payload('ph_sched2').length<LIMIT);
    t('it reads back as exactly what was saved', same(await unpacked(A,'ph_sched2',sp),want));
    const B=Browser(sp,J);
    t('another person’s browser reads the whole schedule, 2027 included', same(await B.S.get('ph_sched2'),want));
    t('nothing is left held back on Heather’s device', !(A.S.unsent&&A.S.unsent('ph_sched2')));
  }

  /* ---- 2. A RECORD THAT CANNOT FIT, EVEN PACKED -------------------------------- */
  {
    const sp=SharePoint(); const A=Browser(sp,H);
    let x=123456789, noise=''; for(let i=0;i<90000;i++){ x^=x<<13; x^=x>>>17; x^=x<<5; noise+='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[(x>>>0)%64]; }
    const r=await A.S.set('ph_me_heather',{photo:noise});
    t('a record that cannot fit is not sent at all', sp.attempts===0);
    t('the banner says it is a size problem', !!r.tooBig && A.failedBanners().some(e=>e.detail&&e.detail.tooBig));
    t('and the change is kept on this device', !!A.LS['ph_me_heather'] && A.S.unsent('ph_me_heather'));
  }

  /* ---- 3. A PAYLOAD THAT WILL NOT READ IS A FAILED READ, NEVER AN EMPTY ONE ---- */
  {
    const sp=SharePoint(); const cut='{"__v":2,"2026-01-05":{"Carlsbad":{"ps":[1],"s":4';
    sp.add('ph_sched2',cut,H);
    const A=Browser(sp,H);
    await A.S.get('ph_sched2');
    t('a cut-off payload counts as a failed read', A.S.readFailed('ph_sched2')===true);
    const r=await A.S.set('ph_sched2',{__v:2,'2026-01-06':{}});
    t('so nothing is written over it', r.blocked===true && sp.payload('ph_sched2')===cut);
    const sp2=SharePoint(); sp2.add('ph_sched2','~z1:bm90IGRlZmxhdGU=',H);
    const A2=Browser(sp2,H); await A2.S.get('ph_sched2');
    t('a packed payload that will not unpack counts as a failed read too', A2.S.readFailed('ph_sched2')===true);
  }

  /* ---- 4. ONE WRITE AT A TIME PER RECORD --------------------------------------- */
  {
    const sp=SharePoint(); sp.delay=25; sp.add('ph_activity',[],H);
    const A=Browser(sp,H); await A.S.get('ph_activity');
    const list=[], ps=[];
    for(let i=0;i<5;i++){ list.unshift({id:'a'+i,title:'entry '+i}); ps.push(A.S.set('ph_activity',list.slice())); }
    await Promise.all(ps);
    t('five quick writes to one record never overlap', sp.peak['ph_activity']===1);
    t('SharePoint ends with the newest value', same(JSON.parse(sp.payload('ph_activity')),list));
    t('queued values go as one send, not five', sp.writes<=2);
  }
  {
    const sp=SharePoint(); sp.delay=20; sp.add('ph_access',{Staff:{schedule:'view'}},H);
    const A=Browser(sp,H);
    await Promise.all([
      A.S.update('ph_access',r=>{ r.Staff.schedule='edit'; return r; }),
      A.S.update('ph_access',r=>{ r.TCs={schedule:'view'}; return r; })]);
    const got=JSON.parse(sp.payload('ph_access'));
    t('two quick changes to one record both survive', got.Staff.schedule==='edit' && !!got.TCs && got.TCs.schedule==='view');
    t('small records stay plain JSON, readable in SharePoint', sp.payload('ph_access')[0]==='{');
  }

  /* ---- 5. BUSY IS NOT BROKEN --------------------------------------------------- */
  {
    const sp=SharePoint(); sp.add('ph_docs',[{n:'Dr. A'}],H);
    const A=Browser(sp,H); await A.S.get('ph_docs');
    sp.fail.push({on:'write',status:503,retryAfter:0},{on:'write',status:429,retryAfter:0});
    const r=await A.S.set('ph_docs',[{n:'Dr. A'},{n:'Dr. B'}]);
    t('a throttled or busy SharePoint is waited out, not reported', !r.error && A.failedBanners().length===0);
    t('and the change landed', JSON.parse(sp.payload('ph_docs')).length===2);
  }
  {
    const sp=SharePoint(); sp.add('ph_people',{a:{teams:['Staff']}},H);
    const A=Browser(sp,H); await A.S.get('ph_people');
    // Jenny's write lands between Heather's read and Heather's write: SharePoint answers "Save Conflict".
    sp.fail.push({on:'write',status:409,then:()=>{ const it=sp.items.find(i=>i.Title==='ph_people');
      const v=JSON.parse(it.Payload); v.c={teams:['TCs']}; it.Payload=JSON.stringify(v); }});
    const r=await A.S.update('ph_people',cur=>{ cur.b={teams:['Doctors']}; return cur; });
    const got=JSON.parse(sp.payload('ph_people'));
    t('a save conflict reads again and merges again', !r.error && !!got.b && !!got.c && !!got.a);
  }

  /* ---- 6. WHEN IT REALLY WILL NOT GO: HELD, SAID, AND SENT LATER ---------------- */
  const base26=Object.assign({__v:2},year(2026,0.5,21));
  const dayA='2026-03-02', dayB='2026-03-03', dayC='2026-03-04';
  {
    const sp=SharePoint(); sp.add('ph_sched2',base26,H);
    const A=Browser(sp,H); await A.S.get('ph_sched2');
    for(let i=0;i<4;i++) sp.fail.push({on:'write',status:503,retryAfter:0});
    const r=await A.S.update('ph_sched2',rem=>Object.assign({},rem,{'2027-01-04':{Hobbs:{ps:[1],s:480,e:1020}}}));
    t('when the retries run out, the banner goes up', !!(r&&r.error) && A.failedBanners().length===1);
    t('the change is held on this device', A.S.unsent('ph_sched2') && A.LS['ph_sched2'].indexOf('2027-01-04')>=0);
    t('with the copy it was made on top of', A.LS['ph_sched2__base']===sp.payload('ph_sched2'));
    // Meanwhile Jenny changes an existing day and closes an office on another.
    const B=Browser(sp,J);
    await B.S.update('ph_sched2',rem=>{ rem[dayA]=Object.assign({},rem[dayA],{Carlsbad:{ps:[3],s:480,e:1020}});
      rem[dayB]=Object.assign({},rem[dayB],{Hobbs:{closed:true}}); return rem; });
    const jennys=await unpacked(B,'ph_sched2',sp);
    // Heather opens the hub again. Nobody saves anything.
    await resend(A);
    const now=await unpacked(A,'ph_sched2',sp);
    t('Heather’s held 2027 day reached SharePoint on its own', !!now['2027-01-04']);
    t('Jenny’s change to an existing day survived', same(now[dayA].Carlsbad,{ps:[3],s:480,e:1020}));
    t('Jenny’s closure survived', !!(now[dayB].Hobbs&&now[dayB].Hobbs.closed));
    t('no day SharePoint had was dropped', Object.keys(jennys).every(k=>k in now));
    t('no office on any day was dropped', Object.keys(jennys).every(k=>Object.keys(jennys[k]||{}).every(o=>k==='__v'||o in now[k])));
    t('the held flag is cleared', !A.S.unsent('ph_sched2'));
    t('her device kept its own copy from before combining', !!A.LS['ph_sched2__mine']);
    t('and the red banner is followed by a "saved" signal', A.events.some(e=>e.type==='ph-save-landed'&&e.detail&&e.detail.recovered));
  }

  /* ---- 7. A BROWSER LEFT HOLDING A CHANGE BEFORE THIS FIX (no base recorded) ----- */
  {
    const sp=SharePoint(); sp.add('ph_sched2',base26,H);        // Heather's last save that landed
    const A=Browser(sp,H);
    const held=clone(base26);
    held['2027-01-05']={Clovis:{ps:[2],s:480,e:1020}};             // new
    held[dayA]=Object.assign({},held[dayA],{Mansfield:{ps:[4],s:450,e:1050}});   // she changed an existing day
    A.LS['ph_sched2']=JSON.stringify(held); A.LS['ph_sched2__unsent']='1';
    const B=Browser(sp,J);
    await B.S.update('ph_sched2',rem=>{ rem[dayC]=Object.assign({},rem[dayC],{Hobbs:{ydot:true}}); return rem; });
    const shown=await A.S.get('ph_sched2');
    const now=await unpacked(A,'ph_sched2',sp);
    t('(held before the fix) her new 2027 day is kept', !!now['2027-01-05']);
    t('(held before the fix) her change to an existing day is kept - the version history shows it was hers',
      same(now[dayA].Mansfield,{ps:[4],s:450,e:1050}));
    t('(held before the fix) Jenny’s later change survived', !!(now[dayC].Hobbs&&now[dayC].Hobbs.ydot));
    t('(held before the fix) the page is shown the combined schedule', same(shown,now));
    t('(held before the fix) and it was sent', !A.S.unsent('ph_sched2'));
  }
  {
    // Same, but her last landed save is not in the history (someone else wrote the only versions).
    const sp=SharePoint(); sp.add('ph_sched2',base26,{email:'office@x.com',displayName:'Front Office'});
    const A=Browser(sp,H);
    const held=clone(base26);
    held['2027-01-06']={Hobbs:{ps:[1],s:480,e:1020}};
    const oldCell=clone(base26[dayA]||{});
    held[dayA]=Object.assign({},held[dayA]||{},{Carlsbad:{ps:[5],s:480,e:1020}});
    A.LS['ph_sched2']=JSON.stringify(held); A.LS['ph_sched2__unsent']='1';
    await A.S.get('ph_sched2');
    const now=await unpacked(A,'ph_sched2',sp);
    t('(no base) her new 2027 day is still added', !!now['2027-01-06']);
    t('(no base) where both copies differ, SharePoint’s value stands',
      oldCell.Carlsbad ? same(now[dayA].Carlsbad,oldCell.Carlsbad) : same(now[dayA].Carlsbad,{ps:[5],s:480,e:1020}));
    t('(no base) no day SharePoint had was dropped', Object.keys(base26).every(k=>k in now));
    t('(no base) her own copy is kept on the device', (A.LS['ph_sched2__mine']||'').indexOf('"ps":[5]')>=0);
  }

  /* ---- 8. "DO NOT DELETE ANY DATA ON THE SCHEDULE" ----------------------------- */
  {
    const sp=SharePoint(); sp.add('ph_sched2',base26,H);
    const A=Browser(sp,H);
    const held=clone(base26);
    const days=Object.keys(base26).filter(k=>k!=='__v');
    delete held[days[0]];                                                  // a whole day gone from her copy
    const d1=days[1], o1=Object.keys(held[d1])[0]; delete held[d1][o1];    // and one office on another day
    held['2027-02-01']={Lubbock:{ps:[0],s:480,e:1020}};
    A.LS['ph_sched2']=JSON.stringify(held); A.LS['ph_sched2__unsent']='1';
    A.LS['ph_sched2__base']=JSON.stringify(base26);
    await resend(A);
    const now=await unpacked(A,'ph_sched2',sp);
    t('sending held changes never removes a day from SharePoint', !!now[days[0]]);
    t('nor an office from a day', !!(now[d1]&&now[d1][o1]));
    t('while still adding what was new', !!now['2027-02-01']);
  }
  {
    // The doctor list is positional (days point at doctors by index). A stale copy held on a
    // device must never be sent over the shared one - the Dr. Lightheart case.
    const sp=SharePoint(); sp.add('ph_docs',[{n:'Dr. A'},{n:'Dr. B'},{n:'Dr. C'},{n:'Dr. Lightheart'}],H);
    const G=Browser(sp,J);
    G.LS['ph_docs']=JSON.stringify([{n:'Dr. A'},{n:'Dr. B'},{n:'Dr. C'}]); G.LS['ph_docs__unsent']='1';
    await resend(G);
    t('a stale doctor list held on a device is not sent over the shared one', JSON.parse(sp.payload('ph_docs')).length===4);
  }

  /* ---- 9. WHAT THE BACKGROUND RESEND LEAVES ALONE -------------------------------- */
  {
    const sp=SharePoint(); sp.add('ph_me_jenny',{about:'hi'},J);
    const G=Browser(sp,J); await G.S.get('ph_me_jenny');
    for(let i=0;i<4;i++) sp.fail.push({on:'write',status:403,msg:'Access denied'});
    await G.S.set('ph_me_jenny',{about:'hello'});
    const before=sp.attempts;
    await resend(G);
    t('a permission refusal is not retried in the background', sp.attempts===before);
    t('and the banner said it was permission', G.failedBanners().some(e=>e.detail&&e.detail.denied));
  }

  /* ---- 9b. BOOKKEEPING DOES NOT RAISE THE ALARM --------------------------------------
     A day edit also writes a notification. When that write failed, the red "your change
     was not saved" went up even though the schedule itself had saved. */
  {
    const sp=SharePoint(); sp.add('ph_activity',[],H); sp.add('ph_sched2',{__v:2},H);
    const A=Browser(sp,H); await A.S.get('ph_activity'); await A.S.get('ph_sched2');
    for(let i=0;i<4;i++) sp.fail.push({on:'write',status:503,retryAfter:0});
    await A.S.set('ph_activity',[{id:'n1',title:'Dr. Jae now at Hobbs'}]);
    t('a notification that does not go is held, quietly', A.S.unsent('ph_activity') && A.failedBanners().length===0);
    const r=await A.S.update('ph_sched2',cur=>Object.assign({},cur,{'2027-01-04':{Hobbs:{ps:[4],s:480,e:1020}}}));
    t('while the schedule save itself goes through', !r.error && !!JSON.parse(sp.payload('ph_sched2'))['2027-01-04']);
    await A.S.resend();
    t('and the notification follows on its own', !A.S.unsent('ph_activity') && JSON.parse(sp.payload('ph_activity')).length===1);
  }

  /* ---- 9c. A FIRST SAVE THAT NEVER LANDED (no row in SharePoint yet) ---------------- */
  {
    const sp=SharePoint(); const A=Browser(sp,H);
    for(let i=0;i<4;i++) sp.fail.push({on:'write',status:503,retryAfter:0});
    await A.S.set('ph_me_newhire@x.com',{about:'Started Monday'});
    t('(first save) held when it cannot go', A.S.unsent('ph_me_newhire@x.com') && sp.payload('ph_me_newhire@x.com')===null);
    await resend(A);
    t('(first save) the background resend creates the row', !!sp.payload('ph_me_newhire@x.com') && !A.S.unsent('ph_me_newhire@x.com'));
    t('(first save) exactly one row', sp.items.filter(i=>i.Title==='ph_me_newhire@x.com').length===1);
  }
  {
    // A connection that fails once must not leave the page unable to reach SharePoint for good.
    const sp=SharePoint(); sp.add('ph_teams',['Staff'],H);
    sp.fail.push({on:'read',status:503},{on:'read',status:503},{on:'read',status:503},{on:'read',status:503});
    const A=Browser(sp,H);
    await A.S.get('ph_teams');                        // the first connection fails outright
    const again=await A.S.get('ph_teams');
    t('a failed first connection is tried again next time', Array.isArray(again) && again[0]==='Staff' && !A.S.readFailed('ph_teams'));
  }

  /* ---- 9d. THE PAGE CLOSES WHILE A SAVE IS STILL ON ITS WAY -------------------------
     A phone locks, a tab is shut. The change is on the device; it never reached
     SharePoint, and nothing failed to say so. The next page load must send it. */
  {
    const sp=SharePoint(); sp.add('ph_sched2',base26,H);
    const A=Browser(sp,H); await A.S.get('ph_sched2');
    sp.delay=10000;                                           // this send will never finish
    A.S.update('ph_sched2',rem=>Object.assign({},rem,{'2027-03-01':{Clovis:{ps:[2],s:480,e:1020}}}));
    await new Promise(r=>setTimeout(r,120));
    t('(closed mid-save) the change is marked as on its way before it lands', A.S.unsent('ph_sched2'));
    sp.delay=0;
    const LS=Object.assign({},A.LS);                          // the device's storage, as the tab died
    const A2=Browser(sp,H); Object.assign(A2.LS,LS);          // the same device, next morning
    const shown=await A2.S.get('ph_sched2');
    const now=await unpacked(A2,'ph_sched2',sp);
    t('(closed mid-save) the next page load sends it', !!now['2027-03-01'] && !A2.S.unsent('ph_sched2'));
    t('(closed mid-save) and shows it', !!shown['2027-03-01']);
  }
  {
    // An ordinary save that lands first time does not claim to have "recovered" anything.
    const sp=SharePoint(); sp.add('ph_teams',['Staff'],H);
    const A=Browser(sp,H); await A.S.get('ph_teams');
    await A.S.set('ph_teams',['Staff','TCs']);
    const landedEv=A.events.filter(e=>e.type==='ph-save-landed');
    t('a normal save lands without a "your earlier changes" message', landedEv.length===1 && !landedEv[0].detail.recovered);
    t('and leaves nothing marked', !A.S.unsent('ph_teams') && !A.LS['ph_teams__base'] && !A.LS['ph_teams__why']);
  }

  /* ---- 9e. THE LAST FEW WAYS A HELD CHANGE COMES BACK ------------------------------ */
  {
    // The save landed, but its answer never came back: the held copy IS what SharePoint has.
    const sp=SharePoint(); sp.add('ph_sched2',base26,H);
    const A=Browser(sp,H); A.LS['ph_sched2']=JSON.stringify(base26); A.LS['ph_sched2__unsent']='1';
    const before=sp.writes;
    await A.S.get('ph_sched2');
    t('(answer lost) a held copy that matches SharePoint is let go without writing again', sp.writes===before && !A.S.unsent('ph_sched2'));
  }
  {
    // A doctor added at the end, the tab closed before it landed: safe to send, nobody's position moves.
    const docs=[{n:'Dr. A'},{n:'Dr. B'},{n:'Dr. C'}];
    const sp=SharePoint(); sp.add('ph_docs',docs,H);
    const A=Browser(sp,H); A.LS['ph_docs']=JSON.stringify(docs.concat([{n:'Dr. Lightheart'}])); A.LS['ph_docs__unsent']='1';
    await resend(A);
    t('(doctor list) a doctor added at the end is sent', JSON.parse(sp.payload('ph_docs')).length===4 && !A.S.unsent('ph_docs'));
    // ...but one REMOVED from the middle is not: the days after it would point at the wrong doctor.
    const sp2=SharePoint(); sp2.add('ph_docs',docs,H);
    const B=Browser(sp2,H); B.LS['ph_docs']=JSON.stringify([docs[0],docs[2]]); B.LS['ph_docs__unsent']='1';
    await resend(B);
    t('(doctor list) a doctor removed from the middle is left for the page to send, with its clash check', JSON.parse(sp2.payload('ph_docs')).length===3);
  }
  {
    // A device that never read a key writes it (a notification, first thing): its base is UNKNOWN,
    // so where its copy and SharePoint differ on one value, SharePoint's stands.
    const sp=SharePoint(); sp.add('ph_prodaudit',{Hobbs:{by:'Jenny',at:'2026-09-24'}},J);
    const A=Browser(sp,H);
    for(let i=0;i<4;i++) sp.fail.push({on:'write',status:503,retryAfter:0});
    await A.S.set('ph_prodaudit',{Hobbs:{by:'Old',at:'2026-01-01'},Clovis:{by:'Heather',at:'2026-09-25'}});
    t('(unknown base) nothing is recorded as "SharePoint had nothing"', A.LS['ph_prodaudit__base']===undefined);
    await resend(A);
    const got=JSON.parse(sp.payload('ph_prodaudit'));
    t('(unknown base) her new office entry is added', got.Clovis && got.Clovis.by==='Heather');
    t('(unknown base) SharePoint’s entry for the office she did not touch stands', got.Hobbs && got.Hobbs.by==='Jenny');
  }

  /* ---- 10. A LONG LIST: PAST THE FIRST 200 ROWS ---------------------------------- */
  {
    const sp=SharePoint();
    for(let i=0;i<249;i++) sp.add('ph_seen_p'+i,['x'],H);
    sp.add('ph_late',{a:1},H);
    const A=Browser(sp,H);
    const v=await A.S.get('ph_late');
    t('a record past the first 200 rows is found', !!v && v.a===1);
    await A.S.set('ph_late',{a:2});
    t('and saved in place, not created a second time', sp.items.filter(i=>i.Title==='ph_late').length===1 && JSON.parse(sp.payload('ph_late')).a===2);
  }

  /* ---- 11. HELD ROWS IN A BULK READ; ACCENTS AND SYMBOLS THROUGH PACKING -------- */
  {
    const sp=SharePoint(); sp.add('ph_me_heather@x.com',{photo:'old'},H);
    const A=Browser(sp,H);
    A.LS['ph_me_heather@x.com']=JSON.stringify({photo:'new'}); A.LS['ph_me_heather@x.com__unsent']='1';
    const all=await A.S.getAll('ph_me_');
    t('a held profile row comes back from a bulk read as held, not as the old copy', all['ph_me_heather@x.com'] && all['ph_me_heather@x.com'].photo==='new');
  }
  {
    const sp=SharePoint(); const A=Browser(sp,H);
    const big={}; for(let i=0;i<1400;i++) big['k'+i]={who:'Dr. Núñez — “Promo” ✨ 🦷', i};
    await A.S.set('ph_big',big);
    t('names with accents, quotes and emoji survive packing exactly', same(await unpacked(A,'ph_big',sp),big) && sp.payload('ph_big').indexOf('{"__packed":"~z1:')===0);
  }

  /* ---- 12. SOMEBODY STILL ON THE OLD CODE --------------------------------------------
     A tab opened before the update keeps the old store.js until it is reloaded. It must
     not be able to turn the packed schedule into "just the day it changed". */
  if(!process.env.STORE){
    const OLD=path.join(__dirname,'fixtures','store.hc46.js');
    const sp=SharePoint(); const A=Browser(sp,H);
    const full=Object.assign({__v:2},year(2026,0.75,11),year(2027,0.3,12));
    await A.S.set('ph_sched2',full);
    t('(old tab) the big schedule is stored packed, in the wrapped form', sp.payload('ph_sched2').indexOf('{"__packed":"~z1:')===0);
    const oldSrc=fs.readFileSync(OLD,'utf8');
    const LS={}, ctx={console,Promise,JSON,Math,Date,Object,Array,String,Number,Error,RegExp,TypeError,setTimeout,clearTimeout,setInterval,clearInterval,
      localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]}},
      document:{addEventListener(){},dispatchEvent(){return true;}}, CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
      PH:{isLive:()=>true}, PH_AUTH:{account:{username:J.email,name:J.displayName},token:()=>Promise.resolve('t'),graph:sp.graph(J)}, fetch:sp.fetch(J)};
    ctx.window=ctx; vm.createContext(ctx); vm.runInContext(oldSrc,ctx,{filename:'store.hc46.js'});
    const O=ctx.PH_STORE;
    // Jenny's old page had the year in memory from before; she changes one day and it saves the old way.
    const mine=clone(full); mine['2026-10-05']=Object.assign({},mine['2026-10-05'],{Clovis:{ps:[1],s:480,e:1020}});
    const r=await O.update('ph_sched2',remote=>{ const m=O.mergeInto(remote,mine,['2026-10-05'],[]); m.__v=2; delete m.__demo; return m; });
    t('(old tab) its save still goes through', r && !r.error && !r.blocked);
    const back=await A.S.get('ph_sched2');
    t('(old tab) the whole year is still there afterwards', Object.keys(full).every(k=>k in back));
    t('(old tab) and the old tab’s own change is in it', back['2026-10-05'] && back['2026-10-05'].Clovis && back['2026-10-05'].Clovis.ps[0]===1);
  }

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('  FAIL  crashed: '+(e&&e.stack||e)); process.exit(1); });
