/* PRODUCTION DAYS FROM THE SCHEDULE (16/11/2026).
       node test/proddays.test.js

   Heather: production days (and completed days, once each day has passed) come from the Schedule, and follow it when
   a doctor's schedule changes - "we will want that to automatically update on the goal production side". The rule was
   checked against her books on live first (Sep-Nov 2026 matched for all 8 offices). Made-up schedule here. */
const fs=require('fs'), path=require('path');
const V1=path.join(__dirname,'..','v1');
const read=f=>fs.readFileSync(path.join(V1,f),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const D=require(path.join(V1,'proddays.js'));

const docs=[{n:'Dr. A'},{n:'Dr. B'},null];          // index 2: a doctor since removed
function sched(){
  const s={};
  const put=(day,o,c)=>{ (s[day]=s[day]||{})[o]=c; };
  // December 2026, Carlsbad: weekdays 1-4 doctor, 7 closed, 8 yellow dot, 9 removed doctor, 10 two doctors (ps),
  // 11 a Friday half day (counts whole), 14 event only (virtual promo - no doctor), 15-31 doctor on weekdays
  ['01','02','03','04'].forEach(d=>put('2026-12-'+d,'Carlsbad',{p:0}));
  put('2026-12-07','Carlsbad',{closed:true}); put('2026-12-08','Carlsbad',{p:0, ydot:true});
  put('2026-12-09','Carlsbad',{p:2}); put('2026-12-10','Carlsbad',{ps:[0,1]});
  put('2026-12-11','Carlsbad',{p:1, s:480, e:720}); put('2026-12-14','Carlsbad',{event:'Virtual Promo Day'});
  for(let d=15; d<=31; d++){ const k='2026-12-'+String(d).padStart(2,'0'); const w=new Date(k+'T12:00:00Z').getUTCDay(); if(w>0 && w<6) put(k,'Carlsbad',{p:0}); }
  put('2026-12-05','Carlsbad',{p:0});            // a Saturday: never a production day
  // August 2026: the Schedule was half blank - and before September anyway
  ['03','04','05'].forEach(d=>put('2026-08-'+d,'Carlsbad',{p:0}));
  // January 2027, Clovis: only 5 weekdays filled in (of 21) -> not scheduled yet
  ['04','05','06','07','08'].forEach(d=>put('2027-01-'+d,'Clovis',{p:0}));
  return s;
}
const S=sched();
let m=D.month(S, docs, 'Carlsbad', 2026, 11, '2026-12-16');
// weekdays with a doctor: 1,2,3,4,10,11 + 15,16,17,18,21,22,23,24,25,28,29,30,31 = 6 + 13 = 19
t('a production day = a weekday with a doctor, not Closed, not Yellow Dot; a Friday half day counts whole; a removed doctor, an event with no doctor and a Saturday don’t',
  m.covered && m.sched===19);
t('completed = those days before today (Dec 16: 1-4, 10, 11, 15)', m.done===7);
t('August 2026 and earlier are never taken from the Schedule', !D.month(S, docs, 'Carlsbad', 2026, 7, '2026-12-16').covered);
t('a month the Schedule hasn’t filled in (fewer than half its weekdays) keeps what was typed', !D.month(S, docs, 'Clovis', 2027, 0, '2026-12-16').covered);
t('an office with nothing scheduled that month: not decided by the Schedule', !D.month(S, docs, 'Hobbs', 2026, 11, '2026-12-16').covered);

const want=D.yearOf(S, docs, 2026, '2026-12-16');
const book={Carlsbad:{days:[0,0,0,0,0,0,0,0,10,10,9,9], done:[0,0,0,0,0,0,0,0,10,10,9,6]}, Hobbs:{days:Array(12).fill(9), done:Array(12).fill(0)}};
let ch=D.changesFor(2026, want, book, '2026-12-16');
t('Dec: production days 9 -> 19 and completed 6 -> 7; nothing for an office/month the Schedule doesn’t decide',
  ch.length===2 && ch.some(c=>c.office==='Carlsbad' && c.month===11 && c.field==='sched' && c.from===9 && c.to===19) && ch.some(c=>c.field==='dys' && c.from===6 && c.to===7) && !ch.some(c=>c.office==='Hobbs'));
ch=D.changesFor(2026, want, book, '2026-11-20');
t('a later month: production days yes, completed days left alone', ch.some(c=>c.month===11 && c.field==='sched') && !ch.some(c=>c.month===11 && c.field==='dys'));
ch=D.changesFor(2026, D.yearOf(S, docs, 2026, '2027-01-05'), book, '2027-01-05');
t('a past month: completed = all its production days', ch.some(c=>c.month===11 && c.field==='dys' && c.to===19));
t('the same numbers: nothing to change', D.changesFor(2026, want, {Carlsbad:{days:[0,0,0,0,0,0,0,0,10,10,9,19], done:[0,0,0,0,0,0,0,0,10,10,9,7]}}, '2026-12-16').length===0);

global.PH_WB={TABS:{'Carlsbad':'Carlsbad (FFO)','Newtown':'Newtown (FFO)'}};
t('the offices are the production book’s offices - a new one is followed as soon as it has its place in the book',
  D.offices().join()==='Carlsbad,Newtown' && Object.keys(D.yearOf({}, docs, 2027, '2026-12-16')).join()==='Carlsbad,Newtown');
delete global.PH_WB;
t('…and the 8 if the book’s list isn’t loaded', D.offices().length===8);
/* sync(): when it writes, and when it doesn't. */
(async()=>{
  function env(o){
    o=o||{};
    const writes=[], LS={};
    global.localStorage={getItem:k=>LS[k]===undefined?null:LS[k], setItem:(k,v)=>{LS[k]=String(v)}, removeItem:k=>{delete LS[k]}};
    global.PH={isLive:()=>o.live!==false, isAdmin:()=>!!o.admin, atLeast:(sec,l)=>!!(o.can||{})[sec], centralNow:()=>({date:'2026-12-16'})};
    global.PH_STORE={get:k=>Promise.resolve(k==='ph_docs' ? (o.docs===undefined?docs:o.docs) : null), readFailed:k=>!!(o.failed||{})[k]};
    global.PH_SCHED={load:()=>Promise.resolve(Object.assign({sched:S, baseFailed:false, failed:[], unknown:false}, o.sched||{}))};
    global.PH_PROD={INDEX:'ph_prod_index', mode:()=>Promise.resolve({source:o.source||'homebrace'}), index:()=>Promise.resolve({years:{2025:{},2026:{},2027:{}}}),
      dashboardData:y=>Promise.resolve({offices: y===2026 ? JSON.parse(JSON.stringify(book)) : {Carlsbad:{days:Array(12).fill(0), done:Array(12).fill(0)}}}),
      setDays:(y,list)=>{ writes.push({y, list}); return Promise.resolve({}); }};
    return {writes, LS};
  }
  let E=env({can:{production:true}}); let r=await D.sync();
  t('someone who can enter production: one save per year that needs it (2025 never looked at)',
    r.wrote===2 && E.writes.length===1 && E.writes[0].y===2026 && E.writes[0].list.length===2 && !('2025' in r.years));
  t('…and it doesn’t look again for 10 minutes on that device', (await D.sync()).skipped==='recently' && E.writes.length===1);
  D.soon(); E.writes.length=0; global.PH_PROD.dashboardData=()=>Promise.resolve({offices:{}});
  t('a Schedule save on the device lets the next page do it at once', !(await D.sync()).skipped);
  E=env({can:{schedule:true}}); r=await D.sync(); t('someone who can change the Schedule: yes', E.writes.length===1);
  E=env({admin:true}); r=await D.sync(); t('an admin: yes', E.writes.length===1);
  E=env({}); r=await D.sync(); t('anyone else: never writes', r.skipped==='not allowed' && !E.writes.length);
  E=env({}); r=await D.sync({dry:true}); t('a dry run (looking only) writes nothing and says what would change', !E.writes.length && r.years[2026].length===2);
  E=env({can:{production:true}, live:false}); r=await D.sync(); t('the sandbox: never', r.skipped==='not allowed' && !E.writes.length);
  E=env({can:{production:true}, source:'excel'}); r=await D.sync(); t('her Excel still the master: nothing written', r.skipped && !E.writes.length);
  E=env({can:{production:true}, sched:{baseFailed:true, sched:null}}); r=await D.sync(); t('the Schedule didn’t read: nothing written', r.skipped==='schedule unread' && !E.writes.length);
  E=env({can:{production:true}, sched:{failed:['ph_sched_2028']}}); r=await D.sync(); t('one year of the Schedule didn’t read: nothing written', r.skipped==='schedule unread' && !E.writes.length);
  E=env({can:{production:true}, sched:{unknown:true}}); r=await D.sync(); t('the list of Schedule years didn’t read: nothing written', r.skipped==='schedule unread' && !E.writes.length);
  E=env({can:{production:true}, failed:{ph_docs:true}}); r=await D.sync(); t('the doctor list didn’t read: nothing written', r.skipped==='doctors unread' && !E.writes.length);
  E=env({can:{production:true}, docs:[]}); r=await D.sync(); t('no doctors at all: nothing written', r.skipped==='doctors unread' && !E.writes.length);
  E=env({can:{production:true}, failed:{ph_prod_index:true}}); r=await D.sync(); t('the production list didn’t read: nothing written', r.skipped && !E.writes.length);
  E=env({can:{production:true}}); global.PH_PROD.dashboardData=()=>Promise.resolve({offices:{Carlsbad:{days:Array(12).fill(0), done:Array(12).fill(0)}}});
  const big={}; for(let d=1; d<=31; d++){ const k='2026-12-'+String(d).padStart(2,'0'); big[k]={Carlsbad:{p:0}}; }
  let threw=''; global.PH_SCHED.load=()=>Promise.resolve({sched:big, failed:[]});
  const many=[]; for(let i=0;i<301;i++) many.push({});
  const realChanges=D.changesFor; // the cap is checked on the list the sync builds
  t('more than 300 changes in a year at once: refused, nothing written (a guard, not a limit anyone should meet)', /if\(list\.length > MAX\) throw new Error/.test(read('proddays.js')) && /MAX = 300/.test(read('proddays.js')));

  /* Wiring. */
  const P=read('prodstore.js'), A=read('prodadmin.js'), X=read('production.html'), I=read('index.html'), SC=read('schedule.html'), AD=read('admin.html');
  t('prodstore.setDays: only production days, 0-31, one History entry "schedule", next year’s "last year" follows',
    /if\(c\.field !== 'sched' && c\.field !== 'dys'\) throw/.test(P) && /n >= 0 && n <= 31/.test(P) && /from:\{how:'schedule', by:me\(\)\}/.test(P) && /setDays:setDays/.test(P));
  t('History says "Production days from the Schedule"', /f\.how === 'schedule' \? 'Production days from the Schedule'/.test(A));
  t('the Dashboard, Enter Production and Admin load it', [I,X,AD].every(h=>/<script src="schedrec\.js\?v=hc\d+"><\/script>/.test(h) && /<script src="proddays\.js\?v=hc\d+"><\/script>/.test(h)));
  t('the Dashboard and Enter Production keep them in step in the background and repaint when something changed',
    /if\(MODE\.source==='homebrace'\)\{ hbShow\(res,n\); daysFromSchedule\(\); return; \}/.test(X) && /daysFromSchedule\(\);\n      \/\/ Her Excel/.test(I) && /PDY\.whenReady\(\)\.then\(\(\)=>PDY\.sync\(\)\)/.test(I));
  t('Enter Production: completed days for a month the Schedule decides are shown, not typed',
    /\(fromSch\(office,month\)\n            \? '<div class="f"><label>Completed production days<\/label>[^\n]*readonly><\/div>'\n            : fld\('Completed production days'/.test(X));
  t('Plan the year: brought up to date first; a month the Schedule decides is read-only (📅); "use last year’s days" skips it',
    /PDY\.sync\(\)\.catch\(function\(\)\{ return null; \}\)\.then\(function\(\)\{ return PDY\.covered\(\+PY\); \}\)/.test(A) && /\? '<td><input class="plsch" value="'\+esc\(v == null \? '' : v\)\+'" readonly tabindex="-1"/.test(A) && /\(v == null && !\(PCOV && PCOV\[PM\.office\] && PCOV\[PM\.office\]\[i\]\)\) \? PM\.lyDays\[i\] : v/.test(A));
  t('a Schedule save clears the wait on that device', /adoptSaved\(res\.parts, res\.sent\);\n        try\{ localStorage\.removeItem\('ph_daysync_at'\); \}catch\(_\)\{\}/.test(SC));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})();
