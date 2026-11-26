/* HOME -> YOUR DAY (26/11/2026): who sees what, the Schedule's day, consult counts, payroll and the month's pace
   (v1/yourday.js _pure). Made-up people and numbers only. Run: node test/yourday.test.js */
const fs=require('fs'), path=require('path'), vm=require('vm');
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','v1','yourday.js'),'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','v1','tc.js'),'utf8'), ctx);
const Y=ctx.PH_DAY._pure, TC=ctx.TC, TODAY='2026-11-26';

/* who is who */
t('a doctor by team', Y.roleOf({teams:['Doctors']})==='doctor');
t('a doctor by name, even an admin', Y.roleOf({name:'Dr. Clara Coleman', admin:true})==='doctor');
t('leadership: admins and anyone seeing every office', Y.roleOf({admin:true, teams:['Admin']})==='lead' && Y.roleOf({all:true, teams:['Leadership']})==='lead');
t('office manager by team or role', Y.roleOf({teams:['Office Managers']})==='om' && Y.roleOf({role:'OM/Clinic Lead'})==='om');
t('TC by team', Y.roleOf({teams:['TCs']})==='tc');
t('everyone else is staff', Y.roleOf({teams:['Staff'], role:'Clinical Asst'})==='staff');

/* the Schedule's day */
const docs=[{n:'Dr. Clara Coleman'},{n:'Dr. Jay Bramwell'},{n:'Dr. Old', left:'2026-01-01'}];
const sched={'2026-11-26':{Hobbs:{ps:[0], s:480, e:1020}, Clovis:{closed:true}, Lubbock:{ydot:true}, Carlsbad:{ps:[1], s:480, e:780, event:'Team lunch'}},
             '2026-11-27':{Carlsbad:{ps:[0]}}};
const offs=['Carlsbad','Clovis','Hobbs','Lubbock','Mansfield'];
t('an office open with its doctor and hours', (d=>d.open && d.docs[0]==='Dr. Clara Coleman' && d.s===480)(Y.officeDay(sched, docs, 'Hobbs', TODAY)));
t('a closed office', (d=>!d.open && d.closed)(Y.officeDay(sched, docs, 'Clovis', TODAY)));
t('a Yellow Dot day is open with no doctor', (d=>d.open && d.ydot && !d.docs.length)(Y.officeDay(sched, docs, 'Lubbock', TODAY)));
t('nothing on the Schedule = null (never shown as closed)', Y.officeDay(sched, docs, 'Mansfield', TODAY)===null);
t('where a doctor is today (Dr. on the list, not in the name)', JSON.stringify(Y.doctorAt(sched, docs, offs, 'Clara Coleman', TODAY).map(x=>x.office))==='["Hobbs"]');
t('...and tomorrow', Y.doctorAt(sched, docs, offs, 'Dr. Clara Coleman', '2026-11-27')[0].office==='Carlsbad');
t('a doctor not on the Schedule today: nowhere', Y.doctorAt(sched, docs, offs, 'Dr. Jay Bramwell', '2026-11-27').length===0);
t('the doctor list with last names only ("Dr. Coleman") still finds Dr. Clara Coleman', (()=>{ const d2=[{n:'Dr. Coleman'},{n:'Dr. Bramwell'}], s2={'2026-11-26':{Hobbs:{ps:[0]}}}; return Y.doctorAt(s2, d2, offs, 'Dr. Clara Coleman', TODAY)[0].office==='Hobbs'; })());
t('a doctor who has left the list is never matched', Y.doctorAt({'2026-11-26':{Hobbs:{ps:[2]}}}, docs, offs, 'Old', TODAY).length===0);
t('someone not on the doctor list: nowhere', Y.doctorAt(sched, docs, offs, 'Pat Nobody', TODAY).length===0);

/* consults: today's at the office, and the calls due */
const cons=[{office:'Hobbs', date:TODAY, outcome:''},{office:'Hobbs', date:TODAY, outcome:'', deleted:true},{office:'Hobbs', date:'2026-11-20', outcome:'Pending', nextFU:'2026-11-25'},
            {office:'Clovis', date:TODAY},{office:'Hobbs', date:'2026-11-21', outcome:'Started', fuStatus:'Closed - started'}];
const C=Y.consultCounts(cons, ['Hobbs'], TODAY, TC);
t('consults today at the office (deleted ones and other offices left out)', C.today===1);
t('calls due: a pending follow-up past its date', C.calls>=1);
t('every office (leadership): all of today\'s', Y.consultCounts(cons, null, TODAY, TC).today===2);

/* the month against goal */
const prod={Hobbs:{act:[...Array(10).fill(0), 81000, 0], goal:[...Array(10).fill(0), 100000, 0], days:[...Array(10).fill(0), 20, 0], done:[...Array(10).fill(0), 16, 0]},
            Clovis:{act:[...Array(10).fill(0), 50000, 0], goal:[...Array(10).fill(0), 50000, 0], days:[...Array(10).fill(0), 10, 0], done:[...Array(10).fill(0), 10, 0]}};
const P1=Y.monthPace(prod, ['Hobbs'], 10);
t('% of the month\'s goal', Math.abs(P1.pct-0.81)<1e-9);
t('pace: the goal for the days worked (16 of 20) = 80,000 -> 1,000 ahead', Math.abs(P1.vpace-1000)<1e-9);
t('several offices summed', Math.abs(Y.monthPace(prod, ['Hobbs','Clovis'], 10).pct-131000/150000)<1e-9);
t('no goal: nothing shown', Y.monthPace(prod, ['Hobbs'], 2)===null && Y.monthPace(prod, ['Nowhere'], 10)===null);

/* payroll */
const R={FIRST:'', OFFICES:[{k:'hobbs', n:'Hobbs'},{k:'clovis', n:'Clovis'},{k:'xpartners', n:'Partners', self:true}],
  currentIndex:()=>25, period:()=>({key:'2026-25', n:25, due:'2026-12-01'})};
const st={p:{'2026-25':{sent:{hobbs:'2026-11-26T15:00:00Z'}}}};
const mine=Y.payBox(R, st, TODAY, ['clovis'], 'send');
t('a sender: their own sheet, not sent yet, due Tuesday', mine.kind==='mine' && !mine.sent && mine.office==='Clovis' && mine.dueDay==='Tuesday' && !mine.late);
t('a sender whose sheet is in: sent', Y.payBox(R, st, TODAY, ['hobbs'], 'send').sent===true);
const all=Y.payBox(R, st, TODAY, null, 'manage');
t('whoever runs payroll: sheets in of the offices that send one (not the one she fills in herself)', all.sent===1 && all.total===2 && all.waiting.join()==='Clovis');
t('late once the due day has passed', Y.payBox(R, st, '2026-12-02', ['clovis'], 'send').late===true);
t('no payroll role: no box', Y.payBox(R, st, TODAY, null, '')===null);
t('the status list didn\'t read: no box (never a false "0 sent")', Y.payBox(R, null, TODAY, null, 'manage')===null);

/* the boxes */
const B=Y.boxes({today:TODAY, role:'doctor', office:'', where:[{office:'Hobbs', s:480, e:1020}], tomorrow:{label:'Tomorrow', offices:['Carlsbad']}, consults:{today:6, calls:null}, consultsAt:'Hobbs', prod:{office:'Hobbs', month:'November', pct:0.81, vpace:-8400}});
t('doctor: where, consults, the month - in that order', B.map(b=>b.k).join()==='where,consults,prod');
t('doctor: where says today and tomorrow', B[0].big==='Hobbs' && /Tomorrow: Carlsbad/.test(B[0].sub));
t('behind pace says by how much', B[2].pill.t==='$8,400 behind pace' && B[2].pill.tone==='warn');
t('every box opens the page behind it', B.every(b=>/\.html$/.test(b.href)));
t('a box only when its numbers are there (nothing read = no box, never a false zero)', Y.boxes({today:TODAY, role:'om', office:'Hobbs'}).length===0);
const L=Y.boxes({today:TODAY, role:'lead', sched:{open:6, total:8, closed:['Clovis','Mansfield']}, pay:all});
t('leadership: offices open and payroll', L[0].big==='6 of 8 open' && /Clovis, Mansfield closed/.test(L[0].sub) && L[1].big==='1 of 2 sent');
const S=Y.boxes({today:TODAY, role:'staff', office:'Hobbs', day:{open:true, docs:['Dr. Coleman'], s:480, e:1020}, week:[{day:'Monday', open:true},{day:'Tuesday', open:false}]});
t('staff: their office today and the week', S.map(b=>b.k).join()==='where,week' && S[0].big==='Open' && S[1].big==='1 day open');
const src=fs.readFileSync(path.join(__dirname,'..','v1','yourday.js'),'utf8');
t('the sandbox shows made-up numbers, never the practice\'s', /if\(!live\(\)\)\{ paint\(sample\(/.test(src));
t('only counts are kept on the device (consults, the month)', /kept\('c_'/.test(src) && !/sessionStorage\.setItem\([^)]*consultsFrom/.test(src));
const home=fs.readFileSync(path.join(__dirname,'..','v1','home.html'),'utf8');
t('Home: the card is there and the app tiles are gone (Cory: they repeat the menu)', /id="yourday"/.test(home) && !/id="tiles"/.test(home));

console.log(pass+' passed, '+fail+' failed'); if(fail) process.exit(1);
