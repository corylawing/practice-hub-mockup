/* MEETINGS (18/11/2026). SANDBOX ONLY until meetings.js MEET_LIVE is true (one live device: localStorage ph_meet_try=1).
       node test/meetings.test.js
   Cory: "connecting their Meeting Calendar ... so they can see Team Meetings and Doctor Schedule", "it should be a
   permission to give to make meetings but I believe its office managers", "It needs to be really easy to switch from
   doctor schedule to meeting schedule ... They cannot live on each other". Runs meetings.js against a pretend
   Microsoft (no network). Made-up people only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const R=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const SRC=R('meetings.js'), SCH=R('schedule.html'), USER=R('user.js'), ADM=R('admin.html');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
const D='example.test';
function load(live, mine){
  const calls=[], LS={};
  const w={ localStorage:{getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}}, console, Promise, JSON, Date, Math, encodeURIComponent, decodeURIComponent, setTimeout:f=>{ f(); return 0; } };
  w.window=w; w.PH={isLive:()=>live, me:()=>({first:'Priya', last:'Tatum', mail:'priya.tatum@'+D})};
  w.PH_AUTH={tokenFor:x=>{ calls.push({scopes:x}); return Promise.resolve('TOK'); }};
  w.fetch=async (url, o)=>{ o=o||{}; const c={url, method:o.method||'GET', body:o.body ? JSON.parse(o.body) : null}; calls.push(c);
    let body={};
    if(/\/groups\?\$filter=/.test(url)) body={value:[{id:'g1', displayName:'Home-Brace', mail:'Home-Brace@'+D, groupTypes:['Unified']}]};
    else if(/\/me\/events\?\$filter=/.test(url)) body={value:mine ? [{id:'my 1', isOrganizer:true}] : []};
    else if(/calendarView/.test(url)) body={value:[
      {id:'e1', iCalUId:'i1', subject:'OM meeting', start:{dateTime:'2026-11-19T15:00:00.0000000', timeZone:'UTC'}, end:{dateTime:'2026-11-19T15:45:00.0000000', timeZone:'UTC'}, isAllDay:false,
        location:{displayName:'Teams'}, organizer:{emailAddress:{name:'Priya Tatum', address:'Priya.Tatum@'+D}}, onlineMeeting:{joinUrl:'https://teams.microsoft.com/l/meetup-join/x'}, webLink:'https://outlook.office365.com/x',
        attendees:[{emailAddress:{name:'Quinn Quill', address:'quinn.quill@'+D}, status:{response:'accepted'}}, {emailAddress:{name:'Home-Brace', address:'home-brace@'+D}, status:{response:'none'}}]},
      {id:'e2', subject:'Gone', isCancelled:true, start:{dateTime:'2026-11-20T15:00:00'}, end:{dateTime:'2026-11-20T16:00:00'}},
      {id:'e3', subject:'<img src=x onerror=alert(1)>', isAllDay:true, start:{dateTime:'2026-11-21T00:00:00.0000000', timeZone:'UTC'}, end:{dateTime:'2026-11-22T00:00:00.0000000', timeZone:'UTC'},
        onlineMeeting:{joinUrl:'javascript:alert(1)'}, webLink:'http://evil.test', organizer:{emailAddress:{address:'other@'+D}}}]};
    else if(/\/users\?/.test(url)) body={value:[{displayName:'Jordan Ellis', mail:'Jordan.Ellis@'+D, userPrincipalName:'jordan.ellis@'+D}]};
    else if(o.method==='POST' && /\/me\/events$/.test(url)) body={id:'new1'};
    return {ok:true, status:(o.method==='PATCH'||/\/cancel$/.test(url)) ? 202 : 200, headers:{get:()=>null}, json:async ()=>body};
  };
  vm.createContext(w); vm.runInContext(SRC, w);
  return {M:w.PH_MEET, calls, LS};
}
const fails=async f=>{ try{ await f(); return ''; }catch(e){ return e.message; } };

(async ()=>{
  let {M, calls, LS}=load(true, true);
  t('OFF on the live site (MEET_LIVE false); on in the sandbox; one live device can try it (ph_meet_try = 1)', /const MEET_LIVE=false;/.test(SRC) && M.on()===false &&
    load(false).M.on()===true && (()=>{ const x=load(true); x.LS.ph_meet_try='1'; return x.M.on(); })());
  const list=await M.list(new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'), 'priya.tatum@'+D);
  t('reads the Home-Brace group’s calendar (found by name, remembered on this device) with the person’s own sign-in - Calendars + Group permissions, nothing else',
    /\/groups\?\$filter=displayName%20eq%20'Home-Brace'/.test(calls.find(c=>c.url && /groups\?/.test(c.url)).url) && /\/groups\/g1\/calendarView\?startDateTime=2026-11-01T00%3A00%3A00\.000Z&endDateTime=2026-12-01/.test(calls.find(c=>c.url && /calendarView/.test(c.url)).url) &&
    JSON.parse(LS.ph_meet_group).id==='g1' && calls.filter(c=>c.scopes).every(c=>c.scopes.join()==='Calendars.ReadWrite,Group.ReadWrite.All'));
  const m1=list.find(m=>m.id==='e1'), m3=list.find(m=>m.id==='e3');
  t('a meeting: UTC times read right, cancelled ones left out, mine known, who’s going, the group itself isn’t listed as a person',
    list.length===2 && m1.start===Date.parse('2026-11-19T15:00:00Z') && m1.end-m1.start===45*60000 && m1.mine===true && m1.people.length===1 && m1.people[0].said==='accepted' && m1.where==='Teams');
  t('…an all-day one keeps its own day; only a real Teams link or an https Outlook link is ever used (anything else is dropped)', m3.allDay && new Date(m3.start).getDate()===21 &&
    m3.join==='' && m3.web==='' && m1.join==='https://teams.microsoft.com/l/meetup-join/x' && m3.mine===false);
  t('the page shows a title only as text (escaped)', /escH\(m\.subject\)/.test(fnOf(SCH,'meetLine')) && /escH\(m\.subject\)/.test(fnOf(SCH,'meetShow')) && /escH\(m\.join\)/.test(fnOf(SCH,'meetShow')));
  calls.length=0;
  const s=Date.parse('2026-11-19T15:00:00Z');
  t('a new meeting needs a name, a time that ends after it starts (12 h at most) and someone invited', /name/.test(await fails(()=>M.create({subject:' ', start:s, end:s+1}))) &&
    /end after/.test(await fails(()=>M.create({subject:'X', start:s, end:s}))) && /12 hours/.test(await fails(()=>M.create({subject:'X', start:s, end:s+13*3600000, people:[{email:'a@'+D}]}))) &&
    /Invite at least one/.test(await fails(()=>M.create({subject:'X', start:s, end:s+60000, people:[{email:'not an email'}]}))) && calls.filter(c=>c.method==='POST').length===0);
  await M.create({subject:'OM meeting', where:'Teams', note:'Goals', start:s, end:s+45*60000, people:[{name:'Quinn Quill', email:'Quinn.Quill@'+D}, {name:'dup', email:'quinn.quill@'+D}]});
  const b=calls.find(c=>c.method==='POST').body;
  t('…made in the organizer’s own calendar: the people invited + the Home-Brace group (so it’s on the shared calendar), a Teams link, times in UTC; Microsoft sends the invites',
    /\/me\/events$/.test(calls.find(c=>c.method==='POST').url) && b.attendees.length===2 && b.attendees[0].emailAddress.address==='quinn.quill@'+D && b.attendees[0].type==='required' &&
    b.attendees[1].emailAddress.address==='home-brace@'+D && b.isOnlineMeeting===true && b.onlineMeetingProvider==='teamsForBusiness' && b.start.timeZone==='UTC' && b.start.dateTime==='2026-11-19T15:00:00' && b.end.dateTime==='2026-11-19T15:45:00');
  calls.length=0;
  await M.change(m1, {subject:'OM meeting', where:'Clovis', start:s+3600000, end:s+2*3600000});
  await M.cancel(m1, 'Moving it');
  t('changing / cancelling goes through the organizer’s own copy (found by iCalUId), so everyone invited gets the update', /\/me\/events\?\$filter=iCalUId%20eq%20'i1'/.test(calls.find(c=>/iCalUId/.test(c.url||'')).url) &&
    calls.some(c=>c.method==='PATCH' && /\/me\/events\/my%201$/.test(c.url) && c.body.location.displayName==='Clovis') && calls.some(c=>c.method==='POST' && /\/me\/events\/my%201\/cancel$/.test(c.url) && c.body.comment==='Moving it'));
  t('…and only the one who made it can (Microsoft has no organizer copy for anyone else)', /Only the person who made this meeting/.test(await fails(()=>load(true, false).M.cancel(m1, ''))));
  const u=await M.byName('Jordan Ellis');
  t('someone with no email in Home-Brace’s list is found in Microsoft by their exact name (guests never)', u && u.email==='jordan.ellis@'+D);

  /* ---- the Schedule page ---- */
  t('Doctor schedule | Meetings: one switch at the top, two separate calendars - meetings never on the doctor board (Cory: "They cannot live on each other")',
    /<div class="modeseg" id="modeseg" role="tablist"/.test(SCH) && /onclick="PS\.mode\('docs'\)"/.test(SCH) && /onclick="PS\.mode\('meet'\)"/.test(SCH) &&
    /MODE==='meet' \? \(view==='week'\?renderMeetWeek\(\):renderMeetMonth\(\)\) : \(view==='week'\?renderWeek\(\):renderMonth\(\)\)/.test(SCH) && !/meetChips/.test(fnOf(SCH,'renderMonth')) && !/mtg/.test(fnOf(SCH,'renderWeek')) &&
    /body\.mode-meet #filters, body\.mode-meet #status, body\.mode-meet \.keyrow, body\.mode-meet #counters/.test(SCH));
  t('…remembered on this device; a link with #meetings opens Meetings; the switch only shows where meetings are on', /localStorage\.setItem\('ph_sched_mode', MODE\)/.test(SCH) && /#meetings/.test(SCH) && /seg\.hidden=!meetOn\(\)/.test(fnOf(SCH,'renderMode')));
  t('Meetings view: a 7-day month (and week) of meetings, ＋ Meeting on a day, an empty month says so; on a phone only the days that have meetings',
    /grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/.test(SCH) && /PS\.newMeet\(\\''\+iso\(d\)\+'\\'\)/.test(fnOf(SCH,'renderMeetMonth')) && /No meetings /.test(fnOf(SCH,'emptyNote')) && /\.mmday\.out,\.mmday\.none\{display:none\}/.test(SCH));
  t('＋ New meeting only for whoever may make meetings; people, a whole office or a team in one searchable list', /nm\.style\.display=MODE==='meet' && meetOn\(\) && canMeet\(\)/.test(fnOf(SCH,'renderMode')) &&
    /if\(!meetOn\(\) \|\| !canMeet\(\)\) return;/.test(fnOf(SCH,'newMeet')) && /<select id="mwho" multiple data-pick/.test(fnOf(SCH,'newMeet')) && /value="o:'/.test(fnOf(SCH,'newMeet')) && /value="t:'/.test(fnOf(SCH,'newMeet')));
  t('…the meeting’s card: when, where, who made it, who’s going, Join the Teams meeting, Open in Outlook; Change / Cancel only for the one who made it (cancelling asks first)',
    /Join the Teams meeting/.test(fnOf(SCH,'meetShow')) && /Open in Outlook/.test(fnOf(SCH,'meetShow')) && /const mineCan=m\.mine && canMeet\(\);/.test(fnOf(SCH,'meetShow')) && /Everyone invited gets a cancellation/.test(fnOf(SCH,'meetCancelAsk')));
  t('THE PERMISSION: Teams & Access has "Meetings: Can make"; Office Managers and Admin to start; a saved grid that predates it uses those starting values',
    /\{k:'meetings',n:'Meetings \(make meetings\)',s:'Meetings',ic:'🗓️'\}/.test(ADM) && /meetings:\['none','edit'\]/.test(ADM) && /set\('Office Managers',\{[^)]*meetings:'edit',/.test(ADM) &&
    /'office managers':[^\n]*meetings:'edit'[,}]/.test(USER) && /'admin':[^\n]*meetings:'edit'[,}]/.test(USER) && !/'staff':[^\n]*meetings/.test(USER) &&
    /if\(c\.meetings===undefined && DEPT_CAN\[d\] && DEPT_CAN\[d\]\.meetings\) c=Object\.assign\(\{\}, c, \{meetings:DEPT_CAN\[d\]\.meetings\}\);/.test(USER));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('CRASH', e && e.stack); process.exit(1); });
