/* Drives the REAL api/production handler. Microsoft and the workbook are stubbed; the
   authorization logic under test is the actual code that would ship. */
const path = require('path');
const API = '/Users/corylawing2/practice-hub-mockup/api';

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

(async () => {
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

  console.log('\n4. Heather (leadership) CAN set a goal, any office');
  r = await call(HEATHER, { office:'Hobbs', month:0, values:{ goal: 250000 } });
  check('accepted', r.status === 200, JSON.stringify(r.body));
  check('goal written', r.calls.some(c => /^WROTE /.test(c)), r.calls.join(' | '));

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
  for (const [label, body] of [
      ['unknown office', { office:'Narnia', month:0, values:{tc:1} }],
      ['bad month',      { office:'Carlsbad', month:99, values:{tc:1} }],
      ['no body',        {}]]){
    r = await call(LILY, body);
    check(label + ' refused', r.status === 400, JSON.stringify(r.body));
  }

  console.log('\n' + (fails ? fails + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED'));
  process.exit(fails ? 1 : 0);
})();
