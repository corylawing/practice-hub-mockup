/* A NEW OFFICE IN PAYROLL (17/11/2026).
       node test/payoffices.test.js

   Cory: "If another office is added it would have to add to the entire workflow" ... "be very careful we don't mess
   anything up". The 9 offices never change; an office from Admin -> Locations is added in Payroll -> Settings and kept
   in the shared list 'ph_pay_offices'. The access sync never drops a folder it has given access on just because a list
   didn't have it (the 12/11 lesson: 8 office managers lost their folders to a sync from an old list). Made-up people. */
const fs=require('fs'), path=require('path');
const R=require(path.join(__dirname,'..','v1','payrules.js'));
const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const H=read('payroll.html'), A=read('admin.html'), U=read('user.js');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const B='Home-Brace Payroll', NAMES9='Carlsbad,Hobbs,Lubbock,Clovis,San Angelo,Zihua Partners,Mansfield,Cruces FFO,Cruces LCO';

t('the 9 offices are exactly as they were, in her sheet’s order, with the same keys', R.BASE_OFFICES.map(o=>o.n).join()===NAMES9 &&
  R.BASE_OFFICES.map(o=>o.k).join()==='carlsbad,hobbs,lubbock,clovis,sanangelo,zihua,mansfield,crucesffo,cruceslco' && R.OFFICES.map(o=>o.n).join()===NAMES9);
t('the payroll page has no list of its own any more - it uses this one', !/\{k:'carlsbad',  n:'Carlsbad'/.test(H) && /let OFFICES=PR\.OFFICES\.slice\(\), OFF=/.test(H));
t('Locations offices Payroll doesn’t have yet = the new ones (any case, once each)', R.newOffices(['Carlsbad','newtown','Newtown','CRUCES FFO','',null,'Newtown']).join()==='newtown,Newtown');

const rec={add:[{k:'xnewtown', n:'Newtown', co:'Farnsworth Newtown PLLC', by:'TC'}, {k:'xcarlsbad', n:'Carlsbad'}, {k:'xab', n:'a/b'}, {k:'oops', n:'Oops'},
  {k:'xnewtown', n:'Newtown'}, {k:'xlong', n:'Long', co:'x'.repeat(300), by:'boss'}]};
const c=R.cleanOffices(rec);
t('only a sound new office is kept: not one of the 9’s names, a folder-safe name, its own key, once; company name capped; "who sends" from the list',
  c.add.map(o=>o.n).join()==='Newtown,Long' && c.add[1].co.length===120 && c.add[1].by==='office manager' && c.add[0].by==='TC');
R.setOffices(rec);
t('added: the 9 first, unchanged, then the new office - in the list, the lookup and the sync’s own list',
  R.OFFICES.slice(0,9).map(o=>o.n).join()===NAMES9 && R.OFFICES[9].n==='Newtown' && R.OFF.xnewtown && R.OFF.xnewtown.co==='Farnsworth Newtown PLLC' && R.OFF.carlsbad.k==='carlsbad');
const roster=[{email:'priya.tatum@example.com', teams:['Admin']}, {email:'avery.brooks@example.com', teams:['Office Managers']}];
const roleOf=teams=>teams.indexOf('Admin')>=0 ? 'write' : '';
let w=R.wanted(B, roster, roleOf, {'Newtown':['avery.brooks@example.com']}, R.syncOffices(B, {}, 'Heather'));
t('a new office’s folder: whoever manages payroll and its sender get it', w.want[B+'/Newtown'] && w.want[B+'/Newtown']['priya.tatum@example.com']==='write' && w.want[B+'/Newtown']['avery.brooks@example.com']==='write');

// the safety: the list didn't load this time (only the 9), but access was given on Newtown before
R.setOffices(null);
const record={[B]:{'priya.tatum@example.com':'write'}, [B+'/Newtown']:{'priya.tatum@example.com':'write','avery.brooks@example.com':'write'}, [B+'/Heather']:{}};
const offs=R.syncOffices(B, record, 'Heather');
w=R.wanted(B, roster, roleOf, {'Newtown':['avery.brooks@example.com']}, offs);
t('THE SAFETY: a folder access was given on stays in the sync even when the office list didn’t have it - its sender keeps access',
  offs.indexOf('Newtown')>=0 && w.want[B+'/Newtown'] && w.want[B+'/Newtown']['avery.brooks@example.com']==='write');
t('…Heather’s own folder is never one of them, and nothing outside the payroll folder is', offs.indexOf('Heather')<0 &&
  R.syncOffices(B, {'Other/Place':{}, [B+'/x/y']:{}}, 'Heather').join()===NAMES9);
t('with nothing added, the sync looks at exactly the 9 it always did', R.syncOffices(B, {[B]:{}, [B+'/Carlsbad']:{}}, 'Heather').join()===NAMES9);

t('the payroll page reads the office list BEFORE any folder (a new office’s folder is one of them)',
  /LIVE\.loading=true; LIVE\.err=''; render\(\);\n    loadOffices\(\)\.then\(\(\)=>liveLoadNow\(lv\)\);/.test(H) && /PH_STORE\.get\(PR\.OFF_KEY\) : null\)\.then\(x=>\{ useOffices\(x\); \}/.test(H));
t('both access syncs (Payroll’s and Admin’s): the office list must have read, and every folder ever given access on stays in',
  /PH_DOCS\.syncBlocked\(\['ph_access','ph_people','ph_pay_senders','ph_paygrants', PR\.OFF_KEY\]\)/.test(H) && /PR\.syncOffices\(B, rec, PH_DOCS\.PAY_PRIVATE\)/.test(H) &&
  /PH_DOCS\.syncBlocked\(\['ph_access','ph_people','ph_pay_senders','ph_paygrants', PAYRULES\.OFF_KEY\]\)/.test(A) && /PAYRULES\.syncOffices\(B, rec, PH_DOCS\.PAY_PRIVATE\)/.test(A) &&
  /PH_STORE\.get\(PAYRULES\.OFF_KEY\)\.then\(x=>\{ PAYRULES\.setOffices\(x\); \}/.test(A));
t('the bell’s reminders know an added office too', /window\.PH_STORE\.get\('ph_pay_offices'\)/.test(U) && /r\[0\]\.setOffices\(r\[3\]\)/.test(U));
t('Settings: a new office from Locations is offered only to whoever manages payroll, with its company name (required) and who usually sends it',
  /function newOfficeCard\(\)\{\n    if\(!holCan\(\)\) return '';/.test(H) && /if\(!co\)\{ toast\('Type its company name first/.test(H) && /PR\.BYS\.map\(b=>'<option/.test(H));
t('…a name SharePoint can’t use for a folder is refused with a plain reason', /change it in Admin → Locations first/.test(H) && /if\(newOfficeNames\(\)\.indexOf\(n\)<0 \|\| !PR\.SAFE_NAME\.test\(n\)\) return;/.test(H));
t('…adding makes its folder at once, and a save that doesn’t reach SharePoint changes nothing and says so',
  /PAYSTORE\.ensure\(\[n\]\)/.test(H) && /e=>toast\('Not added - '\+\(\(e && e\.message\) \|\| 'check the connection'\)\+'\. Nothing changed\.'\)/.test(H));
t('the mock-up keeps added offices in its own state', /useOffices\(S\.offExtra\); \}/.test(H) && /S\.offExtra=put\(S\.offExtra\); save\(\);/.test(H));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
