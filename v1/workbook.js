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

    /* TWO different case fees, easily confused:
         avgFee = "2025 Average Case Fee"  -- reconstructs last year's starts
         mdFee  = "Medicaid Case Fee"      -- what the dashboard calls `fee` (0 on TC-only tabs)
       No last-year starts row exists, so it is derived from production / average fee. */
    var avgFee = firstNonZero(months(rows, row(rows, ['2025 average case fee'])));
    var mdFee  = firstNonZero(months(rows, row(rows, ['medicaid case fee'])));
    var lyStarts = ly.map(function(v){ return avgFee ? Math.round(v / avgFee) : 0; });

    /* Past years, for the year selector. 2025 production is the same figure as `ly`;
       kept separate because the dashboard addresses them differently. */
    var hist = {
      '2024': { act: months(rows, row(rows, ['2024','net production'])).map(function(v, i){
                  var m = med ? months(rows, row(rows, ['2024','medicaid production'])) : null;
                  return v + (m ? m[i] : 0);
                }),
                days: months(rows, row(rows, ['number of production days','(2024)'])) },
      '2025': { act: ly.slice(), days: months(rows, row(rows, ['number of production days','(2025)'])),
                sAct: lyStarts.slice() }
    };

    /* Enter Production works from the raw inputs rather than the totals: TC net production
       and the write-offs line, both present on either tab layout. */
    var tc  = months(rows, row(rows, ['tc net production']));
    var adj = months(rows, row(rows, ['write-offs']));

    return { act:act, goal:goal, stretch:stretch, ly:ly, sAct:sAct, sGoal:sGoal,
             mdStarts:mdStarts, lyStarts:lyStarts, days:days, done:done,
             hist:hist, fee:mdFee, avgFee:avgFee, tc:tc, adj:adj };
  }

  /* graph(path) -> Promise of parsed JSON, supplied by the caller so this module
     stays out of the sign-in business. */

  var CACHE_KEY = 'ph_wb_cache';

  /* Three things keep this fast:
       1. the eight tabs are fetched IN PARALLEL, not one after another -- sequential
          round trips were the whole 7-10s;
       2. $select=values drops address/formulas/formatting from each response;
       3. the result is cached against the file's lastModifiedDateTime, so a reload is
          instant and still correct -- the moment she saves, the stamp changes and the
          cache is skipped. */
  function load(graph, driveId, itemId){
    var item = '/drives/' + driveId + '/items/' + itemId;
    var base = item + '/workbook';
    var names = Object.keys(TABS);

    return graph(item + '?$select=lastModifiedDateTime,name').then(function(meta){
      var stamp = meta && meta.lastModifiedDateTime;
      var hit = null;
      try {
        var raw = sessionStorage.getItem(CACHE_KEY);
        if (raw){
          var c = JSON.parse(raw);
          if (c && c.stamp && c.stamp === stamp && c.itemId === itemId) hit = c;
        }
      } catch(_){}
      if (hit) return { offices: hit.offices, errors: [], savedAt: stamp, cached: true };

      var out = {}, errs = [];
      return Promise.all(names.map(function(name){
        return graph(base + "/worksheets('" + encodeURIComponent(TABS[name]) +
                     "')/usedRange(valuesOnly=true)?$select=values")
          .then(function(rng){ out[name] = office(rng.values || [], !!MEDICAID[name]); })
          .catch(function(e){ errs.push(name + ': ' + ((e && e.message) || e)); });
      })).then(function(){
        if (!errs.length){
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(
              { stamp: stamp, itemId: itemId, offices: out }));
          } catch(_){}   // quota or private mode -- caching is an optimisation, not a requirement
        }
        return { offices: out, errors: errs, savedAt: stamp, cached: false };
      });
    });
  }

  global.PH_WB = { load:load, office:office, TABS:TABS, MEDICAID:MEDICAID };
})(window);
