/* Reads the practice's live production workbook out of Microsoft Graph.

   ONE implementation, used by BOTH the dashboard and connect.html's step-7 verifier.
   Keep it that way: verifying one implementation and shipping another proves nothing.

   Every series is matched on the column-A LABEL, never a row number. The office tabs use
   two different layouts and the same series sits on different rows per tab (12/20/20/20/
   12/11/11/18 for actual production alone). Reading by row number silently compared the
   wrong rows once already.

   Verified 2026-08-28 against "2026 PRODUCTION DASHBOARD (New)-5.xlsx": all 10 series,
   all 8 offices, all 12 months reproduce the practice's own figures exactly.

   THE SNAPSHOT IS THE REFERENCE, NOT A SUSPECT. Heather reviewed the mockup's numbers
   against her own workbook and confirmed they are right. So if this reader ever disagrees
   with snapshot.json, the bug is HERE -- do not "fix" the figures to match a new reading,
   and do not change a derivation because it looks tidier. Reproduce her numbers exactly,
   or find out why you cannot. */
(function(global){
  'use strict';

  var TABS = {
    'Carlsbad':'Carlsbad (FFO)', 'Clovis':'Clovis (FFO)', 'Hobbs':'Hobbs (FFO)',
    'Lubbock':'Lubbock (FFO)', 'San Angelo':'San Angelo (FFO)', 'Cruces FFO':'Cruces (FFO)',
    'Cruces LCO':'Cruces (LCO)', 'Mansfield':'Mansfield (SUN)'
  };
  // Tabs carrying Medicaid rows. The others are TC-only and label things differently.
  var MEDICAID = { 'Carlsbad':1, 'Clovis':1, 'Hobbs':1, 'Cruces LCO':1 };

  function norm(v){ return String(v == null ? '' : v).toLowerCase().replace(/\s+/g,' ').trim(); }

  /* rows: array of arrays. must: substrings that all have to appear in the label.
     never: substrings that disqualify it. */
  function row(rows, must, never){
    never = never || [];
    for (var r = 0; r < rows.length; r++){
      var L = norm(rows[r][0]);
      if (!L) continue;
      var ok = true, i;
      for (i = 0; i < must.length; i++) if (L.indexOf(must[i]) < 0) { ok = false; break; }
      if (!ok) continue;
      for (i = 0; i < never.length; i++) if (L.indexOf(never[i]) >= 0) { ok = false; break; }
      if (ok) return r;
    }
    return -1;
  }
  function months(rows, r){
    var out = [], i;
    if (r < 0) { for (i = 0; i < 12; i++) out.push(0); return out; }
    for (i = 1; i <= 12; i++){
      var v = rows[r][i];
      out.push(typeof v === 'number' ? v : (v === '' || v == null ? 0 : (parseFloat(v) || 0)));
    }
    return out;
  }
  function firstNonZero(a){
    for (var i = 0; i < a.length; i++) if (a[i]) return a[i];
    return 0;
  }

  /* Turn one office tab's grid into the series the dashboard needs. */
  function office(rows, med){
    var act = months(rows, med
      ? row(rows, ['2026','actual','tc only','+','medicaid'])
      /* Medicaid tabs ALSO carry "2026 Actual TC Net Production (Non-Medicaid)" -- a subset,
         not the total. Excluded so it can never be picked up by mistake. */
      : row(rows, ['2026','actual','tc net production'], ['non-medicaid']));

    var goal    = months(rows, med ? row(rows, ['2026','total production goal'])
                                   : row(rows, ['2026','tc production goal'], ['non-medicaid']));
    var stretch = months(rows, row(rows, ['2026','stretch production goal']));
    var days    = months(rows, row(rows, ['number of production days','(2026)']));
    var done    = months(rows, row(rows, ['completed number of production days']));

    var lyNet = months(rows, row(rows, ['2025','net production']));
    var lyMed = med ? months(rows, row(rows, ['2025','medicaid production'])) : null;
    var ly = lyNet.map(function(v, i){ return v + (lyMed ? lyMed[i] : 0); });

    var mdStarts = months(rows, row(rows, ['number of medicaid starts']));

    /* Starts are RECONSTRUCTED, not read -- the workbook has no monthly actual-starts row.
       Goal = needed-per-day x scheduled days. Actual = needed-per-day x days WORKED, plus
       their ahead/behind figure. Using scheduled days instead of worked days inflates every
       part-month (August, on four offices). On a Medicaid tab the Non-Medicaid per-day row
       is the one that reproduces their numbers. */
    var perDay = months(rows, med
      ? row(rows, ['needed number of starts per day','(non-medicaid)'])
      : row(rows, ['needed number of starts per day']));
    var ahead = months(rows, row(rows, ['current # of starts']));

    var sGoal = perDay.map(function(p, i){ return Math.round(p * days[i]); });
    var sAct  = perDay.map(function(p, i){
      return done[i] > 0 ? Math.round(p * done[i] + ahead[i]) : 0;
    });

    // No last-year starts row exists either; their own average case fee reproduces it.
    var fee = firstNonZero(months(rows, row(rows, ['2025 average case fee'])));
    var lyStarts = ly.map(function(v){ return fee ? Math.round(v / fee) : 0; });

    return { act:act, goal:goal, stretch:stretch, ly:ly, sAct:sAct, sGoal:sGoal,
             mdStarts:mdStarts, lyStarts:lyStarts, days:days, done:done };
  }

  /* graph(path) -> Promise of parsed JSON, supplied by the caller so this module
     stays out of the sign-in business. */
  function load(graph, driveId, itemId){
    var base = '/drives/' + driveId + '/items/' + itemId + '/workbook';
    var names = Object.keys(TABS);
    var out = {}, errs = [];
    return names.reduce(function(chain, name){
      return chain.then(function(){
        return graph(base + "/worksheets('" + encodeURIComponent(TABS[name]) + "')/usedRange(valuesOnly=true)")
          .then(function(rng){ out[name] = office(rng.values || [], !!MEDICAID[name]); })
          .catch(function(e){ errs.push(name + ': ' + ((e && e.message) || e)); });
      });
    }, Promise.resolve()).then(function(){
      return { offices: out, errors: errs };
    });
  }

  global.PH_WB = { load:load, office:office, TABS:TABS, MEDICAID:MEDICAID };
})(window);
