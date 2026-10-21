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
  var INDEX = 'ph_prod_index', DATA = 'ph_prod_data_', LOG = 'ph_prod_log_', MODE = 'ph_prod_mode', LINKS = 'ph_prod_links_';
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
        return (changes.length ? followOn(year) : Promise.resolve(null)).then(function(next){
          return {year:year, first:!prevData, changes:changes.length, layout:entry.layout, numbers:entry.numbers, kept:entry.kept,
                  check:{formulas:chk.formulas, differ:chk.differ, sample:chk.sample}, next:next};
        });
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
    syncing = Promise.all([api('GET', '/drives/' + driveId + '/items/' + itemId), S().get(INDEX), mode()]).then(function(r){
      var it = r[0], idx = r[1] || {}, hb = r[2].source === 'homebrace', modified = it.lastModifiedDateTime || '';
      var by = (it.lastModifiedBy && it.lastModifiedBy.user && it.lastModifiedBy.user.displayName) || '';
      // Skip a save already handled the same way: compared (after the switch) or copied (before it, or after switching
      // back - a save that was only compared while Home-Brace held the numbers is copied once it is her Excel again).
      if(!opts.force && idx.source && idx.source.modified === modified && !!idx.source.compared === hb) return {skipped:'unchanged', modified:modified};
      return bytesOf(it['@microsoft.graph.downloadUrl']).then(function(bytes){
        var src = {name:it.name, modified:modified, by:by, how:'copy'};
        return hb ? compareFromBytes(bytes, src) : copyFromBytes(bytes, src);
      });
    }).then(function(r){ syncing = null; return r; }, function(e){ syncing = null; throw e; });
    return syncing;
  }

  /* ------------------------------------------------------------------ reading a year back */
  function loadYear(y){
    return Promise.all([getTemplate(y), S().get(DATA + y)]).then(function(r){
      return B().open(r[0]).then(function(tpl){
        var data = (r[1] && r[1].data) || {}, book = B().withData(tpl, data);
        return {year:y, template:tpl, data:data, book:book, from:(r[1] && r[1].from) || null, rec:r[1] || null};
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

  /* ------------------------------------------------------------------ THE SWITCH
     Where the production numbers live. 'excel' (today): the dashboard and Enter Production use
     Heather's Excel, and Home-Brace keeps a copy. 'homebrace': they use Home-Brace's own books;
     her Excel, while it still exists, is kept up to date too when `mirror` is on, and is only
     COMPARED from then on, never copied over Home-Brace. Only admins change it, and it can be
     changed back. (Cory, 21/10/2026: "build step 4 and the switch"; the switch stays off until
     he says, after the parallel run, before 2027.) */
  function mode(){ return S().get(MODE).then(function(m){ return Object.assign({source:'excel', mirror:true}, m || {}); }); }
  function setMode(next){
    if(!admin()) return Promise.reject(fail('Only admins can switch where the production numbers live.'));
    return S().update(MODE, function(cur){
      var m = Object.assign({source:'excel', mirror:true}, cur || {}, next || {});
      m.changedAt = nowISO(); m.changedBy = me();
      m.history = [{at:m.changedAt, by:m.changedBy, source:m.source, mirror:!!m.mirror}].concat((cur && cur.history) || []).slice(0, 50);
      return m;
    }).then(function(r){ if(r && (r.blocked || r.error)) throw fail('It did not save (' + (r.why || r.error) + ').'); return r && r.value; });
  }
  /* The year being worked on: this calendar year when it is kept, else the latest one kept. */
  function liveYear(idx){
    var ys = Object.keys((idx && idx.years) || {}).map(Number).sort(function(a, b){ return a - b; }), now = new Date().getFullYear();
    if(!ys.length) return null;
    if(ys.indexOf(now) >= 0) return now;
    var past = ys.filter(function(y){ return y < now; });
    return past.length ? past[past.length - 1] : ys[ys.length - 1];
  }

  /* After the switch: is her Excel still the same as Home-Brace? Copied nowhere - just counted. */
  function compareFromBytes(bytes, src){
    var book, year;
    return B().open(bytes).then(function(b){
      book = b; year = B().yearOf(book);
      if(!year) throw fail('Home-Brace could not tell which year her workbook is for.');
      return S().get(DATA + year);
    }).then(function(rec){
      var theirs = B().dataOf(book), ours = (rec && rec.data) || {}, d = diff(book, ours, theirs);
      var cmp = {at:nowISO(), modified:src.modified || '', by:src.by || '', name:src.name || '', year:year, differ:d.length, sample:d.slice(0, 20)};
      return S().update(INDEX, function(cur){
        cur = (cur && cur.years) ? cur : {years:{}};
        cur.compare = cmp;
        // 'source' is her live Excel's last save - a file chosen by hand is not that (as in copyFromBytes).
        if(src.how !== 'upload') cur.source = {modified:src.modified || '', by:src.by || '', year:year, copiedAt:cmp.at, compared:true};
        return cur;
      }).then(function(){ return {compared:true, year:year, differ:d.length, sample:d.slice(0, 20)}; });
    });
  }

  /* ------------------------------------------------------------------ the dashboard from Home-Brace */
  /* The same series the dashboard gets from her Excel (workbook.js office()), worked out from a
     kept year instead - same rows, same sums. */
  function dashboardData(year){
    var WB = global.PH_WB;
    if(!WB) return Promise.reject(fail('The production reader is missing.'));
    return index().then(function(idx){
      var y = year || liveYear(idx);
      if(!y) throw fail('Home-Brace has no production numbers kept yet.');
      return loadYear(y).then(function(Y){
        var ev = B().evaluate(Y.book), out = {}, errors = [];
        Object.keys(WB.TABS).forEach(function(name){
          var tab = WB.TABS[name];
          if(!Y.book.sheets[tab]){ errors.push(name + ': no tab "' + tab + '" in ' + y); return; }
          out[name] = WB.office(B().grid(Y.book, ev, tab), !!WB.MEDICAID[name], y);
        });
        var rec = Y.rec || {}, from = rec.from || {};
        return {year:y, offices:out, errors:errors, savedAt:rec.updatedAt || from.copiedAt || '', savedBy:rec.updatedBy || from.by || '', source:'homebrace'};
      });
    });
  }

  /* ------------------------------------------------------------------ Enter Production into Home-Brace */
  var tplCache = {};
  function templateBook(y){ if(!tplCache[y]) tplCache[y] = getTemplate(y).then(B().open).catch(function(e){ delete tplCache[y]; throw e; }); return tplCache[y]; }
  /* The cell a field and month land in - found the way Enter Production finds it in her Excel
     (workbook.js writeRows: the row by its label, first match; the month's column, January = B). */
  function cellFor(tpl, officeName, field, monthIndex, year){
    var WB = global.PH_WB, tab = WB.TABS[officeName];
    if(!tab || !tpl.sheets[tab]) throw fail('Unknown office: ' + officeName);
    var pats = WB.writeRows(year)[field];
    if(!pats) throw fail('"' + field + '" is not a field that can be saved.');
    if(!(monthIndex >= 0 && monthIndex < 12)) throw fail('Bad month.');
    var rows = B().grid(tpl, {value:function(){ return ''; }}, tab), idx = -1;
    var minR = Object.keys(tpl.sheets[tab].cells).reduce(function(m, a){ var r = +/\d+$/.exec(a)[0]; return r < m ? r : m; }, Infinity);
    for(var i = 0; i < pats.length && idx < 0; i++) idx = WB.row(rows, pats[i].all, pats[i].not);
    if(idx < 0) throw fail('Could not find the row for "' + field + '" on ' + tab + '.');
    return {tab:tab, cell:B().colName(2 + monthIndex) + (minR + idx), label:rows[idx][0]};
  }
  /* values: {field: number, or '' to clear}. Saves into the year's numbers, one change at a time
     on top of whatever is there (the shared store merges), and writes each change to the history. */
  function setValues(year, officeName, monthIndex, values){
    var changes = [], targets;
    return templateBook(year).then(function(tpl){
      targets = Object.keys(values || {}).map(function(f){
        var at = cellFor(tpl, officeName, f, monthIndex, year), v = values[f];
        var n = (v === '' || v == null) ? null : Number(v);
        if(n !== null && !isFinite(n)) throw fail('That is not a number.');
        var where = B().labelAt(tpl, at.tab, at.cell);
        return {field:f, tab:at.tab, cell:at.cell, label:where.label, head:where.head, value:n};
      });
      return S().update(DATA + year, function(rec){
        rec = (rec && rec.data) ? rec : {year:year, data:{}};
        changes = [];
        targets.forEach(function(t){
          var d = rec.data[t.tab] = rec.data[t.tab] || {}, was = d[t.cell] == null ? null : d[t.cell];
          if(was === t.value) return;
          if(t.value === null) delete d[t.cell]; else d[t.cell] = t.value;
          changes.push({tab:t.tab, cell:t.cell, label:t.label, head:t.head, from:was, to:t.value, field:t.field});
        });
        if(!changes.length) return undefined;
        rec.updatedAt = nowISO(); rec.updatedBy = me();
        return rec;
      });
    }).then(function(r){
      if(r && (r.blocked || r.error)) throw fail('Home-Brace could not save (' + (r.why || r.error) + ').');
      if(!changes.length) return null;
      return S().update(LOG + year, function(list){
        list = Array.isArray(list) ? list : [];
        list.unshift({at:nowISO(), from:{how:'enter', by:me(), copiedBy:me(), office:officeName}, changes:changes});
        return list.slice(0, LOG_KEEP);
      }).then(function(){ return followOn(year); });
    }).then(function(next){ return {saved:targets.map(function(t){ return {field:t.field, address:t.tab + '!' + t.cell, label:t.label}; }), changes:changes, next:next || null}; });
  }

  /* ------------------------------------------------------------------ GOALS & FORMULAS, IN HOME-BRACE
     Cory, 21/10/2026: "I want homebrace to be able to configure the formulas for future years" -
     "Home-Brace to manage the numbers, calculations, etc with just the option to download in excel".
     A year's goal rows, office by office, in her own terms: each month is "last year x 1.04" (her
     multiplier, edited as a number), an amount typed in, or - left alone, shown as it is - any other
     formula of hers. Saving changes that YEAR's template and numbers only; every change is in the
     history. The Excel download carries the new formulas. */
  function goalRowsOf(tpl, officeName, year){
    var WB = global.PH_WB, tab = WB.TABS[officeName];
    if(!tab || !tpl.sheets[tab]) throw fail('Unknown office: ' + officeName);
    var Y = String(year), L = String(year - 1), med = !!WB.MEDICAID[officeName];
    var rows = B().grid(tpl, {value:function(){ return ''; }}, tab);
    var minR = Object.keys(tpl.sheets[tab].cells).reduce(function(m, a){ var r = +/\d+$/.exec(a)[0]; return r < m ? r : m; }, Infinity);
    var at = function(all, not){ var i = WB.row(rows, all, not); return i < 0 ? null : {row:minR + i, label:rows[i][0]}; };
    return {tab:tab, med:med, rows:{
      tc:      at([Y, 'tc production goal']),
      md:      med ? at([Y, 'medicaid production goal']) : null,
      total:   med ? at([Y, 'total production goal']) : null,
      stretch: at([Y, 'stretch production goal']),
      days:    at(['number of production days', '(' + Y + ')']),
      lyNet:   at([L, 'net production']),
      lyMed:   med ? at([L, 'medicaid production']) : null
    }};
  }
  var GROLE = {tc:'TC goal', md:'Medicaid goal', total:'goal', stretch:'stretch goal', lyNet:'last year', lyMed:'last year’s Medicaid'};
  /* One month's rule, read the way she wrote it. */
  function ruleOf(cell, dataVal, G){
    if(dataVal != null) return {kind:'amount', value:dataVal};
    if(!cell || cell.f == null) return {kind:'empty'};
    var f = String(cell.f).replace(/\s+/g, ''), m, roleOf = function(r){ var k = Object.keys(G.rows).filter(function(x){ return G.rows[x] && G.rows[x].row === r; })[0]; return k || null; };
    if((m = /^\(?\$?[A-Z]{1,3}\$?(\d+)\)?(?:\*(\d+(?:\.\d+)?))?$/.exec(f))){ var role = roleOf(+m[1]); if(role) return {kind:'times', base:role, baseRow:+m[1], mult:m[2] ? +m[2] : 1, f:cell.f}; }
    if((m = /^\(\$?[A-Z]{1,3}\$?(\d+)\+\$?[A-Z]{1,3}\$?(\d+)\)\*(\d+(?:\.\d+)?)$/.exec(f))){ var a = roleOf(+m[1]), b = roleOf(+m[2]); if(a && b) return {kind:'times', base:a + '+' + b, baseRows:[+m[1], +m[2]], mult:+m[3], f:cell.f}; }
    if((m = /^\$?[A-Z]{1,3}\$?(\d+)\+\$?[A-Z]{1,3}\$?(\d+)$/.exec(f))){ var c = roleOf(+m[1]), d = roleOf(+m[2]); if(c && d) return {kind:'sum', base:c + '+' + d, f:cell.f}; }
    return {kind:'formula', f:cell.f};
  }
  var MONTHS12 = 'BCDEFGHIJKLM'.split('');
  function goalModel(year, officeName){
    return Promise.all([templateBook(year), S().get(DATA + year)]).then(function(r){
      var tpl = r[0], data = (r[1] && r[1].data) || {}, G = goalRowsOf(tpl, officeName, year), d = data[G.tab] || {};
      var book = B().withData(tpl, data), ev = B().evaluate(book), out = [];
      ['tc', 'md', 'total', 'stretch', 'days'].forEach(function(k){
        var R = G.rows[k]; if(!R) return;
        out.push({key:k, label:R.label, row:R.row, cells:MONTHS12.map(function(col, i){
          var a = col + R.row, c = tpl.sheets[G.tab].cells[a];
          var rule = k === 'days' ? {kind:'amount', value:d[a] != null ? d[a] : null} : ruleOf(c, d[a], G);
          var v = ev.value(G.tab, a);
          return {m:i, cell:a, rule:rule, value:typeof v === 'number' ? v : null};
        })});
      });
      return {year:year, office:officeName, tab:G.tab, med:G.med, rows:out, roles:GROLE};
    });
  }
  /* changes: [{cell, set:'times', mult} | {cell, set:'amount', value} | {cell, set:'formula'}  (back to the template's formula)].
     Shown first with preview:true (nothing saved) - the goals they give - then saved. */
  function saveGoals(year, officeName, changes, opts){
    opts = opts || {};
    if(!opts.preview && live() && !admin()) return Promise.reject(fail('Only admins can change goals and formulas.'));
    return Promise.all([templateBook(year), S().get(DATA + year)]).then(function(r){
      var tpl = r[0], rec = r[1] || {year:year, data:{}}, data = JSON.parse(JSON.stringify(rec.data || {})), G = goalRowsOf(tpl, officeName, year);
      var cs = tpl.sheets[G.tab].cells, d = data[G.tab] = data[G.tab] || {}, nt = JSON.parse(JSON.stringify(tpl.sheets[G.tab].cells)), log = [];
      var rowName = function(a){ var rr = +/\d+$/.exec(a)[0]; var k = Object.keys(G.rows).filter(function(x){ return G.rows[x] && G.rows[x].row === rr; })[0]; return k ? (k === 'days' ? 'production days' : GROLE[k]) : a; };
      var said = function(rule){ return rule.kind === 'times' ? (GROLE[rule.base] || rule.base.split('+').map(function(x){ return GROLE[x]; }).join(' + ')) + ' × ' + rule.mult : rule.kind === 'amount' ? '$' + Number(rule.value).toLocaleString('en-US') : rule.kind === 'empty' ? 'empty' : '=' + rule.f; };
      (changes || []).forEach(function(ch){
        var a = ch.cell, col = /^[A-Z]+/.exec(a)[0], i = MONTHS12.indexOf(col); if(i < 0) throw fail('Not a month: ' + a);
        var before = ruleOf(cs[a], d[a], G), isDays = G.rows.days && +/\d+$/.exec(a)[0] === G.rows.days.row;
        if(isDays || ch.set === 'amount'){
          var v = ch.value === '' || ch.value == null ? null : Number(ch.value);
          if(v !== null && !isFinite(v)) throw fail('That is not a number.');
          if(v === null) delete d[a]; else d[a] = v;
          log.push({tab:G.tab, cell:a, label:rowName(a), head:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i], from:said(before), to:v === null ? (cs[a] && cs[a].f != null ? 'back to =' + cs[a].f : 'empty') : '$' + v.toLocaleString('en-US')});
          return;
        }
        if(ch.set === 'formula'){ delete d[a]; log.push({tab:G.tab, cell:a, label:rowName(a), head:MONTHS12[i], from:said(before), to:'=' + (cs[a] && cs[a].f)}); return; }
        if(ch.set === 'times'){
          var m = Number(ch.mult); if(!(m > 0 && m < 100)) throw fail('A multiplier like 1.05, please.');
          var base = before.kind === 'times' ? before : null;
          if(!base){                                   // an amount or empty month: take the row's usual base
            var others = MONTHS12.map(function(c){ return ruleOf(cs[c + /\d+$/.exec(a)[0]], null, G); }).filter(function(x){ return x.kind === 'times'; });
            base = others[0] || (function(){ var rr = +/\d+$/.exec(a)[0], k = rr === (G.rows.md && G.rows.md.row) ? 'lyMed' : 'lyNet'; return G.rows[k] ? {base:k, baseRow:G.rows[k].row} : null; })();
            if(!base) throw fail('Home-Brace can’t tell what this month should multiply.');
          }
          var f = base.baseRows ? '(' + col + base.baseRows[0] + '+' + col + base.baseRows[1] + ')*' + m : col + base.baseRow + (m === 1 ? '' : '*' + m);
          try{ B().parse(f); }catch(_){ throw fail('That formula could not be read: ' + f); }
          nt[a] = Object.assign({}, nt[a] || {v:'', t:'n', s:null}, {f:f}); delete d[a];
          log.push({tab:G.tab, cell:a, label:rowName(a), head:MONTHS12[i], from:said(before), to:said({kind:'times', base:base.base, mult:m})});
        }
      });
      log.forEach(function(x){ var i = MONTHS12.indexOf(/^[A-Z]+/.exec(x.cell)[0]); x.head = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]; });
      var t2 = {names:tpl.names, sheets:Object.assign({}, tpl.sheets), files:tpl.files, sst:tpl.sst}; t2.sheets[G.tab] = {path:tpl.sheets[G.tab].path, cells:nt};
      var book = B().withData(t2, data), ev = B().evaluate(book);
      var bad = log.filter(function(x){ var v = ev.value(G.tab, x.cell); return B().isErr(v); });
      if(bad.length) throw fail('That would give an error in ' + bad.map(function(x){ return x.label + ' ' + x.head; }).join(', ') + '. Nothing was saved.');
      if(opts.preview){                                     // every goal figure, so the totals and stretch follow along
        var vals = [];
        ['tc', 'md', 'total', 'stretch'].forEach(function(k){ var R = G.rows[k]; if(R) MONTHS12.forEach(function(c){ var v = ev.value(G.tab, c + R.row); vals.push({cell:c + R.row, value:typeof v === 'number' ? v : null}); }); });
        return {preview:true, changes:log, values:vals};
      }
      var tplChanged = log.some(function(x){ return /×/.test(x.to) || /^=|^back to/.test(x.to); }) && JSON.stringify(nt) !== JSON.stringify(tpl.sheets[G.tab].cells);
      var at = nowISO(), jobs = [];
      var saveTpl = tplChanged ? B().exportXlsxSmall(B().blank(t2), {}, null).then(function(bytes){ return putTemplate(year, bytes).then(function(sv){ delete tplCache[year]; return fingerprint(t2).then(function(fp){ return {sv:sv, fp:fp}; }); }); }) : Promise.resolve(null);
      return saveTpl.then(function(t){
        rec.data = data; rec.updatedAt = at; rec.updatedBy = me();
        jobs.push(S().set(DATA + year, rec));
        jobs.push(S().update(LOG + year, function(list){ return [{at:at, from:{how:'goals', by:me(), copiedBy:me(), office:officeName}, changes:log}].concat(Array.isArray(list) ? list : []).slice(0, LOG_KEEP); }));
        if(t) jobs.push(S().update(INDEX, function(cur){ cur = (cur && cur.years) ? cur : {years:{}}; var y = cur.years[year] = cur.years[year] || {}; y.layout = t.fp; y.template = {name:t.sv.name, webUrl:t.sv.webUrl || '', savedAt:at}; return cur; }));
        return Promise.all(jobs);
      }).then(function(res){
        var b2 = res.filter(function(x){ return x && (x.blocked || x.error); });
        if(b2.length) throw fail('Home-Brace could not save (' + (b2[0].why || b2[0].error) + ').');
        return {saved:true, changes:log};
      });
    });
  }

  /* ------------------------------------------------------------------ FORMULAS: EVERY CALCULATION, IN HOME-BRACE
     Cory, 21/10/2026: "build the formula screen remember clear and easy ux so she can and others can
     manage this". Any row's formula, for the months chosen, in plain words (prodfx.js) - shown first
     with what it gives and what else moves, then saved into that YEAR's layout only. Every change is
     in the year's History with what it was, and can be undone from there. Admins only. */
  function fxCtx(year){
    return Promise.all([templateBook(year), S().get(DATA + year)]).then(function(r){
      var rec = r[1] || {year:year, data:{}};
      return {tpl:r[0], rec:rec, data:rec.data || {}};
    });
  }
  function fxTabs(tpl){ return tpl.names.filter(function(s){ var cs = tpl.sheets[s].cells; return Object.keys(cs).some(function(a){ return cs[a].f != null; }); }); }
  function formulaModel(year, tab){
    var FX = global.PH_FX; if(!FX) return Promise.reject(fail('The formula reader is missing.'));
    return fxCtx(year).then(function(x){
      var ctx = {tpl:x.tpl, data:x.data}, ev = B().evaluate(B().withData(x.tpl, x.data)), tabs = fxTabs(x.tpl);
      if(!tab || tabs.indexOf(tab) < 0) tab = tabs[0];
      return {year:+year, tab:tab, tabs:tabs, rows:tab ? FX.rowsOf(ctx, ev, tab) : [], picks:FX.picks(ctx)};
    });
  }
  /* Black-out fill on a box getting a formula: take the look of the row's nearest box that isn't. */
  function litStyle(tpl, cs, row, c){
    var black = B().blackStyles(tpl), cur = cs[B().colName(c) + row], s = cur ? cur.s : null;
    if(s == null || !black[s]) return s;
    for(var k = 1; k < 14; k++){ var L = cs[B().colName(c - k) + row], R = cs[B().colName(c + k) + row];
      if(c - k >= 2 && L && L.s != null && !black[L.s]) return L.s; if(R && R.s != null && !black[R.s]) return R.s; }
    return s;
  }
  /* edits: [{cell, f, d}] - what each box becomes: f = its formula (Excel; null = none), d = a number
     typed over it (null = none); either left out = stays as it is. A typed number sits over her
     formula, as in Excel, so emptying it brings the formula back. -> preview (what each box gives,
     what else moves) or saved. Each change keeps the box's exact before and after, for Undo. */
  function fxApply(year, x, tab, edits, opts, from){
    var FX = global.PH_FX, tpl = x.tpl, cs = tpl.sheets[tab].cells, nt = Object.assign({}, cs);
    var data = JSON.parse(JSON.stringify(x.data)), d = data[tab] = data[tab] || {}, changes = [];
    var ctx0 = {tpl:tpl, data:x.data}, eff = function(f, v){ return v != null ? v : f != null ? '=' + f : null; };
    edits.forEach(function(e){
      var cur = cs[e.cell], f0 = cur && cur.f != null ? cur.f : null, d0 = x.data[tab] && x.data[tab][e.cell] != null ? x.data[tab][e.cell] : null;
      var f1 = e.f === undefined ? f0 : e.f, d1 = e.d === undefined ? d0 : e.d;
      if(f1 === f0 && d1 === d0) return;
      var p = /^([A-Z]+)(\d+)$/.exec(e.cell), row = +p[2], c = B().colNum(p[1]);
      if(f1 !== f0) nt[e.cell] = Object.assign({}, cur || {t:'n'}, {f:f1, v:''}, f1 != null ? {s:litStyle(tpl, cs, row, c)} : {});
      if(d1 == null) delete d[e.cell]; else d[e.cell] = d1;
      changes.push({tab:tab, cell:e.cell, row:row, label:FX.rowName(tpl, tab, row), head:FX.colName(ctx0, tab, c, row), from:eff(f0, d0), to:eff(f1, d1),
                    fromF:f0, fromD:d0, toF:f1, toD:d1, fromN:f0 != null && d0 == null ? safeNamed(ctx0, tab, e.cell, f0) : null});
    });
    var t2 = {names:tpl.names, sheets:Object.assign({}, tpl.sheets), files:tpl.files, sst:tpl.sst};
    t2.sheets[tab] = {path:tpl.sheets[tab].path, cells:nt};
    var ctx1 = {tpl:t2, data:data};
    changes.forEach(function(ch){ if(ch.toF != null && ch.toD == null) ch.toN = safeNamed(ctx1, tab, ch.cell, ch.toF); });
    changes.forEach(function(ch){ if(ch.toF != null && ch.toF !== ch.fromF && FX.loops(t2, tab, ch.cell))
      throw fail('That would work “' + ch.label + '” out from its own result (it goes round in a circle). Use a different row.'); });
    var ev0 = B().evaluate(B().withData(tpl, x.data)), ev1 = B().evaluate(B().withData(t2, data));
    var same = function(a, b){ return a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a))); };
    var boxes = changes.map(function(ch){ var v0 = ev0.value(tab, ch.cell), v1 = ev1.value(tab, ch.cell);
      return {cell:ch.cell, head:ch.head, before:v0, after:v1, err:B().isErr(v1) && !B().isErr(v0) ? v1 : (B().isErr(v1) ? v1 : '')}; });
    var mine = {}; changes.forEach(function(ch){ mine[tab + '!' + ch.cell] = 1; });
    var also = {}, ctxA = {tpl:t2, data:data};
    Object.keys(ev1.all).forEach(function(k){
      if(mine[k] || same(ev0.all[k], ev1.all[k])) return;
      var i = k.lastIndexOf('!'), T = k.slice(0, i), r = +/\d+$/.exec(k.slice(i + 1))[0], key = T + '|' + r;
      (also[key] = also[key] || {tab:T, row:r, name:FX.rowName(t2, T, r), n:0}).n++;
    });
    also = Object.keys(also).map(function(k){ return also[k]; });
    var bad = boxes.filter(function(b){ return b.err && b.err !== '#DIV/0!'; });
    var sample = boxes.filter(function(b){ return !b.err; })[0] || boxes[0];
    var show = sample ? changes.filter(function(ch){ return ch.cell === sample.cell; })[0] : null;
    var out = {year:+year, tab:tab, changes:changes, boxes:boxes, also:also, ev:ev1,
               explain:show && typeof show.to === 'string' ? {head:sample.head, text:FX.explain(ctxA, ev1, tab, show.cell, show.to.slice(1)), value:sample.after, excel:show.to} : null};
    if(opts.preview) return Promise.resolve(Object.assign(out, {preview:true, blocked:bad.length ? bad : null}));
    if(!changes.length) return Promise.resolve(Object.assign(out, {saved:false}));
    if(bad.length) return Promise.reject(fail('That gives ' + bad[0].err + ' in ' + bad.map(function(b){ return b.head; }).join(', ') + ' - check the rows it uses. Nothing was saved.'));
    var at = nowISO(), tplChanged = changes.some(function(ch){ return ch.toF !== ch.fromF; }), dataChanged = changes.some(function(ch){ return ch.toD !== ch.fromD; });
    // the layout is saved again only when a formula changed; numbers alone are just numbers
    var saveTpl = tplChanged ? B().exportXlsxSmall(B().blank(t2), {}, null).then(function(bytes){ return putTemplate(year, bytes); }).then(function(sv){
      delete tplCache[year]; return fingerprint(t2).then(function(fp){ return {sv:sv, fp:fp}; }); }) : Promise.resolve(null);
    return saveTpl.then(function(t){
      var jobs = [S().update(LOG + year, function(list){ return [{at:at, from:Object.assign({by:me(), copiedBy:me(), tab:tab}, from), changes:changes}].concat(Array.isArray(list) ? list : []).slice(0, LOG_KEEP); })];
      if(t) jobs.push(S().update(INDEX, function(cur){ cur = (cur && cur.years) ? cur : {years:{}}; var y = cur.years[year] = cur.years[year] || {};
        y.layout = t.fp; y.formulas = t2.names.reduce(function(n, s){ return n + Object.keys(t2.sheets[s].cells).filter(function(a){ return t2.sheets[s].cells[a].f != null; }).length; }, 0);
        y.template = {name:t.sv.name, webUrl:t.sv.webUrl || '', savedAt:at}; return cur; }));
      // only the boxes whose typed number changed - nobody else's numbers are touched
      if(dataChanged) jobs.push(S().update(DATA + year, function(rec){
        rec = (rec && rec.data) ? rec : {year:+year, data:{}}; var dd = rec.data[tab] = rec.data[tab] || {};
        changes.forEach(function(ch){ if(ch.toD === ch.fromD) return; if(ch.toD == null) delete dd[ch.cell]; else dd[ch.cell] = ch.toD; });
        rec.updatedAt = at; rec.updatedBy = me(); return rec; }));
      return Promise.all(jobs);
    }).then(function(res){
      var b2 = res.filter(function(r){ return r && (r.blocked || r.error); });
      if(b2.length) throw fail('Home-Brace could not save (' + (b2[0].why || b2[0].error) + ').');
      return followOn(+year).then(function(next){ return Object.assign(out, {saved:true, at:at, next:next}); });
    });
  }
  function safeNamed(ctx, tab, a, f){ try{ return global.PH_FX.toNamed(ctx, tab, a, f); }catch(_){ return '{=' + f + '}'; } }
  /* One row's formula, in plain words, for the boxes (columns) chosen. */
  function formulaChange(year, tab, row, colsList, text, opts){
    opts = opts || {};
    var FX = global.PH_FX; if(!FX) return Promise.reject(fail('The formula reader is missing.'));
    if(!opts.preview && live() && !admin()) return Promise.reject(fail('Only admins can change formulas.'));
    return fxCtx(year).then(function(x){
      if(!x.tpl.sheets[tab]) throw fail('There’s no tab called ' + tab + ' in ' + year + '.');
      if(!colsList || !colsList.length) throw fail('Pick at least one month.');
      var ctx = {tpl:x.tpl, data:x.data}, cs = x.tpl.sheets[tab].cells;
      var edits = colsList.map(function(c){
        var a = B().colName(+c) + row, cur = cs[a];
        if(cur && cur.f == null && typeof cur.v === 'string' && cur.v.trim()) throw fail('That box holds text in her sheet, not a number.');
        return {cell:a, f:FX.fromNamed(ctx, tab, a, text), d:null};
      });
      return fxApply(year, x, tab, edits, opts, {how:'formulas'});
    });
  }
  /* Back to what a change replaced - if nothing has changed those boxes since. */
  function formulaUndo(year, at){
    if(live() && !admin()) return Promise.reject(fail('Only admins can change formulas.'));
    return Promise.all([fxCtx(year), log(year)]).then(function(r){
      var x = r[0], e = r[1].filter(function(z){ return z.at === at && z.from && (z.from.how === 'formulas' || z.from.how === 'plan'); })[0];
      if(!e) throw fail('That change isn’t in the history any more.');
      var tab = e.from.tab || (e.changes[0] && e.changes[0].tab), cs = x.tpl.sheets[tab] ? x.tpl.sheets[tab].cells : null;
      if(!cs) throw fail('There’s no tab called ' + tab + ' in ' + year + ' any more.');
      var edits = e.changes.map(function(ch){
        var cur = cs[ch.cell], dv = x.data[tab] && x.data[tab][ch.cell] != null ? x.data[tab][ch.cell] : null;
        var now = dv != null ? dv : cur && cur.f != null ? '=' + cur.f : null;
        if(now !== ch.to) throw fail('“' + ch.label + '” ' + ch.head + ' was changed again after that - undo the later change first.');
        if(ch.fromF !== undefined) return {cell:ch.cell, f:ch.fromF, d:ch.fromD};
        return typeof ch.from === 'string' && ch.from.charAt(0) === '=' ? {cell:ch.cell, f:ch.from.slice(1), d:null} : {cell:ch.cell, f:null, d:typeof ch.from === 'number' ? ch.from : null};
      });
      return fxApply(year, x, tab, edits, {}, {how:e.from.how, office:e.from.office, undo:at});
    });
  }

  /* ------------------------------------------------------------------ PLAN A YEAR, OFFICE BY OFFICE
     Cory, 21/10/2026: "Yes build the Plan 2027 screen" ... "This all needs to come together and make
     sense and be easy for her year after year to continue". The year's goals asked as Heather thinks
     of them - grow over last year by 4%, stretch 10% above the goal, the production days, the case
     fee - and written as her own kind of formulas (last year x 1.04, goal x 1.1), so the Excel
     download still reads like hers. A month can differ (Lubbock's November x 1.75) or be a dollar
     goal typed in. Saved into that year only; History, with Undo. */
  function rowAt(tpl, tab, pats){
    var WB = global.PH_WB, rows = B().grid(tpl, {value:function(){ return ''; }}, tab);
    var minR = Object.keys(tpl.sheets[tab].cells).reduce(function(m, a){ var r = +/\d+$/.exec(a)[0]; return r < m ? r : m; }, Infinity);
    var i = WB.row(rows, pats); return i < 0 ? null : minR + i;
  }
  function planModel(year, officeName){
    if(!global.PH_FX) return Promise.reject(fail('The formula reader is missing.'));
    return fxCtx(year).then(function(x){
      var tpl = x.tpl, G = goalRowsOf(tpl, officeName, year), R = G.rows, d = x.data[G.tab] || {}, cs = tpl.sheets[G.tab].cells;
      var ev = B().evaluate(B().withData(tpl, x.data)), val = function(a){ var v = ev.value(G.tab, a); return typeof v === 'number' ? v : null; };
      var row = function(k){ var r = R[k]; if(!r) return null;
        return {row:r.row, label:r.label, months:MONTHS12.map(function(col){ var a = col + r.row;
          return {cell:a, rule:k === 'days' ? {kind:'amount', value:d[a] != null ? d[a] : null} : ruleOf(cs[a], d[a], G), value:val(a)}; })}; };
      var series = function(r){ return r ? MONTHS12.map(function(col){ return val(col + r); }) : null; };
      var lyDaysRow = rowAt(tpl, G.tab, ['number of production days', '(' + (year - 1) + ')']);
      var box = function(field){ try{ var c = cellFor(tpl, officeName, field, 0, year).cell; return {cell:c, value:d[c] != null ? d[c] : val(c)}; }catch(_){ return null; } };
      var offices = Object.keys(global.PH_WB.TABS).filter(function(o){ return tpl.sheets[global.PH_WB.TABS[o]]; });
      return log(year).then(function(L){
        var planned = {};
        L.forEach(function(e){ var f = e.from || {}; if(f.how === 'plan' && !f.undo && f.office && !planned[f.office]) planned[f.office] = {at:e.at, by:f.by || ''}; });
        return {year:+year, office:officeName, tab:G.tab, med:G.med, offices:offices, planned:planned,
                rows:{tc:row('tc'), md:row('md'), total:row('total'), stretch:row('stretch'), days:row('days')},
                ly:series(R.lyNet && R.lyNet.row), lyMed:series(R.lyMed && R.lyMed.row), lyDays:series(lyDaysRow),
                fee:box('afee'), mdFee:G.med ? box('fee') : null};
      });
    });
  }
  /* An office's year as the plan screen shows it: the usual growth (the % most months share), the
     months that differ (their own %, or a dollar goal typed in), and - said in words - months worked
     out some other way, which take the usual % once one is set. No usual % (no two months agree):
     nothing changes until one is typed. */
  var GWORD = {tc:'the TC goal', md:'the Medicaid goal', total:'the goal', 'tc+md':'the goal', stretch:'the stretch', lyNet:'last year', lyMed:'last year’s Medicaid', 'lyNet+lyMed':'last year'};
  function planLine(model, key, base){
    var r = model.rows[key]; if(!r) return null;
    // (TC goal + Medicaid goal) x 1.14 is the goal x 1.14 - Clovis writes its stretch that way
    var med = model.med, bases = key === 'tc' ? ['lyNet'] : key === 'md' ? ['lyMed'] : base === 'last' ? (med ? ['lyNet+lyMed'] : ['lyNet']) : (med ? ['total', 'tc+md'] : ['tc']);
    var months = r.months.map(function(x){ var q = x.rule;
      if(q.kind === 'times' && bases.indexOf(q.base) >= 0) return {pct:Math.round((q.mult - 1) * 1e6) / 1e4};
      if(q.kind === 'amount' && q.value != null) return {amount:q.value};
      return {note:q.kind === 'empty' ? 'no goal yet' : q.kind === 'times' ? Math.round(q.mult * 100) + '% of ' + (GWORD[q.base] || 'another row') : q.kind === 'sum' ? 'a total of two rows' : 'another formula'};
    });
    var count = {}, main = null, best = 0;
    months.forEach(function(x){ if(x.pct != null) count[x.pct] = (count[x.pct] || 0) + 1; });
    Object.keys(count).forEach(function(k){ if(count[k] > best){ best = count[k]; main = +k; } });
    if(best < 2 && months.filter(function(x){ return x.pct != null; }).length !== 1) main = null;
    // `was`: what the month is now, so a month nobody changed is left exactly as she wrote it
    return {main:main, months:months.map(function(x){ return {own:x.pct != null && x.pct !== main ? x.pct : null, amount:x.amount != null ? x.amount : null, note:x.note || null,
      was:x.pct != null ? x.pct : null, wasAmount:x.amount != null ? x.amount : null}; })};
  }
  function planDraft(model){
    var R = model.rows, goalBase = model.med ? 'total' : 'tc', g = 0, l = 0;
    (R.stretch ? R.stretch.months : []).forEach(function(x){ var q = x.rule; if(q.kind !== 'times') return; if(q.base === goalBase || q.base === 'tc+md') g++; else if(q.base === 'lyNet' || q.base === 'lyNet+lyMed') l++; });
    var stBase = l > g ? 'last' : 'goal';
    return {tc:planLine(model, 'tc'), md:model.med ? planLine(model, 'md') : null, st:planLine(model, 'stretch', stBase), stBase:stBase,
            days:R.days ? R.days.months.map(function(x){ return x.rule.value; }) : null,
            fee:model.fee ? model.fee.value : null, mdFee:model.mdFee ? model.mdFee.value : null};
  }
  /* The draft back into a plan for planSave: a month keeps its own % or dollar goal, the rest take the
     usual % - or, with no usual % yet, stay as they are. */
  function planPayload(draft){
    var conv = function(L){ return L ? L.months.map(function(x){
      if(x.amount != null) return x.amount === x.wasAmount ? null : {amount:x.amount};
      var p = x.own != null ? x.own : L.main;
      return p == null || (p === x.was && x.wasAmount == null) ? null : {pct:p};
    }) : null; };
    return {tc:conv(draft.tc), md:conv(draft.md), stretch:conv(draft.st), stretchBase:draft.stBase, days:draft.days, fee:draft.fee, mdFee:draft.mdFee};
  }
  /* plan: {tc:[12], md:[12], stretch:[12], stretchBase:'goal'|'last', days:[12], fee, mdFee}; a month is
     {pct} (last year, or the goal, plus that %), {amount} (a dollar goal typed in) or null (left as it is). */
  function planSave(year, officeName, plan, opts){
    opts = opts || {};
    if(!opts.preview && live() && !admin()) return Promise.reject(fail('Only admins can change the plan.'));
    return fxCtx(year).then(function(x){
      var tpl = x.tpl, G = goalRowsOf(tpl, officeName, year), R = G.rows, edits = [];
      if(!R.tc || !R.lyNet) throw fail('Home-Brace can’t find ' + officeName + '’s goal rows for ' + year + '.');
      var num = function(v, what){ var n = Number(v); if(!isFinite(n)) throw fail(what + ' isn’t a number.'); return n; };
      var times = function(base, pct){ var p = num(pct, 'A growth %'); if(p <= -100 || p > 1000) throw fail('A growth of ' + p + '% doesn’t look right.');
        var m = String(+(1 + p / 100).toFixed(6)); return base + (m === '1' ? '' : '*' + m); };
      var ly = function(col){ return col + R.lyNet.row; };
      var lyAll = function(col){ return R.lyMed ? '(' + col + R.lyNet.row + '+' + col + R.lyMed.row + ')' : col + R.lyNet.row; };
      var goal = function(col){ return col + (G.med && R.total ? R.total.row : R.tc.row); };
      var months = function(r, list, base){
        if(!r || !list) return;
        list.forEach(function(m, i){ if(!m) return; var col = MONTHS12[i], a = col + r.row;
          if(m.amount != null) edits.push({cell:a, d:num(m.amount, 'A dollar goal')});          // her formula stays underneath
          else if(m.pct != null) edits.push({cell:a, f:times(base(col), m.pct), d:null}); });
      };
      months(R.tc, plan.tc, ly);
      if(G.med && R.md && R.lyMed) months(R.md, plan.md, function(col){ return col + R.lyMed.row; });
      months(R.stretch, plan.stretch, plan.stretchBase === 'last' ? lyAll : goal);
      // the total goal is always TC + Medicaid
      if(G.med && R.total && R.md) MONTHS12.forEach(function(col){ edits.push({cell:col + R.total.row, f:col + R.tc.row + '+' + col + R.md.row, d:null}); });
      if(R.days && plan.days) plan.days.forEach(function(v, i){ if(v === undefined) return; edits.push({cell:MONTHS12[i] + R.days.row, d:v === '' || v == null ? null : num(v, 'Production days')}); });
      var put = function(field, v){ if(v === undefined) return; var c = cellFor(tpl, officeName, field, 0, year).cell; edits.push({cell:c, d:v === '' || v == null ? null : num(v, 'A case fee')}); };
      put('afee', plan.fee); if(G.med) put('fee', plan.mdFee);
      return fxApply(year, x, G.tab, edits, opts, {how:'plan', office:officeName}).then(function(out){
        var ev = out.ev, v = function(r, col){ if(!r) return null; var z = ev.value(G.tab, col + r.row); return typeof z === 'number' ? z : null; };
        out.months = MONTHS12.map(function(col){ return {goal:v(G.med && R.total ? R.total : R.tc, col), stretch:v(R.stretch, col), tc:v(R.tc, col), md:v(R.md, col)}; });
        delete out.ev; return out;
      });
    });
  }

  /* ------------------------------------------------------------------ STEP 4: START NEXT YEAR
     The new year's book from this year's, done the way Heather does it each January - but shown
     row by row before anything is saved:
       - every year in the labels moves on one (shiftYears); the formulas stay exactly as they
         are, so next year's goals start as "this year x her growth numbers" until she changes them;
       - last year's and the year before's rows are copied from the row with the same name;
       - "<year> Net Production" comes from the TC Net Production typed each month, and "<year>
         Medicaid Production" from the Actual Medicaid Production (starts x fee) - from her own
         file: her sheet calls the with-write-offs figure "Adjusted", and every 2025 Medicaid month
         is an exact multiple of the $4,200 fee;
       - a one-figure "<year> Average Case Fee" gets the average of the year's monthly fees (to check);
       - this year's monthly inputs, totals and the new year's own rows start empty;
       - single settings with no year (the Medicaid case fee) carry on;
       - anything it cannot place is flagged, never guessed silently. */
  /* Rows that hold numbers someone typed (or worked out in a cell of their own, like Mansfield's
     March "=129,964.95+9,850"). A row counts only when it had a number in it this year - an empty
     formatted cell is layout, not a number. */
  function dataRows(tpl, tab, data){
    var cs = tpl.sheets[tab].cells, rows = {}, d = data[tab] || {};
    Object.keys(cs).forEach(function(a){ var c = cs[a];
      if(c.f != null || (typeof c.v === 'string' && c.v !== '') || typeof c.v === 'boolean') return;
      var r = +/\d+$/.exec(a)[0]; (rows[r] = rows[r] || {all:[], had:[]}).all.push(a); if(d[a] != null) rows[r].had.push(a); });
    Object.keys(rows).forEach(function(r){ if(!rows[r].had.length) delete rows[r]; });
    return rows;
  }
  function labelOfRow(tpl, tab, r){ var c = tpl.sheets[tab].cells['A' + r]; return c && typeof c.v === 'string' ? c.v.trim() : ''; }
  function rowsOf(tpl, tab){ var seen = {}; return Object.keys(tpl.sheets[tab].cells).map(function(a){ return +/\d+$/.exec(a)[0]; }).filter(function(r){ if(seen[r]) return false; seen[r] = 1; return true; }).sort(function(a, b){ return a - b; }); }
  function yearsIn(t){ return (String(t).match(/\b20\d\d\b/g) || []).map(Number); }
  var colOf = function(a){ return /^[A-Z]+/.exec(a)[0]; };
  function previewNextYear(from){
    return index().then(function(idx){
      from = +(from || liveYear(idx));
      if(!from) throw fail('Nothing is kept yet to start a new year from.');
      return Promise.all([templateBook(from), S().get(DATA + from)]).then(function(r){
        var tpl = r[0], data = (r[1] && r[1].data) || {}, to = from + 1;
        var book = B().withData(tpl, data), ev = B().evaluate(book), nt = B().shiftYears(tpl, from);
        var nd = {}, rows = [], flags = [];
        var num = function(v){ return typeof v === 'number' ? v : null; };
        /* A "formula" with no cell in it ("=9*4200", "=129964.95+9850") is a number typed as a sum:
           this year's, so it starts empty next year like any typed number. A real formula with a
           this-year number inside ("=(37800/B26)/B43") is kept but pointed out. */
        var bigNums = {};
        tpl.names.forEach(function(tab){ var cs = nt.sheets[tab].cells;
          Object.keys(cs).forEach(function(a){ var c = cs[a]; if(c.f == null) return;
            var toks; try{ toks = B().tokenize(c.f); }catch(_){ return; }
            if(!toks.some(function(t){ return t.k === 'ref' || t.k === 'sheet'; })){ cs[a] = {v:'', f:null, t:'n', s:c.s}; return; }
            if(toks.some(function(t){ return t.k === 'num' && Math.abs(t.v) >= 10; })){
              var rr = +/\d+$/.exec(a)[0], k = tab + '|' + rr; (bigNums[k] = bigNums[k] || {tab:tab, row:rr, cells:[]}).cells.push(a); }
          }); });
        Object.keys(bigNums).forEach(function(k){ var b = bigNums[k], L = B().shiftYearsText(labelOfRow(tpl, b.tab, b.row), from);
          flags.push({tab:b.tab, row:b.row, label:L || '(no name)', flag:'Its formulas have ' + from + ' numbers typed into them (e.g. =' + tpl.sheets[b.tab].cells[b.cells[0]].f + ') - they carry into ' + to + ' as they are; check them.'}); });
        /* A small table with years across the top (the Dashboard's "2026 | 2025 | YOY Change"):
           a typed figure under an older year takes the figure that sat under the next year. */
        var yearCols = {};
        tpl.names.forEach(function(tab){ var cs = tpl.sheets[tab].cells;
          Object.keys(cs).forEach(function(a){ var c = cs[a], v = data[tab] && data[tab][a];
            if(c.f == null && labelOfRow(tpl, tab, +/\d+$/.exec(a)[0]) === '' && typeof v === 'number' && v === Math.round(v) && v >= from - 2 && v <= from)
              (yearCols[tab] = yearCols[tab] || []).push({row:+/\d+$/.exec(a)[0], col:colOf(a), year:v}); }); });
        var tableSource = function(tab, a){
          var hs = yearCols[tab] || [], rr = +/\d+$/.exec(a)[0], col = colOf(a);
          var h = hs.filter(function(x){ return x.col === col && x.row < rr && rr - x.row <= 12; })[0];
          if(!h || h.year >= from) return null;
          var nx = hs.filter(function(x){ return x.row === h.row && x.year === h.year + 1; })[0];
          return nx ? nx.col + rr : null;
        };
        /* GAPS IN A ROW OF FORMULAS. A month that was blacked out (before an office counted) or held
           a goal typed over by hand gets a formula - but only from a row whose formulas can be
           trusted to continue: all the same shape ("=H12+H14" every month: the total of two rows),
           or worked out for at least half the year. It takes the nearest month's formula, moved
           across as Excel does when a formula is dragged. A formula with a this-year number typed
           into it is never copied. Anything it will not fill is pointed out instead. Every fill is
           listed for her to check. */
        var MOS = 'BCDEFGHIJKLM'.split(''), MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], filled = {}, BLK0 = B().blackStyles(tpl);
        var shape = function(f){ return String(f).replace(/\$?[A-Z]{1,3}(\$?\d+)/g, 'X$1'); };
        nt.names.forEach(function(tab){
          var cs = nt.sheets[tab].cells, old = tpl.sheets[tab].cells, rws = {};
          Object.keys(cs).forEach(function(a){ var i = MOS.indexOf(colOf(a)); if(i >= 0){ var rr = +/\d+$/.exec(a)[0]; (rws[rr] = rws[rr] || {})[i] = a; } });
          Object.keys(rws).forEach(function(rr){
            var m = rws[rr], clean = [], gaps = [];
            Object.keys(m).forEach(function(i){ var a = m[i], c = cs[a], o = old[a] || {};
              if(c.f != null){ var tk; try{ tk = B().tokenize(c.f); }catch(_){ tk = null; }
                if(tk && !tk.some(function(t){ return t.k === 'num' && Math.abs(t.v) >= 10; })) clean.push(+i); return; }
              if(typeof c.v === 'string' && c.v !== '') return;
              if(tableSource(tab, a)) return;                          // a year table's figure, filled below
              if((o.s != null && BLK0[o.s]) || (data[tab] && data[tab][a] != null)) gaps.push(+i); });
            if(!gaps.length) return;
            var lab = B().shiftYearsText(labelOfRow(tpl, tab, +rr), from) || '(no name)';
            var shapes = clean.map(function(i){ return shape(cs[m[i]].f); }), uniform = clean.length >= 2 && shapes.every(function(x){ return x === shapes[0]; });
            gaps.sort(function(a, b){ return a - b; });
            var span = function(g){ var out = [], st = g[0], pv = g[0];
              g.slice(1).concat([null]).forEach(function(x){ if(x !== null && x === pv + 1){ pv = x; return; } out.push(st === pv ? MON[st] : MON[st] + '–' + MON[pv]); st = pv = x; });
              return out.join(', '); };
            if(!(uniform || clean.length >= 6)){
              if(clean.length) flags.push({tab:tab, row:+rr, label:lab, flag:span(gaps) + ' had no formula in ' + from + ' (blacked out or typed by hand), and the rest of the row isn\'t one pattern - set ' + span(gaps) + ' for ' + to + '.'});
              return;
            }
            var bySrc = {};
            gaps.forEach(function(i){
              var j = clean.slice().sort(function(a, b){ return Math.abs(a - i) - Math.abs(b - i) || b - a; })[0];
              cs[m[i]] = Object.assign({}, cs[m[i]], {f:B().shift(cs[m[j]].f, i - j, 0), v:'', t:'n'});
              (bySrc[j] = bySrc[j] || []).push(i);
            });
            filled[tab + '|' + rr] = 1;
            Object.keys(bySrc).forEach(function(j){ var g = bySrc[j];
              flags.push({tab:tab, row:+rr, label:lab, flag:span(g) + ' had no formula in ' + from + ' (blacked out or typed by hand). Filled with ' + MON[j] +
                '\'s formula moved across (=' + B().shift(cs[m[j]].f, g[0] - j, 0) + ')' + (uniform ? '' : ' - check') + '.'}); });
          });
        });
        var MONTHCOLS = 'BCDEFGHIJKLM';
        /* Months blacked out in this year - before an office counted - look like the rest of their
           row next year: each takes the format of the nearest normal month in the same row (the
           office's own colour). A row with no normal month to copy stays black and is pointed out. */
        var BLACK = B().blackStyles(tpl), MO3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        nt.names.forEach(function(tab){
          var cs = nt.sheets[tab].cells, byRow = {};
          Object.keys(cs).forEach(function(a){ var col = colOf(a), i = MONTHCOLS.split('').indexOf(col); if(i < 0) return; var rr = +/\d+$/.exec(a)[0]; (byRow[rr] = byRow[rr] || {})[i] = a; });
          Object.keys(byRow).forEach(function(rr){
            var m = byRow[rr], blk = [], norm = [];
            Object.keys(m).forEach(function(i){ var c = cs[m[i]]; if(c.s == null) return; (BLACK[c.s] ? blk : norm).push(+i); });
            if(!blk.length) return;
            var L = B().shiftYearsText(labelOfRow(tpl, tab, +rr), from) || '(no name)';
            /* The office's own later months, when they sit right after the black ones (a coloured
               band). Otherwise - a small table, where the next cells are outside it - the same column
               in the nearest row above or below that isn't black (the table's own format). */
            var lastBlk = Math.max.apply(null, blk), sameRow = norm.indexOf(lastBlk + 1) >= 0;
            var fromColumn = function(i){
              var col = MONTHCOLS.charAt(i);
              for(var d = 1; d <= 12; d++) for(var k = 0; k < 2; k++){
                var rr2 = +rr + (k ? d : -d), c2 = cs[col + rr2];
                if(rr2 > 0 && c2 && c2.s != null && !BLACK[c2.s]) return c2.s;
              }
              return null;
            };
            var stuck = false;
            blk.forEach(function(i){
              var ns = null;
              if(sameRow){ var right = norm.filter(function(j){ return j > i; }); ns = cs[m[Math.min.apply(null, right)]].s; }
              else ns = fromColumn(i);
              if(ns == null){ stuck = true; return; }
              cs[m[i]] = Object.assign({}, cs[m[i]], {s:ns});
            });
            if(stuck){ flags.push({tab:tab, row:+rr, label:L, flag:'Blacked out in ' + from + ' - some of it is still black for ' + to + '; check.'}); return; }
            blk.sort(function(a, b){ return a - b; });
            rows.push({tab:tab, row:+rr, was:L, now:L, action:'format', source:MO3[blk[0]] + (blk.length > 1 ? '–' + MO3[blk[blk.length - 1]] : '') + ' no longer blacked out', flag:'', sample:[]});
          });
        });
        tpl.names.forEach(function(tab){
          var dr = dataRows(tpl, tab, data), all = rowsOf(tpl, tab), seen = {}, byLabel = {};
          all.forEach(function(rr){ var L = labelOfRow(tpl, tab, rr).toLowerCase(); if(L) (byLabel[L] = byLabel[L] || []).push(rr); });
          /* A row of last year's (or the year before's) with nothing in it this year still takes this year's
             figures next year - Cruces FFO's "Number of Production Days (2025)" was empty (it wasn't counted
             in 2025), so 2027's "(2026)" row had nothing to show. Only when this year has a row to give it. */
          all.forEach(function(rr){
            if(dr[rr]) return;
            var L = labelOfRow(tpl, tab, rr), ys = yearsIn(L), nl = B().shiftYearsText(L, from).toLowerCase();
            if(!L || !ys.some(function(y){ return y >= from - 2 && y < from; }) || ys.indexOf(from) >= 0) return;
            if(!(byLabel[nl] || []).some(function(x){ return x !== rr; })) return;
            dr[rr] = {all:MONTHCOLS.split('').map(function(c){ return c + rr; }), had:[]};
          });
          Object.keys(dr).map(Number).sort(function(a, b){ return a - b; }).forEach(function(rn){
            var R = dr[rn], cells = R.all.sort(function(a, b){ return B().colNum(colOf(a)) - B().colNum(colOf(b)); });
            var oldL = labelOfRow(tpl, tab, rn), newL = B().shiftYearsText(oldL, from), ys = yearsIn(oldL), lo = oldL.toLowerCase();
            // one figure (a fee) = exactly one number this year; an empty row is copied month by month
            // (Cruces FFO's "Number of Production Days (2025)" was empty in 2026 - it was taking an average into nowhere)
            var single = R.had.length === 1, out = {action:'', source:'', flag:''}, put = {};
            var occ = (seen[lo] = (seen[lo] || 0) + 1);
            /* Copy a source row's values (worked out, so a sum typed into a cell counts too), month
               for month. Into a one-number row from a monthly row: the average, to be checked. */
            var monthCells = function(){ return MONTHCOLS.split('').map(function(c){ return c + rn; }); };
            var copyFrom = function(src, how){
              var vals = [], targets = single ? cells : monthCells();
              (single ? monthCells() : targets).forEach(function(a){ var v = num(ev.value(tab, colOf(a) + src)); if(v != null && v !== 0) vals.push(v); });
              if(single && vals.length > 1){
                put[R.had[0]] = Math.round(vals.reduce(function(x, y){ return x + y; }, 0) / vals.length * 100) / 100;
                out.flag = 'Check: the average of ' + vals.length + ' months of "' + labelOfRow(tpl, tab, src) + '".';
              } else targets.forEach(function(a){ var v = num(ev.value(tab, colOf(a) + src)); put[a] = v == null ? 0 : v; });
              out.action = 'copied'; out.source = how;
            };
            var fromTable = R.had.map(function(a){ return {a:a, src:tableSource(tab, a)}; }).filter(function(x){ return x.src; });
            if(fromTable.length){
              fromTable.forEach(function(x){ var v = num(ev.value(tab, x.src)); if(v != null) put[x.a] = v; });
              out.action = 'copied'; out.source = 'from the ' + from + ' column of the same table';
            } else if(!oldL){
              cells.forEach(function(a){ var v = data[tab] && data[tab][a]; if(typeof v === 'number' && v === Math.round(v) && v >= from - 2 && v <= from) put[a] = v + 1; else if(v != null) put[a] = v; });
              var other = Object.keys(put).some(function(a){ var v = data[tab][a]; return !(v >= from - 2 && v <= from); });
              out.action = 'kept'; out.source = other ? 'kept as they were' : 'year headings moved on one';
              if(other) out.flag = 'Numbers with no row name, kept as they were - check they still belong in ' + to + '.';
            } else if(ys.some(function(y){ return y >= from - 2 && y < from; }) && ys.indexOf(from) < 0){
              var cand = (byLabel[newL.toLowerCase()] || []).filter(function(x){ return x !== rn; });
              var dup = (byLabel[lo] || []).length > 1 && occ > 1;
              if(dup){ out.action = 'empty'; out.flag = 'A second row named "' + oldL + '": in ' + from + ' it held that year\'s monthly fees. It starts empty for ' + to + '.'; }
              else if(cand.length) copyFrom(cand[0], 'from ' + from + '\'s "' + labelOfRow(tpl, tab, cand[0]) + '"');
              else if(/net production/i.test(newL) && yearsIn(newL).indexOf(from) >= 0){
                var tc = all.filter(function(x){ return /^tc net production/i.test(labelOfRow(tpl, tab, x)); })[0];
                if(tc) copyFrom(tc, 'from ' + from + '\'s "' + labelOfRow(tpl, tab, tc) + '" (typed each month)');
                else { out.action = 'empty'; out.flag = 'No "TC Net Production" row to fill it from.'; }
              } else if(/medicaid production/i.test(newL) && yearsIn(newL).indexOf(from) >= 0){
                var am = all.filter(function(x){ var L = labelOfRow(tpl, tab, x).toLowerCase(); return L.indexOf(String(from)) >= 0 && L.indexOf('actual medicaid production') >= 0; })[0];
                if(am) copyFrom(am, 'from ' + from + '\'s "' + labelOfRow(tpl, tab, am) + '" (starts x fee)');
                else { out.action = 'empty'; out.flag = 'No "' + from + ' Actual Medicaid Production" row to fill it from.'; }
              } else if(/average case fee/i.test(newL)){
                var twin = (byLabel[lo] || []).filter(function(x){ return x !== rn; })[0];          // Carlsbad: the mislabelled second row
                if(twin) copyFrom(twin, 'from ' + from + '\'s monthly fees (the second "' + oldL + '" row)');
                /* No fee of this year's in her sheet (Cruces FFO/LCO, Mansfield in 2026): keep the one this
                   year's formulas divide by, so next year works out the same until someone sets a new one
                   (Cory, 21/10: keep the fee they use today). Never left blank: blank = #DIV/0! in the starts rows. */
                else if(R.had.length){
                  R.had.forEach(function(a){ put[a] = data[tab][a]; });
                  out.action = 'kept'; out.source = 'the fee ' + from + ' used (her sheet has no ' + from + ' fee)';
                  out.flag = 'No ' + from + ' average case fee in her sheet - kept the one ' + from + ' used (' + R.had.map(function(a){ return '$' + Number(data[tab][a]).toLocaleString('en-US'); }).join(', ') + '). Change it in Enter Production (Average case fee) when there is a new one.';
                }
                else { out.action = 'empty'; out.flag = 'Set ' + from + '\'s average case fee.'; }
              } else { out.action = 'empty'; out.flag = 'Nothing in ' + from + ' to fill "' + newL + '" from.'; }
            } else if(ys.length && ys.every(function(y){ return y < from - 2; })){
              copyFrom(rn, 'kept as it was (an older year)'); out.action = 'kept';
            } else if(ys.indexOf(from) >= 0){
              out.action = 'empty'; out.source = 'new for ' + to;
              if(false && /goal/i.test(oldL) && !filled[tab + '|' + rn]) out.flag = R.had.length + ' ' + from + ' month' + (R.had.length > 1 ? 's were' : ' was') + ' typed in by hand here, not worked out - set ' + (R.had.length > 1 ? 'them' : 'it') + ' for ' + to + ' (the other months follow her formulas).';
            } else if(!ys.length && single && /case fee/i.test(oldL)){
              copyFrom(rn, 'carried on (a setting)'); out.action = 'kept';
            } else {
              out.action = 'empty'; out.source = single ? 'starts empty' : 'typed each month - starts empty';
              if(single) out.flag = '"' + oldL + '" looks like a ' + from + ' total - it starts again for ' + to + '.';
            }
            if(Object.keys(put).length) nd[tab] = Object.assign(nd[tab] || {}, put);
            rows.push({tab:tab, row:rn, was:oldL, now:newL, action:out.action, source:out.source, flag:out.flag, sample:cells.map(function(a){ return put[a]; }).filter(function(v){ return v != null; }).slice(0, 3)});
            if(out.flag) flags.push({tab:tab, row:rn, label:newL || '(no name)', flag:out.flag});
          });
        });
        /* The check that matters: next year's "last year" should be this year's production, month
           for month, as the dashboard shows it. Where it isn't, say where and why it may be. */
        var WB = global.PH_WB;
        if(WB){
          var nb = B().withData(nt, nd), nev = B().evaluate(nb), MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          Object.keys(WB.TABS).forEach(function(name){
            var tab = WB.TABS[name]; if(!book.sheets[tab] || !nb.sheets[tab]) return;
            var med = !!WB.MEDICAID[name], a = WB.office(B().grid(book, ev, tab), med, from).act, l = WB.office(B().grid(nb, nev, tab), med, to).ly, off = [];
            a.forEach(function(v, i){ if(Math.abs((v || 0) - (l[i] || 0)) > 0.005) off.push(MO[i] + ' (' + Math.round(l[i] || 0).toLocaleString('en-US') + ' vs ' + Math.round(v || 0).toLocaleString('en-US') + ')'); });
            if(off.length) flags.push({tab:tab, row:0, label:'Last year, month by month',
              flag:to + '\'s "last year" differs from ' + from + '\'s dashboard production in ' + off.join(', ') + '. Usually months before the office counted on the dashboard (it had numbers typed but no goal yet) - check.'});
          });
        }
        return {from:from, to:to, exists:!!(idx.years[to]), template:nt, data:nd, rows:rows, flags:flags};
      });
    });
  }
  function createNextYear(pv){
    if(live() && !admin()) return Promise.reject(fail('Only admins can start a new year.'));
    if(!pv || !pv.template) return Promise.reject(fail('Look at the preview first.'));
    var to = pv.to, at = nowISO(), book = pv.template;
    return index().then(function(idx){
      if(idx.years[to]) throw fail(to + ' is already kept - nothing was changed.');
      return Promise.all([B().exportXlsxSmall(B().blank(book), {}, null), fingerprint(book)]);
    }).then(function(x){
      return putTemplate(to, x[0]).then(function(saved){
        Object.keys(pv.data).forEach(function(t){ Object.keys(pv.data[t]).forEach(function(a){ if(!/^[A-Z]{1,3}\d+$/.test(a)) delete pv.data[t][a]; }); });
        var n = count(pv.data), entry = {at:at, from:{how:'start', by:me(), copiedBy:me(), fromYear:pv.from}, first:true, numbers:n, layout:'new',
          started:{from:pv.from, rows:pv.rows.length, copied:pv.rows.filter(function(r){ return r.action === 'copied' || r.action === 'kept'; }).length, flags:pv.flags.slice(0, 40)}, changes:[]};
        delete tplCache[to];
        // What was copied from the year before ("last year" rows, fees, small tables), as copied - so a number
        // entered there later can follow (refreshNextYear), and one changed here by hand is left alone.
        var links = {};
        pv.rows.forEach(function(r){ if(r.action !== 'copied') return;
          Object.keys(pv.data[r.tab] || {}).forEach(function(a){ if(+/\d+$/.exec(a)[0] === r.row) (links[r.tab] = links[r.tab] || {})[a] = pv.data[r.tab][a]; }); });
        return Promise.all([
          S().set(DATA + to, {year:to, data:pv.data, from:{how:'start', fromYear:pv.from, copiedAt:at, copiedBy:me()}, updatedAt:at, updatedBy:me()}),
          S().set(LINKS + to, {from:pv.from, at:at, cells:links}),
          S().update(LOG + to, function(list){ return [entry].concat(Array.isArray(list) ? list : []).slice(0, LOG_KEEP); }),
          S().update(INDEX, function(cur){
            cur = (cur && cur.years) ? cur : {years:{}};
            if(cur.years[to]) return undefined;
            var formulas = book.names.reduce(function(k, s){ return k + Object.keys(book.sheets[s].cells).filter(function(a){ return book.sheets[s].cells[a].f != null; }).length; }, 0);
            cur.years[to] = {layout:x[1], numbers:n, formulas:formulas, tabs:book.names.slice(), template:{name:saved.name, webUrl:saved.webUrl || '', savedAt:at},
                             lastCopy:{how:'start', copiedAt:at, copiedBy:me(), fromYear:pv.from}, started:{from:pv.from, at:at, by:me()}};
            return cur;
          })
        ]).then(function(res){
          var bad = res.filter(function(r){ return r && (r.blocked || r.error); });
          if(bad.length) throw fail('Home-Brace could not save ' + to + ' (' + (bad[0].why || bad[0].error) + ').');
          return {year:to, numbers:n, flags:pv.flags.length};
        });
      });
    });
  }
  function log(y){ return S().get(LOG + y).then(function(x){ return Array.isArray(x) ? x : []; }); }

  /* A year started from the one before holds that year's numbers as copies ("last year", as in her
     Excel). The new year is usually started before the old one is finished - December is typed in
     January - so a number saved later for the old year is carried into those copies here, worked out
     the same way Start did it. A copy someone changed by hand in the new year is theirs and is left
     alone; so is anything whose row moved in a changed layout. Every update is in the new year's History.
     Only numbers follow: the new year's formulas, goals and layout never move. */
  function refreshNextYear(from){
    from = +from; var to = from + 1;
    return S().get(LINKS + to).then(function(L){
      if(!L || +L.from !== from || !L.cells) return null;
      return Promise.all([previewNextYear(from), templateBook(to)]).then(function(r){
        var pv = r[0], tpl = r[1], upd = {}, n = 0;
        Object.keys(L.cells).forEach(function(tab){
          if(!tpl.sheets[tab] || !pv.template.sheets[tab]) return;
          Object.keys(L.cells[tab]).forEach(function(a){
            if(!/^[A-Z]{1,3}\d+$/.test(a)) return;
            var nv = pv.data[tab] && pv.data[tab][a], row = +/\d+$/.exec(a)[0];
            if(nv == null || nv === L.cells[tab][a]) return;
            if(labelOfRow(tpl, tab, row) !== labelOfRow(pv.template, tab, row)) return;
            (upd[tab] = upd[tab] || {})[a] = nv; n++;
          });
        });
        if(!n) return {year:to, changes:0};
        var changes = [], kept = 0;
        return S().update(DATA + to, function(rec){
          rec = (rec && rec.data) ? rec : {year:to, data:{}};
          changes = []; kept = 0;
          Object.keys(upd).forEach(function(tab){ var d = rec.data[tab] = rec.data[tab] || {};
            Object.keys(upd[tab]).forEach(function(a){
              var was = d[a] == null ? null : d[a];
              if(was !== L.cells[tab][a]){ kept++; return; }                     // changed by hand in the new year
              d[a] = upd[tab][a]; var w = B().labelAt(tpl, tab, a);
              changes.push({tab:tab, cell:a, label:w.label, head:w.head, from:was, to:upd[tab][a]});
            });
          });
          if(!changes.length) return undefined;
          rec.updatedAt = nowISO(); rec.updatedBy = me();
          return rec;
        }).then(function(res){
          if(res && (res.blocked || res.error)) throw fail('Home-Brace could not update ' + to + '\'s last year (' + (res.why || res.error) + ').');
          if(!changes.length) return {year:to, changes:0, kept:kept};
          return Promise.all([
            S().update(LINKS + to, function(x){ x = (x && x.cells) ? x : L; changes.forEach(function(c){ (x.cells[c.tab] = x.cells[c.tab] || {})[c.cell] = c.to; }); return x; }),
            S().update(LOG + to, function(list){
              list = Array.isArray(list) ? list : [];
              list.unshift({at:nowISO(), from:{how:'lastyear', fromYear:from, by:me(), copiedBy:me()}, changes:changes});
              return list.slice(0, LOG_KEEP);
            })
          ]).then(function(){ return {year:to, changes:changes.length, kept:kept}; });
        });
      });
    });
  }
  // After a year's numbers change: carry them into the next year's copies. Never fails the save itself.
  function followOn(year){
    return refreshNextYear(year).catch(function(e){ try{ console.warn('Next year\'s "last year" not updated:', (e && e.message) || e); }catch(_){} return null; });
  }

  global.PH_PROD = {FOLDER:FOLDER, INDEX:INDEX, DATA:DATA, LOG:LOG, tplName:tplName,
    copyFromBytes:copyFromBytes, syncFromWorkbook:syncFromWorkbook, loadYear:loadYear, downloadYear:downloadYear,
    index:index, log:log, check:check, diff:diff, fingerprint:fingerprint, remap:remap,
    mode:mode, setMode:setMode, liveYear:liveYear, compareFromBytes:compareFromBytes, dashboardData:dashboardData,
    cellFor:cellFor, setValues:setValues, previewNextYear:previewNextYear, createNextYear:createNextYear, refreshNextYear:refreshNextYear,
    goalModel:goalModel, saveGoals:saveGoals, formulaModel:formulaModel, formulaChange:formulaChange, formulaUndo:formulaUndo,
    planModel:planModel, planSave:planSave, planDraft:planDraft, planLine:planLine, planPayload:planPayload,
    reset:function(){ driveP = null; syncing = null; tplCache = {}; }};
})(typeof window !== 'undefined' ? window : globalThis);
