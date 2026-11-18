/* MONTHLY REPORT - the rules (18/11/2026). Heather: "At the beginning of the month each office sends a monthly monitor
   report from the month prior. The offices who have Medicaid have an extra section ... I would love for them to start
   building this in Home Brace and it keeps record of each month and the years past, present and future." Her list
   (email 2): the numbers below + 6 Medicaid ones; "All Medicaid, overestimated completion date and comfort percentage
   reporting will come from the PMS manually entered" - the rest from OrthoFi (filled in nightly once connected).
   Cory: "It has to be more than just her excel" - so beyond the sheet: the gap to goal in DOLLARS, what needs a
   conversation, the month so far every morning, a mismatch flag when a typed number and OrthoFi disagree, notes.
   WORDING (Heather 18/11 IDEA: "change the wording to target instead of goal. I know it may have said that on the sheets
   ... but I was not the original creator of that"): everything people READ says "target"; the code keeps its names.
   Kept in Home-Brace's shared list: one record per year  ph_monthly_<year>  {v:1, o:{<office>:{<mm>:<month>}}}
     <month> = {v:{field:number}, src:{field:'orthofi'|'typed'}, at:{field:iso}, by:{field:who},
                ofv:{field:OrthoFi's latest number}, of:iso (OrthoFi's last refresh), sent:{at,by}, final:{at,by},
                notes:[{t,by,at}]}
   and the settings  ph_monthly_settings  {medicaid:[office names], goals:{...}, due:5}.
   Totals only - never a patient. The live switch is MONTHLY_LIVE in user.js (PH.monthlyOn). */
(function(global){
  'use strict';
  const KEY=y=>'ph_monthly_'+y, SET_KEY='ph_monthly_settings';
  /* t: '$' dollars, '#' a count, '%' a percent (stored as 7.1 for 7.1%). from: 'orthofi' (filled in automatically once
     OrthoFi is connected) or 'pms' (typed from the practice software). flow: a month's activity, adds up over a year;
     otherwise a month-end figure (a balance or a percent) - averaged, never added up. */
  const FIELDS=[
    {k:'gp',   n:'Gross production',                   t:'$', from:'orthofi', flow:true},
    {k:'gc',   n:'Gross collections',                  t:'$', from:'orthofi', flow:true},
    {k:'adj',  n:'Net production adjustments',         t:'$', from:'orthofi', flow:true, help:'Usually a minus number'},
    {k:'np',   n:'Net production',                     t:'$', from:'orthofi', flow:true},
    {k:'ar',   n:'Accounts receivable',                t:'$', from:'orthofi'},
    {k:'arn',  n:'Number of accounts receivable',      t:'#', from:'orthofi'},
    /* Heather 18/11: "Instead of them doing the math to find the percentage. Maybe Home Brace could calculate it" - so the
       COUNT is kept (as the old sheet's column K) and the % of accounts is worked out (CALC delpct, the old L = K/J). */
    {k:'deln', n:'Delinquent accounts past 30 days',   t:'#', from:'orthofi'},
    {k:'ar90', n:'$ 90+ days past due',                t:'$', from:'orthofi'},
    {k:'npe',  n:'New patient exams',                  t:'#', from:'orthofi', flow:true},
    {k:'act',  n:'Active patients',                    t:'#', from:'orthofi'},
    {k:'disc', n:'Total discounts',                    t:'$', from:'orthofi', flow:true},
    /* Heather 18/11: a COUNT, and it "comes from Orthofi but you can't run a report for it" - it is the "Retainer Insurance
       Program" line on a contract's itemization; OrthoFi's API lists each treatment's add-on (productLine), so the nightly
       pull can count it. Typed until then. */
    {k:'rip',  n:'RIP sold (Retainer Insurance Program)', t:'#', from:'orthofi', flow:true},
    {k:'oecd', n:'Over estimated completion date',     t:'%', from:'pms'},
    {k:'cmf',  n:'Comfort percentage',                 t:'%', from:'pms'},
    {k:'mds',  n:'Medicaid submissions',               t:'#', from:'pms', flow:true, medicaid:true},
    {k:'mdd',  n:'Medicaid denials',                   t:'#', from:'pms', flow:true, medicaid:true},
    {k:'mda',  n:'Medicaid approvals',                 t:'#', from:'pms', flow:true, medicaid:true},
    {k:'mdb',  n:'Medicaid bandings',                  t:'#', from:'pms', flow:true, medicaid:true},
    {k:'mdp',  n:'Medicaid production',                t:'$', from:'pms', flow:true, medicaid:true},
    {k:'mdc',  n:'Medicaid collections',               t:'$', from:'pms', flow:true, medicaid:true}];
  const BY={}; FIELDS.forEach(f=>{ BY[f.k]=f; });
  /* worked out, never typed - the old sheet's ratios, against Heather's goals */
  const CALC=[
    {k:'colpct', n:'Collection %',  t:'%', of:v=>v.gp ? v.gc/v.gp*100 : null, goal:'col'},
    /* write-offs as a share of production: adjustments are signed (minus = written off, as in OrthoFi and six of the eight
       sheets), so a month whose adjustments ADD to production shows below zero rather than as a write-off */
    {k:'adjpct', n:'Adjustment %',  t:'%', of:v=>v.gp && v.adj!=null ? -v.adj/v.gp*100 : null, goal:'adj'},
    {k:'ratio',  n:'A/R ratio',     t:'x', of:v=>v.gp && v.ar!=null ? v.ar/v.gp : null, goal:'ratio'},
    {k:'delpct', n:'Delinquent %',  t:'%', of:v=>v.arn && v.deln!=null ? v.deln/v.arn*100 : null, goal:'del'}];
  /* the old sheet's goals row. Heather's email 2 (the list below is exactly hers) narrowed what the report shows -
     case starts and case acceptance (>70%) were on the old sheet and are NOT on her list, so they are not here. */
  const DEF_GOALS={col:[91,93], adj:[7,9], ratio:[5.5,6], del:[5,7]};
  const GOAL_NAMES={col:'Collection %', adj:'Adjustment %', ratio:'A/R ratio', del:'Delinquent %'};
  const DEF_MEDICAID=['Clovis','Hobbs','Carlsbad','Cruces LCO'];     // Heather 03/11 - she can change it in Settings
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mm=m=>String(m).padStart(2,'0');
  const num=v=>{ if(v===null || v===undefined || v==='') return null; const n=typeof v==='number' ? v : Number(String(v).replace(/[$,%\s]/g,'')); return isFinite(n) ? n : null; };
  const r2=x=>Math.round(x*100)/100;
  const LIMIT={'$':[-1e9,1e9], '#':[0,1e7], '%':[0,1000]};
  const str=(x,n)=>typeof x==='string' ? x.slice(0,n) : '';
  /* one value as it may be kept: a sound number within sensible limits, or null (empty) */
  function cleanVal(k, v){ const f=BY[k]; if(!f) return null; const n=num(v); if(n===null) return null; const L=LIMIT[f.t]; if(n<L[0] || n>L[1]) return null;
    return f.t==='#' ? Math.round(n) : r2(n); }
  function cleanMonth(r){
    r=r && typeof r==='object' ? r : {}; const o={v:{}, src:{}, at:{}, by:{}, ofv:{}};
    FIELDS.forEach(f=>{
      const ov=cleanVal(f.k, (r.ofv||{})[f.k]); if(ov!==null && f.from==='orthofi') o.ofv[f.k]=ov;
      const v=cleanVal(f.k, (r.v||{})[f.k]); if(v===null) return; o.v[f.k]=v;
      o.src[f.k]=(r.src||{})[f.k]==='orthofi' && f.from==='orthofi' ? 'orthofi' : 'typed';
      if(r.at && typeof r.at[f.k]==='string') o.at[f.k]=r.at[f.k].slice(0,40);
      if(r.by && typeof r.by[f.k]==='string') o.by[f.k]=r.by[f.k].slice(0,120); });
    if(typeof r.of==='string') o.of=r.of.slice(0,40);
    ['sent','final'].forEach(s=>{ const x=r[s]; if(x && typeof x==='object' && typeof x.at==='string') o[s]={at:x.at.slice(0,40), by:str(x.by,120)}; });
    o.notes=(Array.isArray(r.notes) ? r.notes : []).filter(n=>n && typeof n.t==='string' && n.t.trim()).slice(-50)
      .map(n=>({t:n.t.trim().slice(0,1000), by:str(n.by,120), at:str(n.at,40)}));
    return o;
  }
  function cleanYear(rec){
    const out={v:1, o:{}}; const o=rec && typeof rec==='object' && rec.o && typeof rec.o==='object' ? rec.o : {};
    Object.keys(o).slice(0,60).forEach(off=>{ const ms=o[off]; if(!ms || typeof ms!=='object') return; const k=String(off).slice(0,80); out.o[k]={};
      Object.keys(ms).forEach(m=>{ if(/^(0[1-9]|1[0-2])$/.test(m)) out.o[k][m]=cleanMonth(ms[m]); }); });
    return out;
  }
  function cleanSettings(s){
    s=s && typeof s==='object' ? s : {};
    const med=Array.isArray(s.medicaid) ? s.medicaid.filter(x=>typeof x==='string' && x.trim()).map(x=>x.trim().slice(0,80)) : DEF_MEDICAID.slice();
    const g={}; Object.keys(DEF_GOALS).forEach(k=>{ const a=(s.goals||{})[k]; g[k]=Array.isArray(a) && a.length===2 && a.every(x=>x!=='' && x!==null && isFinite(+x)) && +a[0]<=+a[1] ? [+a[0], +a[1]] : DEF_GOALS[k].slice(); });
    const due=Math.min(28, Math.max(1, Math.round(+s.due)||5));
    /* Heather 18/11: "All office managers can see all offices. I currently send this as an email to all OMs and TCs" -
       so by default everyone who can open the report reads every office (typing stays with each office's own people). */
    return {medicaid:[...new Set(med)], goals:g, due, everyone:s.everyone!==false};
  }
  const fieldsFor=(office, settings)=>FIELDS.filter(f=>!f.medicaid || ((settings||{}).medicaid||[]).indexOf(office)>=0);
  /* the calculated ratios of one month's numbers */
  function calc(v){ const out={}; CALC.forEach(c=>{ const x=c.of(v||{}); out[c.k]=x===null || !isFinite(x) ? null : r2(x); }); return out; }
  /* is a value on goal? 'ok' inside the range, 'hi' above, 'lo' below, '' no goal or no value */
  function onGoal(goalKey, value, goals){ const g=(goals||DEF_GOALS)[goalKey]; if(!g || value===null || value===undefined) return ''; return value<g[0] ? 'lo' : value>g[1] ? 'hi' : 'ok'; }
  /* good or bad depends on the measure: collecting MORE is good; adjusting, owing and being late MORE is not. The A/R
     ratio is a range to sit in (ortho A/R carries the contracts still to be paid), so outside it either way is a 'watch'. */
  function tone(goalKey, value, goals){ const g=onGoal(goalKey, value, goals); if(!g) return '';
    if(g==='ok') return 'ok';
    if(goalKey==='col') return g==='lo' ? 'bad' : 'good';
    if(goalKey==='ratio') return 'watch';
    return g==='hi' ? 'bad' : 'good'; }
  /* a year for one office: the months, the quarter averages, the year so far (adds up only flow numbers) and the year
     average. vals(m) -> the month's numbers or null. */
  function yearRows(vals, fields){
    const months=[]; for(let m=1;m<=12;m++){ const v=vals(m); months.push({m, v:v||null}); }
    const pick=(list, k)=>list.map(r=>r.v && r.v[k]).filter(x=>x!==null && x!==undefined);
    const avgOf=(list, k)=>{ const xs=pick(list, k); return xs.length ? r2(xs.reduce((a,b)=>a+b,0)/xs.length) : null; };
    const sumOf=(list, k)=>{ const xs=pick(list, k); return xs.length ? r2(xs.reduce((a,b)=>a+b,0)) : null; };
    const quarters=[0,1,2,3].map(q=>{ const ms=months.slice(q*3, q*3+3), o={}; fields.forEach(f=>{ o[f.k]=avgOf(ms, f.k); }); return {q:q+1, v:o}; });
    const ytd={}, avg={}; fields.forEach(f=>{ ytd[f.k]=f.flow ? sumOf(months, f.k) : null; avg[f.k]=avgOf(months, f.k); });
    return {months, quarters, ytd, avg};
  }
  /* THE WHOLE PRACTICE for a month: activity, balances and counts add up (so the practice's delinquent % is worked out
     from the practice's own counts - a small office's 20% is not the practice's 20%); the typed percents are averaged. */
  function practiceTotals(list){
    list=(list||[]).filter(Boolean); if(!list.length) return null;
    const out={}; let any=false;
    FIELDS.forEach(f=>{ const xs=list.map(v=>v[f.k]).filter(x=>x!==null && x!==undefined); if(!xs.length) return; any=true;
      if(f.t!=='%'){ out[f.k]=r2(xs.reduce((a,b)=>a+b,0)); return; }
      out[f.k]=r2(xs.reduce((a,b)=>a+b,0)/xs.length); });
    return any ? out : null;
  }
  const money=n=>'$'+Math.round(Math.abs(n)).toLocaleString('en-US');
  /* WHAT NEEDS A CONVERSATION - plain English, with the size of it in dollars where there is one, so a busy owner can
     sort a month by what it cost. v: this month; prev: the month before; hist: up to the last 3 months' numbers before
     this one, oldest first (for "three months running"). Each: {k, tone:'bad'|'watch'|'good'|'info', text, usd}. */
  function insights(v, opts){
    opts=opts||{}; const goals=opts.goals||DEF_GOALS, prev=opts.prev||null, hist=(opts.hist||[]).filter(Boolean);
    const out=[]; if(!v) return out; const c=calc(v);
    if(c.colpct!==null){
      const g=goals.col, t=tone('col', c.colpct, goals);
      if(t==='bad'){ const usd=r2(g[0]/100*v.gp - v.gc); out.push({k:'col', tone:'bad', usd, text:'Collected '+c.colpct.toFixed(1)+'% of what it produced — about '+money(usd)+' short of the '+g[0]+'% target.'}); }
      else if(t==='good') out.push({k:'col', tone:'good', usd:0, text:'Collected '+c.colpct.toFixed(1)+'% of what it produced — above target.'});
    }
    if(c.adjpct!==null && tone('adj', c.adjpct, goals)==='bad'){
      const g=goals.adj, usd=r2(-v.adj - g[1]/100*v.gp);
      out.push({k:'adj', tone:'bad', usd, text:'Adjustments were '+c.adjpct.toFixed(1)+'% of production — about '+money(usd)+' more than the '+g[1]+'% target allows.'});
    }
    if(c.ratio!==null){ const g=goals.ratio, w=onGoal('ratio', c.ratio, goals);
      if(w==='hi'){ const usd=r2(v.ar - g[1]*v.gp); out.push({k:'ratio', tone:'watch', usd, text:'A/R is '+c.ratio.toFixed(1)+'× a month’s production (target '+g[0]+'–'+g[1]+'×) — about '+money(usd)+' more owed than the target.'}); }
      else if(w==='lo') out.push({k:'ratio', tone:'watch', usd:0, text:'A/R is '+c.ratio.toFixed(1)+'× a month’s production, under the '+g[0]+'× target — fewer contracts on the books than usual?'});
    }
    if(c.delpct!==null && tone('del', c.delpct, goals)==='bad'){
      out.push({k:'del', tone:'bad', usd:0, text:c.delpct.toFixed(1)+'% of accounts are more than 30 days late ('+v.deln+' of '+v.arn+') — target is under '+goals.del[1]+'%.'});
    }
    if(v.ar90 && v.ar && v.ar90/v.ar>=0.05) out.push({k:'ar90', tone:'watch', usd:v.ar90, text:money(v.ar90)+' is more than 90 days past due ('+(v.ar90/v.ar*100).toFixed(1)+'% of A/R).'});
    /* three months running: this month's collection % below the last, which was below the one before, and so on */
    /* only worth saying when it is heading somewhere: below the top of the goal now, and down 2 points or more */
    if(c.colpct!==null && hist.length>=2){
      const seq=hist.slice(-2).map(h=>calc(h).colpct).concat([c.colpct]);
      if(seq.every(x=>x!==null) && seq[0]>seq[1] && seq[1]>seq[2] && seq[2]<goals.col[1] && seq[0]-seq[2]>=2) out.push({k:'coltrend', tone:'watch', usd:0, text:'Collection % has fallen three months running ('+seq.map(x=>x.toFixed(1)+'%').join(' → ')+').'});
    }
    if(prev && prev.npe && v.npe!=null){
      const ch=(v.npe-prev.npe)/prev.npe*100;
      if(Math.abs(ch)>=20) out.push({k:'npe', tone:ch<0?'watch':'good', usd:0, text:'New patient exams '+(ch<0?'down':'up')+' '+Math.abs(Math.round(ch))+'% on the month before ('+prev.npe+' → '+v.npe+').'});
    }
    if(v.mds){ const a=v.mda||0, d=v.mdd||0;
      out.push({k:'md', tone:d/v.mds>=0.25?'watch':'info', usd:0, text:'Medicaid: '+a+' approved and '+d+' denied of '+v.mds+' submitted'+(v.mdb!=null?', '+v.mdb+' banded':'')+'.'}); }
    return out.sort(byWeight);
  }
  /* most pressing first: off goal, then outside range, then the rest; the bigger dollar gap first within each */
  const ORDER={bad:0, watch:1, info:2, good:3};
  function byWeight(a,b){ return ORDER[a.tone]-ORDER[b.tone] || (b.usd||0)-(a.usd||0); }
  /* ORTHOFI'S NUMBERS IN (the nightly job). Only OrthoFi's own fields; never a month marked final; and never over a
     number a PERSON typed - theirs stays, OrthoFi's is kept beside it (ofv) so the page can say where the two differ.
     vals: {field:number}. Returns {rec, changed} - rec is the whole year, cleaned. */
  function mergeOrthofi(yearRec, office, m, vals, at){
    const rec=cleanYear(yearRec); const key=mm(m); let changed=0;
    if(!office || !/^(0[1-9]|1[0-2])$/.test(key)) return {rec, changed, why:'bad month'};
    rec.o[office]=rec.o[office]||{}; const r=cleanMonth(rec.o[office][key]);
    if(r.final){ rec.o[office][key]=r; return {rec, changed, why:'final'}; }
    at=typeof at==='string' ? at.slice(0,40) : new Date().toISOString();
    Object.keys(vals||{}).forEach(k=>{ const f=BY[k]; if(!f || f.from!=='orthofi') return; const n=cleanVal(k, vals[k]); if(n===null) return;
      if(r.ofv[k]!==n){ r.ofv[k]=n; changed++; }
      if(r.src[k]==='typed' && r.v[k]!==undefined) return;            // a person's number wins
      if(r.v[k]!==n || r.src[k]!=='orthofi'){ r.v[k]=n; r.src[k]='orthofi'; r.at[k]=at; r.by[k]='OrthoFi'; changed++; } });
    r.of=at; rec.o[office][key]=r;
    return {rec, changed};
  }
  /* PAST MONTHS FROM THE OLD EXCEL (Heather 18/11: "I would love the past months to be put in, Some of these offices will
     not have a full history since we got them this year"). One office's sheet -> its months. Found by LABELS, never by row
     numbers (row 1 headers, column A month names, the Medicaid block's own header row). Only the numbers of the columns
     below are read - nothing else on the sheet (the Medicaid area of some sheets has patient names typed beside it).
     cells: {A1:{v}, ...} (PH_BOOK's parse). Returns {months:{mm:{field:number}}, medicaid:bool, checks:[{m,text}], sign}.
     ADJUSTMENTS' SIGN: most sheets type a write-off as a minus (net = gross + adjustments); one types it as a plus and
     subtracts it. Each sheet's own way is read from its months (net vs gross +/- adjustments) and turned into Home-Brace's
     (minus = written off). A month where net production is neither is kept as typed and listed as a check. */
  const XL_MAIN={'gross production':'gp','gross collections':'gc','net production adjustments':'adj','net production':'np',
    'accounts receivable':'ar','# of accounts receivable':'arn','# of delinquent accounts (pts. 30+)':'deln','np exam':'npe'};
  const XL_MED={'# of medicaid submission':'mds','# of medicaid submissions':'mds','# of medicaid denials':'mdd','# medicaid approvals':'mda',
    'medicaid bandings':'mdb','medicaid production':'mdp','medicaid collections':'mdc','# of rip sold':'rip'};
  const norm=t=>String(t==null?'':t).replace(/\s+/g,' ').trim().toLowerCase();
  function colL(n){ let s=''; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=(n-1-r)/26; } return s; }
  function fromSheet(cells){
    cells=cells||{}; const at=(c,r)=>{ const x=cells[colL(c)+r]; return x ? x.v : undefined; };
    const isNum=x=>typeof x==='number' && isFinite(x);
    const out={months:{}, medicaid:false, checks:[], sign:'+'};
    const headCols=(row, map)=>{ const m={}; for(let c=1;c<=40;c++){ const k=map[norm(at(c,row))]; if(k && !m[k]) m[k]=c; } return m; };
    const monthRows=(from, to)=>{ const m={}; for(let r=from;r<=to;r++){ const i=MONTHS.findIndex(n=>n.toLowerCase()===norm(at(1,r))); if(i>=0 && !m[i+1]) m[i+1]=r; } return m; };
    const main=headCols(1, XL_MAIN); if(!main.gp) return out;
    let goalsRow=60; for(let r=2;r<=80;r++){ if(/^goals/.test(norm(at(1,r)))){ goalsRow=r; break; } }
    const rows=monthRows(2, goalsRow);
    let plus=0, minus=0;
    Object.keys(rows).forEach(m=>{ const r=rows[m], v={};
      Object.keys(main).forEach(k=>{ const x=at(main[k], r); if(isNum(x)) v[k]=x; });
      if(!Object.keys(v).length || !v.gp) return;
      if(v.adj!==undefined && v.np!==undefined && v.adj!==0){ if(Math.abs(v.np-(v.gp+v.adj))<1) plus++; else if(Math.abs(v.np-(v.gp-v.adj))<1) minus++; }
      out.months[mm(m)]=v; });
    out.sign=minus>plus ? '-' : '+';
    Object.keys(out.months).forEach(k=>{ const v=out.months[k], m=+k;
      if(v.adj!==undefined){ const typed=v.adj; if(out.sign==='-') v.adj=-v.adj;
        if(v.np!==undefined && Math.abs(v.np-(v.gp+v.adj))>=1){
          const way=Math.abs(v.np-(v.gp-v.adj))<1 ? 'the other way round from the rest of this sheet' : 'neither plus nor minus the adjustments';
          out.checks.push({m, text:MONTHS[m-1]+': net production is gross production '+way+' (gross '+money(v.gp)+', adjustments '+(typed<0?'−':'')+money(typed)+', net '+money(v.np)+').'}); } }
      if(v.gc!==undefined && v.gp && (v.gc/v.gp>1.5 || v.gc/v.gp<0.3)) out.checks.push({m, text:MONTHS[m-1]+': collections are '+Math.round(v.gc/v.gp*100)+'% of production — worth a look.'});
    });
    /* the Medicaid block: the row whose cells name the Medicaid columns */
    for(let r=goalsRow+1;r<=goalsRow+40;r++){
      const med=headCols(r, XL_MED); if(!med.mds) continue;
      out.medicaid=true; const mr=monthRows(r+1, r+16);
      Object.keys(mr).forEach(m=>{ const v={}; Object.keys(med).forEach(k=>{ const x=at(med[k], mr[m]); if(isNum(x)) v[k]=x; });
        if(!Object.keys(v).length) return; out.months[mm(m)]=Object.assign(out.months[mm(m)]||{}, v); });
      break;
    }
    return out;
  }
  /* put a sheet's months in: EMPTY boxes only - a number already in Home-Brace (typed, or OrthoFi's) is never replaced,
     and where the sheet says something different it is listed; a month marked FINAL is not touched at all. The months count as sent (Heather already has them).
     np (net production) is not one of Heather's 20 boxes - FIELDS has it - so it comes in like the rest. */
  function mergeImport(yearRec, office, months, stamp, who){
    const rec=cleanYear(yearRec); let filled=0; const kept=[], skipped=[];
    stamp=typeof stamp==='string' ? stamp.slice(0,40) : new Date().toISOString(); who=String(who||'Excel import').slice(0,120);
    rec.o[office]=rec.o[office]||{};
    Object.keys(months||{}).forEach(k=>{ if(!/^(0[1-9]|1[0-2])$/.test(k)) return; const r=cleanMonth(rec.o[office][k]); let any=false;
      if(r.final){ skipped.push(+k); return; }                                   // a month marked final is never touched
      Object.keys(months[k]).forEach(f=>{ if(!BY[f]) return; const n=cleanVal(f, months[k][f]); if(n===null) return;
        if(r.v[f]!==undefined){ if(Math.abs(r.v[f]-n)>=0.5) kept.push({m:+k, k:f, have:r.v[f], sheet:n}); return; }
        r.v[f]=n; r.src[f]='typed'; r.at[f]=stamp; r.by[f]=who; filled++; any=true; });
      if(any && !r.sent) r.sent={at:stamp, by:who};
      rec.o[office][k]=cleanMonth(r); });
    return {rec, filled, kept, skipped};
  }
  /* a typed number that OrthoFi disagrees with (worth a second look - a typo, or a correction OrthoFi doesn't know) */
  function mismatches(r){ r=r||{}; const out=[]; Object.keys(r.ofv||{}).forEach(k=>{ const v=(r.v||{})[k];
    if((r.src||{})[k]==='typed' && v!==undefined && Math.abs(v-r.ofv[k])>=Math.max(1, Math.abs(r.ofv[k])*0.001)) out.push({k, typed:v, orthofi:r.ofv[k]}); }); return out; }
  /* the month just finished (what an office reports at the start of a month) */
  function lastMonth(now){ const d=now ? new Date(now) : new Date(); const y=d.getMonth()===0 ? d.getFullYear()-1 : d.getFullYear(), m=d.getMonth()===0 ? 12 : d.getMonth(); return {y, m}; }
  /* the day a month's report is due: settings.due of the next month, end of that day */
  function dueDate(y, m, settings){ const d=(settings && settings.due) || 5; return new Date(m===12 ? y+1 : y, m===12 ? 0 : m, d, 23, 59, 59); }
  /* where a month stands for an office: 'final', 'sent', 'late' (due day gone, not sent), 'open' (still this month - the
     month so far), 'started' (some numbers), '' (nothing yet) */
  function status(r, y, m, settings, now){
    now=now ? new Date(now) : new Date();
    if(r && r.final) return 'final'; if(r && r.sent) return 'sent';
    if(y!==undefined && m!==undefined){
      if(now.getFullYear()===y && now.getMonth()+1===m) return 'open';
      if(now>dueDate(y, m, settings)) return 'late';
    }
    return r && Object.keys(r.v||{}).length ? 'started' : '';
  }
  global.PH_MONTHLY={KEY, SET_KEY, FIELDS, BY, CALC, DEF_GOALS, GOAL_NAMES, DEF_MEDICAID, MONTHS, mm, num, money, cleanVal, cleanMonth, cleanYear, cleanSettings, fieldsFor, calc, onGoal, tone, yearRows, practiceTotals, insights, byWeight, mergeOrthofi, fromSheet, mergeImport, mismatches, lastMonth, dueDate, status};
})(typeof window!=='undefined' ? window : globalThis);
