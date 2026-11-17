/* DIBS IS A COUNT (17/11/2026).
       node test/paydibs.test.js

   Heather: "the "DIBS" column is supposed to be whatever number she puts in x $10 but it is converting it to $1 ...
   Amanda did the Dibs and it should be worth $30 but it is worth $3." San Angelo types how many; pay = count x $10.
   Phone (Lubbock) and POG (San Angelo) stay dollar amounts. Made-up people. */
const fs=require('fs'), path=require('path');
const R=require(path.join(__dirname,'..','v1','payrules.js'));
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const per={hol:null}, p={start:'2020-01-01'};
const c=x=>R.calc(p, x, per, undefined, 0, {});

t('3 DIBS = $30 (it was $3)', c({dibs:3}).own===30 && c({dibs:3}).total===30);
t('POG and Phone are still dollars', c({pog:25}).own===25 && c({phone:40}).own===40);
t('all three together: 2 DIBS + $25 POG = $45', c({dibs:2, pog:25}).own===45);
t('$10 each unless Settings says otherwise', R.RATES.dibs===10 && R.calc(p, {dibs:3}, per, Object.assign({}, R.RATES, {dibs:12}), 0, {}).own===36 && R.calc(p, {dibs:3}, per, {onCall:50, holiday:100, holidayHrs:8, mile:0.76}, 0, {}).own===30);
t('San Angelo’s DIBS column is a count; POG isn’t (one office list, payrules.js)', /\{k:'dibs',n:'DIBS',each:'dibs'\},\{k:'pog',n:'POG'\}/.test(fs.readFileSync(path.join(__dirname,'..','v1','payrules.js'),'utf8')) && R.OFF.sanangelo.own[0].each==='dibs' && !R.OFF.sanangelo.own[1].each);

t('the page works it out the same way', /own=r2\(num\(x\.phone\)\+num\(x\.dibs\)\*num\(RATE\.dibs\)\+num\(x\.pog\)\)/.test(H) && /let RATE=\{onCall:50, holiday:100, holidayHrs:8, mile:0\.76, dibs:10\};/.test(H));
t('the office’s sheet asks "how many" (DIBS #) and shows the dollars under it', /info\(esc\(c\.n\)\+' #','How many '/.test(H) && /'<div class="small muted">= '\+money\(ownUsd\(c,x\)\)\+'<\/div>'/.test(H));
t('its instructions say "type how many - each one is $10"', /type how many each person did - each one is '\+money\(RATE\[c\.each\]\)/.test(H));
t('Heather’s combined sheet and the download show dollars (with "3 × $10" under it on the sheet)',
  /money\(ownUsd\(col,x\)\)\+\(ownEach\(col\) && num\(x\[col\.k\]\) \? '<div class="small muted">'\+esc\(num\(x\[col\.k\]\)\)\+' × '/.test(H) && /own\.map\(col=>col\.hrs\?\(c\.sick\|\|''\):\(ownUsd\(col,x\)\|\|''\)\)/.test(H));
t('Settings shows the DIBS rate', /<div class="k">DIBS<\/div><div class="v">'\+money\(RATE\.dibs\)/.test(H));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
