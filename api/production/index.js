/* POST /api/production
   The only way production numbers reach the workbook. NOBODY needs edit access to the
   file any more - this holds it, and it decides who may change what.

   Body: { office: "Cruces LCO", month: 0-11, values: { tc: 123, dys: 9, ... } }

   What is deliberately NOT trusted from the browser:
     - who the caller is        -> taken from their token, via Microsoft
     - which offices they own    -> looked up here, from the roster
     - which fields are writable -> fixed list below
   The browser can ask for anything; it only gets what the caller is entitled to. */
const { whoIsCalling, permissionsFor, appToken, cfg, reply } = require('../shared');
/* The SAME writer the app uses - one implementation, so the two can never disagree
   about which row a field lives on. Deployed alongside this function (the deploy script
   copies it in); the second path is for running from the repo. */
function sharedWorkbook(){
  for (const p of ['./workbook.js', '../workbook.js', '../../v1/workbook.js']) {
    try { return require(p); } catch (_) {}
  }
  throw new Error('workbook.js was not deployed alongside the API.');
}
const PH_WB = sharedWorkbook();

// Only these can be written, whatever the browser sends. Mirrors WRITABLE in production.html.
const WRITABLE = ['tc', 'adj', 'mds', 'dys', 'goal', 'str', 'fee', 'afee'];
// Goals are a leadership decision, not an office one.
const GOAL_FIELDS = ['goal', 'str'];
const MAY_SET_GOALS = ['admin', 'executive team', 'leadership team'];

module.exports = async function (context, req) {
  try {
    /* Until the app credentials are set, behave as if this endpoint does not exist.
       The pages treat 404 as "no server yet" and write to Graph directly, so shipping
       this before it is configured changes nothing rather than breaking every save.
       The moment the settings are added it starts working - no redeploy needed. */
    try { cfg(); }
    catch (_) { return reply(context, 404, { error: 'The server side is not configured yet.' }); }

    const who = await whoIsCalling(req);
    if (who.error) return reply(context, 401, { error: who.error });

    const perm = permissionsFor(who.mail);
    if (!perm.known)    return reply(context, 403, { error: 'The hub does not have you on its list yet. Ask an admin to add you.' });
    if (!perm.canWrite) return reply(context, 403, { error: 'Your team cannot enter production numbers.' });

    const body   = req.body || {};
    const office = String(body.office || '');
    const month  = Number(body.month);
    const values = (body.values && typeof body.values === 'object') ? body.values : {};

    if (!PH_WB.TABS[office])          return reply(context, 400, { error: 'Unknown office.' });
    if (!(month >= 0 && month < 12))  return reply(context, 400, { error: 'Bad month.' });

    // The check that matters: is this office theirs?
    if (!perm.everyOffice && perm.offices.indexOf(office) < 0)
      return reply(context, 403, { error: 'You can only enter numbers for ' +
        (perm.offices.join(', ') || 'no office you are assigned to') + '.' });

    const canGoals = perm.teams.some(t => MAY_SET_GOALS.indexOf(t) >= 0);

    const c = cfg();
    const token = () => appToken();                 // the APP's access, never the caller's
    const saved = [], refused = [], failed = [];

    for (const field of Object.keys(values)) {
      if (WRITABLE.indexOf(field) < 0) { refused.push(field + ': not a field the hub writes'); continue; }
      if (GOAL_FIELDS.indexOf(field) >= 0 && !canGoals) { refused.push(field + ': only leadership set goals'); continue; }
      try {
        const r = await PH_WB.writeCell(token, c.drive, c.item, office, field, month, values[field]);
        saved.push({ field, address: r.address, sheet: r.sheet, value: r.value });
      } catch (e) {
        failed.push(field + ': ' + (e.message || String(e)));
      }
    }
    try { await PH_WB.closeSession(token, c.drive, c.item); } catch (_) {}

    reply(context, failed.length ? 207 : 200,
      { by: who.name, office, month, saved, refused, failed });
  } catch (e) {
    context.log.error('production write failed', e);
    reply(context, 500, { error: e.message || String(e) });
  }
};
