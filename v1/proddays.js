/* PRODUCTION DAYS FROM THE SCHEDULE (16/11/2026).

   Heather 23/10: "can the # of production days per office pull from the schedule in Home Brace and can the completed
   production days # on this screen pull from that calendar as well once that day has passed?" Her rules (01/11): a
   Friday (half day) counts as a whole day; a cancelled day - "the schedule will be updated"; "If it is a yellow day or a
   virtual promo or any day the doctor is not present we will not count it as a production day". 16/11, on December not
   matching her books: "Schedules changed ... when we enter production goals for next years and we enter the number of
   days the office will be open then a doctor changes their schedule, we will want that to automatically update on the
   goal production side."

   THE RULE: a production day = a weekday (Mon-Fri) with at least one doctor on the Schedule for that office, not
   marked Closed and not a Yellow Dot day. Completed = those days before today (Central time). Checked against her
   books on live (16/11): September, October and November 2026 matched for all 8 offices, scheduled and completed.

   WHICH MONTHS: from September 2026 (the Schedule was half blank before), and only a month the Schedule has filled
   in for that office (fewer than half its weekdays empty) - a month nobody has scheduled yet keeps whatever Heather
   typed for it in Plan the year. Completed days: past months and this month; later months are left alone.

   WRITING: into the year's production numbers (the "Number of Production Days (year)" and "Completed Number of
   Production Days" rows), so the goals worked out from them (starts goal = starts per day x production days), the
   Dashboard, Enter Production, Plan the year and the Excel download all follow. One History entry per year per sync
   ("Production days from the Schedule"). NOTHING is written when the Schedule, the doctor list or the production
   numbers didn't read in full, when her Excel is still the master, or for a month before September 2026. */
(function(global){
  'use strict';
  var FROM = '2026-09', DOCS = 'ph_docs', GATE = 'ph_daysync_at', GAP = 10 * 60 * 1000, MAX = 300;
  var OFFICES = ['Carlsbad', 'Clovis', 'Cruces FFO', 'Cruces LCO', 'Hobbs', 'Lubbock', 'Mansfield', 'San Angelo'];
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function ym(y, m){ return y + '-' + pad(m + 1); }

  function doctorOn(c, docs){
    var ids = Array.isArray(c.ps) ? c.ps : (c.p != null ? [c.p] : []);
    return ids.some(function(i){ return !!docs[i]; });
  }
  function emptyCell(c){ return !c || (c.p == null && !(Array.isArray(c.ps) && c.ps.length) && !c.closed && !c.ydot && !c.event); }

  /* One office's month (m = 0..11): {covered, sched, done}. today = 'YYYY-MM-DD'. */
  function month(sched, docs, office, y, m, today){
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), wk = 0, blank = 0, n = 0, done = 0;
    for(var d = 1; d <= last; d++){
      var dow = new Date(Date.UTC(y, m, d)).getUTCDay(); if(dow === 0 || dow === 6) continue;
      wk++;
      var day = y + '-' + pad(m + 1) + '-' + pad(d), c = (sched[day] || {})[office];
      if(emptyCell(c)){ blank++; continue; }
      if(c.closed || c.ydot || !doctorOn(c, docs)) continue;
      n++; if(day < today) done++;
    }
    return {covered: ym(y, m) >= FROM && blank * 2 < wk, sched: n, done: done};
  }

  /* What the Schedule says for one year, every office: {office: [12 x {covered, sched, done}]}. */
  function yearOf(sched, docs, y, today){
    var out = {};
    OFFICES.forEach(function(o){ out[o] = []; for(var m = 0; m < 12; m++) out[o].push(month(sched, docs, o, y, m, today)); });
    return out;
  }

  /* The changes one year needs: [{office, month, field:'sched'|'dys', from, to}]. book = dashboardData(y).offices. */
  function changesFor(y, want, book, today){
    var out = [], nowYM = today.slice(0, 7);
    var num = function(v){ return (v === '' || v == null || !isFinite(+v)) ? null : +v; };
    OFFICES.forEach(function(o){
      var b = book[o]; if(!b) return;
      for(var m = 0; m < 12; m++){
        var w = want[o][m], at = ym(y, m); if(!w.covered) continue;
        var hadS = num((b.days || [])[m]), hadD = num((b.done || [])[m]);
        if(hadS !== w.sched) out.push({office:o, month:m, field:'sched', from:hadS, to:w.sched});
        var doneTo = at < nowYM ? w.sched : at === nowYM ? w.done : null;
        if(doneTo !== null && hadD !== doneTo) out.push({office:o, month:m, field:'dys', from:hadD, to:doneTo});
      }
    });
    return out;
  }

  function todayHere(){
    try{ if(global.PH && global.PH.centralNow) return global.PH.centralNow().date; }catch(_){}
    var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  /* Whose page keeps them in step: anyone who can change production numbers or the Schedule, or an admin. */
  function mayWrite(){
    var P = global.PH; if(!P || !P.isLive || !P.isLive()) return false;
    try{ return !!((P.isAdmin && P.isAdmin()) || (P.atLeast && (P.atLeast('production', 'edit') || P.atLeast('schedule', 'edit')))); }catch(_){ return false; }
  }

  /* Look, and (unless dry) write. Resolves {skipped} or {years:{y:[changes]}, wrote:n}. */
  var running = null;
  function sync(opts){
    opts = opts || {};
    if(running) return running;
    var S = global.PH_STORE, PROD = global.PH_PROD, SCH = global.PH_SCHED;
    if(!S || !PROD || !SCH) return Promise.resolve({skipped:'not loaded'});
    if(!opts.dry && !mayWrite()) return Promise.resolve({skipped:'not allowed'});
    if(!opts.dry && !opts.force){
      var was = 0; try{ was = +global.localStorage.getItem(GATE) || 0; }catch(_){}
      if(Date.now() - was < GAP) return Promise.resolve({skipped:'recently'});
    }
    var today = opts.today || todayHere();
    running = Promise.all([PROD.mode(), PROD.index(), SCH.load(), S.get(DOCS)]).then(function(r){
      var mode = r[0], idx = r[1], L = r[2], docs = r[3];
      if(!mode || mode.source !== 'homebrace') return {skipped:'excel is the master'};
      if(S.readFailed && (S.readFailed(PROD.INDEX) || S.readFailed('ph_prod_mode'))) return {skipped:'production list unread'};
      if(!L || !L.sched || L.baseFailed || (L.failed && L.failed.length) || L.unknown) return {skipped:'schedule unread'};
      if((S.readFailed && S.readFailed(DOCS)) || !Array.isArray(docs) || !docs.filter(Boolean).length) return {skipped:'doctors unread'};
      var years = Object.keys((idx && idx.years) || {}).map(Number).filter(function(y){ return y >= +FROM.slice(0, 4); }).sort();
      var out = {years:{}, wrote:0};
      return years.reduce(function(chain, y){
        return chain.then(function(){
          return PROD.dashboardData(y).then(function(D){
            var list = changesFor(y, yearOf(L.sched, docs, y, today), D.offices || {}, today);
            out.years[y] = list;
            if(opts.dry || !list.length) return;
            if(list.length > MAX) throw new Error(list.length + ' production days would change in ' + y + ' at once - nothing written.');
            return PROD.setDays(y, list).then(function(){ out.wrote += list.length; });
          });
        });
      }, Promise.resolve()).then(function(){
        if(!opts.dry){ try{ global.localStorage.setItem(GATE, String(Date.now())); }catch(_){} }
        return out;
      });
    }).then(function(x){ running = null; return x; }, function(e){ running = null; throw e; });
    return running;
  }

  /* Once sign-in knows who this is and what they may do (or after 15 s): pages call sync() after this. */
  function whenReady(){
    return new Promise(function(done){
      var t0 = Date.now();
      (function look(){
        var P = global.PH, learning = false;
        try{ learning = !!(P && P.learning && P.learning()); }catch(_){}
        if(!learning || Date.now() - t0 > 15000) return done();
        setTimeout(look, 500);
      })();
    });
  }
  /* A Schedule save on this device: the next page that keeps production days in step does it at once. */
  function soon(){ try{ global.localStorage.removeItem(GATE); }catch(_){} }

  /* For Enter Production and Plan the year: which months of a year the Schedule decides, per office. */
  function covered(y){
    var S = global.PH_STORE, SCH = global.PH_SCHED;
    if(!S || !SCH || +y < +FROM.slice(0, 4)) return Promise.resolve(null);
    return Promise.all([SCH.load(), S.get(DOCS)]).then(function(r){
      var L = r[0], docs = r[1];
      if(!L || !L.sched || L.baseFailed || !Array.isArray(docs)) return null;
      var want = yearOf(L.sched, docs, +y, todayHere()), out = {};
      OFFICES.forEach(function(o){ out[o] = want[o].map(function(w){ return w.covered; }); });
      return out;
    }).catch(function(){ return null; });
  }

  global.PH_PRODDAYS = {FROM:FROM, OFFICES:OFFICES, month:month, yearOf:yearOf, changesFor:changesFor, sync:sync, covered:covered, mayWrite:mayWrite, whenReady:whenReady, soon:soon};
  if(typeof module !== 'undefined' && module.exports) module.exports = global.PH_PRODDAYS;
})(typeof window !== 'undefined' ? window : globalThis);
