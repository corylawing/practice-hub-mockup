/* ADMIN -> USAGE (10/11/2026): the adoption sums (v1/usage.js _pure). Made-up people only. Run: node test/usage.test.js */
const fs=require('fs'), path=require('path'), vm=require('vm');
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','v1','usage.js'),'utf8'), ctx);
const U=ctx.PH_USAGE._pure, TODAY='2026-11-10';

/* Periods */
{
  const p=k=>{ const x=U.period(k, TODAY); return x.from+'..'+x.to; };
  t('Today', p('today')==='2026-11-10..2026-11-10');
  t('7 days = today and the 6 before', p('7d')==='2026-11-04..2026-11-10');
  t('30 days', p('30d')==='2026-10-12..2026-11-10');
  t('This month', p('month')==='2026-11-01..2026-11-10');
  t('Last month', p('last')==='2026-10-01..2026-10-31');
  t('Last month in January = December', U.period('last','2027-01-05').from==='2026-12-01' && U.period('last','2027-01-05').to==='2026-12-31');
  t('Days in a period', U.daysIn('2026-10-30','2026-11-02').join(',')==='2026-10-30,2026-10-31,2026-11-01,2026-11-02');
}
/* Matching visits to the team list */
const roster=[
  {name:'Quinn Quill', email:'quinn.quill@farnsworthorthodontics.com', offices:['Carlsbad'], teams:['TCs']},
  {name:'Morgan Hale', empId:'E7', offices:['Hobbs'], teams:['Office Managers']},              // no email on the list
  {name:'Riley "Ri" Chen', offices:['Hobbs'], teams:['Staff']},                               // no email, a nickname
  {name:'Priya Tatum', email:'priya.tatum@farnsworthorthodontics.com', offices:[], teams:['Admin']},
  {name:'Avery Brooks', email:'avery.brooks@farnsworthorthodontics.com', offices:['Carlsbad'], teams:['Staff']},
  {name:'Gone Person', email:'gone@farnsworthorthodontics.com', offices:['Carlsbad'], teams:['Staff'], status:'Inactive'}
];
const rec=(email, name, days, extra)=>Object.assign({v:1, email, name, first:'2026-11-01T15:00:00Z', last:days.length?days[days.length-1]+'T16:00:00Z':'', d:Object.fromEntries(days.map(d=>[d,{n:2, p:{home:1, payroll:1}}]))}, extra||{});
const recs=[
  rec('quinn.quill@farnsworthorthodontics.com','Quinn Quill',['2026-11-08','2026-11-10']),
  rec('morgan.hale@farnsworthorthodontics.com','Morgan Hale',['2026-11-09'], {rk:'emp:e7'}),
  rec('riley.chen@farnsworthorthodontics.com','Riley Chen',['2026-10-20']),
  rec('priya.tatum@farnsworthorthodontics.com','Priya Tatum',['2026-11-10'], {admin:true}),
  rec('visitor@farnsworthorthodontics.com','Vic Visitor',['2026-11-10']),
  {junk:true}, null, 7
];
{
  const L=U.people(roster, roster, recs);
  const f=n=>L.find(x=>x.name===n);
  t('By email', f('Quinn Quill').rec && f('Quinn Quill').rec.email==='quinn.quill@farnsworthorthodontics.com');
  t('By the key sign-in found them under (no email on the list)', f('Morgan Hale').rec && f('Morgan Hale').rec.rk==='emp:e7');
  t('By name, nickname in quotes ignored', f('Riley "Ri" Chen').rec && f('Riley "Ri" Chen').rec.name==='Riley Chen');
  t('No visits = no record', f('Avery Brooks').rec===null);
  t('Someone not on the team list comes back as an extra', L.some(x=>x.name==='Vic Visitor' && !x.listed));
  t('Inactive people and junk records are left out', !L.some(x=>x.name==='Gone Person') && L.length===6);
  t('Admins are known by team, or by their record', f('Priya Tatum').admin===true);
}
/* The sums */
{
  const L=U.people(roster, roster, recs);
  const S=U.summary(L, {kind:'7d', today:TODAY, includeAdmins:false, offices:['Carlsbad','Hobbs','Clovis']});
  t('Adoption leaves admins out: Quinn + Morgan of Quinn, Morgan, Riley, Avery = 50%', S.total===4 && S.active===2 && S.adoption===0.5);
  t('Using it today: Quinn (Priya is an admin, Vic is not on the list)', S.today===1);
  t('Days used: (2 + 1) / 2 = 1.5', S.avgDays===1.5);
  t('Never signed in: Avery only (Riley came in October)', S.never===1);
  t('States: using / quiet / never', S.rows.find(x=>x.name==='Quinn Quill').state==='using' && S.rows.find(x=>x.name==='Riley "Ri" Chen').state==='quiet' && S.rows.find(x=>x.name==='Avery Brooks').state==='never');
  t('People each day across the period', S.perDay.length===7 && S.perDay.find(x=>x.d==='2026-11-10').n===2 && S.perDay.find(x=>x.d==='2026-11-09').n===1);
  t('By office: Hobbs 1 of 2, Carlsbad 1 of 2; Clovis (nobody listed) left out', S.byOffice.length===2 && S.byOffice.every(r=>r.total===2 && r.active===1));
  t('Sections: people who opened each', S.bySection.find(r=>r.k==='payroll').n===3);
  const A=U.summary(L, {kind:'7d', today:TODAY, includeAdmins:true});
  t('Include admins: Priya counts too', A.total===5 && A.active===3 && A.today===2);
  const T=U.summary(L, {kind:'today', today:TODAY, includeAdmins:false});
  t('Today: the chart still shows the last 7 days', T.days===1 && T.perDay.length===7);
  t('Counting since the first visit anyone made', S.firstEver==='2026-11-01T15:00:00Z');
  const E=U.summary(U.people(roster, roster, []), {kind:'30d', today:TODAY, includeAdmins:false});
  t('Nothing recorded yet: 0%, no averages, everyone never', E.adoption===0 && E.avgDays===null && E.never===4 && E.firstEver==='');
}
/* What is recorded (user.js) */
{
  const src=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8'), i=src.indexOf('function useTick'), body=src.slice(i, src.indexOf('let USAGE_P', i));
  t('A visit records who, which section and which day - nothing typed or seen', /dd\.p\[sec\]/.test(body) && !/value|innerText|textContent/.test(body));
  t('Never while an admin is viewing as someone', /impersonating\(\) && isAdmin\(realMe\(\)\)\) return/.test(body));
  t('At most once per section per 30 minutes on a device', /USE_GAP=30\*60e3/.test(src) && /ph_usegate_/.test(body));
  t('Kept to about 13 months, and allowed to shrink', /days\.length>400/.test(body) && /'ph_use_'\]/.test(fs.readFileSync(path.join(__dirname,'..','v1','store.js'),'utf8')));
}
/* Not tracked: someone who switched their own recording off is never in any number */
{
  const off=recs.map(r=>r && r.email==='quinn.quill@farnsworthorthodontics.com' ? {v:1, email:r.email, off:true, d:{}} : r);
  const L=U.people(roster, roster, off);
  t('switched off: gone from the list (not even "Never signed in")', !L.some(x=>x.name==='Quinn Quill'));
  const S=U.summary(L, {kind:'7d', today:TODAY, includeAdmins:true});
  t('...and from every number, even with Include admins', S.total===4 && S.today===1 && !S.rows.some(x=>x.name==='Quinn Quill'));
  const X=U.people(roster, roster, recs.concat([{v:1, email:'pat.off@elsewhere.com', name:'Pat Off', off:true, d:{}}]));
  t('switched off and not on the team list: not an extra either', !X.some(x=>x.name==='Pat Off'));
  const src=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8');
  t('a switched-off record is never written to by a visit', /if\(cur && cur\.off\) return undefined;/.test(src.slice(src.indexOf('function useTick'))));
  t('switching off clears the visits so far', /return \{v:1, email:em, off:true, d:\{\}\};/.test(src));
}
console.log(pass+' passed, '+fail+' failed'); if(fail) process.exit(1);
