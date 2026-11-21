/* ORTHOFI (20/11/2026) - the live site's window onto OrthoFi's API (api-push/orthofi). Made-up locations and patients only.
       node test/orthofi.test.js
   It must: refuse anyone not signed in to the practice or not on a Home-Brace page; keep the client secret to itself;
   send back TOTALS per location and never a person (patient/guardian names or ids); read only the lists Home-Brace needs. */
const path=require('path');
const F=require(path.join(__dirname,'..','api-push','orthofi','index.js')), T=F._t;
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const SECRET='s3cr3t-made-up-value', CID='made-up-client';
let TOOBIG='';
let calls=[], now=Date.parse('2026-11-20T15:00:00Z'), env={ORTHOFI_CLIENT_ID:CID, ORTHOFI_CLIENT_SECRET:SECRET}, authStatus=200, expire=false;
const AR=[ {practiceLocationId:11, practiceLocationName:'North Office', patientId:501, patientFirstName:'Zelda', patientLastName:'Quill', contractId:9001, outstandingBalance:1200.5, pastDue30Day:0, pastDue90Day:0, pastDueOver90Day:0},
           {practiceLocationId:11, practiceLocationName:'North Office', patientId:502, patientFirstName:'Yusuf', patientLastName:'Pryce', contractId:9002, outstandingBalance:800.25, pastDue30Day:150, pastDue90Day:0, pastDueOver90Day:75},
           {practiceLocationId:12, practiceLocationName:'South Office', patientId:503, patientFirstName:'Xena', patientLastName:'Orr', contractId:9003, outstandingBalance:0, pastDue30Day:0, pastDue90Day:0, pastDueOver90Day:0} ];
const TR=[ {practiceLocationId:11, patientFirstName:'Zelda', productLine:'Retainer Insurance Program', treatmentCost:300, doctorName:'Dr. Made Up'},
           {practiceLocationId:11, patientFirstName:'Yusuf', productLine:'Braces', treatmentCost:5200},
           {practiceLocationId:11, patientFirstName:'Wanda', productLine:'Retainer Insurance Program', treatmentCost:300} ];
const res=(status, body)=>({ok:status<300, status, json:async()=>body});
T.setDeps({ env:()=>env, now:()=>now,
  verify: async idt=>{ if(idt!=='good-signin') throw new Error('not signed in'); return {who:'someone@example.com'}; },
  fetch: async (url, opts)=>{ calls.push({url:String(url), opts:opts||{}});
    if(/oauth2\/token/.test(url)) return authStatus===200 ? res(200, {access_token:'pass-'+calls.length, expires_in:3600, token_type:'Bearer'}) : res(authStatus, {error:'invalid_client', error_description:'secret '+SECRET+' is wrong'});
    if(expire){ expire=false; return res(401, {}); }
    if(/\/v1\/practice-locations\?|\/v1\/practice-locations$/.test(url)) return res(200, [{practiceLocationId:11, practiceLocationName:'North Office', practiceName:'Made-Up Orthodontics', city:'Northtown', stateAbbreviation:'TX', address1:'1 Main St'}, {practiceLocationId:12, practiceLocationName:'South Office', practiceName:'Made-Up Orthodontics', city:'Southtown', stateAbbreviation:'NM'}]);
    if(/insurance-accounts-receivable/.test(url)){ const ids=new URL(url).searchParams.get('practice-location-ids')||'';
      if(ids.indexOf(',')>=0 || ids===TOOBIG) return res(507, {});                                       // too big for OrthoFi at once
      return res(200, [{practiceLocationId:+ids, patientFirstName:'Zelda', outstandingBalance:+ids*10, submissionStatusName:'Open'}]); }
    if(/reference-data/.test(url)) return res(200, {chargeTypes:[{id:1, name:'Fee'}], patientTreatmentStatuses:[{id:3, name:'Active Treatment'}, {id:4, name:'Inactive'},
      {id:5, name:'In Treatment'}, {id:6, name:'Completed'}, {id:0, name:'zero'}]});
    if(/exam-counts/.test(url)) return res(401, {});
    if(/patient-accounts-receivable/.test(url)) return res(200, AR);
    if(/treatments/.test(url)) return res(200, TR);
    if(/patient-exams/.test(url)) return res(200, [{practiceLocationId:11, patientId:501, patientFirstName:'Zelda', keptExamFlag:'Y', examTypeName:'New Patient'}, {practiceLocationId:11, patientId:502, patientFirstName:'Yusuf', keptExamFlag:'N'}]);
    if(/\/deposits/.test(url)) return res(200, [{practiceLocationId:11, depositId:77, paidByName:'Vera Lumen', createdByName:'Tess Front', amount:250.5, depositDetails:[{patientId:501, patientFirstName:'Zelda', amount:250.5}]},
                                                {practiceLocationId:11, depositId:78, paidByName:'Uma Quay', amount:100, depositDetails:[]}]);
    if(/collection-details/.test(url)) return res(200, [{practiceLocationId:11, patientId:501, patientFirstName:'Zelda', patientLastName:'Quill', collection:300, practiceCollections:290, isCollectionSuccessful:true},
                                                       {practiceLocationId:11, patientId:502, patientFirstName:'Yusuf', collection:80, practiceCollections:78, isCollectionSuccessful:false}]);
    if(/production/.test(url)) return res(200, [{gross:1000, adjustments:-50, net:950, practiceId:1, practiceLocationId:11}]);
    return res(404, {}); } });
const call=async (body, origin)=>{ const ctx={}; await F(ctx, {method:'POST', headers:{origin:origin===undefined ? 'https://kind-hill-00da87410.3.azurestaticapps.net' : origin}, body:JSON.stringify(body)}); return {status:ctx.res.status, body:JSON.parse(ctx.res.body), raw:ctx.res.body, headers:ctx.res.headers}; };

(async()=>{
  let r=await call({idt:'good-signin', ask:'locations'}, 'https://evil.example.com');
  t('a page that is not Home-Brace is refused', r.status===403);
  r=await call({idt:'nope', ask:'locations'});
  t('someone not signed in to the practice is refused', r.status===401 && r.body.signin===true);
  env={}; r=await call({idt:'good-signin', ask:'locations'}); env={ORTHOFI_CLIENT_ID:CID, ORTHOFI_CLIENT_SECRET:SECRET};
  t('no ID/secret in the site settings -> says so (503), asks nothing of OrthoFi', r.status===503 && r.body.code==='setup' && !calls.length);

  calls=[]; r=await call({idt:'good-signin', ask:'locations'});
  const tok=calls[0], form=new URLSearchParams(tok.opts.body||'');
  t('the pass: a form POST to auth.data.orthofi.com with client_credentials, the ID and the secret', /^https:\/\/auth\.data\.orthofi\.com\/oauth2\/token$/.test(tok.url) && tok.opts.method==='POST' && /x-www-form-urlencoded/.test(tok.opts.headers['Content-Type']) && form.get('grant_type')==='client_credentials' && form.get('client_id')===CID && form.get('client_secret')===SECRET);
  t('then the API with that pass', /^https:\/\/api\.data\.orthofi\.com\/v1\/practice-locations/.test(calls[1].url) && /^Bearer pass-/.test(calls[1].opts.headers.Authorization));
  t('locations: id, name, practice, city, state - no street address', r.status===200 && r.body.locations.length===2 && r.body.locations[0].name==='North Office' && r.body.locations[0].state==='TX' && r.raw.indexOf('1 Main St')<0);
  t('the secret is never in an answer', r.raw.indexOf(SECRET)<0);
  t('only the Home-Brace page that asked may read the answer', r.headers['Access-Control-Allow-Origin']==='https://kind-hill-00da87410.3.azurestaticapps.net');

  calls=[]; r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/patient-accounts-receivable', locs:[11,12], params:{'as-of-date':'2026-10-31'},
    count:[{name:'late30', any:['pastDue30Day','pastDue90Day','pastDueOver90Day']}, {name:'bal', min:{outstandingBalance:0.01}}]});
  t('the pass is kept: no second sign-in to OrthoFi', !calls.some(c=>/oauth2/.test(c.url)));
  t('A/R adds up per location: $ owed, accounts, past-due $', r.status===200 && r.body.by['11'].sum.outstandingBalance===2000.75 && r.body.by['11'].n===2 && r.body.by['11'].sum.pastDueOver90Day===75 && r.body.by['12'].n===1);
  t('counts by a rule: past due 30+ (1 at North), with a balance (2 at North, 0 at South)', r.body.by['11'].cnt.late30===1 && r.body.by['11'].cnt.bal===2 && !r.body.by['12'].cnt.bal);
  t('NEVER a person: no patient names, no patient or contract ids', !/Zelda|Quill|Yusuf|Pryce|Xena|Orr/.test(r.raw) && r.raw.indexOf('9001')<0 && r.raw.indexOf('501')<0 && !('patientId' in r.body.by['11'].sum) && !('contractId' in r.body.by['11'].sum));
  t('the field names come back (so the page can see what OrthoFi has)', r.body.fields.indexOf('pastDue30Day')>=0);
  t('the as-of date and the locations go to OrthoFi', /as-of-date=2026-10-31/.test(calls[0].url) && /practice-location-ids=11%2C12/.test(calls[0].url));

  calls=[]; r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/treatments', locs:[11], params:{'contract-signed-on-start-date':'2026-10-01','contract-signed-on-end-date':'2026-10-31','product-lines':'Retainer Insurance Program'}, group:'productLine'});
  t('treatments split by product line: 2 Retainer Insurance Program at North (RIP sold)', r.body.by['11'].groups['Retainer Insurance Program'].n===2 && r.body.by['11'].groups['Braces'].n===1);
  t('...still no names, not even the doctor', !/Zelda|Yusuf|Wanda|Dr\. Made Up/.test(r.raw));
  r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/treatments', locs:[11], group:'patientLastName'});
  t('splitting by a person’s field is refused (no groups)', r.status===200 && Object.keys(r.body.by['11'].groups).length===0 && !/Zelda/.test(r.raw));

  r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/patients', locs:[11]});
  t('lists Home-Brace does not need (patients, guardians ...) are refused', r.status===400 && r.body.code==='bad');
  t('every list it reads is a total-type list or is added up here', Object.keys(T.ALLOWED).every(p=>!/patients$|guardians|communications|eligibility|payment-profiles/.test(p)));
  t('the kept NPE list (rows hold patients) is asked only by exam date - never for a patient - and only counted (20/11/2026)', JSON.stringify(T.ALLOWED['/v1/practice-locations/patient-exams'])==='{"exam-date-start-date":"date","exam-date-end-date":"date"}');
  const a=T.cleanAsk({path:'/v1/practice-locations/production', locs:['11','x',-3], params:{'start-date':'2026-10-01','end-date':'31/10/2026','patient-ids':'501'}});
  t('only its own params, in their shape: a bad date and an unknown param are dropped', a.params['start-date']==='2026-10-01' && !a.params['end-date'] && !a.params['patient-ids'] && a.params['practice-location-ids']==='11');

  calls=[]; await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/patient-accounts-receivable', locs:[11,12], params:{'as-of-date':'2026-10-31'},
    count:[{name:'late30', any:['pastDue30Day','pastDue90Day','pastDueOver90Day']}, {name:'bal', min:{outstandingBalance:0.01}}]});
  t('the same question within 10 minutes is answered from memory', calls.length===0);
  now+=11*60e3; calls=[]; await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/production', locs:[11], params:{'start-date':'2026-10-01','end-date':'2026-10-31'}});
  t('...after that it asks OrthoFi again', calls.length===1);

  T.reset(); expire=true; calls=[]; r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/production', locs:[11], params:{'start-date':'2026-10-01'}});
  t('a pass OrthoFi turns away is renewed once, then it works', r.status===200 && calls.filter(c=>/oauth2/.test(c.url)).length===2);

  T.reset(); authStatus=401; r=await call({idt:'good-signin', ask:'locations'}); authStatus=200;
  t('a wrong ID/secret -> "did not accept", and OrthoFi’s own words (which could echo the secret) are not passed on', r.status===502 && r.body.code==='auth' && r.raw.indexOf(SECRET)<0 && /did not accept/.test(r.body.error));

  /* the page side (v1/orthofi.js): which location is which office, the ways a box can be read, the match to Heather */
  /* TOO BIG (20/11/2026: OrthoFi answered 507 for insurance A/R and all treatments across 9 locations) */
  calls=[]; r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/insurance-accounts-receivable', locs:[11,12,13], params:{'as-of-date':'2026-10-31'}});
  const iarCalls=calls.filter(c=>/insurance-accounts/.test(c.url));
  t('507 for every location at once -> asked again one location at a time, put back together', r.status===200 && iarCalls.length===4 &&
    r.body.rows===3 && r.body.by['12'].sum.outstandingBalance===120 && r.body.by['13'].n===1);
  t('…and still no names in what comes back', !/Zelda/.test(r.raw));
  TOOBIG='12'; T.reset(); r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/insurance-accounts-receivable', locs:[11,12], params:{'as-of-date':'2026-10-31'}});
  t('one location still too big -> the list is an error (never a total missing a location)', r.status===502 && /even for one location/.test(r.body.error)); TOOBIG='';
  calls=[]; T.reset(); r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/exam-counts', locs:[11,12], params:{'start-date':'2026-10-01','end-date':'2026-10-31'}});
  t('a refusal that is not "too big" (401) is not split up', r.status===502 && calls.filter(c=>/exam-counts/.test(c.url)).length===2);   // (the 2nd = the one retry with a fresh pass)
  r=await call({idt:'good-signin', ask:'statuses'});
  t('treatment statuses: ids and names only, from reference data', r.status===200 && r.body.statuses.length===4 && r.body.statuses[0].id===3 && !/Fee/.test(r.raw));

  /* PATIENTS, NOT CONTRACTS + OrthoFi's insurance report statuses (20/11/2026) */
  {
    const S=T.summarize([
      {practiceLocationId:11, patientId:1, contractId:1, outstandingBalance:100, pastDue60Day:10, submissionStatusName:'Open'},
      {practiceLocationId:11, patientId:1, contractId:2, outstandingBalance:50, pastDue60Day:5, submissionStatusName:'Ignore'},
      {practiceLocationId:11, patientId:2, contractId:3, outstandingBalance:0, submissionStatusName:'Rejected by Carrier'},
      {practiceLocationId:11, patientId:3, contractId:4, outstandingBalance:-5, submissionStatusName:'open'}], '',
      T.cleanAsk({path:'/v1/practice-locations/insurance-accounts-receivable', locs:[11], params:{}, count:[{name:'bal', min:{outstandingBalance:0.005}}, {name:'late60', any:['pastDue60Day']},
        {name:'rep', min:{outstandingBalance:0}, is:{submissionStatusName:['Open','Rejected by Carrier'], patientId:['1']}}]}).count);
    const L=S.by['11'];
    t('patients counted once however many contracts: 3 patients, 4 rows', L.n===4 && L.pat===3);
    t('…and per test: 1 patient with a balance (2 contracts), 1 patient 60+ late', L.cnt.bal===2 && L.patc.bal===1 && L.cnt.late60===2 && L.patc.late60===1);
    t('report statuses: balance >= 0 and status in the list (any case); "Ignore" and a negative balance left out', L.cnt.rep===2 && L.csum.rep.sum.outstandingBalance===100);
    t('a status filter on an id field is refused (never filter by a person)', !('patientId' in (T.cleanAsk({path:'/v1/practice-locations/insurance-accounts-receivable', locs:[11], count:[{name:'x', is:{patientId:['1']}}]}).count[0]||{is:{}}).is));
    t('only counts leave - no patient ids in the summary', !/"1"|"2"|"3"/.test(JSON.stringify(L.patc)) && JSON.stringify(S).indexOf('patientId":')<0);
  }

  const O=require(path.join(__dirname,'..','v1','orthofi.js'));
  {
    const ANS2={par:{rows:3, by:{'11':{n:3, pat:2, patc:{bal:2, late60:1}, sum:{outstandingBalance:500, currentBalance:400}, nz:{}, cnt:{bal:3, late60:2}, csum:{}, groups:{}}}},
      iar:{rows:2, by:{'11':{n:2, sum:{outstandingBalance:300}, nz:{}, cnt:{bal:2, rep:1}, csum:{rep:{sum:{outstandingBalance:120}, nz:{}}}, groups:{}}}},
      prod:{rows:1, by:{'11':{n:1, sum:{gross:1000, net:900}, nz:{}, cnt:{}, groups:{}}}}};
    const W2=O.ways(ANS2,[11]), v=(k,w)=>(W2[k].find(x=>x.way===w)||{}).v;
    t('new ways: A/R with only the report claim statuses', v('ar','par+iar.rep')===620 && v('ar','par.current+iar.rep')===520);
    t('new ways: patients (not contracts) on A/R, with a balance, and 60+ late', v('arn','par.patients')===2 && v('arn','par.patients.bal')===2 && v('deln','par.pat.late60')===1 && v('arn','par.patients+iar.rep')===3);
    t('gross production can also be read as production net', v('gp','prod.net')===900);
    const ANS3={bh:{rows:1, by:{'11':{n:1, sum:{production:1000}, nz:{}, cnt:{}, groups:{}}}}, coll:{rows:1, by:{'11':{n:1, sum:{net:700}, nz:{}, cnt:{}, groups:{}}}}};
    const W3=O.ways(ANS3,[11],{mdp:250, mdc:'40'}), W4=O.ways(ANS3,[11],{});
    t('Heather = OrthoFi + Medicaid: production 1,000 + Medicaid 250; collections 700 + Medicaid 40', W3.gp[0].way==='bh.production+mdp' && W3.gp[0].v===1250 && W3.gc[0].v===740);
    t('…an office with no Medicaid adds nothing (one rule for every office)', W4.gp[0].v===1000 && W4.gc[0].v===700);
    const bh=O.plan(2026, 10).find(q=>q.id==='bh');
    t('business health is asked for the whole month (OrthoFi files it under the LAST day)', bh.params['month-date-start-date']==='2026-10-01' && bh.params['month-date-end-date']==='2026-10-31');
  }
  {
    const asked=[]; const keep=global.PH_ORTHOFI.ask;
    global.PH_ORTHOFI.ask=async q=>{ asked.push(q); if(q.ask==='statuses') return {ok:true, statuses:[{id:3,name:'Active Treatment'},{id:4,name:'Inactive'},{id:5,name:'In Treatment'},{id:6,name:'Completed'}]}; return {ok:true, rows:0, by:{}}; };
    await global.PH_ORTHOFI.month(2026, 10, [11]);
    const trs=asked.find(q=>q.id==='trs');
    t('all treatments: only the active statuses are asked for ("Inactive" is not active)', trs && trs.params['treatment-status-ids']==='3,5');
    asked.length=0; global.PH_ORTHOFI.ask=async q=>{ asked.push(q); if(q.ask==='statuses') throw new Error('no'); return {ok:true, rows:0, by:{}}; };
    await global.PH_ORTHOFI.month(2026, 10, [11]);
    t('…and if the status list can’t be read, asked as before', asked.find(q=>q.id==='trs') && !asked.find(q=>q.id==='trs').params['treatment-status-ids']);
    global.PH_ORTHOFI.ask=keep;
  }
  const OFF=['Carlsbad','Clovis','Hobbs','San Angelo','Lubbock','Mansfield','Cruces LCO','Cruces FFO'];
  t('location -> office by name: "Farnsworth Orthodontics - Hobbs" is Hobbs', O.guessOffice({name:'Farnsworth Orthodontics - Hobbs'}, OFF)==='Hobbs');
  t('...by city when the name doesn’t say: a location in San Angelo', O.guessOffice({name:'Sunflower Orthodontics', city:'San Angelo'}, OFF)==='San Angelo');
  t('"Cruces" alone is not enough to pick LCO or FFO - left for a person', O.guessOffice({name:'Las Cruces office'}, OFF)==='');
  t('...but "Las Cruces Orthodontics LCO" is', O.guessOffice({name:'Las Cruces Orthodontics LCO'}, OFF)==='Cruces LCO');
  t('a 9th office is found the day it is in the list', O.guessOffice({name:'Ortho of Midland'}, OFF.concat(['Midland']))==='Midland');
  const mp=O.cleanMap({map:{'11':'Hobbs','12':'Hobbs','13':'','x':'Clovis'}});
  t('an office can have two OrthoFi locations; ids only', O.locsOf(mp,'Hobbs').join()==='11,12' && !('x' in mp.map));
  t('A/R "as of": a past month = its last day; this month = today (OrthoFi’s rule)', O.asOf(2026,10,new Date('2026-11-20T12:00:00Z'))==='2026-10-31' && O.asOf(2026,11,new Date('2026-11-20T12:00:00Z'))==='2026-11-20');
  t('a month asks only lists the server allows', O.plan(2026,10).every(q=>!!T.ALLOWED[q.path]) && O.plan(2026,10).every(q=>Object.keys(q.params).every(k=>T.ALLOWED[q.path][k])));
  t('...and only splits by fields the server allows', O.plan(2026,10).every(q=>!q.group || T.GROUPS.indexOf(q.group)>=0));
  t('...and every count rule survives the server’s field check unchanged', O.plan(2026,10).filter(q=>q.count).every(q=>{ const c=T.cleanAsk(Object.assign({locs:[11]}, q)).count; return c.length===q.count.length && c.every((x,i)=>JSON.stringify(Object.keys(x.min).concat(x.any, Object.keys(x.is), Object.keys(x.eq)).sort())===JSON.stringify(Object.keys(q.count[i].min||{}).concat(q.count[i].any||[], Object.keys(q.count[i].is||{}), Object.keys(q.count[i].eq||{})).sort())); }));
  { const c=T.cleanAsk({path:'/v1/practice-locations/patient-accounts-receivable', locs:[11], params:{}, count:[{name:'who', eq:{patientLastName:['quill'], patientFirstName:['zelda']}}, {name:'id', min:{patientId:501}}, {name:'nm', any:['patientLastName']}, {name:'dob', on:{field:'birthDate', from:'2010-01-01', to:'2010-12-31'}}, {name:'ok', min:{outstandingBalance:1}}]});
    t('NEVER one patient: a count rule on a name, an id or any field Home-Brace doesn’t count by is refused', c.count.length===1 && c.count[0].name==='ok'); }
  const ANS={prod:{rows:2, by:{'11':{n:1,sum:{gross:1000,adjustments:-50,net:950},nz:{},cnt:{},groups:{}}, '12':{n:1,sum:{gross:500,adjustments:0,net:500},nz:{},cnt:{},groups:{}}}},
    par:{rows:3, by:{'11':{n:2,sum:{outstandingBalance:2000.75,pastDueOver90Day:75},nz:{},cnt:{bal:2,late30:1},groups:{}}}}, iar:{rows:1, by:{'11':{n:1,sum:{outstandingBalance:400},nz:{},cnt:{bal:1},groups:{}}}},
    trm:{rows:3, by:{'11':{n:3,sum:{},nz:{},cnt:{},groups:{'Retainer Insurance Program':{n:2,sum:{},nz:{}},'Braces':{n:1,sum:{},nz:{}}}}}}, wo:{error:'x'}};
  const W=O.ways(ANS,[11,12]);
  t('an office with two locations adds them: gross production 1,500', W.gp[0].v===1500);
  t('A/R = patient + insurance (Heather) is one of the ways', W.ar.some(w=>w.way==='par+iar.outstanding' && w.v===2400.75));
  t('RIP sold = Retainer Insurance Program on contracts signed that month', W.rip[0].v===2);
  t('a list that didn’t read offers no way (not a zero)', !W.ar.some(w=>w.way==='wo.total'));
  t('to the dollar: $ within 50 cents, counts exactly, adjustments either sign', O.same('gp',1500.4,1500) && !O.same('gp',1501,1500) && O.same('deln',3,3) && !O.same('deln',3,4) && O.same('adj',-50,50));
  /* 20/11/2026 - collections as Heather's balance sheet may count them */
  r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/deposits', locs:[11], params:{'created-on-start-date':'2026-10-01', 'created-on-end-date':'2026-10-31'}});
  t('deposits (OrthoFi’s day sheet) add up per location; payer and patient names never come back', r.status===200 && r.body.by['11'].sum.amount===350.5 && !/Vera|Lumen|Uma|Quay|Tess|Zelda/.test(r.raw) && r.raw.indexOf('"77"')<0);
  r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/collection-details', locs:[11], params:{'payment-start-date':'2026-10-01', 'payment-end-date':'2026-10-31'}, count:[{name:'ok', is:{isCollectionSuccessful:['true']}}]});
  t('collection details: only the successful payments counted (OrthoFi’s own rule), no names', r.status===200 && r.body.by['11'].csum.ok.sum.collection===300 && r.body.by['11'].csum.ok.sum.practiceCollections===290 && !/Zelda|Quill|Yusuf/.test(r.raw));
  { const W2=O.ways({dep:{rows:1, by:{'11':{n:1,sum:{amount:1000},nz:{},cnt:{},groups:{}}}}, cd:{rows:1, by:{'11':{n:1,sum:{},nz:{},cnt:{},csum:{ok:{sum:{collection:900, practiceCollections:880},nz:{}}},groups:{}}}}}, [11], {mdc:50});
    t('gross collections can now be read 3 more ways: deposits, collection details, practice collections (each + Medicaid collections)',
      W2.gc.some(w=>w.way==='dep.amount+mdc' && w.v===1050) && W2.gc.some(w=>w.way==='cd.collection+mdc' && w.v===950) && W2.gc.some(w=>w.way==='cd.practice+mdc' && w.v===930)); }
  r=await call({idt:'good-signin', ask:'sum', path:'/v1/practice-locations/patient-exams', locs:[11], params:{'exam-date-start-date':'2026-10-01', 'exam-date-end-date':'2026-10-31'}, group:'keptExamFlag'});
  t('kept NPE report: exams split by OrthoFi’s kept flag, never a name', r.status===200 && r.body.by['11'].groups.Y.n===1 && r.body.by['11'].groups.N.n===1 && !/Zelda|Yusuf/.test(r.raw));
  { const W3=O.ways({adjr:{rows:1, by:{'11':{n:2,sum:{netAdjustment:-120.5, patientAdjustment:-100, insuranceAdjustment:-20.5},nz:{},cnt:{},groups:{}}}}, pex:{rows:3, by:{'11':{n:3,sum:{},nz:{},cnt:{},groups:{Y:{n:2,sum:{},nz:{}},N:{n:1,sum:{},nz:{}}}}}}}, [11], {});
    t('adjustments can be read from OrthoFi’s adjustment report; new patient exams from its kept NPE report', W3.adj.some(w=>w.way==='adjr.net' && w.v===-120.5) && W3.adj.some(w=>w.way==='adjr.patient+ins' && w.v===-120.5) &&
      W3.npe.some(w=>w.way==='pex.kept' && w.v===2) && W3.npe.some(w=>w.way==='pex.rows' && w.v===3)); }
  { const W4=O.ways({bh:{rows:1, by:{'11':{n:1,sum:{production:10000, totalWriteOff:300, signedNotStartedWriteOff:50, scheduledNewPatientExam:41, keptNewPatientExam:33},nz:{},cnt:{},groups:{}}}},
      del:{rows:5, by:{'11':{n:5,sum:{},nz:{},cnt:{d30:3, d1:5},patc:{d30:2},groups:{}}}}}, [11], {mdp:1000});
    t('Cory: "Should we be sure before we assume?" - adjustments as business health write-offs (signed as a write-off)', W4.adj.some(w=>w.way==='bh.writeoff' && w.v===-300) && W4.adj.some(w=>w.way==='bh.writeoff+sns' && w.v===-350));
    t('...net production = business health production + Medicaid − write-offs', W4.np.some(w=>w.way==='bh.prod+mdp-writeoff' && w.v===10700) && W4.np.some(w=>w.way==='bh.prod+mdp-writeoff-sns' && w.v===10650));
    t('...new patient exams: scheduled as well as kept; past due: OrthoFi’s delinquent list (today’s)', W4.npe.some(w=>w.way==='bh.scheduled' && w.v===41) && W4.deln.some(w=>w.way==='del.d30' && w.v===3) && W4.deln.some(w=>w.way==='del.pat30' && w.v===2)); }
  { const c=T.cleanAsk({path:'/v1/practice-locations/miscellaneous-charges', locs:[11], params:{}, count:[{name:'a', on:{field:'contractSignedOn', from:'2026-10-01', to:'2026-10-31'}}, {name:'b', on:{field:'patientFirstName', from:'2026-10-01', to:'2026-10-31'}}, {name:'c', on:{field:'createdOn', from:'x', to:'2026-10-31'}}]});
    t('a count can ask "this row’s own date is in the month" - only date fields, only real dates', c.count.length===1 && c.count[0].on.field==='contractSignedOn'); }
  { const rows=[{practiceLocationId:11, treatmentCoordinatorName:'Tess Front', keptExamFlag:'Kept Exam', patientFirstName:'Zelda', patientId:1}, {practiceLocationId:11, treatmentCoordinatorName:'Tess Front', keptExamFlag:'Not Kept', patientId:2},
      {practiceLocationId:11, treatmentCoordinatorName:'Rae Desk', keptExamFlag:'Kept Exam', patientId:3}];
    const s=T.summarize(rows, 'treatmentCoordinatorName', [{name:'kept', any:[], min:{}, is:{}, eq:{keptExamFlag:['kept exam']}, on:null}]);
    t('per TC: the counts are kept inside each TC’s group too (a TC is staff, never a patient; no patient name comes back)', s.by['11'].groups['Tess Front'].n===2 && s.by['11'].groups['Tess Front'].cnt.kept===1 && s.by['11'].groups['Rae Desk'].cnt.kept===1 && !/Zelda/.test(JSON.stringify(s))); }
  /* 20/11/2026: proven to the dollar (Sept + Oct) - and still nothing fills itself in for an office until it is ticked */
  t('proven: gross production = business health production, collections = collection details (successful payments), A/R = patient + insurance (report claim statuses) - nothing else', JSON.stringify(O.PROVEN)==='{"gp":"bh.production","gc":"cd.collection","adj":"bs.adj","np":"bs.np","ar":"par+iar.rep","deln":"del.d30"}');
  { const W5=O.ways({adjr:{rows:2, by:{'11':{n:2,sum:{netAdjustment:-500.25},nz:{},cnt:{},groups:{}}}}, misc:{rows:2, by:{'11':{n:2,sum:{},nz:{},cnt:{},csum:{adhoc:{sum:{miscellaneousChargeAmount:200},nz:{}}},groups:{}}}},
      disc:{rows:1, by:{'11':{n:1,sum:{},nz:{},cnt:{},csum:{misc:{sum:{discountAmount:50},nz:{}}},groups:{}}}}, fee:{rows:3, by:{'11':{n:3,sum:{},nz:{},cnt:{},csum:{late:{sum:{feeAmount:75}},nsf:{sum:{feeAmount:25}}},groups:{}}}},
      int:{rows:9, by:{'11':{n:9,sum:{interestAccrued:10.5},nz:{},cnt:{},groups:{}}}}, bh:{rows:1, by:{'11':{n:1,sum:{production:10000},nz:{},cnt:{},groups:{}}}}}, [11], {mdp:1000});
    t('adjustments = the balance sheet’s Adjustments Total: production adjustments + ad-hoc misc charges − their courtesies + late + NSF fees + interest (to the cent: 6 offices x Sept + Oct)',
      W5.adj.some(w=>w.way==='bs.adj' && w.v===-239.75));
    t('...net production = production + that; Heather adds Medicaid production', W5.np.some(w=>w.way==='bs.np' && w.v===9760.25) && W5.np.some(w=>w.way==='bs.np+mdp' && w.v===10760.25));
    const W6=O.ways({adjr:{rows:0, by:{}}, misc:{rows:0, by:{}}, disc:{rows:0, by:{}}, fee:{rows:0, by:{}}, int:{rows:0, by:{}}}, [11], {});
    t('...a month with none of those is 0, not "unknown"; a list that failed is unknown', W6.adj.some(w=>w.way==='bs.adj' && w.v===0) && !O.ways({adjr:{error:'x'}}, [11], {}).adj.some(w=>w.way==='bs.adj')); }
  t('delinquent accounts = OrthoFi’s Delinquent report, everyone 30+ days past due (Heather 21/11) - today’s list, so: this month, and last month only until the due day',
    O.AUTO.deln.snapshot===true && O.snapshotOk(2026, 11, {now:new Date(2026,10,21)}) && O.snapshotOk(2026, 10, {now:new Date(2026,10,4), due:5}) &&
    !O.snapshotOk(2026, 10, {now:new Date(2026,10,21), due:5}) && !O.snapshotOk(2026, 9, {now:new Date(2026,10,2)}) && O.snapshotOk(2025, 12, {now:new Date(2026,0,3)}));
  t('...and no office fills itself in until it is ticked on the OrthoFi page', JSON.stringify(O.autoOffices(O.cleanMap(null)))==='{}' && JSON.stringify(O.cleanMap({map:{'11':'North'}}).auto)==='{}');
  { const MAP=O.cleanMap({map:{'11':'North','12':'North','13':'South','14':''}, auto:{gp:['North','South','Nowhere'], ar:['North'], gc:['North'], zz:['x']}});
    t('ticks are kept only for the proven boxes; an office with no OrthoFi location is left out', Object.keys(MAP.auto).join()==='gp,gc,ar' && JSON.stringify(O.autoOffices(MAP))==='{"North":["gp","gc","ar"],"South":["gp"]}');
    const ANS2={bh:{rows:2, by:{'11':{n:1,sum:{production:1000.5},nz:{},cnt:{},groups:{}},'12':{n:1,sum:{production:500},nz:{},cnt:{},groups:{}},'13':{n:1,sum:{production:70},nz:{},cnt:{},groups:{}}}},
      par:{rows:1, by:{'11':{n:1,sum:{outstandingBalance:2000},nz:{},cnt:{},groups:{}}}}, iar:{rows:1, by:{'11':{n:1,sum:{},nz:{},cnt:{},csum:{rep:{sum:{outstandingBalance:300},nz:{}}},groups:{}}}}};
    t('collections: OrthoFi’s part is the successful payments in collection details', O.autoParts({cd:{rows:1, by:{'11':{n:2,sum:{},nz:{},cnt:{},csum:{ok:{sum:{collection:812.25},nz:{}}},groups:{}}}}}, [11], ['gc']).gc===812.25);
    t('OrthoFi’s part for an office: its locations added up, only the boxes it is ticked for', JSON.stringify(O.autoParts(ANS2,[11,12],['gp','ar']))==='{"gp":1500.5,"ar":2300}' && JSON.stringify(O.autoParts(ANS2,[13],['gp']))==='{"gp":70}');
    const asked=[]; global.PH_ORTHOFI.ask=async q=>{ asked.push(q.id+':'+q.locs.join('+')); return ANS2[q.id]; };
    const res=await global.PH_ORTHOFI.autoMonth(2026, 10, MAP);
    t('the fill asks OrthoFi only for what the ticked boxes need (4 lists, not 15), for the ticked offices’ locations', asked.join()==='par:11+12+13,iar:11+12+13,bh:11+12+13,cd:11+12+13');
    t('...and gives the Monthly Report each ticked office’s parts', JSON.stringify(res.byOffice)==='{"North":{"gp":1500.5,"ar":2300},"South":{"gp":70}}' && res.errors.length===0);
    const asked2=[]; global.PH_ORTHOFI.ask=async q=>{ asked2.push(q.id); return q.id==='del' ? {rows:3, by:{'11':{n:3,sum:{},nz:{},cnt:{d30:2},groups:{}}}} : ANS2[q.id]; };
    const MAPD=O.cleanMap({map:{'11':'North'}, auto:{deln:['North']}});
    const past=await global.PH_ORTHOFI.autoMonth(2026, 9, MAPD, {now:new Date(2026,10,21)}), cur=await global.PH_ORTHOFI.autoMonth(2026, 11, MAPD, {now:new Date(2026,10,21)});
    t('...an office with nobody on the delinquent list gets 0 (not left empty)', O.ways({del:{rows:3, by:{'99':{n:3,sum:{},nz:{},cnt:{d30:3},groups:{}}}}}, [11], {}).deln.some(w=>w.way==='del.d30' && w.v===0));
    t('...a past month never gets today’s delinquent count; this month does', JSON.stringify(past.byOffice)==='{}' && JSON.stringify(cur.byOffice)==='{"North":{"deln":2}}' && asked2.join()==='del');
    delete global.PH_ORTHOFI.ask; }

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
