/* Practice Hub V1 — guided walkthrough (spotlight + pulsing cue + step popover). */
(function(){
  const css=`
  .tour-launch{position:fixed;right:18px;bottom:18px;z-index:200;background:var(--teal,#149B96);color:#fff;border:none;
    border-radius:999px;padding:12px 18px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;
    box-shadow:0 8px 24px rgba(15,42,74,.28);display:flex;align-items:center;gap:8px}
  .tour-launch.pulse{animation:tourpulse 1.5s infinite}
  @keyframes tourpulse{0%{box-shadow:0 0 0 0 rgba(20,155,150,.5),0 8px 24px rgba(15,42,74,.28)}
    70%{box-shadow:0 0 0 18px rgba(20,155,150,0),0 8px 24px rgba(15,42,74,.28)}
    100%{box-shadow:0 0 0 0 rgba(20,155,150,0),0 8px 24px rgba(15,42,74,.28)}}
  .tour-hole{position:fixed;z-index:201;border-radius:12px;box-shadow:0 0 0 9999px rgba(15,42,74,.62);pointer-events:none;transition:all .28s ease}
  .tour-ring{position:fixed;z-index:202;border-radius:14px;border:3px solid #2BC0B8;pointer-events:none;transition:all .28s ease;animation:tourring 1.3s infinite}
  @keyframes tourring{0%{box-shadow:0 0 0 0 rgba(43,192,184,.55)}70%{box-shadow:0 0 0 14px rgba(43,192,184,0)}100%{box-shadow:0 0 0 0 rgba(43,192,184,0)}}
  .tour-pop{position:fixed;z-index:203;background:#fff;border-radius:14px;box-shadow:0 16px 44px rgba(15,42,74,.4);max-width:330px;padding:18px;transition:top .28s ease,left .28s ease}
  .tour-pop h4{margin:0 0 6px;color:#0F2A4A;font-size:16px}
  .tour-pop p{margin:0 0 14px;color:#56627A;font-size:14px;line-height:1.5}
  .tour-pop .trow{display:flex;align-items:center;gap:8px}
  .tour-pop .step{font-size:12px;color:#8a94a6;font-weight:700;margin-bottom:6px}
  .tour-pop .sp{flex:1}
  .tour-btn{border:none;border-radius:9px;padding:8px 15px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer}
  .tour-btn.next{background:#149B96;color:#fff}
  .tour-btn.back{background:#fff;color:#0F2A4A;border:1px solid #E4E8EE}
  .tour-skip{background:none;border:none;color:#8a94a6;font-size:13px;cursor:pointer;font-family:inherit}
  @media(max-width:520px){.tour-pop{max-width:calc(100vw - 24px)}}
  `;
  const styleEl=document.createElement('style'); styleEl.textContent=css; document.head.appendChild(styleEl);

  let steps=[], i=0, hole, ring, pop, launch;
  function build(){
    hole=document.createElement('div'); hole.className='tour-hole';
    ring=document.createElement('div'); ring.className='tour-ring';
    pop=document.createElement('div'); pop.className='tour-pop';
    [hole,ring,pop].forEach(e=>{e.style.display='none';document.body.appendChild(e);});
  }
  function show(n){
    if(n<0) n=0;
    if(n>=steps.length) return end();
    i=n; const s=steps[i]; const t=document.querySelector(s.sel);
    if(!t) return show(n+1);
    t.scrollIntoView({block:'center',behavior:'smooth'});
    setTimeout(()=>place(t,s),300);
  }
  function place(t,s){
    const r=t.getBoundingClientRect(), pad=6;
    [hole,ring,pop].forEach(e=>e.style.display='block');
    [hole,ring].forEach(e=>{e.style.left=(r.left-pad)+'px';e.style.top=(r.top-pad)+'px';e.style.width=(r.width+pad*2)+'px';e.style.height=(r.height+pad*2)+'px';});
    const last=i===steps.length-1;
    pop.innerHTML='<div class="step">Step '+(i+1)+' of '+steps.length+'</div><h4>'+s.title+'</h4><p>'+s.body+'</p>'+
      '<div class="trow"><button class="tour-skip" onclick="Tour.end()">Skip tour</button><span class="sp"></span>'+
      (i>0?'<button class="tour-btn back" onclick="Tour.prev()">Back</button>':'')+
      '<button class="tour-btn next" onclick="Tour.next()">'+(last?'Done ✓':'Next →')+'</button></div>';
    const pr=pop.getBoundingClientRect();
    let top=r.bottom+12; if(top+pr.height>window.innerHeight-12) top=Math.max(12,r.top-pr.height-12);
    let left=Math.min(Math.max(12,r.left),window.innerWidth-pr.width-12);
    pop.style.top=top+'px'; pop.style.left=left+'px';
  }
  function end(){ [hole,ring,pop].forEach(e=>e&&(e.style.display='none')); if(launch) launch.classList.add('pulse'); }
  window.Tour={
    init:function(s,opts){ opts=opts||{}; steps=s; build();
      launch=document.createElement('button'); launch.className='tour-launch pulse';
      launch.innerHTML='👋 Show me around';
      launch.onclick=()=>{ launch.classList.remove('pulse'); show(0); };
      document.body.appendChild(launch);
      if(opts.auto && !sessionStorage.getItem('ph_tour_'+(opts.key||'x'))){
        sessionStorage.setItem('ph_tour_'+(opts.key||'x'),'1');
        setTimeout(()=>{ launch.classList.remove('pulse'); show(0); }, 900);
      }
    },
    next:()=>show(i+1), prev:()=>show(i-1), start:()=>show(0), end:end
  };
  window.addEventListener('resize',()=>{ if(pop&&pop.style.display!=='none'){ const t=document.querySelector(steps[i].sel); if(t) place(t,steps[i]); }});
})();
