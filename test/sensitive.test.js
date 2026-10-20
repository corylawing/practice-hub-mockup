/* SENSITIVE MATERIAL - who may open it, and the double confirmation.

       node test/sensitive.test.js

   20/10/2026. Cory: "another Folder in Documents called Sensitive Material. Which needs a double
   confirmation from any admin when adding a team or a specific user to that folder. This is meant
   to hold doctor sensitive info" and (his correction) "company sensitive information". Decided with him: every admin sees
   it; adding a team or a person = a warning, then the admin types the name back. These check the
   rules in user.js, and that Admin and Documents use them. Made-up people only. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');

function load(LS){
  LS=LS||{}; const listeners={};
  const mk=()=>{ const cls=new Set(); return {style:{setProperty(){},removeProperty(){}}, children:[], attrs:{},
    classList:{add:c=>cls.add(c), remove:c=>cls.delete(c), contains:c=>cls.has(c)},
    appendChild(c){ this.children.push(c); return c; }, remove(){}, setAttribute(k,v){ this.attrs[k]=v; }, getAttribute(k){ return this.attrs[k]; },
    querySelector(){ return null; }, querySelectorAll(){ return []; }, addEventListener(){}, insertBefore(){},
    set innerHTML(v){ this._h=v; }, get innerHTML(){ return this._h||''; }, set textContent(v){ this._t=v; }, get textContent(){ return this._t||''; }}; };
  const ctx={console,Promise,Date,JSON,Math,Object,Array,String,Number,RegExp,Set,isNaN,parseInt,parseFloat,setTimeout,clearTimeout,
    encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]}},
    location:{hostname:'corylawing.github.io',pathname:'/v1/documents.html',search:''},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{readyState:'complete',documentElement:mk(),body:mk(),head:mk(),createElement:()=>mk(),
      getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
      addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},
      dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true}},
    navigator:{userAgent:'node'}, fetch:()=>Promise.reject(new Error('offline'))};
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'),ctx,{filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'),ctx,{filename:'user.js'});
  return ctx.PH;
}
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const PH=load();
const L=PH.sensLevelFor;
const REC={ teams:{'Leadership Team':'view', 'Doctors':'edit'},
            people:{'office.helper@example.com':{level:'view', name:'Office Helper'}, 'board.member@example.com':{level:'edit', name:'Board Member'}} };
const who=(teams, mail, admin)=>({teams, mail:mail||'', can:{admin:admin?'manage':'none'}});

// 1. Who may open it
t('every admin, automatically - even with nothing on the list', L(who(['Admin'],'', true), {})==='manage');
t('a team on the list gets that team’s level', L(who(['Leadership Team']), REC)==='view' && L(who(['Doctors']), REC)==='edit');
t('team names match whatever the capitals', L(who(['leadership team']), REC)==='view');
t('a person on the list by their email', L(who(['Front Desk'], 'office.helper@example.com'), REC)==='view');
t('the email matches whatever the capitals', L(who(['Front Desk'], 'Office.Helper@Example.com'), REC)==='view');
t('two ways in: the better one wins', L(who(['Leadership Team'], 'board.member@example.com'), REC)==='edit');
t('nobody else - not a team off the list, not a stranger', L(who(['Front Desk'], 'someone@example.com'), REC)==='' && L(who([], ''), REC)==='');
t('an empty or missing list lets only admins in', L(who(['Doctors']), {})==='' && L(who(['Doctors']), null)==='');
t('an old-style entry (just the level) still counts', L(who([], 'x@example.com'), {people:{'x@example.com':'edit'}})==='edit');
t('a level that isn’t one of the two never opens anything', L(who(['Doctors']), {teams:{'Doctors':'owner'}})==='');

// 2. The double confirmation: the name typed back
const C=PH.sensConfirmOk;
t('typing the exact name confirms', C('Leadership Team','Leadership Team'));
t('capitals and extra spaces don’t matter', C('  leadership   TEAM ','Leadership Team'));
t('a different name never confirms', !C('Leadership','Leadership Team') && !C('Leadership Teams','Leadership Team'));
t('nothing typed, or nothing to match, never confirms', !C('','Leadership Team') && !C('x','') && !C(null,undefined));

// 3. Admin and Documents use these rules - and nothing in them deletes a file
{
  const admin=fs.readFileSync(path.join(V1,'admin.html'),'utf8'), docs=fs.readFileSync(path.join(V1,'documents.html'),'utf8');
  const userjs=fs.readFileSync(path.join(V1,'user.js'),'utf8');
  t('Admin asks for the typed name before giving access, and checks it again when saving',
    (admin.match(/PH\.sensConfirmOk\(/g)||[]).length>=3 && /if\(widen && !PH\.sensConfirmOk\(d\.typed, who\.name\)\) return;/.test(admin));
  t('every addition is written to the history (who, when, what)', /\{what:d\.mode==='add'\?'added':'changed', kind, who:name, level\}/.test(admin) && /next\.log\.unshift/.test(admin));
  t('Sensitive Material is never in the Teams & Access grid (one way to give it)', !/k:'sensitive'/.test(admin.slice(admin.indexOf('const TOOLS=['), admin.indexOf('const DEFAULT_DOCSECS'))));
  t('a regular section can’t take its name', /==='sensitive material'/.test(admin));
  t('Documents adds nothing until the lock is confirmed', /const shut=s\.sensitive && !sensLocked\(\);/.test(docs) && /if\(sr\.s\.sensitive && !sensLocked\(\)\) return;/.test(docs));
  t('Documents never announces a sensitive file in the bell', /if\(d\.s && d\.s\.sensitive\) return;/.test(docs));
  t('no links and no "only certain people" inside it', /s\.sensitive \? \[\] : LINKS\.filter/.test(docs) && /ctx\.sensitive\?'':/.test(docs));
  t('search shows its files only to people on the list', /if\(!sec && top==='sensitive material'\)\{ if\(!sensitiveLevel\(\)\) return;/.test(userjs));
  const sensBlock=admin.slice(admin.indexOf('SENSITIVE MATERIAL (20/10/2026)'), admin.indexOf('let DEL=null;'));
  t('the Admin panel removes nothing but names from its own list (no files, no other records)',
    !/PH_DOCS\.remove|\.remove\(item|'DELETE'/.test(sensBlock) && !/PH_STORE\.set\(/.test(sensBlock));
}

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
