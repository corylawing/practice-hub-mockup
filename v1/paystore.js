/* PAYROLL STORAGE - its own locked folder on the live site, ONE FOLDER PER OFFICE.

   01/11/2026. Heather: "We can go live with the payroll sheet." Pay is private: an office's hours, bonuses and notes
   are for that office's sender and Heather, not the other offices, and not everyone in Home-Brace (the hub's shared
   list, HomeBraceData, can be read by all of them). So, like the TC Tracker (tcstore.js), payroll lives as files in
   a folder of the Home-Brace site's Documents library, beside Home-Brace Documents and never inside it:
       Documents / Home-Brace Payroll /                     locked once by hand (Members and Visitors removed)
           Carlsbad /   people.json, sheet_2026-23.json ...  that office's sender(s) + whoever manages payroll
           Hobbs / ...                                       one folder per office
           Heather /    settings.json, cols_2026-23.json     whoever manages payroll ONLY: bonus amounts, her
                                                             own columns (Goal, TC/OM, Extra), what's entered
   Admin gives and takes back each person's access from Teams & Access (docs.js PAY, admin.html runPaySync): the
   managers get the whole folder and every office's; a sender gets their own office's folder, nothing else. The
   Heather folder is never given to anyone directly - it only inherits the locked folder's managers.

   Rules, because this is pay: the same as tcstore.js.
     - Nothing is ever deleted. A file is read, changed and written back; SharePoint keeps every earlier version.
     - A file that cannot be read is never written over.
     - Two saves at once: SharePoint refuses the second (If-Match), it reads again and re-applies its change.
     - Busy (429/503/504) or a dropped connection: a few more tries, saves included - safe, for the same reason.
     - Nothing is cached in the browser on the live site, and a read or save that fails says so.
   Only someone who manages payroll can make the folders (the first time Heather opens Payroll, or Admin's sync);
   a sender whose office folder isn't there yet is told so, never shown an empty sheet.
   Sandbox: the browser (localStorage), so the live code can be tried with made-up people. */
(function(global){
  'use strict';
  var GRAPH = 'https://graph.microsoft.com/v1.0';
  var HOST = 'omegaorthodontics.sharepoint.com', SITE_PATH = '/sites/Home-Brace';
  var ROOT = 'Home-Brace Payroll', PRIVATE = 'Heather';
  var RETRY_WAITS = [800, 2500, 6000];

  function live(){ return !!(global.PH && global.PH.isLive && global.PH.isLive()); }
  function fail(status, msg){ var e = new Error(msg); e.status = status; return e; }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function isBlob(b){ return typeof Blob !== 'undefined' && b instanceof Blob; }
  var enc = function(p){ return String(p).split('/').map(encodeURIComponent).join('/'); };

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
  var NO_ACCESS = 'Your account doesn’t have access to Payroll yet. Home-Brace gives it from Admin → Teams & Access ' +
    '(the Payroll column) - ask your administrator.';
  var NOT_SET_UP = function(sub){ return 'The Payroll folder for ' + sub + ' isn’t set up yet. It’s made the first time ' +
    'whoever manages payroll opens Payroll - ask them to open it once.'; };

  /* ---------- the folders ---------- */
  var driveP = null;
  function drive(){
    if(driveP) return driveP;
    driveP = withRetry(function(){ return send('GET', '/sites/' + HOST + ':' + SITE_PATH + '?$select=id'); })
      .then(function(site){ return withRetry(function(){ return send('GET', '/sites/' + site.id + '/drive?$select=id'); }); })
      .then(function(d){ return d.id; })
      .catch(function(e){ driveP = null; throw e; });
    return driveP;
  }
  function isFolder(f, name){
    if(!f.folder) throw fail(409, 'There is a file called “' + name + '” where a Payroll folder should be.');
    return f.id;
  }
  /* Make a folder inside `parentId` - "fail" if it's there already (then look again: someone made it a moment ago,
     or it is locked and this account can't see it). */
  function make(d, parentPath, parentId, name){
    var at = '/drives/' + d + '/root:/' + enc(parentPath ? parentPath + '/' + name : name);
    return withRetry(function(){ return send('POST', parentId ? '/drives/' + d + '/items/' + parentId + '/children' : '/drives/' + d + '/root/children',
      { name: name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }); })
      .then(function(m){ return m.id; }, function(e){
        if(e.status !== 409 && e.status !== 403) throw e;
        return send('GET', at + '?$select=id,folder').then(function(f){ return isFolder(f, name); }, function(){ throw fail(403, NO_ACCESS); });
      });
  }
  var rootP = null;
  function root(canMake){
    if(rootP) return rootP;
    rootP = drive().then(function(d){
      return withRetry(function(){ return send('GET', '/drives/' + d + '/root:/' + enc(ROOT) + '?$select=id,folder'); })
        .then(function(f){ return isFolder(f, ROOT); }, function(e){
          if(e.status === 403) throw fail(403, NO_ACCESS);
          if(e.status !== 404) throw e;
          if(!canMake) throw fail(403, NO_ACCESS);          // a sender who can't see it: locked, not "missing"
          return make(d, '', null, ROOT);
        });
    }).catch(function(e){ rootP = null; throw e; });
    return rootP;
  }
  var subs = {};                       // sub -> Promise<{drive, id}>
  function folder(sub, canMake){
    if(subs[sub]) return subs[sub];
    subs[sub] = drive().then(function(d){
      var at = '/drives/' + d + '/root:/' + enc(ROOT + '/' + sub);
      return withRetry(function(){ return send('GET', at + '?$select=id,folder'); })
        .then(function(f){ return { drive: d, id: isFolder(f, sub) }; }, function(e){
          if(e.status === 403) throw fail(403, NO_ACCESS);
          if(e.status !== 404) throw e;
          if(!canMake) throw fail(404, NOT_SET_UP(sub));
          return root(true).then(function(rid){ return make(d, ROOT, rid, sub); }).then(function(id){ return { drive: d, id: id }; });
        });
    }).catch(function(e){ delete subs[sub]; throw e; });
    return subs[sub];
  }

  /* ---------- files in one folder ---------- */
  var ids = {};                        // sub -> {file name: item id}
  function files(sub, F){
    var out = [];
    function page(url, n){
      return withRetry(function(){ return send('GET', url); }).then(function(r){
        out = out.concat(((r && r.value) || []).filter(function(i){ return i.file; }));
        var next = r && r['@odata.nextLink'];
        return (next && n < 100) ? page(next, n + 1) : out;
      });
    }
    return page('/drives/' + F.drive + '/items/' + F.id + '/children?$top=200', 0).then(function(list){
      ids[sub] = {}; list.forEach(function(i){ ids[sub][i.name] = i.id; });
      return list;
    });
  }
  /* A file's content through its own short-lived download address (no sign-in header - /content redirects are
     refused by the browser). Throws on a mangled file: the caller refuses to go on. */
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
  function fewAtATime(list, n, job){
    var next = 0;
    function lane(){
      if(next >= list.length) return Promise.resolve();
      var x = list[next++];
      return Promise.resolve().then(function(){ return job(x); }).then(lane);
    }
    var lanes = [];
    for(var k = 0; k < Math.min(n, list.length); k++) lanes.push(lane());
    return Promise.all(lanes);
  }

  /* ---------- the sandbox: this browser ---------- */
  var LS_PRE = 'ph_pay__';
  function lsKey(sub, key){ return LS_PRE + sub + '__' + key; }
  function lsGet(sub, key){ try{ var v = localStorage.getItem(lsKey(sub, key)); return v === null ? undefined : JSON.parse(v); }catch(_){ return undefined; } }

  /* One folder's store. canMake: this person manages payroll (may make the folder the first time). */
  function at(sub, canMake){
    sub = String(sub || '').trim();
    if(!sub || /[\/\\]/.test(sub)) throw fail(0, 'Not a Payroll folder: ' + sub);
    /* All records whose key starts with `prefix`: {key: value}. A file that can't be read stops the read - or,
       with {partial: true}, the rest is returned and `unread` (not one of the keys) names what couldn't be read. */
    function getAll(prefix, opts){
      var partial = !!(opts && opts.partial);
      var mark = function(out, unread){ if(partial) Object.defineProperty(out, 'unread', { value: unread, enumerable: false }); return out; };
      if(!live()){
        var out = {}, pre = lsKey(sub, prefix);
        try{
          for(var i = 0; i < localStorage.length; i++){
            var k = localStorage.key(i);
            if(k && k.indexOf(pre) === 0){ try{ out[k.slice(lsKey(sub, '').length)] = JSON.parse(localStorage.getItem(k)); }catch(_){} }
          }
        }catch(_){}
        return Promise.resolve(mark(out, []));
      }
      return folder(sub, canMake).then(function(F){ return files(sub, F); }).catch(function(e){
        if(e.status === 404){ delete subs[sub]; delete ids[sub]; }
        throw e;
      }).then(function(list){
        var out = {}, unread = [];
        var mine = list.filter(function(f){ return f.name.indexOf(prefix) === 0 && /\.json$/i.test(f.name); });
        return fewAtATime(mine, 6, function(f){
          var key = f.name.replace(/\.json$/i, '');
          return readFile(f).then(function(v){ out[key] = v; }, function(){ unread.push(key); });
        }).then(function(){
          unread.sort();
          if(unread.length && (!partial || unread.length === mine.length))
            throw fail(422, 'Part of Payroll (' + sub + ': ' + unread.join(', ') + ') could not be read, so nothing is shown rather than half of it.');
          return mark(out, unread);
        });
      });
    }
    /* One record, or undefined when there isn't one yet. A file that is there but can't be read is an error. */
    function get(key){
      if(!live()) return Promise.resolve(lsGet(sub, key));
      return folder(sub, canMake).then(function(F){
        return files(sub, F).then(function(){
          var id = ids[sub][key + '.json'];
          if(!id) return undefined;
          return withRetry(function(){ return send('GET', '/drives/' + F.drive + '/items/' + id); }).then(readFile)
            .then(function(v){ return v === null ? undefined : v; });
        });
      });
    }
    /* Change one record: read it, hand it to `mutate` (undefined when new), write what it returns (undefined = nothing
       to write). Resolves {value}. Never writes over a file it could not read. */
    function update(key, mutate){
      if(!live()){
        var cur = lsGet(sub, key), next = mutate(cur === undefined ? undefined : JSON.parse(JSON.stringify(cur)));
        if(next === undefined) return Promise.resolve({ value: cur, unchanged: true });
        try{ localStorage.setItem(lsKey(sub, key), JSON.stringify(next)); }
        catch(e){ return Promise.reject(fail(0, 'This browser is out of room, so it wasn’t saved.')); }
        return Promise.resolve({ value: next });
      }
      var tries = 0, name = key + '.json';
      function once(){
        return folder(sub, canMake).then(function(F){
          var known = (ids[sub] && ids[sub][name]) ? Promise.resolve(ids[sub][name]) : files(sub, F).then(function(){ return ids[sub][name] || null; });
          return known.then(function(id){
            if(!id){
              var next = mutate(undefined);
              if(next === undefined) return { value: undefined, unchanged: true };
              return withRetry(function(){ return send('PUT', '/drives/' + F.drive + '/items/' + F.id + ':/' + encodeURIComponent(name) + ':/content?@microsoft.graph.conflictBehavior=fail', body(next)); })
                .then(function(made){ ids[sub] = ids[sub] || {}; ids[sub][name] = made.id; return { value: next }; });
            }
            return withRetry(function(){ return send('GET', '/drives/' + F.drive + '/items/' + id); }).then(function(item){
              return readFile(item).then(function(cur){
                var next = mutate(cur === null ? undefined : cur);
                if(next === undefined) return { value: cur, unchanged: true };
                var h = item.eTag ? { 'If-Match': item.eTag } : {};
                return withRetry(function(){ return send('PUT', '/drives/' + F.drive + '/items/' + id + '/content', body(next), h); })
                  .then(function(){ return { value: next }; });
              }, function(){
                throw fail(422, 'The saved payroll record ' + sub + '/' + key + ' could not be read, so it was not written over. Nothing was changed.');
              });
            });
          });
        }).catch(function(e){
          if((e.status === 412 || e.status === 409) && tries++ < 3){ delete ids[sub]; return sleep(300 * tries).then(once); }
          if(e.status === 404 && tries++ < 3 && !/isn’t set up yet/.test(e.message)){ delete ids[sub]; delete subs[sub]; return once(); }
          throw e;
        });
      }
      return once();
    }
    return { sub: sub, getAll: getAll, get: get, update: update };
  }
  /* Whoever manages payroll: make the payroll folder and every office's (and Heather's), once. */
  function ensure(subNames){
    if(!live()) return Promise.resolve({});
    var out = {};
    return root(true).then(function(){
      return (subNames || []).concat([PRIVATE]).reduce(function(c, s){
        return c.then(function(){ return folder(s, true).then(function(F){ out[s] = F.id; }); });
      }, Promise.resolve());
    }).then(function(){ return out; });
  }

  global.PAYSTORE = { at: at, ensure: ensure, ROOT: ROOT, PRIVATE: PRIVATE,
    _reset: function(){ driveP = null; rootP = null; subs = {}; ids = {}; } };
  if(typeof module !== 'undefined' && module.exports) module.exports = global.PAYSTORE;
})(typeof window !== 'undefined' ? window : globalThis);
