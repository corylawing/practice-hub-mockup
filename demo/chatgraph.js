/* REAL CHAT - Microsoft Teams chats inside Home-Brace (12/11/2026, Jordan: "Yes start. But very important that nobody
   sees it until I've confirmed it works ... what we did in sandbox is very important, but also the ability to send
   videos"). Morgan's #2. Teams is the engine underneath: the messages live in their own Microsoft 365, Home-Brace
   reads and sends them as the signed-in person (DELEGATED Chat.ReadWrite - never an Application permission).

   WHO SEES IT - three locks, all must open:
     1. The live site: CHAT_LIVE=false -> mode() is 'off' there for everyone. (user.js NAV also keeps the chat button
        and page off on live.) Flip CHAT_LIVE only after Jordan has tried it and says it works.
     2. The sandbox: the mock-up for everybody, as before. The REAL chat only for an Admin (the real one, not someone
        they're viewing as) who switched it on for this device (localStorage ph_chat_real).
     3. While CHAT_LIVE is false it's a TEST: you can READ your own Teams chats, but SEND only into chats where every
        other person is on your testers list (ph_chat_testers, this device). No stray message to anyone else.
   The Chat.ReadWrite permission is asked for only here, only in real mode - never at sign-in (gate.js SCOPES), so
   nobody's sign-in changes. IT added it 12/11 but had not granted admin consent yet: until they do, Microsoft
   refuses and the page says so.

   VIDEOS (Teams' own way): the file goes to the sender's OneDrive, folder "Microsoft Teams Chat Files" (what Teams
   itself uses), is shared with the people in the chat (read only, sign-in required, no email), and the message
   carries it as a "reference" attachment - so it shows and plays in Teams too. Photos go inside the message
   (hostedContents), resized first. Reading: a video's play address comes from /shares (a short-lived download URL);
   pictures inside a message are fetched with the sign-in and shown from this browser's memory.
   Nothing from Teams is ever put into the page as HTML: message bodies become plain text (parts()). */
(function(global){
  'use strict';
  const CHAT_LIVE=false;                                         // the live site: OFF until Jordan confirms it works
  const TENANT='00000000-0000-0000-0000-000000000002';            // public by design (gate.js)
  const G='https://graph.microsoft.com/v1.0';
  const EXTRA=['Chat.ReadWrite'];
  const MODE_KEY='ph_chat_real', TESTERS_KEY='ph_chat_testers';
  const FOLDER='Microsoft Teams Chat Files';
  const SMALL=4*1024*1024;                                       // up to this, one upload; above, an upload session
  const CHUNK=320*1024*32;                                       // 10 MiB - must be a multiple of 320 KiB
  const MAX_VIDEO=250*1024*1024;
  const TEST=!CHAT_LIVE;
  /* THE LIVE PILOT (17/11/2026). Jordan: "start with chat but its important only people in this tenant can use it, and only
     me morgan, jamie can use it first until we verify its good". On the live site, while CHAT_LIVE is false: the real
     chat ONLY for someone on Admin -> Chat's list (the shared list 'ph_chat_pilot' - names and emails, never in this
     public code) and NEVER for a guest (a sign-in name with #EXT#: someone from another company's Microsoft account) -
     here and on the sandbox. While it's a pilot, the testers ARE that list: they can only send to each other. */
  const CHAT_PILOT=true;
  /* GUESTS (Jordan 17/11: "If there is no problem using chat with the guest users and they can chat then we go live with
     the rest"): OFF until one guest (e.g. a Meadow Park or Hillcrest person) has tried it in the pilot and it works. */
  const CHAT_GUESTS=false;
  const PILOT_KEY='ph_chat_pilot';
  let PILOT=null;                                                // null = not read yet; a read that failed = [] (closed)

  const lc=s=>String(s||'').trim().toLowerCase();
  const P=()=>global.PH||{};
  const isLive=()=>!!(P().isLive && P().isLive());
  const ls=k=>{ try{ return global.localStorage.getItem(k); }catch(_){ return null; } };
  const lsSet=(k,v)=>{ try{ v==null ? global.localStorage.removeItem(k) : global.localStorage.setItem(k,v); }catch(_){} };

  /* ---------------- who gets the real chat ---------------- */
  function switchedOn(){ return ls(MODE_KEY)==='1'; }
  function adminHere(){ try{ return !!(P().isAdmin && P().isAdmin()); }catch(_){ return false; } }
  /* Microsoft has told us who this is (Graph /me, with their id). Until then the sandbox runs on a stand-in person
     who IS an Admin - so nothing is decided before this (found 12/11 in the browser check: a TC got the real chat
     for a moment while sign-in was still finishing). */
  function signedIn(){ try{ const p=P().profileOf && P().profileOf(); return !!(p && p.id); }catch(_){ return false; } }
  const meP=()=>{ try{ return (P().profileOf && P().profileOf()) || null; }catch(_){ return null; } };
  function guest(){ const p=meP(); return !CHAT_GUESTS && /#ext#/i.test(String((p && p.userPrincipalName)||'')); }   // a guest - and guests aren't allowed yet
  function myEmails(){ const p=meP()||{}; return [lc(p.mail), lc(p.userPrincipalName)].filter(Boolean); }
  function cleanPilot(x){
    const seen={}, out=[];
    ((x && Array.isArray(x.list)) ? x.list : []).forEach(t=>{ const e=lc(t && t.email);
      if(e && /@/.test(e) && (CHAT_GUESTS || !/#ext#/.test(e)) && !seen[e]){ seen[e]=1; out.push({email:e, name:String((t && t.name)||e).slice(0,80)}); } });
    return out;
  }
  const pilotLive=()=>isLive() && !CHAT_LIVE && CHAT_PILOT;
  function pilotKnown(){ return !pilotLive() || PILOT!==null; }
  function loadPilot(){
    const S=global.PH_STORE;
    if(!S || !S.get){ PILOT=[]; return Promise.resolve(PILOT); }
    return S.get(PILOT_KEY).then(x=>{ PILOT=(S.readFailed && S.readFailed(PILOT_KEY)) ? [] : cleanPilot(x); return PILOT; }, ()=>{ PILOT=[]; return PILOT; });
  }
  function onPilot(){ const mine=myEmails(); return !!PILOT && PILOT.some(t=>mine.indexOf(t.email)>=0); }
  /* 'real' | 'demo' (the sandbox mock-up) | 'off' (the live site, while CHAT_LIVE is false). The page asks again
     once signed in, and again when who-they-are is filled in (ph-identity). */
  function mode(){
    if(guest()) return isLive() ? 'off' : 'demo';                // only the practice's own people, live or sandbox
    if(isLive()){ if(!signedIn()) return 'off'; if(CHAT_LIVE) return 'real'; return CHAT_PILOT && onPilot() ? 'real' : 'off'; }
    return switchedOn() && signedIn() && adminHere() ? 'real' : 'demo';
  }
  function setSwitch(on){ lsSet(MODE_KEY, on ? '1' : null); }

  /* The testers on this device: [{email, name}] */
  function testers(){ if(pilotLive()) return (PILOT||[]).slice(); try{ const a=JSON.parse(ls(TESTERS_KEY)||'[]'); return Array.isArray(a) ? a.filter(x=>x && x.email) : []; }catch(_){ return []; } }
  function setTesters(list){
    if(pilotLive()) return testers();                            // the pilot list is changed in Admin -> Chat, not here
    const seen={}, out=[];
    (list||[]).forEach(x=>{ const e=lc(x && x.email); if(e && !seen[e]){ seen[e]=1; out.push({email:e, name:String(x.name||e)}); } });
    lsSet(TESTERS_KEY, JSON.stringify(out)); return out;
  }
  /* May I send into this chat? Outside the test, always. In the test only when EVERY other person in it is a tester -
     someone with no email on record counts as not a tester (fail closed). */
  function canSend(chat, meId, list){
    if(!TEST) return true;
    const ok={}; (list||testers()).forEach(x=>{ ok[lc(x.email)]=1; });
    const others=((chat && chat.people)||[]).filter(p=>p.id!==meId);
    return others.length>0 && others.every(p=>!!ok[lc(p.email)]);
  }

  /* ---------------- Microsoft Graph ---------------- */
  function token(){
    const A=global.PH_AUTH;
    if(!A || !A.tokenFor) return Promise.reject(new Error('Not signed in yet.'));
    return A.tokenFor(EXTRA);
  }
  /* Asked from a person's click when Microsoft wants them to confirm (a popup, or the whole page on a phone). */
  function ask(){ const A=global.PH_AUTH; return A && A.askFor ? A.askFor(EXTRA) : Promise.reject(new Error('Not signed in yet.')); }
  const wait=ms=>new Promise(r=>setTimeout(r, ms));
  async function call(method, path, body, opts){
    opts=opts||{};
    const t=await token();
    const url=/^https:/.test(path) ? path : G+path;
    const headers={Authorization:'Bearer '+t};
    let payload;
    if(body!==undefined){ headers['Content-Type']='application/json'; payload=JSON.stringify(body); }
    for(let attempt=0; ; attempt++){
      const r=await global.fetch(url, {method, headers, body:payload});
      if(r.status===429 && attempt<2){              // Microsoft says slow down: wait as long as it asks (max 10 s)
        const s=Math.min(10, Number(r.headers && r.headers.get && r.headers.get('Retry-After'))||2);
        await wait(s*1000); continue;
      }
      if(opts.raw) return r;
      if(r.status===204 || r.status===202) return {};
      const j=await r.json().catch(()=>({}));
      if(!r.ok){
        const e=new Error((j.error && j.error.message) || ('Microsoft said '+r.status));
        e.status=r.status; e.code=j.error && j.error.code; throw e;
      }
      return j;
    }
  }

  /* ---------------- reading a message: Teams HTML -> plain text + pictures ---------------- */
  const ENT={amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' '};
  function decode(s){
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e)=>{
      if(e[0]==='#'){ const n=e[1]==='x'||e[1]==='X' ? parseInt(e.slice(2),16) : parseInt(e.slice(1),10);
        try{ return n>0 && n<0x110000 ? String.fromCodePoint(n) : ''; }catch(_){ return ''; } }
      const k=e.toLowerCase(); return k in ENT ? ENT[k] : m;
    });
  }
  const attr=(tag, name)=>{ const m=new RegExp('\\s'+name+'\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(tag); return m ? decode(m[2]!=null?m[2]:m[3]) : ''; };
  /* {text, images:[graph URLs]} - text only ever goes into the page escaped. A picture is kept only when it is one of
     Microsoft's own (fetched with the sign-in); anything else in the HTML is dropped. */
  function parts(body){
    if(!body) return {text:'', images:[]};
    let s=String(body.content||'');
    if(lc(body.contentType)!=='html') return {text:s.trim(), images:[]};
    const images=[];
    s=s.replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, '')
       .replace(/<emoji\b[^>]*>[\s\S]*?<\/emoji>/gi, m=>attr(m,'alt'))
       .replace(/<img\b[^>]*>/gi, m=>{
         const src=attr(m,'src'), alt=attr(m,'alt');
         if(/^https:\/\/graph\.microsoft\.com\/(v1\.0|beta)\/.*\/hostedContents\/[^/]+\/\$value$/i.test(src)){ images.push(src); return ''; }
         return alt && /emoji/i.test(m) ? alt : '';
       })
       .replace(/<attachment\b[^>]*>[\s\S]*?<\/attachment>/gi, '')
       .replace(/<at\b[^>]*>([\s\S]*?)<\/at>/gi, (m, n)=>'@'+n)
       .replace(/<br\s*\/?>/gi, '\n')
       .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)\s*>/gi, '\n')
       .replace(/<li\b[^>]*>/gi, '• ')
       .replace(/<[^>]*>/g, '');
    s=decode(s).replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return {text:s, images};
  }
  const VIDEO_RE=/\.(mp4|m4v|mov|webm|3gp)$/i, IMAGE_RE=/\.(jpe?g|png|gif|heic|webp)$/i;
  /* A group's own notes (Teams writes them): added, taken out / left, renamed. Names are filled in by the page (Teams
     often leaves them blank) from the chat's people. */
  function mapEvent(m){
    const d=(m && m.eventDetail) || {}, t=String(d['@odata.type']||'');
    const kind=/membersAdded/i.test(t) ? 'added' : /membersDeleted|membersLeft/i.test(t) ? 'removed' : /chatRenamed/i.test(t) ? 'renamed' : '';
    if(!kind) return null;
    const by=(d.initiator && d.initiator.user) || {};
    return {id:m.id, at:Date.parse(m.createdDateTime)||0, system:true, kind, by:{id:String(by.id||''), name:String(by.displayName||'')},
      who:(d.members||[]).map(x=>({id:String((x && x.id)||''), name:String((x && x.displayName)||'')})), topic:String(d.chatDisplayName||'')};
  }
  function mapMessage(m, meId){
    if(m && m.messageType==='systemEventMessage') return mapEvent(m);
    if(!m || m.messageType!=='message') return null;
    const fromU=(m.from && m.from.user) || null;
    const p=parts(m.body), files=[];
    (m.attachments||[]).forEach(a=>{
      if(a && a.contentType==='reference' && a.contentUrl){
        const name=a.name||'File';
        files.push({id:a.id, name, url:a.contentUrl, video:VIDEO_RE.test(name), image:IMAGE_RE.test(name)});
      } else if(a && /card/i.test(a.contentType||'')) p.text=(p.text?p.text+'\n':'')+'(A card - open it in Teams to see it)';
    });
    return {id:m.id, at:Date.parse(m.createdDateTime)||0, fromId:fromU ? fromU.id : '', from:(fromU && fromU.displayName) || 'Someone',
      mine:!!(fromU && fromU.id===meId), deleted:!!m.deletedDateTime, edited:!!m.lastEditedDateTime,
      text:m.deletedDateTime ? 'This message was deleted.' : p.text, images:m.deletedDateTime?[]:p.images, files:m.deletedDateTime?[]:files,
      rich:m.deletedDateTime ? '' : richOf(m.body), reactions:m.deletedDateTime ? [] : reactionsOf(m.reactions)};
  }
  /* A chat as the list needs it. Meeting chats and chats hidden in Teams are left out. */
  function mapChat(c, meId){
    if(!c || (c.chatType!=='oneOnOne' && c.chatType!=='group')) return null;
    if(c.viewpoint && c.viewpoint.isHidden) return null;
    const people=(c.members||[]).map(x=>({id:x.userId||'', name:x.displayName||'', email:lc(x.email), mid:x.id||''}));
    const others=people.filter(x=>x.id!==meId);
    const name=c.topic || others.map(x=>x.name).filter(Boolean).join(', ') || 'Chat';
    const lp=c.lastMessagePreview||null, lpFrom=lp && lp.from && lp.from.user;
    const at=lp ? Date.parse(lp.createdDateTime)||0 : Date.parse(c.lastUpdatedDateTime||c.createdDateTime)||0;
    const read=c.viewpoint && c.viewpoint.lastMessageReadDateTime ? Date.parse(c.viewpoint.lastMessageReadDateTime)||0 : 0;
    const fromMe=!!(lpFrom && lpFrom.id===meId);
    const unread=!!(lp && !lp.isDeleted && !fromMe && at>read);
    let pv='';
    if(lp){ const pp=parts(lp.body); pv=pp.text || (pp.images.length ? '📷 Photo' : /attachment/i.test((lp.body&&lp.body.content)||'') ? '📎 File' : ''); }
    return {id:c.id, type:c.chatType==='oneOnOne'?'person':'group', name, topic:c.topic||'', people, webUrl:c.webUrl||'',
      last:{at, text:pv, mine:fromMe, from:(lpFrom && lpFrom.displayName)||'', id:lp?lp.id:''}, read, unread};
  }

  /* ---------------- chats ---------------- */
  const LIST='/me/chats?$top=50&$orderby=lastMessagePreview/createdDateTime%20desc';
  const membersCache={};
  async function listChats(meId){
    let j, withMembers=true;
    try{ j=await call('GET', LIST+'&$expand=members,lastMessagePreview'); }
    catch(e){
      if(e.status!==400) throw e;                  // both at once refused: the preview, then the people chat by chat
      withMembers=false; j=await call('GET', LIST+'&$expand=lastMessagePreview');
    }
    const raw=j.value||[];
    if(!withMembers){
      for(const c of raw){
        if(c.chatType!=='oneOnOne' && c.chatType!=='group') continue;
        if(!membersCache[c.id]){ try{ membersCache[c.id]=(await call('GET', '/chats/'+encodeURIComponent(c.id)+'/members')).value||[]; }catch(_){ membersCache[c.id]=[]; } }
        c.members=membersCache[c.id];
      }
    }
    return raw.map(c=>mapChat(c, meId)).filter(Boolean);
  }
  /* The newest 50 (or the page after `next`), oldest first. */
  async function listMessages(chatId, meId, next, top){
    const j=await call('GET', next || ('/chats/'+encodeURIComponent(chatId)+'/messages?$top='+(top||50)+'&$orderby=createdDateTime%20desc'));
    return {msgs:(j.value||[]).map(m=>mapMessage(m, meId)).filter(Boolean).reverse(), next:j['@odata.nextLink']||''};
  }
  function markRead(chatId, meId){
    return call('POST', '/chats/'+encodeURIComponent(chatId)+'/markChatReadForUser', {user:{id:meId, tenantId:TENANT}});
  }
  /* New chat: one person -> their 1:1 (Teams hands back the existing one); several -> a group chat named `topic`. */
  function createChat(meId, otherIds, topic){
    const ids=[meId].concat((otherIds||[]).filter(x=>x && x!==meId));
    const uniq=ids.filter((x,i)=>ids.indexOf(x)===i);
    const member=id=>({'@odata.type':'#microsoft.graph.aadUserConversationMember', roles:['owner'], 'user@odata.bind':G+"/users('"+id+"')"});
    const body={chatType:uniq.length===2?'oneOnOne':'group', members:uniq.map(member)};
    if(body.chatType==='group' && topic) body.topic=String(topic).slice(0,250);
    return call('POST', '/chats', body);
  }
  /* GROUPS (Jordan 18/11: "Flexibility to create their own group" - like Slack channels; called Groups because that's what
     they are in Teams: invite-only group chats). Create / rename / add need Chat.ReadWrite (granted); taking someone out
     or leaving needs ChatMember.ReadWrite - only offered once Microsoft's token says it's granted (canManageMembers). While
     testing / in the pilot, only testers can be put in a group (checked here, before anything leaves). */
  const HISTORY_ALL='0001-01-01T00:00:00Z';
  function testersOnly(users){
    if(!TEST) return;
    const ok={}; testers().forEach(x=>{ ok[lc(x.email)]=1; });
    if((users||[]).some(u=>!u || !ok[lc(u.email)])) throw new Error(pilotLive() ? 'Pilot: only people in the pilot group can be added for now.' : 'Test: only your testers can be added.');
  }
  function createGroup(meId, users, name){
    const nm=String(name||'').trim().slice(0,250);
    if(!nm) throw new Error('Give the group a name.');
    const list=(users||[]).filter(u=>u && u.id && u.id!==meId);
    if(list.length<2) throw new Error('Pick at least 2 people for a group.');
    testersOnly(list);
    return createChat(meId, list.map(u=>u.id), nm);
  }
  async function renameGroup(chat, meId, name){
    allowed(chat, meId);
    const nm=String(name||'').trim().slice(0,250); if(!nm) throw new Error('Give the group a name.');
    if(chat.type!=='group') throw new Error('Only a group can have a name.');
    await call('PATCH', '/chats/'+encodeURIComponent(chat.id), {topic:nm});
    return nm;
  }
  async function addPeople(chat, meId, users){
    allowed(chat, meId);
    if(chat.type!=='group') throw new Error('People can only be added to a group.');
    const have={}; (chat.people||[]).forEach(p=>{ have[p.id]=1; });
    const list=(users||[]).filter(u=>u && u.id && !have[u.id]); if(!list.length) throw new Error('They’re already in the group.');
    testersOnly(list);
    for(const u of list) await call('POST', '/chats/'+encodeURIComponent(chat.id)+'/members', {'@odata.type':'#microsoft.graph.aadUserConversationMember',
      'user@odata.bind':G+"/users('"+u.id+"')", roles:['owner'], visibleHistoryStartDateTime:HISTORY_ALL});   // they see the whole conversation, like Slack
    return list.length;
  }
  /* Does Microsoft let Home-Brace take people out of groups? (ChatMember.ReadWrite in the token's granted list.) */
  let manageOK=null;
  async function canManageMembers(){
    if(manageOK!==null) return manageOK;
    try{ const t=await token(), p=JSON.parse(decodeURIComponent(escape(global.atob(String(t).split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))));
      manageOK=String(p.scp||'').split(' ').indexOf('ChatMember.ReadWrite')>=0; }
    catch(_){ manageOK=false; }
    return manageOK;
  }
  async function removePerson(chat, meId, personId){
    allowed(chat, meId);
    if(chat.type!=='group') throw new Error('Only people in a group can be taken out.');
    if(personId===meId) throw new Error('Use Leave group to take yourself out.');
    const p=(chat.people||[]).find(x=>x.id===personId); if(!p || !p.mid) throw new Error('They’re not in this group any more.');
    await call('DELETE', '/chats/'+encodeURIComponent(chat.id)+'/members/'+encodeURIComponent(p.mid));
  }
  async function leaveGroup(chat, meId){
    if(!chat || chat.type!=='group') throw new Error('You can only leave a group.');
    const p=(chat.people||[]).find(x=>x.id===meId); if(!p || !p.mid) throw new Error('You’re not in this group any more.');
    await call('DELETE', '/chats/'+encodeURIComponent(chat.id)+'/members/'+encodeURIComponent(p.mid));
  }
  /* HIDE A CHAT / DELETE MY MESSAGE (Jordan 18/11: "yes build hide chat and delete message"). Teams doesn't let staff
     delete a whole chat (only IT can, and the history is kept); Hide takes it off your own list until someone writes
     again - like Teams' own Hide. A message: only your own, it stays in the chat as "This message was deleted." Both need
     only Chat.ReadWrite (granted). Each can be undone. */
  function hideChat(chat, meId, back){
    if(!chat || !chat.id || !meId) throw new Error('No chat picked.');
    return call('POST', '/chats/'+encodeURIComponent(chat.id)+'/'+(back ? 'unhideForUser' : 'hideForUser'), {user:{id:meId, tenantId:TENANT}});
  }
  async function deleteMessage(chat, meId, msg, back){
    allowed(chat, meId);
    if(!msg || !msg.id || /^local-/.test(String(msg.id))) throw new Error('That message isn’t sent yet.');
    if(!msg.mine) throw new Error('You can only delete your own messages.');
    return call('POST', '/users/'+encodeURIComponent(meId)+'/chats/'+encodeURIComponent(chat.id)+'/messages/'+encodeURIComponent(msg.id)+'/'+(back ? 'undoSoftDelete' : 'softDelete'));
  }
  /* People in the practice's own Microsoft 365 (Evan, 12/11: current tenant only - guests are left out). */
  async function searchPeople(q){
    const s=String(q||'').trim().replace(/'/g, "''"); if(s.length<2) return [];
    const f="startswith(displayName,'"+s+"') or startswith(givenName,'"+s+"') or startswith(surname,'"+s+"') or startswith(mail,'"+s+"')";
    const j=await call('GET', '/users?$top=15&$select=id,displayName,mail,userPrincipalName,jobTitle&$filter='+encodeURIComponent(f));
    return (j.value||[]).filter(u=>u && !/#EXT#/i.test(u.userPrincipalName||'')).map(u=>({id:u.id, name:u.displayName||'', email:lc(u.mail||u.userPrincipalName), title:u.jobTitle||''}));
  }
  async function userById(id){
    const u=await call('GET', '/users/'+encodeURIComponent(String(id||''))+'?$select=id,displayName');
    return {id:u.id, name:u.displayName||''};
  }
  async function userByEmail(email){
    const u=await call('GET', '/users/'+encodeURIComponent(lc(email))+'?$select=id,displayName,mail,userPrincipalName');
    return {id:u.id, name:u.displayName||'', email:lc(u.mail||u.userPrincipalName)};
  }

  /* ---------------- sending ---------------- */
  const escH=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const textHTML=t=>escH(String(t||'').trim()).replace(/\r?\n/g,'<br>');

  /* ---------------- CHAT v2 (18/11/2026): formatting both ways, @mentions, reactions ----------------
     Jordan: "like slack ... basic bold and links and everything they have is well layed out (just don't need coding stuff)".
     RICH TEXT, SAFELY: HTML (Teams', or the message box's) -> a small allowed set REBUILT FROM SCRATCH: only these tags,
     no attribute but a checked link address (https/http/mailto), every bit of text escaped again, scripts/styles dropped
     with what's in them, every tag closed. Pure string work - the page's HTML parser never sees Teams' own. */
  const RICH_TAGS={b:'b', strong:'b', i:'i', em:'i', u:'u', s:'s', strike:'s', del:'s', ol:'ol', ul:'ul', li:'li', blockquote:'blockquote', p:'p', div:'p', br:'br', a:'a', at:'at', span:'span'};
  function safeHref(h){ h=String(h||'').trim(); return /^(https?:\/\/|mailto:)[^\s"'<>]+$/i.test(h) ? h : ''; }
  function cleanRich(html, out_){
    const toTeams=out_==='teams';
    let s=String(html==null?'':html)
      .replace(/<(script|style|head|title|template|textarea|iframe|object)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<emoji\b[^>]*>[\s\S]*?<\/emoji>/gi, m=>escH(attr(m,'alt')))
      .replace(/<img\b[^>]*>/gi, m=>(/emoji/i.test(m) ? escH(attr(m,'alt')) : ''))          // pictures are shown on their own
      .replace(/<attachment\b[^>]*>[\s\S]*?<\/attachment>/gi, '');
    let out='', stack=[];
    const re=/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</g; let m;
    while((m=re.exec(s))){
      if(m[4]!==undefined){ out+=escH(decode(m[4])); continue; }
      if(m[2]===undefined){ out+='&lt;'; continue; }
      const closing=m[1]==='/', t=RICH_TAGS[m[2].toLowerCase()];
      if(!t) continue;                                                       // any other tag: dropped, its words kept
      if(t==='br'){ out+='<br>'; continue; }
      if(closing){ const i=stack.lastIndexOf(t); if(i<0) continue; while(stack.length>i){ const x=stack.pop(); out+=x===''?'':(x==='at' ? (toTeams?'</at>':'</span>') : '</'+x+'>'); } continue; }
      if(t==='a'){ const h=safeHref(attr(' '+m[3],'href')); if(!h){ stack.push(''); continue; }
        out+='<a href="'+escH(h)+'"'+(toTeams ? '' : ' target="_blank" rel="noopener noreferrer"')+'>'; stack.push('a'); continue; }
      if(t==='at'){ const id=String(attr(' '+m[3],'id')); if(toTeams && /^\d{1,3}$/.test(id)){ out+='<at id="'+id+'">'; } else out+=toTeams ? '' : '<span class="at">@'; stack.push(toTeams && /^\d{1,3}$/.test(id) ? 'at' : (toTeams ? '' : 'at')); continue; }
      if(t==='span'){ const keep=!toTeams && String(attr(' '+m[3],'class'))==='at'; out+=keep ? '<span class="at">' : ''; stack.push(keep ? 'span' : ''); continue; }   // only our own @mention highlight
      out+='<'+t+'>'; stack.push(t);
    }
    while(stack.length){ const x=stack.pop(); out+=x===''?'':(x==='at' ? (toTeams?'</at>':'</span>') : '</'+x+'>'); }
    return out.replace(/(<p>\s*<\/p>)+$/,'').trim();
  }
  /* What a Teams message shows (its words, formatted) - '' when it has no formatting worth keeping (then the plain words). */
  function richOf(body){
    if(!body || lc(body.contentType)!=='html') return '';
    const r=cleanRich(body.content);
    return /<(b|i|u|s|a|ol|ul|blockquote|span)\b/.test(r) ? r : '';
  }
  /* Reactions: Teams' names for its classic six, or the emoji itself. [{emoji, userId, name}] */
  const REACT_NAMES={like:'👍', heart:'❤️', laugh:'😆', surprised:'😮', sad:'😢', angry:'😡'};
  function reactionsOf(list){
    return (Array.isArray(list) ? list : []).map(r=>{ const t=String((r && r.reactionType)||''), u=(r && r.user && r.user.user) || {};
      return {emoji:REACT_NAMES[t.toLowerCase()] || t, raw:t, userId:String(u.id||''), name:String((r && r.displayName)||u.displayName||'')}; }).filter(r=>r.emoji && r.emoji.length<=16);
  }
  /* A classic six's old name (👍 -> like). Only a fallback now: Microsoft refuses the names on setReaction ("Unicode 'like' in the
     payload is not supported", Jordan 20/11/2026) and wants the emoji itself. */
  const REACT_TYPE={}; Object.keys(REACT_NAMES).forEach(k=>{ REACT_TYPE[REACT_NAMES[k]]=k; });
  /* The message box's HTML -> Teams: mentions become <at id="n">, everything else the allowed set. mentions = [{id, name}]. */
  function teamsBody(html, mentions){
    const keep={}, list=[];
    (mentions||[]).forEach((x,i)=>{ if(x && x.id && list.length<20){ keep[i]=list.length; list.push(x); } });
    /* every <at id> matches one mention in the list (renumbered), or it's left as plain words - Teams refuses a mismatch */
    const content=cleanRich(html, 'teams').replace(/<at id="(\d{1,3})">([\s\S]*?)<\/at>/g, (all, i, inner)=>keep[i]!=null ? '<at id="'+keep[i]+'">'+inner+'</at>' : inner);
    return {content, mentions:list.map((x,i)=>({id:i, mentionText:String(x.name||'').slice(0,80),
      mentioned:{user:{id:x.id, displayName:String(x.name||'').slice(0,80), userIdentityType:'aadUser'}}}))};
  }
  /* Add or take back MY reaction on a message (only where I may send - the pilot lock). */
  async function react(chat, meId, msgId, emoji, on, raw){
    allowed(chat, meId);
    if(!msgId || !emoji) throw new Error('Nothing to react to.');
    /* Adding: the emoji itself, then the old name if Microsoft refuses it. Taking one back: the exact type it was saved
       under (an old reaction may be saved as "like"), then the other form. Only a 400 tries the next one. */
    const r=String(raw||''), old=REACT_NAMES[r.toLowerCase()];
    const tries=on ? [emoji, REACT_TYPE[emoji]] : [r || emoji, old || REACT_TYPE[r || emoji] || emoji];
    const path='/chats/'+encodeURIComponent(chat.id)+'/messages/'+encodeURIComponent(msgId)+'/'+(on ? 'setReaction' : 'unsetReaction');
    let last=null;
    for(const type of tries.filter((x,i,a)=>x && a.indexOf(x)===i)){
      try{ return await call('POST', path, {reactionType:String(type)}); }
      catch(e){ last=e; if(e.status!==400) throw e; }
    }
    throw last;
  }
  /* Every send checks the test lock itself, before anything leaves - not only the page's buttons. */
  function allowed(chat, meId){
    if(!chat || !chat.id) throw new Error('No chat picked.');
    if(!canSend(chat, meId)) throw new Error('Test: you can only send to your testers.');
  }
  async function sendText(chat, meId, text, rich){
    allowed(chat, meId);
    if(rich && rich.html){ const tb=teamsBody(rich.html, rich.mentions);
      return call('POST', '/chats/'+encodeURIComponent(chat.id)+'/messages', Object.assign({body:{contentType:'html', content:tb.content}}, tb.mentions.length ? {mentions:tb.mentions} : {})); }
    return call('POST', '/chats/'+encodeURIComponent(chat.id)+'/messages', {body:{contentType:'html', content:textHTML(text)}});
  }
  /* A photo inside the message. b64 = the JPEG's bytes as base64 (already resized - photo() below). */
  async function sendPhoto(chat, meId, b64, w, h, text, rich){
    allowed(chat, meId);
    const img='<img src="../hostedContents/1/$value" width="'+(w|0)+'" height="'+(h|0)+'" style="vertical-align:bottom; width:'+(w|0)+'px; height:'+(h|0)+'px">';
    const tb=rich && rich.html ? teamsBody(rich.html, rich.mentions) : null;
    return call('POST', '/chats/'+encodeURIComponent(chat.id)+'/messages', Object.assign({
      body:{contentType:'html', content:(tb ? tb.content : (text?'<p>'+textHTML(text)+'</p>':''))+'<div><span>'+img+'</span></div>'},
      hostedContents:[{'@microsoft.graph.temporaryId':'1', contentBytes:b64, contentType:'image/jpeg'}]}, tb && tb.mentions.length ? {mentions:tb.mentions} : {}));
  }
  /* The GUID in a OneDrive file's eTag ("{GUID},n") - Teams uses it as the attachment's id. */
  function etagGuid(etag){ const m=/\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?/i.exec(String(etag||'')); return m ? m[1].toLowerCase() : ''; }
  function safeName(n){ return String(n||'video.mp4').replace(/[\\/:*?"<>|#%]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120) || 'video.mp4'; }
  const itemPath=name=>'/me/drive/root:/'+encodeURIComponent(FOLDER)+'/'+encodeURIComponent(safeName(name));
  /* Into the sender's OneDrive. onProgress(0..1). */
  async function upload(blob, name, onProgress){
    const size=blob.size||0;
    if(size>MAX_VIDEO) throw new Error('That video is too big (over '+Math.round(MAX_VIDEO/1048576)+' MB). Try a shorter one.');
    const prog=f=>{ try{ onProgress && onProgress(f); }catch(_){} };
    if(size<=SMALL){
      const t=await token();
      const r=await global.fetch(G+itemPath(name)+':/content?@microsoft.graph.conflictBehavior=rename',
        {method:'PUT', headers:{Authorization:'Bearer '+t, 'Content-Type':blob.type||'application/octet-stream'}, body:blob});
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error((j.error && j.error.message) || ('Upload refused ('+r.status+')'));
      prog(1); return j;
    }
    const s=await call('POST', itemPath(name)+':/createUploadSession', {item:{'@microsoft.graph.conflictBehavior':'rename'}});
    if(!s.uploadUrl) throw new Error('Microsoft did not open an upload.');
    let at=0, last=null;
    while(at<size){
      const end=Math.min(size, at+CHUNK);
      // The upload address carries its own permission: NO sign-in header (Microsoft refuses one there).
      const r=await global.fetch(s.uploadUrl, {method:'PUT', headers:{'Content-Range':'bytes '+at+'-'+(end-1)+'/'+size}, body:blob.slice(at, end)});
      if(!(r.status===200 || r.status===201 || r.status===202)){
        try{ await global.fetch(s.uploadUrl, {method:'DELETE'}); }catch(_){}
        throw new Error('The upload stopped ('+r.status+'). Try again.');
      }
      last=r; at=end; prog(at/size);
    }
    return await last.json();
  }
  /* Read-only, to the people in the chat, sign-in required, no email sent. */
  function share(itemId, people){
    const recipients=(people||[]).filter(p=>p && (p.email || p.id)).map(p=>p.email ? {email:p.email} : {objectId:p.id});
    if(!recipients.length) return Promise.resolve({});
    return call('POST', '/me/drive/items/'+encodeURIComponent(itemId)+'/invite', {requireSignIn:true, sendInvitation:false, roles:['read'], recipients});
  }
  async function sendFile(chatId, item, text, rich){
    const id=etagGuid(item.eTag);
    if(!id || !item.webUrl) throw new Error('The video uploaded, but Microsoft did not say where it is.');
    const tb=rich && rich.html ? teamsBody(rich.html, rich.mentions) : null;
    return call('POST', '/chats/'+encodeURIComponent(chatId)+'/messages', Object.assign({
      body:{contentType:'html', content:(tb ? tb.content+' ' : (text?textHTML(text)+' ':''))+'<attachment id="'+id+'"></attachment>'},
      attachments:[{id, contentType:'reference', contentUrl:item.webUrl, name:item.name}]}, tb && tb.mentions.length ? {mentions:tb.mentions} : {}));
  }
  /* The whole video send. chat = a mapChat() chat. Resolves {message, item, shared:true|false}. */
  async function sendVideo(chat, meId, blob, name, onProgress, text, rich){
    allowed(chat, meId);
    const item=await upload(blob, name, onProgress);
    let shared=true;
    try{ await share(item.id, (chat.people||[]).filter(p=>p.id!==meId)); }catch(_){ shared=false; }
    const message=await sendFile(chat.id, item, text, rich);
    return {message, item, shared};
  }

  /* ---------------- showing what others sent ---------------- */
  function shareId(url){
    const b=global.btoa(unescape(encodeURIComponent(String(url||''))));
    return 'u!'+b.replace(/=+$/,'').replace(/\//g,'_').replace(/\+/g,'-');
  }
  const fileCache={};
  /* {url (plays or downloads, short-lived), name, size, type, thumb} - kept 40 minutes. */
  async function fileFor(contentUrl){
    const c=fileCache[contentUrl]; if(c && Date.now()-c.t<40*60000) return c.v;
    const j=await call('GET', '/shares/'+shareId(contentUrl)+'/driveItem?$expand=thumbnails');
    const th=(j.thumbnails && j.thumbnails[0]) || {};
    const v={url:j['@microsoft.graph.downloadUrl']||'', name:j.name||'', size:j.size||0, type:(j.file && j.file.mimeType)||'',
      thumb:(th.large && th.large.url) || (th.medium && th.medium.url) || ''};
    fileCache[contentUrl]={t:Date.now(), v}; return v;
  }
  const blobCache={};
  /* A picture inside a message: fetched with the sign-in, shown from this browser's memory. */
  async function picture(graphUrl){
    if(blobCache[graphUrl]) return blobCache[graphUrl];
    const r=await call('GET', graphUrl, undefined, {raw:true});
    if(!r.ok) throw new Error('picture '+r.status);
    const b=await r.blob(); return (blobCache[graphUrl]=global.URL.createObjectURL(b));
  }

  /* A photo from the phone or computer: resized to at most 1600 px and saved as a JPEG (which also drops the
     phone's location data). Resolves {b64, w, h}. Browser only. */
  function photo(file, max){
    max=max||1600;
    return new Promise((res, rej)=>{
      const url=global.URL.createObjectURL(file), img=new global.Image();
      img.onload=()=>{
        const k=Math.min(1, max/Math.max(img.naturalWidth, img.naturalHeight));
        const w=Math.max(1, Math.round(img.naturalWidth*k)), h=Math.max(1, Math.round(img.naturalHeight*k));
        const cv=global.document.createElement('canvas'); cv.width=w; cv.height=h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        global.URL.revokeObjectURL(url);
        const d=cv.toDataURL('image/jpeg', .85);
        res({b64:d.slice(d.indexOf(',')+1), w, h, dataUrl:d});
      };
      img.onerror=()=>{ global.URL.revokeObjectURL(url); rej(new Error('That picture could not be opened.')); };
      img.src=url;
    });
  }
  /* Calls and "open in Teams" - Teams itself. */
  function callLink(chat, meId){
    const ems=(chat.people||[]).filter(p=>p.id!==meId && p.email).map(p=>p.email);
    return ems.length ? 'https://teams.microsoft.com/l/call/0/0?users='+ems.map(encodeURIComponent).join(',') : (chat.webUrl||'');
  }

  global.PH_CHATG={CHAT_LIVE, CHAT_PILOT, CHAT_GUESTS, PILOT_KEY, pilotLive, pilotKnown, loadPilot, cleanPilot, guest, TEST, mode, setSwitch, switchedOn, signedIn, testers, setTesters, canSend, ask, token,
    listChats, listMessages, markRead, createChat, searchPeople, userByEmail, createGroup, renameGroup, addPeople, removePerson, leaveGroup, canManageMembers, userById, hideChat, deleteMessage,
    sendText, sendPhoto, sendVideo, upload, share, sendFile, fileFor, picture, photo, callLink, cleanRich, react, REACT_NAMES,
    _t:{parts, decode, mapMessage, mapChat, etagGuid, shareId, safeName, textHTML, call, CHUNK, SMALL, MAX_VIDEO, FOLDER, TENANT, richOf, reactionsOf, teamsBody, safeHref, mapEvent}};
})(window);
