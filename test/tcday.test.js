/* TC TRACKER: ANY DAY, NOT ONLY TODAY (23/11/2026, Selene: "could we view the day? Look up a date to view consults?").
       node test/tcday.test.js
   The Today tab steps a day (‹ ›), jumps to a date (the date box), "Back to today" returns; a consult logged while on a
   day starts on that day; outcome buttons only on today or earlier; "no outcome" warnings only on today. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const TC=require('../v1/tc.js');
const ok=[], bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const H=fs.readFileSync(path.join(__dirname,'..','v1','tc.html'),'utf8');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
const line=n=>{ const i=H.indexOf('  const '+n+'='); return H.slice(i, H.indexOf('\n', i)); };

const W={TC, NOW:'2026-11-23', day:''}; vm.createContext(W);
vm.runInContext('var today=()=>NOW; var MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];\n'+line('fmtS')+'\n'+line('viewDay')+'\n'+line('shiftDay')+'\n'+fnOf(H,'relDay')+
  '\nthis.vd=()=>viewDay(); this.sh=shiftDay; this.rel=relDay;', W);
t('no day picked = today', W.vd()==='2026-11-23');
t('a day before / after, across a month end', W.sh('2026-11-30',1)==='2026-12-01' && W.sh('2026-12-01',-1)==='2026-11-30' && W.sh('2026-12-31',1)==='2027-01-01');
t('labels: Today / Yesterday / Tomorrow / a date', W.rel('2026-11-23')==='Today' && W.rel('2026-11-22')==='Yesterday' && W.rel('2026-11-24')==='Tomorrow' && W.rel('2026-11-30')==='Nov 30');
t('after midnight "today" moves on by itself (day stays empty)', (W.NOW='2026-11-24', W.vd()==='2026-11-24'));

const VT=fnOf(H,'viewToday');
t('Today tab lists the chosen day', /const now=today\(\), d=viewDay\(\), isT=d===now, past=d<=now;/.test(VT) && /scoped\(\)\.filter\(r=>r\.date===d\)/.test(VT));
t('‹ › arrows, a date box and "Back to today"', /data-act="day" data-v="-1"/.test(VT) && /data-act="day" data-v="1"/.test(VT) && /type="date" data-in="day"/.test(VT) && /data-act="day" data-v="0">Back to today/.test(VT));
t('"no outcome yet" warnings only on today', /missing=isT \? scoped\(\)\.filter\(r=>!r\.outcome && r\.date<now\) : \[\]/.test(VT));
t('outcome buttons only on today or earlier', /r\.outcome\|\|!canEdit\(\)\|\|!past \? ocBadge/.test(VT));
t('title says the day', /isT\?'Today’s consults':'Consults on '\+esc\(fmtD\(d\)\)/.test(VT));
t('a consult logged on a day starts on that day', /date:\(tab==='today' && day\) \? day : today\(\)/.test(fnOf(H,'newConsult')));
t('arrows: 0 = back to today, today itself stored as ""', /if\(act==='day'\)\{ const n=Number\(v\); day=n \? shiftDay\(viewDay\(\), n\) : ''; if\(day===today\(\)\) day=''; render\(\); return; \}/.test(H));
t('date box: only a real date moves it', /if\(k==='day'\)\{ if\(TC\.parse\(t\.value\)\)\{ day=t\.value===today\(\) \? '' : t\.value; render\(\); \} return; \}/.test(H));
t('no <input type="month"> anywhere on the page', !/type="month"/.test(H));

console.log(ok.length+' passed, '+bad.length+' failed'); bad.forEach(n=>console.log('  FAIL '+n)); process.exit(bad.length?1:0);
