/* PAYROLL - THE RULES (v1/payrules.js).
       node test/payrules.test.js

   01/11/2026, Heather: "We can go live with the payroll sheet." Her pay periods (anchored on her sheet: #20 paid Sept
   25, 2026), her due day (Tuesday 2 pm; Monday when a holiday falls later that week), her sums, and who may open which
   payroll folder. Made-up people only. */
const R=require('../v1/payrules.js');
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };

/* ---- pay periods, from her sheet ---- */
const p20=R.period(0), p22=R.period(2);
t('#20 of 2026 was paid Sept 25 - her own sheet', p20.key==='2026-20' && p20.pay==='2026-09-25' && p20.n===20);
t('#20 ran Sun Sept 6 - Sat Sept 19, Labor Day in it', p20.start==='2026-09-06' && p20.end==='2026-09-19' && p20.hol && p20.hol.n==='Labor Day');
t('...and was due Tue Sept 22 (a Monday holiday never moves it)', p20.due==='2026-09-22' && !p20.dueHol);
t('#22: Oct 4-17, due Tue Oct 20 by 2 pm, paid Fri Oct 23 (the mock-up’s)', p22.start==='2026-10-04' && p22.end==='2026-10-17' && p22.dueAt==='2026-10-20T14:00' && p22.pay==='2026-10-23');
t('week 1 / week 2', p22.w1end==='2026-10-10' && p22.w2start==='2026-10-11');
const p24=R.period(4);
t('#24 is Sun Nov 1 - Sat Nov 14 (Heather 03/11), due Tue Nov 17, paid Fri Nov 20', p24.key==='2026-24' && p24.start==='2026-11-01' && p24.end==='2026-11-14' && p24.due==='2026-11-17' && p24.pay==='2026-11-20');
t('every period starts on a Sunday and ends on a Saturday', [-30,-1,0,4,7,20,40].every(i=>R.dow(R.period(i).start)===0 && R.dow(R.period(i).end)===6));
t('#1 of 2026 was paid Jan 2', R.numberOf('2026-01-02')===1);
t('the last of 2026 is #26, paid Dec 18', R.numberOf('2026-12-18')===26);
const ny=R.period(7);
t('2027 starts again at #1 (paid Jan 1, 2027)', ny.key==='2027-01' && ny.pay==='2027-01-01');
t('New Year’s Day that Friday: due MONDAY Dec 28 (a holiday later that week)', ny.due==='2026-12-28' && ny.dueHol && ny.dueHol.n==='New Year’s Day');
t('...and Christmas is in that period', ny.hol && ny.hol.n==='Christmas');
t('every period is 14 days, back to back', [0,1,2,3,4,5,6,7,8].every(i=>R.days(R.period(i).start, R.period(i).end)===13 && R.days(R.period(i).end, R.period(i+1).start)===1));
t('earlier periods work too (#19 paid Sept 11)', R.period(-1).key==='2026-19' && R.period(-1).pay==='2026-09-11');
t('a period found again from its key', R.indexOfKey('2026-22')===2 && R.indexOfKey('2027-01')===7 && R.indexOfKey('nonsense')===null);

/* ---- which sheet is being filled in today ---- */
t('the day after #22 ends, #22 is the one being filled in', R.currentIndex('2026-10-18')===2);
t('its due day too', R.currentIndex('2026-10-20')===2);
t('on its last day it hasn’t ended yet: still #21', R.currentIndex('2026-10-17')===1);
t('two weeks on, #23', R.currentIndex('2026-11-01')===3 && R.currentIndex('2026-11-03')===3 && R.currentIndex('2026-11-14')===3 && R.currentIndex('2026-11-15')===4);
t('a workday before Monday is Friday', R.workdayBefore('2026-12-28')==='2026-12-25' && R.workdayBefore('2026-10-20')==='2026-10-19');

/* ---- the sums ---- */
const per=R.period(2), hol={...per, hol:{d:'2026-10-12', n:'Test holiday'}};
const c=R.calc({start:'2020-01-01'}, {w1:42, w2:38, bonus:'partial', cut:10, cutBy:'pct', oncall:1, mkt:50, oth:10, exc:75, phone:25}, hol, R.RATES, 150, {goal:50, tcom:100, extra:20});
t('overtime by week', c.ot1===2 && c.ot2===0 && c.reg===78);
t('partial bonus: 10% off 150', c.ppb===135);
t('holiday pay after the 90-day review', c.hol===100);
t('on call $50 a weekend', c.oc===50);
t('mileage at the IRS rate, kept out of Total', c.reimb===45.6);
t('Extra = her special bonus + exception commuter pay', c.extra===95);
t('Total = PP bonus + Goal + TC/OM + holiday + on call + own + Extra', c.total===135+50+100+100+50+25+95);
t('a $ cut comes off the bonus', R.calc({}, {bonus:'partial', cut:25, cutBy:'usd'}, per, R.RATES, 150).ppb===125);
t('no bonus', R.calc({}, {bonus:'none'}, per, R.RATES, 150).ppb===0);
t('new hire: no holiday pay before 90 days', R.calc({start:'2026-09-01'}, {}, hol, R.RATES, 0).hol===0);
t('holiday HOURS instead of pay for the one who gets them', (x=>x.hol===0 && x.holH===8)(R.calc({start:'2020-01-01', holHrs:true}, {}, hol, R.RATES, 0)));

/* ---- who may open which folder ---- */
const B='Home-Brace Payroll';
const roster=[{name:'Pat Manager', email:'Pat@x.test', teams:['Admin']}, {name:'Lee Viewer', email:'lee@x.test', teams:['Doctors']},
              {name:'Kim Sender', email:'kim@x.test', teams:['Office Managers']}, {name:'No Mail', email:'', teams:['Admin']}];
const roleOf=teams=>teams.indexOf('Admin')>=0 ? 'write' : teams.indexOf('Doctors')>=0 ? 'read' : '';
const w=R.wanted(B, roster, roleOf, {'Hobbs':['KIM@x.test'], 'Atlantis':['kim@x.test']});
t('a manager gets the payroll folder and every office’s', w.want[B]['pat@x.test']==='write' && R.OFFICES.every(o=>w.want[B+'/'+o.n]['pat@x.test']==='write'));
t('"sees everything" reads them all, no more', w.want[B]['lee@x.test']==='read' && w.want[B+'/Carlsbad']['lee@x.test']==='read');
t('a sender gets their own office’s folder - nothing else', w.want[B+'/Hobbs']['kim@x.test']==='write' && !w.want[B]['kim@x.test'] && !w.want[B+'/Carlsbad']['kim@x.test']);
t('an office payroll doesn’t have gives nothing', !w.want[B+'/Atlantis']);
t('Heather’s folder is never handed out', !Object.keys(w.want).some(k=>/Heather$/.test(k)));
t('someone with no email is listed, not given', w.noEmail.join()==='No Mail');
t('every office has a folder entry (so a take-back still happens when the last person goes)', R.OFFICES.every(o=>w.want[B+'/'+o.n]));
t('the offices are her sheet’s, in its order - Zihua Partners after San Angelo (03/11)', R.OFFICES.map(o=>o.n).join()==='Carlsbad,Hobbs,Lubbock,Clovis,San Angelo,Zihua Partners,Mansfield,Cruces FFO,Cruces LCO');
t('Zihua Partners: nobody sends it - Heather fills it in', R.OFF.zihua.self===true && R.OFFICES.filter(o=>o.self).length===1);
{ const w2=R.wanted(B, roster, roleOf, {'Carlsbad':['kim@x.test'], 'Zihua Partners':['kim@x.test']});
  t('Zihua Partners’ folder: whoever manages payroll, never a sender', w2.want[B+'/Zihua Partners'] && w2.want[B+'/Zihua Partners']['pat@x.test']==='write' && !w2.want[B+'/Zihua Partners']['kim@x.test'] && w2.want[B+'/Carlsbad']['kim@x.test']==='write'); }
t('payroll.html lists the same offices, in the same order', (src=>{ const m=src.slice(src.indexOf('const OFFICES=['), src.indexOf('];', src.indexOf('const OFFICES=[')));
  return R.OFFICES.every((o,i,a)=>m.indexOf("k:'"+o.k+"'")>=0 && (i===0 || m.indexOf("k:'"+a[i-1].k+"'")<m.indexOf("k:'"+o.k+"'"))); })(require('fs').readFileSync(require('path').join(__dirname,'..','v1','payroll.html'),'utf8')));

console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
