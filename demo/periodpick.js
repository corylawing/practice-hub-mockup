/* PERIOD PICKER - a month, a quarter, year to date or a year, one control for all of Practice Hub (21/11/2026).
   Jordan, on a plain month box: "Way to old school, we already built a date picker. Also what if they want to do this
   quarter, year to date, last year etc?" Same look as the date picker (datepick.js): a box showing the period ("October
   2026", "Q4 2026", "2026 so far"), and on tap quick picks + a month grid with the year's quarters, no dropdowns. Every
   colour is the person's own scheme (--teal, --teal-600, --teal-wash from user.js).
     const pp = PH_PERIOD.attach(buttonEl, {value, months:false, onChange(v){...}})
       value = {kind:'month', y, m} | {kind:'quarter', y, q} | {kind:'ytd', y} | {kind:'year', y}
       months:true - single months only (a page that compares month by month)
     PH_PERIOD.range(v) -> {first:'YYYY-MM-DD', last:'YYYY-MM-DD', months:[{y,m}], label, open:bool}  (open = still going)
   Nothing later than this month can be picked. */
(function(global){
  'use strict';
  const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MS=MON.map(m=>m.slice(0,3));
  const pad=n=>String(n).padStart(2,'0');
  const ICON={left:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    right:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'};
  // the practice's today (Central, PH.centralNow) - this device's clock only where user.js isn't loaded (21/11/2026, code review)
  const now=()=>{ const P=global.PH, c=P && typeof P.centralNow==='function' ? P.centralNow() : null, x=/^(\d{4})-(\d{2})-(\d{2})$/.exec((c && c.date) || '');
    if(x) return {y:+x[1], m:+x[2], d:+x[3], iso:x[0]};
    const d=new Date(); return {y:d.getFullYear(), m:d.getMonth()+1, d:d.getDate(), iso:d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}; };
  const lastDay=(y,m)=>new Date(y, m, 0).getDate();

  /* ---------- what a period means ---------- */
  function clean(v){
    const N=now(); v=v||{};
    const y=Math.min(N.y, Math.max(2000, +v.y||N.y));
    if(v.kind==='quarter'){ const q=Math.min(4, Math.max(1, +v.q||1)); return (y===N.y && (q-1)*3+1>N.m) ? {kind:'quarter', y, q:Math.ceil(N.m/3)} : {kind:'quarter', y, q}; }
    if(v.kind==='ytd') return {kind:'ytd', y:N.y};
    if(v.kind==='year') return {kind:'year', y};
    const m=Math.min(12, Math.max(1, +v.m||N.m)); return (y===N.y && m>N.m) ? {kind:'month', y, m:N.m} : {kind:'month', y, m};
  }
  function range(v){
    v=clean(v); const N=now(); let a, b;
    if(v.kind==='month'){ a={y:v.y, m:v.m}; b={y:v.y, m:v.m}; }
    else if(v.kind==='quarter'){ a={y:v.y, m:(v.q-1)*3+1}; b={y:v.y, m:v.q*3}; }
    else { a={y:v.y, m:1}; b={y:v.y, m:12}; }
    if(b.y===N.y && b.m>N.m) b={y:N.y, m:N.m};
    const months=[]; for(let y=a.y, m=a.m; y<b.y || (y===b.y && m<=b.m); m++){ if(m>12){ m=1; y++; } months.push({y, m}); if(months.length>24) break; }
    const open=b.y===N.y && b.m===N.m;
    const last=open ? N.iso : b.y+'-'+pad(b.m)+'-'+pad(lastDay(b.y, b.m));
    return {first:a.y+'-'+pad(a.m)+'-01', last, months, open, label:label(v)};
  }
  /* THE PERIOD BEFORE, to compare with (21/11/2026, Jordan: "if they are comparing a quarter or month there is a vs last month
     or vs last quarter ... good to show if ones increasing or decreasing"). Month -> the month before, quarter -> the quarter
     before, year to date -> the same dates last year, a year -> the year before. While a period is still going, the one
     before is cut to the SAME number of days (Nov 1-21 vs Oct 1-21), so a part month never looks like a drop. */
  function prev(v){
    v=clean(v); const R=range(v); let p;
    if(v.kind==='month') p=v.m===1 ? {kind:'month', y:v.y-1, m:12} : {kind:'month', y:v.y, m:v.m-1};
    else if(v.kind==='quarter') p=v.q===1 ? {kind:'quarter', y:v.y-1, q:4} : {kind:'quarter', y:v.y, q:v.q-1};
    else p={kind:'year', y:v.y-1};
    const P=range(p), short=v.kind==='month' ? 'vs '+MS[p.m-1] : v.kind==='quarter' ? 'vs Q'+p.q : v.kind==='ytd' ? 'vs same time '+p.y : 'vs '+p.y;
    if(R.open){ const d0=Date.parse(R.first+'T12:00:00'), days=Math.round((Date.parse(R.last+'T12:00:00')-d0)/864e5), s=new Date(Date.parse(P.first+'T12:00:00')+days*864e5);
      let cut=s.getFullYear()+'-'+pad(s.getMonth()+1)+'-'+pad(s.getDate());
      /* last year: the same month and day, not a count of days - a Feb 29 moved it by one (on 2028-03-01, Jan 1-Mar 1 2027) (21/11/2026, code review) */
      if(p.kind==='year'){ const lm=+R.last.slice(5,7); cut=p.y+'-'+pad(lm)+'-'+pad(Math.min(+R.last.slice(8,10), lastDay(p.y, lm))); }
      if(cut<P.last){ P.last=cut; P.months=P.months.filter(x=>x.y+'-'+pad(x.m)+'-01'<=cut); P.partial=true; } }
    P.short=short; P.value=p; return P;
  }
  function label(v){
    v=clean(v); const N=now();
    if(v.kind==='month') return MON[v.m-1]+' '+v.y;
    if(v.kind==='quarter') return 'Q'+v.q+' '+v.y+(v.y===N.y && v.q===Math.ceil(N.m/3) ? ' so far' : '');
    if(v.kind==='ytd') return v.y+' so far';
    return String(v.y)+(v.y===N.y ? ' so far' : '');
  }

  /* ---------- the look ---------- */
  function css(){
    if(document.getElementById('pp-css')) return;
    const s=document.createElement('style'); s.id='pp-css';
    s.textContent=
      '.pp-btn{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line,#E4E8EE);background:#fff;color:var(--navy,#0F2A4A);border-radius:12px;padding:8px 12px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap}'+
      '.pp-btn:hover{border-color:var(--teal,#149B96)} .pp-btn svg{width:16px;height:16px;flex:none} .pp-btn .pp-cal{color:var(--teal-600,#0F827E)} .pp-btn .pp-dn{color:var(--soft,#56627A);width:14px;height:14px}'+
      '.pp-pop{position:fixed;z-index:10060;background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:16px;box-shadow:0 18px 50px rgba(15,42,74,.18),0 2px 6px rgba(15,42,74,.06);padding:12px;width:320px;max-width:calc(100vw - 16px);font-family:inherit;animation:pp-in .14s ease-out}'+
      '@keyframes pp-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'+
      '.pp-pop *{box-sizing:border-box} .pp-pop button{font:inherit;cursor:pointer;-webkit-appearance:none;appearance:none}'+
      '.pp-quick{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}'+
      '.pp-quick button{border:1px solid var(--line,#E4E8EE);background:#fff;color:var(--navy,#0F2A4A);border-radius:999px;padding:7px 8px;font-size:13px;font-weight:600}'+
      '.pp-quick button:hover{border-color:var(--teal,#149B96);color:var(--teal-600,#0F827E);background:var(--teal-wash,#F2FAF9)}'+
      '.pp-quick button.sel{background:var(--teal,#149B96);border-color:var(--teal,#149B96);color:#fff}'+
      '.pp-or{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--soft,#56627A);margin:2px 2px 4px}'+
      '.pp-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}'+
      '.pp-nav b{font-size:15px;color:var(--navy,#0F2A4A)} .pp-nav button{border:0;background:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--navy,#0F2A4A)}'+
      '.pp-nav button:hover:not(:disabled){background:var(--teal-wash,#F2FAF9);color:var(--teal-600,#0F827E)} .pp-nav button:disabled{opacity:.3;cursor:default} .pp-nav svg{width:16px;height:16px}'+
      '.pp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}'+
      '.pp-grid button{border:0;background:none;height:40px;border-radius:11px;font-size:14px;font-weight:600;color:var(--ink,#1F2D3D)}'+
      '.pp-grid button:hover:not(:disabled){background:var(--teal-wash,#F2FAF9);color:var(--teal-600,#0F827E)}'+
      '.pp-grid button.sel,.pp-grid button.sel:hover{background:var(--teal,#149B96);color:#fff} .pp-grid button.td{color:var(--teal-600,#0F827E)} .pp-grid button:disabled{color:#C3CBD5;cursor:default}'+
      '.pp-qs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px;padding-top:8px;border-top:1px solid var(--line,#E4E8EE)}'+
      '.pp-qs button{border:1px solid var(--line,#E4E8EE);background:#fff;height:34px;border-radius:10px;font-size:13px;font-weight:700;color:var(--navy,#0F2A4A)}'+
      '.pp-qs button:hover:not(:disabled){border-color:var(--teal,#149B96);color:var(--teal-600,#0F827E)} .pp-qs button.sel{background:var(--teal,#149B96);border-color:var(--teal,#149B96);color:#fff} .pp-qs button:disabled{color:#C3CBD5;border-color:#EEF1F4;cursor:default}'+
      '@media (prefers-reduced-motion: reduce){.pp-pop{animation:none}}';
    document.head.appendChild(s);
  }

  /* ---------- the control ---------- */
  let POP=null, CUR=null;
  function close(){ if(POP){ POP.remove(); POP=null; } if(CUR){ CUR.btn.setAttribute('aria-expanded','false'); CUR=null; } }
  function same(a, b){ a=clean(a); b=clean(b); return a.kind===b.kind && a.y===b.y && (a.m||0)===(b.m||0) && (a.q||0)===(b.q||0); }
  function draw(C){
    const N=now(), v=clean(C.value), y=C.viewY, q=v.kind==='quarter' ? v : null;
    const lm=N.m===1 ? {kind:'month', y:N.y-1, m:12} : {kind:'month', y:N.y, m:N.m-1};
    const cq=Math.ceil(N.m/3), lq=cq===1 ? {kind:'quarter', y:N.y-1, q:4} : {kind:'quarter', y:N.y, q:cq-1};
    const quick=C.months ? [['This month',{kind:'month', y:N.y, m:N.m}],['Last month',lm]]
      : [['This month',{kind:'month', y:N.y, m:N.m}],['Last month',lm],['This quarter',{kind:'quarter', y:N.y, q:cq}],['Last quarter',lq],['Year to date',{kind:'ytd', y:N.y}],['Last year',{kind:'year', y:N.y-1}]];
    let h='<div class="pp-quick">'+quick.map((x,i)=>'<button type="button" data-pp="quick" data-i="'+i+'"'+(same(x[1], v)?' class="sel"':'')+'>'+x[0]+'</button>').join('')+'</div>'+
      '<div class="pp-or">Or pick '+(C.months ? 'a month' : 'a month or quarter')+'</div>'+
      '<div class="pp-nav"><button type="button" data-pp="y" data-v="-1" aria-label="Year before">'+ICON.left+'</button><b>'+y+'</b><button type="button" data-pp="y" data-v="1" aria-label="Year after"'+(y>=N.y?' disabled':'')+'>'+ICON.right+'</button></div>'+
      '<div class="pp-grid">'+MS.map((m,i)=>{ const fut=y===N.y && i+1>N.m, sel=v.kind==='month' && v.y===y && v.m===i+1;
        return '<button type="button" data-pp="m" data-v="'+(i+1)+'"'+(fut?' disabled':'')+' class="'+(sel?'sel':(y===N.y && i+1===N.m ? 'td' : ''))+'">'+m+'</button>'; }).join('')+'</div>';
    if(!C.months) h+='<div class="pp-qs">'+[1,2,3,4].map(n=>{ const fut=y===N.y && (n-1)*3+1>N.m, sel=q && q.y===y && q.q===n;
        return '<button type="button" data-pp="q" data-v="'+n+'"'+(fut?' disabled':'')+(sel?' class="sel"':'')+'>Q'+n+'</button>'; }).join('')+'</div>'+
      '<div class="pp-qs" style="grid-template-columns:1fr;border-top:0;padding-top:0"><button type="button" data-pp="yr"'+(v.kind==='year' && v.y===y ? ' class="sel"' : '')+'>All of '+y+(y===N.y?' so far':'')+'</button></div>';
    POP.innerHTML=h; C.quick=quick; place(C);
  }
  function place(C){
    const r=C.btn.getBoundingClientRect(), w=POP.offsetWidth, hh=POP.offsetHeight;
    let left=Math.min(Math.max(8, r.right-w), window.innerWidth-w-8), top=r.bottom+6; if(top+hh>window.innerHeight-8) top=Math.max(8, r.top-hh-6);
    POP.style.left=left+'px'; POP.style.top=top+'px';
  }
  function open(C){
    if(CUR===C){ close(); return; } close(); css();
    POP=document.createElement('div'); POP.className='pp-pop'; POP.setAttribute('role','dialog'); POP.setAttribute('aria-label','Pick a period'); document.body.appendChild(POP);
    CUR=C; C.btn.setAttribute('aria-expanded','true'); C.viewY=clean(C.value).y; draw(C);
    POP.addEventListener('click', e=>{ const b=e.target.closest('[data-pp]'); if(!b || b.disabled) return; const a=b.dataset.pp, n=+b.dataset.v;
      if(a==='y'){ C.viewY=Math.min(now().y, C.viewY+n); draw(C); return; }
      let v=null; if(a==='quick') v=C.quick[+b.dataset.i][1]; else if(a==='m') v={kind:'month', y:C.viewY, m:n}; else if(a==='q') v={kind:'quarter', y:C.viewY, q:n}; else if(a==='yr') v={kind:C.viewY===now().y ? 'ytd' : 'year', y:C.viewY};
      if(v){ set(C, v, true); close(); C.btn.focus(); } });
  }
  function paint(C){ C.btn.innerHTML='<span class="pp-cal">'+ICON.cal+'</span><span>'+label(C.value)+'</span><span class="pp-dn">'+ICON.down+'</span>'; }
  function set(C, v, fire){ C.value=clean(v); paint(C); if(fire && C.onChange) C.onChange(C.value, range(C.value)); }
  function attach(btn, opts){
    css(); opts=opts||{};
    const C={btn, months:!!opts.months, onChange:opts.onChange, value:clean(opts.value||{kind:'month'})};
    btn.classList.add('pp-btn'); btn.type='button'; btn.setAttribute('aria-haspopup','dialog'); btn.setAttribute('aria-expanded','false');
    btn.addEventListener('click', e=>{ e.preventDefault(); open(C); });
    paint(C);
    return { get:()=>C.value, range:()=>range(C.value), prev:()=>prev(C.value), set:v=>set(C, v, false) };
  }
  if(typeof document!=='undefined'){
    document.addEventListener('mousedown', e=>{ if(POP && !POP.contains(e.target) && !(CUR && CUR.btn.contains(e.target))) close(); }, true);
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && POP){ const b=CUR && CUR.btn; close(); if(b) b.focus(); } });
    window.addEventListener('resize', ()=>{ if(CUR && POP) place(CUR); });
    window.addEventListener('scroll', ()=>{ if(CUR && POP) place(CUR); }, true);
  }
  global.PH_PERIOD={attach, range, prev, label, clean};
  if(typeof module!=='undefined' && module.exports) module.exports=global.PH_PERIOD;
})(typeof window!=='undefined' ? window : globalThis);
