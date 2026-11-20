/* TALK TO TYPE - the 🎤 on text boxes (user.js).

       node test/mic.test.js

   20/11/2026. Cory: "We keep seeing the microphone speech to text in random place (this time just floating around the
   new task). I need you to double check everywhere because this is multiple times." Two causes, both closed:
   a page's rule for EVERY button (History: button{margin-top:13px}) reached the 🎤 and pushed it off its box; and the
   🎤 sits over the page, so a box scrolled out of its panel / covered / moved could leave it showing over something
   else. Checked in a real browser on every page at desktop and phone size (193 boxes, 0 problems). */
const fs=require('fs'), path=require('path');
const U=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const css=(/st\.textContent='\.ph-mic\[hidden\][^;]*;[^\n]*\n[^\n]*/.exec(U)||[''])[0];
t('no page style can move it: margin, transform, size, padding, border, transition locked', ['margin:0!important','transform:none!important','transition:none!important','width:26px!important','height:26px!important','padding:0!important','border:0!important','position:fixed!important'].every(s=>css.indexOf(s)>=0));
t('it only shows when the browser says its own box is what is under it', /micBtn\.hidden=!micOnBox\(/.test(U) && /function micOnBox\(cx, cy, r\)\{/.test(U) && /document\.elementsFromPoint\(cx, cy\)/.test(U));
t('...a little thing drawn inside the box (a clear ×) still counts as the box', /u\.left>=r\.left-1 && u\.right<=r\.right\+1/.test(U));
t('it still follows its box every frame, and goes when the box goes or loses the cursor', /if\(!micFor\.isConnected \|\| \(document\.activeElement!==micFor && !micRec\)\)\{ micHide\(\); return; \}/.test(U));
t('never on the TC Tracker, or a box marked data-nomic', /tc\\\.html\$\/\.test\(location\.pathname\)\) return false/.test(U) && /closest\('\[data-nomic\]'\)\) return false/.test(U));
console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
