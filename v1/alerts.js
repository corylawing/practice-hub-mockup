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
  function addDevice(rec, sub, kind, at){
    if(!okSub(sub)) return undefined;
    const rest=devices(rec).filter(x=>x.s.endpoint!==sub.endpoint);
    return {v:1, d:[{s:{endpoint:sub.endpoint, keys:{p256dh:sub.keys.p256dh, auth:sub.keys.auth}}, k:kind||'', at:at||''}].concat(rest).slice(0, MAX_DEVICES)};
  }
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
    return S.update(keyFor(em), cur=>{
      const has=devices(cur).find(x=>x.s.endpoint===sub.endpoint);
      if(has && has.s.keys.p256dh===sub.keys.p256dh && has.s.keys.auth===sub.keys.auth && devices(cur)[0]===has) return undefined;
      return addDevice(cur, sub, KIND, new Date().toISOString());
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
    const j=sub.toJSON(); keep(j); await saveMine(j); return j;
  }
  async function disable(){
    const old=saved();
    try{ const reg=await navigator.serviceWorker.getRegistration(); const s=reg && await reg.pushManager.getSubscription(); if(s) await s.unsubscribe(); }catch(_){}
    keep(null);
    if(old && old.endpoint) await dropMine(old.endpoint);
  }
  /* A device's address can change on its own: keep ours current - here and with the person - whenever a page opens. */
  async function refresh(){
    if(!supported() || Notification.permission!=='granted' || !saved()) return;
    const old=saved();
    try{
      const reg=await navigator.serviceWorker.getRegistration(), s=reg && await reg.pushManager.getSubscription();
      if(!s){ keep(null); if(old && old.endpoint) await dropMine(old.endpoint); return; }
      const j=s.toJSON(); keep(j);
      if(old && old.endpoint && old.endpoint!==j.endpoint) await dropMine(old.endpoint);
      await saveMine(j);
    }catch(_){}
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
  async function sendTo(emails, msg){
    const out={people:0, devices:0, sent:0, gone:0, failed:[]}, S=store();
    if(!ON || !S) return out;
    const list=[...new Set((emails||[]).map(lc).filter(Boolean))];
    if(!list.length) return out;
    const idt=await idToken();
    for(const em of list){
      let rec=null; try{ rec=await S.get(keyFor(em)); }catch(_){ out.failed.push(em+': couldn’t read their devices'); continue; }
      const ds=devices(rec); if(ds.length) out.people++;
      for(const d of ds){
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
  const here=p=>new URL(p, location.href).pathname;          // the path an alert opens, on this site
  if(supported()){
    refresh();
    document.addEventListener('ph-signed-in', ()=>{ refresh(); });   // the shared copy can only be written once signed in
  }
  global.PH_ALERTS={state, enable, disable, send, sendTo, saved, here, refresh, IOS, INSTALLED, KIND, ON, supported,
    _rec:{keyFor, devices, addDevice, dropDevice, MAX_DEVICES}};
})(window);
