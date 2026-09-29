/* FEEDBACK - one message, one row, and Cory can tell what the person was looking at.

       node test/feedback.test.js

   29/09/2026. Cory: "I'm going to need a way to collect feedback ... collected with
   information on user, what screen they were on, etc and forwarded to me by email."
   The round button bottom-right offers the tour or Send feedback. The message becomes a
   new row on the HomeBraceFeedback list and a Power Automate flow emails it to him.
   These hold store.js to writing exactly that row (and nothing on HomeBraceData), to
   saying plainly when the list is not there yet, and user.js to a readable email. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };

/* ---- store.js against a stand-in SharePoint ---- */
function Store({live=true, lists=['HomeBraceData','HomeBraceFeedback'], fail=[]}={}){
  const calls=[];
  const resp=(status,body)=>({status, ok:status<300, headers:{get:()=>null}, json:()=>Promise.resolve(body)});
  const ctx={console,Promise,JSON,Math,Date,Object,Array,String,Number,Error,RegExp,TypeError,Uint8Array,setTimeout,clearTimeout,
    localStorage:{getItem:()=>null,setItem(){},removeItem(){},key:()=>null,length:0},
    document:{addEventListener(){},dispatchEvent(){return true;}},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    PH:{isLive:()=>live},
    PH_AUTH:{account:{username:'jess@x.com',name:'Jess'},token:()=>Promise.resolve('t'),
      graph:async p=>{ calls.push(['GET',p]);
        if(/\/sites\/omega/.test(p)) return {id:'site'};
        if(/\/lists\?/.test(p)) return {value:lists.map(n=>({id:n==='HomeBraceData'?'L':'F',displayName:n}))};
        throw new Error('unexpected read '+p); }},
    fetch:async (url,o)=>{ calls.push([o.method,url,o.body?JSON.parse(o.body):null]);
      const f=fail.shift(); return f?resp(f,{error:{message:'busy'}}):resp(201,{id:'9'}); }};
  ctx.window=ctx; ctx.globalThis=ctx;
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(V1,'store.js'),'utf8'),ctx,{filename:'store.js'});
  ctx.PH_STORE.setRetryWaits([2,2,2]); ctx.PH_STORE.setAutoResend(false);
  return {S:ctx.PH_STORE, calls, posts:()=>calls.filter(c=>c[0]==='POST')};
}
const ROW={Title:'Idea: bigger buttons \u2014 Jess, Schedule', Details:'IDEA\nbigger buttons\n\nFrom: Jess'};

(async()=>{
  { const B=Store({live:false}); const r=await B.S.addFeedback(ROW);
    t('sandbox: nothing is sent, and it says so', r&&r.sandbox===true && B.calls.length===0); }

  { const B=Store(); await B.S.addFeedback(ROW); const p=B.posts();
    t('live: exactly one new row', p.length===1);
    t('live: on HomeBraceFeedback, not on HomeBraceData', p[0]&&/\/sites\/site\/lists\/F\/items$/.test(p[0][1]));
    t('live: the row is Title + Details, as typed', p[0]&&p[0][2].fields.Title===ROW.Title && p[0][2].fields.Details===ROW.Details);
    const looks=()=>B.calls.filter(c=>/\/lists\?/.test(c[1])).length, before=looks();
    await B.S.addFeedback(ROW);
    t('a second message does not look the list up again', looks()===before && B.posts().length===2); }

  { const B=Store({lists:['HomeBraceData']}); let e=null; try{ await B.S.addFeedback(ROW); }catch(x){ e=x; }
    t('list not made yet: refused as missingList, so the form can say "not switched on yet"', e&&e.missingList===true);
    t('list not made yet: nothing written anywhere', B.posts().length===0); }

  { const B=Store({fail:[503]}); await B.S.addFeedback(ROW);
    t('SharePoint busy once: tried again, and one row landed', B.posts().length===2); }

  { const B=Store({fail:[400]}); let e=null; try{ await B.S.addFeedback(ROW); }catch(x){ e=x; }
    t('a real refusal comes back as a failure (the form keeps the text)', e && !e.missingList && B.posts().length===1); }

  /* ---- user.js: what the email says ---- */
  const LS={}, listeners={};
  const mk=()=>({style:{setProperty(){},removeProperty(){},getPropertyValue(){return ''}},classList:{add(){},remove(){},contains(){return false}},children:[],attrs:{},
    appendChild(c){this.children.push(c);return c}, remove(){}, setAttribute(k,v){this.attrs[k]=v}, getAttribute(k){return this.attrs[k]},
    querySelector(){return null}, querySelectorAll(){return []}, addEventListener(){}, insertBefore(){}});
  const ctx={console,Promise,Date,JSON,Math,Object,Array,String,Number,RegExp,Set,isNaN,parseInt,parseFloat,setTimeout,clearTimeout,
    encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]}},
    location:{hostname:'corylawing.github.io',pathname:'/v1/schedule.html',search:'',href:'https://corylawing.github.io/v1/schedule.html'},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{readyState:'complete',documentElement:mk(),body:mk(),head:mk(),createElement:()=>mk(),
      getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
      addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)}, dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true}},
    navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', onLine:true},
    innerWidth:390, innerHeight:844, fetch:()=>Promise.reject(new Error('offline'))};
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'),ctx,{filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'),ctx,{filename:'user.js'});
  const PH=ctx.PH;
  t('PH.feedback is there for the button to call', typeof PH.feedback==='function' && typeof PH.feedbackText==='function');

  const C={name:'Jessica Lynch', email:'jessica@farnsworthorthodontics.com', role:'CSO', teams:'Leadership', offices:'All offices',
    page:'Schedule', url:'https://kind-hill/v1/schedule.html', looking:['Office: Carlsbad','Month'], device:'Phone \u00b7 Safari 18 on iPhone \u00b7 390\u00d7844',
    version:'hc57', colors:'Blush', online:true, trouble:[], when:'Tue Sep 29'};
  const A=PH.feedbackText(C,'problem','The 2027 dates will not save.\nTried twice.');
  t('the subject says what kind, the start of it, who, and which page',
    A.Title==='Something\u2019s wrong: The 2027 dates will not save. Tried twice. \u2014 Jessica Lynch, Schedule');
  t('the body starts with the kind and the message exactly as written', A.Details.indexOf('SOMETHING\u2019S WRONG\nThe 2027 dates will not save.\nTried twice.\n\n')===0);
  ['From: Jessica Lynch <jessica@farnsworthorthodontics.com>','Role: CSO','Team: Leadership','Offices: All offices','Page: Schedule',
   'Had open: Office: Carlsbad \u00b7 Month','Link: https://kind-hill/v1/schedule.html','Device: Phone \u00b7 Safari 18 on iPhone \u00b7 390\u00d7844',
   'Home-Brace version: hc57 \u00b7 Colors: Blush','Recent errors on this page: none','Sent: Tue Sep 29']
    .forEach(l=>t('the body has "'+l+'"', A.Details.split('\n').indexOf(l)>=0));
  const long=PH.feedbackText(C,'idea','x'.repeat(500));
  t('a long message is cut in the subject, never in the body', long.Title.length<=250 && /\u2026 \u2014 Jessica Lynch, Schedule$/.test(long.Title) && long.Details.indexOf('x'.repeat(500))>0);
  const bare=PH.feedbackText({page:'Home', when:'now'},'nonsense','hi');
  t('an unknown kind is just "Feedback", and someone unknown is "Someone"', bare.Title==='Feedback: hi \u2014 Someone, Home');
  t('nothing blank is listed (no empty "Role:" line)', !/^(Role|Team|Offices|Had open|Link|Device):\s*$/m.test(bare.Details));
  const err=PH.feedbackText(Object.assign({},C,{trouble:['2:14 PM  A save did not reach SharePoint (ph_sched2)'], viewingAs:'Haley Smith', online:false}),'question','?');
  t('recent errors are listed under their heading', err.Details.indexOf('Recent errors on this page: \n  2:14 PM  A save did not reach SharePoint (ph_sched2)')>0);
  t('an admin viewing as someone is named, with who they were viewing as', err.Details.split('\n').indexOf('Was viewing as: Haley Smith')>0);
  t('written offline is said', err.Details.split('\n').indexOf('Connection: offline when it was written')>0);
  const live=PH.feedbackContext();
  t('the context knows the page from the address', live.page==='Schedule');
  t('the context reads the device from the browser', /^Phone \u00b7 Safari 18 on iPhone \u00b7 390\u00d7844$/.test(live.device));
  t('the context carries no phone number or date of birth', !('phone' in live) && !('dob' in live) && !/phone:|dob/i.test(JSON.stringify(live)));

  /* ---- the form's and the menu's class names are not ones a page already styles ---- */
  const src=fs.readFileSync(path.join(V1,'user.js'),'utf8')+fs.readFileSync(path.join(V1,'tour.js'),'utf8');
  const classes=[...new Set([...src.matchAll(/\b(phfb-[\w-]+|tour-menu|tour-mi|tmi-ic)\b/g)].map(m=>m[1]))];
  const clashes=[];
  ['home','index','production','schedule','marketing','documents','team','admin'].forEach(pg=>{
    const css=(fs.readFileSync(path.join(V1,pg+'.html'),'utf8').match(/<style[^>]*>[\s\S]*?<\/style>/g)||[]).join('\n');
    classes.forEach(c=>{ if(new RegExp('\\.'+c.replace(/-/g,'\\-')+'(?![\\w-])').test(css)) clashes.push(pg+': .'+c); });
  });
  t('the form and menu class names were found ('+classes.length+')', classes.length>=15);
  t('no page styles any of them'+(clashes.length?' - '+clashes.join(', '):''), clashes.length===0);

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log((ok.length)+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('  FAIL  crashed: '+(e&&e.stack||e)); console.log('0 passed, 1 failed'); process.exit(1); });
