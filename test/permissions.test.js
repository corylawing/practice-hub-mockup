/* Who is allowed to see what, and WHEN.
       node test/permissions.test.js

   2026-09-17: a screenshot showed Jenny Whitefield - an external guest whose roster
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
           locked:()=>body.classList.contains('ph-locked') };
}

const JENNY={ displayName:'Jenny Whitefield', mail:null,
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

/* ---- 2. Admin console itself is locked until we know. ---- */
{
  const A=load({page:'admin'});
  A.PH.nav('admin');
  t('opening admin.html directly before sign-in locks the page', A.locked()===true);
}

/* ---- 3. The menu is REBUILT when the profile lands. This is the missing re-check. ---- */
{
  const B=load({page:'team'});
  B.PH.nav('team');
  const beforeMenu=B.menu();
  B.signIn(JENNY);
  const afterMenu=B.menu();
  t('signing in rebuilds the menu', afterMenu!==beforeMenu || beforeMenu==='');
  t('Jenny is recognised', (B.PH.me().first+' '+B.PH.me().last).trim()==='Jenny Whitefield');
  t('Jenny is not an admin', B.PH.isAdmin()===false);
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
  t('Jenny on admin.html is locked out after sign-in', C.locked()===true);
  t('and the menu she is left with has no Admin link', C.menu().indexOf('admin.html')<0);
}

/* ---- 5. Impersonation must not be reachable before we know who is asking.
          isAdmin() reads realMe(), which had the same hole, so a "view as" written
          straight into localStorage was honoured for anybody. ---- */
{
  const D=load({page:'team', ls:{ ph_impersonate: JSON.stringify(
      { id:'admin', first:'Heather', last:'Beal', title:'COO',
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
  E.ctx.document.dispatchEvent(new E.ctx.CustomEvent('ph-signed-in'));   // no setProfile
  t('a failed /me leaves the person with no access, not full access',
    E.PH.isAdmin()===false && SECTIONS.every(s=>E.PH.can(s)==='none'));
  t('and admin.html stays locked', E.locked()===true);
}

/* ---- 6b. The people who SHOULD have access must still get it. Closing a fail-open is
          only correct if it does not also shut out the practice's own admin. ---- */
{
  const H=load({page:'admin'});
  H.PH.nav('admin');
  H.signIn({ displayName:'Heather Beal', mail:'heather@farnsworthorthodontics.com',
             userPrincipalName:'heather@farnsworthorthodontics.com',
             jobTitle:'COO', department:'Admin', officeLocation:'' });
  t('the practice COO still gets Admin', H.PH.can('admin')==='manage');
  t('the COO is still an admin', H.PH.isAdmin()===true);
  t('admin.html is NOT locked for her', H.locked()===false);
  t('and her menu still has every tab', H.tabs().length===H.PH.NAV.length);

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
  OM.signIn({ displayName:'Suzy Brown', mail:'suzy@fortholascruces.com',
              userPrincipalName:'suzy@fortholascruces.com',
              jobTitle:'OM/Clinic Lead', department:'Office Managers', officeLocation:'Cruces FFO' });
  t('an office manager gets her team\u2019s rights', OM.PH.can('schedule')!=='none');
  t('an office manager gets her own office only',
    JSON.stringify(OM.PH.offices())==='["Cruces FFO"]');
  t('an office manager does NOT get Admin', OM.PH.can('admin')==='none');
}

/* ---- 7. The sandbox must keep working - it is the demo, and the personas live there. ---- */
{
  const S=load({ host:'corylawing.github.io', page:'team', ls:{ ph_viewas:'admin' } });
  S.PH.nav('team');
  t('sandbox still resolves its demo persona', S.PH.me().id==='admin');
  t('sandbox admin persona still has the Admin tab', S.tabs().indexOf('admin')>=0);
  const S2=load({ host:'corylawing.github.io', page:'team', ls:{ ph_viewas:'doctor' } });
  S2.PH.nav('team');
  t('sandbox honours the chosen persona', S2.PH.me().id==='doctor');
  t('a sandbox doctor does NOT get the Admin tab', S2.tabs().indexOf('admin')<0);
}

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
