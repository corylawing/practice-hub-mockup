/* ORTHOFI (20/11/2026) - the page side of the OrthoFi connection (the server side is api-push/orthofi on the live site).
   Cory put OrthoFi's client ID + secret into the live site's settings; the live site's /api/orthofi talks to OrthoFi and
   answers TOTALS per OrthoFi location, never a person. This file:
     - asks it (with the person's Microsoft sign-in), from the live site or the sandbox;
     - says which OrthoFi location is which Home-Brace office (a guess by name, Heather/Cory fix it; kept in ph_orthofi);
     - turns a month's answers into the Monthly Report's OrthoFi boxes. Several ways of reading OrthoFi are offered for a
       box until one is proven against Heather's own numbers (her monitor-report Excel), to the dollar - "Heather's numbers
       are the reference": a box only fills itself in once its way is proven (PROVEN, below).
   Rules only up top so node tests can run them (test/orthofi.test.js covers the server; test/ofmap.test.js these). */
(function(global){
  'use strict';
  const KEY='ph_orthofi';
  const LIVE_API='https://kind-hill-00da87410.3.azurestaticapps.net/api/orthofi';
  const p2=n=>String(n).padStart(2,'0');
  const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();

  function monthBounds(y, m){ const last=new Date(Date.UTC(y, m, 0)).getUTCDate(); return {first:y+'-'+p2(m)+'-01', last:y+'-'+p2(m)+'-'+p2(last)}; }
  /* A/R "as of" must be today (UTC) or a month's last day (OrthoFi's rule): this month -> today, past months -> their last day */
  function asOf(y, m, now){ now=now||new Date(); const b=monthBounds(y, m), t=now.toISOString().slice(0,10); return b.last>t ? t : b.last; }

  /* ---------- which location is which office ---------- */
  /* A guess by name: the office's words found in the location's name (or city). "Cruces LCO" needs both words. */
  function guessOffice(loc, offices){
    const hay=' '+fold((loc && loc.name)||'')+' '+fold((loc && loc.city)||'')+' ';
    const hits=(offices||[]).filter(o=>{ const w=fold(o).split(' ').filter(x=>x.length>1); return w.length && w.every(x=>hay.indexOf(' '+x+' ')>=0 || hay.indexOf(' '+x)>=0); });
    if(hits.length===1) return hits[0];
    if(hits.length>1){ const best=hits.slice().sort((a,b)=>fold(b).length-fold(a).length); return fold(best[0]).length>fold(best[1]).length ? best[0] : ''; }
    return '';
  }
  /* auto: {box:[offices]} - which offices' box fills itself in (ticked on the OrthoFi page, 20/11/2026). Only AUTO's boxes. */
  function cleanMap(r){ const out={v:1, map:{}, auto:{}, at:'', by:''}; if(r && typeof r==='object'){ Object.keys(r.map||{}).forEach(id=>{ const o=String(r.map[id]||'').trim().slice(0,80); if(/^\d+$/.test(id)) out.map[id]=o; });
      Object.keys(AUTO).forEach(k=>{ const a=(r.auto||{})[k]; if(Array.isArray(a)) out.auto[k]=[...new Set(a.filter(x=>typeof x==='string' && x.trim()).map(x=>x.trim().slice(0,80)))].slice(0,60); });
      out.at=String(r.at||'').slice(0,40); out.by=String(r.by||'').slice(0,120); } return out; }
  /* office -> its OrthoFi location ids ('' = not one of ours) */
  function locsOf(map, office){ return Object.keys((map && map.map)||{}).filter(id=>map.map[id]===office).map(Number); }

  /* ---------- a month: what to ask ---------- */
  const LATE30=['pastDue30Day','pastDue60Day','pastDue90Day','pastDueOver90Day','pastDue120Day','pastDueOver120Day','pastDue180Day','pastDueOver180Day','pastDue365Day','pastDueOver365Day'];
  const LATE60=LATE30.filter(f=>f!=='pastDue30Day');
  /* OrthoFi's own insurance A/R report: balance >= 0 and one of these claim statuses (their API docs) */
  const IAR_REPORT=['Accepted','Open','Paper Claim','Pending','Pending Primary','Practice Verified','Rejected by Carrier'];
  function plan(y, m, now){
    const b=monthBounds(y, m), aod=asOf(y, m, now), D={'start-date':b.first, 'end-date':b.last};
    return [
      {id:'prod', path:'/v1/practice-locations/production', params:D},
      {id:'coll', path:'/v1/practice-locations/collection', params:D},
      {id:'par', path:'/v1/practice-locations/patient-accounts-receivable', params:{'as-of-date':aod},
        count:[{name:'bal', min:{outstandingBalance:0.005}}, {name:'late30', any:LATE30}, {name:'late60', any:LATE60}, {name:'late10', any:['pastDue10Day'].concat(LATE30)}]},
      {id:'iar', path:'/v1/practice-locations/insurance-accounts-receivable', params:{'as-of-date':aod}, count:[{name:'bal', min:{outstandingBalance:0.005}},
        {name:'rep', min:{outstandingBalance:0}, is:{submissionStatusName:IAR_REPORT, submissionStatus:IAR_REPORT}}]},
      {id:'wo', path:'/v1/practice-locations/write-offs', params:D, group:'endDate'},
      {id:'npc', path:'/v1/practice-locations/new-patient-counts', params:D},
      {id:'exam', path:'/v1/practice-locations/exam-counts', params:D},
      /* OrthoFi files a month under its LAST day ("Month in Report is the LAST day of the month") - asked first..last */
      {id:'bh', path:'/v1/practice-locations/business-health', params:{'month-date-start-date':b.first, 'month-date-end-date':b.last}},
      /* collections as the balance sheet may count them (Heather 20/11): deposits (OrthoFi's day sheet) and the successful
         payments in collection details (OrthoFi: 'FILTER WHERE "isCollectionSuccessful" = true') */
      {id:'dep', path:'/v1/practice-locations/deposits', params:{'created-on-start-date':b.first, 'created-on-end-date':b.last}},
      {id:'cd', path:'/v1/practice-locations/collection-details', params:{'payment-start-date':b.first, 'payment-end-date':b.last},
        count:[{name:'ok', is:{isCollectionSuccessful:['true']}}]},
      /* OrthoFi's adjustment report (createdOn) and kept NPE report (examDate), per their API notes (20/11/2026) */
      {id:'adjr', path:'/v1/practice-locations/adjustments', params:{'created-on-start-date':b.first, 'created-on-end-date':b.last}},
      {id:'pex', path:'/v1/practice-locations/patient-exams', params:{'exam-date-start-date':b.first, 'exam-date-end-date':b.last}, group:'keptExamFlag'},
      /* OrthoFi's delinquent list: TODAY's (it takes no date) - one row per payment plan past due */
      {id:'del', path:'/v1/practice-locations/delinquent', params:{}, count:[{name:'d30', min:{daysPastDue:30}}, {name:'d1', min:{daysPastDue:1}}]},
      {id:'disc', path:'/v1/practice-locations/discounts', params:{'created-on-start-date':b.first, 'created-on-end-date':b.last}},
      {id:'trm', path:'/v1/practice-locations/treatments', params:{'contract-signed-on-start-date':b.first, 'contract-signed-on-end-date':b.last}, group:'productLine'},
      {id:'trs', path:'/v1/practice-locations/treatments', params:{}, group:'treatmentStatusName'}
    ];
  }

  /* ---------- a month: the boxes, each with the ways OrthoFi could fill it ---------- */
  const r2=x=>Math.round(x*100)/100;
  /* adds a location list's totals up for one office: kind 'sum'|'nz'|'cnt'|'n', field */
  function tot(ans, ids, kind, f){
    if(!ans || !ans.by) return null; let v=0, seen=false;
    ids.forEach(id=>{ const L=ans.by[String(id)]; if(!L) return; seen=true;
      v+=kind==='n' ? L.n : kind==='sum' ? (L.sum[f]||0) : kind==='nz' ? (L.nz[f]||0) : kind==='pat' ? (L.pat||0) : kind==='patc' ? ((L.patc||{})[f]||0)
        : kind==='csum' ? ((((L.csum||{})[f.split('.')[0]]||{}).sum||{})[f.split('.')[1]]||0) : (L.cnt[f]||0); });
    return seen ? r2(v) : (ans.rows===0 ? 0 : null);
  }
  /* write-offs/AR summary rows are per date: the office's value on the LAST date */
  function lastGroup(ans, ids, f){
    if(!ans || !ans.by) return null; let v=0, seen=false;
    ids.forEach(id=>{ const L=ans.by[String(id)]; if(!L || !L.groups) return; const ks=Object.keys(L.groups).sort(); if(!ks.length) return; seen=true; v+=(L.groups[ks[ks.length-1]].sum[f]||0); });
    return seen ? r2(v) : null;
  }
  function groupCount(ans, ids, test){
    if(!ans || !ans.by) return null; let v=0, seen=false;
    ids.forEach(id=>{ const L=ans.by[String(id)]; if(!L) return; seen=true; Object.keys(L.groups||{}).forEach(g=>{ if(test(g)) v+=L.groups[g].n; }); });
    return seen ? v : null;
  }
  const RIP=g=>/retainer\s*insurance|\brip\b/i.test(g);
  const KEPT=g=>/^(y|yes|true|1|kept)$/i.test(String(g).trim());                  // OrthoFi's keptExamFlag (a short flag)
  const ACTIVE=g=>/\b(in\s*treatment|active|started|in\s*progress)\b/i.test(g);              // \b: "Inactive" is not active
  /* answers = {planId: answer}; ids = this office's OrthoFi location ids -> {field:[{way, label, v}]} */
  /* typed = the office's own numbers for the month that OrthoFi never sees: Medicaid production (mdp) and Medicaid
     collections (mdc). Heather's gross production = OrthoFi business health production + Medicaid production, and gross
     collections = OrthoFi collections (net) + Medicaid collections - found 20/11/2026: Carlsbad, Clovis and Hobbs line
     up to the third decimal. An office with no Medicaid adds 0, so it's one rule for every office. */
  function ways(answers, ids, typed){
    const A=answers||{}, s=(id,k,f)=>tot(A[id], ids, k, f), plus=(a,b)=>a===null||b===null ? null : r2(a+b);
    const minus=(a,b)=>a===null||b===null ? null : r2(a-Math.abs(b)), neg=a=>a===null ? null : r2(-Math.abs(a));
    const T=typed||{}, med=k=>(T[k]===undefined || T[k]===null || T[k]==='') ? 0 : (+T[k]||0);
    const W={
      gp:  [{way:'bh.production+mdp', label:'Business health production + Medicaid production', v:plus(s('bh','sum','production'), med('mdp'))},
            {way:'prod.gross', label:'Production — gross', v:s('prod','sum','gross')}, {way:'bh.production', label:'Business health — production', v:s('bh','sum','production')},
            {way:'prod.net', label:'Production — net', v:s('prod','sum','net')}],
      gc:  [{way:'coll.net+mdc', label:'Collections (net) + Medicaid collections', v:plus(s('coll','sum','net'), med('mdc'))},
            {way:'dep.amount+mdc', label:'Deposits (day sheet) + Medicaid collections', v:plus(s('dep','sum','amount'), med('mdc'))},
            {way:'cd.collection+mdc', label:'Collection details (successful) + Medicaid collections', v:plus(s('cd','csum','ok.collection'), med('mdc'))},
            {way:'cd.collection', label:'Collection details (successful)', v:s('cd','csum','ok.collection')},
            {way:'cd.practice+mdc', label:'Collection details — practice collections + Medicaid', v:plus(s('cd','csum','ok.practiceCollections'), med('mdc'))},
            {way:'coll.gross', label:'Collections — gross', v:s('coll','sum','gross')}, {way:'coll.net', label:'Collections — net', v:s('coll','sum','net')}],
      /* 20/11/2026 (Cory: "Should we be sure before we assume?"): Heather's gross production is the business health
         dashboard's - so her adjustments and net production may be its write-offs too (totals, signed as write-offs) */
      adj: [{way:'bh.writeoff', label:'Business health — total write-off', v:neg(s('bh','sum','totalWriteOff'))},
            {way:'bh.writeoff+sns', label:'Business health — write-offs incl. signed-not-started', v:neg(plus(s('bh','sum','totalWriteOff'), s('bh','sum','signedNotStartedWriteOff')))},
            {way:'adjr.net', label:'Adjustment report — net', v:s('adjr','sum','netAdjustment')},
            {way:'adjr.patient+ins', label:'Adjustment report — patient + insurance', v:plus(s('adjr','sum','patientAdjustment'), s('adjr','sum','insuranceAdjustment'))},
            {way:'prod.adjustments', label:'Production — adjustments', v:s('prod','sum','adjustments')}, {way:'coll.adjustments', label:'Collections — adjustments', v:s('coll','sum','adjustments')}],
      np:  [{way:'bh.prod+mdp-writeoff', label:'Business health production + Medicaid − write-offs', v:minus(plus(s('bh','sum','production'), med('mdp')), s('bh','sum','totalWriteOff'))},
            {way:'bh.prod+mdp-writeoff-sns', label:'Business health production + Medicaid − write-offs incl. signed-not-started', v:minus(minus(plus(s('bh','sum','production'), med('mdp')), s('bh','sum','totalWriteOff')), s('bh','sum','signedNotStartedWriteOff'))},
            {way:'prod.net', label:'Production — net', v:s('prod','sum','net')}],
      ar:  [{way:'par+iar.outstanding', label:'Patient + insurance A/R (outstanding)', v:plus(s('par','sum','outstandingBalance'), s('iar','sum','outstandingBalance'))},
            {way:'par+iar.current', label:'Patient (current) + insurance A/R', v:plus(s('par','sum','currentBalance'), s('iar','sum','outstandingBalance'))},
            {way:'par+iar.rep', label:'Patient + insurance A/R (OrthoFi report claim statuses)', v:plus(s('par','sum','outstandingBalance'), s('iar','csum','rep.outstandingBalance'))},
            {way:'par.current+iar.rep', label:'Patient (current) + insurance A/R (report statuses)', v:plus(s('par','sum','currentBalance'), s('iar','csum','rep.outstandingBalance'))},
            {way:'par.outstanding', label:'Patient A/R only', v:s('par','sum','outstandingBalance')},
            {way:'wo.total', label:'A/R summary — total', v:lastGroup(A.wo, ids, 'total')}],
      arn: [{way:'par.bal', label:'Patient accounts with a balance', v:s('par','cnt','bal')}, {way:'par.rows', label:'Patient accounts (all)', v:s('par','n')},
            {way:'par+iar.bal', label:'Patient + insurance accounts with a balance', v:plus(s('par','cnt','bal'), s('iar','cnt','bal'))},
            {way:'wo.nonZero', label:'A/R summary — accounts not zero', v:lastGroup(A.wo, ids, 'nonZeroAccounts')},
            {way:'par.patients', label:'Patients on patient A/R', v:s('par','pat')}, {way:'par.patients.bal', label:'Patients with a balance', v:s('par','patc','bal')},
            {way:'par.patients+iar.rep', label:'Patients with a balance + insurance claims (report statuses)', v:plus(s('par','patc','bal'), s('iar','cnt','rep'))}],
      deln:[{way:'par.late30', label:'Accounts past due 30+ days', v:s('par','cnt','late30')}, {way:'par.late60', label:'Accounts past due 60+ days', v:s('par','cnt','late60')},
            {way:'par.late10', label:'Accounts past due at all', v:s('par','cnt','late10')},
            {way:'par.pat.late30', label:'Patients past due 30+ days', v:s('par','patc','late30')}, {way:'par.pat.late60', label:'Patients past due 60+ days', v:s('par','patc','late60')},
            {way:'par.pat.late10', label:'Patients past due at all', v:s('par','patc','late10')},
            {way:'del.d30', label:'Delinquent list (today) — plans 30+ days', v:s('del','cnt','d30')}, {way:'del.pat30', label:'Delinquent list (today) — patients 30+ days', v:s('del','patc','d30')},
            {way:'del.d1', label:'Delinquent list (today) — plans past due', v:s('del','cnt','d1')}],
      ar90:[{way:'par.over90', label:'Patient A/R over 90 days', v:s('par','sum','pastDueOver90Day')},
            {way:'par.90+over90', label:'Patient A/R 90 days + over 90', v:plus(s('par','sum','pastDue90Day'), s('par','sum','pastDueOver90Day'))}],
      npe: [{way:'bh.scheduled', label:'Business health — scheduled new patient exams', v:s('bh','sum','scheduledNewPatientExam')},
            {way:'pex.kept', label:'Kept NPE report — kept', v:groupCount(A.pex, ids, KEPT)}, {way:'pex.rows', label:'Kept NPE report — every exam', v:s('pex','n')},
            {way:'exam.all', label:'Exams — all', v:s('exam','sum','all')}, {way:'npc.newPatient', label:'New patient count', v:s('npc','sum','newPatient')},
            {way:'bh.kept', label:'Business health — kept new patient exams', v:s('bh','sum','keptNewPatientExam')}],
      act: [{way:'trs.active', label:'Treatments in treatment / active', v:groupCount(A.trs, ids, ACTIVE)}, {way:'par.rows', label:'Patient accounts (all)', v:s('par','n')}],
      disc:[{way:'disc.amount', label:'Discounts given this month', v:s('disc','sum','discountAmount')}, {way:'trm.discounts', label:'Discounts on contracts signed this month', v:s('trm','sum','discounts')}],
      rip: [{way:'trm.rip', label:'Retainer Insurance Program on contracts signed this month', v:groupCount(A.trm, ids, RIP)}]
    };
    Object.keys(W).forEach(k=>{ W[k]=W[k].filter(x=>x.v!==null && x.v!==undefined); });
    return W;
  }
  /* is a way's number Heather's? $ to the dollar (within 50 cents); counts exactly; adjustments either sign */
  function same(field, a, b){
    if(a===null || a===undefined || b===null || b===undefined || !isFinite(a) || !isFinite(b)) return false;
    const money=['gp','gc','adj','np','ar','ar90','disc'].indexOf(field)>=0;
    if(field==='adj') return Math.abs(Math.abs(a)-Math.abs(b))<0.5;
    return money ? Math.abs(a-b)<0.5 : Math.round(a)===Math.round(b);
  }
  /* THE WAYS THAT ARE PROVEN (20/11/2026: to the dollar against Heather's sheets, September AND October). A box fills itself
     in only by one of these, and only for the offices ticked for it on the OrthoFi page (map.auto) - an office is ticked
     once its own numbers match. This is OrthoFi's PART: the Monthly Report adds what the office types (PH_MONTHLY.PARTS -
     Medicaid production, old-system production / A/R).
       gp - business health production (+ Medicaid + old system): Carlsbad, Clovis, Hobbs, San Angelo, Lubbock, Mansfield
       gc - collection details, successful payments (+ Medicaid + old system): Carlsbad, Clovis, Hobbs, San Angelo, Lubbock,
            Mansfield (October; Heather: "I get it from the monthly balance sheet" - an OrthoFi report built on these)
       ar - patient A/R + insurance A/R with OrthoFi's report claim statuses (+ old system): San Angelo, Lubbock, Mansfield
       deln - OrthoFi's Delinquent report, everyone 30+ days past due (Heather 21/11: "Reports- Delinquent account and then
            they have to count everyone that is 30 and above days past due"). The report is TODAY's (no date), so it is a
            snapshot: it fills this month, and last month only up to the report's due day (when Heather makes the sheet).
     check = the way the OrthoFi page compares with Heather's sheet (her Medicaid number added, as the Monthly Report will). */
  const PROVEN={gp:'bh.production', gc:'cd.collection', ar:'par+iar.rep', deln:'del.d30'};
  const AUTO={gp:{way:'bh.production', check:'bh.production+mdp', lists:['bh'], label:'Gross production', plus:'+ Medicaid + old system, as typed'},
              gc:{way:'cd.collection', check:'cd.collection+mdc', lists:['cd'], label:'Gross collections', plus:'+ Medicaid + old system, as typed'},
              ar:{way:'par+iar.rep', check:'par+iar.rep', lists:['par','iar'], label:'Accounts receivable', plus:'+ old system, as typed'},
              deln:{way:'del.d30', check:'del.d30', lists:['del'], label:'Delinquent accounts past 30 days', plus:'Delinquent report, everyone 30+ days past due — counted on the day it fills in', snapshot:true}};
  /* one office's OrthoFi parts for the boxes it is ticked for -> {gp:n, ar:n} (a box OrthoFi has nothing for is left out) */
  function autoParts(answers, ids, boxes){
    const W=ways(answers, ids, {}), out={};
    (boxes||Object.keys(AUTO)).forEach(k=>{ const w=(W[k]||[]).find(x=>x.way===AUTO[k].way); if(w && w.v!==null && w.v!==undefined && isFinite(w.v)) out[k]=w.v; });
    return out;
  }
  /* the offices ticked for each box -> {office:[boxes]}; only offices that have an OrthoFi location */
  function autoOffices(map){
    const m=cleanMap(map), out={};
    Object.keys(m.auto).forEach(k=>m.auto[k].forEach(o=>{ if(locsOf(m, o).length) (out[o]=out[o]||[]).push(k); }));
    return out;
  }

  /* ---------- asking ---------- */
  function apiUrl(){ const H=global.PH; return H && H.isLive && H.isLive() ? location.origin+'/api/orthofi' : LIVE_API; }
  async function ask(body){
    if(!global.PH_AUTH || !global.PH_AUTH.idToken) throw Object.assign(new Error('Sign in first'), {code:'signin'});
    const idt=await global.PH_AUTH.idToken();
    let r; try{ r=await fetch(apiUrl(), {method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify(Object.assign({idt}, body))}); }
    catch(_){ throw Object.assign(new Error('The live site could not be reached'), {code:'net'}); }
    let j=null; try{ j=await r.json(); }catch(_){}
    if(!r.ok || !j || !j.ok) throw Object.assign(new Error((j && j.error) || ('The live site answered '+r.status)), {code:(j && j.code) || (r.status===404 ? 'missing' : 'err'), status:r.status});
    return j;
  }
  async function month(y, m, locs, onStep){
    const out={}, P=plan(y, m);
    const go=(global.PH_ORTHOFI && global.PH_ORTHOFI.ask) || ask;                 // (the page's own, so a check can stand in for OrthoFi)
    /* Every treatment ever is too much for OrthoFi to send (507, 20/11/2026): ask only for the active statuses. If the
       status list can't be read, ask as before. */
    let act='';
    try{ const st=await go({ask:'statuses'}); act=((st && st.statuses)||[]).filter(x=>ACTIVE(x.name)).map(x=>x.id).slice(0,31).join(','); }catch(_){}
    for(let q of P){
      if(q.id==='trs' && act) q=Object.assign({}, q, {params:{'treatment-status-ids':act}});
      if(onStep) onStep(q.id); try{ out[q.id]=await go(Object.assign({ask:'sum', locs}, q)); }catch(e){ out[q.id]={error:e.message, code:e.code}; } }
    return out;
  }

  /* THE FILL (the Monthly Report calls this): only the lists the ticked boxes need, for the ticked offices' locations ->
     {byOffice:{office:{gp, ar}}, errors:[...]}. Never a typed number, never a final month - PH_MONTHLY.mergeOrthofi sees to that. */
  /* a snapshot box (today's report) may fill this month, and last month until its due day (opts.due, the 5th by default) */
  function snapshotOk(y, m, opts){
    const now=(opts && opts.now) || new Date(), due=(opts && +opts.due) || 5, cy=now.getFullYear(), cm=now.getMonth()+1;
    if(y===cy && m===cm) return true;
    const ly=cm===1 ? cy-1 : cy, lm=cm===1 ? 12 : cm-1;
    return y===ly && m===lm && now.getDate()<=due;
  }
  async function autoMonth(y, m, map, opts){
    const snap=snapshotOk(y, m, opts), all=autoOffices(map), offs={};
    Object.keys(all).forEach(o=>{ const b=all[o].filter(k=>!AUTO[k].snapshot || snap); if(b.length) offs[o]=b; });
    const names=Object.keys(offs); if(!names.length) return {byOffice:{}, errors:[]};
    const need=new Set(); names.forEach(o=>offs[o].forEach(k=>AUTO[k].lists.forEach(l=>need.add(l))));
    const locs=[...new Set(names.reduce((a,o)=>a.concat(locsOf(cleanMap(map), o)), []))];
    const go=(global.PH_ORTHOFI && global.PH_ORTHOFI.ask) || ask, ans={}, errors=[];
    for(const q of plan(y, m).filter(q=>need.has(q.id))){ try{ ans[q.id]=await go(Object.assign({ask:'sum', locs}, q)); }catch(e){ errors.push(q.id+': '+(e && e.message)); } }
    const byOffice={}; names.forEach(o=>{ const p=autoParts(ans, locsOf(cleanMap(map), o), offs[o]); if(Object.keys(p).length) byOffice[o]=p; });
    return {byOffice, errors};
  }

  const RULES={KEY, fold, monthBounds, asOf, guessOffice, cleanMap, locsOf, plan, ways, same, PROVEN, AUTO, autoParts, autoOffices, snapshotOk};
  if(typeof module!=='undefined' && module.exports) module.exports=RULES;
  global.PH_ORTHOFI=Object.assign({}, RULES, {ask, month, apiUrl, autoMonth});
})(typeof window!=='undefined' ? window : globalThis);
