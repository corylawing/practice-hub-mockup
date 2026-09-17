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
  var readFailed = {};   // key -> true when THIS session could not read the shared copy

  function local(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  /* Reports whether it worked. Browser storage fills up - usually on profile photos -
     and a save that silently didn't happen is how a screen full of changes reverts on
     the next reload with nobody any the wiser. */
  function setLocal(k,v){ try{ localStorage.setItem(k,v); return true; }catch(_){ return false; } }

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
    if(!live()){ var lv = parse(local(key)); rememberWeight(key, lv); return Promise.resolve(lv); }
    return connect()
      .then(function(){
        return PH_AUTH.graph('/sites/'+siteId+'/lists/'+listId+'/items?$expand=fields&$top=200&$select=id,lastModifiedDateTime');
      })
      .then(function(r){
        var hit=(r.value||[]).filter(function(i){ return i.fields && i.fields.Title===key; })[0];
        /* Reaching this line at all means the read worked. "No row yet" is a real
           answer and a first save is allowed; a thrown request is not, and is caught
           below. Everything downstream depends on keeping those two apart. */
        readFailed[key] = false;
        if(!hit){ rememberWeight(key, null); return parse(local(key)); }
        idCache[key]=hit.id;
        var raw=hit.fields.Payload || '';
        /* WHOSE COPY WINS.

           This used to compare one browser's clock against SharePoint's timestamp and
           keep whichever looked newer. That is not a sound question to ask: the two
           clocks belong to different machines, and every save on the schedule page
           rewrites ph_docs, so simply using the page stamped the local copy as "newer"
           without changing a thing. Once a person's push to SharePoint failed - which
           is what happens to a guest with read but not write access to the site - their
           local stamp stayed ahead of the remote one for good, and they never saw
           anybody else's changes again.

           Reported 2026-09-17: Heather added Dr. Lightheart to the doctor list, and
           Jenny's calendar carried on showing the four it had.

           So: the local copy wins ONLY when it is holding changes that never reached
           SharePoint. Otherwise the shared copy is the truth. No clocks involved. */
        var remoteAt = Date.parse(hit.lastModifiedDateTime || (hit.fields && hit.fields.Modified) || 0) || 0;
        if (unsent(key)){
          var mine = parse(local(key)); rememberWeight(key, mine); return mine;
        }
        setLocal(key, raw);
        setLocal(stampKey(key), String(remoteAt || Date.now()));
        var got = parse(raw);
        rememberWeight(key, got);
        return got;
      })
      .catch(function(){
        /* Still never block the app on storage - but remember that we are now working
           from a guess, so set() below refuses to write this key over the copy we
           could not see. */
        readFailed[key] = true;
        return parse(local(key));
      });
  }

  /* Stamp every write, so a sync can tell which copy is newer instead of blindly
     trusting whichever it read last. Without this, opening the app on a second device
     could push an older copy over a change made on the first. */
  function stampKey(k){ return k + '__at'; }
  function localStamp(k){ return Number(local(stampKey(k))) || 0; }

  /* "This browser has a change that SharePoint never took." Set when a push fails,
     cleared the moment one succeeds. It is the only reason to prefer a local copy over
     the shared one - see the note in get(). */
  function unsentKey(k){ return k + '__unsent'; }
  function unsent(k){ return local(unsentKey(k)) === '1'; }
  function markUnsent(k, yes){
    if(yes) setLocal(unsentKey(k), '1');
    else try{ localStorage.removeItem(unsentKey(k)); }catch(_){}
  }


  /* ------------------------------------------------------------------
     THE SEATBELT.

     On 15 Sep 2026 the schedule page asked for the shared copy, the request failed,
     the failure came back looking exactly like "there is nothing saved", the page
     built a blank year from that, and the next save wrote the blank year over a year
     of somebody's work - 974 writes inside one minute.

     Fixing the schedule page fixed the schedule page. This fixes all of them, because
     every write in the hub comes through set() below, and no page can tell a failed
     read from an empty one on its own.

     Two rules, deliberately blunt:
       1. If we could not READ a key this session, we will not WRITE it. Whatever is
          in memory was built on a guess.
       2. A write that empties out a key which had real content in it is refused, even
          when the read worked fine.

     Both lift with {force:true}, for restore.html and for anything that genuinely
     means "make this blank". A seatbelt, not a lock.
     ------------------------------------------------------------------ */

  /* How much real content is in here? Counts non-empty leaves, so a year of 1,000 days
     each holding an empty {} weighs zero - same as {}. Byte size cannot tell those two
     apart, which is precisely how the blank year got through. */
  function weigh(v, depth){
    depth = depth || 0;
    if(depth > 12 || v === null || v === undefined || v === '' || v === false) return 0;
    if(typeof v !== 'object') return 1;
    var n = 0, i;
    if(Object.prototype.toString.call(v) === '[object Array]'){
      for(i=0;i<v.length;i++) n += weigh(v[i], depth+1);
      return n;
    }
    for(i in v) if(Object.prototype.hasOwnProperty.call(v,i)) n += weigh(v[i], depth+1);
    return n;
  }
  function weightKey(k){ return k + '__w'; }
  function knownWeight(k){ var n = Number(local(weightKey(k))); return n > 0 ? n : 0; }
  function rememberWeight(k, v){ setLocal(weightKey(k), String(weigh(v))); }

  /* Below this, a key is a setting rather than someone's work, and settings get
     cleared on purpose all the time. Nothing to protect. */
  var GUARD_FLOOR = 12;

  /* Keys that are SUPPOSED to shrink, and that nobody typed. The notification feed
     drops anything older than three days, so a quiet weekend empties it; a person's
     read-list is pruned to whatever is still in that feed; the photo cache is rebuilt
     from everyone's profile rows. Guarding these would only ever fire by mistake, and
     the banner would cry wolf over background bookkeeping.

     They are exempt from the shrink rule ONLY. The failed-read rule still applies:
     writing a feed over a copy we could not read would still drop other people's
     entries. When one of these is refused it stays quiet, because the next event
     writes it again anyway. */
  var HOUSEKEEPING = ['ph_activity', 'ph_seen_', 'ph_photos'];
  function housekeeping(key){
    for(var i=0;i<HOUSEKEEPING.length;i++)
      if(key === HOUSEKEEPING[i] || key.indexOf(HOUSEKEEPING[i]) === 0) return true;
    return false;
  }

  function wouldWipe(key, value){
    if(housekeeping(key)) return false;
    var had = knownWeight(key);
    if(had < GUARD_FLOOR) return false;
    return weigh(value) < had * 0.25;
  }

  /* Refused writes are kept, not dropped. If a guard ever fires wrongly the work is
     still here rather than gone, which is the whole point. */
  function refuse(key, value, why){
    try{ setLocal(key + '__refused', JSON.stringify(value)); }catch(_){}
    if(!housekeeping(key)){
      try{
        document.dispatchEvent(new CustomEvent('ph-save-blocked', {detail:{key:key, why:why}}));
      }catch(_){}
    }
    return Promise.resolve({blocked:true, why:why});
  }

  /* Write one key. Always writes locally first so the UI stays instant. */
  function set(key, value, opts){
    if(!(opts && opts.force)){
      if(readFailed[key] === true)
        return refuse(key, value,
          'The hub could not read the saved copy when this page opened, so it will not write '+
          'over it.');
      if(wouldWipe(key, value))
        return refuse(key, value,
          'This would have emptied out something that had real content in it.');
    }
    var raw = JSON.stringify(value);
    /* Keep the copy we are about to replace, here in this browser, so there is always
       an undo even when nobody can find SharePoint's version history. */
    var prevRaw = local(key);
    if(prevRaw && prevRaw !== raw && weigh(parse(prevRaw)) >= GUARD_FLOOR)
      setLocal(key + '__prev', prevRaw);
    if(!setLocal(key, raw))
      return Promise.resolve({quota:true, error:'This browser has run out of room.'});
    setLocal(stampKey(key), String(Date.now()));
    rememberWeight(key, value);
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
      .then(function(r){ markUnsent(key, false); return r; })   // it landed
      .catch(function(e){
        /* A shared save that fails used to be completely silent: it still went into
           this browser's localStorage, so it LOOKED saved, and nobody else ever got
           it. That is the worst way to find out someone's SharePoint permissions are
           wrong. Say so instead - user.js listens and puts a banner up. */
        var msg=(e&&e.message)||String(e);
        /* It did not land. Remember that, so the next read keeps this copy instead of
           being overwritten - and so it stops keeping it as soon as one does land. */
        markUnsent(key, true);
        try{
          document.dispatchEvent(new CustomEvent('ph-save-failed',
            {detail:{key:key, error:msg, denied:/403|forbidden|accessDenied|denied/i.test(msg)}}));
        }catch(_){}
        return {local:true, error:msg};
      });
  }

  /* ------------------------------------------------------------------
     CHANGE ONE PART OF A SHARED RECORD WITHOUT FLATTENING THE REST.

     Every save used to send the page's whole copy of a record. A page that had been
     open for an hour sent an hour-old copy, and whatever anybody else had saved in
     that hour was gone - quietly, because the size barely moved so the wipe guard had
     nothing to say. The Admin screen does this for every person's settings and every
     cell of the access grid, so it was the most exposed.

     update() reads the shared copy FIRST, hands it to the caller to change, and writes
     the result. The read goes through get(), so a copy this browser is still holding
     unsent stays the base, and a read that fails leaves set() refusing to write - you
     cannot safely merge onto something you could not see.

     The caller returns the new value, or undefined for "nothing to write". */
  function update(key, mutate, opts){
    return get(key).then(function(current){
      var next;
      try{ next = mutate(current === null ? undefined : current); }
      catch(e){ return Promise.reject(e); }
      if(next === undefined) return {unchanged:true, value:current};
      return set(key, next, opts).then(function(r){
        if(r) r.value = next;
        return r;
      });
    });
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
            readFailed[t]=false;
            out[t]=parse(i.fields.Payload||'');
            rememberWeight(t, out[t]);
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

  global.PH_STORE = {
    get:get, set:set, update:update, getAll:getAll, setup:setup,
    /* Pages ask this instead of guessing from a null. */
    readFailed:function(k){ return readFailed[k] === true; },
    /* True when this browser is holding a change SharePoint never took. */
    unsent:unsent,
    /* The copy this browser replaced last, for restore.html. */
    backup:function(k){ return parse(local(k + '__prev')); },
    weigh:weigh,
    LIST_NAME:LIST_NAME, SITE_PATH:SITE_PATH
  };
})(window);
