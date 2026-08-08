/* Practice Hub V1 — celebrations.
   Fireworks when an office hits its MAIN production goal, confetti when it hits STRETCH,
   both together when both are reached. Pure canvas, no libraries.
   Celebrate.fire({fireworks:true, confetti:true}) */
(function(){
  const COLORS=['#149B96','#2BC0B8','#F2A03D','#2E9E6B','#6b3fd0','#1f6f9e','#e8c547','#ff6b6b','#ffffff'];
  let canvas,ctx,parts=[],raf=null,stopAt=0;

  function ensure(){
    if(canvas) return;
    canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
    document.body.appendChild(canvas);
    ctx=canvas.getContext('2d');
    resize(); window.addEventListener('resize',resize);
  }
  function resize(){
    if(!canvas)return;
    const d=window.devicePixelRatio||1;
    canvas.width=innerWidth*d; canvas.height=innerHeight*d;
    ctx.setTransform(d,0,0,d,0,0);
  }
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const pick=a=>a[Math.floor(Math.random()*a.length)];

  // a firework: rises, then bursts into a ring of sparks
  function shell(x,y){
    parts.push({kind:'shell',x,y:innerHeight,vy:-(y*0.017+rnd(7,9)),targetY:y,color:pick(COLORS),trail:[]});
  }
  function burst(x,y,color){
    const n=54, speed=rnd(3.4,5.4);
    for(let i=0;i<n;i++){
      const a=(Math.PI*2*i)/n + rnd(-0.05,0.05), s=speed*rnd(0.55,1.15);
      parts.push({kind:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,color:Math.random()<0.22?'#fff':color,life:1,decay:rnd(0.012,0.022),size:rnd(1.6,3)});
    }
  }
  function confettiPiece(){
    parts.push({kind:'conf',x:rnd(0,innerWidth),y:rnd(-innerHeight*0.4,-10),
      vx:rnd(-0.7,0.7),vy:rnd(1.6,3.4),w:rnd(6,11),h:rnd(9,15),
      color:pick(COLORS),rot:rnd(0,Math.PI*2),vr:rnd(-0.16,0.16),sway:rnd(0.01,0.04),phase:rnd(0,6.3),life:1});
  }

  function frame(){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    for(let i=parts.length-1;i>=0;i--){
      const p=parts[i];
      if(p.kind==='shell'){
        p.y+=p.vy; p.vy+=0.16;
        p.trail.push({x:p.x,y:p.y}); if(p.trail.length>8)p.trail.shift();
        ctx.strokeStyle=p.color; ctx.lineWidth=2.4; ctx.globalAlpha=.85; ctx.beginPath();
        p.trail.forEach((t,k)=>k?ctx.lineTo(t.x,t.y):ctx.moveTo(t.x,t.y)); ctx.stroke();
        if(p.vy>=-0.6 || p.y<=p.targetY){ burst(p.x,p.y,p.color); parts.splice(i,1); }
      } else if(p.kind==='spark'){
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.075; p.vx*=0.985; p.vy*=0.985; p.life-=p.decay;
        if(p.life<=0){ parts.splice(i,1); continue; }
        ctx.globalAlpha=Math.max(p.life,0); ctx.fillStyle=p.color;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,6.3); ctx.fill();
      } else {
        p.phase+=p.sway; p.x+=p.vx+Math.sin(p.phase)*1.1; p.y+=p.vy; p.rot+=p.vr;
        if(p.y>innerHeight+30){ parts.splice(i,1); continue; }
        ctx.globalAlpha=1; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
      }
    }
    ctx.globalAlpha=1;
    if(parts.length || Date.now()<stopAt) raf=requestAnimationFrame(frame);
    else { raf=null; ctx.clearRect(0,0,innerWidth,innerHeight); }
  }

  function fire(opts){
    opts=opts||{}; ensure();
    const dur = opts.duration||3400;
    stopAt=Date.now()+dur;
    if(opts.confetti){ for(let i=0;i<150;i++) confettiPiece(); }
    if(opts.fireworks){
      const launch=()=>{ if(Date.now()>stopAt)return;
        shell(rnd(innerWidth*0.15,innerWidth*0.85), rnd(innerHeight*0.12,innerHeight*0.42));
        setTimeout(launch, rnd(220,420)); };
      shell(innerWidth*0.5, innerHeight*0.22); launch();
    }
    if(!raf) raf=requestAnimationFrame(frame);
  }
  window.Celebrate={fire};
})();
