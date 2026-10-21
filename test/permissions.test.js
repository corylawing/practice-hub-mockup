/* Who is allowed to see what, and WHEN.
       node test/permissions.test.js

   2026-09-17: a screenshot showed Selma Blaine - an external guest whose roster
   entry is Office Managers at Cruces LCO - looking at the whole navigation, Admin tab
   included.

   Nothing was wrong with how her permissions were CALCULATED. The problem was when.
   Every page calls PH.nav() as it parses; gate.js does not set the profile until Graph
   answers /me, a network round trip later. With no profile, me() fell through to the
   sandbox persona - 'admin', Heather, manage on everything - and nav() built the menu
   from that. No page ever called nav() again, so the menu and the page guard stayed as
   they were decided at parse time. The avatar was re-rendered on sign-in, which is why
   the screenshot showed the right name above the wrong menu.

   These tests assert the app is IGNORANT before sign-in, not generous. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');
const SECTIONS=['dashboard','production','schedule','marketing','documents','team','admin'];

/* Checks that must wait for the late sources (roster, access grid, people) to land. */
const later=[], tick=()=>new Promise(r=>setTimeout(r,40));

function load(opts){
  opts=opts||{};
  const LS=opts.ls||{}, listeners={};
  function El(tag){
    this.tag=tag; this.style={}; this.children=[]; this._html=''; this._t='';
    this.classes={};
  }
  El.prototype={
    classList:null,
    appendChild(c){ this.children.push(c); return c; },
    insertBefore(c){ this.children.unshift(c); return c; },
    removeChild(){}, remove(){}, setAttribute(){}, getAttribute(){ return null; },
    addEventListener(){}, querySelector(){ return null; }, querySelectorAll(){ return []; },
    get innerHTML(){ return this._html; }, set innerHTML(v){ this._html=v; },
    get textContent(){ return this._t; }, set textContent(v){ this._t=v; }
  };
  const mk=t=>{ const e=new El(t); const set={};
    e.classList={ add(c){set[c]=1}, remove(c){delete set[c]}, contains(c){return !!set[c]} };
    e._set=set; return e; };
  const navHost=mk('div'), wrap=mk('div'), body=mk('body');
  const ctx={ console,Promise,Date,JSON,Math,Object,Array,String,Number,RegExp,Set,
    isNaN,parseInt,parseFloat,setTimeout,clearTimeout,encodeURIComponent,decodeURIComponent,
    localStorage:{ getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v)}, removeItem:k=>{delete LS[k]} },
    location:{ hostname:opts.host||'kind-hill-00da87410.3.azurestaticapps.net',
               pathname:'/v1/'+(opts.page||'team')+'.html', search:'', origin:'https://x',
               assign(){}, reload(){} },
    CustomEvent:class{ constructor(t,o){ this.type=t; this.detail=o&&o.detail; } },
    document:{ readyState:'complete', documentElement:mk('html'), body:body, head:mk('head'),
      createElement:mk,
      getElementById:i=>i==='nav'?navHost:null,
      querySelector:sel=>sel==='.wrap'?wrap:null,
      querySelectorAll:()=>[],
      addEventListener:(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); },
      dispatchEvent:e=>{ (listeners[e.type]||[]).forEach(f=>f(e)); return true; } },
    window:null, navigator:{userAgent:'node'}, fetch:()=>Promise.reject(new Error('offline')) };
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
  ctx.addEventListener=ctx.document.addEventListener;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'),ctx,{filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'),ctx,{filename:'user.js'});
  return { PH:ctx.PH, LS, navHost, body, wrap, ctx,
           signIn:p=>{ ctx.PH.setProfile(p); ctx.document.dispatchEvent(new ctx.CustomEvent('ph-signed-in')); },
           tabs:()=>ctx.PH.NAV.filter(x=>x.show()).map(x=>x.k),
           menu:()=>navHost.innerHTML,
           locked:()=>body.classList.contains('ph-locked'),
           pending:()=>body.classList.contains('ph-pending') };
}

const JENNY={ displayName:'Selma Blaine', mail:null,
  userPrincipalName:'jenny_lascrucessmiles.com#EXT#@OmegaOrthodontics.onmicrosoft.com',
  jobTitle:null, department:null, officeLocation:null };

const ok=[],bad=[];
const t=(n,v)=>{ (v?ok:bad).push(n); };

/* ---- 1. Before the profile arrives, the app must know nothing. ---- */
{
  const A=load({page:'team'});
  A.PH.nav('team');
  t('before sign-in, the menu is NOT built from the admin persona',
    A.PH.me().id!=='admin');
  t('before sign-in, isAdmin() is false', A.PH.isAdmin()===false);
  t('before sign-in, no section is granted',
    SECTIONS.every(s=>A.PH.can(s)==='none'));
  t('before sign-in, no offices are granted',
    JSON.stringify(A.PH.offices())==='[]');
  t('before sign-in, the menu has no Admin link', A.menu().indexOf('admin.html')<0);
  t('before sign-in, the menu has no Enter Production link', A.menu().indexOf('production.html')<0);
}

/* ---- 2. Admin console itself is HELD until we know - not shown, and not refused.
          Refusing at parse time painted "You don't have access" for a second on every
          tab change on a phone, then unlocked (Cory, 19/09). ---- */
{
  const A=load({page:'admin'});
  A.PH.nav('admin');
  t('opening admin.html directly before sign-in holds the page', A.pending()===true && A.locked()===false);
  t('and paints no refusal while it waits', A.wrap.children.every(c=>(c.innerHTML||'').indexOf('have access')<0));
}

/* ---- 3. The menu is REBUILT when the profile lands. This is the missing re-check. ---- */
{
  const B=load({page:'team'});
  B.PH.nav('team');
  const beforeMenu=B.menu();
  B.signIn(JENNY);
  const afterMenu=B.menu();
  t('signing in rebuilds the menu', afterMenu!==beforeMenu || beforeMenu==='');
  t('Jenny is recognised', (B.PH.me().first+' '+B.PH.me().last).trim()==='Selma Blaine');
  t('Jenny is not an admin', B.PH.isAdmin()===false);
  /* My Profile prints me().teams and me().loc straight out. Pre-profile that was the
     'admin' persona, so a guest opening her own profile was shown
     "Team(s): Admin, Executive Team - Location(s): All offices". That is what Jenny
     reported on 2026-09-17 as her staff being "listed under executive". */
  t('her own profile does not show her someone else\u2019s teams',
    B.PH.me().teams.indexOf('Executive Team')<0 && B.PH.me().teams.indexOf('Admin')<0);
  t('her own profile does not show her All offices',
    String(B.PH.me().loc)!=='All offices');
  t('Jenny has no Admin tab', B.tabs().indexOf('admin')<0);
  t('Jenny has no Admin link in the rendered menu', afterMenu.indexOf('admin.html')<0);
  t('Jenny cannot manage anything', SECTIONS.every(s=>B.PH.can(s)!=='manage'));
  t('Jenny CAN still see the pages she is allowed', B.tabs().length>1);
  t('the Team page she was on is not locked for her', B.locked()===false);
  /* guard() used to only drop the lock class and leave its refusal card in the page.
     That never showed while guard ran once; now that it runs again on sign-in, every
     allowed page would open with a stale "you don't have access" above its content. */
  t('and no stale refusal card is left behind on a page she IS allowed',
    B.wrap.children.filter(c=>c._set && c._set['ph-noaccess']!==undefined).length===0 &&
    B.wrap.children.every(c=>(c.innerHTML||'').indexOf('don\u2019t have access')<0));
}

/* ---- 4. And a guest who lands on Admin is locked out once we know who they are. ---- */
{
  const C=load({page:'admin'});
  C.PH.nav('admin');
  C.signIn(JENNY);
  /* 30/09: while her team and offices are still arriving from SharePoint the page is
     HELD - "One moment" - never refused. That refusal-then-unlock was the flash on every
     tab change for new people (Melinda, San Angelo). Once they land, she is refused. */
  t('right after sign-in, while her team is still loading, admin.html is held, not refused',
    C.pending()===true && C.locked()===false && C.wrap.children.every(c=>(c.innerHTML||'').indexOf('have access')<0));
  t('and the menu she is left with has no Admin link', C.menu().indexOf('admin.html')<0);
  later.push(tick().then(()=>{
    t('Jenny on admin.html is locked out once her team has landed', C.locked()===true && C.pending()===false);
  }));
}

/* ---- 5. Impersonation must not be reachable before we know who is asking.
          isAdmin() reads realMe(), which had the same hole, so a "view as" written
          straight into localStorage was honoured for anybody. ---- */
{
  const D=load({page:'team', ls:{ ph_impersonate: JSON.stringify(
      { id:'admin', first:'Priya', last:'Tatum', title:'COO',
        can:{admin:'manage',dashboard:'view',production:'manage',schedule:'edit',
             marketing:'edit',documents:'manage',team:'view'}, offices:'all' }) }});
  t('an impersonation planted in localStorage is NOT honoured before sign-in',
    D.PH.isAdmin()===false && D.PH.can('admin')==='none');
  D.signIn(JENNY);
  t('and it is still not honoured once we know she is not an admin',
    D.PH.isAdmin()===false && D.PH.can('admin')==='none');
  t('viewAs() refuses a non-admin', D.PH.viewAs({id:'x',first:'X',last:'Y'})===false);
}

/* ---- 6. If Graph /me never answers, the app stays shut rather than opening up.
          gate.js catches that failure and carries on, which is what made this
          permanent rather than momentary. ---- */
{
  const E=load({page:'admin'});
  E.PH.nav('admin');
  E.ctx.PH_AUTH={};                                                       // signed in...
  E.ctx.document.dispatchEvent(new E.ctx.CustomEvent('ph-signed-in'));   // ...but /me gave nothing
  t('a failed /me leaves the person with no access, not full access',
    E.PH.isAdmin()===false && SECTIONS.every(s=>E.PH.can(s)==='none'));
  later.push(tick().then(()=>{
    t('and admin.html is refused, not held forever', E.locked()===true && E.pending()===false);
  }));
}

/* ---- 6b. The people who SHOULD have access must still get it. Closing a fail-open is
          only correct if it does not also shut out the practice's own admin. ---- */
{
  const H=load({page:'admin'});
  H.PH.nav('admin');
  H.signIn({ displayName:'Priya Tatum', mail:'priya@farnsworthorthodontics.com',
             userPrincipalName:'priya@farnsworthorthodontics.com',
             jobTitle:'COO', department:'Admin', officeLocation:'' });
  t('the practice COO still gets Admin', H.PH.can('admin')==='manage');
  t('the COO is still an admin', H.PH.isAdmin()===true);
  t('admin.html is NOT locked for her', H.locked()===false);
  /* Every tab - the TC Tracker included since it went live (19/10/2026, Cory: "yes on production"). */
  t('and her menu has every tab (the Academy and Payroll are sandbox mock-ups)', H.tabs().length===H.PH.NAV.filter(x=>x.k!=='academy' && x.k!=='payroll').length);
  t('the Academy mock-up never shows on the live site', H.tabs().indexOf('academy')<0);
  t('the Payroll mock-up never shows on the live site', H.tabs().indexOf('payroll')<0);
  const PY=load({page:'payroll'});
  PY.PH.nav('payroll');
  PY.signIn({ displayName:'Test Admin', mail:'test.admin@example.com', userPrincipalName:'test.admin@example.com',
              jobTitle:'COO', department:'Admin', officeLocation:'' });
  t('...and the Payroll page stays shut there, even for an admin', PY.locked()===true || PY.pending()===true);
  const AC=load({page:'academy'});
  AC.PH.nav('academy');
  AC.signIn({ displayName:'Test Admin', mail:'test.admin@example.com', userPrincipalName:'test.admin@example.com',
              jobTitle:'COO', department:'Admin', officeLocation:'' });
  t('...and its page stays shut there, even for an admin', AC.locked()===true || AC.pending()===true);
  t('the TC Tracker is on on the live site', H.PH.tcOn()===true && H.tabs().indexOf('tc')>=0);

  const BOOT=load({page:'admin'});
  BOOT.PH.nav('admin');
  BOOT.signIn({ displayName:'Cory Lawing', mail:'consult@farnsworthorthodontics.com',
                userPrincipalName:'consult@farnsworthorthodontics.com',
                jobTitle:'', department:'', officeLocation:'' });
  t('the bootstrap admin still gets in with a blank Entra record',
    BOOT.PH.isAdmin()===true && BOOT.locked()===false);

  // And an ordinary in-tenant member lands on their own team's rights, not nothing.
  const OM=load({page:'team'});
  OM.PH.nav('team');
  OM.signIn({ displayName:'Estela Ives', mail:'estela@fortholascruces.com',
              userPrincipalName:'estela@fortholascruces.com',
              jobTitle:'OM/Clinic Lead', department:'Office Managers', officeLocation:'Cruces FFO' });
  t('an office manager gets her team\u2019s rights', OM.PH.can('schedule')!=='none');
  t('an office manager gets her own office only',
    JSON.stringify(OM.PH.offices())==='["Cruces FFO"]');
  t('an office manager does NOT get Admin', OM.PH.can('admin')==='none');
}

/* ---- 6c. HOME AND DOCUMENTS RENDER THE SIGNED-IN PERSON, NOT THE DEMO ADMIN.
          Both pages were written for the sandbox persona shape and kept rendering
          PERSONAS[0] in production. Jenny saw the Administrator's tiles, clicked
          Documents, and the real page refused her. PH.asPersona() is what they render
          from now. ---- */
{
  const J=load({page:'home'});
  J.PH.nav('home');
  const before=J.PH.asPersona();
  t('before sign-in the persona has NO tiles', Object.keys(before.sec).length===0);
  t('and no document folders', Object.keys(before.doc).length===0);

  J.signIn(JENNY);
  const p=J.PH.asPersona();
  t('Jenny\u2019s persona is not the admin', p.id!=='admin' && !p.sec.admin);
  t('her tiles match exactly what she can open',
    ['dashboard','production','schedule','marketing','team','admin'].every(k=>
      (!!p.sec[k]) === (J.PH.can(k)!=='none')));
  t('her folders follow her Documents level',
    (J.PH.can('documents')==='none') ? Object.keys(p.doc).length===0 : Object.keys(p.doc).length>0);
  t('her office scope is her own, not \u201call\u201d', p.scope!=='all');
  t('it carries her teams for section audiences', Array.isArray(p.teams));

  const H=load({page:'home'});
  H.PH.nav('home');
  H.signIn({ displayName:'Priya Tatum', mail:'priya@farnsworthorthodontics.com',
             userPrincipalName:'priya@farnsworthorthodontics.com',
             jobTitle:'COO', department:'Admin', officeLocation:'' });
  const a=H.PH.asPersona();
  t('the COO\u2019s persona is the admin, sees all offices, gets the Admin tile',
    a.id==='admin' && a.scope==='all' && !!a.sec.admin);
}

/* ---- 7. The sandbox must keep working - it is the demo, and the personas live there. ---- */
{
  const S=load({ host:'corylawing.github.io', page:'team', ls:{ ph_viewas:'admin' } });
  S.PH.nav('team');
  t('sandbox still resolves its demo persona', S.PH.me().id==='admin');
  t('sandbox admin persona still has the Admin tab', S.tabs().indexOf('admin')>=0);
  t('the sandbox has the TC Tracker (sandbox first)', S.PH.tcOn()===true && S.tabs().indexOf('tc')>=0);
  const S3=load({ host:'corylawing.github.io', page:'team', ls:{ ph_viewas:'staff' } });
  S3.PH.nav('team');
  t('the sandbox shows the TC Tracker to everyone (made-up patients; the page has its own "Try it as")', S3.tabs().indexOf('tc')>=0);
  /* 13/10/2026, Cory: "give doctor Jae access to the tc in the mockup". On the sandbox a
     real person is signed in, and a doctor's team has no TC Tracker level - the tab and
     the page must still open for them there (and only there). Made-up doctor. */
  const SD=load({ host:'corylawing.github.io', page:'tc' });
  SD.PH.nav('tc');
  SD.signIn({ displayName:'Test Doctor', mail:'test.doctor@example.com', userPrincipalName:'test.doctor@example.com',
              jobTitle:'Doctor', department:'Doctors', officeLocation:'Hobbs' });
  t('a signed-in doctor on the sandbox has the TC Tracker tab and the page opens', SD.PH.can('tc')==='none' &&
    SD.tabs().indexOf('tc')>=0 && SD.locked()===false);
  const LD=load({ page:'tc' });
  LD.PH.nav('tc');
  LD.signIn({ displayName:'Test Doctor', mail:'test.doctor@example.com', userPrincipalName:'test.doctor@example.com',
              jobTitle:'Doctor', department:'Doctors', officeLocation:'Hobbs' });
  // Live: no tab, and the page is held (still learning who they are) or locked - never open.
  t('...but not on the live site', LD.tabs().indexOf('tc')<0 && (LD.locked() || LD.pending()));
  /* 17/10: before everyone gets it, an ADMIN can try it on the live site with ?tcpreview. */
  const PA=load({ page:'tc', ls:{ ph_tc_preview:'1' } });
  PA.PH.nav('tc');
  PA.signIn({ displayName:'Priya Tatum', mail:'priya@farnsworthorthodontics.com', userPrincipalName:'priya@farnsworthorthodontics.com',
              jobTitle:'COO', department:'Admin', officeLocation:'' });
  t('live preview: an admin who opened ?tcpreview gets the TC Tracker', PA.PH.tcOn()===true && PA.tabs().indexOf('tc')>=0);
  const PN=load({ page:'tc', ls:{ ph_tc_preview:'1' } });
  PN.PH.nav('tc');
  PN.signIn({ displayName:'Test Doctor', mail:'test.doctor@example.com', userPrincipalName:'test.doctor@example.com',
              jobTitle:'Doctor', department:'Doctors', officeLocation:'Hobbs' });
  t('...and on the live site a doctor (no TC Tracker level) still has no TC tab, preview flag or not', PN.tabs().indexOf('tc')<0);
  /* 19/10: live for everyone - the tab follows Teams & Access, like every other tab. Made-up people. */
  const LT=load({ page:'tc' });
  LT.PH.nav('tc');
  LT.signIn({ displayName:'Test Coordinator', mail:'test.tc@example.com', userPrincipalName:'test.tc@example.com',
              jobTitle:'Treatment Coordinator', department:'TCs', officeLocation:'Hobbs' });
  t('live: a TC has the TC Tracker tab and the page opens', LT.PH.can('tc')==='edit' && LT.tabs().indexOf('tc')>=0 && LT.locked()===false);
  const LO=load({ page:'tc' });
  LO.PH.nav('tc');
  LO.signIn({ displayName:'Test Manager', mail:'test.om@example.com', userPrincipalName:'test.om@example.com',
              jobTitle:'Office Manager', department:'Office Managers', officeLocation:'Carlsbad' });
  t('live: an office manager has it too (See)', LO.PH.can('tc')==='view' && LO.tabs().indexOf('tc')>=0 && LO.locked()===false);
  const LX=load({ page:'tc', ls:{ ph_access:JSON.stringify({'TCs':{schedule:'view',team:'view',tc:'none'}}) } });
  LX.PH.nav('tc');
  LX.signIn({ displayName:'Test Coordinator', mail:'test.tc@example.com', userPrincipalName:'test.tc@example.com',
              jobTitle:'Treatment Coordinator', department:'TCs', officeLocation:'Hobbs' });
  t('live: a team set to nothing in Teams & Access has no tab and the page stays shut', LX.tabs().indexOf('tc')<0 && (LX.locked() || LX.pending()));
  /* 17/10: SharePoint access to the TC Tracker's patient folder follows Teams & Access. */
  const R=PA.PH.tcRoleFor;
  t('TC folder access: admins and Log + calls / Everything = edit, See = read, nothing = nothing',
    R(['Admin'])==='write' && R(['TCs'])==='write' && R(['Leadership Team'])==='write' && R(['Executive Team'])==='write' &&
    R(['Office Managers'])==='read' && R(['Staff'])==='' && R(['Doctors'])==='' && R([])==='');
  t('...two teams get the better of the two (an OM who is also a TC can edit)', R(['Office Managers','TCs'])==='write');
  const PG=load({ page:'tc', ls:{ ph_access:JSON.stringify({'TCs':{schedule:'view',team:'view',tc:'none'}, 'Office Managers':{schedule:'edit',team:'view'}}) } });
  t('...and a team taken off in Teams & Access loses it (a saved row without the column = nothing)',
    PG.PH.tcRoleFor(['TCs'])==='' && PG.PH.tcRoleFor(['Office Managers'])==='');
  const S2=load({ host:'corylawing.github.io', page:'team', ls:{ ph_viewas:'doctor' } });
  S2.PH.nav('team');
  t('sandbox honours the chosen persona', S2.PH.me().id==='doctor');
  t('a sandbox doctor does NOT get the Admin tab', S2.tabs().indexOf('admin')<0);
}

Promise.all(later).then(()=>{
  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
});
