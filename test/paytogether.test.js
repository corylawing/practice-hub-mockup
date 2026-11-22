/* ENTERED TOGETHER + ONE BONUS (Heather 17/11/2026). SANDBOX ONLY until payroll.html TOGETHER_LIVE is true.
       node test/paytogether.test.js

   Heather: the two Las Cruces offices send separate sheets but are entered as ONE location (one tax ID) - "listed ...
   under one in alphabetical order"; "the hours do not add together when they work in 2 offices (Yvonne)"; "they should
   not qualify for a pay period bonus for each location just one bonus (Erica)". This runs the page's own calc() and
   mergeX() on made-up rows. */
const fs=require('fs'), path=require('path');
const PR=require(path.join(__dirname,'..','v1','payrules.js'));
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=H.indexOf('{', i);
  for(let k=j;k<H.length;k++){ if(H[k]==='{') d++; else if(H[k]==='}'){ d--; if(!d) return H.slice(i, k+1); } } return ''; };
const line=re=>{ const m=H.match(re); if(!m) throw new Error('missing '+re); return m[0]; };

/* the page's own code, with a few stand-ins (made-up offices A and B; no holidays, no extra columns) */
const src=[line(/const num=[^\n]*/), line(/const r2=[^\n]*/), line(/const cutVal=[^\n]*/), line(/const cutBy=[^\n]*/), line(/const otOK=[^\n]*/),
  line(/const MERGE_KEEP=[^\n]*/), fn('calc'), fn('mergeX'), fn('cleanTogether')].join('\n');
const env=new Function('PR','OFF','OFFICES','RATE', `const bonusOf=p=>p.bonus, rt=()=>RATE, eligible=()=>false, specUsd=()=>0;\n${src}\nreturn {calc, mergeX, cleanTogether};`)
  (PR, {a:{k:'a',n:'Cruces FFO'}, b:{k:'b',n:'Cruces LCO'}, z:{k:'z',n:'Zihua', self:true}}, [{k:'a'},{k:'b'},{k:'z'}], PR.RATES);
const pr={hol:null, start:'2026-11-01'}, p={id:'x', bonus:100, offices:['a','b']};
const part=(k,x)=>({k, x, raw:x});

const m=env.mergeX([part('a',{w1:25, w2:30, pto:4, notes:'Out Friday', bonus:'full'}), part('b',{w1:20, w2:'', mkt:10, notes:'Covered front desk', bonus:'full'})], p, pr);
const c=env.calc(p, m, pr);
t('hours added week by week: 25+20 = 45 in week 1, 30 in week 2', m.w1===45 && m.w2===30 && m.pto===4 && m.mkt===10);
t('…so overtime is on the COMBINED week: 5 hours in week 1 (neither office alone had any)', c.ot1===5 && c.ot2===0 && c.reg===70 &&
  env.calc(p, {w1:25}, pr).ot1===0 && env.calc(p, {w1:20}, pr).ot1===0);
t('notes are kept, each with its office’s name', m.notes==='Cruces FFO: Out Friday | Cruces LCO: Covered front desk');
t('ONE bonus: $100, not $100 at each office', c.ppb===100);
const strict=(a,b)=>env.calc(p, env.mergeX([part('a',a), part('b',b)], p, pr), pr).ppb;
t('the strictest mark wins: Full + None = no bonus; Full + Partial 10% = $90; Partial $30 + Partial 10% = $70',
  strict({bonus:'full'},{bonus:'none'})===0 && strict({bonus:'full'},{bonus:'partial', cut:10, cutBy:'pct'})===90 &&
  strict({bonus:'partial', cut:30, cutBy:'usd'},{bonus:'partial', cut:10, cutBy:'pct'})===70);
t('a missed green day at either office counts; overtime approved at either office counts', env.mergeX([part('a',{mg:'Y'}), part('b',{mg:'N', ot1:true})], p, pr).mg==='Y' &&
  env.mergeX([part('a',{mg:'Y'}), part('b',{mg:'N', ot1:true})], p, pr).ot1===true);
t('one office’s row is left exactly as it was (nothing merged)', (()=>{ const x={w1:12}; return env.mergeX([part('a',x)], p, pr)===x; })());
t('the bonus decided across offices replaces the row’s own (and the Total follows)', env.calc(p, {bonus:'full'}, pr, 0).ppb===0 && env.calc(p, {bonus:'full'}, pr, 0).total===0 &&
  env.calc(p, {bonus:'full'}, pr, 40).total===40);

t('groups: real offices only, never Zihua (nobody sends it), once each, in her sheet’s order; nothing saved = null (her ask applies)',
  JSON.stringify(env.cleanTogether([['b','a','a','nope'],['z','a'],['b'],'junk']))==='[["a","b"]]' && env.cleanTogether(undefined)===null && env.cleanTogether([]).length===0);

/* the page */
t('ON for the live site (hc179, Cory: "together live"); false again = every office its own list and the bonus as before', /const TOGETHER_LIVE=true;/.test(H) &&
  /const TOGON=\(\)=>TOGETHER_LIVE \|\| !\(window\.PH && PH\.isLive && PH\.isLive\(\)\);/.test(H) && /if\(!TOGON\(\)\) return \[\];/.test(fn('togGroups')) &&
  /if\(!TOGON\(\) \|\| !p \|\| \(p\.offices\|\|\[\]\)\.length<2\) return null;/.test(fn('oneBonus')));
t('until she saves her own list, the two Cruces offices are entered together (her ask); her list in settings.json replaces it',
  /const TOG_DEFAULT=\[\['crucesffo','cruceslco'\]\];/.test(H) && /TOGETHER=cleanTogether\(st\.together\);/.test(H) && /x\.together=gs;/.test(fn('togSave')));
t('one bonus: the strictest mark, on their first office’s row (the same on the combined sheet, its totals, History, the lookup and the download)',
  /return \{home:parts\[0\]\.k, amt:Math\.min\(\.\.\.parts\.map\(q=>calc\(p,q\.x,pr\)\.ppb\)\), n:parts\.length\};/.test(fn('oneBonus')) &&
  /calc\(en\.p, x, pr, ob \? \(here \? ob\.amt : 0\) : undefined, !here\)/.test(fn('entryCalc')) && /entryCalc\(n,pr,en\)/.test(fn('combined')) && /entryCalc\(n,pr,en\)/.test(fn('combTotals')) &&
  /entryCalc\(n,pr,en\)/.test(fn('csv')) && /ob \? \(o\.k===ob\.home \? ob\.amt : 0\) : undefined/.test(fn('histList')) && /ob \? \(k===ob\.home \? ob\.amt : 0\) : undefined/.test(fn('lookHTML')));
t('the combined sheet: one section per group, A-Z, a person at both = one row ("2 offices · hours added"), the other row says where the bonus is',
  /sections\(\)\.forEach\(ks=>\{/.test(fn('combined')) && /if\(ks\.length>1\) list\.sort\(\(a,b\)=>byLast\(a\.p,b\.p\)\);/.test(fn('combEntries')) &&
  /' offices · hours added<\/span>'/.test(fn('combined')) && /'<div class="small muted">on '\+esc\(poss\(OFF\[r\.ob\.home\]\.n\)\)\+' row<\/div>'/.test(fn('combined')));
t('…each office keeps its own "Entered in payroll" tick and its own "Not sent yet"', /os\.map\(q=>\{ const t=entTick\(n,q\.k\);/.test(fn('combined')) && /lead=many \? '<b>'\+esc\(q\.n\)\+':<\/b> ' : ''/.test(fn('combined')));
t('…Heather’s Goal / TC/OM / Extra go into the first office’s row; anything typed on the other shows under it and counts',
  /const typed=f=>hin\(hk,p,f,hx\[f\],on\)/.test(fn('combined')) && /en\.parts\.slice\(1\)\.filter\(q=>num\(q\.raw\[f\]\)\)/.test(fn('combined')));
t('the download: one block per group, "entered together", "[Hours added: ...]" and "[PP bonus on ...’s row]" in Notes',
  /' - entered together\)'/.test(fn('csv')) && /'\[Hours added: '/.test(fn('csv')) && /'\[PP bonus on '\+poss\(OFF\[r\.ob\.home\]\.n\)\+' row\]'/.test(fn('csv')));
t('Settings → Entered together: only whoever manages payroll; two different offices; Separate undoes it',
  /if\(!TOGON\(\)\) return '';/.test(fn('togCard')) && /can=holCan\(\)/.test(fn('togCard')) && /\(act==='togadd' \|\| act==='togoff'\) && TOGON\(\) && holCan\(\)/.test(H) &&
  /toast\('Pick two different offices'\)/.test(H));
t('"Listed twice?": the same name at DIFFERENT offices (no two different emails) is offered too - she presses the button, nothing by itself',
  /if\(g\.length>1 && ems\.length<=1 && apart\) add\(g\);/.test(fn('twins')) && /data-act="oneperson" data-v="'\+esc\(twinKey\(g\)\)\+'"/.test(H) && /const g=twins\(\)\.find\(a=>twinKey\(a\)===key\);/.test(fn('makeOne')));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
