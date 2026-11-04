/* PAYROLL REMINDERS IN THE BELL (02/11/2026). Heather 22/10: "How will they get reminders to send payroll? Is it
   through Home-Brace?" user.js payReminders(): worked out from the date + ph_pay_status. Sandbox personas, made-up
   people (Gabriela = Carlsbad's sender, Quinn = Hobbs's, Priya = Heather's seat).

       node test/payremind.test.js
*/
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');

function load(reuse){
  const LS=reuse||{};
  const nodes=[];
  const mk=()=>({ style:{}, classList:{add(){},remove(){},contains(){return false}},
    children:[], appendChild(c){this.children.push(c);return c}, removeChild(){},
    remove(){}, setAttribute(){}, getAttribute(){return null},
    querySelector(){return null}, querySelectorAll(){return []},
    addEventListener(){}, insertBefore(){}, set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''},
    set textContent(v){this._t=v}, get textContent(){return this._t||''} });
  const listeners={};
  const ctx={
    console, Promise, Date, JSON, Math, Object, Array, String, Number, RegExp, isNaN, parseInt,
    setTimeout, clearTimeout,
    localStorage:{ getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v)}, removeItem:k=>{delete LS[k]} },
    /* The SANDBOX host on purpose: this file tests the read-state mechanics through the
       demo personas, which are a sandbox feature. It used to point at the production
       host and still resolve a persona - because me() fell through to the 'admin' demo
       persona when there was no profile. That fail-open is what handed a guest the
       Admin tab (see test/permissions.test.js); with it closed, a live host and no
       sign-in correctly resolves to nobody, and nobody has no notifications. */
    location:{ hostname:'corylawing.github.io', pathname:'/v1/home.html', search:'' },
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{ readyState:'complete', documentElement:mk(), body:mk(), head:mk(),
      createElement:mk, getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
      addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},
      dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true} },
    navigator:{ userAgent:'node' }, fetch:()=>Promise.reject(new Error('offline'))
  };
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'), ctx, {filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'payrules.js'),'utf8'), ctx, {filename:'payrules.js'});
  /* These tests work the reminders through #23. Home-Brace payroll really begins with #24 (PAYRULES.FIRST) - checked
     on its own at the end - so here it starts earlier. */
  if(!REAL_FIRST) ctx.PAYRULES.FIRST='2026-01';
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'), ctx, {filename:'user.js'});
  return {PH:ctx.PH, LS, ctx};
}


let pass=0, fail=0, REAL_FIRST=false;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const SENDERS=JSON.stringify({offices:{Carlsbad:['gabriela@farnsworthorthodontics.com'], Hobbs:['Quinn@farnsworthorthodontics.com']}});
const as=(who, ls)=>load(Object.assign({ph_viewas:who}, ls||{}));
const at=(d,h,m)=>new Date(2026, 10, d, h, m||0);          // November 2026, local time
const titles=r=>r.map(x=>x.title).join(' | ');

/* Pay period #23: Oct 18 - Oct 31, due Tue Nov 3 by 2 pm, paid Fri Nov 6. #22 is entered (done). */
const done22={v:1, p:{'2026-22':{sent:{}, entered:'2026-10-21T09:00'}}};
const base={ph_pay_senders:SENDERS, ph_pay_status:JSON.stringify(done22)};

let G=as('om', base);
t('Gabriela sends Carlsbad’s sheet', G.PH.paySenderOffices().join()==='Carlsbad' && G.PH.payLevel()==='send');
t('Sunday Nov 1: #22 is the current one and it’s entered - nothing', G.PH.payReminders(at(1,10)).length===0);
let r=G.PH.payReminders(at(2,10));
t('Monday, the workday before: "due Tuesday by 2 pm"', r.length===1 && /^Carlsbad’s payroll sheet is due Tuesday by 2 pm$/.test(r[0].title) && !r[0].late && r[0].href==='payroll.html');
t('...and it says which pay period', /Pay period #23/.test(r[0].sub));
r=G.PH.payReminders(at(3,13,30));
t('Tuesday 1:30 pm: "due today by 2 pm"', r.length===1 && /due today by 2 pm/.test(r[0].title));
r=G.PH.payReminders(at(3,14,5));
t('Tuesday 2:05 pm: late', r.length===1 && r[0].late && /is late — it was due today by 2 pm/.test(r[0].title));
r=G.PH.payReminders(at(5,9));
t('Thursday: still late, "was due Tuesday"', r.length===1 && /was due Tuesday/.test(r[0].title));
t('Gabriela gets nothing about Hobbs', !/Hobbs/.test(titles(G.PH.payReminders(at(3,15)))));

G.PH.payMark('2026-23', x=>{ x.sent.Carlsbad='2026-11-02T11:00'; });
t('once Carlsbad has sent it, her reminder is gone', G.PH.payReminders(at(2,12)).length===0 && G.PH.payReminders(at(5,9)).length===0);
t('...kept in the shared record, no pay in it', /"Carlsbad":"2026-11-02T11:00"/.test(G.LS.ph_pay_status) && !/bonus|w1|goal/.test(G.LS.ph_pay_status));

let Q=as('tc', base);
t('Quinn (email in other capitals) sends Hobbs', Q.PH.paySenderOffices().join()==='Hobbs' && Q.PH.payReminders(at(2,10)).length===1);

let P=as('admin', base);
t('Priya manages payroll', P.PH.payLevel()==='manage');
t('Monday morning: nothing for whoever manages payroll yet', P.PH.payReminders(at(2,10)).length===0);
r=P.PH.payReminders(at(3,14,30));
t('Tuesday 2:30 pm, nothing sent: "still waiting on Carlsbad, Hobbs, Zihua Partners" (offices with a sender, and hers)', r.length===1 && r[0].title==='Payroll #23: still waiting on Carlsbad, Hobbs, Zihua Partners');
P.PH.payMark('2026-23', x=>{ x.sent.Carlsbad='2026-11-03T10:00'; });
t('...Carlsbad in: still waiting on Hobbs, Zihua Partners', titles(P.PH.payReminders(at(3,14,30)))==='Payroll #23: still waiting on Hobbs, Zihua Partners');
P.PH.payMark('2026-23', x=>{ x.sent.Hobbs='2026-11-03T15:00'; });
t('...Hobbs in: only Zihua Partners left - hers to mark done', titles(P.PH.payReminders(at(3,16)))==='Payroll #23: still waiting on Zihua Partners');
P.PH.payMark('2026-23', x=>{ x.sent['Zihua Partners']='2026-11-03T15:30'; });
t('...all in: "ready to enter"', /every sheet is in — ready to enter/.test(titles(P.PH.payReminders(at(3,16)))));
P.PH.payMark('2026-23', x=>{ x.entered='2026-11-04T09:00'; });
t('...entered: nothing', P.PH.payReminders(at(4,10)).length===0);
const st=JSON.parse(P.LS.ph_pay_status);
t('sending twice keeps the first time', st.p['2026-23'].sent.Carlsbad==='2026-11-03T10:00');

let none=as('admin', {ph_pay_status:JSON.stringify(done22)});
t('no senders chosen yet: Heather isn’t nagged about every office', none.PH.payReminders(at(3,15)).length===0);
let D=as('doctor', base);
t('a doctor with no Payroll: nothing', D.PH.payLevel()==='' && D.PH.payReminders(at(3,15)).length===0);

// the record keeps the last 6 pay periods
let K=as('admin', {});
['2026-18','2026-19','2026-20','2026-21','2026-22','2026-23','2026-24'].forEach(k=>K.PH.payMark(k, x=>{ x.sent.Carlsbad='x'; }));
const kept=Object.keys(JSON.parse(K.LS.ph_pay_status).p).sort();
t('the shared record keeps the last 6 pay periods', kept.length===6 && kept[0]==='2026-19' && kept[5]==='2026-24');

// "Carlsbad sent its payroll sheet" - for whoever sees every office's payroll, not the senders
let A=as('admin', base);
A.PH.logActivity({kind:'payroll', sec:'payroll', ic:'💵', title:'Carlsbad sent its payroll sheet (pay period #23)'});
t('Priya is told Carlsbad sent it', A.PH.notifications().some(n=>/Carlsbad sent its payroll sheet/.test(n.title)));
let G2=as('om', Object.assign({}, base, {ph_activity:A.LS.ph_activity}));
t('Gabriela (a sender) isn’t told about payroll updates', !G2.PH.notifications().some(n=>/payroll sheet/.test(n.title)));
let Q2=as('tc', Object.assign({}, base, {ph_activity:A.LS.ph_activity}));
t('...nor Quinn', !Q2.PH.notifications().some(n=>/payroll sheet/.test(n.title)));

/* ---- PHONE REMINDERS (03/11/2026): when, to whom, and only once ---- */
const ct=(d,h,m)=>new Date(Date.UTC(2026, 10, d, h+6, m||0));   // November 2026 is Central Standard Time (UTC-6)
let Z=as('admin', base);
t('Central time, wherever the device is', JSON.stringify(Z.PH.centralNow(ct(3,9)))==='{"date":"2026-11-03","hm":"09:00"}' &&
  Z.PH.centralNow(new Date(Date.UTC(2026,10,3,5,30))).date==='2026-11-02');
t('Monday 8:59 am: nothing yet', Z.PH.payAlertPlan(ct(2,8,59))===null);
let pl=Z.PH.payAlertPlan(ct(2,9));
t('Monday 9 am (the workday before): both senders, "due Tuesday by 2 pm"', !!pl && pl.slot==='eve' && pl.key==='2026-23' && pl.sends.length===2 &&
  pl.sends[0].title==='Carlsbad’s payroll sheet is due Tuesday by 2 pm' && pl.sends[0].emails.join()==='gabriela@farnsworthorthodontics.com' && pl.sends[0].body==='Pay period #23 · tap to open it');
pl=Z.PH.payAlertPlan(ct(3,9,30));
t('Tuesday 9:30: "due today by 2 pm"', !!pl && pl.slot==='am' && /due today by 2 pm$/.test(pl.sends[1].title) && pl.sends[1].o==='Hobbs');
pl=Z.PH.payAlertPlan(ct(3,13,5));
t('Tuesday 1:05 pm: "an hour to go"', !!pl && pl.slot==='pm' && /due at 2 pm — an hour to go$/.test(pl.sends[0].title));
t('Tuesday 2 pm: no more phone reminders (the bell says late)', Z.PH.payAlertPlan(ct(3,14))===null && Z.PH.payAlertPlan(ct(4,9))===null);
let Z2=as('admin', Object.assign({}, base, {ph_pay_status:JSON.stringify({v:1, p:{'2026-22':done22.p['2026-22'], '2026-23':{sent:{Carlsbad:'2026-11-02T16:00'}}}})}));
pl=Z2.PH.payAlertPlan(ct(3,9,30));
t('an office that sent is left out', !!pl && pl.sends.length===1 && pl.sends[0].o==='Hobbs');
let Z3=as('admin', Object.assign({}, base, {ph_pay_status:JSON.stringify({v:1, p:{'2026-23':{sent:{}, al:{am:{at:'x', by:'y'}}}}})}));
t('a reminder already sent is not sent again', Z3.PH.payAlertPlan(ct(3,11))===null && !!Z3.PH.payAlertPlan(ct(3,13)));
let Z4=as('admin', Object.assign({}, base, {ph_pay_status:JSON.stringify({v:1, p:{'2026-23':{sent:{}, entered:'2026-11-03T08:00'}}})}));
t('entered: nothing', Z4.PH.payAlertPlan(ct(3,9,30))===null);
t('no senders chosen: nothing', as('admin', {ph_pay_status:JSON.stringify(done22)}).PH.payAlertPlan(ct(3,9,30))===null);

/* ---- THE FIRST PAY PERIOD ON HOME-BRACE (04/11/2026): #24. #23 was done the old way - no "late", no phone. ---- */
REAL_FIRST=true;
{ const F=as('om', base), FA=as('admin', base);
  t('Home-Brace payroll begins with #24', F.ctx.PAYRULES.FIRST==='2026-24');
  t('#23 (done the old way): no bell reminder, never "late"', F.PH.payReminders(at(2,10)).length===0 && F.PH.payReminders(at(5,9)).length===0 && FA.PH.payReminders(at(3,15)).length===0);
  t('...and no phone reminder', FA.PH.payAlertPlan(ct(2,9))===null && FA.PH.payAlertPlan(ct(3,9,30))===null);
  const r24=F.PH.payReminders(at(16,10)), p24=FA.PH.payAlertPlan(ct(17,9,30));
  t('#24: Monday Nov 16 "due Tuesday by 2 pm"', r24.length===1 && /due Tuesday by 2 pm/.test(r24[0].title) && /Pay period #24/.test(r24[0].sub));
  t('...and on phones Tuesday Nov 17, 9:30', !!p24 && p24.key==='2026-24' && p24.slot==='am'); }
REAL_FIRST=false;

(async ()=>{
  /* The claim: two visits at once send it once. A stand-in shared store and alert sender. */
  const shared={ph_pay_status:{v:1, p:{'2026-22':done22.p['2026-22']}}}, sentTo=[];
  const mkStore=()=>({ get:k=>Promise.resolve(shared[k]===undefined?null:JSON.parse(JSON.stringify(shared[k]))),
    update:(k, fn)=>{ const cur=shared[k]===undefined?undefined:JSON.parse(JSON.stringify(shared[k])); const nx=fn(cur);
      if(nx===undefined) return Promise.resolve({unchanged:true, value:cur}); shared[k]=JSON.parse(JSON.stringify(nx)); return Promise.resolve({value:nx}); } });
  const mkAlerts=()=>({ON:true, here:p=>'/v1/'+p, sendTo:(ems, msg)=>{ sentTo.push({ems, title:msg.title, tag:msg.tag}); return Promise.resolve({sent:1}); }});
  const V1=as('admin', base), V2=as('om', base);
  [V1, V2].forEach(v=>{ v.ctx.PH_STORE=mkStore(); v.ctx.PH_ALERTS=mkAlerts(); });
  const r1=await V1.PH.payAlertsTick(ct(3,9,30)), r2=await V2.PH.payAlertsTick(ct(3,9,40));
  t('the first visit after 9 am sends one alert per office still to send', Array.isArray(r1) && r1.length===2 && sentTo.length===2 &&
    sentTo[0].ems.join()==='gabriela@farnsworthorthodontics.com' && sentTo[0].tag==='hb-pay-2026-23-Carlsbad');
  t('the next visit finds it claimed and sends nothing', r2===null && sentTo.length===2);
  t('the claim says when and who, in the shared record', !!shared.ph_pay_status.p['2026-23'].al.am && /farnsworthorthodontics\.com$/.test(shared.ph_pay_status.p['2026-23'].al.am.by));
  const r3=await V2.PH.payAlertsTick(ct(3,13,10));
  t('1 pm is its own reminder', Array.isArray(r3) && sentTo.length===4 && /an hour to go/.test(sentTo[3].title));
  const V3=as('admin', base); V3.ctx.PH_STORE=mkStore(); V3.ctx.PH_ALERTS={ON:false, sendTo:()=>{ sentTo.push('x'); return Promise.resolve({}); }};
  shared.ph_pay_status.p['2026-23'].al={};
  t('alerts not on (the live site until ALERTS_LIVE): nothing is claimed or sent', (await V3.PH.payAlertsTick(ct(3,9,30)))===null && sentTo.length===4 && !shared.ph_pay_status.p['2026-23'].al.am);
  console.log(pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
