/* Home-Brace documents - the practice's files, kept in SharePoint, run from the hub.

   30/09/2026. Cory: "There is no way from Home Brace Heather can create the folders
   which would automatically put it in HomeBrace ... She wants it to be master", "She
   should also be able to remove folders she already created", and "Uploading a
   document and deciding the controls needs to be very easy to understand."

   WHERE THINGS LIVE. The Home-Brace site's own document library ("Documents"), inside
   one folder, "Home-Brace Documents": a folder per Documents section and, for a section
   organised by office or brand, a folder per office or brand inside that.
       Documents / Home-Brace Documents / HR / New Hire / packet.pdf
       Documents / Home-Brace Documents / Office Docs / Carlsbad / lease.pdf
   Everything is read and written AS THE SIGNED-IN PERSON (delegated Sites.ReadWrite.All),
   so SharePoint still decides what each person can reach.

   WHAT THIS NEVER DOES
     - Overwrite. Uploads use conflictBehavior=rename: a second "policy.pdf" arrives as
       "policy 1.pdf". Nothing here sends "replace". The one way a file's content changes
       is Replace, which a manager chooses for ONE file and confirms: it writes a new
       VERSION of that file, and SharePoint keeps the old one in its version history.
     - Rename or move anything.
     - Touch anything outside Home-Brace Documents. remove() is the one destructive call
       and it is fenced to items inside that folder; Microsoft moves them to the site's
       recycle bin (restorable for 93 days) rather than deleting them. A LINKED file -
       one that lives elsewhere, e.g. in Heather's OneDrive - is only ever un-linked.

   Who may see a file INSIDE the hub (the "Only certain people" choice) is recorded in
   ph_docmeta, and links to files kept elsewhere in ph_doclinks - both through the store,
   so they follow everyone between devices and two people adding at once both land.

   Tests: test/docs.test.js, against a stand-in SharePoint. */
(function(global){
  'use strict';

  var HOST  = 'omegaorthodontics.sharepoint.com';
  var SITE  = '/sites/Home-Brace';
  var BASE  = 'Home-Brace Documents';
  var GRAPH = 'https://graph.microsoft.com/v1.0';
  var SMALL = 4 * 1024 * 1024;          // one request up to 4 MB; bigger files go in pieces
  var PIECE = 320 * 1024 * 16;          // 5 MB pieces - Graph wants multiples of 320 KB
  var LINKS = 'ph_doclinks', META = 'ph_docmeta';
  // What a folder drop drags along from a Mac or Windows and nobody meant to share.
  var JUNK  = /^(\.|~\$)|^(thumbs\.db|desktop\.ini)$/i;

  var WAITS = [800, 2500, 6000];
  var driveP = null, ids = {};

  function fail(status, msg, extra){
    var e = new Error(msg); e.status = status;
    if(extra) Object.keys(extra).forEach(function(k){ e[k] = extra[k]; });
    return e;
  }
  function isBlob(b){ return typeof Blob !== 'undefined' && b instanceof Blob; }

  function api(method, url, body, headers){
    return global.PH_AUTH.token().then(function(t){
      var h = { Authorization: 'Bearer ' + t };
      if(body !== undefined && !isBlob(body)) h['Content-Type'] = 'application/json';
      if(headers) Object.keys(headers).forEach(function(k){ h[k] = headers[k]; });
      return fetch(/^https?:/i.test(url) ? url : GRAPH + url, {
        method: method, headers: h,
        body: body === undefined ? undefined : (isBlob(body) ? body : JSON.stringify(body))
      });
    }).then(function(res){
      if(res.status === 204) return {};
      return res.json().catch(function(){ return {}; }).then(function(j){
        if(!res.ok) throw fail(res.status, (j.error && j.error.message) || ('Graph ' + res.status),
                               { code: j.error && j.error.code });
        return j;
      });
    });
  }

  /* SharePoint answers "busy" (429, 503) and phones drop connections. Wait and try again
     a few times before calling it a failure. */
  function transient(e){
    var s = e && e.status;
    if(s === 429 || s === 500 || s === 502 || s === 503 || s === 504) return true;
    return !s && /fetch|network|load failed|timed? ?out|abort/i.test(String(e && e.message));
  }
  function retry(run){
    var n = 0;
    function go(){
      return run().catch(function(e){
        if(n >= WAITS.length || !transient(e)) throw e;
        var w = WAITS[n++];
        return new Promise(function(r){ setTimeout(r, w); }).then(go);
      });
    }
    return go();
  }

  function drive(){
    if(!driveP){
      driveP = retry(function(){ return api('GET', '/sites/' + HOST + ':' + SITE); })
        .then(function(s){ return retry(function(){ return api('GET', '/sites/' + s.id + '/drive?$select=id,webUrl'); }); })
        .catch(function(e){ driveP = null; throw e; });
    }
    return driveP;
  }

  /* A name SharePoint will take. Only the characters it refuses are changed, so a file
     keeps the name it was given; nothing here ever adds a number or a date. */
  function clean(name){
    var s = String(name == null ? '' : name).replace(/["*:<>?\/\\|]/g, '-').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
    if(/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(s) || /^_vti_/i.test(s)) s = '_' + s;
    if(s.length > 200){
      var dot = s.lastIndexOf('.'), ext = (dot > 0 && s.length - dot <= 10) ? s.slice(dot) : '';
      s = s.slice(0, 200 - ext.length) + ext;
    }
    return s || 'Untitled';
  }
  /* path('HR', 'Carlsbad') -> 'Home-Brace Documents/HR/Carlsbad'. Each argument is ONE
     folder: a section called "Insurance / W-9" is the folder "Insurance - W-9", not two. */
  function path(){
    var parts = [BASE];
    [].slice.call(arguments).forEach(function(p){ if(p != null && String(p) !== '') parts.push(clean(p)); });
    return parts.join('/');
  }
  /* A folder path plus a relative one that may go several levels down ('New Hire/Texas'),
     as a dropped folder brings. */
  function under(p, rel){
    var r = String(rel || '').split('/').filter(function(x){ return x !== ''; }).map(clean);
    return r.length ? p + '/' + r.join('/') : p;
  }
  function enc(p){ return p.split('/').map(encodeURIComponent).join('/'); }

  function itemAt(p){
    return drive().then(function(d){
      return retry(function(){ return api('GET', '/drives/' + d.id + '/root:/' + enc(p) + '?$select=id,name,folder,file,webUrl,parentReference'); });
    }).catch(function(e){ if(e.status === 404) return null; throw e; });
  }

  /* Make sure a folder path exists, one level at a time. A folder someone else made a
     moment ago (409) is simply used; a FILE in the way is reported, never replaced. */
  function ensureFolder(p){
    if(ids[p]) return Promise.resolve(ids[p]);
    return drive().then(function(d){
      var parts = p.split('/'), i = 0, parent = null, walked = '';
      function step(){
        if(i >= parts.length) return parent;
        var name = parts[i++];
        walked = walked ? walked + '/' + name : name;
        if(ids[walked]){ parent = ids[walked]; return step(); }
        var here = walked;
        return itemAt(here).then(function(it){
          if(it && it.folder){ parent = ids[here] = it.id; return step(); }
          if(it) throw fail(409, 'There is a file called “' + name + '” where that folder should go.', { blocked: true });
          var url = parent ? '/drives/' + d.id + '/items/' + parent + '/children' : '/drives/' + d.id + '/root/children';
          return retry(function(){ return api('POST', url, { name: name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }); })
            .then(function(made){ parent = ids[here] = made.id; return step(); }, function(e){
              if(e.status !== 409) throw e;
              return itemAt(here).then(function(again){
                if(!again || !again.folder) throw e;
                parent = ids[here] = again.id; return step();
              });
            });
        });
      }
      return step();
    });
  }

  /* Folder ids are remembered for speed. If one was removed since (here, or by someone
     in SharePoint), Microsoft answers 404 - forget them all, look again, try once more. */
  function fresh(run){
    return run().catch(function(e){
      if(e.status !== 404) throw e;
      ids = {};
      return run();
    });
  }

  /* What is in a folder. A folder nobody has put anything in yet is simply empty. */
  function list(p){
    return drive().then(function(d){
      var out = [];
      function page(u){
        return retry(function(){ return api('GET', u); }).then(function(r){
          out = out.concat(r.value || []);
          return r['@odata.nextLink'] ? page(r['@odata.nextLink']) : out;
        });
      }
      return page('/drives/' + d.id + '/root:/' + enc(p) + ':/children?$top=200' +
                  '&$select=id,name,webUrl,size,file,folder,lastModifiedDateTime,lastModifiedBy,parentReference');
    }).then(function(items){
      var by = function(a, b){ return String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' }); };
      return {
        folders: items.filter(function(i){ return i.folder; }).sort(by),
        files:   items.filter(function(i){ return !i.folder && !JUNK.test(i.name); }).sort(by),
        missing: false
      };
    }, function(e){
      if(e.status === 404) return { folders: [], files: [], missing: true };
      throw e;
    });
  }

  /* A new folder, made by hand ("+ New folder"). Saying so beats making "HR 1". */
  function newFolder(p, name){
    var nm = clean(name);
    return fresh(function(){ return ensureFolder(p).then(function(parent){
      return drive().then(function(d){
        return retry(function(){ return api('POST', '/drives/' + d.id + '/items/' + parent + '/children',
          { name: nm, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }); })
          .catch(function(e){
            if(e.status === 409) throw fail(409, 'There is already a folder called “' + nm + '” here.', { exists: true });
            throw e;
          });
      });
    }); });
  }

  /* One file, into a folder path. Never overwrites: a name that is taken gets a number. */
  function upload(p, file, onProgress){
    var name = clean(file.name);
    var prog = function(x){ try{ if(onProgress) onProgress(x); }catch(_){} };
    return fresh(function(){ return ensureFolder(p).then(function(parent){
      return drive().then(function(d){
        var at = '/drives/' + d.id + '/items/' + parent + ':/' + encodeURIComponent(name) + ':';
        if(file.size <= SMALL){
          return retry(function(){
            return api('PUT', at + '/content?@microsoft.graph.conflictBehavior=rename', file,
                       { 'Content-Type': file.type || 'application/octet-stream' });
          }).then(function(it){ prog(1); return it; });
        }
        return retry(function(){ return api('POST', at + '/createUploadSession', { item: { '@microsoft.graph.conflictBehavior': 'rename' } }); })
          .then(function(s){ return pieces(s.uploadUrl, file, prog); });
      });
    }); });
  }
  /* A big file, 5 MB at a time. The session URL carries its own permission, so no
     Authorization header - Microsoft rejects one. */
  function pieces(url, file, prog){
    var size = file.size, start = 0;
    function send(){
      var end = Math.min(start + PIECE, size);
      return retry(function(){
        return fetch(url, { method: 'PUT', headers: { 'Content-Range': 'bytes ' + start + '-' + (end - 1) + '/' + size },
                            body: file.slice(start, end) })
          .then(function(res){
            return res.json().catch(function(){ return {}; }).then(function(j){
              if(!res.ok) throw fail(res.status, (j.error && j.error.message) || ('Upload ' + res.status));
              return { status: res.status, body: j };
            });
          });
      }).then(function(r){
        start = end; prog(Math.min(1, start / size));
        if(r.status === 200 || r.status === 201 || start >= size) return r.body;
        return send();
      });
    }
    return send();
  }

  /* Many files, and the folders they came in. [{file, dir}] or [{dir}] for a folder with
     nothing in it. Folders first, then files one at a time; one failure does not stop
     the rest. onProgress({done, total}) - done is fractional while a file is going. */
  function uploadAll(p, entries, onProgress){
    var list = (entries || []).filter(function(e){ return e && (e.file ? !JUNK.test(e.file.name) : !!e.dir); });
    var files = list.filter(function(e){ return e.file; });
    var dirs = [];
    list.forEach(function(e){ if(e.dir && dirs.indexOf(e.dir) < 0) dirs.push(e.dir); });
    var done = 0, uploaded = [], folders = [], failed = [];
    var report = function(x){ try{ if(onProgress) onProgress({ done: x, total: files.length }); }catch(_){} };
    var chain = Promise.resolve();
    dirs.forEach(function(dir){
      chain = chain.then(function(){
        var target = under(p, dir);
        return fresh(function(){ return ensureFolder(target); }).then(function(id){ folders.push({ dir: dir, id: id }); },
                                         function(e){ failed.push({ name: dir, error: e }); });
      });
    });
    files.forEach(function(e){
      chain = chain.then(function(){
        var target = under(p, e.dir);
        return upload(target, e.file, function(f){ report(done + f); })
          .then(function(it){ uploaded.push(Object.assign({ dir: e.dir || '' }, it)); },
                function(err){ failed.push({ name: e.file.name, error: err }); })
          .then(function(){ done++; report(done); });
      });
    });
    return chain.then(function(){ return { uploaded: uploaded, folders: folders, failed: failed }; });
  }

  /* From an <input type=file> (with or without webkitdirectory). A chosen folder keeps
     its own name as the first level, the way it looked on the computer. */
  function fromInput(fileList){
    return [].slice.call(fileList || []).map(function(f){
      var rel = String(f.webkitRelativePath || ''), cut = rel.lastIndexOf('/');
      return { file: f, dir: cut > 0 ? rel.slice(0, cut) : '' };
    });
  }
  /* From a drop. The entries MUST be taken during the drop event itself - a browser
     empties DataTransfer afterwards - so this reads them first and walks them after. */
  function fromDrop(dt){
    var items = dt && dt.items, roots = [];
    if(items && items.length && typeof items[0].webkitGetAsEntry === 'function'){
      for(var i = 0; i < items.length; i++){
        var en = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
        if(en) roots.push(en);
      }
      /* Some browsers hand over the files without their folder entries. Then the
         plain file list is what there is - still upload those. */
      if(roots.length) return walk(roots, '');
    }
    return Promise.resolve([].slice.call((dt && dt.files) || []).map(function(f){ return { file: f, dir: '' }; }));
  }
  function readAll(reader){
    var all = [];
    return new Promise(function(res){
      (function next(){
        reader.readEntries(function(batch){
          if(!batch || !batch.length) return res(all);
          all = all.concat([].slice.call(batch)); next();
        }, function(){ res(all); });
      })();
    });
  }
  function walk(entries, dir){
    var out = [];
    return entries.reduce(function(chain, en){
      return chain.then(function(){
        if(en.isFile) return new Promise(function(res){
          en.file(function(f){ out.push({ file: f, dir: dir }); res(); }, function(){ res(); });
        });
        if(en.isDirectory){
          var sub = dir ? dir + '/' + en.name : en.name;
          out.push({ dir: sub });
          return readAll(en.createReader()).then(function(kids){ return walk(kids, sub); })
            .then(function(more){ out = out.concat(more); });
        }
      });
    }, Promise.resolve()).then(function(){ return out; });
  }

  /* How much is inside a folder, for the "are you sure" before removing it. Stops
     counting at 500 - past that the number is "500+" and the answer is the same. */
  function tally(item){
    if(!item || !item.folder) return Promise.resolve({ files: item ? 1 : 0, folders: 0, more: false });
    var files = 0, folders = 0, more = false;
    function inside(id, depth){
      if(files + folders >= 500 || depth > 8){ more = true; return Promise.resolve(); }
      return drive().then(function(d){
        return retry(function(){ return api('GET', '/drives/' + d.id + '/items/' + id + '/children?$top=200&$select=id,name,folder'); });
      }).then(function(r){
        if(r['@odata.nextLink']) more = true;
        var kids = r.value || [], chain = Promise.resolve();
        kids.forEach(function(k){
          if(k.folder){ folders++; chain = chain.then(function(){ return inside(k.id, depth + 1); }); }
          else if(!JUNK.test(k.name)) files++;
        });
        return chain;
      });
    }
    return inside(item.id, 0).then(function(){ return { files: files, folders: folders, more: more }; });
  }

  /* THE ONE DESTRUCTIVE CALL. Only for something inside Home-Brace Documents, and even
     then Microsoft keeps it in the site's recycle bin for 93 days. Anything else - the
     folder itself, a linked file in someone's OneDrive, another library - is refused
     here, whatever the page asked for. */
  function insideBase(item, driveId){
    var pr = (item && item.parentReference) || {};
    if(pr.driveId !== driveId || typeof pr.path !== 'string') return false;
    var at = pr.path; try{ at = decodeURIComponent(at); }catch(_){}
    var i = at.indexOf('root:/');
    if(i < 0) return false;
    var rel = at.slice(i + 6);                        // 'Home-Brace Documents/HR/...'
    return rel === BASE || rel.indexOf(BASE + '/') === 0;
  }
  function remove(item){
    return drive().then(function(d){
      if(!item || !item.id || !insideBase(item, d.id))
        throw fail(0, 'Only files and folders inside “' + BASE + '” can be removed from Home-Brace.', { fenced: true });
      return retry(function(){ return api('DELETE', '/drives/' + d.id + '/items/' + item.id); })
        .then(function(){
          var gone = Object.keys(ids).filter(function(k){ return ids[k] === item.id; });
          Object.keys(ids).forEach(function(k){
            if(gone.some(function(g){ return k === g || k.indexOf(g + '/') === 0; })) delete ids[k];
          });
          return { removed: true };
        });
    });
  }

  /* REPLACE: A NEW VERSION OF ONE FILE, ON PURPOSE.
     07/10/2026 - Heather keeps her master copies here and updates them: a new PDF of the
     handbook goes in place of the old one - same name, same place, same link. Not an
     accident: a manager picks the file and confirms. SharePoint keeps the old one in the
     file's version history, so it can be brought back. Fenced like remove(): only a FILE
     inside Home-Brace Documents, and only with the same kind of file (.pdf for a .pdf),
     so the name never lies about what is inside. Sends no conflictBehavior at all - the
     file is addressed by its id, so there is nothing to clash with. */
  function ext(n){ var s = String(n || ''), i = s.lastIndexOf('.'); return i > 0 ? s.slice(i + 1).toLowerCase() : ''; }
  function replace(item, file, onProgress){
    var prog = function(x){ try{ if(onProgress) onProgress(x); }catch(_){} };
    return drive().then(function(d){
      if(!item || !item.id || item.folder || !insideBase(item, d.id))
        throw fail(0, 'Only a file inside \u201c' + BASE + '\u201d can be replaced from Home-Brace.', { fenced: true });
      if(!file || ext(file.name) !== ext(item.name))
        throw fail(0, 'Pick a .' + (ext(item.name) || '?') + ' file to replace \u201c' + item.name + '\u201d.', { wrongType: true });
      var at = '/drives/' + d.id + '/items/' + item.id;
      if(file.size <= SMALL){
        return retry(function(){ return api('PUT', at + '/content', file, { 'Content-Type': file.type || 'application/octet-stream' }); })
          .then(function(it){ prog(1); return it; });
      }
      return retry(function(){ return api('POST', at + '/createUploadSession', {}); })
        .then(function(s){ return pieces(s.uploadUrl, file, prog); });
    });
  }

  /* ---- Files that live somewhere else, linked into a section. ---- */
  function b64url(s){
    var bytes = new TextEncoder().encode(s), bin = '';
    for(var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  }
  function shareId(url){ return 'u!' + b64url(String(url || '').trim()); }
  function resolveLink(url){
    var u = String(url || '').trim();
    if(!/^https:\/\/[^\/]+\.sharepoint\.com\//i.test(u))
      return Promise.reject(fail(0, 'That doesn’t look like a SharePoint or OneDrive link. In the file, click Share, then Copy link, and paste that.', { badLink: true }));
    return retry(function(){ return api('GET', '/shares/' + shareId(u) + '/driveItem?$select=id,name,webUrl,file,folder,size,parentReference'); })
      .catch(function(e){
        if(e.status === 400 || e.status === 403 || e.status === 404)
          throw fail(e.status, 'That link didn’t open a file you can see. Check the link, or ask the owner to share the file with you.', { badLink: true });
        throw e;
      });
  }
  /* Can everyone in Home-Brace open it? true: it is in the Home-Brace library, shared with
     the Home-Brace group, or shared with the whole organisation. false: only named
     people. null: could not tell (the check itself was refused) - say nothing then. */
  function whoCanOpen(item){
    var pr = (item && item.parentReference) || {};
    return drive().then(function(d){
      if(pr.driveId === d.id) return true;
      return api('GET', '/drives/' + pr.driveId + '/items/' + item.id + '/permissions').then(function(r){
        return (r.value || []).some(function(p){
          var sc = p.link && p.link.scope;
          if(sc === 'organization' || sc === 'anonymous') return true;
          return /home-brace/i.test(JSON.stringify([p.grantedToV2, p.grantedToIdentitiesV2, p.grantedTo, p.grantedToIdentities]));
        });
      });
    }).catch(function(){ return null; });
  }

  function store(){ return global.PH_STORE; }
  function saved(r, what){
    if(r && (r.blocked || r.error)) throw fail(0, what + ' did not save: ' + (r.why || r.error));
    return r;
  }
  function links(){
    if(!store()) return Promise.resolve([]);
    return store().get(LINKS).then(function(v){ return Array.isArray(v) ? v : []; }, function(){ return []; });
  }
  /* A link is kept, never deleted: un-linking marks it hidden, so it can always be seen
     who added what, and adding the same link again simply brings it back. */
  function addLink(sec, sub, item, shared, by){
    var id = 'L' + item.id + '|' + sec + '|' + (sub || '');
    var entry = { id: id, sec: sec, sub: sub || '', name: item.name, webUrl: item.webUrl,
                  driveId: ((item.parentReference || {}).driveId) || '', itemId: item.id,
                  shared: shared, by: by || '', at: new Date().toISOString(), hidden: false };
    return store().update(LINKS, function(cur){
      var arr = Array.isArray(cur) ? cur.slice() : [];
      var i = -1; arr.forEach(function(x, n){ if(x && x.id === id) i = n; });
      if(i >= 0) arr[i] = Object.assign({}, arr[i], entry); else arr.push(entry);
      return arr;
    }).then(function(r){ saved(r, 'The link'); return entry; });
  }
  function unlink(id, by){
    return store().update(LINKS, function(cur){
      var arr = Array.isArray(cur) ? cur.slice() : [];
      var i = -1; arr.forEach(function(x, n){ if(x && x.id === id) i = n; });
      if(i < 0) return undefined;
      arr[i] = Object.assign({}, arr[i], { hidden: true, hiddenBy: by || '', hiddenAt: new Date().toISOString() });
      return arr;
    }).then(function(r){ return saved(r, 'Removing the link'); });
  }

  /* "Only certain people" for items the hub holds: { itemId: {teams, offices, by, at} }.
     An empty teams list means every team; an empty offices list, every office. */
  function meta(){
    if(!store()) return Promise.resolve({});
    return store().get(META).then(function(v){ return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }, function(){ return {}; });
  }
  function setAudience(itemIds, aud, by){
    var list = (itemIds || []).filter(Boolean);
    if(!list.length || !aud) return Promise.resolve({ unchanged: true });
    var teams = (aud.teams || []).slice(), offices = (aud.offices || []).slice();
    if(!teams.length && !offices.length) return Promise.resolve({ unchanged: true });
    var stamp = { teams: teams, offices: offices, by: by || '', at: new Date().toISOString() };
    return store().update(META, function(cur){
      var next = (cur && typeof cur === 'object' && !Array.isArray(cur)) ? Object.assign({}, cur) : {};
      list.forEach(function(id){ next[id] = stamp; });
      return next;
    }).then(function(r){ return saved(r, 'Who can see it'); });
  }
  /* Back to "everyone who can open the section" (07/10 - Cory: "can I go to each file and
     choose who gets access?"). Only that item's entry is taken off; nothing else in the
     record changes and no file is touched. Nothing to take off: nothing is written. */
  function clearAudience(itemIds){
    var list = (itemIds || []).filter(Boolean);
    if(!list.length) return Promise.resolve({ unchanged: true });
    return store().update(META, function(cur){
      if(!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
      var hit = list.filter(function(id){ return Object.prototype.hasOwnProperty.call(cur, id); });
      if(!hit.length) return undefined;
      var next = Object.assign({}, cur);
      hit.forEach(function(id){ delete next[id]; });
      return next;
    }).then(function(r){ return saved(r, 'Who can see it'); });
  }

  global.PH_DOCS = {
    BASE: BASE, clean: clean, path: path, under: under, shareId: shareId,
    drive: drive, item: itemAt, list: list, ensureFolder: ensureFolder, newFolder: newFolder,
    upload: upload, uploadAll: uploadAll, fromInput: fromInput, fromDrop: fromDrop,
    tally: tally, remove: remove, replace: replace, insideBase: insideBase,
    resolveLink: resolveLink, whoCanOpen: whoCanOpen,
    links: links, addLink: addLink, unlink: unlink,
    meta: meta, setAudience: setAudience, clearAudience: clearAudience,
    /* Tests shorten the waits and start from a clean slate. */
    setRetryWaits: function(w){ WAITS = w; },
    reset: function(){ driveP = null; ids = {}; }
  };
})(window);
