/* FORMULAS IN PLAIN WORDS (PH_FX) - every calculation in a year's production book, named the way
   Heather's sheet names things, so it can be read and changed without knowing cell addresses.

   21/10/2026, Cory: "build the formula screen remember clear and easy ux so she can and others can
   manage this". Her 2026 workbook (checked on Cory's Mac, real numbers never in the repo): 1,881
   formulas, only + - * / ( ) SUM AVERAGE. 93% of the boxes they use are "this month, another row
   of this tab"; the rest are one fixed box (the case fee, "$B$29"), a run of a row ("B8:M8"), or a
   row of another tab (the Dashboard). So a formula reads:

     [2025 Net Production] × 1.04                  that row, the same month
     [2025 Average Case Fee · Jan]                 one fixed box: its row and its column's heading
     SUM([this row · Jan–Dec])                     a run of boxes along a row
     [Carlsbad (FFO) › TC Net Production]          a row of another tab, the same month
     [Carlsbad (FFO) (row 46) · Jan]               a row name used twice on a tab gets its row number
     [row 22 · Jan]                                a row with no name
     {B10:M11}                                     anything else, exactly as Excel writes it

   and is turned back into the Excel formula for each month it is used in. Headings are her own:
   "January" reads Jan, "TOTAL" reads Total, and the Dashboard's small tables are headed by years.
   Checked on every formula of her workbook: named and back, the same results, cell for cell. */
(function(global){
  'use strict';
  var B = function(){ return global.PH_BOOK; };
  var MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  var SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function friendly(msg){ var e = new Error(msg); e.friendly = true; return e; }
  function norm(s){ return String(s == null ? '' : s).toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim(); }
  function split(a){ var m = /^([A-Z]+)(\d+)$/.exec(a); return {col:m[1], c:B().colNum(m[1]), r:+m[2]}; }
  function cellsOf(tpl, tab){ return tpl.sheets[tab] ? tpl.sheets[tab].cells : {}; }
  function label(tpl, tab, r){ var x = cellsOf(tpl, tab)['A' + r]; return x && x.f == null && typeof x.v === 'string' ? x.v.trim() : ''; }
  function quote(tab){ return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(tab) ? tab : "'" + tab.replace(/'/g, "''") + "'"; }

  /* Worked out once per tab (and per year's numbers, for the years heading a small table). */
  var MEMO = typeof WeakMap === 'function' ? new WeakMap() : null;
  function memo(o){ if(!MEMO) return {}; var m = MEMO.get(o); if(!m){ m = {}; MEMO.set(o, m); } return m; }

  /* ---------------------------------------------------------------- rows: by the name in column A */
  function rows(tpl, tab){
    var cs = cellsOf(tpl, tab), M = memo(cs); if(M.rows) return M.rows;
    var seen = {}, count = {}, maxC = 1;
    Object.keys(cs).forEach(function(a){ var p = split(a); seen[p.r] = 1; if(p.c > maxC) maxC = p.c; });
    var list = Object.keys(seen).map(Number).sort(function(a, b){ return a - b; });
    list.forEach(function(r){ var L = norm(label(tpl, tab, r)); if(L) count[L] = (count[L] || 0) + 1; });
    var byRow = {}, byName = {};
    list.forEach(function(r){
      var L = label(tpl, tab, r);
      // a name that would read wrongly inside [ ] (it holds [ ] · › { }) goes by its row number
      var n = !L || /[\[\]{}·›]/.test(L) ? 'row ' + r : count[norm(L)] > 1 ? L + ' (row ' + r + ')' : L;
      byRow[r] = n; byName[norm(n)] = r;
    });
    return (M.rows = {list:list, byRow:byRow, byName:byName, maxC:maxC});
  }
  function rowName(tpl, tab, r){ return rows(tpl, tab).byRow[r] || 'row ' + r; }
  function findRow(tpl, tab, name){
    var R = rows(tpl, tab), n = norm(name), m;
    if(n in R.byName) return R.byName[n];
    if((m = /^row (\d+)$/.exec(n))) return +m[1];
    if((m = /^(.*) \(row (\d+)\)$/.exec(n)) && norm(label(tpl, tab, +m[2])) === m[1]) return +m[2];
    return 0;
  }

  /* ---------------------------------------------------------------- columns: by their heading */
  function nice(h){ var i = MONTHS.indexOf(norm(h)); return i >= 0 ? SHORT[i] : /^total$/i.test(h) ? 'Total' : h; }
  /* The nearest heading above a box: text, or a year heading a small table (a year typed in a row
     with no name - "2026 | 2025 | YOY Change" on the Dashboard). Numbers in named rows are numbers. */
  function headOf(ctx, tab, c, r){
    var cs = cellsOf(ctx.tpl, tab), d = (ctx.data && ctx.data[tab]) || {}, col = B().colName(c);
    for(var rr = r - 1; rr >= 1; rr--){
      var x = cs[col + rr], v = x && x.f == null ? x.v : undefined;
      if(x && x.f != null) continue;
      if(typeof v === 'string' && v.trim()) return nice(v.trim());
      var n = d[col + rr] != null ? d[col + rr] : v;
      if(typeof n === 'number' && n === Math.round(n) && n >= 1990 && n <= 2100 && !label(ctx.tpl, tab, rr)) return String(n);
    }
    return '';
  }
  function cols(ctx, tab, r){
    var cs = cellsOf(ctx.tpl, tab), M = memo(cs), dt = (ctx.data && ctx.data[tab]) || null;
    if(!M.cols || M.dt !== dt){ M.dt = dt; M.cols = {}; }
    if(M.cols[r]) return M.cols[r];
    var maxC = Math.max(rows(ctx.tpl, tab).maxC, 14), heads = {}, count = {}, byCol = {}, byName = {}, c;
    for(c = 2; c <= maxC; c++){ heads[c] = headOf(ctx, tab, c, r); if(heads[c]) count[norm(heads[c])] = (count[norm(heads[c])] || 0) + 1; }
    for(c = 2; c <= maxC; c++){
      var h = heads[c], n = h && count[norm(h)] === 1 && !/[\[\]{}·›–—]|^this /i.test(h) && !/^col [a-z]{1,3}$/i.test(h) ? h : 'col ' + B().colName(c);
      byCol[c] = n; byName[norm(n)] = c; byName['col ' + B().colName(c).toLowerCase()] = c;
      var i = SHORT.indexOf(n); if(i >= 0) byName[MONTHS[i]] = c;
    }
    return (M.cols[r] = {byCol:byCol, byName:byName, heads:heads});
  }
  function colName(ctx, tab, c, r){ return cols(ctx, tab, r).byCol[c] || 'col ' + B().colName(c); }
  function findCol(ctx, tab, r, name){
    var n = norm(name), C = cols(ctx, tab, r), m;
    if(n in C.byName) return C.byName[n];
    if((m = /^col ([a-z]{1,3})$/.exec(n))) return B().colNum(m[1].toUpperCase());
    return 0;
  }
  function inMonths(c){ return c >= 2 && c <= 13; }

  /* ---------------------------------------------------------------- Excel -> plain words */
  /* Her formula in pieces, keeping what Excel's $ says: "$B$29" is one fixed box wherever the
     formula sits; "B8" in column B is "the same month". */
  function lexX(f){
    var out = [], i = 0, m;
    while(i < f.length){
      var rest = f.slice(i), ch = f.charAt(i);
      if(/\s/.test(ch)){ i++; continue; }
      if((m = /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!)/.exec(rest))){ out.push({k:'err', v:m[0]}); i += m[0].length; continue; }
      if((m = /^(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/.exec(rest))){ out.push({k:'num', v:m[1]}); i += m[0].length; continue; }
      if((m = /^('(?:[^']|'')*'|[A-Za-z_][\w.]*)!/.exec(rest))){ out.push({k:'sheet', v:m[1].charAt(0) === "'" ? m[1].slice(1, -1).replace(/''/g, "'") : m[1], raw:m[0]}); i += m[0].length; continue; }
      if((m = /^(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/.exec(rest))){ out.push({k:'ref', absC:m[1] === '$', col:m[2], c:B().colNum(m[2]), r:+m[4], raw:m[0]}); i += m[0].length; continue; }
      if((m = /^([A-Z][A-Z0-9.]*)\(/.exec(rest))){ out.push({k:'fn', v:m[1]}); i += m[1].length; continue; }
      if('+-*/(),:'.indexOf(ch) >= 0){ out.push({k:ch}); i++; continue; }
      throw friendly('Home-Brace can’t read part of this formula: ' + rest.slice(0, 12));
    }
    return out;
  }
  /* "The same month" only where it means that: the formula sits under a month (or Total) heading and
     the box it uses is under the same heading. Anywhere else - the Dashboard's year tables - every
     box says its column. */
  function grid(h){ return SHORT.indexOf(h) >= 0 || h === 'Total'; }
  function nameRef(ctx, tab, me, sheet, p, q, raw){
    var T = sheet || tab, other = T !== tab;
    if(!ctx.tpl.sheets[T] || (q && q.r !== p.r)) return '{' + raw + '}';
    var self = !other && p.r === me.r, mine = colName(ctx, tab, me.c, me.r);
    var same = function(x){ return !x.absC && x.c === me.c && grid(mine) && colName(ctx, T, x.c, x.r) === mine; };
    var here = SHORT.indexOf(mine) >= 0 ? 'this month' : 'this column';
    var cp;
    if(!q) cp = !self && same(p) ? '' : colName(ctx, T, p.c, p.r);
    else { var e1 = same(p) ? here : colName(ctx, T, p.c, p.r), e2 = same(q) ? here : colName(ctx, T, q.c, q.r); cp = e1 === e2 ? e1 : e1 + '–' + e2; }
    return '[' + (other ? T + ' › ' : '') + (self ? 'this row' : rowName(ctx.tpl, T, p.r)) + (cp ? ' · ' + cp : '') + ']';
  }
  /* Walk a formula's pieces, giving each box (or run of boxes) to `box`; joins the rest readably. */
  function render(f, box){
    var t = lexX(String(f)), out = [], operand = false;
    for(var i = 0; i < t.length; i++){
      var k = t[i];
      if(k.k === 'sheet' || k.k === 'ref'){
        var sheet = null, raw = '';
        if(k.k === 'sheet'){ sheet = k.v; raw = k.raw; k = t[++i];
          if(!k || k.k !== 'ref'){ out.push(raw + (k && k.k === 'err' ? k.v : '')); operand = true; continue; } }
        var p = k, q = null; raw += p.raw;
        if(t[i + 1] && t[i + 1].k === ':' && t[i + 2] && t[i + 2].k === 'ref'){ q = t[i + 2]; raw += ':' + q.raw; i += 2; }
        out.push(box(sheet, p, q, raw)); operand = true; continue;
      }
      if(k.k === 'num' || k.k === 'err'){ out.push(k.v); operand = true; continue; }
      if(k.k === 'fn'){ out.push(k.v); operand = false; continue; }
      if(k.k === '('){ out.push('('); operand = false; continue; }
      if(k.k === ')'){ out.push(')'); operand = true; continue; }
      if(k.k === ','){ out.push(', '); operand = false; continue; }
      if(k.k === ':'){ out.push(':'); operand = false; continue; }
      var sym = {'+':'+', '-':'-', '*':'×', '/':'÷'}[k.k];
      out.push(operand ? ' ' + sym + ' ' : sym); operand = false;
    }
    return out.join('');
  }
  function toNamed(ctx, tab, a, f){
    var me = split(a);
    return render(f, function(sheet, p, q, raw){ return nameRef(ctx, tab, me, sheet, p, q, raw); });
  }

  /* ---------------------------------------------------------------- plain words -> Excel */
  function lexN(s){
    var out = [], i = 0, m; s = String(s == null ? '' : s).replace(/^\s*=/, '');
    var operand = function(){ var l = out[out.length - 1]; return !!l && /^(name|raw|num|err|\))$/.test(l.k); };
    while(i < s.length){
      var ch = s.charAt(i), rest = s.slice(i);
      if(/\s/.test(ch)){ i++; continue; }
      if(ch === '['){ var j = s.indexOf(']', i); if(j < 0) throw friendly('A [ isn’t closed with ].'); out.push({k:'name', v:s.slice(i + 1, j)}); i = j + 1; continue; }
      if(ch === ']') throw friendly('There’s a ] without its [.');
      if(ch === '{'){ var j2 = s.indexOf('}', i); if(j2 < 0) throw friendly('A { isn’t closed with }.'); out.push({k:'raw', v:s.slice(i + 1, j2).trim()}); i = j2 + 1; continue; }
      if((m = /^(\d+\.?\d*|\.\d+)(%?)/.exec(rest))){ out.push({k:'num', v:m[2] ? String(+(Number(m[1]) / 100).toPrecision(12)) : m[1]}); i += m[0].length; continue; }
      if((m = /^(sum|average)\s*(?=\()/i.exec(rest))){ out.push({k:'fn', v:m[1].toUpperCase()}); i += m[0].length; continue; }
      if((m = /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!)/i.exec(rest))){ out.push({k:'err', v:m[0].toUpperCase()}); i += m[0].length; continue; }
      if(ch === '×' || ch === '*' || ((ch === 'x' || ch === 'X') && operand() && /^[xX](\s|\d|\.|\[|\{|\()/.test(rest))){ out.push({k:'*'}); i++; continue; }
      if(ch === '÷' || ch === '/'){ out.push({k:'/'}); i++; continue; }
      if(ch === '-' || ch === '−' || ch === '–' || ch === '—'){ out.push({k:'-'}); i++; continue; }
      if('+(),'.indexOf(ch) >= 0){ out.push({k:ch}); i++; continue; }
      var w = /^[^\s\[\]{}()+\-*/,×÷−–—]+/.exec(rest);
      throw friendly('“' + (w ? w[0] : ch) + '” isn’t a row or a number. Row names go in [ ] - the easy way is “Add a row”.');
    }
    return out;
  }
  function findTab(ctx, name){
    var n = norm(name), hit = ctx.tpl.names.filter(function(s){ return norm(s) === n; })[0];
    if(hit) return hit;
    var W = global.PH_WB;                                   // an office's own name: "Carlsbad" for "Carlsbad (FFO)"
    if(W && W.TABS){ var o = Object.keys(W.TABS).filter(function(k){ return norm(k) === n; })[0]; if(o && ctx.tpl.sheets[W.TABS[o]]) return W.TABS[o]; }
    return null;
  }
  function refFor(ctx, tab, me, inner){
    var s = String(inner).trim(), T = tab, m;
    var gt = s.indexOf('›');
    if(gt >= 0){ var tn = s.slice(0, gt).trim(); T = findTab(ctx, tn); if(!T) throw friendly('There’s no tab called “' + tn + '”.'); s = s.slice(gt + 1).trim(); }
    else if((m = /^(.+?)\s+>\s+(.+)$/.exec(s)) && findTab(ctx, m[1])){ T = findTab(ctx, m[1]); s = m[2].trim(); }
    var cp = null, dot = s.lastIndexOf('·');
    if(dot >= 0){ cp = s.slice(dot + 1).trim(); s = s.slice(0, dot).trim(); }
    var other = T !== tab, r;
    if(/^this row$/i.test(s)){ if(other) throw friendly('“this row” is a row of this tab - on ' + T + ', name the row.'); r = me.r; }
    else { r = findRow(ctx.tpl, T, s); if(!r) throw friendly('There’s no row called “' + s + '” on ' + T + '. Pick it with “Add a row”.'); }
    var pre = other ? quote(T) + '!' : '', here = function(x){ return /^this (month|column)$/i.test(x); };
    var itself = function(c){ if(!other && r === me.r && c === me.c) throw friendly('[' + inner + '] is this very box - a box can’t be worked out from itself.'); };
    if(cp == null || cp === '' || here(cp)){ itself(me.c); return pre + B().colName(me.c) + r; }
    var seps = ['–', '—', ' to ', '-'];
    for(var i = 0; i < seps.length; i++){
      var k = cp.toLowerCase().indexOf(seps[i]); if(k <= 0) continue;
      var l = cp.slice(0, k).trim(), rr = cp.slice(k + seps[i].length).trim();
      var end = function(x){ if(here(x)) return B().colName(me.c) + r; var c = findCol(ctx, T, r, x); return c ? '$' + B().colName(c) + '$' + r : null; };
      var a1 = end(l), a2 = end(rr); if(a1 && a2) return pre + a1 + ':' + a2;
    }
    var c = findCol(ctx, T, r, cp);
    if(!c) throw friendly('“' + rowName(ctx.tpl, T, r) + '” has no column called “' + cp + '”.');
    itself(c);
    return pre + '$' + B().colName(c) + '$' + r;
  }
  function fromNamed(ctx, tab, a, text){
    var t = lexN(text), me = split(a), out = '';
    if(!t.length) throw friendly('Type how it’s worked out.');
    t.forEach(function(k){
      if(k.k === 'name') out += refFor(ctx, tab, me, k.v);
      else if(k.k === 'raw' || k.k === 'num' || k.k === 'fn' || k.k === 'err') out += k.v;
      else out += k.k;
    });
    try{ B().parse(out); }catch(_){ throw friendly('That doesn’t read as a formula yet - check the ( ) and that there’s a + - × ÷ between each part.'); }
    return out;
  }

  /* ---------------------------------------------------------------- the numbers, for one month */
  function fmt(v){
    if(typeof v !== 'number') return v === '' || v == null ? '0' : String(v);
    return Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 10000) / 10000);
  }
  /* "112,000 × 1.04" - her formula with each box's number in its place (a run of boxes by name). */
  function explain(ctx, ev, tab, a, f){
    var me = split(a);
    return render(f, function(sheet, p, q, raw){
      var T = sheet || tab;
      if(q){ var nm = nameRef(ctx, tab, me, sheet, p, q, raw); return nm.replace(/^\[|\]$/g, ''); }
      return fmt(ev.value(T, p.col + p.r));
    });
  }

  /* ---------------------------------------------------------------- loops */
  /* Would this box end up worked out from itself? (Excel refuses that too.) */
  function loops(book, tab, a){
    var target = tab + '!' + a, seen = {};
    function refs(T, addr){
      var c = book.sheets[T] && book.sheets[T].cells[addr]; if(!c || c.f == null) return [];
      var t; try{ t = lexX(String(c.f)); }catch(_){ return []; }
      var out = [];
      for(var i = 0; i < t.length; i++){
        var k = t[i], sh = T;
        if(k.k === 'sheet'){ sh = k.v; k = t[++i]; if(!k || k.k !== 'ref') continue; }
        if(k.k !== 'ref') continue;
        if(t[i + 1] && t[i + 1].k === ':' && t[i + 2] && t[i + 2].k === 'ref'){ var q = t[i + 2]; i += 2;
          for(var r = Math.min(k.r, q.r); r <= Math.max(k.r, q.r); r++) for(var cc = Math.min(k.c, q.c); cc <= Math.max(k.c, q.c); cc++) out.push([sh, B().colName(cc) + r]); }
        else out.push([sh, k.col + k.r]);
      }
      return out;
    }
    var stack = refs(tab, a);
    while(stack.length){
      var x = stack.pop(), key = x[0] + '!' + x[1];
      if(key === target) return true;
      if(seen[key]) continue; seen[key] = 1;
      Array.prototype.push.apply(stack, refs(x[0], x[1]));
    }
    return false;
  }

  /* ---------------------------------------------------------------- a tab's rows, for the screen */
  /* The boxes a row has: Jan-Dec (and Total) under month headings; otherwise the row's own boxes.
     Never a box holding text. */
  function boxesOf(ctx, tab, r){
    var cs = cellsOf(ctx.tpl, tab), C = cols(ctx, tab, r), list = [], c;
    var months = true; for(c = 2; c <= 13; c++) if(C.heads[c] !== SHORT[c - 2]){ months = false; break; }
    if(months){ for(c = 2; c <= 13; c++) list.push(c); if(C.heads[14] || cs['N' + r]) list.push(14); }
    else Object.keys(cs).forEach(function(a){ var p = split(a); if(p.r === r && p.c >= 2 && list.indexOf(p.c) < 0) list.push(p.c); });
    return list.sort(function(x, y){ return x - y; }).filter(function(cc){ var x = cs[B().colName(cc) + r]; return !(x && x.f == null && typeof x.v === 'string' && x.v.trim()); });
  }
  function rowsOf(ctx, ev, tab){
    var cs = cellsOf(ctx.tpl, tab), d = (ctx.data && ctx.data[tab]) || {}, have = {};
    Object.keys(cs).forEach(function(a){ if(cs[a].f != null) have[split(a).r] = 1; });
    return Object.keys(have).map(Number).sort(function(x, y){ return x - y; }).map(function(r){
      var boxes = boxesOf(ctx, tab, r).map(function(c){
        var a = B().colName(c) + r, x = cs[a], typed = d[a];
        var kind = x && x.f != null ? 'formula' : typed != null && typed !== '' ? 'typed' : 'empty', named = null;
        if(kind === 'formula'){ try{ named = toNamed(ctx, tab, a, x.f); }catch(_){ named = '{=' + x.f + '}'; } }
        var v = ev ? ev.value(tab, a) : null;
        return {c:c, cell:a, head:colName(ctx, tab, c, r), kind:kind, named:named, f:kind === 'formula' ? x.f : null, typed:kind === 'typed' ? typed : null, value:v};
      });
      var groups = [];
      boxes.forEach(function(b){
        var key = b.kind + '|' + (b.named || ''), g = groups[groups.length - 1];
        if(g && g.key === key && g.boxes[g.boxes.length - 1].c === b.c - 1) g.boxes.push(b);
        else groups.push({key:key, kind:b.kind, named:b.named, boxes:[b]});
      });
      groups.forEach(function(g){ var f = g.boxes[0].head, l = g.boxes[g.boxes.length - 1].head; g.when = g.boxes.length > 1 ? f + '–' + l : f; g.cols = g.boxes.map(function(b){ return b.c; }); delete g.key; });
      return {row:r, name:rowName(ctx.tpl, tab, r), boxes:boxes, groups:groups};
    });
  }
  /* Every row that can go into a formula, for "Add a row": its name, and - for a row that is one
     number (a case fee) - that number's column, so it goes in as that one fixed box. Which kind a
     row is comes from how her own formulas already use it ($B$29 everywhere = one box); a row no
     formula uses yet counts as one box only when it holds a single number. */
  function picks(ctx){
    var out = [], used = {};
    ctx.tpl.names.forEach(function(tab){
      var cs = cellsOf(ctx.tpl, tab);
      Object.keys(cs).forEach(function(a){
        if(cs[a].f == null) return; var me = split(a), t;
        try{ t = lexX(String(cs[a].f)); }catch(_){ return; }
        for(var i = 0; i < t.length; i++){
          var k = t[i], T = tab;
          if(k.k === 'sheet'){ T = k.v; k = t[++i]; }
          if(!k || k.k !== 'ref') continue;
          if(t[i + 1] && t[i + 1].k === ':'){ i += 2; continue; }               // runs of boxes say nothing about it
          var u = used[T + '|' + k.r] = used[T + '|' + k.r] || {same:0, fixed:{}};
          if(!k.absC && k.c === me.c) u.same++; else u.fixed[k.c] = (u.fixed[k.c] || 0) + 1;
        }
      });
    });
    ctx.tpl.names.forEach(function(tab){
      var cs = cellsOf(ctx.tpl, tab), d = (ctx.data && ctx.data[tab]) || {}, R = rows(ctx.tpl, tab);
      R.list.forEach(function(r){
        var full = [];
        for(var c = 2; c <= Math.max(R.maxC, 14); c++){ var a = B().colName(c) + r; if((cs[a] && cs[a].f != null) || (d[a] != null && d[a] !== '')) full.push(c); }
        if(!label(ctx.tpl, tab, r) && !full.length) return;
        var u = used[tab + '|' + r], fixed = u ? Object.keys(u.fixed).map(Number) : [];
        var one = u ? (!u.same && fixed.length === 1 ? fixed[0] : 0) : (full.length === 1 ? full[0] : 0);
        out.push({tab:tab, row:r, name:R.byRow[r], one:one ? colName(ctx, tab, one, r) : ''});
      });
    });
    return out;
  }

  global.PH_FX = {toNamed:toNamed, fromNamed:fromNamed, explain:explain, loops:loops, rowsOf:rowsOf, picks:picks,
                  rowName:rowName, colName:colName, findRow:findRow, findCol:findCol, boxesOf:boxesOf, headOf:headOf, norm:norm, friendly:friendly};
  if(typeof module !== 'undefined' && module.exports) module.exports = global.PH_FX;
})(typeof window !== 'undefined' ? window : globalThis);
