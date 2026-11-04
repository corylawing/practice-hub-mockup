/* FEEDBACK REPLIES (04/11/2026). Cory: "Would be nice as me as an admin can respond to these that they submit from
   Home-Brace directly" - and replies are signed "Home-Brace team" (his choice; the feedback form never names him).
   - Admin -> Feedback: every message, newest first, the conversation under it, Reply and Mark done.
   - The person: the bell says "Home-Brace team replied to your feedback" (and their phone, if they turned alerts on);
     Tour & Feedback -> My messages shows each message with the replies, and Reply sends an answer back.
   Storage (store.js): the HomeBraceFeedback list. The team's answers sit on the message itself (Replies); a person's
   answer back is a new row (ReplyTo = the first one) so the email flow sends it to us like any message. Who wrote a
   row is SharePoint's createdBy. Loaded on demand by user.js (PH.fbReady). */
(function(global){
  'use strict';
  const SEEN='ph_fb_seen', TEAM='Home-Brace team';
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const nowISO=()=>new Date().toISOString();

  /* ---------- the conversation, worked out from the rows (pure - test/fbreply.test.js) ---------- */
  function parseReplies(v){
    let o={};
    /* A column made as rich text hands it back wrapped in HTML: unwrap it first. */
    if(typeof v==='string' && /^\s*</.test(v)) v=v.replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&#58;/g,':').replace(/&#123;/g,'{').replace(/&#125;/g,'}')
      .replace(/&#(\d+);/g,(m,d)=>String.fromCharCode(+d)).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
    try{ o=typeof v==='string' ? (v ? JSON.parse(v) : {}) : (v||{}); }catch(_){ o={}; }
    return {v:1, doneAt:String(o.doneAt||''), r:Array.isArray(o.r) ? o.r.filter(x=>x && x.t && x.at) : []};
  }
  /* Details is the email body: KIND, the message, a blank line, then "From: ..." and the rest. */
  function messageOf(details){
    const s=String(details||''), nl=s.indexOf('\n'), kind=(nl<0 ? s : s.slice(0,nl)).trim(), rest=nl<0 ? '' : s.slice(nl+1);
    const cut=rest.lastIndexOf('\n\nFrom: ');
    return {kind, text:(cut<0 ? rest : rest.slice(0,cut)).trim()};
  }
  const lineOf=(details, label)=>{ const m=new RegExp('^'+label+': (.*)$','m').exec(String(details||'')); return m ? m[1].trim() : ''; };
  function sameAs(by, me){
    by=by||{}; me=me||{};
    if(me.id && by.id && me.id===by.id) return true;
    const a=String(by.email||'').toLowerCase(), b=String(me.email||'').toLowerCase();
    return !!a && a===b;
  }
  /* One conversation per first message: it, the team's replies, and the person's answers back, in time order.
     New (for the team) = the person spoke last and it isn't marked done since. */
  function threads(items){
    const byId={}; (items||[]).forEach(i=>{ byId[i.id]=i; });
    const roots=(items||[]).filter(i=>!i.ReplyTo || !byId[i.ReplyTo] || byId[i.ReplyTo].ReplyTo);
    return roots.map(root=>{
      const rep=parseReplies(root.Replies), first=messageOf(root.Details);
      const msgs=[{who:'them', at:root.at, text:first.text, id:root.id}];
      rep.r.forEach(r=>msgs.push({who:'team', at:r.at, text:r.t, by:r.by||''}));
      (items||[]).filter(i=>i!==root && i.ReplyTo===root.id).forEach(f=>msgs.push({who:'them', at:f.at, text:messageOf(f.Details).text, id:f.id}));
      msgs.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
      const lastThem=msgs.filter(m=>m.who==='them').pop(), lastTeam=msgs.filter(m=>m.who==='team').pop()||null;
      const answered=!!lastTeam && lastTeam.at>=lastThem.at, doneSince=!!rep.doneAt && rep.doneAt>=lastThem.at;
      return {id:root.id, by:root.by||{}, kind:first.kind, page:lineOf(root.Details,'Page'), offices:lineOf(root.Details,'Offices'),
              msgs, replies:rep, lastTeam, lastAt:msgs[msgs.length-1].at, isNew:!answered && !doneSince, done:doneSince};
    }).sort((a,b)=>String(b.lastAt).localeCompare(String(a.lastAt)));
  }
  /* The person's side: their conversations with a reply they haven't opened since. */
  const unread=(ths, seen)=>(ths||[]).filter(t=>t.lastTeam && t.lastTeam.at>String((seen||{})[t.id]||''));

  /* ---------- who is looking ---------- */
  function me(){
    const P=global.PH||{}, m=(P.realMe && P.realMe())||{}, prof=(P.profileOf && P.profileOf())||{};
    const email=String(m.mail || prof.mail || (P.email && m.first ? P.email(m) : '') || '').toLowerCase();
    return {email, id:prof.id||'', name:((m.first||'')+' '+(m.last||'')).trim()};
  }
  const isAdmin=()=>!!(global.PH && PH.isAdmin && PH.isAdmin(PH.realMe && PH.realMe()));
  function seen(){ try{ return JSON.parse(localStorage.getItem(SEEN))||{}; }catch(_){ return {}; } }
  function markSeen(ths){ const s=seen(); (ths||[]).forEach(t=>{ if(t.lastTeam) s[t.id]=t.lastTeam.at; }); try{ localStorage.setItem(SEEN, JSON.stringify(s)); }catch(_){} }

  /* ---------- the bell (user.js asks; 10 minutes apart unless forced) ---------- */
  let CACHE=null;
  function load(){
    if(!global.PH_STORE || !PH_STORE.feedbackItems) return Promise.resolve({items:[], cols:{replies:false, replyTo:false}});
    return Promise.all([PH_STORE.feedbackItems(), PH_STORE.feedbackColumns()]).then(([items, cols])=>(CACHE={items, cols, at:Date.now()}));
  }
  function refresh(){
    return load().then(d=>{
      const ths=threads(d.items), mine=ths.filter(t=>sameAs(t.by, me()));
      return {mine:unread(mine, seen()), fresh:isAdmin() ? ths.filter(t=>t.isNew && !sameAs(t.by, me())).length : 0};
    });
  }

  /* ---------- looks (shared by both screens) ---------- */
  let CSS=false;
  function styles(){
    if(CSS) return; CSS=true;
    const s=document.createElement('style');
    s.textContent=`
    .fbr-ov{position:fixed;inset:0;z-index:9400;background:rgba(15,42,74,.46);display:flex;align-items:center;justify-content:center;padding:18px}
    .fbr-card{width:min(560px,100%);max-height:calc(100% - 20px);display:flex;flex-direction:column;background:#fff;border-radius:18px;box-shadow:0 24px 64px rgba(15,42,74,.35);color:#1F2D3D;overflow:hidden}
    .fbr-hd{display:flex;align-items:flex-start;gap:12px;padding:18px 20px 12px;border-bottom:1px solid #eef1f5}
    .fbr-hd h3{margin:0;font-size:18px;color:#0F2A4A}.fbr-hd p{margin:3px 0 0;font-size:13px;color:#5b6b7d}
    .fbr-x{margin-left:auto;border:0;background:#f1f4f8;width:32px;height:32px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer;color:#33475b}
    .fbr-body{overflow:auto;padding:14px 20px 18px;display:flex;flex-direction:column;gap:14px}
    .fbr-list{display:flex;flex-direction:column;gap:18px}
    .fbr-th{border:1px solid #e3e8ef;border-radius:14px;padding:12px 14px;background:#fff}
    .fbr-th.new{border-color:#f0c36d;box-shadow:0 0 0 3px #fff4dc}
    .fbr-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:12.5px;color:#5b6b7d;margin-bottom:8px}
    .fbr-top b{color:#0F2A4A;font-size:14px}
    .fbr-pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:700;background:#eef2f7;color:#33475b}
    .fbr-pill.new{background:#fff1d6;color:#8a5a00}.fbr-pill.done{background:#e3f4ec;color:#1d6b46}
    .fbr-msgs{display:flex;flex-direction:column;gap:8px}
    .fbr-m{max-width:88%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}
    .fbr-m small{display:block;font-size:11.5px;font-weight:700;margin-bottom:2px;opacity:.75;white-space:normal}
    .fbr-m.them{background:#f1f4f8;align-self:flex-start}
    .fbr-m.team{background:#e2f3f2;align-self:flex-end;color:#0b4f4c}
    .fbr-reply{display:flex;flex-direction:column;gap:8px;margin-top:10px}
    .fbr-reply textarea{width:100%;box-sizing:border-box;min-height:70px;resize:vertical;border:1px solid #cfd8e3;border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;color:#1F2D3D}
    .fbr-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .fbr-btn{border:0;border-radius:10px;padding:8px 14px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;background:#149B96;color:#fff}
    .fbr-btn.ghost{background:#fff;color:#0F2A4A;border:1px solid #cfd8e3}
    .fbr-btn[disabled]{opacity:.55;cursor:default}
    .fbr-note{font-size:13px;line-height:1.5;border-radius:12px;padding:10px 12px;background:#eef6ff;color:#1d4f80}
    .fbr-note.warn{background:#fff6e5;color:#7a4b00}
    .fbr-empty{font-size:14px;color:#5b6b7d;padding:8px 2px}
    .fbr-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
    .fbr-filters button{border:1px solid #cfd8e3;background:#fff;border-radius:99px;padding:6px 13px;font:inherit;font-size:13px;font-weight:700;color:#33475b;cursor:pointer}
    .fbr-filters button.on{background:#0F2A4A;border-color:#0F2A4A;color:#fff}
    .fbr-err{color:#9a2f1e;font-size:13px;font-weight:700}
    .fbr-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#0F2A4A;color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;font-weight:700;z-index:9500;box-shadow:0 10px 30px rgba(15,42,74,.3)}
    @media (max-width:520px){ .fbr-ov{padding:0;align-items:stretch} .fbr-card{border-radius:0;max-height:none;height:100%} .fbr-m{max-width:96%} }`;
    document.head.appendChild(s);
  }
  function toast(t){ const d=document.createElement('div'); d.className='fbr-toast'; d.setAttribute('role','status'); d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(), 2800); }
  const when=iso=>{ try{ return new Date(iso).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}); }catch(_){ return String(iso||''); } };
  const kindPill=k=>{ const t=/WRONG/.test(k) ? '🐞 Something’s wrong' : /IDEA/.test(k) ? '💡 Idea' : /QUESTION/.test(k) ? '❓ Question' : '💬 Feedback'; return '<span class="fbr-pill">'+t+'</span>'; };
  function msgsHTML(t, side){
    return '<div class="fbr-msgs">'+t.msgs.map(m=>'<div class="fbr-m '+m.who+'"><small>'+
      esc(m.who==='team' ? TEAM : (side==='admin' ? (t.by.name||t.by.email||'Them') : 'You'))+' · '+esc(when(m.at))+'</small>'+esc(m.text)+'</div>').join('')+'</div>';
  }
  const setupNote='<div class="fbr-note warn"><b>Replies need a 5-minute setup in SharePoint.</b> On the HomeBraceFeedback list, add two columns: '+
    '<b>Replies</b> (Multiple lines of text, plain text) and <b>ReplyTo</b> (Single line of text). Messages can be read meanwhile.</div>';

  /* ---------- Admin -> Feedback ---------- */
  let FILTER='new';
  function mountAdmin(el){
    styles();
    el.innerHTML='<div class="fbr-empty">Loading feedback…</div>';
    load().then(d=>paintAdmin(el, d), e=>{ el.innerHTML='<div class="fbr-note warn">Feedback couldn’t load: '+esc((e && e.message)||'SharePoint didn’t answer')+'</div>'; });
  }
  function paintAdmin(el, d){
    const all=threads(d.items), n={new:all.filter(t=>t.isNew).length, done:all.filter(t=>t.done).length, all:all.length};
    const shown=all.filter(t=>FILTER==='all' || (FILTER==='new' ? t.isNew : FILTER==='done' ? t.done : true));
    let h='<p style="margin:0 0 12px;font-size:14px;color:#5b6b7d">What people sent with <b>Tour &amp; Feedback</b>. Reply here: they see it in their bell (and on their phone if they turned alerts on), signed <b>'+TEAM+'</b>. Their answer back comes here, and to your email like before.</p>';
    if(!d.cols.replies || !d.cols.replyTo) h+=setupNote;
    h+='<div class="fbr-filters" role="group" aria-label="Show">'+[['new','New'],['all','All'],['done','Done']].map(f=>'<button type="button" data-f="'+f[0]+'" class="'+(FILTER===f[0]?'on':'')+'" aria-pressed="'+(FILTER===f[0])+'">'+f[1]+' ('+n[f[0]]+')</button>').join('')+
      '<button type="button" data-re="1" style="margin-left:auto">↻ Refresh</button></div>';
    h+=shown.length ? '<div class="fbr-list">'+shown.map(t=>'<div class="fbr-th'+(t.isNew?' new':'')+'" data-t="'+esc(t.id)+'"><div class="fbr-top"><b>'+esc(t.by.name||t.by.email||'Someone')+'</b>'+
        (t.offices?'<span>'+esc(t.offices)+'</span>':'')+(t.page?'<span>· '+esc(t.page)+'</span>':'')+kindPill(t.kind)+
        (t.isNew?'<span class="fbr-pill new">New</span>':t.done?'<span class="fbr-pill done">Done</span>':'<span class="fbr-pill">Replied</span>')+'</div>'+
        msgsHTML(t,'admin')+
        '<div class="fbr-reply"><textarea maxlength="4000" placeholder="Reply as '+TEAM+'…" aria-label="Reply to '+esc(t.by.name||'them')+'"'+(d.cols.replies?'':' disabled')+'></textarea>'+
        '<div class="fbr-row"><button type="button" class="fbr-btn" data-send="'+esc(t.id)+'" disabled>Send reply</button>'+
        (d.cols.replies ? '<button type="button" class="fbr-btn ghost" data-done="'+esc(t.id)+'">'+(t.done?'Reopen':'Mark done')+'</button>' : '')+
        '<span class="fbr-err"></span></div></div></div>').join('')+'</div>'
      : '<div class="fbr-empty">'+(FILTER==='new' ? 'Nothing new - you’re all caught up.' : 'Nothing here yet.')+'</div>';
    h+='<p style="margin:14px 2px 0;font-size:12.5px;color:#8291a3">Everyone’s messages show here, for Home-Brace admins. Staff only ever see their own, under My messages.</p>';
    el.innerHTML=h;
    el.onclick=e=>{
      const f=e.target.closest('[data-f]'); if(f){ FILTER=f.dataset.f; paintAdmin(el, d); return; }
      if(e.target.closest('[data-re]')){ mountAdmin(el); return; }
      const s=e.target.closest('[data-send]'); if(s){ sendReply(el, d, s); return; }
      const dn=e.target.closest('[data-done]'); if(dn){ markDone(el, d, dn); return; }
    };
    el.oninput=e=>{ const ta=e.target.closest('.fbr-reply textarea'); if(!ta) return; const b=ta.parentNode.querySelector('[data-send]'); if(b) b.disabled=!ta.value.trim(); };
  }
  function sendReply(el, d, btn){
    const box=btn.closest('.fbr-reply'), ta=box.querySelector('textarea'), err=box.querySelector('.fbr-err'), text=ta.value.trim(), id=btn.dataset.send;
    if(!text) return;
    btn.disabled=true; btn.textContent='Sending…'; err.textContent='';
    const t=threads(d.items).find(x=>x.id===id);
    PH_STORE.feedbackReplies(id, cur=>{ const r=parseReplies(cur); r.r.push({at:nowISO(), t:text.slice(0,4000), by:me().email}); return r; }).then(()=>{
      toast('Sent - they’ll see it in their bell');
      if(t && t.by.email) phone([t.by.email], id);
      mountAdmin(el);
    }, e=>{ btn.disabled=false; btn.textContent='Send reply'; err.textContent=(e && e.needsSetup) ? 'Needs the SharePoint setup above first.' : 'Not sent: '+((e && e.message)||'SharePoint didn’t answer')+' - your reply is still here.'; });
  }
  function markDone(el, d, btn){
    const id=btn.dataset.done, t=threads(d.items).find(x=>x.id===id), reopen=!!(t && t.done);
    btn.disabled=true;
    PH_STORE.feedbackReplies(id, cur=>{ const r=parseReplies(cur); r.doneAt=reopen ? '' : nowISO(); return r; }).then(()=>{ toast(reopen ? 'Back in New' : 'Marked done'); mountAdmin(el); },
      e=>{ btn.disabled=false; const er=btn.parentNode.querySelector('.fbr-err'); if(er) er.textContent='Not saved: '+((e && e.message)||'SharePoint didn’t answer'); });
  }
  /* Their phone, if they turned alerts on - no words of the reply on a lock screen, just that there is one. */
  function phone(emails, id){
    try{ if(!PH.alertsReady) return;
      PH.alertsReady().then(A=>{ if(!A || !A.ON) return; return A.sendTo(emails, {title:TEAM+' replied to your feedback', body:'Open Home-Brace to read it.', url:A.here('home.html')+'#myfeedback', tag:'hb-fb-'+id}); }).catch(()=>{});
    }catch(_){}
  }

  /* ---------- the person: My messages ---------- */
  function openMine(){
    styles();
    if(document.querySelector('.fbr-ov')) return;
    const ov=document.createElement('div'); ov.className='fbr-ov'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','My messages');
    ov.innerHTML='<div class="fbr-card"><div class="fbr-hd"><div><h3>My messages</h3><p>What you sent with Send Feedback, and our replies.</p></div><button type="button" class="fbr-x" aria-label="Close">×</button></div><div class="fbr-body"><div class="fbr-empty">Loading…</div></div></div>';
    document.body.appendChild(ov);
    const body=ov.querySelector('.fbr-body'), close=()=>{ ov.remove(); document.removeEventListener('keydown', key, true); };
    const key=e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } };
    document.addEventListener('keydown', key, true);
    ov.querySelector('.fbr-x').onclick=close;
    ov.addEventListener('click', e=>{ if(e.target===ov && !ov.querySelector('textarea:not(:placeholder-shown)')) close(); });
    const paint=()=>load().then(d=>{
      const mine=threads(d.items).filter(t=>sameAs(t.by, me())), unseen=unread(mine, seen()).map(t=>t.id);
      body.innerHTML=mine.length ? mine.map(t=>'<div class="fbr-th'+(unseen.indexOf(t.id)>=0?' new':'')+'"><div class="fbr-top">'+kindPill(t.kind)+(t.page?'<span>'+esc(t.page)+'</span>':'')+
          (unseen.indexOf(t.id)>=0?'<span class="fbr-pill new">New reply</span>':'')+'</div>'+msgsHTML(t,'mine')+
          (t.lastTeam && d.cols.replyTo ? '<div class="fbr-reply"><textarea maxlength="4000" placeholder="Answer back…" aria-label="Answer back"></textarea><div class="fbr-row"><button type="button" class="fbr-btn" data-back="'+esc(t.id)+'" disabled>Send</button><span class="fbr-err"></span></div></div>' : '')+
          '</div>').join('')
        : '<div class="fbr-empty">Nothing yet. When you send feedback (Tour &amp; Feedback → Send Feedback), it and our replies show up here.</div>';
      markSeen(mine);
      try{ document.dispatchEvent(new CustomEvent('ph-fb-changed')); }catch(_){}
    }, e=>{ body.innerHTML='<div class="fbr-note warn">Your messages couldn’t load: '+esc((e && e.message)||'SharePoint didn’t answer')+'</div>'; });
    body.oninput=e=>{ const ta=e.target.closest('textarea'); if(!ta) return; const b=ta.parentNode.querySelector('[data-back]'); if(b) b.disabled=!ta.value.trim(); };
    body.onclick=e=>{
      const b=e.target.closest('[data-back]'); if(!b) return;
      const box=b.closest('.fbr-reply'), ta=box.querySelector('textarea'), err=box.querySelector('.fbr-err'), text=ta.value.trim(); if(!text) return;
      b.disabled=true; b.textContent='Sending…'; err.textContent='';
      const row=PH.feedbackText(PH.feedbackContext(), '', text);
      row.Title=row.Title.replace(/^Feedback: /, 'Reply: ');
      row.Details=row.Details.replace(/^FEEDBACK\n/, 'REPLY\n');
      row.ReplyTo=String(b.dataset.back);
      PH_STORE.addFeedback(row).then(()=>{ toast('Sent ✓'); paint(); }, er=>{ b.disabled=false; b.textContent='Send'; err.textContent='Not sent - check your connection and try again.'; });
    };
    paint();
  }

  global.PH_FBR={refresh, openMine, mountAdmin, TEAM,
    _pure:{parseReplies, messageOf, lineOf, sameAs, threads, unread}};
})(typeof window!=='undefined' ? window : globalThis);
