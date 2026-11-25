/* MEETINGS (18/11/2026). Jordan 12/11: "connecting their Meeting Calendar which they did in home-brace to schedule so
   they can see Team Meetings and Doctor Schedule (based on permissions and everything). They should also be able to
   create a meeting from Home-Brace." 18/11: "I think it should be a permission to give to make meetings but I believe
   its office managers. Build it please".

   THE CALENDAR: the Home-Brace Microsoft 365 group's own calendar (Outlook -> Groups -> Home-Brace) - the practice's
   shared meetings calendar. Read with the signed-in person's own sign-in (DELEGATED - never an application permission,
   never a secret): GET /groups/{id}/calendarView (Calendars.ReadWrite - granted 18/11).
   A NEW MEETING is made in the ORGANIZER's own calendar (POST /me/events, Calendars.ReadWrite) with the people invited
   AND the Home-Brace group invited: Microsoft sends the invites (everyone gets a normal Outlook invite), puts it on the
   shared calendar, and makes the Teams link (isOnlineMeeting). Changing or cancelling goes through the organizer's own
   copy (found by its iCalUId), so Microsoft sends the update / cancellation to everyone - only the organizer can.
   The group is found by name (GROUP_NAME) with Group.ReadWrite.All (granted 17/11) and remembered on this device.

   SANDBOX / MOCK-UP: made-up meetings kept in this browser (DEMO_KEY); nothing is sent anywhere. */
(function(global){
  'use strict';
  const MEET_LIVE=false;                         // the live site: false = no meetings there yet (sandbox first)
  const G='https://graph.microsoft.com/v1.0';
  const EXTRA=['Calendars.ReadWrite','Group.ReadWrite.All'];
  const GROUP_NAME='Home-Brace';
  const GROUP_KEY='ph_meet_group', DEMO_KEY='ph_meet_demo';
  const ls={get:k=>{ try{ return global.localStorage.getItem(k); }catch(_){ return null; } }, set:(k,v)=>{ try{ global.localStorage.setItem(k,v); }catch(_){} }};
  const live=()=>!!(global.PH && global.PH.isLive && global.PH.isLive());
  const on=()=>MEET_LIVE || !live() || ls.get('ph_meet_try')==='1';    // one live device can try it first
  const real=()=>live();
  const lc=s=>String(s==null?'':s).trim().toLowerCase();
  const wait=ms=>new Promise(r=>global.setTimeout(r, ms));

  /* ---------- Microsoft ---------- */
  function token(){ const A=global.PH_AUTH; return A && A.tokenFor ? A.tokenFor(EXTRA) : Promise.reject(new Error('Not signed in yet.')); }
  function ask(){ const A=global.PH_AUTH; return A && A.askFor ? A.askFor(EXTRA) : Promise.reject(new Error('Not signed in yet.')); }
  async function call(method, path, body){
    const t=await token(), url=/^https:/.test(path) ? path : G+path, headers={Authorization:'Bearer '+t};
    let payload; if(body!==undefined){ headers['Content-Type']='application/json'; payload=JSON.stringify(body); }
    for(let attempt=0; ; attempt++){
      const r=await global.fetch(url, {method, headers, body:payload});
      if(r.status===429 && attempt<2){ await wait(Math.min(10, Number(r.headers && r.headers.get && r.headers.get('Retry-After'))||2)*1000); continue; }
      if(r.status===204 || r.status===202) return {};
      const j=await r.json().catch(()=>({}));
      if(!r.ok){ const e=new Error((j.error && j.error.message) || ('Microsoft said '+r.status)); e.status=r.status; e.code=j.error && j.error.code; throw e; }
      return j;
    }
  }
  /* The Home-Brace group: {id, mail, name} - looked up once, then remembered on this device. */
  let groupP=null;
  function group(){
    if(groupP) return groupP;
    try{ const c=JSON.parse(ls.get(GROUP_KEY)||'null'); if(c && c.id && c.mail) return (groupP=Promise.resolve(c)); }catch(_){}
    groupP=call('GET', "/groups?$filter="+encodeURIComponent("displayName eq '"+GROUP_NAME.replace(/'/g,"''")+"'")+'&$select=id,displayName,mail,groupTypes')
      .then(j=>{ const g=(j.value||[]).find(x=>x && x.mail && (x.groupTypes||[]).indexOf('Unified')>=0) || (j.value||[]).find(x=>x && x.mail);
        if(!g) throw new Error('The Home-Brace group calendar wasn’t found in Microsoft 365.');
        const v={id:g.id, mail:lc(g.mail), name:g.displayName||GROUP_NAME}; ls.set(GROUP_KEY, JSON.stringify(v)); return v; })
      .catch(e=>{ groupP=null; throw e; });
    return groupP;
  }

  /* ---------- one meeting, as the page uses it ---------- */
  const isoDay=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  /* Microsoft gives times in UTC (no Prefer header); an all-day one keeps its own day. */
  function whenOf(t, allDay){
    const s=String((t && t.dateTime)||''); if(!s) return null;
    if(allDay){ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? new Date(+m[1], +m[2]-1, +m[3]).getTime() : null; }
    const ms=Date.parse(/Z$|[+-]\d\d:\d\d$/.test(s) ? s : s+'Z');
    return isNaN(ms) ? null : ms;
  }
  function mapEvent(e, meMail){
    if(!e || e.isCancelled) return null;
    const allDay=!!e.isAllDay, start=whenOf(e.start, allDay), end=whenOf(e.end, allDay);
    if(start===null || end===null) return null;
    const org=(e.organizer && e.organizer.emailAddress) || {};
    const join=(e.onlineMeeting && e.onlineMeeting.joinUrl) || e.onlineMeetingUrl || '';
    return {id:String(e.id||''), ical:String(e.iCalUId||''), subject:String(e.subject||'(No title)').slice(0,200), start, end, allDay,
      where:String((e.location && e.location.displayName)||'').slice(0,200), note:String(e.bodyPreview||'').slice(0,1000),
      by:{name:String(org.name||''), email:lc(org.address)}, mine:!!meMail && lc(org.address)===lc(meMail),
      join:/^https:\/\/teams\.microsoft\.com\//i.test(join) ? join : '', web:/^https:\/\//i.test(String(e.webLink||'')) ? String(e.webLink) : '',
      people:(e.attendees||[]).map(a=>({name:String((a.emailAddress && a.emailAddress.name)||''), email:lc(a.emailAddress && a.emailAddress.address),
        said:String((a.status && a.status.response)||'none'), type:String(a.type||'required')})).filter(p=>p.email)};
  }
  /* Meetings from `from` up to (not including) `to` (Dates), oldest first. */
  async function list(from, to, meMail){
    if(!real()) return demoList(from, to);
    const g=await group(); let out=[], next='/groups/'+encodeURIComponent(g.id)+'/calendarView?startDateTime='+encodeURIComponent(from.toISOString())+
      '&endDateTime='+encodeURIComponent(to.toISOString())+'&$top=200&$orderby=start/dateTime&$select=id,iCalUId,subject,start,end,isAllDay,isCancelled,location,organizer,attendees,onlineMeeting,onlineMeetingUrl,webLink,bodyPreview';
    for(let i=0; next && i<5; i++){ const j=await call('GET', next); out=out.concat(j.value||[]); next=j['@odata.nextLink']||''; }
    return out.map(e=>mapEvent(e, meMail)).filter(Boolean).map(m=>Object.assign(m, {people:m.people.filter(p=>p.email!==g.mail)}));   // the group itself isn't a person
  }
  /* What a new meeting (or a change) must have. Returns the cleaned meeting or throws in plain words. */
  function check(m){
    const subject=String((m && m.subject)||'').trim().slice(0,200), where=String((m && m.where)||'').trim().slice(0,200), note=String((m && m.note)||'').trim().slice(0,4000);
    const start=+m.start, end=+m.end;
    if(!subject) throw new Error('Give the meeting a name.');
    if(!isFinite(start) || !isFinite(end)) throw new Error('Pick a day and a time.');
    if(end<=start) throw new Error('The meeting has to end after it starts.');
    if(end-start>12*3600000) throw new Error('A meeting can be up to 12 hours.');
    const seen={}, people=(m.people||[]).filter(p=>p && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lc(p.email)) && !seen[lc(p.email)] && (seen[lc(p.email)]=1)).slice(0,300)
      .map(p=>({name:String(p.name||'').slice(0,120), email:lc(p.email)}));
    return {subject, where, note, start, end, teams:m.teams!==false, people};
  }
  const utc=ms=>new Date(ms).toISOString().replace(/Z$/,'').replace(/\.\d+$/,'');
  async function create(m){
    const v=check(m);
    if(!v.people.length) throw new Error('Invite at least one person.');
    if(!real()) return demoCreate(v);
    const g=await group();
    const body={subject:v.subject, body:{contentType:'text', content:v.note}, start:{dateTime:utc(v.start), timeZone:'UTC'}, end:{dateTime:utc(v.end), timeZone:'UTC'},
      location:{displayName:v.where}, allowNewTimeProposals:true, responseRequested:true,
      attendees:v.people.map(p=>({emailAddress:{address:p.email, name:p.name||p.email}, type:'required'})).concat([{emailAddress:{address:g.mail, name:g.name}, type:'optional'}])};
    if(v.teams){ body.isOnlineMeeting=true; body.onlineMeetingProvider='teamsForBusiness'; }
    return call('POST', '/me/events', body);
  }
  /* The organizer's own copy of a meeting on the shared calendar (same iCalUId). */
  async function mine(ev){
    if(!ev || !ev.ical) throw new Error('That meeting can’t be found.');
    const j=await call('GET', '/me/events?$filter='+encodeURIComponent("iCalUId eq '"+String(ev.ical).replace(/'/g,"''")+"'")+'&$select=id,isOrganizer,subject');
    const e=(j.value||[]).find(x=>x && x.isOrganizer);
    if(!e) throw new Error('Only the person who made this meeting can change or cancel it.');
    return e;
  }
  async function change(ev, m){
    const v=check(Object.assign({}, m, {people:[]}));
    if(!real()) return demoChange(ev, v);
    const e=await mine(ev);
    return call('PATCH', '/me/events/'+encodeURIComponent(e.id), {subject:v.subject, start:{dateTime:utc(v.start), timeZone:'UTC'}, end:{dateTime:utc(v.end), timeZone:'UTC'}, location:{displayName:v.where}});
  }
  async function cancel(ev, comment){
    if(!real()) return demoCancel(ev);
    const e=await mine(ev);
    return call('POST', '/me/events/'+encodeURIComponent(e.id)+'/cancel', {comment:String(comment||'').slice(0,1000)});
  }
  /* A person with no email in Home-Brace's list: their Microsoft account by their exact name (or null). */
  async function byName(name){
    const n=String(name||'').trim(); if(!real() || n.length<3) return null;
    const j=await call('GET', '/users?$top=2&$select=displayName,mail,userPrincipalName&$filter='+encodeURIComponent("displayName eq '"+n.replace(/'/g,"''")+"'"));
    const u=(j.value||[]).filter(x=>x && !/#EXT#/i.test(x.userPrincipalName||''));
    return u.length===1 ? {name:u[0].displayName||n, email:lc(u[0].mail||u[0].userPrincipalName)} : null;
  }

  /* ---------- the mock-up: made-up meetings in this browser only ---------- */
  function demoAll(){
    try{ const a=JSON.parse(ls.get(DEMO_KEY)||'null'); if(Array.isArray(a)) return a; }catch(_){}
    const now=new Date(), at=(dd, h, m)=>{ const d=new Date(now.getFullYear(), now.getMonth(), now.getDate()+dd, h, m); return d.getTime(); };
    const nextWd=dd=>{ let d=new Date(now.getFullYear(), now.getMonth(), now.getDate()+dd); while(d.getDay()===0 || d.getDay()===6) d=new Date(d.getFullYear(), d.getMonth(), d.getDate()+1); return Math.round((d-new Date(now.getFullYear(), now.getMonth(), now.getDate()))/86400000); };
    const P=(n,e,s)=>({name:n, email:e+'@example.test', said:s||'none'});
    const a=[
      {id:'d1', ical:'d1', subject:'Office managers’ meeting', start:at(nextWd(1),8,0), end:at(nextWd(1),8,45), where:'Teams', join:'https://teams.microsoft.com/l/meetup-join/demo', by:{name:'Morgan Hale', email:'morgan.hale@example.test'},
        people:[P('Gabriela Garrison','gabriela.garrison','accepted'), P('Logan Pratt','logan.pratt','accepted'), P('Hayden Moss','hayden.moss')], note:'Monthly goals and the holiday schedule.'},
      {id:'d2', ical:'d2', subject:'Doctors’ huddle', start:at(nextWd(3),12,15), end:at(nextWd(3),12,45), where:'Northpoint office', join:'', by:{name:'Morgan Hale', email:'morgan.hale@example.test'},
        people:[P('Dr. Clara Coleman','clara.coleman','accepted'), P('Dr. Thornbury','dr.thornbury','declined')], note:''},
      {id:'d3', ical:'d3', subject:'Front desk training', start:at(nextWd(8),14,0), end:at(nextWd(8),15,0), where:'Teams', join:'https://teams.microsoft.com/l/meetup-join/demo2', by:{name:'Casey Webb', email:'casey.webb@example.test'},
        people:[P('Quinn Quill','quinn.quill','accepted'), P('Avery Brooks','avery.brooks')], note:'New check-in steps.'}];
    ls.set(DEMO_KEY, JSON.stringify(a)); return a;
  }
  const demoSave=a=>ls.set(DEMO_KEY, JSON.stringify(a));
  function demoMe(){ const P=global.PH && global.PH.me && global.PH.me(); return {name:P ? ((P.preferred||P.first||'')+' '+(P.last||'')).trim() || 'You' : 'You', email:lc(P && P.mail) || 'you@example.test'}; }
  function demoList(from, to){ const me=demoMe(); return Promise.resolve(demoAll().filter(m=>m.start<+to && m.end>+from).map(m=>Object.assign({allDay:false, web:''}, m, {mine:lc(m.by.email)===me.email || !!m.yours})).sort((a,b)=>a.start-b.start)); }
  function demoCreate(v){ const me=demoMe(), a=demoAll(), id='d'+Date.now();
    a.push({id, ical:id, subject:v.subject, start:v.start, end:v.end, where:v.where, note:v.note, join:v.teams ? 'https://teams.microsoft.com/l/meetup-join/demo-'+id : '', by:me, yours:true, people:v.people.map(p=>Object.assign({said:'none'}, p))});
    demoSave(a); return Promise.resolve({id}); }
  function demoChange(ev, v){ const a=demoAll(), m=a.find(x=>x.id===ev.id); if(!m) return Promise.reject(new Error('That meeting can’t be found.'));
    if(!(m.yours || lc(m.by.email)===demoMe().email)) return Promise.reject(new Error('Only the person who made this meeting can change or cancel it.'));
    Object.assign(m, {subject:v.subject, start:v.start, end:v.end, where:v.where}); demoSave(a); return Promise.resolve({}); }
  function demoCancel(ev){ const a=demoAll(), m=a.find(x=>x.id===ev.id); if(!m) return Promise.reject(new Error('That meeting can’t be found.'));
    if(!(m.yours || lc(m.by.email)===demoMe().email)) return Promise.reject(new Error('Only the person who made this meeting can change or cancel it.'));
    demoSave(a.filter(x=>x.id!==ev.id)); return Promise.resolve({}); }

  global.PH_MEET={MEET_LIVE, on, real, list, create, change, cancel, byName, ask, group, EXTRA, GROUP_NAME,
    _t:{mapEvent, whenOf, check, utc, isoDay, call}};
})(typeof window!=='undefined' ? window : globalThis);
