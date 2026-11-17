/* INSTANT CHAT ALERTS (18/11/2026, Cory: "build instant chat alerts").
       node test/chatinstant.test.js
   The server side (api-push/chatkeys.js, chatseal, chatnote) is run for real, with a made-up certificate and messages
   encrypted the way Microsoft encrypts them; the page side (v1/alerts.js chatLink) is run against a pretend Microsoft.
   Nothing leaves this machine. Made-up people. */
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
let pass=0, fail=0; const t=(n,ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+n); } };
const API=path.join(__dirname,'..','api-push');

/* ---------- the server side, with stand-ins for the sign-in check and the push sender ---------- */
const sent=[];
require.cache[require.resolve(path.join(API,'idtoken.js'))]={exports:{ verify:async idt=>{ if(idt!=='GOOD') throw new Error('not signed in'); return {who:'priya.tatum@example.com', oid:'u-me'}; } }};
const realPush=require(path.join(API,'webpush.js'));
require.cache[require.resolve(path.join(API,'webpush.js'))]={exports:Object.assign({}, realPush, { send:async (sub, msg)=>{ sent.push({sub, msg}); return {status:201}; } })};
const K_=require(path.join(API,'chatkeys.js'));
const {publicKey, privateKey}=crypto.generateKeyPairSync('rsa', {modulusLength:2048});
K_._set({seal:crypto.randomBytes(32), cert:'TESTCERT', certId:'hb-chat-test', priv:privateKey, alert:{publicKey:'x', privateKey:'y'}});
const K=K_.keys();
const seal=require(path.join(API,'chatseal','index.js')), note=require(path.join(API,'chatnote','index.js'));
const LIVE='https://kind-hill-00da87410.3.azurestaticapps.net';
const SUB={endpoint:'https://fcm.googleapis.com/fcm/send/abc123', keys:{p256dh:'BPpk', auth:'au'}};
const run=async (fn, req)=>{ const ctx={}; await fn(ctx, req); return ctx.res; };
const graphEncrypt=obj=>{   // exactly as Microsoft does it
  const key=crypto.randomBytes(32), c=crypto.createCipheriv('aes-256-cbc', key, key.subarray(0,16));
  const data=Buffer.concat([c.update(JSON.stringify(obj),'utf8'), c.final()]);
  return {data:data.toString('base64'), dataSignature:crypto.createHmac('sha256', key).update(data).digest('base64'),
    dataKey:crypto.publicEncrypt({key:publicKey, padding:crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash:'sha1'}, key).toString('base64'),
    encryptionCertificateId:'hb-chat-test', encryptionCertificateThumbprint:'x'};
};
const message=(fromId, name, html, extra)=>Object.assign({id:'1', messageType:'message', chatId:'19:abc@thread.v2', from:{user:{id:fromId, displayName:name}}, body:{contentType:'html', content:html}, attachments:[], hostedContents:[]}, extra||{});

(async ()=>{
  let r=await run(seal, {method:'POST', headers:{origin:'https://evil.example'}, body:JSON.stringify({idt:'GOOD', sub:SUB})});
  t('seal: only the live Home-Brace site may ask', r.status===403);
  r=await run(seal, {method:'POST', headers:{origin:LIVE}, body:JSON.stringify({idt:'BAD', sub:SUB})});
  t('seal: only someone signed in to the practice', r.status===401 && JSON.parse(r.body).signin===true);
  r=await run(seal, {method:'POST', headers:{origin:LIVE}, body:JSON.stringify({idt:'GOOD', sub:{endpoint:'https://evil.example/x', keys:SUB.keys}})});
  t('seal: only a real phone/browser alert address', r.status===400);
  r=await run(seal, {method:'POST', headers:{origin:LIVE}, body:JSON.stringify({idt:'GOOD', sub:SUB})});
  const S=JSON.parse(r.body), d=decodeURIComponent((S.url.split('?d=')[1]||''));
  t('seal: the address Microsoft will call, a check value, our PUBLIC certificate',
    r.status===200 && S.ok && S.url.indexOf(LIVE+'/api/chatnote?d=')===0 && S.clientState.length===43 && S.cert==='TESTCERT' && S.certId==='hb-chat-test');
  const box=K_.open(d, K);
  t('seal: inside it, sealed - who it is (from their sign-in, not from the page) and this device’s address', box && box.u==='u-me' && box.s.endpoint===SUB.endpoint && box.s.keys.p256dh==='BPpk');
  t('seal: nobody else can read or change it (a changed byte = nothing)', K_.open(d.slice(0,-2)+(d.slice(-2)==='AA'?'BB':'AA'), K)===null && K_.open('junk', K)===null);

  r=await run(note, {method:'POST', query:{validationToken:'hello-microsoft'}, body:''});
  t('note: answers Microsoft’s "is this you?" with the token, as plain text', r.status===200 && r.body==='hello-microsoft' && r.headers['Content-Type']==='text/plain');
  const post=async (values, q)=>{ sent.length=0; const res=await run(note, {method:'POST', query:Object.assign({d}, q||{}), body:JSON.stringify({value:values})}); return res; };
  const n=(msg, over)=>Object.assign({subscriptionId:'s1', changeType:'created', clientState:S.clientState, tenantId:K_.TENANT,
    resource:"chats('19:abc@thread.v2')/messages('1')", encryptedContent:graphEncrypt(msg)}, over||{});
  r=await post([n(message('u-q','Quinn Quill','<p>See you at <b>3</b> &amp; bring the forms</p>'))]);
  t('note: a message from someone else -> ONE alert to that device: who, the words, opens that chat',
    r.status===202 && sent.length===1 && sent[0].sub.endpoint===SUB.endpoint && sent[0].msg.title==='Quinn Quill' && sent[0].msg.body==='See you at 3 & bring the forms' &&
    sent[0].msg.url==='/v1/chat.html#chat='+encodeURIComponent('19:abc@thread.v2') && sent[0].msg.tag==='hb-chat');
  await post([n(message('u-me','Priya Tatum','my own words'))]);
  t('note: their OWN message -> no alert', sent.length===0);
  await post([n(message('u-q','Quinn Quill','hi'), {clientState:'wrong'})]);
  t('note: a wrong check value (not Microsoft about this link) -> nothing', sent.length===0);
  const bad=n(message('u-q','Quinn Quill','hi')); bad.encryptedContent.dataSignature='AAAA';
  await post([bad]);
  t('note: a message that doesn’t match its signature -> nothing', sent.length===0);
  await post([n(message('u-q','Quinn Quill','hi'), {tenantId:'another-company'})]);
  t('note: another company’s Microsoft -> nothing', sent.length===0);
  await post([n(message('u-q','Quinn Quill','edited'), {changeType:'updated'}), n(message('u-q','Quinn Quill','gone'), {changeType:'deleted'})]);
  t('note: an edit or a delete -> no alert (new messages only)', sent.length===0);
  await post([n(message('u-q','Quinn Quill','added you', {messageType:'systemEventMessage'}))]);
  t('note: Teams’ own "X added Y" notes -> no alert', sent.length===0);
  r=await post([n(message('u-q','Quinn Quill','hi'))], {l:'1'});
  t('note: a lifecycle notice ("renew me", "removed") -> answered, nothing sent (the page renews on the next visit)', r.status===202 && sent.length===0);
  r=await post([n(message('u-q','Quinn Quill','hi'))], {d:'x'+d.slice(1)});
  t('note: a tampered address -> nothing', r.status===202 && sent.length===0);
  t('preview: emoji, line breaks and entities read as words; a photo says so; long words are cut',
    K_.preview(message('u','x','Done <emoji alt="👍"></emoji><br>ok&nbsp;now'))==='Done 👍 ok now' &&
    K_.preview(message('u','x','<img src="../hostedContents/1/$value">'))==='📷 Sent a photo' &&
    K_.preview(message('u','x','<p>layout</p><div><img src="x"></div>'))==='📷 layout' &&
    K_.preview(message('u','x','', {attachments:[{name:'clip.mp4'}]}))==='🎥 Sent a video' &&
    K_.preview(message('u','x','a'.repeat(300))).length===140);

  /* ---------- the page side: v1/alerts.js chatLink against a pretend Microsoft ---------- */
  const SRC=fs.readFileSync(path.join(__dirname,'..','v1','alerts.js'),'utf8');
  function page(opts){
    const LS=Object.assign({ph_alert_sub:JSON.stringify(SUB)}, opts.ls||{}), calls=[];
    const w={console:{warn(){}, log(){}}, Promise, JSON, Date, Math, URL, setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent, atob:s=>Buffer.from(s,'base64').toString('binary'),
      Uint8Array, location:{origin:LIVE, href:LIVE+'/v1/home.html', hostname:'kind-hill-00da87410.3.azurestaticapps.net'},
      localStorage:{getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];}},
      navigator:{userAgent:'Mozilla/5.0 (Macintosh)', maxTouchPoints:0}, Notification:{permission:'granted'},
      document:{addEventListener(){}},
      PH:{isLive:()=>true, chatPilotMe:()=>opts.pilot!==false, chatPilotKnown:()=>true, profileOf:()=>({id:'u-me'})},
      PH_AUTH:{tokenFor:()=>Promise.resolve('TOK'), idToken:()=>Promise.resolve('GOOD')},
      fetch:async (url, o)=>{ o=o||{}; calls.push({url, method:o.method||'GET', body:o.body});
        const R=(st,b)=>({ok:st>=200&&st<300, status:st, json:async()=>b});
        if(/\/api\/chatseal$/.test(url)) return R(200, {ok:true, url:LIVE+'/api/chatnote?d=SEALED', clientState:'CS', cert:'CERT', certId:'hb-chat-test'});
        if(/\/subscriptions$/.test(url)) return R(201, {id:'sub-1', expirationDateTime:new Date(Date.now()+3*864e5-15*60e3).toISOString()});
        if(/\/subscriptions\//.test(url) && o.method==='PATCH') return opts.gone ? R(404, {error:{message:'gone'}}) : R(200, {expirationDateTime:new Date(Date.now()+3*864e5).toISOString()});
        if(/\/subscriptions\//.test(url) && o.method==='DELETE') return R(204, {});
        return R(404, {}); }};
    w.window=w; w.self=w; w.PushManager=function(){}; const reg={pushManager:{getSubscription:async()=>({toJSON:()=>SUB, endpoint:SUB.endpoint, unsubscribe:async()=>true})}};
    w.navigator.serviceWorker={getRegistration:async()=>reg, register:async()=>reg, ready:Promise.resolve(reg)};
    vm.createContext(w); vm.runInContext(SRC, w);
    return {A:w.PH_ALERTS, LS, calls};
  }
  let p=page({});
  let x=await p.A.chatLink();
  const made=p.calls.find(c=>/\/subscriptions$/.test(c.url)), mb=made && JSON.parse(made.body);
  t('page: a pilot member with alerts on gets a link: sealed by the sender, then asked of Microsoft with their own sign-in', x==='made' &&
    p.calls.findIndex(c=>/\/api\/chatseal$/.test(c.url)) < p.calls.indexOf(made) && JSON.parse(p.calls.find(c=>/chatseal/.test(c.url)).body).idt==='GOOD');
  t('page: Microsoft is asked for THEIR chats only, new messages only, encrypted to our certificate, with the renew notices',
    mb && mb.resource==='/users/u-me/chats/getAllMessages' && mb.changeType==='created' && mb.includeResourceData===true && mb.encryptionCertificate==='CERT' &&
    mb.encryptionCertificateId==='hb-chat-test' && mb.clientState==='CS' && mb.notificationUrl===LIVE+'/api/chatnote?d=SEALED' && mb.lifecycleNotificationUrl===LIVE+'/api/chatnote?d=SEALED&l=1');
  t('page: for just under 3 days (Microsoft’s longest), kept on this device', Date.parse(mb.expirationDateTime)-Date.now() < 3*864e5 && Date.parse(mb.expirationDateTime)-Date.now() > 2.9*864e5 &&
    JSON.parse(p.LS.ph_chat_link).id==='sub-1' && JSON.parse(p.LS.ph_chat_link).ep===SUB.endpoint);
  const n0=p.calls.length; x=await p.A.chatLink();
  t('page: the next visit with more than 2 days left asks nothing', x==='fine' && p.calls.length===n0);
  p=page({ls:{ph_chat_link:JSON.stringify({id:'sub-1', exp:Date.now()+864e5, ep:SUB.endpoint})}});
  x=await p.A.chatLink();
  t('page: under 2 days left -> renewed (PATCH), nothing new made', x==='renewed' && p.calls.some(c=>c.method==='PATCH') && !p.calls.some(c=>/\/subscriptions$/.test(c.url)));
  p=page({gone:true, ls:{ph_chat_link:JSON.stringify({id:'sub-old', exp:Date.now()+864e5, ep:SUB.endpoint})}});
  x=await p.A.chatLink();
  t('page: it had run out at Microsoft -> a new one is made', x==='made' && JSON.parse(p.LS.ph_chat_link).id==='sub-1');
  p=page({ls:{ph_chat_link:JSON.stringify({id:'sub-old', exp:Date.now()+2.5*864e5, ep:'https://fcm.googleapis.com/fcm/send/OLD'})}});
  x=await p.A.chatLink();
  t('page: this device’s alert address changed -> the old link is removed and a new one made', x==='made' && p.calls.some(c=>c.method==='DELETE' && /sub-old/.test(c.url)));
  p=page({pilot:false, ls:{ph_chat_link:JSON.stringify({id:'sub-1', exp:Date.now()+2.5*864e5, ep:SUB.endpoint})}});
  x=await p.A.chatLink();
  t('page: no longer in the pilot (or a guest) -> the link is removed at Microsoft', x==='removed' && p.calls.some(c=>c.method==='DELETE' && /sub-1/.test(c.url)) && !p.LS.ph_chat_link);
  p=page({pilot:false}); x=await p.A.chatLink();
  t('page: not in the pilot -> nothing asked of anyone', x==='off' && p.calls.length===0);
  const AL=SRC, U=fs.readFileSync(path.join(__dirname,'..','v1','user.js'),'utf8');
  t('page: turning alerts off removes the link first; turning them on makes it; every page keeps it up for a pilot member',
    /async function disable\(\)\{\n\s*await chatUnlink\(\);/.test(AL) && /await saveMine\(j\);\n\s*chatLink\(\);/.test(AL) &&
    /if\(chatPilotMe\(\)\) alertsReady\(\)\.then\(function\(A\)\{ if\(A && A\.chatLink\) A\.chatLink\(\); \}\);/.test(U) && /chatPilotKnown:\(\)=>CHATPILOT!==null/.test(U));
  t('page: the live site only; only with alerts on on this device', /function chatLinkWanted\(\)\{ return ON && LIVE && CHAT_INSTANT && !!\(global\.PH && PH\.chatPilotMe && PH\.chatPilotMe\(\)\) && state\(\)==='on' && !!saved\(\); \}/.test(AL));
  const DEP=fs.readFileSync(path.join(__dirname,'..','deploy','deploy-production.sh'),'utf8'), GI=fs.readFileSync(path.join(__dirname,'..','.gitignore'),'utf8');
  t('deploy: ships the certificate next to the sender and refuses without it; the private key is never in git',
    /\[ -f "\$REPO\/deploy\/\.chatcert\.json" \] \|\| \{/.test(DEP) && /cp "\$REPO\/deploy\/\.chatcert\.json" "\$API\/chatcert\.json"/.test(DEP) && /deploy\/\.chatcert\.json/.test(GI) && /api-push\/chatcert\.json/.test(GI));
  t('server: no Microsoft secret, no app permission - the person’s own sign-in asks Microsoft; the sender only keeps its own keys',
    !/client_secret|clientSecret|\.default/.test(fs.readFileSync(path.join(API,'chatkeys.js'),'utf8')+fs.readFileSync(path.join(API,'chatnote','index.js'),'utf8')+fs.readFileSync(path.join(API,'chatseal','index.js'),'utf8')));
  console.log(pass+' passed, '+fail+' failed'); process.exit(fail?1:0);
})().catch(e=>{ console.log('  FAIL  crashed: '+(e && e.stack || e)); process.exit(1); });
