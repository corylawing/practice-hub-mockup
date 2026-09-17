/* Replays the 15 Sep 2026 data loss against store.js, and checks that ordinary work
   still saves. Run it before any change to store.js or to how a page saves:

       node test/guard.test.js

   What happened: schedule.html asked for the shared copy, the request failed, the
   failure came back looking exactly like "nothing is saved yet", the page built a
   blank year from that and saved it over a year of real work. The blank year was
   NOT small - every day was present, every cell just empty - so nothing that checks
   payload size would have noticed. That is why weigh() counts content, not bytes. */
const STORE=__dirname+'/../v1/store.js';
const LS={}; global.localStorage={getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)}};
const events=[]; global.document={dispatchEvent:e=>events.push(e)};
global.CustomEvent=class{constructor(t,o){this.type=t;this.detail=o&&o.detail}};
global.window=global;   // in a browser window IS the global

let REMOTE=null, FAIL=false;   // the SharePoint side
global.PH={isLive:()=>true};
global.PH_AUTH={
  token:()=>Promise.resolve('t'),
  graph:p=>{
    if(FAIL) return Promise.reject(new Error('Graph 503: service unavailable'));
    if(/\/sites\/omega/.test(p)) return Promise.resolve({id:'site'});
    if(/lists\?/.test(p))        return Promise.resolve({value:[{id:'L',displayName:'HomeBraceData'}]});
    return Promise.resolve({value: REMOTE===null?[]:[{id:'1',lastModifiedDateTime:'2026-09-14T00:00:00Z',
                                                      fields:{Title:'ph_sched2',Payload:JSON.stringify(REMOTE)}}]});
  }};
global.fetch=(u,o)=>{ if(FAIL) return Promise.reject(new Error('offline'));
  REMOTE=JSON.parse(JSON.parse(o.body).Payload||JSON.parse(o.body).fields.Payload);
  return Promise.resolve({status:200,ok:true,json:()=>Promise.resolve({id:'1'})}); };
require(STORE);
const S=window.PH_STORE;

// Heather's real year: ~250 working days x 8 offices, a doctor number in most cells.
const real={__v:2}; const d=new Date(2026,0,1);
for(let i=0;i<365;i++,d.setDate(d.getDate()+1)){
  if(d.getDay()===0||d.getDay()===6) continue;
  const k=d.toISOString().slice(0,10); real[k]={};
  ['Carlsbad','Clovis','Roswell','Alamogordo'].forEach((o,j)=>{ real[k][o]={doc:'Dr '+(j%3)}; });
}
// A blank year, exactly as startEmpty() builds it: every day present, every cell {}.
const blank={__v:2}; Object.keys(real).forEach(k=>{ if(k!=='__v'){ blank[k]={};
  ['Carlsbad','Clovis','Roswell','Alamogordo'].forEach(o=>{ blank[k][o]={}; }); }});

const ok=[],bad=[];
const t=(n,v)=>{ (v? ok:bad).push(n); };

(async()=>{
  await S.set('ph_sched2', real, {force:true});
  t('Heather’s year saves', S.weigh(REMOTE)>800);
  const saved=JSON.stringify(REMOTE);

  // --- the actual incident: the read fails, the page rebuilds a blank year, it saves
  FAIL=true;
  const got=await S.get('ph_sched2');
  t('a failed read is reported as failed', S.readFailed('ph_sched2')===true);
  FAIL=false;
  const r=await S.set('ph_sched2', blank);
  t('the blank year is REFUSED', r.blocked===true);
  t('SharePoint still holds the real year', JSON.stringify(REMOTE)===saved);
  t('the refusal raises a banner event', events.some(e=>e.type==='ph-save-blocked'));

  // --- the same wipe with a read that worked: rule 2 must still catch it
  const LS2={}; for(const k in LS) LS2[k]=LS[k];
  delete require.cache[require.resolve(STORE)];
  require(STORE); const S2=window.PH_STORE;
  await S2.get('ph_sched2');
  t('read works, so no failure flag', S2.readFailed('ph_sched2')===false);
  const r2=await S2.set('ph_sched2', blank);
  t('blank year refused even after a good read', r2.blocked===true);
  t('real year still intact', JSON.stringify(REMOTE)===saved);

  // --- ordinary work must NOT be blocked
  const edited=JSON.parse(JSON.stringify(real)); edited['2026-03-02'].Carlsbad={doc:'Dr 9',ydot:1};
  t('a normal edit saves', (await S2.set('ph_sched2', edited)).blocked!==true);
  const trimmed=JSON.parse(JSON.stringify(real));
  Object.keys(trimmed).slice(1,60).forEach(k=>delete trimmed[k]);
  t('deleting two months still saves', (await S2.set('ph_sched2', trimmed)).blocked!==true);
  t('a small setting can be cleared', (await S2.set('ph_viewas', null)).blocked!==true);
  t('an explicit restore is never blocked', (await S2.set('ph_sched2', real, {force:true})).blocked!==true);
  t('the replaced copy is kept as a local backup', S2.backup('ph_sched2')!==null);

  /* Feeds that expire on purpose must not trip the guard. The notification feed drops
     anything over three days old, so a quiet weekend legitimately empties it, and each
     person's read-list is pruned to match. Blocking those would cry wolf on background
     bookkeeping and train everyone to ignore the banner. */
  const feed=[]; for(let i=0;i<60;i++) feed.push({id:'a'+i,title:'Schedule updated',by:'Heather',at:'x'});
  await S2.set('ph_activity', feed, {force:true});
  const quietBefore=events.length;
  const fr=await S2.set('ph_activity', [{id:'a99',title:'One new thing',by:'Cory',at:'y'}]);
  t('an expiring feed may shrink to almost nothing', fr.blocked!==true);
  await S2.set('ph_seen_heather@x.com', ['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10','a11','a12','a13','a14'], {force:true});
  const sr=await S2.set('ph_seen_heather@x.com', ['a99']);
  t('a pruned read-list may shrink too', sr.blocked!==true);
  t('and neither raised a banner', events.length===quietBefore);

  /* But the failed-read rule still covers them - writing a feed over a copy we could
     not see would drop whatever other people added to it. */
  FAIL=true; await S2.get('ph_activity'); FAIL=false;
  const nr=await S2.set('ph_activity', feed);
  t('a feed is still not written over a copy we could not read', nr.blocked===true);
  t('and that refusal stays quiet', events.length===quietBefore);

  /* ---- WHOSE COPY WINS -------------------------------------------------------
     2026-09-17: Heather added Dr. Lightheart to the doctor list; Jenny's calendar
     carried on showing the four it already had. get() was keeping whichever copy
     looked newer by clock - and every save on the schedule page rewrote ph_docs, so
     merely using the page stamped the local copy as newer without changing anything.
     A browser whose push had failed then stayed ahead of the shared copy for good. */
  {
    const LS3={};
    global.localStorage={getItem:k=>k in LS3?LS3[k]:null,setItem:(k,v)=>{LS3[k]=String(v)},
                         removeItem:k=>{delete LS3[k]}};
    delete require.cache[require.resolve(STORE)];
    require(STORE); const J=window.PH_STORE;

    const HEATHERS=[{n:'Dr. Farnsworth'},{n:'Dr. Brimhall'},{n:'Dr. Coelho'},
                    {n:'Dr. McBeth'},{n:'Dr. Lightheart'}];
    const JENNYS  =[{n:'Dr. Farnsworth'},{n:'Dr. Brimhall'},{n:'Dr. Coelho'},{n:'Dr. McBeth'}];

    // Jenny's browser holds the old four, stamped with her own clock, far in the future.
    LS3['ph_docs']=JSON.stringify(JENNYS);
    LS3['ph_docs__at']=String(Date.now()+86400000);
    // Heather's five are what SharePoint holds, saved yesterday.
    REMOTE=HEATHERS;
    global.fetch=(u,o)=>Promise.resolve({status:200,ok:true,json:()=>Promise.resolve({id:'1'})});
    global.PH_AUTH.graph=p=>{
      if(/\/sites\/omega/.test(p)) return Promise.resolve({id:'site'});
      if(/lists\?/.test(p))        return Promise.resolve({value:[{id:'L',displayName:'HomeBraceData'}]});
      return Promise.resolve({value:[{id:'1', lastModifiedDateTime:'2026-09-16T22:14:00Z',
        fields:{Title:'ph_docs', Payload:JSON.stringify(HEATHERS)}}]});
    };

    const got=await J.get('ph_docs');
    t('a newer local clock no longer beats the shared copy',
      Array.isArray(got) && got.length===5);
    t('Dr. Lightheart reaches the other browser',
      (got||[]).some(d=>d.n==='Dr. Lightheart'));

    // But a change that genuinely never reached SharePoint must NOT be thrown away.
    global.fetch=()=>Promise.reject(new Error('403 accessDenied'));
    const mine=HEATHERS.concat([{n:'Dr. Nguyen'}]);
    const w=await J.set('ph_docs', mine, {force:true});
    t('a push that SharePoint refuses is reported, not silently kept', w.local===true);
    t('and the browser records that it is holding an unsent change', J.unsent('ph_docs')===true);
    global.fetch=(u,o)=>Promise.resolve({status:200,ok:true,json:()=>Promise.resolve({id:'1'})});
    const back=await J.get('ph_docs');
    t('an unsent change survives the next read', (back||[]).some(d=>d.n==='Dr. Nguyen'));
    await J.set('ph_docs', mine, {force:true});
    t('once it lands, the unsent mark is cleared', J.unsent('ph_docs')===false);
    const after=await J.get('ph_docs');
    t('and the shared copy is trusted again', after.length===5);
  }

  /* ---- THE GUARD WAS DISARMED BY THE READ ------------------------------------
     16/09 21:45. The wipe guard had been live since 13:36 that day and it did not
     stop Jenny's browser writing a blank year over Heather's 489 doctor days, 325
     yellow dot days and 118 closures.

     Not because the guard was wrong, but because it was measuring the wrong thing.
     get() preferred her stale local copy - her clock was ahead of Heather's save -
     reported the read as a SUCCESS, and recorded THAT copy's weight as the baseline.
     So the guard compared her blank year against her own blank year and correctly
     concluded nothing was being lost.

     A guard that takes its baseline from get() is only ever as good as get(). This
     replays the whole thing end to end rather than seeding a baseline by hand, which
     is how the original test missed it: it set local empty and remote full, never
     local STALE and stamped newer - the case that actually happened. */
  {
    const LS4={};
    global.localStorage={getItem:k=>k in LS4?LS4[k]:null,setItem:(k,v)=>{LS4[k]=String(v)},
                         removeItem:k=>{delete LS4[k]}};
    const ev=[]; global.document={dispatchEvent:e=>ev.push(e)};

    const HER={__v:2}; let dd=new Date(2026,0,1);
    for(let i=0;i<365;i++,dd.setDate(dd.getDate()+1)){
      if(dd.getDay()===0||dd.getDay()===6) continue;
      const k=dd.toISOString().slice(0,10); HER[k]={};
      ['Carlsbad','Clovis','Hobbs','Cruces LCO'].forEach((o,n)=>{ HER[k][o]={p:n%4,s:480,e:1020}; });
    }
    const EMPTY={__v:2};
    Object.keys(HER).forEach(k=>{ if(k==='__v') return; EMPTY[k]={};
      ['Carlsbad','Clovis','Hobbs','Cruces LCO'].forEach(o=>{ EMPTY[k][o]={}; }); });

    // Jenny's browser: a blank year, stamped a minute AFTER Heather's save.
    LS4['ph_sched2']=JSON.stringify(EMPTY);
    LS4['ph_sched2__at']=String(Date.parse('2026-09-16T21:44:00Z'));

    global.PH_AUTH.graph=p=>{
      if(/\/sites\/omega/.test(p)) return Promise.resolve({id:'site'});
      if(/lists\?/.test(p))        return Promise.resolve({value:[{id:'L',displayName:'HomeBraceData'}]});
      return Promise.resolve({value:[{id:'1', lastModifiedDateTime:'2026-09-16T21:43:35Z',
        fields:{Title:'ph_sched2', Payload:JSON.stringify(HER)}}]});
    };
    let STORED=JSON.stringify(HER);
    global.fetch=(u,o)=>{ const b=JSON.parse(o.body);
      STORED=(b.Payload!==undefined?b.Payload:b.fields.Payload);
      return Promise.resolve({status:200,ok:true,json:()=>Promise.resolve({id:'1'})}); };

    delete require.cache[require.resolve(STORE)];
    require(STORE); const K=window.PH_STORE;

    const handed=await K.get('ph_sched2');
    const doctorDays=v=>Object.keys(v||{}).filter(k=>/^\d{4}/.test(k))
      .reduce((n,k)=>n+Object.keys(v[k]).filter(o=>v[k][o]&&v[k][o].p!=null).length,0);

    t('a stale local copy stamped newer no longer wins the read', doctorDays(handed)>1000);
    t('so the guard\u2019s baseline is HER year, not the blank one',
      Number(LS4['ph_sched2__w'])>2000);
    const blocked=await K.set('ph_sched2', EMPTY);
    t('the blank year is refused', blocked.blocked===true);
    t('and SharePoint still holds her year', doctorDays(JSON.parse(STORED))>1000);
    t('and somebody is told', ev.some(e=>e.type==='ph-save-blocked'));
  }

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})();
