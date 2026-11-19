/* TASKS (19/11/2026) - give a task to people, they tick it off, the giver sees who has and hasn't.
       node test/tasks.test.js
   Cory: "leadership can assign a task to certain users who would get a notification and it would be in there today. Then
   leadership who assigned task can track which of their tasks are still open and which ones have be completed?" ...
   "Maybe just tasks and Heather can decide who can assign tasks and who cannot". Made-up people only. */
const fs=require('fs'), path=require('path');
const R=require(path.join(__dirname,'..','v1','tasks.js'));
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };

const ROSTER=[
  {name:'Avery Alder', email:'Avery@Example.com', offices:['North'], teams:['Office Managers']},
  {name:'Blake Birch', email:'blake@example.com', offices:['South'], teams:['Office Managers']},
  {name:'Casey Cedar', email:'casey@example.com', offices:['North'], teams:['TCs']},
  {name:'Drew Dogwood', offices:['South'], teams:['Staff']},                                    // no email on the team list
  {name:'Emery Elm', email:'emery@example.com', offices:['North','South'], teams:['Leadership Team']},
  {name:'Finley Fir', email:'finley@example.com', offices:['North'], teams:['Staff'], status:'Inactive'}
];
const TODAY='2026-11-19', NOW=new Date('2026-11-19T15:00:00');

/* people */
t('a person is filed under their email, lower case', R.personId(ROSTER[0])==='avery@example.com');
t('...or their name when the team list has no email for them', R.personId(ROSTER[3])==='name:drew dogwood');
t('the signed-in person matches by email and by name', JSON.stringify(R.myKeys({email:'Drew@x.com', name:'Drew  Dogwood'}))==='["drew@x.com","name:drew dogwood"]');
const north=R.expand({offices:['north']}, ROSTER);
t('"Everyone at North" is each person there, one each, by name', north.map(p=>p.name).join()==='Avery Alder,Casey Cedar,Emery Elm');
t('someone Inactive is never included', !R.expand({all:true}, ROSTER).some(p=>p.name==='Finley Fir'));
t('"All Office Managers" reads the teams on the team list', R.expand({teams:['Office Managers']}, ROSTER).map(p=>p.id).join()==='avery@example.com,blake@example.com');
t('a person picked twice (by name and by office) is in once', R.expand({people:['avery@example.com'], offices:['North']}, ROSTER).filter(p=>p.id==='avery@example.com').length===1);
t('a 9th office works the day it is on the team list', R.expand({offices:['West']}, ROSTER.concat([{name:'Gray Gum', email:'g@example.com', offices:['West']}])).length===1);
t('"Everyone at North" leaves out someone listed at every office (practice-wide)', R.expand({offices:['North']}, ROSTER, {wide:2}).map(p=>p.name).join()==='Avery Alder,Casey Cedar');
t('a group pick never gives the giver their own task', !R.expand({all:true}, ROSTER, {not:['emery@example.com']}).some(p=>p.name==='Emery Elm'));
t('...but they can pick themselves by name', R.expand({people:['emery@example.com'], all:true}, ROSTER, {not:['emery@example.com']}).some(p=>p.name==='Emery Elm'));
t('the words for a pick: "Everyone at North", "All TCs"', R.howWords({offices:['North'], teams:['TCs']}).join('|')==='Everyone at North|All TCs' && R.howWords({all:true}).join()==='Everyone');

/* giving one */
t('a task needs words and people', R.problems({title:'', people:[]}, TODAY).length===2 && R.problems({title:'Count trays', people:[{id:'a'}]}, TODAY).length===0);
t('a due date in the past is refused', R.problems({title:'x', people:[{id:'a'}], due:'2026-11-18'}, TODAY).join().indexOf('passed')>0);
t('30 February is not a date', !R.isDay('2026-02-30') && R.isDay('2028-02-29'));
const T1=R.create({title:'  Count the aligner trays   and order what’s low ', notes:'Top shelf too', due:'2026-11-21', by:'Emery@example.com', byName:'Emery Elm',
  people:R.expand({teams:['Office Managers']}, ROSTER).concat([{id:'name:drew dogwood', name:'Drew Dogwood'}]), how:['All Office Managers']}, NOW);
t('the task is tidied: one line of words, the giver in lower case', T1.title==='Count the aligner trays and order what’s low' && T1.by==='emery@example.com');
t('everyone on it has their own open line', R.progress(T1).total===3 && R.progress(T1).open===3);
let rec=R.add(null, T1);
t('it goes in the shared record', Object.keys(rec.t).length===1 && rec.t[T1.id].title===T1.title);
t('adding the same task twice keeps one', Object.keys(R.add(rec, T1).t).length===1);

/* my list */
let m=R.mine(rec, ['avery@example.com'], TODAY, NOW);
t('Avery has it on her list', m.open.length===1 && m.open[0].me.id==='avery@example.com');
t('Drew (no email) finds it by name', R.mine(rec, R.myKeys({email:'drew@other.com', name:'Drew Dogwood'}), TODAY, NOW).open.length===1);
t('someone not on it does not', R.mine(rec, ['casey@example.com'], TODAY, NOW).open.length===0);

/* done, undo, note */
rec=R.markDone(rec, T1.id, 'avery@example.com', 'Ordered 2 boxes', NOW);
t('done: ticked with the time and her note', !!rec.t[T1.id].to['avery@example.com'].d && rec.t[T1.id].to['avery@example.com'].note==='Ordered 2 boxes');
t('the giver sees 1 of 3 done', R.progress(rec.t[T1.id]).done===1);
m=R.mine(rec, ['avery@example.com'], TODAY, NOW);
t('it moves to her done list', m.open.length===0 && m.done.length===1);
const firstDone=rec.t[T1.id].to['avery@example.com'].d;
rec=R.markDone(rec, T1.id, 'avery@example.com', null, new Date('2026-11-20T10:00:00'));
t('ticking again keeps the first time (and the note)', rec.t[T1.id].to['avery@example.com'].d===firstDone && rec.t[T1.id].to['avery@example.com'].note==='Ordered 2 boxes');
rec=R.undo(rec, T1.id, 'avery@example.com');
t('undo puts it back on her list', R.mine(rec, ['avery@example.com'], TODAY, NOW).open.length===1);
t('someone not on the task cannot tick it', JSON.stringify(R.markDone(rec, T1.id, 'casey@example.com', '', NOW))===JSON.stringify(rec));

/* the giver's view */
const T2=R.create({title:'Send your top 3 wins', due:'2026-11-18', by:'emery@example.com', byName:'Emery Elm', people:[{id:'casey@example.com', name:'Casey Cedar'}]}, new Date('2026-11-10T09:00:00'));
const T3=R.create({title:'Fire extinguisher dates', by:'blake@example.com', byName:'Blake Birch', people:[{id:'avery@example.com', name:'Avery Alder'}]}, NOW);
rec=R.add(R.add(rec, T2), T3);
let g=R.given(rec, ['emery@example.com'], TODAY);
t('"Tasks I gave" is only the giver’s', g.open.length===2 && !g.open.some(x=>x.id===T3.id));
t('...overdue first', g.open[0].id===T2.id && R.dueState(g.open[0].due, TODAY)==='late');
t('Everything (no keys) sees every task', R.given(rec, null, TODAY).open.length===3);
t('Home summary: Avery has 2 open; Emery gave 2, 1 with someone late', (s=>s.open===2)(R.summary(rec, ['avery@example.com'], TODAY)) && (s=>s.gaveOpen===2 && s.gaveLate===1)(R.summary(rec, ['emery@example.com'], TODAY)));
t('open order on my list: overdue, today, tomorrow, later, no date', (()=>{ let r=null; ['2026-11-25','','2026-11-19','2026-11-17','2026-11-20'].forEach((d,i)=>{ r=R.add(r, R.create({id:'o'+i, title:'x'+i, due:d, by:'b@x', people:[{id:'me@x'}]}, NOW)); });
  return R.mine(r, ['me@x'], TODAY, NOW).open.map(x=>x.due||'-').join()==='2026-11-17,2026-11-19,2026-11-20,2026-11-25,-'; })());

/* due words */
t('due words: today, tomorrow, a weekday this week, a date later', R.dueText('2026-11-19',TODAY)==='Due today' && R.dueText('2026-11-20',TODAY)==='Due tomorrow' && R.dueText('2026-11-24',TODAY)==='Due Tuesday' && R.dueText('2026-12-04',TODAY)==='Due Fri Dec 4');
t('overdue says when it was due', R.dueText('2026-11-18',TODAY)==='Overdue · was due yesterday' && R.dueText('2026-11-10',TODAY)==='Overdue · was due Tue Nov 10');
t('next year’s date carries the year', R.dueText('2027-01-08',TODAY)==='Due Fri Jan 8, 2027');
t('quick dates from a Thursday: Friday is tomorrow’s Friday, next Monday is the 23rd', (q=>q.find(x=>x.k==='fri').d==='2026-11-20' && q.find(x=>x.k==='mon').d==='2026-11-23')(R.quickDues(TODAY)));
t('...and from a Friday, "Friday" is next week’s', R.quickDues('2026-11-20').find(x=>x.k==='fri').d==='2026-11-27');

/* changing it */
rec=R.edit(rec, T1.id, {title:'Count the trays', due:'2026-11-24', notes:'Both closets'}, NOW);
t('edit: words, details and due date change; it says when', rec.t[T1.id].title==='Count the trays' && rec.t[T1.id].due==='2026-11-24' && !!rec.t[T1.id].edited);
t('an edit with no words is ignored', R.edit(rec, T1.id, {title:'  '}, NOW).t[T1.id].title==='Count the trays');
rec=R.addPeople(rec, T1.id, [{id:'casey@example.com', name:'Casey Cedar'}], NOW, ['Everyone at North']);
t('more people can be added', R.progress(rec.t[T1.id]).total===4 && rec.t[T1.id].how.indexOf('Everyone at North')>=0);
rec=R.removePerson(rec, T1.id, 'casey@example.com', NOW);
t('taking someone off marks them gone - the line is kept', R.progress(rec.t[T1.id]).total===3 && !!rec.t[T1.id].to['casey@example.com'].gone);
t('...and it leaves their list', R.mine(rec, ['casey@example.com'], TODAY, NOW).open.every(x=>x.id!==T1.id));
rec=R.markDone(rec, T1.id, 'blake@example.com', '', NOW);
t('someone who has done it cannot be taken off (it is the giver’s record)', !R.removePerson(rec, T1.id, 'blake@example.com', NOW).t[T1.id].to['blake@example.com'].gone);
rec=R.addPeople(rec, T1.id, [{id:'casey@example.com', name:'Casey Cedar'}], NOW);
t('added back, they get a fresh open line', !rec.t[T1.id].to['casey@example.com'].gone && !rec.t[T1.id].to['casey@example.com'].d);

/* closing, nudging */
rec=R.close(rec, T3.id, NOW);
t('closing marks it closed; it leaves Avery’s list, and is finished for the giver', !!rec.t[T3.id].closed && R.mine(rec, ['avery@example.com'], TODAY, NOW).open.every(x=>x.id!==T3.id) && R.given(rec, ['blake@example.com'], TODAY).done.length===1);
t('a closed task cannot be ticked', !R.markDone(rec, T3.id, 'avery@example.com', '', NOW).t[T3.id].to['avery@example.com'].d);
rec=R.reopen(rec, T3.id);
t('reopen brings it back', !rec.t[T3.id].closed && R.mine(rec, ['avery@example.com'], TODAY, NOW).open.some(x=>x.id===T3.id));
t('a nudge goes to the people who haven’t done it', R.openIds(rec.t[T1.id]).sort().join()==='avery@example.com,casey@example.com,name:drew dogwood');
rec=R.nudged(rec, T1.id, NOW);
t('one nudge an hour per task', R.nudgeWait(rec.t[T1.id], new Date(NOW.getTime()+10*60000))===50 && R.nudgeWait(rec.t[T1.id], new Date(NOW.getTime()+61*60000))===0 && rec.t[T1.id].nudges===1);

/* all done -> the giver */
rec=R.markDone(R.markDone(R.markDone(rec, T1.id, 'avery@example.com', '', NOW), T1.id, 'casey@example.com', '', NOW), T1.id, 'name:drew dogwood', '', NOW);
t('everyone done = finished, for the giver', R.finished(rec.t[T1.id]) && R.given(rec, ['emery@example.com'], TODAY).done.some(x=>x.id===T1.id));
t('the bell line for the giver says who and how many', R.bellDone(rec.t[T1.id], 'Avery Alder')==='✅ Avery finished “Count the trays” (4 of 4 done)');
t('alerts: "New task from Emery" with the due date', (a=>a.title==='New task from Emery' && a.body==='Send your top 3 wins · Overdue · was due yesterday')(R.alertNew(rec.t[T2.id], TODAY)));

/* the archive - nothing lost */
const LATER=new Date('2027-01-05T12:00:00');
const old=R.oldOnes(rec, LATER);
t('finished more than 30 days ago -> the archive for the year it was given', Object.keys(old).join()==='2026' && !!old['2026'][T1.id] && !old['2026'][T2.id]);
t('not finished -> never archived, however old', !Object.keys(old).some(y=>old[y][T2.id]));
const arc=R.toArchive(null, old['2026']);
t('the archive holds it exactly', JSON.stringify(arc.t[T1.id])===JSON.stringify(rec.t[T1.id]));
t('the archive never writes over a task already there', R.toArchive(arc, {[T1.id]:Object.assign({}, rec.t[T1.id], {title:'changed'})}).t[T1.id].title==='Count the trays');
const kept=R.dropArchived(rec, arc);
t('only what the archive holds leaves ph_tasks', !kept.t[T1.id] && !!kept.t[T2.id] && !!kept.t[T3.id]);
t('nothing leaves when the archive did not save', Object.keys(R.dropArchived(rec, null).t).length===Object.keys(rec.t).length);
t('a task reopened since is not dropped', !!R.dropArchived(R.reopen(R.close(R.undo(rec, T1.id, 'casey@example.com'), T1.id, NOW), T1.id), arc).t[T1.id]);

/* the record is safe to read whatever is in it */
t('a broken record reads as empty, never throws', Object.keys(R.cleanRecord('nonsense').t).length===0 && Object.keys(R.cleanRecord({t:{a:null, b:{title:''}}}).t).length===0);
t('long words are cut, not refused', R.create({title:'x'.repeat(500), by:'a@x', people:[{id:'b@x'}]}, NOW).title.length===R.MAX_TITLE);

/* the pages - the switch, the tab, Heather's column, Home */
const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const U=read('user.js'), A=read('admin.html'), HOME=read('home.html'), P=read('tasks.html');
t('OFF on the live site until Cory says "tasks live" (an admin can preview with ?taskspreview)', /const TASKS_LIVE=false;/.test(U) && /function tasksOn\(\)\{ if\(env\(\)!=='live' \|\| TASKS_LIVE\) return true;/.test(U) && /taskspreview/.test(U));
t('everyone gets the Tasks tab (the switch decides, not a team)', /\{k:'tasks',\s+n:'[^']*Tasks',\s+href:'tasks\.html',\s+show:\(\)=>tasksOn\(\)\}/.test(U));
t('who can GIVE tasks starts as Admin (everything), Executive and Leadership (can give)', /'admin':[^\n]*tasks:'manage'/.test(U) && /'executive team':[^\n]*tasks:'edit'/.test(U) && /'leadership team':[^\n]*tasks:'edit'/.test(U) && /c\.tasks===undefined && DEPT_CAN\[d\]/.test(U));
t('Heather decides in Teams & Access: Gets tasks / Can give / Everything (off the grid while Tasks is off)', /PH\.tasksOn && !PH\.tasksOn\(\)\) \? \[\] : \[\{k:'tasks'/.test(A) && /tasks:\['none','edit','manage'\]/.test(A) && /tasks:\{none:'Gets tasks',edit:'Can give',manage:'Everything'\}/.test(A));
t('the bell keeps who a notice is for (e.to) and shows it to them only', /to:arr\(e\.to\)/.test(U) && /if\(Array\.isArray\(e\.to\) && e\.to\.length\)\{/.test(U));
t('the page and Home load the rules', /<script src="tasks\.js\?v=hc\d+"><\/script>/.test(P) && /<script src="tasks\.js\?v=hc\d+"><\/script>/.test(HOME));
t('Home shows "Your tasks" only while Tasks is on', /PH\.tasksOn && PH\.tasksOn\(\)\) \|\| !window\.PH_TASKS\)\{ host\.hidden=true; return; \}/.test(HOME));
t('every change is merged onto the shared copy (PH_STORE.update), never written over it', /PH_STORE\.update\(R\.KEY/.test(P) && !/PH_STORE\.set\(R\.KEY, REC\)/.test(P));
t('the sandbox demo is never written on the live site', /if\(!LIVE\)\{ let v=''; try\{ v=localStorage\.getItem\('ph_tasks_demo'\)/.test(P));
t('the page says no patient details where you type', /No patient details in a task/.test(P));
t('closing asks first and says nothing is deleted', /Close this task\? It comes off everyone’s list \(nothing is deleted\)/.test(P));
t('the demo is made-up people only', R.demo(['North'], NOW).people.every(p=>/@example\.com$/.test(p.email)));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
