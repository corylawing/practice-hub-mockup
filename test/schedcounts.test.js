/* SCHEDULE: MONTH ARROWS ON THE COUNTS (Heather 18/11/2026).
       node test/schedcounts.test.js
   Heather: "I often need to see the chart of the days covered per office and scroll through the months. I find that I
   have to go back up to the top to scroll through the months then go down the page halfway to look at this chart." */
const fs=require('fs'), path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','v1','schedule.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=H.indexOf('{', i);
  for(let k=j;k<H.length;k++){ if(H[k]==='{') d++; else if(H[k]==='}'){ d--; if(!d) return H.slice(i, k+1); } } return ''; };
const rc=fn('renderCounters'), cs=fn('countStep');
t('the counts have their own ‹ month › right above them', /<div class="cntbar"><h2>Doctor days and coverage<\/h2><div class="nav2">/.test(rc) && /PS\.countStep\(-1\)/.test(rc) && /PS\.countStep\(1\)/.test(rc) && /MOFULL\[mM\]\+' '\+mY/.test(rc));
t('…a whole month either way (also in Week view), the year rolls over, the whole page follows (the top arrows show the same month)',
  /let y=mY, m=mM\+n; if\(m<0\)\{ m=11; y--; \} if\(m>11\)\{ m=0; y\+\+; \}/.test(cs) && /if\(view==='week'\) anchor=mondayOf\(new Date\(y,m,1\)\);/.test(cs) && /refresh\(\);/.test(cs));
t('…and the counts stay where they are on the screen (the calendar above is 4, 5 or 6 weeks tall)', /const box=el\('counters'\), y0=box\.getBoundingClientRect\(\)\.top;/.test(cs) &&
  /window\.scrollBy\(0, el\('counters'\)\.getBoundingClientRect\(\)\.top-y0\);/.test(cs));
t('PS.countStep is there for the buttons', /pickMonth,goMonth,jumpTo,countStep,/.test(H));
console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
