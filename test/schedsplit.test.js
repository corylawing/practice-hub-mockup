/* THE SCHEDULE, ONE RECORD PER YEAR FROM 2028.
       node test/schedsplit.test.js

   22/10/2026, Cory: "they will need me if it ever gets full, its not self sustainable" - then
   "yes but only if it works". One SharePoint record holds ~63,000 characters and the schedule
   kept every year in one ('ph_sched2'): full around 2033. From 2028 each year gets its own record
   (schedrec.js); nothing already saved moves. These run the real store.js and schedrec.js against
   the same stand-in SharePoint as test/sync.test.js. Made-up schedules only. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const SRC=fs.readFileSync(path.join(__dirname,'..','v1','store.js'),'utf8');
const SCHED=fs.readFileSync(path.join(__dirname,'..','v1','schedrec.js'),'utf8');
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
      sp.byId=(sp.byId||0)+1;
      if(sp.failById && sp.failById.title===it.Title && sp.failById.times-->0) throw err(sp.failById.status,'busy');
      return {id:it.id, lastModifiedDateTime:it.at, fields:{Title:it.Title, Payload:it.Payload}}; }
    if(/\/items\?/.test(p)){
      // Like the real one: fields($select=Title) leaves the contents out, $select=id the rest of the row.
      const short=/fields\(\$select=Title\)/.test(p), idOnly=/[?&]\$select=id(&|$)/.test(p);
      sp.listings=(sp.listings||0)+1;
      if(short && sp.refuseShort) throw err(400,'Invalid request');
      const skip=Number((/skip=(\d+)/.exec(p)||[])[1]||0);
      const r={value:sp.items.slice(skip,skip+200).map(i=>{
        if(short && sp.oddShort) return {id:i.id};
        if(!short) sp.listedChars=(sp.listedChars||0)+i.Payload.length;
        const f=short?{Title:i.Title}:{Title:i.Title,Payload:i.Payload};
        return idOnly?{id:i.id,fields:f}:{id:i.id,lastModifiedDateTime:i.at,fields:f};
      })};
      if(skip+200<sp.items.length) r['@odata.nextLink']='https://graph.microsoft.com/v1.0'+p.split('&skip=')[0]+'&skip='+(skip+200);
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

function Browser(sp,who,opt){
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
  // An older iPhone or iPad (Safari before 16.4): no CompressionStream. pako stands in when it loaded.
  if(opt && opt.old){ ctx.CompressionStream=undefined; ctx.DecompressionStream=undefined; }
  if(opt && opt.pako) ctx.pako=require(path.join(__dirname,'..','v1','vendor','pako.min.js'));
  vm.createContext(ctx); vm.runInContext(SRC,ctx,{filename:'store.js'}); vm.runInContext(SCHED,ctx,{filename:'schedrec.js'});
  const S=ctx.PH_STORE, P=ctx.PH_SCHED;
  if(S.setRetryWaits) S.setRetryWaits([2,2,2]);
  if(S.setAutoResend) S.setAutoResend(false);
  const failedBanners=()=>events.filter(e=>e.type==='ph-save-failed');
  return {S,P,LS,events,failedBanners};
}

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
const H={email:'priya@farnsworthorthodontics.com',displayName:'Priya Tatum'};
const J={email:'selma@lascrucessmiles.com',displayName:'Selma Blaine'};
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const unpacked=async (B,t,sp)=>{ const p=sp.payload(t); return p===null?null:JSON.parse(await B.S.unpack(p)); };
const rows=(sp,prefix)=>sp.items.filter(i=>i.Title.indexOf(prefix)===0).map(i=>i.Title).sort();
// What the page does: the changed cells of its schedule, sent through schedrec.js.
const cellsOf=edits=>edits.map(e=>[e[0],e[1]]);
const page=(B,sched)=>({sched, send:cells=>B.P.send(cells,(k,o)=>sched[k]?sched[k][o]:undefined,2)});

(async()=>{
  const y26=Object.assign({__v:2},year(2026,0.75,11)), y27=year(2027,0.6,12);
  const base=Object.assign({},y26,y27);

  /* ---- 1. 2026 AND 2027: EXACTLY AS BEFORE ------------------------------------------ */
  {
    const sp=SharePoint(); sp.add('ph_sched2',base,H);
    const A=Browser(sp,H);
    const L=await A.P.load();
    t('(today) the schedule loads as before', same(L.sched,base) && !L.baseFailed && !L.failed.length && !L.unknown);
    const s=clone(L.sched); s['2027-03-02']=Object.assign({},s['2027-03-02'],{Hobbs:{ps:[2],s:480,e:1020}});
    const r=await page(A,s).send([['2027-03-02','Hobbs']]);
    t('(today) a 2027 day saves into the same record as before', r.ok && (await unpacked(A,'ph_sched2',sp))['2027-03-02'].Hobbs.ps[0]===2);
    t('(today) and no new record is made', rows(sp,'ph_sched_').length===0);
    const adopted=A.P.adopt(s, r.parts);
    t('(today) the page ends up with exactly the shared copy, as before', same(adopted, await unpacked(A,'ph_sched2',sp)));
  }

  /* ---- 2. A DAY IN 2028 GOES TO 2028'S OWN RECORD -------------------------------------- */
  {
    const sp=SharePoint(); sp.add('ph_sched2',base,H);
    const before=sp.payload('ph_sched2');
    const A=Browser(sp,H);
    const s=clone((await A.P.load()).sched);
    s['2028-01-04']={Carlsbad:{ps:[1],s:480,e:1020}};
    const r=await page(A,s).send([['2028-01-04','Carlsbad']]);
    t('(2028) the day is saved', r.ok);
    t('(2028) into its own year’s record', rows(sp,'ph_sched_').join()==='ph_sched_2028' && same((await unpacked(A,'ph_sched_2028',sp))['2028-01-04'], {Carlsbad:{ps:[1],s:480,e:1020}}));
    t('(2028) and the record that holds 2026-2027 is not touched at all', sp.payload('ph_sched2')===before);
    const B=Browser(sp,J);
    const L=await B.P.load();
    t('(2028) another person sees 2026, 2027 and 2028 together', same(L.sched['2028-01-04'],{Carlsbad:{ps:[1],s:480,e:1020}}) && same(L.sched['2026-03-02'],base['2026-03-02']) && same(L.sched['2027-03-02'],base['2027-03-02']));
    t('(2028) the page keeps both after its save', same(A.P.adopt(s,r.parts)['2028-01-04'],{Carlsbad:{ps:[1],s:480,e:1020}}) && same(A.P.adopt(s,r.parts)['2026-03-02'],base['2026-03-02']));
  }

  /* ---- 3. ONE SAVE ACROSS YEARS ---------------------------------------------------------- */
  {
    const sp=SharePoint(); sp.add('ph_sched2',base,H);
    const A=Browser(sp,H);
    const s=clone((await A.P.load()).sched);
    s['2027-12-30']=Object.assign({},s['2027-12-30'],{Clovis:{ps:[3],s:480,e:1020}});
    s['2028-01-05']={Clovis:{ps:[3],s:480,e:1020}};
    s['2029-06-01']={Lubbock:{closed:true}};
    const r=await page(A,s).send([['2027-12-30','Clovis'],['2028-01-05','Clovis'],['2029-06-01','Lubbock']]);
    t('(across years) one save lands in every record it touches', r.ok && r.parts.length===3);
    t('(across years) each day in its own year', (await unpacked(A,'ph_sched2',sp))['2027-12-30'].Clovis.ps[0]===3 &&
      (await unpacked(A,'ph_sched_2028',sp))['2028-01-05'].Clovis.ps[0]===3 && (await unpacked(A,'ph_sched_2029',sp))['2029-06-01'].Lubbock.closed===true);
    t('(across years) no day ends up in the wrong year', !('2028-01-05' in await unpacked(A,'ph_sched2',sp)) && !('2027-12-30' in await unpacked(A,'ph_sched_2028',sp)));
  }

  /* ---- 4. TWO PEOPLE ON THE SAME 2028 DAY --------------------------------------------- */
  {
    const sp=SharePoint(); sp.add('ph_sched2',base,H); sp.add('ph_sched_2028',{__v:2,'2028-02-07':{Hobbs:{ps:[0],s:480,e:1020}}},H);
    const A=Browser(sp,H), B=Browser(sp,J);
    const sa=clone((await A.P.load()).sched), sb=clone((await B.P.load()).sched);
    sa['2028-02-07']=Object.assign({},sa['2028-02-07'],{Carlsbad:{ps:[1],s:480,e:1020}});
    sb['2028-02-07']=Object.assign({},sb['2028-02-07'],{Clovis:{ps:[2],s:480,e:1020}});
    // B's page was opened before A saved: a stale copy. Each save lays only its own cells onto the shared copy.
    await page(A,sa).send([['2028-02-07','Carlsbad']]);
    await page(B,sb).send([['2028-02-07','Clovis']]);
    const d=(await unpacked(A,'ph_sched_2028',sp))['2028-02-07'];
    t('(two people) a page opened before someone else saved keeps their office, and adds its own', !!(d.Hobbs && d.Carlsbad && d.Clovis));
  }

  /* ---- 5. A YEAR THAT WILL NOT READ ------------------------------------------------------ */
  {
    const sp=SharePoint(); sp.add('ph_sched2',base,H); sp.add('ph_sched_2028',{__v:2,'2028-03-01':{Hobbs:{ps:[0],s:480,e:1020}}},H);
    sp.failById={title:'ph_sched_2028',status:503,times:999};
    const A=Browser(sp,H);
    const L=await A.P.load();
    t('(unreadable year) the page is told which year did not load', L.failed.join()==='ph_sched_2028' && !L.baseFailed);
    t('(unreadable year) everything else still shows', same(L.sched['2026-03-02'],base['2026-03-02']));
    const before=sp.payload('ph_sched_2028');
    const s=clone(L.sched); s['2028-03-02']={Clovis:{ps:[1],s:480,e:1020}}; s['2027-05-03']=Object.assign({},s['2027-05-03'],{Hobbs:{closed:true}});
    const r=await page(A,s).send([['2028-03-02','Clovis'],['2027-05-03','Hobbs']]);
    t('(unreadable year) nothing is written over a year it could not read', sp.payload('ph_sched_2028')===before);
    t('(unreadable year) and the save is not counted as done, so the page keeps the change for the next save', r.ok===false);
    t('(unreadable year) the other year still saved', (await unpacked(A,'ph_sched2',sp))['2027-05-03'].Hobbs.closed===true);
  }

  /* ---- 6. AN OLDER PAGE THAT PUT A 2028 DAY IN 'ph_sched2' -------------------------------- */
  {
    const old=Object.assign({},base,{'2028-01-10':{Mansfield:{ps:[4],s:480,e:1020}}});
    const sp=SharePoint(); sp.add('ph_sched2',old,H);
    const A=Browser(sp,H);
    let L=await A.P.load();
    t('(older page) its 2028 day still shows', same(L.sched['2028-01-10'],{Mansfield:{ps:[4],s:480,e:1020}}));
    const s=clone(L.sched); s['2028-01-10']={Mansfield:{ps:[5],s:480,e:1020}};
    await page(A,s).send([['2028-01-10','Mansfield']]);
    L=await Browser(sp,J).P.load();
    t('(older page) once the day is saved again, its year’s record is what shows', L.sched['2028-01-10'].Mansfield.ps[0]===5);
    t('(older page) and the old copy is left where it was - nothing deleted', (await unpacked(A,'ph_sched2',sp))['2028-01-10'].Mansfield.ps[0]===4);
  }

  /* ---- 7. THE SEATBELT STILL HOLDS, YEAR BY YEAR ------------------------------------------ */
  {
    const y28=Object.assign({__v:2},year(2028,0.8,13));
    const sp=SharePoint(); sp.add('ph_sched2',base,H); sp.add('ph_sched_2028',y28,H);
    const A=Browser(sp,H);
    const s=clone((await A.P.load()).sched), cells=[];
    Object.keys(y28).filter(k=>k!=='__v').forEach(k=>{ Object.keys(y28[k]).forEach(o=>{ cells.push([k,o]); delete s[k][o]; }); });
    const before=sp.payload('ph_sched_2028');
    const r=await page(A,s).send(cells);
    t('(seatbelt) a save that would empty out 2028 is refused', r.ok===false && sp.payload('ph_sched_2028')===before);
  }

  /* ---- 8. YEARS AND YEARS: NOTHING FILLS UP ---------------------------------------------- */
  {
    const sp=SharePoint(), A=Browser(sp,H);
    await A.S.set('ph_sched2',base);                                   // stored the way the page stores it (packed)
    const kept=sp.payload('ph_sched2');
    let s=clone((await A.P.load()).sched);
    for(let y=2028;y<=2035;y++){
      const yr=year(y,0.95,20+y), cells=[];
      Object.keys(yr).forEach(k=>{ s[k]=yr[k]; Object.keys(yr[k]).forEach(o=>cells.push([k,o])); });
      const r=await page(A,s).send(cells); if(!r.ok) t('(years) '+y+' saved',false);
      s=A.P.adopt(s,r.parts);
    }
    const sizes=sp.items.map(i=>({k:i.Title, n:i.Payload.length}));
    const biggest=sizes.reduce((m,x)=>x.n>m.n?x:m,{n:0});
    t('(years) eight more years, one record each', rows(sp,'ph_sched_').length===8);
    t('(years) and 2026-2027’s record never touched by them', sp.payload('ph_sched2')===kept);
    t('(years) no record above a third of what SharePoint holds ('+biggest.k+': '+Math.round(biggest.n/LIMIT*100)+'%)', biggest.n<LIMIT/3);
    const L=await Browser(sp,J).P.load();
    t('(years) and it all reads back as one schedule', Object.keys(L.sched).filter(k=>/^\d{4}-/.test(k)).length===Object.keys(s).filter(k=>/^\d{4}-/.test(k)).length);
  }

  /* ---- 9. THE PAGE'S OWN STEP, UNCHANGED FOR 2026-2027 ------------------------------------ */
  {
    const P=require('../v1/schedrec.js');
    const pageSched=Object.assign({},base,{'2026-01-05':{Carlsbad:{}}});        // a day this page had only in memory
    const shared=Object.assign({},base,{'2026-01-06':{Hobbs:{closed:true}}});
    t('(page) adopting a 2026-2027 save gives exactly the shared copy, as before', same(P.adopt(pageSched,[{key:'ph_sched2',value:shared}]),shared));
    t('(page) days are filed by year: 2027-12-31 stays, 2028-01-01 has its own', P.recOf('2027-12-31')==='ph_sched2' && P.recOf('2028-01-01')==='ph_sched_2028');
  }

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('  FAIL  crashed: '+(e&&e.stack||e)); process.exit(1); });
