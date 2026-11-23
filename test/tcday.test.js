/* TC TRACKER: ANY DAY, NOT ONLY TODAY (23/11/2026, Selene: "could we view the day? Look up a date to view consults?").
       node test/tcday.test.js
   The Today tab: a week strip (each day's consult count, tap to see it), ‹ › a week, the week's name opens a month
   calendar with counts, "Today" returns, ← → step a day; a consult logged on a day starts on that day; outcome buttons
   only on today or earlier; "no outcome" warnings only on today. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const TC=require('../v1/tc.js');
const ok=[], bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const H=fs.readFileSync(path.join(__dirname,'..','v1','tc.html'),'utf8');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
const line=n=>{ const i=H.indexOf('  const '+n+'='); return H.slice(i, H.indexOf('\n', i)); };

const W={TC, NOW:'2026-11-23', day:''}; vm.createContext(W);
vm.runInContext('var today=()=>NOW;\n'+line('viewDay')+'\n'+line('shiftDay')+'\n'+line('weekStart')+'\nthis.vd=()=>viewDay(); this.sh=shiftDay; this.ws=weekStart;', W);
t('no day picked = today', W.vd()==='2026-11-23');
t('a day before / after, across a month end', W.sh('2026-11-30',1)==='2026-12-01' && W.sh('2026-12-01',-1)==='2026-11-30' && W.sh('2026-12-31',1)==='2027-01-01');
t('a week starts on Monday (Sun 29 -> Mon 23; Mon stays; across a month)', W.ws('2026-11-29')==='2026-11-23' && W.ws('2026-11-23')==='2026-11-23' && W.ws('2026-12-02')==='2026-11-30');
t('after midnight "today" moves on by itself (day stays empty)', (W.NOW='2026-11-24', W.vd()==='2026-11-24'));

const VT=fnOf(H,'viewToday');
t('Today tab lists the chosen day', /const now=today\(\), d=viewDay\(\), isT=d===now, past=d<=now;/.test(VT) && /scoped\(\)\.filter\(r=>r\.date===d\)/.test(VT));
const DB=fnOf(H,'dayBar'), CP=fnOf(H,'calPop'), CH=fnOf(H,'chip');
t('the Today tab draws the week strip', /h\+=dayBar\(d\);/.test(VT));
t('week strip: ‹ › a week, the week name opens the calendar, Today when away', /data-act="week" data-v="-1"/.test(DB) && /data-act="week" data-v="1"/.test(DB) && /data-act="cal"/.test(DB) && /\(d===now\?'':'<button[^']*data-act="goday" data-v="'\+esc\(now\)\+'">Today<\/button>'\)/.test(DB));
t('weekend days only when they have consults or are picked', /if\(i>=5 && s!==d && !countOn\(s\)\) continue;/.test(DB));
t('each day says its count (or Closed), tap = that day, read aloud with the count', /attr\('act','goday'\)\+attr\('v',s\)/.test(CH) && /aria-label="'\+esc\(fmtD\(s\)\+' - '\+\(n\?n\+' consult'/.test(CH) && /'Closed'/.test(CH));
t('month calendar: every day of the month, Monday first, ‹ › months', /for\(let k=1;k<=last;k\+\+\) cells\+=chip\(/.test(CP) && /\['Mon','Tue','Wed','Thu','Fri','Sat','Sun'\]/.test(CP) && /data-act="calm" data-v="-1"/.test(CP));
t('picking a day closes the calendar', /if\(act==='goday'\)\{ if\(TC\.parse\(v\)\)\{ day=v===today\(\) \? '' : v; calOpen=false; render\(\); \} return; \}/.test(H));
t('Esc or a click outside closes the calendar', /e\.key==='Escape' && calOpen/.test(H) && /if\(calOpen && !e\.target\.closest\('\.calpop, \.wklabel'\)\)/.test(H));
t('← → step a day - not while typing or in a form', /!DLG && !typing && tab==='today'[^\n]*ArrowLeft/.test(H));
t('"no outcome yet" warnings only on today', /missing=isT \? scoped\(\)\.filter\(r=>!r\.outcome && r\.date<now\) : \[\]/.test(VT));
t('outcome buttons only on today or earlier', /r\.outcome\|\|!canEdit\(\)\|\|!past \? ocBadge/.test(VT));
t('title says the day', /isT\?'Today’s consults':'Consults on '\+esc\(fmtD\(d\)\)/.test(VT));
t('a consult logged on a day starts on that day', /date:\(tab==='today' && day\) \? day : today\(\)/.test(fnOf(H,'newConsult')));
t('arrows: 0 = back to today, today itself stored as ""', /if\(act==='day'\)\{ const n=Number\(v\); day=n \? shiftDay\(viewDay\(\), n\) : ''; if\(day===today\(\)\) day=''; render\(\); return; \}/.test(H));
t('no plain date box on the Today tab (the calendar replaces it)', !/data-in="day"/.test(H));
t('no <input type="month"> anywhere on the page', !/type="month"/.test(H));

console.log(ok.length+' passed, '+bad.length+' failed'); bad.forEach(n=>console.log('  FAIL '+n)); process.exit(bad.length?1:0);
