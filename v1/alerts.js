/* PHONE AND COMPUTER ALERTS (22/10/2026, Cory: "yes for phone alerts we need that" - payroll reminders, chat).
   PH_ALERTS turns alerts on for THIS device, and sends an alert through Home-Brace's alert sender (api-push).
   Sandbox for now: the sender is its TEST SLOT, and this device's alert address (its "subscription") stays on this
   device, so every alert the sandbox sends comes to you. On the live site each person's address will be kept with
   their profile in SharePoint, so a reminder or a chat message can reach them on every device they turned on.
   iPhone: Apple only allows alerts for a web app added to the home screen (iOS 16.4 or newer). */
(function(global){
  'use strict';
  const SENDER='https://kind-hill-00da87410-alerts.centralus.3.azurestaticapps.net/api/push';
  const PUBLIC_KEY='BAUGXYt9Tf0seJ24ks7PIKITPkqbtlD_qe1ApKIqOvGM7EMCjdHTVurmF_d2mkYXu5hGVKcSh8tWLlFX5bke9XM';   // the sender's public half
  const SUB_KEY='ph_alert_sub';
  const UA=navigator.userAgent||'';
  const IOS=/iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints>1);   // an iPad says "Macintosh"
  const INSTALLED=navigator.standalone===true || !!(global.matchMedia && global.matchMedia('(display-mode: standalone)').matches);
  const supported=()=>'serviceWorker' in navigator && 'PushManager' in global && 'Notification' in global;
  const saved=()=>{ try{ return JSON.parse(localStorage.getItem(SUB_KEY)||'null'); }catch(_){ return null; } };
  const keep=j=>{ try{ j ? localStorage.setItem(SUB_KEY, JSON.stringify(j)) : localStorage.removeItem(SUB_KEY); }catch(_){} };

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
    const j=sub.toJSON(); keep(j); return j;
  }
  async function disable(){
    try{ const reg=await navigator.serviceWorker.getRegistration(); const s=reg && await reg.pushManager.getSubscription(); if(s) await s.unsubscribe(); }catch(_){}
    keep(null);
  }
  /* A device's address can change on its own: keep ours current whenever a page opens. */
  async function refresh(){
    if(!supported() || Notification.permission!=='granted' || !saved()) return;
    try{ const reg=await navigator.serviceWorker.getRegistration(); const s=reg && await reg.pushManager.getSubscription();
      if(s) keep(s.toJSON()); else keep(null); }catch(_){}
  }
  /* One alert, to this device. msg = {title, body, url (a path on this site), tag, delay (seconds, at most 10)} */
  async function send(msg, sub){
    sub=sub||saved(); if(!sub) throw new Error('off');
    const r=await fetch(SENDER, {method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify(Object.assign({sub}, msg))});
    const j=await r.json().catch(()=>({}));
    if(j.gone) keep(null);                                  // this device turned alerts off in its settings
    if(!r.ok || !j.ok) throw new Error(j.error || ('status '+(j.status||r.status)));
    return j;
  }
  const here=p=>new URL(p, location.href).pathname;        // the path an alert opens, on this site
  if(supported()) refresh();
  global.PH_ALERTS={state, enable, disable, send, saved, here, refresh, IOS, INSTALLED, supported};
})(window);
