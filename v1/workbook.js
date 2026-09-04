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

    // Ask WHO saved it too — assuming it's always Heather would be wrong the first time
    // anyone else touches the file.
    return graph(item + '?$select=lastModifiedDateTime,lastModifiedBy,name').then(function(meta){
      var stamp = meta && meta.lastModifiedDateTime;
      var who = (meta && meta.lastModifiedBy && meta.lastModifiedBy.user &&
                 meta.lastModifiedBy.user.displayName) || '';
      var hit = null;
      try {
        var raw = sessionStorage.getItem(CACHE_KEY);
        if (raw){
          var c = JSON.parse(raw);
          if (c && c.stamp && c.stamp === stamp && c.itemId === itemId) hit = c;
        }
      } catch(_){}
      if (hit) return { offices: hit.offices, errors: [], savedAt: stamp, savedBy: who, cached: true };

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
        return { offices: out, errors: errs, savedAt: stamp, savedBy: who, cached: false };
      });
    });
  }

  /* ------------------------------------------------------------------
     WRITING BACK.
     The direction that matters: people enter numbers in the hub, and the workbook stays
     the report an owner reads. Two rules, because this writes into the document they run
     the practice on:
       1. Never guess an address. Resolve it from the sheet's own used-range origin and
          the row whose column-A label matches -- the same matching the reader is verified
          against to the dollar.
       2. Never trust the write. Read the cell back and compare before reporting success.
     ------------------------------------------------------------------ */

  // Which column-A label each editable field lives on. Two tab layouts, first match wins.
  var WRITE_ROWS = {
    tc:   [ {all:['tc net production']} ],
    adj:  [ {all:['write-offs']} ],
    mds:  [ {all:['number of medicaid starts']} ],
    dys:  [ {all:['number of production days','(2026)']} ],
    done: [ {all:['completed number of production days']} ],
    goal: [ {all:['2026','total production goal']}, {all:['2026','tc production goal'], not:['non-medicaid']} ],
    str:  [ {all:['2026','stretch production goal']} ],
    fee:  [ {all:['medicaid case fee']} ],
    afee: [ {all:['2025 average case fee']} ]
  };

  function colLetters(n){                 // 0 -> A, 25 -> Z, 26 -> AA
    var out='', v=n+1;
    while(v>0){ var r=(v-1)%26; out=String.fromCharCode(65+r)+out; v=Math.floor((v-1)/26); }
    return out;
  }
  function parseOrigin(address){          // "Sheet1!A1:N60" -> {col:0,row:1}
    var m=/!\$?([A-Z]+)\$?(\d+)/.exec(address||'');
    if(!m) return {col:0,row:1};
    var c=0, L=m[1];
    for(var i=0;i<L.length;i++) c=c*26+(L.charCodeAt(i)-64);
    return { col:c-1, row:parseInt(m[2],10) };
  }

  /* Write one month of one field, then verify it. graph = GET helper, send = method helper. */
  function writeCell(graph, send, driveId, itemId, officeName, field, monthIndex, value){
    var tab=TABS[officeName];
    if(!tab) return Promise.reject(new Error('Unknown office: '+officeName));
    var pats=WRITE_ROWS[field];
    if(!pats) return Promise.reject(new Error('"'+field+'" is not a writable field.'));
    if(!(monthIndex>=0 && monthIndex<12)) return Promise.reject(new Error('Bad month.'));

    var base='/drives/'+driveId+'/items/'+itemId+"/workbook/worksheets('"+encodeURIComponent(tab)+"')";
    return graph(base+'/usedRange(valuesOnly=true)?$select=values,address').then(function(rng){
      var rows=rng.values||[], origin=parseOrigin(rng.address), idx=-1;
      for(var i=0;i<pats.length && idx<0;i++) idx=row(rows, pats[i].all, pats[i].not);
      if(idx<0) throw new Error('Could not find the row for "'+field+'" on '+tab+'.');

      var address = colLetters(origin.col + 1 + monthIndex) + (origin.row + idx);
      var num = (value===''||value===null||value===undefined) ? null : Number(value);
      if(num!==null && !isFinite(num)) throw new Error('That is not a number.');

      return send('PATCH', base+"/range(address='"+address+"')", { values: [[num]] })
        .then(function(){ return graph(base+"/range(address='"+address+"')?$select=values"); })
        .then(function(check){
          var got=(check.values&&check.values[0]&&check.values[0][0]);
          var ok = (num===null) ? (got===null||got===''||got===0)
                                : Math.abs(Number(got)-num) < 0.01;
          if(!ok) throw new Error('Wrote '+num+' to '+address+' but it reads back as '+got+'.');
          return { address:address, sheet:tab, value:num, label:rows[idx][0] };
        });
    });
  }

  global.PH_WB = { load:load, office:office, TABS:TABS, MEDICAID:MEDICAID,
                   writeCell:writeCell, WRITE_ROWS:WRITE_ROWS, colLetters:colLetters };
})(window);
