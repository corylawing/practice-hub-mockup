/* TC TRACKER: WHOSE CONSULTS SHOW IS WORKED OUT AGAIN WHEN WHO-YOU-ARE ARRIVES (23/11/2026, Hobbs).
       node test/tcscope.test.js

   A TC whose offices come from the roster is "no offices" for the first moment after sign-in. The read used to filter
   the consults with that empty list and keep the result: Today stayed empty all morning (only what she added in that
   sitting showed), though every consult was saved. Now rescope() runs after the read and on every identity change.
   Runs tc.html's own rescope() and checks load() and TCPAGE.identity use it. Made-up consults only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ok=[], bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const H=fs.readFileSync(path.join(__dirname,'..','v1','tc.html'),'utf8');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };

const RS=fnOf(H,'rescope'), LD=fnOf(H,'load');
t('rescope() exists', !!RS);
t('load() keeps its consults through rescope() (not a filter frozen at the read)', LD.indexOf('rescope();')>0 && !/ALL=EVERY\.filter\(r=>offs/.test(LD));
t('TCPAGE.identity re-scopes before drawing', /identity:\(\)=>\{[^}]*rescope\(\);[^}]*render\(\);/.test(H));
t('ph-identity and ph-signed-in both call TCPAGE.identity', /ph-identity',function\(\)\{if\(window\.TCPAGE\)TCPAGE\.identity\(\)/.test(H) && /ph-signed-in',function\(\)\{[^<]*TCPAGE\.identity\(\)/.test(H));

/* the morning: the read lands while her offices are still unknown, then the roster arrives */
const w={mine:[], ALL:[], EVERY:[]};
vm.createContext(w);
vm.runInContext('var myOffices=()=>mine;\n'+RS, w);
const c=(id,office,date)=>({id, office, date, time:'09:00', tc:'Dana Ruiz'});
w.EVERY=[c('a1','Hobbs','2026-11-23'), c('a2','Hobbs','2026-11-23'), c('a3','Carlsbad','2026-11-23'), c('a4','Hobbs','2026-11-19')];
vm.runInContext('rescope()', w);
t('offices not known yet: shows nothing (and says nothing wrong is saved)', w.ALL.length===0);
w.mine=['Hobbs']; vm.runInContext('rescope()', w);
t('roster lands: every Hobbs consult shows, Carlsbad stays out', w.ALL.map(r=>r.id).join()==='a1,a2,a4');
t('Today (23rd) has both consults logged days ahead', w.ALL.filter(r=>r.date==='2026-11-23').length===2);
w.mine=['Hobbs','Carlsbad']; vm.runInContext('rescope()', w);
t('a second office added later shows too', w.ALL.length===4);
w.mine=[]; vm.runInContext('rescope()', w);
t('nothing is removed from the read itself (EVERY untouched)', w.EVERY.length===4);

/* ---- 2. never "nothing logged" while it doesn't know your offices ---- */
const RD=fnOf(H,'render');
t('render: no offices + still learning -> "One moment… finding your offices"', /if\(!myOffices\(\)\.length\)\{[\s\S]*?PH\.learning\(\)\)[\s\S]*?One moment… finding your offices/.test(RD));
t('render: no offices, done learning -> says who can fix it (not an empty day)', /No office is set for you yet[\s\S]*?Admin → People/.test(RD));
t('render: that check comes before any tab is drawn', RD.indexOf('if(!myOffices().length)') < RD.indexOf('const v=({today'));

/* ---- 3. the same patient twice on one day ---- */
const TC=require('../v1/tc.js');
const pick=n=>{ const i=H.indexOf('  const '+n+'='); return H.slice(i, H.indexOf('\n', i)); };
const W2={TC, EVERY:[], JSON, Object, Promise, String, Date};
W2.TCSTORE={reads:0, file:null, update(key, mutate){ this.reads++; this.key=key; const r=mutate(this.file===null?undefined:JSON.parse(JSON.stringify(this.file))); if(r!==undefined) this.wrote=true; return Promise.resolve({unchanged:r===undefined}); }};
vm.createContext(W2);
vm.runInContext(pick('nameKey')+'\n'+pick('digits')+'\n'+fnOf(H,'samePatient')+'\n'+fnOf(H,'findTwin')+'\nthis.samePatient=samePatient; this.findTwin=findTwin;', W2);
const sp=W2.samePatient;
t('same name, any case/spaces/punctuation = same patient', sp({name:'Mia  Delgado-Ruiz'},{name:'mia delgado ruiz'}));
t('different names, no birth date = different', !sp({name:'Mia Ruiz'},{name:'Ana Ruiz'}));
t('name spelled differently but same birth date + phone = same patient', sp({name:'Raylee Hart', dob:'2014-03-02', phone:'(575) 555-0142'},{name:'Raeley Hart', dob:'2014-03-02', phone:'575.555.0142'}));
t('same birth date + same chart = same patient', sp({name:'A B', dob:'2014-03-02', chart:'H-1182'},{name:'C D', dob:'2014-03-02', chart:'H-1182'}));
t('same birth date only (twins, different phones) = different', !sp({name:'Lia Cole', dob:'2014-03-02', phone:'5755550100'},{name:'Leo Cole', dob:'2014-03-02', phone:'5755550199'}));
t('short/blank phone never matches on its own', !sp({name:'A', dob:'2014-03-02', phone:''},{name:'B', dob:'2014-03-02', phone:''}));
(async()=>{
  const thu={id:'cThu1', office:'Hobbs', date:'2026-11-23', time:'08:15', name:'Mia Delgado', tc:'Dana Ruiz', upd:'2026-11-19T21:11:00Z'};
  const mon={id:'cNew', office:'Hobbs', date:'2026-11-23', time:'08:15', name:'mia delgado'};
  W2.EVERY=[];                                         // the screen that hadn't caught up: nothing in memory
  W2.TCSTORE.file={v:1, office:'Hobbs', month:'2026-11', consults:{cThu1:thu}};
  let tw=await W2.findTwin(mon);
  t('screen empty but already saved: the fresh read finds it', tw && tw.id==='cThu1');
  t('...reading the right office-month, and never writing', W2.TCSTORE.key==='ph_tclog_hobbs_2026-11' && !W2.TCSTORE.wrote);
  t('a deleted copy is not a twin', (W2.TCSTORE.file.consults.cThu1=Object.assign({}, thu, {deleted:true}), !(await W2.findTwin(mon))));
  W2.TCSTORE.file.consults.cThu1=thu;
  t('another day is not a twin', !(await W2.findTwin(Object.assign({}, mon, {date:'2026-11-24'}))));
  t('another office is not a twin', !(await W2.findTwin(Object.assign({}, mon, {office:'Carlsbad'}))));
  W2.EVERY=[thu]; const n0=W2.TCSTORE.reads;
  t('already on screen: found without a read', (await W2.findTwin(mon)).id==='cThu1' && W2.TCSTORE.reads===n0);
  W2.EVERY=[]; W2.TCSTORE.update=()=>Promise.reject(new Error('SharePoint 503'));
  t('can\'t read: no twin claimed (the save reads first and says so)', (await W2.findTwin(mon))===null);

  /* saveConsult itself: asks once, "Save anyway" saves, a new consult only */
  const W3={TC, EVERY:[], DLG:null, JSON, Object, Promise, String, Date, saved:[], drawn:0};
  W3.TCSTORE={update:(k,m)=>{ m({v:1, consults:{cThu1:thu}}); return Promise.resolve({}); }};
  vm.createContext(W3);
  vm.runInContext(pick('nameKey')+'\n'+pick('digits')+'\n'+fnOf(H,'samePatient')+'\n'+fnOf(H,'findTwin')+'\n'+fnOf(H,'saveConsult')+
    '\nfunction problems(){ return ""; } function drawDlg(){ drawn++; } function persist(r){ saved.push(r.id); return Promise.resolve(""); }'+
    '\nfunction copyFor(){ return {}; } function closeDlg(){ DLG=null; } function render(){} function toast(){} function fmtS(s){ return s; }'+
    '\nthis.go=()=>saveConsult(); this.setDlg=d=>{ DLG=d; }; this.dlg=()=>DLG;', W3);
  const d={isNew:true, rec:Object.assign({}, mon)}; W3.setDlg(d); W3.go(); await new Promise(r=>setTimeout(r,20));
  t('new consult for a patient already logged that day: not saved, asks', W3.saved.length===0 && d.twin && d.twin.id==='cThu1' && !d.busy);
  d.dupOk=!!d.twin; d.twin=null; W3.go(); await new Promise(r=>setTimeout(r,20));
  t('"Save anyway": saved once', W3.saved.join()==='cNew');
  const d2={isNew:true, rec:{id:'cNew2', office:'Hobbs', date:'2026-11-23', name:'Noah Price'}}; W3.setDlg(d2); W3.go(); await new Promise(r=>setTimeout(r,20));
  t('a different patient: saved straight away', W3.saved.join()==='cNew,cNew2' && !d2.twin);
  const d3={isNew:false, rec:Object.assign({}, thu)}; W3.setDlg(d3); W3.go(); await new Promise(r=>setTimeout(r,20));
  t('editing an existing consult never asks', W3.saved.slice(-1)[0]==='cThu1' && !d3.twin);
  t('page: footer shows "Already logged" with Open that one / Save anyway', /else if\(d\.twin\)[^\n]*Already logged/.test(H) && /data-act="twin-open"/.test(H) && /data-act="twin-save"/.test(H));
  t('page: changing name/date/office/dob/phone/chart asks again', /TWIN_FIELDS=\['name','date','office','dob','phone','chart'\]/.test(H) && (H.match(/TWIN_FIELDS\.indexOf\(t\.dataset\.f\)>=0\)\{ DLG\.twin=null; DLG\.dupOk=false; \}/g)||[]).length===2);

  /* ---- 4. a tab left open reads again; a consult just saved never drops off ---- */
  t('back on the tab after 5+ minutes, or a new day: reads again', /visibilitychange[\s\S]{0,200}5\*60e3[\s\S]{0,80}today\(\)!==readDay/.test(H));
  t('never under an open form (waits for it to close)', /if\(DLG\)\{ wantRead=true; return; \}/.test(H) && /if\(wantRead && !DLG\) freshen\(\)/.test(H));
  t('a re-read that fails keeps what is on screen', /if\(quiet && loaded && !loadErr\)\{ toast\(/.test(LD.replace(/\s+/g,' ').replace(/\( /g,'(')) || /if\(quiet && loaded && !loadErr\)/.test(H));
  const W4={EVERY:[], MINE:{}, String, Object}; vm.createContext(W4);
  const ovl=H.slice(H.indexOf('  function overlayMine('), H.indexOf('  let readDay='));
  vm.runInContext(ovl+'\nthis.ov=overlayMine; this.set=(e,m)=>{ EVERY=e; MINE=m; }; this.get=()=>EVERY;', W4);
  W4.set([{id:'x', upd:'2026-11-23T10:00:00Z', outcome:''}], {x:{id:'x', upd:'2026-11-23T10:05:00Z', outcome:'Started'}, y:{id:'y', upd:'2026-11-23T10:06:00Z'}}); W4.ov();
  t('a read that began before my save: my newer copy and my new consult stay', W4.get().find(r=>r.id==='x').outcome==='Started' && W4.get().some(r=>r.id==='y'));
  W4.set([{id:'x', upd:'2026-11-23T11:00:00Z', outcome:'Pending'}], {x:{id:'x', upd:'2026-11-23T10:05:00Z', outcome:'Started'}}); W4.ov();
  t('someone else\'s later change wins over my older copy', W4.get()[0].outcome==='Pending');
  W4.set([{id:'z', upd:'2026-11-23T09:00:00Z'}], {z:{deleted:true, upd:'2026-11-23T10:00:00Z'}}); W4.ov();
  t('a consult I deleted stays off', W4.get().length===0);
  t('persist remembers what it saved (MINE)', /MINE\[rec\.id\]=saved\.deleted \? \{deleted:true, upd:saved\.upd\} : Object\.assign\(\{\}, shown\);/.test(H));
  t('load() lays MINE over the read before scoping', /EVERY=TC\.consultsFrom\(L\)\.filter\(TC\.live\);\s*overlayMine\(\);/.test(H));

  console.log(ok.length+' passed, '+bad.length+' failed'); bad.forEach(n=>console.log('  FAIL '+n)); process.exit(bad.length?1:0);
})();

/* (end) */
