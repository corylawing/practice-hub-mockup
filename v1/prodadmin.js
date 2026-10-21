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
  var FY = null, FT = null, FM = null, FQ = '', FED = null, FMSG = null, fTimer = null, fLoading = false;   // Formulas
  var PY = null, PO = null, PM = null, PD = null, PDIRTY = false, PPREV = null, PERR = '', PMSG = null, POPEN = {}, pTimer = null, pLoading = false, ADV = false;   // Plan, Advanced

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
  CSS += '.pd .fxbar{align-items:center}.pd .fxbar input[type=search]{flex:1;min-width:180px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;font:inherit;font-size:13.5px}'+
    '.pd .fxlist{display:flex;flex-direction:column;margin-top:12px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}'+
    '.pd .fxrow{padding:11px 14px;border-bottom:1px solid var(--line)}.pd .fxrow:last-child{border-bottom:0}.pd .fxrow.open{background:#F7FAFC}'+
    '.pd .fxname{font-weight:700;color:var(--navy);font-size:14px;margin-bottom:3px}'+
    '.pd .fxg{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-size:13.5px;padding:2px 0}'+
    '.pd .fxw{min-width:70px;font-weight:700;color:var(--soft);font-size:12px}.pd .fxf{flex:1;min-width:200px;line-height:1.9}'+
    '.pd .fxn{display:inline-block;padding:0 7px;border-radius:7px;background:#EEF4FA;border:1px solid #cfe0ef;color:#14496c;font-weight:600;font-size:12.5px;line-height:1.7}'+
    '.pd .fxn .fxt{color:#5d7a93;font-weight:500}.pd .fxn .fxc{display:inline-block;margin-left:4px;padding:0 5px;border-radius:5px;background:#fff;border:1px solid #cfe0ef;font-size:11.5px}'+
    '.pd .fxed{margin-top:10px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff;display:flex;flex-direction:column;gap:8px}'+
    '.pd .fxlab{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--soft)}'+
    '.pd .fxms{display:flex;flex-wrap:wrap;gap:6px;align-items:center}'+
    '.pd .fxm{border:1px solid #D5DCE5;background:#fff;border-radius:8px;padding:4px 9px;font:inherit;font-size:12.5px;cursor:pointer;color:var(--ink)}.pd .fxm.on{background:var(--teal);border-color:var(--teal);color:#fff;font-weight:700}'+
    '.pd #fxtext{width:100%;box-sizing:border-box;min-height:60px;padding:9px 11px;border:1.5px solid #C9D3DF;border-radius:10px;font:500 14px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;resize:vertical;color:var(--ink);background:#fff}'+
    '.pd #fxtext:focus{outline:none;border-color:var(--teal)}'+
    '.pd .fxtools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.pd .fxtools input{flex:1;min-width:200px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;font:inherit;font-size:13.5px}'+
    '.pd .fxops{display:flex;gap:4px}.pd .fxops .btn{min-width:32px}.pd .fxhint{font-size:12px;color:var(--soft)}'+
    '.pd .fxex{font-size:13.5px;padding:8px 11px;background:#F2F8F7;border-radius:9px}'+
    '.pd table.fxtb td,.pd table.fxtb th{padding:5px 7px;font-size:12.5px}.pd table.fxtb td.ch{background:var(--teal-soft,#E5F4F3);font-weight:700}.pd table.fxtb td.bad{background:#FCEBE8;color:#93301f;font-weight:700}'+
    '.pd .fxalso{font-size:13px}.pd .fxexcel{font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.pd .btn[disabled]{opacity:.45;cursor:not-allowed}';
  CSS += '.pd .plsteps{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 12px}.pd .plyr{border:1px solid var(--line);background:#fff;border-radius:10px;padding:7px 13px;font:inherit;font-size:13.5px;cursor:pointer;color:var(--ink)}'+
    '.pd .plyr.on{border-color:var(--teal);background:var(--teal-soft,#E5F4F3);font-weight:700}.pd .plyr small{display:block;font-size:11px;font-weight:500;color:var(--soft)}'+
    '.pd .plstep{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--soft);margin:6px 0 6px}'+
    '.pd .ploffs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.pd .ploff{border:1px solid #D5DCE5;background:#fff;border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer;color:var(--ink)}'+
    '.pd .ploff.on{background:var(--teal);border-color:var(--teal);color:#fff;font-weight:700}.pd .ploff .ok{color:#1d6b45;font-weight:800}.pd .ploff.on .ok{color:#fff}'+
    '.pd .pltiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin:10px 0}'+
    '.pd .pltile{background:#F7FAFC;border:1px solid var(--line);border-radius:12px;padding:12px 14px}.pd .pltile .q{font-size:13px;color:var(--soft);margin-bottom:7px}'+
    '.pd .pltile .a{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:14.5px}.pd .pltile input,.pd .pltile select{padding:6px 8px;border:1.5px solid #C9D3DF;border-radius:8px;font:inherit;font-size:15px;background:#fff;color:var(--ink)}'+
    '.pd .pltile input{width:80px;text-align:right}.pd .pltile .r{font-size:13.5px;margin-top:7px}.pd .pltile .r b{color:var(--navy)}'+
    '.pd .pllink{background:none;border:0;padding:0;color:var(--teal-600,#0F827E);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;margin-top:7px}'+
    '.pd table.pltb td,.pd table.pltb th{padding:4px 4px;font-size:12.5px}.pd table.pltb td.lab{white-space:nowrap;color:var(--soft);font-weight:700;font-size:12px}'+
    '.pd table.pltb input{width:100%;min-width:54px;box-sizing:border-box;padding:4px 5px;border:1px solid #D5DCE5;border-radius:6px;text-align:right;font:inherit;font-size:12.5px;background:#fff;color:var(--ink)}'+
    '.pd table.pltb td.own input{border-color:var(--teal);background:var(--teal-soft,#E5F4F3);font-weight:700}.pd table.pltb tr.sum td{font-weight:700;color:var(--navy)}'+
    '.pd .plnote{font-size:12.5px;color:var(--soft);margin-top:6px}.pd .pltile .pair{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}';

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
    h += planHTML();
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
    h += advHTML();
    if(open) h += '<div class="card"><h2>'+esc(open)+' — history of changes</h2><p class="sub">Newest first: every change, who made it, and where it came from.</p>'+logHTML(open)+'</div>';
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
    var h = '<div class="card"><h2>Goals</h2><p class="sub">Each office’s goals for a year, in Heather’s own terms. In a month, type a <b>growth number</b> (1.05 = last year + 5%) or a <b>dollar amount</b>; empty a month to go back to its formula. Changing one year never changes another, and the Excel download carries the new formulas. Any other calculation: <b>Formulas</b>, below.</p>'+
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

  /* ---------- PLAN THE YEAR (Cory, 21/10/2026: "build the Plan 2027 screen" ... "This all needs to come
     together and make sense and be easy for her year after year to continue"). Her yearly routine in
     one card: choose the year; start it (once, from the year before); plan each office - the growth
     over last year, the stretch, production days, case fees. Everything else is under Advanced. ---------- */
  var MO3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var kfmt = function(v){ return typeof v === 'number' && isFinite(v) && v !== 0 ? (Math.abs(v) >= 1000 ? Math.round(v / 1000).toLocaleString('en-US') + 'k' : String(Math.round(v))) : '—'; };
  var usd = function(v){ return typeof v === 'number' && isFinite(v) ? '$' + Math.round(v).toLocaleString('en-US') : '—'; };
  function plYears(){
    var kept = IDX ? Object.keys(IDX.years).map(Number).sort(function(a, b){ return a - b; }) : [];
    if(!kept.length) return null;
    var now = new Date(), live = P().liveYear(IDX) || kept[kept.length - 1], maxK = kept[kept.length - 1];
    var list = kept.filter(function(y){ return y >= live; }), next = maxK <= live ? maxK + 1 : null;   // next year, until it is started
    if(next) list.push(next);
    // the year she is most likely here for: next year once it is started, or from October on; otherwise this one
    var def = maxK > live ? maxK : now.getMonth() >= 9 ? next : live;
    return {list:list, live:live, next:next || maxK, def:def};
  }
  function planHTML(){
    var Y = plYears(); if(!Y || !global.PH_FX) return '';
    if(!PY || Y.list.indexOf(+PY) < 0) PY = Y.def;
    var started = !!IDX.years[PY];
    var h = '<div class="card" id="pdplan"><h2>Plan the year</h2><p class="sub">Each year has two steps: <b>start it</b> from the year before, then <b>plan each office</b> - '+
      'how much to grow over last year, the stretch, production days and case fees. After that, offices enter their numbers each month in Enter Production.</p>';
    h += '<div class="plsteps">'+Y.list.map(function(y){
      var tag = y === Y.live ? 'this year' : y > Y.live ? (IDX.years[y] ? 'next year' : 'next year · not started') : '';
      return '<button type="button" class="plyr'+(y === +PY ? ' on' : '')+'" data-pd="plyear" data-y="'+y+'">'+y+(tag ? '<small>'+tag+'</small>' : '')+'</button>'; }).join('')+'</div>';
    if(!started){
      h += '<div class="plstep">Step 1 · Start '+esc(PY)+'</div>'+nextBody()+'<div class="plstep" style="margin-top:14px;opacity:.6">Step 2 · Plan each office</div><div class="muted" style="font-size:13px">Once '+esc(PY)+' is started.</div>';
      return h + '</div>';
    }
    var st = IDX.years[PY].started;
    h += '<div class="plstep">'+(st ? 'Step 1 · ✓ Started from '+esc(st.from)+' on '+when(st.at)+(st.by ? ' by '+esc(st.by) : '') : esc(PY)+' is kept by Home-Brace')+'</div>';
    if(MODE && MODE.source !== 'homebrace' && IDX.source && +IDX.source.year === +PY)
      h += '<div class="stat warn" style="margin:6px 0 10px"><span>⚠️</span><span class="grow">'+esc(PY)+' is still copied from Heather’s Excel, so her next save puts her goals back. Plan here the year she doesn’t keep in Excel'+(Y.list.indexOf(Y.next) >= 0 ? ' ('+Y.next+')' : '')+', or after the switch.</span></div>';
    h += '<div class="plstep">Step 2 · Plan each office</div>';
    if(!PM || PM.year !== +PY || (PO && PM.office !== PO)){ if(!pLoading) setTimeout(pLoad, 0); return h + '<div class="muted">Loading…</div></div>'; }
    if(PM.err) return h + '<div class="stat warn"><span>⚠️</span><span class="grow">'+esc(PM.err)+'</span></div></div>';
    h += '<div class="ploffs">'+PM.offices.map(function(o){ var done = PM.planned && PM.planned[o];
      return '<button type="button" class="ploff'+(o === PM.office ? ' on' : '')+'" data-pd="ploff" data-o="'+esc(o)+'" title="'+(done ? esc('Planned '+when(done.at)+(done.by ? ' by '+done.by : '')) : 'Not planned yet')+'">'+(done ? '<span class="ok">✓</span> ' : '')+esc(o)+'</button>'; }).join('')+'</div>';
    if(PMSG) h += '<div class="stat '+PMSG.cls+'" style="margin-bottom:10px"><span class="grow">'+PMSG.html+'</span>'+
      (PMSG.at ? '<button class="btn ghost tiny" data-pd="plundo" data-at="'+esc(PMSG.at)+'"'+(busy ? ' disabled' : '')+'>Undo</button>' : '')+
      (PMSG.next ? '<button class="btn tiny" data-pd="ploff" data-o="'+esc(PMSG.next)+'">Next: '+esc(PMSG.next)+' →</button>' : '')+'</div>';
    return h + planEditorHTML() + '</div>';
  }
  /* Step 1, when the year isn't started: the preview of next year, as it was (moved in from its own card). */
  function nextBody(){
    var ys = IDX ? Object.keys(IDX.years).map(Number).sort(function(a, b){ return a - b; }) : [], last = ys[ys.length - 1], to = last + 1;
    var h = '<p class="sub" style="margin-bottom:8px">Home-Brace sets up '+to+' from '+last+' the way Heather does each January: the year names move on one, '+last+'’s numbers become “last year”, and every goal starts as '+last+'’s production × her growth numbers - ready to plan. You see every row before anything is saved. '+
      'It can be started before '+last+' is over: numbers entered later for '+last+' (December, typed in January) follow into '+to+' by themselves.</p>';
    if(!NEXT) return h + '<button class="btn" data-pd="nextprev"'+(busy ? ' disabled' : '')+'>'+(busy === 'next' ? 'Working it out…' : 'Show me '+to)+'</button>';
    var n = NEXT, c = {}; n.rows.forEach(function(r){ c[r.action] = (c[r.action] || 0) + 1; });
    h += '<div class="stat '+(n.flags.length ? 'warn' : 'ok')+'"><span>'+(n.flags.length ? '👀' : '✓')+'</span><span class="grow"><b>'+esc(n.to)+' from '+esc(n.from)+'</b>: '+
      Object.keys(ACT).filter(function(k){ return c[k]; }).map(function(k){ return c[k]+' row'+(c[k] > 1 ? 's' : '')+' '+ACT[k].toLowerCase(); }).join(' · ')+
      (n.flags.length ? '. <b>'+n.flags.length+' thing'+(n.flags.length > 1 ? 's' : '')+' to look at</b> - most are settled in step 2.' : '.')+'</span></div>';
    if(n.flags.length) h += '<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;font-size:13.5px">Things to look at ('+n.flags.length+')</summary><div class="lg" style="margin-top:8px"><div class="e"><ul>'+
      n.flags.map(function(f){ return '<li><b>'+esc(f.tab)+'</b> · '+esc(f.label)+' — '+esc(f.flag)+'</li>'; }).join('')+'</ul></div></div></details>';
    var tabs = []; n.rows.forEach(function(r){ if(tabs.indexOf(r.tab) < 0) tabs.push(r.tab); });
    h += '<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;font-size:13.5px">Every row, tab by tab</summary><div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">'+tabs.map(function(t){
      var rs = n.rows.filter(function(r){ return r.tab === t; });
      return '<details'+(nextOpen[t] ? ' open' : '')+' data-pdtab="'+esc(t)+'"><summary style="cursor:pointer;font-weight:700">'+esc(t)+' <span class="muted" style="font-weight:400">('+rs.length+' rows)</span></summary><div class="tw" style="margin-top:6px"><table><thead><tr><th>Row in '+esc(n.to)+'</th><th>What happens</th><th>Where from</th><th class="num">First values</th></tr></thead><tbody>'+
        rs.map(function(r){ return '<tr><td>'+esc(r.now || '(no name)')+'</td><td>'+esc(ACT[r.action] || r.action)+'</td><td>'+esc(r.source || '')+'</td><td class="num">'+r.sample.map(fmtVal).join(' · ')+'</td></tr>'; }).join('')+'</tbody></table></div></details>';
    }).join('')+'</div></details>';
    return h + '<div class="acts" style="margin-top:12px">'+(n.exists ? '' : '<button class="btn" data-pd="nextgo"'+(busy ? ' disabled' : '')+'>'+(busy === 'nextgo' ? 'Creating…' : 'Create '+esc(n.to))+'</button>')+
      '<button class="btn ghost" data-pd="nextdl"'+(busy ? ' disabled' : '')+'>'+(busy === 'nextdl' ? 'Building…' : '⬇ Preview as Excel')+'</button><button class="btn ghost" data-pd="nextclose">Close</button></div>';
  }
  /* What a month box shows: its own %, a dollar goal, or nothing (it follows the usual %). */
  function plCellText(x){ return x.amount != null ? '$' + Math.round(x.amount).toLocaleString('en-US') : x.own != null ? String(x.own) : ''; }
  function plParse(text, main){
    var t = String(text).replace(/[,\s%]/g, '');
    if(t === '') return {own:null, amount:null};
    var dollar = /^\$/.test(t), n = Number(t.replace(/^\$/, ''));
    if(!isFinite(n)) return {bad:true};
    if(dollar || n >= 1000) return {own:null, amount:n};
    return {own:main != null && n === main ? null : n, amount:null};
  }
  function plRun(list){                                   // [0,1,2,5] -> "Jan–Mar, Jun"
    var out = [], i = 0; while(i < list.length){ var j = i; while(j + 1 < list.length && list[j + 1] === list[j] + 1) j++; out.push(j > i ? MO3[list[i]] + '–' + MO3[list[j]] : MO3[list[i]]); i = j + 1; } return out.join(', ');
  }
  function plNotes(L, what){
    if(!L) return '';
    var by = {}; L.months.forEach(function(x, i){ if(x.note && x.own == null && x.amount == null) (by[x.note] = by[x.note] || []).push(i); });
    return Object.keys(by).map(function(note){
      return '<div class="plnote">'+esc(plRun(by[note]))+': '+esc(note)+' - '+(L.main != null ? 'the plan gives '+(by[note].length > 1 ? 'them' : 'it')+' '+what+' + '+L.main+'% like the other months.' : 'they get the usual % once one is typed.')+'</div>';
    }).join('');
  }
  function planEditorHTML(){
    var m = PM, D = PD, L = PREVYEAR(), pv = PPREV, med = m.med;
    var lyTot = m.ly ? m.ly.reduce(function(s, v, i){ return s + (v || 0) + (m.lyMed && m.lyMed[i] || 0); }, 0) : 0;
    var goalSum = 0, stSum = 0;
    for(var i = 0; i < 12; i++){ var g = pv ? pv.months[i].goal : (med && m.rows.total ? m.rows.total : m.rows.tc).months[i].value, s2 = pv ? pv.months[i].stretch : m.rows.stretch && m.rows.stretch.months[i].value; goalSum += g || 0; stSum += s2 || 0; }
    var exc = function(Ln){ return Ln ? Ln.months.filter(function(x){ return x.own != null || x.amount != null; }).length : 0; };
    if(POPEN.tc == null) POPEN.tc = exc(D.tc) + exc(D.md) > 0;
    if(POPEN.st == null) POPEN.st = exc(D.st) > 0;
    var h = '<div style="font-size:16px;font-weight:800;color:var(--navy)">'+esc(m.office)+' · '+esc(m.year)+'</div>'+
      '<div class="muted" style="font-size:13px">'+L+' production: <b>'+usd(lyTot)+'</b>'+(med ? ' (TC + Medicaid)' : '')+'</div>';
    h += '<div class="pltiles">'+
      '<div class="pltile"><div class="q">1 · Grow over '+L+' by</div><div class="a"><span class="pair"><input data-pl="tcmain" value="'+esc(D.tc.main == null ? '' : D.tc.main)+'" inputmode="decimal" placeholder="?"> %</span>'+
        (med ? '<span class="pair"><span class="muted">Medicaid</span> <input data-pl="mdmain" value="'+esc(D.md && D.md.main != null ? D.md.main : '')+'" inputmode="decimal" placeholder="?"> %</span>' : '')+'</div>'+
        '<div class="r">'+esc(m.year)+' goal: <b id="plgoal">'+usd(goalSum)+'</b></div>'+
        '<button type="button" class="pllink" data-pd="plopen" data-k="tc">'+(POPEN.tc ? 'Hide the months' : 'Different growth for some months'+(exc(D.tc) + exc(D.md) ? ' ('+(exc(D.tc) + exc(D.md))+')' : ''))+'</button></div>'+
      '<div class="pltile"><div class="q">2 · The stretch goal is</div><div class="a"><select data-pl="stbase"><option value="goal"'+(D.stBase === 'goal' ? ' selected' : '')+'>the goal</option><option value="last"'+(D.stBase === 'last' ? ' selected' : '')+'>'+L+'</option></select> + '+
        '<input data-pl="stmain" value="'+esc(D.st && D.st.main != null ? D.st.main : '')+'" inputmode="decimal" placeholder="?"> %</div>'+
        '<div class="r">Stretch goal: <b id="plst">'+usd(stSum)+'</b></div>'+
        '<button type="button" class="pllink" data-pd="plopen" data-k="st">'+(POPEN.st ? 'Hide the months' : 'Different for some months'+(exc(D.st) ? ' ('+exc(D.st)+')' : ''))+'</button></div>'+
      '<div class="pltile"><div class="q">3 · Case fees</div><div class="a">Average $<input data-pl="fee" value="'+esc(D.fee == null ? '' : D.fee)+'" inputmode="decimal" style="width:96px"></div>'+
        (med ? '<div class="a" style="margin-top:6px">Medicaid $<input data-pl="mdfee" value="'+esc(D.mdFee == null ? '' : D.mdFee)+'" inputmode="decimal" style="width:96px"></div>' : '')+
        '<div class="r muted" style="font-size:12.5px">The average turns production into starts.</div></div>'+
    '</div>';
    var row = function(lab, cells, cls){ return '<tr'+(cls ? ' class="'+cls+'"' : '')+'><td class="lab">'+lab+'</td>'+cells.join('')+'</tr>'; };
    var inp = function(key, i, x, main){ return '<td'+(x.own != null || x.amount != null ? ' class="own"' : '')+'><input data-pl="'+key+'" data-i="'+i+'" value="'+esc(plCellText(x))+'" placeholder="'+(main == null ? '' : main)+'" inputmode="decimal" title="A % for '+MO3[i]+', or a dollar goal like $40,000. Empty = the usual %."></td>'; };
    var calc = function(id, f){ var out = []; for(var j = 0; j < 12; j++) out.push('<td class="num" data-plc="'+id+j+'">'+f(j)+'</td>'); return out; };
    var t = '<div class="tw"><table class="pltb"><thead><tr><th></th>'+MO3.map(function(x){ return '<th class="num">'+x+'</th>'; }).join('')+'</tr></thead><tbody>';
    t += row(L, calc('ly', function(j){ return kfmt((m.ly ? m.ly[j] || 0 : 0) + (m.lyMed ? m.lyMed[j] || 0 : 0)); }));
    if(POPEN.tc){ t += row('Growth %', D.tc.months.map(function(x, j){ return inp('tc', j, x, D.tc.main); }));
                  if(med && D.md) t += row('Medicaid %', D.md.months.map(function(x, j){ return inp('md', j, x, D.md.main); })); }
    t += row(esc(m.year)+' goal', calc('g', function(j){ return kfmt(pv ? pv.months[j].goal : (med && m.rows.total ? m.rows.total : m.rows.tc).months[j].value); }), 'sum');
    if(POPEN.st && D.st) t += row('Stretch %', D.st.months.map(function(x, j){ return inp('st', j, x, D.st.main); }));
    t += row('Stretch goal', calc('s', function(j){ return kfmt(pv ? pv.months[j].stretch : m.rows.stretch && m.rows.stretch.months[j].value); }));
    if(D.days) t += row('Production days', D.days.map(function(v, j){ return '<td><input data-pl="days" data-i="'+j+'" value="'+esc(v == null ? '' : v)+'" placeholder="'+esc(m.lyDays && m.lyDays[j] != null ? m.lyDays[j] : '')+'" inputmode="decimal" title="Production days in '+MO3[j]+' '+m.year+(m.lyDays && m.lyDays[j] != null ? ' (grey = '+L+')' : '')+'"></td>'; }));
    t += '</tbody></table></div>';
    h += t;
    if(D.days && m.lyDays && D.days.some(function(v){ return v == null; }) && m.lyDays.some(function(v){ return v != null; }))
      h += '<button type="button" class="pllink" data-pd="pldays">Use '+L+'’s production days for the empty months</button>';
    h += '<div id="plnotes">'+plNotesAll()+'</div>';
    var idx = m.offices.indexOf(m.office), nxt = m.offices[idx + 1];
    h += '<div class="acts" style="margin-top:12px;align-items:center"><button class="btn" id="plsave" data-pd="plsave"'+(plCanSave() ? '' : ' disabled')+'>'+plSaveLabel()+'</button>'+
      '<button class="btn ghost" id="pldiscard" data-pd="pldiscard"'+(PDIRTY ? '' : ' hidden')+'>Discard changes</button>'+
      (nxt ? '<button class="btn ghost" data-pd="ploff" data-o="'+esc(nxt)+'">Next: '+esc(nxt)+' →</button>' : '')+'</div>';
    return h;
  }
  function PREVYEAR(){ return String((PM ? PM.year : +PY) - 1); }
  function plNotesAll(){
    var h = '';
    if(PERR) h += '<div class="stat warn" style="margin-top:8px"><span>⚠️</span><span class="grow">'+esc(PERR)+'</span></div>';
    if(PPREV && PPREV.blocked) h += '<div class="stat warn" style="margin-top:8px"><span>⚠️</span><span class="grow">That gives '+esc(PPREV.blocked[0].err)+' in '+esc(PPREV.blocked.map(function(b){ return b.head; }).join(', '))+' - it can’t be saved like this.</span></div>';
    if(PD){ h += plNotes(PD.tc, PREVYEAR()) + (PD.md ? plNotes(PD.md, PREVYEAR() + '’s Medicaid') : '') + plNotes(PD.st, PD.stBase === 'goal' ? 'the goal' : PREVYEAR());
      if(PD.tc && PD.tc.main == null) h += '<div class="plnote"><b>No usual growth yet</b> - type the % '+esc(PM.office)+' should grow over '+PREVYEAR()+'.</div>'; }
    if(PPREV && PPREV.changes.length) h += '<div class="plnote">'+PPREV.changes.length+' box'+(PPREV.changes.length > 1 ? 'es' : '')+' change when you save.</div>';
    return h;
  }
  function plCanSave(){ return !!(PDIRTY && PPREV && PPREV.changes.length && !PPREV.blocked && !PERR && !busy); }
  function plSaveLabel(){ return busy === 'plsave' ? 'Saving…' : 'Save '+esc(PM ? PM.office : '')+'’s plan'; }
  function pLoad(){
    if(pLoading) return; pLoading = true;
    var o = PO || (PM && PM.office) || Object.keys(global.PH_WB.TABS)[0];
    P().planModel(+PY, o).then(function(m){ pLoading = false; PM = m; PO = m.office; PD = P().planDraft(m); PDIRTY = false; PPREV = null; PERR = ''; POPEN = {}; render(); },
      function(e){ pLoading = false; PM = {year:+PY, office:o, err:'Could not read '+o+' '+PY+': '+((e && e.message) || e), offices:[]}; render(); });
  }
  /* While she types: the worked-out rows, the totals, the notes and Save change - never the box she is in. */
  function pPaint(){
    if(!host || !PM || !PD) return;
    var pv = PPREV, med = PM.med, gs = 0, ss = 0;
    for(var j = 0; j < 12; j++){
      var g = pv ? pv.months[j].goal : null, st = pv ? pv.months[j].stretch : null; gs += g || 0; ss += st || 0;
      var cg = host.querySelector('[data-plc="g'+j+'"]'), cs2 = host.querySelector('[data-plc="s'+j+'"]');
      if(pv && cg) cg.textContent = kfmt(g); if(pv && cs2) cs2.textContent = kfmt(st);
    }
    if(pv){ var a = host.querySelector('#plgoal'), b = host.querySelector('#plst'); if(a) a.textContent = usd(gs); if(b) b.textContent = usd(ss); }
    var n = host.querySelector('#plnotes'); if(n) n.innerHTML = plNotesAll();
    var sv = host.querySelector('#plsave'); if(sv){ sv.disabled = !plCanSave(); sv.innerHTML = plSaveLabel(); }
    var dc = host.querySelector('#pldiscard'); if(dc) dc.hidden = !PDIRTY;
  }
  function pPreview(){
    clearTimeout(pTimer);
    pTimer = setTimeout(function(){
      if(!PM || !PD) return;
      var snap = PD;
      P().planSave(+PY, PM.office, P().planPayload(PD), {preview:true}).then(function(r){ if(PD !== snap) return; PPREV = r; PERR = ''; pPaint(); },
        function(e){ if(PD !== snap) return; PPREV = null; PERR = (e && e.message) || String(e); pPaint(); });
    }, 250);
  }
  function plEdit(t){
    var k = t.dataset.pl, v = t.value, i = +t.dataset.i, num = function(x){ var n = Number(String(x).replace(/[$,\s%]/g, '')); return String(x).trim() === '' ? null : isFinite(n) ? n : NaN; };
    PERR = '';
    if(k === 'tcmain' || k === 'mdmain' || k === 'stmain'){
      var L = k === 'tcmain' ? PD.tc : k === 'mdmain' ? PD.md : PD.st, n = num(v);
      if(n !== n){ PERR = 'The growth needs to be a number, like 4.'; }
      else { var old = L.main; L.main = n;
        L.months.forEach(function(x){ if(x.own != null && x.own === n) x.own = null; });          // a month equal to the usual % just follows it
        if(old != null && n == null) L.months.forEach(function(x){ if(x.own == null && x.amount == null && x.was === old) x.own = old; }); }
    } else if(k === 'tc' || k === 'md' || k === 'st'){
      var Ln = k === 'tc' ? PD.tc : k === 'md' ? PD.md : PD.st, r = plParse(v, Ln.main);
      if(r.bad) PERR = MO3[i]+': type a %, like 4, or a dollar goal, like $40,000.';
      else { Ln.months[i].own = r.own; Ln.months[i].amount = r.amount; t.parentNode.classList.toggle('own', r.own != null || r.amount != null); }
    } else if(k === 'days'){ var dn = num(v); if(dn !== dn) PERR = MO3[i]+': days need to be a number.'; else PD.days[i] = dn; }
    else if(k === 'fee' || k === 'mdfee'){ var fn = num(v); if(fn !== fn) PERR = 'A case fee needs to be a number.'; else PD[k === 'fee' ? 'fee' : 'mdFee'] = fn; }
    PDIRTY = true; PPREV = null; pPaint(); if(!PERR) pPreview();
  }
  function plSave(){
    if(!plCanSave()) return;
    busy = 'plsave'; pPaint();
    var o = PM.office, y = PM.year, idx = PM.offices.indexOf(o), nxt = PM.offices[idx + 1] || null;
    P().planSave(y, o, P().planPayload(PD)).then(function(r){
      busy = ''; LOGS = {}; PMSG = {cls:'ok', html:'✓ <b>'+esc(o)+'’s '+esc(y)+' plan is saved</b>'+(r.next && r.next.changes ? ' ('+esc(r.next.year)+'’s “last year” followed)' : '')+'.', at:r.at, next:nxt};
      PM = null; PO = o; pLoad();
    }, function(e){ busy = ''; PERR = (e && e.message) || String(e); pPaint(); });
  }
  function plGo(o){
    if(PDIRTY && PM && o !== PM.office){ PERR = 'Save or discard '+PM.office+'’s changes first.'; pPaint(); return; }
    PO = o; PM = null; PMSG = PMSG && PMSG.next === o ? null : PMSG; render();
  }

  /* ---------- Advanced: goals box by box, and every formula - for what the plan doesn't cover ---------- */
  function advHTML(){
    if(!IDX || !Object.keys(IDX.years).length) return '';
    var h = '<div class="card"><div class="acts" style="justify-content:space-between;align-items:center;flex-wrap:nowrap"><div><h2 style="margin:0">Advanced</h2>'+
      '<p class="sub" style="margin:4px 0 0">Goals box by box, and every formula in plain words - for changes the plan doesn’t cover.</p></div>'+
      '<button class="btn ghost tiny" data-pd="adv">'+(ADV ? 'Hide' : 'Show')+'</button></div></div>';
    return ADV ? h + goalsHTML() + fxHTML() : h;
  }

  /* ---------- formulas: every calculation, in plain words (Cory: "clear and easy ux so she can and
     others can manage this") ---------- */
  var nrm = function(v){ return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim(); };
  function fmtNum(v){
    if(v === '' || v == null) return '—';
    if(typeof v !== 'number') return esc(v);
    return Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 100) / 100);
  }
  /* A formula with its row names as chips: [Carlsbad (FFO) › Net Production · Jan] */
  function pretty(named){
    return esc(named).replace(/\[([^\]]*)\]/g, function(_, inner){
      var k = inner.indexOf(' › '), tab = k >= 0 ? '<span class="fxt">'+inner.slice(0, k)+' ›</span> ' : '', rest = k >= 0 ? inner.slice(k + 3) : inner;
      var d = rest.lastIndexOf(' · '), col = d >= 0 ? '<span class="fxc">'+rest.slice(d + 3)+'</span>' : '';
      return '<span class="fxn">'+tab+(d >= 0 ? rest.slice(0, d) : rest)+col+'</span>';
    }).replace(/\{([^}]*)\}/g, '<span class="fxn">$1</span>');
  }
  function fxRun(cols, row){
    var heads = {}; ((FM && FM.rows.filter(function(r){ return r.row === row; })[0]) || {boxes:[]}).boxes.forEach(function(b){ heads[b.c] = b.head; });
    var cs = cols.slice().sort(function(a, b){ return a - b; }), out = [], i = 0;
    while(i < cs.length){ var j = i; while(j + 1 < cs.length && cs[j + 1] === cs[j] + 1) j++;
      out.push(j > i ? (heads[cs[i]] || cs[i])+'–'+(heads[cs[j]] || cs[j]) : (heads[cs[i]] || cs[i])); i = j + 1; }
    return out.join(', ');
  }
  function fxPickTexts(){
    if(!FM) return [];
    var order = function(p){ return (p.tab === FM.tab ? 0 : 1) * 1000 + FM.tabs.concat([p.tab]).indexOf(p.tab); };
    return FM.picks.slice().sort(function(a, b){ return order(a) - order(b) || a.row - b.row; })
      .map(function(p){ return '[' + (p.tab === FM.tab ? '' : p.tab + ' › ') + p.name + (p.one ? ' · ' + p.one : '') + ']'; });
  }
  function fxHTML(){
    var ys = IDX ? Object.keys(IDX.years).sort().reverse() : [];
    if(!ys.length || !global.PH_FX) return '';
    if(!FY || ys.indexOf(String(FY)) < 0) FY = ys[0];
    var h = '<div class="card" id="pdfx"><h2>Formulas</h2><p class="sub">How every number in a year’s book is worked out, in plain words. '+
      'A row like <span class="fxn">2025 Net Production</span> means that row in the same month; one with a column, like <span class="fxn">2025 Average Case Fee<span class="fxc">Jan</span></span>, is that one box. '+
      'Change a formula for one year - other years never change - and the Excel download carries it. Every change goes in History, with Undo.</p>';
    h += '<div class="acts fxbar">Year <select data-pd="fy">'+ys.map(function(y){ return '<option'+(String(y) === String(FY) ? ' selected' : '')+'>'+esc(y)+'</option>'; }).join('')+'</select>';
    if(FM && FM.tabs.length) h += 'Tab <select data-pd="ft">'+FM.tabs.map(function(x){ return '<option'+(x === FM.tab ? ' selected' : '')+'>'+esc(x)+'</option>'; }).join('')+'</select>';
    h += '<input type="search" data-pd="fq" placeholder="Find a row…" value="'+esc(FQ)+'" autocomplete="off"></div>';
    if(MODE && MODE.source !== 'homebrace' && IDX.source && +IDX.source.year === +FY)
      h += '<div class="stat warn" style="margin-top:10px"><span>⚠️</span><span class="grow">'+esc(FY)+' is still copied from Heather’s Excel, so her next save puts her formulas back. Change formulas here for a year she doesn’t keep in Excel (start it below), or after the switch.</span></div>';
    if(FMSG) h += '<div class="stat '+FMSG.cls+'" style="margin-top:10px"><span class="grow">'+FMSG.html+'</span>'+
      (FMSG.at ? '<button class="btn ghost tiny" data-pd="fxundo" data-y="'+esc(FMSG.year)+'" data-at="'+esc(FMSG.at)+'"'+(busy ? ' disabled' : '')+'>Undo</button>' : '')+'</div>';
    if(!FM || FM.year !== +FY || (FT && FM.tab !== FT)){ if(!fLoading) setTimeout(fLoad, 0); return h + '<div class="muted" style="margin-top:10px">Loading…</div></div>'; }
    if(FM.err) return h + '<div class="stat warn" style="margin-top:10px"><span>⚠️</span><span class="grow">'+esc(FM.err)+'</span></div></div>';
    h += '<div class="fxlist">'+fxRowsHTML()+'</div>';
    h += '<datalist id="fxpicks">'+fxPickTexts().map(function(t){ return '<option value="'+esc(t)+'">'; }).join('')+'</datalist>';
    return h + '</div>';
  }
  function fxRowsHTML(){
    var q = nrm(FQ), rows = FM.rows.filter(function(r){ return !q || (FED && FED.row === r.row) || nrm(r.name).indexOf(q) >= 0 || r.groups.some(function(g){ return nrm(g.named).indexOf(q) >= 0; }); });
    if(!rows.length) return '<div class="fxrow muted">No row matches “'+esc(FQ)+'”.</div>';
    return rows.map(function(r){
      var open = !!(FED && FED.row === r.row);
      return '<div class="fxrow'+(open ? ' open' : '')+'"><div class="fxname">'+esc(r.name)+'</div>'+
        r.groups.map(function(g, gi){
          var typed = g.boxes.map(function(b){ return fmtNum(b.typed); });
          var what = g.kind === 'formula' ? pretty(g.named) : g.kind === 'typed' ? '<span class="muted" title="'+esc(typed.join(' · '))+'">'+(typed.length > 3 ? 'typed in each month' : 'typed in: '+typed.join(' · '))+'</span>' : '<span class="muted">empty</span>';
          return '<div class="fxg"><span class="fxw">'+esc(g.when)+'</span><span class="fxf">'+what+'</span>'+
            (open ? '' : '<button class="btn ghost tiny" data-pd="fxedit" data-row="'+r.row+'" data-g="'+gi+'">'+(g.kind === 'formula' ? 'Change' : 'Give a formula')+'</button>')+'</div>';
        }).join('')+(open ? fxEditorHTML(r) : '')+'</div>';
    }).join('');
  }
  function fxEditorHTML(r){
    var E = FED;
    return '<div class="fxed">'+
      '<div class="fxlab">Which months</div><div class="fxms">'+r.boxes.map(function(b){
        return '<button type="button" class="fxm'+(E.cols.indexOf(b.c) >= 0 ? ' on' : '')+'" data-pd="fxcol" data-c="'+b.c+'" title="'+esc(b.kind === 'formula' ? b.named : b.kind === 'typed' ? 'typed in: ' + b.typed : 'empty')+'">'+esc(b.head)+'</button>'; }).join('')+
        '<button type="button" class="btn ghost tiny" data-pd="fxcolall">All</button></div>'+
      '<div class="fxlab">How it’s worked out</div>'+
      '<textarea id="fxtext" rows="2" spellcheck="false" autocomplete="off" aria-label="How it’s worked out">'+esc(E.text)+'</textarea>'+
      '<div class="fxtools"><input id="fxpick" list="fxpicks" placeholder="Add a row: type part of its name, pick it" autocomplete="off">'+
        '<button type="button" class="btn tiny" data-pd="fxins">Add</button><span class="fxops">'+
        ['+', '-', '×', '÷', '(', ')'].map(function(o){ return '<button type="button" class="btn ghost tiny" data-pd="fxop" data-op="'+o+'" title="Add '+o+'">'+o+'</button>'; }).join('')+'</span></div>'+
      '<div class="fxhint">[A row] is that row in the same month · [A row · Jan] is one fixed box · numbers like 1.05 or 5%.</div>'+
      '<div id="fxprev">'+fxPrevHTML()+'</div>'+
      '<div class="acts"><button class="btn" id="fxsave" data-pd="fxsave"'+(fxCanSave() ? '' : ' disabled')+'>'+fxSaveLabel()+'</button><button class="btn ghost" data-pd="fxcancel">Cancel</button></div>'+
    '</div>';
  }
  function fxCanSave(){ var E = FED; return !!(E && E.prev && E.prev.changes.length && !E.prev.blocked && !E.err && !busy); }
  function fxSaveLabel(){ return busy === 'fxsave' ? 'Saving…' : FED && FED.cols.length ? 'Save · '+esc(fxRun(FED.cols, FED.row))+' '+esc(FY) : 'Save'; }
  function fxPrevHTML(){
    var E = FED; if(!E) return '';
    if(E.err) return '<div class="stat warn"><span>⚠️</span><span class="grow">'+esc(E.err)+'</span></div>';
    var p = E.prev;
    if(!p) return '<div class="muted">'+(E.text.trim() ? 'Working it out…' : 'Type how it’s worked out, or add a row.')+'</div>';
    if(!p.changes.length) return '<div class="muted">That’s how '+esc(fxRun(E.cols, E.row))+' '+(E.cols.length > 1 ? 'are' : 'is')+' worked out already.</div>';
    var h = '';
    if(p.blocked) h += '<div class="stat warn"><span>⚠️</span><span class="grow">That gives <b>'+esc(p.blocked[0].err)+'</b> in '+esc(p.blocked.map(function(b){ return b.head; }).join(', '))+
      ' - usually a box holding text, or a row of another kind. It can’t be saved like this.</span></div>';
    if(p.explain) h += '<div class="fxex"><b>'+esc(p.explain.head)+':</b> '+esc(p.explain.text)+' = <b>'+fmtNum(p.explain.value)+'</b></div>';
    h += '<div class="tw"><table class="fxtb"><thead><tr><th></th>'+p.boxes.map(function(b){ return '<th class="num">'+esc(b.head)+'</th>'; }).join('')+'</tr></thead><tbody>'+
      '<tr><td class="muted">Now</td>'+p.boxes.map(function(b){ return '<td class="num">'+fmtNum(b.before)+'</td>'; }).join('')+'</tr>'+
      '<tr><td><b>New</b></td>'+p.boxes.map(function(b){ var moved = !(b.before === b.after || (typeof b.before === 'number' && typeof b.after === 'number' && Math.abs(b.before - b.after) < 1e-9));
        return '<td class="num'+(b.err && b.err !== '#DIV/0!' ? ' bad' : moved ? ' ch' : '')+'"'+(b.err === '#DIV/0!' ? ' title="Divides by an empty box - fine for months not entered yet"' : '')+'>'+fmtNum(b.after)+'</td>'; }).join('')+'</tr></tbody></table></div>';
    if(p.also.length) h += '<div class="fxalso">Also changes: '+p.also.slice(0, 8).map(function(a){ return esc((a.tab !== FM.tab ? a.tab + ' › ' : '') + a.name); }).join(', ')+(p.also.length > 8 ? ' and '+(p.also.length - 8)+' more' : '')+'.</div>';
    if(p.explain) h += '<div class="fxexcel muted">In Excel ('+esc(p.explain.head)+'): '+esc(p.explain.excel)+'</div>';
    return h;
  }
  /* While she types: only the preview, the month buttons and Save change - never the box she is in. */
  function fGrow(){ var ta = host && host.querySelector('#fxtext'); if(ta){ ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 4) + 'px'; } }
  function fPaint(){
    if(!host) return;
    fGrow();
    var box = host.querySelector('#fxprev'); if(box) box.innerHTML = fxPrevHTML();
    var s = host.querySelector('#fxsave'); if(s){ s.disabled = !fxCanSave(); s.innerHTML = fxSaveLabel(); }
    if(FED) host.querySelectorAll('.fxm').forEach(function(m){ m.classList.toggle('on', FED.cols.indexOf(+m.dataset.c) >= 0); });
  }
  function fLoad(){
    if(fLoading) return; fLoading = true;
    P().formulaModel(+FY, FT).then(function(m){ fLoading = false; FM = m; FT = m.tab; render(); },
      function(e){ fLoading = false; FM = {year:+FY, tab:FT, tabs:[], rows:[], picks:[], err:'Could not read '+FY+': '+((e && e.message) || e)}; render(); });
  }
  function fPreview(){
    clearTimeout(fTimer);
    fTimer = setTimeout(function(){
      var E = FED; if(!E) return;
      if(!E.text.trim()){ E.prev = null; E.err = ''; fPaint(); return; }
      if(!E.cols.length){ E.prev = null; E.err = 'Pick at least one month.'; fPaint(); return; }
      var snap = E.text + '|' + E.cols.join(',');
      P().formulaChange(+FY, FT, E.row, E.cols, E.text, {preview:true}).then(function(p){ if(FED !== E || snap !== E.text + '|' + E.cols.join(',')) return; E.prev = p; E.err = ''; fPaint(); },
        function(e){ if(FED !== E) return; E.prev = null; E.err = (e && e.message) || String(e); fPaint(); });
    }, 300);
  }
  function fxOpen(row, gi){
    var r = FM && FM.rows.filter(function(x){ return x.row === row; })[0]; if(!r) return;
    var g = r.groups[gi] || r.groups[0], first = r.groups.filter(function(x){ return x.kind === 'formula'; })[0];
    FED = {row:row, cols:g.cols.slice(), text:g.kind === 'formula' ? g.named : (first ? first.named : ''), prev:null, err:''};
    FMSG = null; render(); fGrow();
    var ta = host.querySelector('#fxtext'); if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    fPreview();
  }
  function fxInsert(text){
    var ta = host.querySelector('#fxtext'); if(!ta || !FED) return;
    var a = ta.selectionStart != null ? ta.selectionStart : ta.value.length, b = ta.selectionEnd != null ? ta.selectionEnd : a;
    var before = ta.value.slice(0, a), pad = before && !/\s$/.test(before) && !/^\s/.test(text) ? ' ' : '';
    ta.value = before + pad + text + ta.value.slice(b); var at = a + pad.length + text.length;
    ta.focus(); ta.setSelectionRange(at, at);
    FED.text = ta.value; FED.prev = null; FED.err = ''; fPaint(); fPreview();
  }
  function fxInsertPick(){
    var inp = host.querySelector('#fxpick'); if(!inp || !FED) return;
    var v = inp.value.trim(); if(!v) return;
    var all = fxPickTexts(), hit = all.indexOf(v) >= 0 ? v : all.filter(function(o){ return nrm(o).indexOf(nrm(v)) >= 0; })[0];
    if(!hit){ FED.err = 'No row matches “'+v+'” - type part of its name and pick it from the list.'; fPaint(); return; }
    inp.value = ''; fxInsert(hit);
  }
  function fxSave(){
    var E = FED; if(!E || !fxCanSave()) return;
    busy = 'fxsave'; fPaint();
    P().formulaChange(+FY, FT, E.row, E.cols, E.text).then(function(r){
      var name = (FM.rows.filter(function(x){ return x.row === E.row; })[0] || {}).name || '';
      busy = ''; FED = null; LOGS = {};
      FMSG = {cls:'ok', html:'✓ Saved: <b>'+esc(name)+'</b> · '+esc(fxRun(E.cols, E.row))+' '+esc(FY)+'.'+(r.next && r.next.changes ? ' '+esc(r.next.year)+'’s “last year” followed.' : ''), at:r.at, year:FY};
      FM = null; fLoad();
    }, function(e){ busy = ''; E.err = (e && e.message) || String(e); fPaint(); });
  }
  function fxUndo(y, at){
    busy = 'fxundo'; render();
    P().formulaUndo(+y, at).then(function(){
      busy = ''; FED = null; FMSG = {cls:'ok', html:'↩ Undone - back to how it was (it’s in History).'}; LOGS = {};
      if(open) P().log(open).then(function(l){ LOGS[open] = l; render(); });
      if(String(y) === String(FY)){ FM = null; fLoad(); } else render();
    }, function(e){ busy = ''; FMSG = {cls:'warn', html:'⚠️ '+esc((e && e.message) || e)}; render(); });
  }
  /* History: one line per row and run of months - "Feb–Dec: [last year] × 1.04 → × 1.06" */
  function fxSide(n, v){ return n ? pretty(n) : typeof v === 'number' ? 'typed '+fmtVal(v) : v == null ? 'empty' : esc(v); }
  function fxLines(chs){
    var out = [], last = null;
    chs.forEach(function(c){
      var k = c.label + '|' + (c.fromN || c.from) + '|' + (c.toN || c.to);
      if(last && last.k === k){ last.heads.push(c.head); return; }
      last = {k:k, c:c, heads:[c.head]}; out.push(last);
    });
    return out.map(function(g){ var hd = g.heads.length > 1 ? g.heads[0]+'–'+g.heads[g.heads.length - 1] : g.heads[0];
      return '<b>'+esc(g.c.label)+'</b> · '+esc(hd)+': '+fxSide(g.c.fromN, g.c.from)+' → '+fxSide(g.c.toN, g.c.to); });
  }

  /* ---------- step 4: start next year ---------- */
  var ACT = {copied:'Copied in', kept:'Kept', empty:'Starts empty', format:'Look fixed'};
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
    var undone = {}; L.forEach(function(e){ if(e.from && e.from.undo) undone[e.from.undo] = 1; });
    return '<div class="lg">'+L.map(function(e){
      // Say where each change came from - not every entry is a copy of her Excel.
      var f = e.from || {}, who = f.by || f.copiedBy, by = who ? ' by '+esc(who) : '';
      var head = '<div class="when">'+when(e.at)+'</div><div class="muted">'+
        (f.how === 'upload' ? 'Uploaded'+(f.copiedBy ? ' by '+esc(f.copiedBy) : '')+(f.name ? ' — '+esc(f.name) : '')
        : f.how === 'enter' ? 'Entered in Enter Production'+by+(f.office ? ' — '+esc(f.office) : '')
        : f.how === 'goals' ? 'Goals'+by+(f.office ? ' — '+esc(f.office) : '')
        : f.how === 'formulas' ? (f.undo ? 'A formula change undone' : 'Formulas changed')+by+(f.tab ? ' — '+esc(f.tab) : '')
        : f.how === 'plan' ? (f.undo ? 'A plan change undone' : 'Plan saved')+by+(f.office ? ' — '+esc(f.office) : '')
        : f.how === 'start' ? 'Started from '+esc(f.fromYear)+by
        : f.how === 'lastyear' ? esc(f.fromYear)+' numbers saved later, carried into “last year”'+by
        : 'Copied from Heather’s Excel'+(f.modified ? ' (her save of '+when(f.modified)+(f.by ? ' by '+esc(f.by) : '')+')' : ''))+'</div>';
      var body = [];
      if(e.first) body.push('<li>'+(f.how === 'start' ? 'Started with ' : 'First copy: ')+(e.numbers||0).toLocaleString('en-US')+' numbers.</li>');
      if(e.layout === 'new') body.push('<li>Layout and formulas saved.</li>');
      else if(e.layout) body.push('<li>Layout or formulas changed: '+e.layout.map(esc).join(', ')+'.</li>');
      if(e.kept) body.push('<li>'+e.kept.moved.toLocaleString('en-US')+' numbers moved into the new layout'+(e.kept.lost.length ? '; <b>'+e.kept.lost.length+' had no place in it</b>: '+e.kept.lost.slice(0,6).map(function(x){ return place(x)+' ('+fmtVal(x.value)+')'; }).join('; ') : '')+'.</li>');
      if(f.how === 'formulas' || f.how === 'plan') fxLines(e.changes || []).forEach(function(l){ body.push('<li>'+l+'</li>'); });
      else (e.changes||[]).slice(0, 40).forEach(function(c){ body.push('<li>'+place(c)+': '+fmtVal(c.from)+' → <b>'+fmtVal(c.to)+'</b></li>'); });
      if((f.how === 'formulas' || f.how === 'plan') && !f.undo) body.push('<li style="list-style:none;margin-left:-18px">'+(undone[e.at] ? '<span class="muted">Undone.</span>'
        : '<button class="btn ghost tiny" data-pd="fxundo" data-y="'+esc(y)+'" data-at="'+esc(e.at)+'"'+(busy ? ' disabled' : '')+'>Undo this change</button>')+'</li>');
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
    if(act === 'plyear'){ if(PDIRTY){ PERR = 'Save or discard '+PM.office+'’s changes first.'; pPaint(); return; } PY = +b.dataset.y; PM = null; PMSG = null; PERR = ''; render(); return; }
    if(act === 'ploff'){ plGo(b.dataset.o); return; }
    if(act === 'plopen'){ POPEN[b.dataset.k] = !POPEN[b.dataset.k]; render(); return; }
    if(act === 'plsave'){ plSave(); return; }
    if(act === 'pldiscard'){ PD = P().planDraft(PM); PDIRTY = false; PPREV = null; PERR = ''; render(); return; }
    if(act === 'pldays' && PD && PM.lyDays){ PD.days = PD.days.map(function(v, i){ return v == null ? PM.lyDays[i] : v; }); PDIRTY = true; PPREV = null; render(); pPreview(); return; }
    if(act === 'plundo'){ busy = 'plundo'; render();
      P().formulaUndo(PM ? PM.year : +PY, b.dataset.at).then(function(){ busy = ''; LOGS = {}; PMSG = {cls:'ok', html:'↩ Undone - the plan is back to how it was (it’s in History).'}; PM = null; pLoad(); },
        function(e){ busy = ''; PMSG = {cls:'warn', html:'⚠️ '+esc((e && e.message) || e)}; render(); }); return; }
    if(act === 'adv'){ ADV = !ADV; render(); return; }
    if(act === 'fxedit'){ fxOpen(+b.dataset.row, +b.dataset.g); return; }
    if(act === 'fxcol' && FED){ var fc = +b.dataset.c, fi = FED.cols.indexOf(fc); if(fi >= 0) FED.cols.splice(fi, 1); else FED.cols.push(fc); FED.prev = null; fPaint(); fPreview(); return; }
    if(act === 'fxcolall' && FED){ var fr = FM.rows.filter(function(x){ return x.row === FED.row; })[0]; FED.cols = fr ? fr.boxes.map(function(x){ return x.c; }) : FED.cols; FED.prev = null; fPaint(); fPreview(); return; }
    if(act === 'fxins'){ fxInsertPick(); return; }
    if(act === 'fxop'){ fxInsert(b.dataset.op === '(' || b.dataset.op === ')' ? b.dataset.op : ' ' + b.dataset.op + ' '); return; }
    if(act === 'fxcancel'){ FED = null; render(); return; }
    if(act === 'fxsave'){ fxSave(); return; }
    if(act === 'fxundo'){ fxUndo(b.dataset.y, b.dataset.at); return; }
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
      // straight on to step 2 for the new year, in the same card
      P().createNextYear(NEXT).then(function(r){ busy = ''; NEXT = null; PY = r.year; PM = null; PO = null;
        PMSG = {cls:'ok', html:'✓ <b>'+esc(r.year)+' is started</b>: '+r.numbers.toLocaleString('en-US')+' numbers carried in. Now plan each office - start with the first one below.'}; LOGS = {}; return refresh(); },
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
    if(t.dataset.pl && t.dataset.pl !== 'stbase' && PD){ plEdit(t); return; }
    if(t.id === 'fxtext' && FED){ FED.text = t.value; FED.prev = null; FED.err = ''; fPaint(); fPreview(); return; }
    if(t.id === 'fxpick' && FED && fxPickTexts().indexOf(t.value) >= 0){ var pk = t.value; t.value = ''; fxInsert(pk); return; }   // picked from the list
    if(t.dataset.pd === 'fq'){ FQ = t.value; var fl = host.querySelector('.fxlist'); if(fl && FM && !FED) fl.innerHTML = fxRowsHTML(); return; }
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
    if(t.dataset && t.dataset.pl === 'stbase' && PD && PM){ var was = PD.st && PD.st.main; PD.stBase = t.value; PD.st = P().planLine(PM, 'stretch', t.value);
      if(PD.st && PD.st.main == null && was != null) PD.st.main = was; PDIRTY = true; PPREV = null; PERR = ''; render(); pPreview(); return; }
    if(t.dataset && t.dataset.pd === 'fy'){ FY = t.value; FED = null; FMSG = null; FM = null; render(); return; }
    if(t.dataset && t.dataset.pd === 'ft'){ FT = t.value; FED = null; FMSG = null; FM = null; render(); return; }
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
    if(host !== el){ host = el; host.addEventListener('click', onClick); host.addEventListener('change', onChange); host.addEventListener('input', onInput); host.addEventListener('toggle', onToggle, true);
      host.addEventListener('keydown', function(e){ if(e.key === 'Enter' && e.target && e.target.id === 'fxpick'){ e.preventDefault(); fxInsertPick(); } }); }
    render(); refresh();
  }
  global.PH_PRODUI = {mount:mount};
})(window);
