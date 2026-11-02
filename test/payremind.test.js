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
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'), ctx, {filename:'user.js'});
  return {PH:ctx.PH, LS, ctx};
}


let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const SENDERS=JSON.stringify({offices:{Carlsbad:['gabriela@farnsworthorthodontics.com'], Hobbs:['Quinn@farnsworthorthodontics.com']}});
const as=(who, ls)=>load(Object.assign({ph_viewas:who}, ls||{}));
const at=(d,h,m)=>new Date(2026, 10, d, h, m||0);          // November 2026, local time
const titles=r=>r.map(x=>x.title).join(' | ');

/* Pay period #23: Oct 19 - Nov 1, due Tue Nov 3 by 2 pm, paid Fri Nov 6. #22 is entered (done). */
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
t('Tuesday 2:30 pm, nothing sent: "still waiting on Carlsbad, Hobbs" (only offices with a sender)', r.length===1 && r[0].title==='Payroll #23: still waiting on Carlsbad, Hobbs');
P.PH.payMark('2026-23', x=>{ x.sent.Carlsbad='2026-11-03T10:00'; });
t('...Carlsbad in: still waiting on Hobbs', titles(P.PH.payReminders(at(3,14,30)))==='Payroll #23: still waiting on Hobbs');
P.PH.payMark('2026-23', x=>{ x.sent.Hobbs='2026-11-03T15:00'; });
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

console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
