/* LOADING SCREEN (10/11/2026): one Home-Brace loading screen on every page until its data is in, so nobody sees
   zeros first. Source checks - the timing itself was checked in a browser. Run: node test/loading.test.js */
const fs=require('fs'), path=require('path');
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const U=read('user.js');
t('the screen sits under the sign-in screen (gate.js z 99999)', /#phload\{position:fixed;inset:0;z-index:99990/.test(U) && /#phgate\{position:fixed;inset:0;z-index:99999/.test(read('gate.js')));
t('it hangs off <html>, so gate.js hiding the body does not hide it', /document\.documentElement\.appendChild\(el\)/.test(U));
t('at least half a second, never more than 12', /LOAD_MIN=500, LOAD_MAX=12000/.test(U) && /LOAD\.cap=setTimeout\(loadHide, LOAD_MAX\)/.test(U));
t('on live it waits for sign-in AND the team list / access', /if\(SIGNED_IN && !stillLearning\(\)\) loadDone\('who'\)/.test(U));
t('the sandbox (or a page without sign-in) does not wait for anyone', /if\(!isLive\(\) \|\| !document\.querySelector\('script\[src\*="gate\.js"\]'\)\) loadDone\('who'\)/.test(U));
t('pages can hold it', /loadHold, loadDone\}/.test(U));
// Only the page's own part (10/11/2026, Cory: "just the part of Home-Brace that will show the screen loads so you still see the apps").
t('it covers the content only: right of the sidebar, under the top header and tabs, above the phone bar', /left=Math\.round\(side\.right\)/.test(U) && /\['\.hdr','\.v1nav'\]\.forEach/.test(U) && /bottom=Math\.max\(0, Math\.round\(H-bar\.top\)\)/.test(U));
t('while sign-in is checked with no menu to trust yet: the whole window - except the sidebar\'s place', /const menuOk=body && \(!gated \|\| \(!!NAVSNAP && isLive\(\)\)\);/.test(U) && /else if\(!menuOk\)\{ if\(wantSide\) left=SIDE_W; \}/.test(U));
t('fitted again whenever gate.js shows or hides the page, after sign-in, and on resize', /new MutationObserver\(loadFit\)\.observe\(document\.body, \{attributes:true, attributeFilter:\['class'\]\}\)/.test(U) && /'ph-signed-in', function\(\)\{ loadMsg\(\); loadFit\(\);/.test(U) && /window\.addEventListener\('resize', loadFit\)/.test(U));
t('a fit that goes wrong never breaks the page', /function loadFit\(\)\{[\s\S]{0,200}try\{[\s\S]*?\}catch\(_\)\{\}\s*\}/.test(U));
// The sidebar stays still (10/11/2026, Cory: "screen loads then side bar pops from the left").
t('with the Sidebar menu, the loading screen never covers the sidebar\'s place - not even while sign-in is checked', /else if\(!menuOk\)\{ if\(wantSide\) left=SIDE_W; \}/.test(U) && /if\(!left && wantSide\) left=SIDE_W;/.test(U) && /LOAD\.el=el; loadMsg\(\); loadFit\(\);/.test(U));
t('...it draws the sidebar\'s empty panel over the not-yet-ready one (z 47 over 45/46), nothing about anyone in it', /#phload-side\{position:fixed;top:0;left:0;bottom:0;width:'\+SIDE_W\+'px;z-index:47;/.test(U) && /phls-brand"><img src="'\+LOAD\.logo\+'" alt="" width="34" height="34"><span>Home-<i>Brace<\/i><\/span><\/div>'/.test(U));
t('...and steps aside once sign-in is done (not if it started again meanwhile), and goes with the loading screen', /if\(b && b\.classList && !b\.classList\.contains\('phgated'\)\) loadSide\(false\);/.test(U) && /removeChild\(el\); loadSide\(false\); \}, 420\)/.test(U));
t('...only with the Sidebar menu on a wide window, on a page that has the menu', /classList\.contains\('ph-lay-side'\)\) && \(window\.innerWidth\|\|0\)>=960 &&\s*\(!LOAD\.parsed \|\| !!document\.querySelector\('\.v1nav'\)\)/.test(U));
// The menu stays put between pages (10/11/2026, Cory: "the different tabs flash away for a second").
t('the menu a settled page showed (apps + name button) is kept for this browser tab only, with whose it is', /sessionStorage\.setItem\(NAVSNAP_KEY/.test(U) && !/localStorage\.setItem\(NAVSNAP_KEY/.test(U) && /const snap=\{v:1, who, all:/.test(U) && /if\(!isLive\(\) \|\| stillLearning\(\)\) return;/.test(U));
t('the next page draws it only while it is still finding out (live), in the tabs, the sidebar, the phone bar and the chat button', /const snapping=\(\)=>\{ try\{ return !!NAVSNAP && isLive\(\) && stillLearning\(\);/.test(U) &&
  /host\.innerHTML=navShown\(\)\.map/.test(U) && /'<nav class="ph-sb-list">'\+navShown\(\)\.map/.test(U) && /const items=navShown\(\);/.test(U) && /navShown\(true\)\.indexOf\(chatEntry\)>=0/.test(U));
t('it never decides what anyone may open (guard and the page checks use the real answer)', /const allowed=!entry \|\| entry\.show\(\);/.test(U) && !/navShown\(\)[^\n]*guard|guard[^\n]*navShown/.test(U));
t('once known, the real menu and name replace it, and it is kept again', /if\(!snapping\(\)\)\{ unsnapBar\(\); if\(isLive\(\) && !stillLearning\(\)\) setTimeout\(saveNavSnap, 0\); \}/.test(U));
t('someone else signs in on the tab: forgotten at once, never their apps or name', /if\(NAVSNAP && NAVSNAP\.who!==em\)\{ NAVSNAP=null; try\{ sessionStorage\.removeItem\(NAVSNAP_KEY\); \}catch\(_\)\{\} nav\(NAV_ACTIVE\); unsnapBar\(\); \}/.test(U));
t('nothing slides: the loading screen keeps its place (no moving transition)', !/#phload\.fit\{/.test(U) && !/top \.32s ease, left \.32s ease/.test(U));
// Every page that reads the practice's data holds it, and lets go on success AND failure.
const pages={
  'index.html':[/PH\.isLive\(\)\) PH\.loadHold\('page'/, /\.then\(pageDone, pageDone\)/],
  'production.html':[/PH\.isLive\(\)\) PH\.loadHold\('page'/, /\.then\(pageDone, pageDone\)/],
  'tc.html':[/PH\.loadHold\('page'/, /\.then\(pageDone, pageDone\)/],
  'payroll.html':[/PH\.loadHold\('page'/, /render\(\); payDone\(\); return; \}/, /per=HOME\(\); render\(\); payDone\(\);/, /SharePoint didn’t answer\.'; render\(\); payDone\(\);/],
  'schedule.html':[/PH\.loadHold\('page'/, /booted=true;\n\s*if\(window\.PH && PH\.loadDone\) PH\.loadDone\('page'\);/],
  'marketing.html':[/PH\.loadHold\('page'/, /finally \{ if\(window\.PH && PH\.loadDone\) PH\.loadDone\('page'\)/, /\.catch\(function\(\)\{ if\(window\.PH && PH\.loadDone\) PH\.loadDone\('page'\)/]
};
Object.keys(pages).forEach(f=>{ const s=read(f); t(f+': holds the screen and lets go', pages[f].every(re=>re.test(s))); });
// Every page with the menu loads user.js in <head>, so the screen is up before anything draws.
['home','index','production','payroll','schedule','tc','marketing','documents','team','admin','academy','chat'].forEach(n=>{
  const s=read(n+'.html'); t(n+'.html: user.js before <body>', s.indexOf('src="user.js')>0 && s.indexOf('src="user.js')<s.indexOf('<body'));
});
console.log(pass+' passed, '+fail+' failed'); if(fail) process.exit(1);
