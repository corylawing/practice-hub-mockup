/* TC TRACKER: A SAVE NEVER UNDOES SOMEONE ELSE'S, A MOVE NEVER LOSES THE CONSULT (21/11/2026, code review).
       node test/tcsave.test.js

   Runs tc.html's own persist() against a stand-in TCSTORE (read, change, write - as tcstore.js does), with the real
   tc.js. 1) A call list open since 8:00, someone marks the patient Started at 10:00, the TC adds a note at 14:00: the
   start and the other person's call-log line stay. 2) Moving a consult to another month: the old month is marked
   "moved" only after the new month's write has landed; a failed write leaves it where it was and says "not moved".
   Then the form: Escape / a tap outside never closes it while saving, and asks first when there are changes; the
   settings can't be saved over the real lists after a failed read; the search waits for a pause in typing.
   Made-up patients only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const TC=require('../v1/tc.js');
const ok=[], bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const H=fs.readFileSync(path.join(__dirname,'..','v1','tc.html'),'utf8');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
const clone=v=>v===undefined ? undefined : JSON.parse(JSON.stringify(v));

/* the stand-in folder: one record per office-month, read then written; a key can be set to fail */
function store(){
  const S={db:{}, writes:[], failWrite:{}, failRead:{}};
  S.TCSTORE={update(key, mutate){
    if(S.failRead[key]) return Promise.reject(new Error('SharePoint 503 reading '+key));
    const next=mutate(S.db[key]===undefined ? undefined : clone(S.db[key]));
    if(next===undefined) return Promise.resolve({value:S.db[key], unchanged:true});
    if(S.failWrite[key]) return Promise.reject(new Error('SharePoint 503'));
    S.db[key]=clone(next); S.writes.push(key); return Promise.resolve({value:next});
  }};
  return S;
}
/* tc.html's strip() + persist(), exactly as written there */
const block=H.slice(H.indexOf('  const strip='), H.indexOf('  const keyOf='));
function page(S, who){
  const w={TC, TCSTORE:S.TCSTORE, ALL:[], EVERY:[], myMail:()=>'', myName:()=>who||'Luis Ortega', JSON, Object, Date, Promise, Error, console};
  vm.createContext(w); vm.runInContext(block, w);
  w.load=()=>{ w.ALL.length=0; w.EVERY.length=0; TC.consultsFrom(S.db).filter(TC.live).forEach(r=>{ w.ALL.push(r); w.EVERY.push(r); }); };
  return w;
}
const NOV='ph_tclog_hobbs_2026-11', DEC='ph_tclog_hobbs_2026-12';
const seed=()=>({v:1, office:'Hobbs', month:'2026-11', consults:{
  c1:{id:'c1', office:'Hobbs', date:'2026-11-03', name:'Pat Example', phone:'(575) 555-0101', outcome:'Pending', reason:'Thinking about it', fuStatus:'Open', fuDone:'No', nextFU:'2026-11-20', tc:'Luis Ortega',
    calls:[{at:'2026-11-05T15:00:00.000Z', day:'2026-11-05', by:'Selene', what:'📞 Called', note:'Left a voicemail', next:'2026-11-20'}], upd:'2026-11-05T15:00:00.000Z'},
  c2:{id:'c2', office:'Hobbs', date:'2026-11-12', name:'Sam Sample', outcome:'', tc:'Luis Ortega', upd:'2026-11-12T15:00:00.000Z'}}});
// Someone else, on another computer, marks Pat started and logs it (10:00).
function startedElsewhere(S){
  const c=S.db[NOV].consults.c1; TC.DO.started(c, '2026-11-21', '2026-11-21', 'No');
  TC.addCall(c, {at:'2026-11-21T16:00:00.000Z', day:'2026-11-21', by:'Maya Chen', what:'✅ Started', note:'Came in today', next:''});
  c.upd='2026-11-21T16:00:00.000Z';
}

(async ()=>{
  /* ---------- 1. a save starts from the stored consult ---------- */
  {
    const S=store(); S.db[NOV]=seed(); const P=page(S); P.load();          // 8:00 - the call list opens
    startedElsewhere(S);                                                    // 10:00 - someone else: Started
    // 14:00 - the TC adds a note from the page opened at 8:00 (saveFu's own steps)
    const was=P.ALL.find(x=>x.id==='c1'), orig=clone(was), r=Object.assign({}, was);
    TC.addCall(r, {at:'2026-11-21T20:00:00.000Z', day:'2026-11-21', by:'Luis Ortega', what:'📝 Note', note:'Mom will call back', next:''});
    await P.persist(r, TC.logKey(r.office, TC.monthOf(r.date)), orig);
    const c=S.db[NOV].consults.c1;
    t('1: a note from a page open since 8:00 keeps the 10:00 start (outcome, status, start date)', c.fuStatus==='Closed - started' && c.startDate==='2026-11-21' && c.fuDone==='Yes');
    t('1: …and the call log keeps every line, in order: the first call, the other person’s, the new note', (c.calls||[]).map(x=>x.by).join()==='Selene,Maya Chen,Luis Ortega');
    t('1: the page now shows the stored copy (Started), not its own stale one', P.ALL.find(x=>x.id==='c1').fuStatus==='Closed - started' && P.ALL.find(x=>x.id==='c1').calls.length===3);
    t('1: the other consult in the month is untouched', JSON.stringify(c && S.db[NOV].consults.c2)===JSON.stringify(seed().consults.c2));
  }
  {
    const S=store(); S.db[NOV]=seed(); const P=page(S); P.load();
    const was=P.ALL.find(x=>x.id==='c1'), orig=clone(was), rec=Object.assign({}, was);    // the consult form opens (openConsult)
    startedElsewhere(S);
    rec.phone='(575) 555-0199';                                                             // the TC fixes the phone
    await P.persist(rec, TC.logKey(rec.office, TC.monthOf(rec.date)), orig);
    const c=S.db[NOV].consults.c1;
    t('1: the consult form writes only what it changed (the phone); the start made meanwhile stays', c.phone==='(575) 555-0199' && c.fuStatus==='Closed - started' && c.calls.length===2);
    t('1: who saved it and when are updated', c.updBy==='Luis Ortega' && c.upd>'2026-11-21T16:00:00.000Z');
  }
  {
    const S=store(); S.db[NOV]=seed(); const P=page(S); P.load();
    const was=P.ALL.find(x=>x.id==='c1'), orig=clone(was), rec=Object.assign({}, was);
    startedElsewhere(S);
    TC.setOutcome(rec, 'Refused Treatment');                                                // both changed the outcome: the last save wins
    await P.persist(rec, TC.logKey(rec.office, TC.monthOf(rec.date)), orig);
    t('1: a field both changed: the later save wins (as before)', S.db[NOV].consults.c1.outcome==='Refused Treatment' && S.db[NOV].consults.c1.calls.length===2);
  }
  {
    const S=store(); S.db[NOV]=seed(); const P=page(S); P.load();
    const n={id:'c9', office:'Hobbs', date:'2026-11-21', name:'New Patient', outcome:'', tc:'Luis Ortega', notes:'', gone:undefined};
    await P.persist(n, null);
    t('1: a new consult is written as typed (empty fields stripped)', S.db[NOV].consults.c9.name==='New Patient' && !('gone' in S.db[NOV].consults.c9) && P.ALL.some(x=>x.id==='c9'));
  }
  {
    const m=TC.mergeCalls([{at:'a', by:'x', what:'📞 Called'}, {at:'b', by:'y', what:'📝 Note', note:'n'}], [{at:'a', by:'x', what:'📞 Called'}, {at:'c', by:'z', what:'📝 Note', note:'m'}]);
    t('1: call logs join by time + who, stored order first, nothing twice', m.map(e=>e.at).join()==='a,b,c');
    t('1: nothing stored (a new consult, a moved marker): the form’s copy', TC.mergeConsult(undefined, null, {id:'q', name:'A'}).name==='A' && TC.mergeConsult({moved:true, to:'x'}, null, {id:'q', name:'A'}).name==='A');
  }

  /* ---------- 2. moving a consult to another month ---------- */
  {
    const S=store(); S.db[NOV]=seed(); const P=page(S); P.load();
    const was=P.ALL.find(x=>x.id==='c2'), orig=clone(was), rec=Object.assign({}, was, {date:'2026-12-02'});
    S.failWrite[DEC]=true;
    let err=''; try{ await P.persist(rec, NOV, orig); }catch(e){ err=e.message; }
    t('2: the new month’s write fails -> it says it wasn’t moved', /wasn’t moved/.test(err) && /503/.test(err));
    t('2: …and the consult is still whole in its old month (no "moved" marker written)', S.db[NOV].consults.c2.name==='Sam Sample' && !S.db[NOV].consults.c2.moved && S.writes.indexOf(NOV)<0 && !S.db[DEC]);
    t('2: …and it still shows', TC.consultsFrom(S.db).some(x=>x.id==='c2' && x.date==='2026-11-12'));
    delete S.failWrite[DEC]; S.writes.length=0;
    S.db[NOV].consults.c2.outcome='No Show'; S.db[NOV].consults.c2.upd='2026-11-21T16:00:00.000Z';   // meanwhile, someone marks a no-show
    await P.persist(rec, NOV, orig);
    t('2: a move writes the new month first, then marks the old one', S.writes.join()===DEC+','+NOV && S.db[NOV].consults.c2.moved===true && S.db[NOV].consults.c2.to===DEC);
    t('2: the moved copy starts from the stored one (the no-show made meanwhile stays)', S.db[DEC].consults.c2.outcome==='No Show' && S.db[DEC].consults.c2.date==='2026-12-02');
    t('2: it shows once, on its new date', TC.consultsFrom(S.db).filter(x=>x.id==='c2').map(x=>x.date).join()==='2026-12-02');
  }
  {
    const S=store(); S.db[NOV]=seed(); const P=page(S); P.load();
    const was=P.ALL.find(x=>x.id==='c2'), orig=clone(was), rec=Object.assign({}, was, {date:'2026-12-02'});
    S.failRead[NOV]=true;
    let err=''; try{ await P.persist(rec, NOV, orig); }catch(e){ err=e.message; }
    t('2: the old month can’t be read -> nothing written anywhere, "not moved"', /wasn’t moved/.test(err) && !S.writes.length);
  }
  {
    const S=store(); S.db[NOV]=seed(); const P=page(S); P.load();
    const was=P.ALL.find(x=>x.id==='c2'), orig=clone(was), rec=Object.assign({}, was, {date:'2026-12-02'});
    S.failWrite[NOV]=true;                                                    // the new month lands, the marker doesn't
    let warn=null, err=''; try{ warn=await P.persist(rec, NOV, orig); }catch(e){ err=e.message; }
    t('2: the marker fails after the new month landed -> saved, with a plain warning (it shows once, nothing lost)', !err && /old month couldn’t be updated/.test(warn) &&
      TC.consultsFrom(S.db).filter(x=>x.id==='c2').map(x=>x.date).join()==='2026-12-02');
  }

  /* ---------- 4. the form: never closed while saving; asks first when there are changes ---------- */
  {
    const w={DLG:null, drew:0, closed:0, JSON}; w.drawDlg=()=>{ w.drew++; }; w.closeDlg=()=>{ w.closed++; w.DLG=null; };
    vm.createContext(w); vm.runInContext(fnOf(H,'askClose'), w);
    const open=(o)=>{ w.DLG=Object.assign({kind:'consult', rec:{name:'A'}}, o); w.DLG.start=JSON.stringify({name:'A'}); w.drew=0; w.closed=0; };
    open({busy:true}); w.askClose(); t('4: Escape / a tap outside while "Saving…": the form stays', w.closed===0 && !!w.DLG);
    open({saving:true}); w.askClose(); t('4: …also while Save waits for the last spoken words', w.closed===0);
    open({}); w.DLG.rec.name='B'; w.askClose(); t('4: with changes: asks first (in the form), doesn’t close', w.closed===0 && w.DLG.confirmClose===true && w.drew===1);
    open({}); w.askClose(); t('4: no changes: closes', w.closed===1);
    open({ro:true}); w.DLG.rec.name='B'; w.askClose(); t('4: read-only: closes', w.closed===1);
    open({kind:'slot'}); w.askClose(); t('4: other dialogs: close as before', w.closed===1);
    open({}); w.DLG.newDate='2026-12-01'; w.askClose(); t('4: a new consult date typed counts as a change', w.DLG.confirmClose===true);
  }
  t('4: Escape and the backdrop go through askClose; × / Cancel / Close do nothing while saving', /e\.key==='Escape' && DLG\) askClose\(\)/.test(H) && /if\(e\.target===el\('dlg'\)\) askClose\(\)/.test(H) &&
    /if\(act==='close'\)\{ if\(DLG && \(DLG\.busy \|\| DLG\.saving\)\) return; closeDlg\(\)/.test(H) && /if\(act==='close-yes'\)\{ if\(DLG && \(DLG\.busy \|\| DLG\.saving\)\) return;/.test(H));
  t('4: a failed save after the form closed says so (a red toast), it never redraws a closed form', (fnOf(H,'saveConsult').match(/if\(DLG===d\) drawDlg\(\); else toast\(d\.err, true\)/g)||[]).length===1 &&
    /if\(DLG===d\) drawDlg\(\); else toast\(d\.err, true\)/.test(fnOf(H,'saveFu')) && /d\.confirmDel=false; if\(DLG===d\) drawDlg\(\); else toast\(d\.err, true\)/.test(H));
  t('4: the "Close without saving?" footer is in-page, like Delete', /<b>Close without saving\?<\/b>/.test(H) && /data-act="close-no">Keep editing/.test(H) && /else if\(d\.confirmClose\) h\+=closeAsk;/.test(H));
  t('4: the forms hand persist() the copy they opened with', /persist\(r, d\.isNew\?null:d\.origKey, d\.isNew\?null:d\.orig\)/.test(H) && /orig:JSON\.parse\(JSON\.stringify\(r\)\)/.test(H) &&
    /persist\(r, keyOf\(r\), orig\)/.test(H) && /persist\(r, d\.origKey, d\.orig\)/.test(H));

  /* ---------- 5. settings after a failed read ---------- */
  t('5: a failed read of the settings is remembered (PH_STORE.readFailed), not taken as "no settings"', /LISTS_BAD=!!\(PH_STORE\.readFailed && PH_STORE\.readFailed\(TC\.LISTS_KEY\)\)/.test(H));
  t('5: Settings says so in the page, Save is off and refused until a read works; Try again reads again', /Couldn’t read the settings - try again\./.test(H) && /data-act="lists-save"'\+\(LISTS_BAD\?' disabled':''\)/.test(H) &&
    /if\(act==='lists-save'\)\{\s*if\(LISTS_BAD\) return;/.test(H) && /act==='lists-retry'[\s\S]{0,200}PH_STORE\.get\(TC\.LISTS_KEY\)/.test(H));

  /* ---------- 9. search and the call list ---------- */
  t('9: the search redraws once typing pauses (150 ms), not on every key, and keeps the cursor', /clearTimeout\(qT\); qT=setTimeout\(/.test(H) && /\}, 150\); return; \}/.test(H) && /n\.setSelectionRange\(pos,pos\)/.test(H));
  t('9: the call list is worked out once per render (tab count, Today, Call list share it)', (H.match(/TC\.callList\(/g)||[]).length===1 && /CALLS=null; renderOffices\(\); renderTabs\(\);/.test(H) &&
    (H.match(/callsNow\(\)/g)||[]).length===4);
  t('9: All TCs: one patients() per set of offices', /pc\[pk\]\|\|\(pc\[pk\]=TC\.patients\(L\)\)/.test(H));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('  FAIL  crashed: '+(e && e.stack || e)); console.log('\n'+ok.length+' passed, '+(bad.length+1)+' failed'); process.exit(1); });
