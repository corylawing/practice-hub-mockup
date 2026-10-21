/* ADMIN -> PRODUCTION DATA: Home-Brace's own copy of the production workbook (prodstore.js).

   What an admin sees and can do (21/10/2026, Cory OK'd steps 1-4: keep each year, copy from
   Heather's Excel automatically, download the Excel and upload a changed layout for one year,
   start the next year - and NOT switch the dashboard yet: "we need to wait and run them
   parallel for a bit"):
     - when Home-Brace last copied her Excel, and whether every formula gave the same result;
     - each year kept: Download Excel (formatted exactly as hers), its history of changes, and
       "Upload a changed layout" for that year only;
     - on the sandbox, where her workbook is never opened: try it with a workbook file. */
(function(global){
  'use strict';
  var P = function(){ return global.PH_PROD; };
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var live = function(){ return !!(global.PH && global.PH.isLive && global.PH.isLive()); };
  var host = null, IDX = null, LOGS = {}, open = null, busy = '', msg = null, pending = null;

  var CSS = '.pd{display:flex;flex-direction:column;gap:16px}'+
    '.pd .card{padding:18px}.pd h2{margin:0 0 4px;font-size:17px;color:var(--navy)}.pd .sub{margin:0 0 12px;color:var(--soft);font-size:13.5px;max-width:72ch}'+
    '.pd .stat{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;font-size:14px;padding:11px 14px;border-radius:11px;border:1px solid}'+
    '.pd .stat.ok{background:#E7F4EE;border-color:#bfe3cf;color:#1d6b45}.pd .stat.warn{background:#FFF6E5;border-color:#f0d9a8;color:#7a4b00}'+
    '.pd .stat.info{background:#EEF4FA;border-color:#cfe0ef;color:#14496c}.pd .stat .grow{flex:1;min-width:220px}'+
    '.pd table{border-collapse:collapse;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}'+
    '.pd th{background:#F7F9FB;color:var(--soft);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}'+
    '.pd td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}.pd .tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:#fff}'+
    '.pd .acts{display:flex;gap:6px;flex-wrap:wrap}.pd .lg{font-size:13px;display:flex;flex-direction:column;gap:10px}'+
    '.pd .lg .e{border-left:3px solid var(--teal-line,#bfe3d0);padding:2px 0 2px 12px}.pd .lg .when{font-weight:700;color:var(--navy)}'+
    '.pd .lg ul{margin:4px 0 0;padding-left:18px;color:var(--ink)}.pd .lg li{margin:2px 0}.pd .muted{color:var(--soft)}'+
    '.pd .num{font-variant-numeric:tabular-nums}.pd .dlg{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:#FBFCFD;display:flex;flex-direction:column;gap:10px}'+
    '.pd .dlg label{display:flex;gap:8px;align-items:flex-start;font-size:14px;cursor:pointer}.pd .dlg input{margin-top:3px;accent-color:var(--teal)}';

  function when(iso){
    if(!iso) return '';
    var d = new Date(iso); if(isNaN(d)) return esc(iso);
    return d.toLocaleString('en-US', {weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
  }
  function fmtVal(v){ return v == null || v === '' ? '(empty)' : (typeof v === 'number' ? (Math.round(v * 100) / 100).toLocaleString('en-US') : esc(v)); }
  function place(c){ return esc(c.tab) + ' · ' + esc(c.label || c.cell) + (c.head ? ' · ' + esc(c.head) : ''); }

  function render(){
    if(!host) return;
    var years = IDX ? Object.keys(IDX.years).sort().reverse() : [], src = IDX && IDX.source;
    var h = '<div class="pd"><div class="card"><h2>Production data, kept by Home-Brace</h2>'+
      '<p class="sub">Home-Brace keeps its own copy of the production workbook, one book per year: the layout and formulas, and every number typed. '+
      'The dashboard still reads Heather’s Excel — this runs alongside it until you decide to switch. Nothing here ever changes her Excel.</p>';
    if(live()){
      h += '<div class="stat info"><span>🔁</span><span class="grow">'+(src
          ? 'Copied from Heather’s Excel — her save of <b>'+when(src.modified)+'</b>'+(src.by ? ' by '+esc(src.by) : '')+'. Home-Brace copies it again by itself whenever an admin opens the dashboard after she saves.'
          : 'Not copied yet. Home-Brace copies Heather’s Excel by itself when an admin opens the dashboard, or now:')+'</span>'+
        '<button class="btn tiny" data-pd="sync"'+(busy?' disabled':'')+'>'+(busy==='sync'?'Copying…':'Copy now')+'</button></div>';
    } else {
      h += '<div class="stat info"><span>🧪</span><span class="grow"><b>Sandbox.</b> On the live site this copies Heather’s Excel by itself. Here her workbook is never opened — '+
        'try it with a production workbook file instead. It stays in this browser.</span>'+
        '<label class="btn tiny" style="cursor:pointer">'+(busy==='file'?'Reading…':'Choose a workbook…')+'<input type="file" accept=".xlsx" data-pd="file" hidden></label></div>';
    }
    if(msg) h += '<div class="stat '+msg.cls+'" style="margin-top:10px"><span>'+msg.icon+'</span><span class="grow">'+msg.html+'</span></div>';
    var cy = years[0] && IDX.years[years[0]];
    if(cy && cy.check){
      h += cy.check.differ
        ? '<div class="stat warn" style="margin-top:10px"><span>⚠️</span><span class="grow"><b>'+cy.check.differ+' of '+cy.check.formulas.toLocaleString('en-US')+' formulas came out differently</b> in Home-Brace than in her Excel ('+esc(years[0])+'). '+
          'Don’t switch anything until this is explained:<ul style="margin:6px 0 0">'+cy.check.sample.map(function(d){ return '<li>'+place(d)+': Excel '+esc(d.excel)+', Home-Brace '+esc(d.homeBrace)+'</li>'; }).join('')+'</ul></span></div>'
        : '<div class="stat ok" style="margin-top:10px"><span>✓</span><span class="grow"><b>All '+cy.check.formulas.toLocaleString('en-US')+' formulas give the same results as her Excel</b> ('+esc(years[0])+', checked '+when(cy.check.at)+').</span></div>';
    }
    h += '</div>';

    h += '<div class="card"><h2>Years kept</h2><p class="sub">Each year stands alone: changing one year’s layout or formulas never changes another year.</p>';
    if(!years.length) h += '<div class="muted" style="font-size:14px">Nothing kept yet.</div>';
    else {
      h += '<div class="tw"><table><thead><tr><th>Year</th><th class="num">Numbers</th><th class="num">Formulas</th><th>Last copy</th><th></th></tr></thead><tbody>';
      years.forEach(function(y){ var Y = IDX.years[y];
        h += '<tr><td><b>'+esc(y)+'</b></td><td class="num">'+(Y.numbers||0).toLocaleString('en-US')+'</td><td class="num">'+(Y.formulas||0).toLocaleString('en-US')+'</td>'+
          '<td>'+(Y.lastCopy ? when(Y.lastCopy.copiedAt)+(Y.lastCopy.how==='upload' ? ' · uploaded' : '') : '')+'</td>'+
          '<td><div class="acts"><button class="btn tiny" data-pd="dl" data-y="'+esc(y)+'"'+(busy?' disabled':'')+'>'+(busy==='dl'+y?'Building…':'⬇ Download Excel')+'</button>'+
          '<button class="btn ghost tiny" data-pd="log" data-y="'+esc(y)+'">'+(open===y?'Hide history':'History')+'</button>'+
          '<label class="btn ghost tiny" style="cursor:pointer">Upload a changed layout<input type="file" accept=".xlsx" data-pd="layout" data-y="'+esc(y)+'" hidden></label></div></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    if(pending) h += pendingHTML();
    h += '</div>';
    if(open) h += '<div class="card"><h2>'+esc(open)+' — history of changes</h2><p class="sub">Newest first. Every copy that changed something, and every layout change.</p>'+logHTML(open)+'</div>';
    host.innerHTML = h + '</div>';
  }
  function pendingHTML(){
    var p = pending, has = IDX && IDX.years[p.year] && IDX.years[p.year].numbers;
    var h = '<div class="dlg" style="margin-top:14px"><b>'+esc(p.name)+'</b><div>This is a <b>'+esc(p.year)+'</b> workbook: '+p.tabs+' tabs, '+p.formulas.toLocaleString('en-US')+' formulas, '+p.numbers.toLocaleString('en-US')+' numbers.</div>';
    if(p.year !== p.forYear) h += '<div class="stat warn"><span>⚠️</span><span class="grow">You chose it from the '+esc(p.forYear)+' row, but it is for '+esc(p.year)+'. It would become '+esc(p.year)+'’s layout.</span></div>';
    if(live() && IDX && IDX.source && +IDX.source.year === +p.year)
      h += '<div class="stat warn"><span>⚠️</span><span class="grow">'+esc(p.year)+' is copied from Heather’s Excel. The next copy from her Excel puts her layout back if it is different.</span></div>';
    if(has) h += '<label><input type="radio" name="pdmode" value="keep" checked> Use its layout and formulas, and <b>keep Home-Brace’s numbers</b> — each one moves to the row and month with the same name.</label>'+
                 '<label><input type="radio" name="pdmode" value="take"> Use its layout, formulas <b>and its numbers</b>.</label>';
    else h += '<div>Its layout, formulas and numbers become '+esc(p.year)+'’s book.</div>';
    return h + '<div class="acts"><button class="btn" data-pd="useit">Use it for '+esc(p.year)+'</button><button class="btn ghost" data-pd="cancel">Cancel</button></div></div>';
  }
  function logHTML(y){
    var L = LOGS[y];
    if(!L) return '<div class="muted">Loading…</div>';
    if(!L.length) return '<div class="muted">Nothing changed yet.</div>';
    return '<div class="lg">'+L.map(function(e){
      var f = e.from || {}, head = '<div class="when">'+when(e.at)+'</div><div class="muted">'+
        (f.how === 'upload' ? 'Uploaded'+(f.copiedBy ? ' by '+esc(f.copiedBy) : '')+(f.name ? ' — '+esc(f.name) : '')
                            : 'Copied from Heather’s Excel'+(f.modified ? ' (her save of '+when(f.modified)+(f.by ? ' by '+esc(f.by) : '')+')' : ''))+'</div>';
      var body = [];
      if(e.first) body.push('<li>First copy: '+(e.numbers||0).toLocaleString('en-US')+' numbers.</li>');
      if(e.layout === 'new') body.push('<li>Layout and formulas saved.</li>');
      else if(e.layout) body.push('<li>Layout or formulas changed: '+e.layout.map(esc).join(', ')+'.</li>');
      if(e.kept) body.push('<li>'+e.kept.moved.toLocaleString('en-US')+' numbers moved into the new layout'+(e.kept.lost.length ? '; <b>'+e.kept.lost.length+' had no place in it</b>: '+e.kept.lost.slice(0,6).map(function(x){ return place(x)+' ('+fmtVal(x.value)+')'; }).join('; ') : '')+'.</li>');
      (e.changes||[]).slice(0, 40).forEach(function(c){ body.push('<li>'+place(c)+': '+fmtVal(c.from)+' → <b>'+fmtVal(c.to)+'</b></li>'); });
      var more = Math.max(0, (e.changes||[]).length - 40) + (e.more||0);
      if(more) body.push('<li class="muted">…and '+more+' more.</li>');
      if(e.check && e.check.differ) body.push('<li>⚠️ '+e.check.differ+' formulas came out differently from her Excel.</li>');
      return '<div class="e">'+head+(body.length ? '<ul>'+body.join('')+'</ul>' : '')+'</div>';
    }).join('')+'</div>';
  }

  function say(cls, icon, html){ msg = {cls:cls, icon:icon, html:html}; }
  function summary(r){
    var bits = [];
    if(r.first) bits.push('<b>'+esc(r.year)+' is now kept by Home-Brace</b>: '+r.numbers.toLocaleString('en-US')+' numbers');
    else bits.push(r.changes ? '<b>'+r.changes+' number'+(r.changes>1?'s':'')+' changed</b> in '+esc(r.year) : 'No numbers changed in '+esc(r.year));
    if(r.layout && r.layout !== 'new') bits.push('the layout or formulas changed');
    if(r.kept && r.kept.lost.length) bits.push('<b>'+r.kept.lost.length+' numbers had no place in the new layout</b> (see History)');
    return bits.join('; ')+'.';
  }
  function refresh(){
    return P().index().then(function(x){ IDX = x; if(open) return P().log(open).then(function(l){ LOGS[open] = l; }); }).then(render, function(e){ say('warn','⚠️','Could not read what is kept: '+esc(e.message||e)); render(); });
  }
  function readFile(input){ var f = input.files && input.files[0]; input.value = ''; return f ? f.arrayBuffer().then(function(ab){ return {name:f.name, bytes:new Uint8Array(ab)}; }) : Promise.resolve(null); }

  function onClick(e){
    var b = e.target.closest('[data-pd]'); if(!b || !host.contains(b) || b.tagName === 'INPUT') return;
    var act = b.dataset.pd, y = b.dataset.y;
    if(act === 'sync'){
      busy = 'sync'; msg = null; render();
      P().syncFromWorkbook({force:true}).then(function(r){
        busy = ''; if(r && r.skipped) say('info','ℹ️','Nothing to copy ('+esc(r.skipped)+').'); else say(r.check.differ ? 'warn' : 'ok', r.check.differ ? '⚠️' : '✓', summary(r));
        LOGS = {}; return refresh();
      }, function(err){ busy = ''; say('warn','⚠️','The copy did not work: '+esc(err.message||err)+' Nothing was changed.'); render(); });
    }
    if(act === 'dl'){
      busy = 'dl'+y; render();
      P().downloadYear(y).then(function(r){
        var a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = r.name; document.body.appendChild(a); a.click();
        setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        busy = ''; render();
      }, function(err){ busy = ''; say('warn','⚠️','Could not build the Excel: '+esc(err.message||err)); render(); });
    }
    if(act === 'log'){ open = open === y ? null : y; if(open && !LOGS[y]) P().log(y).then(function(l){ LOGS[y] = l; render(); }); render(); }
    if(act === 'cancel'){ pending = null; render(); }
    if(act === 'useit' && pending){
      var p = pending, mode = (host.querySelector('input[name=pdmode]:checked') || {}).value || 'take';
      pending = null; busy = 'up'; render();
      P().copyFromBytes(p.bytes, {how:'upload', name:p.name, layoutOnly: mode === 'keep'}).then(function(r){
        busy = ''; say(r.check.differ ? 'warn' : 'ok', r.check.differ ? '⚠️' : '✓', summary(r)); LOGS = {}; return refresh();
      }, function(err){ busy = ''; say('warn','⚠️','That did not work: '+esc(err.message||err)+' Nothing was changed.'); render(); });
    }
  }
  function onChange(e){
    var t = e.target; if(!t.dataset || !t.dataset.pd || !host.contains(t)) return;
    if(t.dataset.pd === 'file'){
      busy = 'file'; msg = null; render();
      readFile(t).then(function(f){ if(!f){ busy = ''; render(); return; }
        return P().copyFromBytes(f.bytes, {how:'upload', name:f.name}).then(function(r){ busy = ''; say(r.check.differ ? 'warn' : 'ok', r.check.differ ? '⚠️' : '✓', summary(r)); LOGS = {}; return refresh(); });
      }).catch(function(err){ busy = ''; say('warn','⚠️','That did not work: '+esc(err.message||err)); render(); });
    }
    if(t.dataset.pd === 'layout'){
      var forYear = t.dataset.y;
      readFile(t).then(function(f){ if(!f) return;
        return global.PH_BOOK.open(f.bytes).then(function(book){
          var year = global.PH_BOOK.yearOf(book); if(!year) throw new Error('Home-Brace could not tell which year that workbook is for.');
          var formulas = book.names.reduce(function(n, s){ return n + Object.keys(book.sheets[s].cells).filter(function(a){ return book.sheets[s].cells[a].f != null; }).length; }, 0);
          var numbers = Object.keys(global.PH_BOOK.dataOf(book)).reduce(function(n, s){ return n + Object.keys(global.PH_BOOK.dataOf(book)[s]).length; }, 0);
          pending = {name:f.name, bytes:f.bytes, year:String(year), forYear:String(forYear), tabs:book.names.length, formulas:formulas, numbers:numbers};
          msg = null; render();
        });
      }).catch(function(err){ say('warn','⚠️','That file could not be read: '+esc(err.message||err)); render(); });
    }
  }
  function mount(el){
    if(!host){ var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
    if(host !== el){ host = el; host.addEventListener('click', onClick); host.addEventListener('change', onChange); }
    render(); refresh();
  }
  global.PH_PRODUI = {mount:mount};
})(window);
