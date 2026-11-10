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
