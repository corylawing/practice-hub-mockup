/* ADD TO PAYROLL (12/11/2026) - the rules that keep it private and right.
       node test/payadds.test.js

   Heather: "a place to write it so I don't forget to add it to their payroll" - team-goal bonuses and other special
   pay, for one person, an office, or every office. The list lives in her own folder (adds.json); what's on it is
   worked out onto that pay period's combined sheet when it's drawn, never written into an office's file. Checked
   end to end in a browser (mock-up + Real version, made-up people): office bonus on every row of that office, an
   "everyone" bonus once for someone at two offices, Total and the download, take off / bring back, reload. These
   hold the page to it. */
const fs=require('fs'), path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) return ''; const j=H.indexOf('\n  function ', i+10), k=H.indexOf('\n  /* ', i+10); return H.slice(i, Math.min(j<0?1e9:j, k<0?1e9:k)); };

t('Heather’s side adds it up with the list: the combined sheet, its running totals, History and the download',
  /calc\(p,withAdds\(n,o\.k,p,x\),pr\);\n        sub\.reg/.test(H) && /calc\(p,withAdds\(n,o\.k,p,x\),pr\); st\+=c\.total/.test(fn('combTotals')) &&
  /calc\(p,withAdds\(n,o\.k,p,x\),pr\); hours\+=/.test(fn('histList')) && /calc\(p,withAdds\(n,o\.k,p,x\),pr\), an=addsNote/.test(fn('csv')));
t('an office’s own sheet never does (they never see pay added on Heather’s side)', /const x=s\.rows\[p\.id\]\|\|blank\(\), c=calc\(p,x,pr\);/.test(fn('sheetTable')) && !/withAdds|addLines|addsCard/.test(fn('sheetTable')+fn('viewOmSheet')+fn('viewOmPast')));
t('the list is read from Heather’s folder, and only when this person isn’t a sender',
  /lv==='send' \? null : Promise\.all\(\[store\('_h'\)\.get\('settings'\), store\('_h'\)\.getAll\('cols_', \{partial:true, only:isRecent\}\), store\('_h'\)\.get\('adds'\)\]\)/.test(H));
t('it is saved in Heather’s folder only (adds.json), never in an office file', /liveQueue\('_h', 'adds',/.test(H) && (H.match(/'adds'/g)||[]).length===2);
t('withAdds never changes the row it is given (a copy is added up)', /const y=Object\.assign\(\{\}, x\);/.test(fn('withAdds')) && !/x\[a\.col\]\s*=/.test(fn('withAdds')));
t('taking one off only marks it - nothing is deleted', /i\.gone=gone; i\.goneBy=by;/.test(H) && !/\.items\.splice|items=.*filter\(/.test(H.slice(H.indexOf('function liveAdds'), H.indexOf('function liveAdds')+600)));
t('a pay period marked entered can’t be changed', /if\(n!==null && enteredOf\(n\)\)\{ toast\('That pay period is entered - reopen it first'\)/.test(H) && /if\(!enteredOf\(m\)\) out\.push\(m\)/.test(fn('addPeriods')));
t('read-only payroll (See) gets the list without any buttons', /\(ro \|\| e \? '' : '<button class="btn sm" data-act="addnew">/.test(fn('addsCard')) && /\(ro\|\|e\?'':'<button class="link small" data-act="addrm"/.test(fn('addsCard')));
t('"everyone" means the 8 offices, once per person (the first office’s row whose sheet is in) - not Zihua Partners',
  /OFFICES\.find\(o=>!o\.self && p\.offices\.indexOf\(o\.k\)>=0 && get\(n,o\.k\)\.status==='sent' && get\(n,o\.k\)\.rows\[p\.id\]\)/.test(H) && /if\(t\.k==='all'\) return !!OFF\[o\] && !OFF\[o\]\.self && homeRow\(n,p\)===o;/.test(H));
t('only Goal, TC/OM or Extra, only a positive amount, and what it’s for is escaped wherever it shows',
  /ADD_COLS=\[\['goal','Goal'\],\['tcom','TC\/OM'\],\['extra','Extra'\]\]/.test(H) && /num\(a\.amt\)>0 && ADD_COLS\.some/.test(H) && /esc\(a\.what\)/.test(H) && !/\+a\.what\+'</.test(H));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
