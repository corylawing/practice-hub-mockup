/* YOUR DAY - the card at the top of Home (26/11/2026). Cory: "we need to bring Home-Brace to next level where doctors and
   office managers are convinced by it helping them everyday and that they want to login"; "Lets give a your day card";
   "build it but userfriendly". Home's app tiles are gone (Cory: they repeat the menu).

   A few big boxes, each one thing about TODAY for THIS person, each opening the page behind it:
     doctor        - where I am today (and tomorrow), consults booked there today, that office's month against goal
     office manager- my office today, consults + calls due, payroll for this pay period, my office's month against goal
     TC            - my office today, consults + calls due
     leadership    - offices open today, consults across the practice, payroll sheets in, the practice's month
     everyone else - my office today and this week
   A box shows only when the person can see what it comes from (Schedule, TC Tracker, Payroll, Production Dashboard, by
   Teams & Access) and the numbers read - otherwise it isn't there (never a zero that isn't true). Tasks and birthdays
   have their own cards on Home, so they are not repeated here.
   Counts only - no patient, name of a patient or pay amount ever reaches this card. Live: the Schedule (schedrec.js),
   the TC Tracker's files (tcstore.js + tc.js), the payroll status list, the production books (prodstore.js). Sandbox:
   made-up numbers. Pure parts in _pure (test/yourday.test.js). */
(function(global){
  'use strict';
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const pad=n=>String(n).padStart(2,'0');
  const isoDay=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const addDays=(s,n)=>{ const d=new Date(+s.slice(0,4), +s.slice(5,7)-1, +s.slice(8,10)); d.setDate(d.getDate()+n); return isoDay(d); };
  const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayName=s=>DOW[new Date(+s.slice(0,4), +s.slice(5,7)-1, +s.slice(8,10)).getDay()];
  const nice=s=>dayName(s)+', '+MON[+s.slice(5,7)-1]+' '+(+s.slice(8,10));
  const hm=m=>{ if(m==null || isNaN(m)) return ''; const h=Math.floor(m/60), mi=m%60, h12=((h+11)%12)+1; return h12+':'+pad(mi); };
  const money=v=>{ const s=v<0?'-':''; v=Math.abs(v); return s+'$'+(v>=1e6 ? (v/1e6).toFixed(2)+'M' : v>=1e3 ? Math.round(v).toLocaleString() : Math.round(v)); };
  const norm=n=>String(n||'').replace(/^\s*dr\.?\s+/i,'').replace(/["“”][^"“”]*["“”]|\([^)]*\)/g,'').trim().toLowerCase().replace(/\s+/g,' ');

  /* ---------- who is this, for the card ---------- */
  function roleOf(p){
    const teams=(p.teams||[]).map(t=>String(t).toLowerCase()), role=String(p.role||p.title||'').toLowerCase();
    if(teams.some(t=>/doctor/.test(t)) || /doctor|\bdds\b|orthodontist/.test(role) || /^\s*dr\.?\s/i.test(p.name||'')) return 'doctor';
    if(p.admin || p.all) return 'lead';
    if(teams.some(t=>/office manager/.test(t)) || /\bom\b|office manager/.test(role)) return 'om';
    if(teams.some(t=>/^tcs?$|treatment coord/.test(t)) || /\btc\b|treatment coord/.test(role)) return 'tc';
    return 'staff';
  }

  /* ---------- the Schedule, for one day ---------- */
  function docsOf(c, docs){ const ids=Array.isArray(c && c.ps) ? c.ps : (c && c.p!=null ? [c.p] : []); return ids.filter(i=>docs[i]).map(i=>docs[i].n); }
  /* One office's day: {open, closed, ydot, docs:[names], s, e, event} (null = nothing on the Schedule for it). */
  function officeDay(sched, docs, office, day){
    const c=((sched||{})[day]||{})[office]; if(!c) return null;
    const ds=docsOf(c, docs||[]);
    return {open:!c.closed && (ds.length>0 || !!c.ydot), closed:!!c.closed, ydot:!!c.ydot && !ds.length, docs:ds, s:c.s, e:c.e, event:c.event||''};
  }
  /* Where a doctor is on a day: the office(s) whose cell names them. */
  function doctorAt(sched, docs, offices, name, day){
    const me=norm(name); if(!me) return [];
    /* the doctor list may hold "Dr. Coleman" (last name only) or the full name */
    const myLast=me.split(' ').pop(), myFirst=me.split(' ')[0];
    const mine=(docs||[]).filter(d=>d && !d.left).map((d,i)=>({i:(docs||[]).indexOf(d), n:norm(d.n)})).filter(d=>d.n===me ||
      (d.n.indexOf(' ')<0 && d.n===myLast) || (d.n.split(' ').pop()===myLast && d.n.split(' ')[0][0]===myFirst[0]));
    if(!mine.length) return [];
    const ids=new Set(mine.map(d=>d.i));
    return (offices||[]).filter(o=>{ const c=((sched||{})[day]||{})[o]; if(!c || c.closed) return false;
      const l=Array.isArray(c.ps) ? c.ps : (c.p!=null ? [c.p] : []); return l.some(i=>ids.has(i)); })
      .map(o=>({office:o, s:((sched[day]||{})[o]||{}).s, e:((sched[day]||{})[o]||{}).e}));
  }

  /* ---------- the boxes (pure: the data in, what to show out) ----------
     D = {today, role, office, offices, where, tomorrow, week, sched:{open,closed,total}, consults:{today, calls}, pay, prod} */
  function boxes(D){
    const out=[], o=D.office, r=D.role;
    /* 1. where */
    if(r==='doctor'){
      if(D.where && D.where.length){ const w=D.where[0];
        out.push({k:'where', dark:true, icon:'📍', label:'Today', big:D.where.map(x=>x.office).join(' + '),
          sub:[w.s!=null && w.e!=null ? hm(w.s)+' – '+hm(w.e) : '', D.tomorrow ? D.tomorrow.label+': '+(D.tomorrow.offices.length ? D.tomorrow.offices.join(' + ') : 'not on the schedule') : ''].filter(Boolean).join(' · '), href:'schedule.html'}); }
      else if(D.where) out.push({k:'where', dark:true, icon:'📍', label:'Today', big:'Not scheduled', sub:D.tomorrow && D.tomorrow.offices.length ? D.tomorrow.label+': '+D.tomorrow.offices.join(' + ') : 'No office on the Schedule for you today', href:'schedule.html'});
    } else if(r==='lead'){
      if(D.sched) out.push({k:'where', dark:true, icon:'📍', label:'Today', big:D.sched.open+' of '+D.sched.total+' open',
        sub:D.sched.closed.length ? D.sched.closed.join(', ')+' closed' : 'Every office open', href:'schedule.html'});
    } else if(o && D.day){
      const d=D.day;
      out.push({k:'where', dark:true, icon:'📍', label:o+' today', big:d.closed ? 'Closed' : d.ydot ? 'Yellow Dot day' : d.open ? 'Open' : 'Not on the schedule',
        sub:[d.docs.length ? d.docs.join(', ')+' in' : '', d.s!=null && d.e!=null && !d.closed ? hm(d.s)+' – '+hm(d.e) : '', d.event].filter(Boolean).join(' · '), href:'schedule.html'});
    }
    /* 2. consults */
    if(D.consults){ const c=D.consults, at=r==='lead' ? 'across the practice' : (D.consultsAt ? 'at '+D.consultsAt : '');
      out.push({k:'consults', icon:'🦷', label:'New-patient consults', big:c.today+' today', sub:[at, c.calls!=null ? c.calls+' to call back' : ''].filter(Boolean).join(' · '),
        go:c.calls ? 'Open the call list' : 'See the day', href:'tc.html'}); }
    /* 3. payroll */
    if(D.pay){ const p=D.pay;
      if(p.kind==='mine') out.push({k:'pay', icon:'💵', label:'Payroll #'+p.n, big:p.sent ? 'Sent ✓' : 'Due '+p.dueDay.slice(0,3), sub:p.sent ? 'for '+p.office : 'by 2 pm · '+p.office,
        pill:p.sent ? {t:'Done', tone:'ok'} : p.late ? {t:'Late', tone:'bad'} : {t:'Not sent yet', tone:p.dueSoon ? 'bad' : 'warn'}, href:'payroll.html'});
      else out.push({k:'pay', icon:'💵', label:'Payroll #'+p.n, big:p.entered ? 'Entered ✓' : p.sent+' of '+p.total+' sent', sub:p.entered ? 'all done for this pay period' : (p.waiting.length ? 'waiting on '+p.waiting.slice(0,3).join(', ')+(p.waiting.length>3?' +'+(p.waiting.length-3):'') : 'all in - ready to enter'),
        pill:p.entered ? {t:'Done', tone:'ok'} : {t:'Due '+p.dueDay.slice(0,3)+' 2 pm', tone:p.late ? 'bad' : 'warn'}, href:'payroll.html'});
    }
    /* 4. the month against goal */
    if(D.prod){ const p=D.prod;
      out.push({k:'prod', icon:'📈', label:(p.office ? p.office+' in ' : '')+p.month, big:Math.round(p.pct*100)+'% of goal', bar:Math.min(1, p.pct),
        pill:p.vpace>=0 ? {t:'On pace', tone:'ok'} : {t:money(-p.vpace)+' behind pace', tone:'warn'}, href:'index.html'}); }
    /* staff: the week at their office */
    if(r==='staff' && D.week && D.week.length) out.push({k:'week', icon:'🗓️', label:'This week at '+o, big:(n=>n+(n===1?' day':' days')+' open')(D.week.filter(x=>x.open).length), sub:D.week.filter(x=>x.open).map(x=>x.day.slice(0,3)).join(' · ') || 'no open days', href:'schedule.html'});
    return out;
  }

  /* ---------- the counts (pure) ---------- */
  const liveC=r=>r && !r.deleted && !r.moved;
  function consultCounts(list, offices, today, TC){
    const mine=(list||[]).filter(r=>liveC(r) && (!offices || offices.indexOf(r.office)>=0));
    const n=mine.filter(r=>r.date===today).length;
    let calls=null; if(TC && TC.callList) calls=TC.callList(mine, today).filter(x=>(TC.DUE||[]).indexOf(x.a)>=0).length;
    return {today:n, calls};
  }
  /* One office (or several, summed) this month: % of goal and how far from the goal for the days worked. */
  function monthPace(offices, names, m){
    let act=0, goal=0, days=0, done=0, any=false;
    names.forEach(n=>{ const o=offices[n]; if(!o) return; any=true; act+=(o.act||[])[m]||0; goal+=(o.goal||[])[m]||0; days+=(o.days||[])[m]||0; done+=(o.done||[])[m]||0; });
    if(!any || !goal) return null;
    const paced=days && done ? goal*Math.min(1, done/days) : goal;
    return {pct:act/goal, vpace:act-paced, act, goal};
  }
  function payBox(R, status, today, mine, level, offNames){
    if(!R || !R.period || !R.currentIndex || !status || typeof status!=='object') return null;     // the list didn't read: no box, never "0 sent"
    const per=R.period(R.currentIndex(today)); if(R.FIRST && per.key<R.FIRST) return null;
    const st=((status && status.p) || {})[per.key] || {}, sent=st.sent || {}, due=per.due;
    const late=today>due, dueSoon=today>=addDays(due,-1);
    if(level==='manage' || level==='view'){
      const offs=(R.OFFICES||[]).filter(o=>!o.self), done=offs.filter(o=>sent[o.k]);
      return {kind:'all', n:per.n, entered:!!st.entered, sent:done.length, total:offs.length, waiting:offs.filter(o=>!sent[o.k]).map(o=>o.n), dueDay:dayName(due), late:late && !st.entered};
    }
    if(mine && mine.length){ const k=mine[0], off=(R.OFFICES||[]).find(o=>o.k===k);
      return {kind:'mine', n:per.n, office:(off && off.n) || offNames || '', sent:!!sent[k], dueDay:dayName(due), late:late && !sent[k], dueSoon}; }
    return null;
  }

  /* ---------- reading (live) ---------- */
  const live=()=>!!(global.PH && PH.isLive && PH.isLive());
  function script(name){ return new Promise(ok=>{ if(document.querySelector('script[data-yd="'+name+'"]')) return ok(true);
    const me_=document.querySelector('script[src*="user.js"]'), sc=document.createElement('script'); sc.setAttribute('data-yd', name);
    sc.src=me_ ? me_.getAttribute('src').replace(/user\.js/, name) : name; sc.onload=()=>ok(true); sc.onerror=()=>ok(false); document.head.appendChild(sc); }); }
  const need=(glob, files)=>global[glob] ? Promise.resolve(true) : files.reduce((p,f)=>p.then(()=>script(f)), Promise.resolve()).then(()=>!!global[glob]);
  /* a few numbers kept for a while on this device - counts only, never a patient */
  function kept(key, mins, make){
    try{ const x=JSON.parse(sessionStorage.getItem('ph_yd_'+key)||'null'); if(x && Date.now()-x.at<mins*60e3) return Promise.resolve(x.v); }catch(_){}
    return make().then(v=>{ try{ sessionStorage.setItem('ph_yd_'+key, JSON.stringify({at:Date.now(), v})); }catch(_){} return v; });
  }
  function readSched(){
    return need('PH_SCHED', ['schedrec.js']).then(ok=>ok ? Promise.all([PH_SCHED.load(), global.PH_STORE.get('ph_docs').catch(()=>null)]) : null)
      .then(r=>r && r[0] && r[0].sched ? {sched:r[0].sched, docs:Array.isArray(r[1]) ? r[1] : ((r[1] && r[1].people) || [])} : null).catch(()=>null);
  }
  function readConsults(offices, today){
    return need('TC', ['tcstore.js', 'tc.js']).then(ok=>{ if(!ok || !global.TCSTORE) return null;
      const T=global.TC, prefixes=offices ? offices.map(o=>T.logKey(o, '')) : [T.LOG_PREFIX];
      return Promise.all(prefixes.map(px=>global.TCSTORE.getAll(px, {partial:true}).catch(()=>null))).then(all=>{
        if(all.every(x=>!x)) return null;
        const merged={}; all.forEach(L=>Object.assign(merged, L||{}));
        return consultCounts(T.consultsFrom(merged), offices, today, T); }); }).catch(()=>null);
  }
  function readPay(today, P){
    if(!(P.payOn && P.payOn()) || !(P.payLevel && P.payLevel())) return Promise.resolve(null);
    const level=P.payLevel();
    return P.reloadPayStatus().then(st=>payBox(global.PAYRULES, st, today, level==='send' ? P.paySenderOffices() : null, level)).catch(()=>null);
  }
  function readProd(names, today){
    return need('PH_PROD', ['workbook.js', 'prodbook.js', 'prodstore.js']).then(ok=>{ if(!ok) return null;
      return PH_PROD.mode().then(md=>md && md.source==='homebrace' ? PH_PROD.dashboardData() : null).then(hb=>{
        if(!hb || +hb.year!==+today.slice(0,4)) return null;
        const p=monthPace(hb.offices||{}, names, +today.slice(5,7)-1); return p ? Object.assign(p, {month:MON[+today.slice(5,7)-1]}) : null; }); }).catch(()=>null);
  }

  /* ---------- made-up (sandbox) ---------- */
  function sample(role, office, offices, today){
    let seed=7+role.length*13+String(office||'').length; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
    const tomorrow=addDays(today,1);
    const D={sample:true};
    if(role==='doctor'){ D.where=[{office:office||offices[0], s:480, e:1020}]; D.tomorrow={label:dayName(tomorrow)==='Saturday' ? 'Monday' : 'Tomorrow', offices:[offices[(offices.indexOf(office)+1)%offices.length]]}; }
    if(role==='lead') D.sched={open:offices.length-2, total:offices.length, closed:offices.slice(-2)};
    if(['om','tc','staff'].indexOf(role)>=0) D.day={open:true, closed:false, ydot:false, docs:['Dr. Coleman'], s:480, e:1020, event:''};
    if(role==='staff') D.week=['Monday','Tuesday','Wednesday','Thursday','Friday'].map((d,i)=>({day:d, open:i%2===0}));
    if(['doctor','om','tc','lead'].indexOf(role)>=0){ D.consults={today:role==='lead' ? 31 : 4+Math.floor(rnd()*4), calls:role==='doctor' ? null : (role==='lead' ? 58 : 8+Math.floor(rnd()*8))}; D.consultsAt=role==='lead' ? '' : (office||offices[0]); }
    if(role==='om') D.pay={kind:'mine', n:25, office, sent:false, dueDay:'Tuesday', late:false, dueSoon:false};
    if(role==='lead') D.pay={kind:'all', n:25, entered:false, sent:6, total:8, waiting:offices.slice(2,4), dueDay:'Tuesday', late:false};
    if(['doctor','om','lead'].indexOf(role)>=0){ const pct=role==='lead' ? 0.84 : 0.78+rnd()*0.2; D.prod={office:role==='lead' ? '' : (office||offices[0]), month:MON[+today.slice(5,7)-1], pct, vpace:role==='lead' ? -53680 : (pct>0.9 ? 1200 : -8400)}; }
    return D;
  }

  /* ---------- the card ---------- */
  function styles(){
    if(document.getElementById('yd-css')) return;
    const s=document.createElement('style'); s.id='yd-css';
    s.textContent=`
    .yd{background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:18px;padding:16px 18px;margin:0 0 18px;box-shadow:var(--shadow,none)}
    .yd-hd{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 12px}.yd-hd h2{margin:0;font-size:18px;color:var(--navy,#0F2A4A)}.yd-hd span{font-size:13.5px;color:var(--soft,#56627A)}
    .yd-tag{margin-left:auto;font-size:11.5px;font-weight:700;color:#8a5a00;background:#FFF4DC;border-radius:99px;padding:2px 9px}
    .yd-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
    .yd-b{border-radius:14px;padding:13px 15px;background:#F7F9FB;border:1px solid var(--line,#E4E8EE);display:flex;flex-direction:column;gap:3px;min-width:0;text-decoration:none;color:inherit;transition:border-color .15s, transform .15s}
    .yd-b:hover,.yd-b:focus-visible{border-color:var(--teal,#149B96);transform:translateY(-1px);outline:none}
    .yd-b .k{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--soft,#56627A)}
    .yd-b .v{font-size:26px;font-weight:800;color:var(--navy,#0F2A4A);line-height:1.15;overflow-wrap:anywhere}.yd-b .s{font-size:13px;color:var(--soft,#56627A);line-height:1.35}
    .yd-b.dark{background:var(--navy,#0F2A4A);border-color:var(--navy,#0F2A4A)}.yd-b.dark .k{color:#9fb3cc}.yd-b.dark .v{color:#fff}.yd-b.dark .s{color:#cdd9ea}
    .yd-b .go{margin-top:auto;padding-top:4px;font-size:12.5px;font-weight:700;color:var(--teal-600,#0F827E)}
    .yd-pill{align-self:flex-start;font-size:11.5px;font-weight:700;border-radius:99px;padding:2px 9px;margin-top:3px}
    .yd-pill.ok{background:#E7F4EE;color:#1d6b46}.yd-pill.warn{background:#FFF4DC;color:#8a5a00}.yd-pill.bad{background:#FBEAE7;color:#9a2f1e}
    .yd-bar{height:8px;border-radius:99px;background:var(--line,#E4E8EE);overflow:hidden;margin-top:6px}.yd-bar i{display:block;height:100%;background:var(--teal,#149B96);border-radius:99px}
    .yd-b.wait .v{color:#c3ccd8}
    @media (max-width:520px){ .yd{padding:14px} .yd-row{grid-template-columns:1fr 1fr} .yd-b .v{font-size:22px} .yd-b.dark{grid-column:1 / -1} }`;
    document.head.appendChild(s);
  }
  function boxHTML(b){
    return '<a class="yd-b'+(b.dark?' dark':'')+'" href="'+esc(b.href||'#')+'"><span class="k">'+b.icon+' '+esc(b.label)+'</span><span class="v">'+esc(b.big)+'</span>'+
      (b.sub ? '<span class="s">'+esc(b.sub)+'</span>' : '')+(b.bar!=null ? '<span class="yd-bar" aria-hidden="true"><i style="width:'+Math.round(b.bar*100)+'%"></i></span>' : '')+
      (b.pill ? '<span class="yd-pill '+b.pill.tone+'">'+esc(b.pill.t)+'</span>' : '')+(b.go ? '<span class="go">'+esc(b.go)+' →</span>' : '')+'</a>';
  }
  let RUN=0;
  /* who = {role, name, office, offices:'all'|[...], can:{tc, pay, dash}} */
  function mount(host, who){
    if(!host) return; styles();
    const run=++RUN, today=isoDay(new Date()), P=global.PH||{}, all=(P.officeNames ? P.officeNames() : []).slice();
    const role=who.role, office=who.office || (Array.isArray(who.offices) ? who.offices[0] : '') || '';
    const head='<div class="yd-hd"><h2>Your day</h2><span>'+esc(nice(today))+(role!=='lead' && role!=='doctor' && office ? ' · '+esc(office) : role==='lead' ? ' · all offices' : '')+'</span>'+(live() ? '' : '<span class="yd-tag">Sandbox: made-up numbers</span>')+'</div>';
    const paint=D=>{ if(run!==RUN) return; const list=boxes(Object.assign({today, role, office}, D));
      host.hidden=!list.length; host.innerHTML=list.length ? '<section class="yd" aria-label="Your day">'+head+'<div class="yd-row">'+list.map(boxHTML).join('')+'</div></section>' : ''; };
    if(!live()){ paint(sample(role, office || all[0], all, today)); return; }
    const D={};
    paint(D);                                                                                 // whatever is ready, as it lands
    const tasks=[];
    tasks.push(readSched().then(S=>{ if(!S) return;
      if(role==='doctor'){ D.where=doctorAt(S.sched, S.docs, all, who.name, today);
        let nx=addDays(today,1); while(/Saturday|Sunday/.test(dayName(nx))) nx=addDays(nx,1);
        D.tomorrow={label:nx===addDays(today,1) ? 'Tomorrow' : dayName(nx), offices:doctorAt(S.sched, S.docs, all, who.name, nx).map(x=>x.office)};
        D.office=D.where.length ? D.where[0].office : ''; }
      else if(role==='lead'){ const days=all.map(o=>({o, d:officeDay(S.sched, S.docs, o, today)}));
        D.sched={open:days.filter(x=>x.d && x.d.open).length, total:all.length, closed:days.filter(x=>!x.d || !x.d.open).map(x=>x.o)}; }
      else if(office){ D.day=officeDay(S.sched, S.docs, office, today) || {open:false, closed:false, ydot:false, docs:[], event:''};
        if(role==='staff'){ const mon=addDays(today, -((new Date().getDay()+6)%7)); D.week=[0,1,2,3,4].map(i=>{ const d=addDays(mon,i), x=officeDay(S.sched, S.docs, office, d); return {day:dayName(d), open:!!(x && x.open)}; }); } }
      paint(D); }));
    const afterWhere=tasks[0];
    if(who.can.tc && role!=='staff'){
      tasks.push(afterWhere.then(()=>{ const offs=role==='lead' ? null : (role==='doctor' ? (D.office ? [D.office] : null) : (office ? [office] : null));
        if(role!=='lead' && !offs) return;
        return kept('c_'+(offs ? offs.join('|') : 'all')+'_'+today, 5, ()=>readConsults(offs, today)).then(c=>{ if(c){ D.consults=role==='doctor' ? {today:c.today, calls:null} : c; D.consultsAt=offs ? offs[0] : ''; paint(D); } }); })); }
    if(who.can.pay && (role==='om' || role==='lead' || role==='tc')) tasks.push(readPay(today, P).then(p=>{ if(p){ D.pay=p; paint(D); } }));
    if(who.can.dash && role!=='staff' && role!=='tc'){
      tasks.push(afterWhere.then(()=>{ const names=role==='lead' ? all : [(role==='doctor' ? D.office : office)].filter(Boolean); if(!names.length) return;
        return kept('p_'+names.join('|')+'_'+today, 30, ()=>readProd(names, today)).then(p=>{ if(p){ D.prod=Object.assign({office:role==='lead' ? '' : names[0]}, p); paint(D); } }); })); }
    return Promise.all(tasks);
  }
  /* The signed-in person (live) or Home's sandbox persona, in the shape mount() takes. */
  function whoFrom(persona){
    const P=global.PH||{};
    if(live() && P.me){ const m=P.me()||{}, offs=P.offices ? P.offices() : [];
      const admin=!!(P.isAdmin && P.isAdmin(P.realMe ? P.realMe() : m));
      const who={name:(P.name ? P.name(m) : ((m.first||'')+' '+(m.last||''))), role:'', offices:offs, office:Array.isArray(offs) ? offs[0] : '',
        can:{tc:admin || !!(P.atLeast && P.atLeast('tc','view')), pay:!!(P.payOn && P.payOn() && P.payLevel && P.payLevel()), dash:admin || !!(P.atLeast && P.atLeast('dashboard','view'))}};
      who.role=roleOf({name:who.name, teams:m.teams, role:m.role||m.title, admin, all:offs==='all'});
      return who; }
    const id=(persona && persona.id) || 'admin', scope=(persona && persona.scope)||'all';
    const role=id==='admin' ? 'lead' : id==='om' ? 'om' : id==='doctor' ? 'doctor' : id==='tc' ? 'tc' : 'staff';
    return {name:role==='doctor' ? 'Dr. Coleman' : '', role, office:scope==='all' ? '' : scope, offices:scope==='all' ? 'all' : [scope], can:{tc:true, pay:true, dash:true}};
  }

  global.PH_DAY={mount, whoFrom, _pure:{roleOf, officeDay, doctorAt, boxes, consultCounts, monthPace, payBox, sample, norm}};
})(typeof window!=='undefined' ? window : globalThis);
