/* COLOUR SCHEMES - readable whatever a person picks, and only for that person.

       node test/theme.test.js

   25/09/2026. Cory: "for the user in their profile to change the colors of the practice
   hub. It needs to be smart. We should provide color schemes." / "default is what we have
   already". Every shade in a scheme is worked out from two colours in user.js and its
   contrast is checked there; these tests hold it to that, and to the default being the
   pages' own colours with nothing laid over them. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');

function load(LS){
  LS=LS||{}; const listeners={};
  const style={props:{}, setProperty(k,v){ this.props[k]=v; }, removeProperty(k){ delete this.props[k]; }, getPropertyValue(k){ return this.props[k]||''; }};
  const mk=()=>({style:{},classList:{add(){},remove(){},contains(){return false}},children:[],attrs:{},
    appendChild(c){this.children.push(c);return c}, remove(){}, setAttribute(k,v){this.attrs[k]=v}, getAttribute(k){return this.attrs[k]},
    querySelector(){return null}, querySelectorAll(){return []}, addEventListener(){}, insertBefore(){},
    set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''}, set textContent(v){this._t=v}, get textContent(){return this._t||''}});
  const root=mk(); root.style=style;
  const head=mk(); let meta=null;
  const ctx={console,Promise,Date,JSON,Math,Object,Array,String,Number,RegExp,Set,isNaN,parseInt,parseFloat,setTimeout,clearTimeout,
    encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]}},
    location:{hostname:'corylawing.github.io',pathname:'/v1/home.html',search:''},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{readyState:'complete',documentElement:root,body:mk(),head,createElement:()=>{ const m=mk(); meta=meta||m; return m; },
      getElementById:()=>null, querySelector:q=>(/theme-color/.test(q)?meta:null), querySelectorAll:()=>[],
      addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},
      dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true}},
    navigator:{userAgent:'node'}, fetch:()=>Promise.reject(new Error('offline'))};
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'),ctx,{filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'),ctx,{filename:'user.js'});
  return {PH:ctx.PH, LS, root, style, meta:()=>meta, fire:t=>ctx.document.dispatchEvent(new ctx.CustomEvent(t))};
}
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };

const A=load();
const C=A.PH.contrast, W='#FFFFFF';
t('eight schemes, the first is Home-Brace', A.PH.themes().length===8 && A.PH.themes()[0].k==='homebrace');

// 1. Readable, whatever is picked.
A.PH.themes().forEach(th=>{
  if(th.k==='homebrace') return;
  const k=A.PH.schemeTokens(th.k);
  t(th.n+': white on the header is at least 7:1', C(W,k['--navy'])>=7);
  t(th.n+': quiet text on the header is at least 4.5:1', C(k['--navy-mute'],k['--navy'])>=4.5);
  t(th.n+': white on a button is at least 3:1', C(W,k['--teal'])>=3);
  t(th.n+': accent text on white is at least 4.5:1', C(k['--teal-600'],W)>=4.5);
  t(th.n+': text on a tinted panel is at least 7:1', C(k['--teal-ink'],k['--teal-soft'])>=7);
});
const hc=A.PH.schemeTokens('contrast');
t('High contrast: body text on the page is at least 15:1', C(hc['--ink'],hc['--canvas'])>=15);
t('High contrast: secondary text is at least 9:1', C(hc['--soft'],hc['--canvas'])>=9);

// 2. The default IS what the pages already are: nothing laid over them.
t('with nothing chosen, Home-Brace is on and no colour is overridden', A.PH.theme()==='homebrace' && Object.keys(A.style.props).length===0);
A.PH.setTheme('plum');
t('choosing a scheme overrides the hub colours', A.PH.theme()==='plum' && !!A.style.props['--navy'] && !!A.style.props['--teal']);
t('the phone address bar takes the header colour', A.meta() && A.meta().attrs.content===A.style.props['--navy']);
t('it is remembered on this device', A.LS.ph_theme==='plum');
t('and saved in the person’s own profile row', Object.keys(A.LS).some(k=>k.indexOf('ph_me_')===0 && /"theme":"plum"/.test(A.LS[k])));
A.PH.setTheme('homebrace');
t('going back to Home-Brace removes every override', Object.keys(A.style.props).length===0 && A.meta().attrs.content==='#0F2A4A');
A.PH.setTheme('no-such-scheme');
t('an unknown scheme falls back to Home-Brace', A.PH.theme()==='homebrace' && Object.keys(A.style.props).length===0);

// 3. Only the hub's own colours: office colours and initials colours never move.
const officesBefore=JSON.stringify(A.PH.palette());
A.PH.setTheme('terracotta');
t('office colours on the schedule are the same under any scheme', JSON.stringify(A.PH.palette())===officesBefore);
A.PH.setTheme('homebrace');

// 4. Applied from the device before the page draws.
const B=load({ph_theme:'evergreen'});
t('a device that has a scheme puts it on as the page loads', B.PH.theme()==='evergreen' && !!B.style.props['--navy']);

// 5. A shared front-desk computer: the cached scheme is somebody else's.
const SHARED={ph_theme:'rose'};
const D=load(SHARED);
const key=Object.keys(D.LS).find(k=>k.indexOf('ph_me_')===0) || null;
const me='ph_me_'+'admin';                                 // the sandbox persona's own row
D.LS[me]=JSON.stringify({preferred:'Jess'});               // this person never picked a scheme
D.fire('ph-signed-in');
t('when a person with no scheme signs in, the previous person’s scheme goes', D.PH.theme()==='homebrace' && D.LS.ph_theme==='homebrace');
D.LS[me]=JSON.stringify({preferred:'Jess', theme:'graphite'});
D.fire('ph-signed-in');
t('and a person’s own scheme comes back when they sign in', D.PH.theme()==='graphite');

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
