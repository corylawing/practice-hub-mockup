/* TC CONSULT TRACKER - the sheet's formulas, checked.
       node test/tc.test.js

   12/10/2026. Selene's TC Consult Tracker workbook becomes a Home-Brace page. Every count
   and rate on the page must mean what the same cell means in her sheet, so each block
   below names the cell it reproduces. The three deliberate differences (TC.WHAT_CHANGED)
   are checked too, so nobody "fixes" them back by accident. Made-up patients only. */
const TC=require('../v1/tc.js');
const ok=[], bad=[];
function t(name, cond){ (cond?ok:bad).push(name); }
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const TODAY='2026-10-20';

/* ---------- Column Z, "Action needed" ---------- */
{
  const A=r=>TC.action(Object.assign({date:'2026-10-01'}, r), TODAY);
  t('Z: no consult date -> nothing', TC.action({outcome:'Pending'}, TODAY)==='');
  t('Z: recall ready and not closed -> Recall ready', A({outcome:'Observation', recallReady:'Yes', obsReview:'2026-12-01'})==='Recall ready');
  t('Z: recall ready but scheduled to start -> still Recall ready (the sheet only stops on closed)',
    A({outcome:'Observation', recallReady:'Yes', fuStatus:'Scheduled to start'})==='Recall ready');
  t('Z: observation, no review date -> Set observation review date', A({outcome:'Observation'})==='Set observation review date');
  t('Z: observation review today -> due', A({outcome:'Observation', obsReview:TODAY})==='Observation review due');
  t('Z: observation review passed -> due', A({outcome:'Observation', obsReview:'2026-10-02'})==='Observation review due');
  t('Z: observation review later -> future', A({outcome:'Observation', obsReview:'2026-10-21'})==='Observation - future review');
  t('Z: CHANGE - observation patient who started leaves the list', A({outcome:'Observation', obsReview:'2026-10-02', fuStatus:'Closed - started'})==='');
  t('Z: CHANGE - recall-ready observation patient who started leaves the list', A({outcome:'Observation', recallReady:'Yes', fuStatus:'Closed - started'})==='');
  t('Z: pending, no date -> Set pending follow-up date', A({outcome:'Pending'})==='Set pending follow-up date');
  t('Z: pending, status Open, date today -> due', A({outcome:'Pending', fuStatus:'Open', nextFU:TODAY})==='Pending follow-up due');
  t('Z: pending, contacted, date later -> future', A({outcome:'Pending', fuStatus:'Contacted - waiting', nextFU:'2026-10-27'})==='Pending - future follow-up');
  t('Z: pending, scheduled to start -> off the list', A({outcome:'Pending', fuStatus:'Scheduled to start', nextFU:'2026-10-02'})==='');
  t('Z: pending, closed - declined -> off the list', A({outcome:'Pending', fuStatus:'Closed - declined'})==='');
  t('Z: no show, open -> No-show follow-up', A({outcome:'No Show'})==='No-show follow-up');
  t('Z: no show, contacted -> still No-show follow-up', A({outcome:'No Show', fuStatus:'Contacted - waiting'})==='No-show follow-up');
  t('Z: no show, rebooked -> off the list', A({outcome:'No Show', fuStatus:'Rebooked'})==='');
  t('Z: started / refused / rescheduled / no outcome -> nothing',
    ['Started','Refused Treatment','Rescheduled / Cancelled',''].every(o=>A({outcome:o})===''));
  t('AA: days waiting = consult to start', TC.daysWaiting({date:'2026-10-01', startDate:'2026-10-15'}, TODAY)===14);
  t('AA: days waiting = consult to today while not started', TC.daysWaiting({date:'2026-10-01'}, TODAY)===19);
}

/* ---------- One month: Dashboard B6-B16 / F15-F20, Monthly Totals row ---------- */
const C=[
  {id:'r1', date:'2026-10-05', outcome:'Started', sameDay:'Yes', rpi:'Yes', rpiDate:'2026-10-05'},
  {id:'r2', date:'2026-10-06', outcome:'Started', sameDay:'No', rpi:'Yes', rpiDate:'2026-11-02'},     // sold in November
  {id:'r3', date:'2026-10-07', outcome:'Pending', fuStatus:'Open', fuDone:'No', nextFU:'2026-10-19', sameDay:'No'},
  {id:'r4', date:'2026-10-08', outcome:'Pending', fuStatus:'Closed - started', fuDone:'Yes', startDate:'2026-10-15', sameDay:'No'},
  {id:'r5', date:'2026-10-09', outcome:'Observation', fuStatus:'Open', fuDone:'No', obsReview:'2027-01-09', sameDay:'No'},
  {id:'r6', date:'2026-10-10', outcome:'No Show', fuStatus:'Open', fuDone:'No'},
  {id:'r7', date:'2026-10-11', outcome:'No Show', fuStatus:'Rebooked', fuDone:'Yes'},
  {id:'r8', date:'2026-10-12', outcome:'Refused Treatment', sameDay:'No'},
  {id:'r9', date:'2026-10-13', outcome:'Rescheduled / Cancelled'},
  {id:'r10', date:'2026-10-14', outcome:''},                                                         // past, no outcome
  {id:'r11', date:'2026-10-25', outcome:''},                                                         // not happened yet
  {id:'r12', date:'2026-09-30', outcome:'Started', sameDay:'Yes', rpi:'Yes', rpiDate:'2026-10-01'},   // September consult, October sale
  {id:'r13', date:'2026-10-15', outcome:'Started', sameDay:'Yes', deleted:true},                     // deleted - never counted
  {id:'r14', date:'2026-10-16', outcome:'Started', sameDay:'Yes', moved:true}                         // moved away - never counted here
];
{
  const m=TC.monthStats(C, '2026-10', 88, TODAY);
  t('B6 slots passed through', m.slots===88);
  t('B7 consults scheduled = every consult dated in the month', m.scheduled===11);
  t('B8 capacity scheduled = scheduled / slots', m.capacity===11/88);
  t('B9 completed = started + pending + observation + refused', m.completed===6);
  t('C9 completed rate = completed / scheduled', m.completedRate===6/11);
  t('B10-B15 outcome counts', m.started===2 && m.pending===2 && m.observation===1 && m.noShow===2 && m.refused===1 && m.rescheduled===1);
  t('C10-C14 rates use completed, C13/C15 use scheduled',
    m.startedRate===2/6 && m.pendingRate===2/6 && m.observationRate===1/6 && m.refusedRate===1/6 && m.noShowRate===2/11 && m.rescheduledRate===1/11);
  t('B16 RPI counts by SALE date (a September consult sold in October counts; an October consult sold in November does not)', m.rpi===2);
  t('F15 case acceptance = started / completed', m.acceptance===2/6);
  t('F19 same-day contracts = U Yes in the month', m.sameDay===1);
  t('F16 same-day rate = same-day / completed', m.sameDayRate===1/6);
  t('F20 follow-ups completed = V Yes in the month', m.fuYes===2);
  t('F18 follow-up completion = Yes / (Yes + No)', m.fuRate===2/5);
  t('F11 CHANGE - missing outcome counts only earlier days (not today, not ahead)', m.missing===1 &&
    TC.monthStats([{date:TODAY, outcome:''}], '2026-10', 0, TODAY).missing===0);
  t('B8 with no slots is blank, not a division by zero', TC.monthStats(C, '2026-10', 0, TODAY).capacity===null);
  t('An empty month gives blanks for every rate', (s=>s.acceptance===null && s.fuRate===null && s.scheduled===0)(TC.monthStats(C, '2026-03', 0, TODAY)));
  const n=TC.monthStats(C, '2026-11', 0, TODAY);
  t('November gets the November RPI sale', n.rpi===1 && n.scheduled===0);
}

/* ---------- Open work: Dashboard F6-F12 ---------- */
{
  const w=TC.openWork(C, TODAY);
  t('F6 open pending = pending not closed (any month)', w.openPending===1);
  t('F7 CHANGE - current observation leaves out started/declined', w.observation===1 &&
    TC.openWork(C.concat([{id:'x', date:'2026-08-01', outcome:'Observation', fuStatus:'Closed - started'}]), TODAY).observation===1);
  t('F10 no-show follow-up', w.noShow===1);
  t('F8 / F9', w.recallReady===0 && w.observationDue===0);
  t('F12 all open follow-ups = every consult with an action', w.allOpen===3);
}

/* ---------- Daily view (Dashboard A23:K54) and Monthly Totals ---------- */
{
  const slots=d=>(d==='2026-10-05'?9:0);
  const days=TC.dailyView(C, '2026-10', slots, TODAY);
  t('Daily view has every day of the month', days.length===31 && days[0].date==='2026-10-01' && days[30].date==='2026-10-31');
  const d5=days[4];
  t('Daily view row: scheduled, slots, capacity, started, RPI, same-day', d5.scheduled===1 && d5.slots===9 && d5.capacity===1/9 && d5.started===1 && d5.rpi===1 && d5.sameDay===1);
  t('Daily view: RPI on its SALE day', days[0].rpi===1 && days[0].scheduled===0);
  t('Daily view: follow-ups due = consults that day with an action', days[6].fuDue===1 && days[9].fuDue===1 && days[10].fuDue===0);
  const y=TC.yearTotals(C, 2026, ym=>ym==='2026-10'?88:0, TODAY);
  t('Monthly Totals: twelve months', y.rows.length===12 && y.rows[9].ym==='2026-10');
  t('Monthly Totals October row = the month view', eq(y.rows[9], TC.monthStats(C, '2026-10', 88, TODAY)));
  t('Year total sums the months', y.total.scheduled===12 && y.total.started===3 && y.total.rpi===3 && y.total.slots===88);
  t('Year rates come from the sums', y.total.acceptance===3/7 && y.total.fuRate===2/5);
}

/* ---------- What the page fills in for the TC ---------- */
{
  const p=TC.setOutcome({}, 'Pending');
  t('Pending -> follow-up needed (V No), status Open, no same-day contract', p.fuDone==='No' && p.fuStatus==='Open' && p.sameDay==='No');
  t('No Show -> follow-up needed, same-day not asked', (r=>r.fuDone==='No' && r.sameDay==='')(TC.setOutcome({}, 'No Show')));
  t('Observation -> follow-up needed', TC.setOutcome({}, 'Observation').fuDone==='No');
  t('Started -> same-day left for the TC to answer, no follow-up', (r=>r.sameDay==='' && !r.fuDone)(TC.setOutcome({}, 'Started')));
  t('Refused -> same-day No, no follow-up', (r=>r.sameDay==='No' && !r.fuDone)(TC.setOutcome({}, 'Refused Treatment')));
  const fix=TC.setOutcome(TC.setOutcome({}, 'Pending'), 'Started');
  t('Corrected Pending -> Started drops only what Pending set up', fix.fuDone==='' && fix.fuStatus==='' && fix.sameDay==='');
  t('An answered same-day survives re-saving Started', TC.setOutcome({outcome:'Started', sameDay:'Yes'}, 'Started').sameDay==='Yes');
  t('A typed "follow-up complete" is not overwritten', TC.setOutcome({fuDone:'Yes'}, 'Pending').fuDone==='Yes');

  const D=TC.DO;
  const c=D.called({outcome:'Pending', fuStatus:'Open'}, TODAY, '2026-10-27');
  t('Called: last contact today, Contacted - waiting, next follow-up set', c.lastContact===TODAY && c.fuStatus==='Contacted - waiting' && c.nextFU==='2026-10-27');
  t('Called an observation patient: the date is the next review', D.called({outcome:'Observation'}, TODAY, '2027-04-20').obsReview==='2027-04-20');
  const s=D.started({outcome:'Pending', fuDone:'No'}, TODAY, '2026-10-22', 'Yes');
  t('Started: Closed - started, start date, V Yes + date, RPI sold that day',
    s.fuStatus==='Closed - started' && s.startDate==='2026-10-22' && s.fuDone==='Yes' && s.fuDoneDate===TODAY && s.rpi==='Yes' && s.rpiDate===TODAY);
  t('Started keeps the consult-day outcome (the month’s results do not change)', s.outcome==='Pending');
  t('Scheduled to start: status + V Yes', (r=>r.fuStatus==='Scheduled to start' && r.fuDone==='Yes')(D.scheduled({}, TODAY)));
  t('Declined: Closed - declined + V Yes', (r=>r.fuStatus==='Closed - declined' && r.fuDone==='Yes')(D.declined({}, TODAY)));
  t('Rebooked: status Rebooked + V Yes', (r=>r.fuStatus==='Rebooked' && r.fuDone==='Yes')(D.rebooked({outcome:'No Show'}, TODAY)));
  t('V Yes keeps its first completion date', D.declined({fuDone:'Yes', fuDoneDate:'2026-10-02'}, TODAY).fuDoneDate==='2026-10-02');
  t('Reviewed: next review set, still observation', (r=>r.obsReview==='2027-04-20' && r.outcome==='Observation' && r.lastContact===TODAY)(D.reviewed({outcome:'Observation'}, TODAY, '2027-04-20')));
  t('Ready: recall ready + date', (r=>r.recallReady==='Yes' && r.recallDate===TODAY)(D.ready({}, TODAY)));
  t('Set date: pending -> next follow-up, observation -> review', D.setDate({outcome:'Pending'}, '2026-10-30').nextFU==='2026-10-30' && D.setDate({outcome:'Observation'}, '2027-01-01').obsReview==='2027-01-01');
}

/* ---------- The call list ---------- */
{
  const L=TC.callList([
    {id:'f', date:'2026-10-01', outcome:'Pending', nextFU:'2026-11-01'},
    {id:'s', date:'2026-10-02', outcome:'Pending'},
    {id:'d2', date:'2026-10-03', outcome:'Pending', nextFU:'2026-10-18'},
    {id:'d1', date:'2026-10-04', outcome:'Pending', nextFU:'2026-10-10'},
    {id:'n', date:'2026-10-05', outcome:'No Show'},
    {id:'x', date:'2026-10-06', outcome:'Started'},
    {id:'z', date:'2026-10-06', outcome:'Pending', nextFU:'2026-10-01', deleted:true}
  ], TODAY).map(x=>x.r.id);
  t('Call list: due first (oldest due date first), then no-shows, then needs-a-date, then later', eq(L, ['d1','d2','n','s','f']));
}

/* ---------- Consult slots (Daily Capacity) ---------- */
{
  const hours=[1,null,1,null,1];                 // Mon, Wed, Fri
  const sched={'2026-10-14':{'Hobbs':{closed:true}}};
  const open=TC.openFrom('Hobbs', hours, sched);
  t('Open: a weekday with hours', open('2026-10-12')===true);                // Monday
  t('Closed: a weekday without hours', open('2026-10-13')===false);          // Tuesday
  t('Closed: the weekend', open('2026-10-17')===false && open('2026-10-18')===false);
  t('Closed: marked Closed on the Schedule', open('2026-10-14')===false);
  t('Other offices are not closed by Hobbs’ day', TC.openFrom('Clovis', hours, sched)('2026-10-14')===true);
  const rec={usual:9, days:{'2026-10-12':8, '2026-10-13':10, '2026-10-16':0}};
  t('Usual number on an open day', TC.slotsOn(rec, '2026-10-19', open)===9);
  t('A day the TC changed wins', TC.slotsOn(rec, '2026-10-12', open)===8);
  t('A changed number works even on a usually-closed day', TC.slotsOn(rec, '2026-10-13', open)===10);
  t('0 closes a day', TC.slotsOn(rec, '2026-10-16', open)===0);
  t('Closed days get nothing', TC.slotsOn(rec, '2026-10-14', open)===0);
  // October 2026 has 13 Mon/Wed/Fri; the 14th is closed on the Schedule -> 12 x 9 = 108;
  // then the 12th is 8 (-1), the 16th is 0 (-9) and Tuesday the 13th gets 10 (+10).
  t('Month total', TC.slotsInMonth(rec, '2026-10', open)===12*9 - 1 - 9 + 10);
  t('No usual number set: no slots', TC.slotsInMonth({}, '2026-10', open)===0);
  // The usual number has a history: changing it never rewrites days already counted.
  const h={hist:[{from:'2026-10-05', n:9}, {from:'2026-10-21', n:10}], days:{'2026-11-02':8}};
  t('Before the usual number was set: no slots', TC.slotsOn(h, '2026-10-02', open)===0);
  t('The number in force that day', TC.slotsOn(h, '2026-10-12', open)===9 && TC.slotsOn(h, '2026-10-21', open)===10);
  t('A month not here yet gets no usual number (the sheet was filled at the start of each month)',
    TC.slotsOn(h, '2026-11-04', open, '2026-10-31')===0 && TC.slotsInMonth(h, '2026-12', open, '2026-10-31')===0);
  t('...but a day set by hand in that month counts', TC.slotsOn(h, '2026-11-02', open, '2026-10-31')===8);
  const u=TC.setUsual({}, 9, '2026-10-12');
  t('First usual number covers this whole month', eq(u.hist, [{from:'2026-10-01', n:9}]) && u.usual===9);
  TC.setUsual(u, 10, '2026-10-20');
  t('A later change starts today', eq(u.hist, [{from:'2026-10-01', n:9}, {from:'2026-10-20', n:10}]));
  TC.setUsual(u, 8, '2026-10-20');
  t('Two changes in one day: the second replaces the first', eq(u.hist, [{from:'2026-10-01', n:9}, {from:'2026-10-20', n:8}]) && u.usual===8);
  t('Old records with only a usual number still work', TC.usualOn({usual:9}, '2026-01-05')===9);
  t('Last day of a month', TC.lastDayOf('2026-02')==='2026-02-28' && TC.lastDayOf('2028-02')==='2028-02-29');
}

/* ---------- Where it is kept ---------- */
{
  t('One record per office per month', TC.logKey('San Angelo', '2026-10')==='ph_tclog_san-angelo_2026-10');
  t('Slots per office', TC.slotsKey('Cruces LCO')==='ph_tcslots_cruces-lco');
  t('The log prefix matches only logs', TC.logKey('Hobbs','2026-10').indexOf(TC.LOG_PREFIX)===0 &&
    TC.slotsKey('Hobbs').indexOf(TC.LOG_PREFIX)!==0 && TC.LISTS_KEY.indexOf(TC.LOG_PREFIX)!==0);
  const got=TC.consultsFrom({
    'ph_tclog_hobbs_2026-09':{consults:{a:{date:'2026-09-30', name:'A', moved:true, upd:'2026-10-02T10:00'}, b:{date:'2026-09-02', upd:'1'}}},
    'ph_tclog_hobbs_2026-10':{consults:{a:{date:'2026-10-01', name:'A', upd:'2026-10-02T10:00'}}},
    'ph_tclog_hobbs_2026-08':{consults:{b:{date:'2026-09-02', name:'newer', upd:'2'}}}
  });
  const a=got.find(x=>x.id==='a'), b=got.find(x=>x.id==='b');
  t('A moved consult shows once, at its new date (a moved marker never hides it)', a && !a.moved && a.date==='2026-10-01' && got.filter(x=>x.id==='a').length===1);
  t('The newest copy of a consult wins', b && b.name==='newer');
}

/* ---------- The download: the sheet's own columns ---------- */
{
  const lines=TC.csv([{date:'2026-10-07', name:'Doe, Jane', outcome:'Pending', nextFU:'2026-10-19', chart:'C1'}], TODAY).split('\r\n');
  const head=lines[0].split(',');
  t('Download has the Consult Log’s 28 columns in order', head.length===28 && head[0]==='Consult date' && head[24]==='Month' && head[27]==='Patient / chart ID');
  t('A comma in a name is quoted', lines[1].indexOf('"Doe, Jane"')>0);
  t('Calculated columns are filled', lines[1].indexOf('2026-10,Pending follow-up due,13,C1')>0);
}

/* ---------- The lists match the sheet ---------- */
{
  t('Outcomes = the sheet’s six', eq(TC.OUTCOMES, ['Started','Pending','Observation','No Show','Refused Treatment','Rescheduled / Cancelled']));
  t('Follow-up statuses = the sheet’s five + Rebooked', eq(TC.FU_STATUSES.slice(0,5), ['Open','Contacted - waiting','Scheduled to start','Closed - started','Closed - declined']) && TC.FU_STATUSES[5]==='Rebooked');
  t('Lead sources, pending reasons, consult types = the sheet’s', TC.DEFAULT_LISTS.leads.length===8 && TC.DEFAULT_LISTS.reasons.length===7 && TC.DEFAULT_LISTS.types.length===6);
  t('Every deliberate difference is written down for Selene', TC.WHAT_CHANGED.length===4);
}

/* ---------- Sandbox demo ---------- */
{
  const mk=()=>TC.demo({today:TODAY, from:'2026-09-01', seed:7,
    offices:[{n:'Hobbs', isOpen:TC.openFrom('Hobbs',[1,null,1,null,1],{})}, {n:'Clovis', isOpen:TC.openFrom('Clovis',[1,1,1,1,1],{})}],
    tcFor:o=>({name:'TC '+o, mail:''})});
  const a=mk(), b=mk();
  t('Demo is the same every time', eq(a, b) && a.length>100);
  t('Demo consults are on open days, up to today', a.every(r=>r.date>='2026-09-01' && r.date<=TODAY && TC.parse(r.date).getDay()%6!==0));
  t('Demo: only today’s consults may still be waiting for an outcome', a.filter(r=>!r.outcome).every(r=>r.date===TODAY));
  t('Demo: every started consult answered same-day', a.filter(r=>r.outcome==='Started').every(r=>r.sameDay==='Yes'||r.sameDay==='No'));
  t('Demo phone numbers are the never-real 555-01xx', a.every(r=>/^\(575\) 555-01\d\d$/.test(r.phone)));
  const s=TC.monthStats(a, '2026-09', 500, TODAY);
  t('Demo month has a believable acceptance rate', s.acceptance>0.2 && s.acceptance<0.7);
}

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
