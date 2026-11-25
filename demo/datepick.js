/* DATE & TIME PICKER - one for all of Practice Hub (19/11/2026).
   Jordan: "I don't like the date picker either it looks so old"; "Can they still type it though?"; "I don't really like the
   drop down within it [the month and year selectors] look very old school"; the time picker's columns are good but "uses
   highlight color that have nothing to do with home-brace brand"; "not always home-brace teal it depends on the color
   scheme" -> every colour here is the person's own scheme (--teal, --teal-600, --teal-wash, --teal-line from user.js).
   HOW: PH_PICK.enhance(root) takes every <input type="date"> and <input type="time"> (not [data-nopick]) and puts a
   readable box in front of it ("Thu, Nov 19, 2026" / "9:30 AM"). The original stays in the page, hidden, and is the one
   that holds the value (yyyy-mm-dd / hh:mm) and sends the input + change events - so every page's own code keeps
   working untouched. Typing always works (mm/dd/yyyy, the slashes fill in; "11/18" = this year; "930" = 9:30, "2" =
   2:00 PM in office hours); the calendar is there for anyone who'd rather tap: quick picks, the month and year chosen
   from grids (no dropdowns), arrow keys + Enter, Esc. Date of birth (data-pick="dob", or a box whose name says dob/birth)
   opens on the year grid. Time: the scrolling columns - hour, minute (every 5; any minute can be typed), AM/PM. */
(function(global){
  'use strict';
  const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  function parseISO(s){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||'')); if(!m) return null; const d=new Date(+m[1], +m[2]-1, +m[3]); return d.getMonth()===+m[2]-1 ? d : null; }
  /* "11/18/2026", "11182026", "111826", "11/18" (this year), "11-18-26" -> a Date, or null; never a date that doesn't exist */
  function parseTyped(s, now){
    const t=String(s||'').trim(); if(!t) return null; now=now||new Date();
    let m=/^(\d{1,2})[\/\-. ](\d{1,2})(?:[\/\-. ](\d{2}|\d{4}))?$/.exec(t), mo, da, yr;
    if(m){ mo=+m[1]; da=+m[2]; yr=m[3]===undefined ? now.getFullYear() : +m[3]; }
    else { const g=t.replace(/\D/g,''); if(g.length===8){ mo=+g.slice(0,2); da=+g.slice(2,4); yr=+g.slice(4); } else if(g.length===6){ mo=+g.slice(0,2); da=+g.slice(2,4); yr=+g.slice(4); } else if(g.length===4){ mo=+g.slice(0,2); da=+g.slice(2); yr=now.getFullYear(); } else return null; }
    if(yr<100) yr+= yr+2000>now.getFullYear()+20 ? 1900 : 2000;
    const d=new Date(yr, mo-1, da); return d.getFullYear()===yr && d.getMonth()===mo-1 && d.getDate()===da ? d : null;
  }
  /* the slashes fill in as you type */
  function mask(v){ v=String(v||''); if(/[\/\-.]/.test(v)) return v.replace(/[^\d\/\-.]/g,'').slice(0,10); const g=v.replace(/\D/g,'').slice(0,8);
    return g.length>4 ? g.slice(0,2)+'/'+g.slice(2,4)+'/'+g.slice(4) : g.length>2 ? g.slice(0,2)+'/'+g.slice(2) : g; }
  /* "930" -> 09:30, "9:30 pm" -> 21:30, "2" -> 14:00 (1-6 with no AM/PM is the afternoon, in office hours), "14:05" */
  function parseTime(s){
    const t=String(s||'').trim().toLowerCase(); if(!t) return null;
    const ap=/p/.test(t) ? 'pm' : /a/.test(t) ? 'am' : '', g=t.replace(/[^\d:]/g,'');
    let h, m;
    if(/:/.test(g)){ const p=g.split(':'); h=+p[0]; m=+(p[1]||0); }
    else if(g.length<=2){ h=+g; m=0; } else if(g.length===3){ h=+g.slice(0,1); m=+g.slice(1); } else if(g.length===4){ h=+g.slice(0,2); m=+g.slice(2); } else return null;
    if(!isFinite(h) || !isFinite(m) || m>59 || h>23) return null;
    if(ap==='pm' && h<12) h+=12; if(ap==='am' && h===12) h=0;
    if(!ap && h>=1 && h<=6) h+=12;
    return pad(h)+':'+pad(m);
  }
  const showDate=(d, dob)=>d ? (dob ? '' : DOW[d.getDay()]+', ')+MON[d.getMonth()].slice(0,3)+' '+d.getDate()+', '+d.getFullYear() : '';
  const showTime=v=>{ const m=/^(\d{2}):(\d{2})/.exec(String(v||'')); if(!m) return ''; let h=+m[1]; const ap=h>=12?'PM':'AM'; h=h%12||12; return h+':'+m[2]+' '+ap; };
  const RULES={parseISO, parseTyped, parseTime, mask, showDate, showTime, iso};
  if(typeof document==='undefined'){ global.PH_PICK=RULES; return; }

  /* ---------- styles: the person's own scheme colours, with Practice Hub's as the fallback ---------- */
  function css(){
    if(document.getElementById('pk-css')) return; const st=document.createElement('style'); st.id='pk-css'; st.textContent=
    '.pk-box{position:relative;display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;border:1px solid var(--line,#E4E8EE);border-radius:10px;background:#fff;padding:0 11px;min-height:42px;cursor:text;transition:border-color .12s,box-shadow .12s}'+
    '.pk-box:hover{border-color:var(--teal-line,#a9dcd9)}'+
    '.pk-box.on{border-color:var(--teal,#149B96);box-shadow:0 0 0 3px var(--teal-wash,rgba(20,155,150,.12))}'+
    '.pk-box svg{width:17px;height:17px;flex:none;color:var(--soft,#56627A)}'+
    '.pk-box.on svg{color:var(--teal-600,#0F827E)}'+
    '.pk-box input.pk-in{flex:1;min-width:0;border:0!important;outline:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;margin:0;font:inherit;font-size:15px;font-weight:600;color:var(--navy,#0F2A4A);height:38px}'+
    '.pk-box input.pk-in::placeholder{color:#9aa5b5;font-weight:500}'+
    '.pk-box input.pk-in::selection{background:var(--teal-soft,#E5F4F3);color:var(--teal-ink,#0a4d49)}'+
    '.pk-box.ro{background:#fafbfc;cursor:default}'+
    '.pk-err{font-size:12px;color:#B4321F;margin-top:4px}'+
    '.pk-pop{position:fixed;z-index:10060;background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:16px;box-shadow:0 18px 50px rgba(15,42,74,.18),0 2px 6px rgba(15,42,74,.06);padding:12px;width:334px;max-width:calc(100vw - 16px);font-family:inherit;animation:pk-in .14s ease-out}'+
    '@keyframes pk-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'+
    '.pk-pop *{box-sizing:border-box}'+
    '.pk-pop button{font:inherit;cursor:pointer;-webkit-appearance:none;appearance:none}'+
    '.pk-quick{display:flex;gap:5px;flex-wrap:nowrap;margin-bottom:10px}'+
    '.pk-quick button{flex:1 1 auto;white-space:nowrap;text-align:center;border:1px solid var(--line,#E4E8EE);background:#fff;color:var(--navy,#0F2A4A);border-radius:999px;padding:5px 6px;font-size:12.5px;font-weight:600;line-height:1.2}'+
    '.pk-quick button:hover{border-color:var(--teal,#149B96);color:var(--teal-600,#0F827E);background:var(--teal-wash,#F2FAF9)}'+
    '.pk-nav{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:6px}'+
    '.pk-nav .pk-t{border:0;background:none;border-radius:9px;padding:6px 10px;font-size:15px;font-weight:700;color:var(--navy,#0F2A4A);display:inline-flex;align-items:center;gap:5px;white-space:nowrap}'+
    '.pk-nav .pk-t:hover{background:var(--teal-wash,#F2FAF9);color:var(--teal-600,#0F827E)}'+
    '.pk-nav .pk-t svg{width:14px;height:14px}'+
    '.pk-nav .pk-a{border:0;background:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--navy,#0F2A4A)}'+
    '.pk-nav .pk-a:hover{background:var(--teal-wash,#F2FAF9);color:var(--teal-600,#0F827E)}'+
    '.pk-nav .pk-a svg{width:16px;height:16px}'+
    '.pk-days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}'+
    '.pk-days .pk-w{font-size:11.5px;font-weight:700;color:#9aa5b5;text-align:center;padding:4px 0 6px}'+
    '.pk-days button{border:0;background:none;height:36px;border-radius:50%;font-size:14px;font-weight:600;color:var(--ink,#1F2D3D);padding:0}'+
    '.pk-days button:hover{background:var(--teal-wash,#F2FAF9);color:var(--teal-600,#0F827E)}'+
    '.pk-days button.td{color:var(--teal-600,#0F827E);box-shadow:inset 0 0 0 1.5px var(--teal-line,#a9dcd9)}'+
    '.pk-days button.sel,.pk-days button.sel:hover{background:var(--teal,#149B96);color:#fff;box-shadow:none}'+
    '.pk-days button.kb{outline:2px solid var(--teal,#149B96);outline-offset:1px}'+
    '.pk-days button:disabled{color:#c9d0da;cursor:default;background:none}'+
    '.pk-days .pk-x{visibility:hidden}'+
    '.pk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:2px 0}'+
    '.pk-grid button{border:0;background:none;height:44px;border-radius:12px;font-size:14px;font-weight:600;color:var(--ink,#1F2D3D)}'+
    '.pk-grid button:hover{background:var(--teal-wash,#F2FAF9);color:var(--teal-600,#0F827E)}'+
    '.pk-grid button.sel,.pk-grid button.sel:hover{background:var(--teal,#149B96);color:#fff}'+
    '.pk-grid button.td{color:var(--teal-600,#0F827E)}'+
    '.pk-foot{display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--line,#E4E8EE)}'+
    '.pk-foot button{border:0;background:none;color:var(--teal-600,#0F827E);font-weight:700;font-size:13px;padding:4px 6px;border-radius:7px}'+
    '.pk-foot button:hover{background:var(--teal-wash,#F2FAF9)}'+
    '.pk-time{width:auto;padding:8px}'+
    '.pk-cols{display:flex;gap:4px}'+
    '.pk-col{display:flex;flex-direction:column;gap:2px;height:232px;overflow-y:auto;padding:2px;scrollbar-width:thin;scroll-behavior:smooth}'+
    '.pk-col button{border:0;background:none;width:58px;min-height:36px;border-radius:9px;font-size:15px;font-weight:600;color:var(--ink,#1F2D3D);padding:0}'+
    '.pk-col button:hover{background:var(--teal-wash,#F2FAF9);color:var(--teal-600,#0F827E)}'+
    '.pk-col button.sel,.pk-col button.sel:hover{background:var(--teal,#149B96);color:#fff}'+
    '.pk-col.ap{height:auto}'+
    '@media (prefers-reduced-motion: reduce){.pk-pop{animation:none}.pk-col{scroll-behavior:auto}}';
    document.head.appendChild(st);
  }
  const ICON={date:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    dob:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c1.5 1 3 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0"/><path d="M12 12V8"/><path d="M12 5.5c.8-.9.8-1.7 0-2.5-.8.8-.8 1.6 0 2.5z"/></svg>',
    time:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    left:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    right:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'};

  /* ---------- one picker on a page at a time ---------- */
  let POP=null, CUR=null;
  function close(){ if(POP){ POP.remove(); POP=null; } if(CUR){ CUR.box.classList.remove('on'); CUR=null; } document.removeEventListener('mousedown', outside, true); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); }
  function outside(e){ if(!CUR) return; if(POP && POP.contains(e.target)) return; if(CUR.box.contains(e.target)) return; commit(CUR, true); close(); }
  function place(){ if(!POP || !CUR) return; if(!document.body.contains(CUR.box)){ close(); return; } const r=CUR.box.getBoundingClientRect(), w=POP.offsetWidth, h=POP.offsetHeight;
    let left=Math.min(Math.max(8, r.left), window.innerWidth-w-8), top=r.bottom+6; if(top+h>window.innerHeight-8 && r.top-h-6>8) top=r.top-h-6;
    POP.style.left=left+'px'; POP.style.top=top+'px'; }
  function fire(orig){ ['input','change'].forEach(t=>{ try{ orig.dispatchEvent(new Event(t, {bubbles:true})); }catch(_){} }); }
  function setVal(P, v){ if(P.orig.value===v) return; P.orig.value=v; fire(P.orig); }
  function today(){ const n=new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function bound(P, d){ const mn=parseISO(P.orig.min), mx=parseISO(P.orig.max); return (!mn || d>=mn) && (!mx || d<=mx); }

  /* what's in the box when you're not typing */
  function paint(P){ if(document.activeElement===P.inp) return;
    P.inp.value = P.kind==='time' ? showTime(P.orig.value) : showDate(parseISO(P.orig.value), P.kind==='dob'); }
  /* the words typed: kept if they're a real date / time, otherwise said and put back */
  function commit(P, quiet){
    const t=P.inp.value.trim(); if(P.err){ P.err.remove(); P.err=null; }
    if(!t){ setVal(P, ''); return true; }
    if(P.kind==='time'){ if(t===showTime(P.orig.value)) return true; const v=parseTime(t); if(v){ setVal(P, v); P.inp.value=showTime(v); return true; } }
    else { if(t===showDate(parseISO(P.orig.value), P.kind==='dob')) return true; const d=parseTyped(t); if(d && bound(P, d)){ setVal(P, iso(d)); P.inp.value=showDate(d, P.kind==='dob'); P.view=new Date(d.getFullYear(), d.getMonth(), 1); return true; } }
    if(!quiet){ P.err=document.createElement('div'); P.err.className='pk-err'; P.err.textContent=P.kind==='time' ? 'That isn’t a time - try 9:30 or 2 pm' : 'That date doesn’t exist - try 11/18/2026'; P.box.insertAdjacentElement('afterend', P.err); }
    setTimeout(()=>{ if(P.err){ P.err.remove(); P.err=null; } }, 4000);
    paint(Object.assign(P, {})); P.inp.value=P.kind==='time' ? showTime(P.orig.value) : showDate(parseISO(P.orig.value), P.kind==='dob'); return false;
  }

  /* ---------- the calendar ---------- */
  function drawDate(P){
    const sel=parseISO(P.orig.value), td=today(), y=P.view.getFullYear(), m=P.view.getMonth();
    let h='';
    if(P.lvl==='year'){
      const p=P.page;
      h+='<div class="pk-nav"><button type="button" class="pk-a" data-pk="ypage" data-v="-12" aria-label="Earlier years">'+ICON.left+'</button><span class="pk-t" style="cursor:default">'+p+' – '+(p+11)+'</span><button type="button" class="pk-a" data-pk="ypage" data-v="12" aria-label="Later years">'+ICON.right+'</button></div>';
      h+='<div class="pk-grid">'+Array.from({length:12},(_,i)=>p+i).map(yr=>'<button type="button" data-pk="year" data-v="'+yr+'" class="'+(sel && sel.getFullYear()===yr ? 'sel' : yr===td.getFullYear() ? 'td' : '')+'">'+yr+'</button>').join('')+'</div>';
    } else if(P.lvl==='month'){
      h+='<div class="pk-nav"><button type="button" class="pk-a" data-pk="ystep" data-v="-1" aria-label="Year before">'+ICON.left+'</button><button type="button" class="pk-t" data-pk="lvl" data-v="year">'+y+' '+ICON.down+'</button><button type="button" class="pk-a" data-pk="ystep" data-v="1" aria-label="Year after">'+ICON.right+'</button></div>';
      h+='<div class="pk-grid">'+MON.map((mo,i)=>'<button type="button" data-pk="month" data-v="'+i+'" class="'+(sel && sel.getFullYear()===y && sel.getMonth()===i ? 'sel' : y===td.getFullYear() && i===td.getMonth() ? 'td' : '')+'">'+mo.slice(0,3)+'</button>').join('')+'</div>';
    } else {
      if(P.kind!=='dob') h+='<div class="pk-quick">'+[['Today',0],['Tomorrow',1],['In 3 days',3],['Next week',7]].filter(q=>{ const d=new Date(td); d.setDate(d.getDate()+q[1]); return bound(P, d); }).map(q=>'<button type="button" data-pk="quick" data-v="'+q[1]+'">'+q[0]+'</button>').join('')+'</div>';
      h+='<div class="pk-nav"><button type="button" class="pk-a" data-pk="mstep" data-v="-1" aria-label="Month before">'+ICON.left+'</button><button type="button" class="pk-t" data-pk="lvl" data-v="month">'+MON[m]+' '+y+' '+ICON.down+'</button><button type="button" class="pk-a" data-pk="mstep" data-v="1" aria-label="Month after">'+ICON.right+'</button></div>';
      h+='<div class="pk-days" role="grid">'+['S','M','T','W','T','F','S'].map(d=>'<span class="pk-w">'+d+'</span>').join('');
      const first=new Date(y,m,1).getDay(), n=new Date(y,m+1,0).getDate(), kb=P.kb;
      for(let i=0;i<first;i++) h+='<span class="pk-x"></span>';
      for(let d=1;d<=n;d++){ const dt=new Date(y,m,d), ok=bound(P, dt);
        h+='<button type="button" data-pk="day" data-v="'+d+'"'+(ok?'':' disabled')+' class="'+[sel && +sel===+dt ? 'sel' : '', +td===+dt ? 'td' : '', kb && +kb===+dt ? 'kb' : ''].join(' ').trim()+'" aria-label="'+DOW[dt.getDay()]+' '+MON[m]+' '+d+', '+y+'">'+d+'</button>'; }
      h+='</div><div class="pk-foot"><button type="button" data-pk="clear">Clear</button>'+(P.kind!=='dob' && bound(P, td) ? '<button type="button" data-pk="quick" data-v="0">Today</button>' : '<span></span>')+'</div>';
    }
    POP.innerHTML=h; POP.className='pk-pop'; place();
  }
  /* ---------- the time columns ---------- */
  function drawTime(P){
    const m=/^(\d{2}):(\d{2})/.exec(P.orig.value||'') || [0,'09','00'], H24=+m[1], MIN=+m[2], ap=H24>=12?'PM':'AM', h12=H24%12||12;
    const hours=[7,8,9,10,11,12,1,2,3,4,5,6], mins=[0,5,10,15,20,25,30,35,40,45,50,55]; if(mins.indexOf(MIN)<0){ mins.push(MIN); mins.sort((a,b)=>a-b); }
    POP.className='pk-pop pk-time';
    POP.innerHTML='<div class="pk-cols"><div class="pk-col" data-col="h">'+hours.map(h=>'<button type="button" data-pk="h" data-v="'+h+'" class="'+(h===h12?'sel':'')+'">'+pad(h)+'</button>').join('')+'</div>'+
      '<div class="pk-col" data-col="m">'+mins.map(x=>'<button type="button" data-pk="m" data-v="'+x+'" class="'+(x===MIN?'sel':'')+'">'+pad(x)+'</button>').join('')+'</div>'+
      '<div class="pk-col ap">'+['AM','PM'].map(a=>'<button type="button" data-pk="ap" data-v="'+a+'" class="'+(a===ap?'sel':'')+'">'+a+'</button>').join('')+'</div></div>';
    place();
    POP.querySelectorAll('.pk-col').forEach(c=>{ const s=c.querySelector('.sel'); if(s) c.scrollTop=s.offsetTop-c.clientHeight/2+s.offsetHeight/2; });
  }
  function draw(P){ if(P.kind==='time') drawTime(P); else drawDate(P); }
  function open(P){
    if(P.orig.disabled || P.orig.readOnly) return;
    if(CUR && CUR!==P){ commit(CUR, true); close(); }
    if(!POP){ POP=document.createElement('div'); POP.setAttribute('role','dialog'); document.body.appendChild(POP);
      POP.addEventListener('mousedown', e=>e.preventDefault());               // the cursor stays in the box
      POP.addEventListener('click', e=>{ const b=e.target.closest('[data-pk]'); if(b && CUR) act(CUR, b.dataset.pk, b.dataset.v); });
      document.addEventListener('mousedown', outside, true); window.addEventListener('scroll', place, true); window.addEventListener('resize', place); }
    CUR=P; P.box.classList.add('on');
    const sel=parseISO(P.orig.value);
    P.view=sel ? new Date(sel.getFullYear(), sel.getMonth(), 1) : P.kind==='dob' ? new Date(today().getFullYear()-12, 0, 1) : new Date(today().getFullYear(), today().getMonth(), 1);
    P.lvl=P.kind==='dob' && !sel ? 'year' : 'day'; P.page=P.view.getFullYear()-P.view.getFullYear()%12; P.kb=null;
    draw(P);
  }
  function act(P, a, v){
    const td=today();
    if(a==='quick'){ const d=new Date(td); d.setDate(d.getDate()+(+v)); setVal(P, iso(d)); P.inp.value=showDate(d); close(); P.inp.blur(); return; }
    if(a==='clear'){ setVal(P, ''); P.inp.value=''; close(); return; }
    if(a==='mstep'){ P.view=new Date(P.view.getFullYear(), P.view.getMonth()+(+v), 1); }
    else if(a==='ystep'){ P.view=new Date(P.view.getFullYear()+(+v), P.view.getMonth(), 1); }
    else if(a==='ypage'){ P.page+= +v; }
    else if(a==='lvl'){ P.lvl=v; if(v==='year') P.page=P.view.getFullYear()-P.view.getFullYear()%12; }
    else if(a==='year'){ P.view=new Date(+v, P.view.getMonth(), 1); P.lvl='month'; }
    else if(a==='month'){ P.view=new Date(P.view.getFullYear(), +v, 1); P.lvl='day'; }
    else if(a==='day'){ const d=new Date(P.view.getFullYear(), P.view.getMonth(), +v); setVal(P, iso(d)); P.inp.value=showDate(d, P.kind==='dob'); close(); P.inp.blur(); return; }
    else if(a==='h' || a==='m' || a==='ap'){
      const m=/^(\d{2}):(\d{2})/.exec(P.orig.value||'') || [0,'09','00']; let H=+m[1], M=+m[2]; const pm=H>=12;
      if(a==='h'){ const h=+v; H=(h%12)+(pm?12:0); } else if(a==='m') M=+v; else H=(H%12)+(v==='PM'?12:0);
      const val=pad(H)+':'+pad(M); setVal(P, val); P.inp.value=showTime(val);
      if(a==='ap'){ close(); P.inp.blur(); return; }
    }
    draw(P);
  }
  function key(P, e){
    if(e.key==='Escape'){ if(POP){ e.preventDefault(); close(); paint(P); } return; }
    if(e.key==='Enter'){ e.preventDefault(); if(P.kb && P.kind!=='time'){ const d=P.kb; setVal(P, iso(d)); P.inp.value=showDate(d, P.kind==='dob'); close(); P.inp.blur(); return; } if(commit(P)){ close(); P.inp.blur(); } return; }
    if(P.kind!=='time' && POP && P.lvl==='day' && /^Arrow/.test(e.key) && !P.inp.value.match(/\d/) || (P.kb && /^Arrow/.test(e.key))){
      e.preventDefault(); const base=P.kb || parseISO(P.orig.value) || today(), step={ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7}[e.key]||0;
      const d=new Date(base); d.setDate(d.getDate()+step); P.kb=d; P.view=new Date(d.getFullYear(), d.getMonth(), 1); P.lvl='day'; draw(P);
    }
  }
  /* ---------- put a picker on a box ---------- */
  function attach(orig){
    if(orig.dataset.pk==='1' || orig.hasAttribute('data-nopick')) return; orig.dataset.pk='1';
    const kind=orig.type==='time' ? 'time' : (orig.dataset.pick==='dob' || /dob|birth/i.test((orig.dataset.f||'')+' '+(orig.name||'')+' '+(orig.id||''))) ? 'dob' : 'date';
    const box=document.createElement('div'); box.className='pk-box'+(orig.disabled||orig.readOnly?' ro':'');
    box.innerHTML=ICON[kind==='dob'?'dob':kind];
    const inp=document.createElement('input'); inp.type='text'; inp.className='pk-in'; inp.autocomplete='off'; inp.setAttribute('data-nomic',''); inp.inputMode=kind==='time'?'text':'numeric';
    inp.placeholder=kind==='time' ? 'h:mm' : 'mm/dd/yyyy'; inp.setAttribute('aria-label', orig.getAttribute('aria-label') || (orig.labels && orig.labels[0] && orig.labels[0].textContent.trim()) || (kind==='time'?'Time':'Date'));
    if(orig.disabled || orig.readOnly) inp.readOnly=true;
    box.appendChild(inp);
    const P={orig, box, inp, kind, view:new Date(), lvl:'day', page:2020, kb:null, err:null};
    orig.insertAdjacentElement('beforebegin', box);
    orig.style.display='none'; orig.tabIndex=-1;
    if(orig.id && !inp.id){ inp.id=orig.id+'-pk'; const lab=document.querySelector('label[for="'+orig.id+'"]'); if(lab) lab.htmlFor=inp.id; }
    paint(P);
    box.addEventListener('mousedown', e=>{ if(e.target!==inp){ e.preventDefault(); inp.focus(); } });
    inp.addEventListener('focus', ()=>{ if(kind!=='time'){ const d=parseISO(orig.value); inp.value=d ? pad(d.getMonth()+1)+'/'+pad(d.getDate())+'/'+d.getFullYear() : ''; } inp.select(); open(P); });
    inp.addEventListener('input', ()=>{ P.kb=null; if(kind!=='time'){ const v=mask(inp.value); if(v!==inp.value) inp.value=v; const d=parseTyped(inp.value); if(d && POP && CUR===P){ P.view=new Date(d.getFullYear(), d.getMonth(), 1); P.lvl='day'; P.kb=d; draw(P); } } });
    inp.addEventListener('keydown', e=>key(P, e));
    inp.addEventListener('blur', ()=>{ setTimeout(()=>{ if(CUR===P && document.activeElement!==inp){ commit(P); close(); paint(P); } else if(!CUR) paint(P); }, 0); });
    /* the page set the value itself (a quick-date chip, a reset): show it */
    const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    try{ Object.defineProperty(orig, 'value', {configurable:true, get(){ return d.get.call(this); }, set(v){ d.set.call(this, v); if(document.activeElement!==inp) paint(P); }}); }catch(_){}
  }
  function enhance(root){ css(); (root||document).querySelectorAll('input[type="date"],input[type="time"]').forEach(attach); }
  /* boxes a page draws later (dialogs, re-renders) get one too */
  let watching=false;
  function watch(){ if(watching || typeof MutationObserver==='undefined') return; watching=true;
    new MutationObserver(muts=>{ for(const m of muts) for(const n of m.addedNodes){ if(n.nodeType!==1) continue; if(n.matches && n.matches('input[type="date"],input[type="time"]')) attach(n); else if(n.querySelectorAll) n.querySelectorAll('input[type="date"],input[type="time"]').forEach(attach); } })
      .observe(document.body, {childList:true, subtree:true}); }
  global.PH_PICK=Object.assign({}, RULES, {enhance, watch, close, start(root){ enhance(root); watch(); }});
})(typeof window!=='undefined' ? window : globalThis);
