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

  var GRAPH = 'https://graph.microsoft.com/v1.0';
  var siteId = null, listId = null, ready = null;
  var idCache = {};      // key -> SharePoint item id, so updates don't re-search
  var readFailed = {};   // key -> true when THIS session could not read the shared copy
  var synced = {};       // key -> the payload SharePoint last held, as this session knows it
  function noop(){}
  function emit(type, detail){
    try{ document.dispatchEvent(new CustomEvent(type, {detail:detail})); }catch(_){}
  }
  function listPath(){ return '/sites/'+siteId+'/lists/'+listId; }

  function local(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  /* Reports whether it worked. Browser storage fills up - usually on profile photos -
     and a save that silently didn't happen is how a screen full of changes reverts on
     the next reload with nobody any the wiser. */
  function setLocal(k,v){ try{ localStorage.setItem(k,v); return true; }catch(_){ return false; } }

  /* ------------------------------------------------------------------
     A LIVE SITE THAT IS NOT SIGNED IN YET IS NOT THE SANDBOX.

     19/09/2026, Heather on her phone: a blank September, four doctors, "View only" for
     the COO. Every page reads its data the instant it loads, and at that instant
     Microsoft has not finished signing the person in - PH_AUTH does not exist yet.
     live() used to require PH_AUTH, so on a live site before sign-in it said "sandbox"
     and handed back this browser's local cache as the truth. On a desktop used for
     weeks the cache is warm and it looked fine. On a fresh phone it is empty: the page
     built a blank year from nothing, decided edit/view for nobody, and nothing ever
     read again after sign-in. It also recorded "nothing here" as the guard's baseline,
     which is how a fresh device could still write a blank year over a full one.

     Now live() is about the SITE, and a read on a live site WAITS for sign-in. Every
     page's existing read simply resolves a moment later, with the real data. A write
     on a live site before sign-in is refused: nothing legitimate writes then.
     ------------------------------------------------------------------ */
  function live(){ return !!(global.PH && PH.isLive && PH.isLive()); }
  function signedIn(){ return !!global.PH_AUTH; }
  var authReady = new Promise(function(res){
    if(signedIn()) return res();
    var done=false, fin=function(){ if(done) return; done=true; clearInterval(t); res(); };
    try{ document.addEventListener('ph-signed-in', fin, {once:true}); }catch(_){}
    // gate.js sets PH_AUTH a moment before it fires the event; poll so neither order matters.
    var t=setInterval(function(){ if(signedIn()) fin(); }, 150);
    // Never keep a test process alive waiting for a sign-in that is not coming.
    if(t && typeof t.unref==='function') t.unref();
  });

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
      })
      /* A failed first connection used to stay failed for the rest of the page's life:
         every later read and write - and every retry - got the same rejected promise
         back at once. Forget it, so the next attempt really tries again. */
      .catch(function(e){ ready = null; throw e; });
    return ready;
  }

  function send(method, path, body){
    return PH_AUTH.token().then(function(t){
      return fetch(GRAPH + path, {
        method: method,
        headers: { Authorization:'Bearer '+t, 'Content-Type':'application/json' },
        body: body ? JSON.stringify(body) : undefined
      }).then(function(res){
        if(res.status === 204) return {};
        return res.json().catch(function(){ return {}; }).then(function(j){
          if(!res.ok){
            var e = new Error('Graph '+res.status+': '+((j.error&&j.error.message)||res.statusText));
            e.status = res.status;
            var ra = null;
            try{ ra = res.headers && res.headers.get && res.headers.get('Retry-After'); }catch(_){}
            e.retryAfter = Number(ra) || 0;
            throw e;
          }
          return j;
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     A BUSY MOMENT IS NOT A FAILURE.

     SharePoint answers "try again" in several ways: 429 and 503 when it is throttling
     (with a Retry-After), 409 "Save Conflict" when two writes reach the same item at
     once, a dropped connection on a phone. Each of those used to go straight to the
     red banner and leave the change behind. Wait and try again a few times first. */
  var RETRY_WAITS = [800, 2500, 6000];
  function statusOf(e){
    if(e && e.status) return e.status;
    var m = /Graph (\d{3})/.exec(String(e && e.message));
    return m ? Number(m[1]) : 0;
  }
  function transient(e, allow409){
    var st = statusOf(e);
    if(st === 409) return !!allow409;
    if(st === 423 || st === 429 || st === 500 || st === 502 || st === 503 || st === 504) return true;
    return !st && /fetch|network|load failed|timed? ?out|abort/i.test(String(e && e.message));
  }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function withRetry(run, allow409){
    var n = 0;
    function attempt(){
      return run().catch(function(e){
        if(n >= RETRY_WAITS.length || !transient(e, allow409)) throw e;
        var wait = Math.max(RETRY_WAITS[n++], Math.min(30, (e && e.retryAfter) || 0) * 1000);
        return sleep(wait).then(attempt);
      });
    }
    return attempt();
  }

  /* ------------------------------------------------------------------
     A RECORD SHAREPOINT WILL TAKE.

     25/09/2026, Heather, entering 2027 doctor dates: "Your change was not saved for
     anyone else", several times. A list's "Multiple lines of text" column holds 63,999
     characters, and the whole schedule is ONE record - about 60,000 characters for
     three-quarters of a year - so starting 2027 took it over and every save bounced.
     Nothing had ever checked. The storage proof in connect.html wrote 100 characters.

     A large payload is now deflated (the browser's own zlib) and stored as base64
     behind a short tag. A year of schedule shrinks to a few thousand characters. Small
     records stay plain JSON, readable in SharePoint as before, and anything already
     stored plain still reads. A payload that STILL does not fit is never sent: it stays
     unsent here, safe, and the banner says what it is. */
  var COL_MAX   = 63000;          // Microsoft's figure is 63,999; keep a margin
  var PACK_OVER = 48000;          // only what would not fit otherwise - see WRAPPED below
  var PACK_TAG  = '~z1:';
  /* WRAPPED, so a browser still running the code from before this can read it.
     Somebody who had the hub open before an update keeps the old store.js until they
     reload. That code does not know the packed form: a bare "~z1:..." read as not-JSON,
     which it treated as EMPTY - and its next save would have written back a schedule of
     just the day it changed. Stored as {"__packed":"~z1:..."} it is ordinary JSON to old
     code: it merges its day onto that object and writes the packed year back untouched,
     and unpack() below lays the old tab's day back on top. Records under PACK_OVER are
     never packed at all, so everything that fits today stays readable by everyone. */
  function canPack(){
    return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' &&
           typeof Blob === 'function' && typeof Response === 'function' &&
           typeof btoa === 'function' && typeof atob === 'function';
  }
  function toB64(bytes){
    var s = '', CH = 0x8000;
    for(var i=0;i<bytes.length;i+=CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i+CH));
    return btoa(s);
  }
  function fromB64(t){
    var s = atob(t), a = new Uint8Array(s.length);
    for(var i=0;i<s.length;i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function pack(raw){
    if(typeof raw !== 'string' || raw.length <= PACK_OVER || !canPack()) return Promise.resolve(raw);
    var z = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Response(z).arrayBuffer().then(function(buf){
      var out = JSON.stringify({__packed: PACK_TAG + toB64(new Uint8Array(buf))});
      return out.length < raw.length ? out : raw;
    });
  }
  function inflate(blob){
    var z = new Blob([fromB64(blob.slice(PACK_TAG.length))]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Response(z).text();
  }
  /* Resolves to the JSON text. Rejects when a packed payload cannot be read here, so
     the caller treats it as a FAILED read - never as an empty one. */
  function unpack(pay){
    if(typeof pay !== 'string') return Promise.resolve(pay);
    var bare = pay.indexOf(PACK_TAG) === 0, wrap = !bare && pay.indexOf('{"__packed":') === 0;
    if(!bare && !wrap) return Promise.resolve(pay);
    if(!canPack()) return Promise.reject(new Error('This browser cannot read a packed record.'));
    try{
      if(bare) return inflate(pay);
      var w = JSON.parse(pay);
      if(typeof w.__packed !== 'string' || w.__packed.indexOf(PACK_TAG) !== 0) return Promise.resolve(pay);
      return inflate(w.__packed).then(function(txt){
        var extra = Object.keys(w).filter(function(k){ return k !== '__packed'; });
        if(!extra.length) return txt;
        // Written back by a browser on the old code: its changes sit beside the packed copy.
        var full = JSON.parse(txt);
        if(full && typeof full === 'object' && !Array.isArray(full)) extra.forEach(function(k){ full[k] = w[k]; });
        return JSON.stringify(full);
      });
    }catch(e){ return Promise.reject(e); }       // mangled text: a failed read, reported as one
  }

  /* ------------------------------------------------------------------
     ONE WRITE AT A TIME, PER RECORD.

     One day edit on the schedule fired up to three writes to the notification feed at
     the same instant, and the schedule's own save could start while the previous one
     was still going. Writes that reach one SharePoint item together are what produce
     "Save Conflict". Each key now has a queue: reads and writes for it run in order.
     Several set()s queued for one key send only the newest value. */
  var turn = {};
  function inTurn(key, job){
    var run = (turn[key] || Promise.resolve()).then(job, job);
    turn[key] = run.then(noop, noop);
    return run;
  }
  var seq = {}, waiting = {};

  /* The whole list, every page of it. The old read asked for 200 items and never
     followed on: with 70 people's profile and read-list rows the list passes that, and
     a key past the first page would have read as "not there yet" - and been created a
     second time. One listing in flight is shared by everyone who asks. */
  var listingP = null;
  function listing(){
    if(listingP) return listingP;
    var out = [];
    function one(p, n){
      return PH_AUTH.graph(p).then(function(r){
        out = out.concat((r && r.value) || []);
        var next = r && r['@odata.nextLink'];
        if(next && n < 40) return one(next.replace(GRAPH, ''), n+1);
        return out;
      });
    }
    listingP = withRetry(function(){ out = []; return one(listPath()+'/items?$expand=fields&$top=200', 0); })
      .then(function(items){
        var seen = {};
        items.forEach(function(i){
          var t = i.fields && i.fields.Title;
          if(t && !seen[t]){ seen[t] = 1; idCache[t] = i.id; }   // the FIRST row for a key, always
        });
        listingP = null; return items;
      }, function(e){ listingP = null; throw e; });
    return listingP;
  }
  function findHit(key){
    return listing().then(function(items){
      for(var i=0;i<items.length;i++) if(items[i].fields && items[i].fields.Title === key) return items[i];
      return null;
    });
  }
  /* One item by id: one payload instead of the whole list's. */
  function readItem(key){
    if(!idCache[key]) return findHit(key);
    return PH_AUTH.graph(listPath()+'/items/'+idCache[key]+'?$expand=fields').then(function(i){
      if(!i || !i.fields || i.fields.Title !== key){ delete idCache[key]; return findHit(key); }
      return i;
    }, function(e){
      if(statusOf(e) === 404){ delete idCache[key]; return findHit(key); }
      throw e;
    });
  }
  function writeItem(key, pay){
    if(idCache[key]){
      return send('PATCH', listPath()+'/items/'+idCache[key]+'/fields', {Payload: pay})
        .catch(function(e){
          if(statusOf(e) !== 404) throw e;
          delete idCache[key]; return writeItem(key, pay);      // the row went; find or make it again
        });
    }
    return findHit(key).then(function(hit){
      if(hit){ idCache[key] = hit.id; return send('PATCH', listPath()+'/items/'+hit.id+'/fields', {Payload: pay}); }
      return send('POST', listPath()+'/items', {fields:{Title:key, Payload:pay}})
        .then(function(created){ idCache[key] = created.id; return created; });
    });
  }

  /* Read one key. Resolves to the parsed value, or null. Queued behind any write to
     the same key that is still on its way, so a read never races one. */
  function get(key){
    if(!live()){ var lv = parse(local(key)); rememberWeight(key, lv); return Promise.resolve(lv); }
    return authReady.then(function(){ return inTurn(key, function(){ return readNow(key); }); });
  }
  function readNow(key){
    return withRetry(function(){ return connect().then(function(){ return readItem(key); }); })
      .then(function(hit){
        /* Reaching this line at all means the read worked. "No row yet" is a real
           answer and a first save is allowed; a thrown request is not, and is caught
           below. Everything downstream depends on keeping those two apart. */
        if(!hit){
          readFailed[key] = false;
          // The very first save of this key never landed: send it now (the row gets made).
          synced[key] = null;                      // known: SharePoint has nothing for it
          if(unsent(key)) return recover(key, '', null);
          rememberWeight(key, null); return parse(local(key));
        }
        idCache[key]=hit.id;
        var pay = (hit.fields && hit.fields.Payload) || '';
        return unpack(pay).then(function(raw){
          var got = parse(raw);
          /* Text that is there but will not read is a FAILED read, not an empty record.
             Treating it as empty is the 15 Sep path: blank year, then saved over. */
          if(raw && got === null) throw new Error('The saved copy of '+key+' could not be read.');
          readFailed[key] = false;
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

             So: the local copy counts ONLY when it is holding changes that never reached
             SharePoint - and then it is COMBINED with the shared copy (recover()), not
             put over it. Otherwise the shared copy is the truth. No clocks involved. */
          if(unsent(key)) return recover(key, raw, hit.id);
          var remoteAt = Date.parse(hit.lastModifiedDateTime || (hit.fields && hit.fields.Modified) || 0) || 0;
          setLocal(key, raw);
          setLocal(stampKey(key), String(remoteAt || Date.now()));
          synced[key] = raw;
          rememberWeight(key, got);
          return got;
        });
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
  function drop(k){ try{ localStorage.removeItem(k); }catch(_){ setLocal(k, ''); } }
  function markUnsent(k, yes){
    if(yes) setLocal(unsentKey(k), '1');
    else drop(unsentKey(k));
  }
  /* What the unsent change was made ON TOP OF - the copy SharePoint held when this
     browser's first change of the run failed to go. With it, recover() can tell "I
     changed this" from "someone else changed this since". '' means there was nothing. */
  function baseKey(k){ return k + '__base'; }
  /* Why the last send failed: 'denied' and 'tooBig' wait for the person's next save;
     anything else is retried in the background. */
  function whyKey(k){ return k + '__why'; }
  function forget(k){ drop(baseKey(k)); drop(whyKey(k)); }


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

  /* The guards and the local write - everything set() does before the network. Returns
     {raw} to send, or {result} when there is nothing to send (refused, sandbox, full). */
  function prepare(key, value, opts){
    if(live() && !signedIn()){
      /* Quiet, on purpose: this is a page bug, not something the person can act on,
         and the banner would sit under the sign-in screen. Loud in the console. */
      try{ console.warn('PH_STORE.set('+key+') before sign-in - refused'); }catch(_){}
      return {result:{blocked:true, notReady:true, why:'Not signed in yet.'}};
    }
    if(!(opts && opts.force)){
      if(readFailed[key] === true)
        return {result: refuse(key, value,
          'The hub could not read the saved copy when this page opened, so it will not write '+
          'over it.')};
      if(wouldWipe(key, value))
        return {result: refuse(key, value,
          'This would have emptied out something that had real content in it.')};
    }
    var raw = JSON.stringify(value);
    /* Keep the copy we are about to replace, here in this browser, so there is always
       an undo even when nobody can find SharePoint's version history. */
    var prevRaw = local(key);
    /* Not unsent means this browser's copy WAS the shared one. Remember it before it is
       replaced: if this send fails, it is what the change was made on top of. */
    if(!unsent(key) && !Object.prototype.hasOwnProperty.call(synced, key) && prevRaw !== null) synced[key] = prevRaw;
    if(prevRaw && prevRaw !== raw && weigh(parse(prevRaw)) >= GUARD_FLOOR)
      setLocal(key + '__prev', prevRaw);
    if(!setLocal(key, raw))
      return {result:{quota:true, error:'This browser has run out of room.'}};
    setLocal(stampKey(key), String(Date.now()));
    rememberWeight(key, value);
    if(!live()) return {result:{local:true}};
    /* From here the change is on its way. Mark it NOW, not only if it fails: a phone that
       locks, or a tab that is shut, while the save is still going used to leave the
       change on the device unmarked - and the next page load read SharePoint over it.
       Marked, the next load finds it and sends it (recover()). Cleared when it lands. */
    if(!unsent(key)){
      /* The base only when it is really known. A device that never read this key has no
         idea what SharePoint holds; recording "nothing" would let this copy win every
         difference. Unknown sends recover() to the version history instead. */
      if(Object.prototype.hasOwnProperty.call(synced, key))
        setLocal(baseKey(key), synced[key] == null ? '' : synced[key]);
      markUnsent(key, true);
    }
    return {raw:raw};
  }

  /* The network half. Never throws: resolves {ok:true} or {err}. */
  function sendNow(key, raw, allow409){
    return pack(raw).then(function(pay){
      if(pay.length > COL_MAX){
        var big = new Error('Too large for SharePoint: '+pay.length+' characters (the limit is about '+COL_MAX+').');
        big.tooBig = true; throw big;
      }
      return withRetry(function(){ return connect().then(function(){ return writeItem(key, pay); }); }, allow409);
    }).then(function(){ return {ok:true}; }, function(e){ return {err:e}; });
  }
  function landed(key, raw){
    synced[key] = raw;
    var recovered = !!local(whyKey(key));        // it had failed before (not just been on its way)
    markUnsent(key, false); forget(key);
    emit('ph-save-landed', {key:key, recovered:recovered});
  }
  function failed(key, e, quiet){
    /* A shared save that fails used to be completely silent: it still went into this
       browser's localStorage, so it LOOKED saved, and nobody else ever got it. That is
       the worst way to find out someone's SharePoint permissions are wrong. Say so
       instead - user.js listens and puts a banner up. */
    var msg = (e && e.message) || String(e);
    var st = statusOf(e);
    var denied = st === 403 || /403|forbidden|accessDenied|denied/i.test(msg);
    var tooBig = !!(e && e.tooBig);
    /* It did not land. Remember that, and what it was made on top of, so the next read
       combines this copy with the shared one instead of losing either. */
    if(!unsent(key)){
      if(Object.prototype.hasOwnProperty.call(synced, key))
        setLocal(baseKey(key), synced[key] == null ? '' : synced[key]);
      markUnsent(key, true);
    }
    setLocal(whyKey(key), tooBig ? 'tooBig' : denied ? 'denied' : 'later');
    /* The notification feed and a person's read-list are bookkeeping, not anybody's work:
       the next event rewrites the feed, and both are resent in the background. A red
       "your change was not saved" for them was a false alarm - it went up on a day edit
       whose schedule save had gone through, because the day's notification had not. */
    if(!quiet && !housekeeping(key)) emit('ph-save-failed', {key:key, error:msg, denied:denied, tooBig:tooBig});
    else try{ console.warn('PH_STORE: '+key+' not sent yet - '+msg); }catch(_){}
    return {local:true, error:msg, denied:denied, tooBig:tooBig, conflict: st === 409};
  }

  /* Write one key. Always writes locally first so the UI stays instant; the send joins
     the key's queue, and a newer set() of the same key that is queued behind it carries
     this one's change (every caller gets the result of the send that included theirs). */
  function set(key, value, opts){
    var p = prepare(key, value, opts);
    if(p.result) return Promise.resolve(p.result);
    var raw = p.raw, my = seq[key] = (seq[key] || 0) + 1;
    return new Promise(function(resolve){
      (waiting[key] = waiting[key] || []).push(resolve);
      inTurn(key, function(){
        if(seq[key] !== my) return;
        var callers = waiting[key]; waiting[key] = [];
        return sendNow(key, raw, true).then(function(r){
          var out = r.ok ? (landed(key, raw), {}) : failed(key, r.err);
          callers.forEach(function(f){ f(out); });
        });
      });
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
     the result - all of it in the key's queue, so two changes to one record can never
     read the same copy and each drop the other's. A "Save Conflict" (someone else's
     write landed in between) reads again and changes again. A read that fails leaves
     the write refused - you cannot safely merge onto something you could not see.

     The caller returns the new value, or undefined for "nothing to write". It may be
     called more than once, so it should not count on running only once. */
  function update(key, mutate, opts){
    if(!live()){
      var cur = parse(local(key)), nx;
      try{ nx = mutate(cur === null ? undefined : cur); }catch(e){ return Promise.reject(e); }
      if(nx === undefined) return Promise.resolve({unchanged:true, value:cur});
      return set(key, nx, opts).then(function(r){ if(r) r.value = nx; return r; });
    }
    return authReady.then(function(){
      return inTurn(key, function(){
        var tries = 0;
        function once(){
          return readNow(key).then(function(current){
            var next;
            try{ next = mutate(current === null ? undefined : current); }
            catch(e){ return Promise.reject(e); }
            if(next === undefined) return {unchanged:true, value:current};
            var p = prepare(key, next, opts);
            if(p.result) return Promise.resolve(p.result).then(function(r){ if(r) r.value = next; return r; });
            return sendNow(key, p.raw, false).then(function(r){
              if(r.ok){ landed(key, p.raw); return {value:next}; }
              if(statusOf(r.err) === 409 && tries++ < 3){
                // Someone else's write landed between our read and ours: read theirs, change again.
                if(!local(whyKey(key))){ markUnsent(key, false); forget(key); }
                return sleep(400 * tries).then(once);
              }
              var out = failed(key, r.err); out.value = next; return out;
            });
          });
        }
        return once();
      });
    });
  }

  /* ------------------------------------------------------------------
     A CHANGE THAT NEVER REACHED SHAREPOINT, AND THE COPY THAT DID.

     This browser is holding a change SharePoint never took. It used to win outright:
     the local copy was shown, and the next save sent the whole of it - over whatever
     anybody else had saved since. Now the two are COMBINED, and the result is sent.

     Cory, 25/09: "Do not delete any data on the schedule." So the rules only ever add
     or update, never take away:
       - Anything SharePoint has and this copy lacks is kept.
       - Anything only this browser has is added.
       - Where both hold something different, the copy this change was made on top of
         (its "base") says who changed it. Without a base, SharePoint's value stands.
     The base is recorded when a send first fails. A browser that was left holding a
     change before that existed finds it in the version history: the newest version
     this same person wrote is exactly what their held change was made on top of.
     ------------------------------------------------------------------ */
  var UNKNOWN = {};
  function isObj(v){ return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function hasOwn(o, k){ return Object.prototype.hasOwnProperty.call(o, k); }
  function same(a, b){
    if(a === b) return true;
    if(a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if(Array.isArray(a) !== Array.isArray(b)) return false;
    var i;
    if(Array.isArray(a)){
      if(a.length !== b.length) return false;
      for(i=0;i<a.length;i++) if(!same(a[i], b[i])) return false;
      return true;
    }
    var ka = Object.keys(a), kb = Object.keys(b);
    if(ka.length !== kb.length) return false;
    for(i=0;i<ka.length;i++) if(!hasOwn(b, ka[i]) || !same(a[ka[i]], b[ka[i]])) return false;
    return true;
  }
  function allPrim(a){ return a.every(function(x){ return x === null || typeof x !== 'object'; }); }
  function allIds(a){
    var seen = {};
    return a.every(function(x){
      if(!isObj(x) || x.id === undefined || x.id === null) return false;
      var id = String(x.id); if(seen[id]) return false; seen[id] = 1; return true;
    });
  }
  /* Two levels of a record are combined key by key - a schedule's days and each day's
     offices, the access grid's teams and their sections. Below that a value is ONE
     thing: a day's cell is its doctor, hours and event together, never half of one and
     half of the other. A record that is itself a list is combined item by item. */
  function merge3(base, mine, theirs, depth){
    depth = depth || 0;
    var known = base !== UNKNOWN;
    if(same(mine, theirs)) return theirs;
    if(mine === undefined) return theirs;                    // SharePoint has it: it stays, whoever dropped it here
    if(theirs === undefined){
      // Only here. If the base had it unchanged, it was removed in SharePoint - already the state there.
      if(known && base !== undefined && same(mine, base)) return undefined;
      return mine;                                           // new here: add it
    }
    if(known && same(mine, base)) return theirs;             // only they changed it
    var descend = depth < 2 && isObj(mine) && isObj(theirs);
    var list = depth === 0 && Array.isArray(mine) && Array.isArray(theirs);
    /* Even where only THIS copy changed, an object is walked key by key rather than
       taken whole - taking it whole would also take away whatever this copy lacks. */
    if(descend){
      var out = {}, b = known ? (isObj(base) ? base : {}) : UNKNOWN;
      Object.keys(theirs).concat(Object.keys(mine).filter(function(k){ return !hasOwn(theirs, k); }))
        .forEach(function(k){
          var bk = b === UNKNOWN ? UNKNOWN : (hasOwn(b, k) ? b[k] : undefined);
          var v = merge3(bk, mine[k], theirs[k], depth + 1);
          if(v !== undefined) out[k] = v;
        });
      return out;
    }
    if(list){
      var ba = known ? (Array.isArray(base) ? base : []) : UNKNOWN;
      if(allPrim(mine) && allPrim(theirs)){
        var set1 = theirs.slice();                           // everything SharePoint has, plus what is new here
        mine.forEach(function(x){ if(set1.indexOf(x) < 0 && (ba === UNKNOWN || ba.indexOf(x) < 0)) set1.push(x); });
        return set1;
      }
      if(allIds(mine) && allIds(theirs) && (ba === UNKNOWN || allIds(ba))){
        var M = {}, B = {}, done = {}, items = [];
        mine.forEach(function(x){ M[String(x.id)] = x; });
        if(ba !== UNKNOWN) ba.forEach(function(x){ B[String(x.id)] = x; });
        theirs.concat(mine).forEach(function(x){
          var id = String(x.id); if(done[id]) return; done[id] = 1;
          var tv; theirs.forEach(function(y){ if(String(y.id) === id) tv = y; });
          var v = merge3(ba === UNKNOWN ? UNKNOWN : (hasOwn(B, id) ? B[id] : undefined),
                         hasOwn(M, id) ? M[id] : undefined, tv, 1);
          if(v !== undefined) items.push(v);
        });
        return items;
      }
    }
    if(known && same(theirs, base)) return mine;             // one value, only this copy changed it
    return known ? mine : theirs;       // a true clash: with a base, the held change; without, SharePoint's
  }
  /* Can a record of this shape be combined at all? A list without ids - the doctor list,
     where days point at doctors by POSITION - cannot: that one keeps the old rule. */
  function combinable(a, b){
    if(isObj(a) && isObj(b)) return true;
    if(Array.isArray(a) && Array.isArray(b)) return (allPrim(a) && allPrim(b)) || (allIds(a) && allIds(b));
    return false;
  }
  /* Everything SharePoint had is still in the result. Checked before sending anything,
     on top of the wipe guard, because this is the one write nobody asked for. */
  function keepsAll(merged, theirs){
    if(isObj(theirs)) return isObj(merged) && Object.keys(theirs).every(function(k){ return hasOwn(merged, k); });
    if(Array.isArray(theirs) && Array.isArray(merged)){
      if(allIds(theirs)){ var ids = {}; merged.forEach(function(x){ if(isObj(x)) ids[String(x.id)] = 1; });
        return theirs.every(function(x){ return ids[String(x.id)]; }); }
      return theirs.every(function(x){ return merged.some(function(y){ return same(x, y); }); });
    }
    return true;
  }
  function whoAmI(){
    var a = global.PH_AUTH && PH_AUTH.account;
    return a ? {mail:String(a.username || '').toLowerCase(), name:String(a.name || '')} : null;
  }
  function byMe(v, who){
    var u = v && v.lastModifiedBy && v.lastModifiedBy.user;
    if(!u || !who) return false;
    var em = String(u.email || u.userPrincipalName || '').toLowerCase();
    if(em && who.mail) return em === who.mail;
    return !!(u.displayName && who.name && u.displayName === who.name);
  }
  /* The newest version of this row that THIS person wrote - their last save that
     landed. Looks back 30 versions at most. */
  function mineInHistory(itemId){
    var who = whoAmI();
    if(!who || !itemId) return Promise.resolve(null);
    var found = null, pages = 0;
    function page(p){
      return PH_AUTH.graph(p).then(function(r){
        var vs = ((r && r.value) || []).slice().sort(function(x, y){
          return (Date.parse(y.lastModifiedDateTime) || 0) - (Date.parse(x.lastModifiedDateTime) || 0); });
        for(var i=0;i<vs.length && !found;i++) if(byMe(vs[i], who)) found = vs[i];
        var next = r && r['@odata.nextLink'];
        if(!found && next && ++pages < 3) return page(next.replace(GRAPH, ''));
      });
    }
    return page(listPath()+'/items/'+itemId+'/versions?$top=10').then(function(){
      return found ? unpack((found.fields && found.fields.Payload) || '') : null;
    });
  }
  function baseFor(key, itemId){
    var b = local(baseKey(key));
    if(b !== null) return Promise.resolve(b === '' ? undefined : parse(b));
    return mineInHistory(itemId).then(function(raw){
      if(raw === null || raw === undefined) return UNKNOWN;
      var v = parse(raw); return (raw && v === null) ? UNKNOWN : (v === null ? undefined : v);
    }, function(){ return UNKNOWN; });
  }
  /* Runs inside the key's queue (from readNow). Resolves to what the page should show. */
  function recover(key, remoteRaw, itemId){
    var mineRaw = local(key), mine = parse(mineRaw), theirs = parse(remoteRaw);
    if(mine === null){                               // nothing held after all
      markUnsent(key, false); forget(key);
      setLocal(key, remoteRaw || ''); synced[key] = remoteRaw; rememberWeight(key, theirs);
      return Promise.resolve(theirs);
    }
    /* The held copy is what SharePoint already has - a save that landed but whose answer
       never came back, most often. Nothing to send; just stop holding it. */
    function settled(){
      markUnsent(key, false); forget(key);
      setLocal(key, remoteRaw || ''); synced[key] = remoteRaw; rememberWeight(key, theirs);
      return theirs;
    }
    if(theirs !== null && same(mine, theirs)) return Promise.resolve(settled());
    return baseFor(key, itemId).then(function(base){
      /* A list without ids - the doctor list, which days point into BY POSITION - is
         never combined or sent from here, with or without a base. Its own page sends it,
         with that page's clash check. */
      /* Except the one change that cannot move anybody's position: doctors added at the end,
         with everything before them exactly as SharePoint has it. */
      var appended = Array.isArray(mine) && Array.isArray(theirs) && mine.length > theirs.length &&
                     theirs.every(function(x, i){ return same(x, mine[i]); });
      if(theirs !== null && !combinable(mine, theirs) && !appended){
        rememberWeight(key, mine); return mine;      // the old rule: this browser's copy, sent by its own page
      }
      var merged = (theirs === null || appended) ? mine : merge3(base, mine, theirs, 0);
      if(theirs !== null && same(merged, theirs)) return settled();   // nothing of ours left to add
      if(theirs !== null && !keepsAll(merged, theirs)){
        try{ console.warn('PH_STORE: combining '+key+' would have dropped something - not sent'); }catch(_){}
        rememberWeight(key, mine); return mine;
      }
      var mergedRaw = JSON.stringify(merged);
      setLocal(key + '__mine', mineRaw);             // this browser's copy as it was, before combining
      setLocal(key, mergedRaw);
      setLocal(baseKey(key), remoteRaw || '');       // what is still unsent is now "merged minus this"
      synced[key] = remoteRaw;
      rememberWeight(key, merged);
      if(!local(whyKey(key))) setLocal(whyKey(key), 'later');   // held from before: say so when it lands
      if(wouldWipe(key, merged)) return merged;      // never; but if it ever would, it is not sent
      return sendNow(key, mergedRaw, false).then(function(r){
        if(r.ok) landed(key, mergedRaw); else failed(key, r.err, true);
        return merged;
      });
    });
  }

  /* ------------------------------------------------------------------
     SEND WHAT IS STILL WAITING - without anyone having to save again.

     A change left behind used to go only when that person saved the same thing again,
     so a COO who entered twenty days, saw the banner and closed the laptop had twenty
     days sitting on one machine. Now every page, once signed in, reads each held key
     (which combines and sends it - see recover()), and again every minute and whenever
     the connection comes back. Refusals for permission or size wait for a real save. */
  function pending(){
    var out = [];
    try{
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(k && k.length > 8 && k.slice(-8) === '__unsent' && localStorage.getItem(k) === '1') out.push(k.slice(0, -8));
      }
    }catch(_){}
    return out;
  }
  var resending = false, AUTO = true;
  function autoResend(){ if(AUTO) resendAll(); }
  function resendAll(){
    if(resending || !live() || !signedIn()) return Promise.resolve();
    var keys = pending().filter(function(k){ var w = local(whyKey(k)); return w !== 'denied' && w !== 'tooBig'; });
    if(!keys.length) return Promise.resolve();
    resending = true;
    return Promise.all(keys.map(function(k){ return get(k).catch(noop); }))
      .then(function(){ resending = false; }, function(){ resending = false; });
  }
  authReady.then(function(){ var t = setTimeout(autoResend, 3000); if(t && t.unref) t.unref(); });
  if(typeof setInterval === 'function'){ var every = setInterval(autoResend, 60000); if(every && every.unref) every.unref(); }
  try{ global.addEventListener && global.addEventListener('online', autoResend); }catch(_){}

  /* ------------------------------------------------------------------
     MERGE ONLY WHAT THIS PAGE CHANGED.

     Two people editing the schedule at once used to be last-save-wins for the whole
     year: each page sent its entire copy, so whoever saved second erased the other's
     cell. The wipe guard stops blanking, not that. These take the shared copy as the
     base and lay only this page's changed pieces on top, so both people keep their
     work. Pure functions, tested in test/guard.test.js. */
  function mergeInto(remote, local, changed, removed){
    var out = Object.assign({}, (remote && typeof remote==='object') ? remote : {});
    (changed||[]).forEach(function(k){ if(local && local[k]!==undefined) out[k]=local[k]; });
    (removed||[]).forEach(function(k){ delete out[k]; });
    return out;
  }
  function mergeById(remote, local, changedIds, removedIds){
    var byId={}, order=[], mine={};
    (Array.isArray(remote)?remote:[]).forEach(function(c){ var id=String(c&&c.id); byId[id]=c; order.push(id); });
    (Array.isArray(local)?local:[]).forEach(function(c){ mine[String(c&&c.id)]=c; });
    (changedIds||[]).forEach(function(id){ id=String(id); if(mine[id]===undefined) return;
      if(!(id in byId)) order.push(id); byId[id]=mine[id]; });
    (removedIds||[]).forEach(function(id){ delete byId[String(id)]; });
    return order.filter(function(id){ return byId[id]!==undefined; }).map(function(id){ return byId[id]; });
  }

  function parse(raw){
    if(raw===null || raw===undefined || raw==='') return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  /* Every row whose key starts with a prefix (or any of several), as { key: value }.
     Used to pull everyone's profile row in one request instead of 70. A row this
     browser is still holding unsent comes back as this browser has it - the caller
     writes these rows into local storage, and must not put the old copy over the held
     one. A row that will not read is left out, never reported empty. */
  function getAll(prefix){
    if(!live()) return Promise.resolve({});
    var pre = Array.isArray(prefix) ? prefix : [prefix];
    var wanted = function(t){ return pre.some(function(x){ return t.indexOf(x) === 0; }); };
    return authReady.then(function(){ return withRetry(connect); })
      .then(function(){ return listing(); })
      .then(function(items){
        var out = {}, seen = {}, jobs = [];
        items.forEach(function(i){
          var t = i.fields && i.fields.Title;
          if(!t || seen[t] || !wanted(t)) return;
          seen[t] = 1;
          if(unsent(t)){ out[t] = parse(local(t)); return; }
          jobs.push(unpack(i.fields.Payload || '').then(function(raw){
            var v = parse(raw);
            if(raw && v === null) return;
            readFailed[t] = false; synced[t] = raw; out[t] = v; rememberWeight(t, v);
          }, noop));
        });
        return Promise.all(jobs).then(function(){ return out; });
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
    mergeInto:mergeInto, mergeById:mergeById,
    /* Packed payloads: history.html and restore.html read raw versions through these. */
    pack:pack, unpack:unpack, COL_MAX:COL_MAX,
    /* Combining a held change with the shared copy - pure, tested in test/sync.test.js. */
    merge3:function(base, mine, theirs){ return merge3(base === undefined ? UNKNOWN : base, mine, theirs, 0); },
    /* Keys this browser is holding unsent, and "send them now". */
    pending:pending, resend:resendAll,
    /* Tests shorten the waits between retries. */
    setRetryWaits:function(w){ RETRY_WAITS = w; },
    setAutoResend:function(on){ AUTO = !!on; },
    /* Resolves once the person is signed in; a live site reads nothing before that. */
    ready:authReady,
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
