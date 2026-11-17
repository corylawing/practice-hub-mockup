/* EVERY OTHER PERSON IN THE OFFICE'S COLOR (17/11/2026).
       node test/paystripes.test.js
   Heather: "every other person's line could be a different color ... to follow a line easily when I am looking back
   and forth entering payroll." Cory: the office's color from the Schedule (Admin -> Locations). */
const fs=require('fs'), path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','v1','payroll.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
t('each office heading’s strip is the office’s own Schedule color, a neutral grey for an office without one (Zihua)',
  /PH\.colorForOffice\(OFF\[o\] \? OFF\[o\]\.n : o\)/.test(H) && /'--obg:'\+\(\(c && c\.bg\) \|\| '#F1F5F9'\)\+';--odot:'\+\(\(c && c\.dot\) \|\| '#94a3b8'\)/.test(H));
t('Heather’s combined sheet: every second person of each office (counting only people with a row)',
  /h\+='<tr class="pr'\+\(\(ri\+\+\)%2\?' alt':''\)\+'" style="'\+tint\+'"><td class="nm"><b>'/.test(H) && /let sub=\{reg:0,ot1:0,ot2:0,total:0,reimb:0\}, ri=0; const tint=offTint\(o\.k\);/.test(H));
t('the office’s own sheet too', /h\+='<tr data-row="'\+p\.id\+'" class="pr'\+\(i%2\?' alt':''\)\+'" style="'\+tint\+'"><td class="nm">'/.test(H));
t('each office’s heading on the combined sheet gets a strip of its color', /<td class="co" colspan="'\+NC\+'" style="'\+offTint\(o\.k\)\+'">/.test(H) && /table\.comb td\.co \.stick\{border-left:5px solid var\(--odot,transparent\);margin-left:-8px;padding-left:8px\}/.test(H));
t('white, the office’s color, white, the office’s color - name column included; the row under the pointer stands out',
  /table\.t tr\.pr\.alt td, table\.t tr\.pr\.alt \.nm\{background:color-mix\(in srgb, var\(--odot,#94a3b8\) 14%, var\(--obg,#F4F6F8\)\)\}/.test(H) && /table\.t tr\.pr:hover td, table\.t tr\.pr:hover \.nm\{background:color-mix\(in srgb, var\(--odot,#94a3b8\) 30%, #fff\);box-shadow:inset 0 2px 0 var\(--odot/.test(H));
t('the name column stays put while the sheet scrolls across (both sheets)', /table\.sheet \.nm\{position:sticky;left:0;/.test(H) && /table\.comb \.nm\{position:sticky;left:0;/.test(H));
console.log(ok.map(s=>'  PASS  '+s).join('\n')); if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed'); process.exit(bad.length?1:0);
