/* CODE REVIEW FIXES (21/11/2026).
       node test/codereview.test.js
   Enter Production, the Dashboard, the Schedule and Admin's goals. Small checks: the page's own functions, cut out
   of the file and run with stand-ins, plus a few checks on the source where running it would need the whole page. */
const fs=require('fs'), path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const X=read('production.html'), I=read('index.html'), S=read('schedule.html'), A=read('prodadmin.js');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };

/* 1. December typed in January (after the switch): refused, said on the page. */
{ const MOFULL=['January','February','March','April','May','June','July','August','September','October','November','December'];
  let MODE_UNKNOWN=false, MODE={source:'homebrace'}, HB_YEAR=2027, HB_YEARS=[2027,2026], month=11, CENTRAL='2027-01-04';
  const window={PH:{centralNow:()=>({date:CENTRAL})}}, PH=window.PH;
  const el=()=>({querySelectorAll:()=>[]});
  const run=eval('('+'()=>{ '+fnOf(X,'futureMonth')+fnOf(X,'refusal')+' return refusal(); })');
  const r=run();
  t('Dec 2027 on 4 Jan 2027: refused, and told to pick 2026', /December 2027 hasn’t happened yet — for December 2026 pick 2026 in the Year picker\./.test(r));
  month=0; t('…January 2027 on 4 Jan 2027 goes in', run()==='');
  HB_YEAR=2026; HB_YEARS=[2026]; month=11; t('…December 2026 on 4 Jan 2027 goes in', run()==='');
  HB_YEAR=2027; HB_YEARS=[2027]; month=11; t('…with no 2026 to pick, it only says the month hasn’t happened', /December 2027 hasn’t happened yet\.$/.test(run()));
  HB_YEAR=2027; month=0; CENTRAL='2026-12-31'; t('…Central time decides (still 31 Dec in Texas: January 2027 is refused)', /January 2027 hasn’t happened yet/.test(run()));
  MODE={source:'excel'}; t('…her Excel path keeps its own January question (not this one)', run()==='');
  MODE={source:'homebrace'}; MODE_UNKNOWN=true; t('mode() could not be read: Save is refused, said on the page', /Couldn’t tell where the production numbers live/.test(run()));
  t('commit() asks refusal() before anything is sent, and does nothing while a save is on its way',
    /function commit\(\)\{ if\(!office \|\| SAVING\) return;\n    const why=refusal\(\); if\(why\)\{ wbBanner\(why, true\); return; \}/.test(X)); }

/* 4. A box the browser can't read: not saved as "cleared", marked, said. Paste cleans $ and commas. */
{ let office='Carlsbad', month=3, saved=0, banner='';
  const edits={}, key=(o,m)=>o+'|'+m, val=()=>0, medDollars=()=>0, save=()=>{ saved++; }, refreshRight=()=>{}, BASE={Carlsbad:{}};
  const wbBanner=h=>{ banner=h; };
  const box=(bi,v)=>{ const c=new Set(); return {value:v, validity:{badInput:bi}, classList:{add:x=>c.add(x), remove:x=>c.delete(x), has:x=>c.has(x)}}; };
  const E=eval('('+'()=>{ '+fnOf(X,'edit')+fnOf(X,'paste')+' return {edit, paste}; })')();
  const b1=box(true,''); E.edit('tc','',b1);
  t('a box the browser can’t read is NOT recorded as cleared (Save would delete the figure)', !edits['Carlsbad|3'] && saved===0 && b1.classList.has('bad'));
  const b2=box(false,'125000'); E.edit('tc','125000',b2);
  t('…a good number goes in and the mark comes off', edits['Carlsbad|3'].tc===125000 && !b2.classList.has('bad'));
  let prevented=false; const b3=box(false,''); E.paste({clipboardData:{getData:()=>'$125,000'}, target:b3, preventDefault:()=>{ prevented=true; }}, 'tc');
  t('pasting "$125,000" puts in 125000', prevented && b3.value==='125000' && edits['Carlsbad|3'].tc===125000);
  prevented=false; const b4=box(false,'7'); E.paste({clipboardData:{getData:()=>'abc'}, target:b4, preventDefault:()=>{ prevented=true; }}, 'tc');
  t('…text that still isn’t a number is refused, the box keeps what it had, and the page says so', prevented && b4.value==='7' && /isn’t a number/.test(banner));
  prevented=false; E.paste({clipboardData:{getData:()=>'4500'}, target:box(false,''), preventDefault:()=>{ prevented=true; }}, 'tc');
  t('…a plain number is pasted by the browser as before', !prevented);
  t('the boxes stay type=number, carry their field and catch paste', /<input type="number" value="'\+v\+'" data-f="'\+f\+'" oninput="PROD\.edit\(\\''\+f\+'\\',this\.value,this\)" onpaste="PROD\.paste\(event,\\''\+f\+'\\'\)">/.test(X));
  t('Save refuses while any box can’t be read, naming it', /i\.validity && i\.validity\.badInput/.test(fnOf(X,'refusal')) && /the page can read/.test(fnOf(X,'refusal'))); }

/* 3. The office/month/year a save is FOR are taken at the start and used throughout. */
{ const P=X.slice(X.indexOf('async function pushToWorkbook(){'), X.indexOf('  /* SAVED = DONE.'));
  const after=P.slice(P.indexOf('const ctx='));
  t('pushToWorkbook takes office, month and year once, at the start', /const o=office, m=month, y=HB_YEAR;/.test(P) && /const ctx=\{o:o, m:m, y:y, sy:shownYear\(\), yp:yr\(\), vals:vals\};/.test(P));
  t('…and never reads the on-screen office or month after that', !/\boffice\b|\bmonth\b/.test(after.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/'[^'\n]*'/g,'')));
  t('…Home-Brace, her Excel copy and the old Excel loop all write to the captured office and month',
    /PH_PROD\.setValues\(y, o, m, values\)/.test(P) && /writeCell\(PH_AUTH\.token, WB_DRIVE, WB_ITEM, o, f, m, values\[f\]\)/.test(P) && /writeCell\(PH_AUTH\.token, WB_DRIVE, WB_ITEM, o, f, m, v\)/.test(P));
  // settled(): the saved office/month, a box retyped while it travelled stays typed
  const BASEKEY={tc:'tc', adj:'adj', mds:'mds', dys:'dys', goal:'goal', str:'str'}, z=()=>Array(12).fill(0);
  const BASE={Carlsbad:{tc:z()}, Hobbs:{tc:z()}}; let HB_YEAR=2026; const save=()=>{};
  const edits={'2026|Carlsbad|9':{tc:5000, adj:-20, _at:1}, '2026|Hobbs|3':{tc:77, _at:1}};
  const settled=eval('('+'()=>{ '+fnOf(X,'settled')+' return settled; })')();
  edits['2026|Carlsbad|9'].adj=-30;   // typed again while the save travelled
  settled(['tc','adj'], {o:'Carlsbad', m:9, y:2026, yp:'2026|', vals:{tc:5000, adj:-20}});
  t('settled(): the office and month the save was FOR get the saved figure; the one now on screen is untouched',
    BASE.Carlsbad.tc[9]===5000 && BASE.Hobbs.tc[3]===0 && edits['2026|Hobbs|3'].tc===77);
  t('…a box typed again while it travelled stays typed (it was dropped and its new figure lost)', edits['2026|Carlsbad|9'] && edits['2026|Carlsbad|9'].adj===-30 && edits['2026|Carlsbad|9'].tc===undefined);
  HB_YEAR=2027; BASE.Carlsbad.tc=z(); edits['2027|Carlsbad|1']={tc:1, _at:1}; edits['2026|Carlsbad|1']={tc:9, _at:1};
  settled(['tc'], {o:'Carlsbad', m:1, y:2026, yp:'2026|', vals:{tc:9}});
  t('…another year on screen by then keeps its own figures', BASE.Carlsbad.tc[1]===0 && edits['2027|Carlsbad|1'].tc===1 && !edits['2026|Carlsbad|1']);
  t('the pickers are locked while a save is on its way', /function lock\(on\)\{\n    SAVING=on;/.test(X) && /function setOffice\(o\)\{ if\(!o \|\| SAVING\) return;/.test(X) && /function setMonth\(m\)\{ if\(SAVING\) return;/.test(X) &&
    /MODE\.source!=='homebrace' \|\| SAVING\) return;/.test(X) && /\(SAVING\?' disabled':''\)\+' onclick="PROD\.month\('/.test(X) && /lock\(true\); const free=\(\)=>lock\(false\); pushToWorkbook\(\)\.then\(free, free\);/.test(X)); }

/* 6 + 10. Who entered: once per save that landed. Late: once per office and month, from the 1st of next month. */
{ t('no SharePoint write on every keystroke: edit() no longer stamps who entered', !/ph_prodaudit/.test(fnOf(X,'edit')) && /function stampAudit\(o\)/.test(X));
  const P=X.slice(X.indexOf('async function pushToWorkbook(){'), X.indexOf('  /* SAVED = DONE.'));
  t('…stamped after a save lands (Home-Brace, her Excel, the sandbox), for the office saved', (P.match(/stampAudit\((o|office)\)/g)||[]).length===3 && /settled\(Object\.keys\(values\), ctx\);[\s\S]{0,400}stampAudit\(o\);/.test(P));
  const LS={}; const localStorage={getItem:k=>LS[k]||null, setItem:(k,v)=>{ LS[k]=String(v); }};
  const feed=[]; const PH={logActivity:e=>feed.push(e), activity:()=>feed}, MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], LEAD=[];
  const HB_YEAR=2026, val=()=>0, NOW=Date.UTC(2026,10,12,18);   // 12 Nov 2026
  const realNow=Date.now; Date.now=()=>NOW;
  const tell=eval('('+'()=>{ '+fnOf(X,'tellLeadership')+' return tellLeadership; })')();
  const c={o:'Hobbs', m:9, y:2026, sy:2026, vals:{tc:1}};
  tell(c); tell(c); tell(c);
  const late=feed.filter(e=>e.kind==='late');
  t('“entered late” is said once for an office and month, however often it is saved', late.length===1);
  t('…counted from 1 November: entered on the 12th = 11 days late (it said 12)', late[0] && /Hobbs’s Oct numbers were entered 11 days after month end/.test(late[0].title));
  feed.length=0; tell({o:'Hobbs', m:10, y:2026, sy:2026, vals:{tc:1}});
  t('…and the month in progress is never late', !feed.some(e=>e.kind==='late'));
  Date.now=realNow; }

/* 12. The background repaint doesn't rebuild the form under someone typing. */
t('production days from the Schedule repaint quietly while a box has focus', /function quietRender\(\)\{/.test(X) && /v\.contains\(a\) && a\.tagName==='INPUT'\)\)\{ render\(\); return; \}/.test(fnOf(X,'quietRender')) &&
  /COVER=c; quietRender\(\);/.test(fnOf(X,'daysFromSchedule')) && /fillBase\(res,false\); quietRender\(\);/.test(fnOf(X,'daysFromSchedule')) && /<input class="ro" id="dysro" value="/.test(X));

/* 13. Enter Production: no Edit vs. no office in this year's numbers. */
t('“can’t enter” and “none of your offices are in this year’s numbers” are told apart', /None of your offices are in '\+shownYear\(\)\+'’s production numbers/.test(X) && /This role can\\'t enter production numbers/.test(X));

/* The switch can't be read: say so and stop (coordinator, 21/11/2026). */
t('Enter Production: mode() rejected = banner, nothing read, nothing saved', /try\{ MODE=await PH_PROD\.mode\(\); \}\n        catch\(_\)\{ MODE_UNKNOWN=true; wbBanner\('<b>Couldn\\u2019t tell where the production numbers live right now \\u2014 reload to try again\.<\/b>', true\); return; \}/.test(X));
t('Dashboard: mode() rejected = banner, no Excel read', /try\{ mode=await PH_PROD\.mode\(\); \}\n      catch\(_\)\{ banner\('<b>Couldn\\u2019t tell where the production numbers live right now \\u2014 reload to try again\.<\/b>', true\); return false; \}/.test(I));
t('…the sandbox (no PH_PROD) behaves as before', /if\(window\.PH_PROD\)\{\n\s*try\{ MODE=await/.test(X) && /if\(window\.PH_PROD\)\{\n      try\{ mode=await/.test(I));

/* 5. Dashboard: days filled in from the Schedule but no production yet = pending, not "behind pace". */
{ const g=fnOf(I,'gauges');
  t('pending also when production is still 0; paced only with days AND production',
    /const paced = inProgress\(o\) && c0>=0 && o\.done\[c0\]>0 && o\.act\[c0\]>0;/.test(g) && /const pending = inProgress\(o\) && c0>=0 && \(!o\.done\[c0\] \|\| !o\.act\[c0\]\);/.test(g));
  t('…and it says what it is waiting for', /'\\u23f3 Enter '\+waitFor\+' to see whether this is on pace\.'/.test(g) && /o\.done\[c0\]\?'no production entered yet':'no days logged yet'/.test(g));
  t('dead code gone (applyEdits, NAVSECS, yearHasGoals; the Schedule’s SAT)', !/applyEdits|NAVSECS|yearHasGoals/.test(I) && !/\bSAT\b/.test(S)); }

/* 9. Dashboard: an identity update keeps the office you picked. */
{ let sel='ALL', chosen=false, allowed=[], cur=null, OFFICES=[{n:'Carlsbad'},{n:'Hobbs'},{n:'Clovis'}], ME={offices:['Carlsbad','Hobbs']};
  const window={PH:{me:()=>ME, isLive:()=>true, name:()=>'X', atLeast:()=>true}}, PH=window.PH, render=()=>{};
  const go=eval('('+'()=>{ '+fnOf(I,'realPerson')+fnOf(I,'applyIdentity')+' return {applyIdentity, pick:n=>{ sel=n; chosen=true; }, sel:()=>sel}; })')();
  go.applyIdentity(); t('two offices: lands on All Offices', go.sel()==='ALL');
  go.pick('Hobbs'); go.applyIdentity(); t('picked Hobbs, identity updates: still Hobbs (it went back to All Offices)', go.sel()==='Hobbs');
  ME={offices:['Carlsbad']}; go.applyIdentity(); t('…until Hobbs is no longer theirs', go.sel()==='Carlsbad');
  t('pick() remembers it was the person’s choice', /sel=n; chosen=true; render\(\);/.test(I)); }

/* 2 + 8. Schedule: deleting or renaming an office can't take another's days. */
{ const DAY=k=>/^\d{4}-\d{2}-\d{2}$/.test(k); let html='', did=0;
  const sched={'2026-11-02':{Roswell:{ps:[0]}, Hobbs:{}}, '2026-11-03':{Roswell:{closed:true}}, __v:2};
  let tmpLoc={orig:'Roswell', isNew:false}, schedPart=false, locations=[{n:'Roswell'},{n:'Hobbs'}];
  const isDay=DAY, canEdit=()=>true, escH=s=>String(s), openModal=h=>{ html=h; };
  const D=eval('('+'()=>{ '+fnOf(S,'locDays')+fnOf(S,'delLoc')+' return {locDays, delLoc}; })')();
  D.delLoc();
  t('Delete office: refused while it has days, saying how many', /Roswell can’t be deleted yet/.test(html) && /<b>2 days<\/b> on the schedule\. Clear or move its days first/.test(html) && !/delLocGo/.test(html));
  tmpLoc={orig:'Hobbs', isNew:false}; D.delLoc();
  t('…with no days (an empty cell is not a day), it asks first, in the page, naming the office', /Delete Hobbs\?/.test(html) && /PS\.delLocGo\(\)/.test(html));
  schedPart=true; D.delLoc(); t('…refused while part of the schedule couldn’t be loaded', /couldn’t be loaded, so Hobbs’s days can’t be counted/.test(html));
  t('…delLocGo checks again before deleting, and no native confirm()', /function delLocGo\(\)\{ if\(!canEdit\(\) \|\| !tmpLoc \|\| tmpLoc\.isNew \|\| schedPart \|\| locDays\(tmpLoc\.orig\)\) return;/.test(S) && !/confirm\(/.test(fnOf(S,'delLoc')+fnOf(S,'delLocGo')) && /delLoc,delLocGo,/.test(S));
  t('…a schedule that loaded only in part is known', /schedPart = !!\(L\.baseFailed \|\| L\.failed\.length \|\| L\.unknown\);/.test(S) && /\.catch\(function\(\)\{ schedPart = true;/.test(S));
  // saveLoc: a name another office has
  let err={textContent:''}; const el=id=>id==='lName' ? {value:'  hob bs '} : id==='lErr' ? err : null;
  tmpLoc={isNew:false, orig:'Roswell', color:'x', tz:'', lunch:null, hours:[]};
  const saveLoc=eval('('+'()=>{ '+fnOf(S,'saveLoc')+' return saveLoc; })')();
  const before=JSON.stringify(sched); saveLoc();
  t('Rename to a name another office has (any case, any spaces): refused, nothing moved', /already an office called Hobbs/.test(err.textContent) && JSON.stringify(sched)===before && locations.length===2);
  tmpLoc={isNew:true, n:'', color:'x', tz:'', lunch:null, hours:[]}; err.textContent=''; saveLoc();
  t('…adding one: refused too', /already an office called Hobbs/.test(err.textContent) && locations.length===2); }

/* 7. Schedule: the doctor list goes first; cells only once it is taken. */
{ const run=(docsChanged, outcome)=>{
    const sent=[]; let people=[{n:'A'}], docsSaved=docsChanged ? '[]' : JSON.stringify(people), docsLoaded=docsSaved, saving=false, again=false, sched={}, alerted=0;
    const SCHED_VERSION=2, alert=()=>{ alerted++; }, sendCells=()=>sent.push('cells');
    const window={PH_STORE:{update:(k,f)=>{ sent.push(k); const v=f(outcome==='clash' ? [{n:'Z'}] : JSON.parse(docsLoaded)); return Promise.resolve(outcome==='blocked' ? {blocked:true} : v===undefined ? {unchanged:true} : {value:v}); }}};
    const PH_STORE=window.PH_STORE, PH={isLive:()=>true};
    eval('('+'()=>{ '+fnOf(S,'saveNow')+' saveNow(); })')();
    return new Promise(r=>setTimeout(()=>r({sent, alerted}), 0)); };
  Promise.all([run(false,'ok'), run(true,'ok'), run(true,'blocked'), run(true,'clash')]).then(([a,b,c,d])=>{
    t('doctor list unchanged: the cells go straight away', a.sent.join()==='cells');
    t('doctor list changed: the list first, then the cells', b.sent.join()==='ph_docs,cells');
    t('…list refused: the renumbered cells are NOT sent', c.sent.join()==='ph_docs');
    t('…someone else changed the list: cells not sent, the person is told', d.sent.join()==='ph_docs' && d.alerted===1);

    /* 11. Admin goals: switching year or office with unsaved goals. */
    t('Goals: changing year or office with unsaved changes is refused, the picker goes back, Save still works',
      /if\(t\.dataset && \(t\.dataset\.pd === 'gy' \|\| t\.dataset\.pd === 'go'\) && Object\.keys\(GEDIT\)\.length\)\{\n      t\.value = String\(t\.dataset\.pd === 'gy' \? GY : GO\); GWAIT = 'Save or discard '\+GO\+' '\+GY\+'’s changes first\.'; gPaint\(\); return; \}/.test(A) &&
      /b\.disabled = !n \|\| !!busy \|\| !!GERR;/.test(A) && /GERR = ''; GWAIT = '';/.test(fnOf(A,'gLoad')) && /if\(act === 'gdiscard'\)\{ GEDIT = \{\}; GPREV = \{\}; GERR = ''; GWAIT = ''; render\(\); \}/.test(A));

    t('no native alert/confirm/prompt in the code added today', ![X,I,S,A].some(src=>src.split('\n').some(l=>/21\/11\/2026, code review/.test(l) && /\b(alert|confirm|prompt)\(/.test(l))));

    console.log(ok.map(s=>'  PASS  '+s).join('\n'));
    if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
    console.log('\n'+ok.length+' passed, '+bad.length+' failed');
    process.exit(bad.length?1:0);
  }).catch(e=>{ console.log('CRASH', e && e.stack || e); process.exit(1); });
}
