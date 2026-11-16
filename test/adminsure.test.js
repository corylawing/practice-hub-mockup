/* GIVING SOMEONE ADMIN ASKS FIRST (16/11/2026).
       node test/adminsure.test.js

   Heather made an office manager a full Admin by accident - one tap on that person's Admin line in Admin -> People -
   and Payroll then tried to open every office for them. Cory: "we should have a confirmation when giving someone admin
   access". Every way of making someone a full Admin now asks first; Cancel changes nothing; taking Admin away and
   changes that don't make anyone an Admin never ask. Made-up people only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','v1','admin.html'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fn=name=>{ const i=H.indexOf('function '+name+'('); if(i<0) return ''; const j=H.indexOf('\n  function ', i+10), k=H.indexOf('\n  /* ', i+10); return H.slice(i, Math.min(j<0?1e9:j, k<0?1e9:k)); };

/* The helpers, run for real against a made-up team grid. */
const helpers=H.slice(H.indexOf('const isAdm='), H.indexOf('  function pickUserLevel('));
const asked=[]; let answer=true;
const ctx={ asked, confirm:m=>{ asked.push(m); return answer; },
  users:[{f:'Avery',l:'Brooks',teams:['Office Managers']},{f:'Quinn',l:'Quill',teams:['Office Managers','TCs']},{f:'Rowan',l:'Reed',teams:['Admin']}],
  access:{ 'Admin':{admin:'manage'}, 'Office Managers':{admin:'none'}, 'TCs':{admin:'none'}, 'Executive Team':{admin:'manage'} },
  rank:{none:0,view:1,add:2,edit:3,manage:4}, allSections:()=>[{k:'admin'}] };
vm.createContext(ctx);
vm.runInContext('function userAccess(u){ const out={}; allSections().forEach(s=>{let best="none"; u.teams.forEach(t=>{const lv=(access[t]||{})[s.k]||"none"; if(rank[lv]>rank[best])best=lv;}); out[s.k]=best;}); return out; }\n'+
  helpers+'\nthis.adminWith=adminWith; this.sureAdmin=sureAdmin; this.isAdm=isAdm;', ctx);

t('Office Managers alone is not Admin; adding the Admin team, or Executive Team (Admin in this grid), is',
  !ctx.adminWith(['Office Managers']) && ctx.adminWith(['Office Managers','Admin']) && ctx.adminWith(['Executive Team']));
t('a person’s own Admin setting wins over their teams, both ways',
  ctx.adminWith(['Office Managers'], {admin:'manage'}) && !ctx.adminWith(['Admin'], {admin:'none'}) && ctx.adminWith(['Admin'], {marketing:'edit'}));
asked.length=0; answer=false;
t('Cancel says no', ctx.sureAdmin('Avery Brooks')===false && asked.length===1);
t('the question names the person and says what a full Admin can do',
  /^Make Avery Brooks a full Admin\?/.test(asked[0]) && /see and change everything in Home-Brace, for every office/.test(asked[0]) && /everyone’s access/.test(asked[0]) && /Only do this on purpose/.test(asked[0]));
asked.length=0; answer=true;
t('for a whole team it names the team and how many people are on it', ctx.sureAdmin('Office Managers', true)===true && /^Make everyone on the Office Managers team \(2 people\) a full Admin\?/.test(asked[0]));
asked.length=0;
t('a new person with no name yet is "this person"', ctx.sureAdmin('')===true && /^Make this person a full Admin\?/.test(asked[0]));

/* Wiring: each of the four ways in asks before it changes anything, and only when it makes someone an Admin. */
const pick=fn('pickUserLevel'), tog=fn('togTeam'), np=fn('npTeam'), grid=fn('pickLevel');
t('a person’s own Admin line: asks only going from not-Admin to Full control, before anything is set',
  /if\(k==='admin' && isAdm\(v\) && !isAdm\(cur\) && !sureAdmin\(\[u\.f,u\.l\]\.filter\(Boolean\)\.join\(' '\)\)\) return;\n        tmpU\.access=tmpU\.access\|\|\{\};/.test(pick));
t('adding a person to a team that makes them Admin asks first (their own setting counted); removing a team never asks',
  /if\(i<0 && !adminWith\(tmpU\.teams, tmpU\.access\) && adminWith\(tmpU\.teams\.concat\(\[t\]\), tmpU\.access\)\)\{\n      const u=users\[tmpU\.gi\]\|\|\{\}; if\(!sureAdmin\(\[u\.f,u\.l\]\.filter\(Boolean\)\.join\(' '\)\)\) return; \}\n    if\(i>=0\)tmpU\.teams\.splice\(i,1\); else tmpU\.teams\.push\(t\);/.test(tog));
t('a new person’s teams: same', /if\(i<0 && !adminWith\(newP\.teams\) && adminWith\(newP\.teams\.concat\(\[t\]\)\) && !sureAdmin\(String\(newP\.name\|\|''\)\.trim\(\)\)\) return;\n    if\(i>=0\) newP\.teams\.splice/.test(np));
t('a whole team’s Admin column: asks before the grid is changed or saved',
  /v=>\{ if\(k==='admin' && isAdm\(v\) && !isAdm\(access\[t\]\[k\]\|\|'none'\) && !sureAdmin\(t, true\)\) return;\n           access\[t\]\[k\]=v; saveAccess\(t,k\);/.test(grid));
t('Admin is still one level (None / Full control), so "manage" is the only way in', /admin:\['none','manage'\]/.test(H));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
