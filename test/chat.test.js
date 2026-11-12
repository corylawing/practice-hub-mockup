/* THE REAL CHAT (chatgraph.js + chat.html + gate.js, 12/11/2026).
       node test/chat.test.js
   Cory: "very important that nobody sees it until I've confirmed it works ... also the ability to send videos".
   Checks the locks first (live: off; sandbox: only an Admin who switched it on; while testing, sending only into
   chats where everyone else is a tester - checked inside every send, before anything leaves), that the sign-in never
   asks for Chat.ReadWrite, then what is sent to Microsoft: text (escaped), a photo inside the message, a video the
   way Teams sends one (OneDrive, shared with the chat, a "reference" attachment; big ones in pieces), and that
   Teams' HTML is turned into plain text. Microsoft is faked; no network. Made-up people only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const R=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const SRC=R('chatgraph.js'), GATE=R('gate.js'), CHAT=R('chat.html'), USER=R('user.js');
const D='farnsworthorthodontics.com';
const ME={id:'u-me', name:'Priya Tatum', email:'priya.tatum@'+D};
const QUINN={id:'u-q', name:'Quinn Quill', email:'quinn.quill@'+D};
const AVERY={id:'u-a', name:'Avery Brooks', email:'avery.brooks@'+D};

function load(opts){
  opts=opts||{};
  const LS=Object.assign({}, opts.ls||{}), calls=[], scopes=[];
  const w={ localStorage:{getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}},
    console, Promise, JSON, Date, Math, encodeURIComponent, decodeURIComponent, unescape, escape,
    setTimeout:f=>{ f(); return 0; }, clearTimeout(){},
    btoa:s=>Buffer.from(s,'binary').toString('base64'), URL:{createObjectURL:()=>'blob:x'} };
  w.window=w;
  w.PH={isLive:()=>!!opts.live, isAdmin:()=>!!opts.admin, profileOf:()=>opts.noProfile ? null : {id:'u-me', displayName:'Priya Tatum'}};
  w.PH_AUTH={tokenFor:extra=>{ scopes.push(extra); return Promise.resolve('TOK'); }};
  const replies=opts.replies||[];
  w.fetch=async (url, o)=>{
    o=o||{}; const c={url, method:o.method||'GET', headers:o.headers||{}, body:o.body}; calls.push(c);
    let r=null; for(const x of replies){ if(x.match(c) && !(x.once && x.used)){ r=x; x.used=true; break; } }
    const status=r ? (r.status||200) : 200, body=r ? (typeof r.body==='function' ? r.body(c) : r.body) : {};
    return {ok:status>=200 && status<300, status, headers:{get:k=>r && r.headers ? r.headers[k] : null},
      json:async ()=>body, blob:async ()=>({})};
  };
  vm.createContext(w); vm.runInContext(SRC, w);
  return {w, C:w.PH_CHATG, LS, calls, scopes};
}
const json=s=>{ try{ return JSON.parse(s); }catch(_){ return null; } };
const testersLS=list=>({ph_chat_testers:JSON.stringify(list.map(p=>({email:p.email, name:p.name})))});
const chatWith=(...people)=>({id:'19:abc@thread.v2', type:people.length>2?'group':'person', people});

(async ()=>{
  /* ---- 1. Who gets it ---- */
  {
    t('the live site is OFF: CHAT_LIVE=false in the source', /const CHAT_LIVE=false;/.test(SRC));
    t('live: off, even for an Admin who switched it on', load({live:true, admin:true, ls:{ph_chat_real:'1'}}).C.mode()==='off');
    t('sandbox: the mock-up for someone who is not an Admin, switch or not', load({admin:false, ls:{ph_chat_real:'1'}}).C.mode()==='demo');
    t('sandbox: the mock-up for an Admin who has not switched it on', load({admin:true}).C.mode()==='demo');
    t('sandbox: the real chat only for an Admin who switched it on', load({admin:true, ls:{ph_chat_real:'1'}}).C.mode()==='real');
    t('sandbox: nothing real before Microsoft says who this is (the stand-in person is an Admin)', load({admin:true, noProfile:true, ls:{ph_chat_real:'1'}}).C.mode()==='demo');
    t('chat.html: never starts without knowing who this is', /if\(!MEID\)\{ REALCHAT=false; return; \}/.test(CHAT));
    const {C, LS}=load({admin:true}); C.setSwitch(true); t('the switch is this device only (localStorage)', LS.ph_chat_real==='1');
    C.setSwitch(false); t('switching off removes it', !('ph_chat_real' in LS));
    t('while CHAT_LIVE is false it is a test (send to testers only)', C.TEST===true);
  }
  /* ---- 2. Sign-in never asks for chat ---- */
  {
    t('the sign-in scopes are unchanged (no Chat.ReadWrite)', /var SCOPES = \['User\.Read','Sites\.ReadWrite\.All','User\.ReadBasic\.All'\];/.test(GATE));
    const tf=GATE.slice(GATE.indexOf('tokenFor: function'), GATE.indexOf('askFor: function'));
    t('gate: tokenFor is silent and adds the extra scope', /acquireTokenSilent\(\{ scopes: SCOPES\.concat\(extra \|\| \[\]\)/.test(tf));
    t('gate: tokenFor never puts the sign-in screen up', tf.length>0 && !/requestSignIn|Popup|Redirect/.test(tf.replace(/\/\*[\s\S]*?\*\//g,'')));
    t('gate: askFor is popup, or the whole page on phones', /askFor: function\(extra\)\{[\s\S]*?if \(USE_REDIRECT\) return goSignIn\(app, account, scopes\);[\s\S]*?acquireTokenPopup/.test(GATE));
    t('gate: goSignIn takes the scopes (default the sign-in ones)', /function goSignIn\(app, account, scopes\)[\s\S]*?scopes: scopes \|\| SCOPES/.test(GATE));
    const {C, scopes}=load({admin:true, ls:Object.assign({ph_chat_real:'1'}, testersLS([QUINN]))});
    await C.sendText(chatWith(ME, QUINN), ME.id, 'hi');
    t('chat asks for Chat.ReadWrite through tokenFor', scopes.length===1 && JSON.stringify(scopes[0])==='["Chat.ReadWrite"]');
    t('user.js: the chat button and page stay off on the live site', /\{k:'chat',[^\n]*show:\(\)=>env\(\)!=='live'/.test(USER));
  }
  /* ---- 3. The test lock ---- */
  {
    const {C}=load({ls:testersLS([QUINN, AVERY])});
    t('a chat with a tester: may send', C.canSend(chatWith(ME, QUINN), ME.id));
    t('a group of testers: may send', C.canSend(chatWith(ME, QUINN, AVERY), ME.id));
    t('a chat with anyone else: locked', !C.canSend(chatWith(ME, {id:'u-x', name:'Jordan Ellis', email:'jordan.ellis@'+D}), ME.id));
    t('a group with one non-tester: locked', !C.canSend(chatWith(ME, QUINN, {id:'u-x', name:'Jordan Ellis', email:'jordan.ellis@'+D}), ME.id));
    t('someone with no email on record: locked', !C.canSend(chatWith(ME, {id:'u-y', name:'No Mail', email:''}), ME.id));
    t('a chat with nobody else: locked', !C.canSend(chatWith(ME), ME.id));
    t('testers are matched without caring about capitals', C.canSend(chatWith(ME, {id:'u-q', name:'Q', email:'QUINN.Quill@'+D}), ME.id));
    const none=load({});
    t('no testers: everything locked', !none.C.canSend(chatWith(ME, QUINN), ME.id));
    let err='';
    try{ await none.C.sendText(chatWith(ME, QUINN), ME.id, 'hello'); }catch(e){ err=e.message; }
    t('sendText refuses a non-tester chat by itself', /only send to your testers/.test(err) && none.calls.length===0);
    err=''; try{ await none.C.sendPhoto(chatWith(ME, QUINN), ME.id, 'AAA', 10, 10); }catch(e){ err=e.message; }
    t('sendPhoto refuses too, nothing sent', /testers/.test(err) && none.calls.length===0);
    err=''; try{ await none.C.sendVideo(chatWith(ME, QUINN), ME.id, {size:10, type:'video/mp4'}, 'v.mp4'); }catch(e){ err=e.message; }
    t('sendVideo refuses before uploading anything', /testers/.test(err) && none.calls.length===0);
    const tl=load({}); const saved=tl.C.setTesters([{email:' Quinn.Quill@'+D+' ', name:'Quinn Quill'}, {email:'quinn.quill@'+D, name:'again'}, {email:''}]);
    t('testers: trimmed, small letters, no doubles, no blanks', saved.length===1 && saved[0].email==='quinn.quill@'+D);
    t('chat.html: no message box at all in a locked chat', /if\(REALCHAT && !CG\.canSend\(c, MEID\)\) h\+='<\/div><div class="locked">/.test(CHAT));
    t('chat.html: sendReal checks the lock first', /async function sendReal\(m\)\{\s*const c=cur\(\); if\(!c\) return;\s*if\(!CG\.canSend\(c, MEID\)\)/.test(CHAT));
    t('chat.html: phone alerts only to testers while testing', /if\(CG\.TEST\)\{ const ok=CG\.testers\(\)\.map\(t=>t\.email\); to=to\.filter\(e=>ok\.indexOf\(e\)>=0\); \}/.test(CHAT));
    t('chat.html: new chats in the test are with testers only', /if\(CG\.TEST\)\{\s*const ts=CG\.testers\(\);\s*openDlg\(top\('New chat'\)/.test(CHAT));
  }
  /* ---- 4. Sending ---- */
  {
    const {C, calls}=load({ls:testersLS([QUINN, AVERY]), replies:[{match:c=>/\/messages$/.test(c.url), body:{id:'m1', messageType:'message', createdDateTime:'2026-11-12T15:00:00Z', from:{user:{id:ME.id, displayName:ME.name}}, body:{contentType:'html', content:'x'}}}]});
    await C.sendText(chatWith(ME, QUINN), ME.id, 'Lunch <b>Friday</b>?\nTacos & tea');
    const c=calls[0], b=json(c.body);
    t('text: POST to the chat\'s messages', c.method==='POST' && c.url==='https://graph.microsoft.com/v1.0/chats/'+encodeURIComponent('19:abc@thread.v2')+'/messages');
    t('text: with the sign-in', c.headers.Authorization==='Bearer TOK');
    t('text: escaped, new lines kept', b.body.contentType==='html' && b.body.content==='Lunch &lt;b&gt;Friday&lt;/b&gt;?<br>Tacos &amp; tea');
    calls.length=0;
    await C.sendPhoto(chatWith(ME, QUINN), ME.id, 'QUJD', 800, 600);
    const p=json(calls[0].body);
    t('photo: inside the message (hostedContents 1, JPEG)', p.hostedContents.length===1 && p.hostedContents[0]['@microsoft.graph.temporaryId']==='1' && p.hostedContents[0].contentType==='image/jpeg' && p.hostedContents[0].contentBytes==='QUJD');
    t('photo: the message points at it', /<img src="\.\.\/hostedContents\/1\/\$value" width="800" height="600"/.test(p.body.content));
  }
  {
    const item={id:'it1', name:'Home-Brace video.mp4', webUrl:'https://contoso-my.sharepoint.com/personal/p/Documents/Microsoft%20Teams%20Chat%20Files/Home-Brace%20video.mp4', eTag:'"{153A8F0B-1C2D-4E5F-8A9B-0C1D2E3F4A5B},1"'};
    const {C, calls}=load({ls:testersLS([QUINN, AVERY]), replies:[
      {match:c=>c.method==='PUT' && /:\/content\?/.test(c.url), body:item},
      {match:c=>/\/invite$/.test(c.url), body:{value:[]}},
      {match:c=>/\/messages$/.test(c.url), body:{id:'m2', messageType:'message'}}]});
    const prog=[];
    const r=await C.sendVideo(chatWith(ME, QUINN, AVERY), ME.id, {size:3*1024*1024, type:'video/mp4'}, 'Home-Brace video.mp4', f=>prog.push(f), 'Watch this');
    const [up, inv, msg]=calls;
    t('video: a small one in one upload to OneDrive\'s Teams Chat Files', up.method==='PUT' && up.url==='https://graph.microsoft.com/v1.0/me/drive/root:/Microsoft%20Teams%20Chat%20Files/Home-Brace%20video.mp4:/content?@microsoft.graph.conflictBehavior=rename' && up.headers.Authorization==='Bearer TOK');
    const ib=json(inv.body);
    t('video: shared with the others in the chat, read only, sign-in needed, no email', inv.url==='https://graph.microsoft.com/v1.0/me/drive/items/it1/invite' && ib.requireSignIn===true && ib.sendInvitation===false && JSON.stringify(ib.roles)==='["read"]' &&
      JSON.stringify(ib.recipients)===JSON.stringify([{email:QUINN.email},{email:AVERY.email}]));
    const mb=json(msg.body);
    t('video: the message carries it the way Teams does (reference attachment, id from the eTag)', mb.attachments.length===1 && mb.attachments[0].id==='153a8f0b-1c2d-4e5f-8a9b-0c1d2e3f4a5b' && mb.attachments[0].contentType==='reference' && mb.attachments[0].contentUrl===item.webUrl && mb.attachments[0].name===item.name);
    t('video: the body points at the attachment, with the words', mb.body.content==='Watch this <attachment id="153a8f0b-1c2d-4e5f-8a9b-0c1d2e3f4a5b"></attachment>');
    t('video: progress reaches 100%', prog[prog.length-1]===1 && r.shared===true && r.message.id==='m2');
  }
  {
    const size=25*1024*1024, CH=320*1024*32, blob={size, type:'video/mp4', slice:(a,b)=>({part:[a,b]})};
    const item={id:'it2', name:'big.mp4', webUrl:'https://contoso-my.sharepoint.com/x/big.mp4', eTag:'"{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE},2"'};
    const {C, calls}=load({ls:testersLS([QUINN]), replies:[
      {match:c=>/createUploadSession$/.test(c.url), body:{uploadUrl:'https://contoso-my.sharepoint.com/upload/abc'}},
      {match:c=>c.url==='https://contoso-my.sharepoint.com/upload/abc', status:202, body:c=>/^bytes 20971520-26214399\/26214400$/.test(c.headers['Content-Range']) ? item : {}},
      {match:c=>/\/invite$/.test(c.url), body:{}}, {match:c=>/\/messages$/.test(c.url), body:{id:'m3', messageType:'message'}}]});
    // the last piece answers 201 with the file
    calls.length=0;
    const prog=[];
    await C.sendVideo(chatWith(ME, QUINN), ME.id, blob, 'big.mp4', f=>prog.push(f));
    const sess=calls[0], parts=calls.filter(c=>c.url==='https://contoso-my.sharepoint.com/upload/abc');
    t('a big video: an upload session, renamed if the name is taken', sess.method==='POST' && /Microsoft%20Teams%20Chat%20Files\/big\.mp4:\/createUploadSession$/.test(sess.url) && json(sess.body).item['@microsoft.graph.conflictBehavior']==='rename');
    t('a big video: sent in pieces of 10 MiB (a multiple of 320 KiB)', CH%(320*1024)===0 && parts.length===3 && parts[0].headers['Content-Range']==='bytes 0-'+(CH-1)+'/'+size && parts[2].headers['Content-Range']==='bytes '+(2*CH)+'-'+(size-1)+'/'+size);
    t('a big video: the pieces carry NO sign-in header (Microsoft refuses one there)', parts.every(c=>!c.headers.Authorization));
    t('a big video: progress goes up to 100%', prog.length===3 && prog[2]===1 && prog[0]<prog[1]);
    const toobig=load({ls:testersLS([QUINN])}); let err='';
    try{ await toobig.C.sendVideo(chatWith(ME, QUINN), ME.id, {size:300*1024*1024, type:'video/mp4'}, 'huge.mp4'); }catch(e){ err=e.message; }
    t('over 250 MB: refused in words, nothing uploaded', /too big/.test(err) && toobig.calls.length===0);
    t('file names: no characters OneDrive refuses', toobig.C._t.safeName('a/b:c*?"<>|#%.mp4')==='a b c .mp4');
  }
  /* ---- 5. Reading: Teams HTML -> plain text ---- */
  {
    const {C}=load({}), P=C._t.parts;
    t('paragraphs and line breaks become new lines', P({contentType:'html', content:'<p>Hi <b>there</b></p><p>Line two<br>three</p>'}).text==='Hi there\nLine two\nthree');
    t('emoji kept', P({contentType:'html', content:'Great <emoji id="smile" alt="😄" title="Smile"></emoji>'}).text==='Great 😄');
    t('mentions read @Name', P({contentType:'html', content:'<at id="0">Quinn Quill</at> can you cover?'}).text==='@Quinn Quill can you cover?');
    t('&amp; and friends decoded (shown escaped later)', P({contentType:'html', content:'Tacos &amp; tea &lt;3 &#128512;'}).text==='Tacos & tea <3 😀');
    const x=P({contentType:'html', content:'<script>alert(1)</script><style>p{}</style><img src="x" onerror="alert(2)">ok'});
    t('scripts, styles and stray pictures are dropped', x.text==='ok' && x.images.length===0);
    const hc='https://graph.microsoft.com/v1.0/chats/19:abc@thread.v2/messages/1/hostedContents/aWQ9/$value';
    const y=P({contentType:'html', content:'<p>Trays</p><img src="'+hc+'" width="300"><img src="https://evil.example/x.png">'});
    t('Microsoft\'s own pictures are collected, others dropped', y.text==='Trays' && y.images.length===1 && y.images[0]===hc);
    t('attachment markers removed', P({contentType:'html', content:'Watch <attachment id="153a"></attachment>'}).text==='Watch');
    t('plain-text bodies kept as they are', P({contentType:'text', content:'  <b>hi</b> '}).text==='<b>hi</b>');
    t('chat.html: words only ever go in escaped', /if\(m\.text\) h\+='<div class="bub">'\+esc\(m\.text\)\+'<\/div>';/.test(CHAT) && !/innerHTML=[^;\n]*m\.text(?!\))/.test(CHAT));
    t('chat.html: only https files and pictures are shown', /const httpsOnly=u=>\/\^https:\\\/\\\/\/i\.test/.test(CHAT) && /if\(!httpsOnly\(f\.url\)\) return;/.test(CHAT));
  }
  {
    const {C}=load({}), M=C._t.mapMessage;
    t('system messages are left out', M({messageType:'systemEventMessage'}, ME.id)===null);
    const m=M({id:'1', messageType:'message', createdDateTime:'2026-11-12T15:00:00Z', from:{user:{id:QUINN.id, displayName:QUINN.name}}, body:{contentType:'html', content:'<p>Here</p><attachment id="g"></attachment>'},
      attachments:[{id:'g', contentType:'reference', contentUrl:'https://contoso-my.sharepoint.com/x/clip.MOV', name:'clip.MOV'}, {id:'h', contentType:'reference', contentUrl:'https://contoso-my.sharepoint.com/x/notes.pdf', name:'notes.pdf'}]}, ME.id);
    t('a message: who, when, words', m.from===QUINN.name && m.fromId===QUINN.id && !m.mine && m.text==='Here' && m.at===Date.parse('2026-11-12T15:00:00Z'));
    t('a message: a video file and another file', m.files.length===2 && m.files[0].video===true && m.files[1].video===false && m.files[1].name==='notes.pdf');
    t('a message of mine is marked mine', M({id:'2', messageType:'message', from:{user:{id:ME.id}}, body:{contentType:'text', content:'x'}}, ME.id).mine===true);
    t('a deleted message says so, nothing else', (d=>d.text==='This message was deleted.' && !d.files.length)(M({id:'3', messageType:'message', deletedDateTime:'2026-11-12T15:00:00Z', from:{user:{id:QUINN.id}}, body:{contentType:'html', content:'secret'}, attachments:[{contentType:'reference', contentUrl:'https://x/y.mp4', name:'y.mp4'}]}, ME.id)));
  }
  {
    const {C}=load({}), MC=C._t.mapChat;
    const mem=[{userId:ME.id, displayName:ME.name, email:ME.email}, {userId:QUINN.id, displayName:QUINN.name, email:'Quinn.Quill@'+D}];
    const base={id:'c1', chatType:'oneOnOne', members:mem, viewpoint:{lastMessageReadDateTime:'2026-11-12T14:00:00Z'},
      lastMessagePreview:{id:'p1', createdDateTime:'2026-11-12T15:00:00Z', from:{user:{id:QUINN.id, displayName:QUINN.name}}, body:{contentType:'html', content:'<p>See you</p>'}}};
    const c=MC(base, ME.id);
    t('a 1:1 is named after the other person', c.type==='person' && c.name===QUINN.name && c.people[1].email==='quinn.quill@'+D);
    t('newer than when I last read it, from them: unread', c.unread===true && c.last.text==='See you');
    t('read since: not unread', MC(Object.assign({}, base, {viewpoint:{lastMessageReadDateTime:'2026-11-12T16:00:00Z'}}), ME.id).unread===false);
    t('my own last message: not unread', MC(Object.assign({}, base, {lastMessagePreview:Object.assign({}, base.lastMessagePreview, {from:{user:{id:ME.id}}})}), ME.id).unread===false);
    t('a group keeps its name', MC(Object.assign({}, base, {chatType:'group', topic:'Carlsbad office'}), ME.id).name==='Carlsbad office');
    t('meeting chats are left out', MC(Object.assign({}, base, {chatType:'meeting'}), ME.id)===null);
    t('chats hidden in Teams are left out', MC(Object.assign({}, base, {viewpoint:{isHidden:true}}), ME.id)===null);
  }
  /* ---- 6. The list, reading, people ---- */
  {
    const {C, calls}=load({replies:[{match:c=>/\/me\/chats/.test(c.url), body:{value:[{id:'c1', chatType:'oneOnOne', members:[]}, {id:'c2', chatType:'meeting'}]}}]});
    const l=await C.listChats(ME.id);
    t('the list: newest first, with the people and the last message, 50 at most', /\/me\/chats\?\$top=50&\$orderby=lastMessagePreview\/createdDateTime%20desc&\$expand=members,lastMessagePreview$/.test(calls[0].url) && l.length===1);
    const fb=load({replies:[{match:c=>/\$expand=members,lastMessagePreview/.test(c.url), status:400, body:{error:{message:'not both'}}},
      {match:c=>/\/me\/chats/.test(c.url), body:{value:[{id:'c1', chatType:'group', topic:'T'}]}},
      {match:c=>/\/chats\/c1\/members$/.test(c.url), body:{value:[{userId:QUINN.id, displayName:QUINN.name, email:QUINN.email}]}}]});
    const l2=await fb.C.listChats(ME.id);
    t('if Microsoft won\'t do both at once: the preview, then each chat\'s people', fb.calls.length===3 && /\$expand=lastMessagePreview$/.test(fb.calls[1].url) && l2[0].people[0].id===QUINN.id);
    const ms=load({replies:[{match:c=>/messages\?/.test(c.url), body:{value:[{id:'b', messageType:'message', createdDateTime:'2026-11-12T15:01:00Z', from:{user:{id:'x'}}, body:{contentType:'text', content:'2'}}, {id:'a', messageType:'message', createdDateTime:'2026-11-12T15:00:00Z', from:{user:{id:'x'}}, body:{contentType:'text', content:'1'}}], '@odata.nextLink':'https://graph.microsoft.com/v1.0/next'}}]});
    const got=await ms.C.listMessages('c1', ME.id);
    t('messages: the newest 50, shown oldest first, with a link to earlier ones', /\/chats\/c1\/messages\?\$top=50&\$orderby=createdDateTime%20desc$/.test(ms.calls[0].url) && got.msgs.map(m=>m.id).join()==='a,b' && got.next==='https://graph.microsoft.com/v1.0/next');
    const mr=load({}); await mr.C.markRead('c1', ME.id);
    t('read: for me, in the practice\'s tenant', /\/chats\/c1\/markChatReadForUser$/.test(mr.calls[0].url) && JSON.stringify(json(mr.calls[0].body))==='{"user":{"id":"u-me","tenantId":"edb81e45-7fa8-4147-982f-2f31c6298086"}}');
    const sp=load({replies:[{match:c=>/\/users\?/.test(c.url), body:{value:[{id:'1', displayName:"Sam O'Brien", mail:'Sam.OBrien@'+D, userPrincipalName:'sam@'+D}, {id:'2', displayName:'Guest', userPrincipalName:'g_x.com#EXT#@'+D}]}}]});
    const ppl=await sp.C.searchPeople("O'Bri");
    t('people search: a quote can\'t break the search', decodeURIComponent(sp.calls[0].url).indexOf("startswith(displayName,'O''Bri')")>0);
    t('people search: guests left out (this tenant only)', ppl.length===1 && ppl[0].email==='sam.obrien@'+D);
    t('people search: nothing for one letter', (await sp.C.searchPeople('a')).length===0);
    const cc=load({}); await cc.C.createChat(ME.id, [QUINN.id]); await cc.C.createChat(ME.id, [QUINN.id, AVERY.id], 'Home-Brace test');
    const one=json(cc.calls[0].body), grp=json(cc.calls[1].body);
    t('new chat with one person: a 1:1 (Teams hands back the existing one)', one.chatType==='oneOnOne' && one.members.length===2 && one.members[1]['user@odata.bind']==="https://graph.microsoft.com/v1.0/users('u-q')" && !one.topic);
    t('new chat with several: a named group', grp.chatType==='group' && grp.members.length===3 && grp.topic==='Home-Brace test');
  }
  /* ---- 7. Odds and ends ---- */
  {
    const {C}=load({});
    t('eTag -> attachment id', C._t.etagGuid('"{153A8F0B-1C2D-4E5F-8A9B-0C1D2E3F4A5B},1"')==='153a8f0b-1c2d-4e5f-8a9b-0c1d2e3f4a5b' && C._t.etagGuid('nothing')==='');
    const url='https://contoso-my.sharepoint.com/personal/a/Documents/Microsoft Teams Chat Files/clip.mp4?x=1';
    const enc='u!'+Buffer.from(url).toString('base64').replace(/=+$/,'').replace(/\//g,'_').replace(/\+/g,'-');
    t('a file address -> Microsoft\'s share id (u! + base64url, no padding)', C._t.shareId(url)===enc && !/[=+\/]/.test(enc.slice(2)));
    const sh=load({replies:[{match:c=>/\/shares\//.test(c.url), body:{'@microsoft.graph.downloadUrl':'https://dl.example/x', name:'clip.mp4', file:{mimeType:'video/mp4'}, thumbnails:[{large:{url:'https://th.example/l'}}]}}]});
    const f=await sh.C.fileFor(url);
    t('playing a video: its short-lived address from /shares', sh.calls[0].url==='https://graph.microsoft.com/v1.0/shares/'+enc+'/driveItem?$expand=thumbnails' && f.url==='https://dl.example/x' && f.thumb==='https://th.example/l');
    await sh.C.fileFor(url);
    t('...asked once, then remembered', sh.calls.length===1);
    const busy=load({ls:testersLS([QUINN]), replies:[{once:true, match:c=>/\/messages$/.test(c.url), status:429, headers:{'Retry-After':'1'}, body:{}}, {match:c=>/\/messages$/.test(c.url), body:{id:'ok'}}]});
    const ok=await busy.C.sendText(chatWith(ME, QUINN), ME.id, 'hi');
    t('Microsoft says "too many": waits and tries again', busy.calls.length===2 && ok.id==='ok');
    const bad=load({ls:testersLS([QUINN]), replies:[{match:()=>true, status:403, body:{error:{code:'Forbidden', message:'Missing scope permissions on the request.'}}}]});
    let e2=null; try{ await bad.C.sendText(chatWith(ME, QUINN), ME.id, 'hi'); }catch(e){ e2=e; }
    t('Microsoft\'s refusal comes back in its own words', e2 && e2.status===403 && /Missing scope/.test(e2.message));
    t('call: opens Teams with the others', C.callLink(chatWith(ME, QUINN, AVERY), ME.id)==='https://teams.microsoft.com/l/call/0/0?users='+encodeURIComponent(QUINN.email)+','+encodeURIComponent(AVERY.email));
    t('chat.html: loads chatgraph.js', /<script src="chatgraph\.js\?v=hc\d+"><\/script>/.test(CHAT));
    t('chat.html: "Test the real chat" only for an Admin, never on the live site', /else if\(!\(window\.PH && PH\.isLive && PH\.isLive\(\)\) && CG\.signedIn\(\) && adminNow\(\) && !r\.querySelector/.test(CHAT));
    t('chat.html: the real chat starts only when chatgraph says real', /if\(CG\.mode\(\)==='real'\)\{ if\(!REALCHAT\) startReal\(\); return; \}/.test(CHAT));
    t('chat.html: not-yet-approved says so in words', /Chat isn’t approved by IT yet\./.test(CHAT));
  }
  console.log(pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})().catch(e=>{ console.log('  FAIL  crashed: '+(e && e.stack || e)); process.exit(1); });
