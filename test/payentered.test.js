/* ENTERED, ONE OFFICE AT A TIME (16/11/2026).
       node test/payentered.test.js

   Heather: "When I submit payroll for an office, can you have a check box or something so I can mark that office as
   completed." She enters each office into the payroll software one after another; "Mark as entered in payroll" locked
   every office at once, offices still to send included. Each office's sheet already kept its own `entered`; now it is
   read per office. Checked in a browser (mock-up and Real version, made-up people): tick, untick, "Mark the rest",
   Reopen, the sender's sheet locking, a reload, phone width. These hold the page to it. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) return ''; const j=H.indexOf('\n  function ', i+10), k=H.indexOf('\n  /* ', i+10); return H.slice(i, Math.min(j<0?1e9:j, k<0?1e9:k)); };

/* The rules, run for real. */
const block=H.slice(H.indexOf('  S.entOff=S.entOff||{};'), H.indexOf('  const enteredCount='));
function rules(o){
  const ctx=Object.assign({ S:{entered:{}, entOff:{}}, LIVEPAY:true, CUR:24, P:n=>({pay:'2026-11-20'}), addDays:(d,n)=>d,
    LEVEL:()=>'manage', myOffices:()=>[], OFFICES:[{k:'hobbs'},{k:'clovis'},{k:'zihua'}] }, o||{});
  vm.createContext(ctx); vm.runInContext(block+'\nthis.entOff=entOff; this.enteredOf=enteredOf;', ctx); return ctx;
}
const A={at:'2026-11-16T10:00', by:'Heather'}, B={at:'2026-11-16T11:30', by:'Heather'};
let r=rules({S:{entered:{}, entOff:{24:{hobbs:A}}}});
t('one office ticked: that office is entered, the pay period isn’t', !!r.entOff(24,'hobbs') && !r.entOff(24,'clovis') && r.enteredOf(24)===null);
r=rules({S:{entered:{}, entOff:{24:{hobbs:A, clovis:B, zihua:A}}}});
t('every office ticked: the pay period is entered, at the latest time', r.enteredOf(24)===B);
r=rules({S:{entered:{}, entOff:{24:{hobbs:A, clovis:null, zihua:A}}}});
t('one reopened: the pay period isn’t entered any more', r.enteredOf(24)===null);
r=rules({LEVEL:()=>'send', myOffices:()=>['clovis'], S:{entered:{}, entOff:{24:{clovis:B}}}});
t('a sender only has their own office: theirs entered = their pay period entered', r.enteredOf(24)===B);
r=rules({LIVEPAY:false, S:{entered:{20:A}, entOff:{}}});
t('the mock-up’s older all-at-once mark still reads as entered for every office', r.entOff(20,'clovis')===A && r.enteredOf(20)===A && r.enteredOf(23)!==null && r.enteredOf(24)===null);
r=rules({LIVEPAY:false, S:{entered:{20:A}, entOff:{20:{clovis:null}}}});
t('…and an office reopened since wins over it', r.entOff(20,'clovis')===null && r.entOff(20,'hobbs')===A);

/* Wiring. */
t('live: each office’s sheet gives its own office’s mark (it used to be the last sheet read for all)',
  /if\(x\.entered!==undefined\) \(S\.entOff\[n\]=S\.entOff\[n\]\|\|\{\}\)\[k\]=x\.entered;/.test(fn('takeSheets')) && !/S\.entered\[n\]=x\.entered/.test(H));
t('a fresh load starts with no marks', /S\.subs=\{\}; S\.entered=\{\}; S\.entOff=\{\};/.test(H));
t('an office’s pill, its sender’s sheet and its "as sent" log follow that office',
  /const s=get\(n,o\), e=entOff\(n,o\), pr=P\(n\);/.test(fn('statusPill')) && /s=get\(n,o\), e=entOff\(n,o\), edit=!e &&/.test(fn('viewOmSheet')) && /const n=per, s=get\(n,v\), e=entOff\(n,v\);/.test(H));
t('the combined sheet: Heather’s columns lock per office; "Fill it in" and "late" per office',
  /on=!entOff\(n,o\.k\) && s\.status==='sent' && !R\(\)\.ro/.test(fn('combined')) && /const oe=entOff\(n,o\.k\), late=!oe && NOW>pr\.dueAt/.test(fn('combined')) && /\(!oe && \(n===CUR \|\| n===NEXT\) && !R\(\)\.ro \?/.test(fn('combined')));
t('the tick: on each office tile and each company on the combined sheet',
  (fn('viewBoard').match(/entTick\(n,o\.k\)/g)||[]).length===2 && /entTick\(n,o\.k\)\+'<\/div><\/td><\/tr>'/.test(fn('combined')));
t('the tick shows once the sheet is in (or to untick) - never on the running pay period or for See-only',
  /if\(n===NEXT \|\| R\(\)\.ro \|\| !OFF\[k\]\) return '';/.test(fn('entTick')) && /if\(!en && get\(n,k\)\.status!=='sent'\) return '';/.test(fn('entTick')) && /role="checkbox" aria-checked=/.test(fn('entTick')));
const act=H.slice(H.indexOf("if(act==='enter' || act==='reopen' || act==='entoff'){"), H.indexOf("if(act==='reload')"));
t('a tick saves that one office’s sheet; "Mark the rest" only the ones not ticked (their times kept); Reopen all',
  /const ks=act==='entoff' \? \(OFF\[v\] \? \[v\] : \[\]\) : OFFICES\.map\(o=>o\.k\)\.filter\(k=>act==='reopen' \|\| !entOff\(n,k\)\);/.test(act) && /ks\.forEach\(k=>liveSheet\(n, k, \{set:\{entered:val\}\}\)\);/.test(act));
t('See-only can’t change it, and nothing shows as saved until SharePoint has it',
  /if\(R\(\)\.ro\) return;/.test(act) && /if\(!okd\)\{ toast\('Not saved — check the connection and try again\.'\); return; \}\n          done\(\);/.test(act));
t('the bell’s "entered" changes only when the whole pay period does',
  /if\(LIVEPAY && PH\.payMark && !!nowAll!==wasAll\) PH\.payMark\(keyOf\(n\), x=>\{ if\(nowAll\) x\.entered=nowAll\.at; else delete x\.entered; \}\)/.test(act));
t('the button says "Mark the rest as entered" once some are ticked', /\(enteredCount\(n\)\?'Mark the rest as entered':'Mark all as entered in payroll'\)/.test(fn('viewBoard')));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
