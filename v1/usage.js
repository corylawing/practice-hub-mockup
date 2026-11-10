/* ADMIN -> USAGE: the adoption dashboard (10/11/2026). Cory: the practice asked "to put in ADMIN so dashboard to see usage
   of Home-Brace (non admins). Who is logging in per different period. Basic an adoption dashboard" - "Make it a real
   adoption dashboard. Not too much but very clear with a few tiles".
   Reads every person's visit record (ph_use_<email>, written by user.js useTick: who, which section, which day) and
   lays it against the team list: four tiles (adoption, using it today, days used, never signed in), people per day,
   by office, the sections used, and everyone in a table. Admins are left out unless "Include admins" is ticked.
   Counting starts the day this went live - there was nothing recorded before. Loaded on demand (PH.usageReady). */
(function(global){
  'use strict';
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const pad=n=>String(n).padStart(2,'0');
  const isoDay=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parseDay=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||'')); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null; };
  const addDays=(s,n)=>{ const d=parseDay(s); d.setDate(d.getDate()+n); return isoDay(d); };

  /* ---------- the sums (pure - test/usage.test.js) ---------- */
  const PERIODS=[['today','Today'],['7d','7 days'],['30d','30 days'],['month','This month'],['last','Last month']];
  function period(kind, today){
    const t=parseDay(today);
    if(kind==='today') return {from:today, to:today};
    if(kind==='7d') return {from:addDays(today,-6), to:today};
    if(kind==='month') return {from:today.slice(0,8)+'01', to:today};
    if(kind==='last'){ const f=new Date(t.getFullYear(), t.getMonth()-1, 1), l=new Date(t.getFullYear(), t.getMonth(), 0); return {from:isoDay(f), to:isoDay(l)}; }
    return {from:addDays(today,-29), to:today};                                          // 30 days
  }
  function daysIn(from, to){ const out=[]; for(let d=from; d<=to; d=addDays(d,1)) out.push(d); return out; }
  const normName=n=>String(n||'').replace(/"[^"]*"|\([^)]*\)/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  const keyOf=r=>{ if(!r) return ''; const m=String(r.email||'').trim().toLowerCase(); if(m) return m;
    const e=String(r.empId||'').trim().toLowerCase(); if(e) return 'emp:'+e; const n=normName(r.name); return n ? 'name:'+n : ''; };
  const isAdminTeams=teams=>(teams||[]).some(t=>/^admin$/i.test(String(t).trim()));
  /* Everyone on the team list, each with their visit record if they have one. `raw` is the list as loaded (rosterRows),
     `view` the same rows with Admin's changes (rosterView, same order); a record is matched by the key sign-in found
     them under, then by email, then by name. Visits from people not on the list come back as extras. */
  function people(raw, view, records){
    view=view||raw||[]; raw=raw||view;
    const recs=(records||[]).filter(r=>r && typeof r==='object' && (r.off || (r.d && typeof r.d==='object')));
    const byKey={}, byMail={}, byName={};
    recs.forEach(r=>{ if(r.rk) byKey[String(r.rk).toLowerCase()]=r; if(r.email) byMail[String(r.email).toLowerCase()]=r; const n=normName(r.name); if(n) byName[n]=r; });
    const used=new Set();
    const list=view.filter(v=>v && !(v.status && /inactive|terminated|former|left/i.test(v.status))).map((v,i)=>{
      const w=raw[view.indexOf(v)]||v;
      const rec=byKey[keyOf(w)] || byKey[keyOf(v)] || (v.email && byMail[String(v.email).toLowerCase()]) || byName[normName(v.name)] || null;
      if(rec) used.add(rec);
      return {name:v.name||'', email:String(v.email||'').toLowerCase(), offices:v.offices||[], teams:v.teams||[], admin:isAdminTeams(v.teams) || !!(rec && rec.admin), rec, listed:true};
    });
    recs.filter(r=>!used.has(r)).forEach(r=>list.push({name:r.name||r.email, email:r.email||'', offices:[], teams:[], admin:!!r.admin, rec:r, listed:false}));
    return list.filter(x=>!(x.rec && x.rec.off));                     // asked not to be tracked: never in any number
  }
  /* One period: the tiles, people per day, by office, by section, and each person's line. */
  function summary(list, opts){
    const today=opts.today, p=period(opts.kind, today), days=daysIn(p.from, p.to), inc=opts.includeAdmins;
    const ppl=list.filter(x=>inc || !x.admin);
    const daysUsed=x=>!x.rec ? 0 : days.filter(d=>x.rec.d[d] && x.rec.d[d].n>0).length;
    const rows=ppl.map(x=>{ const du=daysUsed(x);
      return Object.assign({}, x, {days:du, last:x.rec ? x.rec.last||'' : '', state:du ? 'using' : x.rec ? 'quiet' : 'never'}); });
    const listed=rows.filter(x=>x.listed), active=listed.filter(x=>x.days>0);
    const chartDays=opts.kind==='today' ? daysIn(addDays(today,-6), today) : days;
    const perDay=chartDays.map(d=>({d, n:rows.filter(x=>x.rec && x.rec.d[d] && x.rec.d[d].n>0).length}));
    const offices=[...new Set([].concat(opts.offices||[], ...listed.map(x=>x.offices)))].filter(Boolean);
    const byOffice=offices.map(o=>{ const at=listed.filter(x=>x.offices.indexOf(o)>=0); return {o, total:at.length, active:at.filter(x=>x.days>0).length}; })
      .filter(r=>r.total).sort((a,b)=>(b.active/b.total)-(a.active/a.total) || b.total-a.total);
    const secs={};
    rows.forEach(x=>{ if(!x.rec) return; const seen=new Set(); days.forEach(d=>{ const e=x.rec.d[d]; if(e && e.p) Object.keys(e.p).forEach(k=>seen.add(k)); }); seen.forEach(k=>{ secs[k]=(secs[k]||0)+1; }); });
    const bySection=Object.keys(secs).map(k=>({k, n:secs[k]})).sort((a,b)=>b.n-a.n);
    const firstEver=list.map(x=>x.rec && x.rec.first).filter(Boolean).sort()[0]||'';
    return {from:p.from, to:p.to, days:days.length, rows, perDay, byOffice, bySection, firstEver,
      total:listed.length, active:active.length, adoption:listed.length ? active.length/listed.length : null,
      today:listed.filter(x=>x.rec && x.rec.d[today] && x.rec.d[today].n>0).length,
      avgDays:active.length ? active.reduce((a,x)=>a+x.days,0)/active.length : null,
      never:listed.filter(x=>!x.rec).length};
  }

  /* ---------- reading every record ---------- */
  function load(){
    const S=global.PH_STORE; if(!S) return Promise.resolve([]);
    if(global.PH && PH.isLive && PH.isLive()) return S.getAll('ph_use_').then(o=>Object.keys(o||{}).map(k=>o[k]));
    const keys=[]; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.indexOf('ph_use_')===0) keys.push(k); } }catch(_){}
    return Promise.all(keys.map(k=>S.get(k).catch(()=>null)));
  }

  /* ---------- looks ---------- */
  let CSS=false;
  function styles(){
    if(CSS) return; CSS=true;
    const s=document.createElement('style');
    s.textContent=`
    .use-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 14px}
    .use-top .chip{border:1px solid var(--line,#E4E8EE);background:#fff;border-radius:99px;padding:6px 13px;font:inherit;font-size:13px;font-weight:700;color:var(--soft,#56627A);cursor:pointer}
    .use-top .chip.on{background:var(--navy,#0F2A4A);border-color:var(--navy,#0F2A4A);color:#fff}
    .use-top label{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--soft,#56627A);cursor:pointer}
    .use-since{font-size:12.5px;color:var(--soft,#56627A);margin:-6px 0 14px}
    .use-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}
    @media (max-width:520px){ .use-tile{padding:13px 14px} .use-tile .v{font-size:28px} }
    .use-tile{background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:var(--radius,14px);box-shadow:var(--shadow,none);padding:16px 18px}
    .use-tile .k{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--soft,#56627A)}
    .use-tile .v{font-size:34px;font-weight:800;color:var(--navy,#0F2A4A);line-height:1.15;margin-top:4px;font-variant-numeric:tabular-nums}
    .use-tile .s{font-size:13px;color:var(--soft,#56627A);margin-top:2px}
    .use-tile button.s{border:0;background:none;padding:0;font:inherit;font-size:13px;color:var(--teal-600,#0F827E);font-weight:700;cursor:pointer;text-decoration:underline}
    .use-meter{height:6px;border-radius:99px;background:var(--line,#E4E8EE);margin-top:10px;overflow:hidden}
    .use-meter i{display:block;height:100%;border-radius:99px;background:var(--teal,#149B96)}
    .use-card{background:#fff;border:1px solid var(--line,#E4E8EE);border-radius:var(--radius,14px);box-shadow:var(--shadow,none);padding:16px 18px;margin-bottom:14px}
    .use-card h3{margin:0 0 2px;font-size:15px;color:var(--navy,#0F2A4A)}
    .use-card .sub{margin:0 0 12px;font-size:12.5px;color:var(--soft,#56627A)}
    .use-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    @media (max-width:760px){ .use-two{grid-template-columns:1fr} }
    .use-two .use-card{margin-bottom:0}
    .use-chart{display:flex;align-items:flex-end;gap:2px;height:140px;padding-top:6px;border-bottom:1px solid var(--line,#E4E8EE);position:relative}
    .use-chart .b{flex:1 1 0;min-width:2px;display:flex;align-items:flex-end;height:100%;cursor:default;outline:none}
    .use-chart .b i{display:block;width:100%;max-width:26px;margin:0 auto;background:var(--teal,#149B96);border-radius:4px 4px 0 0;min-height:2px}
    .use-chart .b.zero i{background:var(--line,#E4E8EE)}
    .use-chart .b:hover i,.use-chart .b:focus i{background:var(--teal-600,#0F827E)}
    .use-chart .ymax{position:absolute;left:0;top:-2px;font-size:11px;color:var(--soft,#56627A);background:#fff;padding-right:4px}
    .use-x{display:flex;justify-content:space-between;font-size:11.5px;color:var(--soft,#56627A);margin-top:4px}
    .use-bars{display:flex;flex-direction:column;gap:9px}
    .use-bar{display:grid;grid-template-columns:minmax(80px,120px) 1fr auto;align-items:center;gap:10px;font-size:13px}
    .use-bar .t{height:8px;border-radius:99px;background:var(--line,#E4E8EE);overflow:hidden}
    .use-bar .t i{display:block;height:100%;background:var(--teal,#149B96);border-radius:99px}
    .use-bar .n{font-variant-numeric:tabular-nums;color:var(--soft,#56627A);white-space:nowrap}
    .use-bar .n b{color:var(--navy,#0F2A4A)}
    .use-tbl{width:100%;border-collapse:collapse;font-size:13.5px;min-width:620px}
    .use-tbl th{font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--soft,#56627A);text-align:left;padding:9px 10px;border-bottom:1px solid var(--line,#E4E8EE);background:#fafbfc}
    .use-tbl td{padding:9px 10px;border-bottom:1px solid var(--line,#E4E8EE);vertical-align:middle}
    .use-tbl td.n{text-align:right;font-variant-numeric:tabular-nums}.use-tbl th.n{text-align:right}
    .use-tbl tr:last-child td{border-bottom:0}
    .use-wrap{overflow-x:auto}
    .use-pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:700;white-space:nowrap}
    .use-pill.using{background:var(--good-soft,#E7F4EE);color:#1d6b46}
    .use-pill.quiet{background:#FFF4DC;color:#8a5a00}
    .use-pill.never{background:var(--bad-soft,#FBEAE7);color:#9a2f1e}
    .use-pill.off{background:#eef2f7;color:#56627A}
    .use-tip{position:fixed;z-index:9500;background:var(--navy,#0F2A4A);color:#fff;font-size:12.5px;font-weight:600;padding:6px 10px;border-radius:8px;pointer-events:none;white-space:nowrap}
    .use-empty{font-size:13.5px;color:var(--soft,#56627A);padding:6px 0}
    .use-me{font-size:13px;color:var(--soft,#56627A);margin:4px 2px 0}
    .use-me button{border:0;background:none;padding:0;margin-left:4px;font:inherit;font-size:13px;color:var(--teal-600,#0F827E);font-weight:700;cursor:pointer;text-decoration:underline}`;
    document.head.appendChild(s);
  }
  const fmtDay=s=>{ const d=parseDay(String(s).slice(0,10)); return d ? d.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'}) : ''; };
  const fmtShort=s=>{ const d=parseDay(String(s).slice(0,10)); return d ? d.toLocaleDateString([], {month:'short', day:'numeric'}) : ''; };
  function lastSeen(iso, today){
    if(!iso) return '—';
    const day=isoDay(new Date(iso)); if(day===today) return 'Today';
    if(day===addDays(today,-1)) return 'Yesterday';
    return fmtShort(day);
  }
  const secName=k=>{ const n=((global.PH && PH.NAV)||[]).find(x=>x.k===k); return n ? String(n.n).replace(/^[^A-Za-z]+/,'') : (k==='other' ? 'Other' : k.charAt(0).toUpperCase()+k.slice(1)); };
  const pct=x=>x==null ? '—' : Math.round(x*100)+'%';

  /* ---------- the page ---------- */
  let KIND='30d', ADMINS=false, WHO='all', LAST='', DATA=null;
  function mountAdmin(host, opts){
    styles();
    let el=host.querySelector(':scope > .use-admin');
    if(!el){ host.innerHTML='<div class="use-admin"><div class="use-empty">Loading usage…</div></div>'; el=host.firstChild; LAST=''; }
    const force=!!(opts && opts.force);
    if(el._busy && !force) return;
    el._busy=true;
    load().then(recs=>{ el._busy=false; if(!el.isConnected) return; const sig=JSON.stringify(recs);
        if(!force && sig===LAST && el.querySelector('.use-tiles')) return; LAST=sig; DATA=recs; paint(el); },
      e=>{ el._busy=false; if(!el.isConnected || el.querySelector('.use-tiles')) return; el.innerHTML='<div class="intro">Usage couldn’t load: '+esc((e && e.message)||'SharePoint didn’t answer')+'</div>'; });
  }
  function paint(el){
    const P=global.PH||{}, today=isoDay(new Date());
    const list=people(P.rosterRows ? P.rosterRows() : [], P.rosterView ? P.rosterView() : [], DATA||[]);
    const S=summary(list, {kind:KIND, today, includeAdmins:ADMINS, offices:P.officeNames ? P.officeNames() : []});
    const label=(PERIODS.find(p=>p[0]===KIND)||[])[1]||'';
    let h='<div class="use-top" role="group" aria-label="Period">'+PERIODS.map(p=>'<button type="button" class="chip'+(KIND===p[0]?' on':'')+'" data-k="'+p[0]+'" aria-pressed="'+(KIND===p[0])+'">'+p[1]+'</button>').join('')+
      '<label><input type="checkbox" data-adm'+(ADMINS?' checked':'')+'> Include admins</label></div>';
    h+='<p class="use-since"><b>'+esc(fmtDay(S.from))+(S.from!==S.to?' – '+esc(fmtDay(S.to)):'')+'</b>'+(S.firstEver ? ' · Home-Brace has counted visits since '+esc(fmtShort(S.firstEver))+'.' : ' · Nothing counted yet - visits count from the day this went live.')+'</p>';
    h+='<div class="use-tiles">'+
      '<div class="use-tile"><div class="k">Adoption · '+esc(label)+'</div><div class="v">'+pct(S.adoption)+'</div><div class="s">'+S.active+' of '+S.total+' people used Home-Brace</div><div class="use-meter" aria-hidden="true"><i style="width:'+Math.round((S.adoption||0)*100)+'%"></i></div></div>'+
      '<div class="use-tile"><div class="k">Using it today</div><div class="v">'+S.today+'</div><div class="s">'+(S.today===1?'person':'people')+' so far today</div></div>'+
      '<div class="use-tile"><div class="k">Days used</div><div class="v">'+(S.avgDays==null?'—':(Math.round(S.avgDays*10)/10))+'</div><div class="s">'+(S.avgDays==null?'no one yet':'days each, of '+S.days+', for those using it')+'</div></div>'+
      '<div class="use-tile"><div class="k">Never signed in</div><div class="v">'+S.never+'</div>'+(S.never?'<button type="button" class="s" data-who="never">See who →</button>':'<div class="s">Everyone has been in</div>')+'</div>'+
      '</div>';
    const max=Math.max(1, ...S.perDay.map(x=>x.n));
    h+='<div class="use-card"><h3>People using it each day</h3><p class="sub">'+(KIND==='today'?'The last 7 days':'Each day of the period')+(ADMINS?'':', admins left out')+'.</p>'+
      '<div class="use-chart" role="img" aria-label="People using Home-Brace each day"><span class="ymax">'+max+'</span>'+
      S.perDay.map(x=>'<span class="b'+(x.n?'':' zero')+'" tabindex="0" data-tip="'+esc(fmtDay(x.d))+': '+x.n+' '+(x.n===1?'person':'people')+'" aria-label="'+esc(fmtDay(x.d))+': '+x.n+'"><i style="height:'+Math.max(2, Math.round(x.n/max*100))+'%"></i></span>').join('')+'</div>'+
      '<div class="use-x"><span>'+esc(fmtShort(S.perDay[0].d))+'</span>'+(S.perDay.length>2?'<span>'+esc(fmtShort(S.perDay[Math.floor(S.perDay.length/2)].d))+'</span>':'')+'<span>'+esc(fmtShort(S.perDay[S.perDay.length-1].d))+'</span></div></div>';
    h+='<div class="use-two"><div class="use-card"><h3>By office</h3><p class="sub">People on the team list who used it, '+esc(label.toLowerCase())+'.</p><div class="use-bars">'+
      (S.byOffice.length ? S.byOffice.map(r=>'<div class="use-bar"><span>'+esc(r.o)+'</span><span class="t"><i style="width:'+Math.round(r.active/r.total*100)+'%"></i></span><span class="n"><b>'+r.active+'</b> of '+r.total+' · '+pct(r.active/r.total)+'</span></div>').join('') : '<div class="use-empty">No offices on the team list.</div>')+'</div></div>'+
      '<div class="use-card"><h3>What they use</h3><p class="sub">How many people opened each section, '+esc(label.toLowerCase())+'.</p><div class="use-bars">'+
      (S.bySection.length ? S.bySection.map(r=>'<div class="use-bar"><span>'+esc(secName(r.k))+'</span><span class="t"><i style="width:'+Math.round(r.n/Math.max(1,S.bySection[0].n)*100)+'%"></i></span><span class="n"><b>'+r.n+'</b> '+(r.n===1?'person':'people')+'</span></div>').join('') : '<div class="use-empty">Nothing yet.</div>')+'</div></div></div>';
    h+='<div style="height:14px"></div>';
    const cnt={all:S.rows.length, using:S.rows.filter(x=>x.state==='using').length, quiet:S.rows.filter(x=>x.state==='quiet').length, never:S.rows.filter(x=>x.state==='never').length};
    const shown=S.rows.filter(x=>WHO==='all' || x.state===WHO).sort((a,b)=>({using:0,quiet:1,never:2}[a.state]-{using:0,quiet:1,never:2}[b.state]) || String(b.last).localeCompare(String(a.last)) || b.days-a.days || String(a.name).localeCompare(String(b.name)));
    h+='<div class="use-card"><h3>Everyone</h3><p class="sub">Who’s using it, who’s gone quiet, and who hasn’t started.</p>'+
      '<div class="use-top" role="group" aria-label="Show">'+[['all','Everyone'],['using','Using it'],['quiet','Not '+(KIND==='today'?'today':'this period')],['never','Never signed in']].map(f=>'<button type="button" class="chip'+(WHO===f[0]?' on':'')+'" data-who="'+f[0]+'" aria-pressed="'+(WHO===f[0])+'">'+f[1]+' ('+cnt[f[0]]+')</button>').join('')+'</div>'+
      '<div class="use-wrap"><table class="use-tbl"><thead><tr><th>Name</th><th>Office</th><th>Team</th><th>Last visit</th><th class="n">Days used</th><th></th></tr></thead><tbody>'+
      (shown.length ? shown.map(x=>'<tr><td><b>'+esc(x.name)+'</b>'+(x.admin?' <span class="use-pill off">Admin</span>':'')+'</td><td>'+esc(x.offices.join(', ')||'—')+'</td><td>'+(x.listed?esc(x.teams.join(', ')||'—'):'<span class="use-pill off">Not on the team list</span>')+'</td>'+
        '<td>'+esc(lastSeen(x.last, today))+'</td><td class="n">'+(x.days||'—')+'</td><td>'+
        (x.state==='using'?'<span class="use-pill using">Using it</span>':x.state==='quiet'?'<span class="use-pill quiet">Quiet</span>':'<span class="use-pill never">Never</span>')+'</td></tr>').join('')
        : '<tr><td colspan="6" class="use-empty">No one here.</td></tr>')+'</tbody></table></div></div>';
    const myEm=P.useEmail ? P.useEmail() : '', mine=myEm && (DATA||[]).find(r=>r && String(r.email||'').toLowerCase()===myEm);
    if(myEm && P.useTrackMe) h+='<p class="use-me">'+(mine && mine.off
      ? '🔕 <b>Your own visits are not recorded.</b> You’re never in these numbers, even with “Include admins” ticked. <button type="button" data-me="on">Record me again</button>'
      : 'Your own visits are recorded (you show only with “Include admins” ticked). <button type="button" data-me="off">Stop recording me</button>')+'</p>';
    el.innerHTML=h;
    el.onclick=e=>{
      const k=e.target.closest('[data-k]'); if(k){ KIND=k.dataset.k; paint(el); return; }
      const me=e.target.closest('[data-me]'); if(me){ me.disabled=true; me.textContent='Saving…';
        P.useTrackMe(me.dataset.me==='on').then(()=>mountAdmin(el.parentNode, {force:true}),
          err=>{ me.disabled=false; me.textContent='Didn’t save - try again'; }); return; }
      const w=e.target.closest('[data-who]'); if(w){ WHO=w.dataset.who; paint(el); if(w.closest('.use-tile')){ const t=el.querySelector('.use-tbl'); if(t) t.scrollIntoView({behavior:'smooth', block:'start'}); } return; }
    };
    el.onchange=e=>{ if(e.target.matches('[data-adm]')){ ADMINS=e.target.checked; paint(el); } };
    tips(el);
  }
  /* The bars say their number on hover or focus. */
  let TIP=null;
  function tips(el){
    const show=b=>{ if(!TIP){ TIP=document.createElement('div'); TIP.className='use-tip'; TIP.setAttribute('role','tooltip'); document.body.appendChild(TIP); }
      TIP.textContent=b.dataset.tip; TIP.style.display='block'; const r=b.getBoundingClientRect(), w=TIP.offsetWidth;
      TIP.style.left=Math.min(Math.max(8, r.left+r.width/2-w/2), window.innerWidth-w-8)+'px'; TIP.style.top=Math.max(8, r.top-TIP.offsetHeight-8)+'px'; };
    const hide=()=>{ if(TIP) TIP.style.display='none'; };
    el.querySelectorAll('[data-tip]').forEach(b=>{ b.onmouseenter=()=>show(b); b.onfocus=()=>show(b); b.onmouseleave=hide; b.onblur=hide; });
  }

  global.PH_USAGE={mountAdmin, _pure:{period, daysIn, people, summary, normName, keyOf}};
})(typeof window!=='undefined' ? window : globalThis);
