/* CODE REVIEW FIXES (21/11/2026). Payroll is live for staff; the owner: "Nothing can break that's important."
       node test/codereview-pay.test.js

   Each fix runs the page's own code where it can (functions cut out of the page and run on made-up people and
   sheets), and checks the wiring where it can't. Made-up names only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const PR=require(path.join(__dirname,'..','v1','payrules.js'));
const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const H=read('payroll.html'), A=read('admin.html'), T=read('team.html');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fnIn=(S,name)=>{ const i=S.indexOf('function '+name+'('); if(i<0) return ''; let d=0; const j=S.indexOf('{', i);
  for(let k=j;k<S.length;k++){ if(S[k]==='{') d++; else if(S[k]==='}'){ d--; if(!d) return S.slice(i, k+1); } } return ''; };
const fn=name=>fnIn(H,name);
const lineIn=(S,re)=>{ const m=S.match(re); if(!m) throw new Error('missing '+re); return m[0]; };
const line=re=>lineIn(H,re);
const noPopups=s=>!/\b(alert|confirm|prompt)\(/.test(s);

/* ---------- 1. Holiday pay once, on the home row (like the one bonus) ---------- */
{
  const src=[line(/const num=[^\n]*/), line(/const r2=[^\n]*/), line(/const cutVal=[^\n]*/), line(/const cutBy=[^\n]*/), line(/const otOK=[^\n]*/),
    line(/const MERGE_KEEP=[^\n]*/), fn('calc'), fn('mergeX'), fn('oneBonus'), fn('entryCalc'), fn('histList')].join('\n');
  const OFFICES=PR.OFFICES.slice(), OFF=Object.fromEntries(OFFICES.map(o=>[o.k,o]));
  const PEOPLE={
    x:{id:'x', n:'Avery Example', offices:['carlsbad','hobbs'], start:'2020-01-01', bonus:100},
    h:{id:'h', n:'Blake Example', offices:['carlsbad','hobbs'], start:'2020-01-01', bonus:100, holHrs:true},
    y:{id:'y', n:'Casey Example', offices:['crucesffo','cruceslco'], start:'2020-01-01', bonus:100},
    z:{id:'z', n:'Drew Example', offices:['carlsbad'], start:'2020-01-01', bonus:100}};
  const SH={carlsbad:{status:'sent', rows:{x:{w1:20,w2:20,bonus:'full'}, h:{w1:10}, z:{w1:40,w2:40}}},
            hobbs:{status:'sent', rows:{x:{w1:10,w2:10,bonus:'full'}, h:{w1:5}}},
            crucesffo:{status:'sent', rows:{y:{w1:20}}}, cruceslco:{status:'sent', rows:{y:{w1:15}}}};
  const get=(n,k)=>SH[k]||{status:'none', rows:{}};
  const P=n=>Object.assign({}, PR.period(n-20), {n});
  const env=new Function('PR','OFF','OFFICES','get','P','PEOPLE', `
    const bonusOf=p=>p.bonus, rt=()=>PR.RATES, eligible=(p,d)=>PR.eligible(p.start,d), specUsd=()=>0, TOGON=()=>true;
    const LIVEPAY=false, LIVE={}, RECENT=0, CUR=25, FIRST_N=25, lab=n=>'#'+n, esc=s=>String(s), span=()=>'', fmt=()=>'', hrs=n=>String(n);
    const money=n=>'<<'+n+'>>', enteredOf=()=>null, withAdds=(n,k,p,x)=>x, rowPeople=(n,k)=>Object.keys(get(n,k).rows).map(id=>PEOPLE[id]);
    ${src}
    return {calc, entryCalc, histList};`)(PR, OFF, OFFICES, get, P, PEOPLE);
  const pr=P(25), part=k=>id=>({k, x:SH[k].rows[id], raw:SH[k].rows[id]});
  t('pay period #25 (Nov 15-28) has Thanksgiving', pr.start==='2026-11-15' && pr.end==='2026-11-28' && pr.hol && pr.hol.n==='Thanksgiving');
  t('before the fix each office row got it (the bug): $100 holiday on the Hobbs row too', env.calc(PEOPLE.x, SH.hobbs.rows.x, pr).hol===100);
  const ec=(k,id)=>env.entryCalc(25, pr, {p:PEOPLE[id], parts:[part(k)(id)]});
  const xc=ec('carlsbad','x'), xh=ec('hobbs','x');
  t('Carlsbad + Hobbs (two lists): holiday $100 and the bonus on Carlsbad’s row only - Hobbs’ row has neither',
    xc.here && xc.c.hol===100 && xc.c.ppb===100 && xc.c.total===200 && !xh.here && xh.c.hol===0 && xh.c.ppb===0 && xh.c.total===0);
  const hc=ec('carlsbad','h'), hh=ec('hobbs','h');
  t('holiday HOURS too: 8 h on the home row, none on the other', hc.c.holH===8 && hh.c.holH===0 && hc.c.hol===0);
  const yc=env.entryCalc(25, pr, {p:PEOPLE.y, parts:[part('crucesffo')('y'), part('cruceslco')('y')]});
  t('the two Cruces offices entered together: one row, one holiday, one bonus', yc.c.hol===100 && yc.c.ppb===100 && yc.c.total===200);
  t('someone at one office: as before', ec('carlsbad','z').c.hol===100 && ec('carlsbad','z').c.total===200);
  const combinedTotal=[xc,xh,hc,hh,yc,ec('carlsbad','z')].reduce((a,r)=>a+r.c.total,0);
  const hist=+((env.histList().match(/<<([\d.]+)>><\/td><td class="n"><button/)||[])[1]);
  t('History adds up to the combined sheet ($700 - not $900 with the holiday twice)', combinedTotal===700 && hist===700);
  t('the combined sheet and the download say where the holiday went',
    /!r\.here && PR\.holDates\(pr\.hol\)\.some\(d=>eligible\(p,d\)\) \? '<div class="small muted">on '\+esc\(poss\(OFF\[r\.ob\.home\]\.n\)\)\+' row<\/div>'/.test(fn('combined')) &&
    /'\[Holiday on '\+poss\(OFF\[r\.ob\.home\]\.n\)\+' row\]'/.test(fn('csv')));
}

/* ---------- 2. An entered sheet is locked in its file, not only on screen ---------- */
{
  const src=[line(/const entOnly=[^\n]*/), fn('sheetLocked'), fn('liveSheet'), fn('liveFlush')].join('\n');
  const q=[]; const LIVE={locked:{}, lockMsg:'', refused:0, q:{}, busy:0};
  const env=new Function('LIVE','q', `
    const LIVEPAY=true, OFF={carlsbad:{n:'Carlsbad'}}, keyOf=()=>'2026-25', myEmail=()=>'sender@example.com', lab=n=>'#'+n, poss=n=>n+'’s', el=()=>null, lockNote=()=>'';
    const liveQueue=(k,file,f)=>q.push(f), paintSave=()=>{}, pending=()=>false;
    const io={cur:null, out:'unset'}; const store=()=>({update:(file, m)=>{ io.out=m(io.cur); return Promise.resolve({}); }});
    ${src}
    return {liveSheet, liveFlush, io};`)(LIVE, q);
  const ent={at:'2026-12-01T10:00', by:'Heather'};
  const sheet=()=>({v:1, status:'sent', rows:{a:{w1:40}}, docs:{}, log:[], entered:Object.assign({}, ent)});
  let cur=sheet(); env.liveSheet(25,'carlsbad',{row:'a', f:'w1', v:12}); let out=q.pop()(cur);
  t('a change typed on a page drawn before it was entered is refused: the file stays as entered', out===cur && cur.rows.a.w1===40 && !cur.upd && LIVE.locked['carlsbad|25']===1);
  t('…and the page says who entered it and to reload', /Heather has entered Carlsbad’s sheet for pay period #25 in payroll/.test(LIVE.lockMsg) && /Reload/.test(LIVE.lockMsg));
  cur=sheet(); env.liveSheet(25,'carlsbad',{set:{status:'sent', at:'x'}, unset:['changed'], log:{at:'x', t:'Changes sent'}}); q.pop()(cur);
  t('"Send the changes" on an entered sheet is refused too (no new log line)', cur.log.length===0);
  cur=sheet(); env.liveSheet(25,'carlsbad',{set:{entered:null}}); q.pop()(cur);
  t('the tick itself still goes through (reopen)', cur.entered===null);
  cur=sheet(); delete cur.entered; env.liveSheet(25,'carlsbad',{set:{entered:ent}}); q.pop()(cur);
  t('…and ticking it entered', cur.entered && cur.entered.by==='Heather');
  cur=sheet(); const r0=LIVE.refused; env.liveSheet(25,'carlsbad',{drop:'nobody'}); q.pop()(cur);
  t('"Remove" of a row that isn’t on an entered sheet changes nothing, so it isn’t refused', LIVE.refused===r0);
  cur=sheet(); env.liveSheet(25,'carlsbad',{drop:'a'}); q.pop()(cur);
  t('"Remove" of a row that IS on an entered sheet is refused - the row stays', !!cur.rows.a && LIVE.refused===r0+1);
  cur=sheet(); delete cur.entered; env.liveSheet(25,'carlsbad',{row:'a', f:'w1', v:12}); q.pop()(cur);
  t('a sheet not entered saves as before', cur.rows.a.w1===12 && !!cur.upd);
  /* the flush itself: only refused = nothing written; anything else = written as before */
  const ID='carlsbad/sheet_2026-25';
  env.io.cur=sheet(); env.liveSheet(25,'carlsbad',{row:'a', f:'w1', v:1}); LIVE.q[ID]=[q.pop()]; env.liveFlush(ID);
  const refusedOut=env.io.out;
  env.io.cur=sheet(); delete env.io.cur.entered; env.liveSheet(25,'carlsbad',{row:'a', f:'w1', v:2}); LIVE.q[ID]=[q.pop()]; env.liveFlush(ID);
  t('a flush that was only refused writes nothing (not even the same file back); a normal one writes as before', refusedOut===undefined && env.io.out && env.io.out.rows.a.w1===2);
  env.io.cur=sheet(); env.liveSheet(25,'carlsbad',{row:'a', f:'w1', v:3}); env.liveSheet(25,'carlsbad',{set:{entered:null}}); LIVE.q[ID]=[q.shift(), q.shift()]; env.liveFlush(ID);
  t('…a refused change queued with the tick: only the tick is written', env.io.out && env.io.out.entered===null && env.io.out.rows.a.w1===40);
  t('the save badge never says "Saved ✓" over it; a note stays at the top until reloaded',
    /if\(LIVE\.lockMsg\)\{ b\.hidden=false; b\.className='savebadge bad';/.test(fn('paintSave')) && /if\(LIVEPAY && LIVE\.lockMsg\) el\('view'\)\.insertAdjacentHTML\('afterbegin', lockNote\(\)\);/.test(fn('render')));
  t('Send: refused at once when the sheet is known entered, and never marked sent if the file refused it',
    /if\(act==='sendok'\)\{\n\s*if\(entOff\(per,R\(\)\.office\)\)\{ closeDlg\(\); toast\(/.test(H) && /if\(LIVE\.locked\[o\+'\|'\+n\]\)\{ closeDlg\(\); return; \}[^\n]*\n\s*s\.status='sent';/.test(H));
  t('"Remove" on a new person: not off a sheet that’s entered',
    /if\(act==='unadd'\)\{\n\s*const p=who\(v\); if\(!p\) return;\n.*\n\s*if\(\[CUR,NEXT\]\.some\(n=>p\.offices\.some\(o=>entOff\(n,o\) && \(get\(n,o\)\.rows\|\|\{\}\)\[v\]\)\)\)\{ toast\(/.test(H));
}

/* ---------- 3. Nobody typed anything for someone: still flagged ---------- */
{
  const src=[line(/const blank=[^\n]*/), line(/const num=[^\n]*/), line(/const r2=[^\n]*/), line(/const cutVal=[^\n]*/), line(/const otOK=[^\n]*/), fn('issues')].join('\n');
  const mk=rows=>new Function('rows', `const CUR=25, esc=s=>String(s), disp=p=>p.n, money=n=>'$'+n, spbHas=x=>!!(x&&x.spb), spbTypes=()=>[], docRows=()=>[], daySet=v=>v!==''&&v!=null;
    const get=()=>({rows}), rowPeople=()=>[{id:'a', n:'Ellis, Avery'}];
    ${src}
    return issues;`)(rows);
  const none=mk({})(25,'carlsbad'), noted=mk({a:{w1:'', w2:'', notes:'On leave'}})(25,'carlsbad');
  t('a person with no row at all gets "has no hours" (it used to say nothing and let the sheet go)', none.length===1 && /has no hours/.test(none[0].t));
  t('…a note clears it, as before', noted.length===0);
}

/* ---------- 4. Add to payroll vs. offices already entered ---------- */
{
  const src=[line(/const enteredBefore=[^\n]*/), line(/const addOffs=[^\n]*/), line(/const addsFor=[^\n]*/), line(/const homeRow=[^\n]*/), fn('addsOn'), fn('landedOf')].join('\n');
  const OFFICES=[{k:'carlsbad',n:'Carlsbad'},{k:'hobbs',n:'Hobbs'},{k:'zihua',n:'Zihua',self:true}], OFF=Object.fromEntries(OFFICES.map(o=>[o.k,o]));
  const PE={a:{id:'a', offices:['carlsbad']}, b:{id:'b', offices:['hobbs']}};
  const SH={carlsbad:{status:'sent', rows:{a:{}}}, hobbs:{status:'sent', rows:{b:{}}}};
  const mk=(ENT, list)=>new Function('OFF','OFFICES','SH','PE','ENT','list', `const num=v=>+v||0, ADD_COLS=[['goal'],['tcom'],['extra']], nOfP=k=>k, adds=()=>list;
    const entOff=(n,k)=>ENT[k]||null, get=(n,k)=>SH[k], rowPeople=(n,k)=>Object.keys(SH[k].rows).map(id=>PE[id]);
    ${src}
    return {addsOn, landedOf, enteredBefore};`)(OFF, OFFICES, SH, PE, ENT, list);
  const item={id:'i1', key:25, to:{k:'all'}, col:'extra', amt:50, what:'Team hit goal', at:'2026-11-30T11:00'};
  let e=mk({carlsbad:{at:'2026-11-30T10:00'}}, [item]);
  t('Carlsbad entered at 10:00, "everyone $50" written at 11:00: not on Carlsbad’s rows, still on Hobbs’', e.addsOn(25,'carlsbad',PE.a).length===0 && e.addsOn(25,'hobbs',PE.b).length===1);
  const L=e.landedOf(item,25);
  t('…and "where it stands" says Carlsbad was entered before it (not "check")', L.before.join()==='Carlsbad' && L.count===1 && !L.waiting.length);
  e=mk({carlsbad:{at:'2026-11-30T12:00'}}, [item]);
  t('entered AFTER it was written down: it stays on (it was counted when entered)', e.addsOn(25,'carlsbad',PE.a).length===1);
  e=mk({carlsbad:{at:'2026-11-30T11:00'}}, [item]);
  t('same minute, or no times: on it, as before', e.addsOn(25,'carlsbad',PE.a).length===1 && mk({carlsbad:{at:'2026-11-30T10:00'}}, [Object.assign({}, item, {at:undefined})]).addsOn(25,'carlsbad',PE.a).length===1);
  t('nothing entered: as before', mk({}, [item]).addsOn(25,'carlsbad',PE.a).length===1);
  t('the add dialog warns when an office it’s for is already entered for that pay period',
    /const ent=addOffs\(\{to:r\.to\}\)\.filter\(k=>OFF\[k\] && entOff\(r\.n,k\)\);/.test(fn('paintAddPrev')) && /already entered in payroll for /.test(fn('paintAddPrev')));
  t('Take off / Bring back: checked office by office - refused while an office is entered with it counted',
    /const held=n===null \? \[\] : addOffs\(a\)\.filter\(k=>OFF\[k\] && entOff\(n,k\) && !enteredBefore\(n,k,a\)\);/.test(H) &&
    H.indexOf('const held=')>H.indexOf("if((act==='addrm' || act==='addback') && !R().ro){") && H.indexOf('const held=')<H.indexOf("const gone=act==='addrm'"));
}

/* ---------- 5. Taken off but something typed: still on the sheet ---------- */
{
  const src=[line(/const typedRow=[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*/), fn('rowPeople')].join('\n');
  const env=new Function(`const CUR=25, num=v=>parseFloat(v)||0, byLast=(a,b)=>a.id<b.id?-1:1;
    const PE=[{id:'a', offices:['o']}, {id:'g', offices:['o']}], gone={g:1}, rows={};
    const everyone=()=>PE, activeAt=()=>PE.filter(p=>!gone[p.id]), who=id=>PE.find(p=>p.id===id), get=()=>({rows});
    ${src}
    return {typedRow, rowPeople, rows};`)();
  const shown=x=>{ Object.keys(env.rows).forEach(k=>delete env.rows[k]); if(x) env.rows.g=x; return env.rowPeople(25,'o').some(p=>p.id==='g'); };
  t('taken off with PTO only / on call / a bonus mark / a note: still shown', shown({pto:8}) && shown({oncall:1}) && shown({bonus:'none'}) && shown({notes:'Last day Friday'}));
  t('…hours, as before', shown({w1:12}));
  t('…an empty row (blank’s defaults) or none: not shown', !shown({w1:'',w2:'',pto:0,mg:'N',bonus:'full',cut:'',cutBy:'pct',ot1:false,notes:''}) && !shown(null) && !shown({pto:'0'}));
}

/* ---------- 6. Due 2 pm CENTRAL, not the device's clock ---------- */
{
  const src=[line(/const CENTRAL=[^\n]*/), line(/const NOW=LIVEPAY[^\n]*/), line(/const NOWDAY=[^\n]*/)].join('\n');
  const run=PH=>new Function('window', `const PH=window.PH, LIVEPAY=true, TODAY='2026-11-17', pad=n=>String(n).padStart(2,'0');
    ${src}
    return {NOW, NOWDAY};`)({PH});
  const c=run({centralNow:()=>({date:'2026-11-17', hm:'14:05'})});
  t('live: the time is the practice’s (Central) - 2:05 pm Central is late even on a Mountain-time computer', c.NOW==='2026-11-17T14:05' && c.NOW>'2026-11-17T14:00' && c.NOWDAY==='2026-11-17');
  const f=run(undefined), g=run({centralNow:()=>{ throw new Error('x'); }});
  t('no PH.centralNow (or it fails): the device’s clock, as before', /^2026-11-17T\d\d:\d\d$/.test(f.NOW) && /^2026-11-17T\d\d:\d\d$/.test(g.NOW));
  t('late / "due today" / the reminder use that clock', /pr\.due===NOWDAY\?'today'/.test(H) && /NOWDAY>=workdayBefore\(pr\.due\)/.test(fn('viewOmSheet')) && /today=pr\.due===NOWDAY;/.test(fn('viewOmSheet')) &&
    /if\(NOW>pr\.dueAt\) return '<span class="pill p-late">/.test(fn('statusPill')) && !/pr\.due===TODAY/.test(fn('viewOmSheet')+line(/const dueText=[^\n]*/)));   // (the mock-up's own phone-reminder demo keeps its fixed date)
}

/* ---------- 7. iPhone: a save waiting its 0.7 s is sent when the page is hidden ---------- */
{
  let flushed=0; const LIVE={q:{'carlsbad/sheet':[()=>{}]}};
  const f=new Function('LIVE','liveFlushAll', `const LIVEPAY=true; ${line(/const flushHidden=[^\n]*/)} return flushHidden;`)(LIVE, ()=>{ flushed++; });
  f(); LIVE.q={'carlsbad/sheet':[]}; f();
  t('hidden with a change waiting: sent now; nothing waiting: nothing', flushed===1);
  t('on pagehide and on visibilitychange to hidden (beforeunload kept)', /window\.addEventListener\('pagehide', flushHidden\);/.test(H) &&
    /document\.addEventListener\('visibilitychange', \(\)=>\{ if\(document\.visibilityState==='hidden'\) flushHidden\(\); \}\);/.test(H) && /window\.addEventListener\('beforeunload'/.test(H));
}

/* ---------- 8. "Make them one person" also checks the sheet in progress ---------- */
t('it looks at this pay period AND the one in progress, for anything typed (notes too), before merging',
  /\[CUR,NEXT\]\.some\(n=>\{ const x=get\(n,k\)\.rows\[q\.id\]; if\(x && !enteredOf\(n\) && typedRow\(x\)\)/.test(fn('makeOne')) &&
  fn('makeOne').indexOf('if(busy)')<fn('makeOne').indexOf('rest.forEach('));

/* ---------- 9. The download: no formulas from typed text ---------- */
{
  const cell=new Function(line(/const csvCell=[^\n]*\n[^\n]*/)+'\nreturn csvCell;')();
  t('text starting = + - @ gets an apostrophe', cell('=SUM(A1:A9)')==="'=SUM(A1:A9)" && cell('+1 555')==="'+1 555" && cell('-left early')==="'-left early" && cell('@home')==="'@home");
  t('numbers are never touched (a negative stays a number); other text as before', cell(-5)==='-5' && cell(12.5)==='12.5' && cell('Smith, Jo')==='"Smith, Jo"' && cell('')==='' && cell(null)==='');
  t('…and quoting still works on a guarded cell', cell('=1,"2"')==="\"'=1,\"\"2\"\"\"");
  t('every cell of the download goes through it', /const pr=P\(n\), RATE=rt\(pr\.start\), q=csvCell;/.test(fn('csv')) && /lines\.map\(l=>l\.map\(q\)\.join\(','\)\)/.test(fn('csv')));
}

/* ---------- optional: a pay period's key is looked up once ---------- */
{
  let calls=0; const nk=new Function('PR', `const ANCHOR={n:20}; ${line(/const NKEY=[^\n]*/)}\n${line(/const nOfKey=[^\n]*/)} return nOfKey;`)({indexOfKey:k=>{ calls++; return k==='2026-25' ? 5 : null; }});
  t('nOfKey: same answers, worked out once per key', nk('2026-25')===25 && nk('2026-25')===25 && nk('junk')===null && nk('junk')===null && calls===2);
}

/* ---------- 10. Admin: a team with people on it isn't renamed or deleted ---------- */
{
  const src=[lineIn(A,/const teamPeople=[^\n]*/), fnIn(A,'teamBusy')].join('\n');
  const box={textContent:'', style:{}}, toasts=[];
  const env=new Function('box','toasts', `let users=[{f:'Avery',l:'Ellis',teams:['Office Managers']},{f:'Blake',l:'Moss',teams:['office managers','TCs']},{f:'Casey',l:'Lane',teams:['Staff']}];
    const el=()=>box, docToast=(m,b)=>toasts.push(m);
    ${src}
    return {teamBusy};`)(box, toasts);
  t('rename/delete refused while 2 people are on it (any capitals), said in the dialog', env.teamBusy('Office Managers')===true && /2 people are on Office Managers \(Avery Ellis, Blake Moss\)\. Move these 2 people to another team first/.test(box.textContent) && box.style.display==='block');
  t('an empty team can be renamed or deleted, as before', env.teamBusy('Records Techs')===false);
  t('wired before anything changes: rename and delete', /\} else if\(nm!==d\.old\)\{\n\s*if\(teamBusy\(d\.old\)\) return;\n\s*TEAMS=TEAMS\.map/.test(fnIn(A,'saveTeam')) &&
    /if\(teamBusy\(t\)\) return;\n\s*TEAMS=TEAMS\.filter/.test(fnIn(A,'delTeam')) && /<div id="teamErr" class="docerr" style="display:none"><\/div>/.test(A) && noPopups(fnIn(A,'teamBusy')));
}

/* ---------- 11. Admin: Locations ---------- */
{
  const lt=new Function(`const LOCS=[{n:'Carlsbad'},{n:'Hobbs'}]; ${lineIn(A,/const locTaken=[^\n]*/)} return locTaken;`)();
  t('a name already used (any capitals) is refused; the office’s own name is fine', lt('carlsbad', null)===true && lt('HOBBS','Carlsbad')===true && lt('Carlsbad','Carlsbad')===false && lt('Roswell', null)===false);
  const sl=fnIn(A,'saveLoc');
  t('a rename isn’t saved here: the note says to rename it on the Schedule (its days move with it there); brand/state/time zone still save',
    /if\(locTaken\(nm, own\)\)\{ locErr\(/.test(sl) && /if\(own!==null && nm!==own\)\{ locErr\('To rename '\+own\+', use the Schedule/.test(sl) && sl.indexOf('locErr(')<sl.indexOf('LOCS[locDraft.i]=rec') && /<div id="locErr" class="docerr"/.test(A));
  t('Delete asks first, in the page (no browser pop-up), and only then deletes', /onclick="AD\.delLocGo\(\)"/.test(fnIn(A,'delLoc')) && !/splice/.test(fnIn(A,'delLoc')) && /LOCS\.splice\(i,1\); saveLocs\(\);/.test(fnIn(A,'delLocGo')) &&
    /delLoc,delLocGo,resetLocs/.test(A) && noPopups(fnIn(A,'delLoc')+fnIn(A,'delLocGo')+sl));
}

/* ---------- 12. Admin: removing someone takes them off "who sends" ---------- */
{
  const rec={v:1, offices:{Carlsbad:['Ann@Example.com','other@example.com'], Hobbs:['ann@example.com'], Lubbock:['x@example.com']}, upd:'u'};
  const d=PR.dropSender(rec, ' ann@example.com ');
  t('payrules.dropSender: off every office it was on (any capitals), nobody else touched, the original left as it was',
    d && d.from.join()==='Carlsbad,Hobbs' && d.rec.offices.Carlsbad.join()==='other@example.com' && d.rec.offices.Hobbs.length===0 && d.rec.offices.Lubbock.join()==='x@example.com' &&
    rec.offices.Carlsbad.length===2 && d.rec.v===1);
  t('…not on it / no list / no email: null (nothing written)', PR.dropSender(rec, 'zed@example.com')===null && PR.dropSender(undefined, 'a@x')===null && PR.dropSender(rec, '')===null);
  const toasts=[]; let synced=0, written=null;
  const env=new Function('PR','toasts','hooks', `const window={PH_STORE:{update:(k,m)=>{ const v=m(JSON.parse(JSON.stringify(hooks.rec))); hooks.key=k; hooks.written=v; return Promise.resolve(v===undefined ? {unchanged:true} : {value:v}); }}, PAYRULES:PR};
    const PH_STORE=window.PH_STORE, PAYRULES=PR, PH={email:()=>'admin@example.com', me:()=>({}), reloadPaySenders:()=>Promise.resolve()};
    const syncPay=()=>{ hooks.synced++; }, docToast=(m,b)=>toasts.push(m);
    ${fnIn(A,'dropPaySender')}
    return dropPaySender;`);
  const hooks={rec, synced:0};
  const drop=env(PR, toasts, hooks);
  drop({f:'Ann', l:'Example', email:'ann@example.com'}).then(from=>{
    t('removing a sender: the shared list is updated, the folder sync runs, and the page says so',
      hooks.key==='ph_pay_senders' && from.join()==='Carlsbad,Hobbs' && hooks.written.updBy==='admin@example.com' && hooks.synced===1 && /Ann Example no longer sends Carlsbad and Hobbs’s payroll sheet/.test(toasts[0]));
    return drop({f:'Zed', l:'Example', email:'zed@example.com'});
  }).then(from=>{
    t('removing someone who sends nothing: no write, no message', from===null && hooks.written===undefined && toasts.length===1 && hooks.synced===1);
    t('wired into Remove, after the removal saved; no browser pop-up in the new code',
      /closeModal\(\);\n\s*dropPaySender\(u\);/.test(fnIn(A,'removePerson')) && noPopups(fnIn(A,'dropPaySender')));
    finish();
  });
}

/* ---------- 13. Team page: roster words as text, office in a data attribute ---------- */
{
  const s=T.indexOf('<script>\n(function(){'), e=T.indexOf('})();\n</script>', s);
  const code=T.slice(s+'<script>\n'.length, e+'})();'.length);
  const els={};
  const elOf=id=>els[id]||(els[id]={id, innerHTML:'', textContent:'', value:''});
  const ctx={STAFF:[{n:'Evil <img src=x onerror=alert(1)> Person', loc:"O'Brien", role:'<script>bad()</script>', mail:'"><b>@example.com', phone:'<i>555</i>', team:'<u>T</u>', brand:'<s>B</s>'}],
    PH:{officeNames:()=>["O'Brien"], me:()=>null, name:()=>'', photoFor:()=>''},
    document:{getElementById:elOf, addEventListener:()=>{}}, location:{search:''}, URLSearchParams};
  ctx.window=ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
  const g=elOf('grid').innerHTML, f=elOf('filters').innerHTML;
  t('a roster name, role, office, phone, email, team or brand never goes in as HTML',
    !/<img|<script|<i>555|<u>T|<s>B|"><b>/.test(g) && /&lt;img src=x onerror=alert&gt;/.test(g) && /&lt;script&gt;/.test(g) && /href="mailto:&quot;&gt;&lt;b&gt;@example\.com"/.test(g));
  t('the office chips: name in data-o, read with this.dataset - an apostrophe can’t break them',
    /data-o="O&#39;Brien" onclick="TEAM\.office\(this\.dataset\.o\)">O&#39;Brien<\/button>/.test(f) && !/TEAM\.office\('/.test(T));
}

function finish(){
  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
}
