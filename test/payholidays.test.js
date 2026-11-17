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
t('2026 and 2027 come out exactly as they were typed in (all 12 dates and names)', JSON.stringify(two)===JSON.stringify(TYPED));
t('2028: New Year’s Day is a Saturday -> Friday Dec 31, 2027; Memorial May 29; July 4 (a Tuesday); Labor Sep 4; Thanksgiving Nov 23; Christmas Dec 25 (a Monday)',
  R.holidaysFor(2028).map(h=>h.d).join()==='2027-12-31,2028-05-29,2028-07-04,2028-09-04,2028-11-23,2028-12-25');
t('…and it says which year it’s for ("New Year’s Day 2028")', R.holidaysFor(2028)[0].n==='New Year’s Day 2028');
t('a Sunday holiday is the Monday after (Christmas 2033 -> Mon Dec 26)', R.holidaysFor(2033).find(h=>h.n==='Christmas').d==='2033-12-26');
t('the fourth Thursday and the last Monday land right in any year (2031: Thanksgiving Nov 27, Memorial May 26)',
  R.holidaysFor(2031).find(h=>h.n==='Thanksgiving').d==='2031-11-27' && R.holidaysFor(2031).find(h=>h.n==='Memorial Day').d==='2031-05-26');
const thisY=new Date().getFullYear();
t('the list always reaches two years past today, from 2026, in date order, with no list to keep up to date',
  R.HOLIDAYS[0].d==='2026-01-01' && R.HOLIDAYS.some(h=>h.d.slice(0,4)===String(thisY+2)) && R.HOLIDAYS.every((h,i,a)=>!i || a[i-1].d<=h.d));
t('every pay period up to Dec 2027 finds the same holiday it did before',
  (()=>{ for(let i=-5;i<40;i++){ const a=R.period(i, TYPED), b=R.period(i); if(b.pay>'2027-12-20') break; if(JSON.stringify(a.hol)!==JSON.stringify(b.hol) || a.due!==b.due) return false; } return true; })());

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
  /const holN=PR\.holDates\(pr\.hol\)\.filter\(d=>eligible\(p,d\)\)\.length, hol=!p\.holHrs\?holN\*RATE\.holiday:0, holH=p\.holHrs\?holN\*RATE\.holidayHrs:0;/.test(H));
t('the holiday box says "Both paid" / "1 of 2 paid" when there are two', /'<span class="pill p-done">Both paid<\/span>'/.test(H) && /paidN\+' of '\+hds\.length\+' paid<\/span>'/.test(H));
t('Settings lists this year’s and next year’s holidays (not every year there is) and says how they’re worked out',
  /HOLIDAYS\.filter\(x=>\+x\.d\.slice\(0,4\)>=hy && \+x\.d\.slice\(0,4\)<=hy\+1\)/.test(H) && /a holiday on a Saturday is the Friday before, on a Sunday the Monday after/.test(H));
t('no typed-in holiday list is left in the payroll page', !/\{d:'2026-05-25',n:'Memorial Day'\}/.test(H) && !/\{d:'2026-05-25',n:'Memorial Day'\}/.test(fs.readFileSync(path.join(__dirname,'..','v1','payrules.js'),'utf8')));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
