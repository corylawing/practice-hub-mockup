/* TC TRACKER · NUMBERS: LOGGED vs ORTHOFI (24/11/2026; Heather + Selene: "a check that catches anything missed, not a
   replacement"; Cory: "put it in the Numbers tab.. but make sure its user friendly").
       node test/tcofcheck.test.js
   Runs tc.html's own functions: both sides count the same patients (kept new-patient exams up to today -> recommended ->
   started), offices total without names, TC names matched the way the live data needs (Becca = Rebecca, a shared
   "Melinda ... Treatment Coordinator" = Melinda Tavarez), anything unmatched kept as its own row. Made-up consults; the
   TC names are the shapes seen on live, no patients. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const TC=require('../v1/tc.js');
const ok=[], bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const H=fs.readFileSync(path.join(__dirname,'..','v1','tc.html'),'utf8');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
const line=n=>{ const i=H.indexOf('  const '+n+'='); return H.slice(i, H.indexOf('\n', i)); };

const W={TC, NOW:'2026-11-23', CONSULTS:[]}; vm.createContext(W);
vm.runInContext('var today=()=>NOW; var scoped=()=>CONSULTS;\n'+line('OF_GONE')+'\n'+line('nf')+'\n'+line('tidyName')+'\n'+line('sum')+'\n'+
  fnOf(H,'ofSpan')+'\n'+fnOf(H,'loggedBy')+'\n'+fnOf(H,'matchNames')+'\n'+fnOf(H,'lineUp')+'\n'+fnOf(H,'demoOf')+
  '\nthis.span=ofSpan; this.logged=loggedBy; this.match=matchNames; this.line=lineUp; this.demo=demoOf;', W);

/* ---- the span ---- */
let sp=W.span('2026-11');
t('this month: from the 1st through today', sp.first==='2026-11-01' && sp.last==='2026-11-23' && sp.open===true);
t('a past month: the whole month (30 / 31 / Feb)', W.span('2026-10').last==='2026-10-31' && W.span('2026-09').last==='2026-09-30' && W.span('2026-02').last==='2026-02-28' && !W.span('2026-10').open);
t('a month still to come: nothing to check', W.span('2026-12')===null);

/* ---- the Tracker's side ---- */
const c=(date, outcome, tc, office)=>({id:Math.random().toString(36).slice(2), office:office||'Hobbs', date, outcome:outcome||'', tc:tc===undefined?'Dana Ruiz':tc});
W.CONSULTS=[c('2026-11-02','Started'), c('2026-11-03','Pending'), c('2026-11-04','Observation'), c('2026-11-05','No Show'), c('2026-11-06','Cancelled'),
  c('2026-11-07','Rescheduled / Cancelled'), c('2026-11-09',''), c('2026-11-10','Refused Treatment'), c('2026-11-24','Started'), c('2026-10-30','Started'),
  c('2026-11-11','Started','Dana  Ruiz '), c('2026-11-12','Pending','', 'Hobbs'), c('2026-11-12','Started','Dana Ruiz','Carlsbad')];
const L=W.logged('Hobbs', sp), D=L['Dana Ruiz'];
t('exams kept = consults in the span, no-shows / cancels / reschedules left out', D.ex===6);
t('a consult with no outcome yet is logged (and counted as still needing one)', D.none===1);
t('recommended = an outcome other than Observation (Refused counts: it was recommended)', D.rec===4);
t('started = outcome Started', D.st===2);
t('days after today and other months are left out', !Object.values(L).some(x=>x.ex>6));
t('a name with extra spaces is the same TC', !L['Dana  Ruiz ']);
t('no TC picked: its own row, said plainly', L['(no TC picked)'] && L['(no TC picked)'].ex===1);
t('another office\'s consults never count here', W.logged('Carlsbad', sp)['Dana Ruiz'].ex===1);

/* ---- names, the shapes seen on live ---- */
const of=['Rebecca Fluhman','Karen Qualls'];
let m=W.match(of, ['Becca Fluhman','Karen Qualls']);
t('nickname, same last name: Becca Fluhman = Rebecca Fluhman', m['Becca Fluhman']==='Rebecca Fluhman' && m['Karen Qualls']==='Karen Qualls');
m=W.match(['Melinda Tavarez'], ['Melinda Angelo Treatment Coordinator','Melinda Tavarez']);
t('a shared login with the TC\'s first name joins her row', m['Melinda Angelo Treatment Coordinator']==='Melinda Tavarez' && m['Melinda Tavarez']==='Melinda Tavarez');
m=W.match(['Noemi Sanchez'], ['Noemi Sanchez Torres']);
t('a longer last name (Sanchez Torres) still finds Noemi Sanchez', m['Noemi Sanchez Torres']==='Noemi Sanchez');
m=W.match(['Elizabeth Reyes','Cory  Lawing'], ['Elizabeth Reyes','Yessenia Romaniz','Carlsbad Treatment Coordinator']);
t('nobody by that name in OrthoFi: no guess', m['Yessenia Romaniz']===null && m['Carlsbad Treatment Coordinator']===null && m['Elizabeth Reyes']==='Elizabeth Reyes');
m=W.match(['Ana Sanchez','Latricia Sanchez'], ['Maria Sanchez']);
t('two OrthoFi TCs share the last name: no guess', m['Maria Sanchez']===null);
m=W.match(['Ana Lopez','Ana Ruiz'], ['Ana B']);
t('two OrthoFi TCs share the first name: no guess', m['Ana B']===null);
t('accents and capitals don\'t matter', W.match(['José Peña'], ['jose pena'])['jose pena']==='José Peña');

/* ---- one office lined up ---- */
const ofBy={'Elizabeth Reyes':{ex:25,rec:18,st:8}, 'Cory  Lawing':{ex:2,rec:2,st:1}, 'Janel Ezernack':{ex:0,rec:0,st:0}};
const trBy={'Elizabeth Reyes':{ex:22,rec:16,st:4,none:4}, 'Yessenia Romaniz':{ex:5,rec:4,st:0,none:0}};
const X=W.line(ofBy, trBy);
t('office totals need no names (Hobbs, November: 27 = 27)', X.o.ex===27 && X.l.ex===27 && X.o.st===9 && X.l.st===4);
t('every OrthoFi TC with exams gets a row; one with none is left out', X.rows.some(r=>r.name==='Cory Lawing') && !X.rows.some(r=>r.name==='Janel Ezernack'));
t('a Tracker name OrthoFi doesn\'t have: its own row, marked', X.rows.some(r=>r.name==='Yessenia Romaniz' && r.only==='tracker' && r.o===null));
t('an OrthoFi TC with nothing logged shows 0 logged', X.rows.find(r=>r.name==='Cory Lawing').l.ex===0);
const Y=W.line({'Melinda Tavarez':{ex:32,rec:28,st:15}}, {'Melinda Angelo Treatment Coordinator':{ex:30,rec:26,st:12,none:0}, 'Melinda Tavarez':{ex:2,rec:2,st:0,none:0}});
t('two Tracker names for one TC are added together and both named ("logged as …")', Y.rows.length===1 && Y.rows[0].l.ex===32 && Y.rows[0].as.join()==='Melinda Angelo Treatment Coordinator');
t('busiest TC first', W.line({'A B':{ex:3,rec:1,st:0}, 'C D':{ex:9,rec:2,st:1}}, {}).rows[0].name==='C D');

/* ---- the sandbox sample ---- */
const d1=JSON.stringify(W.demo('Hobbs', sp)), d2=JSON.stringify(W.demo('Hobbs', sp));
t('sandbox sample: the same numbers every time for a month', d1===d2);
t('sandbox sample: never fewer in OrthoFi than logged (it shows what was missed)', Object.entries(W.demo('Hobbs', sp)).every(([k,v])=>!L[k] || v.ex>=L[k].ex));

/* ---- asking OrthoFi ---- */
const F=fnOf(H,'ofFetch');
t('asks patient-exams by exam date, grouped by TC, for the office\'s own locations', /path:'\/v1\/practice-locations\/patient-exams', locs, params:\{'exam-date-start-date':sp\.first,'exam-date-end-date':sp\.last\}, group:'treatmentCoordinatorName'/.test(F));
t('all three counts are kept NEW-patient exams (same patients on both sides)', /NEW=\{keptExamFlag:\[K\], examTypeName:\['new'\]\}/.test(F) && /\{name:'ex', eq:NEW\}/.test(F) && /Object\.assign\(\{patientExamResultName:\['treatment recommended'\]\}, NEW\)/.test(F) && /Object\.assign\(\{patientExamTreatmentStatusName:\['patient started'\]\}, NEW\)/.test(F));
t('three offices at a time, not all at once', /for\(let k=0;k<3;k\+\+\) lane\(\);/.test(F));
t('an office with no OrthoFi location says so (no ask)', /if\(!locs\.length\)\{ C\.by\[o\]=\{__unmapped:true\}; return; \}/.test(F));
t('not allowed (403): the check stays out of sight', /e\.status===403[^\n]*C\.gone=true/.test(F) && /if\(C\.gone\) return '';/.test(fnOf(H,'ofCheck')));
t('the sandbox never calls OrthoFi', /if\(!LIVE\(\)\)\{ offs\.forEach\(o=>\{ C\.by\[o\]=demoOf\(o, sp\); \}\); return; \}/.test(F));
t('an answer redraws only this card', /ofRedraw\(ym\)/.test(F) && /card\.replaceWith\(fresh\)/.test(fnOf(H,'ofRedraw')));
const K=fnOf(H,'ofCheck');
t('older than 10 minutes: asked again', /Date\.now\(\)-C\.at>10\*60e3/.test(K));
t('couldn\'t reach OrthoFi: says so with Try again (the Tracker\'s numbers still show)', /Couldn’t reach OrthoFi just now/.test(K) && /data-act="ofretry"/.test(K));
t('words, not just numbers: "N not logged" / "N more than OrthoFi" / "All logged"', /not logged<\/span>/.test(K) && /more than OrthoFi<\/span>/.test(K) && /✓ All logged/.test(K));
t('consults still needing an outcome are counted out loud', /still need'\)\+' an outcome\./.test(K));
const U=new Function('x', 'return '+K.match(/const unmarked=x=>(.*);/)[1]);
t('starts missing beyond the unlogged exams = "not marked Started" (Carlsbad: 15 vs 9, exams 45 vs 44 -> up to 5)', U({o:{ex:45,st:15}, l:{ex:44,st:9}})===5);
t('starts missing only because exams weren\'t logged: no "not marked" note', U({o:{ex:28,st:16}, l:{ex:5,st:3}})<=0);
t('the note names how many and says what to do', /marked Started here - check /.test(K));
t('says conversion here is not the private-pay conversion at the top', /won’t equal the private-pay conversion/.test(K));
t('"By TC" boxes remember being open across redraws', /OF_OPEN\[o\]\?' open':''/.test(K) && /details\[data-of\][^\n]*OF_OPEN\[e\.target\.dataset\.of\]=e\.target\.open/.test(H));
t('the Numbers tab shows it right under the top numbers', /h\+=ofCheck\(\);/.test(fnOf(H,'viewNumbers')));
t('orthofi.js is loaded on the page', /<script src="orthofi\.js\?v=hc\d+"><\/script>/.test(H));
t('no patient field is read from OrthoFi (counts only)', !/patientName|firstName|lastName|patientId/.test(F+K));

console.log(ok.length+' passed, '+bad.length+' failed'); bad.forEach(n=>console.log('  FAIL '+n)); process.exit(bad.length?1:0);
