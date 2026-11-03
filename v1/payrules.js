/* PAYROLL - THE RULES behind payroll.html, kept apart so node can test them (test/payrules.test.js) and Admin can use
   them to hand out folder access. 01/11/2026, Heather: "We can go live with the payroll sheet."

   Everything here is Heather's own: her main sheet's offices and companies (in its order), who sends each one, each
   office's own columns, her pay periods (every other week, Sunday to Saturday, paid the Friday after - anchored on her
   sheet: pay period #20 was paid Sept 25, 2026; Heather 03/11: "the next pay period is Nov 1st - Nov 14th"), her due day (Tuesday by 2 pm Central; Monday when a holiday falls
   LATER that week - a Monday holiday keeps Tuesday, 22/10), and her sums (holiday pay $100 after the 90-day review,
   on call $50 a weekend, mileage at the IRS rate, reimbursements kept out of Total). */
(function(global){
  'use strict';

  /* In the order of her main sheet. by = who sends it; own = the office's own columns (typed by the office). */
  const OFFICES=[
    {k:'carlsbad',  n:'Carlsbad',   co:'Farnsworth Orthodontics, PLLC (Carlsbad)', by:'TC'},
    {k:'hobbs',     n:'Hobbs',      co:'Farnsworth Orthodontics Hobbs, PLLC', by:'office manager'},
    {k:'lubbock',   n:'Lubbock',    co:'Farnsworth Family Orthodontics, PLLC (Lubbock)', by:'clinic lead', own:[{k:'phone',n:'Phone'}]},
    {k:'clovis',    n:'Clovis',     co:'Farnsworth Orthodontics, P.C. (Clovis)', by:'office manager', own:[{k:'sick',n:'Sick hrs',hrs:true}]},
    {k:'sanangelo', n:'San Angelo', co:'Farnsworth Orthodontics San Angelo, PLLC', by:'office manager', own:[{k:'dibs',n:'DIBS'},{k:'pog',n:'POG'}]},
    {k:'mansfield', n:'Mansfield',  co:'Sunflower Orthodontics PLLC', by:'office manager'},
    {k:'crucesffo', n:'Cruces FFO', co:'Farnsworth Legacy – Farnsworth Orthodontics Las Cruces LLC', by:'TC'},
    {k:'cruceslco', n:'Cruces LCO', co:'Las Cruces Orthodontics – Farnsworth Orthodontics LLC', by:'office manager'}
  ];
  const OFF=Object.fromEntries(OFFICES.map(o=>[o.k,o]));
  const RATES={onCall:50, holiday:100, holidayHrs:8, mile:0.76};
  /* Until Heather keeps her own list in Settings. */
  const HOLIDAYS=[{d:'2026-01-01',n:'New Year’s Day'},{d:'2026-05-25',n:'Memorial Day'},{d:'2026-07-03',n:'Independence Day'},
    {d:'2026-09-07',n:'Labor Day'},{d:'2026-11-26',n:'Thanksgiving'},{d:'2026-12-25',n:'Christmas'},
    {d:'2027-01-01',n:'New Year’s Day'},{d:'2027-05-31',n:'Memorial Day'},{d:'2027-07-05',n:'Independence Day'},
    {d:'2027-09-06',n:'Labor Day'},{d:'2027-11-25',n:'Thanksgiving'},{d:'2027-12-24',n:'Christmas'}];

  /* ---------- dates: 'YYYY-MM-DD' strings ---------- */
  const pad=n=>String(n).padStart(2,'0');
  const addDays=(iso,d)=>{ const t=new Date(iso+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()+d); return t.toISOString().slice(0,10); };
  const dow=iso=>new Date(iso+'T12:00:00Z').getUTCDay();
  const days=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
  const todayISO=d=>{ d=d||new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
  function workdayBefore(d){ let x=addDays(d,-1); while(dow(x)===0 || dow(x)===6) x=addDays(x,-1); return x; }

  /* ---------- pay periods ----------
     Absolute index i: i=0 is the period paid on ANCHOR (Sept 25, 2026). Each one's number is its place among the pay
     dates of its pay date's YEAR - #1 is the first Friday paid in January - so #20 of 2026 is i=0, and 2027 starts
     again at #1. Its key, 'YYYY-NN', names its files (sheet_2026-23.json). */
  const ANCHOR='2026-09-25';
  const payOf=i=>addDays(ANCHOR, i*14);
  function numberOf(pay){
    // pay dates of that year before this one: step back 14 days while still in the same year
    let n=1, x=addDays(pay,-14); while(x.slice(0,4)===pay.slice(0,4)){ n++; x=addDays(x,-14); }
    return n;
  }
  function period(i, holidays){
    holidays=holidays||HOLIDAYS;
    const pay=payOf(i), end=addDays(pay,-6), start=addDays(end,-13), n=numberOf(pay), year=+pay.slice(0,4);   // Sunday to Saturday
    const mon=addDays(end,2), dueHol=holidays.find(h=>h.d>mon && h.d<=addDays(end,6))||null, due=dueHol?mon:addDays(end,3);
    return {i, n, year, key:year+'-'+pad(n), start, w1end:addDays(start,6), w2start:addDays(start,7), end, pay, due, dueAt:due+'T14:00', dueHol,
            hol:holidays.find(h=>h.d>=start && h.d<=end)||null};
  }
  /* The period whose sheet is being filled in: the one that ended most recently (its due day and pay day come after). */
  function currentIndex(today){ const i=Math.floor(days(addDays(ANCHOR,-6), today)/14); return days(addDays(payOf(i),-6), today)>0 ? i : i-1; }
  const indexOfKey=key=>{ const m=/^(\d{4})-(\d{2})$/.exec(String(key||'')); if(!m) return null;
    for(let i=currentIndex(m[1]+'-12-31')+1; i>-500; i--){ const p=period(i); if(p.key===key) return i; if(p.year<+m[1]) return null; } return null; };

  /* ---------- people ---------- */
  const eligibleOn=start=>start ? addDays(start,90) : '';
  const eligible=(start,d)=>!!start && eligibleOn(start)<=d;

  /* ---------- the sums: one rule for every row ----------
     p = the person {start, holHrs}; x = their row on the office's sheet; cols = Heather's own columns for them
     {goal, tcom, extra}; bonus = their pay-period bonus amount (Heather's Settings). */
  const num=v=>{ const n=parseFloat(v); return isFinite(n)?n:0; };
  const r2=n=>Math.round(n*100)/100;
  const cutVal=x=>(x.cut!==undefined && x.cut!=='') ? x.cut : (x.pct||'');
  const cutBy=x=>x.cutBy||'pct';
  const otOK=(x,w)=>x['ot'+w]!==undefined ? !!x['ot'+w] : !!x.ot;
  function calc(p, x, per, rates, bonus, cols){
    rates=rates||RATES; cols=cols||{}; x=x||{};
    const w1=num(x.w1), w2=num(x.w2), ot1=Math.max(0,w1-40), ot2=Math.max(0,w2-40), b=num(bonus), cut=num(cutVal(x));
    const ppb=x.bonus==='none' ? 0 : x.bonus==='partial' ? r2(Math.max(0, cutBy(x)==='usd' ? b-cut : b*(1-cut/100))) : b;
    const holOn=!!(per.hol && eligible(p.start, per.hol.d)), hol=holOn&&!p.holHrs?rates.holiday:0, holH=holOn&&p.holHrs?rates.holidayHrs:0;
    const oc=num(x.oncall)*rates.onCall, own=num(x.phone)+num(x.dibs)+num(x.pog), extra=r2(num(cols.extra)+num(x.exc));
    return {hours:w1+w2, reg:r2(w1+w2-ot1-ot2), ot1:r2(ot1), ot2:r2(ot2), ppb, pto:num(x.pto), sick:num(x.sick), hol, holH, oc,
            goal:num(cols.goal), tcom:num(cols.tcom), own, extra, exc:num(x.exc), reimb:r2((num(x.mkt)+num(x.oth))*rates.mile),
            total:r2(ppb+num(cols.goal)+num(cols.tcom)+hol+oc+own+extra)};
  }

  /* ---------- who may open which payroll folder (Admin hands these out: docs.js paySync) ----------
     roster: [{email, teams, name}]; roleOf(teams) -> 'write' (manages payroll: everything), 'read' (sees everything),
     '' (neither); senders: {office name: [email]} (Heather's "Who sends each office's sheet", ph_pay_senders).
     -> {want: {folder path: {email: role}}, noEmail: [name]}. Managers get the payroll folder and every office's; a
     sender gets their own office's folder only; the Heather folder is never in it (it inherits the managers). */
  function wanted(base, roster, roleOf, senders, offices){
    offices=offices||OFFICES.map(o=>o.n); senders=senders||{};
    const want={}, noEmail=[], put=(path, em, role)=>{ want[path]=want[path]||{}; if(want[path][em]!=='write') want[path][em]=role; };
    want[base]={};
    offices.forEach(o=>{ want[base+'/'+o]={}; });
    (roster||[]).forEach(person=>{
      const role=roleOf(person.teams||[]); if(!role) return;
      const em=String(person.email||'').trim().toLowerCase();
      if(!em){ noEmail.push(person.name); return; }
      put(base, em, role); offices.forEach(o=>put(base+'/'+o, em, role));
    });
    Object.keys(senders).forEach(o=>{
      if(offices.indexOf(o)<0) return;                         // an office payroll doesn't have: nothing to give
      (senders[o]||[]).forEach(e=>{ const em=String(e||'').trim().toLowerCase(); if(em) put(base+'/'+o, em, 'write'); });
    });
    return {want, noEmail};
  }

  const api={OFFICES, OFF, RATES, HOLIDAYS, ANCHOR, addDays, dow, days, todayISO, workdayBefore, payOf, numberOf, period, currentIndex, indexOfKey,
    eligibleOn, eligible, num, r2, cutVal, cutBy, otOK, calc, wanted};
  global.PAYRULES=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined' ? window : globalThis);
