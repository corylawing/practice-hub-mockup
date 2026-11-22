/* CODE REVIEW FIXES (21/11/2026).   node test/codereview-mkt.test.js
   Marketing: escaping, card ids, "Where I'll be" shared, office names in data-o, offices read fresh. Monthly: saves keep
   the office/month/typed numbers they started with, a refused save isn't "Saved", failed reads are said, streaks read
   back far enough, one office-month changed on top of what is stored. OrthoFi page: no save over a failed read.
   Period picker: the practice's Central today, year to date by month and day (leap years). Made-up values only. */
const fs=require('fs'), path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const MK=read('marketing.html'), P=read('monthly.html'), OF=read('orthofi.html'), INS=read('insights.html');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0; const j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };

/* ---------- MARKETING ---------- */
t('board card: title, owner and result are escaped like every other view',
  /'<div class="kt">'\+esc\(c\.title\)\+'<\/div>'/.test(MK) && /'👤 '\+esc\(c\.owner\)/.test(MK) && /class="res '\+esc\(c\.result\)\+'"/.test(MK) &&
  !/'<div class="kt">'\+c\.title/.test(MK) && !/'👤 '\+c\.owner/.test(MK));
t('a card id goes into markup only as a number', !/'\+c\.id\+'/.test(MK) && /const nid=c=>Number\(c\.id\);/.test(MK));
{ const cards=[{id:5}];
  const newId=new Function('cards', 'let lastId=0; '+fnOf(MK,'newId')+'; return newId;')(cards);
  const ids=[]; for(let i=0;i<50;i++){ const id=newId(); ids.push(id); cards.push({id}); }
  t('new card ids: time + random, unique even in a burst, safe integers, never a card already here',
    new Set(ids).size===50 && ids.every(Number.isSafeInteger) && ids[0]>Date.now()*999 && ids.every((x,i)=>!i || x>ids[i-1]) &&
    !/id:\+\+seq,title:''/.test(MK) && /\{id:newId\(\)\}/.test(MK) && /const c=\{id:newId\(\),title:''/.test(MK)); }
{ const isObj=x=>!!x && typeof x==='object' && !Array.isArray(x);
  const addWhere=new Function('isObj', fnOf(MK,'addWhere')+'; return addWhere;')(isObj);
  const whereWith=new Function('isObj', fnOf(MK,'whereWith')+'; return whereWith;')(isObj);
  const shared={'2026-12-01':{Ann:'Hobbs'}}, old={'2026-12-01':{Ann:'Carlsbad', Cal:'Clovis'}, '2026-12-03':{Bo:'Lubbock'}, junk:5};
  const m=addWhere(shared, old);
  t('"Where I\u2019ll be": this browser\u2019s old entries are ADDED to the shared copy, never over it', m['2026-12-01'].Ann==='Hobbs' && m['2026-12-01'].Cal==='Clovis' && m['2026-12-03'].Bo==='Lubbock' && !m.junk && shared['2026-12-01'].Cal===undefined);
  t('...and with nothing shared yet, the old entries are the starting value', JSON.stringify(addWhere(undefined, {'2026-12-03':{Bo:'Lubbock'}}))==='{"2026-12-03":{"Bo":"Lubbock"}}');
  const w=whereWith(m, '2026-12-03', 'Bo', ''), w2=whereWith(w, '2026-12-05', 'Jess', "O'Brien");
  t('...a pick changes only that person\u2019s day, on top of what is saved now (an empty day goes)', !w['2026-12-03'] && w['2026-12-01'].Ann==='Hobbs' && w2['2026-12-05'].Jess==="O'Brien" && m['2026-12-03'].Bo==='Lubbock'); }
t('..."Where I\u2019ll be" is read from and saved to the shared store (update), once moved from this browser',
  /PH_STORE\.get\(WKEY\)/.test(MK) && /PH_STORE\.update\(WKEY, cur=>addWhere\(cur, old\)\)/.test(MK) && /PH_STORE\.update\(WKEY, cur=>whereWith\(cur,iso,me,office\)\)/.test(MK) &&
  /const WMOVED='ph_mktgwhere_moved';/.test(MK) && !/saveWhere/.test(MK) && /loadWhere\(\);/.test(MK));
t('office names travel in data-o / data-n, never inside an onclick\u2019s quotes',
  /onclick="MK\.togLoc\(this\.dataset\.n\)"/.test(MK) && /onclick="MK\.byoToggle\(this\.dataset\.o\)"/.test(MK) && /MK\.pickWhere\(\\''\+iso\+'\\',this\.dataset\.o\)/.test(MK) &&
  !/MK\.togLoc\(\\''/.test(MK) && !/MK\.byoToggle\(\\''/.test(MK));
t('the office list is read when needed, not once at load (an office added in Admin is not dropped)', /const LOCS=\(\)=>\['All offices'\]\.concat\(PH\.officeNames\(\)\);/.test(MK) && /const all=LOCS\(\);/.test(MK));

/* ---------- MONTHLY ---------- */
const write=fnOf(P,'write');
t('a save takes the office, month and typed numbers when Save is pressed, and uses only those',
  /const o=OFF, y=Y, mo=MO, edits=Object\.assign\(\{\}, EDIT\);/.test(write) && !/\bOFF\b|\bMO\b|\bEDIT\b|\(Y\)|DATA\[Y\]/.test(write.replace(/const o=OFF, y=Y, mo=MO, edits=Object\.assign\(\{\}, EDIT\);/,'')) &&
  /function applyEdits\(r, edits\)/.test(P) && !/function applyEdits[\s\S]{0,400}EDIT\[/.test(fnOf(P,'applyEdits')));
t('...no other office or month while a save is on its way', /move\(n\)\{ if\(busy\(\)\) return;/.test(P) && /office\(o\)\{ if\(busy\(\)\) return;/.test(P) && /open\(o\)\{ if\(busy\(\)\) return;/.test(P) && /if\(busy\(\)\) return null; BUSY=true;/.test(write));
t('a save the store refused (blocked or error) is not "Saved": said on the page, what was typed kept',
  /const refused=r=>!r \|\| !!\(r\.blocked \|\| r\.error\);/.test(P) && /if\(refused\(r\)\)\{ notSaved\(r\); return null; \}/.test(write) && /id="pagewarn"/.test(P) &&
  /if\(refused\(r\)\)\{ notSaved\(r, 'Nothing changed\.'\)/.test(fnOf(P,'saveSet')) && /if\(refused\(r\)\)\{ notSaved\(r, x\.file/.test(fnOf(P,'impGo')) && /if\(refused\(r\)\) throw/.test(fnOf(P,'importOrthofi')));
{ let EDIT={npe:'50', appts:'900', oecd:'7'}; const saved={npe:'50', appts:'90'};
  new Function('EDIT','saved', fnOf(P,'doneEditing')+'; doneEditing(saved);')(EDIT, saved);
  t('numbers typed while a save travelled stay: only boxes unchanged since it started are cleared (save, send, mark final)',
    JSON.stringify(EDIT)==='{"appts":"900","oecd":"7"}' && !/EDIT=\{\}/.test(fnOf(P,'save')+fnOf(P,'send')+fnOf(P,'markFinal')) && (P.match(/doneEditing\(saved\);/g)||[]).length===3); }
t('a failed read is said (years and settings), and settings are never saved over one; the Medicaid add merges into what is saved',
  /YFAIL\[y\]=readFailed\(M\.KEY\(y\)\);/.test(P) && /SETFAIL=readFailed\(M\.SET_KEY\);/.test(P) && /if\(SETFAIL\)\{ toast\('Not saved/.test(fnOf(P,'saveSet')) &&
  /couldn’t read the saved reports for/.test(P) && /SET\.medicaid\.indexOf\(x\.office\)<0 && !SETFAIL/.test(P) && !/PH_STORE\.update\(M\.SET_KEY, \(\)=>next\)/.test(P) && /await loadRuns\(\); showWarn\(\);/.test(P));
t('the Overview/office buttons carry the office in data-o', !/MONTHLY\.(open|office)\(\\''\+esc\(/.test(P) && (P.match(/onclick="MONTHLY\.(open|office)\(this\.dataset\.o\)"/g)||[]).length===5);

require(path.join(__dirname,'..','v1','monthly.js')); const M=globalThis.PH_MONTHLY;
t('streaks: where a run began (a run that began in January reads the year before, up to 36 months)',
  JSON.stringify(M.runStart(2026,10,22))==='{"y":2025,"m":1}' && JSON.stringify(M.runStart(2026,3,3))==='{"y":2026,"m":1}' && JSON.stringify(M.runStart(2026,10,0))==='{"y":2026,"m":10}' &&
  /s\.m===1 && !DATA\[s\.y-1\]\) want\[s\.y-1\]=1;/.test(P));
{ const RUN={}; for(let y=2024;y<=2026;y++) for(let m=1;m<=12;m++) if(y<2026 || m<=10) RUN[y+'-'+m]={gp:100, gc:93, adj:-7};
  t('...so a run since January 2024 counts 34 months through October 2026, not the 22 that two years allowed', M.streak((y,m)=>RUN[y+'-'+m], 2026, 10)===34 && M.streak((y,m)=>y>=2025 ? RUN[y+'-'+m] : null, 2026, 10)===22); }
{ const stored={v:1, meta:{keep:1}, o:{Carlsbad:{'10':{v:{gp:1, zz2:5}, src:{gp:'typed', zz2:'typed'}, zz:'keep', final:{at:'x', by:'H'}}, '09':{v:{gp:9}, odd:1}}, Clovis:{'09':{xtra:1}}}};
  const month=M.cleanMonth({v:{gp:2, npe:40}, src:{gp:'typed', npe:'typed'}});
  const out=M.putMonth(stored, 'Carlsbad', 10, month), c=out.o.Carlsbad['10'];
  t('one office-month laid onto the year as stored: other offices/months untouched, fields this version doesn\u2019t know kept',
    out.meta.keep===1 && out.o.Clovis===stored.o.Clovis && out.o.Carlsbad['09']===stored.o.Carlsbad['09'] && c.zz==='keep' && c.v.zz2===5 && c.src.zz2==='typed' && c.v.gp===2 && c.v.npe===40 &&
    stored.o.Carlsbad['10'].v.gp===1);
  t('...a field this version knows and removed stays removed (reopening a final month)', c.final===undefined && JSON.stringify(M.putMonth(null, 'Hobbs', 3, month).o.Hobbs['03'].v)==='{"gp":2,"npe":40}');
  t('...used by Save, the Excel import and OrthoFi\u2019s fill (no whole-year cleanYear rewrite)',
    /return M\.putMonth\(base, o, mo, M\.cleanMonth\(m\)\);/.test(write) && /M\.putMonth\(out, x\.office/.test(P) && /rec=M\.putMonth\(rec, o, m, mo\)/.test(P) && !/cleanYear/.test(fnOf(P,'importOrthofi')+fnOf(P,'impGo')+write)); }

/* ---------- ORTHOFI PAGE ---------- */
t('OrthoFi page: a map that couldn\u2019t be read is said and never saved over (matches or the fill switches)',
  /MAPFAIL=!!\(PH_STORE\.readFailed && PH_STORE\.readFailed\(O\.KEY\)\);/.test(OF) && /if\(MAPFAIL\)\{ el\('mapnote'\)\.textContent=MAPFAIL_TXT; return; \}/.test(OF) &&
  /if\(MAPFAIL\)\{ el\('autonote'\)\.textContent=MAPFAIL_TXT; return; \}/.test(OF) && /MAPFAIL \? esc\(MAPFAIL_TXT\)/.test(OF));

/* ---------- TIME ZONES ---------- */
t('Insights: the late-payment snapshot is filed under the practice\u2019s (Central) day', /const today=\(PH\.centralNow && PH\.centralNow\(\)\.date\) \|\| new Date\(\)\.toISOString\(\)\.slice\(0,10\);/.test(INS));
const PP=require(path.join(__dirname,'..','v1','periodpick.js'));
const at=d=>{ globalThis.PH={centralNow:()=>({date:d, hm:'09:00'})}; };
at('2028-03-01'); let pv=PP.prev({kind:'ytd'});
t('year to date on 2028-03-01 (a leap year) is compared with Jan 1 - Mar 1 2027, by month and day, not a day count',
  PP.range({kind:'ytd'}).last==='2028-03-01' && pv.first==='2027-01-01' && pv.last==='2027-03-01' && pv.partial===true && pv.months.length===3);
at('2028-02-29'); pv=PP.prev({kind:'ytd'}); const pf=pv.last;
at('2029-03-01'); pv=PP.prev({kind:'year', y:2029});
t('...Feb 29 compares with Feb 28; "all of this year so far" the same way (2029-03-01 vs Jan 1 - Mar 1 2028)', pf==='2027-02-28' && pv.last==='2028-03-01');
at('2026-11-21');
t('...a month and a quarter still compare the same number of days (Nov 1-21 vs Oct 1-21; Q4 so far vs Jul 1 - Aug 21)',
  PP.prev({kind:'month', y:2026, m:11}).last==='2026-10-21' && PP.prev({kind:'quarter', y:2026, q:4}).last==='2026-08-21');
at('2026-12-01'); const dec=PP.clean({kind:'month', y:2026, m:12}).m; at('2026-11-30'); const nov=PP.clean({kind:'month', y:2026, m:12}).m;
t('the picker\u2019s "now" is the practice\u2019s Central today (December opens on Dec 1 Central, whatever this device\u2019s clock says)', dec===12 && nov===11);
globalThis.PH={centralNow:()=>({date:'nonsense'})}; const n1=PP.range({kind:'month'}).first; delete globalThis.PH; const n2=PP.range({kind:'month'}).first;
const d=new Date(), here=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
t('...and this device\u2019s clock where user.js isn\u2019t loaded (the date picker demo, tests)', n1===here && n2===here);

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
