/* ADDED AND REMOVED PEOPLE.
       node test/roster.test.js

   17/09/2026. Heather: "don't forget the ability to add and take away staff." Admin told
   her people come from Microsoft and appear on their own. They come from a file Cory
   deploys, and nobody appears on their own. Additions and removals now live in
   SharePoint (ph_roster_extra) and are laid over the file for every reader. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');
const FILE=JSON.parse(fs.readFileSync(path.join(V1,'_people.json'),'utf8'));

function load(ls, shared){
  const LS=ls||{}, listeners={}; shared=shared||{};
  const mk=()=>({style:{},classList:{add(){},remove(){},contains(){return false}},children:[],
    appendChild(c){this.children.push(c);return c},remove(){},setAttribute(){},getAttribute(){return null},
    querySelector(){return null},querySelectorAll(){return []},addEventListener(){},insertBefore(){},
    set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''},
    set textContent(v){this._t=v}, get textContent(){return this._t||''}});
  const ctx={console,Promise,Date,JSON,Math,Object,Array,String,Number,RegExp,Set,
    isNaN,parseInt,parseFloat,setTimeout,clearTimeout,encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]}},
    location:{hostname:'kind-hill-00da87410.3.azurestaticapps.net',pathname:'/v1/admin.html',
              search:'',origin:'https://x',assign(){},reload(){}},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{readyState:'complete',documentElement:mk(),body:mk(),head:mk(),createElement:mk,
      getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],
      addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},
      dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true}},
    navigator:{userAgent:'node'},
    fetch:(u,o)=>{
      if(String(u).indexOf('_people.json')>=0)
        return Promise.resolve({ok:true, json:()=>Promise.resolve(FILE)});
      // Graph writes land in `shared`
      if(o && o.body){ const b=JSON.parse(o.body); const raw=b.Payload!==undefined?b.Payload:(b.fields&&b.fields.Payload);
        const title=(b.fields&&b.fields.Title)||shared.__lastKey; shared[title]=raw; }
      return Promise.resolve({status:200,ok:true,json:()=>Promise.resolve({id:'1'})});
    }};
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx; ctx.addEventListener=ctx.document.addEventListener;
  // A tiny Graph + store stand-in so PH_STORE.update() really reads then writes.
  ctx.PH_AUTH={ token:()=>Promise.resolve('t'), graph:p=>{
    if(/\/sites\/omega/.test(p)) return Promise.resolve({id:'site'});
    if(/lists\?/.test(p))        return Promise.resolve({value:[{id:'L',displayName:'HomeBraceData'}]});
    const vals=Object.keys(shared).filter(k=>k[0]!=='_').map((k,i)=>({id:String(i+1),
      lastModifiedDateTime:'2026-09-17T09:00:00Z', fields:{Title:k, Payload:shared[k]}}));
    return Promise.resolve({value:vals});
  }};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'),ctx,{filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'),ctx,{filename:'user.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'store.js'),'utf8'),ctx,{filename:'store.js'});
  // PATCH the stand-in so a PATCH to items/<id>/fields is recorded under the right key
  const origFetch=ctx.fetch;
  ctx.fetch=(u,o)=>{ const m=String(u).match(/items\/(\d+)\/fields/);
    if(m){ const keys=Object.keys(shared).filter(k=>k[0]!=='_'); shared.__lastKey=keys[Number(m[1])-1]; }
    return origFetch(u,o); };
  return {ctx, PH:ctx.PH, LS, shared,
          signIn:p=>{ ctx.PH.setProfile(p); ctx.document.dispatchEvent(new ctx.CustomEvent('ph-signed-in')); }};
}
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const settle=()=>new Promise(r=>setTimeout(r,30));

(async()=>{
  const A=load({}, {});
  await A.PH.rosterReady; await settle();
  const before=A.PH.rosterRows().length;
  t('the roster loads from the file', before===FILE.people.length);
  t('nobody is removed to begin with', A.PH.removedRows().length===0);

  /* ---- add Dr. Lightheart, who exists in the schedule but has no profile ---- */
  const r1=await A.PH.saveRosterExtra(function(ex){
    ex.added.push({name:'Dr. Lightheart', role:'Associate Doctor', offices:['Hobbs'], teams:['Doctors'], email:'', empId:''});
    return ex;
  });
  t('adding a person saves to the shared record', !!A.shared.ph_roster_extra && A.shared.ph_roster_extra.indexOf('Lightheart')>=0);
  t('they appear in the roster straight away', A.PH.rosterRows().some(r=>r.name==='Dr. Lightheart'));
  t('and are marked as added, not from the file', A.PH.rosterRows().find(r=>r.name==='Dr. Lightheart')._added===true);
  t('the roster grew by exactly one', A.PH.rosterRows().length===before+1);

  /* ---- the added person signs in and gets their team's rights ---- */
  A.signIn({displayName:'Dr. Lightheart', mail:'lightheart@example.com', userPrincipalName:'lightheart@example.com',
            jobTitle:'', department:'', officeLocation:''});
  await settle();
  t('an added doctor gets the Doctors team when they sign in', (A.PH.me().teams||[]).indexOf('Doctors')>=0);
  t('and the office they were added to', JSON.stringify(A.PH.offices())==='["Hobbs"]');

  /* ---- remove somebody from the file: hidden, not deleted ---- */
  const mia=FILE.people.find(p=>p.name==='Mia Armenta');
  const miaKey=A.PH.personKey(mia);
  await A.PH.saveRosterExtra(function(ex){ ex.removed.push(miaKey); return ex; });
  t('a removed person leaves the roster', !A.PH.rosterRows().some(r=>r.name==='Mia Armenta'));
  t('but is listed under removed, so it can be undone', A.PH.removedRows().some(r=>r.name==='Mia Armenta'));
  t('the file itself is untouched', FILE.people.some(p=>p.name==='Mia Armenta'));

  /* ---- and undone ---- */
  await A.PH.saveRosterExtra(function(ex){ ex.removed=ex.removed.filter(k=>k!==miaKey); return ex; });
  t('restoring puts them back', A.PH.rosterRows().some(r=>r.name==='Mia Armenta'));
  t('with nobody left under removed', A.PH.removedRows().length===0);

  /* ---- two browsers: additions merge, they do not overwrite each other ---- */
  const sharedB={ ph_roster_extra: JSON.stringify({added:[{name:'Dr. Gallagher', role:'Associate Doctor', offices:['Clovis'], teams:['Doctors']}], removed:[]}) };
  const B=load({}, sharedB);                       // Heather's browser knows nothing of Gallagher yet
  await B.PH.rosterReady; await settle();
  await B.PH.saveRosterExtra(function(ex){ ex.added.push({name:'Dr. Lightheart', role:'Associate Doctor', offices:['Hobbs'], teams:['Doctors']}); return ex; });
  const merged=JSON.parse(sharedB.ph_roster_extra);
  t('a second browser’s addition does not erase the first’s', merged.added.some(a=>a.name==='Dr. Gallagher'));
  t('and its own addition landed', merged.added.some(a=>a.name==='Dr. Lightheart'));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})();
