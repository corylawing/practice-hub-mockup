/* Home-Brace V1 — the signed-in person: avatar, My Profile, and what they're allowed to do.
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
     can:{dashboard:'view',production:'manage',schedule:'edit',marketing:'edit',documents:'manage',team:'view',admin:'manage'}},
    {id:'om', first:'Lily', last:'Rico', role:'OM / Clinic Lead', title:'Office Manager \u00b7 Carlsbad',
     teams:['Office Managers','Clinic Managers'], loc:'Carlsbad', region:'NM', brand:'FFO',
     mail:'lily@farnsworthorthodontics.com',
     phone:'(575) 555-1010', emp:'E-1010', status:'Active', color:'#149B96', offices:['Carlsbad'],
     about:'Office manager and clinic lead at Carlsbad.',
     can:{dashboard:'view',production:'edit',schedule:'edit',marketing:'view',documents:'edit',team:'view',admin:'none'}},
    {id:'doctor', first:'Carla', last:'Coelho', role:'Associate Doctor', title:'Associate Doctor \u00b7 rotates', dr:true,
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

  /* ------------------------------------------------------------------
     WHO IS THIS?
     Sandbox: the "Viewing as" dropdown, so roles can be demonstrated.
     Live: the person's own Microsoft profile. Their Entra **Department** decides what
     they can do and their **Office location** decides whose numbers they see — the two
     fields IT populates. Nothing here is a security boundary on its own; SharePoint
     still enforces what a token can actually fetch.
     ------------------------------------------------------------------ */

  // Department (Entra) -> what they can do. Keys are Heather's own ten team names, lowercased.
  const DEPT_CAN={
    'admin':                      {dashboard:'view',production:'manage',schedule:'edit',marketing:'edit',documents:'manage',team:'view',admin:'manage'},
    'executive team':             {dashboard:'view',production:'edit',  schedule:'edit',marketing:'edit',documents:'manage',team:'view',admin:'none'},
    'leadership team':            {dashboard:'view',production:'edit',  schedule:'edit',marketing:'edit',documents:'manage',team:'view',admin:'none'},
    'office managers':            {dashboard:'view',production:'edit',  schedule:'edit',marketing:'view',documents:'edit',  team:'view',admin:'none'},
    'clinic managers':            {dashboard:'view',production:'view',  schedule:'edit',marketing:'view',documents:'edit',  team:'view',admin:'none'},
    'doctors':                    {dashboard:'view',production:'none',  schedule:'view',marketing:'none',documents:'view',  team:'view',admin:'none'},
    'tcs':                        {dashboard:'none',production:'none',  schedule:'view',marketing:'none',documents:'add',   team:'view',admin:'none'},
    'marketing team':             {dashboard:'none',production:'none',  schedule:'view',marketing:'edit',documents:'edit',  team:'view',admin:'none'},
    'financial coordinator team': {dashboard:'view',production:'edit',  schedule:'view',marketing:'none',documents:'view',  team:'view',admin:'none'},
    'staff':                      {dashboard:'none',production:'none',  schedule:'view',marketing:'none',documents:'view',  team:'view',admin:'none'}
  };
  // Departments that legitimately see every office.
  const ALL_OFFICE_DEPTS=['admin','executive team','leadership team'];

  /* What Admin > Teams & Access has actually set. That screen is the practice's own
     control over permissions, so it wins; DEPT_CAN above is only the starting point for
     a team the matrix doesn't mention. Keys there are team names as typed, so match
     case-insensitively. */
  /* PER-PERSON OVERRIDES set in Admin > People.
     Microsoft creates the account; the HUB decides access. So whatever an administrator
     sets here beats the Entra Department/Office fields — those are only the starting
     point for someone nobody has configured yet. */
  let PEOPLE_OVR=null;
  function loadPeopleLocal(){
    try{ PEOPLE_OVR=JSON.parse(localStorage.getItem('ph_people')); }catch(_){ PEOPLE_OVR=null; }
  }
  loadPeopleLocal();
  function reloadPeople(){
    loadPeopleLocal();
    if(window.PH_STORE && isLive()){
      return window.PH_STORE.get('ph_people').then(function(r){
        if(r && typeof r==='object'){
          PEOPLE_OVR=r;
          try{ localStorage.setItem('ph_people',JSON.stringify(r)); }catch(_){}
        }
        return PEOPLE_OVR;
      }).catch(function(){ return PEOPLE_OVR; });
    }
    return Promise.resolve(PEOPLE_OVR);
  }
  function overrideFor(mail){
    if(!PEOPLE_OVR || !mail) return null;
    return PEOPLE_OVR[String(mail).toLowerCase().trim()] || null;
  }

  let ACCESS=null;
  function loadAccessLocal(){
    try{ ACCESS=JSON.parse(localStorage.getItem('ph_access')); }catch(_){ ACCESS=null; }
  }
  loadAccessLocal();
  function reloadAccess(){
    loadAccessLocal();
    if(window.PH_STORE && isLive()){
      return window.PH_STORE.get('ph_access').then(function(r){
        if(r && typeof r==='object'){
          ACCESS=r;
          try{ localStorage.setItem('ph_access',JSON.stringify(r)); }catch(_){}
        }
        return ACCESS;
      }).catch(function(){ return ACCESS; });
    }
    return Promise.resolve(ACCESS);
  }
  function accessForTeam(dept){
    if(!ACCESS) return null;
    const key=Object.keys(ACCESS).find(k=>k.toLowerCase()===dept);
    return key?ACCESS[key]:null;
  }

  /* BOOTSTRAP ADMINS.
     Access normally comes from the Entra Department field. But until someone sets those
     fields nobody is an admin — and Admin is where you'd fix it. That deadlock would leave
     the hub unadministrable on day one. These accounts are treated as Admin regardless, by
     email. Keep the list tiny and remove people once their Entra profile is set properly.
     This grants nothing in SharePoint — only what the interface offers. */
  const BOOTSTRAP_ADMINS=[
    'consult@farnsworthorthodontics.com'
  ];

  // Set by gate.js once Graph /me comes back.
  let PROFILE=null;
  function setProfile(p){ PROFILE=p; }

  /* Turn one or more team names into a permission set. Used by BOTH real sign-in and
     View as — they diverged once, and an admin impersonating another admin got locked
     out of Admin because "Admin; Leadership Team" was looked up as a single literal. */
  function canForTeams(depts){
    let can=null;
    depts.forEach(d=>{
      const c=accessForTeam(d) || DEPT_CAN[d]; if(!c) return;
      if(!can){ can=Object.assign({},c); return; }
      Object.keys(c).forEach(k=>{ if(RANK[c[k]]>RANK[can[k]]) can[k]=c[k]; });
    });
    return can;
  }
  const splitTeams=v=>String(v||'').split(/[;,]/).map(x=>x.trim().toLowerCase()).filter(Boolean);

  function fromProfile(){
    if(!PROFILE) return null;
    const mailNow=String(PROFILE.mail||PROFILE.userPrincipalName||'').toLowerCase().trim();
    const ovr=overrideFor(mailNow);
    // The hub's own setting wins; Entra is only the fallback for an unconfigured person.
    const deptSrc = (ovr && ovr.teams && ovr.teams.length)
      ? ovr.teams.join(';')
      : String(PROFILE.department||'');
    const depts=splitTeams(deptSrc);
    // Several departments -> take the most permissive level for each area.
    let can=canForTeams(depts);
    const known=depts.some(d=>accessForTeam(d)||DEPT_CAN[d]);
    if(!can) can=Object.assign({},DEPT_CAN['staff']);   // unrecognised/blank -> least access

    const mail=String(PROFILE.mail||PROFILE.userPrincipalName||'').toLowerCase().trim();
    const boot=BOOTSTRAP_ADMINS.indexOf(mail)>=0;
    if(boot) can=Object.assign({},DEPT_CAN['admin']);

    const ovrLocs = (ovr && ovr.locs && ovr.locs.length) ? ovr.locs : null;
    const loc = ovrLocs ? ovrLocs.filter(l=>l!=='All offices').join(', ')
                        : String(PROFILE.officeLocation||'').trim();
    const seesAll = boot
      || (ovrLocs ? ovrLocs.indexOf('All offices')>=0 : false)
      || depts.some(d=>ALL_OFFICE_DEPTS.indexOf(d)>=0);
    const offs = seesAll ? 'all'
      : (ovrLocs ? ovrLocs.slice() : (loc?[loc]:[]));

    const full=String(PROFILE.displayName||PROFILE.mail||'').trim();
    const bits=full.split(/\s+/);
    return {
      id:'me', first:bits[0]||'', last:bits.slice(1).join(' '),
      role:PROFILE.jobTitle||'', title:PROFILE.jobTitle||'',
      mail:PROFILE.mail||PROFILE.userPrincipalName||'',
      teams:depts.length?depts.map(d=>d.replace(/\b\w/g,c=>c.toUpperCase())):['Staff'],
      loc:loc||'', offices:offs, can:can,
      // Flags the UI uses to explain a thin-looking account rather than just showing nothing.
      _needsSetup: !boot && !ovr && (!known || (!seesAll && !loc))
    };
  }

  /* VIEW AS — admin only, Salesforce-style. An administrator can look at the hub through
     someone else's eyes to debug "I can't see X". A banner always says so, and one click
     returns. Presentation only: SharePoint still answers to the REAL person's token, so
     this can never grant access the impersonator doesn't already have. */
  const IMP_KEY='ph_impersonate';
  function impersonating(){
    try{ return JSON.parse(localStorage.getItem(IMP_KEY)||'null'); }catch(_){ return null; }
  }
  function realMe(){
    const real=fromProfile();
    if(real) return real;
    const base=PEOPLE.find(p=>p.id===id());
    let mine={}; try{ mine=JSON.parse(localStorage.getItem('ph_me_'+base.id))||{}; }catch(_){}
    return Object.assign({},base,mine);
  }
  function isAdmin(p){ p=p||realMe(); return RANK[(p.can||{}).admin||'none']>=RANK['manage']; }
  function viewAs(person){
    if(!isAdmin()) return false;                       // only an admin may do this
    try{ localStorage.setItem(IMP_KEY, JSON.stringify(person)); }catch(_){}
    location.reload(); return true;
  }
  function stopViewAs(){
    try{ localStorage.removeItem(IMP_KEY); }catch(_){}
    location.reload();
  }
  /* Turn a roster row into someone the app can render as. */
  function personFromStaff(row){
    const depts=splitTeams(row.team);
    const bits=String(row.n||'').trim().split(/\s+/);
    const locs=String(row.loc||'').split(',').map(x=>x.trim()).filter(Boolean);
    const seesAll = locs.indexOf('All offices')>=0 ||
                    depts.some(d=>ALL_OFFICE_DEPTS.indexOf(d)>=0);
    return { id:'imp', first:bits[0]||'', last:bits.slice(1).join(' '),
             role:row.role||'', title:row.role||'', mail:row.mail||'',
             teams:depts.length?depts.map(d=>d.replace(/\b\w/g,c=>c.toUpperCase())):['Staff'],
             loc:row.loc||'',
             offices: seesAll ? 'all' : locs,
             can: canForTeams(depts) || Object.assign({},DEPT_CAN['staff']) };
  }

  function id(){ let v='admin'; try{ v=localStorage.getItem('ph_viewas')||'admin'; }catch(_){}
    return PEOPLE.some(p=>p.id===v)?v:'admin'; }
  function me(){
    const imp=impersonating();
    if(imp && isAdmin(realMe())) return imp;    // admin looking through someone else's eyes
    const real=fromProfile();
    if(real){
      let mine={}; try{ mine=JSON.parse(localStorage.getItem(profileKey()))||{}; }catch(_){}
      return Object.assign(real, mine);         // live: the signed-in person + their own edits
    }
    const base=PEOPLE.find(p=>p.id===id());     // sandbox: the chosen persona
    let mine={}; try{ mine=JSON.parse(localStorage.getItem('ph_me_'+base.id))||{}; }catch(_){}
    return Object.assign({},base,mine);
  }
  /* Profile edits (photo, preferred name, phone, About me) belong to the PERSON, so in
     production they're keyed by their email — not by a demo persona id, which would have
     made everyone share one profile. They also go to SharePoint so they follow the person
     between devices. */
  function profileKey(){
    if(PROFILE){
      const mail=String(PROFILE.mail||PROFILE.userPrincipalName||'').toLowerCase().trim();
      if(mail) return 'ph_me_'+mail;
    }
    return 'ph_me_'+id();
  }
  function saveMine(patch){
    const k=profileKey(); let cur={}; try{ cur=JSON.parse(localStorage.getItem(k))||{}; }catch(_){}
    const merged=Object.assign(cur,patch);
    try{ localStorage.setItem(k,JSON.stringify(merged)); }catch(_){}
    if(window.PH_STORE && isLive()) window.PH_STORE.set(k, merged);
  }
  const name=p=>((p.dr?'Dr. ':'')+(p.preferred||p.first)+' '+p.last);
  const initialsOf=p=>((p.preferred||p.first)[0]+p.last[0]).toUpperCase();
  const initials=p=>((p.preferred||p.first)[0]+(p.last[0]||'')).toUpperCase();
  const email=p=>p.mail||((p.first[0]+p.last).toLowerCase().replace(/[^a-z]/g,'')+'@farnsworthorthodontics.com');
  function can(section){ const c=me().can||{}; return c[section]||'none'; }
  function atLeast(section,lvl){ return RANK[can(section)]>=RANK[lvl]; }
  function offices(){ return me().offices; }

  /* ------------------------------------------------------------------
     LOCATIONS — one list, shared by every page.
     Admin owns brand/state/tz. Schedule owns color/lunch/hours. Both write the
     WHOLE record back so neither wipes the other's fields. Every other page just
     reads it, so adding an office in either place shows up everywhere at once.
     ------------------------------------------------------------------ */
  const WKH={s:480,e:1020};   // 8:00a–5:00p. hours[] is Mon–Fri (5 slots) — no weekends.
  const DEFAULT_LOCATIONS=[
    {n:'Carlsbad',  brand:'FFO', state:'New Mexico', tz:'Mountain Time', color:'Hot Pink',
     lunch:{s:720,e:780}, hours:[WKH,null,WKH,null,WKH]},
    {n:'Clovis',    brand:'FFO', state:'New Mexico', tz:'Mountain Time', color:'Highlighter Orange',
     lunch:{s:720,e:780}, hours:[WKH,null,WKH,null,WKH]},
    {n:'Hobbs',     brand:'FFO', state:'New Mexico', tz:'Mountain Time', color:'Lime Green',
     lunch:{s:720,e:780}, hours:[null,WKH,null,WKH,null]},
    {n:'San Angelo',brand:'FFO', state:'Texas',      tz:'Central Time',  color:'Sky Blue',
     lunch:{s:780,e:840}, hours:[WKH,null,WKH,null,WKH]},
    {n:'Lubbock',   brand:'FFO', state:'Texas',      tz:'Central Time',  color:'Highlighter Yellow',
     lunch:null,          hours:[null,WKH,null,WKH,WKH]},
    {n:'Mansfield', brand:'SUN', state:'Texas',      tz:'Central Time',  color:'Purple',
     lunch:{s:720,e:780}, hours:[WKH,null,WKH,null,WKH]},
    {n:'Cruces LCO',brand:'LCO', state:'New Mexico', tz:'Mountain Time', color:'Jade',
     lunch:{s:720,e:780}, hours:[null,WKH,null,WKH,null]},
    {n:'Cruces FFO',brand:'FFO', state:'New Mexico', tz:'Mountain Time', color:'Slate Blue',
     lunch:null,          hours:[null,null,WKH,null,WKH]}
  ];
  // Same order as the Schedule's PALETTE, so an auto-assigned color is always one the
  // schedule can actually render.
  const ALL_COLORS=['Teal','Slate Blue','Hot Pink','Purple','Sky Blue','Highlighter Orange',
                    'Lime Green','Highlighter Yellow','Jade','Red'];
  // Stored locations from earlier versions hold abbreviations ("NM", "MT"). The practice
  // asked for full names everywhere, so heal them on read rather than leaving stale data
  // showing codes forever.
  const STATE_FULL={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
    CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',
    ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',
    MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
    MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',
    NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',
    PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',
    UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
  const TZ_FULL={ET:'Eastern Time',CT:'Central Time',MT:'Mountain Time',AZ:'Mountain Time (Arizona, no DST)',
    PT:'Pacific Time',AKT:'Alaska Time',HT:'Hawaii Time',
    Eastern:'Eastern Time',Central:'Central Time',Mountain:'Mountain Time',Pacific:'Pacific Time'};
  const fullState=v=>{ v=(v||'').trim(); return STATE_FULL[v.toUpperCase()] || v; };
  // Light Pink/Light Orange were retired for reading as Hot Pink and Highlighter Orange
  // when stacked together in a day cell. Anyone holding a retired name keeps a color
  // that still renders, rather than losing it or drawing blank.
  const COLOR_RENAME={'Light Pink':'Jade','Light Orange':'Slate Blue','Royal Blue':'Slate Blue'};
  const fullTZ=v=>{ v=(v||'').trim(); return TZ_FULL[v] || TZ_FULL[v.toUpperCase()] || v; };

  function locations(){
    let st=null; try{ st=JSON.parse(localStorage.getItem('ph_locations')); }catch(_){}
    /* The default open/closed pattern per office is demo invention — it claims Carlsbad
       shuts on Tuesdays and so on. In production every office starts open Mon–Fri with
       nothing decided, and the practice closes the days they actually close. Stored
       locations from before this are dropped the same way, by version. */
    const LOC_VERSION=2;
    const openAllWeek=()=>[WKH,WKH,WKH,WKH,WKH].map(h=>({s:h.s,e:h.e}));
    if(isLive()){
      const stale = !Array.isArray(st) || !st.length || st.some(l=>l.__v!==LOC_VERSION);
      if(stale){
        return DEFAULT_LOCATIONS.map(l=>Object.assign(
          JSON.parse(JSON.stringify(l)), {hours:openAllWeek(), __v:LOC_VERSION}));
      }
    }
    if(!Array.isArray(st)||!st.length) return JSON.parse(JSON.stringify(DEFAULT_LOCATIONS));
    // An office added from Admin has no color/hours yet; give it usable ones so the
    // Schedule can draw it straight away instead of rendering blank.
    const used=st.map(l=>l.color).filter(Boolean);
    let spare=0;
    const nextColor=()=>{
      const free=ALL_COLORS.find(c=>used.indexOf(c)<0);
      // Track it immediately — otherwise every office added in the same pass gets the
      // same color, and two offices sharing a color breaks the whole calendar.
      const pick = free || ALL_COLORS[spare++ % ALL_COLORS.length];
      used.push(pick);
      return pick;
    };
    return st.map(l=>{
      const rec=Object.assign({
        brand:'', state:'', tz:'Mountain Time',
        lunch: null,
        hours: [null,null,null,null,null,null]    // closed until someone sets the days
      }, l, l.color?{}:{color:nextColor()});
      rec.state=fullState(rec.state); rec.tz=fullTZ(rec.tz);
      if(COLOR_RENAME[rec.color]) rec.color=COLOR_RENAME[rec.color];
      return rec;
    });
  }
  /* A stand-in for their SharePoint tree. In production this is the Graph file picker,
     which returns the file's real driveId/itemId — the hub stores the LINK, never a copy. */
  const DRIVE={
    '':{folders:['Home-Brace','Shared Documents','Clinical','Finance'],files:[]},
    'Home-Brace':{folders:['HR','Operations','Marketing','Office Forms'],files:[]},
    'Home-Brace/HR':{folders:['New Hire','Policies'],files:[
      ['Employee Handbook 2026.docx','Modified 2 days ago by Heather B.'],
      ['PTO Request Form.xlsx','Modified last week by Lily R.']]},
    'Home-Brace/HR/New Hire':{folders:[],files:[
      ['New-Hire Packet (New Mexico).pdf','Modified yesterday by Heather B.'],
      ['New-Hire Packet (Texas).pdf','Modified yesterday by Heather B.'],
      ['W-9 Blank.pdf','Modified 3 months ago']]},
    'Home-Brace/HR/Policies':{folders:[],files:[
      ['Uniform Policy.docx','Modified last month by Heather B.'],
      ['Attendance Policy.docx','Modified last month by Heather B.']]},
    'Home-Brace/Operations':{folders:[],files:[
      ['2026 Production Dashboard.xlsx','Modified today by Lily R.'],
      ['Opening & Closing Checklist.docx','Modified 2 weeks ago'],
      ['Supply Order Form.xlsx','Modified last week']]},
    'Home-Brace/Marketing':{folders:[],files:[
      ['Marketing Calendar 2026.xlsx','Modified 3 days ago by Selene B.'],
      ['Referral Card Artwork.pdf','Modified last month']]},
    'Home-Brace/Office Forms':{folders:[],files:[
      ['Maintenance Request.docx','Modified 2 months ago'],
      ['Incident Report.pdf','Modified 5 months ago']]},
    'Shared Documents':{folders:[],files:[['Group Org Chart.pptx','Modified last quarter']]},
    'Clinical':{folders:[],files:[['Sterilization Log.xlsx','Modified today']]},
    'Finance':{folders:[],files:[['Payroll Tracking Sheet.xlsx','Modified today by Heather B.']]}
  };
  let drivePath='';
  const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  /* Browse the Microsoft drive and LINK the live file. This is the whole point of the hub —
     the document keeps living on SharePoint and the hub points at it, so it is never a stale
     second copy. Uploading from a device is offered too, but it uploads TO the drive first. */
  function drivePicker(o){
    if(o.name){
      return '<div class="picked"><span style="font-size:20px">\ud83d\udcc4</span>'+
        '<div style="flex:1"><div class="pn">'+esc(o.name)+'</div>'+
        '<div class="pp">\u2601 '+esc(o.path2||'Microsoft drive')+'</div>'+
        '<div class="linkpill">\ud83d\udd17 LINKED \u2014 ALWAYS THE LIVE FILE</div></div>'+
        '<button class="dpbtn" onclick="'+o.ns+'.clearFile()">Change</button></div>';
    }
    const node=DRIVE[o.path||'']||{folders:[],files:[]};
    const parts=(o.path||'')?(o.path||'').split('/'):[];
    let acc='', crumbs='<button onclick="'+o.ns+'.cd(\'\')">\u2601 Microsoft drive</button>';
    parts.forEach(p=>{ acc=acc?acc+'/'+p:p; crumbs+='<span>\u203a</span><button onclick="'+o.ns+'.cd(\''+acc.replace(/'/g,"\\'")+'\')">'+p+'</button>'; });
    const up = (o.path||'') ? '<button class="drow" onclick="'+o.ns+'.cd(\''+parts.slice(0,-1).join('/').replace(/'/g,"\\'")+'\')"><span class="di">\u21a9</span><span class="dn">Back</span></button>' : '';
    const rows = node.folders.map(f=>{
      const full=((o.path||'')?(o.path||'')+'/':'')+f;
      return '<button class="drow" onclick="'+o.ns+'.cd(\''+full.replace(/'/g,"\\'")+'\')"><span class="di">\ud83d\udcc1</span><span class="dn">'+f+'</span><span class="dm">\u203a</span></button>';
    }).join('') + node.files.map(f=>
      '<button class="drow" onclick="'+o.ns+'.useFile(\''+f[0].replace(/'/g,"\\'")+'\')"><span class="di">\ud83d\udcc4</span><span class="dn">'+f[0]+'</span><span class="dm">'+f[1]+'</span></button>'
    ).join('');
    return '<div class="drivebox">'+
        '<div class="drive-h">\u2601 Choose a document already on your Microsoft drive</div>'+
        '<div class="crumb2">'+crumbs+'</div>'+
        '<div class="drivelist">'+up+(rows||'<div style="padding:14px;color:var(--soft);font-size:13.5px">Nothing in this folder.</div>')+'</div>'+
      '</div>'+
      '<div class="orline">or</div>'+
      '<div class="dfile">\ud83d\udcbb <span style="flex:1">Upload a file from this device</span>'+
        '<button class="dpbtn" onclick="'+o.ns+'.uploadFile()">Choose file\u2026</button></div>'+
      '<div class="uploadnote">An upload is saved <b>onto the practice\u2019s Microsoft drive first</b>, then linked here \u2014 so it behaves exactly like the files above. The hub never keeps its own copy.</div>';
  }

  function saveLocations(list){
    if(isLive()) list.forEach(l=>{ l.__v=2; });   // mark as the practice's own, not demo
    try{ localStorage.setItem('ph_locations',JSON.stringify(list)); }catch(_){}
    // Offices are shared practice-wide, so they belong in SharePoint, not one browser.
    if(window.PH_STORE) window.PH_STORE.set('ph_locations', list);
  }
  const officeNames=()=>locations().map(l=>l.n);

  function setMe(v){
    try{ localStorage.setItem('ph_viewas',v); }catch(_){}
    // If the person we just became can't open this page, don't leave them staring at it.
    const file=(location.pathname.split('/').pop()||'home.html');
    const entry=NAV.find(x=>x.href===file);
    if(entry && !entry.show()){ location.assign('home.html'); return; }
    location.reload();
  }

  const css=`
  /* Microsoft-drive file picker — shared by Documents and Admin so the two can't drift. */
  .dpbtn{background:#fff;border:1px solid #E4E8EE;border-radius:9px;padding:9px 13px;font-weight:600;
    font-size:13px;cursor:pointer;font-family:inherit;color:#0F2A4A}
  .dpbtn:hover{border-color:#149B96;color:#0F827E}
  .drivebox{border:1px solid #E4E8EE;border-radius:12px;overflow:hidden}
  .drive-h{display:flex;align-items:center;gap:8px;background:#eef3fb;color:#1f6f9e;padding:9px 12px;font-size:12.5px;font-weight:700}
  .crumb2{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:12.5px;color:#56627A;padding:8px 12px;border-bottom:1px solid #E4E8EE;background:#fafbfc}
  .crumb2 button{border:none;background:none;font-family:inherit;font-size:12.5px;font-weight:700;color:#0F827E;cursor:pointer;padding:2px 4px}
  .drivelist{max-height:230px;overflow:auto}
  .drow{display:flex;align-items:center;gap:10px;width:100%;border:none;background:none;font-family:inherit;
    text-align:left;padding:10px 13px;font-size:14px;cursor:pointer;border-bottom:1px solid #E4E8EE;color:#1F2D3D}
  .drow:last-child{border-bottom:none}
  .drow:hover{background:#E5F4F3}
  .drow .di{font-size:16px;flex:none}
  .drow .dn{flex:1;font-weight:500}
  .drow .dm{font-size:11.5px;color:#56627A}
  .picked{display:flex;align-items:flex-start;gap:11px;border:1px solid #c4e6e3;background:#E5F4F3;border-radius:10px;padding:11px 13px}
  .picked .pn{font-weight:700;color:#0F2A4A;font-size:14px}
  .picked .pp{font-size:12px;color:#0c5b57;margin-top:2px}
  .linkpill{display:inline-block;background:#fff;border:1px solid #c4e6e3;color:#0F827E;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;margin-top:6px}
  .orline{display:flex;align-items:center;gap:10px;margin:12px 0 0;color:#56627A;font-size:12px}
  .orline:before,.orline:after{content:'';flex:1;height:1px;background:#E4E8EE}
  .uploadnote{font-size:12.5px;color:#56627A;margin-top:7px;line-height:1.5}
  .dfile{display:flex;align-items:center;gap:10px;border:1px dashed #E4E8EE;border-radius:10px;padding:10px 12px;font-size:14px;color:#56627A;margin-top:8px}
  body.ph-locked .wrap > *:not(.ph-noaccess){display:none!important}
  body.ph-locked .ph-fab,body.ph-locked .tourfab,body.ph-locked #tourfab{display:none!important}
  .ph-noaccess{background:#fff;border:1px solid #E4E8EE;border-radius:16px;padding:40px 28px;text-align:center;
    max-width:520px;margin:40px auto;box-shadow:0 1px 2px rgba(15,42,74,.06),0 6px 18px rgba(15,42,74,.06)}
  .ph-noaccess .ic{font-size:34px;line-height:1}
  .ph-noaccess h2{margin:12px 0 8px;font-size:20px;color:#0F2A4A}
  .ph-noaccess p{margin:0 0 20px;font-size:14.5px;color:#56627A;line-height:1.55}
  .ph-noaccess .btn{display:inline-block;background:#149B96;color:#fff;text-decoration:none;
    border-radius:10px;padding:11px 18px;font-weight:700;font-size:14px}
  .ph-noaccess .btn:hover{background:#0F827E}
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
      (isLive() ? '' :
      '<div class="sec">Demo — sign in as</div>'+
      PEOPLE.map(x=>'<button class="'+(x.id===p.id?'cur':'')+'" onclick="PH.setMe(\''+x.id+'\')">'+
        '<span class="cir" style="width:22px;height:22px;font-size:10px;'+faceStyle(x.id===p.id?p:x)+'">'+face(x.id===p.id?p:x)+'</span>'+
        x.title.split(' · ')[0]+(x.id===p.id?'<span class="ck">✓</span>':'')+'</button>').join(''));
    document.body.appendChild(menu);
    const r=anchor.getBoundingClientRect(), m=menu.getBoundingClientRect();
    menu.style.top=(r.bottom+8)+'px';
    menu.style.left=Math.max(8,Math.min(r.right-m.width,window.innerWidth-m.width-8))+'px';
  }

  // one place that draws a person's picture: their uploaded photo if there is one, else initials
  function faceStyle(p){ return p.photo ? 'background-image:url('+p.photo+');background-size:cover;background-position:center' : 'background:'+p.color; }
  function face(p){ return p.photo ? '' : initials(p); }
  function mount(){
    const bar=document.querySelector('.hdr-in'); if(!bar)return;
    // Re-mount once the real profile lands: pages call nav()/mount() before sign-in
    // finishes, so the first paint would otherwise show a demo persona forever.
    const old=bar.querySelector('.ph-av'); if(old) old.remove();
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
          (p.photo?'':'<div class="ph-pick" style="margin-top:10px"><span style="font-size:12px;color:#56627A">No photo? Pick a color for your initials:</span>'+
            COLORS.map(c=>'<button class="ph-sw'+(c===p.color?' on':'')+'" style="background:'+c+'" onclick="PH.setColor(\''+c+'\')" title="Use this color"></button>').join('')+'</div>')+
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
    {k:'dashboard',  n:'\ud83d\udcca Production Dashboard',        href:'index.html',      show:()=>atLeast('dashboard','view')},
    {k:'production', n:'\ud83d\udcdd Enter Production',  href:'production.html', show:()=>atLeast('production','edit')},
    {k:'schedule',   n:'\ud83d\udcc5 Schedule',          href:'schedule.html',   show:()=>atLeast('schedule','view')},
    {k:'marketing',  n:'\ud83d\udce3 Marketing',         href:'marketing.html',  show:()=>atLeast('marketing','view')},
    {k:'documents',  n:'\ud83d\udcc1 Documents',         href:'documents.html',  show:()=>atLeast('documents','view')},
    {k:'team',       n:'\ud83d\udc65 Team',              href:'team.html',       show:()=>atLeast('team','view')},
    {k:'admin',      n:'\u2699\ufe0f Admin',            href:'admin.html',      show:()=>atLeast('admin','view')}
  ];
  /* Production is not a prototype. Strip the demo chrome — the amber ribbon, the
     "Viewing as" switcher, the V1 badge — so staff see an app, not a mock-up. Sandbox
     keeps all of it, because that is what it is for. */
  function impersonationBar(){
    const imp=impersonating();
    // dechrome() runs twice — once on load, once after sign-in — so both banners must be
    // idempotent or they stack.
    const existing=document.getElementById('ph-impbar');
    if(!imp || !isAdmin(realMe())){ if(existing) existing.remove(); return; }
    if(existing) return;
    const b=document.createElement('div');
    b.id='ph-impbar';
    b.style.cssText='background:#4B2E83;color:#fff;padding:8px 16px;font-size:13px;'+
      'display:flex;align-items:center;justify-content:center;gap:14px;font-weight:600';
    b.innerHTML='\u{1F441} Viewing as <b>'+((imp.first||'')+' '+(imp.last||'')).trim()+
      '</b>'+(imp.role?' \u00b7 '+imp.role:'')+
      ' <button style="font:inherit;font-weight:700;background:#fff;color:#4B2E83;border:none;'+
      'border-radius:7px;padding:4px 12px;cursor:pointer">Return to my account</button>';
    b.querySelector('button').onclick=stopViewAs;
    document.body.insertBefore(b, document.body.firstChild);
  }

  function dechrome(){
    impersonationBar();
    if(!isLive()) return;
    document.documentElement.classList.add('ph-live');
    const css=document.createElement('style');
    css.textContent='.ph-live .ribbon,.ph-live .viewas,.ph-live .v1{display:none !important}';
    document.head.appendChild(css);
    // If a person's Entra profile isn't filled in yet, say so plainly instead of
    // silently showing them an empty app.
    const m=me();
    if(document.getElementById('ph-setupbar')) return;
    if(m && m._needsSetup){
      const b=document.createElement('div');
      b.id='ph-setupbar';
      b.style.cssText='background:#FFF6E5;color:#8a5a00;border-bottom:1px solid #f0d9a8;'+
        'padding:8px 16px;font-size:13px;text-align:center';
      b.innerHTML='Your profile isn\u2019t finished yet, so you may not see everything. '+
        'Ask your administrator to set your <b>Department</b> and <b>Office location</b>.';
      document.body.insertBefore(b, document.body.firstChild);
    }
  }

  /* ---------------------------------------------------------------
     ACTIVITY — a real notification feed.
     The home page used to list invented updates. Now anything that actually changes
     records who did it, when, and which office it touched, and Home shows the entries
     the reader is allowed to see. Capped, because this is a feed, not an audit log —
     the audit trail for production numbers lives separately in ph_prodaudit.
     --------------------------------------------------------------- */
  const ACT_KEY='ph_activity', ACT_MAX=60;
  const ACT_DAYS=3;           // a feed, not an archive — three days and it drops off
  function fresh(list){
    const cut=Date.now()-ACT_DAYS*86400000;
    return (list||[]).filter(e=>e && e.at && new Date(e.at).getTime()>cut);
  }

  function activity(){
    let l=[]; try{ l=JSON.parse(localStorage.getItem(ACT_KEY)||'[]'); }catch(_){ l=[]; }
    return fresh(l);
  }
  function logActivity(e){
    if(!e || !e.title) return;
    const who=realMe();
    const entry={
      title:e.title, sec:e.sec||'', ic:e.ic||'\u{1F514}',
      scope:e.scope||'everyone',
      by:((who.first||'')+' '+(who.last||'')).trim()||'Someone',
      at:new Date().toISOString()
    };
    let list=activity();
    // Collapse a burst of edits to the same thing by the same person into one entry.
    const recent=list[0];
    if(recent && recent.title===entry.title && recent.by===entry.by &&
       (Date.now()-new Date(recent.at)) < 5*60*1000){ list[0]=entry; }
    else list.unshift(entry);
    list=fresh(list).slice(0,ACT_MAX);
    try{ localStorage.setItem(ACT_KEY,JSON.stringify(list)); }catch(_){}
    if(window.PH_STORE) window.PH_STORE.set(ACT_KEY, list);
    return list;
  }
  function loadActivity(){
    if(!window.PH_STORE || !isLive()) return Promise.resolve(activity());
    return window.PH_STORE.get(ACT_KEY).then(function(remote){
      if(Array.isArray(remote)){
        try{ localStorage.setItem(ACT_KEY,JSON.stringify(remote)); }catch(_){}
        return remote;
      }
      return activity();
    }).catch(function(){ return activity(); });
  }
  function ago(iso){
    const mins=Math.round((Date.now()-new Date(iso))/60000);
    if(mins<2) return 'just now';
    if(mins<60) return mins+' minutes ago';
    if(mins<120) return 'an hour ago';
    if(mins<1440) return Math.round(mins/60)+' hours ago';
    if(mins<2880) return 'yesterday';
    return Math.round(mins/1440)+' days ago';
  }

  /* ---------------------------------------------------------------
     PROFILE PHOTOS.
     People upload their own from My profile — most staff have never set a photo on
     their Microsoft account, so asking the directory for one would mostly return
     nothing. An upload saves to their own profile row, which syncs to SharePoint;
     this pulls everyone's rows in a single request so the Team page and Admin can
     show each other's faces.
     --------------------------------------------------------------- */
  const PHOTO_KEY='ph_photos';
  let PHOTOS=null;
  function photoCache(){
    if(PHOTOS) return PHOTOS;
    try{ PHOTOS=JSON.parse(localStorage.getItem(PHOTO_KEY))||{}; }catch(_){ PHOTOS={}; }
    return PHOTOS;
  }
  function photoFor(mail){
    const k=String(mail||'').toLowerCase().trim();
    if(!k) return '';
    // Their own row on this device first — instant after they upload.
    try{
      const own=JSON.parse(localStorage.getItem('ph_me_'+k)||'{}');
      if(own && own.photo) return own.photo;
    }catch(_){}
    return photoCache()[k] || '';
  }
  /* Pull every profile row from SharePoint so other people's photos appear too.
     Resolves true when something changed, so the caller can re-render. */
  function loadPhotos(){
    if(!window.PH_STORE || !window.PH_STORE.getAll || !isLive()) return Promise.resolve(false);
    return window.PH_STORE.getAll('ph_me_').then(function(rows){
      const cache=photoCache(); let changed=false;
      Object.keys(rows||{}).forEach(function(k){
        const mail=k.slice('ph_me_'.length);
        const v=rows[k];
        if(v && v.photo && cache[mail]!==v.photo){ cache[mail]=v.photo; changed=true; }
        // Keep each person's own row current on this device too.
        try{ if(v) localStorage.setItem(k, JSON.stringify(v)); }catch(_){}
      });
      if(changed){ try{ localStorage.setItem(PHOTO_KEY, JSON.stringify(cache)); }catch(_){} }
      return changed;
    }).catch(function(){ return false; });
  }

  function nav(active){
    const host=document.getElementById('nav')||document.querySelector('.v1nav-in');
    if(host) host.innerHTML=NAV.filter(x=>x.show()).map(x=>
      '<a href="'+x.href+'"'+(x.k===active?' class="active"':'')+'>'+x.n+'</a>').join('');
    guard(active);
  }

  /* One gate for every page.
     Hiding a tab in the nav is NOT enough — anyone can type the URL. Each page calls
     PH.nav('<key>'), so this runs everywhere for free and uses the SAME show() rule the
     nav does. The body class does the real work: even if the page's own script renders
     afterwards (or re-renders later), CSS keeps its content hidden. */
  const SECNAME={dashboard:'Production Dashboard',production:'Enter Production',schedule:'Schedule',
    marketing:'Marketing board',documents:'Documents',team:'Team directory',admin:'Admin Console'};
  function guard(active){
    const entry=NAV.find(x=>x.k===active);
    if(!entry || entry.show()){ document.body && document.body.classList.remove('ph-locked'); return true; }
    const paint=()=>{
      const wrap=document.querySelector('.wrap'); if(!wrap) return;
      document.body.classList.add('ph-locked');
      if(!wrap.querySelector('.ph-noaccess')){
        const d=document.createElement('div'); d.className='ph-noaccess';
        d.innerHTML='<div class="ic">🔒</div>'+
          '<h2>You don\'t have access to '+(SECNAME[active]||'this page')+'</h2>'+
          '<p>Access is set by your <b>team</b>. If you need this, ask an admin to add you '+
          'in <b>Admin → Teams &amp; Access</b>.</p>'+
          '<a class="btn" href="home.html">← Back to Home</a>';
        wrap.insertBefore(d,wrap.firstChild);
      }
    };
    paint();
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',paint);
    window.addEventListener('load',paint);
    return false;
  }

  /* Drop a "view only" banner at the top of a page's content. */
  function readOnlyBanner(target,what){
    const host=document.querySelector(target); if(!host||host.querySelector('.ph-ro-banner'))return;
    const d=document.createElement('div'); d.className='ph-ro-banner';
    d.innerHTML='👁 <span><b>View only.</b> You can look at the '+what+', but not change it. Ask an admin if you need to edit.</span>';
    host.insertBefore(d,host.firstChild);
  }

  /* Office colors. Lives HERE, not in schedule.html, because Marketing colors its
     items by office too and the two must never drift. Schedule owns which office has
     which color; this owns what each color actually is. */
  const PALETTE=[
    {k:'Hot Pink',           dot:'#F0378F', bg:'#FFE1EF', fg:'#A80F63'},
    {k:'Purple',             dot:'#7C3AED', bg:'#EDE7FD', fg:'#5B21B6'},
    {k:'Sky Blue',           dot:'#38BDF8', bg:'#DFF3FE', fg:'#0369A1'},
    {k:'Highlighter Orange', dot:'#F27C1A', bg:'#FFE9D3', fg:'#B45309'},
    {k:'Lime Green',         dot:'#84CC16', bg:'#ECFACC', fg:'#4D7C0F'},
    {k:'Highlighter Yellow', dot:'#FACC15', bg:'#FEF6C7', fg:'#7A5B08'},
    // Light Pink and Light Orange lived here. Each was the same hue as Hot Pink /
    // Highlighter Orange, only paler, so stacked in one day cell they read as one
    // color. Jade is the only hue the palette had real room for; Red is a spare.
    // The two offices that had them now use Jade and the unused Slate Blue.
    {k:'Jade',               dot:'#5CD6A9', bg:'#E3FDF3', fg:'#0A7F54'},
    {k:'Red',                dot:'#F31637', bg:'#FDE3E7', fg:'#8E0B1F'},
    {k:'Teal',               dot:'#14B8A6', bg:'#DBF5F1', fg:'#0F766E'},
    {k:'Slate Blue',         dot:'#475569', bg:'#E8ECF1', fg:'#334155'}
  ];
  const colorOf=c=>PALETTE.find(p=>p.k===c)||PALETTE[PALETTE.length-1];
  /* By OFFICE name, which is what Marketing has to hand. Falls back to a neutral so an
     office that has not been given a color yet still renders. */
  function colorForOffice(n){
    const l=locations().find(x=>x.n===n);
    return l ? colorOf(l.color) : {k:'',dot:'#94a3b8',bg:'#F1F5F9',fg:'#475569'};
  }

  /* WHERE ARE WE RUNNING?
       'live'    - the practice's real hub on Azure. Reads their workbook.
       'sandbox' - GitHub Pages or localhost. Demo numbers only, never real figures,
                   because that host is public.
     Anything that would expose real data must check this. */
  function env(){
    const h=location.hostname;
    if(/azurestaticapps\.net$/i.test(h)) return 'live';
    if(/^hub\./i.test(h)) return 'live';               // future custom domain
    return 'sandbox';
  }
  const isLive=()=>env()==='live';

  window.PH={PEOPLE,me,name,initials,email,face,faceStyle,can,atLeast,offices,locations,saveLocations,officeNames,drivePicker,DRIVE,setMe,mount,nav,NAV,guard,profile,pickPhoto,clearPhoto,saveProfile,setColor,closeProfile,readOnlyBanner,palette:()=>PALETTE.slice(), colorOf, colorForOffice, env, isLive, setProfile, profileOf:()=>PROFILE, dechrome, realMe, isAdmin, viewAs, stopViewAs, impersonating, personFromStaff, DEPT_CAN, logActivity, activity, loadActivity, ago, reloadAccess, reloadPeople, photoFor, loadPhotos};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
