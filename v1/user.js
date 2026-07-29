/* Practice Hub V1 — the signed-in person: avatar, My Profile, and what they're allowed to do.
   ONE source of truth for personas + permissions. Every page includes this.
   Levels: none < view < add < edit < manage   (see Admin → Teams & Access) */
(function(){
  const RANK={none:0,view:1,add:2,edit:3,manage:4};

  // Sample people for the demo. Real names/emails/photos come from Microsoft 365 at go-live;
  // teams & locations are placeholders until the practice sends their real groupings.
  // REAL people and REAL roles from the practice's User Profile sheet (2026-07-28).
  // Note many staff hold DUAL roles — that's why `role` can be a combination.
  const PEOPLE=[
    {id:'admin', first:'Heather', last:'Beal', role:'COO', title:'COO (Admin)',
     teams:['Admin','Executive Team'], loc:'All offices', region:'All', brand:'Group',
     mail:'heather@farnsworthorthodontics.com',
     phone:'(575) 555-1002', emp:'E-1002', status:'Active', color:'#25456e', offices:'all',
     about:'COO. I look after the group and I\u2019m the administrator for this hub.',
     can:{dashboard:'manage',production:'manage',schedule:'manage',marketing:'manage',documents:'manage',team:'manage',admin:'manage'}},
    {id:'om', first:'Lily', last:'Rico', role:'OM / Clinic Lead', title:'Office Manager \u00b7 Carlsbad',
     teams:['Office Managers','Clinic Managers'], loc:'Carlsbad', region:'NM', brand:'FFO',
     mail:'lily@farnsworthorthodontics.com',
     phone:'(575) 555-1010', emp:'E-1010', status:'Active', color:'#149B96', offices:['Carlsbad'],
     about:'Office manager and clinic lead at Carlsbad.',
     can:{dashboard:'view',production:'edit',schedule:'edit',marketing:'view',documents:'edit',team:'view',admin:'none'}},
    {id:'doctor', first:'Carla', last:'Coehlo', role:'Associate Doctor', title:'Associate Doctor \u00b7 rotates', dr:true,
     teams:['Doctors'], loc:'Rotates', region:'NM', brand:'FFO',
     phone:'(575) 555-1020', emp:'E-1020', status:'Active', color:'#6b3fd0', offices:['Carlsbad','Hobbs'],
     about:'Associate doctor. I rotate between offices.',
     can:{dashboard:'view',production:'none',schedule:'view',marketing:'none',documents:'view',team:'view',admin:'none'}},
    {id:'tc', first:'Elizabeth', last:'Reyes', role:'TC', title:'Treatment Coordinator \u00b7 Hobbs',
     teams:['TCs'], loc:'Hobbs', region:'NM', brand:'FFO',
     mail:'liz@farnsworthorthodontics.com',
     phone:'(575) 555-1030', emp:'E-1030', status:'Active', color:'#946011', offices:['Hobbs'],
     about:'Treatment coordinator at Hobbs.',
     can:{dashboard:'none',production:'none',schedule:'view',marketing:'none',documents:'add',team:'view',admin:'none'}},
    {id:'staff', first:'Serenity', last:'Gonzales', role:'Clinical Assistant', title:'Clinical Assistant \u00b7 Carlsbad',
     teams:['Staff'], loc:'Carlsbad', region:'NM', brand:'FFO',
     phone:'(575) 555-1055', emp:'E-1055', status:'Active', color:'#b03a63', offices:['Carlsbad'],
     about:'Clinical assistant at Carlsbad.',
     can:{dashboard:'none',production:'none',schedule:'view',marketing:'none',documents:'view',team:'view',admin:'none'}}
  ];
  const COLORS=['#25456e','#149B96','#6b3fd0','#946011','#b03a63','#2E7D52','#1f6f9e','#b0442f'];

  function id(){ let v='admin'; try{ v=localStorage.getItem('ph_viewas')||'admin'; }catch(_){}
    return PEOPLE.some(p=>p.id===v)?v:'admin'; }
  function me(){
    const base=PEOPLE.find(p=>p.id===id());
    let mine={}; try{ mine=JSON.parse(localStorage.getItem('ph_me_'+base.id))||{}; }catch(_){}
    return Object.assign({},base,mine);
  }
  function saveMine(patch){
    const k='ph_me_'+id(); let cur={}; try{ cur=JSON.parse(localStorage.getItem(k))||{}; }catch(_){}
    try{ localStorage.setItem(k,JSON.stringify(Object.assign(cur,patch))); }catch(_){}
  }
  const name=p=>((p.dr?'Dr. ':'')+(p.preferred||p.first)+' '+p.last);
  const initialsOf=p=>((p.preferred||p.first)[0]+p.last[0]).toUpperCase();
  const initials=p=>((p.preferred||p.first)[0]+(p.last[0]||'')).toUpperCase();
  const email=p=>p.mail||((p.first[0]+p.last).toLowerCase().replace(/[^a-z]/g,'')+'@farnsworthorthodontics.com');
  function can(section){ const c=me().can||{}; return c[section]||'none'; }
  function atLeast(section,lvl){ return RANK[can(section)]>=RANK[lvl]; }
  function offices(){ return me().offices; }
  function setMe(v){
    try{ localStorage.setItem('ph_viewas',v); }catch(_){}
    // If the person we just became can't open this page, don't leave them staring at it.
    const file=(location.pathname.split('/').pop()||'home.html');
    const entry=NAV.find(x=>x.href===file);
    if(entry && !entry.show()){ location.assign('home.html'); return; }
    location.reload();
  }

  const css=`
  .ph-av{margin-left:auto;display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);
    border-radius:999px;padding:5px 12px 5px 6px;cursor:pointer;font-family:inherit;color:#fff}
  .ph-av:hover{background:rgba(255,255,255,.18)}
  .ph-av .cir{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:12px;color:#fff;flex:none}
  .ph-av .who{text-align:left;line-height:1.15}
  .ph-av .who b{display:block;font-size:13px;font-weight:700}
  .ph-av .who small{font-size:10.5px;color:#a8bdd8}
  .ph-av .car{font-size:9px;color:#a8bdd8}
  @media(max-width:560px){ .ph-av .who{display:none} }
  .ph-menu{position:fixed;z-index:400;background:#fff;border:1px solid #E4E8EE;border-radius:14px;box-shadow:0 16px 44px rgba(15,42,74,.28);
    padding:7px;min-width:250px;font-family:inherit}
  .ph-menu .mh{padding:9px 11px 8px;border-bottom:1px solid #E4E8EE;margin-bottom:6px}
  .ph-menu .mh b{display:block;color:#0F2A4A;font-size:14px}
  .ph-menu .mh small{color:#56627A;font-size:11.5px}
  .ph-menu button{display:flex;align-items:center;gap:9px;width:100%;border:none;background:none;font-family:inherit;text-align:left;
    padding:9px 11px;border-radius:9px;cursor:pointer;font-size:13.5px;font-weight:600;color:#1F2D3D}
  .ph-menu button:hover{background:#F4F6F8}
  .ph-menu .sec{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#8a94a6;padding:9px 11px 4px}
  .ph-menu button.cur{background:#E5F4F3;color:#0F827E}
  .ph-menu button .ck{margin-left:auto;font-weight:800;color:#0F827E}
  .ph-ov{position:fixed;inset:0;background:rgba(15,42,74,.55);z-index:410;display:none;align-items:flex-start;justify-content:center;padding:22px 14px;overflow:auto}
  .ph-ov.open{display:flex}
  .ph-card{background:#fff;width:100%;max-width:620px;border-radius:16px;box-shadow:0 16px 44px rgba(15,42,74,.3);margin:auto;overflow:hidden;font-family:inherit}
  .ph-top{display:flex;align-items:center;gap:13px;padding:17px 20px;border-bottom:1px solid #E4E8EE}
  .ph-top .big{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:19px;flex:none}
  .ph-top h3{margin:0;font-size:19px;color:#0F2A4A}
  .ph-top .t{font-size:13px;color:#56627A}
  .ph-top .x{margin-left:auto;border:none;background:none;font-size:25px;color:#56627A;cursor:pointer;line-height:1}
  .ph-body{padding:18px 20px;max-height:68vh;overflow:auto}
  .ph-lab{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#8a94a6;margin:0 0 9px;display:flex;align-items:center;gap:8px}
  .ph-tag{font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px}
  .ph-tag.ms{background:#eef3fb;color:#2b5f9e}
  .ph-tag.adm{background:#FFF6E9;color:#946011}
  .ph-tag.you{background:#E7F4EE;color:#2E9E6B}
  .ph-g{display:grid;grid-template-columns:1fr 1fr;gap:9px 16px;margin-bottom:18px}
  .ph-f label{display:block;font-size:11.5px;font-weight:600;color:#56627A;margin-bottom:3px}
  .ph-ro{background:#fafbfc;border:1px dashed #E4E8EE;border-radius:9px;padding:9px 11px;font-size:14px;color:#1F2D3D;font-weight:500}
  .ph-edit{border:1px solid #E4E8EE;border-radius:9px;padding:10px 12px;font-size:14px;font-family:inherit;width:100%;color:#1F2D3D}
  .ph-edit:focus{outline:2px solid #149B96;border-color:#149B96}
  textarea.ph-edit{min-height:74px;resize:vertical}
  .ph-pick{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
  .ph-photo{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border:2px dashed #dbe2ea;border-radius:14px;padding:14px;background:#fafbfc;transition:border-color .15s,background .15s}
  .ph-photo.over{border-color:#149B96;background:#E5F4F3}
  .ph-face{width:66px;height:66px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:23px;flex:none}
  .ph-photo-txt{flex:1;min-width:150px;display:flex;flex-direction:column}
  .ph-photo-txt b{font-size:13.5px;color:#0F2A4A}
  .ph-photo-txt span{font-size:12px;color:#56627A}
  .ph-photo-btns{display:flex;gap:8px;flex-wrap:wrap}
  .ph-sw{width:30px;height:30px;border-radius:50%;border:2px solid transparent;cursor:pointer}
  .ph-sw.on{border-color:#0F2A4A}
  .ph-note{background:#E5F4F3;border:1px solid #c4e6e3;border-radius:10px;padding:11px 14px;font-size:12.5px;color:#0c5b57;line-height:1.5}
  .ph-note b{color:#0a4d49}
  .ph-foot{display:flex;align-items:center;gap:10px;padding:14px 20px;border-top:1px solid #E4E8EE;background:#fafbfc}
  .ph-btn{background:#149B96;color:#fff;border:none;border-radius:9px;padding:10px 17px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}
  .ph-btn:hover{background:#0F827E}
  .ph-btn.g{background:#fff;color:#0F2A4A;border:1px solid #E4E8EE;font-weight:600}
  .ph-ok{font-size:12.5px;font-weight:700;color:#2E9E6B;opacity:0;transition:opacity .2s}
  .ph-ok.on{opacity:1}
  .ph-ro-banner{background:#FFF6E9;border:1px solid #f0d9ae;color:#7a4d0a;border-radius:12px;padding:11px 15px;font-size:13.5px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:9px}
  @media(max-width:560px){ .ph-g{grid-template-columns:1fr} }
  `;
  const style=document.createElement('style'); style.textContent=css; document.head.appendChild(style);

  let menu=null;
  function closeMenu(){ if(menu){menu.remove();menu=null;} }
  document.addEventListener('click',e=>{ if(menu && !menu.contains(e.target) && !e.target.closest('.ph-av')) closeMenu(); });

  function openMenu(anchor){
    closeMenu(); const p=me();
    menu=document.createElement('div'); menu.className='ph-menu';
    menu.innerHTML='<div class="mh"><b>'+name(p)+'</b><small>'+p.title+'</small></div>'+
      '<button onclick="PH.profile()">👤 My profile</button>'+
      '<div class="sec">Demo — sign in as</div>'+
      PEOPLE.map(x=>'<button class="'+(x.id===p.id?'cur':'')+'" onclick="PH.setMe(\''+x.id+'\')">'+
        '<span class="cir" style="width:22px;height:22px;font-size:10px;'+faceStyle(x.id===p.id?p:x)+'">'+face(x.id===p.id?p:x)+'</span>'+
        x.title.split(' · ')[0]+(x.id===p.id?'<span class="ck">✓</span>':'')+'</button>').join('');
    document.body.appendChild(menu);
    const r=anchor.getBoundingClientRect(), m=menu.getBoundingClientRect();
    menu.style.top=(r.bottom+8)+'px';
    menu.style.left=Math.max(8,Math.min(r.right-m.width,window.innerWidth-m.width-8))+'px';
  }

  // one place that draws a person's picture: their uploaded photo if there is one, else initials
  function faceStyle(p){ return p.photo ? 'background-image:url('+p.photo+');background-size:cover;background-position:center' : 'background:'+p.color; }
  function face(p){ return p.photo ? '' : initials(p); }
  function mount(){
    const bar=document.querySelector('.hdr-in'); if(!bar||bar.querySelector('.ph-av'))return;
    const p=me();
    const b=document.createElement('button'); b.className='ph-av';
    b.innerHTML='<span class="cir" style="'+faceStyle(p)+'">'+face(p)+'</span>'+
      '<span class="who"><b>'+name(p)+'</b><small>'+p.title.split(' · ')[0]+'</small></span><span class="car">▼</span>';
    b.onclick=e=>{e.stopPropagation(); menu?closeMenu():openMenu(b);};
    bar.appendChild(b);
    if(!document.getElementById('ph-ov')){
      const ov=document.createElement('div'); ov.id='ph-ov'; ov.className='ph-ov';
      ov.innerHTML='<div class="ph-card" id="ph-card"></div>';
      ov.addEventListener('click',e=>{ if(e.target===ov) closeProfile(); });
      document.body.appendChild(ov);
    }
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeProfile();closeMenu();} });
  }

  function profile(){
    closeMenu(); const p=me();
    const ro=(l,v)=>'<div class="ph-f"><label>'+l+'</label><div class="ph-ro">'+(v||'—')+'</div></div>';
    document.getElementById('ph-card').innerHTML=
      '<div class="ph-top"><span class="big" style="'+faceStyle(p)+'">'+face(p)+'</span>'+
        '<div><h3>'+name(p)+'</h3><div class="t">'+p.title+'</div></div>'+
        '<button class="x" onclick="PH.closeProfile()">×</button></div>'+
      '<div class="ph-body">'+
        '<p class="ph-lab">You can change these <span class="ph-tag you">YOURS TO EDIT</span></p>'+
        '<div class="ph-f" style="margin-bottom:16px"><label>Photo</label>'+
          '<div class="ph-photo" id="ph-drop">'+
            '<span class="ph-face" style="'+faceStyle(p)+'">'+face(p)+'</span>'+
            '<div class="ph-photo-txt"><b>'+(p.photo?'Your photo':'No photo yet')+'</b>'+
              '<span>Drag a picture here, or choose one from your device \u2014 JPG or PNG.</span></div>'+
            '<div class="ph-photo-btns">'+
              '<button class="ph-btn" onclick="document.getElementById(\'ph-file\').click()">'+(p.photo?'Change photo':'Choose photo')+'</button>'+
              (p.photo?'<button class="ph-btn g" onclick="PH.clearPhoto()">Remove</button>':'')+
            '</div>'+
            '<input type="file" id="ph-file" accept="image/*" style="display:none" onchange="PH.pickPhoto(this)">'+
          '</div>'+
          (p.photo?'':'<div class="ph-pick" style="margin-top:10px"><span style="font-size:12px;color:#56627A">No photo? Pick a colour for your initials:</span>'+
            COLORS.map(c=>'<button class="ph-sw'+(c===p.color?' on':'')+'" style="background:'+c+'" onclick="PH.setColor(\''+c+'\')" title="Use this colour"></button>').join('')+'</div>')+
        '</div>'+
        '<div class="ph-f" style="margin-bottom:14px"><label>Preferred name</label>'+
          '<input class="ph-edit" id="ph-pref" value="'+((p.preferred||'')).replace(/"/g,'&quot;')+'" placeholder="'+p.first+'">'+
          '<div style="font-size:11.5px;color:#56627A;margin-top:4px">What you\u2019d like to be called \u2014 this is the name your team sees. Leave blank to use \u201c'+p.first+'\u201d.</div></div>'+
        '<div class="ph-f" style="margin-bottom:14px"><label>Contact phone</label>'+
          '<input class="ph-edit" id="ph-phone" value="'+(p.phone||'').replace(/"/g,'&quot;')+'" placeholder="(575) 555-0000">'+
          '<div style="font-size:11.5px;color:#56627A;margin-top:4px">Microsoft doesn\'t hold this — keep it current so your team can reach you.</div></div>'+
        '<div class="ph-f" style="margin-bottom:18px"><label>About me</label>'+
          '<textarea class="ph-edit" id="ph-about" placeholder="A line about what you do…">'+(p.about||'')+'</textarea></div>'+
        '<p class="ph-lab">From Microsoft 365 <span class="ph-tag ms">SYNCED — CAN\'T EDIT HERE</span></p>'+
        '<div class="ph-g">'+ro('First name',p.first)+ro('Last name',p.last)+ro('Email',email(p))+ro('Employee ID',p.emp)+'</div>'+
        '<p class="ph-lab">Set by your admin <span class="ph-tag adm">ADMIN ONLY</span></p>'+
        '<div class="ph-g">'+ro('Role(s)',p.role||'\u2014')+ro('Team(s)',p.teams.join(', '))+ro('Location(s)',p.loc)+ro('Region',p.region)+ro('Brand',p.brand)+ro('Status',p.status)+'</div>'+
        '<div class="ph-note"><b>Why some boxes are locked:</b> your name and email come straight from Microsoft, so they only change there. Your team, location and status decide what you can open — only an admin can change those. Your <b>photo</b>, <b>phone</b> and <b>About me</b> are yours to keep current.</div>'+
      '</div>'+
      '<div class="ph-foot"><span class="ph-ok" id="ph-ok">✓ Saved</span><span style="flex:1"></span>'+
        '<button class="ph-btn g" onclick="PH.closeProfile()">Close</button>'+
        '<button class="ph-btn" onclick="PH.saveProfile()">Save my changes</button></div>';
    document.getElementById('ph-ov').classList.add('open');
    wireDrop();
  }
  function pickPhoto(input){ const f=input.files&&input.files[0]; if(f) readPhoto(f); }
  function readPhoto(file){
    if(!/^image\//.test(file.type)) return;
    const r=new FileReader();
    r.onload=e=>{
      const img=new Image();
      img.onload=()=>{ // shrink to a sensible avatar so it fits in storage
        const S=256, c=document.createElement('canvas'); c.width=S; c.height=S;
        const g=c.getContext('2d'), m=Math.min(img.width,img.height);
        g.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,S,S);
        saveMine({photo:c.toDataURL('image/jpeg',0.82)});
        profile(); refreshFaces();
      };
      img.src=e.target.result;
    };
    r.readAsDataURL(file);
  }
  function clearPhoto(){ saveMine({photo:null}); profile(); refreshFaces(); }
  function refreshFaces(){ const p=me(); const a=document.querySelector('.ph-av .cir');
    if(a){ a.setAttribute('style',faceStyle(p)); a.textContent=face(p); }
    document.dispatchEvent(new CustomEvent('ph:me-changed')); }
  function wireDrop(){
    const d=document.getElementById('ph-drop'); if(!d)return;
    ['dragenter','dragover'].forEach(t=>d.addEventListener(t,e=>{e.preventDefault();d.classList.add('over');}));
    ['dragleave','drop'].forEach(t=>d.addEventListener(t,e=>{e.preventDefault();d.classList.remove('over');}));
    d.addEventListener('drop',e=>{ const f=e.dataTransfer.files&&e.dataTransfer.files[0]; if(f)readPhoto(f); });
  }
  function setColor(c){ saveMine({color:c}); profile();
    const av=document.querySelector('.ph-av .cir'); if(av)av.style.background=c; }
  function saveProfile(){
    const t=document.getElementById('ph-about'), ph=document.getElementById('ph-phone'), pr=document.getElementById('ph-pref');
    const patch={about:t?t.value:''};
    if(ph) patch.phone=ph.value.trim();
    if(pr) patch.preferred=pr.value.trim();
    saveMine(patch);
    refreshFaces();
    const av=document.querySelector('.ph-av .who b'); if(av) av.textContent=name(me());
    const ok=document.getElementById('ph-ok'); if(ok){ok.classList.add('on'); setTimeout(()=>ok.classList.remove('on'),2200);}
  }
  function closeProfile(){ const o=document.getElementById('ph-ov'); if(o)o.classList.remove('open'); }

  /* ONE nav for every page — identical order everywhere, so it never rearranges itself.
     A tab only appears if the person can actually open it. */
  const NAV=[
    {k:'home',       n:'\ud83c\udfe0 Home',             href:'home.html',       show:()=>true},
    {k:'dashboard',  n:'\ud83d\udcca Dashboard',        href:'index.html',      show:()=>atLeast('dashboard','view')},
    {k:'production', n:'\ud83d\udcdd Enter Production',  href:'production.html', show:()=>atLeast('production','edit')},
    {k:'schedule',   n:'\ud83d\udcc5 Schedule',          href:'schedule.html',   show:()=>atLeast('schedule','view')},
    {k:'marketing',  n:'\ud83d\udce3 Marketing',         href:'marketing.html',  show:()=>atLeast('marketing','view')},
    {k:'documents',  n:'\ud83d\udcc1 Documents',         href:'documents.html',  show:()=>atLeast('documents','view')},
    {k:'team',       n:'\ud83d\udc65 Team',              href:'team.html',       show:()=>atLeast('team','view')},
    {k:'admin',      n:'\u2699\ufe0f Admin',            href:'admin.html',      show:()=>atLeast('admin','view')}
  ];
  function nav(active){
    const host=document.getElementById('nav')||document.querySelector('.v1nav-in'); if(!host)return;
    host.innerHTML=NAV.filter(x=>x.show()).map(x=>
      '<a href="'+x.href+'"'+(x.k===active?' class="active"':'')+'>'+x.n+'</a>').join('');
  }

  /* Drop a "view only" banner at the top of a page's content. */
  function readOnlyBanner(target,what){
    const host=document.querySelector(target); if(!host||host.querySelector('.ph-ro-banner'))return;
    const d=document.createElement('div'); d.className='ph-ro-banner';
    d.innerHTML='👁 <span><b>View only.</b> You can look at the '+what+', but not change it. Ask an admin if you need to edit.</span>';
    host.insertBefore(d,host.firstChild);
  }

  window.PH={PEOPLE,me,name,initials,email,face,faceStyle,can,atLeast,offices,setMe,mount,nav,NAV,profile,pickPhoto,clearPhoto,saveProfile,setColor,closeProfile,readOnlyBanner};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
