/* TC TRACKER STORAGE - its own locked folder on the live site.

   17/10/2026. The TC Tracker holds patient names, birth dates and phone numbers. The hub's
   shared list (HomeBraceData) can be read by everyone in Home-Brace, so consults live as files
   in one folder of the Home-Brace site's Documents library, "Home-Brace TC Tracker" - beside
   Home-Brace Documents, never inside it. Cory: "lets do it like we did for documents then as
   long as its scalable": the folder is locked once by hand (Members and Visitors removed) and
   from then on Admin gives and takes back each person's access from Teams & Access (docs.js
   tcGrant / tcRevoke). A folder, not a list, because Microsoft lets an app share a folder with
   a person; a list it does not.
       Documents / Home-Brace TC Tracker / ph_tclog_hobbs_2026-10.json   (one file per office-month)
   Consult slots and the editable lists stay in HomeBraceData through PH_STORE: no patient
   details in them.

   This file touches only that folder. Rules, because these are patient records:
     - Nothing is ever deleted. A file is read, one consult is added or replaced in it, and it
       is written back (tc.js marks deleted / moved consults rather than removing them).
       SharePoint keeps every earlier version of every file, too.
     - A file that cannot be read is never written over.
     - Two people saving the same file at once: the second is told "changed since you read it"
       by SharePoint (If-Match), reads again and re-applies its change.
     - A busy SharePoint (429/503/504) or a dropped connection gets a few more tries, saves
       included. Safe to repeat: if the first save did land, the repeat is refused (If-Match /
       "fail"), the file is read again and the change - one consult, by its id - applied again.
     - Nothing is cached in the browser on the live site, and a read or save that fails says
       so. A tracker that quietly showed nothing would look like lost work.
   Sandbox: the browser, through PH_STORE, exactly as before. */
(function(global){
  'use strict';
  var GRAPH = 'https://graph.microsoft.com/v1.0';
  var HOST = 'omegaorthodontics.sharepoint.com', SITE_PATH = '/sites/Home-Brace';
  var FOLDER = 'Home-Brace TC Tracker';
  var RETRY_WAITS = [800, 2500, 6000];

  function live(){ return !!(global.PH && global.PH.isLive && global.PH.isLive()); }
  function fail(status, msg){ var e = new Error(msg); e.status = status; return e; }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function isBlob(b){ return typeof Blob !== 'undefined' && b instanceof Blob; }

  function send(method, path, body, headers){
    return global.PH_AUTH.token().then(function(t){
      var h = { Authorization: 'Bearer ' + t };
      if(body !== undefined && !isBlob(body)) h['Content-Type'] = 'application/json';
      Object.keys(headers || {}).forEach(function(k){ h[k] = headers[k]; });
      return global.fetch(path.indexOf('https://') === 0 ? path : GRAPH + path, { method: method, headers: h,
        body: body === undefined ? undefined : (isBlob(body) ? body : JSON.stringify(body)) });
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
  var NO_ACCESS = 'Your account doesn’t have access to the TC Tracker’s patient folder yet. ' +
    'Home-Brace gives it from Admin → Teams & Access (the TC Tracker column) - ask your administrator.';

  /* The folder. It is made the first time anyone uses the tracker. Someone who can't see it
     (it is locked and they haven't been given access) gets "it's already there" when trying to
     make it - that is how "no access" is told apart from "not made yet". */
  var where = null;
  function folder(){
    if(where) return where;
    where = withRetry(function(){ return send('GET', '/sites/' + HOST + ':' + SITE_PATH + '?$select=id'); })
      .then(function(site){ return withRetry(function(){ return send('GET', '/sites/' + site.id + '/drive?$select=id'); }); })
      .then(function(d){
        var at = '/drives/' + d.id + '/root:/' + encodeURIComponent(FOLDER);
        function found(f){
          if(!f.folder) throw fail(409, 'There is a file called “' + FOLDER + '” where the TC Tracker’s folder should be.');
          return { drive: d.id, id: f.id };
        }
        return withRetry(function(){ return send('GET', at + '?$select=id,folder'); }).then(found, function(e){
          if(e.status === 403) throw fail(403, NO_ACCESS);
          if(e.status !== 404) throw e;
          return withRetry(function(){ return send('POST', '/drives/' + d.id + '/root/children',
            { name: FOLDER, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }); })
            .then(function(made){ return { drive: d.id, id: made.id }; }, function(e2){
              if(e2.status !== 409 && e2.status !== 403) throw e2;
              // "Already there": someone made it a moment ago (then it can be seen now), or it is
              // locked and this account hasn't been given access.
              return send('GET', at + '?$select=id,folder').then(found, function(){ throw fail(403, NO_ACCESS); });
            });
        });
      })
      .catch(function(e){ where = null; throw e; });
    return where;
  }

  /* Every file in the folder, every page of the listing. */
  var ids = {};                        // file name -> item id
  function files(F){
    var out = [];
    function page(url, n){
      return withRetry(function(){ return send('GET', url); }).then(function(r){
        out = out.concat(((r && r.value) || []).filter(function(i){ return i.file; }));
        var next = r && r['@odata.nextLink'];
        return (next && n < 100) ? page(next, n + 1) : out;
      });
    }
    return page('/drives/' + F.drive + '/items/' + F.id + '/children?$top=200', 0).then(function(list){
      ids = {}; list.forEach(function(i){ ids[i.name] = i.id; });
      return list;
    });
  }
  /* A file's content, through its own short-lived download address (no sign-in header -
     Microsoft's documented way for a browser; /content answers with a redirect a browser
     refuses). Throws on a mangled file: the caller refuses to go on. */
  function readFile(item){
    var url = item && item['@microsoft.graph.downloadUrl'];
    if(!url) return Promise.reject(fail(0, 'SharePoint gave no download address for ' + (item && item.name) + '.'));
    return withRetry(function(){
      return global.fetch(url).then(function(res){
        if(!res.ok) throw fail(res.status, 'SharePoint ' + res.status + ' reading ' + item.name);
        return res.text();
      });
    }).then(function(txt){ return txt ? JSON.parse(txt) : null; });
  }
  function body(value){
    var txt = JSON.stringify(value);
    return (typeof Blob !== 'undefined') ? new Blob([txt], { type: 'application/json' }) : txt;
  }
  const nameOf = function(key){ return key + '.json'; };

  /* All records whose key starts with `prefix`: {key: value}. A file that cannot be read
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
    return folder().then(files).catch(function(e){
      if(e.status === 404){ where = null; ids = {}; }      // the folder went: "Try again" looks again
      throw e;
    }).then(function(list){
      var out = {};
      return Promise.all(list.filter(function(f){ return f.name.indexOf(prefix) === 0 && /\.json$/i.test(f.name); }).map(function(f){
        var key = f.name.replace(/\.json$/i, '');
        return readFile(f).then(function(v){ out[key] = v; }, function(){
          throw fail(422, 'Part of the TC Tracker (' + key + ') could not be read, so nothing is shown rather than half of it.');
        });
      })).then(function(){ return out; });
    });
  }

  /* Change one record: read it, hand it to `mutate`, write the result. `mutate` returns the
     new value, or undefined for "nothing to write". Resolves {value}; rejects with what
     SharePoint said. Never writes over a file it could not read. */
  function update(key, mutate){
    if(!live()){
      return global.PH_STORE.update(key, mutate).then(function(r){
        if(r && (r.blocked || r.error)) throw fail(0, r.why || r.error);
        return r || {};
      });
    }
    var tries = 0, name = nameOf(key);
    function once(){
      return folder().then(function(F){
        var known = ids[name] ? Promise.resolve(ids[name]) : files(F).then(function(){ return ids[name] || null; });
        return known.then(function(id){
          if(!id){
            var next = mutate(undefined);
            if(next === undefined) return { value: undefined, unchanged: true };
            // New file - and "fail" if someone made it a moment ago (then read theirs, change again).
            return withRetry(function(){ return send('PUT', '/drives/' + F.drive + '/items/' + F.id + ':/' + encodeURIComponent(name) + ':/content?@microsoft.graph.conflictBehavior=fail', body(next)); })
              .then(function(made){ ids[name] = made.id; return { value: next }; });
          }
          return withRetry(function(){ return send('GET', '/drives/' + F.drive + '/items/' + id); }).then(function(item){
            return readFile(item).then(function(cur){
              var next = mutate(cur === null ? undefined : cur);
              if(next === undefined) return { value: cur, unchanged: true };
              var h = item.eTag ? { 'If-Match': item.eTag } : {};
              return withRetry(function(){ return send('PUT', '/drives/' + F.drive + '/items/' + id + '/content', body(next), h); })
                .then(function(){ return { value: next }; });
            }, function(){
              throw fail(422, 'The saved record ' + key + ' could not be read, so it was not written over. Nothing was changed.');
            });
          });
        });
      }).catch(function(e){
        // Someone else's save landed between our read and our write: read again, change again.
        if((e.status === 412 || e.status === 409) && tries++ < 3){ ids = {}; return sleep(300 * tries).then(once); }
        if(e.status === 404 && tries++ < 3){ ids = {}; where = null; return once(); }        // the file or folder moved
        throw e;
      });
    }
    return once();
  }

  global.TCSTORE = { getAll: getAll, update: update, FOLDER: FOLDER, _reset: function(){ where = null; ids = {}; } };
  if(typeof module !== 'undefined' && module.exports) module.exports = global.TCSTORE;
})(typeof window !== 'undefined' ? window : globalThis);
