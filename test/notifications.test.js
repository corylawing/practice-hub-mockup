/* The notification read-state: what a person has checked off must stay checked off,
   and must not come back. Runs user.js in a stub DOM.

       node test/notifications.test.js
*/
const fs=require('fs'), vm=require('vm'), path=require('path');
const V1=path.join(__dirname,'..','v1');

function load(reuse){
  const LS=reuse||{};
  const nodes=[];
  const mk=()=>({ style:{}, classList:{add(){},remove(){},contains(){return false}},
    children:[], appendChild(c){this.children.push(c);return c}, removeChild(){},
    remove(){}, setAttribute(){}, getAttribute(){return null},
    querySelector(){return null}, querySelectorAll(){return []},
    addEventListener(){}, insertBefore(){}, set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''},
    set textContent(v){this._t=v}, get textContent(){return this._t||''} });
  const listeners={};
  const ctx={
    console, Promise, Date, JSON, Math, Object, Array, String, Number, RegExp, isNaN, parseInt,
    setTimeout, clearTimeout,
    localStorage:{ getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v)}, removeItem:k=>{delete LS[k]} },
    /* The SANDBOX host on purpose: this file tests the read-state mechanics through the
       demo personas, which are a sandbox feature. It used to point at the production
       host and still resolve a persona - because me() fell through to the 'admin' demo
       persona when there was no profile. That fail-open is what handed a guest the
       Admin tab (see test/permissions.test.js); with it closed, a live host and no
       sign-in correctly resolves to nobody, and nobody has no notifications. */
    location:{ hostname:'corylawing.github.io', pathname:'/v1/home.html', search:'' },
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    document:{ readyState:'complete', documentElement:mk(), body:mk(), head:mk(),
      createElement:mk, getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
      addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},
      dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e));return true} },
    navigator:{ userAgent:'node' }, fetch:()=>Promise.reject(new Error('offline'))
  };
  ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(V1,'_staff.js'),'utf8'), ctx, {filename:'_staff.js'});
  vm.runInContext(fs.readFileSync(path.join(V1,'user.js'),'utf8'), ctx, {filename:'user.js'});
  return {PH:ctx.PH, LS, ctx};
}

const ok=[],bad=[];
const t=(n,v)=>{ (v?ok:bad).push(n); };

let E;
try{ E=load(); }
catch(e){ console.log('  FAIL  user.js would not load: '+e.message); process.exit(1); }
const PH=E.PH;

t('PH exposes the notification functions',
  ['notifications','unreadCount','markSeen','markAllSeen','loadSeen'].every(k=>typeof PH[k]==='function'));

// Log three things, as the app does.
PH.logActivity({sec:'schedule',   ic:'\u{1F4C5}', title:'Schedule updated',   scope:'everyone'});
PH.logActivity({sec:'production', ic:'\u{1F4B0}', title:'Numbers entered',    scope:'everyone'});
PH.logActivity({sec:'marketing',  ic:'\u{1F4E3}', title:'Promo posted',       scope:'everyone'});

let list=PH.notifications();
t('all three show up', list.length===3);
t('every one carries an id', list.every(n=>n.id));
t('ids are unique', new Set(list.map(n=>n.id)).size===3);
t('they all start unread', PH.unreadCount()===3);

// Check one off.
const first=list[0];
PH.markSeen(first);
t('ticking one off drops the unread count', PH.unreadCount()===2);
t('that one reads as seen', PH.notifications().find(n=>n.id===first.id).seen===true);
t('the others are untouched', PH.notifications().filter(n=>!n.seen).length===2);

// THE POINT: it must not come back when the same thing is logged again inside the
// collapse window - that is the same event being updated, not a new one.
PH.logActivity({sec:first.sec, ic:first.ic, title:first.title.replace(/ — .*$/,''), scope:'everyone'});
const after=PH.notifications();
t('a collapsed re-save does NOT come back unread',
  (after.find(n=>n.id===first.id)||{}).seen===true);
t('and it did not create a second entry', after.length===3);

// A genuinely different update should still get through.
PH.logActivity({sec:'documents', ic:'\u{1F4C4}', title:'New policy posted', scope:'everyone'});
t('a new update still arrives unread', PH.unreadCount()===3);

PH.markAllSeen();
t('mark all as read clears the badge', PH.unreadCount()===0);
t('nothing was deleted from the feed', PH.notifications().length===4);

// The seen list must not grow forever: ids for entries that have expired get pruned.
const key=Object.keys(E.LS).find(k=>k.indexOf('ph_seen_')===0);
t('read state is stored per person, not per page', !!key);
const seenNow=JSON.parse(E.LS[key]||'[]');
t('the stored list only holds ids still in the feed',
  seenNow.length===4 && seenNow.every(id=>PH.notifications().some(n=>n.id===id)));

/* THE WHOLE POINT, and the one the first version of this test missed: it has to still
   be read after a reload. It was not - the key was built from a person's .mail, which
   no person object actually has, so every tick was written to an empty key and thrown
   away. Ticking something off that comes straight back is worse than no button at all. */
const R=load(E.LS).PH;
t('after a reload they are ALL still read', R.unreadCount()===0);
t('and the feed itself survived the reload', R.notifications().length===4);
R.logActivity({sec:'schedule', ic:'\u{1F4C5}', title:'Something brand new', scope:'everyone'});
t('a genuinely new update after a reload does show unread', R.unreadCount()===1);

/* And again as somebody who is NOT one of the three people whose record happens to
   carry an email property. Keying the read-list off a person's .mail worked for
   Heather and silently threw away everybody else's ticks - which is the version of
   this bug that would have reached the practice, because most of them are not
   Heather. Anything keyed per person gets checked on a person without an email. */
const NOMAIL={ph_viewas:'doctor'};
const D=load(NOMAIL).PH;
t('this persona really has no email property of its own', !D.realMe().mail && !D.realMe().email);
D.logActivity({sec:'schedule', ic:'\u{1F4C5}', title:'Schedule updated', scope:'everyone'});
t('they see it unread', D.unreadCount()===1);
D.markAllSeen();
t('they can mark it read', D.unreadCount()===0);
const D2=load(NOMAIL).PH;
t('and it is STILL read after they reload', D2.unreadCount()===0);
t('their read-list was actually written somewhere',
  Object.keys(NOMAIL).some(k=>k.indexOf('ph_seen_')===0));

// Visibility. Two things must hold, and the office one is a privacy matter: an update
// about Carlsbad must not appear in the Hobbs manager's bell.
PH.logActivity({sec:'schedule', ic:'\u{1F4C5}', title:'Carlsbad note', scope:'Carlsbad'});
PH.logActivity({sec:'production', ic:'\u{1F4B0}', title:'Hobbs numbers', scope:'Hobbs'});

/* me() is the base person merged with their own saved row, so writing that row is how
   the app itself narrows somebody down - the same path a real profile takes. */
const MEKEY='ph_me_'+PH.me().id;
const asPerson=o=>{ E.LS[MEKEY]=JSON.stringify(o); };

asPerson({offices:['Hobbs']});
t('the test person really is limited to one office',
  JSON.stringify(PH.offices())===JSON.stringify(['Hobbs']));
const seenTitles=PH.notifications().map(n=>n.title);
t('an office update does NOT reach someone in another office',
  seenTitles.indexOf('Carlsbad note')<0);
t('their own office update DOES reach them',
  seenTitles.indexOf('Hobbs numbers')>=0);

// Someone with no access to a page should not be told about changes on it.
asPerson({offices:'all', can:Object.assign({}, PH.me().can, {production:'none'})});
t('an update about a page they cannot open is not shown',
  !PH.notifications().some(n=>n.sec==='production'));
t('and one they can open still is',
  PH.notifications().some(n=>n.sec==='schedule'));
delete E.LS[MEKEY];

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
