/* ADMIN -> MONTHLY REVIEW (26/11/2026). Jessica: "Here's what we need to do going forward ... Monthly... What is the ask?
   Why? What is built (bc we all know it's more than the ask). What is the usage? Value add". Cory: "it should be in admin
   section and not be data vomit ... high level and clear"; of the first version "Its just words"; "You need to define
   better what its used for. You shouldn't count people who have never logged in, even if they have access"; "there
   should be some sort of calculator for the value for each section ... Estimate time saved per week, average hourly
   salary which could give us an overall value of Home-Brace"; and "some months we will be upgrading what was already
   built which we can't add a specific value for that or it should contribute to the overall value of the specific app".

   One month, numbers first:
     1. four big numbers: staff time given back in dollars (the value calculator), exams OrthoFi saw that were never
        logged, payroll sheets sent in Home-Brace, and the share of people using it;
     2. two charts: people using Home-Brace week by week, and each tool used by the people who HAVE it;
     3. VALUE BY APP: one card per app - what it's used for, its usage ring, the result Home-Brace counted, its dollars
        from the calculator, and what has been built or upgraded in it. VALUE BELONGS TO THE APP: an upgrade adds to its
        app, it never gets a number of its own;
     4. THIS MONTH'S WORK: what was delivered, marked New or Upgrade and tied to its app - Before -> Now, who asked; the
        ask, why and what was built (Jessica's words) open with "Details".
   WHO COUNTS: people on the team list who have signed in at least once since counting began (10/11/2026). Someone who
   has never signed in is in no number, whatever access they have. A tool counts the people who have it (Teams & Access
   or Admin's own level for them, payroll senders, the chat pilot list) and is listed only while it is on for staff.
   THE VALUE CALCULATOR (ph_review_set, admins): an average hourly cost, the minutes saved by each job Home-Brace counts
   (a payroll sheet, a consult, a production day, a task) and the minutes saved a week by the apps it can't count. The
   practice sets the numbers; the page multiplies. Until they're set the value tile asks for them.
   Counts only - never a patient, a name or a pay amount. The sandbox shows made-up numbers.
   Pure parts are in _pure (test/review.test.js). WORK = what was delivered: add the month's lines when something ships. */
(function(global){
  'use strict';
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const pad=n=>String(n).padStart(2,'0');
  const isoDay=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parseDay=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||'')); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null; };
  const addDays=(s,n)=>{ const d=parseDay(s); d.setDate(d.getDate()+n); return isoDay(d); };
  const RANK={none:0,view:1,add:2,edit:3,manage:4};
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName=ym=>MONTHS[+ym.slice(5,7)-1]+' '+ym.slice(0,4);
  const shiftMonth=(ym,n)=>{ const d=new Date(+ym.slice(0,4), +ym.slice(5,7)-1+n, 1); return d.getFullYear()+'-'+pad(d.getMonth()+1); };
  const short=s=>{ const d=parseDay(s); return d ? MONTHS[d.getMonth()].slice(0,3)+' '+d.getDate() : ''; };

  /* ---------- THE APPS: what each is for, who HAS it, and how its value is counted ----------
     metric = the result Home-Brace counts for it (alt when that can't be read); jobs/weekly = its value calculator rows. */
  const APPS=[
    {k:'payroll',    n:'Payroll',              icon:'💵', use:'Every office sends its payroll to Heather each pay period.', work:'filled in or sent a sheet', on:c=>c.on.payroll, has:(p,c)=>c.lv(p,'payroll')>=RANK.view || c.senders.has(p.email), metric:'paySheets'},
    {k:'tc',         n:'TC Tracker',           icon:'🗂️', use:'TCs log every new-patient consult and work the call list.', work:'logged or updated a consult', on:c=>c.on.tc, has:(p,c)=>c.lv(p,'tc')>=RANK.view, metric:'missed', alt:'consults'},
    {k:'tasks',      n:'Tasks',                icon:'✅', use:'Leaders give staff jobs and see who’s done them.', work:'gave or ticked off a task', on:c=>c.on.tasks, has:()=>true, metric:'tasksDone'},
    {k:'dashboard',  n:'Production Dashboard', icon:'📊', use:'Production against goal and pace, every office.', view:'checked the numbers', on:()=>true, has:(p,c)=>c.lv(p,'dashboard')>=RANK.view, metric:'prodDays'},
    {k:'production', n:'Enter Production',     icon:'📝', use:'Typing the month’s production numbers.', work:'saved production numbers', on:()=>true, has:(p,c)=>c.lv(p,'production')>=RANK.edit},
    {k:'monthly',    n:'Monthly Report',       icon:'📈', use:'Each office’s month-end numbers, for Heather and the doctors.', work:'saved or sent a month', on:()=>true, has:(p,c)=>c.on.monthly && c.lv(p,'monthly')>=RANK.view, metric:'offices'},
    {k:'schedule',   n:'Schedule',             icon:'📅', use:'Who works where, each day.', view:'checked who works where', work:'changed the schedule', on:()=>true, has:(p,c)=>c.lv(p,'schedule')>=RANK.view},
    {k:'chat',       n:'Team Chat',            icon:'💬', use:'Messages, photos and videos between staff, with phone alerts.', work:'sent a message', on:()=>true, has:(p,c)=>c.on.chat || c.pilot.has(p.email)},
    {k:'documents',  n:'Documents',            icon:'📁', use:'Forms, policies and files for each office.', view:'looked for a form or file', work:'added files', on:()=>true, has:(p,c)=>c.lv(p,'documents')>=RANK.view},
    {k:'marketing',  n:'Marketing',            icon:'📣', use:'Events and social posts.', view:'checked the board', work:'added or changed an item', on:()=>true, has:(p,c)=>c.lv(p,'marketing')>=RANK.view},
    {k:'team',       n:'Team',                 icon:'👥', use:'Everyone’s contact card.', view:'looked someone up', on:()=>true, has:(p,c)=>c.lv(p,'team')>=RANK.view},
    {k:'home',       n:'Home',                 icon:'🏠', use:'Each person’s day, tasks, updates and celebrations.', view:'opened Home-Brace', on:()=>true, has:()=>true, metric:'celebrations'}
  ];
  const APP=k=>APPS.find(a=>a.k===k);

  /* ---------- THE WORK: what was delivered, month by month - new apps and upgrades to existing ones ---------- */
  const WORK=[
    {month:'2026-11', app:'payroll', kind:'new', title:'Payroll in Home-Brace', status:'live', who:'Heather',
     before:'Heather copied every office’s Excel sheet by hand', now:'Offices send it here; totals add up themselves',
     ask:'“We can go live with the payroll sheet.”', why:'Heather copied every office’s Excel payroll sheet into her main sheet.',
     built:'Each office sends its sheet in Home-Brace; totals and overtime work themselves out, and Heather gets one combined sheet.',
     extra:'Reminders before the due day, checks that catch missing notes, and it moves on to the next pay period by itself.'},
    {month:'2026-11', app:'tc', kind:'upgrade', title:'Day view + OrthoFi check', status:'live', who:'Selene',
     before:'No day view; nothing checked the log against OrthoFi', now:'A day view, and a check against OrthoFi',
     ask:'“Could we view the day? Look up a date to view consults?”', why:'A TC couldn’t see one day’s consults, and nothing checked the log against OrthoFi.',
     built:'A day view with a week strip and a calendar, and “Logged vs OrthoFi”, which shows exams that were never logged.',
     extra:'It also stops the same consult being logged twice.'},
    {month:'2026-11', app:'tasks', kind:'new', title:'Tasks', status:'live', who:'Leadership',
     before:'No one place to give a job and see who did it', now:'Give, track and nudge in one place',
     ask:'“Assign a task … then track which of their tasks are still open and which ones have been completed.”', why:'There was no one place to give staff a job and see who had done it.',
     built:'Give a task to a person, an office or a team; everyone ticks it off, and the giver sees who’s done and can nudge.',
     extra:'Shows on Home and in the bell; Heather decides who can give tasks.'},
    {month:'2026-11', app:'dashboard', kind:'upgrade', title:'Production days from the Schedule', status:'live', who:'Heather',
     before:'Typed by hand; wrong when schedules changed', now:'Filled from the Schedule automatically',
     ask:'“Can the # of production days per office pull from the schedule in Home-Brace?”', why:'Production days were typed by hand and went wrong whenever a doctor’s schedule changed.',
     built:'Production days and days completed fill themselves from the Schedule, and follow it when a doctor’s days change.',
     extra:'Checked against Heather’s workbook first: September to November matched for all 8 offices.'},
    {month:'2026-11', app:'monthly', kind:'new', title:'Monthly Report', status:'review', who:'Heather',
     before:'Each office built a month-end spreadsheet', now:'One report; OrthoFi fills it in',
     ask:'“Could you actually do the monthly monitor sheet 3rd?”', why:'Each office built a month-end spreadsheet and sent it to Heather and the doctors.',
     built:'Every office’s month-end numbers in one place; the OrthoFi numbers fill themselves and offices type only the rest.',
     extra:'This year’s earlier months are already in, so the year is complete from January.'},
    {month:'2026-11', app:'chat', kind:'new', title:'Team Chat + phone alerts', status:'pilot', who:'Heather',
     before:'Work messages lived outside Home-Brace', now:'The practice’s Teams chat, inside Home-Brace',
     ask:'“The chat feature should go next.”', why:'Staff needed one place to message each other, with alerts on their phones.',
     built:'The practice’s own Microsoft Teams chat inside Home-Brace: messages, photos and videos, with phone alerts.',
     extra:'Phone alerts also remind offices when payroll is due.'},
    {month:'2026-11', app:'home', kind:'upgrade', title:'Birthdays and anniversaries', status:'live', who:'Heather',
     before:'Easy to miss someone’s day', now:'Every one on Home, with a one-tap message',
     ask:'“Go to production with birthday and workiversary.”', why:'So no birthday or work anniversary is missed.',
     built:'They show on everyone’s Home on the day, with a one-tap message to the person.'}
  ];
  const STATUS={live:'Live', review:'In review', pilot:'Pilot'}, KIND={new:'New', upgrade:'Upgrade'};
  /* the counted results: the big number's words */
  const METRIC={
    paySheets:   v=>v===1 ? 'payroll sheet sent' : 'payroll sheets sent',
    missed:      v=>v===1 ? 'missed exam found' : 'missed exams found',
    consults:    v=>v===1 ? 'consult logged' : 'consults logged',
    tasksDone:   v=>v===1 ? 'task done' : 'tasks done',
    prodDays:    v=>v===1 ? 'production day filled for you' : 'production days filled for you',
    offices:     v=>v===1 ? 'office, one report' : 'offices, one report',
    celebrations:v=>v===1 ? 'birthday or anniversary' : 'birthdays & anniversaries'
  };

  /* Counted = on the team list and signed in at least once (Cory: never logged in = not counted, even with access). */
  const counted=p=>!!(p && p.listed && p.rec);
  function hasTool(p, a, c){ return a.on(c) && (p.admin ? true : a.has(p, c)); }
  function monthDays(ym, today){
    const out=[]; const last=new Date(+ym.slice(0,4), +ym.slice(5,7), 0).getDate();
    for(let i=1;i<=last;i++){ const d=ym+'-'+pad(i); if(!today || d<=today) out.push(d); }
    return out;
  }
  /* opened = the app was open that day; worked = something they did in it was saved (PH.did - user.js) */
  const usedIn=(p, days, k, work)=>!!(p.rec && p.rec.d && days.some(d=>{ const e=p.rec.d[d]; if(!e) return false;
    if(work) return k ? !!(e.w && e.w[k]>0) : !!(e.w && Object.keys(e.w).some(x=>e.w[x]>0));
    return k ? !!(e.p && e.p[k]>0) : e.n>0; }));
  /* The first day anyone's work was recorded: "did work" means nothing before it. */
  const workSince=list=>{ let f=''; (list||[]).forEach(p=>{ const d=(p && p.rec && p.rec.d) || {}; Object.keys(d).forEach(day=>{ const w=d[day] && d[day].w; if(w && Object.keys(w).length && (!f || day<f)) f=day; }); }); return f; };
  /* Each app that is on: of the counted people who have it, how many opened it on those days. */
  function toolUse(list, days, c){
    const ppl=(list||[]).filter(counted);
    return APPS.filter(a=>a.on(c)).map(a=>{ const have=ppl.filter(p=>hasTool(p, a, c));
      const opened=have.filter(p=>usedIn(p, days, a.k)).length, worked=have.filter(p=>usedIn(p, days, a.k, true)).length;
      return {k:a.k, n:a.n, use:a.use, have:have.length, used:opened, opened, worked}; }).filter(t=>t.have>0);
  }
  function usage(list, ym, c, today){
    const days=monthDays(ym, today), ppl=(list||[]).filter(counted);
    const tools=toolUse(list, days, c);
    return {counted:ppl.length, used:ppl.filter(p=>usedIn(p, days)).length, worked:ppl.filter(p=>usedIn(p, days, null, true)).length,
      never:(list||[]).filter(p=>p.listed && !p.rec).length, tools, days:days.length, workSince:workSince(list)};
  }
  /* People using it each week (Monday to Sunday) that touches the month, from the day counting began. */
  function weekly(list, ym, today, since){
    const days=monthDays(ym, today); if(!days.length) return [];
    const ppl=(list||[]).filter(counted), out=[];
    const d=parseDay(days[0]); d.setDate(d.getDate()-((d.getDay()+6)%7));                  // the Monday on or before the 1st
    for(let w=isoDay(d); w<=days[days.length-1]; w=addDays(w,7)){
      const wk=[]; for(let i=0;i<7;i++){ const x=addDays(w,i); if(x<=today && (!since || x>=since)) wk.push(x); }
      if(wk.length) out.push({from:w, n:ppl.filter(p=>usedIn(p, wk)).length});
    }
    return out;
  }

  /* ---------- the results Home-Brace counts itself ---------- */
  const inMonth=(iso, ym)=>{ if(!iso) return false; const d=new Date(iso); return !isNaN(d) && isoDay(d).slice(0,7)===ym; };
  function paySheets(status, ym){
    let n=0; const p=(status && status.p) || {};
    Object.keys(p).forEach(k=>{ const s=(p[k] && p[k].sent) || {}; Object.keys(s).forEach(o=>{ if(inMonth(s[o], ym)) n++; }); });
    return n;
  }
  function tasksDone(rows, ym){
    let done=0, given=0;
    (rows||[]).forEach(r=>{ const t=(r && r.t) || {}; Object.keys(t).forEach(id=>{ const x=t[id]; if(!x) return;
      if(inMonth(x.at, ym)) given++;
      Object.keys(x.to||{}).forEach(k=>{ const w=x.to[k]; if(w && !w.gone && inMonth(w.d, ym)) done++; }); }); });
    return {done, given};
  }
  const NOT_HELD=['No Show','Cancelled','Rescheduled / Cancelled'];                        // the TC Tracker's OF_GONE
  const live_=r=>r && !r.deleted && !r.moved;
  function consults(list, ym){ return (list||[]).filter(r=>live_(r) && String(r.date||'').slice(0,7)===ym).length; }
  /* Exams OrthoFi saw that the TC Tracker doesn't have, office by office (more logged than OrthoFi never cancels a miss). */
  function missed(ofByOffice, list, from, to){
    let n=0;
    Object.keys(ofByOffice||{}).forEach(o=>{ const ex=ofByOffice[o]; if(typeof ex!=='number') return;
      const logged=(list||[]).filter(r=>live_(r) && r.office===o && r.date>=from && r.date<=to && NOT_HELD.indexOf(r.outcome)<0).length;
      n+=Math.max(0, ex-logged); });
    return n;
  }
  function prodDays(logs, ym){
    let n=0; (logs||[]).forEach(list=>(Array.isArray(list) ? list : []).forEach(e=>{
      if(e && e.from && e.from.how==='schedule' && inMonth(e.at, ym)) n+=(e.changes||[]).length; }));
    return n;
  }
  function celebrations(rec, ym){
    const mm=ym.slice(5,7), yy=+ym.slice(0,4); let n=0; const p=(rec && rec.p) || {};
    Object.keys(p).forEach(e=>{ const x=p[e]||{}, no=x.no||{};
      if(x.bday && !no.bday && String(x.bday).slice(0,2)===mm) n++;
      if(x.started && !no.anniv && String(x.started).slice(5,7)===mm && +String(x.started).slice(0,4)<yy) n++; });
    return n;
  }

  /* ---------- the value calculator: every row belongs to an app ---------- */
  const JOBS=[
    {k:'paySheets', app:'payroll',   n:'Each payroll sheet sent in Home-Brace', hint:'Copying and checking it by hand', unit:['sheet','sheets']},
    {k:'consults',  app:'tc',        n:'Each consult logged',                   hint:'No spreadsheet to keep or email', unit:['consult','consults']},
    {k:'prodDays',  app:'dashboard', n:'Each production day filled for you',    hint:'Typing and correcting the days', unit:['day','days']},
    {k:'tasksDone', app:'tasks',     n:'Each task given and tracked here',       hint:'Chasing it by text or email', unit:['task','tasks']}
  ];
  const WEEKLY=[
    {k:'schedule',  app:'schedule',  n:'Schedule',             hint:'Finding who works where, across the practice'},
    {k:'documents', app:'documents', n:'Documents',            hint:'Finding forms and files'},
    {k:'dashboard', app:'dashboard', n:'Production Dashboard', hint:'Building and sending the production numbers'},
    {k:'monthly',   app:'monthly',   n:'Monthly Report',       hint:'Building month-end spreadsheets (once offices have it)'},
    {k:'chat',      app:'chat',      n:'Team Chat',            hint:'Once everyone has it'}
  ];
  const SET_KEY='ph_review_set';
  const SAMPLE_SET={rate:22, jobs:{paySheets:20, consults:3, prodDays:2, tasksDone:5}, weekly:{schedule:90, documents:45, dashboard:60}};
  const num=v=>{ const n=parseFloat(v); return isFinite(n) && n>0 ? n : 0; };
  function cleanSet(s){
    const o={rate:0, jobs:{}, weekly:{}, by:'', at:''}; if(!s || typeof s!=='object') return o;
    o.rate=Math.min(500, num(s.rate));
    JOBS.forEach(j=>{ const v=Math.min(600, num(s.jobs && s.jobs[j.k])); if(v) o.jobs[j.k]=v; });
    WEEKLY.forEach(j=>{ const v=Math.min(6000, num(s.weekly && s.weekly[j.k])); if(v) o.weekly[j.k]=v; });
    o.by=String(s.by||'').slice(0,80); o.at=String(s.at||'').slice(0,30);
    return o;
  }
  /* minutes saved this month -> hours -> dollars (in total and by app), and a year at this pace. Only what is counted or
     set adds anything. */
  function value(set, metrics, daysCounted){
    const s=cleanSet(set), rows=[], byApp={}; let min=0;
    const add=(app, m)=>{ min+=m; byApp[app]=(byApp[app]||0)+m; };
    JOBS.forEach(j=>{ const per=s.jobs[j.k]||0, cnt=metrics && typeof metrics[j.k]==='number' ? metrics[j.k] : null;
      const m=per && cnt!=null ? per*cnt : 0; add(j.app, m); rows.push({k:j.k, app:j.app, n:j.n, hint:j.hint, unit:j.unit, kind:'job', per, cnt, min:m}); });
    const weeks=(daysCounted||0)/7;
    WEEKLY.forEach(j=>{ const per=s.weekly[j.k]||0, m=per*weeks; add(j.app, m); rows.push({k:j.k, app:j.app, n:j.n, hint:j.hint, kind:'week', per, cnt:null, min:m}); });
    const toDollars=m=>m/60*s.rate, app={}; Object.keys(byApp).forEach(k=>{ app[k]={hrs:byApp[k]/60, dollars:toDollars(byApp[k])}; });
    const hrs=min/60, dollars=hrs*s.rate, year=daysCounted ? dollars/daysCounted*365 : 0;
    return {set:s, rows, app, hrs, dollars, year, ready:!!(s.rate && min>0)};
  }
  /* What has been built in an app up to a month: new or upgraded, how many times, and since when. */
  function history(appK, ym){
    const w=WORK.filter(x=>x.app===appK && x.month<=ym), here=w.filter(x=>x.month===ym);
    return {total:w.length, since:w.length ? w.map(x=>x.month).sort()[0] : '', thisMonth:here.length ? (here.some(x=>x.kind==='new') ? 'new' : 'upgrade') : ''};
  }

  /* ---------- reading (live) / made-up (sandbox) ---------- */
  const live=()=>!!(global.PH && PH.isLive && PH.isLive());
  function script(name){ return new Promise(ok=>{ const me_=document.querySelector('script[src*="user.js"]'), sc=document.createElement('script');
    sc.src=me_ ? me_.getAttribute('src').replace(/user\.js/, name) : name; sc.onload=()=>ok(true); sc.onerror=()=>ok(false); document.head.appendChild(sc); }); }
  const CACHE={};
  function loadMetrics(ym, today){
    if(!live()) return Promise.resolve({paySheets:16, consults:214, missed:23, tasksDone:23, prodDays:96, offices:8, celebrations:11, sample:true});
    if(CACHE[ym] && Date.now()-CACHE[ym].at<10*60e3) return CACHE[ym].p;
    const S=global.PH_STORE, P=global.PH, out={offices:(P.officeNames ? P.officeNames() : []).length}, y=ym.slice(0,4);
    const first=ym+'-01', lastD=isoDay(new Date(+y, +ym.slice(5,7), 0)), last=lastD<today ? lastD : today;
    const pay=S.get('ph_pay_status').then(v=>{ out.paySheets=paySheets(v, ym); }, ()=>{});
    const tsk=Promise.all([S.get('ph_tasks').catch(()=>null), S.get('ph_tasks_old_'+y).catch(()=>null)]).then(r=>{ out.tasksDone=tasksDone(r, ym).done; });
    const pd=S.get('ph_prod_log_'+y).then(l=>{ out.prodDays=prodDays([l], ym); }, ()=>{});
    const pa=S.get('ph_celebrate').then(r=>{ out.celebrations=celebrations(r, ym); }, ()=>{});
    const tcList=(global.TCSTORE && global.TC ? Promise.resolve() : script('tcstore.js').then(()=>script('tc.js')))
      .then(()=>global.TCSTORE.getAll(global.TC.LOG_PREFIX, {partial:true})).then(L=>global.TC.consultsFrom(L));
    const tc=tcList.then(list=>{ out.consults=consults(list, ym);
      return (global.PH_ORTHOFI ? Promise.resolve() : script('orthofi.js')).then(()=>{ const O=global.PH_ORTHOFI; if(!O || !O.ask) return;
        const NEW={keptExamFlag:['kept exam'], examTypeName:['new']}, offs=P.officeNames ? P.officeNames() : [];
        return S.get(O.KEY).then(v=>O.cleanMap(v)).then(M=>Promise.all(offs.map(o=>{ const locs=O.locsOf(M, o); if(!locs.length) return [o, null];
          return O.ask({ask:'sum', path:'/v1/practice-locations/patient-exams', locs, params:{'exam-date-start-date':first, 'exam-date-end-date':last}, count:[{name:'ex', eq:NEW}]})
            .then(a=>[o, Object.keys(a.by||{}).reduce((s,l)=>s+(((a.by[l]||{}).cnt||{}).ex||0), 0)]); })))
          .then(pairs=>{ const by={}; pairs.forEach(([o,v])=>{ by[o]=v; }); if(pairs.some(p=>typeof p[1]==='number')) out.missed=missed(by, list, first, last); });
      }); }).catch(()=>{});                                                                // OrthoFi not reachable: consults logged instead
    const p=Promise.all([pay, tsk, pd, pa, tc]).then(()=>out);
    CACHE[ym]={at:Date.now(), p};
    return p;
  }
  /* Who has what: Teams & Access (or Admin's own level for a person), payroll senders, the chat pilot list. */
  function context(){
    const P=global.PH, on=Object.assign({tc:true, payroll:true, tasks:true, monthly:true, chat:true}, live() && P.switches ? P.switches() : {});
    const senders=new Set(); const so=(P.paySenders && P.paySenders().offices) || {};
    Object.keys(so).forEach(o=>(so[o]||[]).forEach(e=>senders.add(String(e||'').trim().toLowerCase())));
    if(!live() && P.rosterView) P.rosterView().forEach(r=>{ if(/\bOM\b|office manager|\bTC\b/i.test(r.role||'') && r.email) senders.add(String(r.email).toLowerCase()); });
    const lvCache={};
    const lv=(p,k)=>{ if(p.access && p.access[k]!==undefined) return RANK[p.access[k]]||0;          // Admin's own level for this person wins
      const key=(p.teams||[]).join('|')+'#'+k; if(!(key in lvCache)) lvCache[key]=RANK[P.levelForTeams(p.teams||[], k)]||0; return lvCache[key]; };
    const pilot=new Set();
    const pl=live() && global.PH_STORE ? global.PH_STORE.get(P.CHAT_PILOT_KEY).then(x=>(P.cleanChatPilot ? P.cleanChatPilot(x) : []).forEach(t=>pilot.add(t.email)), ()=>{}) : Promise.resolve();
    return pl.then(()=>({on, senders, lv, pilot}));
  }
  /* The sandbox has no visits worth counting: made-up ones, the same every time. Each made-up person uses a few apps,
     more often as the weeks go on, and some came last month and not this one - so the numbers look like a real practice. */
  function sampleRecords(list, ym, today){
    let seed=11; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
    const prevDays=monthDays(shiftMonth(ym,-1)).slice(-12), curDays=monthDays(ym, today), keys=APPS.map(a=>a.k);
    return (list||[]).filter(p=>p.listed).map(p=>{ if(!/@/.test(p.email||'') || rnd()<0.12) return Object.assign({}, p, {rec:null});   // no email = can't sign in
      const mine=keys.filter(()=>rnd()<0.7), busy=0.15+rnd()*0.35, d={};
      const WORKS=APPS.filter(a=>a.work).map(a=>a.k);
      const visit=day=>{ const pp={home:1}, ww={}; mine.forEach(k=>{ if(rnd()<0.6){ pp[k]=1; if(WORKS.indexOf(k)>=0 && rnd()<0.55) ww[k]=1; } }); d[day]={n:2, p:pp, w:ww}; };
      if(rnd()<0.22){ monthDays(shiftMonth(ym,-1)).slice(0,8).forEach(day=>{ if(rnd()<0.4) visit(day); }); const k=Object.keys(d); if(k.length) return Object.assign({}, p, {rec:{d, first:k[0]+'T15:00:00', last:k[k.length-1]+'T15:00:00'}}); }   // gone quiet
      if(rnd()<0.6) prevDays.forEach(day=>{ if(rnd()<busy*0.5) visit(day); });
      if(rnd()<0.8) curDays.forEach((day,i)=>{ if(rnd()<busy*(0.4+0.8*i/curDays.length)) visit(day); });
      const days=Object.keys(d).sort(), at=x=>x ? x+'T15:00:00' : '';
      return Object.assign({}, p, {rec:days.length ? {d, first:at(days[0]), last:at(days[days.length-1])} : null}); });
  }

  /* ---------- the page ---------- */
  let YM='', BUSY=false, AGAIN=false, LAST=null, OPEN={}, CALC=false;
  const pct=(a,b)=>b ? Math.round(a/b*100)+'%' : '—';
  const money=n=>'$'+Math.round(n).toLocaleString();
  function styles(){
    if(document.getElementById('rv-css')) return;
    const s=document.createElement('style'); s.id='rv-css';
    s.textContent=`
    .rv{--rv-good:#1d8a5a;--rv-goodsoft:#E7F4EE;--rv-amber:#8a5a00;--rv-ambersoft:#FFF4DC}
    .rv-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}
    .rv-mon{display:flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:12px;padding:4px}
    .rv-mon button{border:0;background:none;font:inherit;font-size:18px;font-weight:700;color:var(--navy,#0F2A4A);width:34px;height:34px;border-radius:8px;cursor:pointer}
    .rv-mon button:disabled{opacity:.3;cursor:default}
    .rv-mon b{min-width:150px;text-align:center;font-size:16px;color:var(--navy,#0F2A4A)}
    .rv-tag{font-size:12px;font-weight:700;border-radius:99px;padding:3px 10px;background:var(--rv-ambersoft);color:var(--rv-amber);white-space:nowrap}
    .rv-acts{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
    .rv-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}
    @media (max-width:980px){ .rv-kpis{grid-template-columns:repeat(2,minmax(0,1fr))} }
    @media (max-width:520px){ .rv-kpis{grid-template-columns:1fr} }
    .rv-kpi{background:var(--navy,#0F2A4A);color:#fff;border-radius:16px;padding:16px 18px;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:2px;min-width:0}
    .rv-kpi:after{content:"";position:absolute;right:-34px;top:-34px;width:120px;height:120px;border-radius:50%;background:rgba(43,192,184,.12);pointer-events:none}
    .rv-kpi .ic{font-size:20px}.rv-kpi .v{font-size:40px;font-weight:800;line-height:1.05;margin-top:6px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
    .rv-kpi .l{font-size:13.5px;color:#cdd9ea;line-height:1.35}
    .rv-kpi .d{align-self:flex-start;margin-top:8px;font-size:12px;font-weight:700;background:rgba(43,192,184,.18);color:#7fe3da;border-radius:99px;padding:3px 9px;border:0;font-family:inherit;position:relative;z-index:1}
    .rv-kpi button.d{cursor:pointer;text-decoration:underline}
    .rv-kpi.ask{background:#fff;color:var(--navy,#0F2A4A);border:2px dashed var(--teal,#149B96)}.rv-kpi.ask .l{color:var(--soft,#56627A)}.rv-kpi.ask .d{background:var(--teal,#149B96);color:#fff;text-decoration:none}
    .rv-card{background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:16px;padding:16px 18px;min-width:0}
    .rv-card h3{margin:0;font-size:15.5px;color:var(--navy,#0F2A4A)}.rv-card .sub{margin:2px 0 12px;font-size:12.5px;color:var(--soft,#56627A)}
    .rv-wk{display:flex;align-items:flex-end;gap:10px;height:150px;border-bottom:1px solid var(--line,#E4E8EE);padding:0 4px}
    .rv-wk .b{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px;min-width:0}
    .rv-wk .b i{display:block;width:100%;max-width:54px;border-radius:6px 6px 0 0;background:var(--teal,#149B96);min-height:3px}.rv-wk .b.now i{background:var(--navy,#0F2A4A)}
    .rv-wk .b b{font-size:13px;color:var(--navy,#0F2A4A);font-variant-numeric:tabular-nums}
    .rv-wx{display:flex;gap:10px;padding:6px 4px 0}.rv-wx span{flex:1;text-align:center;font-size:11.5px;color:var(--soft,#56627A);min-width:0}
    .rv-hb{display:grid;grid-template-columns:minmax(110px,170px) 1fr 66px;gap:10px;align-items:center;margin-bottom:9px;font-size:13.5px}
    .rv-hb .t{height:10px;background:var(--line,#E4E8EE);border-radius:99px;overflow:hidden}.rv-hb .t i{display:block;height:100%;background:var(--teal,#149B96);border-radius:99px}
    .rv-hb .n{text-align:right;color:var(--soft,#56627A);font-size:12.5px;font-variant-numeric:tabular-nums;white-space:nowrap}.rv-hb .n b{color:var(--navy,#0F2A4A);font-size:14px}
    .rv-h{font-size:16px;color:var(--navy,#0F2A4A);margin:4px 2px 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .rv-h small{font-size:12.5px;font-weight:400;color:var(--soft,#56627A)}
    .rv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:18px}
    @media (max-width:520px){ .rv-grid{grid-template-columns:1fr} }
    .rv-app{background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:16px;padding:15px 17px;display:flex;flex-direction:column;gap:12px;min-width:0}
    .rv-app .hd{display:flex;align-items:flex-start;gap:10px}.rv-app .ico,.rv-w .ico{width:38px;height:38px;border-radius:10px;background:var(--teal-soft,#E5F4F3);display:grid;place-items:center;font-size:19px;flex:none}
    .rv-app .nm{font-weight:800;color:var(--navy,#0F2A4A);font-size:15.5px}.rv-app .use{font-size:12.5px;color:var(--soft,#56627A);line-height:1.35;margin-top:1px}
    .rv-chip{margin-left:auto;font-size:11px;font-weight:700;border-radius:99px;padding:3px 9px;white-space:nowrap;flex:none}
    .rv-chip.new{background:var(--navy,#0F2A4A);color:#fff}.rv-chip.upgrade{background:var(--teal-soft,#E5F4F3);color:var(--teal-600,#0F827E)}
    .rv-chip.live{background:var(--rv-goodsoft);color:var(--rv-good)}.rv-chip.review{background:var(--rv-ambersoft);color:var(--rv-amber)}.rv-chip.pilot{background:var(--teal-soft,#E5F4F3);color:var(--teal-600,#0F827E)}
    .rv-nums{display:grid;grid-template-columns:auto 1fr 1fr;gap:12px;align-items:center}
    .rv-ring{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;flex:none}
    .rv-ring b{width:40px;height:40px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:12px;color:var(--navy,#0F2A4A)}
    .rv-nums .x{font-size:12px;color:var(--soft,#56627A);line-height:1.3;min-width:0}.rv-nums .x b{display:block;font-size:22px;color:var(--navy,#0F2A4A);line-height:1.1;font-variant-numeric:tabular-nums}
    .rv-nums .x.money b{color:var(--teal-600,#0F827E)}
    .rv-nums .x small{display:block;font-size:11.5px;color:var(--soft,#56627A);margin-top:3px;line-height:1.3}
    .rv-app .foot{font-size:12px;color:var(--soft,#56627A);border-top:1px solid var(--line,#E4E8EE);padding-top:10px}
    .rv-work{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
    .rv-w{background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:16px;padding:13px 16px;display:grid;grid-template-columns:38px minmax(160px,1fr) minmax(0,2.2fr);gap:12px;align-items:center}
    @media (max-width:760px){ .rv-w{grid-template-columns:38px 1fr} .rv-w .rv-ba{grid-column:1 / -1} }
    .rv-w .t1{font-weight:800;color:var(--navy,#0F2A4A);font-size:14.5px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .rv-w .t2{font-size:12.5px;color:var(--soft,#56627A);margin-top:2px}
    .rv-w .t2 button{border:0;background:none;padding:0;font:inherit;font-size:12.5px;font-weight:700;color:var(--teal-600,#0F827E);cursor:pointer;margin-left:6px}
    .rv-ba{display:grid;grid-template-columns:1fr 16px 1fr;gap:6px;font-size:12.5px;line-height:1.35}
    .rv-ba>div{border-radius:10px;padding:7px 10px}.rv-ba .bf{background:#F6F1F1;color:#7a5b5b}.rv-ba .nw{background:var(--teal-soft,#E5F4F3);color:#0d5f5b;font-weight:600}
    .rv-ba .ar{display:grid;place-items:center;color:var(--soft,#56627A);font-weight:800;padding:0}
    .rv-ba small{display:block;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin-bottom:1px}
    .rv-det{grid-column:1 / -1;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.45;background:#FAFBFC;border-radius:10px;padding:10px 12px}
    .rv-det div{display:grid;grid-template-columns:52px 1fr;gap:6px}.rv-det span:first-child{font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--soft,#56627A);padding-top:2px}
    .rv-note{font-size:12.5px;color:var(--soft,#56627A);margin:12px 2px 0}
    .rv-empty{background:#fff;border:1px dashed var(--line,#E4E8EE);border-radius:16px;padding:18px;color:var(--soft,#56627A);font-size:14px}
    .rv-calc{background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:16px;padding:16px 18px;margin-bottom:16px}
    .rv-calc h3{margin:0;font-size:15.5px;color:var(--navy,#0F2A4A)}.rv-calc .sub{margin:2px 0 12px;font-size:12.5px;color:var(--soft,#56627A)}
    .rv-rate{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-size:14px;font-weight:600;color:var(--navy,#0F2A4A)}
    .rv-in{width:84px;padding:8px 10px;border:1px solid var(--line,#E4E8EE);border-radius:9px;font:inherit;font-size:14px;text-align:right}
    .rv-ctbl{width:100%;border-collapse:collapse;font-size:13.5px;min-width:560px}
    .rv-ctbl th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--soft,#56627A);text-align:left;padding:7px 8px;border-bottom:1px solid var(--line,#E4E8EE)}
    .rv-ctbl td{padding:7px 8px;border-bottom:1px solid var(--line,#E4E8EE);vertical-align:middle}.rv-ctbl td small{display:block;color:var(--soft,#56627A);font-size:11.5px}
    .rv-ctbl .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .rv-ctbl tfoot td{font-weight:800;color:var(--navy,#0F2A4A);border-bottom:0}
    .rv-ctbl tr.grp td{background:#F6F8FA;font-size:12.5px;color:var(--soft,#56627A);padding:8px 8px}.rv-ctbl tr.grp b{color:var(--navy,#0F2A4A)}
    .rv-ctbl td.n small{display:block;font-size:11px;color:var(--soft,#56627A);font-weight:400}
    .rv-per{display:inline-flex;align-items:center;gap:6px;justify-content:flex-end}.rv-per span{font-size:12px;color:var(--soft,#56627A);white-space:nowrap;min-width:70px;text-align:left}
    .rv-cw{overflow-x:auto}.rv-cacts{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}.rv-cacts .msg{font-size:12.5px;color:var(--soft,#56627A);margin-right:auto}`;
    document.head.appendChild(s);
  }
  const firstMonth=()=>WORK.map(i=>i.month).sort()[0];
  const isAdminNow=()=>{ try{ return !!(global.PH && PH.isAdmin && PH.isAdmin(PH.realMe ? PH.realMe() : null)); }catch(_){ return false; } };
  function mount(host){
    styles();
    const today=isoDay(new Date()), cur=today.slice(0,7);
    if(!YM) YM=WORK.some(i=>i.month===cur) ? cur : (WORK.map(i=>i.month).filter(m=>m<=cur).sort().pop() || cur);
    if(!host.querySelector(':scope > .rv')) host.innerHTML='<div class="rv"><div class="rv-empty">Getting the month together…</div></div>';
    if(BUSY){ AGAIN=true; return; }                                       // the team list / access landed meanwhile: count again after
    BUSY=true; AGAIN=false;
    const P=global.PH, ym=YM;
    const recsP=live() && global.PH_STORE ? global.PH_STORE.getAll('ph_use_').then(o=>Object.keys(o||{}).map(k=>o[k])).catch(()=>[]) : Promise.resolve([]);
    const setP=global.PH_STORE ? global.PH_STORE.get(SET_KEY).catch(()=>null) : Promise.resolve(null);
    Promise.all([P.usageReady(), recsP, context(), loadMetrics(ym, today), setP])
      .then(([U, recs, c, m, set])=>{
        BUSY=false; const el=host.querySelector(':scope > .rv'); if(!el || !el.isConnected) return;
        let list=U ? U._pure.people(P.rosterRows ? P.rosterRows() : [], P.rosterView ? P.rosterView() : [], recs) : [];
        const sample=!live();
        if(sample) list=sampleRecords(list, ym, today);
        const since=(U ? U._pure.countedFrom(list) : '') || '';
        const prevYm=shiftMonth(ym,-1), prev=usage(list, prevYm, c, today);
        const u=usage(list, ym, c, today);
        const daysCounted=monthDays(ym, today).filter(d=>!since || d>=since).length;
        const S=set ? set : (sample ? SAMPLE_SET : null);
        LAST={ym, u, prev:(prev.used && (!since || since<=prevYm+'-28')) ? prev : null, m, since, weeks:weekly(list, ym, today, since), val:value(S, m, daysCounted), daysCounted, sample};
        paint(el, today);
        if(ym!==YM || AGAIN){ AGAIN=false; mount(host); }
      }, e=>{ BUSY=false; AGAIN=false; const el=host.querySelector(':scope > .rv'); if(el) el.innerHTML='<div class="rv-empty">The review couldn’t load: '+esc((e && e.message) || 'SharePoint didn’t answer')+'</div>'; });
  }
  function resultOf(a, m){
    const k=(a.metric && m && typeof m[a.metric]==='number') ? a.metric : (a.alt && m && typeof m[a.alt]==='number') ? a.alt : null;
    return k ? {n:m[k].toLocaleString(), t:METRIC[k](m[k])} : null;
  }
  const ring=(a,b)=>{ const p=b ? Math.round(a/b*100) : 0; return '<div class="rv-ring" style="background:conic-gradient(var(--teal,#149B96) '+p+'%,var(--line,#E4E8EE) 0)"><b>'+(b?p+'%':'—')+'</b></div>'; };
  /* The apps worth a card this month: anything with something built, a counted result or a value - most valuable first. */
  /* What an app's usage number IS, in words (Cory: "used it" was vague). A working app (payroll, TC, tasks...) counts the
     people who DID WORK in it - something they did was saved - once that has been recorded; a look-up app (dashboard,
     team...) counts the people who checked it. */
  function usageOf(a, t, L){
    const ws=L.u.workSince, monthEnd=L.ym+'-31', workOn=!!(ws && ws<=monthEnd);
    if(a.work && !a.view){
      if(workOn) return {n:t.worked, d:t.have, label:'did work in it', sub:a.work+(t.opened>t.worked ? ' · '+(t.opened-t.worked)+' more only opened it' : '')};
      return {n:t.opened, d:t.have, label:'opened it', sub:'“Did work” is counted from the next update'};
    }
    return {n:t.opened, d:t.have, label:a.view||'opened it', sub:(a.work && workOn && t.worked) ? t.worked+' '+a.work : ''};
  }
  function appCards(L){
    const use={}; L.u.tools.forEach(t=>{ use[t.k]=t; });
    return APPS.map(a=>{ const t=a.k==='home' ? {used:L.u.used, opened:L.u.used, worked:L.u.worked, have:L.u.counted} : use[a.k], r=resultOf(a, L.m), v=L.val.app[a.k], hst=history(a.k, L.ym);
        return {a, t, r, v:(v && v.dollars>0 && L.val.set.rate) ? v : null, hst}; })
      .filter(x=>x.t && (x.hst.total || x.r || x.v))
      .sort((x,y)=>((y.v?y.v.dollars:0)-(x.v?x.v.dollars:0)) || ((y.hst.thisMonth?1:0)-(x.hst.thisMonth?1:0)) || (y.t.used/Math.max(1,y.t.have))-(x.t.used/Math.max(1,x.t.have)));
  }
  function paint(el, today){
    const L=LAST, u=L.u, m=L.m||{}, V=L.val, mon=MONTHS[+L.ym.slice(5,7)-1], work=WORK.filter(i=>i.month===L.ym);
    let h='<div class="rv-top"><div class="rv-mon" role="group" aria-label="Month"><button type="button" data-m="-1" aria-label="Earlier month"'+(L.ym<=firstMonth()?' disabled':'')+'>‹</button><b>'+esc(monthName(L.ym))+'</b>'+
      '<button type="button" data-m="1" aria-label="Later month"'+(L.ym>=today.slice(0,7)?' disabled':'')+'>›</button></div>'+(L.sample?'<span class="rv-tag">Sandbox: made-up numbers</span>':'')+
      '<div class="rv-acts"><button type="button" class="btn ghost sm" data-calc>🧮 Value calculator</button><button type="button" class="btn ghost sm" data-copy>📋 Copy for email</button></div></div>';
    /* 1. the four numbers - then 2. value by app, 3. this month's work, 4. people each week. Nothing else (Cory: "easy to
       see, use, and understand"). */
    const share=u.counted ? u.used/u.counted : null, was=L.prev ? L.prev.used/L.prev.counted : null;
    const delta=was==null ? 'first month counted' : (Math.round(share*100)>=Math.round(was*100) ? '▲ ' : '▼ ')+'from '+Math.round(was*100)+'% in '+MONTHS[+shiftMonth(L.ym,-1).slice(5,7)-1];
    h+='<div class="rv-kpis">'+
      (V.ready ? '<div class="rv-kpi"><div class="ic">⏱️</div><div class="v">'+money(V.dollars)+'</div><div class="l">of staff time given back in '+esc(mon)+' (≈ '+Math.round(V.hrs)+' hours)</div><button type="button" class="d" data-calc>≈ '+money(V.year)+' a year · how it’s worked out</button></div>'
               : '<div class="rv-kpi ask"><div class="ic">⏱️</div><div class="v">$ ?</div><div class="l">Staff time given back: set the minutes each job saves and the hourly cost.</div><button type="button" class="d" data-calc>Open the value calculator</button></div>')+
      (typeof m.missed==='number' ? '<div class="rv-kpi"><div class="ic">🦷</div><div class="v">'+m.missed.toLocaleString()+'</div><div class="l">exams OrthoFi saw that weren’t logged</div><span class="d">found for follow-up by the TC Tracker</span></div>'
        : '<div class="rv-kpi"><div class="ic">🦷</div><div class="v">'+(typeof m.consults==='number' ? m.consults.toLocaleString() : '—')+'</div><div class="l">new-patient consults logged</div><span class="d">every office, one tracker</span></div>')+
      '<div class="rv-kpi"><div class="ic">💵</div><div class="v">'+(typeof m.paySheets==='number' ? m.paySheets.toLocaleString() : '—')+'</div><div class="l">payroll sheets sent in Home-Brace</div><span class="d">totals add up themselves</span></div>'+
      '<div class="rv-kpi"><div class="ic">👥</div><div class="v">'+(share==null ? '—' : Math.round(share*100)+'%')+'</div><div class="l">'+u.used+' of '+u.counted+' people signed in this month'+(u.workSince ? ' · '+u.worked+' did work in an app' : '')+'</div><span class="d">'+esc(delta)+'</span></div></div>';
    if(CALC) h+=calcHTML();
    /* 2. value by app */
    const cards=appCards(L);
    h+='<h2 class="rv-h">Value by app <small>what each app is for, who uses it and what it saved in '+esc(mon)+'</small></h2>';
    h+=cards.length ? '<div class="rv-grid">'+cards.map(x=>{ const a=x.a;
      return '<div class="rv-app"><div class="hd"><div class="ico" aria-hidden="true">'+a.icon+'</div><div><div class="nm">'+esc(a.n)+'</div><div class="use">Used for: '+esc(a.use)+'</div></div>'+
        (x.hst.thisMonth ? '<span class="rv-chip '+x.hst.thisMonth+'">'+(x.hst.thisMonth==='new'?'New':'Upgraded')+' in '+esc(mon.slice(0,3))+'</span>' : '')+'</div>'+
        (()=>{ const g=usageOf(a, x.t, L); return '<div class="rv-nums">'+ring(g.n, g.d)+'<div class="x"><b>'+g.n+' of '+g.d+'</b>'+esc(g.label)+(g.sub ? '<small>'+esc(g.sub)+'</small>' : '')+'</div>'; })()+
        (x.v ? '<div class="x money"><b>'+money(x.v.dollars)+'</b>staff time saved</div>' : x.r ? '<div class="x"><b>'+esc(x.r.n)+'</b>'+esc(x.r.t)+'</div>' : '<div class="x"></div>')+'</div>'+
        ((x.v && x.r) ? '<div class="foot"><b>'+esc(x.r.n)+'</b> '+esc(x.r.t)+'</div>' : '')+
        '</div>'; }).join('')+'</div>' : '<div class="rv-empty">No apps to show yet.</div>';
    /* 3. this month's work */
    h+='<h2 class="rv-h">This month’s work <span class="rv-tag" style="background:var(--teal-soft,#E5F4F3);color:var(--teal-600,#0F827E)">'+work.filter(w=>w.kind==='new').length+' new · '+work.filter(w=>w.kind==='upgrade').length+' upgrades</span></h2>';
    h+=work.length ? '<div class="rv-work">'+work.map((w,i)=>{ const a=APP(w.app)||{n:w.app, icon:'•'}, key=L.ym+'#'+i;
      return '<div class="rv-w"><div class="ico" aria-hidden="true">'+a.icon+'</div><div><div class="t1">'+esc(w.title)+' <span class="rv-chip '+w.kind+'" style="margin:0">'+KIND[w.kind]+'</span>'+(w.status!=='live' ? ' <span class="rv-chip '+w.status+'" style="margin:0">'+STATUS[w.status]+'</span>' : '')+'</div>'+
        '<div class="t2">'+esc(a.n)+' · asked by '+esc(w.who)+'<button type="button" data-det="'+esc(key)+'" aria-expanded="'+!!OPEN[key]+'">'+(OPEN[key]?'Hide ▴':'Details ▾')+'</button></div></div>'+
        '<div class="rv-ba"><div class="bf"><small>Before</small>'+esc(w.before)+'</div><div class="ar" aria-hidden="true">→</div><div class="nw"><small>Now</small>'+esc(w.now)+'</div></div>'+
        (OPEN[key] ? '<div class="rv-det"><div><span>Ask</span><span>'+esc(w.ask)+'</span></div><div><span>Why</span><span>'+esc(w.why)+'</span></div><div><span>Built</span><span>'+esc(w.built)+(w.extra?' <b>Plus:</b> '+esc(w.extra):'')+'</span></div></div>' : '')+
        '</div>'; }).join('')+'</div>' : '<div class="rv-empty">Nothing was delivered in '+esc(monthName(L.ym))+'.</div>';
    /* 4. people using it, week by week */
    const wmax=Math.max(1, ...L.weeks.map(w=>w.n));
    h+='<h2 class="rv-h">People signing in, week by week <small>everyone who has signed in before'+(L.since && L.since.slice(0,7)===L.ym ? ' · counting began '+esc(short(L.since)) : '')+'</small></h2>'+
      (L.weeks.length ? '<div class="rv-card"><div class="rv-wk">'+L.weeks.map((w,i)=>'<div class="b'+(i===L.weeks.length-1?' now':'')+'"><b>'+w.n+'</b><i style="height:'+Math.max(3, Math.round(w.n/wmax*88))+'%"></i></div>').join('')+'</div>'+
        '<div class="rv-wx">'+L.weeks.map(w=>'<span>Week of '+esc(short(w.from))+'</span>').join('')+'</div></div>' : '<div class="rv-empty">Nothing counted in this month.</div>');
    h+='<p class="rv-note">“Did work” = something they did was saved (a consult logged, a sheet sent, a task ticked...); “opened” = they only looked. Usage counts only people who have signed in'+(L.since ? ' (counting began '+esc(short(L.since))+')' : '')+' and have that app'+(u.never ? '. '+u.never+' on the team list have never signed in, so they’re in no number' : '')+'. Staff time is an estimate from the value calculator.</p>';
    el.innerHTML=h;
    el.onclick=e=>{ const b=e.target.closest('button'); if(!b) return;
      if(b.dataset.m){ YM=shiftMonth(YM, +b.dataset.m); mount(el.parentNode); return; }
      if(b.dataset.det){ OPEN[b.dataset.det]=!OPEN[b.dataset.det]; paint(el, today); return; }
      if(b.hasAttribute('data-calc')){ CALC=!CALC; paint(el, today); if(CALC){ const c=el.querySelector('.rv-calc'); if(c) c.scrollIntoView({behavior:'smooth', block:'start'}); } return; }
      if(b.hasAttribute('data-csave')){ saveCalc(el, today); return; }
      if(b.hasAttribute('data-copy')){ const txt=emailText(); const done=()=>{ b.textContent='✓ Copied'; setTimeout(()=>{ b.textContent='📋 Copy for email'; }, 1800); };
        if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, ()=>prompt('Copy this:', txt)); else prompt('Copy this:', txt); } };
    el.oninput=e=>{ if(e.target.matches('.rv-in')) calcPreview(el); };
  }
  /* THE VALUE CALCULATOR: the practice's own numbers, multiplied by what Home-Brace counted this month. */
  /* THE VALUE CALCULATOR: the practice's own numbers, multiplied by what Home-Brace counted this month. Every number says
     its unit (Cory: "Not clear if minutes saved is for this month this week or what"): counted jobs are "minutes EACH",
     the rest "minutes A WEEK, whole practice", and each row shows its sum ("16 sheets x 20 min"). */
  function calcHTML(){
    const L=LAST, V=L.val, s=V.set, can=isAdminNow(), weeks=Math.round(L.daysCounted/7*10)/10;
    const inp=(attr, v, step)=>'<input class="rv-in" type="number" inputmode="decimal" min="0" step="'+(step||1)+'" '+attr+' value="'+(v||'')+'"'+(can?'':' disabled')+'>';
    const hrs=r=>r.min ? (Math.round(r.min/6)/10).toLocaleString()+' h' : '—', usd=r=>r.min && s.rate ? money(r.min/60*s.rate) : '—';
    const sum=r=>r.kind==='job' ? (r.cnt==null ? 'not counted yet' : r.cnt.toLocaleString()+' '+r.unit[r.cnt===1?0:1]+' × '+(r.per||0)+' min')
                                : weeks+' weeks × '+(r.per||0)+' min';
    const row=r=>'<tr><td>'+esc(r.n)+'<small>'+esc(r.hint)+' · '+esc((APP(r.app)||{}).n||'')+'</small></td>'+
      '<td class="n">'+(r.kind==='job' ? (r.cnt==null?'—':'<b>'+r.cnt.toLocaleString()+'</b> '+esc(r.unit[r.cnt===1?0:1])) : '<b>'+weeks+'</b> weeks')+'</td>'+
      '<td class="n"><span class="rv-per">'+inp('data-'+r.kind+'="'+r.k+'"', r.per, 1)+'<span>'+(r.kind==='job' ? 'min each' : 'min a week')+'</span></span></td>'+
      '<td class="n"><span data-h="'+r.kind+r.k+'">'+hrs(r)+'</span><small data-s="'+r.kind+r.k+'">'+esc(sum(r))+'</small></td><td class="n" data-d="'+r.kind+r.k+'">'+usd(r)+'</td></tr>';
    let h='<div class="rv-calc"><h3>🧮 Value calculator</h3><p class="sub">Heather and Jessica set the numbers; Home-Brace multiplies them by what happened in '+esc(monthName(L.ym))+' ('+L.daysCounted+' days so far).</p>'+
      '<div class="rv-rate">Average hourly cost of staff time $'+inp('data-rate', s.rate, 0.5)+'<span style="font-weight:400;font-size:12.5px;color:var(--soft,#56627A)">per hour, pay plus taxes and benefits</span></div>'+
      '<div class="rv-cw"><table class="rv-ctbl"><thead><tr><th>What Home-Brace does</th><th class="n">In '+esc(MONTHS[+L.ym.slice(5,7)-1])+'</th><th class="n">Time it saves</th><th class="n">Hours saved</th><th class="n">Value</th></tr></thead><tbody>'+
      '<tr class="grp"><td colspan="5"><b>1. Jobs Home-Brace counts</b> - type the minutes ONE of each saves</td></tr>'+
      V.rows.filter(r=>r.kind==='job').map(row).join('')+
      '<tr class="grp"><td colspan="5"><b>2. Everything else</b> - type the minutes the WHOLE PRACTICE saves in a week</td></tr>'+
      V.rows.filter(r=>r.kind==='week').map(row).join('')+
      '</tbody><tfoot><tr><td>Total for '+esc(MONTHS[+L.ym.slice(5,7)-1])+'</td><td></td><td></td><td class="n" data-th>'+(Math.round(V.hrs*10)/10).toLocaleString()+' h</td><td class="n" data-td>'+(V.ready ? money(V.dollars) : '—')+'</td></tr></tfoot></table></div>'+
      '<div class="rv-cacts"><span class="msg">'+(s.by ? 'Last set by '+esc(s.by)+(s.at ? ', '+esc(short(s.at.slice(0,10))) : '') : (can ? 'Not set yet - these are example numbers.' : 'Only an admin can change these.'))+'</span>'+
      (can ? '<button type="button" class="btn sm" data-csave>Save</button>' : '')+'<button type="button" class="btn ghost sm" data-calc>Close</button></div></div>';
    return h;
  }
  function readCalc(el){
    const s={rate:0, jobs:{}, weekly:{}}; const r=el.querySelector('[data-rate]'); if(r) s.rate=num(r.value);
    el.querySelectorAll('[data-job]').forEach(i=>{ s.jobs[i.dataset.job]=num(i.value); });
    el.querySelectorAll('[data-week]').forEach(i=>{ s.weekly[i.dataset.week]=num(i.value); });
    return s;
  }
  function calcPreview(el){
    const V=value(readCalc(el), LAST.m, LAST.daysCounted), weeks=Math.round(LAST.daysCounted/7*10)/10;
    V.rows.forEach(r=>{ const id=r.kind+r.k, hh=el.querySelector('[data-h="'+id+'"]'), dd=el.querySelector('[data-d="'+id+'"]'), ss=el.querySelector('[data-s="'+id+'"]');
      if(hh) hh.textContent=r.min ? (Math.round(r.min/6)/10).toLocaleString()+' h' : '—';
      if(dd) dd.textContent=r.min && V.set.rate ? money(r.min/60*V.set.rate) : '—';
      if(ss) ss.textContent=r.kind==='job' ? (r.cnt==null ? 'not counted yet' : r.cnt.toLocaleString()+' '+r.unit[r.cnt===1?0:1]+' × '+(r.per||0)+' min') : weeks+' weeks × '+(r.per||0)+' min'; });
    const th=el.querySelector('[data-th]'), td=el.querySelector('[data-td]');
    if(th) th.textContent=(Math.round(V.hrs*10)/10).toLocaleString()+' h'; if(td) td.textContent=V.ready ? money(V.dollars) : '—';
  }
  function saveCalc(el, today){
    if(!isAdminNow() || !global.PH_STORE) return;
    const s=readCalc(el), me_=(global.PH && PH.realMe && PH.realMe()) || {};
    s.by=String(((me_.first||'')+' '+(me_.last||'')).trim() || 'An admin'); s.at=new Date().toISOString();
    const btn=el.querySelector('[data-csave]'); if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
    global.PH_STORE.update(SET_KEY, ()=>cleanSet(s)).then(()=>{ LAST.val=value(cleanSet(s), LAST.m, LAST.daysCounted); CALC=false; paint(el, today); },
      ()=>{ if(btn){ btn.disabled=false; btn.textContent='Didn’t save - try again'; } });
  }
  /* The same month as plain words, for an email to the doctors. */
  function emailText(){
    const L=LAST, u=L.u, m=L.m||{}, V=L.val, work=WORK.filter(i=>i.month===L.ym);
    let t='Home-Brace - '+monthName(L.ym)+'\n\n';
    if(V.ready) t+='Staff time given back: '+money(V.dollars)+' (about '+Math.round(V.hrs)+' hours) - about '+money(V.year)+' a year at this pace\n';
    if(typeof m.missed==='number') t+='Exams OrthoFi saw that weren\'t logged, found for follow-up: '+m.missed+'\n';
    if(typeof m.paySheets==='number') t+='Payroll sheets sent in Home-Brace: '+m.paySheets+'\n';
    t+='Signed in this month: '+u.used+' of '+u.counted+' people ('+pct(u.used, u.counted)+')'+(u.workSince ? '; '+u.worked+' did work in an app' : '')+'\n\nValue by app:\n';
    appCards(L).forEach(x=>{ const g=usageOf(x.a, x.t, L); t+='- '+x.a.n+' ('+x.a.use.replace(/\.$/,'')+'): '+g.n+' of '+g.d+' with access '+g.label+(x.r ? '; '+x.r.n+' '+x.r.t : '')+(x.v ? '; '+money(x.v.dollars)+' staff time saved' : '')+'\n'; });
    t+='\nThis month\'s work:\n';
    work.forEach(w=>{ t+='- '+KIND[w.kind]+': '+w.title+' ('+(APP(w.app)||{n:w.app}).n+', asked by '+w.who+(w.status!=='live' ? ', '+STATUS[w.status].toLowerCase() : '')+'): '+w.before+' -> '+w.now+'.\n'; });
    return t;
  }

  /* the same made-up visits for the Usage tab on the sandbox (Cory: "I don't see what you did to the usage app in sandbox") */
  const sample=list=>{ const t=isoDay(new Date()); return sampleRecords(list, t.slice(0,7), t); };
  global.PH_REVIEW={mount, WORK, APPS, context, toolUse, sample, _pure:{APPS, WORK, JOBS, WEEKLY, usage, toolUse, weekly, hasTool, counted, monthDays, paySheets, tasksDone, consults, missed, prodDays, celebrations, cleanSet, value, history, shiftMonth, usageOf, workSince}};
})(typeof window!=='undefined' ? window : globalThis);
