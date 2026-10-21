/* PRODUCTION BOOKS, KEPT - where each year's book lives, and the copy from Heather's Excel.

   21/10/2026, Cory: build Home-Brace's own production data beside the live Excel ("don't
   disconnect production dashboard for now") and "run them parallel for a bit to make sure
   everything works correctly" before anything switches. The book engine is prodbook.js.

   What is kept, all on the Home-Brace site:
     - each year's TEMPLATE (her workbook without the typed numbers: tabs, labels, formatting,
       that year's formulas) as a file, "<year> production template.xlsx", in the folder
       "Home-Brace Production" at the top of the site's Documents. SharePoint keeps every
       earlier version of it, so an older layout can always be looked at again.
     - each year's NUMBERS in the shared store: 'ph_prod_data_<year>' = {year, data:{tab:{cell:n}}, from}
     - what changed, newest first: 'ph_prod_log_<year>'
     - the years and how each was last copied and checked: 'ph_prod_index'

   COPY-ONLY. Nothing here writes to Heather's Excel, and nothing is ever removed: a copy adds
   or updates Home-Brace's own records, and the shared store's wipe guard refuses a copy that
   would shrink a year's numbers to almost nothing (an emptied Excel stays an emptied Excel,
   not an emptied Home-Brace). Only admins copy. On the sandbox her workbook is never opened:
   everything stays in this browser, and a workbook can be tried by choosing a file.

   Each year stands alone: a new layout for 2027 is 2027's template only, and the "last year"
   rows in a book are a copy, as they are in her Excel - so nothing done to one year can move
   another. */
(function(global){
  'use strict';

  var HOST = 'omegaorthodontics.sharepoint.com', SITE = '/sites/Home-Brace', FOLDER = 'Home-Brace Production';
  var GRAPH = 'https://graph.microsoft.com/v1.0';
  var INDEX = 'ph_prod_index', DATA = 'ph_prod_data_', LOG = 'ph_prod_log_';
  var LOG_KEEP = 150, CHANGES_KEEP = 400;
  var B = function(){ return global.PH_BOOK; };
  var S = function(){ return global.PH_STORE; };

  function live(){ return !!(global.PH && global.PH.isLive && global.PH.isLive()); }
  function admin(){ return !!(global.PH && global.PH.isAdmin && global.PH.isAdmin()); }
  function me(){ try{ return (global.PH && global.PH.name && global.PH.me && global.PH.name(global.PH.me())) || ''; }catch(_){ return ''; } }
  function nowISO(){ return new Date().toISOString(); }
  function fail(msg, status){ var e = new Error(msg); if(status) e.status = status; return e; }

  /* ------------------------------------------------------------------ Graph (live only) */
  function api(method, url, body, type){
    return global.PH_AUTH.token().then(function(t){
      var h = {Authorization:'Bearer ' + t};
      if(body !== undefined) h['Content-Type'] = type || 'application/json';
      return fetch(/^https?:/i.test(url) ? url : GRAPH + url, {method:method, headers:h,
        body: body === undefined ? undefined : (type ? body : JSON.stringify(body))});
    }).then(function(res){
      if(res.status === 204) return {};
      return res.json().catch(function(){ return {}; }).then(function(j){
        if(!res.ok) throw fail((j.error && j.error.message) || ('Microsoft said ' + res.status), res.status);
        return j;
      });
    });
  }
  function bytesOf(url){
    return fetch(url).then(function(r){ if(!r.ok) throw fail('Could not download the file (' + r.status + ').', r.status); return r.arrayBuffer(); })
      .then(function(ab){ return new Uint8Array(ab); });
  }
  var driveP = null;
  function drive(){
    if(!driveP) driveP = api('GET', '/sites/' + HOST + ':' + SITE).then(function(s){ return api('GET', '/sites/' + s.id + '/drive?$select=id'); })
      .catch(function(e){ driveP = null; throw e; });
    return driveP;
  }
  function enc(p){ return p.split('/').map(encodeURIComponent).join('/'); }
  function tplName(y){ return y + ' production template.xlsx'; }
  function ensureFolder(){
    return drive().then(function(d){
      return api('GET', '/drives/' + d.id + '/root:/' + enc(FOLDER) + '?$select=id,folder').catch(function(e){
        if(e.status !== 404) throw e;
        return api('POST', '/drives/' + d.id + '/root/children', {name:FOLDER, folder:{}, '@microsoft.graph.conflictBehavior':'fail'})
          .catch(function(e2){ if(e2.status === 409) return api('GET', '/drives/' + d.id + '/root:/' + enc(FOLDER) + '?$select=id,folder'); throw e2; });
      }).then(function(f){ if(!f.folder) throw fail('Something that is not a folder is called "' + FOLDER + '" on the site.'); return d; });
    });
  }

  /* ------------------------------------------------------------------ templates */
  function b64(u8){ var s = ''; for(var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(t){ var s = atob(t), u = new Uint8Array(s.length); for(var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function putTemplate(y, bytes){
    if(!live()){ try{ localStorage.setItem('ph_prod_tpl_' + y, b64(bytes)); }catch(_){ return Promise.reject(fail('This browser has no room left to keep the layout.')); } return Promise.resolve({name:tplName(y)}); }
    return ensureFolder().then(function(d){
      return api('PUT', '/drives/' + d.id + '/root:/' + enc(FOLDER + '/' + tplName(y)) + ':/content', new Blob([bytes]),
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }).then(function(it){ return {id:it.id, name:it.name, webUrl:it.webUrl}; });
  }
  function getTemplate(y){
    if(!live()){ var t = null; try{ t = localStorage.getItem('ph_prod_tpl_' + y); }catch(_){}
      return t ? Promise.resolve(unb64(t)) : Promise.reject(fail('No layout is kept for ' + y + ' yet.')); }
    return drive().then(function(d){ return api('GET', '/drives/' + d.id + '/root:/' + enc(FOLDER + '/' + tplName(y))); })
      .then(function(it){ return bytesOf(it['@microsoft.graph.downloadUrl']); })
      .catch(function(e){ if(e.status === 404) throw fail('No layout is kept for ' + y + ' yet.', 404); throw e; });
  }

  /* ------------------------------------------------------------------ small helpers */
  function sha(text){
    var data = typeof text === 'string' ? new TextEncoder().encode(text) : text;
    return global.crypto.subtle.digest('SHA-256', data).then(function(h){
      return Array.prototype.map.call(new Uint8Array(h), function(b){ return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 24); });
  }
  function fingerprint(book){
    var L = B().layoutText(book), keys = Object.keys(L);
    return Promise.all(keys.map(function(k){ return sha(L[k]); })).then(function(h){ var o = {}; keys.forEach(function(k, i){ o[k] = h[i]; }); return o; });
  }
  /* Does Home-Brace's own working-out agree with the results Excel saved in the file? */
  function check(book){
    var ev = B().evaluate(book), n = 0, differ = [];
    book.names.forEach(function(s){ var cs = book.sheets[s].cells;
      Object.keys(cs).forEach(function(a){ var c = cs[a]; if(c.f == null) return; n++;
        var got = ev.value(s, a), want = c.v, same;
        if(B().isErr(got) || B().isErr(want)) same = String(got) === String(want);
        else { var g = typeof got === 'number' ? got : (got === '' ? 0 : Number(got)), w = typeof want === 'number' ? want : (want === '' ? 0 : Number(want));
               same = Math.abs(g - w) <= 1e-9 * Math.max(1, Math.abs(w)); }
        if(!same){ var at = B().labelAt(book, s, a); differ.push({tab:s, cell:a, label:at.label, head:at.head, excel:want, homeBrace:got}); }
      }); });
    return {formulas:n, differ:differ.length, sample:differ.slice(0, 8), ev:ev};
  }
  function diff(book, before, after){
    var out = [];
    book.names.forEach(function(s){
      var a = (before && before[s]) || {}, b = (after && after[s]) || {}, seen = {};
      Object.keys(a).concat(Object.keys(b)).forEach(function(cell){
        if(seen[cell]) return; seen[cell] = 1;
        var x = a[cell], y = b[cell];
        if(x === y || (x == null && y == null)) return;
        var at = B().labelAt(book, s, cell);
        out.push({tab:s, cell:cell, label:at.label, head:at.head, from:x == null ? null : x, to:y == null ? null : y});
      });
    });
    return out;
  }
  function count(data){ return Object.keys(data || {}).reduce(function(n, s){ return n + Object.keys(data[s]).length; }, 0); }
  function rowCol(a, b){ var p = /^([A-Z]+)(\d+)$/.exec(a), q = /^([A-Z]+)(\d+)$/.exec(b);
    return (+p[2] - +q[2]) || (B().colNum(p[1]) - B().colNum(q[1])); }
  /* A new layout for a year that already has numbers: each number goes to the cell with the same
     row name and the same column heading ("Completed Number of Production Days", "October") on the
     same tab - never to the same address, which a row added above would have moved. Two rows with
     the same name keep their order. Whatever has no place in the new layout is listed, not lost
     silently (the old layout and numbers stay in SharePoint's version history). */
  function remap(fromBook, data, toBook){
    var targets = {}, used = {}, out = {}, moved = 0, lost = [];
    function key(book, s, a){ var at = B().labelAt(book, s, a); return s + '|' + at.label + '|' + at.head; }
    toBook.names.forEach(function(s){ var cs = toBook.sheets[s].cells;
      Object.keys(cs).sort(rowCol).forEach(function(a){ var c = cs[a];
        if(c.f != null || (typeof c.v === 'string' && c.v !== '') || typeof c.v === 'boolean') return;
        var k = key(toBook, s, a); (targets[k] = targets[k] || []).push(a); }); });
    Object.keys(data || {}).forEach(function(s){
      Object.keys(data[s]).sort(rowCol).forEach(function(a){
        var k = key(fromBook, s, a), list = targets[k] || [], i = used[k] || 0;
        if(fromBook.sheets[s] && toBook.sheets[s] && i < list.length){ (out[s] = out[s] || {})[list[i]] = data[s][a]; used[k] = i + 1; moved++; }
        else { var at = fromBook.sheets[s] ? B().labelAt(fromBook, s, a) : {label:'', head:''}; lost.push({tab:s, cell:a, label:at.label, head:at.head, value:data[s][a]}); }
      }); });
    return {data:out, moved:moved, lost:lost};
  }

  /* ------------------------------------------------------------------ the copy */
  /* bytes: a production workbook (.xlsx). src: {name, modified, by, how} - where it came from.
     Keeps its layout (when it changed) and its numbers as that year's book, and says what changed. */
  function copyFromBytes(bytes, src){
    src = src || {};
    if(live() && !admin()) return Promise.reject(fail('Only admins keep the production copy.'));
    var book, year, chk, fp, idx, prevData, changes, tplChanged, moved = null, store = S();
    return B().open(bytes).then(function(b){
      book = b; year = B().yearOf(book);
      if(!year) throw fail('Home-Brace could not tell which year this workbook is for (no row like "2026 TC Production Goal").');
      chk = check(book);
      return fingerprint(book);
    }).then(function(f){
      fp = f;
      return Promise.all([store.get(INDEX), store.get(DATA + year)]);
    }).then(function(r){
      idx = (r[0] && r[0].years) ? r[0] : {years:{}};
      prevData = r[1] && r[1].data ? r[1].data : null;
      var was = idx.years[year] && idx.years[year].layout;
      tplChanged = !was || JSON.stringify(was) !== JSON.stringify(fp);
      if(src.layoutOnly && prevData && tplChanged){
        return getTemplate(year).then(B().open).then(function(oldTpl){ moved = remap(oldTpl, prevData, book); })
          .catch(function(e){ if(e.status === 404) moved = remap(book, prevData, book); else throw e; })
          .then(function(){ return B().exportXlsxSmall(B().blank(book), {}, null); }).then(function(tb){ return putTemplate(year, tb); });
      }
      if(src.layoutOnly && prevData) moved = {data:prevData, moved:count(prevData), lost:[]};
      if(!tplChanged) return null;
      return B().exportXlsxSmall(B().blank(book), {}, null).then(function(tb){ return putTemplate(year, tb); });
    }).then(function(tplSaved){
      var data = moved ? moved.data : B().dataOf(book), at = nowISO();
      changes = prevData ? diff(book, prevData, data) : [];
      var changedTabs = [];
      if(tplChanged && idx.years[year] && idx.years[year].layout){ var was = idx.years[year].layout;
        Object.keys(fp).forEach(function(k){ if(was[k] !== fp[k]) changedTabs.push(k); }); }
      var from = {name:src.name || '', modified:src.modified || '', by:src.by || '', how:src.how || 'copy', copiedAt:at, copiedBy:me()};
      var entry = {at:at, from:from, first:!prevData, numbers:count(data),
                   layout: tplChanged ? (prevData || (idx.years[year] && idx.years[year].layout) ? (changedTabs.length ? changedTabs : ['(layout)']) : 'new') : null,
                   changes:changes.slice(0, CHANGES_KEEP), more:Math.max(0, changes.length - CHANGES_KEEP),
                   kept: moved ? {moved:moved.moved, lost:moved.lost.slice(0, 50)} : null,
                   check:{formulas:chk.formulas, differ:chk.differ}};
      var writes = [];
      if(!prevData || changes.length) writes.push(store.set(DATA + year, {year:year, data:data, from:from}));
      if(entry.first || entry.layout || changes.length)
        writes.push(store.update(LOG + year, function(list){ list = Array.isArray(list) ? list : []; list.unshift(entry); return list.slice(0, LOG_KEEP); }));
      writes.push(store.update(INDEX, function(cur){
        cur = (cur && cur.years) ? cur : {years:{}};
        var y = cur.years[year] = cur.years[year] || {};
        y.layout = fp; y.numbers = count(data); y.formulas = chk.formulas; y.tabs = book.names.slice();
        y.lastCopy = from; y.check = {formulas:chk.formulas, differ:chk.differ, sample:chk.sample.map(function(d){ return {tab:d.tab, cell:d.cell, label:d.label, head:d.head, excel:String(d.excel), homeBrace:String(d.homeBrace)}; }), at:at};
        if(tplSaved) y.template = {name:tplSaved.name, webUrl:tplSaved.webUrl || '', savedAt:at};
        if(src.how !== 'upload') cur.source = {modified:src.modified || '', by:src.by || '', year:year, copiedAt:at};
        return cur;
      }));
      return Promise.all(writes).then(function(res){
        var blocked = res.filter(function(x){ return x && (x.blocked || x.error); });
        if(blocked.length) throw fail('Home-Brace refused to save this copy (' + (blocked[0].why || blocked[0].error) + '). Nothing was changed.');
        return {year:year, first:!prevData, changes:changes.length, layout:entry.layout, numbers:entry.numbers, kept:entry.kept,
                check:{formulas:chk.formulas, differ:chk.differ, sample:chk.sample}};
      });
    });
  }

  /* Live: copy Heather's workbook if it was saved since the last copy. Called after the dashboard
     has read it (so it costs nothing when nothing changed) and from Admin. Never on the sandbox. */
  var syncing = null;
  function syncFromWorkbook(opts){
    opts = opts || {};
    if(!live()) return Promise.resolve({skipped:'sandbox'});
    if(!admin()) return Promise.resolve({skipped:'not an admin'});
    if(syncing) return syncing;
    var driveId = opts.driveId || (global.PH && global.PH.WORKBOOK && global.PH.WORKBOOK.drive), itemId = opts.itemId || (global.PH && global.PH.WORKBOOK && global.PH.WORKBOOK.item);
    if(!driveId || !itemId) return Promise.resolve({skipped:'no workbook'});
    syncing = Promise.all([api('GET', '/drives/' + driveId + '/items/' + itemId), S().get(INDEX)]).then(function(r){
      var it = r[0], idx = r[1] || {}, modified = it.lastModifiedDateTime || '';
      var by = (it.lastModifiedBy && it.lastModifiedBy.user && it.lastModifiedBy.user.displayName) || '';
      if(!opts.force && idx.source && idx.source.modified === modified) return {skipped:'unchanged', modified:modified};
      return bytesOf(it['@microsoft.graph.downloadUrl']).then(function(bytes){
        return copyFromBytes(bytes, {name:it.name, modified:modified, by:by, how:'copy'});
      });
    }).then(function(r){ syncing = null; return r; }, function(e){ syncing = null; throw e; });
    return syncing;
  }

  /* ------------------------------------------------------------------ reading a year back */
  function loadYear(y){
    return Promise.all([getTemplate(y), S().get(DATA + y)]).then(function(r){
      return B().open(r[0]).then(function(tpl){
        var data = (r[1] && r[1].data) || {}, book = B().withData(tpl, data);
        return {year:y, template:tpl, data:data, book:book, from:(r[1] && r[1].from) || null};
      });
    });
  }
  /* The Excel, from Home-Brace: the year's own layout with its numbers, formatted exactly as hers. */
  function downloadYear(y){
    return loadYear(y).then(function(Y){
      var ev = B().evaluate(Y.book);
      return B().exportXlsxSmall(Y.book, Y.data, ev).then(function(bytes){
        return {blob:new Blob([bytes], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
                name:y + ' PRODUCTION DASHBOARD (from Home-Brace).xlsx', bytes:bytes};
      });
    });
  }
  function index(){ return S().get(INDEX).then(function(x){ return (x && x.years) ? x : {years:{}}; }); }
  function log(y){ return S().get(LOG + y).then(function(x){ return Array.isArray(x) ? x : []; }); }

  global.PH_PROD = {FOLDER:FOLDER, INDEX:INDEX, DATA:DATA, LOG:LOG, tplName:tplName,
    copyFromBytes:copyFromBytes, syncFromWorkbook:syncFromWorkbook, loadYear:loadYear, downloadYear:downloadYear,
    index:index, log:log, check:check, diff:diff, fingerprint:fingerprint, remap:remap,
    reset:function(){ driveP = null; syncing = null; }};
})(typeof window !== 'undefined' ? window : globalThis);
