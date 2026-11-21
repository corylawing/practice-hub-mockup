/* PHONE AND COMPUTER ALERTS (22/10/2026, Cory: "yes for phone alerts we need that" - payroll reminders, chat).
   PH_ALERTS turns alerts on for THIS device, and sends alerts through Home-Brace's alert sender (api-push).
   EVERY DEVICE A PERSON TURNS ON (03/11/2026): each device's alert address (its "subscription") is kept with the
   person in the shared store - ph_alertdev_<email> = {v:1, d:[{s: subscription, k:'iPhone', at}]}, newest first, at
   most 6 - so a reminder or a chat message reaches every phone and computer they turned on. sendTo(emails, msg) reads
   each person's devices and sends one alert to each; a device that has since turned alerts off ("gone") is dropped.
   The sender only sends for someone signed in to the practice: every request carries their Microsoft sign-in (the ID
   token, PH_AUTH.idToken) and the sender checks it (api-push/idtoken.js).
   Sandbox: the sender is its TEST SLOT and the store is this browser, so "everyone" is whoever turned alerts on here
   (View As someone, turn alerts on, and they're on for them on this device). Live: ON since 04/11/2026 (Cory: "Phone
   alerts can be on") - the live site's own /api/push (api-push, shipped by deploy-production.sh).
   iPhone: Apple only allows alerts for a web app added to the home screen (iOS 16.4 or newer). */
(function(global){
  'use strict';
  const ALERTS_LIVE=true;                                     // 04/11/2026: on - deploy-production.sh ships api-push as the site's API
  const LIVE=!!(global.PH && global.PH.isLive && global.PH.isLive());
  const SENDER=LIVE ? location.origin+'/api/push' : 'https://kind-hill-00da87410-alerts.centralus.3.azurestaticapps.net/api/push';
  const PUBLIC_KEY='BAUGXYt9Tf0seJ24ks7PIKITPkqbtlD_qe1ApKIqOvGM7EMCjdHTVurmF_d2mkYXu5hGVKcSh8tWLlFX5bke9XM';   // the sender's public half
  const SUB_KEY='ph_alert_sub', DEV='ph_alertdev_', MAX_DEVICES=6;
  const ON=!LIVE || ALERTS_LIVE;
  const UA=navigator.userAgent||'';
  const IOS=/iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints>1);   // an iPad says "Macintosh"
  const INSTALLED=navigator.standalone===true || !!(global.matchMedia && global.matchMedia('(display-mode: standalone)').matches);
  const KIND=/iPad/.test(UA)||(/Macintosh/.test(UA)&&navigator.maxTouchPoints>1) ? 'iPad' : /iPhone|iPod/.test(UA) ? 'iPhone' : /Android/.test(UA) ? 'Android phone'
    : /Macintosh/.test(UA) ? 'Mac' : /Windows/.test(UA) ? 'Windows computer' : 'computer';
  const supported=()=>'serviceWorker' in navigator && 'PushManager' in global && 'Notification' in global;
  const saved=()=>{ try{ return JSON.parse(localStorage.getItem(SUB_KEY)||'null'); }catch(_){ return null; } };
  const keep=j=>{ try{ j ? localStorage.setItem(SUB_KEY, JSON.stringify(j)) : localStorage.removeItem(SUB_KEY); }catch(_){} };

  /* ---- one person's devices (pure, so the tests can check them) ---- */
  const lc=s=>String(s||'').trim().toLowerCase();
  const keyFor=email=>DEV+lc(email);
  const okSub=s=>!!(s && typeof s.endpoint==='string' && /^https:\/\//.test(s.endpoint) && s.keys && s.keys.p256dh && s.keys.auth);
  function devices(rec){ return (rec && Array.isArray(rec.d)) ? rec.d.filter(x=>x && okSub(x.s)) : []; }
  /* ONE ALERT PER PHONE (21/11/2026, Cory: "Sometimes homebrace on my phone will send notifications 2 or 3 times").
     His record held two iPhones - the same phone under an old address Apple still accepted, so every alert went twice
     (and a chat sent from Home-Brace a third time, through the instant chat link too). Now each install keeps its own id
     (did): a new address for the same install replaces the old one; an entry no install has opened Home-Brace on for
     STALE_DAYS is dropped; and the entries from before ids (no id) of this phone's own kind go when this phone saves.
     seen = the last day this install opened Home-Brace; ci = until when this device has instant chat alerts. */
  const STALE_DAYS=21, DAYMS=864e5;
  function addDevice(rec, sub, kind, at, did){
    if(!okSub(sub)) return undefined;
    const was=devices(rec).find(x=>x.s.endpoint===sub.endpoint);
    const rest=devices(rec).filter(x=>x.s.endpoint!==sub.endpoint && !(did && x.id===did));
    const e={s:{endpoint:sub.endpoint, keys:{p256dh:sub.keys.p256dh, auth:sub.keys.auth}}, k:kind||'', at:at||''};
    if(did){ e.id=String(did).slice(0,40); e.seen=at||''; }
    if(was && was.ci) e.ci=was.ci;
    return {v:1, d:[e].concat(rest).slice(0, MAX_DEVICES)};
  }
  /* what this install's save leaves: stale entries out; old no-id leftovers of the same kind out */
  function tidyDevices(list, me, kind, nowMs){
    return list.filter(x=>{
      if(x.s.endpoint===me) return true;
      const last=Date.parse(x.seen || x.at || '') || 0;
      if(last && nowMs-last>STALE_DAYS*DAYMS) return false;
      if(!x.id && x.k===kind && last && nowMs-last>2*DAYMS) return false;
      return true;
    });
  }
  const DID_KEY='ph_alert_did';
  function myDid(){ try{ let d=localStorage.getItem(DID_KEY); if(!d){ d=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-5); localStorage.setItem(DID_KEY, d); } return d; }catch(_){ return ''; } }
  function dropDevice(rec, endpoint){
    const was=devices(rec), left=was.filter(x=>x.s.endpoint!==endpoint);
    return left.length===was.length ? undefined : {v:1, d:left};      // undefined = nothing to write
  }

  /* Whose devices this browser's are: the signed-in person on the live site; on the sandbox whoever you're viewing as. */
  function who(){
    const P=global.PH; if(!P || !P.email) return '';
    try{ return lc(P.email(LIVE && P.realMe ? P.realMe() : P.me())); }catch(_){ return ''; }
  }
  const store=()=>global.PH_STORE||null;
  function saveMine(sub){
    const em=who(), S=store(); if(!em || !S || !okSub(sub)) return Promise.resolve(null);
    const did=myDid();
    return S.update(keyFor(em), cur=>{
      const nowMs=Date.now(), list=devices(cur), has=list.find(x=>x.s.endpoint===sub.endpoint), tidy=tidyDevices(list, sub.endpoint, KIND, nowMs);
      const fresh=has && has.seen && nowMs-(Date.parse(has.seen)||0)<DAYMS;
      if(has && has.s.keys.p256dh===sub.keys.p256dh && has.s.keys.auth===sub.keys.auth && list[0]===has && has.id===did && fresh && tidy.length===list.length) return undefined;
      return addDevice({v:1, d:tidy}, sub, KIND, new Date(nowMs).toISOString(), did);
    }).catch(()=>null);
  }
  function dropMine(endpoint){
    const em=who(), S=store(); if(!em || !S || !endpoint) return Promise.resolve(null);
    return S.update(keyFor(em), cur=>dropDevice(cur, endpoint)).catch(()=>null);
  }

  /* 'install' (an iPhone in Safari: add it to the home screen first) · 'unsupported' · 'blocked' (said no before)
     · 'off' · 'on' */
  function state(){
    if(IOS && !INSTALLED) return 'install';
    if(!supported()) return 'unsupported';
    if(Notification.permission==='denied') return 'blocked';
    return Notification.permission==='granted' && saved() ? 'on' : 'off';
  }
  const registration=()=>navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready);
  function keyBytes(b){ const s=atob(b.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-b.length%4)%4)); return Uint8Array.from(s, c=>c.charCodeAt(0)); }

  /* Call straight from a tap: the browser only asks "Allow notifications?" from one. */
  async function enable(){
    const st=state();
    if(st==='install' || st==='unsupported' || st==='blocked') throw new Error(st);
    const p=await Notification.requestPermission();
    if(p!=='granted') throw new Error(p==='denied' ? 'blocked' : 'dismissed');
    const reg=await registration();
    let sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:keyBytes(PUBLIC_KEY)});
    const j=sub.toJSON(); keep(j); markOff(false); await saveMine(j);
    chatLink();                                                // instant chat alerts for a pilot member (quietly)
    return j;
  }
  async function disable(){
    await chatUnlink();                                        // Microsoft stops telling the sender about this device
    const old=saved();
    try{ const reg=await navigator.serviceWorker.getRegistration(); const s=reg && await reg.pushManager.getSubscription(); if(s) await s.unsubscribe(); }catch(_){}
    keep(null); markOff(true);
    if(old && old.endpoint) await dropMine(old.endpoint);
  }
  /* A device's address can change on its own: keep ours current - here and with the person - whenever a page opens.
     20/11/2026, Heather: "my phone keeps not giving me notifications and when I open the app it shows the button to turn
     on notifications, which I have multiple times." This used to give up the moment the phone hadn't found its alert
     service yet: it then DELETED this phone from the person's devices and showed "Turn on" again. Now it wakes the
     service (registering again is harmless), and if the phone really has no subscription while alerts are still
     allowed, it quietly makes a new one. Only if that fails is the old one dropped. A browser that forgot it was on
     (allowed + a live subscription, and not turned off here) is put back on. */
  const OFF_KEY='ph_alert_off';
  const offHere=()=>{ try{ return localStorage.getItem(OFF_KEY)==='1'; }catch(_){ return false; } };
  const markOff=v=>{ try{ v ? localStorage.setItem(OFF_KEY, '1') : localStorage.removeItem(OFF_KEY); }catch(_){} };
  let busy=null, again=false;
  function refresh(){                                          // one at a time; a call while one runs runs once more after it
    if(busy){ again=true; return busy; }
    busy=(async ()=>{ try{ do{ again=false; await refreshNow(); }while(again); }catch(_){} finally{ busy=null; } })();
    return busy;
  }
  async function refreshNow(){
    if(!supported() || Notification.permission!=='granted') return;
    const old=saved();
    if(!old && offHere()) return;                              // turned off on this device: leave it off
    let reg=null;
    try{ reg=await navigator.serviceWorker.getRegistration(); }catch(_){}
    if(!reg){ try{ reg=await registration(); }catch(_){ return; } }        // can't reach the service right now: change nothing
    let s=null;
    try{ s=await reg.pushManager.getSubscription(); }catch(_){ return; }
    if(!s && old){ try{ s=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:keyBytes(PUBLIC_KEY)}); }catch(_){ s=null; } }
    if(!s){ if(old){ keep(null); if(old.endpoint) await dropMine(old.endpoint); } return; }
    const j=s.toJSON(); keep(j);
    if(old && old.endpoint && old.endpoint!==j.endpoint) await dropMine(old.endpoint);
    await saveMine(j);
  }

  /* The person's Microsoft sign-in, for the sender. '' when there's none (the sender then refuses: "signin"). */
  function idToken(){
    const A=global.PH_AUTH;
    return (A && A.idToken) ? A.idToken().catch(()=>'') : Promise.resolve('');
  }
  async function post(sub, msg, idt){
    const r=await fetch(SENDER, {method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify(Object.assign({idt, sub}, msg))});
    const j=await r.json().catch(()=>({}));
    if(r.status===401) j.signin=true;
    return Object.assign({httpOk:r.ok}, j);
  }
  /* One alert, to THIS device. msg = {title, body, url (a path on this site), tag, delay (seconds, at most 10)} */
  async function send(msg, sub){
    if(!ON) throw new Error('off');
    sub=sub||saved(); if(!sub) throw new Error('off');
    const j=await post(sub, msg, await idToken());
    if(j.gone){ keep(null); if(sub.endpoint) await dropMine(sub.endpoint); }   // this device turned alerts off in its settings
    if(!j.httpOk || !j.ok) throw new Error(j.signin ? 'signin' : (j.error || ('status '+(j.status||'?'))));
    return j;
  }
  /* One alert to every device of each of these people. Resolves {people, devices, sent, gone, failed:[...]};
     people with no devices are simply skipped (they haven't turned alerts on anywhere). */
  async function sendTo(emails, msg, opts){
    const out={people:0, devices:0, sent:0, gone:0, failed:[]}, S=store();
    if(!ON || !S) return out;
    const list=[...new Set((emails||[]).map(lc).filter(Boolean))];
    if(!list.length) return out;
    const idt=await idToken();
    for(const em of list){
      let rec=null; try{ rec=await S.get(keyFor(em)); }catch(_){ out.failed.push(em+': couldn’t read their devices'); continue; }
      const ds=devices(rec); if(ds.length) out.people++;
      for(const d of ds){
        if(opts && opts.skipInstant && d.ci && Date.parse(d.ci)>Date.now()) continue;   // its instant chat link alerts it already
        out.devices++;
        try{
          const j=await post(d.s, msg, idt);
          if(j.gone){ out.gone++; await S.update(keyFor(em), cur=>dropDevice(cur, d.s.endpoint)).catch(()=>null); }
          else if(j.httpOk && j.ok) out.sent++;
          else out.failed.push(em+': '+(j.signin ? 'signin' : (j.error || ('status '+(j.status||'?')))));
        }catch(e){ out.failed.push(em+': '+((e && e.message) || 'network')); }
      }
    }
    return out;
  }
  /* INSTANT CHAT ALERTS (18/11/2026, Cory: "build instant chat alerts") - the server side is api-push/chatkeys.js.
     This device asks Microsoft, with the person's OWN sign-in (Chat.ReadWrite, delegated), to tell Home-Brace's alert
     sender about every new message in their Teams chats - so a message typed in the Teams app alerts here too, within
     seconds, and their own messages never do. Only: the live site, someone in the chat pilot (PH.chatPilotMe - a
     member, never a guest) with alerts on, on this device. Microsoft keeps it up to 3 days; a visit with less than 2
     days left renews it. Turning alerts off here, or leaving the pilot, removes it. Kept on this device: ph_chat_link
     {id, exp, ep}. Fails quietly: the alerts Home-Brace already sends carry on as before (same tag 'hb-chat', so the
     two never stack). */
  const CHAT_INSTANT=true;
  const LINK_KEY='ph_chat_link', G='https://graph.microsoft.com/v1.0', DAY=864e5;
  const linkGet=()=>{ try{ return JSON.parse(localStorage.getItem(LINK_KEY)||'null'); }catch(_){ return null; } };
  const linkSet=v=>{ try{ v ? localStorage.setItem(LINK_KEY, JSON.stringify(v)) : localStorage.removeItem(LINK_KEY); }catch(_){} };
  const pilotKnown=()=>!!(global.PH && PH.chatPilotKnown && PH.chatPilotKnown());
  function chatLinkWanted(){ return ON && LIVE && CHAT_INSTANT && !!(global.PH && PH.chatPilotMe && PH.chatPilotMe()) && state()==='on' && !!saved(); }
  async function graph(method, path, body, tok){
    const r=await fetch(G+path, {method, headers:Object.assign({Authorization:'Bearer '+tok}, body ? {'Content-Type':'application/json'} : {}), body:body ? JSON.stringify(body) : undefined});
    const j=(r.status===204 || r.status===202) ? {} : await r.json().catch(()=>({}));
    if(!r.ok){ const e=new Error((j.error && j.error.message) || ('Microsoft said '+r.status)); e.status=r.status; throw e; }
    return j;
  }
  let linkBusy=null;
  function chatLink(){
    if(linkBusy) return linkBusy;
    linkBusy=(async()=>{
      const cur=linkGet();
      if(!chatLinkWanted()){
        /* Not (or no longer) for this device: once we KNOW - signed in, the pilot list read - take any link away. */
        if(cur && cur.id && LIVE && global.PH_AUTH && pilotKnown()){ await chatUnlink(); return 'removed'; }
        return 'off';
      }
      const sub=saved(), now=Date.now();
      if(cur && cur.id && cur.ep===sub.endpoint && cur.exp-now>2*DAY){ markInstant(new Date(cur.exp).toISOString()); return 'fine'; }
      const A=global.PH_AUTH; if(!A || !A.tokenFor) return 'nosignin';
      const me=(global.PH && PH.profileOf && PH.profileOf()) || {}; if(!me.id) return 'nosignin';
      const tok=await A.tokenFor(['Chat.ReadWrite']);
      const exp=new Date(now+3*DAY-15*60e3).toISOString();         // just under Microsoft's longest (3 days)
      if(cur && cur.id){
        if(cur.ep===sub.endpoint){
          try{ const j=await graph('PATCH', '/subscriptions/'+encodeURIComponent(cur.id), {expirationDateTime:exp}, tok);
               linkSet({id:cur.id, exp:Date.parse(j.expirationDateTime||exp), ep:sub.endpoint}); markInstant(new Date(Date.parse(j.expirationDateTime||exp)).toISOString()); return 'renewed'; }
          catch(e){ if(e.status!==404) throw e; }                    // it had run out: make a new one below
        } else { try{ await graph('DELETE', '/subscriptions/'+encodeURIComponent(cur.id), null, tok); }catch(_){} }   // this device's address changed
        linkSet(null);
      }
      const r=await fetch(location.origin+'/api/chatseal', {method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify({idt:await idToken(), sub})});
      const s=await r.json().catch(()=>({}));
      if(!r.ok || !s.ok) throw new Error(s.error || ('the alert sender said '+r.status));
      const j=await graph('POST', '/subscriptions', {changeType:'created', notificationUrl:s.url, lifecycleNotificationUrl:s.url+'&l=1',
        resource:'/users/'+me.id+'/chats/getAllMessages', includeResourceData:true, encryptionCertificate:s.cert, encryptionCertificateId:s.certId,
        expirationDateTime:exp, clientState:s.clientState}, tok);
      linkSet({id:j.id, exp:Date.parse(j.expirationDateTime||exp), ep:sub.endpoint}); markInstant(new Date(Date.parse(j.expirationDateTime||exp)).toISOString());
      return 'made';
    })().catch(e=>{ try{ console.warn('Instant chat alerts:', e && e.message); }catch(_){} return 'failed'; })
      .then(x=>{ linkBusy=null; return x; });
    return linkBusy;
  }
  /* this device's entry says until when Microsoft alerts it for chats (so Home-Brace's own chat alert skips it) */
  function markInstant(until){
    const em=who(), S=store(), sub=saved(); if(!em || !S || !sub) return Promise.resolve(null);
    return S.update(keyFor(em), cur=>{ const list=devices(cur), me=list.find(x=>x.s.endpoint===sub.endpoint); if(!me) return undefined;
      if((me.ci||'')===(until||'')) return undefined; const d=list.map(x=>x===me ? Object.assign({}, x, until ? {ci:until} : {}) : x); if(!until) delete d[list.indexOf(me)].ci; return {v:1, d}; }).catch(()=>null);
  }
  async function chatUnlink(){
    const cur=linkGet(); linkSet(null); markInstant(null); if(!cur || !cur.id) return;
    try{ const A=global.PH_AUTH; if(A && A.tokenFor) await graph('DELETE', '/subscriptions/'+encodeURIComponent(cur.id), null, await A.tokenFor(['Chat.ReadWrite'])); }catch(_){}
  }
  const here=p=>new URL(p, location.href).pathname;          // the path an alert opens, on this site
  if(supported()){
    refresh();
    document.addEventListener('ph-signed-in', ()=>{ refresh(); });   // the shared copy can only be written once signed in
    document.addEventListener('ph-identity', ()=>{ if(LIVE) chatLink(); });   // the pilot list has landed: make / renew / remove the instant link
  }
  global.PH_ALERTS={state, enable, disable, send, sendTo, saved, here, refresh, chatLink, chatUnlink, CHAT_INSTANT, IOS, INSTALLED, KIND, ON, supported,
    _rec:{keyFor, devices, addDevice, dropDevice, tidyDevices, MAX_DEVICES, STALE_DAYS}};
})(window);
