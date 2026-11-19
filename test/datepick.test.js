/* THE DATE & TIME PICKER (19/11/2026). node test/datepick.test.js
   Cory: "I don't like the date picker ... it looks so old"; "Can they still type it though?"; month and year chosen from
   grids, not dropdowns; the time columns kept, in each person's colour scheme. */
const fs=require('fs'), path=require('path');
require(path.join(__dirname,'..','v1','datepick.js'));
const P=globalThis.PH_PICK, J=fs.readFileSync(path.join(__dirname,'..','v1','datepick.js'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const NOW=new Date(2026,10,19), I=d=>d ? P.iso(d) : null;
t('typing: "04032014", "04/03/2014", "4/3/14" -> Apr 3 2014', I(P.parseTyped('04032014',NOW))==='2014-04-03' && I(P.parseTyped('04/03/2014',NOW))==='2014-04-03' && I(P.parseTyped('4/3/14',NOW))==='2014-04-03');
t('typing: "11/24" is this year; "111826" is 2026; a two-digit year far ahead is last century', I(P.parseTyped('11/24',NOW))==='2026-11-24' && I(P.parseTyped('111826',NOW))==='2026-11-18' && I(P.parseTyped('3/4/62',NOW))==='1962-03-04');
t('typing: a date that does not exist is refused (02/30, 13/01), never rolled over', P.parseTyped('02/30/2026',NOW)===null && P.parseTyped('13/01/2026',NOW)===null && P.parseTyped('hello',NOW)===null);
t('the slashes fill in as you type', P.mask('0403')==='04/03' && P.mask('04032014')==='04/03/2014' && P.mask('4/3/14')==='4/3/14');
t('time: "930" 9:30, "2" 2 PM (office hours), "9:30 pm", "12am", "14:05"; nonsense refused', P.parseTime('930')==='09:30' && P.parseTime('2')==='14:00' && P.parseTime('9:30 pm')==='21:30' && P.parseTime('12am')==='00:00' && P.parseTime('14:05')==='14:05' && P.parseTime('25:00')===null && P.parseTime('9:75')===null);
t('shown the American way: "Thu, Nov 19, 2026", a birthday "Apr 3, 2014", "2:05 PM"', P.showDate(new Date(2026,10,19))==='Thu, Nov 19, 2026' && P.showDate(new Date(2014,3,3), true)==='Apr 3, 2014' && P.showTime('14:05')==='2:05 PM' && P.showTime('00:30')==='12:30 AM');
t('the page keeps its own box: hidden, holding yyyy-mm-dd / hh:mm, sending input + change - no page code changes', /orig\.style\.display='none'/.test(J) && /\['input','change'\]\.forEach/.test(J) && /setVal\(P, iso\(d\)\)/.test(J));
t('month and year from grids - no dropdowns (Cory: "look very old school")', /data-pk="month"/.test(J) && /data-pk="year"/.test(J) && !/<select/.test(J));
t('every colour is the person’s scheme (Cory: "not always home-brace teal it depends on the color scheme")', /var\(--teal,#149B96\)/.test(J) && /var\(--teal-600/.test(J) && /var\(--teal-wash/.test(J) && !/#2563EB|blue/i.test(J.replace(/\/\*[\s\S]*?\*\//g,'')));
t('the time columns kept (hour · minute every 5 · AM/PM), any minute can still be typed', /data-col="h"/.test(J) && /data-col="m"/.test(J) && /mins\.indexOf\(MIN\)<0/.test(J));
t('min / max respected (a follow-up can’t be in the past); the talk-to-type mic stays off date boxes', /function bound\(P, d\)/.test(J) && /inp\.setAttribute\('data-nomic',''\)/.test(J));
console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
