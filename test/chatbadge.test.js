/* THE CHAT COUNT ON EVERY PAGE (Heather 18/11/2026: "Since I have Home Brace open, I do not see a number next to my
   messages when you send me one. If I don't have it open I think it does put the number next to the chat icon").
       node test/chatbadge.test.js
   Runs user.js's own unread rule on a pretend Microsoft answer. Made-up people only. */
const fs=require('fs'), path=require('path');
const U=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const fnOf=(src,name)=>{ const i=src.indexOf('function '+name+'('); if(i<0) return ''; let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{') d++; else if(src[k]==='}'){ d--; if(!d) return src.slice(i, k+1); } } return ''; };
(async ()=>{
  const SS={}, now=Date.parse('2026-11-18T18:00:00Z'), iso=ms=>new Date(ms).toISOString();
  const chats=[
    {id:'a', chatType:'oneOnOne', viewpoint:{lastMessageReadDateTime:iso(now-3600000)}, lastMessagePreview:{createdDateTime:iso(now-60000), from:{user:{id:'u-q'}}}},             // new from Quinn -> unread
    {id:'b', chatType:'group', viewpoint:{lastMessageReadDateTime:iso(now)}, lastMessagePreview:{createdDateTime:iso(now-60000), from:{user:{id:'u-q'}}}},                         // already read
    {id:'c', chatType:'oneOnOne', viewpoint:{lastMessageReadDateTime:iso(now-3600000)}, lastMessagePreview:{createdDateTime:iso(now-60000), from:{user:{id:'u-me'}}}},           // mine
    {id:'d', chatType:'oneOnOne', viewpoint:{isHidden:true, lastMessageReadDateTime:iso(now-3600000)}, lastMessagePreview:{createdDateTime:iso(now-60000), from:{user:{id:'u-q'}}}}, // hidden
    {id:'e', chatType:'meeting', viewpoint:{}, lastMessagePreview:{createdDateTime:iso(now-60000), from:{user:{id:'u-q'}}}},                                                          // a meeting chat
    {id:'f', chatType:'group', viewpoint:{}, lastMessagePreview:{createdDateTime:iso(now-60000), isDeleted:true, from:{user:{id:'u-q'}}}}];                                          // deleted
  let asked=null, badge=0;
  const run=new Function('env','chatPilotMe','PROFILE','window','PH_AUTH','fetch','document','sessionStorage','chatBadge','location',
    'let cuBusy=false;\n'+'async '+fnOf(U,'chatUnreadCheck')+'\nreturn chatUnreadCheck();');
  await run(()=>'live', ()=>true, {id:'u-me'}, {PH_AUTH:{tokenFor:x=>(asked=x, Promise.resolve('T'))}}, {tokenFor:x=>(asked=x, Promise.resolve('T'))},
    async url=>({ok:true, json:async ()=>({value:chats}), url}), {visibilityState:'visible'}, {setItem:(k,v)=>{ SS[k]=v; }}, ()=>{ badge++; }, {pathname:'/v1/home.html'});
  t('counts only chats with something new for YOU: not read yet, not yours, not hidden, not deleted, not a meeting chat',
    JSON.stringify(JSON.parse(SS.ph_chat_unread))==='{"a":1}' && badge===1 && asked.join()==='Chat.ReadWrite');
  t('on every page on the live site for whoever has chat (the Chat page keeps its own count); never the mock-up’s made-up 3 on live',
    /if\(env\(\)!=='live' \|\| !chatPilotMe\(\) \|\| \/chat\\\.html\$\/\.test\(location\.pathname\)/.test(fnOf(U,'chatUnreadCheck')) && /let n=env\(\)==='live' \? 0 : 3;/.test(fnOf(U,'chatBadge')));
  t('checked when the page opens, every minute while it’s on screen, on coming back, and 1.5 s after a chat alert reaches this device',
    /cuT=setInterval\(chatUnreadCheck, 60000\);/.test(fnOf(U,'chatUnreadStart')) && /visibilitychange/.test(fnOf(U,'chatUnreadStart')) && /window\.addEventListener\('focus', chatUnreadCheck\);/.test(fnOf(U,'chatUnreadStart')) &&
    /d\.type==='ph-alert' && d\.message && d\.message\.tag==='hb-chat'\) setTimeout\(chatUnreadCheck, 1500\)/.test(fnOf(U,'chatUnreadStart')) && /chatUnreadStart\(\); \} \}\); \}/.test(U));
  t('…and never while the page is in the background', /document\.visibilityState!=='visible'\) return;/.test(fnOf(U,'chatUnreadCheck')));
  /* THE RED NUMBER ON THE APP ICON (20/11/2026, Cory: Android shows it for a chat message, his iPhone doesn't) */
  { const SW=fs.readFileSync(path.join(__dirname,'..','v1','sw.js'),'utf8'), store={}, badges=[], L={};
    const caches={ open:()=>Promise.resolve({ match:k=>Promise.resolve(k in store ? {text:()=>Promise.resolve(store[k])} : undefined), put:(k,r)=>r.text().then(v=>{ store[k]=v; }) }) };
    class Resp{ constructor(b){ this.b=b; } text(){ return Promise.resolve(this.b); } }
    const self={ addEventListener:(n,f)=>{ L[n]=f; }, navigator:{ setAppBadge:n=>{ badges.push(n); return Promise.resolve(); } }, caches,
      registration:{ showNotification:()=>Promise.resolve(), scope:'https://x/v1/' }, clients:{ matchAll:()=>Promise.resolve([]), claim:()=>Promise.resolve() }, skipWaiting:()=>{} };
    require('vm').runInNewContext(SW, { self, caches, Response:Resp, Promise, URL, console, Math, String, parseInt });
    const push=async()=>{ let w; L.push({ data:{ json:()=>({title:'Quinn', body:'hi', tag:'hb-chat'}) }, waitUntil:p=>{ w=p; } }); await w; };
    await push(); await push();
    t('each alert adds one to the app icon’s number (an iPhone only shows what the app sets)', JSON.stringify(badges)==='[1,2]');
    t('opening Home-Brace sets the icon’s number to the unread chats, 0 clears it (live only)', /if\(env\(\)==='live'\) appBadge\(n\);/.test(U) && /navigator\.clearAppBadge \? navigator\.clearAppBadge\(\)/.test(U) && /caches\.open\('ph-badge'\)\.then\(c=>c\.put\('ph-badge-count'/.test(U)); }
  t('the glass bar: a finger drawn down 30px always brings the whole bar back (Cory 21/11: "sometimes it doesn\'t")', /if\(t\.clientY-fy>30\)\{ barMini\(false\); fy=t\.clientY; \}/.test(U));
  console.log(ok.map(s=>'  PASS  '+s).join('\n'));
  if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
  console.log('\n'+ok.length+' passed, '+bad.length+' failed');
  process.exit(bad.length?1:0);
})().catch(e=>{ console.log('CRASH', e && e.stack); process.exit(1); });
