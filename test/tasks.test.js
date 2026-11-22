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
/* 21/11/2026, code review: a change that changes nothing returns undefined, so PH_STORE.update writes nothing */
t('ticking again keeps the first time (and the note) - nothing to write', R.markDone(rec, T1.id, 'avery@example.com', null, new Date('2026-11-20T10:00:00'))===undefined &&
  rec.t[T1.id].to['avery@example.com'].d===firstDone && rec.t[T1.id].to['avery@example.com'].note==='Ordered 2 boxes');
t('the same note again, or a task that is not there - nothing to write', R.setNote(rec, T1.id, 'avery@example.com', 'Ordered 2 boxes')===undefined && R.close(rec, 'no-such-task', NOW)===undefined &&
  R.setNote(rec, T1.id, 'avery@example.com', 'Ordered 3 boxes').t[T1.id].to['avery@example.com'].note==='Ordered 3 boxes');
rec=R.undo(rec, T1.id, 'avery@example.com');
t('undo puts it back on her list', R.mine(rec, ['avery@example.com'], TODAY, NOW).open.length===1);
t('someone not on the task cannot tick it', R.markDone(rec, T1.id, 'casey@example.com', '', NOW)===undefined);

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
t('quick dates from a Thursday: no "Friday" button (it is "Tomorrow"), next Monday is the 23rd', (q=>!q.some(x=>x.k==='fri') && q.find(x=>x.k==='tomorrow').d==='2026-11-20' && q.find(x=>x.k==='mon').d==='2026-11-23')(R.quickDues(TODAY)));
t('...from a Tuesday, Friday is that Friday', R.quickDues('2026-11-17').find(x=>x.k==='fri').d==='2026-11-20');
t('...and from a Friday, "Friday" is next week’s', R.quickDues('2026-11-20').find(x=>x.k==='fri').d==='2026-11-27');

/* changing it */
rec=R.edit(rec, T1.id, {title:'Count the trays', due:'2026-11-24', notes:'Both closets'}, NOW);
t('edit: words, details and due date change; it says when', rec.t[T1.id].title==='Count the trays' && rec.t[T1.id].due==='2026-11-24' && !!rec.t[T1.id].edited);
t('an edit with no words is ignored', R.edit(rec, T1.id, {title:'  '}, NOW)===undefined && rec.t[T1.id].title==='Count the trays');
rec=R.addPeople(rec, T1.id, [{id:'casey@example.com', name:'Casey Cedar'}], NOW, ['Everyone at North']);
t('more people can be added', R.progress(rec.t[T1.id]).total===4 && rec.t[T1.id].how.indexOf('Everyone at North')>=0);
rec=R.removePerson(rec, T1.id, 'casey@example.com', NOW);
t('taking someone off marks them gone - the line is kept', R.progress(rec.t[T1.id]).total===3 && !!rec.t[T1.id].to['casey@example.com'].gone);
t('...and it leaves their list', R.mine(rec, ['casey@example.com'], TODAY, NOW).open.every(x=>x.id!==T1.id));
rec=R.markDone(rec, T1.id, 'blake@example.com', '', NOW);
t('someone who has done it cannot be taken off (it is the giver’s record)', R.removePerson(rec, T1.id, 'blake@example.com', NOW)===undefined && !rec.t[T1.id].to['blake@example.com'].gone);
rec=R.addPeople(rec, T1.id, [{id:'casey@example.com', name:'Casey Cedar'}], NOW);
t('added back, they get a fresh open line', !rec.t[T1.id].to['casey@example.com'].gone && !rec.t[T1.id].to['casey@example.com'].d);

/* closing, nudging */
rec=R.close(rec, T3.id, NOW);
t('closing marks it closed; it leaves Avery’s list, and is finished for the giver', !!rec.t[T3.id].closed && R.mine(rec, ['avery@example.com'], TODAY, NOW).open.every(x=>x.id!==T3.id) && R.given(rec, ['blake@example.com'], TODAY).done.length===1);
t('a closed task cannot be ticked', R.markDone(rec, T3.id, 'avery@example.com', '', NOW)===undefined && !rec.t[T3.id].to['avery@example.com'].d);
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
{ /* the wipe guard: one save never takes the list below 40% of its weight; oldest go first; the rest on a later day */
  let big={v:1, t:{}}; const NOW2=new Date('2026-11-20T15:00:00Z');
  for(let i=0;i<10;i++){ const c=R.create({title:'Old '+i, people:[{id:'casey@example.com', name:'Casey Made'}], by:'jordan@example.com', byName:'Jordan'}, new Date('2026-09-0'+(i%9+1)+'T10:00:00Z'));
    big=R.add(big, c); big=R.markDone(big, c.id, 'casey@example.com', '', new Date('2026-09-1'+i%10+'T10:00:00Z')); }
  const ids=Object.keys(big.t), arcAll={v:1, t:big.t};
  const d1=R.dropArchived(big, arcAll), left1=Object.keys(d1.t).length;
  t('archiving everything at once keeps enough that the save is never refused (wipe guard)', left1>0 && left1<10);
  const d2=R.dropArchived(d1, arcAll);
  t('…the next day takes more of them, oldest first', Object.keys(d2.t).length<left1 && Object.keys(d2.t).every(id=>Object.keys(d1.t).indexOf(id)>=0));
}
t('nothing leaves when the archive did not save', Object.keys(R.dropArchived(rec, null).t).length===Object.keys(rec.t).length);
t('a task reopened since is not dropped', !!R.dropArchived(R.reopen(R.close(R.undo(rec, T1.id, 'casey@example.com'), T1.id, NOW), T1.id), arc).t[T1.id]);

/* the record is safe to read whatever is in it */
t('a broken record reads as empty, never throws', Object.keys(R.cleanRecord('nonsense').t).length===0 && Object.keys(R.cleanRecord({t:{a:null, b:{title:''}}}).t).length===0);
t('long words are cut, not refused', R.create({title:'x'.repeat(500), by:'a@x', people:[{id:'b@x'}]}, NOW).title.length===R.MAX_TITLE);

/* typing it the way you'd say it (Cory 19/11: "It should be intelligent but not a stupid task system") */
{
  const ro=[{name:'Maya Chen',email:'maya@example.com'},{name:'Dana Brooks',email:'dana@example.com'},{name:'Maya Ruiz',email:'mruiz@example.com'},{name:'Jules Moreno',email:'jules@example.com'}];
  const C={today:'2026-11-19', roster:ro, offices:['Hobbs','San Angelo'], teams:['Office Managers','TCs','Leadership Team','Doctors'], me:'jordan@example.com'};
  const u=s=>R.understand(s, C), who=x=>x.who.map(w=>w.label).join('|');
  let x=u('Office managers: count the aligner trays by Friday');
  t('"Office managers: count the aligner trays by Friday" -> All Office Managers, Friday, the words alone', who(x)==='All Office Managers' && x.due==='2026-11-20' && x.title==='Count the aligner trays');
  x=u('Ask Maya Chen and Dana to send the photos tomorrow');
  t('"Ask Maya Chen and Dana to ..." -> both of them, tomorrow', who(x)==='Maya Chen|Dana Brooks' && x.due==='2026-11-20' && x.title==='Send the photos');
  x=u('Everyone at Hobbs - restock the brochures by next Monday');
  t('"Everyone at Hobbs - ..." -> that office; "next Monday" is the 23rd', who(x)==='Everyone at Hobbs' && x.due==='2026-11-23' && x.title==='Restock the brochures');
  t('"OMs + leadership" and "TCs" and "Drs" are understood', who(u('OMs + leadership: review the budget'))==='All Office Managers|All Leadership Team' && who(u('TCs: x'))==='All TCs' && who(u('Drs: sign the charts'))==='All Doctors');
  t('"by the 5th" after the 5th is next month’s 5th', u('TCs: top 3 wins by the 5th').due==='2026-12-05');
  t('"by end of month" = the last working day', u('Check the dates by end of month').due==='2026-11-30');
  t('"next Friday" on a Thursday is the Friday of next week; "Friday" is tomorrow', u('Do it next friday').due==='2026-11-27' && u('Do it Friday').due==='2026-11-20');
  t('12/3, Nov 30, in 2 weeks, eod', u('Lunch 12/3').due==='2026-12-03' && u('Tidy the lab Nov 30').due==='2026-11-30' && u('Call the lab in 2 weeks').due==='2026-12-03' && u('Sign by eod').due==='2026-11-19');
  t('a date that has gone this year means next year', u('Plan it by 1/15').due==='2027-01-15');
  x=u('Send me a photo of Hobbs’ front desk');
  t('an office named inside the words is NOT read as who it is for', !x.who.length && x.title==='Send me a photo of Hobbs’ front desk');
  x=u('Reminder: lock the back door');
  t('"Reminder: ..." stays as typed (nobody is called Reminder)', !x.who.length && x.title==='Reminder: lock the back door');
  t('"next week" alone at the end is left in the words (could be what the task is about)', u('Plan the party next week').due==='' && u('Plan the party by next week').due==='2026-11-23');
  x=u('Maya: order lunch 12/3');
  t('two people called Maya -> asked, not guessed', !x.who.length && x.unknown.join().indexOf('2 people called Maya')>=0 && x.title==='Order lunch');
  x=u('Maya Ruiz, Bob: order lunch');
  t('a name nobody has is flagged; the ones found still count', who(x)==='Maya Ruiz' && x.unknown.join().indexOf('Bob')>=0);
  t('"me" is the giver', u('Me: check the alarm').who[0].v==='jordan@example.com');
}
/* ideas from the practice's own teams, and "give again" */
t('ideas only for teams the practice has, in its own words', (i=>i.some(x=>/^Office Managers: count the aligner trays/.test(x.text)) && !i.some(x=>/\{T\}/.test(x.text)))(R.ideas({teams:['Office Managers']})) && !R.ideas({teams:['Staff']}).some(x=>/Office Managers/.test(x.text)));
{
  const D=R.demo(['North','South','East','West','Mid'], NOW), mine=R.recent(D.rec, ['jordan.reyes@example.com'], D.people, 3);
  t('"give again" = the last different things you gave, to the same people', mine.length===3 && mine.every(x=>/: /.test(x.text)) && mine[0].text.indexOf('Check the fire extinguisher')>0);
}
/* the giver's view */
{
  let r=R.add(null, R.create({id:'g1', title:'Count trays', due:'2026-11-18', by:'jordan@example.com', people:[{id:'a@x',name:'Avery Alder'},{id:'b@x',name:'Blake Birch'},{id:'c@x',name:'Casey Cedar'}]}, new Date('2026-11-16T10:00:00')));
  t('one line for the giver: "Waiting on Avery, Blake and 1 more"', R.giverLine(r.t.g1)==='Waiting on Avery, Blake and 1 more');
  t('due today: no Nudge button while Home-Brace’s own morning reminder is on; with it off, there is one', !R.needsNudge(R.edit(r,'g1',{due:TODAY},NOW).t.g1, TODAY, NOW) && R.needsNudge(R.edit(r,'g1',{due:TODAY, remind:false},NOW).t.g1, TODAY, NOW));
  t('a late task is worth a nudge; nudged a minute ago it isn’t', R.needsNudge(r.t.g1, TODAY, NOW) && !R.needsNudge(R.nudged(r, 'g1', NOW).t.g1, TODAY, new Date(NOW.getTime()+60000)));
  t('no date and quiet for 3 days -> worth a nudge; given yesterday -> not yet', R.needsNudge(R.edit(r,'g1',{due:''},NOW).t.g1, TODAY, NOW) && !R.needsNudge(R.add(null, R.create({id:'g2', title:'x', by:'j@x', people:[{id:'a@x'}]}, new Date('2026-11-18T10:00:00'))).t.g2, TODAY, NOW));
  r=R.markDone(r, 'g1', 'a@x', null, NOW, 'jordan@example.com');
  t('the giver can mark someone done (they told them) - and it says so', !!r.t.g1.to['a@x'].d && r.t.g1.to['a@x'].mk==='jordan@example.com');
  t('undo clears who marked it', R.undo(r, 'g1', 'a@x').t.g1.to['a@x'].mk==='');
  /* reminders Home-Brace sends */
  const plan=(rec, day, hm, now)=>R.remindPlan(rec, day, hm, now||new Date(day+'T15:00:00Z')).map(p=>p.id+':'+p.kind+(p.silent?':silent':''));
  let q=R.add(null, R.create({id:'d1', title:'Due Thursday', due:'2026-11-19', by:'j@x', people:[{id:'a@x'}]}, new Date('2026-11-17T10:00:00')));
  t('the morning it is due (8 AM practice time on) -> a reminder', plan(q, '2026-11-19', '08:05').join()==='d1:due' && plan(q, '2026-11-19', '07:40').join()==='');
  q.t.d1.rem.due='x'; q=R.cleanRecord(q);
  t('sent once (stamped); the next working day it is late -> one more', plan(q, '2026-11-19', '09:00').join()==='' && plan(q, '2026-11-20', '09:00').join()==='d1:late');
  t('never on a weekend, never once everyone is done, never when reminders are off', plan(q, '2026-11-21', '09:00').join()==='' && plan(R.markDone(q,'d1','a@x','',NOW), '2026-11-20', '09:00').join()==='' && plan(R.edit(q,'d1',{remind:false},NOW), '2026-11-20', '09:00').join()==='');
  t('given on the day it is due -> no morning reminder on top of the new-task alert', R.create({title:'x', due:'2026-11-19', today:'2026-11-19', by:'j@x', people:[{id:'a@x'}]}, NOW).rem.due!=='');
  t('a new due date earns new reminders', R.edit(q, 'd1', {due:'2026-11-24'}, NOW).t.d1.rem.due==='');
  t('nudged by hand this morning -> the reminder is stamped but not sent again', plan(R.cleanRecord(Object.assign({}, R.nudged(R.cleanRecord({v:1,t:{d2:Object.assign({}, q.t.d1, {id:'d2', rem:{due:'',late:''}})}}), 'd2', new Date('2026-11-19T13:00:00Z')))), '2026-11-19', '09:00', new Date('2026-11-19T15:00:00Z')).join()==='d2:due:silent');
}

/* the pages - the switch, the tab, Heather's column, Home */
const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const U=read('user.js'), A=read('admin.html'), HOME=read('home.html'), P=read('tasks.html');
t('ON on the live site since 20/11/2026 (Heather: push tasks to production); the preview switch stays', /const TASKS_LIVE=true;/.test(U) && /function tasksOn\(\)\{ if\(env\(\)!=='live' \|\| TASKS_LIVE\) return true;/.test(U) && /taskspreview/.test(U));
t('everyone gets the Tasks tab (the switch decides, not a team)', /\{k:'tasks',\s+n:'[^']*Tasks',\s+href:'tasks\.html',\s+show:\(\)=>tasksOn\(\)\}/.test(U));
t('who can GIVE tasks by default: Admin (everything); Executive, Leadership, Office Managers, Clinic Managers, Doctors, Marketing (can give); not Staff, FCs or TCs (Cory 20/11)',
  /'admin':[^\n]*tasks:'manage'/.test(U) && ['executive team','leadership team','office managers','clinic managers','doctors','marketing team'].every(d=>new RegExp("'"+d+"':[^\\n]*tasks:'edit'").test(U)) &&
  ['tcs','financial coordinator team','staff'].every(d=>!new RegExp("'"+d+"':[^\\n]*tasks:").test(U)) && /c\.tasks===undefined && DEPT_CAN\[d\]/.test(U));
t('Heather decides in Teams & Access: Gets tasks / Can give / Everything (off the grid while Tasks is off)', /PH\.tasksOn && !PH\.tasksOn\(\)\) \? \[\] : \[\{k:'tasks'/.test(A) && /tasks:\['none','edit','manage'\]/.test(A) && /tasks:\{none:'Gets tasks',edit:'Can give',manage:'Everything'\}/.test(A));
t('the bell keeps who a notice is for (e.to) and shows it to them only', /to:arr\(e\.to\)/.test(U) && /if\(Array\.isArray\(e\.to\) && e\.to\.length\)\{/.test(U));
t('the page and Home load the rules', /<script src="tasks\.js\?v=hc\d+"><\/script>/.test(P) && /<script src="tasks\.js\?v=hc\d+"><\/script>/.test(HOME));
t('Home shows "Your tasks" only while Tasks is on', /PH\.tasksOn && PH\.tasksOn\(\)\) \|\| !window\.PH_TASKS\)\{ host\.hidden=true; return; \}/.test(HOME));
t('every change is merged onto the shared copy (PH_STORE.update), never written over it', /PH_STORE\.update\(R\.KEY/.test(P) && !/PH_STORE\.set\(R\.KEY, REC\)/.test(P));
t('the sandbox demo is never written on the live site', /if\(!LIVE\)\{ let v=''; try\{ v=localStorage\.getItem\('ph_tasks_demo'\)/.test(P));
t('the page says no patient details where you type', /No patient details in a task/.test(P));
t('closing asks first and says nothing is deleted', /Close this task\? It comes off everyone’s list \(nothing is deleted\)/.test(P));
/* 20/11/2026: a task for yourself; "New task" wording; buttons look like the rest of the app */
{ const me=R.create({title:'Call the lab', by:'emery@example.com', byName:'Emery Elm', people:[{id:'emery@example.com', name:'Emery Elm'}], today:TODAY}, NOW);
  const both=R.create({title:'Order gloves', by:'emery@example.com', byName:'Emery Elm', people:[{id:'emery@example.com', name:'Emery Elm'},{id:'avery@example.com', name:'Avery Alder'}], today:TODAY}, NOW);
  let r=R.add(R.add(R.cleanRecord(null), me), both);
  t('a task for yourself is on your own list', R.mine(r, ['emery@example.com'], TODAY, NOW).open.some(x=>x.id===me.id));
  t('...and not under "Tasks I assigned" (nobody else to wait on)', !R.given(r, ['emery@example.com'], TODAY).open.some(x=>x.id===me.id) && R.given(r, ['emery@example.com'], TODAY).open.some(x=>x.id===both.id));
  t('...but still in Everyone’s', R.given(r, null, TODAY).open.some(x=>x.id===me.id));
  t('Home does not count it as one you assigned', R.summary(r, ['emery@example.com'], TODAY).gaveOpen===1); }
t('a one-tap "＋ Me" on a new task, shown as "Me", and you are on it even if the team list does not have you', /data-act="addme"/.test(P) && /isMe\(k\) \? 'Me'/.test(P) && /add\.push\(\{id:WHO\.key, name:WHO\.name\}\)/.test(P));
t('no bell or alert to yourself; a task only for you says "Added to your tasks" and opens My tasks', /const others=ids\.filter\(k=>WHO\.keys\.indexOf\(k\)<0\)/.test(P) && /Added to your tasks/.test(P) && /TAB=others\.length \? 'gave' : 'mine'/.test(P));
t('the button says "New task" and the sheet "Assign to ..." (not "Give")', /＋ New task<\/button>/.test(P) && /'Assign to '/.test(P) && !/Give a task|Give the task|Give it to/.test(P));
t('no broken "font:... inherit" rules on the page (the browser drops them: thin, small button text)', !/font:\s*\d{3}[^;}]*\binherit/.test(P));
t('the main button matches the rest of the app (700, 14.5px)', /\.btn\{[^}]*font-weight:700;font-size:14\.5px/.test(P));
t('everyone can make a reminder for themselves: "＋ Reminder for me" for people who can’t assign, only "Me" on it, no names or groups', /textContent=can\('edit'\) \? '＋ New task' : '＋ Reminder for me'/.test(P) && /FORM\.self=!can\('edit'\); if\(FORM\.self\) FORM\.picks\.people=\[WHO\.key\]/.test(P) && /if\(FORM\.self\)\{ picks\.people=\[WHO\.key\]; picks\.offices=\[\]; picks\.teams=\[\]; picks\.all=false; \}/.test(P));
{ const own=R.create({title:'Call the lab', due:TODAY, by:'emery@example.com', byName:'Emery Elm', people:[{id:'emery@example.com', name:'Emery Elm'}], today:TODAY}, NOW);
  t('your own reminder’s alert doesn’t say "from" you', R.alertDue(own).body==='Call the lab' && !/from/.test(R.alertLate(own, TODAY).body));
  t('...a task from someone else still says who it’s from', /from Emery/.test(R.alertDue(R.create({title:'X', due:TODAY, by:'emery@example.com', byName:'Emery Elm', people:[{id:'avery@example.com', name:'Avery Alder'}], today:TODAY}, NOW)).body)); }
t('a new task starts with WHO: the people list is open, "＋ Add people" comes before "＋ Me" (Cory: "the most used use case will be assigning to someone")',
  /skip:\{\}, adding:true, q:''/.test(P) && /data-act="adding">'\+\(FORM\.adding \? 'Done' : '＋ Add people'\)\+'<\/button>'\+\s*\(meOn \? '' : '<button type="button" class="chip" data-act="addme"/.test(P) && /remind:t\.remind, adding:false\}/.test(P));
t('the demo is made-up people only', R.demo(['North'], NOW).people.every(p=>/@example\.com$/.test(p.email)));

/* 21/11/2026, code review: a new task whose save failed; chained changes; Home reads ph_tasks / ph_celebrate once */
const vm=require('vm');
const afn=(src,name)=>{ let i=src.indexOf('async function '+name+'('); if(i<0) i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
t('the reminder plan checks "already sent" once (the repeated late check is gone)', !/if\(kind==='late' && t\.rem\.late\) return;/.test(read('tasks.js')));
t('chained changes keep the last record when a step changes nothing (Change, Nudge all)', /rec=R\.removePerson\(rec\|\|cur, id, k, new Date\(\)\) \|\| rec;/.test(P) && /rec=R\.addPeople\(rec\|\|cur, id, P\.add, new Date\(\), how\) \|\| rec;/.test(P) &&
  /let rec; late\.forEach\(x=>\{ rec=R\.nudged\(rec\|\|cur, x\.id, new Date\(\)\) \|\| rec; \}\); return rec;/.test(P));
t('the sheet can’t be closed while a new task is saving', /case 'sheetx': if\(FORM && FORM\.busy\) return; return closeSheet\(\);/.test(P) && /if\(e\.key==='Escape' && FORM\)\{ if\(FORM\.busy\) return; return closeSheet\(\); \}/.test(P));
t('Home: no second ph-identity listener reading ph_tasks again (set() already redraws the tasks)', !/addEventListener\('ph-identity', function\(\)\{ try\{ renderTasks\(\); \}catch\(_\)\{\} \}\)/.test(HOME) && /tasksRead\(R\.KEY\)\.then\(got/.test(HOME) && /partyRead\(\)\.then\(r=>draw/.test(HOME));
t('Home: office names on the Documents tile and the summary are escaped', /'<span class="locchip">'\+esc\(l\)\+'<\/span>'/.test(HOME) && /'the '\+esc\(\(cur\.scopes\|\|\[cur\.scope\]\)\.join\(', '\)\)/.test(HOME));
(async ()=>{
  /* tasks.html send(): run as written, against a stand-in store answering each way store.js can */
  const sendSrc=afn(P,'send'), saveSrc=afn(P,'save'), changeSrc=afn(P,'saveChange');
  async function trySend(mode, twice){
    const told=[], buzzed=[], toasts=[]; let calls=0;
    const RR=Object.assign({}, R, {tell:(ids)=>told.push(ids.join()), buzz:(ids)=>buzzed.push(ids.join())});
    const w={R:RR, WHO:{key:'emery@example.com', keys:['emery@example.com'], name:'Emery Elm'}, REC:{v:1, t:{}}, LIVE:true, TAB:'mine', FILTER:'', OPEN:{}, closed:0, drew:0, rendered:0,
      FORM:{errs:[], notes:'', remind:true, picks:{people:['avery@example.com'], offices:[], teams:[], all:false}}, today:()=>TODAY, first:n=>String(n||'').split(' ')[0],
      grabNotes(){}, drawParts(){ w.drew++; }, render(){ w.rendered++; }, toast:m=>toasts.push(m), Promise, Object, JSON, Date};
    w.closeSheet=()=>{ w.closed++; w.FORM=null; };
    w.plan=()=>({title:'Count the aligner trays', due:'', add:[{id:'avery@example.com', name:'Avery Alder'}], picks:w.FORM.picks});
    w.PH_STORE={update:(key, fn)=>{ calls++; const v=fn(undefined);
      return new Promise(res=>setTimeout(()=>res(mode==='ok' ? {value:v} : mode==='local' ? {local:true, error:'SharePoint 503', value:v} :
        mode==='blocked' ? {blocked:true, why:'could not read', value:v} : {quota:true, error:'This browser has run out of room.'}), 5)); }};
    vm.createContext(w); vm.runInContext(sendSrc, w);
    const F=w.FORM; await (twice ? Promise.all([w.send(), w.send()]) : w.send());
    return {w, F, told, buzzed, toasts, calls, listed:Object.keys(w.REC.t).length};
  }
  let x=await trySend('local');
  t('new task kept on this device (SharePoint didn’t take it yet): the sheet closes, it says "saved on this device, will send when back online"', x.w.closed===1 && /Saved on this device — it will send when you’re back online/.test(x.toasts.join()));
  t('…and Avery still gets the bell entry and the alert; the task is listed once', x.told.join()==='avery@example.com' && x.buzzed.join()==='avery@example.com' && x.listed===1);
  x=await trySend('blocked');
  t('new task refused (a read that failed): the sheet stays open with the words, says it didn’t save, nothing listed, nobody told', x.w.closed===0 && x.w.FORM===x.F && /didn’t save/.test(x.F.errs.join()) && x.w.drew>0 && x.listed===0 && !x.told.length && !x.buzzed.length);
  x=await trySend('quota');
  t('new task not kept anywhere (browser full): the sheet stays open', x.w.closed===0 && /didn’t save/.test(x.F.errs.join()) && !x.told.length);
  x=await trySend('ok');
  t('new task saved: the sheet closes after the save, "Assigned to Avery", she is told', x.w.closed===1 && /Assigned to Avery/.test(x.toasts.join()) && x.told.length===1 && x.w.TAB==='gave');
  x=await trySend('ok', true);
  t('Enter twice while saving: one task, one save', x.calls===1 && x.listed===1 && x.told.length===1);
  /* save(): a refused save's value is not shown as if saved */
  { const toasts=[], w={R, REC:{v:1, t:{}}, toast:m=>toasts.push(m), render(){}, Promise, Object, JSON};
    w.PH_STORE={update:(k, fn)=>Promise.resolve({blocked:true, why:'x', value:fn(undefined)})};
    vm.createContext(w); vm.runInContext(saveSrc, w);
    const r=await w.save(cur=>R.add(cur, R.create({title:'X', by:'emery@example.com', people:[{id:'a@x'}]}, NOW)), 'ok');
    t('a refused save shows nothing new in the list and says it didn’t save', r===null && !Object.keys(w.REC.t).length && /didn’t save/.test(toasts.join())); }
  /* saveChange(): taking off someone who has done it changes nothing - the new words and the added person still go */
  { const T=R.create({id:'k1', title:'Old words', by:'emery@example.com', byName:'Emery Elm', people:[{id:'avery@example.com', name:'Avery Alder'}, {id:'blake@example.com', name:'Blake Birch'}]}, NOW);
    let base=R.markDone(R.add(null, T), 'k1', 'avery@example.com', '', NOW), mut=null;
    const w={R, REC:base, WHO:{keys:['emery@example.com']}, today:()=>TODAY, grabNotes(){}, closeSheet(){}, drawParts(){}, Object, JSON, Date,
      FORM:{id:'k1', drop:{'avery@example.com':true}, notes:'', remind:true, errs:[]}, save:async (fn)=>{ mut=fn; return null; }};
    w.plan=()=>({title:'New words', due:'', now:[{id:'blake@example.com'}], add:[{id:'casey@example.com', name:'Casey Cedar'}], picks:{people:[], offices:[], teams:[], all:false}});
    vm.createContext(w); vm.runInContext(changeSrc, w); await w.saveChange();
    const out=mut && mut(R.cleanRecord(base));
    t('Change: a step that changes nothing no longer drops the rest (new words + Casey added; Avery, who did it, stays)', !!out && out.t.k1.title==='New words' && !!out.t.k1.to['casey@example.com'] && !out.t.k1.to['avery@example.com'].gone);
    t('Change on a task that is gone: nothing to write', mut(R.cleanRecord(null))===undefined); }
  /* Home: one read of ph_tasks / ph_celebrate at a time */
  { let gets=0; const w={PH:{PARTY_KEY:'ph_celebrate'}, PH_STORE:{get:()=>{ gets++; return new Promise(r=>setTimeout(()=>r({v:1}), 5)); }}, Promise};
    const helpers=HOME.slice(HOME.indexOf('  let PARTY_P=null, TASKS_P=null;'), HOME.indexOf('  renderParty();'));
    vm.createContext(w); vm.runInContext(helpers+';this.partyRead=partyRead;this.tasksRead=tasksRead;', w);
    await Promise.all([w.partyRead(), w.partyRead(), w.tasksRead('ph_tasks'), w.tasksRead('ph_tasks'), w.tasksRead('ph_tasks')]);
    const burst=gets; await w.tasksRead('ph_tasks');
    t('Home: identity updates arriving together share one read of each record; a later one reads again', burst===2 && gets===3); }
})().catch(e=>{ bad.push('crashed: '+(e && e.stack || e)); }).then(()=>{
  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
});
