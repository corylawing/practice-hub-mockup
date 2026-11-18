/* CHAT: HIDE A CHAT, DELETE MY MESSAGE (18/11/2026, Cory: "yes build hide chat and delete message").
       node test/chathide.test.js
   Teams doesn't let staff delete a whole chat (only IT, and the history is kept). Hide = off your own list until someone
   writes again (Teams' own Hide). Delete = only your own message, it stays as "This message was deleted." Both undoable,
   both only Chat.ReadWrite. Runs chatgraph.js against a pretend Microsoft. Made-up people only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const R=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const SRC=R('chatgraph.js'), CHAT=R('chat.html');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
const D='example.test', calls=[], LS={ph_chat_testers:JSON.stringify([{email:'quinn.quill@'+D, name:'Quinn Quill'}])};
const w={ localStorage:{getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}}, console, Promise, JSON, Date, Math, encodeURIComponent, decodeURIComponent, unescape, escape,
  setTimeout:f=>{ f(); return 0; }, clearTimeout(){}, btoa:s=>Buffer.from(s,'binary').toString('base64'), atob:s=>Buffer.from(s,'base64').toString('binary') };
w.window=w; w.PH={isLive:()=>false, isAdmin:()=>true, profileOf:()=>({id:'u-me', displayName:'Priya Tatum'})};
w.PH_AUTH={tokenFor:()=>Promise.resolve('TOK')};
w.fetch=async (url, o)=>{ o=o||{}; calls.push({url, method:o.method||'GET', body:o.body ? JSON.parse(o.body) : null}); return {ok:true, status:204, headers:{get:()=>null}, json:async ()=>({})}; };
vm.createContext(w); vm.runInContext(SRC, w);
const C=w.PH_CHATG;
const chat={id:'19:abc@thread.v2', type:'person', people:[{id:'u-me', email:'priya.tatum@'+D}, {id:'u-q', email:'quinn.quill@'+D}]};
const fails=async f=>{ try{ await f(); return ''; }catch(e){ return e.message; } };
(async ()=>{
  await C.hideChat(chat, 'u-me'); await C.hideChat(chat, 'u-me', true);
  t('Hide: POST hideForUser for ME only (and unhideForUser to undo)', /\/chats\/19%3Aabc%40thread\.v2\/hideForUser$/.test(calls[0].url) && calls[0].body.user.id==='u-me' && !!calls[0].body.user.tenantId &&
    /\/unhideForUser$/.test(calls[1].url));
  calls.length=0;
  await C.deleteMessage(chat, 'u-me', {id:'m1', mine:true}); await C.deleteMessage(chat, 'u-me', {id:'m1', mine:true}, true);
  t('Delete: softDelete on MY message (undoSoftDelete to undo) - it stays in the chat as "This message was deleted."', /\/users\/u-me\/chats\/19%3Aabc%40thread\.v2\/messages\/m1\/softDelete$/.test(calls[0].url) && calls[0].method==='POST' &&
    /\/undoSoftDelete$/.test(calls[1].url));
  calls.length=0;
  t('…never someone else’s, never one still sending, never in a chat outside the pilot / test lock (checked before anything leaves)',
    /only delete your own/.test(await fails(()=>C.deleteMessage(chat, 'u-me', {id:'m2', mine:false}))) && /isn’t sent yet/.test(await fails(()=>C.deleteMessage(chat, 'u-me', {id:'local-1', mine:true}))) &&
    /testers/.test(await fails(()=>C.deleteMessage({id:'19:x', type:'group', people:[{id:'u-me'}, {id:'u-z', email:'zed@'+D}]}, 'u-me', {id:'m1', mine:true}))) && calls.length===0);
  t('the page: ⋯ on the chat -> "Hide this chat" (nothing is deleted); it leaves the list and Undo brings it back', /data-act="chatmenu"/.test(CHAT) && /Hide this chat/.test(CHAT) &&
    /await CG\.hideChat\(c, MEID\)/.test(fnOf(CHAT,'hideChatNow')) && /CG\.hideChat\(c, MEID, true\)/.test(fnOf(CHAT,'hideChatNow')));
  t('…🗑 only on MY messages (desktop hover; "Delete message" in the hold menu on a phone), asks first, shows "This message was deleted.", Undo',
    /\(can && mineOf\(m\) \? b\('msgdel','Delete',ICO\.trash,'del'\) : ''\)/.test(fnOf(CHAT,'msgBar')) && /mineOf\(m\) \? '<button type="button" class="copy" data-act="msgdel"/.test(CHAT) && /Delete this message\?/.test(fnOf(CHAT,'msgDelAsk')) &&
    /text:'This message was deleted\.'/.test(fnOf(CHAT,'msgDelNow')) && /CG\.deleteMessage\(c, MEID, before, true\)/.test(fnOf(CHAT,'msgDelNow')));
  t('…the message shown in the "are you sure" is plain text (escaped)', /esc\(String\(m\.text\)\.slice\(0,300\)\)/.test(fnOf(CHAT,'msgDelAsk')) && /'<span>'\+esc\(text\)\+'<\/span>'/.test(fnOf(CHAT,'undoToast')));
  /* the message toolbar, like Slack (Cory 18/11: "Its hard to scroll over to emoji now and it flashes off. Look at what slack does" + "also forward") */
  const MB=fnOf(CHAT,'msgBar');
  t('THE TOOLBAR: over the message’s top corner while you’re on it (it overlaps the bubble, so moving onto it never loses it): React, Forward, Copy, Delete (yours) - phones hold instead',
    /'<div class="mbar">'\+\(can \? b\('reactadd','Add a reaction'/.test(MB) && /b\('fwd','Forward',ICO\.fwd\)/.test(MB) && /b\('copytext','Copy text',ICO\.copy\)/.test(MB) &&
    /\.mbar\{position:absolute;top:-27px;/.test(CHAT) && /@media \(hover:hover\)\{ \.m:hover \.mbar,\.mbar:focus-within\{display:flex\} \}/.test(CHAT) && /'<div class="col">'\+msgBar\(m\)/.test(CHAT));
  t('…reactions keep a ☺+ right after them (always there, not hover-only)', /if\(!chips\) return '';/.test(fnOf(CHAT,'reactsHTML')) && /class="radd" data-act="reactadd"/.test(fnOf(CHAT,'reactsHTML')) && !/\.reacts \.radd\{[^}]*opacity:0/.test(CHAT));
  const FN=fnOf(CHAT,'fwdNow');
  t('FORWARD: pick a chat you may send to (search), add a note if you like; arrives as "Forwarded from <name>" + the words (formatting kept) + the photo; files as their links',
    /const list=CHATS\.filter\(x=>!REALCHAT \|\| CG\.canSend\(x, MEID\)\);/.test(fnOf(CHAT,'fwdDlg')) && /Pick a chat to forward it to\./.test(FN) && /<i>Forwarded from '\+esc\(who\)\+'<\/i>/.test(FN) &&
    /CG\.sendPhoto\(t, MEID, p\.b64, p\.w, p\.h, text, \{html, mentions:\[\]\}\)/.test(FN) && /CG\.sendText\(t, MEID, text, \{html, mentions:\[\]\}\)/.test(FN) && /f=>\/\^https:\\\/\\\/\/i\.test\(f\.url\)/.test(FN));
  t('…what’s forwarded is cleaned / escaped (never raw HTML); the note is plain text', /CG\.cleanRich\(m\.rich\)/.test(FN) && /'<p>'\+esc\(note\)\+'<\/p>'/.test(FN) && /esc\(m\.text\|\|''\)/.test(FN));
  t('DELETE asks first: "Delete this message?" - Keep it / Delete', /Delete this message\?/.test(fnOf(CHAT,'msgDelAsk')) && />Keep it<\/button>/.test(fnOf(CHAT,'msgDelAsk')) && /data-act="msgdelok"/.test(fnOf(CHAT,'msgDelAsk')));
  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('CRASH', e && e.stack); process.exit(1); });
