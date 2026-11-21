/* PHONE ALERTS: every device a person turns on (alerts.js, 03/11/2026).
       node test/alerts.test.js
   Each device's alert address is kept with the person in the shared store (ph_alertdev_<email>), so a payroll reminder
   or a chat message reaches every phone and computer they turned on. These check the device record (newest first,
   no doubles, at most 6), that sendTo() sends one alert per device with the sender's Microsoft sign-in, drops a device
   that turned alerts off, skips people with none, and that the live site sends nothing until ALERTS_LIVE. Also that
   the store's wipe guard leaves these records - and the payroll folders' grants record - free to shrink.
   Runs the real store.js in its sandbox mode (this "browser's" storage). No network. Made-up people only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const SRC=fs.readFileSync(path.join(__dirname,'..','v1','alerts.js'),'utf8'), STORE=fs.readFileSync(path.join(__dirname,'..','v1','store.js'),'utf8');
const sub=(n)=>({endpoint:'https://web.push.apple.com/dev-'+n, keys:{p256dh:'P'+n, auth:'A'+n}});

function load(opts){
  opts=opts||{};
  const LS=Object.assign({}, opts.ls||{}), posted=[];
  const w={ localStorage:{getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}},
    navigator:{userAgent:opts.ua||'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', maxTouchPoints:0},
    location:{href:'https://corylawing.github.io/practice-hub-mockup/v1/home.html', origin:opts.origin||'https://corylawing.github.io'},
    document:{addEventListener(){}, dispatchEvent(){}}, CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail;}},
    URL, console, Promise, JSON, Set, Date, setTimeout, clearTimeout, atob:s=>Buffer.from(s,'base64').toString('binary') };
  w.window=w;
  /* a phone's alert service, when asked for (opts.sw): {reg:true|false, sub:subscription|null, canSub:true|false} */
  if(opts.sw){ const SW=opts.sw; SW.registered=0; SW.subscribed=0;
    const toJ=x=>({endpoint:x.endpoint, keys:x.keys}), wrap=x=>x ? Object.assign({toJSON:()=>toJ(x)}, x) : null;
    const reg={pushManager:{getSubscription:async ()=>wrap(SW.sub), subscribe:async ()=>{ if(!SW.canSub) throw new Error('needs a tap'); SW.subscribed++; SW.sub=SW.fresh; return wrap(SW.sub); }}};
    w.navigator.serviceWorker={getRegistration:async ()=>SW.reg ? reg : undefined, register:async ()=>{ SW.registered++; SW.reg=true; return reg; }, get ready(){ return Promise.resolve(reg); }};
    w.PushManager=function(){}; w.Notification={permission:SW.perm||'granted'}; }
  const me={first:'Gabriela', last:'Garrison', mail:'Gabriela.Garrison@farnsworthorthodontics.com'};
  w.PH={isLive:()=>!!opts.live, me:()=>me, realMe:()=>me, email:p=>p.mail};
  w.PH_AUTH={idToken:()=>Promise.resolve('ID-TOKEN')};
  w.fetch=async (url, o)=>{ const b=JSON.parse(o.body); posted.push({url, b});
    const gone=(opts.gone||[]).indexOf(b.sub.endpoint)>=0, bad=(opts.bad||[]).indexOf(b.sub.endpoint)>=0;
    return {ok:!bad, status:bad?500:200, json:async ()=>bad ? {ok:false, error:'boom'} : gone ? {ok:false, status:410, gone:true} : {ok:true, status:201}}; };
  vm.createContext(w);
  vm.runInContext(STORE, w); vm.runInContext(SRC, w);
  return {w, A:w.PH_ALERTS, S:w.PH_STORE, LS, posted};
}

(async ()=>{
  /* ---- 1. The device record ---- */
  {
    const {A}=load(), R=A._rec;
    let rec=R.addDevice(undefined, sub(1), 'iPhone', 't1');
    t('a first device makes a record', rec.v===1 && rec.d.length===1 && rec.d[0].k==='iPhone' && rec.d[0].s.endpoint===sub(1).endpoint);
    rec=R.addDevice(rec, sub(2), 'Mac', 't2');
    t('a second device goes first (newest first)', rec.d.length===2 && rec.d[0].s.endpoint===sub(2).endpoint);
    rec=R.addDevice(rec, sub(1), 'iPhone', 't3');
    t('the same device again is moved up, not added twice', rec.d.length===2 && rec.d[0].s.endpoint===sub(1).endpoint && rec.d[0].at==='t3');
    for(let i=3;i<=9;i++) rec=R.addDevice(rec, sub(i), 'x', 't'+i);
    t('at most 6 devices - the oldest drop off', rec.d.length===6 && rec.d[0].s.endpoint===sub(9).endpoint && !rec.d.some(x=>x.s.endpoint===sub(2).endpoint));
    t('a broken address is refused', R.addDevice(rec, {endpoint:'http://x', keys:{p256dh:'a', auth:'b'}})===undefined && R.addDevice(rec, {endpoint:'https://x'})===undefined);
    t('only the address and its keys are kept', JSON.stringify(Object.keys(R.addDevice(undefined, Object.assign({expirationTime:null, extra:'x'}, sub(1))).d[0].s))==='["endpoint","keys"]');
    const less=R.dropDevice(rec, sub(9).endpoint);
    t('a device can be taken off', less.d.length===5 && !less.d.some(x=>x.s.endpoint===sub(9).endpoint));
    t('taking off one that isn\'t there writes nothing', R.dropDevice(rec, 'https://nope')===undefined);
    t('the key is by email, any capitals', R.keyFor(' Gabriela.Garrison@FarnsworthOrthodontics.com ')==='ph_alertdev_gabriela.garrison@farnsworthorthodontics.com');
    t('junk in the record is ignored', R.devices({d:[null, {s:{endpoint:'nope'}}, {s:sub(1)}]}).length===1);
  }

  /* ---- 1b. One alert per phone (21/11/2026, Cory: "on my phone will send notifications 2 or 3 times") ---- */
  {
    const {A}=load(), R=A._rec, D=864e5, now=Date.parse('2026-11-21T12:00:00Z'), iso=ms=>new Date(ms).toISOString();
    let rec=R.addDevice(undefined, sub(1), 'iPhone', iso(now-3*D), 'inst1');
    rec=R.addDevice(rec, sub(2), 'iPhone', iso(now), 'inst1');
    t('the same install with a new address replaces its old one (no second alert to the same phone)', rec.d.length===1 && rec.d[0].s.endpoint===sub(2).endpoint && rec.d[0].id==='inst1');
    const legacy=[{s:sub(3), k:'iPhone', at:iso(now-3*D)}, {s:sub(4), k:'Mac', at:iso(now-3*D)}, {s:sub(5), k:'iPhone', at:iso(now-1*3600e3)}, {s:sub(6), k:'iPad', at:iso(now-30*D), id:'x', seen:iso(now-30*D)}];
    const left=R.tidyDevices(legacy, sub(9).endpoint, 'iPhone', now).map(x=>x.s.endpoint);
    t('an old leftover of this phone’s kind (from before ids) is dropped; another kind of device stays', left.indexOf(sub(3).endpoint)<0 && left.indexOf(sub(4).endpoint)>=0);
    t('...a brand-new one (under 2 days) stays, in case it is a second real phone', left.indexOf(sub(5).endpoint)>=0);
    t('a device nobody has opened Home-Brace on for 3 weeks is dropped', R.STALE_DAYS===21 && left.indexOf(sub(6).endpoint)<0);
    const keepCi=R.addDevice({v:1, d:[{s:sub(7), k:'iPhone', at:'a', ci:iso(now+D)}]}, sub(7), 'iPhone', iso(now), 'inst7');
    t('a device keeps its instant-chat mark when it saves itself again', keepCi.d[0].ci===iso(now+D));
  }
  {
    const {A, S, posted}=load(), R=A._rec;
    await S.set(R.keyFor('quinn.quill@farnsworthorthodontics.com'), {v:1, d:[{s:sub(1), k:'iPhone', at:'a', ci:new Date(Date.now()+864e5).toISOString()}, {s:sub(2), k:'Mac', at:'b'}]});
    const out=await A.sendTo(['quinn.quill@farnsworthorthodontics.com'], {title:'Quinn', tag:'hb-chat'}, {skipInstant:true});
    t('a chat sent from Home-Brace skips the phone that gets it straight from Microsoft (no double chat alert); others still get it', posted.length===1 && posted[0].b.sub.endpoint===sub(2).endpoint && out.devices===1);
    posted.length=0; await A.sendTo(['quinn.quill@farnsworthorthodontics.com'], {title:'Task', tag:'hb-task'});
    t('...every other kind of alert still goes to every device', posted.length===2);
  }
  /* ---- 2. sendTo(): one alert per device, with the sign-in ---- */
  {
    const {A, S, posted}=load({gone:[sub(2).endpoint]}), R=A._rec;
    await S.set(R.keyFor('quinn.quill@farnsworthorthodontics.com'), R.addDevice(R.addDevice(undefined, sub(1), 'iPhone', 'a'), sub(2), 'Mac', 'b'));
    await S.set(R.keyFor('avery.brooks@farnsworthorthodontics.com'), R.addDevice(undefined, sub(3), 'Android phone', 'c'));
    const out=await A.sendTo(['Quinn.Quill@farnsworthorthodontics.com', 'avery.brooks@farnsworthorthodontics.com', 'jordan.ellis@farnsworthorthodontics.com', 'quinn.quill@farnsworthorthodontics.com'],
      {title:'Carlsbad’s payroll sheet is due today by 2 pm', url:'/v1/payroll.html', tag:'hb-pay'});
    t('every device of every person, once (the same person twice counts once)', posted.length===3 && out.devices===3);
    t('people with no devices are skipped, not an error', out.people===2 && !out.failed.length);
    t('each one carries the Microsoft sign-in and the message', posted.every(p=>p.b.idt==='ID-TOKEN' && p.b.title.indexOf('payroll sheet')>0 && p.b.tag==='hb-pay'));
    t('the sandbox uses the sender\'s test slot', posted.every(p=>p.url==='https://kind-hill-00da87410-alerts.centralus.3.azurestaticapps.net/api/push'));
    t('sent 2, one device gone', out.sent===2 && out.gone===1);
    const q=await S.get(R.keyFor('quinn.quill@farnsworthorthodontics.com'));
    t('the gone device is dropped from that person', R.devices(q).length===1 && R.devices(q)[0].s.endpoint===sub(1).endpoint);
  }
  {
    const {A, S}=load({bad:[sub(1).endpoint]}), R=A._rec;
    await S.set(R.keyFor('quinn.quill@farnsworthorthodontics.com'), R.addDevice(undefined, sub(1), 'iPhone', 'a'));
    const out=await A.sendTo(['quinn.quill@farnsworthorthodontics.com'], {title:'x'});
    t('a failure is reported by person, and the device is kept', out.failed.length===1 && /quinn/.test(out.failed[0]) && R.devices(await S.get(R.keyFor('quinn.quill@farnsworthorthodontics.com'))).length===1);
  }
  {
    const {A, posted}=load({live:true, origin:'https://kind-hill-00da87410.3.azurestaticapps.net'});
    let err=''; try{ await A.send({title:'x'}, sub(1)); }catch(e){ err=e.message; }
    t('the live site is on (ALERTS_LIVE, 04/11) and sends through its own /api/push, signed in', A.ON===true && !err && posted.length===1 &&
      posted[0].url==='https://kind-hill-00da87410.3.azurestaticapps.net/api/push' && posted[0].b.idt==='ID-TOKEN');
  }

  /* ---- 3. The wipe guard leaves these records free to shrink ---- */
  {
    const {S}=load();
    const big={}; for(let i=0;i<9;i++) big['Home-Brace Payroll/F'+i]={['a'+i+'@x.com']:'write', ['b'+i+'@x.com']:'write'};
    await S.set('ph_paygrants', big);
    const r=await S.set('ph_paygrants', {'Home-Brace Payroll':{'a@x.com':'write'}});
    t('ph_paygrants can shrink a lot (access taken back) without being refused', !(r && r.blocked));
    const devs={v:1, d:[1,2,3,4].map(i=>({s:sub(i), k:'x', at:'t'}))};
    await S.set('ph_alertdev_quinn.quill@farnsworthorthodontics.com', devs);
    const r2=await S.set('ph_alertdev_quinn.quill@farnsworthorthodontics.com', {v:1, d:[]});
    t('a person\'s devices can go to none without being refused', !(r2 && r2.blocked));
    await S.set('ph_pay_senders', big);
    const r3=await S.set('ph_pay_senders', {v:1});
    t('a record people typed (who sends each sheet) is still guarded', !!(r3 && r3.blocked));
  }
  /* Admin -> a person -> Send a test alert (10/11/2026, Cory: "Can you send a test notification on production to heather") */
  {
    const A=require('fs').readFileSync(require('path').join(__dirname,'..','v1','admin.html'),'utf8');
    t('Admin: a test alert goes only to the person whose card is open', /return A\.sendTo\(\[em\], \{title:'Test alert from Home-Brace'/.test(A) && /const em=String\(u\.email\|\|''\)\.trim\(\)\.toLowerCase\(\)/.test(A));
    t('Admin: the sandbox never sends one', /if\(!\(PH\.isLive && PH\.isLive\(\)\)\)\{ say\('On the live site this sends '/.test(A));
    t('Admin: says when they haven\'t turned alerts on yet', /hasn’t turned alerts on yet/.test(A));
  }
  /* ---- REFRESH WHEN THE APP OPENS (20/11/2026, Heather kept seeing "Turn on") ---- */
  {
    const devs=async (S)=>((await S.get('ph_alertdev_gabriela.garrison@farnsworthorthodontics.com'))||{d:[]}).d.map(x=>x.s.endpoint);
    // 1. the phone hadn't found its alert service yet: wake it, keep the device
    let L=load({sw:{reg:false, sub:sub(1)}}); L.LS['ph_alert_sub']=JSON.stringify(sub(1));
    await L.S.set('ph_alertdev_gabriela.garrison@farnsworthorthodontics.com', {v:1, d:[{s:sub(1), k:'iPhone', at:'t'}]});
    await L.A.refresh();
    t('service not found yet -> woken, the phone stays on and stays in the person\u2019s devices', L.A.state()==='on' && (await devs(L.S)).join()===sub(1).endpoint);
    // 2. the subscription really went: a new one quietly, the old one dropped
    L=load({sw:{reg:true, sub:null, canSub:true, fresh:sub(2)}}); L.LS['ph_alert_sub']=JSON.stringify(sub(1));
    await L.S.set('ph_alertdev_gabriela.garrison@farnsworthorthodontics.com', {v:1, d:[{s:sub(1), k:'iPhone', at:'t'}]});
    await L.A.refresh();
    t('subscription gone but alerts still allowed -> a new one, no "Turn on"; the dead one leaves the devices', L.A.state()==='on' && (await devs(L.S)).join()===sub(2).endpoint);
    // 3. and if the phone won't make one without a tap: as before - off, dropped
    L=load({sw:{reg:true, sub:null, canSub:false}}); L.LS['ph_alert_sub']=JSON.stringify(sub(1));
    await L.S.set('ph_alertdev_gabriela.garrison@farnsworthorthodontics.com', {v:1, d:[{s:sub(1), k:'iPhone', at:'t'}]});
    await L.A.refresh();
    t('…and if it can\u2019t, off and dropped (the bell shows Turn on)', L.A.state()==='off' && (await devs(L.S)).length===0);
    // 4. this browser forgot it was on: put back on
    L=load({sw:{reg:true, sub:sub(3)}}); await L.A.refresh();
    t('this browser forgot, but the phone still has its subscription -> back on, and in the devices', L.A.state()==='on' && (await devs(L.S)).join()===sub(3).endpoint);
    // 5. turned off here: never quietly back on
    L=load({sw:{reg:true, sub:sub(4)}, ls:{ph_alert_off:'1'}}); await L.A.refresh();
    t('turned off on this device -> stays off', L.A.state()==='off' && (await devs(L.S)).length===0);
    // 6. two at once (page open + sign-in) run one after the other
    L=load({sw:{reg:false, sub:sub(5)}}); const p1=L.A.refresh(), p2=L.A.refresh(); await p1; await p2;
    t('two refreshes at once run one after the other (the second after sign-in still saves)', L.w.navigator.serviceWorker && L.A.state()==='on');
  }

  console.log(pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})().catch(e=>{ console.log('  FAIL  crashed: '+(e && e.stack || e)); process.exit(1); });
