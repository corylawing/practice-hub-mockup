/* TC CONSULT TRACKER - the rules behind tc.html.

   12/10/2026. Heather, cc Selene: "is there a way to make this a fillable form on Home Brace
   instead of an excel sheet that she has to email out every month? It would be for TC
   reporting." The sheet is FFO_TC_Consult_Tracker_Excel_Compatible.xlsx: a Consult Log
   (28 columns), a Follow-Up Queue and a Dashboard / Monthly Totals calculated from it, and a
   Daily Capacity tab. Every count and rate here is that workbook's own formula, so a number
   means the same thing on this page as in Selene's sheet. The few places that differ on
   purpose are marked CHANGE and listed in WHAT_CHANGED for her to confirm.

   Kept apart from the page so node can test it: test/tc.test.js. */
(function(global){
  'use strict';

  /* The sheet's Lists tab. Outcomes and follow-up statuses drive the formulas, so they are
     fixed here. Consult types, pending reasons and lead sources are only labels: a manager
     can change those on the page (ph_tclists). */
  const OUTCOMES=['Started','Pending','Observation','No Show','Refused Treatment','Rescheduled / Cancelled'];
  // "Completed consults" = Started + Pending + Observation + Refused (Dashboard B9, Monthly Totals E).
  const COMPLETED=['Started','Pending','Observation','Refused Treatment'];
  // CHANGE: "Rebooked" is new - see WHAT_CHANGED.
  const FU_STATUSES=['Open','Contacted - waiting','Scheduled to start','Closed - started','Closed - declined','Rebooked'];
  const OPEN_FU=['','Open','Contacted - waiting'];
  const CLOSED_FU=['Closed - started','Closed - declined'];
  const DEFAULT_LISTS={
    types:['Braces','Invisalign','Both','Phase I','Phase II','Other'],
    reasons:['Financial','Decision-maker absent','Shopping / comparing','Insurance','Needs dental work','Needs records','Other'],
    leads:['Google','Meta / Facebook','Patient referral','Dental referral','Website','Walk-in','Community event','Other']
  };
  const SLOT_CHOICES=[8,9,10];
  // The Follow-Up Queue's "Action needed" values, most urgent first (the call list's order).
  const ACTIONS=['Pending follow-up due','No-show follow-up','Observation review due','Recall ready',
    'Set pending follow-up date','Set observation review date','Pending - future follow-up','Observation - future review'];
  const DUE=['Pending follow-up due','No-show follow-up','Observation review due','Recall ready'];
  const NEEDS_DATE=['Set pending follow-up date','Set observation review date'];

  const WHAT_CHANGED=[
    'A patient who started or declined leaves the call list, observation patients included. '+
      'In the sheet an observation patient stayed on the queue and in "Current observation patients" '+
      'even after starting, unless someone changed the consult’s Outcome - which would also change that month’s results.',
    '"Missing outcome" counts consults from earlier days only. In the sheet today’s afternoon consults, '+
      'and any entered ahead of time, counted as missing before they had happened.',
    'Consult slots: an office sets its usual number once and every open day gets it; a TC changes only the odd day. '+
      'In the sheet a TC picked 8, 9 or 10 for every working day at the start of each month.',
    'New follow-up status "Rebooked", for a no-show who books another consult. The sheet had no word for it, '+
      'so the no-show stayed on the queue or had to be marked declined.'
  ];

  /* ---------- dates: 'YYYY-MM-DD' strings in the office's own calendar ---------- */
  const pad=n=>String(n).padStart(2,'0');
  function iso(d){ d=d||new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function parse(s){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||'')); return m?new Date(+m[1],+m[2]-1,+m[3]):null; }
  function addDays(s,n){ const d=parse(s); if(!d) return ''; d.setDate(d.getDate()+n); return iso(d); }
  function addMonths(s,n){
    const d=parse(s); if(!d) return '';
    const day=d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+n);
    const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(day,last)); return iso(d);
  }
  function daysBetween(a,b){ const x=parse(a), y=parse(b); return (x&&y)?Math.round((y-x)/86400000):null; }
  const monthOf=s=>String(s||'').slice(0,7);                        // 'YYYY-MM'
  const inMonth=(s,ym)=>!!s && monthOf(s)===ym;
  function monthDays(ym){
    const y=+ym.slice(0,4), m=+ym.slice(5,7), n=new Date(y,m,0).getDate(), out=[];
    for(let i=1;i<=n;i++) out.push(ym+'-'+pad(i));
    return out;
  }
  function shiftMonth(ym,n){ const d=new Date(+ym.slice(0,4),+ym.slice(5,7)-1+n,1); return d.getFullYear()+'-'+pad(d.getMonth()+1); }

  /* ---------- one consult ----------
     The sheet's columns, by the names used here:
       A date  B time  C name  D dob  E phone  F office  G tc  H type  I outcome
       J reason  K nextFU  L lastContact  M fuStatus  N obsReview  O recallReady
       P recallDate  Q startDate  R lead  S rpi  T rpiDate  U sameDay  V fuDone
       W fuDoneDate  X notes  AB chart
     S/T are the RIP Retainer Program. The sheet said "RPI" in places; the practice calls it
     RIP (Heather, 13/10), so every label says RIP. The stored keys stay rpi / rpiDate.
     Y (month), Z (action needed) and AA (days waiting) are calculated, never stored. */
  const live=r=>!!r && !r.deleted && !r.moved;

  /* Column Z, "Action needed": the sheet's formula, branch for branch. */
  function action(r, today){
    if(!r || !r.date) return '';
    const st=r.fuStatus||'', closed=CLOSED_FU.indexOf(st)>=0;
    if(r.recallReady==='Yes' && !closed) return 'Recall ready';
    if(r.outcome==='Observation'){
      if(closed) return '';                                       // CHANGE: the sheet kept them forever
      if(!r.obsReview) return 'Set observation review date';
      return r.obsReview<=today ? 'Observation review due' : 'Observation - future review';
    }
    if(r.outcome==='Pending' && OPEN_FU.indexOf(st)>=0){
      if(!r.nextFU) return 'Set pending follow-up date';
      return r.nextFU<=today ? 'Pending follow-up due' : 'Pending - future follow-up';
    }
    if(r.outcome==='No Show' && OPEN_FU.indexOf(st)>=0) return 'No-show follow-up';
    return '';
  }
  // Column AA, "Days waiting": consult to start, or consult to today while not started.
  function daysWaiting(r, today){ if(!r||!r.date) return null; return daysBetween(r.date, r.startDate||today); }

  /* ---------- filling in what the sheet asks the TC to type ----------
     Each one only answers what the action itself answers. Nothing here clears a value a
     person typed, except the one field that action is about. */
  function fuDoneNow(r, today){ if(r.fuDone!=='Yes'){ r.fuDone='Yes'; r.fuDoneDate=today; } }
  /* The outcome picked after the consult. Pending, No Show and Observation need follow-up
     (column V starts at No); a contract cannot have been signed at a consult that did not
     start (column U is No - the sheet asks for it on every completed consult). */
  function setOutcome(r, outcome){
    const was=r.outcome||'';
    r.outcome=outcome||'';
    const needs = outcome==='Pending' || outcome==='No Show' || outcome==='Observation';
    if(needs){
      if(!r.fuDone) r.fuDone='No';
      if(!r.fuStatus) r.fuStatus='Open';
    } else if(was && was!==outcome){
      // Corrected away from an outcome that needed follow-up: drop only what that set up.
      if(r.fuDone==='No') r.fuDone='';
      if(r.fuStatus==='Open') r.fuStatus='';
    }
    if(outcome==='Started'){ if(was!=='Started') r.sameDay=''; }     // the TC answers this one
    else if(COMPLETED.indexOf(outcome)>=0) r.sameDay='No';
    else r.sameDay='';                                               // no-show / rescheduled: not asked
    return r;
  }
  /* The call list's buttons. Each sets the columns a TC would have typed in the sheet. */
  const DO={
    // Spoke or left a message. Pending/no-show: still waiting. The next date, if given,
    // is the next follow-up (or the next review for an observation patient).
    called(r, today, next){
      r.lastContact=today;
      if(CLOSED_FU.indexOf(r.fuStatus)<0) r.fuStatus='Contacted - waiting';
      if(next){ if(r.outcome==='Observation' && r.recallReady!=='Yes') r.obsReview=next; else r.nextFU=next; }
      return r;
    },
    scheduled(r, today){ r.lastContact=today; r.fuStatus='Scheduled to start'; fuDoneNow(r, today); return r; },
    started(r, today, startDate, rpi){
      r.lastContact=today; r.fuStatus='Closed - started'; r.startDate=startDate||today; fuDoneNow(r, today);
      if(rpi==='Yes'){ r.rpi='Yes'; r.rpiDate=r.rpiDate||today; }
      return r;
    },
    declined(r, today){ r.lastContact=today; r.fuStatus='Closed - declined'; fuDoneNow(r, today); return r; },
    rebooked(r, today){ r.lastContact=today; r.fuStatus='Rebooked'; fuDoneNow(r, today); return r; },
    // An observation review done: the next one is booked. Still under observation.
    reviewed(r, today, next){ r.lastContact=today; if(next) r.obsReview=next; return r; },
    ready(r, today){ r.recallReady='Yes'; r.recallDate=today; return r; },
    setDate(r, next){ if(r.outcome==='Observation') r.obsReview=next; else r.nextFU=next; return r; }
  };

  /* ---------- the numbers ---------- */
  const rate=(a,b)=>b?a/b:null;
  /* One month, as the Dashboard's "Monthly results" and "TC accountability metrics" show it,
     and as one row of Monthly Totals. `consults` is everyone in view; `slots` is that
     month's available consult slots (Daily Capacity). */
  function monthStats(consults, ym, slots, today){
    const all=(consults||[]).filter(live), m=all.filter(r=>inMonth(r.date, ym));
    const n=o=>m.filter(r=>r.outcome===o).length;
    const started=n('Started'), pending=n('Pending'), observation=n('Observation'), noShow=n('No Show'),
          refused=n('Refused Treatment'), rescheduled=n('Rescheduled / Cancelled');
    const scheduled=m.length, completed=started+pending+observation+refused;
    const sameDay=m.filter(r=>r.sameDay==='Yes').length;
    const fuYes=m.filter(r=>r.fuDone==='Yes').length, fuNo=m.filter(r=>r.fuDone==='No').length;
    slots=Number(slots)||0;
    return {
      ym, slots, scheduled, capacity:rate(scheduled, slots),
      completed, completedRate:rate(completed, scheduled),
      started, startedRate:rate(started, completed),
      pending, pendingRate:rate(pending, completed),
      observation, observationRate:rate(observation, completed),
      noShow, noShowRate:rate(noShow, scheduled),
      refused, refusedRate:rate(refused, completed),
      rescheduled, rescheduledRate:rate(rescheduled, scheduled),
      // RIP counts by the SALE date, not the consult date (B16 / M6).
      rpi:all.filter(r=>r.rpi==='Yes' && inMonth(r.rpiDate, ym)).length,
      acceptance:rate(started, completed),
      sameDay, sameDayRate:rate(sameDay, completed),
      fuYes, fuNo, fuRate:rate(fuYes, fuYes+fuNo),
      // CHANGE: only days already gone. Today's consults may not have happened yet.
      missing:m.filter(r=>!r.outcome && r.date<today).length
    };
  }
  /* "Open work" - across every consult, not one month (Dashboard F6-F12). */
  function openWork(consults, today){
    const all=(consults||[]).filter(live), acts=all.map(r=>action(r, today));
    const c=a=>acts.filter(x=>x===a).length;
    return {
      openPending: all.filter(r=>r.outcome==='Pending' && CLOSED_FU.indexOf(r.fuStatus||'')<0).length,
      // CHANGE: started/declined observation patients are not "current" (the sheet: every Observation ever).
      observation: all.filter(r=>r.outcome==='Observation' && CLOSED_FU.indexOf(r.fuStatus||'')<0).length,
      recallReady: c('Recall ready'),
      observationDue: c('Observation review due'),
      noShow: c('No-show follow-up'),
      allOpen: acts.filter(Boolean).length
    };
  }
  /* The Dashboard's "Daily view": one row per day of the month. */
  function dailyView(consults, ym, slotsOn, today){
    const all=(consults||[]).filter(live);
    return monthDays(ym).map(d=>{
      const day=all.filter(r=>r.date===d), slots=Number(slotsOn(d))||0;
      const n=o=>day.filter(r=>r.outcome===o).length;
      return {date:d, scheduled:day.length, slots, capacity:rate(day.length, slots),
        started:n('Started'), pending:n('Pending'), noShow:n('No Show'),
        fuDue:day.filter(r=>action(r, today)).length,
        rpi:all.filter(r=>r.rpi==='Yes' && r.rpiDate===d).length,
        sameDay:day.filter(r=>r.sameDay==='Yes').length,
        fuDone:day.filter(r=>r.fuDone==='Yes').length};
    });
  }
  /* Monthly Totals: twelve rows and the year. Rates for the year come from the year's
     sums (the sheet left all but the follow-up rate blank on that row). */
  function yearTotals(consults, year, slotsInMonth, today){
    const rows=[];
    for(let i=1;i<=12;i++){ const ym=year+'-'+pad(i); rows.push(monthStats(consults, ym, slotsInMonth(ym), today)); }
    const sum=k=>rows.reduce((a,r)=>a+(r[k]||0),0);
    const t={ym:String(year)};
    ['slots','scheduled','completed','started','pending','observation','noShow','refused','rescheduled','rpi','sameDay','fuYes','fuNo','missing']
      .forEach(k=>{ t[k]=sum(k); });
    t.capacity=rate(t.scheduled,t.slots); t.completedRate=rate(t.completed,t.scheduled);
    t.acceptance=t.startedRate=rate(t.started,t.completed); t.sameDayRate=rate(t.sameDay,t.completed);
    t.noShowRate=rate(t.noShow,t.scheduled); t.fuRate=rate(t.fuYes,t.fuYes+t.fuNo);
    return {rows, total:t};
  }
  /* The call list: everything with an action, most urgent first, oldest first within. */
  function callList(consults, today){
    return (consults||[]).filter(live).map(r=>({r, a:action(r, today)})).filter(x=>x.a)
      .sort((x,y)=>{
        const ax=ACTIONS.indexOf(x.a), ay=ACTIONS.indexOf(y.a);
        if(ax!==ay) return ax-ay;
        const dx=x.r.nextFU||x.r.obsReview||x.r.recallDate||x.r.date, dy=y.r.nextFU||y.r.obsReview||y.r.recallDate||y.r.date;
        return dx<dy?-1:dx>dy?1:0;
      });
  }

  /* ---------- consult slots (Daily Capacity) ----------
     The sheet: "Choose 8, 9, or 10 for every working day. Leave closed days blank" - at
     the beginning of each month. Here an office sets its usual number once; every day the
     office is open (its weekly hours and the Schedule's closed days) gets it; a TC changes
     only the odd day.
       rec = {usual: 9, hist: [{from:'2026-09-01', n:9}, ...], days: {'2026-10-14': 0, ...}}
     The usual number has a history so changing it never rewrites a month already counted,
     and it only reaches a month once that month has arrived (`until`), as the sheet's was
     filled in at the start of each month. A day changed by hand always counts. */
  function usualOn(rec, date){
    let h=Array.isArray(rec && rec.hist) && rec.hist.length ? rec.hist : null;
    if(!h) h=(rec && rec.usual) ? [{from:rec.since||'', n:rec.usual}] : [];
    let n=0;
    h.slice().sort((a,b)=>String(a.from||'')<String(b.from||'')?-1:1)
      .forEach(e=>{ if(String(e.from||'')<=date) n=Number(e.n)||0; });
    return n;
  }
  function slotsOn(rec, date, isOpen, until){
    const days=(rec && rec.days)||{};
    if(Object.prototype.hasOwnProperty.call(days, date)) return Number(days[date])||0;
    if(until && date>until) return 0;
    if(isOpen && !isOpen(date)) return 0;
    return usualOn(rec, date);
  }
  function slotsInMonth(rec, ym, isOpen, until){ return monthDays(ym).reduce((a,d)=>a+slotsOn(rec, d, isOpen, until),0); }
  /* A new usual number: from the 1st of this month the first time (so this month is
     whole), from today after that (the days already gone keep what they had). */
  function setUsual(rec, n, today){
    const hist=Array.isArray(rec.hist) ? rec.hist.slice() : (rec.usual ? [{from:rec.since||'', n:rec.usual}] : []);
    const from=hist.length ? today : monthOf(today)+'-01';
    rec.hist=hist.filter(e=>String(e.from||'')<from).concat([{from, n:Number(n)||0}]);
    rec.usual=Number(n)||0;
    return rec;
  }
  const lastDayOf=ym=>monthDays(ym).slice(-1)[0];
  /* Open for consults: a weekday the office has hours, not marked Closed on the Schedule.
     hours = the office's Mon-Fri list from PH.locations() (null = closed that day);
     sched = the Schedule's {date: {office: {closed:true}}}. */
  function openFrom(officeName, hours, sched){
    return function(date){
      const d=parse(date); if(!d) return false;
      const wd=d.getDay(); if(wd===0 || wd===6) return false;
      if(Array.isArray(hours) && hours.length && !hours[wd-1]) return false;
      const c=sched && sched[date] && sched[date][officeName];
      return !(c && c.closed);
    };
  }

  /* ---------- where it is kept ----------
     One record per office per month of the consult date, so each office's TC writes only
     their own office and a month stays well under SharePoint's size for one record.
       ph_tclog_<office>_<YYYY-MM>  {v:1, office, month, consults:{id: consult}}
       ph_tcslots_<office>          {usual, days:{}}
       ph_tclists                   {types, reasons, leads}
     Records are never removed: a deleted consult is marked deleted (the shared store only
     ever adds or updates when it combines copies, so a removal would come back anyway). */
  const slug=o=>String(o||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const LOG_PREFIX='ph_tclog_';
  const logKey=(office, ym)=>LOG_PREFIX+slug(office)+'_'+ym;
  const slotsKey=office=>'ph_tcslots_'+slug(office);
  const LISTS_KEY='ph_tclists';
  function newId(){ return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
  /* Every consult in a set of stored records, newest copy of each. */
  function consultsFrom(records){
    const out={};
    Object.keys(records||{}).forEach(k=>{
      const v=records[k]; if(!v || typeof v!=='object' || !v.consults) return;
      Object.keys(v.consults).forEach(id=>{
        const c=v.consults[id]; if(!c || typeof c!=='object') return;
        /* A consult whose date moved to another month leaves a "moved" marker behind. The
           marker and the moved copy are written together with the same time, so the copy
           must win outright - otherwise which one shows depends on reading order. */
        const had=out[id];
        const better=!had || (had.moved && !c.moved) ||
          (!(c.moved && !had.moved) && String(c.upd||'')>String(had.upd||''));
        if(better) out[id]=Object.assign({id}, c);
      });
    });
    return Object.keys(out).map(id=>out[id]);
  }

  /* ---------- the sheet's own columns, for the download ---------- */
  const SHEET_COLS=[
    ['Consult date','date'],['Time','time'],['Patient name','name'],['Patient DOB','dob'],['Phone','phone'],
    ['Office','office'],['TC','tc'],['Consult type','type'],['Outcome','outcome'],['Pending reason','reason'],
    ['Next follow-up','nextFU'],['Last contact','lastContact'],['Follow-up status','fuStatus'],
    ['Observation review','obsReview'],['Recall ready?','recallReady'],['Recall-ready date','recallDate'],
    ['Treatment start date','startDate'],['Lead source','lead'],['RIP sold?','rpi'],['RIP sale date','rpiDate'],
    ['Same-day contract?','sameDay'],['Follow-up complete?','fuDone'],['Follow-up completion date','fuDoneDate'],
    ['Notes','notes'],['Month',null],['Action needed',null],['Days waiting',null],['Patient / chart ID','chart']
  ];
  function csv(consults, today){
    const q=v=>{ v=v==null?'':String(v); return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
    const rows=[SHEET_COLS.map(c=>c[0])];
    (consults||[]).filter(live).slice().sort((a,b)=>(a.date+(a.time||''))<(b.date+(b.time||''))?-1:1).forEach(r=>{
      rows.push(SHEET_COLS.map(c=>{
        if(c[0]==='Month') return monthOf(r.date);
        if(c[0]==='Action needed') return action(r, today);
        if(c[0]==='Days waiting'){ const d=daysWaiting(r, today); return d==null?'':d; }
        return r[c[1]]||'';
      }));
    });
    return rows.map(row=>row.map(q).join(',')).join('\r\n');
  }

  /* ---------- sandbox only: a believable two months to look at ----------
     Made-up patients, deterministic so the sandbox looks the same for everyone. Never
     called on the live site (tc.html checks). */
  function demo(opts){
    let s=opts.seed||20261012;
    const rnd=()=>{ s=(s*1103515245+12345)%2147483648; return s/2147483648; };
    const pick=a=>a[Math.floor(rnd()*a.length)];
    const weighted=pairs=>{ let x=rnd()*pairs.reduce((a,p)=>a+p[1],0); for(const p of pairs){ x-=p[1]; if(x<0) return p[0]; } return pairs[0][0]; };
    const FIRST=['Ava','Liam','Mia','Noah','Sofia','Mateo','Isabella','Elijah','Camila','Lucas','Emma','Diego','Aria','Gabriel',
      'Lily','Daniel','Zoe','Adrian','Valeria','Ethan','Chloe','Julian','Natalie','Caleb','Layla','Ryan','Nora','Isaac','Elena','Owen'];
    const LAST=['Garcia','Martinez','Lopez','Hernandez','Smith','Johnson','Ramirez','Torres','Flores','Rivera','Gomez','Diaz',
      'Reyes','Cruz','Morales','Ortiz','Gutierrez','Chavez','Ramos','Ruiz','Alvarez','Mendoza','Castillo','Jimenez','Vargas',
      'Romero','Herrera','Medina','Aguilar','Castro'];
    const today=opts.today, start=opts.from, out=[];
    opts.offices.forEach((o, oi)=>{
      const usual=SLOT_CHOICES[oi % 3], tc=opts.tcFor(o.n) || {name:'Treatment Coordinator', mail:''};
      for(let d=start; d<=today; d=addDays(d,1)){
        if(!o.isOpen(d)) continue;
        const booked=Math.round(usual*(0.45+rnd()*0.45));
        for(let i=0;i<booked;i++){
          const past=d<today, r={
            id:'demo'+oi+'-'+d.replace(/-/g,'')+'-'+i, office:o.n, tc:tc.name, tcMail:tc.mail||'',
            date:d, time:pad(8+Math.floor(i*8/Math.max(booked,1)))+':'+pick(['00','30']),
            name:pick(FIRST)+' '+pick(LAST),
            dob:addDays(d, -Math.round(365*weighted([[9,3],[12,5],[14,4],[30,1],[42,1]])+rnd()*300)),
            phone:'(575) 555-01'+pad(Math.floor(rnd()*100)),          // 555-01xx: never a real number
            chart:'C'+(10000+Math.floor(rnd()*89999)),
            type:weighted([['Braces',45],['Invisalign',30],['Both',5],['Phase I',12],['Phase II',5],['Other',3]]),
            lead:weighted([['Patient referral',26],['Dental referral',20],['Google',22],['Meta / Facebook',14],['Website',9],['Walk-in',4],['Community event',3],['Other',2]]),
            notes:'', by:'demo', upd:d+'T12:00:00'
          };
          // Today's afternoon consults have not happened yet.
          if(!past && i>=booked/2){ out.push(r); continue; }
          setOutcome(r, weighted([['Started',36],['Pending',24],['Observation',9],['No Show',11],['Refused Treatment',8],['Rescheduled / Cancelled',12]]));
          if(r.outcome==='Started'){
            r.sameDay=rnd()<0.7?'Yes':'No'; r.startDate=r.sameDay==='Yes'?d:addDays(d, 7+Math.floor(rnd()*14));
            if(r.startDate>today) r.startDate='';
            if(rnd()<0.4){ r.rpi='Yes'; r.rpiDate=r.startDate||d; } else r.rpi='No';
          }
          if(r.outcome==='Pending'){
            r.reason=weighted([['Financial',30],['Decision-maker absent',18],['Shopping / comparing',16],['Insurance',14],['Needs dental work',10],['Needs records',7],['Other',5]]);
            r.nextFU=addDays(d, 3+Math.floor(rnd()*12));
            const age=daysBetween(d, today);
            if(age>10 && rnd()<0.75){
              const end=weighted([['started',45],['declined',20],['called',35]]), when=addDays(d, 5+Math.floor(rnd()*Math.min(age-4,20)));
              if(end==='started'){ DO.started(r, when<today?when:today, when<today?when:today); if(rnd()<0.35){ r.rpi='Yes'; r.rpiDate=r.startDate; } }
              else if(end==='declined') DO.declined(r, when<today?when:today);
              else DO.called(r, when<today?when:today, addDays(today, Math.floor(rnd()*9)-3));
            }
          }
          if(r.outcome==='Observation'){
            r.obsReview=addMonths(d, pick([3,6,6,12]));
            if(rnd()<0.2) DO.ready(r, addDays(d, 20));
          }
          if(r.outcome==='No Show' && daysBetween(d, today)>3){
            const end=rnd();
            if(end<0.45) DO.rebooked(r, addDays(d, 2));
            else if(end<0.65) DO.called(r, addDays(d, 1));
            else if(end<0.75) DO.declined(r, addDays(d, 3));
          }
          out.push(r);
        }
      }
    });
    return out;
  }

  const TC={
    OUTCOMES, COMPLETED, FU_STATUSES, OPEN_FU, CLOSED_FU, DEFAULT_LISTS, SLOT_CHOICES, ACTIONS, DUE, NEEDS_DATE, WHAT_CHANGED,
    iso, parse, addDays, addMonths, daysBetween, monthOf, inMonth, monthDays, shiftMonth,
    action, daysWaiting, setOutcome, DO, monthStats, openWork, dailyView, yearTotals, callList,
    slotsOn, slotsInMonth, usualOn, setUsual, lastDayOf, openFrom, slug, LOG_PREFIX, logKey, slotsKey, LISTS_KEY, newId, consultsFrom,
    SHEET_COLS, csv, demo, live
  };
  global.TC=TC;
  if(typeof module!=='undefined' && module.exports) module.exports=TC;
})(typeof window!=='undefined'?window:globalThis);
