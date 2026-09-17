/* WHICH SLOT DOES A PERSON'S SETTINGS GO IN?
       node test/peoplekey.test.js

   17/09/2026. Heather: staff locations wrong on Admin, right on Team, and her fixes
   not sticking. The ph_people history showed why - one entry keyed by the literal
   string "emp:" whose office changed on nearly every save:

       47.0 22:16:19  emp: Lubbock      51.0 22:19:58  emp: Lubbock
       48.0 22:16:26  emp: Clovis       54.0 15:00:16  emp: All offices
       53.0 23:22:15  emp: Lubbock      55.0 15:00:41  emp: Carlsbad

   admin.html built that key as `email || 'emp:'+emp`. Anyone with NO email and NO
   employee id therefore collapsed to "emp:" - one shared slot for all of them. Editing
   one overwrote the last, and on load that single office was stamped onto every one of
   them, over the correct roster. The Team page was right because it never reads these.

   Two more things the same data exposed:
   - user.js looked these up by EMAIL ONLY, so for anyone whose roster row has no email
     an admin's team and office settings never reached their actual permissions.
   - an override can change a person's email and employee id, and the key was computed
     AFTER that - so editing someone could move their own slot. */
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');

function load(ls){
  const LS=ls||{}, listeners={};
  const mk=()=>({style:{},classList:{add(){},remove(){},contains(){return false}},children:[],
    appendChild(c){this.children.push(c);return c},remove(){},setAttribute(){},getAttribute(){return null},
    querySelector(){return null},querySelectorAll(){return []},addEventListener(){},insertBefore(){},
    set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''},
    set textContent(v){this._t=v}, get textContent(){return this._t||''}});
  const ctx={console,Promise,Date,JSON,Math,Object,Array,String,Number,RegExp,Set,
    isNaN,parseInt,parseFloat,setTimeout,clearTimeout,encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v)},removeItem:k=>{delete LS[k]}},
    location:{hostname:'kind-hill-00da87410.3.azurestaticapps.net',pathname:'/v1/admin.html',
              search:'',origin:'https://x',assign(){},reload(){}},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{readyState:'complete',documentElement:mk(),body:mk(),head:mk(),createElement:mk,
      getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],
      addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},
      dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true}},
    navigator:{userAgent:'node'},
    fetch:(u)=>String(u).indexOf('_people.json')>=0
      ? Promise.resolve({ok:true, json:()=>Promise.resolve(
          JSON.parse(fs.readFileSync(path.join(V1,'_people.json'),'utf8')))})
      : Promise.reject(new Error('offline'))};
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx; ctx.addEventListener=ctx.document.addEventListener;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'),ctx,{filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'),ctx,{filename:'user.js'});
  return ctx;
}

const ok=[],bad=[];
const t=(n,v)=>{ (v?ok:bad).push(n); };

const PH=load().PH;

t('PH.personKey exists', typeof PH.personKey==='function');
if(typeof PH.personKey!=='function'){
  console.log('  FAIL  PH.personKey exists\n\n0 passed, 1 failed');
  process.exit(1);
}

/* ---- 1. THE BUG: no email, no employee id. These are two different people. ---- */
const ghost1={name:'Mia Armenta',    email:'', empId:''};
const ghost2={name:'Linda Herrera',  email:'', empId:''};
const k1=PH.personKey(ghost1), k2=PH.personKey(ghost2);
t('two people with no email and no employee id get DIFFERENT slots', k1!==k2);
t('neither slot is the shared bucket "emp:"', k1!=='emp:' && k2!=='emp:');
t('neither slot is empty', !!k1 && !!k2);

/* ---- 2. The 21 entries already saved are keyed by email. They must still resolve. ---- */
t('someone with an email keys to that email, as already stored',
  PH.personKey({name:'Elizabeth Reyes', email:'liz@farnsworthorthodontics.com', empId:'ecmxzu'})
    === 'liz@farnsworthorthodontics.com');
t('and case and spacing do not make a second slot',
  PH.personKey({name:'x', email:'  LIZ@Farnsworthorthodontics.COM '})
    === 'liz@farnsworthorthodontics.com');

/* ---- 3. No email but a real employee id: their own slot, as before. ---- */
t('employee id gives its own slot',
  PH.personKey({name:'Mia Armenta', email:'', empId:'a7ab79'}) === 'emp:a7ab79');
t('and six Hobbs staff get six different slots',
  new Set(['a7ab79','tiq22z','8d4562','xmfmpi','7bbe20','isc6yt']
    .map(id=>PH.personKey({name:'n'+id, email:'', empId:id}))).size === 6);

/* ---- 4. Editing someone must not move their own slot. An override can change their
          email and employee id; the key was computed after that. ---- */
const before=PH.personKey({name:'Dr. David Farnsworth', email:'', empId:''});
const after =PH.personKey({name:'Dr. David Farnsworth', email:'', empId:''});
t('the slot is stable for the same person', before===after);
t('and it is derived from the roster, not from an edited field',
  PH.personKey({name:'Dr. David Farnsworth', email:'', empId:''}) ===
  PH.personKey({name:'Dr. David Farnsworth'}));

/* ---- 5. Every one of the 70 real people gets a unique slot. ---- */
{
  const rows=JSON.parse(fs.readFileSync(path.join(V1,'_people.json'),'utf8')).people;
  const keys=rows.map(r=>PH.personKey(r));
  t('all 70 real staff get a slot', keys.every(k=>!!k));
  t('all 70 slots are unique', new Set(keys).size===rows.length);
  t('no real person lands in the shared bucket', keys.indexOf('emp:')<0);
}

/* ---- 6. THE PERMISSIONS GAP. An admin sets someone's team and office in Admin. That
          has to reach what the person actually sees when they sign in - including when
          their roster row has no email and the slot is therefore not their address. ---- */
function permissionsGap(){
  const rows=JSON.parse(fs.readFileSync(path.join(V1,'_people.json'),'utf8')).people;
  const mia=rows.find(r=>r.name==='Mia Armenta');
  const slot=PH.personKey(mia);
  const ovr={}; ovr[slot]={teams:['Office Managers'], locs:['Hobbs']};
  const E=load({ ph_people: JSON.stringify(ovr) });
  return E.PH.rosterReady.then(function(){
  // She signs in with a Microsoft address the roster does not list.
  E.PH.setProfile({displayName:'Mia Armenta', mail:'marmenta@farnsworthorthodontics.com',
                   userPrincipalName:'marmenta@farnsworthorthodontics.com',
                   jobTitle:'', department:'', officeLocation:''});
  t('an admin-set office reaches the person even when their slot is not their email',
    JSON.stringify(E.PH.offices())==='["Hobbs"]');
  t('and so does the admin-set team',
    (E.PH.me().teams||[]).indexOf('Office Managers')>=0);
  });
}

Promise.resolve(permissionsGap()).then(function(){
  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
});
