/* REIMBURSEMENTS IN ADD TO PAYROLL (23/11/2026, Heather: reimbursements in Add to payroll).
       node test/payreimb.test.js

   Heather: "Will you make it to where I can also add reimbursements for employees on this 'add to payroll' part, not
   just bonuses." A 4th column choice, row field 'radd': it goes in Reimburse next to the mileage and is NEVER in Total.
   The page's own code is cut out of payroll.html and run on made-up people and sheets (combined sheet, History, the
   download); payrules.js is run as it is. Made-up names only. */
const fs=require('fs'), path=require('path');
const PR=require(path.join(__dirname,'..','v1','payrules.js'));
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) throw new Error('missing function '+name); let d=0; const j=H.indexOf('{', i);
  for(let k=j;k<H.length;k++){ if(H[k]==='{') d++; else if(H[k]==='}'){ d--; if(!d) return H.slice(i, k+1); } } return ''; };
const line=re=>{ const m=H.match(re); if(!m) throw new Error('missing '+re); return m[0]; };

/* ---------- the page's own code, with what's around it stubbed ---------- */
const SRC=[line(/const num=[^\n]*/), line(/const r2=[^\n]*/), line(/const cutVal=[^\n]*/), line(/const cutBy=[^\n]*/), line(/const otOK=[^\n]*/),
  line(/const daySet=[^\n]*/), line(/const MERGE_KEEP=[^\n]*/), line(/const csvCell=[^\n]*\n[^\n]*/),
  line(/const ADD_COLS=[^\n]*/), line(/const addColName=[^\n]*/), line(/const addInto=[^\n]*/), line(/const addsFor=[^\n]*/), line(/const homeRow=[^\n]*/),
  line(/const enteredBefore=[^\n]*/), line(/const addOffs=[^\n]*/), fn('addsOn'), fn('withAdds'), line(/const addLines=[^\n]*/), line(/const addsNote=[^\n]*/),
  fn('calc'), fn('sections'), fn('combEntries'), fn('mergeX'), fn('oneBonus'), fn('entryCalc'), fn('specColsG'), fn('combined'), fn('histList'), fn('csv')].join('\n');

const OFFICES=[{k:'carlsbad', n:'Carlsbad', co:'Example Co A'}, {k:'hobbs', n:'Hobbs', co:'Example Co B'}, {k:'zihua', n:'Zihua', co:'Example Co Z', self:true, by:'Heather'}];
const OFF=Object.fromEntries(OFFICES.map(o=>[o.k,o]));
const PEOPLE={
  a:{id:'a', n:'Avery Example', offices:['carlsbad'], start:'2020-01-01', bonus:100},
  b:{id:'b', n:'Blake Example', offices:['carlsbad'], start:'2020-01-01', bonus:100},
  c:{id:'c', n:'Casey Example', offices:['hobbs'], start:'2020-01-01', bonus:100}};
const sheets=()=>({carlsbad:{status:'sent', rows:{a:{w1:40, w2:40, bonus:'full', mkt:50}, b:{w1:30, w2:30, bonus:'full', oth:10, notes:'Example run'}}},
                   hobbs:{status:'sent', rows:{c:{w1:20, w2:20, bonus:'full', mkt:10}}}});
const P=n=>Object.assign({}, PR.period(n-20), {n});
/* list: Add to payroll's items; ENT: offices marked entered {k:{at}}; cols: which ADD_COLS the page knows (a page from before = 3) */
function page(list, ENT, oldPage){
  const SH=sheets(), CAP=[];
  let src=SRC;
  if(oldPage) src=src.replace(",['radd','Reimbursement']", '').replace('+num(x.radd)', '');   // the page as it was before 23/11/2026
  const env=new Function('PR','OFF','OFFICES','PEOPLE','SH','P','list','ENT','CAP', `
    const get=(n,k)=>SH[k]||{status:'none', rows:{}, docs:{}}, rowPeople=(n,k)=>Object.keys((SH[k]||{rows:{}}).rows).map(id=>PEOPLE[id]);
    const adds=()=>list, nOfP=k=>k, entOff=(n,k)=>ENT[k]||null, enteredOf=()=>null;
    const bonusOf=p=>p.bonus, rt=()=>PR.RATES, eligible=(p,d)=>PR.eligible(p.start,d), specUsd=()=>0, TOGON=()=>true, togGroups=()=>[];
    const LIVEPAY=false, LIVE={}, RECENT=0, CUR=25, NEXT=26, FIRST_N=25, NOW='2026-12-01';
    const lab=n=>'#'+n, esc=s=>String(s), span=()=>'span', fmt=()=>'date', hrs=n=>String(n), money=n=>'<<'+n+'>>', disp=p=>p.n, poss=n=>n+'’s', byLast=(a,b)=>a.n<b.n?-1:1;
    const R=()=>({ro:false}), offTint=()=>'', entTick=()=>'', whoSends=()=>'Someone', combHead=()=>'<tr class="hd"></tr>', hin=(k,p,f,v)=>'<i>'+(v||'')+'</i>';
    const otCell=()=>'', ownColsG=()=>[], ownUsd=()=>0, ownEach=()=>false, specCols=()=>[], specShow=()=>'', SPBON=()=>false, spbHas=()=>false;
    const docRows=()=>[], DOCPAYON=()=>false, docPay=()=>null, dayN=()=>'', daysText=()=>'';
    let NC=17;
    class Blob{ constructor(parts){ CAP.push(parts.join('')); } }
    const document={createElement:()=>({click(){}, remove(){}}), body:{appendChild(){}}}, URL={createObjectURL:()=>'', revokeObjectURL(){}}, setTimeout=()=>{};
    ${src}
    return {calc, withAdds, addsOn, addLines, combEntries, entryCalc, combined, histList, csv};`)(PR, OFF, OFFICES, PEOPLE, SH, P, list, ENT, CAP);
  return Object.assign(env, {SH, CAP});
}
/* what each one shows */
const row=(html,k,id)=>{ const m=html.match(new RegExp('id="ct-'+k+'-'+id+'"><<([\\d.]+)>></b></td><td class="n"><<([\\d.]+)>>(.*?)</td>')); return m ? {total:+m[1], reimb:+m[2], under:m[3]} : null; };
const grand=html=>{ const m=html.match(/id="cgt"><<([\d.]+)>><\/td><td class="n"><<([\d.]+)>>/); return m ? {total:+m[1], reimb:+m[2]} : null; };
const histTotal=html=>+((html.match(/<<([\d.]+)>><\/td><td class="n"><button/)||[])[1]);
const csvRows=e=>{ e.csv(25); const text=e.CAP.pop().replace(/^﻿/,''), out=[];
  text.split('\r\n').forEach(l=>{ const cells=[]; let cur='', q=false;
    for(let i=0;i<l.length;i++){ const ch=l[i];
      if(q){ if(ch==='"' && l[i+1]==='"'){ cur+='"'; i++; } else if(ch==='"') q=false; else cur+=ch; }
      else if(ch==='"') q=true; else if(ch===','){ cells.push(cur); cur=''; } else cur+=ch; }
    cells.push(cur); out.push(cells); });
  const head=out.find(r=>r[0]==='Employee Name'), col=n=>head.indexOf(n);
  const by={}; out.forEach(r=>{ if(Object.values(PEOPLE).some(p=>p.n===r[0])) by[r[0]]={reimb:r[col('Reimburse')], total:r[col('Total')], goal:r[col('Goal')], tcom:r[col('TC/OM')], extra:r[col('Extra')], notes:r[col('Notes')]}; });
  return by; };

const AT='2026-11-30T11:00';
const reimb45={id:'r1', key:25, to:{k:'person', o:'carlsbad', pid:'a'}, col:'radd', amt:45, what:'Scrubs, example', at:AT};
const bonuses=[{id:'g1', key:25, to:{k:'office', o:'carlsbad'}, col:'goal', amt:100, what:'Team hit goal', at:AT},
               {id:'t1', key:25, to:{k:'person', o:'carlsbad', pid:'b'}, col:'tcom', amt:75, what:'Pilot bonus', at:AT},
               {id:'e1', key:25, to:{k:'all'}, col:'extra', amt:20, what:'Holiday lunch', at:AT}];
const RATE=PR.RATES.mile;

/* ---------- 1. A $45 reimbursement for one person: in Reimburse, never in Total ---------- */
{
  const before=page([], {}), after=page([reimb45], {});
  const hb=before.combined(25), ha=after.combined(25), rb=row(hb,'carlsbad','a'), ra=row(ha,'carlsbad','a');
  t('the combined sheet: Avery’s Reimburse is mileage + $45 ('+RATE+' × 50 mi + 45 = '+(50*RATE+45)+'), Total exactly as before',
    rb && ra && rb.reimb===Math.round(50*RATE*100)/100 && ra.reimb===Math.round((50*RATE+45)*100)/100 && ra.total===rb.total);
  t('…with the line under Reimburse saying what it was for ("+ $45 · Scrubs, example")', ra.under==='<span class="addl" title="Added to payroll: Scrubs, example - <<45>>">+ <<45>> · Scrubs, example</span>' && rb.under==='');
  t('…nobody else gets it: Blake and Casey unchanged', JSON.stringify(row(ha,'carlsbad','b'))===JSON.stringify(row(hb,'carlsbad','b')) && JSON.stringify(row(ha,'hobbs','c'))===JSON.stringify(row(hb,'hobbs','c')));
  t('…the "All offices" line: Reimburse up by exactly $45, Total the same', grand(ha).total===grand(hb).total && Math.round((grand(ha).reimb-grand(hb).reimb)*100)/100===45);
  t('History totals: not in Total (the same with or without it)', histTotal(after.histList())===histTotal(before.histList()) && histTotal(before.histList())>0);
  const cb=csvRows(before), ca=csvRows(after);
  t('the download: Reimburse '+(Math.round((50*RATE+45)*100)/100)+' for Avery, Total the same',
    +ca['Avery Example'].reimb===Math.round((50*RATE+45)*100)/100 && +cb['Avery Example'].reimb===Math.round(50*RATE*100)/100 && ca['Avery Example'].total===cb['Avery Example'].total);
  t('…and its Notes say it like the other columns do: "[Added to payroll: Reimbursement $45: Scrubs, example]"',
    ca['Avery Example'].notes==='[Added to payroll: Reimbursement <<45>>: Scrubs, example]' && cb['Avery Example'].notes==='');
  t('the row it is given is never changed (radd is only on Heather’s side)', !('radd' in after.SH.carlsbad.rows.a));
}

/* ---------- 2. Mileage + reimbursement add together (payroll.html and payrules.js) ---------- */
{
  const e=page([], {}), pr=P(25), p=PEOPLE.a;
  const m=e.calc(p, {mkt:50, oth:10}, pr), r=e.calc(p, {mkt:50, oth:10, radd:45}, pr), only=e.calc(p, {radd:45}, pr);
  t('the page: 60 miles + $45 = mileage + 45, Total the same', r.reimb===Math.round((60*RATE+45)*100)/100 && m.reimb===Math.round(60*RATE*100)/100 && r.total===m.total && only.reimb===45 && only.total===e.calc(p, {}, pr).total);
  const per=PR.period(2), q={start:'2020-01-01'};
  const R0=PR.calc(q, {mkt:50, oth:10}, per, PR.RATES, 150, {goal:50}), R1=PR.calc(q, {mkt:50, oth:10, radd:45}, per, PR.RATES, 150, {goal:50});
  t('payrules.js: the same - 45.6 + 45 = 90.6 in Reimburse, Total the same', R0.reimb===45.6 && R1.reimb===90.6 && R1.total===R0.total);
  const two=page([Object.assign({}, reimb45), Object.assign({}, reimb45, {id:'r2', amt:12.5, what:'CE course, example'})], {});
  const ra=row(two.combined(25),'carlsbad','a');
  t('two reimbursements for one person add up, each with its own line', ra.reimb===Math.round((50*RATE+57.5)*100)/100 && (ra.under.match(/class="addl"/g)||[]).length===2);
}

/* ---------- 3. Goal / TC/OM / Extra additions: exactly as before ---------- */
{
  const old=page(bonuses, {}, true), now=page(bonuses, {}), both=page(bonuses.concat([reimb45]), {});
  const ho=old.combined(25), hn=now.combined(25), hb=both.combined(25);
  t('the combined sheet with only bonuses: the same, to the character, as with the old three columns and the old sum', hn===ho);
  t('…adding a reimbursement changes no Total anywhere (each row, All offices, History, download)',
    ['a','b'].every(id=>row(hb,'carlsbad',id).total===row(hn,'carlsbad',id).total) && row(hb,'hobbs','c').total===row(hn,'hobbs','c').total &&
    grand(hb).total===grand(hn).total && histTotal(both.histList())===histTotal(now.histList()) &&
    Object.keys(csvRows(now)).every(k=>csvRows(both)[k].total===csvRows(now)[k].total));
  const co=csvRows(old), cn=csvRows(now);
  t('the download with only bonuses: every cell the same as before', JSON.stringify(cn)===JSON.stringify(co));
  t('History with only bonuses: the same as before', now.histList()===old.histList());
  const cb=csvRows(both);
  t('…and Goal, TC/OM and Extra keep their amounts next to a reimbursement', ['Avery Example','Blake Example','Casey Example'].every(k=>cb[k].goal===cn[k].goal && cb[k].tcom===cn[k].tcom && cb[k].extra===cn[k].extra) &&
    cb['Avery Example'].goal==='100' && cb['Blake Example'].tcom==='75' && cb['Casey Example'].extra==='20');
  /* the sums themselves: with no radd on a row, calc gives every field exactly what it gave before */
  const pr=P(25), rows=[{}, {w1:42, w2:38, mkt:50, oth:10, oncall:1, phone:25, goal:50, tcom:100, extra:20, exc:15, spb:5}, {mkt:33.3, oth:0.7}, {mkt:'12', oth:'abc'}, {bonus:'partial', cut:10, mkt:1}];
  t('calc() on rows without a reimbursement: every number the same as before (5 kinds of rows)', rows.every(x=>JSON.stringify(now.calc(PEOPLE.a, x, pr))===JSON.stringify(old.calc(PEOPLE.a, x, pr))));
}

/* ---------- 4. An office entered before it was written down still doesn't get it ---------- */
{
  const forC=Object.assign({}, reimb45, {id:'r3', to:{k:'person', o:'hobbs', pid:'c'}});
  const early=page([forC], {hobbs:{at:'2026-11-30T10:00'}}), late=page([forC], {hobbs:{at:'2026-11-30T12:00'}}), none=page([], {});
  const re=row(early.combined(25),'hobbs','c'), rl=row(late.combined(25),'hobbs','c'), rn=row(none.combined(25),'hobbs','c');
  t('Hobbs entered at 10:00, the $45 written at 11:00: not on Casey’s row (Reimburse is mileage only, no line under it)', re.reimb===rn.reimb && re.under==='' && early.addsOn(25,'hobbs',PEOPLE.c).length===0);
  t('…nor in the download', csvRows(early)['Casey Example'].reimb===csvRows(none)['Casey Example'].reimb && csvRows(early)['Casey Example'].notes==='');
  t('entered AFTER it was written down (12:00): it stays on, as for the other columns', rl.reimb===Math.round((10*RATE+45)*100)/100 && /\+ <<45>>/.test(rl.under));
}

/* ---------- 5. A page from before this (an old tab still open) ignores it without breaking ---------- */
{
  const old=page([reimb45].concat(bonuses), {}, true), oldNone=page(bonuses, {}, true);
  let html='', err=null; try{ html=old.combined(25); old.histList(); csvRows(old); }catch(x){ err=x; }
  t('an old page drops a reimbursement it doesn’t know (addsFor keeps only its own columns): no error, the sheet as if it weren’t there',
    !err && html===oldNone.combined(25) && old.addsOn(25,'carlsbad',PEOPLE.a).every(a=>a.col!=='radd'));
}

/* ---------- 6. The words ---------- */
{
  /* the Add dialog's own preview, run as it is: what Heather reads as she picks the column */
  const src=[line(/const ADD_COLS=[^\n]*/), line(/const addColName=[^\n]*/), line(/const addInto=[^\n]*/), line(/const addOffs=[^\n]*/), fn('paintAddPrev')].join('\n');
  const dlg=r=>{ const E={aprev:{textContent:'', innerHTML:''}, awhat:{placeholder:''}};
    new Function('E','r','OFF','OFFICES', `const el=id=>E[id]||null, addRead=()=>r, esc=s=>String(s), money=n=>'$'+n, lab=n=>'#'+n, poss=n=>n+'’s', entOff=()=>null,
      addWho=()=>'Avery Example · Carlsbad';
      ${src}
      paintAddPrev();`)(E, r, OFF, OFFICES);
    return E; };
  const one={to:{k:'person', o:'carlsbad', pid:'a'}, amt:45, n:25, howMany:1};
  const R=dlg(Object.assign({col:'radd'}, one)), G=dlg(Object.assign({col:'goal'}, one)), A=dlg({to:{k:'office', o:'carlsbad'}, amt:45, col:'radd', n:25, howMany:2}), N=dlg({to:null, amt:0, col:'radd', n:25});
  t('the dialog, Reimbursement picked: "What it’s for" asks e.g. Scrubs, CE course, supplies - even before who and the amount',
    R.awhat.placeholder==='e.g. Scrubs, CE course, supplies' && N.awhat.placeholder==='e.g. Scrubs, CE course, supplies' && N.aprev.textContent==='Pick who and the amount.');
  t('…and reads "Avery Example · Carlsbad gets $45 in Reimburse on #25. A reimbursement - kept out of Total."',
    R.aprev.innerHTML==='Avery Example · Carlsbad gets <b>$45</b> in Reimburse on #25. <span class="muted">A reimbursement - kept out of Total.</span>');
  t('…for everyone at an office: still per person ("$45 each × about 2 people = about $90 in Reimburse")', /^\$45 each × about 2 people = <b>about \$90<\/b> in Reimburse on #25\./.test(A.aprev.innerHTML) && /kept out of Total/.test(A.aprev.innerHTML));
  t('a bonus reads as before ("gets $45 in Goal on #25.", the usual e.g.)', G.aprev.innerHTML==='Avery Example · Carlsbad gets <b>$45</b> in Goal on #25.' && G.awhat.placeholder==='e.g. Team hit goal, pilot bonus');
}
t('Reimburse’s info tip names it, and the note under the sheet too',
  /info\('Reimburse','Mileage: marketing and other miles × '\+money\(RATE\.mile\)\+' a mile \(the IRS rate\), plus reimbursements added in Add to payroll\. Kept out of Total\.'\)/.test(H) &&
  /Reimburse is mileage at '\+money\(RATE\.mile\)\+' a mile \(the IRS rate\) plus any reimbursement from Add to payroll/.test(fn('combined')));
t('the Reimburse cell shows the reimbursement lines (addLines for radd), like Goal / TC/OM / Extra show theirs',
  /money\(c\.reimb\)\+en\.parts\.map\(q=>addLines\(n,q\.k,p,'radd'\)\)\.join\(''\)/.test(fn('combined')));
t('the dialog: picking Reimbursement asks "e.g. Scrubs, CE course, supplies", says it goes in Reimburse and stays out of Total',
  /wf\.placeholder=r\.col==='radd' \? 'e\.g\. Scrubs, CE course, supplies' : 'e\.g\. Team hit goal, pilot bonus'/.test(fn('paintAddPrev')) &&
  /placeholder="e\.g\. Team hit goal, pilot bonus"/.test(fn('addDlg')) && (fn('paintAddPrev').match(/esc\(addInto\(r\.col\)\)/g)||[]).length===3 &&
  /if\(r\.col==='radd'\) b\.innerHTML\+=' <span class="muted">A reimbursement - kept out of Total\.<\/span>';/.test(fn('paintAddPrev')));
t('the card says a reimbursement goes in Reimburse, kept out of Total; its list names the column "Reimbursement"',
  /A bonus, a reimbursement or anything extra/.test(fn('addsCard')) && /\(a reimbursement goes in Reimburse, kept out of Total\)/.test(fn('addsCard')) &&
  /<td>'\+esc\(addColName\(a\.col\)\)\+'<\/td>/.test(fn('addsCard')));
t('the row field is radd - never "reimb" (that one is worked out)', !/\['reimb',/.test(H) && /\['radd','Reimbursement'\]/.test(H));
t('no pop-ups', !/\b(alert|confirm|prompt)\(/.test(fn('paintAddPrev')+fn('addDlg')+fn('addsCard')));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
