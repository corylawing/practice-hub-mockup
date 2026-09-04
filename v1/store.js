/* Home-Brace shared storage.

   Sandbox  -> localStorage, as it always was.
   Live     -> a SharePoint list on /sites/Home-Brace, so the schedule, offices, teams and
               everything else follow a person between devices instead of living in one
               browser. Reads and writes happen AS THE SIGNED-IN PERSON, so SharePoint
               keeps enforcing who can touch what.

   One list, "HomeBraceData", with two text columns:
     Title    - the key ('ph_sched2', 'ph_locations', ...)
     Payload  - JSON, multiple lines of text

   The app never creates the list: that needs Sites.Manage.All, which we deliberately do
   not have. Create it by hand once (see setup() below for the exact steps).

   Every read falls back to localStorage, and every write mirrors to localStorage, so a
   SharePoint hiccup degrades to the old behavior instead of losing someone's work. */
(function(global){
  'use strict';

  var SITE_PATH = '/sites/Home-Brace';
  var LIST_NAME = 'HomeBraceData';
  var hostname  = 'omegaorthodontics.sharepoint.com';

  var siteId = null, listId = null, ready = null;
  var idCache = {};      // key -> SharePoint item id, so updates don't re-search

  function local(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function setLocal(k,v){ try{ localStorage.setItem(k,v); }catch(_){} }

  function live(){ return global.PH && PH.isLive && PH.isLive() && global.PH_AUTH; }

  function connect(){
    if(ready) return ready;
    ready = PH_AUTH.graph('/sites/' + hostname + ':' + SITE_PATH)
      .then(function(s){
        siteId = s.id;
        return PH_AUTH.graph('/sites/' + siteId + '/lists?$select=id,displayName');
      })
      .then(function(r){
        var hit = (r.value||[]).filter(function(l){ return l.displayName === LIST_NAME; })[0];
        if(!hit) throw new Error('No "' + LIST_NAME + '" list on ' + SITE_PATH + ' yet.');
        listId = hit.id;
      });
    return ready;
  }

  function send(method, path, body){
    return PH_AUTH.token().then(function(t){
      return fetch('https://graph.microsoft.com/v1.0' + path, {
        method: method,
        headers: { Authorization:'Bearer '+t, 'Content-Type':'application/json' },
        body: body ? JSON.stringify(body) : undefined
      }).then(function(res){
        if(res.status === 204) return {};
        return res.json().catch(function(){ return {}; }).then(function(j){
          if(!res.ok) throw new Error('Graph '+res.status+': '+((j.error&&j.error.message)||res.statusText));
          return j;
        });
      });
    });
  }

  /* Read one key. Resolves to the parsed value, or null. */
  function get(key){
    if(!live()) return Promise.resolve(parse(local(key)));
    return connect()
      .then(function(){
        return PH_AUTH.graph('/sites/'+siteId+'/lists/'+listId+'/items?$expand=fields&$top=200&$select=id,lastModifiedDateTime');
      })
      .then(function(r){
        var hit=(r.value||[]).filter(function(i){ return i.fields && i.fields.Title===key; })[0];
        if(!hit) return parse(local(key));
        idCache[key]=hit.id;
        var raw=hit.fields.Payload || '';
        /* Only accept the remote copy if it is at least as new as ours. SharePoint's own
           lastModifiedDateTime is the arbiter; a local change made since then wins, and
           gets pushed on the next save. */
        var remoteAt = Date.parse(hit.lastModifiedDateTime || (hit.fields && hit.fields.Modified) || 0) || 0;
        if (localStamp(key) > remoteAt + 1000) return parse(local(key));
        setLocal(key, raw);
        setLocal(stampKey(key), String(remoteAt || Date.now()));
        return parse(raw);
      })
      .catch(function(){ return parse(local(key)); });   // never block the app on storage
  }

  /* Stamp every write, so a sync can tell which copy is newer instead of blindly
     trusting whichever it read last. Without this, opening the app on a second device
     could push an older copy over a change made on the first. */
  function stampKey(k){ return k + '__at'; }
  function localStamp(k){ return Number(local(stampKey(k))) || 0; }

  /* Write one key. Always writes locally first so the UI stays instant. */
  function set(key, value){
    var raw = JSON.stringify(value);
    setLocal(key, raw);
    setLocal(stampKey(key), String(Date.now()));
    if(!live()) return Promise.resolve({local:true});
    return connect()
      .then(function(){
        if(idCache[key]){
          return send('PATCH','/sites/'+siteId+'/lists/'+listId+'/items/'+idCache[key]+'/fields',
                      {Payload: raw});
        }
        return PH_AUTH.graph('/sites/'+siteId+'/lists/'+listId+'/items?$expand=fields&$top=200')
          .then(function(r){
            var hit=(r.value||[]).filter(function(i){ return i.fields && i.fields.Title===key; })[0];
            if(hit){
              idCache[key]=hit.id;
              return send('PATCH','/sites/'+siteId+'/lists/'+listId+'/items/'+hit.id+'/fields',{Payload:raw});
            }
            return send('POST','/sites/'+siteId+'/lists/'+listId+'/items',
                        {fields:{Title:key, Payload:raw}})
              .then(function(created){ idCache[key]=created.id; return created; });
          });
      })
      .catch(function(e){ return {local:true, error:(e&&e.message)||String(e)}; });
  }

  function parse(raw){
    if(raw===null || raw===undefined || raw==='') return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  /* Every row whose key starts with a prefix, as { key: parsedValue }. Used to pull
     everyone's profile row in one request instead of 70. */
  function getAll(prefix){
    if(!live()) return Promise.resolve({});
    return connect()
      .then(function(){
        return PH_AUTH.graph('/sites/'+siteId+'/lists/'+listId+'/items?$expand=fields&$top=500');
      })
      .then(function(r){
        var out={};
        (r.value||[]).forEach(function(i){
          var t=i.fields && i.fields.Title;
          if(t && t.indexOf(prefix)===0){
            idCache[t]=i.id;
            out[t]=parse(i.fields.Payload||'');
          }
        });
        return out;
      })
      .catch(function(){ return {}; });
  }

  /* What a human has to do once, by hand, before live storage works. */
  function setup(){
    return 'On ' + SITE_PATH + ': New > List > Blank list, name it "' + LIST_NAME + '", ' +
           'then Add column > Multiple lines of text named "Payload". Nothing else.';
  }

  global.PH_STORE = { get:get, set:set, getAll:getAll, setup:setup, LIST_NAME:LIST_NAME, SITE_PATH:SITE_PATH };
})(window);
