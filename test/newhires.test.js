/* NEW HIRES (17/11/2026, hc170) - SANDBOX ONLY until user.js NEWHIRES_LIVE is true.
       node test/newhires.test.js

   Heather added Jamy Aguilar and Trinity Moccabee to Clovis in Admin -> People. They sat at the bottom of the list,
   not with Clovis, and Payroll never knew about them. These hold the fix to: (1) someone added in Admin goes in with
   their office (sandbox) and exactly where they always went on the live site while the switch is off; (2) Payroll's
   "New on the team list" offers only people ADDED in Admin, not doctors, not anyone already on that office's payroll
   (same email or same name) and not anyone Heather skipped; (3) Add a person is unchanged when it isn't opened from
   that card. Made-up people only. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');
const FILE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','people.json'),'utf8'));
const USER=fs.readFileSync(path.join(V1,'user.js'),'utf8');
const H=fs.readFileSync(path.join(V1,'payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const settle=()=>new Promise(r=>setTimeout(r,30));

/* user.js in a stand-in browser (the same shape as roster.test.js), on a host of our choosing */
function load(host, ls, shared, src){
  const LS=ls||{}, listeners={}; shared=shared||{};
  const mk=()=>({style:{},classList:{add(){},remove(){},contains(){return false}},children:[],
    appendChild(c){this.children.push(c);return c},remove(){},setAttribute(){},getAttribute(){return null},
    querySelector(){return null},querySelectorAll(){return []},addEventListener(){},insertBefore(){},
    set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''},
    set textContent(v){this._t=v}, get textContent(){return this._t||''}});
  const ctx={console,Promise,Date,JSON,Math,Object,Array,String,Number,RegExp,Set,
    isNaN,parseInt,parseFloat,setTimeout,clearTimeout,encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]}},
    location:{hostname:host,pathname:'/v1/admin.html',search:'',origin:'https://x',assign(){},reload(){}},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{readyState:'complete',documentElement:mk(),body:mk(),head:mk(),createElement:mk,
      getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],
      addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},
      dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true}},
    navigator:{userAgent:'node'},
    fetch:(u,o)=>{
      if(String(u).indexOf('_people.json')>=0) return Promise.resolve({ok:true, json:()=>Promise.resolve(FILE)});
      if(o && o.body){ const b=JSON.parse(o.body); const raw=b.Payload!==undefined?b.Payload:(b.fields&&b.fields.Payload);
        const title=(b.fields&&b.fields.Title)||shared.__lastKey; shared[title]=raw; }
      return Promise.resolve({status:200,ok:true,json:()=>Promise.resolve({id:'1'})});
    }};
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx; ctx.addEventListener=ctx.document.addEventListener;
  ctx.PH_AUTH={ token:()=>Promise.resolve('t'), graph:p=>{
    if(/\/sites\/omega/.test(p)) return Promise.resolve({id:'site'});
    if(/lists\?/.test(p))        return Promise.resolve({value:[{id:'L',displayName:'HomeBraceData'}]});
    const vals=Object.keys(shared).filter(k=>k[0]!=='_').map((k,i)=>({id:String(i+1),
      lastModifiedDateTime:'2026-09-17T09:00:00Z', fields:{Title:k, Payload:shared[k]}}));
    const one=/\/items\/(\d+)\?/.exec(p);
    if(one){ const it=vals.find(v=>v.id===one[1]); return it?Promise.resolve(it):Promise.reject(new Error('Graph 404: itemNotFound')); }
    return Promise.resolve({value:vals});
  }};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'),ctx,{filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'store.js'),'utf8'),ctx,{filename:'store.js'});
  vm.runInContext(src||USER,ctx,{filename:'user.js'});
  const origFetch=ctx.fetch;
  ctx.fetch=(u,o)=>{ const m=String(u).match(/items\/(\d+)\/fields/);
    if(m){ const keys=Object.keys(shared).filter(k=>k[0]!=='_'); shared.__lastKey=keys[Number(m[1])-1]; }
    return origFetch(u,o); };
  return {ctx, PH:ctx.PH, LS, shared};
}
const first=r=>String(((r&&r.offices)||[])[0]||'');
const NEW=[
  {name:'Jamy Zzaguilar', role:'Clinical Asst', offices:['Clovis'], teams:['Staff'], email:'', empId:''},
  {name:'Trinity Zzmoccabee', role:'Clinical Asst', offices:['Clovis'], teams:['Staff'], email:'', empId:''},
  {name:'Nobody Zzoffice', role:'Clinical Asst', offices:[], teams:['Staff'], email:'', empId:''}];

(async()=>{
  /* ---- the switch ---- */
  t('the switch is ON in the code (Cory 17/11: put it live)', /const NEWHIRES_LIVE=true;/.test(USER));
  t('it is decided where applyExtra can see it (before applyExtra, not further down the file)',
    USER.indexOf('const NEWHIRES_LIVE=') > 0 && USER.indexOf('const NEWHIRES_LIVE=') < USER.indexOf('function applyExtra('));

  /* ---- the live site with the switch ON: added people go with their office ---- */
  const L=load('kind-hill-00da87410.3.azurestaticapps.net', {}, {});
  await L.PH.rosterReady; await settle();
  t('live: PH.newHiresOn() is true', L.PH.newHiresOn()===true);
  await L.PH.saveRosterExtra(ex=>{ NEW.forEach(r=>ex.added.push(Object.assign({}, r))); return ex; });
  { const lr=L.PH.rosterRows(), ia=lr.findIndex(r=>r.name===NEW[0].name), lastC=FILE.people.map(first).lastIndexOf('Clovis');
    t('live: the Clovis hires go in right after the last Clovis person, in the order added', ia===lastC+1 && lr[ia+1].name===NEW[1].name);
    t('live: the file\'s own people keep their order', lr.filter(r=>!r._added).every((r,i)=>r.name===FILE.people[i].name)); }

  /* ---- the switch OFF still means exactly as before (so it stays a real off switch) ---- */
  const OFF=USER.replace('const NEWHIRES_LIVE=true;', 'const NEWHIRES_LIVE=false;');
  const L0=load('kind-hill-00da87410.3.azurestaticapps.net', {}, {}, OFF);
  await L0.PH.rosterReady; await settle();
  t('switch off, live: PH.newHiresOn() is false', L0.PH.newHiresOn()===false);
  await L0.PH.saveRosterExtra(ex=>{ NEW.forEach(r=>ex.added.push(Object.assign({}, r))); return ex; });
  const lr=L0.PH.rosterRows(), ln=lr.length;
  t('switch off, live: the file comes first, untouched and in its order', lr.slice(0, FILE.people.length).every((r,i)=>r.name===FILE.people[i].name));
  t('switch off, live: added people stay at the end, in the order added', lr[ln-3].name===NEW[0].name && lr[ln-2].name===NEW[1].name && lr[ln-1].name===NEW[2].name);

  /* ---- the sandbox: with their office ---- */
  const S=load('corylawing.github.io', {ph_roster_extra:JSON.stringify({added:NEW, removed:[]})}, {});
  await S.PH.rosterReady; await settle();
  t('sandbox: PH.newHiresOn() is true', S.PH.newHiresOn()===true);
  const sr=S.PH.rosterRows(), ia=sr.findIndex(r=>r.name===NEW[0].name), ib=sr.findIndex(r=>r.name===NEW[1].name);
  const lastClovis=FILE.people.map(first).lastIndexOf('Clovis');
  t('sandbox: everyone is still there (file + 3 added)', sr.length===FILE.people.length+3);
  t('sandbox: the first Clovis hire goes in right after the last Clovis person on the list', ia===lastClovis+1 && first(sr[ia-1])==='Clovis');
  t('sandbox: the second goes right after the first (order added kept)', ib===ia+1);
  t('sandbox: someone with no office still goes at the end', sr[sr.length-1].name===NEW[2].name);
  t('sandbox: the file\'s own people keep their order', sr.filter(r=>!r._added).every((r,i)=>r.name===FILE.people[i].name));
  t('sandbox: both are still marked "added here"', sr[ia]._added===true && sr[ib]._added===true);
  t('sandbox: removing one still works (hidden, not deleted)', (()=>{
    const k=S.PH.personKey(NEW[0]);
    return S.PH.saveRosterExtra(ex=>{ ex.removed.push(k); return ex; }).then(()=>!S.PH.rosterRows().some(r=>r.name===NEW[0].name));
  })());
  await settle();
  t('sandbox: a new office (not in the file) goes at the end, not lost', (()=>{
    const r=[{name:'A', offices:['Clovis']},{name:'B', offices:['Hobbs']}];
    const spot=new Function('rows','row', USER.slice(USER.indexOf('function officeSpot('), USER.indexOf('function applyExtra(')) + '; return officeSpot(rows,row);');
    return spot(r, {name:'C', offices:['Roswell']})===-1 && spot(r, {name:'D', offices:['Clovis']})===1 && spot(r, {name:'E', offices:[]})===-1;
  })());
  t('sandbox: someone at an office that is only a SECOND office in the file goes after that row', (()=>{
    const spot=new Function('rows','row', USER.slice(USER.indexOf('function officeSpot('), USER.indexOf('function applyExtra(')) + '; return officeSpot(rows,row);');
    return spot([{offices:['Hobbs','Carlsbad']},{offices:['Lubbock']}], {offices:['Carlsbad']})===1;
  })());

  /* ---- Payroll: who "New on the team list" offers ---- */
  const block=H.slice(H.indexOf('  const NEWON='), H.indexOf('  function newOnCard('));
  const run=(env)=>new Function('window','LIVEPAY','PH','R','OFFICES','everyone','S', block+'; return newOnList();')
    ({PH:env.PH}, env.LIVEPAY, env.PH, ()=>env.R||{kind:'coo', ro:false}, env.OFFICES, ()=>env.people, env.S||{});
  const OFFS=[{k:'clovis', n:'Clovis'}, {k:'hobbs', n:'Hobbs'}, {k:'zihua', n:'Zihua Partners', self:true}];
  const ROSTER=[
    {name:'Jamy Zzaguilar', offices:['Clovis'], teams:['Staff'], _added:true},
    {name:'Trinity Zzmoccabee', offices:['Clovis'], teams:['Staff'], email:'trinity@example.com', _added:true},
    {name:'Dr. Zzdoc', offices:['Clovis'], teams:['Doctors'], _added:true},
    {name:'Old Zzfile', offices:['Clovis'], teams:['Staff']},                      // from the starting list: never offered
    {name:'Two Zzoffices', offices:['Clovis','Hobbs'], teams:['Staff'], _added:true},
    {name:'Zihua Zzperson', offices:['Zihua Partners'], teams:['Staff'], _added:true}];
  const pk=r=>String(r.email||'').toLowerCase() || 'name:'+String(r.name).toLowerCase();
  const PHs=on=>({newHiresOn:()=>on, rosterView:()=>ROSTER.map(r=>Object.assign({}, r)), personKey:pk});
  const base={LIVEPAY:true, PH:PHs(true), OFFICES:OFFS, people:[]};
  const names=l=>l.map(x=>x.nm+'@'+x.k).sort().join(',');
  t('offers added people at each of their offices, not doctors, not the starting list, not Zihua (no sender)',
    names(run(base))==='Jamy Zzaguilar@clovis,Trinity Zzmoccabee@clovis,Two Zzoffices@clovis,Two Zzoffices@hobbs');
  t('nothing when the switch is off (the live site today)', run(Object.assign({}, base, {PH:PHs(false)})).length===0);
  t('nothing in the mock-up (not the live code)', run(Object.assign({}, base, {LIVEPAY:false})).length===0);
  t('nothing for Payroll: See (read-only)', run(Object.assign({}, base, {R:{kind:'coo', ro:true}})).length===0);
  t('someone already on that office\'s payroll by NAME is not offered',
    names(run(Object.assign({}, base, {people:[{first:'Jamy', last:'Zzaguilar', offices:['clovis']}]}))).indexOf('Jamy')<0);
  t('someone already on it by EMAIL (another spelling) is not offered',
    names(run(Object.assign({}, base, {people:[{first:'Trin', last:'M', email:'Trinity@Example.com', offices:['clovis']}]}))).indexOf('Trinity')<0);
  t('on payroll at ANOTHER office still counts as new here (Two Zzoffices on Hobbs only -> offered at Clovis)',
    names(run(Object.assign({}, base, {people:[{first:'Two', last:'Zzoffices', offices:['hobbs']}]})))==='Jamy Zzaguilar@clovis,Trinity Zzmoccabee@clovis,Two Zzoffices@clovis');
  t('someone taken off payroll is not offered again (still on the list, marked)',
    names(run(Object.assign({}, base, {people:[{id:'x', first:'Jamy', last:'Zzaguilar', offices:['clovis']}], S:{removed:{x:'2026-11-17'}}}))).indexOf('Jamy')<0);
  t('skipped at Clovis is not offered at Clovis, still offered at Hobbs',
    names(run(Object.assign({}, base, {S:{notPaid:{clovis:['name:two zzoffices']}}})))==='Jamy Zzaguilar@clovis,Trinity Zzmoccabee@clovis,Two Zzoffices@hobbs');
  t('a 9th office from Admin -> Locations is included with no change', (()=>{
    const R2=ROSTER.concat([{name:'New Zzoffice', offices:['Roswell'], teams:['Staff'], _added:true}]);
    const env=Object.assign({}, base, {OFFICES:OFFS.concat([{k:'xroswell', n:'Roswell'}]), PH:Object.assign(PHs(true), {rosterView:()=>R2})});
    return names(run(env)).indexOf('New Zzoffice@xroswell')>=0;
  })());

  /* ---- where it's saved ---- */
  t('Skip is kept in Heather\'s own folder (settings.json notPaid) - never an office file',
    /liveQueue\('_h','settings', cur=>\{ const x=cur\|\|\{v:1, bonus:\{\}\}; x\.notPaid=x\.notPaid\|\|\{\}; x\.notPaid\[k\]=put\(x\.notPaid\[k\]\); return x; \}\);/.test(H));
  t('and read back with her bonuses, cleaned', /S\.bonus=st\.bonus\|\|\{\};\n\s+S\.notPaid=cleanNotPaid\(st\.notPaid\);/.test(H));
  t('cleanNotPaid keeps only lists of strings', (()=>{
    const c=new Function(H.slice(H.indexOf('  function cleanNotPaid('), H.indexOf('  function newOnList(')) + '; return cleanNotPaid;')();
    return JSON.stringify(c({clovis:['a', 3, '', 'b'], hobbs:'x'}))==='{"clovis":["a","b"]}' && JSON.stringify(c(null))==='{}';
  })());
  t('the card sits at the top of Heather\'s board (someone missing from payroll matters most), only there',
    /let h='<div class="stack">'\+newOnCard\(\)\+'<div class="card"><div class="perhead">/.test(H) && H.split("'+newOnCard()+'").length===2 && H.split('h+=newOnCard()').length===1);
  t('Settings -> People lists who was skipped, with Put back', /skippedHTML\(\)\+/.test(H) && /data-act="newback"/.test(H));
  t('the card\'s buttons only work while it is on (NEWON)', /act==='newadd' && NEWON\(\)/.test(H) && /\(act==='newskip' \|\| act==='newback'\) && NEWON\(\)/.test(H));

  /* ---- Add a person: unchanged unless opened from the card ---- */
  const dlg=H.slice(H.indexOf('  function addPersonDlg('), H.indexOf('  function addDocDlg('));
  const draw=(o, pre)=>{ let out=''; new Function('openDlg','top','esc','poss','OFF','OFFICES','TODAY','el','setTimeout',
      dlg+'; addPersonDlg(o, pre);'.replace('o, pre', JSON.stringify(o)+', '+JSON.stringify(pre||null)))(
      h=>{ out=h; }, x=>'<h>'+x+'</h>', v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
      n=>n+'’s', {clovis:{n:'Clovis'}, hobbs:{n:'Hobbs'}}, [{k:'clovis', n:'Clovis'}, {k:'hobbs', n:'Hobbs'}], '2026-11-17', ()=>null, ()=>0);
    return out; };
  const plain=draw(''), om=draw('clovis'), pre=draw('', {k:'clovis', nm:'Jamy "J" Zzaguilar', em:'jamy@example.com', key:'jamy@example.com'});
  t('Heather\'s Add a person: start date today, no office picked, no email carried (as before)',
    /id="ns" type="date" value="2026-11-17"/.test(plain) && !/selected/.test(plain) && !/id="nem"/.test(plain) && /<h>Add a person<\/h>/.test(plain));
  t('an office\'s Add someone new: as before (no office list, no bonus box)', /Add someone to Clovis’s sheet/.test(om) && !/id="no"/.test(om) && !/id="nb"/.test(om) && !/id="nem"/.test(om));
  t('from the card: name filled in, their office picked, start date EMPTY (she types it), email carried',
    /id="nf" autocomplete="off" value="Jamy &quot;J&quot;"/.test(pre) && /id="nl" autocomplete="off" value="Zzaguilar"/.test(pre) &&
    /<option value="clovis" selected>Clovis<\/option>/.test(pre) && /id="ns" type="date" value=""/.test(pre) && /id="nem" value="jamy@example.com"/.test(pre));
  t('the dialog still saves through Add a person\'s own button (addok), not Add to payroll\'s (addpayok)', /data-act="addok" data-v="'\+\(o\|\|''\)\+'"/.test(dlg));
  t('Add a person keeps that email, links the same person at another office like Fill does',
    /const em=el\('nem'\) \? String\(el\('nem'\)\.value\|\|''\)\.trim\(\)\.toLowerCase\(\) : '';/.test(H) && /const twin=em \? elsewhere\(em, o\) : null;/.test(H) && /em \? \{email:em, from:'team list'\} : \{\}/.test(H));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})();
