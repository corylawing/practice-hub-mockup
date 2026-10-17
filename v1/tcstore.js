/* TC TRACKER STORAGE - its own locked SharePoint list on the live site.

   17/10/2026. The TC Tracker holds patient names, birth dates and phone numbers. The hub's
   shared list (HomeBraceData) can be read by everyone in Home-Brace, so consults live in a
   list of their own, "HomeBraceConsults", that only the people with the TC Tracker can open.
   Same two columns as HomeBraceData (Title = the key, Payload = JSON), made by hand - the app
   never creates lists (no Sites.Manage.All, on purpose). Consult slots and the editable lists
   stay in HomeBraceData through PH_STORE: there are no patient details in them.

   This is a separate file on purpose: it touches only that one list, so nothing here can
   reach the hub's other data. Rules, because these are patient records:
     - Nothing is ever deleted. A record is read, one consult is added or replaced in it, and
       it is written back (tc.js marks deleted / moved consults rather than removing them).
     - A record that cannot be read is never written over.
     - Two people saving the same record at once: the second is told "changed since you read
       it" by SharePoint (If-Match), reads again and re-applies its change.
     - Nothing is cached in the browser on the live site, and a read or save that fails says
       so. A tracker that quietly showed nothing would look like lost work.
   Sandbox: the browser, through PH_STORE, exactly as before. */
(function(global){
  'use strict';
  var GRAPH = 'https://graph.microsoft.com/v1.0';
  var HOST = 'omegaorthodontics.sharepoint.com', SITE_PATH = '/sites/Home-Brace';
  var LIST_NAME = 'HomeBraceConsults';
  var COL_MAX = 63000;                 // SharePoint's 63,999 for one multi-line value, with a margin
  var RETRY_WAITS = [800, 2500, 6000];

  function live(){ return !!(global.PH && global.PH.isLive && global.PH.isLive()); }
  function fail(status, msg){ var e = new Error(msg); e.status = status; return e; }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  function send(method, path, body, headers){
    return global.PH_AUTH.token().then(function(t){
      var h = { Authorization: 'Bearer ' + t };
      if(body !== undefined) h['Content-Type'] = 'application/json';
      Object.keys(headers || {}).forEach(function(k){ h[k] = headers[k]; });
      return global.fetch(path.indexOf('https://') === 0 ? path : GRAPH + path,
        { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    }).then(function(res){
      if(res.status === 204) return {};
      return res.json().catch(function(){ return {}; }).then(function(j){
        if(!res.ok) throw fail(res.status, 'SharePoint ' + res.status + ': ' + ((j.error && j.error.message) || res.statusText || ''));
        return j;
      });
    });
  }
  // Busy is not broken: throttling and a dropped connection get a few more tries.
  function withRetry(run){
    var i = 0;
    function attempt(){
      return run().catch(function(e){
        var busy = !e.status || e.status === 429 || e.status === 503 || e.status === 504;
        if(!busy || i >= RETRY_WAITS.length) throw e;
        return sleep(RETRY_WAITS[i++]).then(attempt);
      });
    }
    return attempt();
  }

  /* The list, found by its name the way store.js finds HomeBraceData. Someone without access
     does not see it at all (SharePoint leaves it out), so "missing" covers both. */
  var where = null;
  function list(){
    if(where) return where;
    where = withRetry(function(){ return send('GET', '/sites/' + HOST + ':' + SITE_PATH + '?$select=id'); })
      .then(function(site){
        return withRetry(function(){ return send('GET', '/sites/' + site.id + '/lists?$select=id,displayName&$top=200'); })
          .then(function(r){
            var hit = ((r && r.value) || []).filter(function(l){ return l.displayName === LIST_NAME; })[0];
            if(!hit) throw fail(404, 'The TC Tracker can’t find its SharePoint list. Either it isn’t set up yet, ' +
              'or your account hasn’t been given access to it. Ask your administrator.');
            return '/sites/' + site.id + '/lists/' + hit.id;
          });
      })
      .catch(function(e){ where = null; throw e; });
    return where;
  }

  /* Every row, every page of them. Rows are kept by key; a key written twice at the same
     moment by two people can end up as two rows - both are read, and tc.js combines them by
     consult (newest copy of each wins), so nothing in either is lost. */
  var ids = {};                        // key -> the item id writes go to (the first row for it)
  function rows(){
    return list().then(function(L){
      var out = [];
      function page(url, n){
        return withRetry(function(){ return send('GET', url); }).then(function(r){
          out = out.concat((r && r.value) || []);
          var next = r && r['@odata.nextLink'];
          return (next && n < 100) ? page(next, n + 1) : out;
        });
      }
      return page(L + '/items?$expand=fields($select=Title,Payload)&$top=200', 0).then(function(items){
        items.sort(function(a, b){ return Number(a.id) - Number(b.id); });
        ids = {};
        items.forEach(function(i){ var k = i.fields && i.fields.Title; if(k && !ids[k]) ids[k] = i.id; });
        return items;
      });
    });
  }
  function readPayload(pay){
    var unpack = (global.PH_STORE && global.PH_STORE.unpack) ? global.PH_STORE.unpack : function(p){ return Promise.resolve(p); };
    return unpack(pay || '').then(function(txt){
      if(!txt) return null;
      return JSON.parse(txt);              // throws on a mangled record - the caller refuses to go on
    });
  }
  function writePayload(value){
    var raw = JSON.stringify(value);
    var pack = (global.PH_STORE && global.PH_STORE.pack) ? global.PH_STORE.pack : function(r){ return Promise.resolve(r); };
    return pack(raw).then(function(pay){
      if(pay.length > COL_MAX) throw fail(413, 'This month’s consults are too large to save in one SharePoint record.');
      return pay;
    });
  }

  /* All records whose key starts with `prefix`: {key: value}. A row that cannot be read
     stops the read - showing the rest would hide that something is wrong. */
  function getAll(prefix){
    if(!live()){
      var out = {};
      try{
        for(var i = 0; i < localStorage.length; i++){
          var k = localStorage.key(i);
          if(k && k.indexOf(prefix) === 0 && k.indexOf('__') < 0){ try{ out[k] = JSON.parse(localStorage.getItem(k)); }catch(_){} }
        }
      }catch(_){}
      return Promise.resolve(out);
    }
    return rows().then(function(items){
      var out = {}, jobs = [];
      items.forEach(function(it){
        var k = it.fields && it.fields.Title;
        if(!k || k.indexOf(prefix) !== 0) return;
        jobs.push(readPayload(it.fields.Payload).then(function(v){
          out[ids[k] === it.id ? k : k + '#' + it.id] = v;
        }, function(){
          throw fail(422, 'Part of the TC Tracker (' + k + ') could not be read, so nothing is shown rather than half of it.');
        }));
      });
      return Promise.all(jobs).then(function(){ return out; });
    });
  }

  /* Change one record: read it, hand it to `mutate`, write the result. `mutate` returns the
     new value, or undefined for "nothing to write". Resolves {value}; rejects with what
     SharePoint said. Never writes over a record it could not read. */
  function update(key, mutate){
    if(!live()){
      return global.PH_STORE.update(key, mutate).then(function(r){
        if(r && (r.blocked || r.error)) throw fail(0, r.why || r.error);
        return r || {};
      });
    }
    var tries = 0;
    function once(){
      return list().then(function(L){
        var known = ids[key] ? Promise.resolve(ids[key]) : rows().then(function(){ return ids[key] || null; });
        return known.then(function(id){
          if(!id){
            var next = mutate(undefined);
            if(next === undefined) return { value: undefined, unchanged: true };
            return writePayload(next).then(function(pay){
              return withRetry(function(){ return send('POST', L + '/items', { fields: { Title: key, Payload: pay } }); })
                .then(function(created){ ids[key] = created.id; return { value: next }; });
            });
          }
          return withRetry(function(){ return send('GET', L + '/items/' + id + '?$expand=fields($select=Title,Payload)'); })
            .then(function(item){
              return readPayload(item.fields && item.fields.Payload).then(function(cur){
                var next = mutate(cur === null ? undefined : cur);
                if(next === undefined) return { value: cur, unchanged: true };
                return writePayload(next).then(function(pay){
                  var h = item.eTag ? { 'If-Match': item.eTag } : {};
                  return send('PATCH', L + '/items/' + id + '/fields', { Payload: pay }, h).then(function(){ return { value: next }; });
                });
              }, function(){
                throw fail(422, 'The saved record ' + key + ' could not be read, so it was not written over. Nothing was changed.');
              });
            });
        });
      }).catch(function(e){
        // Someone else's save landed between our read and our write: read again, change again.
        if((e.status === 412 || e.status === 409) && tries++ < 3) return sleep(300 * tries).then(once);
        if(e.status === 404 && ids[key] && tries++ < 3){ delete ids[key]; return once(); }   // the row went
        throw e;
      });
    }
    return once();
  }

  global.TCSTORE = { getAll: getAll, update: update, LIST_NAME: LIST_NAME,
    _reset: function(){ where = null; ids = {}; } };
  if(typeof module !== 'undefined' && module.exports) module.exports = global.TCSTORE;
})(typeof window !== 'undefined' ? window : globalThis);
