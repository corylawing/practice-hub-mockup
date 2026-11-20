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
  function cleanMap(r){ const out={v:1, map:{}, at:'', by:''}; if(r && typeof r==='object'){ Object.keys(r.map||{}).forEach(id=>{ const o=String(r.map[id]||'').trim().slice(0,80); if(/^\d+$/.test(id)) out.map[id]=o; }); out.at=String(r.at||'').slice(0,40); out.by=String(r.by||'').slice(0,120); } return out; }
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
  const ACTIVE=g=>/\b(in\s*treatment|active|started|in\s*progress)\b/i.test(g);              // \b: "Inactive" is not active
  /* answers = {planId: answer}; ids = this office's OrthoFi location ids -> {field:[{way, label, v}]} */
  /* typed = the office's own numbers for the month that OrthoFi never sees: Medicaid production (mdp) and Medicaid
     collections (mdc). Heather's gross production = OrthoFi business health production + Medicaid production, and gross
     collections = OrthoFi collections (net) + Medicaid collections - found 20/11/2026: Carlsbad, Clovis and Hobbs line
     up to the third decimal. An office with no Medicaid adds 0, so it's one rule for every office. */
  function ways(answers, ids, typed){
    const A=answers||{}, s=(id,k,f)=>tot(A[id], ids, k, f), plus=(a,b)=>a===null||b===null ? null : r2(a+b);
    const T=typed||{}, med=k=>(T[k]===undefined || T[k]===null || T[k]==='') ? 0 : (+T[k]||0);
    const W={
      gp:  [{way:'bh.production+mdp', label:'Business health production + Medicaid production', v:plus(s('bh','sum','production'), med('mdp'))},
            {way:'prod.gross', label:'Production — gross', v:s('prod','sum','gross')}, {way:'bh.production', label:'Business health — production', v:s('bh','sum','production')},
            {way:'prod.net', label:'Production — net', v:s('prod','sum','net')}],
      gc:  [{way:'coll.net+mdc', label:'Collections (net) + Medicaid collections', v:plus(s('coll','sum','net'), med('mdc'))},
            {way:'coll.gross', label:'Collections — gross', v:s('coll','sum','gross')}, {way:'coll.net', label:'Collections — net', v:s('coll','sum','net')}],
      adj: [{way:'prod.adjustments', label:'Production — adjustments', v:s('prod','sum','adjustments')}, {way:'coll.adjustments', label:'Collections — adjustments', v:s('coll','sum','adjustments')}],
      np:  [{way:'prod.net', label:'Production — net', v:s('prod','sum','net')}],
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
            {way:'par.pat.late10', label:'Patients past due at all', v:s('par','patc','late10')}],
      ar90:[{way:'par.over90', label:'Patient A/R over 90 days', v:s('par','sum','pastDueOver90Day')},
            {way:'par.90+over90', label:'Patient A/R 90 days + over 90', v:plus(s('par','sum','pastDue90Day'), s('par','sum','pastDueOver90Day'))}],
      npe: [{way:'exam.all', label:'Exams — all', v:s('exam','sum','all')}, {way:'npc.newPatient', label:'New patient count', v:s('npc','sum','newPatient')},
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
  /* the ways that are proven - a box fills itself in only by one of these (empty until Heather's numbers prove one) */
  const PROVEN={};

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

  const RULES={KEY, fold, monthBounds, asOf, guessOffice, cleanMap, locsOf, plan, ways, same, PROVEN};
  if(typeof module!=='undefined' && module.exports) module.exports=RULES;
  global.PH_ORTHOFI=Object.assign({}, RULES, {ask, month, apiUrl});
})(typeof window!=='undefined' ? window : globalThis);
