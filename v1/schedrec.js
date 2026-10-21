/* THE SCHEDULE, ONE RECORD PER YEAR FROM 2028.

   22/10/2026, Cory: "they will need me if it ever gets full, its not self sustainable" - then
   "yes but only if it works". One SharePoint record holds about 63,000 characters, and the
   schedule kept every year in ONE record ('ph_sched2'): about 8% more of it each year, so full
   around 2033. Now every day from 2028 on is saved in its own year's record ('ph_sched_2028',
   'ph_sched_2029', ...), made the first time a day in that year is saved. Nothing already saved
   moves: 2026 and 2027 stay in 'ph_sched2' and go through exactly the same steps as before.

   Reading: 'ph_sched2' plus every year record, put together into the one schedule the page has
   always worked with. A day from 2028 on comes from its year's record; a day that only an older
   page ever wrote into 'ph_sched2' is still shown.
   Saving: the changed office cells, each laid onto the shared copy of ITS year's record (the
   page's merge, record by record). A save counts as done only when every record took its cells -
   otherwise the cells stay changed and go with the next save, as before.

   Used by schedule.html (reads and saves) and tc.html (reads, for open and closed days). */
(function(global){
  'use strict';
  var CUT = 2028, BASE = 'ph_sched2', PREFIX = 'ph_sched_', YEAR_KEY = /^ph_sched_(\d{4})$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
  function S(){ return global.PH_STORE; }

  /* Which record a day lives in. */
  function recOf(day){ var y = +String(day).slice(0, 4); return y >= CUT ? PREFIX + y : BASE; }

  /* 'ph_sched2' and the year records, as one schedule. null when there is nothing at all. */
  function combine(base, records){
    var keys = Object.keys(records || {}).filter(function(k){ return YEAR_KEY.test(k); }).sort();
    if(!base && !keys.length) return null;
    var out = Object.assign({}, (base && typeof base === 'object') ? base : {});
    keys.forEach(function(k){
      var v = records[k] || {};
      Object.keys(v).forEach(function(d){ if(DAY.test(d) && recOf(d) === k) out[d] = v[d]; });
    });
    if(!base && keys.length && out.__v === undefined) out.__v = 2;   // only year records: still the real schedule
    return out;
  }

  /* Every year record there is. failed: records that would not read (and had no copy on this
     device); unknown: the list of records itself could not be read. */
  function years(){
    if(!S().keys) return Promise.resolve({records:{}, failed:[], unknown:false});
    return S().keys(PREFIX).then(function(ks){
      ks = ks.filter(function(k){ return YEAR_KEY.test(k); });
      return Promise.all(ks.map(function(k){
        return S().get(k).then(function(v){ return {k:k, v:v, failed:!!(S().readFailed && S().readFailed(k))}; });
      }));
    }).then(function(list){
      var records = {}, failed = [];
      list.forEach(function(x){
        if(x.v && typeof x.v === 'object') records[x.k] = x.v;
        else if(x.failed) failed.push(x.k);
      });
      return {records:records, failed:failed, unknown:false};
    }, function(){ return {records:{}, failed:[], unknown:true}; });
  }

  /* The whole schedule. {sched, baseFailed, failed, unknown}. When 'ph_sched2' itself would not
     read, sched is null - exactly as before, the page says so and writes nothing over it. */
  function load(){
    return Promise.all([S().get(BASE), years()]).then(function(r){
      var base = r[0], yr = r[1], baseFailed = !!(S().readFailed && S().readFailed(BASE)) && !base;
      return {sched: baseFailed ? null : combine(base, yr.records), baseFailed:baseFailed, failed:yr.failed, unknown:yr.unknown};
    });
  }

  /* Send changed cells, each laid onto its own year's record. cells: [[day, office], ...];
     valueOf(day, office) -> the cell as the page has it now (undefined = cleared).
     Resolves {ok, parts:[{key, value}], sent:{'day|office': JSON or undefined}}. */
  function send(cells, valueOf, version){
    var groups = {}, sent = {};
    cells.forEach(function(c){ var k = recOf(c[0]); (groups[k] = groups[k] || []).push(c); });
    return Promise.all(Object.keys(groups).map(function(key){
      return S().update(key, function(remote){
        groups[key].forEach(function(c){ delete sent[c[0] + '|' + c[1]]; });     // this may run again after a conflict
        var out = Object.assign({}, (remote && typeof remote === 'object') ? remote : {});
        groups[key].forEach(function(c){
          var v = valueOf(c[0], c[1]), day = Object.assign({}, out[c[0]] || {});
          if(v === undefined) delete day[c[1]]; else day[c[1]] = v;
          out[c[0]] = day;
          sent[c[0] + '|' + c[1]] = v === undefined ? undefined : JSON.stringify(v);
        });
        out.__v = version; delete out.__demo;
        return out;
      }).then(function(r){ return {key:key, r:r}; });
    })).then(function(res){
      var ok = res.every(function(x){ return x.r && !x.r.blocked && !x.r.error && x.r.value; });
      return {ok:ok, parts:res.map(function(x){ return {key:x.key, value:x.r && x.r.value}; }), sent:sent};
    });
  }

  /* The page's schedule after a save: its own copy, with each saved record's days (and, for
     'ph_sched2', its other entries) replaced by the shared copy that came back. */
  function adopt(sched, parts){
    var out = Object.assign({}, sched || {});
    (parts || []).forEach(function(p){
      Object.keys(out).forEach(function(k){ if(DAY.test(k) && recOf(k) === p.key) delete out[k]; });
      var v = p.value || {};
      Object.keys(v).forEach(function(k){
        if(DAY.test(k)){ if(recOf(k) === p.key) out[k] = v[k]; }
        else if(p.key === BASE) out[k] = v[k];
      });
    });
    return out;
  }

  global.PH_SCHED = {CUT:CUT, BASE:BASE, PREFIX:PREFIX, recOf:recOf, combine:combine, years:years, load:load, send:send, adopt:adopt};
  if(typeof module !== 'undefined' && module.exports) module.exports = global.PH_SCHED;
})(typeof window !== 'undefined' ? window : globalThis);
