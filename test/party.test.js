/* CELEBRATIONS - birthdays and work anniversaries on Home (18/11/2026).
       node test/party.test.js
   Cory: "animated motion art celebration"; "something the admin can do in profile set up for birthday and start date (it
   should be hidden to other users)"; "The persons birthday or workaversary ... should be extra special animated on their
   home-brace, others should have a nice animated which catches their eye"; "The banner for others should have a reach out
   ... message that automatically opens a chat to that staff member". Made-up people only. */
const fs=require('fs'), path=require('path');
require(path.join(__dirname,'..','v1','party.js'));
const P=globalThis.PH_PARTY;
const read=f=>fs.readFileSync(path.join(__dirname,'..','v1',f),'utf8');
const U=read('user.js'), A=read('admin.html'), HOME=read('home.html'), C=read('chat.html'), J=read('party.js');
const ok=[],bad=[]; const t=(n,v)=>{ (v?ok:bad).push(n); };
const ppl=(o)=>Object.assign({email:'a@x.com', name:'Avery Alder'}, o);

/* the dates */
t('a birthday is the day and month only ("MM-DD"); nonsense is dropped', P.cleanBday('03-14')==='03-14' && P.cleanBday('02-30')==='' && P.cleanBday('1990-03-14')==='' && P.cleanBday('13-01')==='');
t('a start date is a real date', P.cleanStart('2021-06-01')==='2021-06-01' && P.cleanStart('2021-02-29')==='' && P.cleanStart('June 2021')==='');
t('29 February is celebrated on the 28th in a year without one', P.dayIn(2027,'02-29').getDate()===28 && P.dayIn(2028,'02-29').getDate()===29);

/* who, when */
const WED='2026-11-18T09:00:00';                                     // a Wednesday
let c=P.celebrations([ppl({bday:'11-18', bdayOn:true}), ppl({email:'d@x.com', name:'Dana Dorsey', started:'2021-11-18'}),
  ppl({email:'m@x.com', name:'Maya Mercer', bday:'11-20', bdayOn:true}), ppl({email:'j@x.com', name:'Jules Jensen', started:'2025-11-23'}),
  ppl({email:'z@x.com', name:'Zed Zane', bday:'11-30', bdayOn:true})], WED);
t('today: a birthday and a 5-year anniversary', c.today.length===2 && c.today.some(i=>i.kind==='bday' && i.first==='Avery') && c.today.some(i=>i.kind==='anniv' && i.years===5));
t('coming up: the next 7 days, soonest first (a date 12 days away is not)', c.soon.map(i=>i.first).join(',')==='Maya,Jules' && c.soon[1].years===1 && c.soon[0].day==='Friday');
t('a birthday switched off is not celebrated', P.celebrations([ppl({bday:'11-18', bdayOn:false})], WED).today.length===0);
t('no anniversary before the first full year', P.celebrations([ppl({started:'2026-11-18'})], WED).today.length===0);
const MON='2026-11-23T09:00:00';
c=P.celebrations([ppl({bday:'11-22', bdayOn:true}), ppl({email:'s@x.com', name:'Sam Saturday', bday:'11-21', bdayOn:true})], MON);
t('on a Monday, the weekend’s celebrations are still celebrated (the offices were shut)', c.today.length===2 && c.today.every(i=>i.in<0) && c.today[0].day==='Sunday');
t('the words: "Happy 5th Workiversary" (Cory: "In American English they now call it Workiversary"), "Happy birthday"', P.headline({kind:'anniv', years:5, first:'Dana'})==='Happy 5th Workiversary, Dana!' && P.headline({kind:'bday', first:'Avery'})==='Happy birthday, Avery!' && P.ordinal(11)==='11th' && P.ordinal(22)==='22nd');

/* the shared record: set by an admin, only what a celebration needs */
const rec={p:{'A@X.com':{bday:'03-14', started:'2021-06-01', name:'Avery Alder', first:'Avery', office:'Carlsbad', year:1990, note:'x'}, 'bad':{bday:'03-14'},
  'z@x.com':{no:{bday:true}}}};
const R=P.cleanRecord(rec);
t('the record keeps only email → day/month, start date, name, office, role and the person’s own off switches - never a year of birth', JSON.stringify(Object.keys(R.p))==='["a@x.com","z@x.com"]' &&
  R.p['a@x.com'].year===undefined && R.p['a@x.com'].note===undefined && R.p['a@x.com'].bday==='03-14' && R.p['z@x.com'].no.bday===true);
const people=P.peopleFrom({p:{'a@x.com':{bday:'11-18', name:'Old Name', office:'Hobbs', no:{bday:true}}, 'b@x.com':{started:'2020-01-01', name:'Bo Banks'}}}, [{email:'b@x.com', name:'Bo Banks-Brown', offices:['Clovis'], role:'TC'}], e=>e==='b@x.com'?'data:x':'');
t('today’s team list wins for the name and office; the off switch is respected', people.find(p=>p.email==='b@x.com').name==='Bo Banks-Brown' && people.find(p=>p.email==='b@x.com').office==='Clovis' &&
  people.find(p=>p.email==='a@x.com').bdayOn===false && people.find(p=>p.email==='b@x.com').photo==='data:x');
const D=P.celebrations(P.peopleFrom(P.demo('2026-11-18T09:00:00')), '2026-11-18T09:00:00');
t('the sandbox always has something to see today, coming up, and one from 3 days ago (made-up people)', D.today.length===2 && D.soon.length>=2 && D.recent.length===1 && D.recent[0].in===-3 && Object.keys(P.demo().p).every(e=>/@example\.com$/.test(e)));

/* where it lives */
t('OFF on the live site until Cory says "celebrations live"', /const PARTY_LIVE=false;/.test(U) && /function partyOn\(\)\{ return env\(\)!=='live' \|\| PARTY_LIVE; \}/.test(U));
t('the dates are set in Admin → People, marked ONLY ADMINS SEE THESE, the year never asked', /function celebHTML\(u\)/.test(A) && /ONLY ADMINS SEE THESE/.test(A) && /aria-label="Birth month"/.test(A) && !/Birth year/.test(A) && /setLocTZ,testAlert,setCeleb,hireOpen,hireRead,hireSet,hireSave,close:closeModal/.test(A));
t('…saved straight away, merged into the shared record (nobody else’s dates touched)', /PH_STORE\.update\(PH\.PARTY_KEY, cur=>/.test(A));
t('My profile: each person can switch their own birthday or anniversary celebration off - no dates shown there', /Celebrate my birthday/.test(U) && /Celebrate my Workiversary/.test(U) && /function partyPref\(kind, on\)/.test(U));
t('Home shows the card (live: the shared record; sandbox: made-up people)', /<div id="party" hidden><\/div>/.test(HOME) && /<script src="party\.js\?v=hc\d+"><\/script>/.test(HOME) && /PH_PARTY\.card\(host, PH_PARTY\.peopleFrom\(rec, roster, PH\.photoFor\), \{me, demo:!live, onSeen\}\)/.test(HOME));
t('YOUR day opens by itself (once a day per device); everyone else’s never takes over the screen', /const auto=mineAll\.filter\(it=>!it\.seen\);/.test(J) && /if\(auto\.length && opts\.auto!==false && !seenToday\(auto\)\)/.test(J) && /function mineCard\(card, it\)/.test(J));
t('motion art: aurora, glass card, light trails, fireworks, orbit ring, a cake with five candles to blow out - and still for "less motion"', /function aurora\(t\)/.test(J) && /backdrop-filter:blur\(22px\)/.test(J) && /function drawRibbon/.test(J) && /function orbitRing/.test(J) && /class="pp-cake" id="pp-cake"/.test(J) && /function puff\(x, y\)/.test(J) && /prefers-reduced-motion: reduce/.test(J));
t('"Send a message" opens Home-Brace Chat on that person with the message ready (Teams for anyone without it) - nothing sent by itself',
  /chat\.html#to='\+encodeURIComponent\(it\.email\)\+'&name='/.test(J) && /teams\.microsoft\.com\/l\/chat\/0\/0\?users=/.test(J) && /function openFromLink\(\)/.test(C) && /function prefill\(text\)/.test(C) && /if\(!openFromLink\(\)\) firstOpen\(\);/.test(C));

t('nobody reads "anniversary" - it is a Workiversary', !/'[^'\n]*\b[Aa]nniversary\b[^'\n]*'/.test(J.replace(/\/\*[\s\S]*?\*\//g,'')) && !/work anniversary/i.test(U.replace(/\/\*[\s\S]*?\*\//g,'')));
t('no "everyone at the practice can see" line on your own day (Cory 18/11)', !/can see it\u2019s your birthday|can see your anniversary/.test(J) && /Have a wonderful day/.test(J));
t('the wish: a cake with five candles, each blown out on its own; the last one makes the wish', (J.match(/xs=\[-44,-22,0,22,44\]/)||[]).length===1 && /aria-label="Blow out candle /.test(J) && /if\(left\.length\)\{/.test(J));

/* BELATED (Cory 18/11: "Lots of people take the Birthday off so it should come next time they log in but the message
   should be a bit different") */
const FRI='2026-11-20T09:00:00';
let L=P.celebrations([ppl({bday:'11-17', bdayOn:true}), ppl({email:'d@x.com', name:'Dana Dorsey', started:'2020-11-13'}), ppl({email:'o@x.com', name:'Old Owen', bday:'11-12', bdayOn:true})], FRI);
t('the last 7 days are kept as "recent" - a week at most (Cory: "otherwise you\u2019ll probably be celebrating peoples birthday months after")', L.today.length===0 && L.recent.map(i=>i.first).join(',')==='Avery,Dana' && L.recent[0].in===-3 && L.recent[0].on==='2026-11-17' && L.recent[1].in===-7);
t('a celebration you have already had (any device) is marked seen', P.celebrations([ppl({bday:'11-17', bdayOn:true, seen:{bday:'2026-11-17'}})], FRI).recent[0].seen===true &&
  P.celebrations([ppl({bday:'11-17', bdayOn:true, seen:{bday:'2025-11-17'}})], FRI).recent[0].seen===false);
t('the words: "Happy belated birthday", "Happy belated 6th Workiversary"; "on Tuesday", or "a week ago" on the 7th day',
  P.headline({kind:'bday', first:'Avery', belated:true})==='Happy belated birthday, Avery!' && P.headline({kind:'anniv', years:6, first:'Dana', belated:true})==='Happy belated 6th Workiversary, Dana!' &&
  P.whenWas(L.recent[0])==='on Tuesday' && P.whenWas(L.recent[1])==='a week ago');
t('the record keeps "seen" days (real dates only)', JSON.stringify(P.cleanRecord({p:{'a@x.com':{bday:'03-14', seen:{bday:'2026-03-14', anniv:'nope'}}}}).p['a@x.com'].seen)==='{"bday":"2026-03-14"}');
t('only YOUR missed one comes back (once), as "We missed you on your day"; others never see it again', /const late=c\.recent\.filter\(it=>isMe\(it\) && !it\.seen\)/.test(J) && /We missed you on your day/.test(J) && /we saved your cake/.test(J) &&
  /seen\[it\.kind\]=it\.on;/.test(HOME));

/* Heather's "Hire Dates and Birthdays" Excel - a made-up sheet in its layout */
const hc={}; const hp=(a,v)=>{ hc[a]={v}; };
hp('A1','Carlsbad Office'); hp('A2','Employee Name'); hp('B2','Date of Hire'); hp('C2','Birthday');
hp('A3','Pat (Patty) Penn'); hp('B3',45200); hp('C3','March 14th');
hp('A4','Sam Stone'); hp('B4',44000); hp('C4','Febuary 30th');
hp('A6','Hobbs Office'); hp('A7','Employee Name'); hp('B7','Date of Hire'); hp('C7','Birthday'); hp('D7','Actual Hire Date');
hp('A8','Lee Lane'); hp('B8',45200); hp('C8','May 3rd'); hp('D8',40000);
hp('A9','Kim Kerr'); hp('B9',45200); hp('C9','Dec 1st'); hp('D9',2015);
hp('A10','Ned Noel'); hp('C10','July 4th');
const HR=P.fromHireSheet(hc);
t('Excel: people found by their sections and header rows, office from the section label', HR.length===5 && HR[0].section==='Carlsbad' && HR[2].section==='Hobbs');
t('Excel: "March 14th" -> 03-14, nickname kept in the name; a birthday that isn’t a date is flagged', HR[0].bday==='03-14' && HR[0].name==='Pat (Patty) Penn' && HR[1].bday==='' && /Birthday not understood/.test(HR[1].notes.join()));
t('Excel: the ACTUAL (original) hire date wins over the date of hire (Heather)', HR[2].from==='original' && HR[2].started===P.parseStart(40000));
t('Excel: an original hire that is only a year is not turned into a date - listed to fill in', HR[3].from==='hire' && /only a year \(2015\)/.test(HR[3].notes.join()));
t('Excel: no hire date says so', HR[4].started==='' && /No hire date/.test(HR[4].notes.join()));
t('Excel: names match a person by first + last, the nickname too; two people with the same name match nobody',
  P.matchPerson('Pat (Patty) Penn', [{name:'Patty Penn', email:'pp@x.com'}])==='pp@x.com' && P.matchPerson('Lee Lane', [{name:'Lee Lane', email:'a@x'}, {name:'Lee Lane', email:'b@x'}])==='' && P.matchPerson('Zoe Zed', [{name:'Lee Lane', email:'a@x'}])==='');
t('Admin: the file is read in the browser, shown first, and only EMPTY dates are filled', /🎂 Birthdays &amp; hire dates from Excel/.test(A) && /PH_PARTY\.fromHireSheet\(book\.sheets\[nm\]\.cells\)/.test(A) && /if\(!x\.bday\)\{ x\.bday=r\.bday; filled\+\+; \}/.test(A));

/* chat photos say they can be opened (Cory 18/11) */
t('chat: hovering a photo shows a magnifier with a + (mouse only)', /@media \(hover:hover\)\{\s*\.v2 \.media:has\(> img\[src\]\)\{cursor:zoom-in\}/.test(C) && /\.v2 \.media:has\(> img\[src\]\):hover::after\{opacity:1/.test(C));

console.log(ok.map(s=>'  PASS  '+s).join('\n'));
if(bad.length) console.log(bad.map(s=>'  FAIL  '+s).join('\n'));
console.log('\n'+ok.length+' passed, '+bad.length+' failed');
process.exit(bad.length?1:0);
