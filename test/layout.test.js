/* MENU LAYOUT - tabs across the top (as today) or a sidebar on the left, per person.

       node test/layout.test.js

   19/10/2026. Cory: "add in profile settings for desktop if they want the different tabs on
   the top like they are today, or like a more modern app the side bar is on the left".
   Held to the same rules as the colours: nothing changes for anyone who doesn't choose it,
   it is applied before the page draws, it is the person's own (a shared front-desk computer
   shows each person theirs), and phones keep their bottom bar. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');
const SRC=fs.readFileSync(path.join(V1,'user.js'),'utf8');

function load(LS, opts){
  LS=LS||{}; opts=opts||{}; const listeners={};
  const mk=tag=>{ const cls=new Set();
    return {tag, style:{setProperty(){}, removeProperty(){}}, children:[], attrs:{},
      classList:{add:c=>cls.add(c), remove:c=>cls.delete(c), contains:c=>cls.has(c), toggle:(c,on)=>{ (on===undefined?!cls.has(c):on)?cls.add(c):cls.delete(c); }},
      get className(){ return [...cls].join(' '); }, set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c=>cls.add(c)); },
      appendChild(c){ this.children.push(c); return c; }, remove(){}, setAttribute(k,v){ this.attrs[k]=v; }, getAttribute(k){ return this.attrs[k]; },
      querySelector(){ return null; }, querySelectorAll(){ return []; }, addEventListener(){}, insertBefore(){},
      set innerHTML(v){ this._h=v; }, get innerHTML(){ return this._h||''; }, set textContent(v){ this._t=v; }, get textContent(){ return this._t||''; }};
  };
  const root=mk('html'), body=mk('body'), head=mk('head'), menu=mk('nav');
  const made=[];
  const find=q=>{
    if(q==='.v1nav') return opts.noMenu ? null : menu;
    if(q==='.ph-sidenav') return made.find(e=>e.classList.contains('ph-sidenav'))||null;
    if(q==='.ph-tabbar') return made.find(e=>e.classList.contains('ph-tabbar'))||null;
    return null;
  };
  const ctx={console,Promise,Date,JSON,Math,Object,Array,String,Number,RegExp,Set,isNaN,parseInt,parseFloat,setTimeout,clearTimeout,
    encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]}},
    location:{hostname:'corylawing.github.io',pathname:'/v1/tc.html',search:''},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{readyState:'complete',documentElement:root,body,head,createElement:t=>{ const m=mk(t); made.push(m); return m; },
      getElementById:()=>null, querySelector:find, querySelectorAll:()=>[],
      addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},
      dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true}},
    navigator:{userAgent:'node'}, fetch:()=>Promise.reject(new Error('offline'))};
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'),ctx,{filename:'_staff.js'});
  vm.runInContext(SRC,ctx,{filename:'user.js'});
  return {PH:ctx.PH, LS, root, side:()=>find('.ph-sidenav'), fire:t=>ctx.document.dispatchEvent(new ctx.CustomEvent(t))};
}
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const ROW='ph_me_admin';                                           // the sandbox persona's own row

// 1. Nothing changes for anyone who doesn't choose it.
const A=load();
t('two choices: tabs across the top (first), sidebar on the left', JSON.stringify(A.PH.layouts().map(l=>l.k))==='["top","side"]');
t('with nothing chosen it is the tabs, as today', A.PH.layout()==='top' && !A.root.classList.contains('ph-lay-side'));

// 2. Choosing the sidebar.
A.PH.nav('tc');
A.PH.setLayout('side');
t('choosing the sidebar switches the page at once', A.PH.layout()==='side' && A.root.classList.contains('ph-lay-side'));
t('it is remembered on this device', A.LS.ph_layout==='side');
t('and saved in the person\u2019s own row (theirs on any computer)', /"layout":"side"/.test(A.LS[ROW]||''));
const html=(A.side()||{}).innerHTML||'';
const want=A.PH.NAV.filter(x=>x.show()).map(x=>x.href);
const got=[...html.matchAll(/<nav class="ph-sb-list">([\s\S]*)<\/nav>/g)].map(m=>[...m[1].matchAll(/href="([^"]+)"/g)].map(x=>x[1]))[0]||[];
t('the sidebar lists exactly the tabs this person has, in the same order', want.length>3 && JSON.stringify(got)===JSON.stringify(want));
t('the page you are on is marked', /<a href="tc\.html" class="active" aria-current="page">/.test(html));
t('the logo at the top takes you Home', /class="ph-sb-brand" href="home\.html"/.test(html));
t('full names, not the phone bar\u2019s short ones', />Production Dashboard</.test(html) && />Enter Production</.test(html));
A.PH.setLayout('top');
t('back to tabs undoes it, here and in their row', A.PH.layout()==='top' && !A.root.classList.contains('ph-lay-side') &&
  A.LS.ph_layout==='top' && /"layout":"top"/.test(A.LS[ROW]||''));
A.PH.setLayout('sideways');
t('anything unknown is the tabs', A.PH.layout()==='top' && !A.root.classList.contains('ph-lay-side'));

// 3. Before the page draws: no flash of the tabs first.
const B=load({ph_layout:'side'});
t('a computer that has the sidebar puts it on as the page loads', B.PH.layout()==='side' && B.root.classList.contains('ph-lay-side'));

// 4. A shared front-desk computer: the layout on the device is the last person's.
const D=load({ph_layout:'side'});
D.LS[ROW]=JSON.stringify({preferred:'Jess'});                     // this person never chose one
D.fire('ph-signed-in');
t('when a person who never chose signs in, the last person\u2019s sidebar goes', D.PH.layout()==='top' && D.LS.ph_layout==='top' && !D.root.classList.contains('ph-lay-side'));
D.LS[ROW]=JSON.stringify({preferred:'Jess', layout:'side'});
D.fire('ph-signed-in');
t('and a person\u2019s own sidebar comes back when they sign in', D.PH.layout()==='side' && D.root.classList.contains('ph-lay-side'));

// 5. Pages without the menu (sign-in, restore, history) never get a sidebar.
const E=load({ph_layout:'side'}, {noMenu:true});
E.PH.nav('home');
t('no menu on the page, no sidebar made', !E.side());

// 6. The styles: computers only, and only on pages with the menu.
{
  const css=SRC.slice(SRC.indexOf('SIDEBAR MENU, for whoever picks it'), SRC.indexOf('the choice, in the profile'));
  const media=css.slice(css.indexOf('@media(min-width:960px){'));
  const block=media.slice(0, media.indexOf('\n  }\n'));
  t('the sidebar is hidden unless switched on', /\.ph-sidenav\{display:none\}/.test(css));
  t('everything that moves the page sits inside the 960px-and-wider rule (phones keep their bar)',
    /padding-left:248px/.test(block) && /\.v1nav\{display:none !important\}/.test(block) && /\.ph-sidenav\{display:flex/.test(block) &&
    !/padding-left:248px/.test(css.replace(block,'')));
  t('only pages with the menu make room for it', /html\.ph-lay-side body:has\(\.v1nav\)\{padding-left:248px\}/.test(block));
  t('the blue top bar goes: search, bell and name sit at the foot of the sidebar (computers only)',
    /body:has\(\.v1nav\) \.hdr\{position:fixed;left:0;bottom:0;width:248px/.test(block) && /\.hdr \.brand,[\s\S]*\.hdr \.v1\{display:none\}/.test(block) &&
    /\.hdr \.ph-np\{top:auto;bottom:calc\(100% \+ 10px\)/.test(block) && !/\.hdr\{position:fixed/.test(css.replace(block,'')));
  t('the name menu opens upwards when there is no room below', /r\.bottom\+8\+m\.height<=window\.innerHeight-8 \? r\.bottom\+8 : Math\.max\(8, r\.top-8-m\.height\)/.test(SRC));
  t('it sits under every pop-up and dialog (they start at 50)', /z-index:45/.test(block));
}

// 7. Class names no page already styles (the colour picker once borrowed "sw" - Cory's screenshot, 25/09).
{
  const body=SRC.slice(SRC.indexOf('function setLayout'), SRC.indexOf('function themePicker'))+
             SRC.slice(SRC.indexOf('function sidenav'), SRC.indexOf('const TAB_MAX'));
  const classes=[...new Set([...body.matchAll(/class="([^"']+)/g)].flatMap(m=>m[1].split(/\s+/)))]
    .filter(c=>c && c!=='on' && c!=='active' && !/^ph-th/.test(c) && !/['+]/.test(c)).concat(['ph-sidenav']);
  const clashes=[];
  fs.readdirSync(V1).filter(f=>/\.html$/.test(f)).forEach(pg=>{
    const css=(fs.readFileSync(path.join(V1,pg),'utf8').match(/<style[^>]*>[\s\S]*?<\/style>/g)||[]).join('\n');
    classes.forEach(c=>{ if(new RegExp('\\.'+c.replace(/-/g,'\\-')+'(?![\\w-])').test(css)) clashes.push(pg+': .'+c); });
  });
  t('found the new class names ('+classes.length+')', classes.length>=6);
  t('no page styles any of them'+(clashes.length?' - '+clashes.join(', '):''), clashes.length===0);
}

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
