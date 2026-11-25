/* CELEBRATIONS ON HOME - birthdays and work anniversaries (Jordan 18/11/2026: "I like lets do that right away awesome
   animated motion art celebration put in sandbox to show Morgan example").
   WHERE THE DATES COME FROM (Jordan 18/11: "Maybe something the admin can do in profile set up for birthday and start
   date (it should be hidden to other users)"): an ADMIN sets them in Admin -> People, in a part only admins see.
   One shared record  ph_celebrate  {v:1, p:{<email>:{bday:'MM-DD', started:'YYYY-MM-DD', name, first, office, role,
   no:{bday:true, anniv:true}}}}. The birthday is only the day and month - the YEAR IS NEVER ASKED OR KEPT, so nobody's
   age is anywhere. The dates are shown nowhere else (not on profiles, not on the Team page) - only the celebration on
   the day and the week's "coming up". Each person can switch either celebration off for themselves in My profile (no).
   WHEN: today; on a Monday also Saturday and Sunday (the offices were shut); "coming up" = the next 7 days.
   29 February is celebrated on the 28th in a year without one.
   THE ART: pure canvas + CSS, no libraries - balloons, confetti, sparkles; fireworks and a gold count-up of the years
   for an anniversary. Jordan 18/11: "The persons birthday or workaversary ... should be extra special animated on their
   home-brace, others should have a nice animated which catches their eye": IT'S YOUR DAY = the full show opens by itself
   when you open Home (once a day per device; bigger - waves of balloons, confetti and fireworks; a cake whose candles you
   tap to blow out, or a gold count-up of your years). EVERYONE ELSE = an eye-catching animated card on Home (shimmer,
   floating balloons, a pulsing Celebrate button) - it never takes over their screen; they tap it to watch.
   Still (no motion) for anyone who asks their computer for less motion.
   WORDS (Jordan 18/11: "In American English they now call it Workiversary"): a work anniversary is a WORKIVERSARY
   everywhere people read it. Live switch: user.js PARTY_LIVE (PH.partyOn). */
(function(global){
  'use strict';
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const DIM=[31,29,31,30,31,30,31,31,30,31,30,31];
  const leap=y=>(y%4===0 && y%100!==0) || y%400===0;
  /* ---------- the rules (node-testable) ---------- */
  function cleanBday(s){ const m=/^(\d{2})-(\d{2})$/.exec(String(s||'')); if(!m) return ''; const mo=+m[1], d=+m[2];
    return mo>=1 && mo<=12 && d>=1 && d<=DIM[mo-1] ? m[1]+'-'+m[2] : ''; }
  function cleanStart(s){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||'')); if(!m) return ''; const y=+m[1], mo=+m[2], d=+m[3];
    if(y<1950 || y>2100 || mo<1 || mo>12 || d<1 || d>(mo===2 && !leap(y) ? 28 : DIM[mo-1])) return ''; return m[0]; }
  function dayIn(y, mmdd){ let mo=+mmdd.slice(0,2), d=+mmdd.slice(3,5); if(mo===2 && d===29 && !leap(y)) d=28; return new Date(y, mo-1, d); }
  /* the shared record, cleaned: only what a celebration needs */
  const s120=(x,n)=>typeof x==='string' ? x.trim().slice(0,n||120) : '';
  function cleanRecord(rec){
    const out={v:1, p:{}}, p=rec && typeof rec==='object' && rec.p && typeof rec.p==='object' ? rec.p : {};
    Object.keys(p).slice(0,1000).forEach(k=>{ const e=String(k).toLowerCase().trim(); if(!/^[^\s@]+@[^\s@]+$/.test(e)) return; const x=p[k]||{};
      const o={bday:cleanBday(x.bday), started:cleanStart(x.started), name:s120(x.name), first:s120(x.first,60), office:s120(x.office), role:s120(x.role)};
      const no=x.no && typeof x.no==='object' ? x.no : {}; if(no.bday===true || no.anniv===true) o.no={bday:no.bday===true, anniv:no.anniv===true};
      const sn=x.seen && typeof x.seen==='object' ? x.seen : {}; const seen={}; ['bday','anniv'].forEach(k=>{ if(cleanStart(sn[k])) seen[k]=sn[k]; }); if(seen.bday||seen.anniv) o.seen=seen;
      if(o.bday || o.started || o.no) out.p[e]=o; });
    return out;
  }
  /* the record -> people to celebrate. roster (optional): today's names and offices win over the ones saved with the
     dates; photoFor(email) -> a photo. */
  function peopleFrom(rec, roster, photoFor){
    const r=cleanRecord(rec), by={}; (roster||[]).forEach(x=>{ if(x && x.email) by[String(x.email).toLowerCase()]=x; });
    return Object.keys(r.p).map(e=>{ const x=r.p[e], ro=by[e]||{}, nm=ro.name||x.name; if(!nm) return null;
      return {email:e, name:nm, first:x.first||String(nm).split(' ')[0], office:(ro.offices&&ro.offices[0])||ro.loc||x.office, role:ro.role||x.role,
        photo:photoFor ? photoFor(e) : '', bday:x.bday, bdayOn:!!x.bday && !(x.no&&x.no.bday), started:(x.no&&x.no.anniv) ? '' : x.started, seen:x.seen||null}; }).filter(Boolean);
  }
  /* people: [{email, name, first, office, role, photo, bday, bdayOn, started}] -> {today:[...], soon:[...]} */
  function celebrations(people, now){
    now=now ? new Date(now) : new Date(); const t0=new Date(now.getFullYear(), now.getMonth(), now.getDate()), Y=t0.getFullYear();
    const diff=d=>Math.round((d-t0)/864e5), out={today:[], soon:[], recent:[]}, monday=t0.getDay()===1;
    const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    (people||[]).forEach(p=>{
      if(!p || !p.name) return; const ev=[];
      const b=p.bdayOn===true ? cleanBday(p.bday) : '';
      if(b) [Y-1, Y, Y+1].forEach(y=>ev.push({kind:'bday', d:dayIn(y, b)}));
      const s=cleanStart(p.started);
      if(s){ const sy=+s.slice(0,4); [Y-1, Y, Y+1].forEach(y=>{ if(y-sy>=1) ev.push({kind:'anniv', d:dayIn(y, s.slice(5)), years:y-sy}); }); }
      ev.forEach(e=>{ const n=diff(e.d); if(n<-7 || n>7) return;          // a belated one: a week at most (Jordan 18/11)
        const it={kind:e.kind, years:e.years||0, in:n, on:iso(e.d), seen:!!(p.seen && p.seen[e.kind]===iso(e.d)), day:DAYS[e.d.getDay()], date:e.d.getDate()+' '+MONTHS[e.d.getMonth()].slice(0,3),
          email:String(p.email||''), name:String(p.name), first:String(p.first||String(p.name).split(' ')[0]), office:String(p.office||''), role:String(p.role||''), photo:p.photo||''};
        if(n===0 || (monday && n>=-2 && n<0)) out.today.push(it); else if(n>0) out.soon.push(it); else out.recent.push(it); });
    });
    out.today.sort((a,b)=>b.in-a.in || a.name.localeCompare(b.name));
    out.soon.sort((a,b)=>a.in-b.in || a.name.localeCompare(b.name));
    out.recent.sort((a,b)=>b.in-a.in || a.name.localeCompare(b.name));
    return out;
  }
  const yearsWord=n=>n+' year'+(n===1?'':'s');
  function headline(it){ const late=it.belated ? 'belated ' : '';
    return it.kind==='bday' ? 'Happy '+late+'birthday, '+it.first+'!' : 'Happy '+late+ordinal(it.years)+' Workiversary, '+it.first+'!'; }
  /* "We celebrated you on Tuesday" - "a week ago" on the 7th day (the same weekday as today would read oddly) */
  function whenWas(it){ return it.in>=-6 ? 'on '+it.day : 'a week ago'; }
  function ordinal(n){ const s=n%100>=11 && n%100<=13 ? 'th' : ({1:'st',2:'nd',3:'rd'})[n%10]||'th'; return n+s; }
  function wishText(it){ return it.kind==='bday' ? 'Happy birthday, '+it.first+'! 🎂🎉' : 'Happy '+ordinal(it.years)+' Workiversary, '+it.first+'! Thank you for everything 🎉'; }
  /* THE SANDBOX'S STORY for Morgan (made-up people, dates around today so there is always something to see) */
  function demo(now){
    now=now ? new Date(now) : new Date(); const md=n=>{ const d=new Date(now.getFullYear(), now.getMonth(), now.getDate()+n); return String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
    const st=(n, yrs)=>{ const d=new Date(now.getFullYear()-yrs, now.getMonth(), now.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
    return {v:1, p:{
      'avery.alder@example.com':{name:'Avery Alder', first:'Avery', office:'Cedar Grove', role:'Clinical Assistant', bday:md(0), started:st(40,2)},
      'dana.dorsey@example.com':{name:'Dana Dorsey', first:'Dana', office:'Lakeview', role:'Office Manager', started:st(0,5)},
      'maya.mercer@example.com':{name:'Maya Mercer', first:'Maya', office:'Westfield', role:'Treatment Coordinator', bday:md(2)},
      'jules.jensen@example.com':{name:'Jules Jensen', first:'Jules', office:'Brookside', role:'Financial Coordinator', started:st(5,1)},
      'rory.ramsey@example.com':{name:'Rory Ramsey', first:'Rory', office:'Hillcrest', role:'Clinical Assistant', bday:md(-3)},
      'theo.tran@example.com':{name:'Theo Tran', first:'Theo', office:'Northpoint', role:'Clinical Assistant', bday:md(6)}}};
  }
  /* MORGAN'S "Hire Dates and Birthdays" EXCEL (18/11/2026: "Birthday and Hire Date, if it says original hire date you can
     use those instead of the hire date that was when the practice was purchased"). Read in the ADMIN'S browser only
     (Admin -> People), never kept in the code. One tab, a section per office: a label row ("Cedar Grove Office"), a header
     row (Employee Name | Date of Hire | Birthday | Actual/Original Hire Date), then people. Found BY LABELS. A birthday is
     words ("March 14th") - only the month and day are kept, whatever else is written. The start date: the actual /
     original hire date when there is one; a bare year there ("2015") is not a date - the person is listed to fill in. */
  const MON3=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const xlDate=v=>{ if(typeof v==='number' && v>20000 && v<80000){ const d=new Date(Math.round((v-25569)*864e5)); return {y:d.getUTCFullYear(), m:d.getUTCMonth()+1, d:d.getUTCDate()}; }
    if(v instanceof Date && !isNaN(v)) return {y:v.getFullYear(), m:v.getMonth()+1, d:v.getDate()};
    const s=String(v==null?'':v).trim(); let m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if(m) return {y:+m[1], m:+m[2], d:+m[3]};
    m=/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s); if(m) return {y:+m[3]<100 ? 2000+(+m[3]) : +m[3], m:+m[1], d:+m[2]}; return null; };
  const p2=n=>String(n).padStart(2,'0');
  function parseBday(v){
    const x=xlDate(v); if(x) return cleanBday(p2(x.m)+'-'+p2(x.d));
    const s=String(v==null?'':v).toLowerCase().trim(); let m=/^([a-z]+)\.?\s+(\d{1,2})(st|nd|rd|th)?\b/.exec(s);
    if(m){ const i=MON3.indexOf(m[1].slice(0,3)); return i<0 ? '' : cleanBday(p2(i+1)+'-'+p2(+m[2])); }
    m=/^(\d{1,2})\/(\d{1,2})$/.exec(s); return m ? cleanBday(p2(+m[1])+'-'+p2(+m[2])) : '';
  }
  function parseStart(v){ const x=xlDate(v); return x ? cleanStart(x.y+'-'+p2(x.m)+'-'+p2(x.d)) : ''; }
  function fromHireSheet(cells){
    cells=cells||{}; const at=(c,r)=>{ const x=cells[String.fromCharCode(64+c)+r]; return x ? x.v : undefined; }, txt=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
    let maxR=0; Object.keys(cells).forEach(k=>{ const r=+(/\d+$/.exec(k)||[0])[0]; if(r>maxR) maxR=r; });
    const out=[]; let cols=null, section='';
    for(let r=1;r<=Math.min(maxR, 2000);r++){
      const a=txt(at(1,r)), heads=[1,2,3,4,5,6].map(c=>txt(at(c,r)).toLowerCase());
      if(heads.some(h=>/hire/.test(h)) && heads.some(h=>/birth/.test(h))){
        cols={}; heads.forEach((h,i)=>{ const c=i+1; if(/name/.test(h)) cols.name=c; else if(/(actual|original).*hire|hire.*(actual|original)/.test(h)) cols.orig=c; else if(/hire/.test(h)) cols.hire=c; else if(/birth/.test(h)) cols.bday=c; });
        continue; }
      if(a && [2,3,4].every(c=>at(c,r)==null || txt(at(c,r))==='')){ section=a.replace(/\s+office$/i,'').trim(); continue; }
      if(!cols || !cols.name || !a) continue;
      const row={name:txt(at(cols.name,r)).slice(0,120), section, bday:'', started:'', from:'', notes:[]};
      if(!row.name) continue;
      const bv=cols.bday ? at(cols.bday,r) : null; row.bday=parseBday(bv); if(bv!=null && txt(bv) && !row.bday) row.notes.push('Birthday not understood');
      const ov=cols.orig ? at(cols.orig,r) : null, hv=cols.hire ? at(cols.hire,r) : null;
      const o=ov!=null && txt(ov) ? parseStart(ov) : '';
      if(o){ row.started=o; row.from='original'; }
      else { row.started=hv!=null && txt(hv) ? parseStart(hv) : ''; row.from=row.started ? 'hire' : '';
        if(ov!=null && txt(ov)) row.notes.push(/^\d{4}$/.test(txt(ov)) ? 'Original hire is only a year ('+txt(ov)+') — type the full date in Admin → People' : 'Original hire date not understood'); }
      if(!row.started && !(ov!=null && txt(ov))) row.notes.push(hv!=null && txt(hv) ? 'Hire date not understood' : 'No hire date');
      out.push(row);
    }
    return out;
  }
  /* a name from the sheet -> one person in Home-Brace (their email), or '' when none or more than one could be them.
     "Alexis (Tess) Easton" matches "Alexis Easton" or "Tess Easton"; case, accents and punctuation ignored. */
  const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  function nameKeys(n){ n=fold(n); const nick=(/\(([^)]+)\)/.exec(n)||[])[1]||''; const base=n.replace(/\([^)]*\)/g,' ').replace(/[^a-z\s'-]/g,' ').replace(/\s+/g,' ').trim();
    const t=base.split(' ').filter(Boolean); if(!t.length) return []; const last=t[t.length-1], keys=[t[0]+' '+last];
    nick.split(/[\s,/]+/).filter(Boolean).forEach(k=>keys.push(k.replace(/[^a-z'-]/g,'')+' '+last)); return keys; }
  function matchPerson(name, roster){
    const want=nameKeys(name); if(!want.length) return '';
    const hits=(roster||[]).filter(p=>p && p.email && nameKeys(p.name).some(k=>want.indexOf(k)>=0));
    const emails=[...new Set(hits.map(p=>String(p.email).toLowerCase()))]; return emails.length===1 ? emails[0] : '';
  }
  const RULES={cleanBday, cleanStart, dayIn, celebrations, cleanRecord, peopleFrom, demo, headline, whenWas, ordinal, wishText, yearsWord, parseBday, parseStart, fromHireSheet, matchPerson, KEY:'ph_celebrate'};
  if(typeof window==='undefined'){ global.PH_PARTY=RULES; return; }


  /* ---------- the motion art (Jordan 18/11: "I was expecting both to be more modern wow motion art") ----------
     One canvas behind a frosted-glass card: a slow AURORA of light (four drifting blobs, added together), BOKEH orbs at
     different depths, LIGHT TRAILS (ribbons, fireworks, comets leave streaks that fade), a SHOCKWAVE ring on open.
     Birthday: glossy 3D balloons + flowing ribbons; your own day: a glowing flame to blow out -> smoke -> light burst.
     Anniversary: a ring of light orbiting the gold number + fireworks with trails. Everything still for "less motion". */
  const RM=!!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const THEMES={
    bday: {aur:['#FF4D8D','#7C5CFF','#22D3EE','#FFB547'], fx:['#FF7AB6','#B49CFF','#5EEAD4','#FFD27A','#FFFFFF'], bal:['#FF6FA8','#9B7BFF','#36D1E0','#FFC15E','#FF8A65']},
    anniv:{aur:['#FFB547','#F59E0B','#22D3EE','#A78BFA'], fx:['#FFE29A','#FFC15E','#FFFFFF','#7DE3F0','#FF9FC6'], bal:['#FFC15E','#FFE29A','#36D1E0']}};
  const rnd=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];
  const rgba=(hex,a)=>{ const n=parseInt(hex.slice(1),16); return 'rgba('+(n>>16)+','+(n>>8&255)+','+(n&255)+','+a+')'; };
  function mix(hex, amt){ const n=parseInt(hex.slice(1),16); let r=n>>16, g=n>>8&255, b=n&255;
    const t=amt<0?0:255, p=Math.abs(amt); r=Math.round(r+(t-r)*p); g=Math.round(g+(t-g)*p); b=Math.round(b+(t-b)*p); return 'rgb('+r+','+g+','+b+')'; }
  let cv=null, cx=null, raf=0, P=[], start=0, kind='bday', BIG=false, W=0, H=0, TH=THEMES.bday, CARD=null, last=0, prev=0;
  /* SPEED (Jordan 18/11: "it should move a bit quicker its like everything is in slow mo"): every movement is multiplied by
     K = the time since the last frame (a dropped frame no longer slows the show) x PACE (faster than before). The aurora
     is CSS now (the graphics card), the glow dots are drawn once and stamped - so frames aren't dropped in the first place. */
  const PACE=1.15; let K=PACE; const damp=f=>Math.pow(f, K);
  const SPRITES={};
  function sprite(c){ if(SPRITES[c]) return SPRITES[c]; const s=document.createElement('canvas'); s.width=s.height=64; const g=s.getContext('2d'), r=g.createRadialGradient(32,32,0,32,32,32);
    r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(0.25, rgba(c.length===7?c:'#ffffff',0.9)); r.addColorStop(1, rgba(c.length===7?c:'#ffffff',0)); g.fillStyle=r; g.fillRect(0,0,64,64); return (SPRITES[c]=s); }
  function size(){ if(!cv) return; const d=Math.min(1.5, window.devicePixelRatio||1); W=innerWidth; H=innerHeight; cv.width=W*d; cv.height=H*d; cx.setTransform(d,0,0,d,0,0); }
  const centre=()=>{ const r=CARD ? CARD.getBoundingClientRect() : null; return r ? {x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height} : {x:W/2, y:H/2, w:400, h:400}; };
  /* --- the parts --- */
  function orb(){ const z=rnd(0.25,1); return {t:'o', x:rnd(0,W), y:rnd(0,H), z, r:rnd(2,9)*z+1, c:pick(TH.fx), vy:-rnd(0.15,0.6)*z, ph:rnd(0,6.3), tw:rnd(1,3)}; }
  function drawOrb(p, t){ p.y+=p.vy*K; p.x+=Math.sin(t*0.9+p.ph)*0.3*p.z*K; if(p.y<-20){ p.y=H+20; p.x=rnd(0,W); }
    const a=(0.35+0.35*Math.sin(t*p.tw*1.4+p.ph))*p.z, R=p.r*3.2; cx.globalAlpha=Math.max(0, Math.min(1, a)); cx.drawImage(sprite(p.c), p.x-R, p.y-R, R*2, R*2); cx.globalAlpha=1; }
  function balloon(delay){ const z=rnd(0.45,1), r=rnd(26,42)*z; return {t:'b', x:rnd(r, W-r), y:H+r*1.2+rnd(0,H*0.25), r, z, c:pick(TH.bal), vy:rnd(1.1,1.9)*z, amp:rnd(8,22), f:rnd(0.5,1.1), ph:rnd(0,6.3), delay:delay||0}; }
  function drawBalloon(b, t){
    const sw=Math.sin(t*b.f+b.ph), x=b.x+sw*b.amp, y=b.y, r=b.r;
    cx.save(); cx.globalAlpha=0.55+0.45*b.z;
    cx.strokeStyle='rgba(255,255,255,.35)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(x, y+r*1.1);
    cx.bezierCurveTo(x+Math.sin(t*2+b.ph)*8, y+r*1.7, x-Math.sin(t*1.6+b.ph)*8, y+r*2.3, x+Math.sin(t*1.2+b.ph)*5, y+r*3.1); cx.stroke();
    cx.translate(x, y); cx.rotate(sw*0.07);
    const g=cx.createRadialGradient(-r*0.3, -r*0.42, r*0.05, 0, 0, r*1.15);           // glossy body
    g.addColorStop(0, mix(b.c,0.7)); g.addColorStop(0.35, b.c); g.addColorStop(0.85, mix(b.c,-0.35)); g.addColorStop(1, mix(b.c,-0.5));
    cx.fillStyle=g; cx.beginPath(); cx.ellipse(0, 0, r*0.86, r*1.04, 0, 0, Math.PI*2); cx.fill();
    const rim=cx.createRadialGradient(r*0.35, r*0.45, r*0.1, r*0.2, r*0.3, r*0.9);          // rim light, lower right
    rim.addColorStop(0, 'rgba(255,255,255,.28)'); rim.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle=rim; cx.fill();
    cx.fillStyle='rgba(255,255,255,.75)'; cx.beginPath(); cx.ellipse(-r*0.32, -r*0.48, r*0.12, r*0.22, -0.5, 0, Math.PI*2); cx.fill();
    cx.fillStyle='rgba(255,255,255,.35)'; cx.beginPath(); cx.ellipse(-r*0.08, -r*0.72, r*0.05, r*0.07, 0, 0, Math.PI*2); cx.fill();
    cx.fillStyle=mix(b.c,-0.3); cx.beginPath(); cx.moveTo(-r*0.1, r*1.02); cx.lineTo(r*0.1, r*1.02); cx.lineTo(0, r*0.92); cx.closePath(); cx.fill();
    cx.restore();
  }
  function ribbon(x, y){ const a=rnd(-Math.PI*0.95, -Math.PI*0.05), v=rnd(5,12);
    return {t:'rb', x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, c:pick(TH.fx.slice(0,4)), w:rnd(3,6), ph:rnd(0,6.3), trail:[], life:rnd(260,360)}; }
  function drawRibbon(p, t){
    p.vx*=damp(0.985); p.vy=p.vy*damp(0.985)+0.11*K; p.x+=(p.vx+Math.sin(t*4+p.ph)*1.4)*K; p.y+=p.vy*K; p.life-=K;
    p.trail.push({x:p.x, y:p.y}); if(p.trail.length>16) p.trail.shift();
    const a=Math.max(0, Math.min(1, p.life/80));
    for(let i=1;i<p.trail.length;i++){ const k=i/p.trail.length; cx.strokeStyle=rgba(p.c.length===7?p.c:'#ffffff', a*k); cx.lineWidth=p.w*k*(0.6+0.4*Math.sin(t*6+p.ph+i*0.6));
      cx.lineCap='round'; cx.beginPath(); cx.moveTo(p.trail[i-1].x, p.trail[i-1].y); cx.lineTo(p.trail[i].x, p.trail[i].y); cx.stroke(); }
    return p.life>0 && p.y<H+40;
  }
  function rocket(x){ return {t:'r', x:x==null?rnd(W*0.12,W*0.88):x, y:H+10, vx:rnd(-0.6,0.6), vy:-rnd(10,13.5), ty:rnd(H*0.1,H*0.42), c:pick(TH.fx), trail:[]}; }
  function burst(x, y, c, n){ n=n||90; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+rnd(-0.05,0.05), v=rnd(2.5,6.5)*(Math.random()<0.15?1.35:1);
    P.push({t:'s', x, y, px:x, py:y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, c:Math.random()<0.25?'#FFFFFF':c, life:rnd(60,100), max:100}); }
    P.push({t:'w', x, y, r:4, life:28, c}); }
  function shock(x, y){ P.push({t:'w', x, y, r:20, life:42, c:'#FFFFFF', big:true}); }
  function orbitRing(){ const n=140; for(let i=0;i<n;i++) P.push({t:'ob', a:i/n*Math.PI*2, sp:rnd(0.35,0.55), off:rnd(-6,6), s:rnd(1,2.6), c:pick(['#FFE29A','#FFC15E','#FFFFFF','#FFD27A'])}); }
  function drawOrbit(p, t, C){ const a=p.a+t*p.sp*0.8, rx=Math.min(W*0.46, C.w*0.78), ry=Math.min(H*0.2, C.h*0.32), tilt=-0.18;
    const ex=Math.cos(a)*(rx+p.off), ey=Math.sin(a)*(ry+p.off*0.4), x=C.x+ex*Math.cos(tilt)-ey*Math.sin(tilt), y=C.y+ex*Math.sin(tilt)+ey*Math.cos(tilt);
    const depth=(Math.sin(a)+1)/2, al=(0.25+0.75*depth)*Math.min(1, t/0.8);
    const g=cx.createRadialGradient(x,y,0,x,y,p.s*4); g.addColorStop(0, rgba(p.c,al)); g.addColorStop(1, rgba(p.c,0)); cx.fillStyle=g; cx.beginPath(); cx.arc(x,y,p.s*4,0,Math.PI*2); cx.fill(); }
  function comet(){ const fromL=Math.random()<0.5; return {t:'cm', x:fromL?-40:W+40, y:rnd(H*0.05,H*0.5), vx:(fromL?1:-1)*rnd(9,14), vy:rnd(2,4), c:pick(TH.fx), trail:[]}; }
  function smoke(x, y){ for(let i=0;i<26;i++) P.push({t:'sm', x:x+rnd(-4,4), y:y+rnd(-4,4), vx:rnd(-0.5,0.5), vy:-rnd(0.6,1.6), r:rnd(4,8), g:rnd(0.25,0.55), life:rnd(70,120), max:120, ph:rnd(0,6.3)}); }
  /* --- the frame --- */
  function frame(now){
    const t=(now-start)/1000, C=centre(); last=t;
    K=Math.min(3, Math.max(0.5, (now-(prev||now-16.7))/16.7))*PACE; prev=now;
    cx.globalCompositeOperation='source-over'; cx.clearRect(0,0,W,H);
    if((kind==='anniv' || BIG) && t<(BIG?11:8) && Math.random()<(BIG?0.05:0.035)) P.push(rocket());
    if(t<12 && Math.random()<0.008) P.push(comet());
    if(kind==='bday' && t<8 && Math.random()<0.06) P.push(ribbon(rnd(W*0.1, W*0.9), H+10));
    const keep=[];
    for(const p of P){
      let alive=true;
      if(p.t==='o') drawOrb(p, t);
      else if(p.t==='b'){ if(t<p.delay){ keep.push(p); continue; } p.y-=p.vy*K*(1+t*0.03); drawBalloon(p, t*1.3); if(p.y<-p.r*4){ if(t<12) Object.assign(p, balloon(0)); else alive=false; } }
      else if(p.t==='rb'){ cx.globalCompositeOperation='lighter'; alive=drawRibbon(p, t); cx.globalCompositeOperation='source-over'; }
      else if(p.t==='r'){ p.x+=p.vx*K; p.y+=p.vy*K; p.vy*=damp(0.986); p.trail.push({x:p.x, y:p.y}); if(p.trail.length>14) p.trail.shift();
        cx.globalCompositeOperation='lighter'; for(let i=1;i<p.trail.length;i++){ const k=i/p.trail.length; cx.strokeStyle=rgba(p.c.length===7?p.c:'#ffffff', k*0.9); cx.lineWidth=2.6*k; cx.beginPath(); cx.moveTo(p.trail[i-1].x,p.trail[i-1].y); cx.lineTo(p.trail[i].x,p.trail[i].y); cx.stroke(); }
        cx.globalCompositeOperation='source-over'; if(p.y<=p.ty){ burst(p.x, p.y, p.c); alive=false; } }
      else if(p.t==='s'){ p.px=p.x; p.py=p.y; p.vx*=damp(0.965); p.vy=p.vy*damp(0.965)+0.055*K; p.x+=p.vx*K; p.y+=p.vy*K; p.life-=K; const a=Math.max(0, p.life/p.max);
        cx.globalCompositeOperation='lighter'; cx.strokeStyle=rgba(p.c.length===7?p.c:'#ffffff', a); cx.lineWidth=1.6+a*1.4; cx.lineCap='round';
        cx.beginPath(); cx.moveTo(p.px-(p.vx*3), p.py-(p.vy*3)); cx.lineTo(p.x, p.y); cx.stroke(); cx.globalCompositeOperation='source-over'; alive=p.life>0; }
      else if(p.t==='w'){ p.r+=(p.big?18:6)*K; p.life-=K; const a=p.life/(p.big?42:28); cx.strokeStyle=rgba(p.c.length===7?p.c:'#ffffff', a*(p.big?0.5:0.7)); cx.lineWidth=p.big?3:2; cx.beginPath(); cx.arc(p.x,p.y,p.r,0,Math.PI*2); cx.stroke(); alive=p.life>0; }
      else if(p.t==='ob'){ cx.globalCompositeOperation='lighter'; drawOrbit(p, t, C); cx.globalCompositeOperation='source-over'; }
      else if(p.t==='cm'){ p.x+=p.vx*K; p.y+=p.vy*K; p.trail.push({x:p.x,y:p.y}); if(p.trail.length>22) p.trail.shift(); cx.globalCompositeOperation='lighter';
        for(let i=1;i<p.trail.length;i++){ const k=i/p.trail.length; cx.strokeStyle=rgba(p.c.length===7?p.c:'#ffffff', k*0.7); cx.lineWidth=3*k; cx.beginPath(); cx.moveTo(p.trail[i-1].x,p.trail[i-1].y); cx.lineTo(p.trail[i].x,p.trail[i].y); cx.stroke(); }
        cx.globalCompositeOperation='source-over'; alive=p.x>-60 && p.x<W+60 && p.y<H+60; }
      else if(p.t==='sm'){ p.x+=(p.vx+Math.sin(t*2.6+p.ph)*0.4)*K; p.y+=p.vy*K; p.r+=0.35*K; p.life-=K; const a=p.g*p.life/p.max; const g=cx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
        g.addColorStop(0,'rgba(220,226,235,'+a+')'); g.addColorStop(1,'rgba(220,226,235,0)'); cx.fillStyle=g; cx.beginPath(); cx.arc(p.x,p.y,p.r,0,Math.PI*2); cx.fill(); alive=p.life>0; }
      if(alive) keep.push(p);
    }
    P=keep;
    raf=requestAnimationFrame(frame);                                   // the aurora keeps breathing while it's open
  }
  function play(k, big){
    if(RM || !cv) return; cancelAnimationFrame(raf); P=[]; kind=k; BIG=!!big; TH=THEMES[k]||THEMES.bday; size(); start=performance.now(); prev=0;
    const ov=document.getElementById('ph-party'); if(ov) ov.dataset.k=k;
    for(let i=0;i<(big?50:36);i++) P.push(orb());
    const C=centre(); shock(C.x, C.y);
    if(k==='bday'){ for(let i=0;i<(big?18:12);i++) P.push(balloon(0.2+i*0.18)); for(let i=0;i<(big?30:22);i++) P.push(ribbon(rnd(W*0.1,W*0.9), H+10)); }
    else { orbitRing(); for(let i=0;i<3;i++) setTimeout(()=>{ if(cv){ const c2=centre(); burst(c2.x+rnd(-c2.w,c2.w), c2.y+rnd(-c2.h*0.7,-c2.h*0.2), pick(TH.fx)); } }, 260+i*390); }
    if(big){ setTimeout(()=>{ if(cv) for(let i=0;i<4;i++) P.push(rocket(W*(0.2+i*0.2))); }, 600); }
    raf=requestAnimationFrame(frame);
  }
  /* one candle out: a puff of smoke. The last one: a burst of light. */
  function puff(x, y){ if(RM || !cv) return; for(let i=0;i<10;i++) P.push({t:'sm', x:x+rnd(-2,2), y:y+rnd(-2,2), vx:rnd(-0.35,0.35), vy:-rnd(0.5,1.3), r:rnd(2.5,5), g:rnd(0.3,0.55), life:rnd(60,100), max:100, ph:rnd(0,6.3)}); }
  function pop(x, y){ if(RM || !cv) return; burst(x, y-20, '#FFD27A', 130); shock(x, y-20); for(let i=0;i<34;i++) P.push(ribbon(x+rnd(-60,60), y)); for(let i=0;i<4;i++) P.push(rocket(W*(0.2+i*0.2))); }

  /* ---------- the overlay ---------- */
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function css(){
    if(document.getElementById('pp-css')) return; const st=document.createElement('style'); st.id='pp-css'; st.textContent=
    '#ph-party{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at 50% 45%,#122544 0%,#070F1E 70%);animation:pp-in .45s ease-out;overflow:hidden}'+
    '#ph-party canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}'+
    '.pp-aur{position:absolute;inset:0;pointer-events:none;overflow:hidden}'+
    '.pp-aur i{position:absolute;width:70vmax;height:70vmax;border-radius:50%;filter:blur(40px);opacity:.55;mix-blend-mode:screen;will-change:transform}'+
    '.pp-aur i:nth-child(1){left:-20vmax;top:-25vmax;background:radial-gradient(circle,#FF4D8D,transparent 65%);animation:pp-a1 9s ease-in-out infinite alternate}'+
    '.pp-aur i:nth-child(2){right:-25vmax;top:-20vmax;background:radial-gradient(circle,#7C5CFF,transparent 65%);animation:pp-a2 11s ease-in-out infinite alternate}'+
    '.pp-aur i:nth-child(3){left:-10vmax;bottom:-35vmax;background:radial-gradient(circle,#22D3EE,transparent 65%);animation:pp-a3 10s ease-in-out infinite alternate}'+
    '.pp-aur i:nth-child(4){right:-15vmax;bottom:-30vmax;background:radial-gradient(circle,#FFB547,transparent 65%);animation:pp-a1 12s ease-in-out infinite alternate-reverse}'+
    '#ph-party[data-k="anniv"] .pp-aur i:nth-child(1){background:radial-gradient(circle,#FFB547,transparent 65%)}#ph-party[data-k="anniv"] .pp-aur i:nth-child(2){background:radial-gradient(circle,#F59E0B,transparent 65%)}#ph-party[data-k="anniv"] .pp-aur i:nth-child(4){background:radial-gradient(circle,#A78BFA,transparent 65%)}'+
    '@keyframes pp-a1{to{transform:translate(18vmax,14vmax) scale(1.15)}}@keyframes pp-a2{to{transform:translate(-16vmax,18vmax) scale(.9)}}@keyframes pp-a3{to{transform:translate(20vmax,-14vmax) scale(1.2)}}'+
    '.pp-card{position:relative;max-width:460px;width:100%;border-radius:28px;padding:34px 28px 24px;text-align:center;color:#fff;'+
      'background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.22);'+
      'backdrop-filter:blur(14px) saturate(150%);-webkit-backdrop-filter:blur(14px) saturate(150%);'+
      'box-shadow:0 40px 120px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.25);animation:pp-pop .78s cubic-bezier(.16,1.3,.3,1) both;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'+
    '.pp-card::before{content:"";position:absolute;inset:-1px;border-radius:28px;padding:1px;background:linear-gradient(120deg,rgba(255,255,255,.6),rgba(255,255,255,0) 40%,rgba(255,255,255,0) 60%,rgba(255,255,255,.45));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}'+
    '.pp-av{position:relative;width:112px;height:112px;margin:-92px auto 14px}'+
    '.pp-av .ring{position:absolute;inset:-6px;border-radius:50%;background:conic-gradient(from 0deg,#FF4D8D,#FFB547,#22D3EE,#7C5CFF,#FF4D8D);animation:pp-spin 2.6s linear infinite;filter:drop-shadow(0 0 18px rgba(124,92,255,.7))}'+
    '.pp-av .ring::after{content:"";position:absolute;inset:4px;border-radius:50%;background:#0d1b33}'+
    '.pp-av .face{position:absolute;inset:0;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:36px;color:#fff;background:linear-gradient(135deg,#FF4D8D,#7C5CFF)}'+
    '.pp-av .face img{width:100%;height:100%;object-fit:cover}'+
    '.pp-av .badge{position:absolute;right:-8px;bottom:-4px;font-size:36px;animation:pp-bob 1.8s ease-in-out infinite;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}'+
    '.pp-kick{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#fff;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2)}'+
    '.pp-pre{margin-top:14px;font-size:15px;font-weight:600;letter-spacing:.02em;color:rgba(255,255,255,.8)}'+
    '.pp-title{margin:2px 0 6px;font-size:46px;line-height:1.05;font-weight:900;letter-spacing:-.02em;perspective:600px;text-wrap:balance}'+
    '.pp-title span{display:inline-block;background:linear-gradient(90deg,#fff 0%,#FFE1F0 20%,#FFD27A 40%,#fff 55%,#A5F3FC 75%,#fff 100%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;'+
      'animation:pp-letter .78s cubic-bezier(.16,1.3,.3,1) both,pp-sheen 3.5s linear infinite;transform-origin:50% 100%}'+
    '.pp-sub{font-size:14px;color:rgba(255,255,255,.72);max-width:340px;margin:0 auto}'+
    '.pp-years{position:relative;margin:10px auto 0;width:220px;height:170px;display:flex;align-items:center;justify-content:center}'+
    '.pp-years::before{content:"";position:absolute;inset:-30px;border-radius:50%;background:conic-gradient(from 0deg,rgba(255,210,122,0) 0deg,rgba(255,210,122,.35) 20deg,rgba(255,210,122,0) 40deg,rgba(255,210,122,0) 90deg,rgba(255,210,122,.3) 110deg,rgba(255,210,122,0) 130deg,rgba(255,210,122,0) 180deg,rgba(255,210,122,.35) 200deg,rgba(255,210,122,0) 220deg,rgba(255,210,122,0) 270deg,rgba(255,210,122,.3) 290deg,rgba(255,210,122,0) 310deg);animation:pp-spin 12s linear infinite;filter:blur(2px);-webkit-mask:radial-gradient(circle,#000 25%,transparent 70%);mask:radial-gradient(circle,#000 25%,transparent 70%)}'+
    '.pp-years b{position:relative;font-size:150px;line-height:1;font-weight:900;letter-spacing:-.04em;background:linear-gradient(180deg,#FFF6D6 0%,#FFD27A 35%,#F59E0B 70%,#B45309 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 30px rgba(245,158,11,.55));animation:pp-glow 2.4s ease-in-out infinite}'+
    '.pp-years b::after{content:attr(data-n);position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.9) 50%,transparent 65%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:pp-sweep 2.8s ease-in-out infinite}'+
    '.pp-ylab{font-size:14px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#FFD27A;margin-top:-8px}'+
    '.pp-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:22px}'+
    '.pp-btn{border:0;border-radius:14px;padding:12px 18px;font:inherit;font-weight:800;font-size:14.5px;cursor:pointer;color:#0a1426;background:linear-gradient(135deg,#FFFFFF,#E8F7F6);box-shadow:0 8px 24px rgba(0,0,0,.25);transition:transform .15s}'+
    '.pp-btn:hover{transform:translateY(-1px)}.pp-btn.g{color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);box-shadow:none}.pp-btn.g:hover{background:rgba(255,255,255,.18)}'+
    '.pp-btn:focus-visible{outline:3px solid #5EEAD4;outline-offset:2px}'+
    '.pp-dots{display:flex;gap:6px;justify-content:center;margin-top:14px}.pp-dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.3)}.pp-dots i.on{background:#fff;box-shadow:0 0 10px #fff}'+
    /* your own birthday: a glossy layered cake, five candles to blow out one by one */
    '.pp-cake{position:relative;width:200px;height:190px;margin:10px auto 0}'+
    '.pp-cake .glow{position:absolute;left:50%;top:-10px;width:240px;height:150px;margin-left:-120px;border-radius:50%;background:radial-gradient(ellipse,rgba(255,200,90,.45),rgba(255,140,60,.12) 45%,rgba(255,140,60,0) 72%);animation:pp-halo 1.6s ease-in-out infinite;transition:opacity .6s;pointer-events:none}'+
    '.pp-cake.done .glow{opacity:0}'+
    '.pp-cake .tier{position:absolute;left:50%;transform:translateX(-50%);border-radius:14px 14px 10px 10px;overflow:hidden;box-shadow:inset 0 -10px 18px rgba(0,0,0,.18),inset 0 8px 14px rgba(255,255,255,.35),0 10px 24px rgba(0,0,0,.25)}'+
    '.pp-cake .t2{bottom:78px;width:118px;height:42px;background:linear-gradient(180deg,#D9C8FF,#9B7BFF 70%,#7C5CFF)}'+
    '.pp-cake .t1{bottom:16px;width:176px;height:64px;background:linear-gradient(180deg,#FFC2DA,#FF6FA8 65%,#E0457F)}'+
    '.pp-cake .drip{position:absolute;left:0;right:0;top:0;height:18px;background:radial-gradient(circle at 10px 8px,#fff 9px,transparent 10px) 0 0/22px 18px repeat-x,linear-gradient(#fff,#fff) 0 0/100% 8px no-repeat;filter:drop-shadow(0 2px 2px rgba(0,0,0,.12))}'+
    '.pp-cake .t1 i{position:absolute;width:7px;height:3px;border-radius:2px;opacity:.95}'+
    '.pp-cake .plate{position:absolute;left:50%;bottom:4px;width:206px;height:16px;margin-left:-103px;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.15));border:1px solid rgba(255,255,255,.4)}'+
    '.pp-cake .cand{position:absolute;bottom:118px;width:22px;height:70px;padding:0;border:0;background:none;cursor:pointer;border-radius:8px}'+
    '.pp-cake .cand:focus-visible{outline:2px solid #5EEAD4;outline-offset:3px}'+
    '.pp-cake .stick{position:absolute;left:50%;bottom:0;width:9px;height:36px;margin-left:-4.5px;border-radius:3px;background:repeating-linear-gradient(-45deg,#fff 0 4px,#5EEAD4 4px 8px);box-shadow:0 2px 6px rgba(0,0,0,.25)}'+
    '.pp-cake .stick::before{content:"";position:absolute;left:50%;top:-6px;width:2px;height:7px;margin-left:-1px;background:#3b2a1a;border-radius:1px}'+
    '.pp-cake .fl{position:absolute;left:50%;bottom:40px;width:16px;height:27px;margin-left:-8px;border-radius:50% 50% 45% 45%/65% 65% 35% 35%;background:radial-gradient(ellipse at 50% 78%,#fff 0 18%,#FFE9A8 30%,#FFB547 55%,rgba(255,90,40,.85) 80%,rgba(255,90,40,0) 100%);filter:drop-shadow(0 0 10px rgba(255,180,80,.95));transform-origin:50% 100%;animation:pp-flicker .95s ease-in-out infinite}'+
    '.pp-cake .cand:hover .fl{filter:drop-shadow(0 0 16px rgba(255,200,100,1))}'+
    '.pp-cake .cand.out .fl{animation:pp-blow .52s cubic-bezier(.4,0,.7,1) forwards}'+
    '.pp-cake .cand.out .stick::before{animation:pp-ember 1.8s ease-out forwards}'+
    '.pp-cake .smk{position:absolute;left:50%;bottom:36px;width:34px;height:110px;margin-left:-17px;opacity:0;overflow:visible;pointer-events:none}'+
    '.pp-cake .smk path{fill:none;stroke:rgba(228,233,242,.8);stroke-width:3.4;stroke-linecap:round;stroke-dasharray:170;stroke-dashoffset:170;filter:blur(1.1px)}'+
    '.pp-cake .smk path.b{stroke:rgba(210,218,232,.55);stroke-width:2.2;filter:blur(1.6px)}'+
    '.pp-cake .cand.out .smk{animation:pp-smk 2.4s ease-out .2s forwards}'+
    '.pp-cake .cand.out .smk path{animation:pp-draw 2.1s ease-out .2s forwards}.pp-cake .cand.out .smk path.b{animation-delay:.38s}'+
    '@keyframes pp-blow{0%{transform:none;opacity:1}25%{transform:rotate(-28deg) skewX(-18deg) scale(1.05,.85) translateX(-2px)}55%{transform:rotate(-48deg) skewX(-26deg) scale(.55,.4) translateX(-4px);opacity:.8}100%{transform:rotate(-55deg) scale(0);opacity:0}}'+
    '@keyframes pp-ember{0%{background:#FF8A3D;box-shadow:0 0 8px 2px rgba(255,138,61,.9)}60%{background:#C2410C;box-shadow:0 0 4px 1px rgba(255,138,61,.4)}100%{background:#3b2a1a;box-shadow:none}}'+
    '@keyframes pp-smk{0%{opacity:0;transform:translateY(4px) scaleX(.6)}12%{opacity:.95}70%{opacity:.5}100%{opacity:0;transform:translateY(-46px) scaleX(1.5)}}'+
    '@keyframes pp-draw{to{stroke-dashoffset:0}}'+
    '.pp-make{margin:16px 0 0;font-size:26px;font-weight:900;letter-spacing:.01em;background:linear-gradient(100deg,#B45309 0%,#F59E0B 18%,#FFF3C4 34%,#FFD27A 50%,#F59E0B 66%,#FFF3C4 82%,#B45309 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 14px rgba(255,200,90,.55));animation:pp-gold 3s linear infinite,pp-goldglow 2.2s ease-in-out infinite}'+
    '.pp-make.made{font-size:30px;animation:pp-gold 2s linear infinite,pp-goldglow 1.4s ease-in-out infinite,pp-pop .7s cubic-bezier(.16,1.4,.3,1)}'+
    '@keyframes pp-gold{to{background-position:-220% 0}}@keyframes pp-goldglow{0%,100%{filter:drop-shadow(0 0 10px rgba(255,200,90,.45))}50%{filter:drop-shadow(0 0 24px rgba(255,210,122,.9))}}'+
    '.pp-hint{font-size:13.5px;font-weight:600;color:rgba(255,255,255,.75);margin-top:8px;letter-spacing:.01em}'+
    /* keyframes */
    '@keyframes pp-in{from{opacity:0}to{opacity:1}}@keyframes pp-pop{from{opacity:0;transform:translateY(40px) scale(.9);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}'+
    '@keyframes pp-spin{to{transform:rotate(360deg)}}@keyframes pp-bob{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-7px) rotate(8deg)}}'+
    '@keyframes pp-letter{from{opacity:0;transform:translateY(40px) rotateX(80deg);filter:blur(8px)}to{opacity:1;transform:none;filter:blur(0)}}'+
    '@keyframes pp-sheen{to{background-position:-300% 0}}@keyframes pp-sweep{0%,30%{background-position:150% 0}100%{background-position:-100% 0}}'+
    '@keyframes pp-glow{0%,100%{filter:drop-shadow(0 6px 24px rgba(245,158,11,.45))}50%{filter:drop-shadow(0 6px 44px rgba(245,158,11,.85))}}'+
    '@keyframes pp-flicker{0%,100%{transform:scale(1,1) rotate(-2deg)}25%{transform:scale(.94,1.08) rotate(2deg)}50%{transform:scale(1.04,.95) rotate(-1deg)}75%{transform:scale(.97,1.05) rotate(1.5deg)}}'+
    '@keyframes pp-halo{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.12);opacity:1}}@keyframes pp-out{to{transform:scale(0) translateY(10px);opacity:0}}'+
    /* the Home card: a live aurora, glass tiles */
    '.pp-home{position:relative;overflow:hidden;isolation:isolate;border-radius:22px;padding:20px;margin-bottom:22px;color:#fff;background:#0b1830;box-shadow:0 18px 50px rgba(11,24,48,.35)}'+
    '.pp-home .aur{position:absolute;inset:-40%;z-index:-1;background:radial-gradient(closest-side,rgba(255,77,141,.55),transparent 70%) 10% 20%/55% 60% no-repeat,radial-gradient(closest-side,rgba(124,92,255,.55),transparent 70%) 85% 15%/55% 65% no-repeat,radial-gradient(closest-side,rgba(34,211,238,.45),transparent 70%) 60% 90%/60% 60% no-repeat,radial-gradient(closest-side,rgba(255,181,71,.45),transparent 70%) 20% 85%/50% 55% no-repeat;filter:blur(30px);animation:pp-aur 16s ease-in-out infinite alternate}'+
    '.pp-home.anniv .aur{filter:blur(30px) hue-rotate(-40deg)}'+
    '@keyframes pp-aur{0%{transform:translate(0,0) rotate(0) scale(1)}50%{transform:translate(4%,-3%) rotate(8deg) scale(1.08)}100%{transform:translate(-4%,3%) rotate(-6deg) scale(1)}}'+
    '.pp-home .bok{position:absolute;inset:0;z-index:-1;pointer-events:none}'+
    '.pp-home .bok i{position:absolute;bottom:-20px;border-radius:50%;background:radial-gradient(circle,#fff 0,rgba(255,255,255,.6) 30%,rgba(255,255,255,0) 70%);animation:pp-rise linear infinite;opacity:.7}'+
    '@keyframes pp-rise{from{transform:translateY(0)}to{transform:translateY(-320px)}}'+
    '.pp-home h2{margin:0;font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.85);display:flex;align-items:center;gap:8px}'+
    '.pp-home h2 .spark{display:inline-block;animation:pp-bob 1.8s ease-in-out infinite}'+
    '.pp-home .pp-today{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:14px}'+
    '.pp-it{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:12px 14px;border-radius:18px;padding:14px;background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.2);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}'+
    '.pp-it .mini{position:relative;width:54px;height:54px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:linear-gradient(135deg,#FF4D8D,#7C5CFF)}'+
    '.pp-it .mini::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(#FF4D8D,#FFB547,#22D3EE,#7C5CFF,#FF4D8D);z-index:-1;animation:pp-spin 3s linear infinite}'+
    '.pp-it .mini img{width:100%;height:100%;object-fit:cover;border-radius:50%}'+
    '.pp-it .tx b{display:block;font-size:17px;font-weight:800;letter-spacing:-.01em;background:linear-gradient(90deg,#fff,#FFE1F0,#FFD27A,#fff);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:pp-sheen 5s linear infinite}'+
    '.pp-it .tx span{font-size:12.5px;color:rgba(255,255,255,.7)}'+
    '.pp-it .acts{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}'+
    '.pp-it .go,.pp-it .say{border-radius:12px;padding:9px 13px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;transition:transform .15s}'+
    '.pp-it .go{border:0;color:#0a1426;background:linear-gradient(135deg,#fff,#FFE9C2);animation:pp-pulse 2.4s ease-in-out infinite}'+
    '.pp-it .say{border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff}'+
    '.pp-it .go:hover,.pp-it .say:hover{transform:translateY(-1px)}'+
    '@keyframes pp-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,233,194,.55)}60%{box-shadow:0 0 0 12px rgba(255,233,194,0)}}'+
    '.pp-soon{margin-top:14px;display:flex;gap:8px;flex-wrap:wrap}'+
    '.pp-soon span{font-size:12.5px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 12px;color:rgba(255,255,255,.85)}.pp-soon b{color:#fff}'+
    '.pp-home.mine{box-shadow:0 0 0 2px rgba(255,210,122,.6),0 22px 60px rgba(124,92,255,.45)}'+
    '.pp-home.mine h2{font-size:15px;color:#FFE29A}'+
    '.pp-demo{margin-top:12px;font-size:12px;color:rgba(255,255,255,.7)}.pp-demo button{background:none;border:0;color:#fff;text-decoration:underline;font:inherit;cursor:pointer;padding:0 4px}'+
    '@media (prefers-reduced-motion: reduce){#ph-party,.pp-card,.pp-title span,.pp-av .ring,.pp-av .badge,.pp-years b,.pp-years b::after,.pp-years::before,.pp-cake .fl,.pp-cake .glow,.pp-cake .smk,.pp-cake .smk path,.pp-make,.pp-aur i,.pp-home .aur,.pp-home .bok i,.pp-it .mini::before,.pp-it .tx b,.pp-it .go,.pp-home h2 .spark{animation:none!important}}'+
    '@media (max-width:520px){.pp-title{font-size:36px}.pp-years b{font-size:120px}.pp-card{padding:30px 18px 20px}}';
    document.head.appendChild(st);
  }
  let LIST=[], AT=0, LAST_FOCUS=null;
  function faceHTML(it){ const ini=(it.first[0]||'')+((it.name.split(' ').slice(-1)[0]||'')[0]||'');
    return it.photo ? '<img src="'+esc(it.photo)+'" alt="">' : esc(ini.toUpperCase()); }
  const letters=(txt, d0)=>String(txt).split('').map((ch,i)=>ch===' ' ? ' ' : '<span style="animation-delay:'+(d0+i*0.039).toFixed(3)+'s,0s">'+esc(ch)+'</span>').join('');
  function open(list, i){
    LIST=list||[]; AT=i||0; if(!LIST.length) return; css(); close(true);
    LAST_FOCUS=document.activeElement;
    const ov=document.createElement('div'); ov.id='ph-party'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
    ov.innerHTML='<div class="pp-aur" aria-hidden="true"><i></i><i></i><i></i><i></i></div><canvas aria-hidden="true"></canvas><div class="pp-card" id="pp-card"></div>';
    ov.addEventListener('click', e=>{ if(e.target===ov) close(); });
    document.body.appendChild(ov); cv=ov.querySelector('canvas'); cx=cv.getContext('2d'); CARD=ov.querySelector('#pp-card'); size();
    window.addEventListener('resize', size); document.addEventListener('keydown', key);
    show();
  }
  function yearsHTML(it){ return '<div class="pp-years" aria-hidden="true"><b id="pp-n" data-n="'+it.years+'">'+(RM?it.years:0)+'</b></div><div class="pp-ylab">'+(it.years===1?'year':'years')+' with us</div>'; }
  function countUp(it){ if(RM) return; const n=document.getElementById('pp-n'), t0=performance.now(), dur=950+it.years*78;
    const step=now=>{ const k=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-k,4), v=Math.round(e*it.years); if(n){ n.textContent=v; n.dataset.n=v; } if(k<1) requestAnimationFrame(step); }; setTimeout(()=>requestAnimationFrame(step), 430); }
  function show(){
    const it=LIST[AT], card=document.getElementById('pp-card'); if(!it || !card) return;
    document.getElementById('ph-party').setAttribute('aria-label', headline(it));
    card.style.animation='none'; void card.offsetWidth; card.style.animation='';
    if(it.mine){ mineCard(card, it); return; }
    const bday=it.kind==='bday', when=it.in===0 ? 'Today' : it.in<0 ? 'This weekend · '+it.day : it.day;
    card.innerHTML='<div class="pp-av"><span class="ring"></span><span class="face">'+faceHTML(it)+'</span><span class="badge" aria-hidden="true">'+(bday?'🎂':'🏆')+'</span></div>'+
      '<div class="pp-kick">'+esc(when)+' · '+(bday?'Birthday':'Workiversary')+'</div>'+
      '<div class="pp-pre">'+(bday ? 'Happy birthday' : 'Happy '+ordinal(it.years)+' Workiversary')+'</div>'+
      '<h2 class="pp-title">'+letters(it.first+'!', 0.22)+'</h2>'+
      '<div class="pp-sub">'+esc([it.role, it.office].filter(Boolean).join(' · '))+'</div>'+
      (bday ? '' : yearsHTML(it))+
      '<div class="pp-btns">'+(it.email||!(window.PH && PH.isLive && PH.isLive()) ? '<button class="pp-btn" id="pp-wish">💬 Send '+esc(it.first)+' a message</button>' : '')+
        (LIST.length>1 ? '<button class="pp-btn g" id="pp-next">Next →</button>' : '')+'<button class="pp-btn g" id="pp-close">Close</button></div>'+
      (LIST.length>1 ? '<div class="pp-dots">'+LIST.map((_,i)=>'<i class="'+(i===AT?'on':'')+'"></i>').join('')+'</div>' : '');
    const w=document.getElementById('pp-wish'); if(w) w.onclick=()=>wish(it);
    const nx=document.getElementById('pp-next'); if(nx) nx.onclick=()=>{ AT=(AT+1)%LIST.length; show(); };
    document.getElementById('pp-close').onclick=()=>close();
    (w||document.getElementById('pp-close')).focus({preventScroll:true});
    if(!bday) countUp(it);
    play(it.kind);
  }
  /* IT'S YOUR DAY - the bigger show, with something to do */
  function cakeHTML(){
    const n=5, xs=[-44,-22,0,22,44], spr=[[18,64,'#FFE29A',20],[40,74,'#5EEAD4',-30],[70,66,'#B49CFF',45],[100,76,'#FFFFFF',10],[126,64,'#FFE29A',-15],[150,72,'#5EEAD4',30],[58,88,'#FFFFFF',-40],[112,90,'#B49CFF',15],[32,96,'#FFFFFF',60],[140,94,'#FFE29A',-50]];
    return '<div class="pp-cake" id="pp-cake" role="group" aria-label="Your birthday cake - blow out the candles">'+
      '<span class="glow" aria-hidden="true"></span>'+
      xs.slice(0,n).map((x,i)=>'<button type="button" class="cand" style="left:calc(50% + '+x+'px - 11px)" aria-label="Blow out candle '+(i+1)+'"><span class="fl" style="animation-delay:-'+(i*0.23).toFixed(2)+'s"></span><span class="stick"></span>'+
        '<svg class="smk" viewBox="0 0 40 120" aria-hidden="true"><path d="M20 118 C 10 102, 30 88, 19 72 S 7 44, 23 30 S 31 10, 17 2"/><path class="b" d="M21 118 C 28 104, 12 92, 22 78 S 33 52, 18 38 S 9 16, 24 6"/></svg></button>').join('')+
      '<span class="tier t2" aria-hidden="true"><span class="drip"></span></span>'+
      '<span class="tier t1" aria-hidden="true"><span class="drip"></span>'+spr.map(p=>'<i style="left:'+p[0]+'px;top:'+(p[1]-50)+'px;background:'+p[2]+';transform:rotate('+p[3]+'deg)"></i>').join('')+'</span>'+
      '<span class="plate" aria-hidden="true"></span></div>';
  }
  function mineCard(card, it){
    const bday=it.kind==='bday';
    card.innerHTML='<div class="pp-av"><span class="ring"></span><span class="face">'+faceHTML(it)+'</span><span class="badge" aria-hidden="true">'+(bday?'🥳':'🏆')+'</span></div>'+
      '<div class="pp-kick">'+(it.belated ? '✨ We missed you on your day' : '✨ It’s your day')+'</div>'+
      '<div class="pp-pre">'+(bday ? 'Happy '+(it.belated?'belated ':'')+'birthday' : 'Happy '+(it.belated?'belated ':'')+ordinal(it.years)+' Workiversary')+'</div>'+
      '<h2 class="pp-title">'+letters(it.first+'!', 0.22)+'</h2>'+
      '<div class="pp-sub">'+(it.belated
          ? (bday ? 'Your birthday was '+whenWas(it)+' — we saved your cake 🎂' : 'Your Workiversary was '+whenWas(it)+' — thank you for '+yearsWord(it.years)+' with us 💛')
          : (bday ? 'Have a wonderful day 🎉' : 'Thank you for '+yearsWord(it.years)+' with us 💛'))+'</div>'+
      (bday ? '<div class="pp-make" id="pp-make">✨ Make a wish ✨</div>'+cakeHTML()+'<div class="pp-hint" id="pp-hint">Tap each candle to blow it out</div>' : yearsHTML(it))+
      '<div class="pp-btns">'+(LIST.length>1 ? '<button class="pp-btn g" id="pp-next">Next →</button>' : '')+'<button class="pp-btn" id="pp-close">Thank you! 💛</button></div>'+
      (LIST.length>1 ? '<div class="pp-dots">'+LIST.map((_,i)=>'<i class="'+(i===AT?'on':'')+'"></i>').join('')+'</div>' : '');
    const nx=document.getElementById('pp-next'); if(nx) nx.onclick=()=>{ AT=(AT+1)%LIST.length; show(); };
    document.getElementById('pp-close').onclick=()=>close();
    /* the cake (Jordan 18/11: "a cake with multiple candles to blow out"): each candle is blown out on its own - a puff of
       smoke - and when the last one goes out, the wish is made: a burst of light */
    const cake=document.getElementById('pp-cake');
    if(cake){ const cands=[...cake.querySelectorAll('.cand')];
      cands.forEach(b=>b.onclick=()=>{ if(b.classList.contains('out')) return; b.classList.add('out'); b.setAttribute('aria-pressed','true');
        const f=b.querySelector('.fl').getBoundingClientRect(); puff(f.left+f.width/2, f.top+f.height*0.3);
        const left=cands.filter(x=>!x.classList.contains('out')), h=document.getElementById('pp-hint');
        if(left.length){ if(h) h.textContent=left.length===1 ? 'One more…' : left.length+' to go…'; left[0].focus({preventScroll:true}); return; }
        cake.classList.add('done'); const r=cake.getBoundingClientRect(); setTimeout(()=>pop(r.left+r.width/2, r.top+r.height*0.25), 300);
        setTimeout(()=>{ const mk=document.getElementById('pp-make'); if(mk){ mk.textContent='✨ Wish made! ✨'; mk.classList.add('made'); } if(h) h.textContent='Happy '+(it.belated?'belated ':'')+'birthday, '+it.first+'!'; }, 700);
        setTimeout(()=>{ const c2=document.getElementById('pp-close'); if(c2) c2.focus({preventScroll:true}); }, 800); });
      cands[0].focus({preventScroll:true}); }
    else document.getElementById('pp-close').focus({preventScroll:true});
    if(!bday) countUp(it);
    play(it.kind, true);
  }
  /* SEND A MESSAGE (Jordan 18/11: "a reach out ... message that automatically opens a chat to that staff member for them to
     write a message"): Home-Brace Chat for anyone who has it (and the sandbox), opened on that person with a message
     ready to change and send; otherwise Teams' own chat, the same way. Nothing is ever sent by itself. */
  function chatLink(it){ return 'chat.html#to='+encodeURIComponent(it.email)+'&name='+encodeURIComponent(it.name)+'&say='+encodeURIComponent(wishText(it)); }
  function wish(it){
    const live=!!(window.PH && PH.isLive && PH.isLive()), hb=!live || !!(window.PH && PH.chatPilotMe && PH.chatPilotMe());
    if(hb){ close(true); location.href=chatLink(it); return; }
    window.open('https://teams.microsoft.com/l/chat/0/0?users='+encodeURIComponent(it.email)+'&message='+encodeURIComponent(wishText(it)), '_blank', 'noopener');
  }
  function key(e){ if(e.key==='Escape') close(); else if(e.key==='ArrowRight' && LIST.length>1){ AT=(AT+1)%LIST.length; show(); }
    else if(e.key==='Tab'){ const f=[...document.querySelectorAll('#pp-card button')]; if(!f.length) return; const i=f.indexOf(document.activeElement);
      if(e.shiftKey && i<=0){ e.preventDefault(); f[f.length-1].focus(); } else if(!e.shiftKey && i===f.length-1){ e.preventDefault(); f[0].focus(); } } }
  function close(quiet){ cancelAnimationFrame(raf); raf=0; P=[]; const ov=document.getElementById('ph-party'); if(ov) ov.remove(); cv=null; cx=null; CARD=null;
    window.removeEventListener('resize', size); document.removeEventListener('keydown', key);
    if(!quiet && LAST_FOCUS && LAST_FOCUS.focus) try{ LAST_FOCUS.focus({preventScroll:true}); }catch(_){} }
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden && raf){ cancelAnimationFrame(raf); raf=0; } else if(!document.hidden && cv && !raf && !RM){ start=performance.now()-last*1000; prev=0; raf=requestAnimationFrame(frame); } });

  /* ---------- the Home card ---------- */
  const SEEN='ph_party_seen';
  function seenToday(list){ const d=new Date().toDateString(), ids=list.map(it=>it.kind+':'+it.email+':'+it.name).join('|');
    try{ const s=JSON.parse(localStorage.getItem(SEEN)||'{}'); return s.d===d && s.ids===ids; }catch(_){ return true; } }
  function markSeen(list){ try{ localStorage.setItem(SEEN, JSON.stringify({d:new Date().toDateString(), ids:list.map(it=>it.kind+':'+it.email+':'+it.name).join('|')})); }catch(_){} }
  /* BELATED (Jordan 18/11: "should show if the user didn't log in the day of their birthday or workiversary. Lots of people
     take the Birthday off so it should come next time they log in but the message should be a bit different"): YOUR OWN
     celebration from the last 7 days (Jordan: "It shouldn't run for more than a week after their birthday") that you haven't had yet (seen - kept in the shared record, so any device counts)
     plays the next time you open Home, as "Happy belated ...". Nobody else is shown it again after the day. */
  function card(host, people, opts){
    opts=opts||{}; if(!host) return; const me=String(opts.me||'').toLowerCase(), c=celebrations(people, opts.now); css();
    const isMe=it=>!!me && it.email.toLowerCase()===me;
    c.today.forEach(it=>{ it.mine=isMe(it); if(it.mine && it.in<0) it.belated=true; }); c.today.sort((a,b)=>(b.mine-a.mine));
    const late=c.recent.filter(it=>isMe(it) && !it.seen).map(it=>Object.assign(it, {mine:true, belated:true}));
    const mineAll=late.concat(c.today.filter(it=>it.mine)), shown=late.concat(c.today);
    if(!shown.length && !c.soon.length){ host.innerHTML=''; host.hidden=true; return; }
    host.hidden=false;
    const others=c.today.filter(it=>!it.mine), onlyAnniv=shown.length && shown.every(it=>it.kind==='anniv');
    const bok=RM ? '' : '<div class="bok" aria-hidden="true">'+Array.from({length:14},(_,i)=>{ const s=3+(i*7)%9; return '<i style="left:'+((i*37)%100)+'%;width:'+s+'px;height:'+s+'px;animation-duration:'+(9+(i*5)%9)+'s;animation-delay:-'+((i*1.7)%9).toFixed(1)+'s"></i>'; }).join('')+'</div>';
    const soonTxt=it=>'<span><b>'+esc(it.day)+'</b> · '+esc(it.first)+'’s '+(it.kind==='bday' ? 'birthday 🎂' : ordinal(it.years)+' Workiversary 🏆')+'</span>';
    const item=(it,i)=>'<div class="pp-it"><span class="mini">'+faceHTML(it)+'</span>'+
        '<div class="tx"><b>'+(it.mine ? esc(headline(it))+(it.kind==='bday' ? ' 🥳' : ' 🏆')
                         : esc(it.kind==='bday' ? it.first+'’s birthday 🎂' : it.first+' · '+yearsWord(it.years)+' with us 🏆'))+'</b>'+
        '<span>'+esc(it.belated ? 'It was '+whenWas(it)+' — tap to see your celebration' : it.mine ? 'Tap to see your celebration again' : [it.in<0?it.day:'', it.role, it.office].filter(Boolean).join(' · '))+'</span></div>'+
        '<span class="acts">'+(it.mine ? '' : '<button class="say" data-w="'+i+'">💬 Send '+esc(it.first)+' a message</button>')+
        '<button class="go" data-i="'+i+'">'+(it.mine?'✨ My celebration':'🎉 Celebrate')+'</button></span></div>';
    const pastOther=opts.demo ? c.recent.find(it=>!isMe(it)) : null;
    const demoLinks=opts.demo && (others.length || pastOther) ? '<div class="pp-demo">Demo: see what '+others.map((it,i)=>'<button data-as="'+i+'">'+esc(it.first)+'</button>').join(' or ')+' sees today (it’s their day)'+
      (pastOther ? ' · or a belated one: <button data-late="1">'+esc(pastOther.first)+'</button> was off '+esc(whenWas(pastOther).replace(/^on /,''))+' and opens Home-Brace today' : '')+'</div>' : '';
    host.innerHTML='<div class="pp-home'+(mineAll.length?' mine':'')+(onlyAnniv?' anniv':'')+'"><div class="aur" aria-hidden="true"></div>'+bok+
      '<h2><span class="spark">✨</span>'+(late.length && !c.today.some(it=>it.mine) ? 'We missed you on your day!' : mineAll.length ? 'It’s your day!' : c.today.length ? 'Celebrating today' : 'Coming up this week')+'</h2>'+
      (shown.length ? '<div class="pp-today">'+shown.map(item).join('')+'</div>' : '')+
      (c.soon.length ? '<div class="pp-soon">'+(shown.length?'<span><b>Coming up</b></span>':'')+c.soon.map(soonTxt).join('')+'</div>' : '')+
      demoLinks+'</div>';
    const seenIt=list=>{ list.filter(it=>it.mine).forEach(it=>{ it.seen=true; if(opts.onSeen) try{ opts.onSeen(it); }catch(_){} }); };
    host.querySelectorAll('.go').forEach(b=>b.onclick=()=>{ seenIt([shown[+b.dataset.i]]); open(shown, +b.dataset.i); });
    host.querySelectorAll('.say').forEach(b=>b.onclick=()=>wish(shown[+b.dataset.w]));
    host.querySelectorAll('[data-as]').forEach(b=>b.onclick=()=>{ const it=others[+b.dataset.as]; open([Object.assign({}, it, {mine:true})], 0); });
    host.querySelectorAll('[data-late]').forEach(b=>b.onclick=()=>{ open([Object.assign({}, pastOther, {mine:true, belated:true})], 0); });
    /* your day (or the one you missed) opens by itself - once: not on this device today, and not if you've had it on any device */
    const auto=mineAll.filter(it=>!it.seen);
    if(auto.length && opts.auto!==false && !seenToday(auto)){ markSeen(auto); seenIt(auto); setTimeout(()=>open(auto.concat(shown.filter(it=>auto.indexOf(it)<0)), 0), 700); }
  }
  /* any page but Home (user.js partyMine): only YOUR own, today's or a missed one from the last week, once */
  function autoMine(o){
    o=o||{}; const me=String(o.me||'').toLowerCase(); if(!me) return false;
    const c=celebrations(peopleFrom(o.rec, o.roster, o.photoFor).filter(p=>p.email===me), o.now);
    const list=c.today.concat(c.recent).filter(it=>!it.seen).map(it=>Object.assign(it, {mine:true, belated:it.in<0}));
    if(!list.length || seenToday(list)) return false;
    markSeen(list); list.forEach(it=>{ if(o.onSeen) try{ o.onSeen(it); }catch(_){} }); css(); setTimeout(()=>open(list, 0), 600); return true;
  }
  global.PH_PARTY=Object.assign({}, RULES, {open, close, card, play, autoMine});
})(typeof window!=='undefined' ? window : globalThis);
