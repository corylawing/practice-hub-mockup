/* PAID HOLIDAYS, WORKED OUT EVERY YEAR (17/11/2026).
       node test/payholidays.test.js

   The list used to be typed in and stopped at Christmas 2027. Cory: "Everything we build needs to be scalable" ... "be
   very careful we don't mess anything up". So: the rule must give EXACTLY the dates that were typed in for 2026 and
   2027, then keep going; and two holidays in one pay period (Christmas + New Year's Day, December 2028) are both paid.
   Made-up people. */
const fs=require('fs'), path=require('path');
const R=require(path.join(__dirname,'..','v1','payrules.js'));
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };

const TYPED=[{d:'2026-01-01',n:'New Year’s Day'},{d:'2026-05-25',n:'Memorial Day'},{d:'2026-07-03',n:'Independence Day'},
  {d:'2026-09-07',n:'Labor Day'},{d:'2026-11-26',n:'Thanksgiving'},{d:'2026-12-25',n:'Christmas'},
  {d:'2027-01-01',n:'New Year’s Day'},{d:'2027-05-31',n:'Memorial Day'},{d:'2027-07-05',n:'Independence Day'},
  {d:'2027-09-06',n:'Labor Day'},{d:'2027-11-25',n:'Thanksgiving'},{d:'2027-12-24',n:'Christmas'}];
const two=R.holidaysFor(2026).concat(R.holidaysFor(2027));
/* Heather 17/11: "We pay the Holiday no matter what day it falls on ... pay it out on the actual day". */
t('paid on the ACTUAL day: July 4 2026 (a Saturday), July 4 2027 (a Sunday), Christmas 2027 (a Saturday) - the rest as typed',
  two.map(h=>h.d).join()==='2026-01-01,2026-05-25,2026-07-04,2026-09-07,2026-11-26,2026-12-25,2027-01-01,2027-05-31,2027-07-04,2027-09-06,2027-11-25,2027-12-25' &&
  two.map(h=>h.n).join()===TYPED.map(h=>h.n).join());
t('…and each actual day is in the SAME pay period as the date typed before (pay periods run Sunday to Saturday)',
  two.every((h,i)=>{ for(let k=-30;k<80;k++){ const p=R.period(k, []); if(p.start<=TYPED[i].d && p.end>=TYPED[i].d) return p.start<=h.d && p.end>=h.d; } return false; }));
t('2028: New Year’s Day (a Saturday) Jan 1; Memorial May 29; July 4 (a Tuesday); Labor Sep 4; Thanksgiving Nov 23; Christmas Dec 25',
  R.holidaysFor(2028).map(h=>h.d).join()==='2028-01-01,2028-05-29,2028-07-04,2028-09-04,2028-11-23,2028-12-25' && R.holidaysFor(2028)[0].n==='New Year’s Day');
t('a Sunday holiday is paid on the Sunday (Christmas 2033 -> Dec 25)', R.holidaysFor(2033).find(h=>h.n==='Christmas').d==='2033-12-25');
t('the fourth Thursday and the last Monday land right in any year (2031: Thanksgiving Nov 27, Memorial May 26)',
  R.holidaysFor(2031).find(h=>h.n==='Thanksgiving').d==='2031-11-27' && R.holidaysFor(2031).find(h=>h.n==='Memorial Day').d==='2031-05-26');
const thisY=new Date().getFullYear();
t('the list always reaches two years past today, from 2026, in date order, with no list to keep up to date',
  R.HOLIDAYS[0].d==='2026-01-01' && R.HOLIDAYS.some(h=>h.d.slice(0,4)===String(thisY+2)) && R.HOLIDAYS.every((h,i,a)=>!i || a[i-1].d<=h.d));
t('every pay period up to Dec 2027 has the same holiday (by name) and the SAME due day as before',
  (()=>{ for(let i=-5;i<40;i++){ const a=R.period(i, TYPED), b=R.period(i); if(b.pay>'2028-01-05') break; if(((a.hol||{}).n||'')!==((b.hol||{}).n||'') || a.due!==b.due) return false; } return true; })());

// December 2028: Christmas (Mon Dec 25) and New Year's Day 2029 (Mon Jan 1) in one pay period
const ALL=R.holidaysThrough(2029);
let per=null; for(let i=0;i<120 && !per;i++){ const p=R.period(i, ALL); if(p.start<='2028-12-25' && p.end>='2028-12-25') per=p; }
t('December 2028: Christmas and New Year’s Day share a pay period - one entry naming both',
  per && per.hol && per.hol.n==='Christmas + New Year’s Day' && per.hol.ds.join()==='2028-12-25,2029-01-01');
const c=x=>R.calc(x, {}, per, R.RATES, 0, {});
t('…and both are paid: $200 for someone past their 90 days', c({start:'2020-01-01'}).hol===200);
t('…holiday hours instead: 16 hours', c({start:'2020-01-01', holHrs:true}).holH===16 && c({start:'2020-01-01', holHrs:true}).hol===0);
t('…someone whose 90 days end between the two: one of them ($100)', c({start:'2028-09-30'}).hol===100);
t('…someone not there 90 days yet: none', c({start:'2028-12-01'}).hol===0);

t('the payroll page uses the same holidays (the mock-up too) and pays each one in the pay period',
  /let HOLIDAYS=PR\.HOLIDAYS\.slice\(\);/.test(H) && /hol:PR\.holIn\(HOLIDAYS, start, end\)\}/.test(H) &&
  /const holN=PR\.holDates\(pr\.hol\)\.filter\(d=>eligible\(p,d\)\)\.length, hol=!p\.holHrs\?holN\*RT\.holiday:0, holH=p\.holHrs\?holN\*RT\.holidayHrs:0;/.test(H));
t('the holiday box says "Both paid" / "1 of 2 paid" when there are two', /'<span class="pill p-done">Both paid<\/span>'/.test(H) && /paidN\+' of '\+hds\.length\+' paid<\/span>'/.test(H));
t('Settings lists this year’s and next year’s holidays (not every year there is) and says how they’re worked out',
  /const hy=\+TODAY\.slice\(0,4\), inYrs=d=>\+d\.slice\(0,4\)>=hy && \+d\.slice\(0,4\)<=hy\+1/.test(H) && /each one on its actual day, whatever day of the week it falls on/.test(H));

/* Heather can change them (Cory: "give nobody the ability to modify or change things" isn't scalable). */
const U=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8');
let L=R.setHolidayEdits({off:['2026-12-25'], add:[{d:'2026-11-27', n:'Day after Thanksgiving'}]});
t('"not paid this year" takes that one off; a paid day added goes in - the rest still from the rule',
  !L.some(h=>h.d==='2026-12-25') && L.some(h=>h.d==='2026-11-27' && h.n==='Day after Thanksgiving' && h.added) && L.some(h=>h.d==='2027-12-25') && R.HOLIDAYS===L);
let pp=null; for(let i=0;i<20 && !pp;i++){ const p=R.period(i); if(p.start<='2026-11-26' && p.end>='2026-11-27') pp=p; }
t('…pay periods and the "due Monday" weeks follow: Thanksgiving + the day after are both paid that pay period',
  pp && pp.hol && pp.hol.ds && pp.hol.ds.join()==='2026-11-26,2026-11-27' && R.calc({start:'2020-01-01'}, {}, pp, R.RATES, 0, {}).hol===200);
t('junk is ignored (a bad date, a duplicate, a 200-letter name)', (()=>{ const e=R.cleanEdits({off:['x','2026-12-25','2026-12-25'], add:[{d:'nope'},{d:'2026-11-27',n:'a'.repeat(200)},{d:'2026-11-27',n:'twice'}]});
  return e.off.join()==='2026-12-25' && e.add.length===1 && e.add[0].n.length===60; })());
R.setHolidayEdits(null);
t('no changes = the rule exactly', JSON.stringify(R.HOLIDAYS)===JSON.stringify(R.holidaysThrough(new Date().getFullYear()+2)));
t('kept in the shared list "ph_pay_holidays" (dates and names only) so every sheet and reminder follows',
  R.HOL_KEY==='ph_pay_holidays' && /loadHolEdits\(\),/.test(H) && /\.then\(\(\[perOffice, , , , hers\]\)=>/.test(H) && /PH_STORE\.get\('ph_pay_holidays'\)/.test(U) && /r\[0\]\.setHolidayEdits\(r\[2\]\)/.test(U));
t('only whoever manages payroll can change them, and only from the first pay period not entered yet - paid ones stay as they were',
  /const holCan=\(\)=>!R\(\)\.ro && \(!LIVEPAY \|\| LEVEL\(\)==='manage'\);/.test(H) && /const holFrom=\(\)=>P\(enteredCount\(CUR\) \? NEXT : CUR\)\.start;/.test(H) &&
  /\(can && x\.d>=from \?/.test(H) && /if\(!holCan\(\)\) return;/.test(H) && /if\(d<from\)\{ toast\('That pay period is already done/.test(H));
t('a save that doesn’t reach SharePoint changes nothing and says so', /e=>toast\('Not saved - '\+\(\(e && e\.message\) \|\| 'check the connection'\)\+'\. Nothing changed\.'\)/.test(H));
t('the old "holidays in settings" override is gone (one place for them)', !/st\.holidays/.test(H));
t('no typed-in holiday list is left in the payroll page', !/\{d:'2026-05-25',n:'Memorial Day'\}/.test(H) && !/\{d:'2026-05-25',n:'Memorial Day'\}/.test(fs.readFileSync(path.join(__dirname,'..','v1','payrules.js'),'utf8')));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
