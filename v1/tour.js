/* Home-Brace V1 — guided walkthrough.
   Steps: {sel, title, body, pre?}  pre() runs first (e.g. switch a tab) then we spotlight sel.
   Options: {key, title, launch, next:{label,href}}  next = where the walkthrough continues, so
   someone can walk the whole app end to end on their own, with no one sitting beside them. */
(function(){
  const css=`
  .tour-launch{position:fixed;right:18px;bottom:18px;z-index:200;background:var(--teal,#149B96);color:#fff;border:none;
    border-radius:999px;padding:12px 18px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;
    box-shadow:0 8px 24px rgba(15,42,74,.28);display:flex;align-items:center;gap:8px}
  .tour-launch.pulse{animation:tourpulse 1.5s infinite}
  @keyframes tourpulse{0%{box-shadow:0 0 0 0 rgba(20,155,150,.5),0 8px 24px rgba(15,42,74,.28)}
    70%{box-shadow:0 0 0 18px rgba(20,155,150,0),0 8px 24px rgba(15,42,74,.28)}
    100%{box-shadow:0 0 0 0 rgba(20,155,150,0),0 8px 24px rgba(15,42,74,.28)}}
  .tour-hole{position:fixed;z-index:201;border-radius:12px;box-shadow:0 0 0 9999px rgba(15,42,74,.64);pointer-events:none;transition:all .28s ease}
  .tour-ring{position:fixed;z-index:202;border-radius:14px;border:3px solid var(--teal2,#2BC0B8);pointer-events:none;transition:all .28s ease;animation:tourring 1.3s infinite}
  @keyframes tourring{0%{box-shadow:0 0 0 0 rgba(43,192,184,.55)}70%{box-shadow:0 0 0 14px rgba(43,192,184,0)}100%{box-shadow:0 0 0 0 rgba(43,192,184,0)}}
  .tour-pop{position:fixed;z-index:203;background:#fff;border-radius:14px;box-shadow:0 16px 44px rgba(15,42,74,.4);max-width:352px;padding:18px;transition:top .28s ease,left .28s ease}
  .tour-pop h4{margin:0 0 6px;color:var(--navy,#0F2A4A);font-size:16.5px;line-height:1.3}
  .tour-pop p{margin:0 0 14px;color:#465264;font-size:14px;line-height:1.55}
  .tour-pop p b{color:var(--navy,#0F2A4A)}
  .tour-pop .trow{display:flex;align-items:center;gap:8px}
  .tour-pop .step{font-size:11.5px;color:#8a94a6;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:7px}
  .tour-pop .dots{display:flex;gap:4px;margin-bottom:9px}
  .tour-pop .dots i{width:6px;height:6px;border-radius:50%;background:#dde3ea;display:block}
  .tour-pop .dots i.on{background:var(--teal,#149B96)}
  .tour-pop .sp{flex:1}
  .tour-btn{border:none;border-radius:9px;padding:9px 15px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer}
  .tour-btn.next{background:var(--teal,#149B96);color:#fff}
  .tour-btn.next:hover{background:var(--teal-600,#0F827E)}
  .tour-btn.back{background:#fff;color:var(--navy,#0F2A4A);border:1px solid #E4E8EE}
  .tour-skip{background:none;border:none;color:#8a94a6;font-size:13px;cursor:pointer;font-family:inherit}
  .tour-skip:hover{color:#465264}
  /* The button offers two things now: the tour, and feedback (user.js draws the form). */
  .tour-menu{position:fixed;z-index:205;background:#fff;border-radius:16px;box-shadow:0 18px 48px rgba(15,42,74,.3);padding:6px;
    width:272px;max-width:calc(100vw - 28px);transform-origin:100% 100%;opacity:0;transform:translateY(8px) scale(.96);
    transition:opacity .16s ease,transform .2s cubic-bezier(.2,.9,.3,1.2);pointer-events:none}
  .tour-menu.open{opacity:1;transform:none;pointer-events:auto}
  .tour-mi{display:flex;gap:12px;align-items:center;width:100%;border:none;background:none;padding:11px 12px;border-radius:11px;
    text-align:left;font-family:inherit;cursor:pointer;color:inherit}
  .tour-mi:hover,.tour-mi:focus-visible{background:#F1F5F9;outline:none}
  .tour-mi .tmi-ic{flex:none;width:38px;height:38px;border-radius:11px;background:var(--teal-soft,#E5F4F3);display:grid;place-items:center;font-size:19px}
  .tour-mi b{display:block;color:var(--navy,#0F2A4A);font-size:14.5px;font-weight:700}
  .tour-mi small{display:block;color:#6B7A8C;font-size:12.5px;line-height:1.35;margin-top:2px}
  /* On phones the full "Show me around" pill sat on top of the content you were trying
     to read. Collapse it to a round icon button — same tap target, far less in the way. */
  @media(max-width:760px){
    .tour-pop{max-width:calc(100vw - 24px)}
    .tour-launch{right:14px;bottom:14px;width:52px;height:52px;padding:0;border-radius:50%;
      font-size:22px;justify-content:center;gap:0}
    .tour-launch .tl-txt{display:none}
  }
  `;
  const styleEl=document.createElement('style'); styleEl.textContent=css; document.head.appendChild(styleEl);

  let steps=[], i=0, hole, ring, pop, launch, menu, opts={};
  const canFeedback=()=>!!(window.PH&&PH.feedback);
  function openMenu(){
    if(!menu){
      menu=document.createElement('div'); menu.className='tour-menu'; menu.setAttribute('role','menu');
      menu.addEventListener('click',e=>{ const b=e.target.closest('.tour-mi'); if(!b) return; closeMenu();
        if(b.dataset.a==='fb') PH.feedback(); else show(0); });
      document.body.appendChild(menu);
    }
    menu.innerHTML='<button type="button" class="tour-mi" role="menuitem" data-a="tour"><span class="tmi-ic" aria-hidden="true">\u{1F44B}</span>'+
      '<span><b>'+(opts.launch||'Show me around')+'</b><small>Step by step, a minute or two</small></span></button>'+
      '<button type="button" class="tour-mi" role="menuitem" data-a="fb"><span class="tmi-ic" aria-hidden="true">\u{1F4AC}</span>'+
      '<span><b>Send Feedback</b><small>Something wrong, or an idea? Tell us.</small></span></button>';
    const r=launch.getBoundingClientRect();
    menu.style.right=Math.max(10,window.innerWidth-r.right)+'px'; menu.style.bottom=(window.innerHeight-r.top+10)+'px';
    requestAnimationFrame(()=>menu.classList.add('open')); launch.setAttribute('aria-expanded','true');
  }
  function closeMenu(){ if(menu) menu.classList.remove('open'); if(launch) launch.setAttribute('aria-expanded','false'); }
  document.addEventListener('click',e=>{ if(menu&&menu.classList.contains('open')&&!e.target.closest('.tour-menu,.tour-launch')) closeMenu(); },true);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeMenu(); });
  function build(){
    hole=document.createElement('div'); hole.className='tour-hole';
    ring=document.createElement('div'); ring.className='tour-ring';
    pop=document.createElement('div'); pop.className='tour-pop';
    [hole,ring,pop].forEach(e=>{e.style.display='none';document.body.appendChild(e);});
  }
  function show(n){
    if(n<0) n=0;
    if(n>=steps.length) return finish();
    i=n; const s=steps[i];
    if(s.pre){ try{ s.pre(); }catch(_){} }
    const t=document.querySelector(s.sel);
    if(!t) return show(n+1);
    t.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});
    requestAnimationFrame(()=>requestAnimationFrame(()=>place(t,s)));
  }
  function place(t,s){
    const r=t.getBoundingClientRect(), pad=6;
    [hole,ring,pop].forEach(e=>e.style.display='block');
    [hole,ring].forEach(e=>{e.style.left=(r.left-pad)+'px';e.style.top=(r.top-pad)+'px';e.style.width=(r.width+pad*2)+'px';e.style.height=(r.height+pad*2)+'px';});
    const last=i===steps.length-1;
    const nextLabel = last ? (opts.next? 'Next: '+opts.next.label+' →' : 'Done ✓') : 'Next →';
    pop.innerHTML='<div class="step">Step '+(i+1)+' of '+steps.length+(opts.title?' · '+opts.title:'')+'</div>'+
      '<div class="dots">'+steps.map((_,k)=>'<i class="'+(k<=i?'on':'')+'"></i>').join('')+'</div>'+
      '<h4>'+s.title+'</h4><p>'+s.body+'</p>'+
      '<div class="trow"><button class="tour-skip" onclick="Tour.end()">Close</button><span class="sp"></span>'+
      (i>0?'<button class="tour-btn back" onclick="Tour.prev()">Back</button>':'')+
      '<button class="tour-btn next" onclick="Tour.next()">'+nextLabel+'</button></div>';
    const pr=pop.getBoundingClientRect();
    let top=r.bottom+12; if(top+pr.height>window.innerHeight-12) top=Math.max(12,r.top-pr.height-12);
    if(top<12) top=12;
    let left=Math.min(Math.max(12,r.left),window.innerWidth-pr.width-12);
    pop.style.top=top+'px'; pop.style.left=left+'px';
  }
  function finish(){
    if(opts.next){ try{ sessionStorage.setItem('ph_tour_auto',opts.next.href); }catch(_){}
      window.location.assign(opts.next.href); return; }
    end();
  }
  function end(){ [hole,ring,pop].forEach(e=>e&&(e.style.display='none')); if(launch) launch.classList.add('pulse'); }
  window.Tour={
    init:function(s,o){ opts=o||{}; steps=s; build();
      launch=document.createElement('button'); launch.className='tour-launch pulse';
      // With feedback available the button opens a small menu: the tour, or Send feedback.
      const two=canFeedback(), label=two?'Tour & Feedback':(opts.launch||'Show me around');
      launch.title=label; launch.setAttribute('aria-label',label);
      if(two){ launch.setAttribute('aria-haspopup','menu'); launch.setAttribute('aria-expanded','false'); }
      launch.innerHTML='👋<span class="tl-txt">'+label.replace('&','&amp;')+'</span>';
      launch.onclick=()=>{ launch.classList.remove('pulse');
        if(!canFeedback()) return show(0);
        if(menu&&menu.classList.contains('open')) closeMenu(); else openMenu(); };
      document.body.appendChild(launch);
      // continue a walkthrough that was handed over from the previous page
      let auto=null; try{ auto=sessionStorage.getItem('ph_tour_auto'); }catch(_){}
      if(auto && auto.split('/').pop()===location.pathname.split('/').pop()){
        try{ sessionStorage.removeItem('ph_tour_auto'); }catch(_){}
        setTimeout(()=>{ launch.classList.remove('pulse'); show(0); },500);
      }
    },
    next:()=>show(i+1), prev:()=>show(i-1), start:()=>show(0), end:end
  };
  window.addEventListener('resize',()=>{ if(pop&&pop.style.display!=='none'){ const t=document.querySelector(steps[i].sel); if(t) place(t,steps[i]); }});
})();
