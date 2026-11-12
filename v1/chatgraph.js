/* REAL CHAT - Microsoft Teams chats inside Home-Brace (12/11/2026, Cory: "Yes start. But very important that nobody
   sees it until I've confirmed it works ... what we did in sandbox is very important, but also the ability to send
   videos"). Heather's #2. Teams is the engine underneath: the messages live in their own Microsoft 365, Home-Brace
   reads and sends them as the signed-in person (DELEGATED Chat.ReadWrite - never an Application permission).

   WHO SEES IT - three locks, all must open:
     1. The live site: CHAT_LIVE=false -> mode() is 'off' there for everyone. (user.js NAV also keeps the chat button
        and page off on live.) Flip CHAT_LIVE only after Cory has tried it and says it works.
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
  const CHAT_LIVE=false;                                         // the live site: OFF until Cory confirms it works
  const TENANT='edb81e45-7fa8-4147-982f-2f31c6298086';            // public by design (gate.js)
  const G='https://graph.microsoft.com/v1.0';
  const EXTRA=['Chat.ReadWrite'];
  const MODE_KEY='ph_chat_real', TESTERS_KEY='ph_chat_testers';
  const FOLDER='Microsoft Teams Chat Files';
  const SMALL=4*1024*1024;                                       // up to this, one upload; above, an upload session
  const CHUNK=320*1024*32;                                       // 10 MiB - must be a multiple of 320 KiB
  const MAX_VIDEO=250*1024*1024;
  const TEST=!CHAT_LIVE;

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
  /* 'real' | 'demo' (the sandbox mock-up) | 'off' (the live site, while CHAT_LIVE is false). The page asks again
     once signed in, and again when who-they-are is filled in (ph-identity). */
  function mode(){
    if(isLive()) return CHAT_LIVE && signedIn() ? 'real' : 'off';
    return switchedOn() && signedIn() && adminHere() ? 'real' : 'demo';
  }
  function setSwitch(on){ lsSet(MODE_KEY, on ? '1' : null); }

  /* The testers on this device: [{email, name}] */
  function testers(){ try{ const a=JSON.parse(ls(TESTERS_KEY)||'[]'); return Array.isArray(a) ? a.filter(x=>x && x.email) : []; }catch(_){ return []; } }
  function setTesters(list){
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
  function mapMessage(m, meId){
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
      text:m.deletedDateTime ? 'This message was deleted.' : p.text, images:m.deletedDateTime?[]:p.images, files:m.deletedDateTime?[]:files};
  }
  /* A chat as the list needs it. Meeting chats and chats hidden in Teams are left out. */
  function mapChat(c, meId){
    if(!c || (c.chatType!=='oneOnOne' && c.chatType!=='group')) return null;
    if(c.viewpoint && c.viewpoint.isHidden) return null;
    const people=(c.members||[]).map(x=>({id:x.userId||'', name:x.displayName||'', email:lc(x.email)}));
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
  /* People in the practice's own Microsoft 365 (Adam, 12/11: current tenant only - guests are left out). */
  async function searchPeople(q){
    const s=String(q||'').trim().replace(/'/g, "''"); if(s.length<2) return [];
    const f="startswith(displayName,'"+s+"') or startswith(givenName,'"+s+"') or startswith(surname,'"+s+"') or startswith(mail,'"+s+"')";
    const j=await call('GET', '/users?$top=15&$select=id,displayName,mail,userPrincipalName,jobTitle&$filter='+encodeURIComponent(f));
    return (j.value||[]).filter(u=>u && !/#EXT#/i.test(u.userPrincipalName||'')).map(u=>({id:u.id, name:u.displayName||'', email:lc(u.mail||u.userPrincipalName), title:u.jobTitle||''}));
  }
  async function userByEmail(email){
    const u=await call('GET', '/users/'+encodeURIComponent(lc(email))+'?$select=id,displayName,mail,userPrincipalName');
    return {id:u.id, name:u.displayName||'', email:lc(u.mail||u.userPrincipalName)};
  }

  /* ---------------- sending ---------------- */
  const escH=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const textHTML=t=>escH(String(t||'').trim()).replace(/\r?\n/g,'<br>');
  /* Every send checks the test lock itself, before anything leaves - not only the page's buttons. */
  function allowed(chat, meId){
    if(!chat || !chat.id) throw new Error('No chat picked.');
    if(!canSend(chat, meId)) throw new Error('Test: you can only send to your testers.');
  }
  async function sendText(chat, meId, text){
    allowed(chat, meId);
    return call('POST', '/chats/'+encodeURIComponent(chat.id)+'/messages', {body:{contentType:'html', content:textHTML(text)}});
  }
  /* A photo inside the message. b64 = the JPEG's bytes as base64 (already resized - photo() below). */
  async function sendPhoto(chat, meId, b64, w, h, text){
    allowed(chat, meId);
    const img='<img src="../hostedContents/1/$value" width="'+(w|0)+'" height="'+(h|0)+'" style="vertical-align:bottom; width:'+(w|0)+'px; height:'+(h|0)+'px">';
    return call('POST', '/chats/'+encodeURIComponent(chat.id)+'/messages', {
      body:{contentType:'html', content:(text?'<p>'+textHTML(text)+'</p>':'')+'<div><span>'+img+'</span></div>'},
      hostedContents:[{'@microsoft.graph.temporaryId':'1', contentBytes:b64, contentType:'image/jpeg'}]});
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
  async function sendFile(chatId, item, text){
    const id=etagGuid(item.eTag);
    if(!id || !item.webUrl) throw new Error('The video uploaded, but Microsoft did not say where it is.');
    return call('POST', '/chats/'+encodeURIComponent(chatId)+'/messages', {
      body:{contentType:'html', content:(text?textHTML(text)+' ':'')+'<attachment id="'+id+'"></attachment>'},
      attachments:[{id, contentType:'reference', contentUrl:item.webUrl, name:item.name}]});
  }
  /* The whole video send. chat = a mapChat() chat. Resolves {message, item, shared:true|false}. */
  async function sendVideo(chat, meId, blob, name, onProgress, text){
    allowed(chat, meId);
    const item=await upload(blob, name, onProgress);
    let shared=true;
    try{ await share(item.id, (chat.people||[]).filter(p=>p.id!==meId)); }catch(_){ shared=false; }
    const message=await sendFile(chat.id, item, text);
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

  global.PH_CHATG={CHAT_LIVE, TEST, mode, setSwitch, switchedOn, signedIn, testers, setTesters, canSend, ask, token,
    listChats, listMessages, markRead, createChat, searchPeople, userByEmail,
    sendText, sendPhoto, sendVideo, upload, share, sendFile, fileFor, picture, photo, callLink,
    _t:{parts, decode, mapMessage, mapChat, etagGuid, shareId, safeName, textHTML, call, CHUNK, SMALL, MAX_VIDEO, FOLDER, TENANT}};
})(window);
