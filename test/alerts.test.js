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
  const LS={}, posted=[];
  const w={ localStorage:{getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}},
    navigator:{userAgent:opts.ua||'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', maxTouchPoints:0},
    location:{href:'https://corylawing.github.io/practice-hub-mockup/v1/home.html', origin:opts.origin||'https://corylawing.github.io'},
    document:{addEventListener(){}, dispatchEvent(){}}, CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail;}},
    URL, console, Promise, JSON, Set, Date, setTimeout, clearTimeout, atob:s=>Buffer.from(s,'base64').toString('binary') };
  w.window=w;
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
    const out=await A.sendTo(['quinn.quill@farnsworthorthodontics.com'], {title:'x'});
    t('the live site sends nothing until ALERTS_LIVE', A.ON===false && out.devices===0 && !posted.length);
    let threw=false; try{ await A.send({title:'x'}, sub(1)); }catch(e){ threw=e.message==='off'; }
    t('and send() says "off" there', threw);
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
  console.log(pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})().catch(e=>{ console.log('  FAIL  crashed: '+(e && e.stack || e)); process.exit(1); });
