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
  t('every list it reads is a total-type list or is added up here', Object.keys(T.ALLOWED).every(p=>!/patients$|guardians|communications|eligibility|payment-profiles|patient-exams/.test(p)));
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

  const O=require(path.join(__dirname,'..','v1','orthofi.js'));
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
  const ANS={prod:{rows:2, by:{'11':{n:1,sum:{gross:1000,adjustments:-50,net:950},nz:{},cnt:{},groups:{}}, '12':{n:1,sum:{gross:500,adjustments:0,net:500},nz:{},cnt:{},groups:{}}}},
    par:{rows:3, by:{'11':{n:2,sum:{outstandingBalance:2000.75,pastDueOver90Day:75},nz:{},cnt:{bal:2,late30:1},groups:{}}}}, iar:{rows:1, by:{'11':{n:1,sum:{outstandingBalance:400},nz:{},cnt:{bal:1},groups:{}}}},
    trm:{rows:3, by:{'11':{n:3,sum:{},nz:{},cnt:{},groups:{'Retainer Insurance Program':{n:2,sum:{},nz:{}},'Braces':{n:1,sum:{},nz:{}}}}}}, wo:{error:'x'}};
  const W=O.ways(ANS,[11,12]);
  t('an office with two locations adds them: gross production 1,500', W.gp[0].v===1500);
  t('A/R = patient + insurance (Heather) is one of the ways', W.ar.some(w=>w.way==='par+iar.outstanding' && w.v===2400.75));
  t('RIP sold = Retainer Insurance Program on contracts signed that month', W.rip[0].v===2);
  t('a list that didn’t read offers no way (not a zero)', !W.ar.some(w=>w.way==='wo.total'));
  t('to the dollar: $ within 50 cents, counts exactly, adjustments either sign', O.same('gp',1500.4,1500) && !O.same('gp',1501,1500) && O.same('deln',3,3) && !O.same('deln',3,4) && O.same('adj',-50,50));
  t('nothing fills itself in until a way is proven against Heather', Object.keys(O.PROVEN).length===0);

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
