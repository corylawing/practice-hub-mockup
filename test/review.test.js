/* ADMIN -> MONTHLY REVIEW (26/11/2026): who counts, who HAS an app, the month's usage, the counted results, the value
   calculator and value-by-app (v1/review.js _pure). Made-up people only. Run: node test/review.test.js */
const fs=require('fs'), path=require('path'), vm=require('vm');
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','v1','review.js'),'utf8'), ctx);
const R=ctx.PH_REVIEW._pure, RANK={none:0,view:1,add:2,edit:3,manage:4};
const TODAY='2026-11-26', YM='2026-11';

/* A made-up Teams & Access grid: TCs have the TC Tracker, office managers payroll (view), staff only the basics. */
const GRID={tcs:{tc:'edit', schedule:'view'}, 'office managers':{tc:'view', payroll:'view', schedule:'edit', dashboard:'view'}, staff:{schedule:'view'}};
const ctxOf=(on)=>({on:Object.assign({tc:true, payroll:true, tasks:true, monthly:false, chat:false}, on||{}),
  senders:new Set(['sam.sender@example.com']), pilot:new Set(['pat.pilot@example.com']),
  lv:(p,k)=>{ if(p.access && p.access[k]!==undefined) return RANK[p.access[k]]||0; let best=0; (p.teams||[]).forEach(tm=>{ const g=GRID[String(tm).toLowerCase()]||{}; best=Math.max(best, RANK[g[k]||'none']); }); return best; }});
const day=p=>({n:2, p:Object.assign({home:1}, p||{})});
const person=(name, email, teams, days, extra)=>Object.assign({name, email, teams, offices:[], listed:true, admin:false, rec:days ? {d:days} : null}, extra||{});
const L=[
  person('Tia Tc', 'tia.tc@example.com', ['TCs'], {'2026-11-12':day({tc:1})}),
  person('Toby Tc', 'toby.tc@example.com', ['TCs'], {'2026-10-28':day({tc:1})}),            // signed in (October), not this month
  person('Nora Never', 'nora.never@example.com', ['TCs'], null),                              // has the tracker, never signed in
  person('Olive Om', 'olive.om@example.com', ['Office Managers'], {'2026-11-20':day({payroll:1, tc:1})}),
  person('Sam Sender', 'sam.sender@example.com', ['Staff'], {'2026-11-18':day({payroll:1})}),  // sends an office's payroll
  person('Stu Staff', 'stu.staff@example.com', ['Staff'], {'2026-10-30':day({})}),             // came in October only
  person('No Email', '', ['Staff'], null),                                                     // can't sign in
  person('Pat Pilot', 'pat.pilot@example.com', ['Staff'], {'2026-11-21':day({chat:1})}),
  person('Ada Admin', 'ada.admin@example.com', ['Admin'], {'2026-11-03':day({monthly:1})}, {admin:true}),
  person('Una Override', 'una.o@example.com', ['Staff'], {'2026-11-22':day({tc:1})}, {access:{tc:'view'}})
];
const U=R.usage(L, YM, ctxOf(), TODAY), by={}; U.tools.forEach(x=>{ by[x.k]=x; });

/* Who counts - Cory 26/11: "You shouldn't count people who have never logged in, even if they have access." */
t('only people who have signed in are counted', U.counted===8);
t('never signed in (with or without an email): in no number, but known', U.never===2);
t('used Home-Brace this month (October visits don\'t count)', U.used===6);
t('not on the team list: never counted', R.usage(L.concat([Object.assign(person('Visitor', 'v@example.com', [], {'2026-11-02':day()}), {listed:false})]), YM, ctxOf(), TODAY).counted===8);

/* Each app against the people who HAVE it - "only 4 have access to chat it shouldn't count the 20 users but the 4" */
t('TC Tracker: Tia, Toby, Olive, Ada (admin) and Una (given it in Admin) - Nora never signed in', by.tc && by.tc.have===5);
t('TC Tracker: 3 of them opened it this month', by.tc.used===3);
t('Payroll: the office manager, the office\'s sender and the admin', by.payroll && by.payroll.have===3 && by.payroll.used===2);
t('Chat while a pilot: only the pilot list (+ admins)', by.chat && by.chat.have===2 && by.chat.used===1);
t('Chat for everyone once it\'s on: everyone counted', R.usage(L, YM, ctxOf({chat:true}), TODAY).tools.find(x=>x.k==='chat').have===8);
t('Monthly Report before it\'s on for staff: admins only', by.monthly && by.monthly.have===1 && by.monthly.used===1);
t('Tasks: everyone counted', by.tasks && by.tasks.have===8);
t('admins have every app that is on (Marketing: just the admin)', by.marketing && by.marketing.have===1);
t('an app nobody has isn\'t listed', !R.usage(L.filter(p=>!p.admin), YM, ctxOf(), TODAY).tools.some(x=>x.k==='marketing'));
t('an app switched off for staff isn\'t counted at all (TC off)', !R.usage(L, YM, ctxOf({tc:false}), TODAY).tools.some(x=>x.k==='tc'));
t('Admin\'s own level for a person beats their team', R.hasTool(L[9], R.APPS.find(x=>x.k==='tc'), ctxOf()));
t('...and an override of "none" takes an app away', !R.hasTool(Object.assign({}, L[0], {access:{tc:'none'}}), R.APPS.find(x=>x.k==='tc'), ctxOf()));

/* The month and its weeks */
t('this month = the 1st to today', R.monthDays(YM, TODAY).length===26 && R.monthDays(YM, TODAY)[25]==='2026-11-26');
t('a finished month = all its days', R.monthDays('2026-10', TODAY).length===31);
t('months step across the year', R.shiftMonth('2026-12', 1)==='2027-01' && R.shiftMonth('2027-01', -1)==='2026-12');

/* The counted results - counts only, never names or amounts */
const status={v:1, p:{'2026-24':{sent:{carlsbad:'2026-11-16T15:00:00Z', hobbs:'2026-11-17T19:00:00Z'}, entered:'2026-11-18T15:00:00Z'},
  '2026-25':{sent:{carlsbad:'2026-11-30T16:00:00Z'}}, '2026-23':{sent:{hobbs:'2026-10-20T15:00:00Z'}}}};
t('payroll: sheets sent in the month (October\'s left out)', R.paySheets(status, YM)===3);
t('payroll: nothing stored = 0', R.paySheets(null, YM)===0);
const tasks=[{v:1, t:{a:{at:'2026-11-03T15:00:00Z', to:{x:{d:'2026-11-04T15:00:00Z'}, y:{d:''}, z:{d:'2026-11-05T15:00:00Z', gone:'2026-11-05T16:00:00Z'}}},
  b:{at:'2026-10-28T15:00:00Z', to:{x:{d:'2026-11-02T15:00:00Z'}}}}}, {v:1, t:{c:{at:'2026-11-10T15:00:00Z', to:{y:{d:'2026-11-11T15:00:00Z'}}}}}];
t('tasks: ticks done in the month, the archive too (taken-off people don\'t count)', R.tasksDone(tasks, YM).done===3);
t('tasks: given in the month', R.tasksDone(tasks, YM).given===2);
const cons=[{office:'Hobbs', date:'2026-11-03', outcome:'Started'},{office:'Hobbs', date:'2026-11-30'},{office:'Hobbs', date:'2026-11-05', deleted:true},
  {office:'Hobbs', date:'2026-11-06', moved:true},{office:'Hobbs', date:'2026-10-31'},{office:'Hobbs', date:'2026-11-07', outcome:'No Show'},{office:'Lakeview', date:'2026-11-09', outcome:'Pending'}];
t('consults: the month\'s, not deleted or moved', R.consults(cons, YM)===4);
t('missed exams: OrthoFi\'s exams less the ones logged that happened, office by office', R.missed({Hobbs:4, Lakeview:1}, cons, '2026-11-01', '2026-11-26')===3);
t('missed exams: more logged than OrthoFi never cancels another office\'s miss', R.missed({Hobbs:0, Lakeview:3}, cons, '2026-11-01', '2026-11-26')===2);
t('missed exams: an office OrthoFi couldn\'t answer for is skipped', R.missed({Hobbs:null, Lakeview:3}, cons, '2026-11-01', '2026-11-26')===2);
const log=[{at:'2026-11-16T15:00:00Z', from:{how:'schedule'}, changes:[1,2,3]}, {at:'2026-11-17T15:00:00Z', from:{how:'enter'}, changes:[1]}, {at:'2026-10-16T15:00:00Z', from:{how:'schedule'}, changes:[1,2]}];
t('production days filled from the Schedule in the month (typed ones don\'t count)', R.prodDays([log], YM)===3);
const party={v:1, p:{a:{bday:'11-04'}, b:{bday:'11-20', no:{bday:true}}, c:{started:'2024-11-15'}, d:{started:'2026-11-02'}, e:{bday:'12-01', started:'2020-11-30'}}};
t('celebrations: birthdays and anniversaries this month (switched off and first-year starts left out)', R.celebrations(party, YM)===3);

/* The value calculator: the practice's numbers x what Home-Brace counted; every row belongs to an app */
const M={paySheets:16, consults:200, prodDays:90, tasksDone:20};
const V=R.value({rate:24, jobs:{paySheets:30, consults:3}, weekly:{schedule:70}}, M, 28);
t('jobs: count x minutes (16 sheets x 30 + 200 consults x 3)', Math.round(V.rows.find(r=>r.k==='paySheets').min)===480 && Math.round(V.rows.find(r=>r.k==='consults').min)===600);
t('weekly: minutes a week x the weeks counted (70 x 4)', Math.round(V.rows.find(r=>r.k==='schedule').min)===280);
t('hours and dollars: (480+600+280)/60 = 22.67 h x $24', Math.abs(V.hrs-1360/60)<1e-9 && Math.abs(V.dollars-1360/60*24)<1e-9);
t('by app: Payroll\'s own value', Math.abs(V.app.payroll.dollars-8*24)<1e-9 && Math.abs(V.app.tc.dollars-10*24)<1e-9);
t('a year at this pace', Math.abs(V.year-V.dollars/28*365)<1e-6);
t('nothing set: no value at all (the tile asks for the numbers)', !R.value(null, M, 28).ready && R.value(null, M, 28).dollars===0);
t('minutes but no hourly cost: not ready', !R.value({jobs:{paySheets:30}}, M, 28).ready);
t('a job Home-Brace couldn\'t count adds nothing', R.value({rate:20, jobs:{prodDays:5}}, {}, 28).dollars===0);
t('the calculator keeps only sane numbers', R.cleanSet({rate:-4, jobs:{paySheets:'abc', consults:5, junk:9}, weekly:{schedule:1e9}}).rate===0 && !('paySheets' in R.cleanSet({jobs:{paySheets:'abc'}}).jobs) && R.cleanSet({weekly:{schedule:1e9}}).weekly.schedule===6000 && !('junk' in R.cleanSet({jobs:{junk:9}}).jobs));
t('every calculator row names an app that exists', R.JOBS.concat(R.WEEKLY).every(j=>R.APPS.some(a=>a.k===j.app)));

/* Value belongs to the app - Cory: "some months we will be upgrading what was already built ... it should contribute to
   the overall value of the specific app itself" */
t('every delivery is New or Upgrade and points at an app', R.WORK.every(w=>(w.kind==='new' || w.kind==='upgrade') && R.APPS.some(a=>a.k===w.app)));
t('a delivery has no value of its own (no metric on the work)', R.WORK.every(w=>!('metric' in w) && !('value' in w)));
const H=R.history('tc', YM);
t('an app\'s history: what was built in it up to the month, and whether this month was new or an upgrade', H.total>=1 && H.thisMonth==='upgrade');
t('nothing built in an app: no history', R.history('marketing', YM).total===0 && R.history('marketing', YM).thisMonth==='');
t('every delivery has its words: month, who, before, now, ask, why, built', R.WORK.every(w=>/^\d{4}-\d{2}$/.test(w.month) && w.who && w.before && w.now && w.ask && w.why && w.built && w.status));
t('every app says what it is used for', R.APPS.every(a=>a.use && a.use.length>10));
t('no figures in the words (money or percentages)', !R.WORK.some(w=>/\$\d|\d+%/.test([w.ask,w.why,w.built,w.extra,w.before,w.now].join(' '))));
const src=fs.readFileSync(path.join(__dirname,'..','v1','review.js'),'utf8');
t('the sandbox never reads the practice\'s stores for the numbers', /if\(!live\(\)\) return Promise\.resolve\(\{paySheets:/.test(src));
t('only an admin can save the calculator', /function saveCalc\(el, today\)\{\s*if\(!isAdminNow\(\)/.test(src));
t('no <input type="month"> (Safari types it)', !/type="month"/.test(src));


/* DID WORK vs OPENED (Cory 26/11: "Its a bit vague to just say they used it (meaning they looked at it or did they actually
   use it)") */
{
  const dw=(p,w)=>({n:2, p:Object.assign({home:1}, p||{}), w:w||{}});
  const L2=[
    person('Wanda Works', 'w@example.com', ['TCs'], {'2026-11-20':dw({tc:1},{tc:1})}),
    person('Lou Looks', 'l@example.com', ['TCs'], {'2026-11-21':dw({tc:1})}),
    person('Old Work', 'o@example.com', ['TCs'], {'2026-10-21':dw({tc:1},{tc:2})})
  ];
  const T=R.usage(L2, YM, ctxOf(), TODAY).tools.find(x=>x.k==='tc');
  t('opened = the app was open; did work = something saved in it', T.opened===2 && T.worked===1 && T.have===3);
  t('people who did work anywhere this month', R.usage(L2, YM, ctxOf(), TODAY).worked===1);
  t('work is counted from the first day anyone\'s work was recorded', R.workSince(L2)==='2026-10-21' && R.workSince(L)==='');
  const tc=R.APPS.find(a=>a.k==='tc'), dash=R.APPS.find(a=>a.k==='dashboard');
  const Lw={ym:YM, u:{workSince:'2026-11-27'}}, Lon={ym:YM, u:{workSince:'2026-11-20'}};
  const g1=R.usageOf(tc, {opened:5, worked:3, have:8}, Lon);
  t('a working app shows who DID WORK, says what that is, and how many only opened it', g1.n===3 && g1.d===8 && g1.label==='did work in it' && /logged or updated a consult/.test(g1.sub) && /2 more only opened it/.test(g1.sub));
  const g2=R.usageOf(tc, {opened:5, worked:0, have:8}, {ym:'2026-10', u:{workSince:'2026-11-20'}});
  t('before work was recorded: "opened it", and it says when work counting starts', g2.n===5 && g2.label==='opened it' && /next update/.test(g2.sub));
  const g3=R.usageOf(dash, {opened:6, worked:0, have:9}, Lw);
  t('a look-up app says what checking it means', g3.n===6 && g3.label==='checked the numbers');
  t('every app says either what counts as work or what checking it means', R.APPS.every(a=>a.work || a.view));
  const us=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8'), did=us.slice(us.indexOf('function did(sec)'), us.indexOf('function did(sec)')+1500);
  t('did(): never while an admin views as someone, never for someone who switched recording off', /impersonating\(\) && isAdmin\(realMe\(\)\)\) return;/.test(did) && /if\(cur && cur\.off\) return undefined;/.test(did));
  t('did(): at most once per app per 10 minutes on a device', /DID_GAP=10\*60\*1000/.test(us) && /Date\.now\(\)-was<DID_GAP/.test(did));
  t('did() is offered to the pages', /usageReady, did,/.test(us));
  const calls={tc:'tc.html', payroll:'payroll.html', tasks:'tasks.html', production:'production.html', monthly:'monthly.html', schedule:'schedule.html', marketing:'marketing.html', documents:'documents.html', chat:'chat.html'};
  t('every working app records its work', Object.keys(calls).every(k=>fs.readFileSync(path.join(__dirname,'..','v1',calls[k]),'utf8').indexOf("PH.did('"+k+"')")>=0));
  const tk=fs.readFileSync(path.join(__dirname,'..','v1','tasks.html'),'utf8');
  t('tasks: archiving old tasks is housekeeping, not anyone\'s work', /R\.dropArchived\(cur, R\.cleanRecord\(a\.value\)\), undefined, true\)/.test(tk) && /if\(!bad && !chore\)/.test(tk));
}

/* PATIENTS WON BACK - started after a follow-up logged in the call list (Cory 26/11: show money found) */
{
  const W=[
    {date:'2026-11-02', outcome:'Pending', fuStatus:'Closed - started', startDate:'2026-11-20', calls:[{day:'2026-11-10', what:'Called'}]},     // counts
    {date:'2026-11-03', outcome:'Started', sameDay:'Yes', startDate:'2026-11-03', calls:[{day:'2026-11-03'}]},                              // same-day start: not won back
    {date:'2026-11-04', outcome:'Pending', fuStatus:'Closed - started', startDate:'2026-11-18', calls:[]},                                  // no follow-up logged
    {date:'2026-10-20', outcome:'Pending', fuStatus:'Closed - started', startDate:'2026-10-30', calls:[{day:'2026-10-25'}]},                // started last month
    {date:'2026-11-05', outcome:'Pending', fuStatus:'Closed - started', startDate:'2026-11-12', calls:[{day:'2026-11-15'}]},                // the call came after the start
    {date:'2026-11-06', outcome:'Pending', fuStatus:'Closed - started', startDate:'2026-11-22', calls:[{at:'2026-11-21T15:00:00Z'}], deleted:true}  // deleted
  ];
  t('won back: started this month, not same-day, with a call logged on or before the start', R.wonBack(W, YM)===1);
  t('the average case fee is kept (and capped)', R.cleanSet({fee:5200}).fee===5200 && R.cleanSet({fee:-3}).fee===0 && R.cleanSet({fee:1e9}).fee===50000);
}
console.log(pass+' passed, '+fail+' failed'); if(fail) process.exit(1);
