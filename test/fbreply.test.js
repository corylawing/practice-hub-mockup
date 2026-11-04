/* FEEDBACK REPLIES (04/11/2026): the conversation worked out from the HomeBraceFeedback rows (v1/fbreply.js _pure).
   Made-up people only. Run: node test/fbreply.test.js */
const fs=require('fs'), path=require('path'), vm=require('vm');
let pass=0, fail=0;
const t=(name, ok)=>{ if(ok) pass++; else { fail++; console.log('  FAIL  '+name); } };
const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','v1','fbreply.js'),'utf8'), ctx);
const F=ctx.PH_FBR._pure;

const body=(kind, text, who)=>kind+'\n'+text+'\n\nFrom: '+who+'\nOffices: San Angelo\nPage: Home-Brace · Payroll\nSent: today';
const quinn={email:'quinn.quill@farnsworthorthodontics.com', name:'Quinn Quill', id:'u-q'};
const morgan={email:'morgan.hale@farnsworthorthodontics.com', name:'Morgan Hale', id:'u-m'};

/* Reading the email body back */
{
  const m=F.messageOf(body('QUESTION', 'Can you make the banner go away?\n\nIt says my profile is not finished.', 'Quinn Quill'));
  t('the kind is the first line', m.kind==='QUESTION');
  t('the message keeps its own blank lines, and stops before From:', m.text==='Can you make the banner go away?\n\nIt says my profile is not finished.');
  t('Page and Offices are read from their lines', F.lineOf(body('IDEA','x','Q'),'Page')==='Home-Brace · Payroll' && F.lineOf(body('IDEA','x','Q'),'Offices')==='San Angelo');
  t('an empty body is safe', F.messageOf('').text==='' && F.messageOf(null).kind==='');
}
/* The team's replies */
{
  t('no Replies = none, not done', F.parseReplies('').r.length===0 && F.parseReplies('').doneAt==='');
  t('broken JSON = none (never throws)', F.parseReplies('{oops').r.length===0);
  const rich=F.parseReplies('<div class="ExternalClass1">{&quot;v&quot;&#58;1,&quot;r&quot;&#58;[{&quot;at&quot;&#58;&quot;2026-11-04T15&#58;00&#58;00Z&quot;,&quot;t&quot;&#58;&quot;Done &amp; dusted&quot;}]}</div>');
  t('a rich-text column (HTML-wrapped) still reads', rich.r.length===1 && rich.r[0].t==='Done & dusted');
  const r=F.parseReplies(JSON.stringify({v:1, doneAt:'2026-11-04T16:00:00.000Z', r:[{at:'2026-11-04T15:00:00.000Z', t:'Fixed!'}, {at:'x'}, null]}));
  t('replies without words are dropped', r.r.length===1 && r.r[0].t==='Fixed!' && r.doneAt==='2026-11-04T16:00:00.000Z');
}
/* Who is who */
{
  t('the same person by email, any case', F.sameAs({email:'Quinn.Quill@farnsworthorthodontics.com'}, quinn));
  t('the same person by id', F.sameAs({id:'u-q'}, {id:'u-q'}));
  t('someone else is not', !F.sameAs({email:morgan.email, id:'u-m'}, quinn));
  t('no email and no id is nobody', !F.sameAs({}, {}));
}
/* Conversations */
const rows=[
  {id:'1', at:'2026-11-04T15:09:00Z', by:quinn, Title:'Question: ...', Details:body('QUESTION','Can you make the banner go away?','Quinn Quill'),
   Replies:JSON.stringify({v:1, r:[{at:'2026-11-04T16:00:00.000Z', t:'Fixed - refresh the page.', by:'admin@x'}]}), ReplyTo:''},
  {id:'2', at:'2026-11-04T17:00:00Z', by:quinn, Title:'Reply: ...', Details:body('REPLY','Thanks, it is gone!','Quinn Quill'), Replies:'', ReplyTo:'1'},
  {id:'3', at:'2026-11-04T12:00:00Z', by:morgan, Title:'Idea: ...', Details:body('IDEA','Add a column for ERs','Morgan Hale'), Replies:'', ReplyTo:''},
  {id:'4', at:'2026-11-03T12:00:00Z', by:morgan, Title:'Something: ...', Details:body('SOMETHING’S WRONG','Months greyed out','Morgan Hale'),
   Replies:JSON.stringify({v:1, doneAt:'2026-11-03T13:00:00.000Z', r:[]}), ReplyTo:''}
];
{
  const th=F.threads(rows);
  t('one conversation per first message (the answer back joins its first one)', th.length===3 && !th.some(x=>x.id==='2'));
  const q=th.find(x=>x.id==='1');
  t('in time order: their message, our reply, their answer back', q.msgs.map(m=>m.who).join(',')==='them,team,them' && q.msgs[2].text==='Thanks, it is gone!');
  t('they spoke last, so it is New again for the team', q.isNew && !q.done);
  t('newest conversation first', th[0].id==='1');
  const m=th.find(x=>x.id==='3');
  t('no reply yet = New', m.isNew && !m.lastTeam);
  const d=th.find(x=>x.id==='4');
  t('marked done with no reply = Done, not New', d.done && !d.isNew);
  const answered=F.threads([rows[0]]);
  t('our reply after their message = not New', !answered[0].isNew && answered[0].lastTeam.t===undefined && answered[0].lastTeam.text==='Fixed - refresh the page.');
  const late=F.threads([rows[3], {id:'5', at:'2026-11-04T09:00:00Z', by:morgan, Details:body('REPLY','Still grey','Morgan Hale'), Replies:'', ReplyTo:'4'}]);
  t('an answer back after Done reopens it', late.length===1 && late[0].isNew && !late[0].done);
  t('the page and offices travel with it', q.page==='Home-Brace · Payroll' && q.offices==='San Angelo' && q.kind==='QUESTION');
}
/* The person's side: unread replies */
{
  const mine=F.threads(rows).filter(x=>F.sameAs(x.by, quinn));
  t('only their own conversations', mine.length===1 && mine[0].id==='1');
  t('a reply they have not opened is unread', F.unread(mine, {}).length===1);
  t('opened since = read', F.unread(mine, {'1':'2026-11-04T16:00:00.000Z'}).length===0);
  t('a newer reply after that = unread again', F.unread(mine, {'1':'2026-11-04T15:30:00.000Z'}).length===1);
  t('no reply = nothing unread', F.unread(F.threads([rows[2]]), {}).length===0);
}
/* The page side: replies are signed by the team, never by a name */
{
  const src=fs.readFileSync(path.join(__dirname,'..','v1','fbreply.js'),'utf8');
  t('replies are signed "Home-Brace team"', /TEAM='Home-Brace team'/.test(src) && !/Cory/i.test(src.replace(/Cory: "[^"]*"|\(his choice[^)]*\)|Cory's|Cory,/g,'')));
  t('a phone alert never carries the words of the reply', /body:'Open Home-Brace to read it\.'/.test(src));
}
console.log(pass+' passed, '+fail+' failed'); if(fail) process.exit(1);
