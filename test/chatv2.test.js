/* CHAT v2 (18/11/2026): the Slack-style message box, formatting, @mentions, reactions, the photo viewer.
       node test/chatv2.test.js
   SANDBOX ONLY until chat.html CHAT_V2_LIVE is true (one live device can try it first: localStorage ph_chat_v2 = '1').
   Cory: "it should be like slack where microphone is below (don't add the code stuff, but basic bold and links and
   everything they have is well layed out", "add an emoji to their message ... the message they sent and its under it",
   "Clicking on photo in chat that brings up bigger view exactly like slack does".
   Runs chatgraph.js itself against a pretend Microsoft (no network). Made-up people only. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const R=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const SRC=R('chatgraph.js'), CHAT=R('chat.html');
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };

function load(){
  const calls=[], LS={};
  const w={ localStorage:{getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}},
    console, Promise, JSON, Date, Math, encodeURIComponent, decodeURIComponent, unescape, escape,
    setTimeout:f=>{ f(); return 0; }, clearTimeout(){}, btoa:s=>Buffer.from(s,'binary').toString('base64'), URL:{createObjectURL:()=>'blob:x'} };
  w.window=w;
  w.PH={isLive:()=>false, isAdmin:()=>true, profileOf:()=>({id:'u-me', displayName:'Priya Tatum'})};
  w.PH_AUTH={tokenFor:()=>Promise.resolve('TOK')};
  w.fetch=async (url, o)=>{ o=o||{}; calls.push({url, method:o.method||'GET', body:o.body ? JSON.parse(o.body) : null});
    return {ok:true, status:200, headers:{get:()=>null}, json:async ()=>({id:'m1', messageType:'message', createdDateTime:'2026-11-18T10:00:00Z', body:{contentType:'html', content:'hi'}}), blob:async ()=>({})}; };
  vm.createContext(w); vm.runInContext(SRC, w);
  return {C:w.PH_CHATG, calls, LS};
}
const {C, calls, LS}=load();
const D='example.test';
LS['ph_chat_testers']=JSON.stringify([{email:'quinn.quill@'+D, name:'Quinn Quill'}]);
const chat={id:'19:abc@thread.v2', type:'person', people:[{id:'u-me', name:'Priya Tatum', email:'priya.tatum@'+D}, {id:'u-q', name:'Quinn Quill', email:'quinn.quill@'+D}]};

/* ---- what reaches the page: only the safe set, whatever Teams (or anyone) sends ---- */
const clean=C.cleanRich;
t('formatting kept: bold, italic, underline, strike, lists, quote, line breaks',
  clean('<p><strong>Hi</strong> <em>there</em> <u>u</u> <s>s</s></p><ul><li>one</li></ul><ol><li>two</li></ol><blockquote>q</blockquote>a<br>b')===
  '<p><b>Hi</b> <i>there</i> <u>u</u> <s>s</s></p><ul><li>one</li></ul><ol><li>two</li></ol><blockquote>q</blockquote>a<br>b');
t('NOTHING that runs: scripts, onerror, javascript: links, iframes, styles, event attributes - all gone, the words kept as words',
  !/script|onerror|onclick|javascript:|iframe|style=|<img/i.test(clean('<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><iframe src="https://x"></iframe><b onclick="x()" style="color:red">B</b><svg onload=alert(1)>s</svg>')) &&
  clean('<b onclick="x()">B</b>')==='<b>B</b>' && clean('<a href="javascript:alert(1)">x</a>')==='x');
t('…a link only for https / http / mailto, opening in a new tab; quotes in it can’t break out', clean('<a href="https://ex.test/a?b=1&c=2">L</a>')==='<a href="https://ex.test/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">L</a>' &&
  clean('<a href="https://ex.test/&quot; onmouseover=&quot;x">L</a>').indexOf('onmouseover="')<0 && clean('<a href="data:text/html,x">L</a>')==='L');
t('…< > & typed as words stay words', clean('1 < 2 & 3 > 2')==='1 &lt; 2 &amp; 3 &gt; 2' && clean('&lt;b&gt;not bold&lt;/b&gt;')==='&lt;b&gt;not bold&lt;/b&gt;');
t('…tags left open are closed; a stray closing tag is ignored', clean('<b><i>x')==='<b><i>x</i></b>' && clean('x</b></ul>')==='x');
t('a Teams @mention shows as "@Name" (highlighted), never as Teams markup', clean('<at id="0">Quinn Quill</at> hi')==='<span class="at">@Quinn Quill</span> hi');
t('…and keeps that highlight when cleaned a second time where it’s shown; any other <span> (or one with extras) is dropped, words kept',
  clean(clean('<at id="0">Quinn Quill</at> hi'))==='<span class="at">@Quinn Quill</span> hi' && clean('<span class="at" onclick="x()">A</span>')==='<span class="at">A</span>' &&
  clean('<span style="color:red">A</span>')==='A' && clean('<span class="at evil">A</span>')==='A' && clean('<span class="at">A</span>','teams')==='A');
t('Teams emoji pictures become the emoji itself; other pictures are left to the photo part', clean('<emoji id="like" alt="👍" title="Like"></emoji>')==='👍' && clean('<img src="https://x/y.png">')==='');
const T=C._t;
t('a plain Teams message stays plain words (no formatting to keep)', T.richOf({contentType:'html', content:'<p>Just words</p>'})==='' && T.richOf({contentType:'text', content:'<b>x</b>'})==='' &&
  T.richOf({contentType:'html', content:'<p><b>Bold</b> words</p>'})==='<p><b>Bold</b> words</p>');

/* ---- reactions ---- */
const rs=T.reactionsOf([{reactionType:'like', user:{user:{id:'u-q', displayName:'Quinn Quill'}}}, {reactionType:'💯', user:{user:{id:'u-me'}}}, {reactionType:'x'.repeat(40), user:{user:{id:'u-z'}}}, null]);
t('reactions read: Teams’ "like" is 👍, any emoji as itself, who reacted, the exact Teams name kept; junk dropped',
  rs.length===2 && rs[0].emoji==='👍' && rs[0].raw==='like' && rs[0].userId==='u-q' && rs[0].name==='Quinn Quill' && rs[1].emoji==='💯' && rs[1].raw==='💯');
t('a message carries its reactions and its formatting', (()=>{ const m=T.mapMessage({id:'1', messageType:'message', createdDateTime:'2026-11-18T10:00:00Z', from:{user:{id:'u-q', displayName:'Quinn Quill'}},
  body:{contentType:'html', content:'<p><b>Yes</b></p>'}, reactions:[{reactionType:'heart', user:{user:{id:'u-me'}}}]}, 'u-me'); return m.rich==='<p><b>Yes</b></p>' && m.reactions[0].emoji==='❤️'; })());
(async ()=>{
  calls.length=0;
  await C.react(chat, 'u-me', 'm 1', '👍', true);
  await C.react(chat, 'u-me', 'm1', '🙏', true);
  await C.react(chat, 'u-me', 'm1', '👍', false, '👍');
  t('reacting: setReaction / unsetReaction on THAT message; 👍 goes as Teams’ own "like"; taking one back uses the name it was saved under',
    calls[0].method==='POST' && /\/chats\/19%3Aabc%40thread\.v2\/messages\/m%201\/setReaction$/.test(calls[0].url) && calls[0].body.reactionType==='like' &&
    calls[1].body.reactionType==='🙏' && /unsetReaction$/.test(calls[2].url) && calls[2].body.reactionType==='👍');
  let locked=false; try{ await C.react({id:'19:x', type:'group', people:[{id:'u-me'}, {id:'u-z', email:'zed@'+D}]}, 'u-me', 'm1', '👍', true); }catch(_){ locked=true; }
  t('…only in a chat you may send to (the pilot / test lock is checked inside, before anything leaves)', locked);

  /* ---- sending formatting and mentions to Teams ---- */
  calls.length=0;
  await C.sendText(chat, 'u-me', 'Hi Quinn', {html:'<b>Hi</b> <at id="0">Quinn Quill</at> <a href="https://ex.test">see</a><script>x</script>', mentions:[{id:'u-q', name:'Quinn Quill'}]});
  const b=calls[0].body;
  t('formatted text goes to Teams as HTML from the safe set; the mention as <at id="0"> with its person', b.body.contentType==='html' &&
    b.body.content==='<b>Hi</b> <at id="0">Quinn Quill</at> <a href="https://ex.test">see</a>' && b.mentions.length===1 && b.mentions[0].id===0 &&
    b.mentions[0].mentioned.user.id==='u-q' && b.mentions[0].mentionText==='Quinn Quill');
  const tb=T.teamsBody('<at id="0">Nobody</at> and <at id="1">Quinn Quill</at>', [{id:'', name:'Nobody'}, {id:'u-q', name:'Quinn Quill'}]);
  t('…a mention without a real person becomes plain words, and the rest are renumbered (Teams refuses a mismatch)', tb.content==='Nobody and <at id="0">Quinn Quill</at>' && tb.mentions.length===1 && tb.mentions[0].mentioned.user.id==='u-q');
  calls.length=0;
  await C.sendPhoto(chat, 'u-me', 'QUJD', 10, 20, 'x', {html:'<at id="0">Quinn Quill</at> look', mentions:[{id:'u-q', name:'Quinn Quill'}]});
  t('a photo with formatted words and a mention: the words above the picture, the mention listed too', /^<at id="0">Quinn Quill<\/at> look<div><span><img src="\.\.\/hostedContents\/1\/\$value"/.test(calls[0].body.body.content) &&
    calls[0].body.mentions.length===1 && calls[0].body.hostedContents.length===1);
  calls.length=0;
  await C.sendFile('19:abc@thread.v2', {eTag:'"{0F0E0D0C-0B0A-0908-0706-050403020100},1"', webUrl:'https://ex.test/v.mp4', name:'v.mp4'}, 'x', {html:'<i>clip</i> <at id="0">Quinn Quill</at>', mentions:[{id:'u-q', name:'Quinn Quill'}]});
  t('a video with formatted words and a mention', /^<i>clip<\/i> <at id="0">Quinn Quill<\/at> <attachment id="0f0e0d0c-/.test(calls[0].body.body.content) && calls[0].body.mentions.length===1);
  calls.length=0;
  await C.sendText(chat, 'u-me', 'plain <b>', null);
  t('without the new box (v1, the live site today) a message is sent exactly as before', calls[0].body.body.content.indexOf('&lt;b&gt;')>=0 && !calls[0].body.mentions);

  /* ---- the page ---- */
  t('OFF on the live site (CHAT_V2_LIVE false); on in the sandbox; one live device can try it (ph_chat_v2 = 1)', /const CHAT_V2_LIVE=false;/.test(CHAT) &&
    /const V2=\(\)=>\{ if\(CHAT_V2_LIVE \|\| !ONLIVE\) return true; try\{ return localStorage\.getItem\('ph_chat_v2'\)==='1'; \}catch\(_\)\{ return false; \} \};/.test(CHAT) &&
    /if\(V2\(\)\) return composerHTML2\(c\);/.test(fnOf(CHAT,'composerHTML')));
  const box=fnOf(CHAT,'composerHTML2');
  t('the box like Slack: Bold, Italic, Underline, Strikethrough, Link, numbered and bulleted lists, Quote - no code buttons',
    ['bold','italic','underline','strikeThrough','insertOrderedList','insertUnorderedList'].every(k=>box.indexOf("tb('cmd','"+k+"'")>=0) && /tb\('link'/.test(box) && /tb\('quote'/.test(box) && !/code/i.test(box));
  t('…the row under it: ＋ photo/video, Aa (shows/hides the formatting), emoji, @, record a video, 🎤 talk to type - and Send on the right',
    /<div class="cbar">'\+tb\('attach'[\s\S]*tb\('fmt'[\s\S]*tb\('emoji'[\s\S]*tb\('mention'[\s\S]*tb\('record'[\s\S]*tb\('mic'[\s\S]*class="sendb" data-act="send"/.test(box));
  t('…the 🎤 is in that row, not floating (the box itself says data-nomic)', /id="txt" class="ed blank" contenteditable="true"[^>]{0,160}data-nomic/.test(box));
  t('…a waiting photo/video sits above it, as before', /composer v2">'\+stagedHTML\(st\)/.test(box));
  t('Enter sends; Shift+Enter a new line; Enter in a list starts the next point (Ctrl/Cmd+Enter sends)', /if\(inLi && !\(e\.ctrlKey \|\| e\.metaKey\)\) return;/.test(CHAT) && /if\(e\.key==='Enter' && !e\.shiftKey && !e\.isComposing && e\.target && e\.target\.id==='txt'\)/.test(CHAT));
  t('pasted words come in as plain words (no stray styles from other sites); a pasted picture waits like a picked one', /if\(!f\)\{ if\(isEd\(box\)\)\{ e\.preventDefault\(\); const tx=\(e\.clipboardData && e\.clipboardData\.getData\('text\/plain'\)\)/.test(CHAT));
  t('a link must be a real web address (or email) - anything else is refused', /if\(!CG \|\| !CG\._t\.safeHref\(u\)\)\{/.test(fnOf(CHAT,'linkOk')));
  t('@ offers only the people in that chat; picking one sends a real Teams mention', /c\.people\|\|\[\]\)\.filter\(p=>p\.id!==MEID\)/.test(fnOf(CHAT,'mentionPop')) &&
    /const at=document\.createElement\('at'\); at\.setAttribute\('id', String\(i\)\);/.test(fnOf(CHAT,'edGet')));
  t('what Teams sends is cleaned AGAIN where it’s shown (two locks); the made-up chat too', /if\(m\.rich && V2\(\) && CG\) h\+='<div class="bub rich">'\+CG\.cleanRich\(m\.rich\)\+'<\/div>';/.test(fnOf(CHAT,'realBody')) &&
    /mm\.richHtml=CG\.cleanRich\(/.test(fnOf(CHAT,'send')));
  const rh=fnOf(CHAT,'reactsHTML');
  t('reactions under the message: one chip per emoji with how many, mine highlighted, who in the tooltip', /'<button type="button" class="rc'\+\(mine\?' mine':''\)/.test(rh) && /rs\.length/.test(rh) && /rs\.map\(r=>r\.name\|\|'Someone'\)/.test(rh));
  t('…tap a chip to add or take back yours; only where you can send (pilot lock) - otherwise you just see them', /const can=!REALCHAT \|\| \(c && CG\.canSend\(c, MEID\)\)/.test(rh) && /\(can\?' data-act="react"/.test(rh));
  t('…shows straight away, undone (and said) if Microsoft refuses', /m\.reactions=on \? before\.concat/.test(fnOf(CHAT,'reactToggle')) && /catch\(e\)\{ m\._rb=0; m\.reactions=before;/.test(fnOf(CHAT,'reactToggle')));
  t('…reactions added in Teams show here within seconds (the open chat’s check compares them)', /rk\(o\)!==rk\(n\)/.test(fnOf(CHAT,'pollOpen')) && /!\(o\._rb && Date\.now\(\)-o\._rb<6000\)/.test(fnOf(CHAT,'pollOpen')));
  t('…on a phone: hold a message to react or copy its words (like WhatsApp)', /lp=\{x0, y0, t:setTimeout\(/.test(CHAT) && /data-act="copytext"/.test(CHAT));
  const lbo=fnOf(CHAT,'lbOpen');
  t('PHOTO VIEWER: tap a photo - full screen, who sent it and when, ‹ › and swipe between the chat’s photos, Esc or ✕ closes, Open full size',
    /const im=e\.target\.closest\('#msgs \.media img'\); if\(im && V2\(\) && im\.getAttribute\('src'\)\)\{ lbOpen\(im\); return; \}/.test(CHAT) &&
    /ArrowRight/.test(lbo) && /ArrowLeft/.test(lbo) && /Escape/.test(lbo) && /touchend/.test(lbo) && /Open full size/.test(lbo) && /data-lb="x"/.test(lbo) && /' of '\+list\.length/.test(lbo));
  t('…only photos already shown (https or this device’s own), nothing typed goes in as HTML', /esc\(x\.src\)/.test(lbo) && !/innerHTML=[^;]*m\.text/.test(lbo));
  t('the phone never zooms on the new box either (16px)', /\.composer textarea, \.search, \.composer \.ed\{font-size:16px\}/.test(CHAT));

  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('CRASH', e && e.stack); process.exit(1); });
