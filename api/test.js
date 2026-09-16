/* Drives the REAL api/production handler. Microsoft and the workbook are stubbed; the
   authorization logic under test is the actual code that would ship. */
const path = require('path');
const fs   = require('fs');
const API  = __dirname;                       // run from anywhere, including a fresh clone
const REPO = path.join(API, '..');

process.env.HB_TENANT_ID='t'; process.env.HB_CLIENT_ID='c';
process.env.HB_CLIENT_SECRET='s'; process.env.HB_WB_DRIVE='drv'; process.env.HB_WB_ITEM='itm';

// ---- stub the network -------------------------------------------------------
const sheet = {};                              // address -> value
let calls = [];
let signedInAs = null;                         // what Microsoft says /me is
global.fetch = async (url, opts = {}) => {
  const d = decodeURIComponent(String(url));
  const m = opts.method || 'GET';
  const J = (o, status = 200) => ({ status, ok: status < 300, json: async () => o });

  if (/oauth2\/v2\.0\/token/.test(d)) { calls.push('APP TOKEN'); return J({ access_token:'APP', expires_in:3600 }); }
  if (/graph\.microsoft\.com\/v1\.0\/me/.test(d)) {
    const auth = (opts.headers || {}).Authorization || '';
    if (!signedInAs || auth !== 'Bearer CALLER') return J({ error:{message:'invalid'} }, 401);
    return J(signedInAs);
  }
  // workbook calls must ALWAYS carry the app token, never the caller's
  const auth = (opts.headers || {}).Authorization || '';
  if (auth !== 'Bearer APP') { calls.push('!! WORKBOOK CALL WITH WRONG TOKEN: ' + auth); return J({error:{message:'bad token'}},403); }

  if (/createSession/.test(d)) return J({ id:'S1' });
  if (/closeSession/.test(d))  return J({}, 204);
  const ra = /range\(address='([^']+)'\)/.exec(d);
  if (ra) {
    if (/\/clear$/.test(d) && m === 'POST') { sheet[ra[1]]=''; return J({},204); }
    if (m === 'PATCH') { const v = JSON.parse(opts.body).values[0][0];
      calls.push('WROTE ' + ra[1] + '=' + v); if (v !== null) sheet[ra[1]] = v; return J({},204); }
    return J({ values: [[ sheet[ra[1]] === undefined ? null : sheet[ra[1]] ]] });
  }
  if (/usedRange/.test(d)) {
    const labels = ['CARLSBAD (FFO)','TC Net Production (Total - Discounts)',
      'Completed Number of Production Days','Write-Offs','Number of Production Days (2026)',
      '2026 Total Production Goal'];
    const rows = labels.map((l,i) => i===0
      ? [l,'January','February','March','April','May','June','July','August','September','October','November','December','TOTAL']
      : [l, ...Array(12).fill(0), 0]);
    return J({ values: rows, address: "Tab!A1:N6" });
  }
  throw new Error('unexpected ' + d);
};

const handler = require(path.join(API, 'production', 'index.js'));

let fails = 0;
function check(name, cond, detail){
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (cond ? '' : '\n          ' + detail));
  if (!cond) fails++;
}
async function call(me, body, withToken = true){
  signedInAs = me; calls = [];
  const ctx = { log: Object.assign(()=>{}, { error: ()=>{} }) };
  const req = { headers: withToken ? { Authorization:'Bearer CALLER' } : {}, body };
  await handler(ctx, req);
  return { status: ctx.res.status, body: JSON.parse(ctx.res.body), calls };
}

const JENNY = { displayName:'Jenny Whitefield', mail:'', userPrincipalName:'jenny_lascrucessmiles.com#EXT#@host.onmicrosoft.com' };
const LILY  = { displayName:'Lily Rico',  mail:'lily@farnsworthorthodontics.com' };
const HEATHER = { displayName:'Heather Beal', mail:'heather@farnsworthorthodontics.com' };
const LEXI  = { displayName:'Alexandra Espinosa', mail:'' , userPrincipalName:'nobody@nowhere.com' };
const CORY  = { displayName:'Corey Lawing', mail:'Consult@farnsworthorthodontics.com' };

/* The server's permission lists are written out by hand because user.js touches the
   DOM and cannot be required here. So CHECK them: parse DEPT_CAN straight out of
   user.js and fail if the two ever disagree. The first hand-written copy had already
   drifted, and the server is the boundary that actually holds the credentials. */
function checkPermissionListsMatchTheApp(){
  const src = fs.readFileSync(path.join(REPO, 'v1', 'user.js'), 'utf8');
  const block = /const DEPT_CAN=\{([\s\S]*?)\n  \};/.exec(src);
  if (!block) { check('DEPT_CAN found in user.js', false, 'could not parse it'); return; }
  const RANK = { none:0, view:1, add:2, edit:3, manage:4 };
  const fromApp = { write:[], manage:[] };
  const row = /'([^']+)':\s*\{([^}]*)\}/g;
  let m;
  while ((m = row.exec(block[1]))) {
    const team = m[1];
    const prod = /production:\s*'([a-z]+)'/.exec(m[2]);
    if (!prod) continue;
    if (RANK[prod[1]] >= RANK.edit)   fromApp.write.push(team);
    if (RANK[prod[1]] >= RANK.manage) fromApp.manage.push(team);
  }
  const { MAY_WRITE, MAY_MANAGE } = require(path.join(API, 'shared.js'));
  const same = (a,b) => JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());
  console.log('\n0. The server agrees with the app about who may write');
  check('MAY_WRITE matches DEPT_CAN (production >= edit)', same(MAY_WRITE, fromApp.write),
        'server ' + JSON.stringify(MAY_WRITE.slice().sort()) +
        '\n          app    ' + JSON.stringify(fromApp.write.slice().sort()));
  check('MAY_MANAGE matches DEPT_CAN (production == manage)', same(MAY_MANAGE, fromApp.manage),
        'server ' + JSON.stringify(MAY_MANAGE.slice().sort()) +
        '\n          app    ' + JSON.stringify(fromApp.manage.slice().sort()));
}

(async () => {
  checkPermissionListsMatchTheApp();
  console.log('\n1. Jenny (Cruces LCO) writes her own office');
  let r = await call(JENNY, { office:'Cruces LCO', month:0, values:{ tc: 12345 } });
  check('accepted', r.status === 200, JSON.stringify(r.body));
  check('wrote the cell', r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));
  check('used the APP token, not hers', !r.calls.some(c => /WRONG TOKEN/.test(c)), r.calls.join(' | '));
  check('identified her from the #EXT# UPN', r.body.by === 'Jenny Whitefield', JSON.stringify(r.body));

  console.log('\n2. Jenny tries a DIFFERENT office');
  r = await call(JENNY, { office:'Hobbs', month:0, values:{ tc: 999999 } });
  check('refused', r.status === 403, JSON.stringify(r.body));
  check('nothing written', !r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));
  check('says which offices are hers', /Cruces LCO/.test(r.body.error||''), r.body.error);

  console.log('\n3. Jenny tries to change a GOAL for her own office');
  r = await call(JENNY, { office:'Cruces LCO', month:0, values:{ goal: 1 } });
  check('goal refused', (r.body.refused||[]).some(x => /^goal/.test(x)), JSON.stringify(r.body));
  check('nothing written', !r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));

  /* The server must allow exactly what the client allows. production.html gates goals
     and case fees on atLeast('production','manage'), which under DEPT_CAN is admin
     only - so Executive Team is refused in BOTH places. The previous version of this
     test asserted the opposite and locked the drift in as if it were intended. If
     leadership should set goals, that is one word in DEPT_CAN and both sides follow. */
  console.log('\n4. Goals follow the SAME rule as the app');
  r = await call(HEATHER, { office:'Hobbs', month:0, values:{ goal: 250000 } });
  check('Executive Team refused, as in the UI',
        (r.body.refused||[]).some(x => /^goal/.test(x)), JSON.stringify(r.body));
  check('nothing written', !r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));

  r = await call(CORY, { office:'Hobbs', month:0, values:{ goal: 250000 } });
  check('an admin IS allowed', r.status === 200 && (r.body.saved||[]).length === 1,
        JSON.stringify(r.body));

  console.log('\n4b. A case fee is leadership-only too (it was not)');
  r = await call(LILY, { office:'Carlsbad', month:0, values:{ fee: 1 } });
  check('office manager refused', (r.body.refused||[]).some(x => /^fee/.test(x)), JSON.stringify(r.body));
  check('nothing written', !r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));

  console.log('\n5. A field that is not writable');
  r = await call(LILY, { office:'Carlsbad', month:0, values:{ act: 1, somethingElse: 2 } });
  check('both refused', (r.body.refused||[]).length === 2, JSON.stringify(r.body.refused));
  check('nothing written', !r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));

  console.log('\n6. Somebody the hub does not know');
  r = await call(LEXI, { office:'Carlsbad', month:0, values:{ tc: 1 } });
  check('refused', r.status === 403, JSON.stringify(r.body));
  check('nothing written', !r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));

  console.log('\n7. No token at all');
  r = await call(LILY, { office:'Carlsbad', month:0, values:{ tc: 1 } }, false);
  check('refused', r.status === 401, JSON.stringify(r.body));
  check('nothing written', !r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));

  console.log('\n8. Rubbish input');
  /* Number(null), Number(''), Number([]) and Number(false) are all 0, so every one of
     these used to pass the range check and silently overwrite JANUARY, returning 200. */
  for (const [label, body] of [
      ['unknown office',  { office:'Narnia', month:0, values:{tc:1} }],
      ['month 99',        { office:'Carlsbad', month:99, values:{tc:1} }],
      ['month null',      { office:'Carlsbad', month:null, values:{tc:1} }],
      ['month ""',        { office:'Carlsbad', month:'', values:{tc:1} }],
      ['month []',        { office:'Carlsbad', month:[], values:{tc:1} }],
      ['month false',     { office:'Carlsbad', month:false, values:{tc:1} }],
      ['month true',      { office:'Carlsbad', month:true, values:{tc:1} }],
      ['month "3.9"',     { office:'Carlsbad', month:'3.9', values:{tc:1} }],
      ['month -1',        { office:'Carlsbad', month:-1, values:{tc:1} }],
      ['no body',         {}]]){
    r = await call(LILY, body);
    check(label + ' refused', r.status === 400, 'got ' + r.status + ' ' + JSON.stringify(r.body));
    check(label + ' wrote nothing', !r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));
  }

  console.log('\n9. Two people saving at once keep their own Excel sessions');
  signedInAs = LILY; calls = [];
  const ctx1={log:Object.assign(()=>{},{error:()=>{}})}, ctx2={log:Object.assign(()=>{},{error:()=>{}})};
  const hdr={ Authorization:'Bearer CALLER' };
  await Promise.all([
    handler(ctx1,{headers:hdr,body:{office:'Carlsbad',month:0,values:{tc:111}}}),
    handler(ctx2,{headers:hdr,body:{office:'Carlsbad',month:1,values:{tc:222}}})
  ]);
  const b1=JSON.parse(ctx1.res.body), b2=JSON.parse(ctx2.res.body);
  check('both saves succeeded', ctx1.res.status===200 && ctx2.res.status===200,
        JSON.stringify([ctx1.res.status, b1.failed, ctx2.res.status, b2.failed]));
  check('neither reported a failure', !(b1.failed||[]).length && !(b2.failed||[]).length,
        JSON.stringify([b1.failed, b2.failed]));

  console.log('\n' + (fails ? fails + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED'));
  process.exit(fails ? 1 : 0);
})();
