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
  const BASE_OFFICES=[
    {k:'carlsbad',  n:'Carlsbad',   co:'Farnsworth Orthodontics, PLLC (Carlsbad)', by:'TC'},
    {k:'hobbs',     n:'Hobbs',      co:'Farnsworth Orthodontics Hobbs, PLLC', by:'office manager'},
    {k:'lubbock',   n:'Lubbock',    co:'Farnsworth Family Orthodontics, PLLC (Lubbock)', by:'clinic lead', own:[{k:'phone',n:'Phone'}]},
    {k:'clovis',    n:'Clovis',     co:'Farnsworth Orthodontics, P.C. (Clovis)', by:'office manager', own:[{k:'sick',n:'Sick hrs',hrs:true}]},
    {k:'sanangelo', n:'San Angelo', co:'Farnsworth Orthodontics San Angelo, PLLC', by:'office manager', own:[{k:'dibs',n:'DIBS',each:'dibs'},{k:'pog',n:'POG'}]},
    {k:'zihua',     n:'Zihua Partners', co:'Zihua Partners', by:'Heather', self:true},   // Heather fills it in herself (03/11)
    {k:'mansfield', n:'Mansfield',  co:'Sunflower Orthodontics PLLC', by:'office manager'},
    {k:'crucesffo', n:'Cruces FFO', co:'Farnsworth Legacy – Farnsworth Orthodontics Las Cruces LLC', by:'TC'},
    {k:'cruceslco', n:'Cruces LCO', co:'Las Cruces Orthodontics – Farnsworth Orthodontics LLC', by:'office manager'}
  ];
  /* A NEW OFFICE (17/11/2026). Cory: "If another office is added it would have to add to the entire workflow" -
     "be very careful we don't mess anything up". The 9 above never change (their keys name every file). An office
     added in Admin -> Locations shows up in Payroll -> Settings as new; whoever manages payroll adds it there with its
     company name, and from then on it is in Payroll everywhere (its sheet, the combined sheet, who sends it, its
     folder and access) - kept in the shared list 'ph_pay_offices' {add:[{k, n, co, by}]}, never dropped on its own.
     Its key is 'x' + its name in letters and digits, so it can't take one of the 9's. */
  const SAFE_NAME=/^[^"*:<>?\/\\|#%]{1,60}$/;
  const BYS=['office manager', 'TC', 'clinic lead'];
  function keyFor(n){ return 'x' + String(n).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30); }
  function cleanOffices(rec){
    rec=(rec && typeof rec==='object') ? rec : {};
    const taken=new Set(BASE_OFFICES.map(o=>o.n.toLowerCase())), keys=new Set(BASE_OFFICES.map(o=>o.k)), add=[];
    (Array.isArray(rec.add) ? rec.add : []).forEach(o=>{
      const n=String((o && o.n) || '').trim(), k=String((o && o.k) || '');
      if(!n || !SAFE_NAME.test(n) || n.trim()!==n || /^\.|\.$/.test(n) || taken.has(n.toLowerCase())) return;
      if(k!==keyFor(n) || k.length<2 || keys.has(k)) return;
      taken.add(n.toLowerCase()); keys.add(k);
      add.push({k, n, co:String(o.co || n).trim().slice(0, 120) || n, by:BYS.indexOf(o.by)>=0 ? o.by : 'office manager'});
    });
    return {add};
  }
  let OFFICES=BASE_OFFICES.slice(), OFFEXTRA=cleanOffices(null);
  function setOffices(rec){
    OFFEXTRA=cleanOffices(rec);
    OFFICES=BASE_OFFICES.concat(OFFEXTRA.add);
    if(typeof api!=='undefined'){ api.OFFICES=OFFICES; api.OFF=Object.fromEntries(OFFICES.map(o=>[o.k, o])); api.OFFEXTRA=OFFEXTRA; }
    return OFFICES;
  }
  /* Offices in Admin -> Locations that Payroll doesn't have yet (names). */
  function newOffices(locNames){
    const have=new Set(OFFICES.map(o=>o.n.toLowerCase()));
    return (locNames || []).map(n=>String(n || '').trim()).filter((n, i, a)=>n && a.indexOf(n)===i && !have.has(n.toLowerCase()));
  }
  /* The office folders a sync must look at: every office Payroll has, AND every office folder access was ever given on
     (the record) - a folder never drops out of the sync just because a list didn't have it, so nobody's access is
     taken back that way. Heather's own folder is never one of them. */
  function syncOffices(base, record, priv){
    const out=OFFICES.map(o=>o.n);
    Object.keys(record || {}).forEach(p=>{ if(p.indexOf(base + '/')===0){ const n=p.slice(base.length + 1); if(n && n!==priv && !/[\/\\]/.test(n) && out.indexOf(n)<0) out.push(n); } });
    return out;
  }
  const OFF=Object.fromEntries(OFFICES.map(o=>[o.k,o]));
  const RATES={onCall:50, holiday:100, holidayHrs:8, mile:0.76, dibs:10};      // dibs: $ each - San Angelo types a count (17/11/2026)
  /* RATES THAT CHANGE (17/11/2026). Heather: the mileage rate says "change it here" but nothing could change it. Cory:
     "build rates". A change says which pay period it starts in (from = that pay period's first day); every pay period
     before it keeps the rate it was paid at. Kept in the shared list 'ph_pay_rates' {changes:[{id, from, r:{mile:0.7},
     at, by}]} - amounts only. Applied in order of their start (the later one wins when two start together). */
  const RATE_LIMITS={onCall:[0,2000], holiday:[0,5000], holidayHrs:[0,24], mile:[0,5], dibs:[0,1000]};
  function cleanRates(x){
    const out=[]; ((x && Array.isArray(x.changes)) ? x.changes : []).forEach(c=>{
      if(!c || typeof c!=='object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(c.from||''))) return;
      const r={}; Object.keys(RATE_LIMITS).forEach(k=>{ const v=c.r && c.r[k]; if(v===undefined || v===null || v==='') return;
        const n=Number(v); if(isFinite(n) && n>=RATE_LIMITS[k][0] && n<=RATE_LIMITS[k][1]) r[k]=Math.round(n*100)/100; });
      if(!Object.keys(r).length) return;
      out.push({id:String(c.id||('r'+out.length)).slice(0,40), from:c.from, r, at:String(c.at||'').slice(0,40), by:String(c.by||'').slice(0,120)});
    });
    return out.slice(-200).sort((a,b)=>a.from<b.from?-1:a.from>b.from?1:0);    // sort is stable: same start keeps the order made
  }
  function ratesOn(base, changes, day){
    const out=Object.assign({}, base||RATES);
    (changes||[]).forEach(c=>{ if(c && c.from<=day) Object.assign(out, c.r); });
    return out;
  }
  /* Until Heather keeps her own list in Settings. */
  /* PAID HOLIDAYS, WORKED OUT EVERY YEAR (17/11/2026). The list used to be typed in and stopped at Christmas 2027 - from
     2028 holiday pay would quietly have gone missing. Cory: "Everything we build needs to be scalable". The six paid
     holidays by their rule - New Year's Day, Memorial Day (last Monday of May), Independence Day, Labor Day (first
     Monday of September), Thanksgiving (fourth Thursday of November), Christmas. PAID ON THE ACTUAL DAY (Heather,
     17/11/2026: "We pay the Holiday no matter what day it falls on. It would be ideal for Home Brace to pay it out on
     the actual day") - July 4 is July 4 even on a Saturday, for the pay AND for the "sheets due Monday" week. (Pay
     periods run Sunday to Saturday, so the Friday-before / Monday-after dates typed in before were always in the same
     pay period anyway.) Years 2026 to two years ahead of today; no list to keep up to date. */
  function iso(dt){ return dt.toISOString().slice(0, 10); }
  function nthDay(y, m, wd, n){ const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return iso(new Date(Date.UTC(y, m - 1, 1 + ((wd - first + 7) % 7) + (n - 1) * 7))); }
  function lastDay(y, m, wd){ const last = new Date(Date.UTC(y, m, 0)); return iso(new Date(Date.UTC(y, m - 1, last.getUTCDate() - ((last.getUTCDay() - wd + 7) % 7)))); }
  function fixed(y, m, d, n){ return {d:iso(new Date(Date.UTC(y, m - 1, d))), n}; }
  function holidaysFor(y){
    return [fixed(y, 1, 1, 'New Year’s Day'), {d:lastDay(y, 5, 1), n:'Memorial Day'}, fixed(y, 7, 4, 'Independence Day'),
            {d:nthDay(y, 9, 1, 1), n:'Labor Day'}, {d:nthDay(y, 11, 4, 4), n:'Thanksgiving'}, fixed(y, 12, 25, 'Christmas')];
  }
  function holidaysThrough(toYear){ let out = []; for(let y = 2026; y <= toYear; y++) out = out.concat(holidaysFor(y)); return out.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0); }
  /* HEATHER CAN CHANGE THEM (17/11/2026). Cory: "its never very scalable to just do a few years and give nobody the
     ability to modify or change things." Payroll -> Settings: take a holiday off (the practice doesn't pay it that
     year), or add a paid day (the day after Thanksgiving; a holiday moved = one taken off + one added). Kept in the
     shared list 'ph_pay_holidays' {off:[date], add:[{d, n}]} - dates and names only - so every sheet and reminder
     follows, not only Heather's. Everything else keeps coming from the rule, year after year. */
  const DAY=/^\d{4}-\d{2}-\d{2}$/;
  function cleanEdits(ed){
    ed=(ed && typeof ed==='object') ? ed : {};
    const off=[...new Set((Array.isArray(ed.off) ? ed.off : []).map(String).filter(d=>DAY.test(d)))].sort();
    const seen={}, add=(Array.isArray(ed.add) ? ed.add : []).filter(h=>h && DAY.test(String(h.d)) && !seen[h.d] && (seen[h.d]=1))
      .map(h=>({d:String(h.d), n:String(h.n||'').trim().slice(0, 60) || 'Paid holiday'})).sort((a, b)=>a.d < b.d ? -1 : 1);
    return {off, add};
  }
  function withEdits(list, ed){
    ed=cleanEdits(ed);
    const kept=list.filter(h=>ed.off.indexOf(h.d) < 0);
    return kept.concat(ed.add.filter(a=>!kept.some(h=>h.d===a.d)).map(a=>({d:a.d, n:a.n, added:true})))
      .sort((a, b)=>a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  }
  let EDITS=cleanEdits(null);
  let HOLIDAYS=holidaysThrough(new Date().getFullYear() + 2);
  function setHolidayEdits(ed){
    EDITS=cleanEdits(ed);
    HOLIDAYS=withEdits(holidaysThrough(new Date().getFullYear() + 2), EDITS);
    api.HOLIDAYS=HOLIDAYS; api.EDITS=EDITS;
    return HOLIDAYS;
  }
  /* The holiday(s) in a stretch of days. Two can share a pay period (Christmas and New Year's Day, December 2028): then
     one entry for both - name "Christmas + New Year’s Day", ds = both dates - and each is paid. */
  function holIn(holidays, start, end){
    const hs = (holidays || HOLIDAYS).filter(h => h.d >= start && h.d <= end);
    return !hs.length ? null : hs.length === 1 ? hs[0] : {d:hs[0].d, n:hs.map(h => h.n).join(' + '), ds:hs.map(h => h.d)};
  }
  const holDates=hol => !hol ? [] : (hol.ds || [hol.d]);

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
  /* The first pay period on Home-Brace (Heather: go live with #24, Nov 1-14). Nothing before it is expected - no sheet,
     no reminder, no "late" - those were done the old way. */
  const FIRST='2026-24';
  const payOf=i=>addDays(ANCHOR, i*14);
  function numberOf(pay){
    // pay dates of that year before this one: step back 14 days while still in the same year
    let n=1, x=addDays(pay,-14); while(x.slice(0,4)===pay.slice(0,4)){ n++; x=addDays(x,-14); }
    return n;
  }
  function period(i, holidays){
    holidays=holidays||HOLIDAYS;      // the current list, Heather's changes included (setHolidayEdits)
    const pay=payOf(i), end=addDays(pay,-6), start=addDays(end,-13), n=numberOf(pay), year=+pay.slice(0,4);   // Sunday to Saturday
    const mon=addDays(end,2), dueHol=holidays.find(h=>h.d>mon && h.d<=addDays(end,6))||null, due=dueHol?mon:addDays(end,3);
    return {i, n, year, key:year+'-'+pad(n), start, w1end:addDays(start,6), w2start:addDays(start,7), end, pay, due, dueAt:due+'T14:00', dueHol,
            hol:holIn(holidays, start, end)};
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
    const holN=holDates(per.hol).filter(d=>eligible(p.start, d)).length, hol=!p.holHrs?holN*rates.holiday:0, holH=p.holHrs?holN*rates.holidayHrs:0;
    const oc=num(x.oncall)*rates.onCall, own=r2(num(x.phone)+num(x.dibs)*num(rates.dibs==null ? RATES.dibs : rates.dibs)+num(x.pog)), extra=r2(num(cols.extra)+num(x.exc)+num(x.spb));   // spb: the office's special bonus (payroll.html SPECIAL_LIVE)
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
      if(OFFICES.some(x=>x.n===o && x.self)) return;           // Zihua Partners: nobody sends it, so nobody is given it
      (senders[o]||[]).forEach(e=>{ const em=String(e||'').trim().toLowerCase(); if(em) put(base+'/'+o, em, 'write'); });
    });
    return {want, noEmail};
  }

  const api={OFFICES, OFF, OFFEXTRA, BASE_OFFICES, BYS, keyFor, cleanOffices, setOffices, newOffices, syncOffices, OFF_KEY:'ph_pay_offices', SAFE_NAME, RATES, RATE_LIMITS, RATE_KEY:'ph_pay_rates', cleanRates, ratesOn, HOLIDAYS, EDITS, holidaysFor, holidaysThrough, holIn, holDates, cleanEdits, withEdits, setHolidayEdits, HOL_KEY:'ph_pay_holidays', ANCHOR, FIRST, addDays, dow, days, todayISO, workdayBefore, payOf, numberOf, period, currentIndex, indexOfKey,
    eligibleOn, eligible, num, r2, cutVal, cutBy, otOK, calc, wanted};
  global.PAYRULES=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined' ? window : globalThis);
