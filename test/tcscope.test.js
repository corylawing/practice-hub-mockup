/* TC TRACKER: WHOSE CONSULTS SHOW IS WORKED OUT AGAIN WHEN WHO-YOU-ARE ARRIVES (23/11/2026, Hobbs).
       node test/tcscope.test.js

   A TC whose offices come from the roster is "no offices" for the first moment after sign-in. The read used to filter
   the consults with that empty list and keep the result: Today stayed empty all morning (only what she added in that
   sitting showed), though every consult was saved. Now rescope() runs after the read and on every identity change.
   Runs tc.html's own rescope() and checks load() and TCPAGE.identity use it. Made-up consults only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ok=[], bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const H=fs.readFileSync(path.join(__dirname,'..','v1','tc.html'),'utf8');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };

const RS=fnOf(H,'rescope'), LD=fnOf(H,'load');
t('rescope() exists', !!RS);
t('load() keeps its consults through rescope() (not a filter frozen at the read)', LD.indexOf('rescope();')>0 && !/ALL=EVERY\.filter\(r=>offs/.test(LD));
t('TCPAGE.identity re-scopes before drawing', /identity:\(\)=>\{[^}]*rescope\(\);[^}]*render\(\);/.test(H));
t('ph-identity and ph-signed-in both call TCPAGE.identity', /ph-identity',function\(\)\{if\(window\.TCPAGE\)TCPAGE\.identity\(\)/.test(H) && /ph-signed-in',function\(\)\{[^<]*TCPAGE\.identity\(\)/.test(H));

/* the morning: the read lands while her offices are still unknown, then the roster arrives */
const w={mine:[], ALL:[], EVERY:[]};
vm.createContext(w);
vm.runInContext('var myOffices=()=>mine;\n'+RS, w);
const c=(id,office,date)=>({id, office, date, time:'09:00', tc:'Dana Ruiz'});
w.EVERY=[c('a1','Hobbs','2026-11-23'), c('a2','Hobbs','2026-11-23'), c('a3','Carlsbad','2026-11-23'), c('a4','Hobbs','2026-11-19')];
vm.runInContext('rescope()', w);
t('offices not known yet: shows nothing (and says nothing wrong is saved)', w.ALL.length===0);
w.mine=['Hobbs']; vm.runInContext('rescope()', w);
t('roster lands: every Hobbs consult shows, Carlsbad stays out', w.ALL.map(r=>r.id).join()==='a1,a2,a4');
t('Today (23rd) has both consults logged days ahead', w.ALL.filter(r=>r.date==='2026-11-23').length===2);
w.mine=['Hobbs','Carlsbad']; vm.runInContext('rescope()', w);
t('a second office added later shows too', w.ALL.length===4);
w.mine=[]; vm.runInContext('rescope()', w);
t('nothing is removed from the read itself (EVERY untouched)', w.EVERY.length===4);

console.log(ok.length+' passed, '+bad.length+' failed'); bad.forEach(n=>console.log('  FAIL '+n)); process.exit(bad.length?1:0);
