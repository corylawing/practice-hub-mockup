/* TASKS (19/11/2026). Jordan: "Can we build a task management part. Like leadership can assign a task to certain users who
   would get a notification and it would be in there today. Then leadership who assigned task can track which of their
   tasks are still open and which ones have be completed?" ... "I wouldn't call it leadership tasks. Maybe just tasks and
   Morgan can decide who can assign tasks and who cannot, because it might be office managers or whatever."

   So: everyone GETS tasks; who can GIVE them is the Tasks column of Admin -> Teams & Access (Morgan's choice):
     none   = gets the tasks given to them (My tasks), can't give one
     edit   = can give tasks to anyone, and follows the ones they gave (who's done, who isn't, a nudge)
     manage = all of that, plus every task in the practice (see, change, close)

   THE RECORD - one shared row, ph_tasks: {v:1, t:{<id>: task}}
     task = {id, title, notes, due:'YYYY-MM-DD'|'', by:<giver's key>, byName, at:<ISO given>, how:[labels used to pick
             people: "Everyone at Lakeview", "All Office Managers"], to:{<person key>: {n:name, d:<ISO done>|'', note,
             at:<ISO added>, gone:<ISO taken off>|''}}, closed:<ISO>|'', edited, nudged, nudges}
     A person's key is their email, lower case ('name:<their name>' for the few the team list has no email for).
     Everyone on a task has their own tick: "Everyone at Lakeview" becomes one line per person, so the giver sees exactly
     who has done it.
   NOTHING IS DELETED. Taking someone off a task marks them gone (and only before they've done it); closing a task marks
   it closed. A task that has been finished (everyone done, or closed) for 30 days moves to that year's archive row,
   ph_tasks_old_<year it was given>, so the shared row stays small however long the practice uses this - the archive is
   written first and the task leaves ph_tasks only once the archive holds it.
   No patient details in a task: tasks are in the shared list, not a locked folder (the page says so where you type).

   Rules only, no page code, so node tests can run them (test/tasks.test.js). tasks.html is the page; Home shows
   "Your tasks"; user.js has the switch (TASKS_LIVE) and the bell rule for entries addressed to people (e.to). */
(function(global){
  'use strict';
  const KEY='ph_tasks', OLD='ph_tasks_old_', KEEP_DAYS=30;
  const MAX_TITLE=140, MAX_NOTES=1500, MAX_NOTE=300, MAX_PEOPLE=400, MAX_HOW=12;
  const DAY=864e5;

  const lc=s=>String(s==null?'':s).toLowerCase().trim();
  const line=(v,n)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
  const text=(v,n)=>String(v==null?'':v).replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,n);
  const iso=s=>(typeof s==='string' && s && !isNaN(Date.parse(s))) ? s : '';
  const p2=n=>String(n).padStart(2,'0');
  function dayOf(d){ d=d instanceof Date ? d : new Date(d); return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
  const isDay=s=>typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dayOf(new Date(s+'T12:00:00'))===s;     // 30 Feb is not a day
  function addDays(day, n){ const d=new Date(day+'T12:00:00'); d.setDate(d.getDate()+n); return dayOf(d); }
  function weekday(day){ return new Date(day+'T12:00:00').getDay(); }

  /* ---------- people ---------- */
  /* One person's key: their email, else 'name:<their name>'. The same for a roster row, a signed-in person or a pick. */
  function personId(p){
    if(!p) return '';
    const e=lc(p.email||p.mail); if(e && e.indexOf('@')>0) return e.slice(0,160);
    const n=lc(p.name || ((p.f||p.first||'')+' '+(p.l||p.last||''))).replace(/\s+/g,' ');
    return n ? ('name:'+n).slice(0,160) : '';
  }
  /* Every key the signed-in person could be filed under (their email, and their name for a task given before the team
     list had their email). */
  function myKeys(me){
    const out=[]; const e=lc(me && (me.email||me.mail)); if(e) out.push(e);
    const n=lc(me && me.name).replace(/\s+/g,' '); if(n) out.push('name:'+n);
    return out;
  }
  const teamsOf=r=>Array.isArray(r.teams) ? r.teams : String(r.team||'').split(/[;,]/);
  const officesOf=r=>Array.isArray(r.offices) ? r.offices : (r.loc ? String(r.loc).split(/[;,]/) : []);
  /* The people a pick means, one each, by name. picks = {people:[keys], offices:[names], teams:[names], all:true}.
     Offices and teams are read off the team list as it is today (Admin -> People), so a 9th office or a new team works
     the day it is added. Someone marked Inactive is never included.
     opts.wide = how many offices the practice has: someone listed at every one of them is practice-wide (leadership),
     not "at Lakeview", so an office pick leaves them out. opts.not = the giver's own keys: a group pick never hands the
     giver their own task (they can still pick themselves by name). */
  function expand(picks, roster, opts){
    picks=picks||{}; opts=opts||{}; const want={}, out=[], not=(opts.not||[]).map(lc), wide=+opts.wide||0;
    const offs=(picks.offices||[]).map(lc), teams=(picks.teams||[]).map(lc), ppl=(picks.people||[]).map(lc);
    (roster||[]).forEach(r=>{
      if(!r || lc(r.status)==='inactive') return;
      const k=personId(r); if(!k || want[k]) return;
      const named=ppl.indexOf(k)>=0, ro=officesOf(r).filter(Boolean), everywhere=wide>1 && ro.length>=wide;
      const hit=named || (not.indexOf(k)<0 && (picks.all ||
        (!everywhere && ro.some(o=>offs.indexOf(lc(o))>=0)) || teamsOf(r).some(t=>teams.indexOf(lc(t))>=0)));
      if(!hit) return;
      want[k]=1; out.push({id:k, name:line(r.name || ((r.f||'')+' '+(r.l||'')),80)});
    });
    return out.sort((a,b)=>a.name.localeCompare(b.name));
  }
  /* The words for what was picked, for the task card: "Everyone", "Everyone at Lakeview", "All Office Managers". */
  function howWords(picks){
    picks=picks||{}; if(picks.all) return ['Everyone'];
    return (picks.offices||[]).map(o=>'Everyone at '+o).concat((picks.teams||[]).map(t=>'All '+t)).slice(0,MAX_HOW);
  }

  /* ---------- the record ---------- */
  function cleanTask(t){
    if(!t || typeof t!=='object') return null;
    const id=line(t.id,40), title=line(t.title,MAX_TITLE);
    if(!id || !title) return null;
    const to={}; let n=0;
    Object.keys(t.to||{}).forEach(k=>{
      const x=t.to[k], kk=lc(k).slice(0,160);
      if(!kk || !x || typeof x!=='object' || to[kk] || n>=MAX_PEOPLE) return; n++;
      to[kk]={n:line(x.n,80), d:iso(x.d), note:text(x.note,MAX_NOTE), at:iso(x.at), gone:iso(x.gone), mk:line(x.mk,160)};
    });
    return {id, title, notes:text(t.notes,MAX_NOTES), due:isDay(t.due) ? t.due : '', by:lc(t.by).slice(0,160), byName:line(t.byName,80),
      at:iso(t.at) || '1970-01-01T00:00:00.000Z', how:(Array.isArray(t.how) ? t.how : []).map(h=>line(h,60)).filter(Boolean).slice(0,MAX_HOW),
      to, closed:iso(t.closed), edited:iso(t.edited), nudged:iso(t.nudged), nudges:Math.max(0, Math.min(999, Math.floor(+t.nudges||0))),
      remind:t.remind!==false, rem:{due:line(t.rem && t.rem.due, 60), late:line(t.rem && t.rem.late, 60)}};
  }
  function cleanRecord(r){
    const out={v:1, t:{}};
    if(r && typeof r==='object' && r.t && typeof r.t==='object')
      Object.keys(r.t).forEach(id=>{ const c=cleanTask(Object.assign({}, r.t[id], {id:r.t[id] && r.t[id].id || id})); if(c) out.t[c.id]=c; });
    return out;
  }
  const list=rec=>Object.keys((rec && rec.t)||{}).map(k=>rec.t[k]);

  /* ---------- giving a task ---------- */
  /* What's missing before a task can go: words for each, in the page's voice. */
  function problems(o, today){
    const out=[];
    if(!line(o && o.title, MAX_TITLE)) out.push('Say what needs doing');
    if(!(o && o.people && o.people.length)) out.push('Pick who it’s for');
    if(o && o.due && !isDay(o.due)) out.push('That due date isn’t a date');
    else if(o && o.due && today && o.due<today) out.push('That due date has already passed');
    return out;
  }
  function newId(now){ return 't'+now.getTime().toString(36)+Math.random().toString(36).slice(2,7); }
  /* o = {title, notes, due, by, byName, people:[{id,name}], how} -> the task, ready to add. */
  function create(o, now){
    now=now||new Date(); const at=now.toISOString(), to={};
    (o.people||[]).forEach(p=>{ const k=lc(p.id||personId(p)); if(k && !to[k]) to[k]={n:line(p.name,80), d:'', note:'', at, gone:''}; });
    /* given on the day it's due: they've just been told, so the morning reminder for today is already done */
    const rem={due:(o.due && o.today && o.due===o.today) ? at : '', late:''};
    return cleanTask({id:o.id||newId(now), title:o.title, notes:o.notes, due:o.due, by:o.by, byName:o.byName, at, how:o.how, to, remind:o.remind!==false, rem});
  }
  function add(rec, task){ rec=cleanRecord(rec); const c=cleanTask(task); if(c && !rec.t[c.id]) rec.t[c.id]=c; return rec; }

  /* ---------- reading one task ---------- */
  function people(t){ return Object.keys((t && t.to)||{}).filter(k=>!t.to[k].gone).map(k=>Object.assign({id:k}, t.to[k])); }
  function progress(t){ const p=people(t), done=p.filter(x=>x.d).length; return {total:p.length, done, open:p.length-done, all:p.length>0 && done===p.length}; }
  function finished(t){ return !!(t && (t.closed || progress(t).all)); }
  function finishedAt(t){
    if(!t) return ''; if(t.closed) return t.closed;
    const p=people(t); return p.length && p.every(x=>x.d) ? p.map(x=>x.d).sort().pop() : '';
  }
  function openIds(t){ return people(t).filter(x=>!x.d).map(x=>x.id); }
  /* Which of my keys this task has me under (not taken off), or ''. */
  function slotFor(t, keys){ for(const k of (keys||[])){ const x=t && t.to && t.to[k]; if(x && !x.gone) return k; } return ''; }
  function isGiver(t, keys){ return !!(t && t.by && (keys||[]).indexOf(t.by)>=0); }

  /* ---------- due dates ---------- */
  /* 'none' | 'late' | 'today' | 'tomorrow' | 'week' (within 6 days) | 'later' */
  function dueState(due, today){
    if(!isDay(due)) return 'none'; if(due<today) return 'late'; if(due===today) return 'today';
    if(due===addDays(today,1)) return 'tomorrow'; if(due<=addDays(today,6)) return 'week'; return 'later';
  }
  const WD=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function shortDay(day, today){
    const d=new Date(day+'T12:00:00'), s=WD[d.getDay()].slice(0,3)+' '+MO[d.getMonth()]+' '+d.getDate();
    return (today && day.slice(0,4)!==today.slice(0,4)) ? s+', '+day.slice(0,4) : s;
  }
  function dueText(due, today){
    const st=dueState(due, today);
    if(st==='none') return ''; if(st==='today') return 'Due today'; if(st==='tomorrow') return 'Due tomorrow';
    if(st==='late'){ const n=Math.round((new Date(today+'T12:00:00')-new Date(due+'T12:00:00'))/DAY); return 'Overdue · was due '+(n===1 ? 'yesterday' : shortDay(due, today)); }
    if(st==='week') return 'Due '+WD[weekday(due)];
    return 'Due '+shortDay(due, today);
  }
  /* The quick due-date choices: today, tomorrow, this Friday (or next, from Friday on), next Monday, in two weeks. */
  function quickDues(today){
    const wd=weekday(today), fri=addDays(today, ((5-wd+7)%7)||7), mon=addDays(today, ((1-wd+7)%7)||7);
    const all=[{k:'today', n:'Today', d:today}, {k:'tomorrow', n:'Tomorrow', d:addDays(today,1)},
            {k:'fri', n:'Friday', d:fri}, {k:'mon', n:'Next Monday', d:mon}, {k:'2w', n:'In 2 weeks', d:addDays(today,14)}];
    return all.filter((x,i)=>!all.slice(0,i).some(y=>y.d===x.d));      // on a Thursday "Friday" is "Tomorrow" - one button, not two
  }
  const DUE_ORDER={late:0, today:1, tomorrow:2, week:3, later:4, none:5};
  function byDue(today){
    return (a,b)=>{ const x=DUE_ORDER[dueState(a.due,today)], y=DUE_ORDER[dueState(b.due,today)];
      if(x!==y) return x-y; if(a.due!==b.due) return a.due<b.due ? -1 : 1; return a.at<b.at ? 1 : -1; };
  }

  /* ---------- the lists ---------- */
  /* My tasks: open ones first (overdue, today, tomorrow, this week, later, no date), then the ones I did in the last
     7 days. A closed task leaves my list. Each item carries `me` (my line on it). */
  function mine(rec, keys, today, now){
    now=now||new Date(); const cut=new Date(now.getTime()-7*DAY).toISOString(), open=[], done=[];
    list(rec).forEach(t=>{
      if(t.closed) return; const k=slotFor(t, keys); if(!k) return;
      const it=Object.assign({}, t, {me:Object.assign({id:k}, t.to[k])});
      if(!t.to[k].d) open.push(it); else if(t.to[k].d>=cut) done.push(it);
    });
    open.sort(byDue(today)); done.sort((a,b)=>a.me.d<b.me.d ? 1 : -1);
    return {open, done};
  }
  /* The tasks someone gave (keys = theirs), or every task (keys = null, for Everything). Open: the ones with someone
     overdue first, then by due date. Finished: newest first. */
  /* A task someone made just for themselves (20/11/2026, Morgan: assign a task to yourself) is on their own list, not
     under "Tasks I assigned" - nobody else to wait on. */
  function given(rec, keys, today){
    const open=[], done=[];
    const selfOnly=t=>{ const p=people(t); return p.length>0 && p.every(x=>keys.indexOf(x.id)>=0); };
    list(rec).forEach(t=>{ if(keys && (!isGiver(t, keys) || selfOnly(t))) return; (finished(t) ? done : open).push(t); });
    open.sort(byDue(today)); done.sort((a,b)=>finishedAt(a)<finishedAt(b) ? 1 : -1);
    return {open, done};
  }
  /* For Home: how many of mine are open, overdue and due today; how many I gave are open, and with someone late. */
  function summary(rec, keys, today){
    const m=mine(rec, keys, today), g=given(rec, keys, today);
    return {open:m.open.length, late:m.open.filter(t=>dueState(t.due,today)==='late').length, today:m.open.filter(t=>dueState(t.due,today)==='today').length,
            gaveOpen:g.open.length, gaveLate:g.open.filter(t=>dueState(t.due,today)==='late').length};
  }

  /* ---------- changes (each returns the new record; used inside PH_STORE.update, so they merge) ---------- */
  /* Nothing changed (no such task, refused, or the same task again) -> undefined, so PH_STORE.update writes nothing
     (21/11/2026, code review). A caller chaining several changes keeps the last record: `rec=f(rec, ...) || rec`. */
  function change(rec, id, fn){
    rec=cleanRecord(rec); const t=rec.t[id]; if(!t) return undefined;
    const c=JSON.parse(JSON.stringify(t)); if(fn(c)===false) return undefined;
    const ok=cleanTask(c); if(!ok || JSON.stringify(ok)===JSON.stringify(t)) return undefined;
    rec.t[id]=ok; return rec;
  }
  function markDone(rec, id, key, note, now, by){
    return change(rec, id, t=>{ const x=t.to[key]; if(!x || x.gone || t.closed) return false; if(!x.d){ x.d=(now||new Date()).toISOString(); x.mk=by ? lc(by) : ''; } if(note!=null) x.note=text(note,MAX_NOTE); });
  }
  function setNote(rec, id, key, note){ return change(rec, id, t=>{ const x=t.to[key]; if(!x || x.gone) return false; x.note=text(note,MAX_NOTE); }); }
  function undo(rec, id, key){ return change(rec, id, t=>{ const x=t.to[key]; if(!x || !x.d) return false; x.d=''; x.mk=''; }); }
  function edit(rec, id, o, now){
    return change(rec, id, t=>{
      if(o.title!=null){ const ti=line(o.title,MAX_TITLE); if(!ti) return false; t.title=ti; }
      if(o.notes!=null) t.notes=text(o.notes,MAX_NOTES);
      if(o.due!=null){ const d=isDay(o.due) ? o.due : ''; if(d!==t.due){ t.due=d; t.rem={due:'', late:''}; } }   // a new date earns new reminders
      if(o.remind!=null) t.remind=!!o.remind;
      t.edited=(now||new Date()).toISOString();
    });
  }
  /* More people on a task. Someone taken off earlier comes back with a fresh, open line. */
  function addPeople(rec, id, ppl, now, how){
    const at=(now||new Date()).toISOString();
    return change(rec, id, t=>{
      (ppl||[]).forEach(p=>{ const k=lc(p.id||personId(p)); if(!k) return; const x=t.to[k];
        if(!x) t.to[k]={n:line(p.name,80), d:'', note:'', at, gone:''}; else if(x.gone){ x.gone=''; x.d=''; x.note=''; x.at=at; } });
      (how||[]).forEach(h=>{ if(t.how.indexOf(h)<0) t.how.push(h); });
    });
  }
  /* Off the task - only someone who hasn't done it (a done tick is the giver's record, it stays). */
  function removePerson(rec, id, key, now){ return change(rec, id, t=>{ const x=t.to[key]; if(!x || x.gone || x.d) return false; x.gone=(now||new Date()).toISOString(); }); }
  function close(rec, id, now){ return change(rec, id, t=>{ if(t.closed) return false; t.closed=(now||new Date()).toISOString(); }); }
  function reopen(rec, id){ return change(rec, id, t=>{ if(!t.closed) return false; t.closed=''; }); }
  function nudged(rec, id, now){ return change(rec, id, t=>{ t.nudged=(now||new Date()).toISOString(); t.nudges=(t.nudges||0)+1; }); }
  /* A nudge is offered once an hour per task, so nobody gets a string of them. Returns minutes to wait, or 0. */
  function nudgeWait(t, now){ if(!t || !t.nudged) return 0; const m=60-Math.floor(((now||new Date())-new Date(t.nudged))/60000); return m>0 ? m : 0; }

  /* ---------- the archive ---------- */
  /* Tasks finished more than 30 days ago, by the year they were given: {year: {id: task}}. */
  function oldOnes(rec, now){
    const cut=new Date((now||new Date()).getTime()-KEEP_DAYS*DAY).toISOString(), out={};
    list(cleanRecord(rec)).forEach(t=>{ const f=finishedAt(t); if(!f || f>=cut) return; const y=String(t.at).slice(0,4); (out[y]=out[y]||{})[t.id]=t; });
    return out;
  }
  /* Into a year's archive row (never over a task already there). */
  function toArchive(arc, tasks){ arc=cleanRecord(arc); Object.keys(tasks||{}).forEach(id=>{ const c=cleanTask(tasks[id]); if(c && !arc.t[c.id]) arc.t[c.id]=c; }); return arc; }
  /* Out of ph_tasks - only the ids the archive is confirmed to hold, and only if still finished. */
  /* Oldest first, and never so many in one save that the list loses most of its weight: Practice Hub refuses a save that
     drops below a quarter of a record (the wipe guard in store.js - it would show a "not saved" warning). The rest go on
     a later day; they're finished, so nothing shows wrong meanwhile (20/11/2026, before Tasks went live). */
  const weight=v=>v===null || v===undefined || v==='' || v===false ? 0 : typeof v!=='object' ? 1 : Object.keys(v).reduce((n,k)=>n+weight(v[k]), 0);
  function dropArchived(rec, held){
    rec=cleanRecord(rec); const h=(held && held.t) || {};
    const go=Object.keys(rec.t).filter(id=>h[id] && finished(rec.t[id])).sort((a,b)=>String(finishedAt(rec.t[a])).localeCompare(String(finishedAt(rec.t[b]))));
    const was=weight(rec); let left=was;
    go.forEach(id=>{ const w=weight(rec.t[id]); if(left-w < was*0.4) return; left-=w; delete rec.t[id]; });
    return rec;
  }

  /* ---------- words for alerts and the bell ---------- */
  const first=n=>String(n||'').trim().split(/\s+/)[0]||'';
  function alertNew(t, today){ return {title:'New task from '+(first(t.byName)||'Practice Hub'), body:t.title+(t.due ? ' · '+dueText(t.due, today) : '')}; }
  function alertNudge(t, today){ return {title:'Reminder from '+(first(t.byName)||'Practice Hub'), body:t.title+(t.due ? ' · '+dueText(t.due, today) : '')}; }
  function alertAllDone(t){ return {title:'All done ✓ '+t.title, body:'Everyone on this task has finished it.'}; }
  function bellDone(t, who){ const p=progress(t); return '✅ '+first(who)+' finished “'+t.title+'”'+(p.total>1 ? ' ('+p.done+' of '+p.total+' done)' : ''); }

  /* ---------- understanding what was typed ---------- */
  /* Jordan 19/11: "A little bit cleaner, and easier to use with good use cases.. It should be intelligent but not a stupid
     task system". So a task can be typed the way it would be said, and the page fills in who and when:
       "Office managers: count the aligner trays by Friday"     -> All Office Managers, due Friday, "Count the aligner trays"
       "Ask Maya and Dana to send the photos tomorrow"          -> Maya + Dana, due tomorrow, "Send the photos"
       "Everyone at Lakeview - restock the brochures by the 5th"   -> everyone at Lakeview, due the 5th
     WHO is only read from the front ("<who>: ..." / "<who> - ..." / "Ask <who> to ..."), and only when every name in it is
     someone or something real (a person, an office, a team, "everyone") - so "Reminder: ..." or "Send me a photo of
     Lakeview' front desk" stay exactly as typed. WHEN is only read from the end. Names come from the team list, offices
     from Admin -> Locations and teams from the people on the team list, so a 9th office or a new team works at once. */
  const fold=s=>String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’‘`]/g,"'").replace(/\s+/g,' ').trim();
  const WD3=['sun','mon','tue','wed','thu','fri','sat'], MON3=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const NUMW={a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6};
  function nextWd(today, wd, incl){ let n=(wd-weekday(today)+7)%7; if(n===0 && !incl) n=7; return addDays(today, n); }
  function workBack(d){ while(weekday(d)===0 || weekday(d)===6) d=addDays(d,-1); return d; }
  function monthDay(today, m, d, y){
    const yy=y ? (y<100 ? 2000+y : y) : +today.slice(0,4), s=yy+'-'+p2(m)+'-'+p2(d);
    if(!isDay(s)) return ''; if(!y && s<today) return (yy+1)+'-'+p2(m)+'-'+p2(d); return s;
  }
  /* A phrase (already folded, no "by") -> a day, or ''. strong = it can stand at the end without "by"/"due". */
  function dateOf(p, today){
    p=String(p||'').replace(/[.!,;]+$/,'').trim(); let m;
    if(/^(today|tonight|eod|end of (the )?day)$/.test(p)) return {d:today, strong:true};
    if(/^(tomorrow|tmrw|tmr|tomorow)$/.test(p)) return {d:addDays(today,1), strong:true};
    if((m=/^(this |next |coming )?(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/.exec(p)) && /^(sun(day)?|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?)$/.test(p.replace(/^(this|next|coming) /,''))){
      const wd=WD3.indexOf(m[2]);
      if(m[1]==='next '){ const d=nextWd(today, wd, false), mon=nextWd(today, 1, false); return {d:d<mon ? addDays(d,7) : d, strong:true}; }
      return {d:nextWd(today, wd, true), strong:true};
    }
    if(/^(end of (the )?week|eow|this week|the end of the week)$/.test(p)){ const wd=weekday(today); return {d:(wd===6||wd===0) ? nextWd(today,5,false) : nextWd(today,5,true), strong:true}; }
    if(/^next week$/.test(p)) return {d:nextWd(today,1,false), strong:false};
    if(/^(end of (the )?month|eom|month end|the end of the month)$/.test(p)){
      const t=new Date(today+'T12:00:00'), last=dayOf(new Date(t.getFullYear(), t.getMonth()+1, 0, 12)), w=workBack(last);
      return {d:w<today ? today : w, strong:true}; }
    if((m=/^in (\d{1,2}|a|an|one|two|three|four|five|six) (day|days|week|weeks)$/.exec(p))){ const n=NUMW[m[1]]||+m[1]; return {d:addDays(today, /week/.test(m[2]) ? n*7 : n), strong:true}; }
    if((m=/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(p))){ const d=monthDay(today, +m[1], +m[2], m[3] ? +m[3] : 0); return d ? {d, strong:true} : null; }
    if((m=/^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/.exec(p)) && MON3.indexOf(m[1].slice(0,3))>=0){ const d=monthDay(today, MON3.indexOf(m[1].slice(0,3))+1, +m[2], m[3] ? +m[3] : 0); return d ? {d, strong:true} : null; }
    if((m=/^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]{3,9})$/.exec(p)) && MON3.indexOf(m[2].slice(0,3))>=0){ const d=monthDay(today, MON3.indexOf(m[2].slice(0,3))+1, +m[1], 0); return d ? {d, strong:true} : null; }
    if((m=/^the (\d{1,2})(?:st|nd|rd|th)$/.exec(p))){ const t=new Date(today+'T12:00:00'); let d=monthDay(today, t.getMonth()+1, +m[1], t.getFullYear());
      if(!d || d<today){ const n=new Date(t.getFullYear(), t.getMonth()+1, 1, 12); d=monthDay(today, n.getMonth()+1, +m[1], n.getFullYear()); } return d ? {d, strong:true} : null; }
    return null;
  }
  /* The due date at the END of the words: "... by Friday", "... due 12/3", "... tomorrow". -> {rest, due, said} */
  function takeDue(txt, today){
    const words=String(txt||'').trim().split(/\s+/);
    for(let n=Math.min(6, words.length-1); n>=1; n--){
      const head=words.slice(0, words.length-n).join(' ').replace(/[\s,;:–—-]+$/,''), tail=fold(words.slice(-n).join(' ')).replace(/^[,;:–—-]+\s*/,'');
      if(!head) continue;
      const m=/^(by|due|before|on|until|no later than)\s+(.+)$/.exec(tail), dd=dateOf(m ? m[2] : tail, today);
      if(dd && dd.d && (m || dd.strong)) return {rest:head, due:dd.d, said:words.slice(-n).join(' ')};
    }
    return {rest:String(txt||'').trim(), due:'', said:''};
  }
  /* One name in a who-list -> {kind:'all'|'office'|'team'|'person', v, label} or null. ambiguous = several people match. */
  function plural(x){ return x.replace(/'s$/,'').replace(/s$/,''); }
  function whoOne(tok, ctx){
    let x=fold(tok).replace(/^(the|our)\s+/,'');
    if(/^(everyone|everybody|all|all staff|the whole team|the whole practice|everyone in the practice|whole team)$/.test(x)) return {kind:'all', v:'', label:'Everyone'};
    if(/^(me|myself)$/.test(x) && ctx.me) return {kind:'person', v:ctx.me, label:'Me'};
    const bare=x.replace(/^(all|every|everyone|everybody|all of|all the)\s+(at\s+|in\s+|from\s+)?/,'').replace(/\s+(office|team|staff|crew|people)$/,'').trim();
    const ppl=ctx.roster||[];
    const full=ppl.filter(r=>fold(r.name)===x); if(full.length===1) return {kind:'person', v:personId(full[0]), label:full[0].name};
    for(const o of (ctx.offices||[])){ const f=fold(o); if(f===bare || f.replace(/\s*\(.*\)$/,'')===bare) return {kind:'office', v:o, label:'Everyone at '+o}; }
    for(const t of (ctx.teams||[])){
      const f=fold(t), base=f.replace(/\s+team$/,''), ac=base.split(' ').map(w=>w[0]).join('');
      const forms=[f, base, plural(base), ac, ac+'s'].concat(base.split(' ').length===1 ? [] : []);
      if(forms.indexOf(bare)>=0 || forms.indexOf(plural(bare))>=0 || (/^(drs?|docs?)$/.test(bare) && /^doctor/.test(base))) return {kind:'team', v:t, label:'All '+t};
    }
    const firsts=ppl.filter(r=>fold(r.name).split(' ')[0]===x);
    if(firsts.length===1) return {kind:'person', v:personId(firsts[0]), label:firsts[0].name};
    const fl=/^(\S+) (\S)\.?$/.exec(x); if(fl){ const h=ppl.filter(r=>{ const w=fold(r.name).split(' '); return w[0]===fl[1] && (w[w.length-1]||'')[0]===fl[2]; }); if(h.length===1) return {kind:'person', v:personId(h[0]), label:h[0].name}; }
    if(firsts.length>1) return {kind:'ambiguous', v:x, label:tok.trim(), n:firsts.length};
    return null;
  }
  function whoList(str, ctx){
    const toks=String(str||'').split(/\s*(?:,|&|\+|\/|\band\b)\s*/i).map(x=>x.trim()).filter(Boolean);
    if(!toks.length || toks.length>12) return null;
    const got=toks.map(t=>({t, w:whoOne(t, ctx)}));
    const ok=got.filter(g=>g.w && g.w.kind!=='ambiguous');
    /* a real first name that fits two people ("Maya") still counts as a name: it is taken off the words and asked about */
    return (ok.length || got.some(g=>g.w && g.w.kind==='ambiguous')) ? {found:ok.map(g=>g.w), unknown:got.filter(g=>!g.w || g.w.kind==='ambiguous').map(g=>g.w ? g.w.n+' people called '+g.w.label : '“'+g.t+'”')} : null;
  }
  function takeWho(txt, ctx){
    const s0=String(txt||'').trim(); let m;
    if((m=/^(?:please\s+)?(?:ask|have|get|tell|remind)\s+(.+?)\s+to\s+(.+)$/i.exec(s0))){ const w=whoList(m[1], ctx); if(w) return Object.assign({rest:m[2]}, w); }
    if((m=/^([^:–—]{2,90}?)\s*[:–—]\s*(.+)$/.exec(s0)) || (m=/^(.{2,90}?)\s+-\s+(.+)$/.exec(s0))){ const w=whoList(m[1], ctx); if(w) return Object.assign({rest:m[2]}, w); }
    return {rest:s0, found:[], unknown:[]};
  }
  /* "Office managers: count the trays by Friday" -> {title, due, dueSaid, who:[{kind,v,label}], unknown:[words], picks} */
  function understand(txt, ctx){
    ctx=ctx||{}; const today=ctx.today||dayOf(new Date());
    const w=takeWho(txt, ctx), d=takeDue(w.rest, today);
    let title=d.rest.replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g,'').replace(/^(please|pls)\s+/i,'');
    if(!title) title=String(txt||'').trim();
    title=title.charAt(0).toUpperCase()+title.slice(1);
    const picks={people:[], offices:[], teams:[], all:false};
    w.found.forEach(x=>{ if(x.kind==='all') picks.all=true; else if(x.kind==='office') picks.offices.push(x.v); else if(x.kind==='team') picks.teams.push(x.v); else picks.people.push(x.v); });
    return {title:line(title, MAX_TITLE), due:d.due, dueSaid:d.said, who:w.found, unknown:w.unknown, picks};
  }

  /* ---------- ideas: the practice's own use cases, and what this person has given before ---------- */
  /* Only offered when the practice has that team (read off the team list), in its own words. Nothing about patients. */
  const IDEAS=[
    {team:/office manager/, text:'{T}: count the aligner trays and order what’s low by Friday', ic:'📦'},
    {team:/office manager/, text:'{T}: check the fire extinguisher and eyewash dates by end of week', ic:'🧯'},
    {team:/office manager/, text:'{T}: put up the new promo posters by Monday', ic:'📣'},
    {team:/^tcs?$|treatment coordinator/, text:'{T}: send me your top 3 wins this month by Friday', ic:'🏆'},
    {team:null, text:'Everyone: read the new uniform policy by end of week', ic:'👕'},
    {team:null, text:'Everyone: update your emergency contact in My profile by end of week', ic:'☎️'}];
  function ideas(ctx){
    const teams=ctx.teams||[];
    return IDEAS.map(x=>{ if(!x.team) return {text:x.text, ic:x.ic}; const t=teams.find(n=>x.team.test(fold(n))); return t ? {text:x.text.replace('{T}', t), ic:x.ic} : null; }).filter(Boolean);
  }
  /* "Give again": the last few different things this person gave, ready to send again to the same people. */
  function recent(rec, keys, roster, n){
    const seen={}, out=[];
    list(rec).filter(t=>isGiver(t, keys)).sort((a,b)=>a.at<b.at ? 1 : -1).forEach(t=>{
      const k=fold(t.title); if(seen[k] || out.length>=(n||3)) return; seen[k]=1;
      const who=t.how.length ? t.how.join(', ') : people(t).map(x=>x.n).filter(Boolean).slice(0,6).join(', ');
      if(who) out.push({text:who+': '+t.title, ic:'↻', at:t.at});
    });
    return out;
  }

  /* ---------- a word on each task ---------- */
  const names=a=>a.length<=2 ? a.join(' and ') : a.slice(0,2).join(', ')+' and '+(a.length-2)+' more';
  function waitingOn(t){ return people(t).filter(x=>!x.d).sort((a,b)=>a.n.localeCompare(b.n)).map(x=>first(x.n)); }
  /* Worth a nudge now? Not finished, someone still to do it, not nudged in the last hour, and: late; or due today with
     Practice Hub's own reminders off (with them on, the morning reminder already went); or no date and nobody has moved
     for 3 days. */
  function needsNudge(t, today, now){
    if(!t || finished(t) || !openIds(t).length || nudgeWait(t, now)) return false;
    const st=dueState(t.due, today); if(st==='late') return true; if(st==='today') return !t.remind;
    if(!t.due){ const quiet=((now||new Date())-new Date(t.nudged || t.at))/DAY; return quiet>=3; }
    return false;
  }
  /* "Waiting on Maya and Sam" / "Everyone's done" / "Closed" - the one line a giver needs. */
  function giverLine(t){
    if(t.closed) return 'Closed'; const p=progress(t); if(p.all) return 'Everyone’s done';
    return 'Waiting on '+names(waitingOn(t));
  }

  /* ---------- reminders Practice Hub sends for the giver ---------- */
  /* Practice time (Central). From 8 AM on a weekday: the morning it's due, and once the first working day it's late -
     to the people who haven't done it. Each is sent once (stamped in the task; the device whose stamp lands sends it).
     A task nudged by hand in the last 12 hours is stamped but not sent again. */
  function remindPlan(rec, today, hm, now){
    const out=[]; if(String(hm||'')<'08:00') return out; const wd=weekday(today); if(wd===0 || wd===6) return out;
    list(rec).forEach(t=>{
      if(!t.remind || !t.due || finished(t) || !openIds(t).length) return;
      const kind=t.due===today ? 'due' : (t.due<today ? 'late' : ''); if(!kind || t.rem[kind]) return;
      const silent=!!(t.nudged && ((now||new Date())-new Date(t.nudged))<12*36e5);
      out.push({id:t.id, kind, silent});
    });
    return out;
  }
  const selfMade=t=>{ const p=people(t); return p.length>0 && p.every(x=>x.id===t.by); };      // a reminder someone made for themselves
  function alertDue(t){ return {title:'Due today', body:t.title+(t.byName && !selfMade(t) ? ' — from '+first(t.byName) : '')}; }
  function alertLate(t, today){ return {title:'Still to do', body:t.title+' — '+dueText(t.due, today).replace('Overdue · ','')+(t.byName && !selfMade(t) ? ' · from '+first(t.byName) : '')}; }

  /* ---------- the sandbox's made-up practice ---------- */
  /* Made-up people and tasks for the sandbox (never the live site). Offices are the practice's own list as it is today, so
     the demo follows a 9th office too. Fixed ids: opening it again never doubles anything. */
  const DEMO_PEOPLE=[['Priya Nair','Admin','Practice administrator','all'],['Jordan Ramsey','Leadership Team','Operations lead','all'],
    ['Maya Chen','Office Managers','Office manager',0],['Dana Brooks','Office Managers','Office manager',1],['Rory Lane','Office Managers','Office manager',2],
    ['Sam Whitfield','Office Managers','Office manager',3],['Luis Ortega','TCs','Treatment coordinator',0],['Jules Moreno','TCs','Treatment coordinator',1],
    ['Avery Patel','Staff','Front desk',0],['Theo Grant','Staff','Clinical assistant',2],['Nina Alvarez','Clinic Managers','Clinic lead',3],['Kai Turner','Staff','Clinical assistant',4]];
  function demo(offices, now, day){
    now=now||new Date(); offices=(offices&&offices.length) ? offices : ['Main office'];
    const today=isDay(day) ? day : dayOf(now), ago=h=>new Date(now.getTime()-h*36e5).toISOString();   // day = the practice's day (Central)
    const wk=n=>{ let d=addDays(today,n); while(weekday(d)===0 || weekday(d)===6) d=addDays(d, n<0 ? -1 : 1); return d; };   // a working day
    const people=DEMO_PEOPLE.map(d=>({name:d[0], email:d[0].toLowerCase().replace(/[^a-z]+/g,'.')+'@example.com', teams:[d[1]], role:d[2],
      offices:d[3]==='all' ? offices.slice() : [offices[d[3]%offices.length]]}));
    const P=n=>people.find(x=>x.name.indexOf(n)===0), id=n=>P(n).email;
    const mk=(o)=>{ const t=create({id:o.id, title:o.title, notes:o.notes, due:o.due, by:id(o.by), byName:P(o.by).name, how:o.how,
        people:o.to.map(n=>({id:id(n), name:P(n).name}))}, new Date(now.getTime()-o.h*36e5));
      (o.done||[]).forEach(d=>{ t.to[id(d[0])].d=ago(d[1]); t.to[id(d[0])].note=d[2]||''; }); return t; };
    const o0=offices[0], rec={v:1, t:{}};
    [ mk({id:'demo1', by:'Jordan', h:26, title:'Count the aligner trays and order what’s low', notes:'Both closets. Note what you ordered so I can match the invoice.',
          due:wk(2), to:['Maya','Dana','Rory','Sam'], how:['All Office Managers'], done:[['Dana',5,'Ordered 2 boxes of 50'],['Rory',2]]}),
      mk({id:'demo2', by:'Jordan', h:98, title:'Send me your top 3 patient wins from this month', due:wk(-1), to:['Maya','Luis','Jules'], done:[['Luis',30,'Sent them in Teams']]}),
      mk({id:'demo3', by:'Priya', h:50, title:'Finish the HIPAA refresher in the Academy', notes:'About 15 minutes. Tell me if the link doesn’t open.',
          due:wk(6), to:people.filter(x=>x.offices.length===1 && x.offices[0]===o0).map(x=>x.name.split(' ')[0]), how:['Everyone at '+o0], done:[['Avery',20]]}),
      mk({id:'demo4', by:'Jordan', h:3, title:'Check the fire extinguisher dates and send me a photo', due:today, to:['Maya']}),
      mk({id:'demo5', by:'Priya', h:1, title:'Look over the December schedule changes', due:wk(1), to:['Jordan']}),
      mk({id:'demo6', by:'Jordan', h:150, title:'Update your emergency contact in My profile', to:['Maya','Dana','Rory','Sam','Luis','Jules'], how:['All Office Managers','All TCs'],
          done:[['Maya',140],['Dana',120,'Done - new number'],['Rory',100],['Sam',96],['Luis',80],['Jules',75]]})
    ].forEach(t=>{ rec.t[t.id]=t; });
    return {people, rec:cleanRecord(rec)};
  }

  /* ---------- shared by tasks.html and Home (browser only) ---------- */
  /* The bell: an entry only the people in `ids` see (user.js canSeeActivity, e.to). */
  function tell(ids, title, ic){ try{ if(ids && ids.length && global.PH && global.PH.logActivity) global.PH.logActivity({kind:'task', sec:'tasks', ic:ic||'📋', title, to:ids}); }catch(_){} }
  /* Phone / computer alerts (live only; people who turned alerts on). */
  function buzz(ids, msg, tag){
    const H=global.PH, em=(ids||[]).filter(k=>String(k).indexOf('@')>0);
    if(!em.length || !(H && H.isLive && H.isLive() && H.alertsReady)) return;
    H.alertsReady().then(A=>{ if(!A || !A.ON || !A.sendTo) return; return A.sendTo(em, {title:msg.title, body:msg.body, url:A.here('tasks.html'), tag}); }).catch(()=>{});
  }
  /* I've done it: tick it (merged onto the shared record), tell the giver in the bell, and when I was the last one,
     alert the giver that everyone has finished. */
  async function finish(id, key, who, note){
    const S=global.PH_STORE; if(!S) return null; let was=null;
    const r=await S.update(KEY, cur=>{ const rec=cleanRecord(cur), t=rec.t[id]; was=t ? {all:progress(t).all, me:!!(t.to[key] && t.to[key].d)} : null; return markDone(rec, id, key, note, new Date()); });
    const t=r && r.value && cleanRecord(r.value).t[id];
    if(t && was && !was.me && !(r.error || r.blocked) && t.by && t.by!==key){
      tell([t.by], bellDone(t, who), '✅');
      if(!was.all && progress(t).all) buzz([t.by], alertAllDone(t), 'hb-task-'+id+'-done');
    }
    return r;
  }

  /* Runs on Home and the Tasks page (live, whoever is signed in): at most every 20 minutes per device. */
  let TICKING=false;
  async function remindTick(){
    const H=global.PH, S=global.PH_STORE;
    if(TICKING || !H || !S || !(H.isLive && H.isLive()) || !(H.tasksOn && H.tasksOn())) return;
    let last=0; try{ last=+localStorage.getItem('ph_tasks_remind_at')||0; }catch(_){}
    if(Date.now()-last<20*60e3) return; try{ localStorage.setItem('ph_tasks_remind_at', String(Date.now())); }catch(_){}
    TICKING=true;
    try{
      const c=H.centralNow ? H.centralNow() : {date:dayOf(new Date()), hm:'12:00'};
      const plan=remindPlan(cleanRecord(await S.get(KEY)), c.date, c.hm, new Date());
      for(const p of plan){
        const stamp=new Date().toISOString()+'~'+Math.random().toString(36).slice(2,8);
        const r=await S.update(KEY, cur=>{ const x=cleanRecord(cur), t=x.t[p.id]; if(!t || t.rem[p.kind]) return undefined; t.rem[p.kind]=stamp; return x; });
        const t=r && r.value && cleanRecord(r.value).t[p.id];
        if(!t || r.blocked || r.error || t.rem[p.kind]!==stamp || p.silent) continue;
        buzz(openIds(t), p.kind==='due' ? alertDue(t) : alertLate(t, c.date), 'hb-task-'+t.id);
      }
    }catch(_){}
    TICKING=false;
  }

  const RULES={KEY, OLD, KEEP_DAYS, MAX_TITLE, MAX_NOTES, MAX_NOTE, lc, dayOf, addDays, isDay, personId, myKeys, expand, howWords,
    cleanTask, cleanRecord, list, problems, create, add, people, progress, finished, finishedAt, openIds, slotFor, isGiver,
    dueState, dueText, shortDay, quickDues, mine, given, summary, markDone, setNote, undo, edit, addPeople, removePerson,
    close, reopen, nudged, nudgeWait, oldOnes, toArchive, dropArchived, alertNew, alertNudge, alertAllDone, bellDone, demo, tell, buzz, finish,
    fold, dateOf, takeDue, whoOne, understand, ideas, recent, waitingOn, needsNudge, giverLine, remindPlan, alertDue, alertLate, remindTick};
  if(typeof module!=='undefined' && module.exports) module.exports=RULES;
  global.PH_TASKS=RULES;
})(typeof window!=='undefined' ? window : globalThis);
