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
  var host = null, IDX = null, LOGS = {}, open = null, busy = '', msg = null, pending = null, MODE = null, sw = null, NEXT = null, nextOpen = {};
  var GY = null, GO = null, GM = null, GEDIT = {}, GPREV = {}, GERR = '', gTimer = null;

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
    '.pd .dlg label{display:flex;gap:8px;align-items:flex-start;font-size:14px;cursor:pointer}.pd .dlg input{margin-top:3px;accent-color:var(--teal)}'+
    '.pd select{padding:7px 10px;border:1px solid var(--line);border-radius:9px;font:inherit;font-size:13.5px;background:#fff;color:var(--ink)}'+
    '.pd table.gt td,.pd table.gt th{padding:6px 5px}.pd table.gt td.gl{position:sticky;left:0;background:#fff;z-index:1;min-width:170px;box-shadow:1px 0 0 var(--line)}'+
    '.pd .gc input{width:74px;padding:5px 6px;border:1px solid #D5DCE5;border-radius:7px;font:inherit;font-size:13px;text-align:right;font-variant-numeric:tabular-nums}'+
    '.pd .gc.ch input{border-color:var(--teal);background:var(--teal-soft)}.pd .gc.ro{text-align:right}'+
    '.pd .gv{font-size:11.5px;color:var(--soft);text-align:right;margin-top:2px;font-variant-numeric:tabular-nums}.pd .gh{font-size:10.5px;color:#9AA5B5}'+
    '.pd .gall{margin-top:5px;width:120px;padding:4px 7px;border:1px dashed #C9D3DF;border-radius:7px;font:inherit;font-size:12px}';

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
    // After the switch her Excel is only compared, never copied over Home-Brace - say so, and name the button for it.
    var onHB = !!(MODE && MODE.source === 'homebrace');
    var h = '<div class="pd"><div class="card"><h2>Production data, kept by Home-Brace</h2>'+
      '<p class="sub">Home-Brace keeps its own copy of the production workbook, one book per year: the layout and formulas, and every number typed. '+
      (onHB ? 'The dashboard and Enter Production use these books now (see below). Nothing here ever changes her Excel.</p>'
            : 'The dashboard still reads Heather’s Excel — this runs alongside it until you decide to switch. Nothing here ever changes her Excel.</p>');
    if(live()){
      h += '<div class="stat info"><span>🔁</span><span class="grow">'+(onHB
          ? (src ? 'Compared with Heather’s Excel — her save of <b>'+when(src.modified)+'</b>'+(src.by ? ' by '+esc(src.by) : '')+'. ' : '')+
            'Home-Brace compares again by itself whenever an admin opens the dashboard after she saves. Her numbers are never copied over Home-Brace’s now.'
          : src && src.compared
          ? 'Her save of <b>'+when(src.modified)+'</b>'+(src.by ? ' by '+esc(src.by) : '')+' was only compared while Home-Brace kept the numbers. Home-Brace copies it the next time an admin opens the dashboard, or now:'
          : src
          ? 'Copied from Heather’s Excel — her save of <b>'+when(src.modified)+'</b>'+(src.by ? ' by '+esc(src.by) : '')+'. Home-Brace copies it again by itself whenever an admin opens the dashboard after she saves.'
          : 'Not copied yet. Home-Brace copies Heather’s Excel by itself when an admin opens the dashboard, or now:')+'</span>'+
        '<button class="btn tiny" data-pd="sync"'+(busy?' disabled':'')+'>'+(busy==='sync'?(onHB?'Comparing…':'Copying…'):(onHB?'Compare now':'Copy now'))+'</button></div>';
    } else {
      h += '<div class="stat info"><span>🧪</span><span class="grow"><b>Sandbox.</b> On the live site this '+(onHB ? 'compares with' : 'copies')+' Heather’s Excel by itself. Here her workbook is never opened — '+
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

    h += switchHTML();
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
    h += goalsHTML();
    h += nextHTML();
    if(open) h += '<div class="card"><h2>'+esc(open)+' — history of changes</h2><p class="sub">Newest first. Every copy that changed something, and every layout change.</p>'+logHTML(open)+'</div>';
    host.innerHTML = h + '</div>';
  }
  /* ---------- the switch: where the dashboard and Enter Production get their numbers ---------- */
  function switchHTML(){
    var m = MODE || {source:'excel', mirror:true}, onHB = m.source === 'homebrace', cmp = IDX && IDX.compare;
    var h = '<div class="card"><h2>Where the production numbers live</h2>';
    if(!onHB){
      h += '<div class="stat info"><span>📗</span><span class="grow"><b>Heather’s Excel</b>, as today. The dashboard and Enter Production use her Excel, and Home-Brace keeps its copy alongside.</span>'+
        (sw ? '' : '<button class="btn tiny" data-pd="swopen">Switch to Home-Brace…</button>')+'</div>';
      if(sw === 'to') h += switchDlgHTML();
    } else {
      h += '<div class="stat ok"><span>🏠</span><span class="grow"><b>Home-Brace</b>, since '+when(m.changedAt)+(m.changedBy ? ' ('+esc(m.changedBy)+')' : '')+
        '. The dashboard and Enter Production use Home-Brace’s own numbers. '+(m.mirror ? 'Heather’s Excel is kept up to date too.' : 'Heather’s Excel is no longer updated.')+'</span></div>';
      if(cmp) h += cmp.differ
        ? '<div class="stat warn" style="margin-top:10px"><span>⚠️</span><span class="grow"><b>Her Excel differs from Home-Brace in '+cmp.differ+' number'+(cmp.differ > 1 ? 's' : '')+'</b> ('+(cmp.modified ? 'her save of '+when(cmp.modified)+(cmp.by ? ' by '+esc(cmp.by) : '') : '“'+esc(cmp.name || 'the workbook')+'”, '+when(cmp.at))+'). Someone may have typed in her Excel - Home-Brace’s numbers are the ones used:<ul style="margin:6px 0 0">'+
            cmp.sample.slice(0, 8).map(function(c){ return '<li>'+place(c)+': Home-Brace '+fmtVal(c.from)+', her Excel '+fmtVal(c.to)+'</li>'; }).join('')+'</ul></span></div>'
        : '<div class="stat ok" style="margin-top:10px"><span>✓</span><span class="grow">Her Excel matches Home-Brace ('+(cmp.modified ? 'her save of '+when(cmp.modified) : '“'+esc(cmp.name || 'the workbook')+'”, '+when(cmp.at))+').</span></div>';
      h += '<div class="acts" style="margin-top:10px"><button class="btn ghost tiny" data-pd="mirror"'+(busy?' disabled':'')+'>'+(m.mirror ? 'Stop updating her Excel' : 'Keep her Excel up to date again')+'</button>'+
        (sw ? '' : '<button class="btn ghost tiny" data-pd="swback">Switch back to her Excel…</button>')+'</div>';
      if(sw === 'back') h += '<div class="dlg" style="margin-top:12px"><b>Switch back to Heather’s Excel?</b><div>The dashboard and Enter Production go back to her Excel. '+
        // Switching back makes her Excel the one copied again, so anything only Home-Brace has would then live on in History alone.
        (cmp && cmp.differ ? '<b>Her Excel differs from Home-Brace in '+cmp.differ+' number'+(cmp.differ > 1 ? 's' : '')+'</b> (listed above). Put those in her Excel first: once switched back, her Excel is copied into Home-Brace again, and Home-Brace’s versions stay only in History.'
          : m.mirror ? 'Her Excel has been kept up to date, so nothing is lost.' : '<b>Her Excel was not kept up to date</b>, so numbers entered in Home-Brace since then are not in it. Put them in her Excel first (Download Excel below shows them): once switched back, her Excel is copied into Home-Brace again, and Home-Brace’s versions stay only in History.')+'</div>'+
        '<div class="acts"><button class="btn" data-pd="swbackgo"'+(busy?' disabled':'')+'>'+(busy === 'sw' ? 'Switching…' : 'Switch back')+'</button><button class="btn ghost" data-pd="swcancel">Cancel</button></div></div>';
    }
    return h + '</div>';
  }
  function switchDlgHTML(){
    var y = P().liveYear(IDX), Y = y && IDX.years[y], ok = function(b){ return b ? '✓' : '⚠️'; }, src = IDX && IDX.source;
    var ready = [
      [!!Y, Y ? y+' is kept by Home-Brace ('+(Y.numbers||0).toLocaleString('en-US')+' numbers).' : 'This year isn’t kept yet - copy her Excel first.'],
      [!!(Y && Y.check && !Y.check.differ), Y && Y.check ? (Y.check.differ ? Y.check.differ+' formulas came out differently from her Excel - explain those first.' : 'Every formula gave the same result as her Excel at the last copy.') : 'No formula check yet.'],
      live() ? [!!src, src ? 'Last copy of her Excel: her save of '+when(src.modified)+(src.by ? ' by '+esc(src.by) : '')+'.' : 'Her Excel hasn’t been copied yet.']
             : [true, 'Sandbox: there is no Excel of hers here to copy.']
    ];
    var go = ready.every(function(r){ return r[0]; });
    return '<div class="dlg" style="margin-top:12px"><b>Switch to Home-Brace?</b>'+
      '<div>'+ready.map(function(r){ return ok(r[0])+' '+r[1]; }).join('<br>')+'</div>'+
      '<div>From then on: <b>Enter Production saves into Home-Brace</b>, and <b>the dashboard shows Home-Brace’s numbers</b>. '+(live() ? 'Home-Brace copies her Excel one last time first, so nothing she typed is missed. ' : '')+
      'Her Excel stays where it is; Home-Brace only compares with it from then on. You can switch back.</div>'+
      '<label><input type="checkbox" id="pdmirror" checked> Keep Heather’s Excel up to date too (recommended until you retire it)</label>'+
      '<div class="acts"><button class="btn" data-pd="swgo"'+(go && !busy ? '' : ' disabled')+'>'+(busy === 'sw' ? 'Switching…' : 'Switch now')+'</button><button class="btn ghost" data-pd="swcancel">Cancel</button></div></div>';
  }

  /* ---------- goals & formulas, in Home-Brace (Cory: "configure the formulas for future years") ---------- */
  var MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var GLAB = {tc:'TC goal', md:'Medicaid goal', total:'Total goal', stretch:'Stretch goal', days:'Production days'};
  var money = function(v){ return typeof v === 'number' && isFinite(v) ? '$' + Math.round(v).toLocaleString('en-US') : ''; };
  function goalsHTML(){
    var ys = IDX ? Object.keys(IDX.years).sort().reverse() : [];
    if(!ys.length || !global.PH_WB) return '';
    if(!GY || ys.indexOf(String(GY)) < 0) GY = ys[0];
    var offs = Object.keys(global.PH_WB.TABS); if(!GO) GO = offs[0];
    var h = '<div class="card"><h2>Goals &amp; formulas</h2><p class="sub">Each office’s goals for a year, in Heather’s own terms. In a month, type a <b>growth number</b> (1.05 = last year + 5%) or a <b>dollar amount</b>; empty a month to go back to its formula. Changing one year never changes another, and the Excel download carries the new formulas.</p>'+
      '<div class="acts" style="align-items:center">Year <select data-pd="gy">'+ys.map(function(y){ return '<option'+(String(y) === String(GY) ? ' selected' : '')+'>'+esc(y)+'</option>'; }).join('')+'</select>'+
      'Office <select data-pd="go">'+offs.map(function(o){ return '<option'+(o === GO ? ' selected' : '')+'>'+esc(o)+'</option>'; }).join('')+'</select></div>';
    if(MODE && MODE.source !== 'homebrace' && IDX.source && +IDX.source.year === +GY)
      h += '<div class="stat warn" style="margin-top:10px"><span>⚠️</span><span class="grow">'+esc(GY)+' is still copied from Heather’s Excel, so her next save puts her numbers back. Set goals here for a year she doesn’t keep in Excel (start it below), or after the switch.</span></div>';
    if(!GM || GM.year !== +GY || GM.office !== GO){ if(!gLoading) setTimeout(gLoad, 0); return h + '<div class="muted" style="margin-top:10px">Loading…</div></div>'; }
    var n = Object.keys(GEDIT).length;
    h += '<div class="tw" style="margin-top:10px"><table class="gt"><thead><tr><th>'+esc(GM.tab)+'</th>'+MO.map(function(m){ return '<th class="num">'+m+'</th>'; }).join('')+'</tr></thead><tbody>'+
      GM.rows.map(function(row){
        var all = row.key === 'days' || row.cells.some(function(x){ return x.rule.kind === 'times'; });
        return '<tr><td class="gl"><b>'+GLAB[row.key]+'</b><div class="muted" style="font-size:11.5px;max-width:190px">'+esc(row.label)+'</div>'+
          (all && row.key !== 'total' ? '<input class="gall" data-gall="'+row.key+'" placeholder="'+(row.key === 'days' ? 'all months' : '× all months')+'" inputmode="decimal">' : '')+'</td>'+
          row.cells.map(function(x){ return gCell(row, x); }).join('')+'</tr>';
      }).join('')+'</tbody></table></div>';
    h += '<div id="pdgerr">'+gErrHTML()+'</div>';
    h += '<div class="acts" style="margin-top:10px"><button class="btn" id="pdgsave" data-pd="gsave"'+(n && !busy && !GERR ? '' : ' disabled')+'>'+gSaveLabel()+'</button>'+
      '<button class="btn ghost" data-pd="gdiscard"'+(n ? '' : ' hidden')+'>Discard changes</button></div>';
    return h + '</div>';
  }
  function gErrHTML(){ return GERR ? '<div class="stat warn" style="margin-top:10px"><span>⚠️</span><span class="grow">'+esc(GERR)+'</span></div>' : ''; }
  function gSaveLabel(){ var n = Object.keys(GEDIT).length; return busy === 'gsave' ? 'Saving…' : 'Save '+esc(GO)+' '+esc(GY)+(n ? ' ('+n+' change'+(n > 1 ? 's' : '')+')' : ''); }
  /* While she types: only the dollar figures, the error line and the Save button change - the box
     she is typing in is never redrawn. */
  function gPaint(){
    if(!host) return;
    Object.keys(GPREV).forEach(function(cell){ var td = host.querySelector('td[data-gc="'+cell+'"]'); if(!td) return;
      var gv = td.querySelector('.gv'); if(gv) gv.innerHTML = money(GPREV[cell]); });
    var e = host.querySelector('#pdgerr'); if(e) e.innerHTML = gErrHTML();
    var n = Object.keys(GEDIT).length, b = host.querySelector('#pdgsave'); if(b){ b.textContent = gSaveLabel(); b.disabled = !n || !!busy || !!GERR; }
    var d = host.querySelector('[data-pd=gdiscard]'); if(d) d.hidden = !n;
  }
  function gCell(row, x){
    var r = x.rule, ed = GEDIT[x.cell], dollars = (x.cell in GPREV) ? GPREV[x.cell] : x.value;
    var editable = row.key === 'days' || r.kind === 'times' || r.kind === 'amount' || r.kind === 'empty';
    if(!editable) return '<td class="gc ro" data-gc="'+esc(x.cell)+'" title="'+esc(r.kind === 'sum' ? 'Worked out: TC goal + Medicaid goal' : 'Her formula: =' + r.f)+'"><span class="muted">'+(r.kind === 'sum' ? 'TC + Med' : 'formula')+'</span><div class="gv">'+money(dollars)+'</div></td>';
    var val = ed ? ed.text : (row.key === 'days' ? (r.value == null ? '' : r.value) : r.kind === 'times' ? r.mult : r.kind === 'amount' ? r.value : '');
    var hint = row.key === 'days' ? '' : r.kind === 'times' && !ed ? '× ' + (r.base === 'lyNet' || r.base === 'lyMed' ? 'last yr' : r.base === 'total' ? 'goal' : r.base === 'tc' ? 'TC goal' : r.base === 'stretch' ? 'stretch' : 'goals') : '';
    return '<td class="gc'+(ed ? ' ch' : '')+'" data-gc="'+esc(x.cell)+'"><input data-gcell="'+esc(x.cell)+'" data-grow="'+row.key+'" value="'+esc(val)+'" inputmode="decimal" title="'+esc(row.key === 'days' ? 'Production days' : 'A growth number like 1.05, or a dollar amount')+'">'+
      '<div class="gv">'+(row.key === 'days' ? '' : money(dollars))+(hint ? '<div class="gh">'+hint+'</div>' : '')+'</div></td>';
  }
  /* what a box's text means: a growth number, an amount, or back to the formula */
  function gChange(row, cell, text){
    var t = String(text).replace(/[$,\s×x]/gi, '');
    if(row === 'days') return {cell:cell, set:'amount', value:t === '' ? null : Number(t)};
    if(t === '') return {cell:cell, set:'formula'};
    var v = Number(t); if(!isFinite(v)) return {cell:cell, bad:true};
    return v < 20 ? {cell:cell, set:'times', mult:v} : {cell:cell, set:'amount', value:v};
  }
  var gLoading = false;
  function gLoad(){
    if(gLoading) return; gLoading = true;
    GM = null; GEDIT = {}; GPREV = {}; GERR = '';
    P().goalModel(+GY, GO).then(function(m){ gLoading = false; GM = m; render(); }, function(e){ gLoading = false; GERR = 'Could not read '+GO+' '+GY+': '+((e && e.message) || e); GM = {year:+GY, office:GO, rows:[], tab:''}; render(); });
  }
  function gPreview(){
    clearTimeout(gTimer);
    gTimer = setTimeout(function(){
      var ch = Object.keys(GEDIT).map(function(k){ return GEDIT[k].change; });
      if(ch.some(function(c){ return c.bad; })){ GERR = 'One of the boxes isn’t a number.'; gPaint(); return; }
      if(!ch.length){ GPREV = {}; GERR = ''; gPaint(); return; }
      P().saveGoals(+GY, GO, ch, {preview:true}).then(function(r){ GPREV = {}; r.values.forEach(function(v){ GPREV[v.cell] = v.value; }); GERR = ''; gPaint(); },
        function(e){ GERR = (e && e.message) || String(e); gPaint(); });
    }, 350);
  }

  /* ---------- step 4: start next year ---------- */
  var ACT = {copied:'Copied in', kept:'Kept', empty:'Starts empty', format:'Look fixed'};
  function nextHTML(){
    var ys = IDX ? Object.keys(IDX.years).map(Number).sort(function(a, b){ return a - b; }) : [], last = ys[ys.length - 1];
    if(!last) return '';
    var to = last + 1, have = IDX.years[to], h = '<div class="card"><h2>Start '+to+'</h2>';
    if(IDX.years[last] && IDX.years[last].started && ys.length > 1){
      var st = IDX.years[last].started;
      h += '<p class="sub">'+esc(last)+' was started from '+esc(st.from)+' on '+when(st.at)+(st.by ? ' by '+esc(st.by) : '')+'. Set its goals and production days in <b>Goals &amp; formulas</b> above (choose '+esc(last)+').</p>';
    }
    h += '<p class="sub">Home-Brace sets up '+to+' from '+last+' the way Heather does each January: the year names move on one, '+last+'’s numbers become “last year”, '+to+'’s goals start as '+last+'’s actuals × her growth numbers, and everything typed each month starts empty. You see every row before anything is saved. Best done once '+last+' is complete; you can look any time.</p>';
    if(!NEXT){
      h += '<button class="btn" data-pd="nextprev"'+(busy ? ' disabled' : '')+'>'+(busy === 'next' ? 'Working it out…' : 'Show me '+to)+'</button>';
      return h + '</div>';
    }
    var n = NEXT, c = {}; n.rows.forEach(function(r){ c[r.action] = (c[r.action] || 0) + 1; });
    h += '<div class="stat '+(n.flags.length ? 'warn' : 'ok')+'"><span>'+(n.flags.length ? '👀' : '✓')+'</span><span class="grow"><b>'+esc(n.to)+' from '+esc(n.from)+'</b>: '+
      Object.keys(ACT).filter(function(k){ return c[k]; }).map(function(k){ return c[k]+' row'+(c[k] > 1 ? 's' : '')+' '+ACT[k].toLowerCase(); }).join(' · ')+
      (n.flags.length ? '. <b>'+n.flags.length+' thing'+(n.flags.length > 1 ? 's' : '')+' to check</b>, below.' : '.')+'</span></div>';
    if(n.exists) h += '<div class="stat warn" style="margin-top:8px"><span>⚠️</span><span class="grow">'+esc(n.to)+' is already kept - creating it again is refused, so nothing typed for '+esc(n.to)+' can be lost.</span></div>';
    if(n.flags.length) h += '<div class="lg" style="margin-top:10px"><div class="e"><div class="when">To check</div><ul>'+n.flags.map(function(f){ return '<li><b>'+esc(f.tab)+'</b> · '+esc(f.label)+' — '+esc(f.flag)+'</li>'; }).join('')+'</ul></div></div>';
    var tabs = []; n.rows.forEach(function(r){ if(tabs.indexOf(r.tab) < 0) tabs.push(r.tab); });
    h += '<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">'+tabs.map(function(t){
      var rs = n.rows.filter(function(r){ return r.tab === t; });
      return '<details'+(nextOpen[t] ? ' open' : '')+' data-pdtab="'+esc(t)+'"><summary style="cursor:pointer;font-weight:700">'+esc(t)+' <span class="muted" style="font-weight:400">('+rs.length+' rows)</span></summary><div class="tw" style="margin-top:6px"><table><thead><tr><th>Row in '+esc(n.to)+'</th><th>What happens</th><th>Where from</th><th class="num">First values</th></tr></thead><tbody>'+
        rs.map(function(r){ return '<tr><td>'+esc(r.now || '(no name)')+'</td><td>'+esc(ACT[r.action] || r.action)+'</td><td>'+esc(r.source || '')+'</td><td class="num">'+r.sample.map(fmtVal).join(' · ')+'</td></tr>'; }).join('')+'</tbody></table></div></details>';
    }).join('')+'</div>';
    h += '<div class="acts" style="margin-top:12px"><button class="btn ghost" data-pd="nextdl"'+(busy ? ' disabled' : '')+'>'+(busy === 'nextdl' ? 'Building…' : '⬇ Download the '+esc(n.to)+' preview as Excel')+'</button>'+
      (n.exists ? '' : '<button class="btn" data-pd="nextgo"'+(busy ? ' disabled' : '')+'>'+(busy === 'nextgo' ? 'Creating…' : 'Create '+esc(n.to))+'</button>')+
      '<button class="btn ghost" data-pd="nextclose">Close</button></div>';
    return h + '</div>';
  }
  function save(blob, name){ var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500); }

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
    return Promise.all([P().index(), P().mode()]).then(function(x){ IDX = x[0]; MODE = x[1]; if(open) return P().log(open).then(function(l){ LOGS[open] = l; }); })
      .then(render, function(e){ say('warn','⚠️','Could not read what is kept: '+esc(e.message||e)); render(); });
  }
  function readFile(input){ var f = input.files && input.files[0]; input.value = ''; return f ? f.arrayBuffer().then(function(ab){ return {name:f.name, bytes:new Uint8Array(ab)}; }) : Promise.resolve(null); }

  function onClick(e){
    var b = e.target.closest('[data-pd]'); if(!b || !host.contains(b) || b.tagName === 'INPUT') return;
    var act = b.dataset.pd, y = b.dataset.y;
    if(act === 'sync'){
      busy = 'sync'; msg = null; render();
      P().syncFromWorkbook({force:true}).then(function(r){
        busy = '';
        if(r && r.skipped) say('info','ℹ️','Nothing to copy ('+esc(r.skipped)+').');
        else if(r && r.compared) say(r.differ ? 'warn' : 'ok', r.differ ? '⚠️' : '✓', r.differ ? 'Her Excel differs from Home-Brace in <b>'+r.differ+' number'+(r.differ > 1 ? 's' : '')+'</b> (listed below). Home-Brace’s numbers were not changed.' : 'Her Excel matches Home-Brace.');
        else say(r.check.differ ? 'warn' : 'ok', r.check.differ ? '⚠️' : '✓', summary(r));
        LOGS = {}; return refresh();
      }).catch(function(err){ busy = ''; say('warn','⚠️','That did not work: '+esc(err.message||err)+' Nothing was changed.'); render(); });
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
    if(act === 'swopen'){ sw = 'to'; render(); }
    if(act === 'swback'){ sw = 'back'; render(); }
    if(act === 'swcancel'){ sw = null; render(); }
    if(act === 'swgo'){
      var mirror = !!(host.querySelector('#pdmirror') || {}).checked;
      busy = 'sw'; render();
      (live() ? P().syncFromWorkbook({force:true}) : Promise.resolve(null)).then(function(r){
        if(r && r.check && r.check.differ) throw new Error('The last copy of her Excel has '+r.check.differ+' formulas that came out differently. Nothing was switched.');
        return P().setMode({source:'homebrace', mirror:mirror});
      }).then(function(){ busy = ''; sw = null; say('ok','✓','<b>Switched.</b> The dashboard and Enter Production now use Home-Brace’s numbers'+(mirror ? ', and keep Heather’s Excel up to date too.' : '.')); return refresh(); },
        function(err){ busy = ''; say('warn','⚠️','Not switched: '+esc(err.message||err)); render(); });
    }
    if(act === 'swbackgo'){
      busy = 'sw'; render();
      P().setMode({source:'excel'}).then(function(){ busy = ''; sw = null; say('ok','✓','Switched back: the dashboard and Enter Production use Heather’s Excel again.'); return refresh(); },
        function(err){ busy = ''; say('warn','⚠️','Not switched back: '+esc(err.message||err)); render(); });
    }
    if(act === 'mirror'){
      busy = 'mirror'; render();
      P().setMode({mirror:!(MODE && MODE.mirror)}).then(function(){ busy = ''; return refresh(); }, function(err){ busy = ''; say('warn','⚠️',esc(err.message||err)); render(); });
    }
    if(act === 'nextprev'){
      busy = 'next'; render();
      P().previewNextYear().then(function(pv){ busy = ''; NEXT = pv; nextOpen = {}; render(); }, function(err){ busy = ''; say('warn','⚠️','Could not work out next year: '+esc(err.message||err)); render(); });
    }
    if(act === 'nextclose'){ NEXT = null; render(); }
    if(act === 'gdiscard'){ GEDIT = {}; GPREV = {}; GERR = ''; render(); }
    if(act === 'gsave'){
      var ch = Object.keys(GEDIT).map(function(k){ return GEDIT[k].change; });
      busy = 'gsave'; render();
      P().saveGoals(+GY, GO, ch).then(function(r){ busy = ''; say('ok','✓','<b>'+esc(GO)+' '+esc(GY)+' saved</b>: '+r.changes.length+' change'+(r.changes.length > 1 ? 's' : '')+' (in '+esc(GY)+'’s History).'); LOGS = {}; GM = null; return refresh(); },
        function(e){ busy = ''; GERR = (e && e.message) || String(e); render(); });
    }
    if(act === 'nextdl' && NEXT){
      busy = 'nextdl'; render();
      var B = global.PH_BOOK, nb = B.withData(NEXT.template, NEXT.data);
      B.exportXlsxSmall(nb, NEXT.data, B.evaluate(nb)).then(function(bytes){
        save(new Blob([bytes], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), NEXT.to+' PRODUCTION DASHBOARD (preview from Home-Brace).xlsx'); busy = ''; render();
      }, function(err){ busy = ''; say('warn','⚠️','Could not build the preview Excel: '+esc(err.message||err)); render(); });
    }
    if(act === 'nextgo' && NEXT){
      busy = 'nextgo'; render();
      P().createNextYear(NEXT).then(function(r){ busy = ''; NEXT = null; say('ok','✓','<b>'+esc(r.year)+' is started</b>: '+r.numbers.toLocaleString('en-US')+' numbers carried in'+(r.flags ? ', '+r.flags+' things noted to check (in its History)' : '')+'.'); LOGS = {}; return refresh(); },
        function(err){ busy = ''; say('warn','⚠️','Not created: '+esc(err.message||err)); render(); });
    }
    if(act === 'useit' && pending){
      var p = pending, mode = (host.querySelector('input[name=pdmode]:checked') || {}).value || 'take';
      pending = null; busy = 'up'; render();
      P().copyFromBytes(p.bytes, {how:'upload', name:p.name, layoutOnly: mode === 'keep'}).then(function(r){
        busy = ''; say(r.check.differ ? 'warn' : 'ok', r.check.differ ? '⚠️' : '✓', summary(r)); LOGS = {}; return refresh();
      }, function(err){ busy = ''; say('warn','⚠️','That did not work: '+esc(err.message||err)+' Nothing was changed.'); render(); });
    }
  }
  function onToggle(e){ var d = e.target; if(d && d.dataset && d.dataset.pdtab) nextOpen[d.dataset.pdtab] = d.open; }
  function onInput(e){
    var t = e.target; if(!t.dataset || !host.contains(t)) return;
    if(t.dataset.gcell){ GEDIT[t.dataset.gcell] = {text:t.value, change:gChange(t.dataset.grow, t.dataset.gcell, t.value)}; t.parentNode.classList.add('ch'); gPreview(); }
  }
  function onChange(e){
    var t = e.target;
    if(t.dataset && t.dataset.gall && GM && host.contains(t)){
      var row = GM.rows.filter(function(r){ return r.key === t.dataset.gall; })[0], v = t.value;
      if(row && v !== '') row.cells.forEach(function(x){ var k = x.rule.kind; if(row.key === 'days' || k === 'times' || k === 'amount' || k === 'empty') GEDIT[x.cell] = {text:v, change:gChange(row.key, x.cell, v)}; });
      render(); gPreview(); return;
    }
    if(t.dataset && t.dataset.pd === 'gy'){ GY = t.value; gLoad(); return; }
    if(t.dataset && t.dataset.pd === 'go'){ GO = t.value; gLoad(); return; }
    if(!t.dataset || !t.dataset.pd || !host.contains(t)) return;
    if(t.dataset.pd === 'file'){
      busy = 'file'; msg = null; render();
      readFile(t).then(function(f){ if(!f){ busy = ''; render(); return; }
        // After the switch a workbook is compared, as her Excel is on the live site - never copied over Home-Brace.
        if(MODE && MODE.source === 'homebrace') return P().compareFromBytes(f.bytes, {how:'upload', name:f.name}).then(function(r){ busy = '';
          say(r.differ ? 'warn' : 'ok', r.differ ? '⚠️' : '✓', r.differ ? 'That workbook differs from Home-Brace in <b>'+r.differ+' number'+(r.differ > 1 ? 's' : '')+'</b> (listed below). Home-Brace’s numbers were not changed.' : 'That workbook matches Home-Brace.'); return refresh(); });
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
    if(host !== el){ host = el; host.addEventListener('click', onClick); host.addEventListener('change', onChange); host.addEventListener('input', onInput); host.addEventListener('toggle', onToggle, true); }
    render(); refresh();
  }
  global.PH_PRODUI = {mount:mount};
})(window);
