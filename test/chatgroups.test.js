/* CHAT GROUPS (18/11/2026, Cory: "Flexibility to create their own group" - like Slack channels, called Groups).
       node test/chatgroups.test.js
   SANDBOX ONLY until chat.html GROUPS_LIVE is true (one live device can try it first: localStorage ph_chat_groups = '1').
   Runs chatgraph.js itself against a pretend Microsoft (no network): what it sends to make, rename and change a group,
   the pilot lock (only testers can be put in a group), and that taking out / leaving only happens once Microsoft's
   ChatMember.ReadWrite permission is granted. Made-up people only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const R=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const SRC=R('chatgraph.js'), CHAT=R('chat.html');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
const D='example.test';
const b64u=o=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function load(scp){
  const calls=[], LS={ph_chat_testers:JSON.stringify([{email:'quinn.quill@'+D, name:'Quinn Quill'}, {email:'jordan.ellis@'+D, name:'Jordan Ellis'}])};
  const w={ localStorage:{getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}},
    console, Promise, JSON, Date, Math, encodeURIComponent, decodeURIComponent, unescape, escape,
    setTimeout:f=>{ f(); return 0; }, clearTimeout(){}, btoa:s=>Buffer.from(s,'binary').toString('base64'), atob:s=>Buffer.from(s,'base64').toString('binary'), URL:{createObjectURL:()=>'blob:x'} };
  w.window=w;
  w.PH={isLive:()=>false, isAdmin:()=>true, profileOf:()=>({id:'u-me', displayName:'Priya Tatum'})};
  const tok=b64u({alg:'none'})+'.'+b64u({scp:scp||'Chat.ReadWrite User.Read'})+'.x';
  w.PH_AUTH={tokenFor:()=>Promise.resolve(tok)};
  w.fetch=async (url, o)=>{ o=o||{}; calls.push({url, method:o.method||'GET', body:o.body ? JSON.parse(o.body) : null});
    return {ok:true, status:(o.method==='DELETE'||o.method==='PATCH') ? 204 : 201, headers:{get:()=>null}, json:async ()=>({id:'19:g1@thread.v2', chatType:'group'}), blob:async ()=>({})}; };
  vm.createContext(w); vm.runInContext(SRC, w);
  return {C:w.PH_CHATG, calls};
}
const Q={id:'u-q', name:'Quinn Quill', email:'quinn.quill@'+D}, J={id:'u-j', name:'Jordan Ellis', email:'jordan.ellis@'+D}, A={id:'u-a', name:'Avery Brooks', email:'avery.brooks@'+D};
const grp=(people)=>({id:'19:g1@thread.v2', type:'group', name:'Front desk', people});
const PME={id:'u-me', name:'Priya Tatum', email:'priya.tatum@'+D, mid:'m-me'};
const fails=async f=>{ try{ await f(); return ''; }catch(e){ return e.message; } };

(async ()=>{
  let {C, calls}=load();
  t('a group needs a name and at least 2 other people; while testing only testers can be put in it (checked before anything leaves)',
    /name/.test(await fails(()=>C.createGroup('u-me', [Q,J], '  '))) && /at least 2/.test(await fails(()=>C.createGroup('u-me', [Q], 'X'))) &&
    /only your testers/.test(await fails(()=>C.createGroup('u-me', [Q,A], 'X'))) && calls.length===0);
  await C.createGroup('u-me', [Q,J], 'Front desk leads');
  const b=calls[0].body;
  t('making one: a Teams GROUP chat with that name, me + the 2 picked, everyone an owner', calls[0].method==='POST' && /\/chats$/.test(calls[0].url) && b.chatType==='group' && b.topic==='Front desk leads' &&
    b.members.length===3 && b.members.every(m=>m.roles[0]==='owner') && /users\('u-me'\)/.test(b.members[0]['user@odata.bind']));
  calls.length=0;
  const g=grp([PME, Object.assign({mid:'m-q'}, Q), Object.assign({mid:'m-j'}, J)]);
  await C.renameGroup(g, 'u-me', 'Front desk');
  t('renaming: PATCH the chat’s topic', calls[0].method==='PATCH' && /\/chats\/19%3Ag1%40thread\.v2$/.test(calls[0].url) && calls[0].body.topic==='Front desk');
  t('…not a 1:1, not empty, and not in a chat with someone outside the testers (the pilot lock)', /Only a group/.test(await fails(()=>C.renameGroup(Object.assign(grp([PME, Q]), {type:'person'}), 'u-me', 'x'))) &&
    /name/.test(await fails(()=>C.renameGroup(g, 'u-me', ' '))) && /testers/.test(await fails(()=>C.renameGroup(grp([PME, Q, A]), 'u-me', 'x'))));
  calls.length=0;
  const g2=grp([PME, Object.assign({mid:'m-q'}, Q)]);
  await C.addPeople(g2, 'u-me', [J, Q]);
  t('adding: one POST per new person (someone already in is skipped), they see the whole conversation, like Slack', calls.length===1 && calls[0].method==='POST' &&
    /\/chats\/19%3Ag1%40thread\.v2\/members$/.test(calls[0].url) && /users\('u-j'\)/.test(calls[0].body['user@odata.bind']) && calls[0].body.visibleHistoryStartDateTime==='0001-01-01T00:00:00Z');
  t('…only testers while testing; nobody new = says so', /only your testers/.test(await fails(()=>C.addPeople(g2, 'u-me', [A]))) && /already/.test(await fails(()=>C.addPeople(g2, 'u-me', [Q]))));
  t('taking out / leaving is offered only when Microsoft’s token says ChatMember.ReadWrite is granted', (await C.canManageMembers())===false && (await load('Chat.ReadWrite ChatMember.ReadWrite').C.canManageMembers())===true &&
    (await load('Chat.ReadWrite ChatMember.ReadWriteX').C.canManageMembers())===false);
  ({C, calls}=load('Chat.ReadWrite ChatMember.ReadWrite'));
  await C.removePerson(g, 'u-me', 'u-j');
  await C.leaveGroup(g, 'u-me');
  t('taking someone out = DELETE their membership; leaving = DELETE mine', calls[0].method==='DELETE' && /\/members\/m-j$/.test(calls[0].url) && calls[1].method==='DELETE' && /\/members\/m-me$/.test(calls[1].url));
  t('…never yourself by Take out, never someone not in it, never a 1:1', /Leave group/.test(await fails(()=>C.removePerson(g, 'u-me', 'u-me'))) && /not in this group/.test(await fails(()=>C.removePerson(g, 'u-me', 'u-a'))) &&
    /only leave a group/.test(await fails(()=>C.leaveGroup(Object.assign(grp([PME, Q]), {type:'person'}), 'u-me'))));
  const T=C._t;
  t('the chat list knows each person’s membership (needed to take them out)', T.mapChat({id:'c', chatType:'group', topic:'X', members:[{id:'m-q', userId:'u-q', displayName:'Quinn Quill', email:'quinn.quill@'+D}]}, 'u-me').people[0].mid==='m-q');
  const evm=(type, extra)=>Object.assign({id:'e1', messageType:'systemEventMessage', createdDateTime:'2026-11-18T10:00:00Z', eventDetail:Object.assign({'@odata.type':'#microsoft.graph.'+type, initiator:{user:{id:'u-me', displayName:null}}}, extra)});
  const ea=T.mapMessage(evm('membersAddedEventMessageDetail', {members:[{id:'u-q', displayName:null}]}), 'u-me'), er=T.mapMessage(evm('membersDeletedEventMessageDetail', {members:[{id:'u-j'}]}), 'u-me'),
    en=T.mapMessage(evm('chatRenamedEventMessageDetail', {chatDisplayName:'Front desk'}), 'u-me'), ex=T.mapMessage(evm('callEndedEventMessageDetail', {}), 'u-me');
  t('Teams’ own notes come through: added, taken out / left, renamed (others are left out)', ea.system && ea.kind==='added' && ea.who[0].id==='u-q' && ea.by.id==='u-me' && er.kind==='removed' && en.kind==='renamed' && en.topic==='Front desk' && ex===null);

  /* ---- the page ---- */
  t('ON for the live site (hc194, Cory: "groups live"); GROUPS_LIVE false again = no groups (one device can still opt in: ph_chat_groups = 1)', /const GROUPS_LIVE=true;/.test(CHAT) &&
    /const GROUPS=\(\)=>\{ if\(GROUPS_LIVE \|\| !ONLIVE\) return true; try\{ return localStorage\.getItem\('ph_chat_groups'\)==='1'; \}catch\(_\)\{ return false; \} \};/.test(CHAT));
  t('"＋ New group" first in every New chat (mock-up, pilot, everyone); the old fixed "All your testers" group only without it', (CHAT.match(/data-act="grpnew"/g)||[]).length>=3 && /ts\.length>1 && !GROUPS\(\) \? '<button data-act="mkgroup">/.test(CHAT));
  t('a group’s name (or 👥 N) opens its settings: rename, people, ＋ Add people, take out (×), Leave group - each change asks first', /data-act="grpinfo" role="button"/.test(CHAT) && CHAT.indexOf("👥 '+(c.members||[]).length")>=0 &&
    /data-act="grpren"/.test(fnOf(CHAT,'grpInfo')) && /data-act="grpadd"/.test(fnOf(CHAT,'grpInfo')) && /data-act="grprmok"/.test(fnOf(CHAT,'grpInfo')) && /data-act="grpleaveok"/.test(fnOf(CHAT,'grpInfo')));
  t('…× and Leave only once ChatMember.ReadWrite is granted (it says so); changes only where you may send (pilot note)', /boss && mng && !p\.me \?/.test(fnOf(CHAT,'grpInfo')) && /mng \? '<button class="btn warn" data-act="grpleave">/.test(fnOf(CHAT,'grpInfo')) &&
    /ChatMember\.ReadWrite permission is granted/.test(fnOf(CHAT,'grpInfo')) && /const can=!REALCHAT \|\| CG\.canSend\(c, MEID\)/.test(fnOf(CHAT,'grpInfo')));
  const ST=new Function('REALCHAT','MEID','ME', 'const KNOWN={"u-j":"Jordan Ellis"}; const lookUp=()=>{};\n'+fnOf(CHAT,'sysText')+'\nreturn sysText;');
  const st=ST(true, 'u-me', 'Priya Tatum'), c={name:'Front desk', people:[{id:'u-me', name:'Priya Tatum'}, {id:'u-q', name:'Quinn Quill'}]};
  t('the notes in the conversation read like Slack: "You added Quinn Quill", "Quinn Quill took Jordan Ellis out" (a name Teams leaves blank is remembered), "… left the group", "You named the group “…”"',
    st({kind:'added', by:{id:'u-me'}, who:[{id:'u-me'}, {id:'u-q'}]}, c)==='You added Quinn Quill' && st({kind:'removed', by:{id:'u-q'}, who:[{id:'u-j'}]}, c)==='Quinn Quill took Jordan Ellis out' &&
    st({kind:'removed', by:{id:'u-q'}, who:[{id:'u-q'}]}, c)==='Quinn Quill left the group' && st({kind:'renamed', by:{id:'u-me'}, topic:'Front desk'}, c)==='You named the group “Front desk”' &&
    st({kind:'added', by:{id:'u-x'}, who:[{id:'u-y'}]}, c)==='Someone added Someone');
  /* ---- OWNERS (Cory 18/11: "The person who starts the group can be the owner of the group or assign ownership to someone else. Same as slack") ---- */
  const OW=new Function('REALCHAT','MEID','ME','PH_STORE', "const window={PH_STORE};\n"+/const OWN_PRE='ph_chatgrp_';/.exec(CHAT)[0]+'\n'+/const ownKey=id=>\{[^\n]*\};/.exec(CHAT)[0]+'\n'+fnOf(CHAT,'cleanOwn')+'\n'+
    /const meKey=\(\)=>[^\n]*/.exec(CHAT)[0]+'\n'+/const memberKeys=c=>[^\n]*/.exec(CHAT)[0]+'\nasync '+fnOf(CHAT,'ownersOf')+'\nreturn {ownKey, cleanOwn, ownersOf};');
  const store=(rec, fail)=>({get:()=>Promise.resolve(rec), readFailed:()=>!!fail});
  const gc={id:'19:g1@thread.v2', people:[{id:'u-me'}, {id:'u-q'}, {id:'u-j'}]};
  const O1=OW(true, 'u-me', 'Priya Tatum', store({chat:gc.id, owners:['u-q']}));
  t('owners are kept one record per group (a short, safe key), only for THAT chat, ids only, no repeats',
    /^ph_chatgrp_[0-9a-z]+$/.test(O1.ownKey(gc.id)) && O1.ownKey(gc.id)===O1.ownKey(gc.id) && O1.ownKey(gc.id)!==O1.ownKey('19:g2@thread.v2') &&
    O1.cleanOwn({chat:'other', owners:['u-q']}, gc.id)===null && JSON.stringify(O1.cleanOwn({chat:gc.id, owners:['u-q','u-q',5,'']}, gc.id).owners)==='["u-q"]');
  let o=await O1.ownersOf(gc);
  t('not an owner: can’t rename / take out / change owners', o.known && !o.none && !o.mine && o.owners.join()==='u-q');
  o=await OW(true, 'u-me', 'Priya Tatum', store({chat:gc.id, owners:['u-me','u-gone']})).ownersOf(gc);
  t('an owner: can; an owner who has left the group no longer counts', o.mine && o.owners.join()==='u-me');
  o=await OW(true, 'u-me', 'Priya Tatum', store({chat:gc.id, owners:['u-gone']})).ownersOf(gc);
  const o2=await OW(true, 'u-me', 'Priya Tatum', store(null)).ownersOf(gc);
  t('no owner left (or a group made in Teams / before owners): anyone in it can manage it', o.none && o.mine && o2.none && o2.mine);
  o=await OW(true, 'u-me', 'Priya Tatum', store(null, true)).ownersOf(gc);
  t('owners that couldn’t be read are NEVER treated as "no owner" - the owner-only buttons are off and it says so', !o.known && !o.mine && !o.none &&
    /Couldn’t check who owns this group/.test(fnOf(CHAT,'grpInfo')));
  const gi=fnOf(CHAT,'grpInfo'), ga=fnOf(CHAT,'grpAct');
  t('the group screen: "Owner" badges; for owners Rename, ×, Make owner, Remove owner / Step down (never the last owner); for others it says only owners can',
    /const isOwn=id=>O\.owners\.indexOf\(id\)>=0, boss=can && O\.mine;/.test(gi) && /<span class="ownb">Owner<\/span>/.test(gi) && /boss \? '<button class="btn ghost sm" data-act="grpren">Rename/.test(gi) &&
    /boss && mng && !p\.me \?/.test(gi) && /O\.owners\.length>1 \?/.test(gi) && /'Step down' : 'Remove owner'/.test(gi) && /Only the group’s owners can rename it and take people out/.test(gi));
  t('…every owner-only change checks the owners AGAIN before anything is sent (an old screen can’t sneak a rename through)',
    /await ownerOnly\('rename it'\); if\(REALCHAT\) await CG\.renameGroup/.test(ga) && /await ownerOnly\('take people out'\); if\(REALCHAT\) await CG\.removePerson/.test(ga) &&
    /const O=await ownerOnly\('change its owners'\);/.test(ga) && /throw new Error\('a group keeps at least one owner'\)/.test(ga));
  t('…the one who makes a group is its owner; someone taken out or leaving stops being one; the last owner is warned before leaving',
    /ownSave\(made, \(\)=>\[MEID\]\)/.test(fnOf(CHAT,'grpMake')) && /c\.owners=\[ME\];/.test(fnOf(CHAT,'grpMake')) && /ownSave\(c, list=>list\.filter\(x=>x!==v\)\)/.test(ga) &&
    /ownSave\(c, list=>list\.filter\(x=>x!==me\)\)/.test(ga) && /You’re its only owner\. Make someone else an owner first/.test(gi));
  t('…saved with PH_STORE.update (never over someone else’s change); a save that didn’t land says so', /return PH_STORE\.update\(ownKey\(c\.id\), cur=>/.test(fnOf(CHAT,'ownSave')) &&
    /if\(!r \|\| r\.blocked \|\| r\.error\) throw new Error/.test(fnOf(CHAT,'ownSave')) && /saving you as its owner didn’t work/.test(fnOf(CHAT,'grpMake')));
  const ini=new Function(/const initials=n=>\{[^\n]*\};/.exec(CHAT)[0]+' return initials;')();
  t('initials skip a nickname in brackets or quotes ("Avery (Ave) Alder" = AA)', ini('Avery (Ave) Alder')==='AA' && ini('Joemily "Emmy" Prieto')==='JP' && ini('Dr. Clara Coleman')==='CC' && ini('Quinn Quill')==='QQ');
  t('nothing typed goes in as HTML (names and group names are escaped)', /<b>'\+esc\(c\.name\)\+'<\/b>/.test(fnOf(CHAT,'grpInfo')) && /esc\(tx\)/.test(fnOf(CHAT,'msgHTML')) && !/innerHTML=[^;]*\.value/.test(fnOf(CHAT,'grpInfo')));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('CRASH', e && e.stack); process.exit(1); });
