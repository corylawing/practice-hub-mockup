/* PAYROLL: ALL ENTERED -> ON TO THE NEXT ONE (24/11/2026).
       node test/paynext.test.js
   Heather: "this payroll still shows as the last on this screen. Once I have clicked on submitted all payroll can it
   automatically scroll to the next one?" Once every sheet of the pay period being sent is entered (an office manager:
   their own), Payroll opens on the one in progress; ticking the last office moves there itself; a green note says so
   with "Back to #N"; the dropdown lists the one in progress while she's on it. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
const block=H.slice(H.indexOf('  S.entOff=S.entOff||{};'), H.indexOf('  const enteredCount='));
const homeLine=H.slice(H.indexOf('  const HOME=()=>'), H.indexOf('\n', H.indexOf('  const HOME=()=>')));
function page(o){
  const ctx=Object.assign({ S:{entered:{}, entOff:{}}, LIVEPAY:true, CUR:24, NEXT:25, BEFORE:false, per:24, P:n=>({pay:'2026-11-20'}), addDays:(d,n)=>d,
    LEVEL:()=>'manage', myOffices:()=>[], OFFICES:[{k:'hobbs'},{k:'clovis'},{k:'lubbock'}], kind:'admin',
    esc:s=>String(s), lab:n=>'#'+n }, o||{});
  vm.createContext(ctx);
  vm.runInContext(block+'\n'+homeLine+'\nfunction R(){ return {kind:kind}; }\n'+fnOf(H,'allEnteredNote')+'\nthis.HOME=HOME; this.note=()=>allEnteredNote(); this.setPer=v=>{ per=v; };', ctx);
  return ctx;
}
const A={at:'2026-11-24T08:30', by:'Heather'};
let p=page();
t('nothing entered: opens on the pay period being sent (#24)', p.HOME()===24);
p=page({S:{entered:{}, entOff:{24:{hobbs:A, clovis:A}}}});
t('two of three entered: still #24', p.HOME()===24);
p=page({S:{entered:{}, entOff:{24:{hobbs:A, clovis:A, lubbock:A}}}});
t('every office entered: opens on the one in progress (#25)', p.HOME()===25);
p=page({S:{entered:{24:A}, entOff:{}}});
t('entered all at once (older mark): also #25', p.HOME()===25);
p=page({S:{entered:{}, entOff:{24:{hobbs:A, clovis:null, lubbock:A}}}});
t('one reopened: back to #24', p.HOME()===24);
p=page({LEVEL:()=>'send', myOffices:()=>['clovis'], kind:'om', S:{entered:{}, entOff:{24:{clovis:A}}}});
t('an office manager: their own sheet entered -> #25', p.HOME()===25);
p=page({BEFORE:true});
t('before Home-Brace payroll began: the one in progress, as before', p.HOME()===25);
p=page({LEVEL:()=>{ throw new Error('not ready'); }});
t('anything not ready yet: #24, never an error', p.HOME()===24);

p=page({S:{entered:{}, entOff:{24:{hobbs:A, clovis:A, lubbock:A}}}, per:25});
t('on #25 with #24 all entered: the green note, with Back to #24', /#24 is all<\/b>|#24 is all entered/.test(p.note()) && /data-act="open" data-v="24">Back to #24/.test(p.note()) && /Here’s #25, in progress/.test(p.note()));
p.setPer(24);
t('looking at #24 itself: no note', p.note()==='');
p=page({S:{entered:{}, entOff:{24:{hobbs:A}}}, per:25});
t('on #25 but #24 not all entered: no note', p.note()==='');
p=page({LEVEL:()=>'send', myOffices:()=>['clovis'], kind:'om', S:{entered:{}, entOff:{24:{clovis:A}}}, per:25});
t('an office manager\'s note speaks of their sheet and goes back their way', /Your #24 sheet is/.test(p.note()) && /data-act="omopen" data-v="24"/.test(p.note()));

const AC=H.slice(H.indexOf("if(act==='enter' || act==='reopen' || act==='entoff'){"), H.indexOf("if(act==='enter' || act==='reopen' || act==='entoff'){")+3000);
t('ticking the last office: moves on to the one in progress after a moment, scrolled to the top', /if\(val && !wasAll && nowAll && n===CUR && !BEFORE\) setTimeout\(\(\)=>\{ if\(per!==n \|\| tab!=='sheet'\) return; per=NEXT; render\(\); window\.scrollTo\(\{top:0, behavior:'smooth'\}\); \}, 900\);/.test(AC));
t('only once it has saved (inside done, after the save is confirmed)', AC.indexOf('setTimeout(()=>{ if(per!==n')>AC.indexOf('const done=()=>{') && AC.indexOf('liveFlushAll().then(okd=>{')>AC.indexOf('const done=()=>{'));
t('the note sits on top of the sheet tab', /if\(tab==='sheet'\) el\('view'\)\.insertAdjacentHTML\('afterbegin', allEnteredNote\(\)\);/.test(H));
t('Heather\'s dropdown lists the one in progress while she is there', /periodPicker\('perpick', per===NEXT \|\| !!enteredOf\(CUR\)\)/.test(H));

console.log(ok.length+' passed, '+bad.length+' failed'); bad.forEach(n=>console.log('  FAIL '+n)); process.exit(bad.length?1:0);
