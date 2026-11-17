/* CHAT FOLLOWS ADMIN'S OFFICES AND TEAMS (17/11/2026).
       node test/chatlists.test.js
   Cory: "If another office is added it would have to add to the entire workflow" / "Everything we build needs to be
   scalable". Chat's "New chat" listed 8 offices and 5 teams typed into the page; now Admin's own lists. */
const fs=require('fs'), path=require('path');
const C=fs.readFileSync(path.join(__dirname,'..','v1','chat.html'),'utf8'), U=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
t('user.js gives the teams as Admin has them (the access grid) next to the offices (Locations)',
  /const teamNames=\(\)=>Object\.keys\(\(ACCESS && typeof ACCESS==='object' && !Array\.isArray\(ACCESS\)\) \? ACCESS : \{\}\)/.test(U) && /officeNames,teamNames,/.test(U) && /const officeNames=\(\)=>locations\(\)\.map\(l=>l\.n\);/.test(U));
t('New chat uses them - a new office or team shows up by itself', /const offices=fromAdmin\('officeNames'\)\.length \? fromAdmin\('officeNames'\)/.test(C) && /const teams=fromAdmin\('teamNames'\)\.length \? fromAdmin\('teamNames'\)/.test(C));
t('…the typed lists are only a stand-in until Admin’s have been read', /: \['Carlsbad','Clovis','Hobbs','Lubbock','San Angelo','Mansfield','Cruces FFO','Cruces LCO'\];/.test(C));
// run teamNames for real
const src=U.slice(U.indexOf('  const teamNames=()=>'), U.indexOf('\n', U.indexOf('  const teamNames=()=>')));
const run=a=>{ const ACCESS=a; return eval(src.replace('const teamNames=','(').replace(/;\s*$/,'')+')')(); };
t('teams: every team in the grid, in its order; nothing before it’s been read', run({'Executive Team':{}, 'Office Managers':{}, 'Newteam':{}}).join()==='Executive Team,Office Managers,Newteam' && run(null).length===0 && run([]).length===0);
console.log(ok.map(s=>'  PASS  '+s).join('\n')); if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed'); process.exit(bad.length?1:0);
